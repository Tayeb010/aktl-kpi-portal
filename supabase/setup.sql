-- =====================================================================
-- AKTL Sitakunda KPI Portal: database setup
-- Paste this whole file into Supabase > SQL Editor > New query, then Run.
--
-- BEFORE YOU RUN: scroll to the very bottom and replace
--   CHANGE-THIS-PASSWORD
-- with the password you want for your own admin login (login ID: tayeb).
--
-- Safe to run again later: it only adds what is missing.
-- =====================================================================

create extension if not exists pgcrypto with schema extensions;
create schema if not exists private;

-- ---------------------------------------------------------------------
-- Tables
-- ---------------------------------------------------------------------

-- One row per person who can sign in (all 26 users).
create table if not exists public.profiles (
  id          uuid primary key references auth.users(id) on delete cascade,
  login_id    text not null unique,
  name        text not null,
  role        text not null check (role in ('admin','viewall','dso','dsr')),
  dsr_code    text unique,            -- e.g. Dsr_Aktl(sitakunda)_107484_16 (DSRs only)
  active      boolean not null default true,
  created_at  timestamptz not null default now()
);

-- Devices each person has signed in on (max 2, admin exempt).
create table if not exists public.devices (
  user_id     uuid not null references public.profiles(id) on delete cascade,
  device_id   text not null,
  device_name text,
  first_seen  timestamptz not null default now(),
  last_seen   timestamptz not null default now(),
  primary key (user_id, device_id)
);

-- Simple key/value settings controlled by the admin.
create table if not exists public.settings (
  key   text primary key,
  value jsonb not null
);
insert into public.settings(key, value) values
  ('dsr_summary', 'false'::jsonb),
  ('dsr_summary_mode', '"totals"'::jsonb)
on conflict (key) do nothing;

-- Every published upload is kept as a version. Exactly one is live per KPI.
create table if not exists public.batches (
  id           uuid primary key default gen_random_uuid(),
  kpi          text not null default 'SQR',
  file_name    text,
  period       jsonb,
  carried      jsonb not null default '[]'::jsonb,
  is_live      boolean not null default false,
  published_at timestamptz not null default now(),
  published_by uuid references public.profiles(id) on delete set null
);
create unique index if not exists batches_one_live_per_kpi on public.batches(kpi) where is_live;

-- KPI figures: one row per DSR per version. "data" holds the numbers.
create table if not exists public.dsr_figures (
  batch_id  uuid not null references public.batches(id) on delete cascade,
  dsr_code  text not null,
  dsr_name  text not null,
  data      jsonb not null,
  primary key (batch_id, dsr_code)
);

-- Retailer list per DSR per version (no phone numbers are stored).
create table if not exists public.retailers (
  batch_id  uuid not null references public.batches(id) on delete cascade,
  dsr_code  text not null,
  items     jsonb not null default '[]'::jsonb,
  primary key (batch_id, dsr_code)
);

-- Log of manual corrections.
create table if not exists public.corrections (
  id              bigint generated always as identity primary key,
  batch_id        uuid references public.batches(id) on delete cascade,
  dsr_code        text not null,
  dsr_name        text,
  field           text not null,
  old_value       numeric,
  new_value       numeric,
  reason          text not null,
  changed_by      uuid references public.profiles(id) on delete set null,
  changed_by_name text,
  changed_at      timestamptz not null default now()
);

-- ---------------------------------------------------------------------
-- Helper functions (private schema is not reachable from the website)
-- ---------------------------------------------------------------------

create or replace function private.my_role() returns text
language sql stable security definer set search_path = '' as $$
  select role from public.profiles where id = auth.uid() and active
$$;

create or replace function private.my_dsr_code() returns text
language sql stable security definer set search_path = '' as $$
  select dsr_code from public.profiles where id = auth.uid() and active
$$;

create or replace function private.is_staff() returns boolean
language sql stable security definer set search_path = '' as $$
  select coalesce(private.my_role() in ('admin','viewall','dso'), false)
$$;

create or replace function private.is_admin() returns boolean
language sql stable security definer set search_path = '' as $$
  select coalesce(private.my_role() = 'admin', false)
$$;

create or replace function private.login_email(p_login text) returns text
language sql immutable set search_path = '' as $$
  select lower(trim(p_login)) || '@aktl-kpi.local'
$$;

create or replace function private.check_login(p_login text) returns text
language plpgsql immutable set search_path = '' as $$
declare v text := lower(trim(coalesce(p_login, '')));
begin
  if v !~ '^[a-z0-9._-]{2,40}$' then
    raise exception 'Login ID can use letters, numbers, dot, dash or underscore (2 to 40 characters).';
  end if;
  return v;
end $$;

-- Creates a sign-in account. Only called by the admin functions below.
create or replace function private.create_auth_user(
  p_login text, p_password text, p_name text, p_role text, p_dsr_code text
) returns uuid
language plpgsql security definer set search_path = '' as $$
declare
  v_id    uuid := gen_random_uuid();
  v_login text := private.check_login(p_login);
  v_email text := private.login_email(p_login);
begin
  if coalesce(length(p_password), 0) < 6 then
    raise exception 'Password must be at least 6 characters.';
  end if;
  if coalesce(trim(p_name), '') = '' then
    raise exception 'Enter a name.';
  end if;
  if p_role not in ('admin','viewall','dso','dsr') then
    raise exception 'Unknown role.';
  end if;
  if exists (select 1 from public.profiles where login_id = v_login)
     or exists (select 1 from auth.users where email = v_email) then
    raise exception 'That login ID is already used.';
  end if;
  if nullif(trim(p_dsr_code), '') is not null
     and exists (select 1 from public.profiles where dsr_code = trim(p_dsr_code)) then
    raise exception 'That DSR already has an account.';
  end if;

  insert into auth.users (
    instance_id, id, aud, role, email, encrypted_password, email_confirmed_at,
    raw_app_meta_data, raw_user_meta_data, created_at, updated_at,
    confirmation_token, recovery_token, email_change_token_new, email_change
  ) values (
    '00000000-0000-0000-0000-000000000000', v_id, 'authenticated', 'authenticated',
    v_email, extensions.crypt(p_password, extensions.gen_salt('bf')), now(),
    '{"provider":"email","providers":["email"]}'::jsonb,
    jsonb_build_object('name', p_name), now(), now(), '', '', '', ''
  );

  insert into auth.identities (
    id, user_id, provider_id, identity_data, provider, last_sign_in_at, created_at, updated_at
  ) values (
    gen_random_uuid(), v_id, v_id::text,
    jsonb_build_object('sub', v_id::text, 'email', v_email, 'email_verified', true),
    'email', now(), now(), now()
  );

  insert into public.profiles (id, login_id, name, role, dsr_code)
  values (v_id, v_login, trim(p_name), p_role, nullif(trim(p_dsr_code), ''));

  return v_id;
end $$;

-- ---------------------------------------------------------------------
-- Security rules (Row Level Security)
-- Nobody can write to tables directly; all changes go through the
-- functions below, which check the person's role first.
-- ---------------------------------------------------------------------

alter table public.profiles    enable row level security;
alter table public.devices     enable row level security;
alter table public.settings    enable row level security;
alter table public.batches     enable row level security;
alter table public.dsr_figures enable row level security;
alter table public.retailers   enable row level security;
alter table public.corrections enable row level security;

revoke insert, update, delete, truncate on
  public.profiles, public.devices, public.settings, public.batches,
  public.dsr_figures, public.retailers, public.corrections
from anon, authenticated;
revoke all on
  public.profiles, public.devices, public.settings, public.batches,
  public.dsr_figures, public.retailers, public.corrections
from anon;

grant usage on schema public to authenticated;
grant select on
  public.profiles, public.devices, public.settings, public.batches,
  public.dsr_figures, public.retailers, public.corrections
to authenticated;

grant usage on schema private to authenticated;
grant execute on function private.my_role(), private.my_dsr_code(),
  private.is_staff(), private.is_admin() to authenticated;
revoke all on function private.create_auth_user(text, text, text, text, text) from public, anon, authenticated;

drop policy if exists profiles_read on public.profiles;
create policy profiles_read on public.profiles for select to authenticated
  using (id = auth.uid() or private.is_staff());

drop policy if exists devices_read on public.devices;
create policy devices_read on public.devices for select to authenticated
  using (user_id = auth.uid() or private.is_admin());

drop policy if exists settings_read on public.settings;
create policy settings_read on public.settings for select to authenticated
  using (private.my_role() is not null);

drop policy if exists batches_read on public.batches;
create policy batches_read on public.batches for select to authenticated
  using (private.my_role() is not null);

drop policy if exists figures_read on public.dsr_figures;
create policy figures_read on public.dsr_figures for select to authenticated
  using (private.is_staff() or dsr_code = private.my_dsr_code());

drop policy if exists retailers_read on public.retailers;
create policy retailers_read on public.retailers for select to authenticated
  using (private.is_staff() or dsr_code = private.my_dsr_code());

drop policy if exists corrections_read on public.corrections;
create policy corrections_read on public.corrections for select to authenticated
  using (private.is_admin());

-- ---------------------------------------------------------------------
-- Functions the website calls
-- ---------------------------------------------------------------------

-- Records this device. Refuses a 3rd device (admin is exempt).
create or replace function public.register_device(p_device_id text, p_device_name text)
returns text language plpgsql security definer set search_path = '' as $$
declare v_role text := private.my_role();
begin
  if v_role is null then raise exception 'account_off'; end if;
  if exists (select 1 from public.devices where user_id = auth.uid() and device_id = p_device_id) then
    update public.devices set last_seen = now() where user_id = auth.uid() and device_id = p_device_id;
    return 'ok';
  end if;
  if v_role <> 'admin'
     and (select count(*) from public.devices where user_id = auth.uid()) >= 2 then
    raise exception 'device_limit';
  end if;
  insert into public.devices (user_id, device_id, device_name)
  values (auth.uid(), left(p_device_id, 80), left(p_device_name, 60));
  return 'ok';
end $$;

create or replace function public.admin_create_account(
  p_login text, p_password text, p_name text, p_role text, p_dsr_code text
) returns uuid language plpgsql security definer set search_path = '' as $$
begin
  if not private.is_admin() then raise exception 'Only the admin can create accounts.'; end if;
  return private.create_auth_user(p_login, p_password, p_name, p_role, p_dsr_code);
end $$;

create or replace function public.admin_update_account(
  p_id uuid, p_login text, p_name text, p_role text, p_dsr_code text, p_active boolean
) returns void language plpgsql security definer set search_path = '' as $$
declare v_login text := private.check_login(p_login);
begin
  if not private.is_admin() then raise exception 'Only the admin can change accounts.'; end if;
  if p_id = auth.uid() and (not p_active or p_role <> 'admin') then
    raise exception 'You cannot turn off or change your own admin account.';
  end if;
  if p_role not in ('admin','viewall','dso','dsr') then raise exception 'Unknown role.'; end if;
  if coalesce(trim(p_name), '') = '' then raise exception 'Enter a name.'; end if;
  if exists (select 1 from public.profiles where login_id = v_login and id <> p_id) then
    raise exception 'That login ID is already used.';
  end if;
  if nullif(trim(p_dsr_code), '') is not null
     and exists (select 1 from public.profiles where dsr_code = trim(p_dsr_code) and id <> p_id) then
    raise exception 'That DSR already has an account.';
  end if;

  update public.profiles
     set login_id = v_login, name = trim(p_name), role = p_role,
         dsr_code = nullif(trim(p_dsr_code), ''), active = p_active
   where id = p_id;
  if not found then raise exception 'Account not found.'; end if;

  update auth.users
     set email = private.login_email(v_login),
         banned_until = case when p_active then null else 'infinity'::timestamptz end,
         updated_at = now()
   where id = p_id;
  update auth.identities
     set identity_data = identity_data || jsonb_build_object('email', private.login_email(v_login)),
         updated_at = now()
   where user_id = p_id and provider = 'email';

  if not p_active then delete from public.devices where user_id = p_id; end if;
end $$;

create or replace function public.admin_set_password(p_id uuid, p_password text)
returns void language plpgsql security definer set search_path = '' as $$
begin
  if not private.is_admin() then raise exception 'Only the admin can set passwords.'; end if;
  if coalesce(length(p_password), 0) < 6 then raise exception 'Password must be at least 6 characters.'; end if;
  update auth.users
     set encrypted_password = extensions.crypt(p_password, extensions.gen_salt('bf')), updated_at = now()
   where id = p_id;
  if not found then raise exception 'Account not found.'; end if;
end $$;

create or replace function public.admin_clear_devices(p_id uuid)
returns void language plpgsql security definer set search_path = '' as $$
begin
  if not private.is_admin() then raise exception 'Only the admin can remove devices.'; end if;
  delete from public.devices where user_id = p_id;
end $$;

create or replace function public.set_setting(p_key text, p_value jsonb)
returns void language plpgsql security definer set search_path = '' as $$
begin
  if not private.is_admin() then raise exception 'Only the admin can change settings.'; end if;
  if p_key not in ('dsr_summary','dsr_summary_mode') then raise exception 'Unknown setting.'; end if;
  insert into public.settings(key, value) values (p_key, p_value)
  on conflict (key) do update set value = excluded.value;
end $$;

-- Publishes a new version and makes it live, in one step.
create or replace function public.publish_batch(
  p_kpi text, p_file text, p_period jsonb, p_carried jsonb, p_figures jsonb, p_retailers jsonb
) returns uuid language plpgsql security definer set search_path = '' as $$
declare v_id uuid; v_kpi text := coalesce(nullif(p_kpi, ''), 'SQR');
begin
  -- The admin (website Upload page) or the GitHub publisher (secret/service_role key) may publish.
  if not (private.is_admin() or coalesce(auth.role(), '') = 'service_role') then raise exception 'Only the admin can publish.'; end if;
  if jsonb_typeof(p_figures) <> 'array' or jsonb_array_length(p_figures) = 0 then
    raise exception 'No DSR figures to publish.';
  end if;

  insert into public.batches (kpi, file_name, period, carried, is_live, published_by)
  values (v_kpi, left(p_file, 200), p_period, coalesce(p_carried, '[]'::jsonb), false, auth.uid())
  returning id into v_id;

  insert into public.dsr_figures (batch_id, dsr_code, dsr_name, data)
  select v_id, f->>'code', coalesce(nullif(f->>'name', ''), f->>'code'), f->'data'
    from jsonb_array_elements(p_figures) f;

  insert into public.retailers (batch_id, dsr_code, items)
  select v_id, r->>'code', coalesce(r->'items', '[]'::jsonb)
    from jsonb_array_elements(coalesce(p_retailers, '[]'::jsonb)) r;

  update public.batches set is_live = false where kpi = v_kpi and is_live;
  update public.batches set is_live = true where id = v_id;
  return v_id;
end $$;

-- Makes an earlier version live again.
create or replace function public.set_live_batch(p_id uuid)
returns void language plpgsql security definer set search_path = '' as $$
declare v_kpi text;
begin
  if not private.is_admin() then raise exception 'Only the admin can change the live version.'; end if;
  select kpi into v_kpi from public.batches where id = p_id;
  if v_kpi is null then raise exception 'Version not found.'; end if;
  update public.batches set is_live = false where kpi = v_kpi and is_live;
  update public.batches set is_live = true where id = p_id;
end $$;

-- Corrects one figure for one DSR in the live version, and logs it.
create or replace function public.correct_figure(
  p_dsr_code text, p_field text, p_value numeric, p_reason text
) returns void language plpgsql security definer set search_path = '' as $$
declare v_batch uuid; v_data jsonb; v_name text; v_old numeric;
begin
  if not private.is_admin() then raise exception 'Only the admin can correct figures.'; end if;
  if p_field not in ('active','target','qrSuccess','qrTarget','requests','completed',
                     'sqrAmt','c2sAmt','incVis','incTrx','incTotal') then
    raise exception 'This figure cannot be corrected.';
  end if;
  if coalesce(trim(p_reason), '') = '' then raise exception 'Add a reason for the correction.'; end if;
  if p_value is null then raise exception 'Enter the new value.'; end if;

  select id into v_batch from public.batches where kpi = 'SQR' and is_live;
  if v_batch is null then raise exception 'Nothing is published yet.'; end if;

  select data, dsr_name into v_data, v_name
    from public.dsr_figures where batch_id = v_batch and dsr_code = p_dsr_code for update;
  if not found then raise exception 'That DSR is not in the live data.'; end if;

  v_old := nullif(v_data->>p_field, '')::numeric;
  update public.dsr_figures
     set data = jsonb_set(data, array[p_field], to_jsonb(p_value))
   where batch_id = v_batch and dsr_code = p_dsr_code;

  insert into public.corrections (batch_id, dsr_code, dsr_name, field, old_value, new_value, reason, changed_by, changed_by_name)
  values (v_batch, p_dsr_code, v_name, p_field, v_old, p_value, trim(p_reason), auth.uid(),
          (select name from public.profiles where id = auth.uid()));
end $$;

-- Team summary. DSRs only get it when the admin has switched it on,
-- and only get names/ranking when "show names and ranking" is on.
drop function if exists public.team_summary();
create or replace function public.team_summary(p_kpi text default 'SQR')
returns jsonb language plpgsql stable security definer set search_path = '' as $$
declare
  v_role  text := private.my_role();
  v_on    boolean;
  v_mode  text;
  v_batch uuid;
  v_tot   jsonb;
  v_rank  jsonb;
begin
  if v_role is null then raise exception 'account_off'; end if;
  v_on   := coalesce((select (value #>> '{}')::boolean from public.settings where key = 'dsr_summary'), false);
  v_mode := coalesce((select value #>> '{}' from public.settings where key = 'dsr_summary_mode'), 'totals');
  if v_role = 'dsr' and not v_on then return null; end if;

  select id into v_batch from public.batches where kpi = coalesce(nullif(p_kpi, ''), 'SQR') and is_live;
  if v_batch is null then return null; end if;

  -- Trade Visibility: POS and visit counts
  if p_kpi = 'TV' then
    select jsonb_build_object(
      'pos', coalesce(sum((data->>'pos')::numeric), 0),
      'v1',  coalesce(sum((data->>'v1')::numeric), 0),
      'v2',  coalesce(sum((data->>'v2')::numeric), 0),
      'n',   count(*)
    ) into v_tot from public.dsr_figures where batch_id = v_batch;
    if v_role <> 'dsr' or v_mode = 'ranked' then
      select jsonb_agg(jsonb_build_object('code', dsr_code, 'name', dsr_name,
        'pos', data->'pos', 'v1', data->'v1', 'v2', data->'v2'))
      into v_rank from public.dsr_figures where batch_id = v_batch;
    end if;
    return jsonb_build_object('totals', v_tot, 'ranking', v_rank, 'mode', v_mode);
  end if;

  select jsonb_build_object(
    'active',    coalesce(sum((data->>'active')::numeric), 0),
    'target',    coalesce(sum((data->>'target')::numeric), 0),
    'qrSuccess', coalesce(sum((data->>'qrSuccess')::numeric), 0),
    'qrTarget',  coalesce(sum((data->>'qrTarget')::numeric), 0),
    'sqrAmt',    coalesce(sum((data->>'sqrAmt')::numeric), 0),
    'c2sAmt',    coalesce(sum((data->>'c2sAmt')::numeric), 0),
    'n',         count(*),
    'atTarget',  count(*) filter (where (data->>'target')::numeric > 0
                                   and (data->>'active')::numeric >= (data->>'target')::numeric)
  ) into v_tot
  from public.dsr_figures where batch_id = v_batch;

  if v_role <> 'dsr' or v_mode = 'ranked' then
    select jsonb_agg(jsonb_build_object(
      'code', dsr_code, 'name', dsr_name,
      'active', data->'active', 'target', data->'target',
      'qrSuccess', data->'qrSuccess', 'qrTarget', data->'qrTarget'))
    into v_rank
    from public.dsr_figures where batch_id = v_batch;
  end if;

  return jsonb_build_object('totals', v_tot, 'ranking', v_rank, 'mode', v_mode);
end $$;

revoke all on function
  public.register_device(text, text),
  public.admin_create_account(text, text, text, text, text),
  public.admin_update_account(uuid, text, text, text, text, boolean),
  public.admin_set_password(uuid, text),
  public.admin_clear_devices(uuid),
  public.set_setting(text, jsonb),
  public.publish_batch(text, text, jsonb, jsonb, jsonb, jsonb),
  public.set_live_batch(uuid),
  public.correct_figure(text, text, numeric, text),
  public.team_summary(text)
from public, anon;
grant execute on function
  public.register_device(text, text),
  public.admin_create_account(text, text, text, text, text),
  public.admin_update_account(uuid, text, text, text, text, boolean),
  public.admin_set_password(uuid, text),
  public.admin_clear_devices(uuid),
  public.set_setting(text, jsonb),
  public.publish_batch(text, text, jsonb, jsonb, jsonb, jsonb),
  public.set_live_batch(uuid),
  public.correct_figure(text, text, numeric, text),
  public.team_summary(text)
to authenticated;
grant execute on function public.publish_batch(text, text, jsonb, jsonb, jsonb, jsonb) to service_role;

-- ---------------------------------------------------------------------
-- Your admin account (created only once).
-- Replace CHANGE-THIS-PASSWORD with your own password before running.
-- ---------------------------------------------------------------------
do $$
declare
  admin_password text := 'CHANGE-THIS-PASSWORD';   -- <== put your own password here (6+ characters)
begin
  if not exists (select 1 from public.profiles where login_id = 'tayeb') then
    if admin_password = 'CHANGE' || '-THIS-PASSWORD' then
      raise exception 'Replace CHANGE-THIS-PASSWORD at the bottom of the script with your own password, then run again.';
    end if;
    perform private.create_auth_user('tayeb', admin_password, 'Tayeb', 'admin', null);
  end if;
end $$;

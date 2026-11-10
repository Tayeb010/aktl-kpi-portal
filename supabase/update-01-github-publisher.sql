-- =====================================================================
-- Update 01: let the GitHub publisher publish SQR updates.
-- Paste into Supabase > SQL Editor > New query, then Run. Safe to run again.
-- (Already included in setup.sql for new installs.)
-- =====================================================================
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

grant execute on function public.publish_batch(text, text, jsonb, jsonb, jsonb, jsonb) to service_role;

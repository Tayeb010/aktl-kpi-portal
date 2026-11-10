-- =====================================================================
-- Update 02: Trade Visibility in the DSR "Team" tab.
-- Paste into Supabase > SQL Editor > New query, then Run. Safe to run again.
-- (Already included in setup.sql for new installs.)
-- Without this, everything works except that DSRs' Team tab shows SQR only.
-- =====================================================================
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

revoke all on function public.team_summary(text) from public, anon;
grant execute on function public.team_summary(text) to authenticated;

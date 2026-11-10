#!/usr/bin/env node
/* AKTL KPI Portal: KPI publisher (SQR, Trade Visibility).
 *
 *   node tools/kpi.cjs build <file.xlsx> [out.json]
 *     Reads the Excel with the same reader as the website (site/sqr-parse.js),
 *     detects the KPI, stops on any required-column error, and writes
 *     data/<kpi>/latest.json with figures and retailer lists only (no phone numbers).
 *
 *   node tools/kpi.cjs publish <data/<kpi>/latest.json> [...more]
 *     Publishes that JSON to Supabase as the new live SQR update. DSRs missing
 *     from the file keep their current figures, like the website's Upload page.
 *     Needs env SUPABASE_SECRET_KEY (secret / service_role key). Runs in GitHub Actions.
 */
'use strict';
const fs = require('fs');
const path = require('path');
const ROOT = path.resolve(__dirname, '..');
const SQR = require(path.join(ROOT, 'site', 'sqr-parse.js'));
const jsonFor = kpi => path.join(ROOT, 'data', String(kpi).toLowerCase(), 'latest.json');

const pct = (a, b) => (b ? Math.round((a / b) * 100) + '%' : '-');
const die = m => { console.error('\nERROR: ' + m); process.exit(1); };

function build(xlsxPath, outPath) {
  if (!xlsxPath || !fs.existsSync(xlsxPath)) die('Give the path to the SQR .xlsx file.');
  const XLSX = require('xlsx');
  const wb = XLSX.read(fs.readFileSync(xlsxPath), { type: 'buffer' });
  const fileName = path.basename(xlsxPath).replace(/^[0-9a-f]{8}-/, '');
  const sqrJson = jsonFor('SQR');
  const dsrIndex = fs.existsSync(sqrJson) ? JSON.parse(fs.readFileSync(sqrJson, 'utf8')).figures.map(f => ({ code: f.code, name: f.name })) : [];
  const r = SQR.parse(wb, XLSX, fileName, { dsrIndex });
  console.log(`File: ${fileName}  ·  KPI: ${r.kpi}  ·  layout: ${r.format || 'unknown'}  ·  sheets: ${r.sheetDsr || '-'} / ${r.sheetRet || '-'}`);
  console.log(`Period: ${r.period ? `${r.period.from} to ${r.period.to}${r.period.pulled ? ' (pulled ' + r.period.pulled + ')' : ''}` : 'not found'}`);
  r.issues.forEach(i => console.log(`  [${i.t.toUpperCase()}] ${i.m}`));
  if (r.issues.some(i => i.t === 'err')) die('Fix the errors above, nothing was written.');
  const figures = Object.values(r.dsrs).map(d => { const data = Object.assign({}, d); delete data.code; delete data.name; return { code: d.code, name: d.name, data }; })
    .sort((a, b) => String(a.name).localeCompare(String(b.name), undefined, { numeric: true }));
  const retailers = figures.map(f => ({ code: f.code, items: r.retailers[f.code] || [] }));
  const out = { kpi: r.kpi, fileName, format: r.format, period: r.period, builtAt: new Date().toISOString(), issues: r.issues, figures, retailers };
  outPath = outPath || jsonFor(r.kpi);
  fs.mkdirSync(path.dirname(outPath), { recursive: true });
  fs.writeFileSync(outPath, JSON.stringify(out, null, 1) + '\n');
  if (r.kpi === 'TV') {
    console.log(`\n${'DSR'.padEnd(10)} ${'POS'.padStart(5)} ${'1st done'.padStart(9)} ${'2nd done'.padStart(9)} ${'need both'.padStart(10)} ${'need 2nd'.padStart(9)}`);
    let P = 0, V1 = 0, V2 = 0;
    figures.forEach(f => { const d = f.data, it = r.retailers[f.code] || []; P += d.pos; V1 += d.v1; V2 += d.v2;
      console.log(`${f.name.padEnd(10)} ${String(d.pos).padStart(5)} ${(d.v1 + ' ' + pct(d.v1, d.pos)).padStart(9)} ${(d.v2 + ' ' + pct(d.v2, d.pos)).padStart(9)} ${String(it.filter(x => x.st === 'p').length).padStart(10)} ${String(it.filter(x => x.st === 'f').length).padStart(9)}`); });
    console.log(`${'TOTAL'.padEnd(10)} ${String(P).padStart(5)} ${(V1 + ' ' + pct(V1, P)).padStart(9)} ${(V2 + ' ' + pct(V2, P)).padStart(9)}`);
    console.log(`\n${figures.length} DSRs, ${r.retCount} POS still to visit -> ${path.relative(ROOT, outPath)}`);
    return;
  }
  console.log(`\n${'DSR'.padEnd(10)} ${'Active/Target'.padStart(14)} ${'%'.padStart(5)} ${'QR vis'.padStart(10)} ${'Super QR Tk'.padStart(12)}`);
  let A = 0, T = 0, Q = 0, QT = 0, S = 0;
  figures.forEach(f => { const d = f.data; A += d.active; T += d.target; Q += d.qrSuccess; QT += d.qrTarget; S += d.sqrAmt || 0;
    console.log(`${f.name.padEnd(10)} ${(d.active + '/' + d.target).padStart(14)} ${pct(d.active, d.target).padStart(5)} ${(d.qrSuccess + '/' + d.qrTarget).padStart(10)} ${String(d.sqrAmt == null ? '-' : d.sqrAmt).padStart(12)}`); });
  console.log(`${'TOTAL'.padEnd(10)} ${(A + '/' + T).padStart(14)} ${pct(A, T).padStart(5)} ${(Q + '/' + QT).padStart(10)} ${String(S).padStart(12)}`);
  console.log(`\n${figures.length} DSRs, ${r.retCount} retailers -> ${path.relative(ROOT, outPath)}`);
}

async function publish(jsonPath) {
  if (!jsonPath || !fs.existsSync(jsonPath)) die(`${jsonPath} not found.`);
  const key = process.env.SUPABASE_SECRET_KEY;
  if (!key) die('SUPABASE_SECRET_KEY is not set. Add it in GitHub > Settings > Secrets and variables > Actions.');
  const cfg = fs.readFileSync(path.join(ROOT, 'site', 'config.js'), 'utf8').match(/supabaseUrl:\s*'([^']+)'/);
  const url = process.env.SUPABASE_URL || (cfg && cfg[1]);
  if (!url) die('Could not find the Supabase URL in site/config.js.');
  const { createClient } = require('@supabase/supabase-js');
  const sb = createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
  const j = JSON.parse(fs.readFileSync(jsonPath, 'utf8'));
  if (!Array.isArray(j.figures) || !j.figures.length) die('The JSON has no DSR figures.');

  // Keep DSRs that are live now but missing from this file (same as the website's Upload page).
  const must = res => { if (res.error) die(res.error.message || JSON.stringify(res.error)); return res.data; };
  const live = must(await sb.from('batches').select('id,period').eq('kpi', j.kpi || 'SQR').eq('is_live', true).maybeSingle());
  const figs = new Map(), rets = new Map();
  let carried = [];
  if (live) {
    must(await sb.from('dsr_figures').select('dsr_code,dsr_name,data').eq('batch_id', live.id)).forEach(x => figs.set(x.dsr_code, { code: x.dsr_code, name: x.dsr_name, data: x.data }));
    must(await sb.from('retailers').select('dsr_code,items').eq('batch_id', live.id)).forEach(x => rets.set(x.dsr_code, x.items));
    const inFile = new Set(j.figures.map(f => f.code));
    carried = [...figs.values()].filter(f => !inFile.has(f.code)).map(f => f.name);
  }
  j.figures.forEach(f => figs.set(f.code, f));
  (j.retailers || []).forEach(r => rets.set(r.code, r.items));
  const figures = [...figs.values()];
  const retailers = figures.map(f => ({ code: f.code, items: rets.get(f.code) || [] }));

  const id = must(await sb.rpc('publish_batch', {
    p_kpi: j.kpi || 'SQR', p_file: j.fileName, p_period: j.period || (live && live.period) || null,
    p_carried: carried, p_figures: figures, p_retailers: retailers
  }));
  console.log(`Published ${j.fileName}: ${figures.length} DSR dashboards updated (batch ${id}).`);
  if (carried.length) console.log(`Kept current figures for ${carried.length} DSR(s) not in this file: ${carried.join(', ')}`);
  const accounts = must(await sb.from('profiles').select('dsr_code').eq('role', 'dsr'));
  const withLogin = new Set(accounts.map(a => a.dsr_code));
  const noLogin = figures.filter(f => !withLogin.has(f.code)).map(f => f.name);
  if (noLogin.length && (j.kpi || 'SQR') === 'SQR') console.log(`No login yet for: ${noLogin.join(', ')} (create them on the People page).`);
}

const [cmd, ...args] = process.argv.slice(2);
if (cmd === 'build') build(args[0], args[1]);
else if (cmd === 'publish') (async () => { if (!args.length) die('Give one or more data/<kpi>/latest.json files.'); for (const f of args) await publish(f); })().catch(e => die(e.message || String(e)));
else { console.log('Usage:\n  node tools/kpi.cjs build <file.xlsx> [out.json]\n  node tools/kpi.cjs publish data/<kpi>/latest.json [...]'); process.exit(cmd ? 1 : 0); }

/* AKTL KPI Portal: KPI Excel reader (SQR and Trade Visibility).
 * Shared by the website's Upload page (browser) and the GitHub publisher
 * (tools/sqr.mjs, Node), so both read a file exactly the same way.
 *
 * Trade Visibility ("TV"): a "DSR Summury" sheet (BCD POS, 1st Time Visit RT,
 *   2 Times Visit Retail) plus a "Retail Wise" sheet listing the POS still to visit:
 *   "Pending" = needs 1st and 2nd visit, "1st Times Done" = needs 2nd visit only.
 *   POS with both visits done are removed from that sheet. Each POS must be visited twice.
 *   DSRs are matched to logins by DSR number (e.g. "AKTL (Sitakunda) DSR 01" = "DSR-01").
 *   Retailer MSISDNs are cut to the last 4 digits.
 *
 * SQR understands two layouts:
 *   "summary": a "Summury"/summary sheet keyed by DSR Name (C2S Target, QR Target, ...)
 *              plus a retailer sheet with DSR Profile Code + COMPLETED Amount.
 *   "dsrwise": the older "DSR Wise" + "Retail Wise" layout keyed by DSR Profile Code.
 *
 * Definitions (from Tayeb):
 *   C2S target  = number of retailers targeted for a minimum 300 Tk transaction
 *   QR target   = number of retailers
 * Retailer EL phone numbers are never read.
 */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.SQRParse = factory();
})(typeof self !== 'undefined' ? self : this, function () {
'use strict';

const MIN_TK = 300;
const norm = v => String(v == null ? '' : v).toLowerCase().replace(/\s+/g, ' ').trim();
const yes = v => norm(v) === 'yes';
const num = v => { if (v == null || v === '') return 0; if (typeof v === 'number') return v; const n = parseFloat(String(v).replace(/,/g, '')); return isNaN(n) ? NaN : n; };

/* Older "DSR Wise" sheet: [key, Excel header, label, required] */
const FIELDS = [
  ['retailers', 'Retailers', 'Retailers', 1],
  ['hasRequest', 'Retailer has Request', 'Retailers with a request', 0],
  ['active', 'Retailer Trxn Active', 'Transaction active retailers', 1],
  ['target', '300 tk c2s Target', '300 Tk C2S target', 1],
  ['requests', 'Request Count', 'Requests', 0],
  ['completed', 'COMPLETED Request Count', 'Completed requests', 0],
  ['ticket', 'COMPLETED Ticket Size', 'Avg ticket size (Tk)', 0],
  ['sqrAmt', 'Super QR COMPLETED Amount', 'Super QR amount (Tk)', 0],
  ['c2sAmt', 'C2S Amount', 'C2S amount (Tk)', 0],
  ['qrTarget', 'QR Target', 'QR visibility target', 0],
  ['qrSuccess', 'QR Visibility Success', 'QR visibility success', 0],
  ['wrongQr', 'Wrong QR Placed', 'Wrong QR placed', 0],
  ['outside100', 'QR Place outside 100m', 'QR placed outside 100m', 0],
  ['latePhoto', 'Photo > 15 min after visit', 'Photo >15 min after visit', 0],
  ['robiActive', 'Retailer Trxn Active_Robi', 'Robi: active retailers', 0],
  ['robiReq', 'Request Count_Robi', 'Robi: requests', 0],
  ['robiSqr', 'Super QR COMPLETED Amount_Robi', 'Robi: Super QR Tk', 0],
  ['robiC2s', 'C2S Amount_Robi', 'Robi: C2S Tk', 0],
  ['cirActive', 'Retailer Trxn Active_Cirkle', 'Cirkle: active retailers', 0],
  ['cirReq', 'Request Count_Cirkle', 'Cirkle: requests', 0],
  ['cirSqr', 'Super QR COMPLETED Amount_Cirkle', 'Cirkle: Super QR Tk', 0],
  ['cirC2s', 'C2S Amount_Cirkle', 'Cirkle: C2S Tk', 0],
  ['incVis', 'Visibility Incentive', 'Visibility incentive (Tk)', 0],
  ['incTrx', 'Transaction Incentive', 'Transaction incentive (Tk)', 0],
  ['incTotal', 'SQR Incentive Total', 'SQR incentive total (Tk)', 0]
];

/* Newer summary sheet: [key, accepted headers, label, required] */
const SUMMARY = [
  ['retailers', ['retailers'], 'Retailers', 0],
  ['hasRequest', ['retailer has request'], 'Retailers with a request', 0],
  ['active', ['retailer trxn active'], 'Transaction active retailers', 1],
  ['target', ['c2s target', '300 tk c2s target'], 'C2S target (300 Tk+ retailers)', 1],
  ['qrTarget', ['qr target'], 'QR visibility target (= retailers)', 0],
  ['qrSuccess', ['qr visibility success'], 'QR visibility success', 1],
  ['wrongQr', ['wrong qr placed'], 'Wrong QR placed', 0],
  ['outside100', ['qr place outside 100m'], 'QR placed outside 100m', 0],
  ['latePhoto', ['photo > 15 min after visit'], 'Photo >15 min after visit', 0]
];

const LABEL = Object.assign(
  Object.fromEntries(FIELDS.map(f => [f[0], f[2]])),
  Object.fromEntries(SUMMARY.map(f => [f[0], f[2]])),
  { trxRet: 'Retailers with a completed transaction', zeroTk: 'Retailers with no completed transaction' }
);
const KPI_NAME = { SQR: 'SQR · Super QR', TV: 'Trade Visibility' };

function sheets(wb, XLSX) {
  return wb.SheetNames.map(sn => ({ sn, rows: XLSX.utils.sheet_to_json(wb.Sheets[sn], { header: 1, defval: null, raw: true, blankrows: false }) }));
}
function findHeader(rows, test) {
  const hi = rows.slice(0, 10).findIndex(r => r && test(r.map(norm)));
  return hi < 0 ? null : { hi, H: rows[hi].map(norm), raw: rows[hi] };
}
function readPeriod(texts) {
  const txt = texts.join(' | ');
  const m1 = txt.match(/(\d{1,2}-[A-Za-z]{3})\s*(?:to|\.{2,}|–|—)\s*(\d{1,2}-[A-Za-z]{3})/i);
  const m2 = txt.match(/pulled\s+(\d{1,2}-[A-Za-z]{3})/i);
  return m1 ? { from: m1[1], to: m1[2], pulled: m2 ? m2[1] : null } : null;
}
const titleText = (rows, hi) => rows.slice(0, hi).flat().filter(c => typeof c === 'string');

const dsrNo = s => { const m = String(s == null ? '' : s).match(/dsr\D{0,3}(\d+)\s*$/i) || String(s == null ? '' : s).match(/(\d+)\s*$/); return m ? +m[1] : null; };

/* opts.dsrIndex: [{ code, name }] of DSRs already known (from the live SQR data); used to match Trade Visibility rows. */
function parse(wb, XLSX, fileName, opts) {
  const all = sheets(wb, XLSX);
  const tv = all.find(s => findHeader(s.rows, H => H.includes('bcd pos') && H.some(h => h.startsWith('1st time visit'))));
  if (tv) return parseTv(all, tv, { fileName, kpi: 'TV', format: 'tv', issues: [], mapping: [], period: null, dsrs: {}, retailers: {}, retCount: 0, sheetDsr: null, sheetRet: null }, (opts && opts.dsrIndex) || []);
  const out = { fileName, kpi: 'SQR', format: null, issues: [], mapping: [], period: null, dsrs: {}, retailers: {}, retCount: 0, sheetDsr: null, sheetRet: null };
  const old = all.find(s => findHeader(s.rows, H => H.includes('dsr profile code') && H.includes('retailer trxn active')));
  if (old) return parseDsrWise(all, old, out);
  const sum = all.find(s => findHeader(s.rows, H => H.includes('dsr name') && H.includes('retailer trxn active') && !H.includes('dsr profile code')));
  if (sum) return parseSummary(all, sum, out);
  out.issues.push({ t: 'err', m: 'No SQR sheet found. It needs a header row with "Retailer Trxn Active" and either "DSR Profile Code" or "DSR Name".' });
  return out;
}

/* ---------- newer layout: Summury + retailer sheet ---------- */
function parseSummary(all, sum, out) {
  out.format = 'summary'; out.sheetDsr = sum.sn;
  const h = findHeader(sum.rows, H => H.includes('dsr name'));
  const col = names => { for (const n of names) { const i = h.H.indexOf(n); if (i >= 0) return i; } return -1; };
  out.mapping = SUMMARY.map(f => { const c = col(f[1]); return { k: f[0], label: f[2], req: !!f[3], col: c, header: c >= 0 ? h.raw[c] : null }; });
  out.mapping.filter(m => m.req && m.col < 0).forEach(m => out.issues.push({ t: 'err', m: `Required column missing in "${sum.sn}": "${SUMMARY.find(f => f[0] === m.k)[1][0]}".` }));

  // Retailer sheet gives each DSR's profile code (needed to match logins) and the retailer list.
  const ret = all.find(s => s !== sum && findHeader(s.rows, H => H.includes('dsr profile code') && H.includes('retailer code')));
  if (!ret) { out.issues.push({ t: 'err', m: 'No retailer sheet found. It needs "DSR Profile Code", "DSR Name" and "Retailer Code" columns, and is used to match each DSR to their login.' }); return out; }
  out.sheetRet = ret.sn;
  const rh = findHeader(ret.rows, H => H.includes('dsr profile code'));
  const ix = n => rh.H.indexOf(n);
  const c = { code: ix('dsr profile code'), dname: ix('dsr name'), rcode: ix('retailer code'), rname: ix('retailer name'), rname2: ix('retail name'), amt: ix('completed amount') >= 0 ? ix('completed amount') : ix('qr c2s amount'), vis: ix('qr visibility'), wrong: ix('wrong qr placed'), out: ix('qr place outside 100m'), late: ix('photo > 15 min after visit') };
  if (c.dname < 0) out.issues.push({ t: 'err', m: `"${ret.sn}" has no "DSR Name" column, so DSRs cannot be matched to the summary.` });
  if (c.amt < 0) out.issues.push({ t: 'err', m: `"${ret.sn}" has no "COMPLETED Amount" column.` });
  out.period = readPeriod(titleText(ret.rows, rh.hi).concat(titleText(sum.rows, h.hi)));
  if (!out.period) out.issues.push({ t: 'warn', m: 'Could not read the report period from the title row. Dashboards will show "Period not given".' });
  if (out.issues.some(i => i.t === 'err')) return out;

  const codeOf = {}, byCode = {}, conflict = new Set();
  let badAmt = 0;
  ret.rows.slice(rh.hi + 1).forEach(r => {
    if (!r || r[c.code] == null || r[c.code] === '') return;
    const code = String(r[c.code]).trim(), dn = String(r[c.dname] == null ? '' : r[c.dname]).trim();
    if (dn) { if (codeOf[dn] && codeOf[dn] !== code) conflict.add(dn); codeOf[dn] = code; }
    let amt = num(r[c.amt]); if (isNaN(amt)) { badAmt++; amt = 0; }
    const pick = (a, b) => { const v = a >= 0 ? r[a] : null; return v != null && v !== '' ? v : (b >= 0 ? r[b] : null); };
    const it = { code: String(r[c.rcode] == null ? '' : r[c.rcode]).trim(), name: String(pick(c.rname, c.rname2) || '').trim(), amt, rem: Math.max(0, MIN_TK - amt), done: amt >= MIN_TK, vis: c.vis >= 0 && yes(r[c.vis]) };
    if (c.wrong >= 0 && yes(r[c.wrong])) it.wrong = true;
    if (c.out >= 0 && yes(r[c.out])) it.out = true;
    if (c.late >= 0 && yes(r[c.late])) it.late = true;
    (byCode[code] = byCode[code] || []).push(it);
  });
  conflict.forEach(dn => out.issues.push({ t: 'err', m: `DSR name "${dn}" has more than one DSR Profile Code in "${ret.sn}".` }));
  if (badAmt) out.issues.push({ t: 'warn', m: `${badAmt} retailer amount cell(s) had text instead of a number and were read as 0.` });

  let skipped = 0, badNum = 0;
  const ni = h.H.indexOf('dsr name');
  sum.rows.slice(h.hi + 1).forEach((r, k) => {
    if (!r || r.every(v => v == null || v === '')) return;
    const name = String(r[ni] == null ? '' : r[ni]).trim();
    if (!name || /total/i.test(name)) { skipped++; return; }
    const code = codeOf[name];
    if (!code) { out.issues.push({ t: 'warn', m: `${name} is in "${sum.sn}" but has no retailers in "${ret.sn}", so it was skipped.` }); return; }
    if (out.dsrs[code]) { out.issues.push({ t: 'err', m: `${name} appears twice in "${sum.sn}" (row ${h.hi + k + 2}).` }); return; }
    const d = { code, name };
    out.mapping.forEach(m => { if (m.col < 0) return; let v = num(r[m.col]); if (isNaN(v)) { badNum++; v = 0; } d[m.k] = v; });
    const items = byCode[code] || [];
    if (d.retailers == null) d.retailers = items.length;
    if (d.qrTarget == null) d.qrTarget = d.retailers;               // QR target = number of retailers
    d.sqrAmt = items.reduce((s, x) => s + x.amt, 0);                  // Super QR completed Tk
    d.trxRet = items.filter(x => x.amt > 0).length;
    d.zeroTk = items.filter(x => x.amt <= 0).length;
    // Cross-checks between the summary and the retailer rows
    const act = items.filter(x => x.done).length, vis = items.filter(x => x.vis).length;
    if (items.length !== d.retailers) out.issues.push({ t: 'warn', m: `${name}: summary says ${d.retailers} retailers, retailer sheet has ${items.length}.` });
    if (act !== d.active) out.issues.push({ t: 'warn', m: `${name}: summary says ${d.active} transaction-active, retailer sheet has ${act} at 300 Tk+.` });
    if (vis !== d.qrSuccess) out.issues.push({ t: 'warn', m: `${name}: summary says ${d.qrSuccess} QR visible, retailer sheet has ${vis}.` });
    out.dsrs[code] = d;
    out.retailers[code] = items;
    out.retCount += items.length;
  });
  const orphan = Object.keys(byCode).filter(k => !out.dsrs[k]);
  if (orphan.length) out.issues.push({ t: 'warn', m: `Retailers for ${orphan.length} DSR code(s) not in the summary were ignored.` });
  if (skipped) out.issues.push({ t: 'warn', m: `${skipped} row(s) without a DSR name were skipped (for example a total row).` });
  if (badNum) out.issues.push({ t: 'warn', m: `${badNum} summary cell(s) had text where a number was expected and were read as 0.` });
  if (!Object.keys(out.dsrs).length) out.issues.push({ t: 'err', m: 'No DSR rows found in the summary.' });
  return out;
}

/* ---------- Trade Visibility: DSR Summury + Retail Wise ---------- */
const TV_FIELDS = [
  ['pos', ['bcd pos'], 'BCD POS (each needs 2 visits)', 1],
  ['v1', ['1st time visit rt (bdc)', '1st time visit rt (bcd)', '1st time visit rt', '1st time visit retail'], '1st visit done', 1],
  ['v2', ['2 times visit retail (bcd)', '2 times visit retail (bdc)', '2 times visit retail', '2nd time visit retail'], '2nd visit done', 1]
];
function parseTv(all, sum, out, index) {
  out.sheetDsr = sum.sn;
  const h = findHeader(sum.rows, H => H.includes('bcd pos'));
  const col = names => { for (const n of names) { const i = h.H.indexOf(n); if (i >= 0) return i; } return h.H.findIndex(x => names.some(n => x.startsWith(n.split(' (')[0]))); };
  out.mapping = TV_FIELDS.map(f => { const c = col(f[1]); return { k: f[0], label: f[2], req: !!f[3], col: c, header: c >= 0 ? h.raw[c] : null }; });
  out.mapping.filter(m => m.req && m.col < 0).forEach(m => out.issues.push({ t: 'err', m: `Required column missing in "${sum.sn}": "${TV_FIELDS.find(f => f[0] === m.k)[1][0]}".` }));
  const ni = h.H.indexOf('dsr name') >= 0 ? h.H.indexOf('dsr name') : 0;
  const byNo = {}; index.forEach(d => { const n = dsrNo(d.name); if (n != null) byNo[n] = d; });
  if (!index.length) out.issues.push({ t: 'err', m: 'Publish an SQR file first: Trade Visibility rows are matched to DSR logins through the SQR DSR list.' });
  const ret = all.find(s => s !== sum && findHeader(s.rows, H => H.includes('tv remarks')));
  if (!ret) out.issues.push({ t: 'warn', m: 'No "Retail Wise" sheet with a "TV Remarks" column found. DSRs will not see which POS to visit.' });
  if (out.issues.some(i => i.t === 'err')) return out;

  const nameToCode = {};
  let badNum = 0, skipped = 0;
  sum.rows.slice(h.hi + 1).forEach((r, k) => {
    if (!r || r.every(v => v == null || v === '')) return;
    const raw = String(r[ni] == null ? '' : r[ni]).trim();
    if (!raw || /total/i.test(raw)) { skipped++; return; }
    const n = dsrNo(raw), known = n != null ? byNo[n] : null;
    if (!known) { out.issues.push({ t: 'warn', m: `"${raw}" does not match any DSR in the SQR data, so it was skipped.` }); return; }
    if (out.dsrs[known.code]) { out.issues.push({ t: 'err', m: `${raw} appears twice in "${sum.sn}" (row ${h.hi + k + 2}).` }); return; }
    const d = { code: known.code, name: known.name };
    out.mapping.forEach(m => { let v = num(r[m.col]); if (isNaN(v)) { badNum++; v = 0; } d[m.k] = v; });
    d.rem1 = Math.max(0, d.pos - d.v1); d.rem2 = Math.max(0, d.pos - d.v2);
    if (d.v2 > d.v1 || d.v1 > d.pos) out.issues.push({ t: 'warn', m: `${raw}: visit counts look wrong (POS ${d.pos}, 1st ${d.v1}, 2nd ${d.v2}).` });
    nameToCode[norm(raw)] = known.code;
    out.dsrs[known.code] = d;
  });
  if (skipped) out.issues.push({ t: 'warn', m: `${skipped} row(s) without a DSR name were skipped (for example a total row).` });
  if (badNum) out.issues.push({ t: 'warn', m: `${badNum} summary cell(s) had text where a number was expected and were read as 0.` });
  if (!Object.keys(out.dsrs).length) { out.issues.push({ t: 'err', m: 'No DSR rows could be matched in the summary.' }); return out; }
  Object.values(out.dsrs).forEach(d => { out.retailers[d.code] = []; });

  if (ret) {
    out.sheetRet = ret.sn;
    const rh = findHeader(ret.rows, H => H.includes('tv remarks'));
    const ix = n => rh.H.indexOf(n);
    const c = { dsr: ix('dsr no') >= 0 ? ix('dsr no') : ix('dsr name'), name: ix('retailer name'), msisdn: ix('ret_msisdn') >= 0 ? ix('ret_msisdn') : ix('retailer code'), rem: ix('tv remarks') };
    const orphan = new Set(), odd = new Set();
    ret.rows.slice(rh.hi + 1).forEach(r => {
      if (!r || r[c.dsr] == null || r[c.dsr] === '') return;
      const raw = String(r[c.dsr]).trim();
      const code = nameToCode[norm(raw)] || (byNo[dsrNo(raw)] && out.dsrs[byNo[dsrNo(raw)].code] ? byNo[dsrNo(raw)].code : null);
      if (!code) { orphan.add(raw); return; }
      const rem = norm(r[c.rem]);
      const st = /pending/.test(rem) ? 'p' : /1st/.test(rem) ? 'f' : null;
      if (!st) { odd.add(String(r[c.rem])); return; }
      const ms = String(r[c.msisdn] == null ? '' : r[c.msisdn]).replace(/\D/g, '');
      out.retailers[code].push({ name: String(r[c.name] == null ? '' : r[c.name]).trim(), id: ms ? ms.slice(-4) : '', st });
      out.retCount++;
    });
    if (orphan.size) out.issues.push({ t: 'warn', m: `POS rows for ${[...orphan].join(', ')} did not match a DSR and were ignored.` });
    if (odd.size) out.issues.push({ t: 'warn', m: `Rows with an unknown TV remark were skipped: ${[...odd].slice(0, 5).join(', ')}.` });
    // Cross-check: Pending rows = POS - 1st visits; 1st-done rows = 1st - 2nd visits
    Object.values(out.dsrs).forEach(d => {
      const it = out.retailers[d.code], p = it.filter(x => x.st === 'p').length, f = it.filter(x => x.st === 'f').length;
      if (p !== d.rem1) out.issues.push({ t: 'warn', m: `${d.name}: summary says ${d.rem1} POS need the 1st visit, "${ret.sn}" lists ${p} as Pending.` });
      if (f !== d.v1 - d.v2) out.issues.push({ t: 'warn', m: `${d.name}: summary says ${d.v1 - d.v2} POS need only the 2nd visit, "${ret.sn}" lists ${f} as 1st Times Done.` });
    });
  }
  return out;
}

/* ---------- older layout: DSR Wise + Retail Wise ---------- */
function parseDsrWise(all, dSheet, out) {
  out.format = 'dsrwise'; out.sheetDsr = dSheet.sn;
  const dS = findHeader(dSheet.rows, H => H.includes('dsr profile code'));
  const rSheet = all.find(s => s !== dSheet && findHeader(s.rows, H => H.includes('dsr profile code') && H.includes('retailer code')));
  out.period = readPeriod(titleText(dSheet.rows, dS.hi));
  if (!out.period) out.issues.push({ t: 'warn', m: 'Could not read the report period from the title row. Dashboards will show "Period not given".' });
  out.mapping = FIELDS.map(f => { const col = dS.H.indexOf(norm(f[1])); return { k: f[0], label: f[2], req: !!f[3], col, header: col >= 0 ? dS.raw[col] : null }; });
  const ci = dS.H.indexOf('dsr profile code'), ni = dS.H.indexOf('dsr name');
  out.mapping.filter(m => m.req && m.col < 0).forEach(m => out.issues.push({ t: 'err', m: `Required column missing: "${FIELDS.find(f => f[0] === m.k)[1]}".` }));
  if (out.issues.some(i => i.t === 'err')) return out;
  let skipped = 0, bad = 0;
  dSheet.rows.slice(dS.hi + 1).forEach((r, ix) => {
    if (!r || r.every(c => c == null || c === '')) return;
    const code = String(r[ci] == null ? '' : r[ci]).trim();
    if (!code || /total/i.test(code) || /total/i.test(String(r[ni] || ''))) { skipped++; return; }
    if (out.dsrs[code]) { out.issues.push({ t: 'err', m: `DSR ${code} appears twice (row ${dS.hi + ix + 2}).` }); return; }
    const d = { code, name: String(r[ni] == null || r[ni] === '' ? code : r[ni]).trim() };
    out.mapping.forEach(m => { let v = m.col >= 0 ? num(r[m.col]) : 0; if (isNaN(v)) { bad++; v = 0; } d[m.k] = v; });
    out.dsrs[code] = d;
  });
  if (skipped) out.issues.push({ t: 'warn', m: `${skipped} row(s) without a DSR code were skipped (for example a total row).` });
  if (bad) out.issues.push({ t: 'warn', m: `${bad} cell(s) had text where a number was expected and were read as 0.` });
  if (!Object.keys(out.dsrs).length) out.issues.push({ t: 'err', m: 'No DSR rows found under the header.' });
  if (rSheet) {
    out.sheetRet = rSheet.sn;
    const rS = findHeader(rSheet.rows, H => H.includes('dsr profile code'));
    const ix = n => rS.H.indexOf(n);
    const c = { dsr: ix('dsr profile code'), code: ix('retailer code'), name: ix('retailer name'), amt: ix('qr c2s amount'), rem: ix('remaining amount for target'), vis: ix('qr visibility') };
    const orphan = new Set();
    rSheet.rows.slice(rS.hi + 1).forEach(r => {
      if (!r || r[c.dsr] == null) return;
      const dc = String(r[c.dsr]).trim(); if (!out.dsrs[dc]) { orphan.add(dc); return; }
      const amt = +r[c.amt] || 0, rv = c.rem >= 0 ? r[c.rem] : null;
      const done = typeof rv === 'string' ? /done/i.test(rv) : (rv != null ? rv <= 0 : amt >= MIN_TK);
      (out.retailers[dc] = out.retailers[dc] || []).push({ code: String(r[c.code] == null ? '' : r[c.code]), name: String(r[c.name] == null ? '' : r[c.name]), amt, rem: done ? 0 : (typeof rv === 'number' ? rv : Math.max(0, MIN_TK - amt)), done, vis: yes(r[c.vis]) });
      out.retCount++;
    });
    if (orphan.size) out.issues.push({ t: 'warn', m: `Retailers for ${orphan.size} DSR code(s) not in the DSR sheet were ignored.` });
  } else out.issues.push({ t: 'warn', m: 'No retailer sheet found. DSRs will not see their retailer list.' });
  return out;
}

return { parse, dsrNo, FIELDS, SUMMARY, TV_FIELDS, LABEL, KPI_NAME, MIN_TK };
});

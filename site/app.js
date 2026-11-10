/* AKTL Sitakunda KPI Portal
 * Static front end. All data and permissions live in Supabase
 * (see supabase/setup.sql). This file only shows what the database
 * allows the signed-in person to read.
 */
(function () {
'use strict';

const CFG = window.AKTL_CONFIG;
const app = document.getElementById('app');
if (!window.supabase || !CFG || !window.SQRParse) {
  app.innerHTML = '<div class="loading"><div>The page could not load. Check your internet connection and reload.</div></div>';
  return;
}
const sb = window.supabase.createClient(CFG.supabaseUrl, CFG.supabaseKey, {
  auth: { persistSession: true, autoRefreshToken: true, storageKey: 'aktl-kpi-auth' }
});

/* ---------- small helpers ---------- */
const esc = s => String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const nf = n => Math.round(+n || 0).toLocaleString('en-IN');
const pf = (x, d) => ((+x || 0) * 100).toFixed(d || 0) + '%';
const norm = v => String(v == null ? '' : v).toLowerCase().replace(/\s+/g, ' ').trim();
const natural = (a, b) => String(a).localeCompare(String(b), undefined, { numeric: true });
const lsGet = k => { try { return localStorage.getItem(k); } catch (e) { return null; } };
const lsSet = (k, v) => { try { localStorage.setItem(k, v); } catch (e) {} };
const barW = p => Math.max(0, Math.min(100, (+p || 0) * 100)).toFixed(1) + '%';
const fmtTime = iso => { if (!iso) return '-'; try { const d = new Date(iso); return d.toLocaleDateString('en-GB', { day: '2-digit', month: 'short' }) + ', ' + d.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' }); } catch (e) { return iso; } };
const errText = e => (e && (e.message || e.error_description)) || String(e || 'Something went wrong.');

const DEVICE = (() => { let d = lsGet('aktl-device-id'); if (!d) { d = 'dev-' + Date.now().toString(36) + Math.random().toString(36).slice(2, 10); lsSet('aktl-device-id', d); } return d; })();
function deviceName() { const ua = navigator.userAgent; return /iPhone/.test(ua) ? 'iPhone' : /iPad/.test(ua) ? 'iPad' : /Android/.test(ua) ? 'Android phone' : /Windows/.test(ua) ? 'Windows PC' : /Mac/.test(ua) ? 'Mac' : 'Browser'; }

/* ---------- KPI fields (shared with the publisher, see sqr-parse.js) ---------- */
const LABEL = window.SQRParse.LABEL;
const EDITABLE = ['active', 'target', 'qrSuccess', 'qrTarget', 'hasRequest', 'requests', 'completed', 'sqrAmt', 'c2sAmt', 'incVis', 'incTrx', 'incTotal'];
const ROLE_LABEL = { admin: 'Admin', viewall: 'Manager / supervisor', dso: 'DSO', dsr: 'DSR' };

/* ---------- Bangla / English labels for DSR screens ---------- */
const TX = {
  en: { home: 'Home', retailersTab: 'Retailers', team: 'Team', trx: 'Transaction active retailers', trxSub: 'Retailers with 300 Tk+ C2S via Super QR, against your C2S target', achieved: 'Achieved', target: 'Target', remaining: 'Remaining', qr: 'QR visibility', share: 'Super QR share of C2S', hasReq: 'Retailers with a request', ofRet: 'of retailers', sqrAmt: 'Super QR amount', trxRetSub: '{n} retailers transacted', zeroTk: 'Retailers at 0 Tk', zeroSub: 'no completed Super QR yet', fWrong: 'Wrong QR', fOut: 'Outside 100m', fLate: 'Late photo', req: 'Requests completed', ticket: 'avg ticket', inc: 'SQR incentive', vis: 'Visibility', trxInc: 'Transaction', checks: 'QR Visibility checks', kpi: 'KPI', sqrName: 'SQR · Super QR', tvName: 'Trade Visibility', seeSqr: 'See SQR details', seeTv: 'See Trade Visibility details', tvVisits: 'POS visits', tvSub: 'Every BCD POS must be visited 2 times', pos: 'BCD POS', v1: '1st visit done', v2: '2nd visit done', r1: '1st visit remaining', r2: '2nd visit remaining', bothDone: 'POS with both visits done', needBoth: 'Need 1st + 2nd visit', need2: 'Need 2nd visit', tvList: 'POS to visit', tvLead: 'Pending POS need both visits. POS with both visits done are not listed.', st1: '1st + 2nd visit pending', st2: '2nd visit pending', noTv: 'Trade Visibility figures are not published yet.', noSqr: 'SQR figures are not published yet.', tvRankBy: 'By % of POS with 2nd visit done', totPos: 'Total BCD POS', posNeedBoth: 'POS needing both visits', needOnly2: '{n} need only the 2nd visit', totRet: 'Total retailers', c2sT: '300 Tk C2S target', visDone: 'QR visibility done', visRem: 'Visibility remaining', visHead: 'QR visibility', visSub: 'QR visibility target = all your retailers', trxTot: 'Transaction vs total retailers', trxTotSub: '300 Tk+ retailers out of all retailers', trxC2s: 'Transaction vs C2S target', trxC2sSub: '300 Tk+ retailers against C2S target retailers', dsrAch: 'DSRs achieved C2S target', dsrAchSub: 'DSRs with transaction ≥ C2S target', vmLate: '15 min late photo', vmWrong: 'Wrong QR placed', vmOut: 'Placed outside 100m', wrong: 'Wrong QR placed', outside: 'Placed outside 100m', late: 'Photo 15+ min after visit', split: 'Robi vs Cirkle', active: 'Active retailers', requests: 'Requests', sqr: 'Super QR Tk', c2s: 'C2S Tk', period: 'Period', updated: 'Updated', myReport: 'My report image', stA: 'Achieved', stP: 'In progress', stB: 'Behind', need: 'needs Tk {n} more', tdone: '300 Tk done', noqr: 'QR Visibility missing', fNeed: 'Need Tk', fQr: 'QR Visibility missing', fDone: 'Done', fAll: 'All', retHead: 'Retailers to push', retLead: 'Closest to the 300 Tk target first. Each one you finish adds 1 to your achievement.', teamHead: 'Team summary', dsrsDone: 'DSRs at target', noRet: 'No retailers in this list.', of: 'of', allRet: 'See all {n} retailers', notYet: 'Your figures are not published yet. Check again after the next update.', signOut: 'Sign out' },
  bn: { home: 'হোম', retailersTab: 'রিটেইলার', team: 'টিম', trx: 'লেনদেন সক্রিয় রিটেইলার', trxSub: 'Super QR দিয়ে ৩০০ টাকা+ C2S করা রিটেইলার', achieved: 'অর্জন', target: 'টার্গেট', remaining: 'বাকি', qr: 'QR দৃশ্যমানতা', share: 'C2S-এ Super QR অংশ', hasReq: 'রিকোয়েস্ট করা রিটেইলার', ofRet: 'রিটেইলারের', sqrAmt: 'Super QR টাকা', trxRetSub: '{n} রিটেইলার লেনদেন করেছে', zeroTk: '০ টাকার রিটেইলার', zeroSub: 'এখনো Super QR সম্পন্ন হয়নি', fWrong: 'ভুল QR', fOut: '১০০ মি. বাইরে', fLate: 'দেরিতে ছবি', req: 'সম্পন্ন রিকোয়েস্ট', ticket: 'গড় টিকেট', inc: 'SQR ইনসেনটিভ', vis: 'দৃশ্যমানতা', trxInc: 'লেনদেন', checks: 'QR দৃশ্যমানতা যাচাই', kpi: 'KPI', sqrName: 'SQR · Super QR', tvName: 'ট্রেড ভিজিবিলিটি', seeSqr: 'SQR বিস্তারিত দেখুন', seeTv: 'ট্রেড ভিজিবিলিটি বিস্তারিত দেখুন', tvVisits: 'POS ভিজিট', tvSub: 'প্রতিটি BCD POS-এ ২ বার ভিজিট করতে হবে', pos: 'BCD POS', v1: '১ম ভিজিট সম্পন্ন', v2: '২য় ভিজিট সম্পন্ন', r1: '১ম ভিজিট বাকি', r2: '২য় ভিজিট বাকি', bothDone: 'দুই ভিজিট সম্পন্ন POS', needBoth: '১ম + ২য় ভিজিট দরকার', need2: '২য় ভিজিট দরকার', tvList: 'যেসব POS-এ ভিজিট বাকি', tvLead: 'পেন্ডিং POS-এ দুই ভিজিটই দরকার। দুই ভিজিট সম্পন্ন POS তালিকায় নেই।', st1: '১ম + ২য় ভিজিট বাকি', st2: '২য় ভিজিট বাকি', noTv: 'ট্রেড ভিজিবিলিটির তথ্য এখনো প্রকাশ হয়নি।', noSqr: 'SQR তথ্য এখনো প্রকাশ হয়নি।', tvRankBy: '২য় ভিজিট সম্পন্ন POS-এর % অনুযায়ী', totPos: 'মোট BCD POS', posNeedBoth: 'দুই ভিজিট দরকার এমন POS', needOnly2: '{n}টিতে শুধু ২য় ভিজিট দরকার', totRet: 'মোট রিটেইলার', c2sT: '৩০০ টাকা C2S টার্গেট', visDone: 'QR দৃশ্যমানতা সম্পন্ন', visRem: 'দৃশ্যমানতা বাকি', visHead: 'QR দৃশ্যমানতা', visSub: 'QR দৃশ্যমানতা টার্গেট = আপনার সব রিটেইলার', trxTot: 'মোট রিটেইলারের বিপরীতে লেনদেন', trxTotSub: 'সব রিটেইলারের মধ্যে ৩০০ টাকা+ রিটেইলার', trxC2s: 'C2S টার্গেটের বিপরীতে লেনদেন', trxC2sSub: 'C2S টার্গেট রিটেইলারের বিপরীতে ৩০০ টাকা+ রিটেইলার', dsrAch: 'C2S টার্গেট অর্জনকারী DSR', dsrAchSub: 'লেনদেন ≥ C2S টার্গেট', vmLate: '১৫ মিনিট দেরিতে ছবি', vmWrong: 'ভুল QR লাগানো', vmOut: '১০০ মিটারের বাইরে', wrong: 'ভুল QR লাগানো', outside: '১০০ মিটারের বাইরে', late: 'ভিজিটের ১৫+ মিনিট পরে ছবি', split: 'Robi বনাম Cirkle', active: 'সক্রিয় রিটেইলার', requests: 'রিকোয়েস্ট', sqr: 'Super QR টাকা', c2s: 'C2S টাকা', period: 'সময়কাল', updated: 'আপডেট', myReport: 'আমার রিপোর্ট ছবি', stA: 'অর্জিত', stP: 'চলমান', stB: 'পিছিয়ে', need: 'আরও {n} টাকা দরকার', tdone: '৩০০ টাকা পূর্ণ', noqr: 'QR দৃশ্যমানতা নেই', fNeed: 'টাকা বাকি', fQr: 'QR দৃশ্যমানতা নেই', fDone: 'পূর্ণ', fAll: 'সব', retHead: 'যেসব রিটেইলারে কাজ বাকি', retLead: '৩০০ টাকার সবচেয়ে কাছের রিটেইলার আগে। প্রতিটি পূর্ণ হলে আপনার অর্জন ১ বাড়বে।', teamHead: 'টিম সারাংশ', dsrsDone: 'টার্গেট পূর্ণ DSR', noRet: 'এই তালিকায় কোনো রিটেইলার নেই।', of: 'এর মধ্যে', allRet: 'সব {n} রিটেইলার দেখুন', notYet: 'আপনার তথ্য এখনো প্রকাশ হয়নি। পরের আপডেটের পর আবার দেখুন।', signOut: 'সাইন আউট' }
};
const T = (k, v) => { let s = (TX[st.lang] || TX.en)[k] || TX.en[k] || k; if (v) for (const x in v) s = s.replace('{' + x + '}', v[x]); return s; };

/* ---------- state ---------- */
const st = {
  booting: true, profile: null, loginErr: null, loginId: '',
  settings: { summary: false, mode: 'totals' },
  live: null, dsrs: {}, rets: {}, team: null, tv: { live: null, dsrs: {}, rets: {} }, teamTv: null,
  batches: [], accounts: [], devices: {}, edits: [],
  lang: lsGet('aktl-lang') || 'en', loadedAt: 0
};
const ui = {
  tab: null, viewDsr: null, detail: null, retFilter: 'need', tvFilter: 'p', confirm: null,
  corr: { code: '', k: 'active', val: '', reason: '' },
  imgs: {}, modal: null, busy: false, saving: false,
  editAcct: null, creds: null, newRole: 'dsr'
};
let pending = null;

const dsrList = () => Object.values(st.dsrs).sort((a, c) => natural(a.name, c.name));
const tvList = () => Object.values(st.tv.dsrs).sort((a, c) => natural(a.name, c.name));
const kpiState = k => k === 'TV' ? st.tv : st;   // { live, dsrs, rets }
const initials = n => { const m = String(n).match(/(\d+)\s*$/); if (m) return m[1].slice(-2); return String(n).split(/\s+/).map(w => w[0] || '').join('').slice(0, 2).toUpperCase(); };

/* ---------- calculations ---------- */
function calc(d) {
  const pct = d.target ? d.active / d.target : 0;
  return { pct, rem: Math.max(0, (d.target || 0) - (d.active || 0)), vis: d.qrTarget ? d.qrSuccess / d.qrTarget : 0, share: d.c2sAmt ? d.sqrAmt / d.c2sAmt : 0, flags: (d.wrongQr || 0) + (d.outside100 || 0) + (d.latePhoto || 0) };
}
const status = p => p >= 1 ? { c: 'good', k: 'stA' } : p >= .5 ? { c: 'warn', k: 'stP' } : { c: 'bad', k: 'stB' };
function localTotals() {
  const t = { retailers: 0, active: 0, target: 0, qrSuccess: 0, qrTarget: 0, sqrAmt: 0, c2sAmt: 0, n: 0, atTarget: 0 };
  dsrList().forEach(d => { ['retailers', 'active', 'target', 'qrSuccess', 'qrTarget', 'sqrAmt', 'c2sAmt'].forEach(k => t[k] += +d[k] || 0); t.n++; if (d.target && d.active >= d.target) t.atTarget++; });
  return t;
}
const periodText = b => { const p = (b && b.period) || {}; return p.from && p.to ? `${p.from} to ${p.to}` : 'Period not given'; };

/* ---------- KPI cards: one list used by the DSR page, report image and WhatsApp text ----------
   Cards only appear for figures the published file actually has. */
const has = (d, k) => d && d[k] != null;
function kpiCards(d) {
  const c = calc(d), out = [];
  out.push({ id: 'qr', label: T('qr'), big: `${nf(d.qrSuccess)} / ${nf(d.qrTarget)}`, sub: pf(c.vis) + ' ' + T('ofRet'), pct: c.vis, bar: status(c.vis / 0.9).c, wa: `${d.qrSuccess}/${d.qrTarget} (${pf(c.vis)})` });
  if (has(d, 'requests') && d.requests) out.push({ id: 'req', label: T('req'), big: `${nf(d.completed)} / ${nf(d.requests)}`, sub: `${T('ticket')} Tk ${nf(d.ticket)}`, wa: `${d.completed}/${d.requests}` });
  else if (has(d, 'hasRequest')) { const p = d.retailers ? d.hasRequest / d.retailers : 0; out.push({ id: 'hreq', label: T('hasReq'), big: `${nf(d.hasRequest)} / ${nf(d.retailers)}`, sub: pf(p) + ' ' + T('ofRet'), pct: p, wa: `${d.hasRequest}/${d.retailers}` }); }
  if (has(d, 'c2sAmt') && d.c2sAmt) out.push({ id: 'share', label: T('share'), big: pf(c.share, 1), sub: `Tk ${nf(d.sqrAmt)} ${T('of')} Tk ${nf(d.c2sAmt)}`, wa: pf(c.share, 1) });
  else if (has(d, 'sqrAmt')) out.push({ id: 'sqr', label: T('sqrAmt'), big: 'Tk ' + nf(d.sqrAmt), sub: has(d, 'trxRet') ? T('trxRetSub', { n: nf(d.trxRet) }) : '', wa: 'Tk ' + nf(d.sqrAmt) });
  if (has(d, 'incTotal') && (d.incTotal || d.incVis || d.incTrx)) out.push({ id: 'inc', label: T('inc'), big: 'Tk ' + nf(d.incTotal), sub: `${T('vis')} ${nf(d.incVis)} · ${T('trxInc')} ${nf(d.incTrx)}`, good: d.incTotal > 0, wa: 'Tk ' + nf(d.incTotal) });
  else if (has(d, 'zeroTk')) out.push({ id: 'zero', label: T('zeroTk'), big: nf(d.zeroTk), sub: T('zeroSub'), bad: d.zeroTk > 0, wa: String(d.zeroTk) });
  return out.slice(0, 4);
}
const hasSplit = d => has(d, 'robiActive') && (d.robiActive || d.cirActive || d.robiC2s || d.cirC2s);

/* ---------- icons ---------- */
const I = {
  home: '<path d="M3 11l9-7 9 7v9a1 1 0 0 1-1 1h-5v-6H9v6H4a1 1 0 0 1-1-1z"/>',
  store: '<path d="M4 9l1.5-5h13L20 9M4 9v11h16V9M4 9h16M9 20v-6h6v6"/>',
  team: '<circle cx="9" cy="8" r="3.2"/><path d="M3 20c0-3.3 2.7-6 6-6s6 2.7 6 6"/><circle cx="17" cy="9" r="2.5"/><path d="M16 14.2c2.8.3 5 2.6 5 5.8"/>',
  upload: '<path d="M12 16V4M7 9l5-5 5 5M4 16v4h16v-4"/>',
  image: '<rect x="3" y="4" width="18" height="16" rx="2"/><circle cx="9" cy="10" r="2"/><path d="M21 16l-5-5-9 9"/>',
  data: '<ellipse cx="12" cy="6" rx="8" ry="3"/><path d="M4 6v6c0 1.7 3.6 3 8 3s8-1.3 8-3V6M4 12v6c0 1.7 3.6 3 8 3s8-1.3 8-3v-6"/>',
  people: '<circle cx="12" cy="8" r="4"/><path d="M4 21c0-4.4 3.6-8 8-8s8 3.6 8 8"/>',
  back: '<path d="M15 5l-7 7 7 7"/>',
  next: '<path d="M5 12h14M13 6l6 6-6 6"/>',
  file: '<path d="M14 3H6a1 1 0 0 0-1 1v16a1 1 0 0 0 1 1h12a1 1 0 0 0 1-1V8z"/><path d="M14 3v5h5M9 13h6M9 17h6"/>'
};
const ic = n => `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${I[n]}</svg>`;

function tabsFor(p) {
  if (!p) return [];
  if (p.role === 'dsr') return [['home', T('home'), 'home']].concat(st.settings.summary ? [['team', T('team'), 'team']] : []);
  if (p.role === 'admin') return [['team', 'Team', 'team'], ['upload', 'Upload', 'upload'], ['reports', 'Reports', 'image'], ['data', 'Data', 'data'], ['people', 'People', 'people']];
  return [['team', 'Team', 'team']];
}

/* =====================================================================
   Sign-in and loading
   ===================================================================== */
async function boot() {
  try {
    const { data } = await sb.auth.getSession();
    if (data && data.session) { await afterSignIn(); return; }
  } catch (e) { /* fall through to login */ }
  st.booting = false; render();
}

async function afterSignIn() {
  st.booting = true; render();
  try {
    const { data: u } = await sb.auth.getUser();
    if (!u || !u.user) { await signOutWith(null); return; }
    const pr = await sb.from('profiles').select('*').eq('id', u.user.id).maybeSingle();
    if (pr.error) throw pr.error;
    if (!pr.data || !pr.data.active) { await signOutWith('This account is turned off. Contact Tayeb.'); return; }
    const dv = await sb.rpc('register_device', { p_device_id: DEVICE, p_device_name: deviceName() });
    if (dv.error) {
      const m = errText(dv.error);
      await signOutWith(m.includes('device_limit') ? 'This account is already used on 2 devices. Ask Tayeb to remove one.' : m.includes('account_off') ? 'This account is turned off. Contact Tayeb.' : 'Could not check this device. ' + m);
      return;
    }
    st.profile = pr.data;
    await loadData();
  } catch (e) {
    await signOutWith('Could not load your data. ' + errText(e));
    return;
  }
  st.booting = false; render();
}

async function signOutWith(msg) {
  st.profile = null;   // clear first so the SIGNED_OUT listener below does not run this again
  try { await sb.auth.signOut(); } catch (e) {}
  st.live = null; st.dsrs = {}; st.rets = {}; st.team = null;
  st.batches = []; st.accounts = []; st.devices = {}; st.edits = [];
  ui.tab = null; ui.viewDsr = null; ui.modal = null; ui.imgs = {}; pending = null;
  st.loginErr = msg; st.booting = false; render();
}

function must(res) { if (res.error) throw res.error; return res.data; }

async function loadData() {
  const p = st.profile;
  const [sets, lives] = await Promise.all([
    sb.from('settings').select('key,value'),
    sb.from('batches').select('id,kpi,file_name,period,carried,published_at').eq('is_live', true)
  ]);
  (must(sets) || []).forEach(r => {
    if (r.key === 'dsr_summary') st.settings.summary = r.value === true;
    if (r.key === 'dsr_summary_mode') st.settings.mode = r.value === 'ranked' ? 'ranked' : 'totals';
  });
  const L = must(lives) || [];
  st.live = L.find(b => b.kpi === 'SQR') || null;
  st.tv = { live: L.find(b => b.kpi === 'TV') || null, dsrs: {}, rets: {} };
  st.dsrs = {}; st.rets = {};
  const byId = {}; if (st.live) byId[st.live.id] = st; if (st.tv.live) byId[st.tv.live.id] = st.tv;
  const ids = Object.keys(byId);
  if (ids.length) {
    const [f, r] = await Promise.all([
      sb.from('dsr_figures').select('batch_id,dsr_code,dsr_name,data').in('batch_id', ids),
      sb.from('retailers').select('batch_id,dsr_code,items').in('batch_id', ids)
    ]);
    (must(f) || []).forEach(x => { byId[x.batch_id].dsrs[x.dsr_code] = Object.assign({}, x.data, { code: x.dsr_code, name: x.dsr_name }); });
    (must(r) || []).forEach(x => { byId[x.batch_id].rets[x.dsr_code] = x.items || []; });
  }
  st.team = null; st.teamTv = null;
  if (p.role === 'dsr' && st.settings.summary) {
    const [t, v] = await Promise.all([sb.rpc('team_summary'), st.tv.live ? sb.rpc('team_summary', { p_kpi: 'TV' }) : Promise.resolve({ data: null })]);
    if (!t.error) st.team = t.data;
    if (!v.error && v.data && v.data.totals && v.data.totals.pos != null) st.teamTv = v.data;   // needs supabase/update-02
  }
  if (p.role === 'admin') await loadAdmin();
  st.loadedAt = Date.now();
}

async function loadAdmin() {
  const [b, a, d, e] = await Promise.all([
    sb.from('batches').select('id,kpi,file_name,period,carried,published_at,is_live').order('published_at', { ascending: false }).limit(30),
    sb.from('profiles').select('*').order('name'),
    sb.from('devices').select('user_id,device_name,last_seen'),
    sb.from('corrections').select('*').order('changed_at', { ascending: false }).limit(100)
  ]);
  st.batches = must(b) || [];
  st.accounts = (must(a) || []).sort((x, y) => (['admin', 'viewall', 'dso', 'dsr'].indexOf(x.role) - ['admin', 'viewall', 'dso', 'dsr'].indexOf(y.role)) || natural(x.name, y.name));
  st.devices = {};
  (must(d) || []).forEach(x => { (st.devices[x.user_id] = st.devices[x.user_id] || []).push(x); });
  st.edits = must(e) || [];
}

async function refresh(msg) {
  try { await loadData(); if (msg) toast(msg); }
  catch (e) { toast('Could not refresh. ' + errText(e)); }
  render();
}

/* =====================================================================
   Rendering
   ===================================================================== */
function render() {
  if (st.booting) { app.innerHTML = '<div class="loading"><div><div class="spin"></div>Loading…</div></div>'; return; }
  const p = st.profile;
  if (!p) { app.innerHTML = viewLogin(); return; }
  const tabs = tabsFor(p);
  if (!ui.tab || !tabs.some(t => t[0] === ui.tab)) ui.tab = tabs[0][0];
  let body = '';
  if (p.role === 'dsr') {
    if (ui.tab === 'team') body = viewTeamDsr();
    else body = ui.detail === 'sqr' ? viewDsr(p.dsr_code, { back: T('home') }) : ui.detail === 'tv' ? viewTvDsr(p.dsr_code, { back: T('home') }) : viewDsrHome(p.dsr_code);
  } else if (ui.tab === 'team') {
    if (ui.viewDsr) body = ui.detail === 'tv' ? viewTvDsr(ui.viewDsr, { back: 'Trade Visibility ranking', staff: true }) : viewDsr(ui.viewDsr, { back: 'SQR ranking', staff: true });
    else body = ui.detail === 'sqr' ? viewTeam(false) : ui.detail === 'tv' ? viewTvTeam(false) : viewOverview();
  } else {
    body = ({ upload: viewUpload, reports: viewReports, data: viewData, people: viewPeople }[ui.tab] || viewOverview)();
  }
  app.innerHTML = `
  <header class="top"><div class="wrap">
    <div class="brand"><div class="mark">AK</div><div style="min-width:0"><b>AKTL Sitakunda</b><small>KPI Portal · SQR · Trade Visibility</small></div></div>
    <button class="who" data-act="askout" title="${T('signOut')}"><span class="av">${esc(initials(p.name))}</span><span>${esc(p.name)}</span></button>
  </div></header>
  <nav class="tabbar${tabs.length > 1 ? '' : ' solo'}" aria-label="Sections"><div class="wrap"><div class="tabs">${tabs.map(t => `<button data-act="tab" data-v="${t[0]}" ${ui.tab === t[0] ? 'aria-current="page"' : ''}>${ic(t[2])}<span>${esc(t[1])}</span></button>`).join('')}</div></div></nav>
  <main><div class="wrap stack">${body}</div></main>
  ${ui.modal ? viewModal() : ''}`;
}

function viewLogin() {
  return `<main><div class="wrap"><div class="login stack">
    <div style="display:flex;align-items:center;gap:12px"><div class="mark" style="width:48px;height:48px;font-size:20px;border-radius:14px">AK</div><div><div class="lbl">AKTL Sitakunda</div><h1>KPI Portal</h1></div></div>
    <form id="loginform" class="card stack" novalidate>
      <h2>Sign in</h2>
      <div class="field"><label for="lg-id">Login ID · আইডি</label><input id="lg-id" name="username" autocomplete="username" autocapitalize="none" spellcheck="false" value="${esc(st.loginId)}"></div>
      <div class="field"><label for="lg-pw">Password · পাসওয়ার্ড</label><input id="lg-pw" name="password" type="password" autocomplete="current-password"></div>
      ${st.loginErr ? `<p class="no small" role="alert" style="margin:0">${esc(st.loginErr)}</p>` : ''}
      <button class="btn primary" type="submit" ${ui.busy ? 'disabled' : ''}>${ui.busy ? 'Signing in…' : 'Sign in'}</button>
      <p class="small muted" style="margin:0">Forgot your password? Ask Tayeb to set a new one.</p>
    </form>
  </div></div></main>`;
}

function stampHtml(b) {
  b = b === undefined ? st.live : b;
  if (!b) return '';
  const p = b.period || {};
  return `<div class="stamp">${p.from && p.to ? `<span>${T('period')}: <b>${esc(periodText(b))}</b></span>` : ''}<span>${T('updated')}: <b>${esc(fmtTime(b.published_at))}</b></span></div>`;
}
const backBtn = label => `<div><button class="btn ghost" data-act="back">${ic('back')} ${esc(label)}</button></div>`;
const kpiTitle = (name, b) => `<div class="kpititle"><span class="kpitag">${T('kpi')}</span><h2>${esc(name)}</h2>${stampHtml(b)}</div>`;

function viewDsr(code, opt) {
  const d = code && st.dsrs[code];
  const p = st.profile;
  if (!d) {
    return `${opt.back ? backBtn(opt.back) : ''}<section class="hello"><div class="av">${esc(initials(p.name))}</div><div class="grow"><h1>${esc(p.name)}</h1></div>${langToggle()}</section>
      <div class="card empty">${p.role === 'dsr' ? T('notYet') : 'This DSR is not in the published data.'}</div>`;
  }
  const c = calc(d), stt = status(c.pct);
  const flag = (v, k) => `<div class="${v > 0 ? 'hit' : ''}"><b class="num">${v || 0}</b><span>${T(k)}</span></div>`;
  return `
  ${opt.back ? backBtn(opt.back) : ''}
  <section class="hello">
    <div class="av">${esc(initials(d.name))}</div>
    <div class="grow"><h1>${esc(d.name)}</h1><p>${esc(d.code)}</p></div>
    ${langToggle()}
  </section>
  ${kpiTitle(T('sqrName'), st.live)}
  <article class="card hero">
    <div class="row1"><div><div class="lbl">${T('trx')}</div><div class="small muted">${T('trxSub')}</div></div><span class="chip ${stt.c}">${T(stt.k)}</span></div>
    <div class="main"><div class="big num">${nf(d.active)} <small>/ ${nf(d.target)}</small></div><div class="ring ${stt.c}" style="--p:${Math.min(100, c.pct * 100).toFixed(1)}"><b class="num">${pf(c.pct)}</b></div></div>
    <div class="bar" role="img" aria-label="${pf(c.pct)} of target"><i class="${stt.c}" style="width:${barW(c.pct)}"></i></div>
    <div class="facts f5">
      <div><span>${T('totRet')}</span><b class="num">${nf(d.retailers)}</b></div>
      <div><span>${T('c2sT')}</span><b class="num">${nf(d.target)}</b></div>
      <div><span>${T('achieved')}</span><b class="num">${nf(d.active)}</b></div>
      <div class="rem"><span>${T('remaining')}</span><b class="num">${nf(c.rem)}</b></div>
      <div><span>%</span><b class="num">${pf(c.pct)}</b></div>
    </div>
  </article>
  <article class="card hero vis">
    <div class="row1"><div><div class="lbl">${T('visHead')}</div><div class="small muted">${T('visSub')}</div></div><span class="chip ${status(c.vis / 0.9).c}">${pf(c.vis)}</span></div>
    <div class="bar" role="img" aria-label="${pf(c.vis)} QR visibility"><i class="${status(c.vis / 0.9).c}" style="width:${barW(c.vis)}"></i></div>
    <div class="facts f3">
      <div><span>${T('totRet')}</span><b class="num">${nf(d.qrTarget)}</b></div>
      <div><span>${T('visDone')}</span><b class="num">${nf(d.qrSuccess)}</b></div>
      <div class="rem"><span>${T('visRem')}</span><b class="num">${nf(Math.max(0, (d.qrTarget || 0) - (d.qrSuccess || 0)))}</b></div>
    </div>
  </article>
  <div class="tiles">${kpiCards(d).filter(k => k.id !== 'qr').map(k => `<article class="card tile"><div class="lbl">${esc(k.label)}</div><div class="v num${k.bad ? ' badv' : k.good ? ' goodv' : ''}">${esc(k.big)}</div>${k.pct != null ? `<div class="bar sm"><i class="${k.bar || ''}" style="width:${barW(k.pct)}"></i></div>` : ''}<p class="num">${esc(k.sub)}</p></article>`).join('')}</div>
  <div class="${hasSplit(d) ? 'grid2' : 'stack'}">
    <article class="card"><h3>${T('checks')}</h3><div class="flags">${flag(d.wrongQr, 'wrong')}${flag(d.outside100, 'outside')}${flag(d.latePhoto, 'late')}</div></article>
    ${hasSplit(d) ? `<article class="card"><h3>${T('split')}</h3><div class="tbl"><table><thead><tr><th></th><th class="r">Robi</th><th class="r">Cirkle</th></tr></thead><tbody>
      <tr><td>${T('active')}</td><td class="r num">${nf(d.robiActive)}</td><td class="r num">${nf(d.cirActive)}</td></tr>
      <tr><td>${T('requests')}</td><td class="r num">${nf(d.robiReq)}</td><td class="r num">${nf(d.cirReq)}</td></tr>
      <tr><td>${T('sqr')}</td><td class="r num">${nf(d.robiSqr)}</td><td class="r num">${nf(d.cirSqr)}</td></tr>
      <tr><td>${T('c2s')}</td><td class="r num">${nf(d.robiC2s)}</td><td class="r num">${nf(d.cirC2s)}</td></tr>
    </tbody></table></div></article>` : ''}
  </div>
  <article class="card"><h3>${T('retHead')}</h3><p class="small muted" style="margin:2px 0 0">${T('retLead')}</p>${retailerList(code)}</article>
  <div class="actions"><button class="btn primary" data-act="myreport" data-v="${esc(code)}">${ic('image')} ${T('myReport')}</button>${p.role !== 'dsr' ? `<button class="btn" data-act="copytext" data-v="${esc(code)}">Copy WhatsApp text</button>` : ''}</div>`;
}
const langToggle = () => `<div class="seg" role="group" aria-label="Language"><button data-act="lang" data-v="en" aria-pressed="${st.lang === 'en'}">EN</button><button data-act="lang" data-v="bn" aria-pressed="${st.lang === 'bn'}">বাং</button></div>`;

function visNote(r) {
  const why = [r.late && T('vmLate'), r.wrong && T('vmWrong'), r.out && T('vmOut')].filter(Boolean).join(', ');
  if (r.vis && !why) return '';
  return ` · <span class="no">${r.vis ? why : T('noqr') + (why ? ' - ' + why : '')}</span>`;
}
function retRow(r) {
  return `<div class="li"><div class="n">${esc(r.name)}</div>${r.done ? `<div class="ok">${T('tdone')}</div>` : `<div class="need num">${T('need', { n: nf(r.rem) })}</div>`}<div class="s num">${esc(r.code)} · Tk ${nf(r.amt)} / 300${visNote(r)}</div>${r.done ? '' : `<div class="bar sm" style="grid-column:1/-1"><i style="width:${barW(r.amt / 300)}"></i></div>`}</div>`;
}
function retailerList(code) {
  const all = st.rets[code] || [], f = ui.retFilter;
  if (!all.length) return `<div class="empty">${T('noRet')}</div>`;
  const cnt = { need: all.filter(r => !r.done).length, qr: all.filter(r => !r.vis).length, done: all.filter(r => r.done).length, all: all.length };
  const l = f === 'need' ? all.filter(r => !r.done).sort((a, b) => a.rem - b.rem) : f === 'qr' ? all.filter(r => !r.vis) : f === 'done' ? all.filter(r => r.done).sort((a, b) => b.amt - a.amt) : all.slice().sort((a, b) => natural(a.name, b.name));
  const pills = [['need', 'fNeed'], ['qr', 'fQr'], ['done', 'fDone'], ['all', 'fAll']].map(x => `<button class="pill" data-act="rf" data-v="${x[0]}" aria-pressed="${f === x[0]}">${T(x[1])} · ${cnt[x[0]]}</button>`).join('');
  return `<div class="pills" style="margin-top:10px">${pills}</div><div class="list">${l.length ? l.map(retRow).join('') : `<div class="empty">${T('noRet')}</div>`}</div>`;
}
function viewTeam(forDsr) {
  if (!st.live) return (forDsr ? '' : backBtn('Team overview')) + emptyPublished();
  let t, ranking;
  if (forDsr) {
    if (!st.team) return `${kpiTitle(T('sqrName'), st.live)}<div class="card empty">Team summary is not available right now.</div>`;
    t = st.team.totals || {}; ranking = st.team.ranking || null;
  } else {
    t = localTotals(); ranking = dsrList().map(d => d);
  }
  const p = st.profile;
  const rows = ranking ? ranking.map(d => ({ d, c: calc(d) })).sort((a, c) => c.c.pct - a.c.pct || (c.d.active || 0) - (a.d.active || 0)) : null;
  return `
  ${forDsr ? '' : backBtn('Team overview')}
  ${kpiTitle(T('sqrName'), st.live)}
  ${sqrTeamTiles(t)}
  ${rows ? `<article class="card"><div style="display:flex;justify-content:space-between;align-items:baseline;gap:8px;flex-wrap:wrap"><h2>DSR ranking</h2><span class="small muted">By % of C2S target${forDsr ? '' : ' · tap a DSR to open'}</span></div>
    <div class="list">${rows.map((x, i) => {
      const s = status(x.c.pct);
      const inner = `<span class="pos num">${i + 1}</span><span class="nm">${esc(x.d.name)}${p.role === 'dsr' && p.dsr_code === x.d.code ? ' <span class="chip good" style="font-size:11px;padding:1px 8px">You</span>' : ''}</span><span class="pc num">${pf(x.c.pct)}</span><span class="bar sm"><i class="${s.c}" style="width:${barW(x.c.pct)}"></i></span><span class="meta num">${nf(x.d.active)}/${nf(x.d.target)} active · QR ${pf(x.c.vis)}${forDsr ? '' : x.d.incTotal ? ` · Tk ${nf(x.d.incTotal)} incentive` : has(x.d, 'sqrAmt') ? ` · Tk ${nf(x.d.sqrAmt)} Super QR` : ''}${!forDsr && x.c.flags ? ` · <span class="no">${x.c.flags} QR visibility flag${x.c.flags > 1 ? "s" : ""}</span>` : ''}</span>`;
      return forDsr ? `<div class="rank">${inner}</div>` : `<button class="rank" data-act="open" data-v="${esc(x.d.code)}">${inner}</button>`;
    }).join('')}</div></article>` : ''}`;
}
function sqrTeamTiles(t) {
  const tp = t.target ? t.active / t.target : 0;
  if (!t.retailers) t = Object.assign({}, t, { retailers: t.qrTarget });   // QR target = number of retailers
  return `<div class="tiles">
    ${t.retailers ? `<article class="card tile"><div class="lbl">${T('trxTot')}</div><div class="v num">${nf(t.active)} <small>/ ${nf(t.retailers)}</small></div><div class="bar sm"><i style="width:${barW(t.active / t.retailers)}"></i></div><p class="num">${pf(t.active / t.retailers)} · ${T('trxTotSub')}</p></article>` : ''}
    <article class="card tile"><div class="lbl">${T('trxC2s')}</div><div class="v num">${nf(t.active)} <small>/ ${nf(t.target)}</small></div><div class="bar sm"><i class="${status(tp).c}" style="width:${barW(tp)}"></i></div><p class="num">${pf(tp)} · ${T('trxC2sSub')}</p></article>
    <article class="card tile"><div class="lbl">${T('qr')}</div><div class="v num">${pf(t.qrTarget ? t.qrSuccess / t.qrTarget : 0)}</div><p class="num">${nf(t.qrSuccess)} / ${nf(t.qrTarget)}</p></article>
    <article class="card tile"><div class="lbl">${T('dsrAch')}</div><div class="v num">${nf(t.atTarget)} <small>/ ${nf(t.n)}</small></div><div class="bar sm"><i class="${status(t.n ? t.atTarget / t.n : 0).c}" style="width:${barW(t.n ? t.atTarget / t.n : 0)}"></i></div><p class="num">${T('dsrAchSub')}</p></article>
  </div>`;
}
function emptyPublished() {
  return `<div class="card empty">Nothing is published yet.${st.profile.role === 'admin' ? ' Go to <b>Upload</b> to publish the first SQR file.' : ''}</div>`;
}

/* =====================================================================
   KPI sections: home summaries with "See details", Trade Visibility pages
   ===================================================================== */
const tvCalc = d => ({ p1: d.pos ? d.v1 / d.pos : 0, p2: d.pos ? d.v2 / d.pos : 0, rem1: Math.max(0, (d.pos || 0) - (d.v1 || 0)), rem2: Math.max(0, (d.pos || 0) - (d.v2 || 0)) });
const ring = (pct, cls, label) => `<div class="ring ${cls}" style="--p:${Math.min(100, pct * 100).toFixed(1)}"><b class="num">${label || pf(pct)}</b></div>`;
const moreBtn = (k, label) => `<button class="btn more" data-act="detail" data-v="${k}"><span>${esc(label)}</span>${ic('next')}</button>`;
const visitRow = (label, done, total, pct) => `<div class="vrow"><div class="vtop"><span>${esc(label)}</span><b class="num">${nf(done)} / ${nf(total)} · ${pf(pct)}</b></div><div class="bar sm"><i class="${status(pct).c}" style="width:${barW(pct)}"></i></div></div>`;

function viewDsrHome(code) {
  const p = st.profile, d = st.dsrs[code], t = st.tv.dsrs[code];
  let sqr = `<div class="card empty">${T('noSqr')}</div>`;
  if (d) {
    const c = calc(d), s1 = status(c.pct);
    sqr = `<article class="card hero">
      <div class="row1"><div><div class="lbl">${T('trx')}</div><div class="small muted">${T('trxSub')}</div></div><span class="chip ${s1.c}">${T(s1.k)}</span></div>
      <div class="main"><div class="big num">${nf(d.active)} <small>/ ${nf(d.target)}</small></div>${ring(c.pct, s1.c)}</div>
      <div class="facts f3">
        <div><span>${T('totRet')}</span><b class="num">${nf(d.retailers)}</b></div>
        <div class="rem"><span>${T('remaining')}</span><b class="num">${nf(c.rem)}</b></div>
        <div><span>${T('qr')}</span><b class="num">${nf(d.qrSuccess)}/${nf(d.qrTarget)}</b></div>
      </div>
      ${moreBtn('sqr', T('seeSqr'))}
    </article>`;
  }
  let tv = `<div class="card empty">${T('noTv')}</div>`;
  if (t) {
    const c = tvCalc(t), s2 = status(c.p2), it = st.tv.rets[code] || [];
    tv = `<article class="card hero tvh">
      <div class="row1"><div><div class="lbl">${T('tvVisits')}</div><div class="small muted">${T('tvSub')}</div></div><span class="chip ${s2.c}">${pf(c.p2)} ${T('v2').toLowerCase()}</span></div>
      <div class="main"><div class="big num">${nf(t.v2)} <small>/ ${nf(t.pos)}</small></div>${ring(c.p2, s2.c)}</div>
      ${visitRow(T('v1'), t.v1, t.pos, c.p1)}${visitRow(T('v2'), t.v2, t.pos, c.p2)}
      <div class="facts f2">
        <div class="rem"><span>${T('needBoth')}</span><b class="num">${nf(it.length ? it.filter(x => x.st === 'p').length : c.rem1)}</b></div>
        <div class="rem"><span>${T('need2')}</span><b class="num">${nf(it.length ? it.filter(x => x.st === 'f').length : t.v1 - t.v2)}</b></div>
      </div>
      ${moreBtn('tv', T('seeTv'))}
    </article>`;
  }
  return `
  <section class="hello"><div class="av">${esc(initials(d ? d.name : p.name))}</div><div class="grow"><h1>${esc(d ? d.name : p.name)}</h1>${code ? `<p>${esc(code)}</p>` : ''}</div>${langToggle()}</section>
  <section class="kpisec">${kpiTitle(T('sqrName'), st.live)}${sqr}</section>
  <section class="kpisec">${kpiTitle(T('tvName'), st.tv.live)}${tv}</section>`;
}

function viewTvDsr(code, opt) {
  const t = st.tv.dsrs[code], sq = st.dsrs[code], p = st.profile;
  const name = (t && t.name) || (sq && sq.name) || p.name;
  const head = `${opt.back ? backBtn(opt.back) : ''}
  <section class="hello"><div class="av">${esc(initials(name))}</div><div class="grow"><h1>${esc(name)}</h1><p>${esc(code || '')}</p></div>${langToggle()}</section>
  ${kpiTitle(T('tvName'), st.tv.live)}`;
  if (!t) return head + `<div class="card empty">${T('noTv')}</div>`;
  const c = tvCalc(t), s2 = status(c.p2), it = st.tv.rets[code] || [];
  return head + `
  <article class="card hero tvh">
    <div class="row1"><div><div class="lbl">${T('tvVisits')}</div><div class="small muted">${T('tvSub')}</div></div><span class="chip ${s2.c}">${T(s2.k)}</span></div>
    <div class="main"><div><div class="small muted">${T('bothDone')}</div><div class="big num">${nf(t.v2)} <small>/ ${nf(t.pos)}</small></div></div>${ring(c.p2, s2.c)}</div>
    ${visitRow(T('v1'), t.v1, t.pos, c.p1)}${visitRow(T('v2'), t.v2, t.pos, c.p2)}
    <div class="facts f5">
      <div><span>${T('pos')}</span><b class="num">${nf(t.pos)}</b></div>
      <div><span>${T('v1')}</span><b class="num">${nf(t.v1)}</b></div>
      <div><span>${T('v2')}</span><b class="num">${nf(t.v2)}</b></div>
      <div class="rem"><span>${T('r1')}</span><b class="num">${nf(c.rem1)}</b></div>
      <div class="rem"><span>${T('r2')}</span><b class="num">${nf(c.rem2)}</b></div>
    </div>
  </article>
  <article class="card"><h3>${T('tvList')}</h3><p class="small muted" style="margin:2px 0 0">${T('tvLead')}</p>${tvRetailerList(it)}</article>`;
}
function tvRetailerList(all) {
  if (!all.length) return `<div class="empty">${T('noRet')}</div>`;
  const f = ui.tvFilter, cnt = { p: all.filter(r => r.st === 'p').length, f: all.filter(r => r.st === 'f').length, all: all.length };
  const l = (f === 'all' ? all.slice() : all.filter(r => r.st === f)).sort((a, b) => (a.st === b.st ? 0 : a.st === 'p' ? -1 : 1) || natural(a.name, b.name));
  const pills = [['p', 'needBoth'], ['f', 'need2'], ['all', 'fAll']].map(x => `<button class="pill" data-act="tf" data-v="${x[0]}" aria-pressed="${f === x[0]}">${T(x[1])} · ${cnt[x[0]]}</button>`).join('');
  return `<div class="pills" style="margin-top:10px">${pills}</div><div class="list">${l.length ? l.map(r => `<div class="li"><div class="n">${esc(r.name)}</div><span class="chip ${r.st === 'p' ? 'bad' : 'warn'}">${T(r.st === 'p' ? 'st1' : 'st2')}</span>${r.id ? `<div class="s num">…${esc(r.id)}</div>` : ''}</div>`).join('') : `<div class="empty">${T('noRet')}</div>`}</div>`;
}

function tvTotals(list) {
  const t = { pos: 0, v1: 0, v2: 0, n: 0, need2: 0 };
  list.forEach(d => { t.pos += +d.pos || 0; t.v1 += +d.v1 || 0; t.v2 += +d.v2 || 0; t.n++; });
  return t;
}
function tvTeamTiles(t) {
  const p1 = t.pos ? t.v1 / t.pos : 0, p2 = t.pos ? t.v2 / t.pos : 0;
  return `<div class="tiles">
    <article class="card tile"><div class="lbl">${T('totPos')}</div><div class="v num">${nf(t.pos)}</div><p class="num">${nf(t.n)} DSRs · ${T('tvSub')}</p></article>
    <article class="card tile"><div class="lbl">${T('v1')}</div><div class="v num">${nf(t.v1)} <small>/ ${nf(t.pos)}</small></div><div class="bar sm"><i class="${status(p1).c}" style="width:${barW(p1)}"></i></div><p class="num">${pf(p1)}</p></article>
    <article class="card tile"><div class="lbl">${T('v2')}</div><div class="v num">${nf(t.v2)} <small>/ ${nf(t.pos)}</small></div><div class="bar sm"><i class="${status(p2).c}" style="width:${barW(p2)}"></i></div><p class="num">${pf(p2)}</p></article>
    <article class="card tile"><div class="lbl">${T('posNeedBoth')}</div><div class="v num badv">${nf(t.pos - t.v1)}</div><p class="num">${T('needOnly2', { n: nf(t.v1 - t.v2) })}</p></article>
  </div>`;
}
function tvRanking(rows, clickable) {
  const p = st.profile;
  const r = rows.map(d => ({ d, c: tvCalc(d) })).sort((a, b) => b.c.p2 - a.c.p2 || b.c.p1 - a.c.p1);
  return `<article class="card"><div style="display:flex;justify-content:space-between;align-items:baseline;gap:8px;flex-wrap:wrap"><h2>DSR ranking</h2><span class="small muted">${T('tvRankBy')}${clickable ? ' · tap a DSR to open' : ''}</span></div>
    <div class="list">${r.map((x, i) => {
      const inner = `<span class="pos num">${i + 1}</span><span class="nm">${esc(x.d.name)}${p.role === 'dsr' && p.dsr_code === x.d.code ? ' <span class="chip good" style="font-size:11px;padding:1px 8px">You</span>' : ''}</span><span class="pc num">${pf(x.c.p2)}</span><span class="bar sm"><i class="${status(x.c.p2).c}" style="width:${barW(x.c.p2)}"></i></span><span class="meta num">${nf(x.d.pos)} POS · 1st ${nf(x.d.v1)} (${pf(x.c.p1)}) · 2nd ${nf(x.d.v2)}${x.c.rem1 ? ` · <span class="no">${nf(x.c.rem1)} need both visits</span>` : ''}</span>`;
      return clickable ? `<button class="rank" data-act="open" data-v="${esc(x.d.code)}">${inner}</button>` : `<div class="rank">${inner}</div>`;
    }).join('')}</div></article>`;
}
function viewTvTeam() {
  if (!st.tv.live) return backBtn('Team overview') + `<div class="card empty">${T('noTv')}</div>`;
  const l = tvList();
  return `${backBtn('Team overview')}${kpiTitle(T('tvName'), st.tv.live)}${tvTeamTiles(tvTotals(l))}${tvRanking(l, true)}`;
}
function viewOverview() {
  const sqr = st.live ? `${sqrTeamTiles(localTotals())}${moreBtn('sqr', 'See SQR details · DSR ranking')}` : emptyPublished();
  const tv = st.tv.live ? `${tvTeamTiles(tvTotals(tvList()))}${moreBtn('tv', 'See Trade Visibility details · DSR ranking')}` : `<div class="card empty">${T('noTv')}${st.profile.role === 'admin' ? ' Upload the Trade Visibility file to add it.' : ''}</div>`;
  return `<section><h1 style="font-size:24px">Team performance</h1></section>
  <section class="kpisec">${kpiTitle(T('sqrName'), st.live)}${sqr}</section>
  <section class="kpisec">${kpiTitle(T('tvName'), st.tv.live)}${tv}</section>`;
}
function viewTeamDsr() {
  const tv = st.teamTv;
  return `<section><h1 style="font-size:24px">${T('teamHead')}</h1></section>
  <section class="kpisec">${viewTeam(true)}</section>
  ${tv ? `<section class="kpisec">${kpiTitle(T('tvName'), st.tv.live)}${tvTeamTiles(Object.assign({ n: 0 }, tv.totals))}${tv.ranking ? tvRanking(tv.ranking, false) : ''}</section>` : ''}`;
}

/* ---------- admin: upload ---------- */
function viewUpload() {
  if (ui.busy) return `<div class="card empty"><div class="spin"></div>Reading the file…</div>`;
  if (!pending) return `
  <section><h1 style="font-size:24px">Upload a KPI report</h1><p class="muted small" style="margin:4px 0 0">Nothing changes for DSRs until you press Publish.</p></section>
  <div class="steps"><div class="on">Choose file</div><div>Check columns</div><div>Fix issues</div><div>Preview and publish</div></div>
  <label class="drop" id="drop" for="file">${ic('file')}<b>Choose the SQR or Trade Visibility Excel file</b><span class="muted small">or drag it here · .xlsx</span><input type="file" id="file" accept=".xlsx,.xls,.csv"></label>
  <div class="banner info"><div><b>What gets read:</b> the KPI is detected from the file. <b>SQR:</b> the summary sheet (e.g. "Summury") and the retailer sheet; the older "DSR Wise" layout also works. <b>Trade Visibility:</b> "DSR Summury" (BCD POS, 1st and 2nd visits) and "Retail Wise" (Pending / 1st Times Done), matched to DSRs by number. Phone numbers are never saved; retailer MSISDNs are cut to the last 4 digits.</div></div>`;
  const pd = pending, errs = pd.issues.filter(i => i.t === 'err');
  const rows = Object.values(pd.dsrs).sort((a, c) => natural(a.name, c.name));
  return `
  <section><h1 style="font-size:24px">Check before publishing</h1><p class="muted small" style="margin:4px 0 0">${esc(pd.fileName)}</p></section>
  <div class="steps"><div>Choose file</div><div class="on">Check columns</div><div class="on">Fix issues</div><div class="on">Preview and publish</div></div>
  <div class="grid2">
    <article class="card"><h3>What was found</h3>
      <div class="issue ok"><span class="dot"></span><span>Report type: <b>${esc(window.SQRParse.KPI_NAME[pd.kpi] || pd.kpi)}</b> · sheet "${esc(pd.sheetDsr || '-')}"</span></div>
      <div class="issue ${pd.period ? 'ok' : pd.kpi === 'TV' ? 'ok' : 'warn'}"><span class="dot"></span><span>Period: <b>${esc(pd.period ? pd.period.from + ' to ' + pd.period.to : 'not found')}</b>${pd.period && pd.period.pulled ? ` · pulled ${esc(pd.period.pulled)}` : ''}</span></div>
      <div class="issue ok"><span class="dot"></span><span><b>${rows.length}</b> DSRs · <b>${pd.retCount}</b> ${pd.kpi === 'TV' ? 'POS still to visit' : 'retailers'}${pd.sheetRet ? ` from "${esc(pd.sheetRet)}"` : ''}</span></div>
      ${pd.carried.length ? `<div class="issue warn"><span class="dot"></span><span>${pd.carried.length} DSR(s) are not in this file and will keep their current figures: ${pd.carried.map(esc).join(', ')}</span></div>` : ''}
    </article>
    <article class="card"><h3>Issues</h3>${pd.issues.length ? pd.issues.map(i => `<div class="issue ${i.t}"><span class="dot"></span><span>${esc(i.m)}</span></div>`).join('') : `<div class="issue ok"><span class="dot"></span><span>No problems found.</span></div>`}</article>
  </div>
  <article class="card"><h3>Column mapping</h3><p class="small muted" style="margin:2px 0 0">${pd.mapping.filter(m => m.col >= 0).length} of ${pd.mapping.length} KPI columns matched.</p>
    <div class="tbl"><table><thead><tr><th>KPI field</th><th>Excel column</th><th></th></tr></thead><tbody>${pd.mapping.map(m => `<tr><td>${esc(m.label)}</td><td class="muted">${m.col >= 0 ? esc(m.header) : '—'}</td><td>${m.col >= 0 ? '<span class="yes">Matched</span>' : m.req ? '<span class="no">Missing (required)</span>' : '<span class="muted">Not found</span>'}</td></tr>`).join('')}</tbody></table></div>
  </article>
  <article class="card"><h3>Preview</h3><p class="small muted" style="margin:2px 0 0">Change is compared with what DSRs see now${pd.kpi === 'TV' ? ' (2nd visits)' : ''}.</p>
    <div class="tbl"><table>${pd.kpi === 'TV' ? `<thead><tr><th>DSR</th><th class="r">BCD POS</th><th class="r">1st visit</th><th class="r">2nd visit</th><th class="r">2nd visit %</th><th class="r">Change</th></tr></thead><tbody>
    ${rows.map(d => { const c = tvCalc(d), o = st.tv.dsrs[d.code]; const dl = o ? d.v2 - o.v2 : null; return `<tr><td>${esc(d.name)}</td><td class="r num">${nf(d.pos)}</td><td class="r num">${nf(d.v1)} (${pf(c.p1)})</td><td class="r num">${nf(d.v2)}</td><td class="r num">${pf(c.p2)}</td><td class="r num">${dl == null ? '<span class="muted">new</span>' : dl > 0 ? `<span class="up">+${dl}</span>` : dl < 0 ? `<span class="down">${dl}</span>` : '<span class="muted">0</span>'}</td></tr>`; }).join('')}` : `<thead><tr><th>DSR</th><th class="r">Active / Target</th><th class="r">%</th><th class="r">Change</th><th class="r">QR vis.</th><th class="r">${pd.format === 'summary' ? 'Super QR Tk' : 'Incentive'}</th></tr></thead><tbody>
    ${rows.map(d => { const c = calc(d), o = st.dsrs[d.code]; const dl = o ? d.active - o.active : null; return `<tr><td>${esc(d.name)}</td><td class="r num">${nf(d.active)} / ${nf(d.target)}</td><td class="r num">${pf(c.pct)}</td><td class="r num">${dl == null ? '<span class="muted">new</span>' : dl > 0 ? `<span class="up">+${dl}</span>` : dl < 0 ? `<span class="down">${dl}</span>` : '<span class="muted">0</span>'}</td><td class="r num">${pf(c.vis)}</td><td class="r num">Tk ${nf(pd.format === 'summary' ? d.sqrAmt : d.incTotal)}</td></tr>`; }).join('')}
`}
    </tbody></table></div>
  </article>
  <div class="actions"><button class="btn primary" data-act="publish" ${errs.length || ui.saving ? 'disabled' : ''}>${ui.saving ? 'Publishing…' : 'Publish update'}</button><button class="btn" data-act="discard" ${ui.saving ? 'disabled' : ''}>Discard</button>${errs.length ? '<span class="small no">Fix the required issues above first.</span>' : ''}</div>`;
}

function parseWorkbook(wb, fileName) {
  const out = Object.assign(window.SQRParse.parse(wb, XLSX, fileName, { dsrIndex: dsrList().map(d => ({ code: d.code, name: d.name })) }), { carried: [] });
  const cur = kpiState(out.kpi);
  if (cur.live && !out.issues.some(i => i.t === 'err')) {
    out.carried = Object.keys(cur.dsrs).filter(k => !out.dsrs[k]).map(k => cur.dsrs[k].name);
    const nw = Object.keys(out.dsrs).filter(k => !cur.dsrs[k]).map(k => out.dsrs[k].name);
    if (nw.length && out.kpi === 'SQR') out.issues.push({ t: 'warn', m: `New DSR(s) not in the current data: ${nw.join(', ')}. Create their logins in People.` });
  }
  return out;
}
function handleFile(f) {
  if (!f) return;
  if (typeof XLSX === 'undefined') { toast('The Excel reader did not load. Check your connection and reload the page.'); return; }
  ui.busy = true; render();
  const rd = new FileReader();
  rd.onload = () => { try { const wb = XLSX.read(new Uint8Array(rd.result), { type: 'array' }); pending = parseWorkbook(wb, f.name); } catch (e) { pending = null; toast('Could not read that file. Save it as .xlsx and try again.'); } ui.busy = false; render(); };
  rd.onerror = () => { ui.busy = false; toast('Could not open that file.'); render(); };
  rd.readAsArrayBuffer(f);
}
async function publish() {
  const pd = pending; if (!pd || ui.saving) return;
  const cur = kpiState(pd.kpi);
  const figs = Object.assign({}, cur.dsrs, pd.dsrs);
  const rets = Object.assign({}, cur.rets, pd.retailers);
  const figures = Object.values(figs).map(d => { const data = Object.assign({}, d); delete data.code; delete data.name; return { code: d.code, name: d.name, data }; });
  const retailers = Object.keys(rets).filter(k => figs[k]).map(k => ({ code: k, items: rets[k] }));
  ui.saving = true; render();
  const r = await sb.rpc('publish_batch', { p_kpi: pd.kpi, p_file: pd.fileName, p_period: pd.period || (pd.kpi === 'SQR' && st.live && st.live.period) || null, p_carried: pd.carried, p_figures: figures, p_retailers: retailers });
  ui.saving = false;
  if (r.error) { toast('Could not publish. ' + errText(r.error)); render(); return; }
  pending = null; ui.imgs = {}; ui.tab = 'team'; ui.detail = null; ui.viewDsr = null;
  await refresh(`Published. ${figures.length} DSR dashboards updated.`);
}

/* ---------- admin: reports ---------- */
function viewReports() {
  if (!st.live) return emptyPublished();
  const l = dsrList(), have = Object.keys(ui.imgs).length;
  return `
  <section><h1 style="font-size:24px">SQR WhatsApp report images</h1><p class="muted small" style="margin:4px 0 0">One portrait image per DSR (1080 × 1350), from the published data.</p></section>
  <div class="actions"><button class="btn primary" data-act="genall">${ic('image')} ${have ? 'Refresh all images' : 'Make all ' + l.length + ' images'}</button>${have ? `<button class="btn" data-act="zip">Download all as ZIP</button>` : ''}</div>
  <div class="rgrid">${l.map(d => `<article class="card rcard">${ui.imgs[d.code] ? `<img src="${ui.imgs[d.code]}" alt="SQR report for ${esc(d.name)}">` : `<div style="aspect-ratio:1080/1350;border-radius:10px;background:var(--surface-2);display:grid;place-items:center" class="muted small">Not made yet</div>`}<b>${esc(d.name)}</b><div class="actions"><button class="btn" data-act="savepng" data-v="${esc(d.code)}">Download</button><button class="btn" data-act="copytext" data-v="${esc(d.code)}">Copy text</button></div></article>`).join('')}</div>`;
}
function rr(x, X, Y, w, h, r, fill) { x.beginPath(); x.moveTo(X + r, Y); x.arcTo(X + w, Y, X + w, Y + h, r); x.arcTo(X + w, Y + h, X, Y + h, r); x.arcTo(X, Y + h, X, Y, r); x.arcTo(X, Y, X + w, Y, r); x.closePath(); x.fillStyle = fill; x.fill(); }
async function reportCanvas(d) {
  try { await Promise.all([document.fonts.load('800 100px "Bricolage Grotesque"'), document.fonts.load('700 40px "Bricolage Grotesque"'), document.fonts.load('500 30px "Hind Siliguri"'), document.fonts.load('600 30px "Hind Siliguri"')]); } catch (e) {}
  const W = 1080, H = 1350, cv = document.createElement('canvas'); cv.width = W; cv.height = H; const x = cv.getContext('2d');
  const C = { ink: '#EAF0FF', muted: '#8C9BC0', card: 'rgba(22,34,68,.92)', line: 'rgba(140,170,255,.18)', track: 'rgba(255,255,255,.10)', cyan: '#4FD1FF', violet: '#8B7CFF', gold: '#FFC25C', good: '#3EE89A', warn: '#FFB547', bad: '#FF6B81' };
  const D = '"Bricolage Grotesque","Hind Siliguri",system-ui,sans-serif', B = '"Hind Siliguri",system-ui,sans-serif';
  const c = calc(d), s = status(c.pct), col = { good: C.good, warn: C.warn, bad: C.bad }[s.c];
  // background: navy gradient, glows, grid, target rings
  let g = x.createLinearGradient(0, 0, 0, H); g.addColorStop(0, '#0A1638'); g.addColorStop(1, '#060B1A'); x.fillStyle = g; x.fillRect(0, 0, W, H);
  const glow = (X, Y, R, rgba) => { const r = x.createRadialGradient(X, Y, 0, X, Y, R); r.addColorStop(0, rgba); r.addColorStop(1, 'rgba(0,0,0,0)'); x.fillStyle = r; x.fillRect(0, 0, W, H); };
  glow(940, 40, 560, 'rgba(139,124,255,.45)'); glow(60, 520, 520, 'rgba(79,209,255,.22)'); glow(700, 1400, 640, 'rgba(46,92,255,.30)');
  x.strokeStyle = 'rgba(255,255,255,.04)'; x.lineWidth = 1; for (let i = 0; i <= W; i += 54) { x.beginPath(); x.moveTo(i + .5, 0); x.lineTo(i + .5, H); x.stroke(); } for (let j = 0; j <= H; j += 54) { x.beginPath(); x.moveTo(0, j + .5); x.lineTo(W, j + .5); x.stroke(); }
  x.strokeStyle = 'rgba(79,209,255,.16)'; [90, 150, 210].forEach((r, i) => { x.setLineDash(i === 1 ? [6, 12] : []); x.beginPath(); x.arc(960, 150, r, 0, Math.PI * 2); x.stroke(); }); x.setLineDash([]);
  // header
  const grad = (X0, X1) => { const q = x.createLinearGradient(X0, 0, X1, 0); q.addColorStop(0, C.cyan); q.addColorStop(1, C.violet); return q; };
  rr(x, 64, 56, 64, 64, 18, grad(64, 128)); x.fillStyle = '#04122A'; x.font = `800 28px ${D}`; x.fillText('AK', 76, 99);
  x.fillStyle = C.muted; x.font = `600 26px ${B}`; x.fillText('AKTL SITAKUNDA   ·   SQR REPORT', 148, 98);
  let fs = 96; x.font = `800 ${fs}px ${D}`; while (x.measureText(d.name).width > W - 128 && fs > 50) { fs -= 4; x.font = `800 ${fs}px ${D}`; }
  x.fillStyle = '#fff'; x.fillText(d.name, 64, 222);
  x.font = `500 28px ${B}`; x.fillStyle = C.muted; x.fillText(`${periodText(st.live)}   ·   Updated ${fmtTime(st.live && st.live.published_at)}`, 64, 270);
  // hero card
  const card = (X, Y, w, h, r) => { rr(x, X, Y, w, h, r, C.card); x.strokeStyle = C.line; x.lineWidth = 2; x.beginPath(); x.moveTo(X + r, Y); x.arcTo(X + w, Y, X + w, Y + h, r); x.arcTo(X + w, Y + h, X, Y + h, r); x.arcTo(X, Y + h, X, Y, r); x.arcTo(X, Y, X + w, Y, r); x.closePath(); x.stroke(); };
  card(48, 312, W - 96, 420, 32);
  x.fillStyle = C.muted; x.font = `600 26px ${B}`; x.fillText('TRANSACTION ACTIVE RETAILERS (300 TK+)', 88, 370);
  x.font = `500 24px ${B}`; x.fillText('Against C2S target', 88, 404);
  x.font = `800 150px ${D}`; x.fillStyle = '#fff'; const a = nf(d.active); x.fillText(a, 84, 560); const aw = x.measureText(a).width;
  x.font = `600 60px ${D}`; x.fillStyle = C.muted; x.fillText(' / ' + nf(d.target), 84 + aw, 560);
  // progress ring
  const cx = W - 190, cy = 488, R = 96; x.lineWidth = 22; x.lineCap = 'round';
  x.strokeStyle = C.track; x.beginPath(); x.arc(cx, cy, R, 0, Math.PI * 2); x.stroke();
  if (c.pct > 0) { x.strokeStyle = col; x.shadowColor = col; x.shadowBlur = 24; x.beginPath(); x.arc(cx, cy, R, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * Math.min(1, c.pct)); x.stroke(); x.shadowBlur = 0; }
  x.lineCap = 'butt'; x.fillStyle = '#fff'; x.font = `800 46px ${D}`; const pt = pf(c.pct); x.fillText(pt, cx - x.measureText(pt).width / 2, cy + 16);
  const lab = ['Achieved', 'In progress', 'Behind'][['good', 'warn', 'bad'].indexOf(s.c)];
  x.font = `700 26px ${B}`; const lw = x.measureText(lab).width + 44; rr(x, cx - lw / 2, cy + R + 26, lw, 48, 24, 'rgba(255,255,255,.08)'); x.fillStyle = col; x.fillText(lab, cx - lw / 2 + 22, cy + R + 59);
  rr(x, 88, 600, W - 176 - 260, 22, 11, C.track); if (c.pct > 0) rr(x, 88, 600, Math.max(22, (W - 176 - 260) * Math.min(1, c.pct)), 22, 11, col);
  x.font = `600 30px ${B}`; x.fillStyle = C.muted; x.fillText('Remaining', 88, 684); const rlw = x.measureText('Remaining').width; x.fillStyle = C.gold; x.font = `800 40px ${D}`; x.fillText(nf(c.rem), 88 + rlw + 18, 686);
  // KPI tiles (same list as the dashboard)
  const tw = (W - 96 - 24) / 2, th = 196, strip = [[C.cyan, C.violet], ['#8B7CFF', '#E37CFF'], [C.good, C.cyan], [C.gold, '#FF8A3D']];
  kpiCards(d).forEach((k, i) => {
    const X = 48 + (i % 2) * (tw + 24), Y = 760 + Math.floor(i / 2) * (th + 20);
    card(X, Y, tw, th, 26); const sg = x.createLinearGradient(X, 0, X + tw, 0); sg.addColorStop(0, strip[i][0]); sg.addColorStop(1, strip[i][1]); rr(x, X + 24, Y, tw - 48, 5, 2, sg);
    x.fillStyle = C.muted; x.font = `600 24px ${B}`; x.fillText(k.label.toUpperCase(), X + 30, Y + 54);
    x.fillStyle = k.bad ? C.bad : k.good ? C.good : '#fff'; let f = 62; x.font = `800 ${f}px ${D}`; while (x.measureText(k.big).width > tw - 60 && f > 34) { f -= 4; x.font = `800 ${f}px ${D}`; } x.fillText(k.big, X + 30, Y + 128);
    x.fillStyle = C.muted; x.font = `500 26px ${B}`; x.fillText(k.sub, X + 30, Y + 170);
  });
  const y0 = 760 + (th + 20) * 2 + 8; card(48, y0, W - 96, 84, 24);
  x.font = `600 28px ${B}`; x.fillStyle = c.flags ? C.bad : C.muted;
  x.fillText(`Photo checks:  Wrong QR ${d.wrongQr || 0}   ·   Outside 100m ${d.outside100 || 0}   ·   Late photo ${d.latePhoto || 0}`, 80, y0 + 53);
  x.font = `500 24px ${B}`; x.fillStyle = C.muted; x.fillText('AKTL Sitakunda KPI Portal', 64, H - 32);
  return cv;
}
async function makeImg(code) { const cv = await reportCanvas(st.dsrs[code]); ui.imgs[code] = cv.toDataURL('image/png'); return cv; }
const fileStamp = () => { const p = st.live && st.live.period; return String(p && p.pulled ? p.pulled : new Date().toLocaleDateString('en-GB', { day: '2-digit', month: 'short' })).replace(/\s+/g, '-'); };
function dataUrlToBlob(u) { const [, b64] = u.split(','); const bin = atob(b64); const a = new Uint8Array(bin.length); for (let i = 0; i < bin.length; i++) a[i] = bin.charCodeAt(i); return new Blob([a], { type: 'image/png' }); }
function download(name, blob) { const u = URL.createObjectURL(blob); const a = document.createElement('a'); a.href = u; a.download = name; document.body.appendChild(a); a.click(); a.remove(); setTimeout(() => URL.revokeObjectURL(u), 5000); }
function waText(code) {
  const d = st.dsrs[code], c = calc(d);
  return `*SQR update: ${d.name}*\nPeriod: ${periodText(st.live)} (updated ${fmtTime(st.live.published_at)})\n\nTrxn active retailers (300 Tk+): ${d.active}/${d.target} (${pf(c.pct)})\nRemaining: ${c.rem}\n` + kpiCards(d).map(k => `${k.label}: ${k.wa}`).join('\n') + (c.flags ? `\nPhoto flags: ${c.flags}` : '');
}

/* ---------- admin: data (history + corrections) ---------- */
function viewData() {
  const l = dsrList(), cc = ui.corr;
  if (!cc.code || !st.dsrs[cc.code]) cc.code = l[0] ? l[0].code : '';
  const curVal = cc.code ? st.dsrs[cc.code][cc.k] : '';
  return `
  <section><h1 style="font-size:24px">Data</h1><p class="muted small" style="margin:4px 0 0">Every upload is kept as a version. Corrections are logged with who, when and why.</p></section>
  ${st.live ? `<article class="card"><h2>Correct an SQR figure</h2><p class="small muted" style="margin:2px 0 0">Changes the published data straight away, without a new upload.</p>
    <div class="form">
      <div class="field"><label for="c-dsr">DSR</label><select id="c-dsr" data-in="code">${l.map(d => `<option value="${esc(d.code)}" ${d.code === cc.code ? 'selected' : ''}>${esc(d.name)}</option>`).join('')}</select></div>
      <div class="field"><label for="c-k">Figure</label><select id="c-k" data-in="k">${EDITABLE.filter(k => k === cc.k || l.some(d => has(d, k))).map(k => `<option value="${k}" ${k === cc.k ? 'selected' : ''}>${esc(LABEL[k])}</option>`).join('')}</select></div>
      <div class="field"><label for="c-cur">Current value</label><input value="${esc(nf(curVal))}" disabled id="c-cur"></div>
      <div class="field"><label for="c-val">New value</label><input id="c-val" type="number" inputmode="decimal" data-in="val" value="${esc(cc.val)}"></div>
      <div class="field wide"><label for="c-reason">Reason</label><input id="c-reason" data-in="reason" placeholder="For example: 2 retailers confirmed by Robi after the file was pulled" value="${esc(cc.reason)}"></div>
    </div>
    <div class="actions" style="margin-top:12px"><button class="btn primary" data-act="correct" ${ui.saving ? 'disabled' : ''}>Save correction</button></div>
  </article>` : emptyPublished()}
  <article class="card"><h2>Published versions</h2>${st.batches.length ? `<div class="tbl"><table><thead><tr><th>Status</th><th>KPI</th><th>File</th><th>Period</th><th>Published</th><th></th></tr></thead><tbody>
    ${st.batches.map(x => `<tr><td>${x.is_live ? '<span class="chip good">Live</span>' : '<span class="muted">Previous</span>'}</td><td>${esc(x.kpi === 'TV' ? 'Trade Visibility' : x.kpi)}</td><td>${esc(x.file_name)}${x.carried && x.carried.length ? ` <span class="muted small">(${x.carried.length} kept)</span>` : ''}</td><td>${esc(periodText(x))}</td><td class="num">${esc(fmtTime(x.published_at))}</td><td>${x.is_live ? '' : ui.confirm === x.id ? `<span class="actions"><button class="btn danger" data-act="rollback" data-v="${x.id}">Yes, make live</button><button class="btn" data-act="cancel">Cancel</button></span>` : `<button class="btn" data-act="askroll" data-v="${x.id}">Make live</button>`}</td></tr>`).join('')}
  </tbody></table></div>` : '<div class="empty">No versions yet.</div>'}</article>
  <article class="card"><h2>Correction log</h2>${st.edits.length ? `<div class="tbl"><table><thead><tr><th>When</th><th>DSR</th><th>Figure</th><th class="r">Old</th><th class="r">New</th><th>By</th><th>Reason</th></tr></thead><tbody>${st.edits.map(e => `<tr><td class="num">${esc(fmtTime(e.changed_at))}</td><td>${esc(e.dsr_name)}</td><td>${esc(LABEL[e.field] || e.field)}</td><td class="r num">${nf(e.old_value)}</td><td class="r num">${nf(e.new_value)}</td><td>${esc(e.changed_by_name)}</td><td style="white-space:normal;min-width:200px">${esc(e.reason)}</td></tr>`).join('')}</tbody></table></div>` : '<div class="empty">No corrections yet.</div>'}</article>`;
}

/* ---------- admin: people + visibility settings ---------- */
function freeDsrCodes() { const used = new Set(st.accounts.map(a => a.dsr_code).filter(Boolean)); return dsrList().filter(d => !used.has(d.code)); }
function viewPeople() {
  const free = freeDsrCodes(), ea = ui.editAcct && st.accounts.find(a => a.id === ui.editAcct);
  return `
  <section><h1 style="font-size:24px">People</h1><p class="muted small" style="margin:4px 0 0">Only people listed here can sign in. You set every login ID and password. Each account works on at most 2 devices.</p></section>
  ${ui.creds ? `<article class="card"><h2>New logins</h2><p class="small no" style="margin:2px 0 0">Copy these now. Passwords are stored encrypted and cannot be shown again.</p><div class="creds" style="margin-top:10px">${esc(ui.creds)}</div><div class="actions" style="margin-top:10px"><button class="btn primary" data-act="copycreds">Copy list</button><button class="btn" data-act="hidecreds">Done</button></div></article>` : ''}
  ${free.length ? `<article class="card"><h2>DSRs without a login (${free.length})</h2><p class="small muted" style="margin:2px 0 0">${free.map(d => esc(d.name)).join(', ')}</p>
    <div class="actions" style="margin-top:10px"><button class="btn primary" data-act="bulkdsr" ${ui.saving ? 'disabled' : ''}>${ui.saving ? 'Creating…' : `Create ${free.length} DSR logins`}</button><span class="small muted">Login IDs like dsr18, each with a random 6-digit password.</span></div></article>` : ''}
  ${ea ? editAccountCard(ea) : addAccountCard(free)}
  <article class="card"><h2>Accounts (${st.accounts.length})</h2><div class="tbl"><table><thead><tr><th>Name</th><th>Role</th><th>Login ID</th><th>Devices</th><th>Status</th><th></th></tr></thead><tbody>
    ${st.accounts.map(a => { const dv = st.devices[a.id] || []; return `<tr><td>${esc(a.name)}${a.dsr_code ? `<div class="small muted">${esc(a.dsr_code)}</div>` : ''}</td><td>${esc(ROLE_LABEL[a.role])}</td><td class="num">${esc(a.login_id)}</td><td class="num" title="${esc(dv.map(x => x.device_name).join(', '))}">${dv.length}${a.role === 'admin' ? '' : ' / 2'}</td><td>${a.active ? '<span class="yes">Active</span>' : '<span class="no">Off</span>'}</td><td><button class="btn ghost" data-act="editacct" data-v="${a.id}">Edit</button></td></tr>`; }).join('')}
  </tbody></table></div></article>
  <article class="card"><h2>What DSRs can see</h2>
    <div class="switchrow"><div><b>Team summary for DSRs</b><p>Adds a Team tab to every DSR's screen.</p></div><label class="switch"><input type="checkbox" id="set-summary" data-chg="summary" ${st.settings.summary ? 'checked' : ''} aria-label="Team summary for DSRs"><span></span></label></div>
    <div class="switchrow"><div><b>Show names and ranking</b><p>Off: DSRs see team totals only. On: they see every DSR's name and %.</p></div><label class="switch"><input type="checkbox" id="set-ranked" data-chg="ranked" ${st.settings.mode === 'ranked' ? 'checked' : ''} ${st.settings.summary ? '' : 'disabled'} aria-label="Show names and ranking"><span></span></label></div>
  </article>`;
}
function roleOptions(sel) { return Object.keys(ROLE_LABEL).map(r => `<option value="${r}" ${r === sel ? 'selected' : ''}>${ROLE_LABEL[r]}</option>`).join(''); }
function addAccountCard(free) {
  return `<article class="card"><h2>Add a person</h2>
    <div class="form">
      <div class="field"><label for="na-name">Name</label><input id="na-name" placeholder="For example Supervisor Rahim"></div>
      <div class="field"><label for="na-role">Role</label><select id="na-role" data-chg="newrole">${roleOptions(ui.newRole)}</select></div>
      <div class="field"><label for="na-login">Login ID</label><input id="na-login" autocapitalize="none" spellcheck="false" placeholder="For example sup1"></div>
      <div class="field"><label for="na-pw">Password</label><input id="na-pw" placeholder="6+ characters"></div>
      ${ui.newRole === 'dsr' ? `<div class="field wide"><label for="na-dsr">DSR in the SQR file</label><select id="na-dsr"><option value="">Choose…</option>${free.map(d => `<option value="${esc(d.code)}">${esc(d.name)} · ${esc(d.code)}</option>`).join('')}</select></div>` : ''}
    </div>
    <div class="actions" style="margin-top:12px"><button class="btn primary" data-act="addacct" ${ui.saving ? 'disabled' : ''}>Create login</button><button class="btn" data-act="genpw" data-v="na-pw">Make a random password</button></div></article>`;
}
function editAccountCard(a) {
  const dv = st.devices[a.id] || [], self = a.id === st.profile.id;
  const codes = dsrList().filter(d => d.code === a.dsr_code || !st.accounts.some(x => x.dsr_code === d.code));
  return `<article class="card"><h2>Edit ${esc(a.name)}</h2>
    <div class="form">
      <div class="field"><label for="ea-name">Name</label><input id="ea-name" value="${esc(a.name)}"></div>
      <div class="field"><label for="ea-role">Role</label><select id="ea-role" ${self ? 'disabled' : ''}>${roleOptions(a.role)}</select></div>
      <div class="field"><label for="ea-login">Login ID</label><input id="ea-login" value="${esc(a.login_id)}" autocapitalize="none" spellcheck="false"></div>
      <div class="field"><label for="ea-active">Status</label><select id="ea-active" ${self ? 'disabled' : ''}><option value="1" ${a.active ? 'selected' : ''}>Active</option><option value="0" ${a.active ? '' : 'selected'}>Off (cannot sign in)</option></select></div>
      <div class="field wide"><label for="ea-dsr">DSR in the SQR file (DSRs only)</label><select id="ea-dsr"><option value="">None</option>${codes.map(d => `<option value="${esc(d.code)}" ${d.code === a.dsr_code ? 'selected' : ''}>${esc(d.name)} · ${esc(d.code)}</option>`).join('')}${a.dsr_code && !st.dsrs[a.dsr_code] ? `<option value="${esc(a.dsr_code)}" selected>${esc(a.dsr_code)}</option>` : ''}</select></div>
    </div>
    <div class="actions" style="margin-top:12px"><button class="btn primary" data-act="saveacct" data-v="${a.id}" ${ui.saving ? 'disabled' : ''}>Save changes</button><button class="btn" data-act="canceledit">Cancel</button></div>
    <div class="form" style="margin-top:16px"><div class="field wide"><label for="ea-pw">New password</label><input id="ea-pw" placeholder="6+ characters"></div></div>
    <div class="actions" style="margin-top:12px"><button class="btn" data-act="setpw" data-v="${a.id}" ${ui.saving ? 'disabled' : ''}>Set new password</button><button class="btn" data-act="genpw" data-v="ea-pw">Make a random password</button></div>
    <div class="switchrow" style="margin-top:8px"><div><b>Devices: ${dv.length}${a.role === 'admin' ? '' : ' / 2'}</b><p>${dv.length ? dv.map(x => esc(x.device_name || 'Device') + ' · last used ' + esc(fmtTime(x.last_seen))).join('<br>') : 'Not signed in on any device yet.'}</p></div>${dv.length ? `<button class="btn" data-act="cleardev" data-v="${a.id}">Remove devices</button>` : ''}</div>
  </article>`;
}
const randPw = () => { const a = new Uint32Array(1); crypto.getRandomValues(a); return String(100000 + a[0] % 900000); };

/* ---------- modal ---------- */
function viewModal() {
  const m = ui.modal;
  if (m.type === 'signout') return `<div class="modal" data-act="closemodal" data-self="1"><div class="card" role="dialog" aria-label="${T('signOut')}"><h3>${T('signOut')}?</h3><p class="small muted" style="margin:0">You will need your login ID and password to sign in again.</p><div class="actions"><button class="btn primary" data-act="signout">${T('signOut')}</button><button class="btn" data-act="closemodal">Cancel</button></div></div></div>`;
  if (m.type === 'text') return `<div class="modal" data-act="closemodal" data-self="1"><div class="card" role="dialog" aria-label="WhatsApp text"><div style="display:flex;justify-content:space-between;align-items:center;gap:8px"><h3>WhatsApp text</h3><button class="btn ghost" data-act="closemodal">Close</button></div><textarea id="watext" readonly style="width:100%;min-height:220px;border:1px solid var(--line);border-radius:10px;padding:10px;background:var(--surface-2)">${esc(m.text)}</textarea><p class="small muted" style="margin:0">Select the text and copy it.</p></div></div>`;
  return `<div class="modal" data-act="closemodal" data-self="1"><div class="card" role="dialog" aria-label="Report image">
    <div style="display:flex;justify-content:space-between;align-items:center;gap:8px"><h3>${esc(m.title)}</h3><button class="btn ghost" data-act="closemodal">Close</button></div>
    ${m.src ? `<img src="${m.src}" alt="${esc(m.title)}">` : '<div class="empty"><div class="spin"></div>Making image…</div>'}
    ${m.src ? `<div class="actions"><button class="btn primary" data-act="savepng" data-v="${esc(m.code)}">Download image</button></div><p class="small muted" style="margin:0">On a phone you can also press and hold the image to save or share it.</p>` : ''}
  </div></div>`;
}

/* ---------- toast ---------- */
let tt;
function toast(msg) { const el = document.getElementById('toast'); el.textContent = msg; el.hidden = false; clearTimeout(tt); tt = setTimeout(() => { el.hidden = true; }, 3600); }
const val = id => { const el = document.getElementById(id); return el ? el.value : ''; };

async function rpcDo(name, args, okMsg) {
  ui.saving = true; render();
  const r = await sb.rpc(name, args);
  ui.saving = false;
  if (r.error) { toast(errText(r.error)); render(); return false; }
  await refresh(okMsg);
  return true;
}

/* ---------- events ---------- */
const A = {
  tab: v => { ui.tab = v; ui.viewDsr = null; ui.detail = null; ui.confirm = null; render(); window.scrollTo(0, 0); },
  detail: v => { ui.detail = v; ui.viewDsr = null; ui.retFilter = 'need'; ui.tvFilter = 'p'; if (st.profile.role !== 'dsr') ui.tab = 'team'; render(); window.scrollTo(0, 0); },
  open: v => { ui.viewDsr = v; ui.retFilter = 'need'; ui.tvFilter = 'p'; render(); window.scrollTo(0, 0); },
  back: () => { if (ui.viewDsr) ui.viewDsr = null; else ui.detail = null; render(); window.scrollTo(0, 0); },
  tf: v => { ui.tvFilter = v; render(); },
  lang: v => { st.lang = v; lsSet('aktl-lang', v); render(); },
  rf: v => { ui.retFilter = v; render(); },
  askout: () => { ui.modal = { type: 'signout' }; render(); },
  signout: () => signOutWith(null),
  discard: () => { pending = null; render(); },
  publish: publish,
  askroll: v => { ui.confirm = v; render(); },
  cancel: () => { ui.confirm = null; render(); },
  rollback: async v => { ui.confirm = null; ui.imgs = {}; await rpcDo('set_live_batch', { p_id: v }, 'That version is live again.'); },
  correct: async () => {
    const cc = ui.corr, d = st.dsrs[cc.code];
    if (!d) { toast('Pick a DSR.'); return; }
    if (cc.val === '' || isNaN(+cc.val)) { toast('Enter the new value as a number.'); return; }
    if (!cc.reason.trim()) { toast('Add a reason so the change log makes sense later.'); return; }
    const ok = await rpcDo('correct_figure', { p_dsr_code: cc.code, p_field: cc.k, p_value: +cc.val, p_reason: cc.reason.trim() }, `Saved. ${d.name}'s dashboard now shows the new figure.`);
    if (ok) { cc.val = ''; cc.reason = ''; delete ui.imgs[d.code]; render(); }
  },
  myreport: async v => { const d = st.dsrs[v]; ui.modal = { type: 'img', title: d.name + ' · SQR report', code: v, src: null }; render(); await makeImg(v); if (ui.modal && ui.modal.code === v) { ui.modal.src = ui.imgs[v]; render(); } },
  closemodal: (v, el, e) => { if (el.dataset.self && e.target !== el) return; ui.modal = null; render(); },
  genall: async () => { const l = dsrList(); toast('Making ' + l.length + ' images…'); for (const d of l) await makeImg(d.code); render(); toast(l.length + ' images ready.'); },
  savepng: async v => { if (!ui.imgs[v]) await makeImg(v); download(`SQR_${st.dsrs[v].name}_${fileStamp()}.png`, dataUrlToBlob(ui.imgs[v])); },
  zip: async () => {
    if (typeof JSZip === 'undefined') { toast('The ZIP tool did not load. Reload the page.'); return; }
    const z = new JSZip();
    for (const d of dsrList()) { if (!ui.imgs[d.code]) await makeImg(d.code); z.file(`SQR_${d.name}_${fileStamp()}.png`, ui.imgs[d.code].split(',')[1], { base64: true }); }
    download(`SQR_reports_${fileStamp()}.zip`, await z.generateAsync({ type: 'blob' }));
  },
  copytext: async v => { const t = waText(v); try { await navigator.clipboard.writeText(t); toast('Copied. Paste it into WhatsApp.'); } catch (e) { ui.modal = { type: 'text', text: t }; render(); const ta = document.getElementById('watext'); if (ta) ta.select(); } },
  /* people */
  editacct: v => { ui.editAcct = v; render(); window.scrollTo(0, 0); },
  canceledit: () => { ui.editAcct = null; render(); },
  genpw: v => { const el = document.getElementById(v); if (el) el.value = randPw(); },
  hidecreds: () => { ui.creds = null; render(); },
  copycreds: async () => { try { await navigator.clipboard.writeText(ui.creds); toast('Copied.'); } catch (e) { toast('Select the list and copy it.'); } },
  addacct: async () => {
    const name = val('na-name').trim(), role = val('na-role'), login = val('na-login').trim().toLowerCase(), pw = val('na-pw'), code = role === 'dsr' ? val('na-dsr') : '';
    if (!name || !login || !pw) { toast('Fill in name, login ID and password.'); return; }
    if (role === 'dsr' && !code) { toast('Choose which DSR in the SQR file this login is for.'); return; }
    const ok = await rpcDo('admin_create_account', { p_login: login, p_password: pw, p_name: name, p_role: role, p_dsr_code: code || null }, `Login created for ${name}.`);
    if (ok) { ui.creds = `${name}\tID: ${login}\tPassword: ${pw}`; render(); }
  },
  bulkdsr: async () => {
    const free = freeDsrCodes(); if (!free.length) return;
    const taken = new Set(st.accounts.map(a => a.login_id)); const lines = []; let fails = 0;
    ui.saving = true; render();
    for (const d of free) {
      let login = d.name.toLowerCase().replace(/[^a-z0-9]/g, '') || 'dsr'; let base = login, i = 2;
      while (taken.has(login)) login = base + '-' + (i++);
      const pw = randPw();
      const r = await sb.rpc('admin_create_account', { p_login: login, p_password: pw, p_name: d.name, p_role: 'dsr', p_dsr_code: d.code });
      if (r.error) { fails++; continue; }
      taken.add(login); lines.push(`${d.name}\tID: ${login}\tPassword: ${pw}`);
    }
    ui.saving = false; ui.creds = lines.join('\n') || null;
    await refresh(`${lines.length} DSR logins created${fails ? `, ${fails} failed` : ''}.`);
  },
  saveacct: async v => {
    const a = st.accounts.find(x => x.id === v); if (!a) return;
    const role = a.id === st.profile.id ? a.role : val('ea-role');
    const active = a.id === st.profile.id ? true : val('ea-active') === '1';
    const ok = await rpcDo('admin_update_account', { p_id: v, p_login: val('ea-login').trim().toLowerCase(), p_name: val('ea-name').trim(), p_role: role, p_dsr_code: val('ea-dsr') || null, p_active: active }, 'Saved.');
    if (ok) { ui.editAcct = null; render(); }
  },
  setpw: async v => {
    const a = st.accounts.find(x => x.id === v), pw = val('ea-pw');
    if (!pw || pw.length < 6) { toast('Use at least 6 characters.'); return; }
    const ok = await rpcDo('admin_set_password', { p_id: v, p_password: pw }, `New password set for ${a.name}.`);
    if (ok) { ui.creds = `${a.name}\tID: ${a.login_id}\tPassword: ${pw}`; ui.editAcct = null; render(); }
  },
  cleardev: async v => { const a = st.accounts.find(x => x.id === v); await rpcDo('admin_clear_devices', { p_id: v }, `Devices removed for ${a.name}. They can sign in on a new device.`); }
};

document.addEventListener('click', e => { const el = e.target.closest('[data-act]'); if (!el) return; const f = A[el.dataset.act]; if (f) f(el.dataset.v, el, e); });
document.addEventListener('change', e => {
  const t = e.target;
  if (t.id === 'file') { handleFile(t.files[0]); return; }
  if (t.dataset.chg === 'summary') { rpcDo('set_setting', { p_key: 'dsr_summary', p_value: t.checked }, t.checked ? 'DSRs can now see the team summary.' : 'Team summary hidden from DSRs.'); }
  if (t.dataset.chg === 'ranked') { rpcDo('set_setting', { p_key: 'dsr_summary_mode', p_value: t.checked ? 'ranked' : 'totals' }, t.checked ? 'DSRs now see names and ranking.' : 'DSRs now see team totals only.'); }
  if (t.dataset.chg === 'newrole') { ui.newRole = t.value; const keep = { n: val('na-name'), l: val('na-login'), p: val('na-pw') }; render(); document.getElementById('na-name').value = keep.n; document.getElementById('na-login').value = keep.l; document.getElementById('na-pw').value = keep.p; }
  if (t.dataset.in === 'code' || t.dataset.in === 'k') { ui.corr[t.dataset.in] = t.value; render(); }
});
document.addEventListener('input', e => { const t = e.target; if (t.dataset.in === 'val' || t.dataset.in === 'reason') ui.corr[t.dataset.in] = t.value; });
document.addEventListener('submit', async e => {
  if (e.target.id !== 'loginform') return;
  e.preventDefault();
  const id = val('lg-id').trim().toLowerCase(), pw = val('lg-pw');
  st.loginId = id;
  if (!id || !pw) { st.loginErr = 'Enter your login ID and password.'; render(); return; }
  ui.busy = true; st.loginErr = null; render();
  const { error } = await sb.auth.signInWithPassword({ email: id + CFG.loginDomain, password: pw });
  ui.busy = false;
  if (error) {
    const m = errText(error);
    st.loginErr = /invalid/i.test(m) ? 'Login ID or password is wrong.' : /banned/i.test(m) ? 'This account is turned off. Contact Tayeb.' : 'Could not sign in. ' + m;
    render(); return;
  }
  st.loginId = '';
  await afterSignIn();
});
document.addEventListener('keydown', e => { if (e.key === 'Escape' && ui.modal) { ui.modal = null; render(); } });
document.addEventListener('dragover', e => { const d = e.target.closest && e.target.closest('#drop'); if (d) { e.preventDefault(); d.classList.add('over'); } });
document.addEventListener('dragleave', e => { const d = e.target.closest && e.target.closest('#drop'); if (d) d.classList.remove('over'); });
document.addEventListener('drop', e => { const d = e.target.closest && e.target.closest('#drop'); if (d) { e.preventDefault(); d.classList.remove('over'); handleFile(e.dataTransfer.files[0]); } });
// Pick up new publishes when someone comes back to the app.
document.addEventListener('visibilitychange', () => {
  if (document.visibilityState === 'visible' && st.profile && !pending && !ui.saving && Date.now() - st.loadedAt > 60000) refresh();
});
sb.auth.onAuthStateChange(ev => { if (ev === 'SIGNED_OUT' && st.profile) signOutWith(null); });

boot();
})();

/* AKTL Sitakunda KPI Portal
 * Static front end. All data and permissions live in Supabase
 * (see supabase/setup.sql). This file only shows what the database
 * allows the signed-in person to read.
 */
(function () {
'use strict';

const CFG = window.AKTL_CONFIG;
const app = document.getElementById('app');
if (!window.supabase || !CFG) {
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

/* ---------- KPI field map (header text in the SQR "DSR Wise" sheet) ---------- */
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
const LABEL = Object.fromEntries(FIELDS.map(f => [f[0], f[2]]));
const EDITABLE = ['active', 'target', 'qrSuccess', 'qrTarget', 'requests', 'completed', 'sqrAmt', 'c2sAmt', 'incVis', 'incTrx', 'incTotal'];
const ROLE_LABEL = { admin: 'Admin', viewall: 'Manager / supervisor', dso: 'DSO', dsr: 'DSR' };

/* ---------- Bangla / English labels for DSR screens ---------- */
const TX = {
  en: { home: 'Home', retailersTab: 'Retailers', team: 'Team', trx: 'Transaction active retailers', trxSub: 'Retailers with 300 Tk+ C2S via Super QR', achieved: 'Achieved', target: 'Target', remaining: 'Remaining', qr: 'QR visibility', share: 'Super QR share of C2S', req: 'Requests completed', ticket: 'avg ticket', inc: 'SQR incentive', vis: 'Visibility', trxInc: 'Transaction', checks: 'QR photo checks', wrong: 'Wrong QR placed', outside: 'Placed outside 100m', late: 'Photo 15+ min after visit', split: 'Robi vs Cirkle', active: 'Active retailers', requests: 'Requests', sqr: 'Super QR Tk', c2s: 'C2S Tk', period: 'Period', updated: 'Updated', myReport: 'My report image', stA: 'Achieved', stP: 'In progress', stB: 'Behind', need: 'needs Tk {n} more', tdone: '300 Tk done', noqr: 'QR photo missing', fNeed: 'Need Tk', fQr: 'QR missing', fDone: 'Done', fAll: 'All', retHead: 'Retailers to push', retLead: 'Closest to the 300 Tk target first. Each one you finish adds 1 to your achievement.', teamHead: 'Team summary', dsrsDone: 'DSRs at target', noRet: 'No retailers in this list.', of: 'of', allRet: 'See all {n} retailers', notYet: 'Your figures are not published yet. Check again after the next update.', signOut: 'Sign out' },
  bn: { home: 'হোম', retailersTab: 'রিটেইলার', team: 'টিম', trx: 'লেনদেন সক্রিয় রিটেইলার', trxSub: 'Super QR দিয়ে ৩০০ টাকা+ C2S করা রিটেইলার', achieved: 'অর্জন', target: 'টার্গেট', remaining: 'বাকি', qr: 'QR দৃশ্যমানতা', share: 'C2S-এ Super QR অংশ', req: 'সম্পন্ন রিকোয়েস্ট', ticket: 'গড় টিকেট', inc: 'SQR ইনসেনটিভ', vis: 'দৃশ্যমানতা', trxInc: 'লেনদেন', checks: 'QR ছবি যাচাই', wrong: 'ভুল QR লাগানো', outside: '১০০ মিটারের বাইরে', late: 'ভিজিটের ১৫+ মিনিট পরে ছবি', split: 'Robi বনাম Cirkle', active: 'সক্রিয় রিটেইলার', requests: 'রিকোয়েস্ট', sqr: 'Super QR টাকা', c2s: 'C2S টাকা', period: 'সময়কাল', updated: 'আপডেট', myReport: 'আমার রিপোর্ট ছবি', stA: 'অর্জিত', stP: 'চলমান', stB: 'পিছিয়ে', need: 'আরও {n} টাকা দরকার', tdone: '৩০০ টাকা পূর্ণ', noqr: 'QR ছবি নেই', fNeed: 'টাকা বাকি', fQr: 'QR নেই', fDone: 'পূর্ণ', fAll: 'সব', retHead: 'যেসব রিটেইলারে কাজ বাকি', retLead: '৩০০ টাকার সবচেয়ে কাছের রিটেইলার আগে। প্রতিটি পূর্ণ হলে আপনার অর্জন ১ বাড়বে।', teamHead: 'টিম সারাংশ', dsrsDone: 'টার্গেট পূর্ণ DSR', noRet: 'এই তালিকায় কোনো রিটেইলার নেই।', of: 'এর মধ্যে', allRet: 'সব {n} রিটেইলার দেখুন', notYet: 'আপনার তথ্য এখনো প্রকাশ হয়নি। পরের আপডেটের পর আবার দেখুন।', signOut: 'সাইন আউট' }
};
const T = (k, v) => { let s = (TX[st.lang] || TX.en)[k] || TX.en[k] || k; if (v) for (const x in v) s = s.replace('{' + x + '}', v[x]); return s; };

/* ---------- state ---------- */
const st = {
  booting: true, profile: null, loginErr: null, loginId: '',
  settings: { summary: false, mode: 'totals' },
  live: null, dsrs: {}, rets: {}, team: null,
  batches: [], accounts: [], devices: {}, edits: [],
  lang: lsGet('aktl-lang') || 'en', loadedAt: 0
};
const ui = {
  tab: null, viewDsr: null, retFilter: 'need', confirm: null,
  corr: { code: '', k: 'active', val: '', reason: '' },
  imgs: {}, modal: null, busy: false, saving: false,
  editAcct: null, creds: null, newRole: 'dsr'
};
let pending = null;

const dsrList = () => Object.values(st.dsrs).sort((a, c) => natural(a.name, c.name));
const initials = n => { const m = String(n).match(/(\d+)\s*$/); if (m) return m[1].slice(-2); return String(n).split(/\s+/).map(w => w[0] || '').join('').slice(0, 2).toUpperCase(); };

/* ---------- calculations ---------- */
function calc(d) {
  const pct = d.target ? d.active / d.target : 0;
  return { pct, rem: Math.max(0, (d.target || 0) - (d.active || 0)), vis: d.qrTarget ? d.qrSuccess / d.qrTarget : 0, share: d.c2sAmt ? d.sqrAmt / d.c2sAmt : 0, flags: (d.wrongQr || 0) + (d.outside100 || 0) + (d.latePhoto || 0) };
}
const status = p => p >= 1 ? { c: 'good', k: 'stA' } : p >= .5 ? { c: 'warn', k: 'stP' } : { c: 'bad', k: 'stB' };
function localTotals() {
  const t = { active: 0, target: 0, qrSuccess: 0, qrTarget: 0, sqrAmt: 0, c2sAmt: 0, n: 0, atTarget: 0 };
  dsrList().forEach(d => { ['active', 'target', 'qrSuccess', 'qrTarget', 'sqrAmt', 'c2sAmt'].forEach(k => t[k] += +d[k] || 0); t.n++; if (d.target && d.active >= d.target) t.atTarget++; });
  return t;
}
const periodText = b => { const p = (b && b.period) || {}; return p.from && p.to ? `${p.from} to ${p.to}` : 'Period not given'; };

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
  file: '<path d="M14 3H6a1 1 0 0 0-1 1v16a1 1 0 0 0 1 1h12a1 1 0 0 0 1-1V8z"/><path d="M14 3v5h5M9 13h6M9 17h6"/>'
};
const ic = n => `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${I[n]}</svg>`;

function tabsFor(p) {
  if (!p) return [];
  if (p.role === 'dsr') return [['home', T('home'), 'home'], ['retailers', T('retailersTab'), 'store']].concat(st.settings.summary ? [['team', T('team'), 'team']] : []);
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
  const [sets, live] = await Promise.all([
    sb.from('settings').select('key,value'),
    sb.from('batches').select('id,file_name,period,carried,published_at').eq('kpi', 'SQR').eq('is_live', true).maybeSingle()
  ]);
  (must(sets) || []).forEach(r => {
    if (r.key === 'dsr_summary') st.settings.summary = r.value === true;
    if (r.key === 'dsr_summary_mode') st.settings.mode = r.value === 'ranked' ? 'ranked' : 'totals';
  });
  st.live = must(live) || null;
  st.dsrs = {}; st.rets = {};
  if (st.live) {
    const [f, r] = await Promise.all([
      sb.from('dsr_figures').select('dsr_code,dsr_name,data').eq('batch_id', st.live.id),
      sb.from('retailers').select('dsr_code,items').eq('batch_id', st.live.id)
    ]);
    (must(f) || []).forEach(x => { st.dsrs[x.dsr_code] = Object.assign({}, x.data, { code: x.dsr_code, name: x.dsr_name }); });
    (must(r) || []).forEach(x => { st.rets[x.dsr_code] = x.items || []; });
  }
  st.team = null;
  if (p.role === 'dsr' && st.settings.summary) {
    const t = await sb.rpc('team_summary');
    if (!t.error) st.team = t.data;
  }
  if (p.role === 'admin') await loadAdmin();
  st.loadedAt = Date.now();
}

async function loadAdmin() {
  const [b, a, d, e] = await Promise.all([
    sb.from('batches').select('id,file_name,period,carried,published_at,is_live').eq('kpi', 'SQR').order('published_at', { ascending: false }).limit(30),
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
    body = ui.tab === 'home' ? viewDsr(p.dsr_code, {}) : ui.tab === 'retailers' ? viewRetailers(p.dsr_code) : viewTeam(true);
  } else if (ui.viewDsr && st.dsrs[ui.viewDsr]) {
    body = viewDsr(ui.viewDsr, { back: true });
  } else {
    body = ({ team: () => viewTeam(false), upload: viewUpload, reports: viewReports, data: viewData, people: viewPeople }[ui.tab] || (() => viewTeam(false)))();
  }
  app.innerHTML = `
  <header class="top"><div class="wrap">
    <div class="brand"><div class="mark">AK</div><div style="min-width:0"><b>AKTL Sitakunda</b><small>KPI Portal · SQR</small></div></div>
    <button class="who" data-act="askout" title="${T('signOut')}"><span class="av">${esc(initials(p.name))}</span><span>${esc(p.name)}</span></button>
  </div></header>
  <nav class="tabbar" aria-label="Sections"><div class="wrap"><div class="tabs">${tabs.map(t => `<button data-act="tab" data-v="${t[0]}" ${ui.tab === t[0] && !ui.viewDsr ? 'aria-current="page"' : ''}>${ic(t[2])}<span>${esc(t[1])}</span></button>`).join('')}</div></div></nav>
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

function stampHtml() {
  return `<div class="stamp"><span>${T('period')}: <b>${esc(periodText(st.live))}</b></span><span>${T('updated')}: <b>${esc(fmtTime(st.live && st.live.published_at))}</b></span></div>`;
}

function viewDsr(code, opt) {
  const d = code && st.dsrs[code];
  const p = st.profile;
  if (!d) {
    return `<section class="hello"><div class="av">${esc(initials(p.name))}</div><div class="grow"><h1>${esc(p.name)}</h1></div>${langToggle()}</section>
      <div class="card empty">${p.role === 'dsr' ? T('notYet') : 'This DSR is not in the published data.'}</div>`;
  }
  const c = calc(d), stt = status(c.pct);
  const flag = (v, k) => `<div class="${v > 0 ? 'hit' : ''}"><b class="num">${v || 0}</b><span>${T(k)}</span></div>`;
  return `
  ${opt.back ? `<div><button class="btn ghost" data-act="back">${ic('back')} All DSRs</button></div>` : ''}
  <section class="hello">
    <div class="av">${esc(initials(d.name))}</div>
    <div class="grow"><h1>${esc(d.name)}</h1><p>${esc(d.code)}</p></div>
    ${langToggle()}
  </section>
  ${stampHtml()}
  <article class="card hero">
    <div class="row1"><div><div class="lbl">${T('trx')}</div><div class="small muted">${T('trxSub')}</div></div><span class="chip ${stt.c}">${T(stt.k)}</span></div>
    <div class="main"><div class="big num">${nf(d.active)} <small>/ ${nf(d.target)}</small></div><div class="ring ${stt.c}" style="--p:${Math.min(100, c.pct * 100).toFixed(1)}"><b class="num">${pf(c.pct)}</b></div></div>
    <div class="bar" role="img" aria-label="${pf(c.pct)} of target"><i class="${stt.c}" style="width:${barW(c.pct)}"></i></div>
    <div class="facts">
      <div><span>${T('achieved')}</span><b class="num">${nf(d.active)}</b></div>
      <div><span>${T('target')}</span><b class="num">${nf(d.target)}</b></div>
      <div class="rem"><span>${T('remaining')}</span><b class="num">${nf(c.rem)}</b></div>
      <div><span>%</span><b class="num">${pf(c.pct)}</b></div>
    </div>
  </article>
  <div class="tiles">
    <article class="card tile"><div class="lbl">${T('qr')}</div><div class="v num">${nf(d.qrSuccess)} <small>/ ${nf(d.qrTarget)}</small></div><div class="bar sm"><i class="${status(c.vis / 0.9).c}" style="width:${barW(c.vis)}"></i></div><p>${pf(c.vis)}</p></article>
    <article class="card tile"><div class="lbl">${T('share')}</div><div class="v num">${pf(c.share, 1)}</div><p class="num">Tk ${nf(d.sqrAmt)} ${T('of')} Tk ${nf(d.c2sAmt)}</p></article>
    <article class="card tile"><div class="lbl">${T('req')}</div><div class="v num">${nf(d.completed)} <small>/ ${nf(d.requests)}</small></div><p class="num">${T('ticket')} Tk ${nf(d.ticket)}</p></article>
    <article class="card tile"><div class="lbl">${T('inc')}</div><div class="v num">Tk ${nf(d.incTotal)}</div><p class="num">${T('vis')} ${nf(d.incVis)} · ${T('trxInc')} ${nf(d.incTrx)}</p></article>
  </div>
  <div class="grid2">
    <article class="card"><h3>${T('checks')}</h3><div class="flags">${flag(d.wrongQr, 'wrong')}${flag(d.outside100, 'outside')}${flag(d.latePhoto, 'late')}</div></article>
    <article class="card"><h3>${T('split')}</h3><div class="tbl"><table><thead><tr><th></th><th class="r">Robi</th><th class="r">Cirkle</th></tr></thead><tbody>
      <tr><td>${T('active')}</td><td class="r num">${nf(d.robiActive)}</td><td class="r num">${nf(d.cirActive)}</td></tr>
      <tr><td>${T('requests')}</td><td class="r num">${nf(d.robiReq)}</td><td class="r num">${nf(d.cirReq)}</td></tr>
      <tr><td>${T('sqr')}</td><td class="r num">${nf(d.robiSqr)}</td><td class="r num">${nf(d.cirSqr)}</td></tr>
      <tr><td>${T('c2s')}</td><td class="r num">${nf(d.robiC2s)}</td><td class="r num">${nf(d.cirC2s)}</td></tr>
    </tbody></table></div></article>
  </div>
  ${opt.back ? `<article class="card"><h3>${T('retHead')}</h3>${retailerList(code)}</article>` : retailerPreview(code)}
  <div class="actions"><button class="btn primary" data-act="myreport" data-v="${esc(code)}">${ic('image')} ${T('myReport')}</button>${p.role !== 'dsr' ? `<button class="btn" data-act="copytext" data-v="${esc(code)}">Copy WhatsApp text</button>` : ''}</div>`;
}
const langToggle = () => `<div class="seg" role="group" aria-label="Language"><button data-act="lang" data-v="en" aria-pressed="${st.lang === 'en'}">EN</button><button data-act="lang" data-v="bn" aria-pressed="${st.lang === 'bn'}">বাং</button></div>`;

function retRow(r) {
  return `<div class="li"><div class="n">${esc(r.name)}</div>${r.done ? `<div class="ok">${T('tdone')}</div>` : `<div class="need num">${T('need', { n: nf(r.rem) })}</div>`}<div class="s num">${esc(r.code)} · Tk ${nf(r.amt)} / 300${r.vis ? '' : ` · <span class="no">${T('noqr')}</span>`}</div>${r.done ? '' : `<div class="bar sm" style="grid-column:1/-1"><i style="width:${barW(r.amt / 300)}"></i></div>`}</div>`;
}
function retailerList(code) {
  const all = st.rets[code] || [], f = ui.retFilter;
  if (!all.length) return `<div class="empty">${T('noRet')}</div>`;
  const cnt = { need: all.filter(r => !r.done).length, qr: all.filter(r => !r.vis).length, done: all.filter(r => r.done).length, all: all.length };
  const l = f === 'need' ? all.filter(r => !r.done).sort((a, b) => a.rem - b.rem) : f === 'qr' ? all.filter(r => !r.vis) : f === 'done' ? all.filter(r => r.done).sort((a, b) => b.amt - a.amt) : all.slice().sort((a, b) => natural(a.name, b.name));
  const pills = [['need', 'fNeed'], ['qr', 'fQr'], ['done', 'fDone'], ['all', 'fAll']].map(x => `<button class="pill" data-act="rf" data-v="${x[0]}" aria-pressed="${f === x[0]}">${T(x[1])} · ${cnt[x[0]]}</button>`).join('');
  return `<div class="pills" style="margin-top:10px">${pills}</div><div class="list">${l.length ? l.map(retRow).join('') : `<div class="empty">${T('noRet')}</div>`}</div>`;
}
function retailerPreview(code) {
  const all = st.rets[code] || [];
  if (!all.length) return '';
  const need = all.filter(r => !r.done).sort((a, b) => a.rem - b.rem), done = all.length - need.length;
  return `<article class="card"><div style="display:flex;justify-content:space-between;align-items:baseline;gap:8px;flex-wrap:wrap"><h3>${T('retHead')}</h3><span class="small muted num">${T('tdone')}: ${done} / ${all.length}</span></div><p class="small muted" style="margin:2px 0 0">${T('retLead')}</p>
  <div class="list">${need.length ? need.slice(0, 5).map(retRow).join('') : `<div class="empty">${T('noRet')}</div>`}</div>
  <div class="actions" style="margin-top:8px"><button class="btn" data-act="tab" data-v="retailers">${ic('store')} ${T('allRet', { n: all.length })}</button></div></article>`;
}
function viewRetailers(code) {
  return `<section><h1 style="font-size:24px">${T('retHead')}</h1><p class="muted small" style="margin:4px 0 0">${T('retLead')}</p></section><article class="card">${retailerList(code)}</article>`;
}

function viewTeam(forDsr) {
  if (!st.live) return emptyPublished();
  let t, ranking;
  if (forDsr) {
    if (!st.team) return `<div class="card empty">Team summary is not available right now.</div>`;
    t = st.team.totals || {}; ranking = st.team.ranking || null;
  } else {
    t = localTotals(); ranking = dsrList().map(d => d);
  }
  const tp = t.target ? t.active / t.target : 0, p = st.profile;
  const rows = ranking ? ranking.map(d => ({ d, c: calc(d) })).sort((a, c) => c.c.pct - a.c.pct || (c.d.active || 0) - (a.d.active || 0)) : null;
  return `
  <section><h1 style="font-size:24px">${forDsr ? T('teamHead') : 'Team performance'}</h1><div style="margin-top:4px">${stampHtml()}</div></section>
  <div class="tiles">
    <article class="card tile"><div class="lbl">${T('trx')}</div><div class="v num">${nf(t.active)} <small>/ ${nf(t.target)}</small></div><div class="bar sm"><i class="${status(tp).c}" style="width:${barW(tp)}"></i></div><p class="num">${pf(tp)}</p></article>
    <article class="card tile"><div class="lbl">${T('dsrsDone')}</div><div class="v num">${nf(t.atTarget)} <small>/ ${nf(t.n)}</small></div></article>
    <article class="card tile"><div class="lbl">${T('qr')}</div><div class="v num">${pf(t.qrTarget ? t.qrSuccess / t.qrTarget : 0)}</div><p class="num">${nf(t.qrSuccess)} / ${nf(t.qrTarget)}</p></article>
    <article class="card tile"><div class="lbl">${T('share')}</div><div class="v num">${pf(t.c2sAmt ? t.sqrAmt / t.c2sAmt : 0, 1)}</div><p class="num">Tk ${nf(t.sqrAmt)}</p></article>
  </div>
  ${rows ? `<article class="card"><div style="display:flex;justify-content:space-between;align-items:baseline;gap:8px;flex-wrap:wrap"><h2>DSR ranking</h2><span class="small muted">By % of 300 Tk target${forDsr ? '' : ' · tap a DSR to open'}</span></div>
    <div class="list">${rows.map((x, i) => {
      const s = status(x.c.pct);
      const inner = `<span class="pos num">${i + 1}</span><span class="nm">${esc(x.d.name)}${p.role === 'dsr' && p.dsr_code === x.d.code ? ' <span class="chip good" style="font-size:11px;padding:1px 8px">You</span>' : ''}</span><span class="pc num">${pf(x.c.pct)}</span><span class="bar sm"><i class="${s.c}" style="width:${barW(x.c.pct)}"></i></span><span class="meta num">${nf(x.d.active)}/${nf(x.d.target)} active · QR ${pf(x.c.vis)}${forDsr ? '' : ` · Tk ${nf(x.d.incTotal)} incentive`}${!forDsr && x.c.flags ? ` · <span class="no">${x.c.flags} photo flag${x.c.flags > 1 ? 's' : ''}</span>` : ''}</span>`;
      return forDsr ? `<div class="rank">${inner}</div>` : `<button class="rank" data-act="open" data-v="${esc(x.d.code)}">${inner}</button>`;
    }).join('')}</div></article>` : ''}`;
}
function emptyPublished() {
  return `<div class="card empty">Nothing is published yet.${st.profile.role === 'admin' ? ' Go to <b>Upload</b> to publish the first SQR file.' : ''}</div>`;
}

/* ---------- admin: upload ---------- */
function viewUpload() {
  if (ui.busy) return `<div class="card empty"><div class="spin"></div>Reading the file…</div>`;
  if (!pending) return `
  <section><h1 style="font-size:24px">Upload SQR report</h1><p class="muted small" style="margin:4px 0 0">Nothing changes for DSRs until you press Publish.</p></section>
  <div class="steps"><div class="on">Choose file</div><div>Check columns</div><div>Fix issues</div><div>Preview and publish</div></div>
  <label class="drop" id="drop" for="file">${ic('file')}<b>Choose the SQR Excel file</b><span class="muted small">or drag it here · .xlsx</span><input type="file" id="file" accept=".xlsx,.xls,.csv"></label>
  <div class="banner info"><div><b>What gets read:</b> the "DSR Wise" sheet for KPI figures and the "Retail Wise" sheet for each DSR's retailer list. Retailer EL phone numbers are skipped and never saved.</div></div>`;
  const pd = pending, errs = pd.issues.filter(i => i.t === 'err');
  const rows = Object.values(pd.dsrs).sort((a, c) => natural(a.name, c.name));
  return `
  <section><h1 style="font-size:24px">Check before publishing</h1><p class="muted small" style="margin:4px 0 0">${esc(pd.fileName)}</p></section>
  <div class="steps"><div>Choose file</div><div class="on">Check columns</div><div class="on">Fix issues</div><div class="on">Preview and publish</div></div>
  <div class="grid2">
    <article class="card"><h3>What was found</h3>
      <div class="issue ok"><span class="dot"></span><span>Report type: <b>SQR</b> · sheet "${esc(pd.sheetDsr || '-')}"</span></div>
      <div class="issue ${pd.period ? 'ok' : 'warn'}"><span class="dot"></span><span>Period: <b>${esc(pd.period ? pd.period.from + ' to ' + pd.period.to : 'not found')}</b>${pd.period && pd.period.pulled ? ` · pulled ${esc(pd.period.pulled)}` : ''}</span></div>
      <div class="issue ok"><span class="dot"></span><span><b>${rows.length}</b> DSRs · <b>${pd.retCount}</b> retailers${pd.sheetRet ? ` from "${esc(pd.sheetRet)}"` : ''}</span></div>
      ${pd.carried.length ? `<div class="issue warn"><span class="dot"></span><span>${pd.carried.length} DSR(s) are not in this file and will keep their current figures: ${pd.carried.map(esc).join(', ')}</span></div>` : ''}
    </article>
    <article class="card"><h3>Issues</h3>${pd.issues.length ? pd.issues.map(i => `<div class="issue ${i.t}"><span class="dot"></span><span>${esc(i.m)}</span></div>`).join('') : `<div class="issue ok"><span class="dot"></span><span>No problems found.</span></div>`}</article>
  </div>
  <article class="card"><h3>Column mapping</h3><p class="small muted" style="margin:2px 0 0">${pd.mapping.filter(m => m.col >= 0).length} of ${pd.mapping.length} KPI columns matched.</p>
    <div class="tbl"><table><thead><tr><th>KPI field</th><th>Excel column</th><th></th></tr></thead><tbody>${pd.mapping.map(m => `<tr><td>${esc(m.label)}</td><td class="muted">${m.col >= 0 ? esc(m.header) : '—'}</td><td>${m.col >= 0 ? '<span class="yes">Matched</span>' : m.req ? '<span class="no">Missing (required)</span>' : '<span class="muted">Not found</span>'}</td></tr>`).join('')}</tbody></table></div>
  </article>
  <article class="card"><h3>Preview</h3><p class="small muted" style="margin:2px 0 0">Change is compared with what DSRs see now.</p>
    <div class="tbl"><table><thead><tr><th>DSR</th><th class="r">Active / Target</th><th class="r">%</th><th class="r">Change</th><th class="r">QR vis.</th><th class="r">Incentive</th></tr></thead><tbody>
    ${rows.map(d => { const c = calc(d), o = st.dsrs[d.code]; const dl = o ? d.active - o.active : null; return `<tr><td>${esc(d.name)}</td><td class="r num">${nf(d.active)} / ${nf(d.target)}</td><td class="r num">${pf(c.pct)}</td><td class="r num">${dl == null ? '<span class="muted">new</span>' : dl > 0 ? `<span class="up">+${dl}</span>` : dl < 0 ? `<span class="down">${dl}</span>` : '<span class="muted">0</span>'}</td><td class="r num">${pf(c.vis)}</td><td class="r num">Tk ${nf(d.incTotal)}</td></tr>`; }).join('')}
    </tbody></table></div>
  </article>
  <div class="actions"><button class="btn primary" data-act="publish" ${errs.length || ui.saving ? 'disabled' : ''}>${ui.saving ? 'Publishing…' : 'Publish update'}</button><button class="btn" data-act="discard" ${ui.saving ? 'disabled' : ''}>Discard</button>${errs.length ? '<span class="small no">Fix the required issues above first.</span>' : ''}</div>`;
}

function parseWorkbook(wb, fileName) {
  const out = { fileName, issues: [], mapping: [], period: null, dsrs: {}, retailers: {}, retCount: 0, sheetDsr: null, sheetRet: null, carried: [] };
  let dS = null, rS = null;
  for (const sn of wb.SheetNames) {
    const rows = XLSX.utils.sheet_to_json(wb.Sheets[sn], { header: 1, defval: null, raw: true, blankrows: false });
    const hi = rows.slice(0, 10).findIndex(r => r && r.some(c => norm(c) === 'dsr profile code'));
    if (hi < 0) continue;
    const H = rows[hi].map(norm);
    if (!dS && H.includes('retailer trxn active')) dS = { sn, rows, hi, H, raw: rows[hi] };
    else if (!rS && H.includes('retailer code')) rS = { sn, rows, hi, H };
  }
  if (!dS) { out.issues.push({ t: 'err', m: 'No DSR-wise sheet found. It needs a header row with "DSR Profile Code" and "Retailer Trxn Active".' }); return out; }
  out.sheetDsr = dS.sn;
  const txt = dS.rows.slice(0, dS.hi).flat().filter(c => typeof c === 'string').join(' | ');
  const m1 = txt.match(/(\d{1,2}-[A-Za-z]{3})\s*to\s*(\d{1,2}-[A-Za-z]{3})/), m2 = txt.match(/pulled\s+(\d{1,2}-[A-Za-z]{3})/i);
  if (m1) out.period = { from: m1[1], to: m1[2], pulled: m2 ? m2[1] : null };
  else out.issues.push({ t: 'warn', m: 'Could not read the report period from the title row. Dashboards will show "Period not given".' });
  out.mapping = FIELDS.map(f => { const col = dS.H.indexOf(norm(f[1])); return { k: f[0], label: f[2], req: !!f[3], col, header: col >= 0 ? dS.raw[col] : null }; });
  const ci = dS.H.indexOf('dsr profile code'), ni = dS.H.indexOf('dsr name');
  out.mapping.filter(m => m.req && m.col < 0).forEach(m => out.issues.push({ t: 'err', m: `Required column missing: "${FIELDS.find(f => f[0] === m.k)[1]}".` }));
  if (out.issues.some(i => i.t === 'err')) return out;
  let skipped = 0, bad = 0;
  dS.rows.slice(dS.hi + 1).forEach((r, ix) => {
    if (!r || r.every(c => c == null || c === '')) return;
    const code = String(r[ci] == null ? '' : r[ci]).trim();
    if (!code || /total/i.test(code) || /total/i.test(String(r[ni] || ''))) { skipped++; return; }
    if (out.dsrs[code]) { out.issues.push({ t: 'err', m: `DSR ${code} appears twice (row ${dS.hi + ix + 2}).` }); return; }
    const d = { code, name: String(r[ni] == null || r[ni] === '' ? code : r[ni]).trim() };
    out.mapping.forEach(m => { let v = m.col >= 0 ? r[m.col] : 0; if (v == null || v === '') v = 0; if (typeof v !== 'number') { const n = parseFloat(String(v).replace(/,/g, '')); if (isNaN(n)) { bad++; v = 0; } else v = n; } d[m.k] = v; });
    out.dsrs[code] = d;
  });
  if (skipped) out.issues.push({ t: 'warn', m: `${skipped} row(s) without a DSR code were skipped (for example a total row).` });
  if (bad) out.issues.push({ t: 'warn', m: `${bad} cell(s) had text where a number was expected and were read as 0.` });
  if (!Object.keys(out.dsrs).length) out.issues.push({ t: 'err', m: 'No DSR rows found under the header.' });
  if (rS) {
    out.sheetRet = rS.sn;
    const ix = n => rS.H.indexOf(n);
    const c = { dsr: ix('dsr profile code'), code: ix('retailer code'), name: ix('retailer name'), amt: ix('qr c2s amount'), rem: ix('remaining amount for target'), vis: ix('qr visibility') };
    const yes = v => norm(v) === 'yes';
    const orphan = new Set();
    rS.rows.slice(rS.hi + 1).forEach(r => {
      if (!r || r[c.dsr] == null) return;
      const dc = String(r[c.dsr]).trim(); if (!out.dsrs[dc]) { orphan.add(dc); return; }
      const amt = +r[c.amt] || 0, rv = c.rem >= 0 ? r[c.rem] : null;
      const done = typeof rv === 'string' ? /done/i.test(rv) : (rv != null ? rv <= 0 : amt >= 300);
      (out.retailers[dc] = out.retailers[dc] || []).push({ code: String(r[c.code] == null ? '' : r[c.code]), name: String(r[c.name] == null ? '' : r[c.name]), amt, rem: done ? 0 : (typeof rv === 'number' ? rv : Math.max(0, 300 - amt)), done, vis: yes(r[c.vis]) });
      out.retCount++;
    });
    if (orphan.size) out.issues.push({ t: 'warn', m: `Retailers for ${orphan.size} DSR code(s) not in the DSR sheet were ignored.` });
  } else out.issues.push({ t: 'warn', m: 'No retailer sheet found. DSRs will not see their retailer list.' });
  if (st.live) {
    out.carried = Object.keys(st.dsrs).filter(k => !out.dsrs[k]).map(k => st.dsrs[k].name);
    const nw = Object.keys(out.dsrs).filter(k => !st.dsrs[k]).map(k => out.dsrs[k].name);
    if (nw.length) out.issues.push({ t: 'warn', m: `New DSR(s) not in the current data: ${nw.join(', ')}. Create their logins in People.` });
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
  const figs = Object.assign({}, st.dsrs, pd.dsrs);
  const rets = Object.assign({}, st.rets, pd.retailers);
  const figures = Object.values(figs).map(d => { const data = Object.assign({}, d); delete data.code; delete data.name; return { code: d.code, name: d.name, data }; });
  const retailers = Object.keys(rets).filter(k => figs[k]).map(k => ({ code: k, items: rets[k] }));
  ui.saving = true; render();
  const r = await sb.rpc('publish_batch', { p_kpi: 'SQR', p_file: pd.fileName, p_period: pd.period || (st.live && st.live.period) || null, p_carried: pd.carried, p_figures: figures, p_retailers: retailers });
  ui.saving = false;
  if (r.error) { toast('Could not publish. ' + errText(r.error)); render(); return; }
  pending = null; ui.imgs = {}; ui.tab = 'team';
  await refresh(`Published. ${figures.length} DSR dashboards updated.`);
}

/* ---------- admin: reports ---------- */
function viewReports() {
  if (!st.live) return emptyPublished();
  const l = dsrList(), have = Object.keys(ui.imgs).length;
  return `
  <section><h1 style="font-size:24px">WhatsApp report images</h1><p class="muted small" style="margin:4px 0 0">One portrait image per DSR (1080 × 1350), from the published data.</p></section>
  <div class="actions"><button class="btn primary" data-act="genall">${ic('image')} ${have ? 'Refresh all images' : 'Make all ' + l.length + ' images'}</button>${have ? `<button class="btn" data-act="zip">Download all as ZIP</button>` : ''}</div>
  <div class="rgrid">${l.map(d => `<article class="card rcard">${ui.imgs[d.code] ? `<img src="${ui.imgs[d.code]}" alt="SQR report for ${esc(d.name)}">` : `<div style="aspect-ratio:1080/1350;border-radius:10px;background:var(--surface-2);display:grid;place-items:center" class="muted small">Not made yet</div>`}<b>${esc(d.name)}</b><div class="actions"><button class="btn" data-act="savepng" data-v="${esc(d.code)}">Download</button><button class="btn" data-act="copytext" data-v="${esc(d.code)}">Copy text</button></div></article>`).join('')}</div>`;
}
function rr(x, X, Y, w, h, r, fill) { x.beginPath(); x.moveTo(X + r, Y); x.arcTo(X + w, Y, X + w, Y + h, r); x.arcTo(X + w, Y + h, X, Y + h, r); x.arcTo(X, Y + h, X, Y, r); x.arcTo(X, Y, X + w, Y, r); x.closePath(); x.fillStyle = fill; x.fill(); }
async function reportCanvas(d) {
  try { await Promise.all([document.fonts.load('800 100px "Bricolage Grotesque"'), document.fonts.load('700 40px "Bricolage Grotesque"'), document.fonts.load('500 30px "Hind Siliguri"'), document.fonts.load('600 30px "Hind Siliguri"')]); } catch (e) {}
  const W = 1080, H = 1350, cv = document.createElement('canvas'); cv.width = W; cv.height = H; const x = cv.getContext('2d');
  const C = { bg: '#EEF2EF', ink: '#13201E', muted: '#5A6A66', track: '#E3E9E6', teal: '#0B6E5F', gold: '#C98316', good: '#1D8A4B', warn: '#B8740B', bad: '#BF3328', goodS: '#DDF3E5', warnS: '#FBEED6', badS: '#FBE3E0' };
  const D = '"Bricolage Grotesque","Hind Siliguri",system-ui,sans-serif', B = '"Hind Siliguri",system-ui,sans-serif';
  const c = calc(d), s = status(c.pct), sc = { good: [C.good, C.goodS], warn: [C.warn, C.warnS], bad: [C.bad, C.badS] }[s.c];
  x.fillStyle = C.bg; x.fillRect(0, 0, W, H);
  x.fillStyle = C.teal; x.fillRect(0, 0, W, 280);
  x.fillStyle = 'rgba(255,255,255,.78)'; x.font = `600 28px ${B}`; x.fillText('AKTL SITAKUNDA   ·   SQR REPORT', 64, 82);
  let fs = 100; x.font = `800 ${fs}px ${D}`; while (x.measureText(d.name).width > W - 128 && fs > 50) { fs -= 4; x.font = `800 ${fs}px ${D}`; }
  x.fillStyle = '#fff'; x.fillText(d.name, 64, 192);
  x.font = `500 30px ${B}`; x.fillStyle = 'rgba(255,255,255,.85)'; x.fillText(`${periodText(st.live)}   ·   Updated ${fmtTime(st.live && st.live.published_at)}`, 64, 244);
  rr(x, 48, 316, W - 96, 400, 30, '#fff');
  x.fillStyle = C.muted; x.font = `600 28px ${B}`; x.fillText('TRANSACTION ACTIVE RETAILERS (300 TK+)', 88, 376);
  x.font = `800 150px ${D}`; x.fillStyle = C.ink; const a = nf(d.active); x.fillText(a, 84, 540); const aw = x.measureText(a).width;
  x.font = `600 64px ${D}`; x.fillStyle = C.muted; x.fillText(' / ' + nf(d.target), 84 + aw, 540);
  const lab = ['Achieved', 'In progress', 'Behind'][['good', 'warn', 'bad'].indexOf(s.c)];
  x.font = `700 30px ${B}`; const lw = x.measureText(lab).width + 48; rr(x, W - 88 - lw, 340, lw, 54, 27, sc[1]); x.fillStyle = sc[0]; x.fillText(lab, W - 88 - lw + 24, 377);
  x.font = `800 64px ${D}`; x.fillStyle = sc[0]; const pt = pf(c.pct); x.fillText(pt, W - 88 - x.measureText(pt).width, 540);
  rr(x, 88, 580, W - 176, 26, 13, C.track); if (c.pct > 0) rr(x, 88, 580, Math.max(26, (W - 176) * Math.min(1, c.pct)), 26, 13, sc[0]);
  x.font = `600 32px ${B}`; x.fillStyle = C.muted; x.fillText('Remaining', 88, 672); const rlw = x.measureText('Remaining').width; x.fillStyle = C.gold; x.font = `800 40px ${D}`; x.fillText(nf(c.rem), 88 + rlw + 20, 674);
  const tw = (W - 96 - 24) / 2, th = 196;
  const tile = (X, Y, label, big, sub, col) => { rr(x, X, Y, tw, th, 26, '#fff'); x.fillStyle = C.muted; x.font = `600 24px ${B}`; x.fillText(label, X + 32, Y + 52); x.fillStyle = col || C.ink; let f = 64; x.font = `800 ${f}px ${D}`; while (x.measureText(big).width > tw - 64 && f > 36) { f -= 4; x.font = `800 ${f}px ${D}`; } x.fillText(big, X + 32, Y + 128); x.fillStyle = C.muted; x.font = `500 26px ${B}`; x.fillText(sub, X + 32, Y + 170); };
  tile(48, 744, 'QR VISIBILITY', `${nf(d.qrSuccess)} / ${nf(d.qrTarget)}`, pf(c.vis) + ' of target');
  tile(48 + tw + 24, 744, 'SUPER QR SHARE OF C2S', pf(c.share, 1), `Tk ${nf(d.sqrAmt)} of Tk ${nf(d.c2sAmt)}`);
  tile(48, 744 + th + 20, 'REQUESTS COMPLETED', `${nf(d.completed)} / ${nf(d.requests)}`, `Avg ticket Tk ${nf(d.ticket)}`);
  tile(48 + tw + 24, 744 + th + 20, 'SQR INCENTIVE', `Tk ${nf(d.incTotal)}`, `Visibility ${nf(d.incVis)} · Transaction ${nf(d.incTrx)}`, d.incTotal > 0 ? C.good : C.ink);
  const y0 = 744 + th * 2 + 44; rr(x, 48, y0, W - 96, 84, 24, c.flags ? C.badS : '#fff');
  x.font = `600 28px ${B}`; x.fillStyle = c.flags ? C.bad : C.muted;
  x.fillText(`Photo checks:  Wrong QR ${d.wrongQr || 0}   ·   Outside 100m ${d.outside100 || 0}   ·   Late photo ${d.latePhoto || 0}`, 80, y0 + 53);
  x.font = `500 24px ${B}`; x.fillStyle = C.muted; x.fillText('AKTL Sitakunda KPI Portal', 64, H - 28);
  return cv;
}
async function makeImg(code) { const cv = await reportCanvas(st.dsrs[code]); ui.imgs[code] = cv.toDataURL('image/png'); return cv; }
const fileStamp = () => { const p = st.live && st.live.period; return String(p && p.pulled ? p.pulled : new Date().toLocaleDateString('en-GB', { day: '2-digit', month: 'short' })).replace(/\s+/g, '-'); };
function dataUrlToBlob(u) { const [, b64] = u.split(','); const bin = atob(b64); const a = new Uint8Array(bin.length); for (let i = 0; i < bin.length; i++) a[i] = bin.charCodeAt(i); return new Blob([a], { type: 'image/png' }); }
function download(name, blob) { const u = URL.createObjectURL(blob); const a = document.createElement('a'); a.href = u; a.download = name; document.body.appendChild(a); a.click(); a.remove(); setTimeout(() => URL.revokeObjectURL(u), 5000); }
function waText(code) {
  const d = st.dsrs[code], c = calc(d);
  return `*SQR update: ${d.name}*\nPeriod: ${periodText(st.live)} (updated ${fmtTime(st.live.published_at)})\n\nTrxn active retailers: ${d.active}/${d.target} (${pf(c.pct)})\nRemaining: ${c.rem}\nQR visibility: ${d.qrSuccess}/${d.qrTarget} (${pf(c.vis)})\nSuper QR share of C2S: ${pf(c.share, 1)}\nRequests completed: ${d.completed}/${d.requests}\nSQR incentive: Tk ${nf(d.incTotal)}` + (c.flags ? `\nPhoto flags: ${c.flags}` : '');
}

/* ---------- admin: data (history + corrections) ---------- */
function viewData() {
  const l = dsrList(), cc = ui.corr;
  if (!cc.code || !st.dsrs[cc.code]) cc.code = l[0] ? l[0].code : '';
  const curVal = cc.code ? st.dsrs[cc.code][cc.k] : '';
  return `
  <section><h1 style="font-size:24px">Data</h1><p class="muted small" style="margin:4px 0 0">Every upload is kept as a version. Corrections are logged with who, when and why.</p></section>
  ${st.live ? `<article class="card"><h2>Correct a figure</h2><p class="small muted" style="margin:2px 0 0">Changes the published data straight away, without a new upload.</p>
    <div class="form">
      <div class="field"><label for="c-dsr">DSR</label><select id="c-dsr" data-in="code">${l.map(d => `<option value="${esc(d.code)}" ${d.code === cc.code ? 'selected' : ''}>${esc(d.name)}</option>`).join('')}</select></div>
      <div class="field"><label for="c-k">Figure</label><select id="c-k" data-in="k">${EDITABLE.map(k => `<option value="${k}" ${k === cc.k ? 'selected' : ''}>${esc(LABEL[k])}</option>`).join('')}</select></div>
      <div class="field"><label for="c-cur">Current value</label><input value="${esc(nf(curVal))}" disabled id="c-cur"></div>
      <div class="field"><label for="c-val">New value</label><input id="c-val" type="number" inputmode="decimal" data-in="val" value="${esc(cc.val)}"></div>
      <div class="field wide"><label for="c-reason">Reason</label><input id="c-reason" data-in="reason" placeholder="For example: 2 retailers confirmed by Robi after the file was pulled" value="${esc(cc.reason)}"></div>
    </div>
    <div class="actions" style="margin-top:12px"><button class="btn primary" data-act="correct" ${ui.saving ? 'disabled' : ''}>Save correction</button></div>
  </article>` : emptyPublished()}
  <article class="card"><h2>Published versions</h2>${st.batches.length ? `<div class="tbl"><table><thead><tr><th>Status</th><th>File</th><th>Period</th><th>Published</th><th></th></tr></thead><tbody>
    ${st.batches.map(x => `<tr><td>${x.is_live ? '<span class="chip good">Live</span>' : '<span class="muted">Previous</span>'}</td><td>${esc(x.file_name)}${x.carried && x.carried.length ? ` <span class="muted small">(${x.carried.length} kept)</span>` : ''}</td><td>${esc(periodText(x))}</td><td class="num">${esc(fmtTime(x.published_at))}</td><td>${x.is_live ? '' : ui.confirm === x.id ? `<span class="actions"><button class="btn danger" data-act="rollback" data-v="${x.id}">Yes, make live</button><button class="btn" data-act="cancel">Cancel</button></span>` : `<button class="btn" data-act="askroll" data-v="${x.id}">Make live</button>`}</td></tr>`).join('')}
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
  tab: v => { ui.tab = v; ui.viewDsr = null; ui.confirm = null; render(); window.scrollTo(0, 0); },
  open: v => { ui.viewDsr = v; ui.retFilter = 'need'; render(); window.scrollTo(0, 0); },
  back: () => { ui.viewDsr = null; render(); },
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

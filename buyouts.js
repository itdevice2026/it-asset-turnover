/* IT Asset Turnover — Direct Asset Buyout module.
   Stand-alone register of company IT assets SOLD to employees (Supabase table itat_buyouts),
   independent of a turnover record — e.g. an active employee buying a replaced/old laptop.
   Built on the Section 7 buyout of the Turnover form:
   - "Buyout" tab in the toolbar: searchable register, workflow Draft → For approval → Approved → Released (or Cancelled)
   - Add a buyout directly (employee + any number of assets), optionally start from / link to a saved turnover
   - Import the Section 7 buyouts already recorded in turnover records ("Import from turnovers")
   - Payments ledger (installments / salary deduction) → Unpaid / Partially paid / Fully paid, balance
   - Printable IT Asset Buyout Form (Deed of Sale · Proof of Purchase · payment ledger) and register list; CSV export
   - Linked turnovers get their Section 7 payment status kept in step with the register.
   Loaded after index.html's main script, admin.js, buyout.js, signatures.js and disposal.js. */
(function(){
  if (typeof sb === 'undefined' || !sb || !sb.from) return; // online form only

  /* ===================== constants & helpers ===================== */
  const STATUSES = ['Draft','For approval','Approved','Released','Cancelled'];
  const METHODS = ['Cash','Salary deduction','Bank transfer','GCash / e-wallet','Deducted from final pay','Check','Other'];
  const BASES = ['Net book value','Fair market / appraised value','Fully depreciated (nominal value)','Company-approved price list','Other'];
  const OCCASIONS = ['Purchase while employed (replaced / old unit)','Resignation / separation','End of contract','Retirement','Equipment refresh / upgrade program','Other'];
  const CONDS = ['Good','Fair','Damaged'];
  const ASSET_TYPES = (typeof ASSETS !== 'undefined') ? ASSETS : ['Laptop/Desktop','Monitor','Keyboard','Mouse','Laptop Charger/Adapter','Docking Station','Headset','Mobile Device/Tablet','External HDD/SSD/USB','Other IT Equipment'];
  const E = (typeof esc === 'function') ? esc : (s => String(s ?? '').replace(/[&<>"]/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c])));
  const num = v => { const n = parseFloat(String(v ?? '').replace(/[^0-9.\-]/g, '')); return isFinite(n) ? n : 0; };
  const money = v => num(v).toLocaleString('en-PH', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  const today = () => { const d = new Date(); return new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString().slice(0, 10); };
  const fmtD = d => { if (!d) return ''; const x = new Date(String(d).length === 10 ? d + 'T00:00:00' : d); return isNaN(x) ? String(d) : x.toLocaleDateString([], { year:'numeric', month:'short', day:'2-digit' }); };
  const fmtLong = d => { if (!d) return ''; const x = new Date(String(d).length === 10 ? d + 'T00:00:00' : d); return isNaN(x) ? String(d) : x.toLocaleDateString('en-PH', { year:'numeric', month:'long', day:'numeric' }); };
  const companies = () => [...document.querySelectorAll('#company option')].filter(o => o.value && o.value !== '__other').map(o => ({ name: o.value, abbr: o.dataset.abbr || '' }));
  const abbrOf = name => { const c = companies().find(x => x.name === name); if (c && c.abbr) return c.abbr; return String(name || '').replace(/\b(inc|corp|corporation|co|ltd|the|of|and)\b\.?/gi, '').split(/\s+/).filter(Boolean).map(w => w[0]).join('').toUpperCase().slice(0, 5) || 'GEN'; };
  const logoFor = co => (typeof LOGOS !== 'undefined' && LOGOS[co]) || '';
  const coName = o => (typeof companyName === 'function') ? companyName(o) : (o.company || '');
  const statusCls = s => ({ 'Draft':'draft', 'For approval':'pend', 'Approved':'appr', 'Released':'done', 'Cancelled':'cancel' }[s] || 'draft');
  const flash = m => { const st = document.getElementById('state'); if (st) st.textContent = m; };
  const turnovers = () => (typeof store !== 'undefined' && store.records) ? [...store.records.values()] : [];
  function amountWords(v){
    const n = Math.round(num(v) * 100); if (!isFinite(n) || n <= 0) return '';
    const ones = ['','One','Two','Three','Four','Five','Six','Seven','Eight','Nine','Ten','Eleven','Twelve','Thirteen','Fourteen','Fifteen','Sixteen','Seventeen','Eighteen','Nineteen'];
    const tens = ['','','Twenty','Thirty','Forty','Fifty','Sixty','Seventy','Eighty','Ninety'];
    const chunk = x => (x >= 100 ? ones[Math.floor(x/100)] + ' Hundred' + (x%100 ? ' ' : '') : '') + (x%100 < 20 ? ones[x%100] : tens[Math.floor((x%100)/10)] + (x%10 ? '-' + ones[x%10] : ''));
    const words = x => { if (x === 0) return 'Zero'; const parts = []; for (const [d, nm] of [[1e9,'Billion'],[1e6,'Million'],[1e3,'Thousand'],[1,'']]) { const q = Math.floor(x/d); if (q) { parts.push(chunk(q) + (nm ? ' ' + nm : '')); x %= d; } } return parts.join(' '); };
    const pesos = Math.floor(n/100), cents = n%100;
    return words(pesos) + ' Peso' + (pesos === 1 ? '' : 's') + (cents ? ' and ' + String(cents).padStart(2,'0') + '/100' : ' Only');
  }
  // payment position of a buyout from its payments ledger
  function payOf(r){
    const amount = num(r.amount);
    const pays = (r.payments || []).filter(p => num(p.amount) > 0);
    const paid = pays.reduce((s, p) => s + num(p.amount), 0);
    const status = amount > 0 && paid >= amount - 0.005 ? 'Fully paid' : paid > 0 ? 'Partially paid' : 'Unpaid';
    const lastDate = pays.map(p => p.date).filter(Boolean).sort().pop() || null;
    const lastOr = [...pays].sort((a, b) => String(a.date || '').localeCompare(String(b.date || ''))).map(p => p.or_no).filter(Boolean).pop() || '';
    const cls = status === 'Fully paid' ? 'paid' : status === 'Partially paid' ? 'partial' : 'unpaid';
    return { amount, paid, balance: Math.max(0, amount - paid), status, cls, lastDate, lastOr, label: status === 'Fully paid' ? 'PAID' : status === 'Partially paid' ? 'PARTIALLY PAID' : 'UNPAID' };
  }
  // who is buying: the employee who turned over the asset (default), another employee, or an outside party
  const buyerKind = t => !t ? 'same' : /^Another/.test(t) ? 'emp' : 'out';
  function buyerOf(r){
    const kind = buyerKind(r.buyer_type);
    if (kind !== 'same' && (r.buyer_name || '').trim()) return { kind, other: true, name: r.buyer_name.trim(), id: r.buyer_emp_id || '', dept: r.buyer_dept || '', pos: r.buyer_pos || '', company: r.buyer_company || '', contact: r.buyer_contact || '', address: r.buyer_address || '', idref: r.buyer_idref || '', rel: r.buyer_rel || '' };
    return { kind: 'same', other: false, name: r.emp_name || '', id: r.emp_id || '', dept: r.emp_dept || '', pos: r.emp_pos || '', company: r.company || '', contact: r.buyer_contact || '', address: '', idref: '', rel: '' };
  }
  // approval: both the IT Manager and the Administrative Manager must approve
  const approvedBoth = r => !!((r.approver_it || '').trim() && (r.approver_admin || '').trim());
  const buyerLabel = k => k === 'emp' ? 'Another employee' : k === 'out' ? 'Outside party' : 'Employee (turned over)';
  // a turnover counts as already in the register when a buyout is linked to it, or carries its control no. (link lost)
  const ctrlKey = v => String(v || '').trim().toUpperCase();
  const coveredBy = t => rows.find(b => b.turnover_id === t._id) || (ctrlKey(t.ctrl_no) && rows.find(b => !b.turnover_id && ctrlKey(b.turnover_ctrl_no) === ctrlKey(t.ctrl_no))) || null;
  const itemsTotal = items => (items || []).reduce((s, it) => s + num(it.price) * (num(it.qty) || 1), 0);
  const sigImg = name => { const u = (name && typeof window.itatSignatureFor === 'function') ? window.itatSignatureFor(name) : ''; return u ? `<img class="sig" src="${u}" alt="">` : ''; };

  /* ===================== styles ===================== */
  const css = document.createElement('style');
  css.textContent = `
  .byo{max-width:1280px;margin:24px auto 60px;background:var(--paper);border:1px solid var(--line);padding:24px 28px;box-shadow:0 6px 24px rgba(22,32,42,.06)}
  .byo[hidden]{display:none}
  .byo .head{display:flex;justify-content:space-between;align-items:flex-end;gap:20px;flex-wrap:wrap;margin-bottom:14px}
  .byo .title{font-family:var(--head);font-size:18px;font-weight:700;margin:0;background:none;border:0;padding:0}
  .byo .sub{color:var(--muted);font-size:12.5px;margin-top:2px;max-width:760px}
  .byo .bar{display:flex;gap:8px;flex-wrap:wrap;align-items:center;margin-bottom:12px}
  .byo .bar input[type=search]{border:1px solid var(--line);border-radius:6px;padding:7px 10px;width:260px;background:var(--paper)}
  .byo .bar select{border:1px solid var(--line);border-radius:6px;padding:7px 8px;background:var(--paper)}
  .byo .bar .sp{flex:1}
  .byo .kpis{display:flex;gap:8px;flex-wrap:wrap;margin-bottom:12px}
  .byo .kpi{border:1px solid var(--line);border-radius:6px;padding:6px 12px;font-size:12px;color:var(--muted);cursor:pointer;background:var(--paper);text-align:left}
  .byo .kpi b{display:block;font-family:var(--head);font-size:16px;color:var(--ink)}
  .byo .kpi.on{border-color:var(--accent);background:var(--accent-soft)}
  .byo .kpi.money{cursor:default} .byo .kpi.money b{font-family:var(--mono);font-size:14px}
  .byo table{width:100%;border-collapse:collapse;font-size:12.5px}
  .byo th{font-family:var(--head);font-size:11px;letter-spacing:.06em;text-transform:uppercase;color:var(--muted);text-align:left;padding:8px 6px;border-bottom:1px solid var(--line);white-space:nowrap}
  .byo td{padding:8px 6px;border-bottom:1px solid var(--line-soft);vertical-align:top}
  .byo td.m{font-family:var(--mono);font-size:12px;white-space:nowrap} .byo td.r{text-align:right;font-family:var(--mono);font-size:12px;white-space:nowrap}
  .byo tr:hover td{background:var(--ground)}
  .byo .acts{display:flex;gap:4px;white-space:nowrap}
  .byo .acts button{border:1px solid var(--line);background:var(--paper);border-radius:4px;padding:3px 8px;cursor:pointer;font-size:12px}
  .byo .acts button:hover{border-color:var(--accent);color:var(--accent)}
  .byo .acts button.del:hover{border-color:var(--crit);color:var(--crit)}
  .byo .foot{color:var(--faint);font-size:12px;margin-top:10px;display:flex;justify-content:space-between;flex-wrap:wrap;gap:8px}
  .byo .empty{color:var(--muted);text-align:center;padding:28px}
  .byo .small{color:var(--faint);font-size:11.5px}
  .byo-pill{display:inline-block;font-family:var(--head);font-size:10px;letter-spacing:.05em;text-transform:uppercase;border-radius:999px;padding:2px 8px;white-space:nowrap}
  .byo-pill.draft{background:var(--sunken);color:var(--muted)} .byo-pill.pend{background:#FBEBD3;color:#8A5A0B} .byo-pill.appr{background:var(--accent-soft);color:var(--accent)} .byo-pill.done{background:#DFF1E5;color:#2A7A4B} .byo-pill.cancel{background:#F3E1DF;color:var(--crit);text-decoration:line-through}
  .byo-pill.paid{background:#DFF1E5;color:#2A7A4B} .byo-pill.partial{background:#FBEBD3;color:#8A5A0B} .byo-pill.unpaid{background:#F3E1DF;color:var(--crit)}
  .bm{position:fixed;inset:0;background:rgba(22,32,42,.45);display:flex;align-items:flex-start;justify-content:center;padding:32px 16px;z-index:200;overflow:auto}
  .bm[hidden]{display:none}
  .bm .box{background:var(--paper);border:1px solid var(--line);border-radius:10px;width:1040px;max-width:100%;box-shadow:0 16px 48px rgba(22,32,42,.25);display:grid;gap:14px;padding:22px 24px}
  .bm h2{font-family:var(--head);font-size:16px;margin:0;background:none;border:0;padding:0;display:flex;justify-content:space-between;align-items:center;gap:10px}
  .bm h2 button.x{border:0;background:none;font-size:20px;cursor:pointer;color:var(--muted)}
  .bm .sub{color:var(--muted);font-size:12.5px;margin-top:-8px}
  .bm h3{font-family:var(--head);font-size:11px;letter-spacing:.08em;text-transform:uppercase;color:var(--muted);margin:6px 0 0;padding-bottom:4px;border-bottom:1px solid var(--line-soft);display:flex;justify-content:space-between;align-items:center;gap:8px}
  .bm h3 .btn{font-size:11.5px;padding:3px 9px;text-transform:none;letter-spacing:0}
  .bm .grid{display:grid;grid-template-columns:repeat(4,1fr);gap:8px 12px}
  .bm .grid label{display:grid;gap:4px;font-size:12px;color:var(--muted)}
  .bm .grid label.w2{grid-column:span 2} .bm .grid label.w4{grid-column:span 4}
  .bm input,.bm select,.bm textarea{border:1px solid var(--line);border-radius:6px;padding:7px 9px;background:var(--paper);font-size:13px;width:100%;color:var(--ink)}
  .bm textarea{min-height:52px;resize:vertical}
  .bm input:focus,.bm select:focus,.bm textarea:focus{outline:none;border-color:var(--accent)}
  .bm .chk{display:flex;align-items:center;gap:8px;color:var(--ink);font-size:12.5px}
  .bm .chk input{width:auto}
  .bm .btns{display:flex;gap:8px;justify-content:flex-end;border-top:1px solid var(--line);padding-top:14px;align-items:center;flex-wrap:wrap}
  .bm .btns .msg{flex:1;font-size:12.5px;color:var(--muted)} .bm .btns .msg.err{color:var(--crit)}
  .bm table{width:100%;border-collapse:collapse;font-size:12.5px}
  .bm th{font-family:var(--head);font-size:10.5px;letter-spacing:.06em;text-transform:uppercase;color:var(--muted);text-align:left;padding:6px 4px;border-bottom:1px solid var(--line);white-space:nowrap}
  .bm td{padding:4px;border-bottom:1px solid var(--line-soft);vertical-align:top}
  .bm td input,.bm td select{padding:5px 6px;font-size:12.5px}
  .bm td.m{font-family:var(--mono);font-size:12px}
  .bm td .rm{border:1px solid var(--line);background:var(--paper);border-radius:4px;cursor:pointer;padding:4px 8px;color:var(--muted)}
  .bm td .rm:hover{border-color:var(--crit);color:var(--crit)}
  .bm tfoot td{font-weight:700;border-bottom:0;padding-top:8px}
  .bm .hint{font-size:11.5px;color:var(--faint)}
  .bm .tot{display:flex;gap:18px;flex-wrap:wrap;align-items:center;font-size:12.5px;color:var(--muted);padding:8px 10px;background:var(--ground);border-radius:6px}
  .bm .tot b{font-family:var(--mono);color:var(--ink);font-size:13px}
  .bm .scroll{overflow-x:auto}
  .bm .grid label.byr[hidden]{display:none}
  .bm .grid label{align-content:end}
  .bm .grid label.chk{display:flex;align-items:center;align-self:center}
  .bm .sigprev{display:block;min-height:0;line-height:0}
  .bm .sigprev img{height:46px;max-width:240px;object-fit:contain;object-position:left bottom;margin:2px 0 -6px 4px;position:relative;z-index:1}
  .bm .sigprev em{display:block;line-height:1.3;font-size:11px;font-style:normal;color:var(--faint);margin-bottom:2px}
  .byo-link{display:flex;gap:10px;align-items:center;flex-wrap:wrap;margin-top:8px}
  @media(max-width:760px){.bm .grid{grid-template-columns:1fr 1fr}.bm .grid label.w4{grid-column:span 2}}
  @media print{.byo,.bm,.byo-link{display:none!important}}`;
  document.head.appendChild(css);

  /* ===================== data ===================== */
  let rows = [], channel = null, loaded = false;
  const filt = { q: '', status: '', pay: '', company: '' };
  let sortKey = 'updated_at', sortAsc = false;

  async function load(){
    const { data, error } = await sb.from('itat_buyouts').select('*').order('updated_at', { ascending: false });
    if (error) throw new Error(error.message);
    rows = data || []; loaded = true;
    render(); updateTab();
  }
  function nextRef(company){
    const abbr = abbrOf(company), d = today().replace(/-/g, '');
    let max = 0; const re = new RegExp('^' + abbr + '-BO-\\d{8}-(\\d+)$');
    rows.forEach(r => { const m = re.exec(r.ref_no || ''); if (m) max = Math.max(max, parseInt(m[1], 10)); });
    return `${abbr}-BO-${d}-${String(max + 1).padStart(2, '0')}`;
  }
  async function save(rec){
    const isNew = !rec.id;
    const row = { ...rec, updated_by: currentUser?.id || null, updated_at: new Date().toISOString() };
    row.items = (row.items || []).filter(it => it.type || it.tag || it.sn || it.desc).map(it => ({ ...it, qty: num(it.qty) || 1, acq_cost: it.acq_cost === '' || it.acq_cost == null ? null : num(it.acq_cost), price: it.price === '' || it.price == null ? null : num(it.price) }));
    row.payments = (row.payments || []).filter(p => num(p.amount) > 0 || p.or_no).map(p => ({ ...p, amount: num(p.amount) }));
    row.amount = row.amount === '' || row.amount == null ? null : num(row.amount);
    row.installments = row.installments === '' || row.installments == null ? null : (parseInt(row.installments, 10) || null);
    const p = payOf(row); row.pay_status = p.status; row.amount_paid = p.paid; row.paid_date = p.status === 'Fully paid' ? p.lastDate : null;
    ['released_date','rcvd_date','approved_date','buyer_date','approver_it_date','approver_admin_date'].forEach(k => { if (!row[k]) row[k] = null; });
    if (!row.turnover_id && ctrlKey(row.turnover_ctrl_no)) { // keep the record tied to its turnover even if the link was dropped
      const t = turnovers().find(x => ctrlKey(x.ctrl_no) === ctrlKey(row.turnover_ctrl_no));
      if (t && !rows.some(b => b.turnover_id === t._id && b.id !== row.id)) row.turnover_id = t._id;
    }
    if (!row.turnover_id) row.turnover_id = null;
    if (isNew) { delete row.id; row.created_by = currentUser?.id || null; if (!row.ref_no) row.ref_no = nextRef(row.company); }
    const { data, error } = await sb.from('itat_buyouts').upsert(row).select().single();
    if (error) throw new Error(/duplicate key.*turnover/i.test(error.message) ? 'That turnover record is already linked to another buyout in the register.' : error.message);
    const i = rows.findIndex(r => r.id === data.id); if (i >= 0) rows[i] = data; else rows.unshift(data);
    render(); updateTab();
    syncTurnover(data).catch(e => flash('Buyout saved; could not update the linked turnover: ' + e.message));
    return data;
  }
  async function remove(id){
    const { error } = await sb.from('itat_buyouts').delete().eq('id', id);
    if (error) throw new Error(error.message);
    rows = rows.filter(r => r.id !== id); render(); updateTab();
  }
  // keep the linked turnover's Section 7 payment fields in step with the register
  async function syncTurnover(b){
    if (!b.turnover_id || typeof store === 'undefined' || !store.records) return;
    const p = payOf(b);
    const vals = { bo_appr_it: b.approver_it || '', bo_appr_it_date: b.approver_it_date || '', bo_appr_admin: b.approver_admin || '', bo_appr_admin_date: b.approver_admin_date || '', bo_pay_status: p.status, bo_amount_paid: p.paid ? p.paid.toFixed(2) : '', bo_paid_date: p.status === 'Fully paid' ? (p.lastDate || '') : '', bo_amount: b.amount != null ? Number(b.amount).toFixed(2) : '', bo_or_no: p.lastOr || '', bo_date: p.lastDate || '' };
    if (typeof currentId !== 'undefined' && currentId === b.turnover_id && typeof form !== 'undefined') {
      // the record is open in the form: write into the fields and let autosave persist them
      const f = document.getElementById('form'); if (!f || !f.querySelector('[name=bo_enabled]')?.checked) return;
      let changed = false;
      for (const [k, v] of Object.entries(vals)) { const el = f.querySelector(`[name="${k}"]`); if (el && el.value !== v && !(/^bo_(or_no|date|appr_)/.test(k) && !v)) { el.value = v; changed = true; } }
      if (changed) f.querySelector('[name=bo_amount_paid]')?.dispatchEvent(new Event('input', { bubbles: true }));
      return;
    }
    const rec = store.records.get(b.turnover_id); if (!rec || !rec.bo_enabled) return;
    const next = { ...rec };
    let changed = false;
    for (const [k, v] of Object.entries(vals)) { if (/^bo_(or_no|date|appr_)/.test(k) && !v) continue; if ((rec[k] || '') !== v) { next[k] = v; changed = true; } }
    if (!changed) return;
    next._updated = new Date().toISOString();
    await store.put(next);
    if (typeof renderRecords === 'function' && !document.getElementById('recordsView').hidden) renderRecords();
  }

  /* ===================== list view ===================== */
  const view = document.createElement('div'); view.className = 'byo'; view.id = 'buyoutView'; view.hidden = true;
  view.innerHTML = `
    <div class="head">
      <div><h2 class="title">IT Asset Buyout Register</h2>
        <div class="sub">Company IT assets sold to employees, taken from the Turnover records (Section 7 buyouts are added automatically). Workflow: Draft → For approval → Approved (IT Manager + Administrative Manager) → Released. Payments are tracked per installment / OR.</div></div>
      <div style="display:flex;gap:8px;flex-wrap:wrap"><button class="btn primary" id="byoAdd" title="Pick the turnover record the buyout comes from">+ New buyout from turnover</button><button class="btn" id="byoDirect" title="Buyout without a turnover record">Direct buyout</button><button class="btn" id="byoImport" title="Bring in the Section 7 buyouts already recorded in turnover records">Import from turnovers</button></div>
    </div>
    <div class="kpis" id="byoKpis"></div>
    <div class="bar">
      <input id="byoQ" type="search" placeholder="Search ref, employee, tag, serial, OR no.…" autocomplete="off">
      <select id="byoStatus"><option value="">All statuses</option><option value="open">Open (not released / cancelled)</option>${STATUSES.map(s => `<option>${s}</option>`).join('')}</select>
      <select id="byoPay"><option value="">Any payment</option><option value="due">With balance (unpaid / partial)</option><option>Unpaid</option><option>Partially paid</option><option>Fully paid</option></select>
      <select id="byoCompany"><option value="">All companies</option></select>
      <span class="sp"></span>
      <button class="btn" id="byoPrint">Print register</button>
      <button class="btn" id="byoCsv">Export CSV</button>
    </div>
    <div class="tablewrap"><table>
      <thead><tr><th data-sort="ref_no">Ref. No.</th><th data-sort="company">Company</th><th data-sort="emp_name">Buyer</th><th>Asset(s)</th><th data-sort="amount" style="text-align:right">Price (PHP)</th><th style="text-align:right">Paid / Balance</th><th data-sort="status">Status</th><th data-sort="updated_at">Updated</th><th></th></tr></thead>
      <tbody id="byoRows"></tbody>
    </table></div>
    <div class="foot"><span id="byoFoot"></span><span class="small">"Form" opens the printable IT Asset Buyout Form (Deed of Sale · Proof of Purchase) for that buyout.</span></div>`;
  document.getElementById('recordsView').insertAdjacentElement('afterend', view);
  const $ = s => view.querySelector(s);

  function filtered(){
    const q = filt.q.trim().toLowerCase();
    let list = rows.filter(r => {
      if (filt.company && r.company !== filt.company) return false;
      if (filt.status && (filt.status === 'open' ? ['Released','Cancelled'].includes(r.status) : r.status !== filt.status)) return false;
      if (filt.pay) { const p = payOf(r).status; if (filt.pay === 'due' ? (p === 'Fully paid' || r.status === 'Cancelled') : p !== filt.pay) return false; }
      if (q) { const hay = [r.ref_no, r.company, r.emp_name, r.buyer_name, r.buyer_emp_id, r.buyer_contact, r.buyer_type, r.emp_id, r.emp_dept, r.emp_pos, r.turnover_ctrl_no, r.occasion, r.method, r.status, r.remarks, r.approver_it, r.approver_admin, r.released_by, ...(r.items || []).flatMap(i => [i.type, i.tag, i.sn, i.desc]), ...(r.payments || []).flatMap(p => [p.or_no, p.remarks])].join(' ').toLowerCase(); if (!hay.includes(q)) return false; }
      return true;
    });
    list.sort((a, b) => { let x = a[sortKey] ?? '', y = b[sortKey] ?? ''; if (sortKey === 'amount') { x = num(x); y = num(y); } const c = x < y ? -1 : x > y ? 1 : 0; return sortAsc ? c : -c; });
    return list;
  }
  function render(){
    const sel = $('#byoCompany'), cur = sel.value; const names = [...new Set(rows.map(r => r.company).filter(Boolean))].sort();
    sel.innerHTML = '<option value="">All companies</option>' + names.map(n => `<option ${n === cur ? 'selected' : ''}>${E(n)}</option>`).join('');
    const live = rows.filter(r => r.status !== 'Cancelled');
    const outstanding = live.reduce((s, r) => s + payOf(r).balance, 0), collected = live.reduce((s, r) => s + payOf(r).paid, 0);
    $('#byoKpis').innerHTML = [['', 'All', rows.length], ...STATUSES.map(s => [s, s, rows.filter(r => r.status === s).length])]
      .map(([v, l, n]) => `<button type="button" class="kpi ${filt.status === v ? 'on' : ''}" data-status="${E(v)}">${E(l)}<b>${n}</b></button>`).join('')
      + `<button type="button" class="kpi ${filt.pay === 'due' ? 'on' : ''}" data-pay="due" title="Buyouts with an unpaid balance">Balance outstanding<b style="font-family:var(--mono);font-size:14px">PHP ${money(outstanding)}</b></button>`
      + `<span class="kpi money">Collected<b>PHP ${money(collected)}</b></span>`;
    $('#byoKpis').querySelectorAll('[data-status]').forEach(b => b.onclick = () => { filt.status = b.dataset.status; $('#byoStatus').value = filt.status; render(); });
    $('#byoKpis').querySelectorAll('[data-pay]').forEach(b => b.onclick = () => { filt.pay = filt.pay === 'due' ? '' : 'due'; $('#byoPay').value = filt.pay; render(); });
    const list = filtered();
    $('#byoRows').innerHTML = list.length ? list.map(r => {
      const p = payOf(r), its = r.items || [];
      const summary = its.slice(0, 3).map(i => `<b>${E(i.type || 'Item')}</b>${num(i.qty) > 1 ? ' ×' + i.qty : ''}${i.tag || i.sn ? ` <span class="small" style="font-family:var(--mono)">${E(i.tag || i.sn)}</span>` : ''}${i.desc ? ` <span class="small">${E(i.desc)}</span>` : ''}`).join('<br>') + (its.length > 3 ? `<br><span class="small">+${its.length - 3} more</span>` : '');
      return `<tr data-id="${r.id}">
      <td class="m">${E(r.ref_no || '')}${r.turnover_ctrl_no ? `<br><span class="small" title="Linked turnover record">↳ ${E(r.turnover_ctrl_no)}</span>` : ''}</td>
      <td>${E(r.company || '')}</td>
      <td>${(() => { const b = buyerOf(r); return `<b>${E(b.name)}</b>${b.other ? ` <span class="byo-pill ${b.kind === 'out' ? 'pend' : 'appr'}">${b.kind === 'out' ? 'Outside party' : 'Other employee'}</span>` : ''}<br><span class="small">${E((b.kind === 'out' ? [b.contact, b.rel] : [b.id, b.dept]).filter(Boolean).join(' · '))}</span>${b.other ? `<br><span class="small">turned over by ${E(r.emp_name || '—')}</span>` : ''}`; })()}${r.occasion ? `<br><span class="small">${E(r.occasion)}</span>` : ''}</td>
      <td>${summary || '<span class="small">—</span>'}</td>
      <td class="r">${r.amount != null ? money(r.amount) : '—'}${r.method ? `<br><span class="small" style="font-family:var(--body,inherit)">${E(r.method)}${r.installments > 1 ? ' · ' + r.installments + ' inst.' : ''}</span>` : ''}</td>
      <td class="r"><span class="byo-pill ${p.cls}">${E(p.status)}</span><br>${money(p.paid)}${p.balance > 0 ? `<br><span style="color:var(--crit)">bal ${money(p.balance)}</span>` : ''}</td>
      <td><span class="byo-pill ${statusCls(r.status)}">${E(r.status)}</span>${r.released_date && r.status === 'Released' ? `<br><span class="small">${E(fmtD(r.released_date))}</span>` : ''}${r.status === 'Cancelled' ? '' : `<br><span class="small" title="IT Manager: ${E(r.approver_it || 'not yet')} · Administrative Manager: ${E(r.approver_admin || 'not yet')}">${r.approver_it ? '✓' : '○'} IT Mgr · ${r.approver_admin ? '✓' : '○'} Admin Mgr</span>`}${['Approved','Released'].includes(r.status) && !approvedBoth(r) ? '<br><span class="byo-pill unpaid" title="Needs approval by both the IT Manager and the Administrative Manager">Approval incomplete</span>' : ''}</td>
      <td class="small" style="white-space:nowrap">${E(fmtD(r.updated_at))}</td>
      <td><div class="acts"><button type="button" data-edit>Edit</button><button type="button" data-form>Form</button><button type="button" class="del" data-del>Remove</button></div></td></tr>`; }).join('')
      : `<tr><td colspan="9" class="empty">${rows.length ? 'No buyouts match the current filter.' : 'No buyouts recorded yet. Use <b>+ New buyout</b> to record a sale of IT asset(s) to an employee, or <b>Import from turnovers</b> to bring in Section 7 buyouts.'}</td></tr>`;
    const tot = list.reduce((s, r) => s + num(r.amount), 0);
    $('#byoFoot').textContent = `${list.length} of ${rows.length} buyout(s) · total price PHP ${money(tot)}`;
    $('#byoRows').querySelectorAll('[data-edit]').forEach(b => b.onclick = () => openEdit(rows.find(r => r.id === b.closest('tr').dataset.id)));
    $('#byoRows').querySelectorAll('[data-form]').forEach(b => b.onclick = () => openDoc(buildFormDoc(rows.find(r => r.id === b.closest('tr').dataset.id))));
    $('#byoRows').querySelectorAll('[data-del]').forEach(b => b.onclick = async () => {
      if (b.dataset.armed !== '1') { b.dataset.armed = '1'; b.textContent = 'Confirm'; setTimeout(() => { b.dataset.armed = ''; b.textContent = 'Remove'; }, 4000); return; }
      try { await remove(b.closest('tr').dataset.id); flash('Buyout removed from the register.'); } catch (e) { alert(e.message); }
    });
  }
  $('#byoQ').addEventListener('input', () => { filt.q = $('#byoQ').value; render(); });
  $('#byoStatus').addEventListener('change', () => { filt.status = $('#byoStatus').value; render(); });
  $('#byoPay').addEventListener('change', () => { filt.pay = $('#byoPay').value; render(); });
  $('#byoCompany').addEventListener('change', () => { filt.company = $('#byoCompany').value; render(); });
  view.querySelectorAll('th[data-sort]').forEach(th => { th.style.cursor = 'pointer'; th.onclick = () => { const k = th.dataset.sort; if (sortKey === k) sortAsc = !sortAsc; else { sortKey = k; sortAsc = k !== 'updated_at' && k !== 'amount'; } render(); }; });
  $('#byoAdd').onclick = () => openPick();
  $('#byoDirect').onclick = () => openEdit(null);
  $('#byoImport').onclick = () => openImport();
  $('#byoCsv').onclick = exportCsv;
  $('#byoPrint').onclick = () => openDoc(buildListDoc(filtered()));

  /* ===================== toolbar tab ===================== */
  const tab = document.createElement('button'); tab.className = 'tab'; tab.id = 'tabBuyout'; tab.setAttribute('role', 'tab'); tab.hidden = true;
  tab.innerHTML = 'Buyout <span class="badge" id="byoCount">0</span>';
  tab.title = 'Buyouts not yet released, or with an unpaid balance';
  document.querySelector('.toolbar .tabs').appendChild(tab);
  function updateTab(){ document.getElementById('byoCount').textContent = rows.filter(r => r.status !== 'Cancelled' && (r.status !== 'Released' || payOf(r).balance > 0)).length; }
  const prevShowView = showView;
  showView = function (v) {
    if (v === 'buyouts') {
      document.getElementById('recordsView').hidden = true; document.getElementById('form').hidden = true;
      const dv = document.getElementById('disposalView'); if (dv) dv.hidden = true;
      document.querySelectorAll('.toolbar .tabs .tab').forEach(t => t.classList.remove('on')); tab.classList.add('on');
      view.hidden = false; render(); return;
    }
    view.hidden = true; tab.classList.remove('on'); prevShowView(v);
  };
  tab.onclick = () => showView('buyouts');

  /* ===================== add / edit modal ===================== */
  const em = document.createElement('div'); em.className = 'bm'; em.hidden = true;
  em.innerHTML = `
    <div class="box" role="dialog" aria-label="Asset buyout">
      <h2><span id="bmTitle">New asset buyout</span> <button type="button" class="x" id="bmClose" aria-label="Close">×</button></h2>
      <div class="sub">The buyout is taken from the turnover record. The buyer can be that employee, another employee or an outside party — set the selling prices and record every payment received.</div>
      <form id="bmForm" autocomplete="off">
        <input type="hidden" name="id"><input type="hidden" name="ref_no">
        <h3>Source turnover record <span class="hint" style="text-transform:none;letter-spacing:0">the employee and Section 2 assets come from this record · choose "none" only for a direct buyout</span></h3>
        <div class="grid">
          <label class="w2">Turnover record <select name="turnover_id"><option value="">— none (direct buyout) —</option></select></label>
          <label>Turnover Control No. <input name="turnover_ctrl_no" readonly placeholder="—"></label>
          <label style="align-self:end"><button type="button" class="btn" id="bmFromTo">Load employee &amp; assets</button></label>
        </div>
        <h3>1. Employee who turned over the asset(s) <span class="hint" style="text-transform:none;letter-spacing:0">last custodian</span></h3>
        <div class="grid">
          <label class="w2">Company <select name="company" required><option value="">— select —</option></select></label>
          <label>Ref. No. <input name="ref_view" readonly placeholder="auto on save"></label>
          <label>Occasion <select name="occasion"><option value="">— select —</option>${OCCASIONS.map(o => `<option>${E(o)}</option>`).join('')}</select></label>
          <label class="w2">Employee name <input name="emp_name" list="bmEmps" required placeholder="type to pick from turnover records"><datalist id="bmEmps"></datalist></label>
          <label>Employee ID <input name="emp_id"></label>
          <label>Department <input name="emp_dept"></label>
          <label>Position <input name="emp_pos"></label>
          <label>Immediate supervisor <input name="emp_sup"></label>
        </div>
        <h3>Buyer</h3>
        <div class="grid">
          <label class="w2">Who is buying the asset(s)? <select name="buyer_type"><option value="">The employee who turned over the asset(s)</option><option>Another employee</option><option>Outside party (non-employee)</option></select></label>
          <label class="w2 byr" data-for="emp out">Buyer full name <input name="buyer_name" list="bmEmps"></label>
          <label class="byr" data-for="emp">Buyer employee ID <input name="buyer_emp_id"></label>
          <label class="byr" data-for="emp">Department <input name="buyer_dept"></label>
          <label class="byr" data-for="emp">Position <input name="buyer_pos"></label>
          <label class="byr" data-for="emp">Company <input name="buyer_company" list="bmCos"><datalist id="bmCos"></datalist></label>
          <label class="byr" data-for="emp out">Contact no. / e-mail <input name="buyer_contact"></label>
          <label class="w2 byr" data-for="out">Address <input name="buyer_address"></label>
          <label class="byr" data-for="out">Valid ID presented (type &amp; no.) <input name="buyer_idref"></label>
          <label class="w2 byr" data-for="emp out">Relationship to the employee / company <input name="buyer_rel" placeholder="e.g. spouse, co-worker, outside buyer"></label>
        </div>
        <h3>2. IT asset(s) sold <span><button type="button" class="btn" id="bmAddItem">+ Add asset</button></span></h3>
        <div class="scroll"><table>
          <thead><tr><th style="width:150px">Asset type</th><th style="width:110px">Asset tag</th><th style="width:120px">Serial no.</th><th>Description / model</th><th style="width:84px">Condition</th><th style="width:52px">Qty</th><th style="width:118px">Acq. date</th><th style="width:96px">Acq. cost</th><th style="width:104px">Selling price</th><th style="width:34px"></th></tr></thead>
          <tbody id="bmItems"></tbody>
          <tfoot><tr><td colspan="8" style="text-align:right">Total of selling prices</td><td class="m" id="bmItemsTot">0.00</td><td></td></tr></tfoot>
        </table></div>
        <datalist id="bmTypes">${ASSET_TYPES.map(t => `<option value="${E(t)}">`).join('')}</datalist>
        <h3>3. Sale &amp; payment terms</h3>
        <div class="grid">
          <label>Agreed buyout price (PHP) <input name="amount" inputmode="decimal" placeholder="0.00"></label>
          <label>Basis of valuation <select name="basis"><option value="">— select —</option>${BASES.map(o => `<option>${E(o)}</option>`).join('')}</select></label>
          <label>Payment method <select name="method"><option value="">— select —</option>${METHODS.map(o => `<option>${E(o)}</option>`).join('')}</select></label>
          <label>No. of installments <input name="installments" type="number" min="1" placeholder="1"></label>
          <label class="w4">Remarks / inclusions (condition sold, accessories, warranty, licenses) <input name="remarks"></label>
        </div>
        <h3>Payments received <span><button type="button" class="btn" id="bmPayFull">Record full balance</button> <button type="button" class="btn" id="bmAddPay">+ Add payment</button></span></h3>
        <table>
          <thead><tr><th style="width:140px">Date</th><th style="width:130px">Amount (PHP)</th><th style="width:150px">OR / AR No.</th><th style="width:170px">Method</th><th>Remarks (e.g. payroll period)</th><th style="width:34px"></th></tr></thead>
          <tbody id="bmPays"></tbody>
        </table>
        <div class="tot" id="bmTot"></div>
        <h3>Pre-release checklist</h3>
        <div class="grid">
          <label class="chk w2"><input type="checkbox" name="data_wiped"> Company data backed up and device wiped / reset</label>
          <label class="chk w2"><input type="checkbox" name="licenses_removed"> Company accounts, MDM and licensed software removed / deactivated</label>
        </div>
        <h3>Status &amp; sign-off</h3>
        <div class="grid">
          <label>Status <select name="status">${STATUSES.map(s => `<option>${s}</option>`).join('')}</select></label>
          <label class="w2">Approved by &mdash; IT Manager <input name="approver_it" list="itatSigNames" placeholder="type or pick a name — signature appears"></label>
          <label>IT Manager approval date <input name="approver_it_date" type="date"></label>
          <label class="w2">Approved by &mdash; Administrative Manager <input name="approver_admin" list="itatSigNames" placeholder="type or pick a name — signature appears"></label>
          <label>Admin. Manager approval date <input name="approver_admin_date" type="date"></label>
          <span class="hint" style="grid-column:1/-1;margin-top:-4px">Both approvals are required before the buyout can be set to <b>Approved</b> or <b>Released</b>.</span>
          <label class="w2">Released by (IT Department) <input name="released_by" list="itatSigNames"></label>
          <label>Release date <input name="released_date" type="date"></label>
          <label>Buyer acknowledged on <input name="buyer_date" type="date"></label>
          <label class="w2">Payment received by (Finance / Cashier) <input name="rcvd_name" list="itatSigNames"></label>
          <label>Received date <input name="rcvd_date" type="date"></label>
        </div>
      </form>
      <div class="btns"><span class="msg" id="bmMsg"></span><button type="button" class="btn" id="bmCancel">Cancel</button><button type="button" class="btn" id="bmSaveForm">Save &amp; open form</button><button type="button" class="btn primary" id="bmSave">Save</button></div>
    </div>`;
  document.body.appendChild(em);
  const F = em.querySelector('#bmForm');
  const fv = n => F.querySelector(`[name="${n}"]`);
  const bmMsg = (m, err) => { const el = em.querySelector('#bmMsg'); el.textContent = m || ''; el.classList.toggle('err', !!err); };

  const itemRow = (it = {}) => `<tr>
    <td><input data-k="type" list="bmTypes" value="${E(it.type || '')}"></td>
    <td><input data-k="tag" value="${E(it.tag || '')}" style="font-family:var(--mono)"></td>
    <td><input data-k="sn" value="${E(it.sn || '')}" style="font-family:var(--mono)"></td>
    <td><input data-k="desc" value="${E(it.desc || '')}"></td>
    <td><select data-k="cond"><option value=""></option>${CONDS.map(c => `<option ${it.cond === c ? 'selected' : ''}>${c}</option>`).join('')}</select></td>
    <td><input data-k="qty" type="number" min="1" value="${E(it.qty || 1)}"></td>
    <td><input data-k="acq_date" type="date" value="${E(it.acq_date || '')}"></td>
    <td><input data-k="acq_cost" inputmode="decimal" value="${it.acq_cost != null && it.acq_cost !== '' ? E(it.acq_cost) : ''}"></td>
    <td><input data-k="price" inputmode="decimal" value="${it.price != null && it.price !== '' ? E(it.price) : ''}" placeholder="0.00"></td>
    <td><button type="button" class="rm" title="Remove row">×</button></td></tr>`;
  const payRow = (p = {}) => `<tr>
    <td><input data-k="date" type="date" value="${E(p.date || '')}"></td>
    <td><input data-k="amount" inputmode="decimal" value="${p.amount != null && p.amount !== '' ? E(p.amount) : ''}" placeholder="0.00"></td>
    <td><input data-k="or_no" value="${E(p.or_no || '')}" style="font-family:var(--mono)"></td>
    <td><select data-k="method"><option value=""></option>${METHODS.map(m => `<option ${p.method === m ? 'selected' : ''}>${m}</option>`).join('')}</select></td>
    <td><input data-k="remarks" value="${E(p.remarks || '')}"></td>
    <td><button type="button" class="rm" title="Remove payment">×</button></td></tr>`;
  const readRows = sel => [...em.querySelectorAll(sel + ' tr')].map(tr => Object.fromEntries([...tr.querySelectorAll('[data-k]')].map(el => [el.dataset.k, el.value.trim()])));
  const readItems = () => readRows('#bmItems').filter(it => it.type || it.tag || it.sn || it.desc || it.price);
  const readPays = () => readRows('#bmPays').filter(p => p.amount || p.or_no || p.date);
  function setItems(items){ em.querySelector('#bmItems').innerHTML = (items && items.length ? items : [{}]).map(itemRow).join(''); recalc(); }
  function setPays(pays){ em.querySelector('#bmPays').innerHTML = (pays && pays.length ? pays : []).map(payRow).join(''); recalc(); }
  let amountAuto = true;
  function recalc(){
    const items = readItems(), tot = itemsTotal(items);
    em.querySelector('#bmItemsTot').textContent = money(tot);
    if (amountAuto && tot > 0) fv('amount').value = tot.toFixed(2);
    const p = payOf({ amount: fv('amount').value, payments: readPays() });
    const inst = parseInt(fv('installments').value, 10);
    em.querySelector('#bmTot').innerHTML = `<span>Price <b>PHP ${money(p.amount)}</b></span><span>Paid <b>PHP ${money(p.paid)}</b></span><span>Balance <b style="color:${p.balance > 0 ? 'var(--crit)' : '#2A7A4B'}">PHP ${money(p.balance)}</b></span><span class="byo-pill ${p.cls}">${p.status}</span>${inst > 1 && p.amount ? `<span>Installment ≈ <b>PHP ${money(p.amount / inst)}</b> × ${inst}</span>` : ''}${p.amount ? `<span style="font-style:italic">${E(amountWords(p.amount))}</span>` : ''}`;
  }
  em.querySelector('#bmItems').addEventListener('input', recalc);
  em.querySelector('#bmPays').addEventListener('input', recalc);
  em.querySelector('#bmPays').addEventListener('change', recalc);
  fv('amount').addEventListener('input', () => { amountAuto = !fv('amount').value.trim(); recalc(); });
  fv('installments').addEventListener('input', recalc);
  em.addEventListener('click', e => { const b = e.target.closest('.rm'); if (!b) return; const tr = b.closest('tr'); const body = tr.parentElement; tr.remove(); if (body.id === 'bmItems' && !body.children.length) body.innerHTML = itemRow({}); recalc(); });
  em.querySelector('#bmAddItem').onclick = () => { em.querySelector('#bmItems').insertAdjacentHTML('beforeend', itemRow({})); em.querySelector('#bmItems tr:last-child input').focus(); };
  em.querySelector('#bmAddPay').onclick = () => { em.querySelector('#bmPays').insertAdjacentHTML('beforeend', payRow({ date: today(), method: fv('method').value })); em.querySelector('#bmPays tr:last-child [data-k=amount]').focus(); recalc(); };
  em.querySelector('#bmPayFull').onclick = () => {
    const p = payOf({ amount: fv('amount').value, payments: readPays() });
    if (!p.amount) { bmMsg('Enter the agreed buyout price first.', true); fv('amount').focus(); return; }
    if (p.balance <= 0) { bmMsg('Already fully paid.'); return; }
    em.querySelector('#bmPays').insertAdjacentHTML('beforeend', payRow({ date: today(), amount: p.balance.toFixed(2), method: fv('method').value }));
    em.querySelector('#bmPays tr:last-child [data-k=or_no]').focus(); recalc(); bmMsg('Balance added as a payment — enter the OR / AR no.');
  };
  // employee datalist + autofill from turnover records
  function empIndex(){
    const m = new Map();
    turnovers().sort((a, b) => String(a._updated || '').localeCompare(String(b._updated || ''))).forEach(r => { if (r.emp_name) m.set(r.emp_name.trim().toLowerCase(), r); });
    rows.forEach(r => { if (r.emp_name && !m.has(r.emp_name.trim().toLowerCase())) m.set(r.emp_name.trim().toLowerCase(), { emp_name: r.emp_name, emp_id: r.emp_id, emp_dept: r.emp_dept, emp_pos: r.emp_pos, emp_sup: r.emp_sup, company: r.company }); });
    return m;
  }
  fv('emp_name').addEventListener('change', () => {
    const r = empIndex().get(fv('emp_name').value.trim().toLowerCase()); if (!r) return;
    ['emp_id','emp_dept','emp_pos','emp_sup'].forEach(k => { if (!fv(k).value && r[k]) fv(k).value = r[k]; });
    const co = coName(r); if (!fv('company').value && co) fv('company').value = co;
  });
  function turnoverAssets(r, onlyBuyout){
    return ASSET_TYPES.map((t, i) => ({ i, type: t, tag: r[`a${i}_tag`] || '', sn: r[`a${i}_sn`] || '', desc: r[`a${i}_desc`] || '', cond: r[`a${i}_good`] ? 'Good' : r[`a${i}_dmg`] ? 'Damaged' : '', rem: r[`a${i}_rem`] || '' }))
      .filter(a => (a.tag || a.sn || a.desc) && (!onlyBuyout || r['bo_item' + a.i]))
      .map(({ i, ...a }) => ({ ...a, qty: 1 }));
  }
  em.querySelector('#bmFromTo').onclick = () => {
    const r = turnovers().find(x => x._id === fv('turnover_id').value);
    if (!r) { bmMsg('Pick a turnover record first.', true); return; }
    ['emp_name','emp_id','emp_dept','emp_pos','emp_sup'].forEach(k => { if (r[k]) fv(k).value = r[k]; });
    const co = coName(r); if (co) fv('company').value = co;
    const items = turnoverAssets(r, !!r.bo_enabled);
    const cur = readItems();
    if (items.length) setItems(cur.length ? [...cur, ...items.filter(n => !cur.some(c => c.type === n.type && (c.tag || '') === n.tag && (c.sn || '') === n.sn))] : items);
    if (r.bo_enabled) {
      if (r.bo_amount && !fv('amount').value) { fv('amount').value = num(r.bo_amount).toFixed(2); amountAuto = false; }
      if (r.bo_basis && !fv('basis').value) fv('basis').value = r.bo_basis;
      if (r.bo_method && !fv('method').value) fv('method').value = r.bo_method;
      [['approver_it','bo_appr_it'],['approver_it_date','bo_appr_it_date'],['approver_admin','bo_appr_admin'],['approver_admin_date','bo_appr_admin_date']].forEach(([k, src]) => { if (r[src] && !fv(k).value) fv(k).value = r[src]; });
    }
    if (!fv('occasion').value) fv('occasion').value = r.r_resign ? 'Resignation / separation' : r.r_term ? 'End of contract' : r.r_replace ? 'Equipment refresh / upgrade program' : '';
    if (!fv('released_by').value && r.sg2_name) fv('released_by').value = r.sg2_name;
    recalc();
    bmMsg(`Loaded ${items.length} asset(s) from ${r.ctrl_no || 'the turnover'}${r.bo_enabled ? ' (Section 7 buyout items)' : ''}. Remove the rows not being sold, then set the selling prices.`);
  };
  fv('turnover_id').addEventListener('change', () => { const r = turnovers().find(x => x._id === fv('turnover_id').value); fv('turnover_ctrl_no').value = r ? (r.ctrl_no || '') : ''; });
  fv('status').addEventListener('change', () => {
    const s = fv('status').value;
    if (s === 'Approved' || s === 'Released') { if (fv('approver_it').value && !fv('approver_it_date').value) fv('approver_it_date').value = today(); if (fv('approver_admin').value && !fv('approver_admin_date').value) fv('approver_admin_date').value = today(); }
    if (s === 'Released') { if (!fv('released_date').value) fv('released_date').value = today(); if (!fv('buyer_date').value) fv('buyer_date').value = today(); }
  });

  function syncBuyerFields(){
    const k = buyerKind(fv('buyer_type').value);
    F.querySelectorAll('.byr').forEach(l => { l.hidden = !l.dataset.for.split(' ').includes(k); });
  }
  fv('buyer_type').addEventListener('change', () => { syncBuyerFields(); if (fv('buyer_type').value) { if (buyerKind(fv('buyer_type').value) === 'emp' && !fv('buyer_company').value) fv('buyer_company').value = fv('company').value; fv('buyer_name').focus(); } });
  fv('buyer_name').addEventListener('change', () => {
    if (buyerKind(fv('buyer_type').value) !== 'emp') return;
    const r = empIndex().get(fv('buyer_name').value.trim().toLowerCase()); if (!r) return;
    [['buyer_emp_id','emp_id'],['buyer_dept','emp_dept'],['buyer_pos','emp_pos']].forEach(([k, src]) => { if (!fv(k).value && r[src]) fv(k).value = r[src]; });
    const co = coName(r); if (co) fv('buyer_company').value = co;
  });
  // signatory fields: show the saved signature as soon as the name matches the signature library
  const SIG_FIELDS = ['approver_it','approver_admin','released_by','rcvd_name'];
  function sigPreview(n){
    const el = fv(n); if (!el) return;
    let pv = el.parentElement.querySelector('.sigprev');
    if (!pv) { pv = document.createElement('span'); pv.className = 'sigprev'; el.before(pv); }
    const v = el.value.trim(), u = v && typeof window.itatSignatureFor === 'function' ? window.itatSignatureFor(v) : '';
    const html = u ? `<img src="${u}" alt="Signature of ${E(v)}">` : v ? '<em>No saved signature for this name — add it under Signatures to have it appear here and on the form.</em>' : '';
    if (pv.dataset.v !== v + '|' + !!u) { pv.innerHTML = html; pv.dataset.v = v + '|' + !!u; }
  }
  SIG_FIELDS.forEach(n => { fv(n).addEventListener('input', () => sigPreview(n)); fv(n).addEventListener('change', () => sigPreview(n)); });
  setInterval(() => { if (!em.hidden) SIG_FIELDS.forEach(sigPreview); }, 800); // picks up signatures added while the window is open
  function openEdit(rec){
    F.reset(); bmMsg(''); amountAuto = true;
    fv('company').innerHTML = '<option value="">— select —</option>' + companies().map(c => `<option>${E(c.name)}</option>`).join('');
    const used = new Set(turnovers().filter(t => { const b = coveredBy(t); return b && (!rec || b.id !== rec.id); }).map(t => t._id));
    const tos = turnovers().sort((a, b) => String(b._updated || '').localeCompare(String(a._updated || '')));
    fv('turnover_id').innerHTML = '<option value="">— none (direct buyout) —</option>' + tos.map(r => `<option value="${E(r._id)}" ${used.has(r._id) ? 'disabled' : ''}>${E([r.ctrl_no || '(no ctrl no.)', r.emp_name, r.emp_date].filter(Boolean).join(' · '))}${r.bo_enabled ? ' · with buyout' : ''}${used.has(r._id) ? ' — already in register' : ''}</option>`).join('');
    em.querySelector('#bmCos').innerHTML = companies().map(c => `<option value="${E(c.name)}">`).join('');
    em.querySelector('#bmEmps').innerHTML = [...empIndex().values()].map(r => `<option value="${E(r.emp_name)}">${E([r.emp_id, r.emp_dept].filter(Boolean).join(' · '))}</option>`).join('');
    const last = rows[0] || {};
    const lastAppr = rows.find(x => x.approver_it || x.approver_admin) || {};
    const r = rec || { status: 'Draft', company: last.company || '', released_by: last.released_by || '', rcvd_name: last.rcvd_name || '', approver_it: lastAppr.approver_it || '', approver_admin: lastAppr.approver_admin || '' };
    if (rec && !rec.id) { if (!r.approver_it) r.approver_it = lastAppr.approver_it || ''; if (!r.approver_admin) r.approver_admin = lastAppr.approver_admin || ''; }
    em.querySelector('#bmTitle').textContent = rec && rec.id ? `Edit buyout ${rec.ref_no || ''}` : 'New asset buyout';
    F.querySelectorAll('input[name],select[name],textarea[name]').forEach(el => { if (el.type === 'checkbox') el.checked = !!r[el.name]; else if (el.name !== 'ref_view') el.value = r[el.name] ?? ''; });
    if (r.company && !fv('company').value) { fv('company').insertAdjacentHTML('beforeend', `<option>${E(r.company)}</option>`); fv('company').value = r.company; }
    if (r.turnover_id && !fv('turnover_id').value) { fv('turnover_id').insertAdjacentHTML('beforeend', `<option value="${E(r.turnover_id)}">${E(r.turnover_ctrl_no || r.turnover_id)}</option>`); fv('turnover_id').value = r.turnover_id; }
    fv('ref_view').value = r.ref_no || '';
    setItems(r.items || []); setPays(r.payments || []); syncBuyerFields(); SIG_FIELDS.forEach(sigPreview);
    if (rec && r.amount != null) { const t = itemsTotal(r.items); amountAuto = !(t > 0 && Math.abs(t - num(r.amount)) > 0.005) && t > 0; fv('amount').value = num(r.amount).toFixed(2); }
    recalc();
    if (rec && !rec.id && rec.turnover_id) bmMsg(`Filled from turnover ${rec.turnover_ctrl_no || ''} — remove any asset not being sold, then set the selling prices.`);
    em.hidden = false; setTimeout(() => (rec ? fv('emp_name') : fv('turnover_id')).focus(), 30);
  }
  function collectEdit(){
    const o = {}; F.querySelectorAll('input[name],select[name],textarea[name]').forEach(el => { if (el.name === 'ref_view') return; o[el.name] = el.type === 'checkbox' ? el.checked : el.value.trim(); });
    o.items = readItems(); o.payments = readPays();
    if (!o.id) delete o.id;
    return o;
  }
  async function submit(openForm){
    const o = collectEdit();
    if (!o.company) { bmMsg('Select the company.', true); fv('company').focus(); return; }
    if (!o.emp_name) { bmMsg('Enter the employee (buyer) name.', true); fv('emp_name').focus(); return; }
    const bk = buyerKind(o.buyer_type);
    if (bk !== 'same' && !o.buyer_name) { bmMsg('Enter the buyer\'s full name (or choose "The employee who turned over the asset(s)").', true); fv('buyer_name').focus(); return; }
    if (bk === 'out' && /deduct/i.test(o.method || '')) { bmMsg('An outside party cannot pay by salary / final-pay deduction — choose another payment method.', true); fv('method').focus(); return; }
    if (bk === 'same') ['buyer_name','buyer_emp_id','buyer_dept','buyer_pos','buyer_company','buyer_address','buyer_idref','buyer_rel'].forEach(k => { o[k] = ''; });
    if (bk === 'emp') ['buyer_address','buyer_idref'].forEach(k => { o[k] = ''; });
    if (bk === 'out') ['buyer_emp_id','buyer_dept','buyer_pos','buyer_company'].forEach(k => { o[k] = ''; });
    if (!o.items.length) { bmMsg('Add at least one IT asset being sold.', true); return; }
    if (o.items.some(it => !it.type)) { bmMsg('Every asset row needs an asset type.', true); return; }
    if (['Approved','Released'].includes(o.status) && !approvedBoth(o)) { bmMsg('A buyout needs approval by both the IT Manager and the Administrative Manager before it can be ' + o.status.toLowerCase() + '.', true); fv(o.approver_it ? 'approver_admin' : 'approver_it').focus(); return; }
    if (['Approved','Released'].includes(o.status)) { if (!o.approver_it_date) o.approver_it_date = today(); if (!o.approver_admin_date) o.approver_admin_date = today(); }
    if (['Draft','For approval'].includes(o.status) && approvedBoth(o) && o.approver_it_date && o.approver_admin_date) { o.status = 'Approved'; flash('Both approvals recorded — status set to Approved.'); }
    if (o.status === 'Released' && !num(o.amount)) { bmMsg('Set the agreed buyout price before releasing.', true); fv('amount').focus(); return; }
    const btns = em.querySelectorAll('.btns button'); btns.forEach(b => b.disabled = true); bmMsg('Saving…');
    try {
      const saved = await save(o);
      em.hidden = true; flash(`Buyout ${saved.ref_no} saved.`);
      if (openForm) openDoc(buildFormDoc(saved));
    } catch (e) { bmMsg(e.message, true); }
    finally { btns.forEach(b => b.disabled = false); }
  }
  em.querySelector('#bmSave').onclick = () => submit(false);
  em.querySelector('#bmSaveForm').onclick = () => submit(true);
  em.querySelector('#bmClose').onclick = em.querySelector('#bmCancel').onclick = () => { em.hidden = true; };
  em.addEventListener('keydown', e => { if (e.key === 'Escape') em.hidden = true; });

  /* ===================== import Section 7 buyouts from turnovers ===================== */
  function fromTurnover(r){
    const amount = num(r.bo_amount), paid = r.bo_pay_status === 'Fully paid' ? amount : num(r.bo_amount_paid);
    const payDate = r.bo_paid_date || r.bo_date || '';
    const payments = paid > 0 || r.bo_or_no ? [{ date: payDate, amount: paid || (r.bo_or_no ? amount : 0), or_no: r.bo_or_no || '', method: r.bo_method || '', remarks: 'Imported from turnover ' + (r.ctrl_no || '') }] : [];
    const fully = payOf({ amount, payments }).status === 'Fully paid';
    return {
      company: coName(r), emp_name: r.emp_name || '', emp_id: r.emp_id || '', emp_dept: r.emp_dept || '', emp_pos: r.emp_pos || '', emp_sup: r.emp_sup || '',
      occasion: r.r_resign ? 'Resignation / separation' : r.r_term ? 'End of contract' : r.r_replace ? 'Equipment refresh / upgrade program' : '',
      turnover_id: r._id, turnover_ctrl_no: r.ctrl_no || '', ref_no: (r.ctrl_no || '').trim() ? r.ctrl_no.trim() + '-BO' : '',
      items: turnoverAssets(r, true), amount: amount || null, basis: r.bo_basis || '', method: r.bo_method || '', payments,
      approver_it: r.bo_appr_it || '', approver_it_date: r.bo_appr_it_date || '', approver_admin: r.bo_appr_admin || '', approver_admin_date: r.bo_appr_admin_date || '', released_by: r.sg2_name || '', released_date: fully ? (r.sg2_date || payDate || '') : '',
      rcvd_name: r.bo_rcvd_name || '', rcvd_date: r.bo_rcvd_date || '', buyer_date: r.bo_buyer_date || '', remarks: r.bo_remarks || '',
      status: (r.bo_appr_it && r.bo_appr_admin) ? (fully ? 'Released' : 'Approved') : 'For approval',
      buyer_type: r.bo_buyer_type && (r.bo_buyer || '').trim() ? r.bo_buyer_type : '', buyer_name: r.bo_buyer_type ? (r.bo_buyer || '') : '',
      buyer_emp_id: r.bo_buyer_emp_id || '', buyer_dept: r.bo_buyer_dept || '', buyer_pos: r.bo_buyer_pos || '', buyer_company: /^Another/.test(r.bo_buyer_type || '') ? coName(r) : '',
      buyer_contact: r.bo_buyer_contact || '', buyer_address: r.bo_buyer_address || '', buyer_idref: r.bo_buyer_idref || '', buyer_rel: r.bo_buyer_rel || ''
    };
  }
  const im = document.createElement('div'); im.className = 'bm'; im.hidden = true;
  im.innerHTML = `<div class="box" role="dialog" aria-label="Import buyouts from turnovers" style="width:900px">
    <h2>Import buyouts from turnover records <button type="button" class="x" data-close aria-label="Close">×</button></h2>
    <div class="sub">Turnover records with Section 7 "Asset Buyout" ticked that are not yet in the register. Each becomes a buyout with the ticked assets, price and any payment already recorded; the ref. no. follows the turnover (<code>&lt;control no.&gt;-BO</code>).</div>
    <div class="scroll"><table><thead><tr><th><input type="checkbox" id="imAll"></th><th>Turnover</th><th>Employee</th><th>Assets in buyout</th><th style="text-align:right">Price</th><th>Payment</th></tr></thead><tbody id="imRows"></tbody></table></div>
    <div class="btns"><span class="msg" id="imMsg"></span><button type="button" class="btn" data-close>Cancel</button><button type="button" class="btn primary" id="imGo">Import selected</button></div></div>`;
  document.body.appendChild(im);
  let imList = [];
  function openImport(onlyId){
    imList = turnovers().filter(r => r.bo_enabled && !coveredBy(r) && (!onlyId || r._id === onlyId)).sort((a, b) => String(b._updated || '').localeCompare(String(a._updated || '')));
    im.querySelector('#imMsg').textContent = ''; im.querySelector('#imMsg').classList.remove('err');
    im.querySelector('#imRows').innerHTML = imList.length ? imList.map((r, k) => { const b = fromTurnover(r), p = payOf(b); return `<tr><td><input type="checkbox" data-k="${k}" checked></td><td class="m">${E(r.ctrl_no || '—')}<br><span class="small">${E(fmtD(r.emp_date))}</span></td><td>${E(r.emp_name || '')}<br><span class="small">${E(coName(r))}</span></td><td>${b.items.map(i => E(i.type) + (i.tag ? ` <span class="small">${E(i.tag)}</span>` : '')).join('<br>') || '<span class="small">no items ticked</span>'}</td><td class="m" style="text-align:right">${b.amount ? money(b.amount) : '—'}</td><td><span class="byo-pill ${p.cls}">${p.status}</span></td></tr>`; }).join('')
      : `<tr><td colspan="6" class="empty" style="padding:22px;text-align:center;color:var(--muted)">No turnover buyouts waiting to be imported — every Section 7 buyout is already in the register.</td></tr>`;
    im.querySelector('#imAll').checked = imList.length > 0;
    im.hidden = false;
  }
  im.querySelector('#imAll').onchange = e => im.querySelectorAll('#imRows [data-k]').forEach(c => c.checked = e.target.checked);
  im.querySelectorAll('[data-close]').forEach(b => b.onclick = () => { im.hidden = true; });
  im.querySelector('#imGo').onclick = async () => {
    const pick = [...im.querySelectorAll('#imRows [data-k]:checked')].map(c => imList[+c.dataset.k]);
    if (!pick.length) { im.querySelector('#imMsg').textContent = 'Tick at least one record.'; return; }
    const go = im.querySelector('#imGo'); go.disabled = true; let n = 0;
    try {
      for (const r of pick) { const b = fromTurnover(r); if (rows.some(x => x.ref_no === b.ref_no)) b.ref_no = ''; await save(b); n++; }
      im.hidden = true; flash(`Imported ${n} buyout(s) from turnover records.`); showView('buyouts');
    } catch (e) { const m = im.querySelector('#imMsg'); m.textContent = `Imported ${n}; stopped: ${e.message}`; m.classList.add('err'); }
    finally { go.disabled = false; }
  };

  /* ===================== link from the turnover form (Section 7) ===================== */
  const genBtn = document.getElementById('btnBuyoutForm');
  if (genBtn) {
    const wrap = document.createElement('div'); wrap.className = 'byo-link noprint';
    wrap.innerHTML = `<button type="button" class="btn" id="btnBuyoutRegister">Open in Buyout register</button><span class="hint" style="margin:0" id="byoLinkHint">Track installments / ORs for this buyout in the Buyout tab.</span>`;
    genBtn.parentElement.insertAdjacentElement('afterend', wrap);
    wrap.querySelector('#btnBuyoutRegister').onclick = async () => {
      if (typeof saveCurrent === 'function') { clearTimeout(typeof saveTimer !== 'undefined' ? saveTimer : 0); await saveCurrent(true); }
      const id = typeof currentId !== 'undefined' ? currentId : null;
      if (!id) { alert('Save the turnover record first (fill in the employee or company).'); return; }
      const existing = rows.find(r => r.turnover_id === id);
      if (existing) { showView('buyouts'); openEdit(existing); return; }
      const r = store.records.get(id);
      try { const saved = await save(r && r.bo_enabled ? fromTurnover(r) : { ...fromTurnover(r || {}), items: r ? turnoverAssets(r, false) : [], status: 'Draft' }); showView('buyouts'); openEdit(saved); }
      catch (e) { alert(e.message); }
    };
  }

  /* ===================== new buyout: pick the turnover record it comes from ===================== */
  const pk = document.createElement('div'); pk.className = 'bm'; pk.hidden = true;
  pk.innerHTML = `<div class="box" role="dialog" aria-label="Select turnover record" style="width:960px">
    <h2>New buyout — select the turnover record <button type="button" class="x" data-close aria-label="Close">×</button></h2>
    <div class="sub">The buyout takes the employee, company and Section 2 assets from the turnover record (only the Section 7 ticked items when the turnover already has a buyout).</div>
    <input type="search" id="pkQ" placeholder="Search control no., employee, company, asset tag…" autocomplete="off">
    <div class="scroll" style="max-height:52vh;overflow:auto"><table><thead><tr><th></th><th>Control No.</th><th>Employee</th><th>Company</th><th>Assets (Section 2)</th><th>Section 7</th></tr></thead><tbody id="pkRows"></tbody></table></div>
    <div class="btns"><span class="msg" id="pkMsg"></span><button type="button" class="btn" id="pkDirect">Direct buyout (no turnover)</button><button type="button" class="btn" data-close>Cancel</button><button type="button" class="btn primary" id="pkGo">Use selected record</button></div></div>`;
  document.body.appendChild(pk);
  function renderPick(){
    const q = pk.querySelector('#pkQ').value.trim().toLowerCase();
    const linked = { get: id => { const t = turnovers().find(x => x._id === id); return t ? coveredBy(t) : null; } };
    const list = turnovers().sort((a, b) => String(b._updated || '').localeCompare(String(a._updated || '')))
      .filter(r => !q || [r.ctrl_no, r.emp_name, r.emp_id, coName(r), ...turnoverAssets(r, false).flatMap(a => [a.type, a.tag, a.sn, a.desc])].join(' ').toLowerCase().includes(q));
    pk.querySelector('#pkRows').innerHTML = list.length ? list.map(r => { const a = turnoverAssets(r, false), b = linked.get(r._id); return `<tr${b ? ' style="opacity:.6"' : ''}>
      <td><input type="radio" name="pkSel" value="${E(r._id)}" ${b ? 'disabled' : ''}></td>
      <td class="m">${E(r.ctrl_no || '—')}<br><span class="small">${E(fmtD(r.emp_date))}</span></td>
      <td><b>${E(r.emp_name || '')}</b><br><span class="small">${E([r.emp_id, r.emp_dept].filter(Boolean).join(' · '))}</span></td>
      <td>${E(coName(r))}</td>
      <td>${a.map(x => E(x.type) + (x.tag || x.sn ? ` <span class="small" style="font-family:var(--mono)">${E(x.tag || x.sn)}</span>` : '')).join('<br>') || '<span class="small">no assets listed</span>'}</td>
      <td>${b ? `<span class="small">in register · ${E(b.ref_no)}</span><br><button type="button" class="btn" data-open="${E(b.id)}" style="padding:2px 8px;font-size:11.5px;margin-top:3px">Open</button>` : r.bo_enabled ? '<span class="byo-pill appr">Buyout ticked</span>' : '<span class="small">—</span>'}</td></tr>`; }).join('')
      : `<tr><td colspan="6" class="empty" style="padding:22px;text-align:center;color:var(--muted)">${turnovers().length ? 'No turnover record matches.' : 'No turnover records yet.'}</td></tr>`;
    pk.querySelectorAll('[data-open]').forEach(b => b.onclick = () => { pk.hidden = true; openEdit(rows.find(r => r.id === b.dataset.open)); });
    pk.querySelectorAll('#pkRows tr').forEach(tr => tr.ondblclick = () => { const rd = tr.querySelector('input[name=pkSel]:not(:disabled)'); if (rd) { rd.checked = true; pk.querySelector('#pkGo').click(); } });
  }
  function openPick(){ pk.querySelector('#pkQ').value = ''; pk.querySelector('#pkMsg').textContent = ''; renderPick(); pk.hidden = false; setTimeout(() => pk.querySelector('#pkQ').focus(), 30); }
  pk.querySelector('#pkQ').addEventListener('input', renderPick);
  pk.querySelectorAll('[data-close]').forEach(b => b.onclick = () => { pk.hidden = true; });
  pk.addEventListener('keydown', e => { if (e.key === 'Escape') pk.hidden = true; });
  pk.querySelector('#pkDirect').onclick = () => { pk.hidden = true; openEdit(null); };
  pk.querySelector('#pkGo').onclick = () => {
    const id = (pk.querySelector('input[name=pkSel]:checked') || {}).value;
    const r = turnovers().find(x => x._id === id);
    if (!r) { pk.querySelector('#pkMsg').textContent = 'Select a turnover record.'; return; }
    const b = fromTurnover(r);
    if (!r.bo_enabled) { b.items = turnoverAssets(r, false); b.status = 'Draft'; b.payments = []; b.amount = null; b.released_date = ''; }
    if (rows.some(x => x.ref_no === b.ref_no)) b.ref_no = '';
    pk.hidden = true; openEdit(b);
  };

  /* every turnover with Section 7 buyout ticked is added to the register automatically */
  let autoBusy = false;
  async function autoImport(){
    if (autoBusy || !currentUser || !loaded) return;
    // re-attach buyouts that lost their turnover link but still carry its control no. (prevents duplicates)
    for (const b of rows.filter(x => !x.turnover_id && ctrlKey(x.turnover_ctrl_no))) {
      const t = turnovers().find(x => ctrlKey(x.ctrl_no) === ctrlKey(b.turnover_ctrl_no));
      if (t && !rows.some(x => x.turnover_id === t._id)) { try { await sb.from('itat_buyouts').update({ turnover_id: t._id }).eq('id', b.id); b.turnover_id = t._id; } catch (e) {} }
    }
    const formOpen = document.getElementById('form') && !document.getElementById('form').hidden;
    const editing = formOpen && typeof currentId !== 'undefined' ? currentId : null; // wait until the user leaves the record
    const todo = turnovers().filter(r => r.bo_enabled && !coveredBy(r) && r._id !== editing);
    if (!todo.length) return;
    autoBusy = true; let n = 0;
    try { for (const r of todo) { const b = fromTurnover(r); if (rows.some(x => x.ref_no === b.ref_no)) b.ref_no = ''; try { await save(b); n++; } catch (e) { if (!/already linked/.test(e.message)) console.warn('Buyout auto-import', r.ctrl_no, e.message); } } }
    finally { autoBusy = false; }
    if (n) flash(`${n} turnover buyout(s) added to the Buyout register.`);
  }

  /* ===================== CSV ===================== */
  function exportCsv(){
    const list = filtered();
    const head = ['ref_no','company','buyer','buyer_type','buyer_emp_id','buyer_dept','buyer_contact','buyer_address','buyer_rel','emp_name','emp_id','emp_dept','emp_pos','occasion','turnover_ctrl_no','status','items','asset_tags','serial_nos','amount','basis','method','installments','amount_paid','balance','pay_status','paid_date','or_nos','approver_it','approver_it_date','approver_admin','approver_admin_date','released_by','released_date','rcvd_name','buyer_date','data_wiped','licenses_removed','remarks','created_at','updated_at'];
    const q = v => { const s = String(v ?? ''); return /[",\n]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s; };
    const lines = list.map(r => { const p = payOf(r), its = r.items || [], b = buyerOf(r); const v = { ...r, buyer: b.name, buyer_type: buyerLabel(b.kind),
      items: its.map(i => `${i.type}${num(i.qty) > 1 ? ' x' + i.qty : ''}${i.desc ? ' (' + i.desc + ')' : ''}${i.price != null ? ' @' + num(i.price).toFixed(2) : ''}`).join('; '),
      asset_tags: its.map(i => i.tag).filter(Boolean).join('; '), serial_nos: its.map(i => i.sn).filter(Boolean).join('; '),
      amount_paid: p.paid.toFixed(2), balance: p.balance.toFixed(2), pay_status: p.status, paid_date: p.status === 'Fully paid' ? p.lastDate || '' : '',
      or_nos: (r.payments || []).map(x => x.or_no).filter(Boolean).join('; ') };
      return head.map(k => q(v[k])).join(','); });
    const blob = new Blob(['\uFEFF' + head.join(',') + '\n' + lines.join('\n')], { type: 'text/csv;charset=utf-8' });
    const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = `IT-Asset-Buyouts-${today()}.csv`; a.click(); setTimeout(() => URL.revokeObjectURL(a.href), 2000);
  }

  /* ===================== printable documents ===================== */
  function openDoc(html){ const w = window.open('', '_blank'); if (!w) { alert('Pop-up blocked — please allow pop-ups for this site to generate the form.'); return; } w.document.open(); w.document.write(html); w.document.close(); }
  const DOC_CSS = `
@page{size:A4;margin:14mm 14mm 16mm}
*{box-sizing:border-box}body{font-family:Arial,Helvetica,sans-serif;font-size:11.5px;color:#111;margin:0;padding:24px;background:#eee}
.sheet{background:#fff;max-width:800px;margin:0 auto;padding:28px 32px;box-shadow:0 2px 12px rgba(0,0,0,.15);position:relative}
.hdr{display:flex;align-items:center;gap:16px;border-bottom:2px solid #111;padding-bottom:10px;margin-bottom:12px}
.hdr img{height:54px;max-width:170px;object-fit:contain}.hdr .co{font-size:15px;font-weight:700;letter-spacing:.02em}.hdr .sub{font-size:10.5px;color:#444}
.hdr .ref{margin-left:auto;text-align:right;font-size:10.5px;line-height:1.5}.hdr .ref b{font-family:Consolas,monospace;font-size:12px}
h1{font-size:16px;text-align:center;letter-spacing:.06em;margin:4px 0 2px}.tagline{text-align:center;font-size:10.5px;color:#444;margin-bottom:12px}
h2{font-size:11px;letter-spacing:.08em;text-transform:uppercase;background:#f0f0f0;border-left:4px solid #111;padding:4px 8px;margin:14px 0 6px}
.grid{display:grid;grid-template-columns:repeat(4,1fr);gap:6px 14px}.grid .f{border-bottom:1px solid #999;padding:2px 0 3px;min-height:26px}.grid .f.w2{grid-column:span 2}.grid .f.w4{grid-column:span 4}
.lbl{display:block;font-size:9px;text-transform:uppercase;letter-spacing:.05em;color:#555}.val{font-size:11.5px;min-height:14px}
table{width:100%;border-collapse:collapse;margin-top:4px}th,td{border:1px solid #333;padding:4px 5px;vertical-align:top;font-size:10.5px}th{background:#f0f0f0;font-size:9.5px;text-transform:uppercase;letter-spacing:.04em}td.c{text-align:center}td.m{font-family:Consolas,monospace}td.r{text-align:right;font-family:Consolas,monospace;white-space:nowrap}tfoot td{font-weight:700}
.amt{display:flex;gap:12px;align-items:baseline;border:1px solid #333;padding:8px 10px;margin:4px 0 8px}.amt .num{font-size:16px;font-weight:700;font-family:Consolas,monospace}.amt .wds{font-style:italic}
ol{margin:4px 0 0 18px;padding:0;font-size:10.5px;line-height:1.45}ol li{margin-bottom:3px}
.chk{font-size:10.5px;margin-top:6px}.chk span{display:inline-block;margin-right:18px}.bx{display:inline-block;width:11px;height:11px;border:1px solid #111;vertical-align:-2px;margin-right:4px;text-align:center;font-size:9px;line-height:10px}
.signs{display:grid;grid-template-columns:1fr 1fr;gap:22px 28px;margin-top:10px}.sg{padding-top:34px;position:relative}.sg img.sig{position:absolute;left:6px;bottom:44px;height:46px;max-width:70%;object-fit:contain;object-position:left bottom}.sg .line{border-top:1px solid #111;padding-top:3px;font-weight:700;font-size:11px;min-height:18px}.sg .role{font-size:9.5px;color:#444}.sg .dt{font-size:9.5px;color:#444;margin-top:8px}.sg .dt span{display:inline-block;min-width:110px;border-bottom:1px solid #111;margin-left:4px;text-align:center;font-weight:600;color:#111}
.stub{margin-top:18px;border:1px dashed #333;padding:10px 12px}.stub .t{font-size:11px;font-weight:700;letter-spacing:.06em;text-transform:uppercase;margin-bottom:6px}.stub p{margin:0 0 6px;line-height:1.7}.stub u{text-decoration:none;border-bottom:1px solid #111;padding:0 8px;font-weight:600}
.stamp{position:absolute;right:32px;top:110px;transform:rotate(-8deg);border:3px solid;border-radius:6px;padding:4px 14px;font-weight:800;font-size:20px;letter-spacing:.12em;text-align:center;opacity:.85;-webkit-print-color-adjust:exact;print-color-adjust:exact}.stamp small{display:block;font-size:9px;letter-spacing:.04em;font-weight:600}.stamp.paid{color:#2A7A4B;border-color:#2A7A4B}.stamp.partial{color:#9A5B00;border-color:#C98A1B}.stamp.unpaid{color:#B3261E;border-color:#B3261E}.stamp.cancel{color:#777;border-color:#777}
.foot{margin-top:14px;font-size:9px;color:#666;display:flex;justify-content:space-between;border-top:1px solid #ccc;padding-top:4px}
.bar{max-width:800px;margin:0 auto 12px;display:flex;gap:8px;justify-content:flex-end}.bar button{border:1px solid #333;background:#fff;padding:7px 14px;border-radius:4px;cursor:pointer;font-size:12px}.bar button.p{background:#111;color:#fff}
.land .sheet{max-width:1080px}.land .bar{max-width:1080px}
@media print{body{background:#fff;padding:0}.sheet{box-shadow:none;padding:0;max-width:none}.bar{display:none}.stub,.signs{break-inside:avoid}tr{break-inside:avoid}}`;
  const docHead = (title, extra) => `<!DOCTYPE html><html lang="en"><head><meta charset="utf-8"><title>${E(title)}</title><style>${DOC_CSS}${extra || ''}</style></head><body>
<div class="bar"><button onclick="window.close()">Close</button><button class="p" onclick="window.print()">Print / Save as PDF</button></div>`;
  const docTail = `<script>window.addEventListener('load',()=>{ setTimeout(()=>{ try{ window.print(); }catch(e){} }, 400); });<\/script></body></html>`;
  const B = (v, n) => v ? E(v) : '&nbsp;'.repeat(n);

  function buildFormDoc(r){
    const co = r.company || '', logo = logoFor(co), ref = r.ref_no || '', gen = fmtLong(today());
    const p = payOf(r), its = r.items || [], b = buyerOf(r);
    const priced = its.some(i => i.price != null && i.price !== '');
    const itemRows = its.map((it, k) => `<tr><td class="c">${k + 1}</td><td>${E(it.type || '')}${num(it.qty) > 1 ? ' ×' + it.qty : ''}</td><td class="m">${E(it.tag || '')}</td><td class="m">${E(it.sn || '')}</td><td>${E(it.desc || '')}${it.acq_date || it.acq_cost ? `<br><span style="color:#555;font-size:9.5px">Acquired ${E(fmtD(it.acq_date))}${it.acq_cost ? ' · cost PHP ' + money(it.acq_cost) : ''}</span>` : ''}</td><td class="c">${E(it.cond || '')}</td><td class="r">${it.price != null && it.price !== '' ? money(num(it.price) * (num(it.qty) || 1)) : ''}</td></tr>`).join('')
      + Array.from({ length: Math.max(0, 3 - its.length) }, () => '<tr><td class="c">&nbsp;</td><td></td><td></td><td></td><td></td><td></td><td></td></tr>').join('');
    const pays = (r.payments || []).filter(x => num(x.amount) > 0 || x.or_no);
    let run = 0;
    const payRows = pays.length ? [...pays].sort((a, b) => String(a.date || '').localeCompare(String(b.date || ''))).map((x, k) => { run += num(x.amount); return `<tr><td class="c">${k + 1}</td><td>${E(fmtD(x.date))}</td><td class="m">${E(x.or_no || '')}</td><td>${E(x.method || '')}</td><td>${E(x.remarks || '')}</td><td class="r">${money(x.amount)}</td><td class="r">${money(Math.max(0, p.amount - run))}</td></tr>`; }).join('')
      : '<tr><td class="c">&nbsp;</td><td></td><td></td><td></td><td>No payment recorded yet</td><td></td><td></td></tr>';
    const stamp = r.status === 'Cancelled' ? '<div class="stamp cancel">CANCELLED</div>'
      : `<div class="stamp ${p.cls}">${p.label}${p.cls === 'paid' && p.lastDate ? '<small>' + E(fmtLong(p.lastDate)) + '</small>' : p.balance > 0 && p.amount ? '<small>Balance PHP ' + E(money(p.balance)) + '</small>' : ''}</div>`;
    return docHead('IT Asset Buyout Form ' + ref) + `<div class="sheet">
  <div class="hdr">${logo ? `<img src="${logo}" alt="">` : ''}<div><div class="co">${E(co)}</div><div class="sub">Information Technology Department</div></div>
    <div class="ref">Buyout Ref. No.: <b>${E(ref)}</b>${r.turnover_ctrl_no ? `<br>Turnover Control No.: <b>${E(r.turnover_ctrl_no)}</b>` : ''}<br>Status: ${E(r.status || '')}<br>Date generated: ${E(gen)}</div></div>
  ${stamp}
  <h1>IT ASSET BUYOUT FORM</h1>
  <div class="tagline">Deed of Sale of Company IT Asset to ${b.kind === 'out' ? 'Buyer' : 'Employee'} &middot; Proof of Purchase</div>

  <h2>1. Buyer Information${b.other ? ' &mdash; ' + (b.kind === 'out' ? 'Outside party (non-employee)' : 'Another employee') : ' (Employee)'}</h2>
  <div class="grid">
    <div class="f w2"><span class="lbl">Buyer name</span><div class="val">${E(b.name)}</div></div>
    ${b.kind === 'out' ? `<div class="f w2"><span class="lbl">Contact no. / e-mail</span><div class="val">${E(b.contact)}</div></div>
    <div class="f w2"><span class="lbl">Address</span><div class="val">${E(b.address)}</div></div>
    <div class="f"><span class="lbl">Valid ID presented</span><div class="val">${E(b.idref)}</div></div>
    <div class="f"><span class="lbl">Relationship</span><div class="val">${E(b.rel)}</div></div>`
    : `<div class="f"><span class="lbl">Employee ID</span><div class="val">${E(b.id)}</div></div>
    <div class="f"><span class="lbl">Department</span><div class="val">${E(b.dept)}</div></div>
    <div class="f"><span class="lbl">Position</span><div class="val">${E(b.pos)}</div></div>
    ${b.other ? `<div class="f"><span class="lbl">Company</span><div class="val">${E(b.company)}</div></div><div class="f w2"><span class="lbl">Contact / relationship</span><div class="val">${E([b.contact, b.rel].filter(Boolean).join(' · '))}</div></div>` : `<div class="f"><span class="lbl">Immediate supervisor</span><div class="val">${E(r.emp_sup || '')}</div></div>`}`}
    <div class="f w2"><span class="lbl">Occasion of purchase</span><div class="val">${E(r.occasion || '')}</div></div>
  </div>
  ${b.other ? `<div class="grid" style="margin-top:6px">
    <div class="f w2"><span class="lbl">Asset(s) turned over by (last custodian)</span><div class="val">${E(r.emp_name || '')}${r.emp_id ? ' &middot; ' + E(r.emp_id) : ''}</div></div>
    <div class="f"><span class="lbl">Department</span><div class="val">${E(r.emp_dept || '')}</div></div>
    <div class="f"><span class="lbl">Turnover Control No.</span><div class="val">${E(r.turnover_ctrl_no || '')}</div></div>
  </div>` : ''}

  <h2>2. IT Asset(s) Sold</h2>
  <table><thead><tr><th style="width:26px">#</th><th style="width:120px">Item</th><th style="width:95px">Asset Tag</th><th style="width:110px">Serial No.</th><th>Description / Model</th><th style="width:62px">Condition</th><th style="width:90px">Price (PHP)</th></tr></thead><tbody>${itemRows}</tbody>
  ${priced ? `<tfoot><tr><td colspan="6" style="text-align:right">Total</td><td class="r">${money(itemsTotal(its))}</td></tr></tfoot>` : ''}</table>

  <h2>3. Sale &amp; Payment Details</h2>
  <div class="amt"><span class="lbl" style="display:inline">Total buyout price</span><span class="num">PHP ${E(p.amount ? money(p.amount) : '')}</span><span class="wds">${E(amountWords(p.amount))}</span></div>
  <div class="grid">
    <div class="f"><span class="lbl">Basis of valuation</span><div class="val">${E(r.basis || '')}</div></div>
    <div class="f"><span class="lbl">Payment method</span><div class="val">${E(r.method || '')}${r.installments > 1 ? ' · ' + r.installments + ' installments' : ''}</div></div>
    <div class="f"><span class="lbl">Payment status</span><div class="val">${E(p.status)}</div></div>
    <div class="f"><span class="lbl">Paid / Balance</span><div class="val">PHP ${money(p.paid)} / PHP ${money(p.balance)}</div></div>
    <div class="f w4"><span class="lbl">Remarks / inclusions</span><div class="val">${E(r.remarks || '')}</div></div>
  </div>
  <table style="margin-top:8px"><thead><tr><th style="width:26px">#</th><th style="width:90px">Date</th><th style="width:100px">OR / AR No.</th><th style="width:110px">Method</th><th>Remarks</th><th style="width:90px">Amount</th><th style="width:90px">Balance</th></tr></thead><tbody>${payRows}</tbody>
  <tfoot><tr><td colspan="5" style="text-align:right">Total paid</td><td class="r">${money(p.paid)}</td><td class="r">${money(p.balance)}</td></tr></tfoot></table>
  <div class="chk"><span><span class="bx">${r.data_wiped ? '✓' : ''}</span>Company data backed up and device wiped / reset</span><span><span class="bx">${r.licenses_removed ? '✓' : ''}</span>Company accounts, MDM and licensed software removed</span></div>

  <h2>4. Terms and Conditions of Sale</h2>
  <ol>
    <li><b>${E(co)}</b> (the "Company") sells, transfers and conveys to the ${b.kind === 'out' ? 'person' : 'employee'} named above in Section 1 (the "Buyer") the IT asset(s) listed in Section 2 for the total price stated in Section 3.</li>
    <li>The asset(s) are sold on an <b>"as-is, where-is"</b> basis. The Company gives no warranty as to condition, fitness for purpose, remaining useful life, or manufacturer warranty coverage.</li>
    <li>All company data, files, e-mail/account profiles, and licensed software (including operating system volume licenses and Microsoft 365) have been removed, transferred or deactivated before release. Software licenses are <b>not</b> transferred with the asset unless expressly stated in the remarks.</li>
    <li>Ownership and risk pass to the Buyer upon full payment and release of the asset(s). The asset(s) are thereafter removed from the Company's fixed-asset register and IT asset inventory.</li>
    ${b.kind === 'out' ? `<li>As the Buyer is not an employee of the Company, the price stated in Section 3 shall be paid in full (or per the installments stated) before the asset(s) are released; the Company may withhold release until full payment.</li>` : `<li>Where payment is by salary deduction, installment or deduction from final pay, the Buyer authorizes the Company to deduct the amount(s) stated in Section 3 from the Buyer's compensation in accordance with company policy and applicable law. Any unpaid balance upon separation shall be deducted from the Buyer's final pay.</li>`}
    <li>This form, together with the Official/Acknowledgment Receipt(s) listed in Section 3, serves as the Buyer's <b>proof of purchase</b>.</li>
  </ol>

  <h2>5. Acknowledgment and Approval</h2>
  <div class="signs">
    <div class="sg"><div class="line">${E(b.name)}</div><div class="role">Buyer${b.kind === 'out' ? ' (Outside party)' : ' (Employee)'} &mdash; I have read and accept the terms above and acknowledge receipt of the asset(s)</div><div class="dt">Date:<span>${E(fmtLong(r.buyer_date))}</span></div></div>
    <div class="sg">${sigImg(r.released_by)}<div class="line">${E(r.released_by || '')}</div><div class="role">Released by &mdash; IT Department</div><div class="dt">Date:<span>${E(fmtLong(r.released_date))}</span></div></div>
    <div class="sg">${sigImg(r.approver_it)}<div class="line">${E(r.approver_it || '')}</div><div class="role">Approved by &mdash; IT Manager</div><div class="dt">Date:<span>${E(fmtLong(r.approver_it_date))}</span></div></div>
    <div class="sg">${sigImg(r.approver_admin)}<div class="line">${E(r.approver_admin || '')}</div><div class="role">Approved by &mdash; Administrative Manager</div><div class="dt">Date:<span>${E(fmtLong(r.approver_admin_date))}</span></div></div>
    <div class="sg">${sigImg(r.rcvd_name)}<div class="line">${E(r.rcvd_name || '')}</div><div class="role">Payment received by &mdash; Finance / Cashier</div><div class="dt">Date:<span>${E(fmtLong(r.rcvd_date))}</span></div></div>
    ${b.other ? `<div class="sg"><div class="line">${E(r.emp_name || '')}</div><div class="role">Conforme &mdash; Employee who turned over the asset(s) (last custodian)</div><div class="dt">Date:<span></span></div></div>` : ''}
  </div>

  <div class="stub">
    <div class="t">Acknowledgment Receipt</div>
    <p>Received from <u>${B(b.name, 30)}</u> the amount of <u>PHP ${B(p.paid ? money(p.paid) : '', 12)}</u> (<u>${B(amountWords(p.paid), 40)}</u>) as ${p.status === 'Fully paid' ? 'full' : 'partial'} payment for the IT asset(s) listed above under Buyout Ref. No. <u>${E(ref)}</u>.</p>
    <p>OR / AR No. <u>${B((r.payments || []).map(x => x.or_no).filter(Boolean).join(', '), 16)}</u> &nbsp; Date <u>${B(fmtLong(p.lastDate), 16)}</u> &nbsp; Received by <u>${B(r.rcvd_name, 30)}</u> (signature over printed name)</p>
  </div>
  <div class="foot"><span>${E(co)} &middot; IT Asset Buyout Form</span><span>${E(ref)} &middot; Generated ${E(gen)}</span></div>
</div>` + docTail;
  }

  function buildListDoc(list){
    const cos = [...new Set(list.map(r => r.company).filter(Boolean))], co = cos.length === 1 ? cos[0] : 'Meatplus Group', gen = fmtD(today());
    const tot = list.reduce((s, r) => s + num(r.amount), 0), paid = list.reduce((s, r) => s + payOf(r).paid, 0);
    const filterTxt = [filt.status ? 'Status: ' + (filt.status === 'open' ? 'Open' : filt.status) : '', filt.pay ? 'Payment: ' + (filt.pay === 'due' ? 'With balance' : filt.pay) : '', filt.company ? 'Company: ' + filt.company : '', filt.q ? 'Search: "' + filt.q + '"' : ''].filter(Boolean).join(' · ');
    const body = list.map((r, i) => { const p = payOf(r); return `<tr><td class="c">${i + 1}</td><td class="m">${E(r.ref_no || '')}${r.turnover_ctrl_no ? '<br>TO: ' + E(r.turnover_ctrl_no) : ''}</td><td>${E(r.company || '')}</td><td>${(() => { const b = buyerOf(r); return `${E(b.name)}${b.other ? ` <i style="color:#444">(${E(b.kind === 'out' ? 'outside party' : 'other employee')})</i>` : ''}<br><span style="color:#444">${E((b.kind === 'out' ? [b.contact] : [b.id, b.dept]).filter(Boolean).join(' · '))}${b.other ? '<br>turned over by ' + E(r.emp_name || '') : ''}</span>`; })()}</td><td>${(r.items || []).map(it => `${E(it.type || '')}${it.tag ? ' · ' + E(it.tag) : ''}${it.sn ? ' · ' + E(it.sn) : ''}`).join('<br>')}</td><td>${E(r.method || '')}</td><td class="r">${r.amount != null ? money(r.amount) : ''}</td><td class="r">${money(p.paid)}</td><td class="r">${money(p.balance)}</td><td>${E(p.status)}<br>${E((r.payments || []).map(x => x.or_no).filter(Boolean).join(', '))}</td><td>${E(r.status || '')}${r.released_date ? '<br>' + E(fmtD(r.released_date)) : ''}</td><td>${E(r.approver_it || '—')}${r.approver_it_date ? ' (' + E(fmtD(r.approver_it_date)) + ')' : ''}<br>${E(r.approver_admin || '—')}${r.approver_admin_date ? ' (' + E(fmtD(r.approver_admin_date)) + ')' : ''}</td></tr>`; }).join('');
    return docHead('IT Asset Buyout Register', '@page{size:A4 landscape}') + `<div class="land"><div class="sheet">
  <div class="hdr">${cos.length === 1 && logoFor(co) ? `<img src="${logoFor(co)}" alt="">` : ''}<div><div class="co">${E(co)}</div><div class="sub">Information Technology Department</div></div><div class="ref">Date generated: ${E(gen)}<br>Buyouts: <b>${list.length}</b>${filterTxt ? '<br>' + E(filterTxt) : ''}</div></div>
  <h1>IT ASSET BUYOUT REGISTER</h1>
  <div class="tagline">Company IT assets sold to employees &middot; price, payments and release status</div>
  <table><thead><tr><th style="width:22px">#</th><th style="width:120px">Ref. No.</th><th>Company</th><th>Buyer</th><th>Asset(s) &middot; tag &middot; serial</th><th>Method</th><th style="width:78px">Price</th><th style="width:78px">Paid</th><th style="width:78px">Balance</th><th>Payment / OR</th><th style="width:72px">Status</th><th>Approved by (IT Mgr / Admin Mgr)</th></tr></thead>
  <tbody>${body || '<tr><td colspan="12" class="c">No buyouts</td></tr>'}</tbody>
  <tfoot><tr><td colspan="6" style="text-align:right">Totals</td><td class="r">${money(tot)}</td><td class="r">${money(paid)}</td><td class="r">${money(Math.max(0, tot - paid))}</td><td colspan="3"></td></tr></tfoot></table>
  <div class="signs">
    <div class="sg"><div class="line"></div><div class="role">Prepared by &mdash; IT Department</div><div class="dt">Date:<span></span></div></div>
    <div class="sg"><div class="line"></div><div class="role">Verified by &mdash; Finance / Accounting</div><div class="dt">Date:<span></span></div></div>
    <div class="sg">${sigImg([...new Set(list.map(r => r.approver_it).filter(Boolean))].length === 1 ? list.find(r => r.approver_it).approver_it : '')}<div class="line">${E([...new Set(list.map(r => r.approver_it).filter(Boolean))].join(', '))}</div><div class="role">Approved by &mdash; IT Manager</div><div class="dt">Date:<span></span></div></div>
    <div class="sg">${sigImg([...new Set(list.map(r => r.approver_admin).filter(Boolean))].length === 1 ? list.find(r => r.approver_admin).approver_admin : '')}<div class="line">${E([...new Set(list.map(r => r.approver_admin).filter(Boolean))].join(', '))}</div><div class="role">Approved by &mdash; Administrative Manager</div><div class="dt">Date:<span></span></div></div>
  </div>
  <div class="foot"><span>${E(co)} &middot; IT Asset Buyout Register</span><span>Generated ${E(gen)}</span></div>
</div></div>` + docTail;
  }
  window.itatBuyoutFormFor = id => { const r = rows.find(x => x.id === id); if (r) openDoc(buildFormDoc(r)); };

  /* ===================== session hooks ===================== */
  function subscribe(){ if (channel) return; channel = sb.channel('itat-buyouts').on('postgres_changes', { event: '*', schema: 'public', table: 'itat_buyouts' }, () => load().catch(() => {})).subscribe(); }
  const prevStart = start;
  start = async function (session) { await prevStart(session); if (!currentUser) return; tab.hidden = false; try { await load(); subscribe(); await autoImport(); } catch (e) { flash('Buyout register: ' + e.message); } };
  setInterval(() => { autoImport().catch(() => {}); }, 20000); // picks up turnovers whose Section 7 buyout was ticked since
  const prevStop = stop;
  stop = function () { prevStop(); tab.hidden = true; view.hidden = true; em.hidden = true; im.hidden = true; pk.hidden = true; rows = []; loaded = false; if (channel) { sb.removeChannel(channel); channel = null; } };
  if (typeof currentUser !== 'undefined' && currentUser) { tab.hidden = false; load().then(subscribe).then(autoImport).catch(() => {}); }
})();

/* IT Asset Turnover — Disposal module.
   Register of IRREPARABLE IT assets subject for disposal (Supabase table itat_disposals).
   - "Disposal" tab in the toolbar: searchable list with status workflow
     For evaluation → For disposal → Approved → Disposed (or Cancelled)
   - Add assets manually, or pull damaged / "For Disposal" items from saved turnover records
   - Printable Disposal List and IT Asset Disposal Form / Certificate of Disposal (batch of selected items)
   - CSV export.  Loaded after the main script, admin.js, buyout.js and signatures.js. */
(function(){
  if (typeof sb === 'undefined' || !sb || !sb.from) return; // online form only

  /* ===================== constants ===================== */
  const STATUSES = ['For evaluation','For disposal','Approved','Disposed','Cancelled'];
  const METHODS = ['Sell as scrap','E-waste recycler (certified)','Donate','Return to vendor / trade-in','Physical destruction','Cannibalize for parts','Sold to employee (buyout)','Other'];
  const ASSET_TYPES = (typeof ASSETS !== 'undefined') ? ASSETS : ['Laptop/Desktop','Monitor','Keyboard','Mouse','Laptop Charger/Adapter','Docking Station','Headset','Mobile Device/Tablet','External HDD/SSD/USB','Other IT Equipment'];
  const E = (typeof esc === 'function') ? esc : (s => String(s ?? '').replace(/[&<>"]/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c])));
  const fmtD = d => { if (!d) return ''; const x = new Date(d.length === 10 ? d + 'T00:00:00' : d); return isNaN(x) ? String(d) : x.toLocaleDateString([], { year:'numeric', month:'short', day:'2-digit' }); };
  const money = v => (v === null || v === undefined || v === '' || Number(v) === 0) ? '' : Number(v).toLocaleString('en-PH', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  const today = () => new Date().toISOString().slice(0, 10);
  const companies = () => [...document.querySelectorAll('#company option')].filter(o => o.value && o.value !== '__other').map(o => ({ name: o.value, abbr: o.dataset.abbr || '' }));
  const abbrOf = name => { const c = companies().find(x => x.name === name); if (c && c.abbr) return c.abbr; return String(name || '').replace(/\b(inc|corp|corporation|co|ltd|the|of|and)\b\.?/gi, '').split(/\s+/).filter(Boolean).map(w => w[0]).join('').toUpperCase().slice(0, 5) || 'GEN'; };
  const statusCls = s => ({ 'For evaluation':'eval', 'For disposal':'fordsp', 'Approved':'appr', 'Disposed':'done', 'Cancelled':'cancel' }[s] || 'eval');

  /* ===================== styles ===================== */
  const css = document.createElement('style');
  css.textContent = `
  .dsp{max-width:1280px;margin:24px auto 60px;background:var(--paper);border:1px solid var(--line);padding:24px 28px;box-shadow:0 6px 24px rgba(22,32,42,.06)}
  .dsp[hidden]{display:none}
  .dsp .head{display:flex;justify-content:space-between;align-items:flex-end;gap:20px;flex-wrap:wrap;margin-bottom:14px}
  .dsp .title{font-family:var(--head);font-size:18px;font-weight:700;margin:0;background:none;border:0;padding:0}
  .dsp .sub{color:var(--muted);font-size:12.5px;margin-top:2px}
  .dsp .bar{display:flex;gap:8px;flex-wrap:wrap;align-items:center;margin-bottom:12px}
  .dsp .bar input[type=search]{border:1px solid var(--line);border-radius:6px;padding:7px 10px;width:260px;background:var(--paper)}
  .dsp .bar select{border:1px solid var(--line);border-radius:6px;padding:7px 8px;background:var(--paper)}
  .dsp .bar .sp{flex:1}
  .dsp .kpis{display:flex;gap:8px;flex-wrap:wrap;margin-bottom:12px}
  .dsp .kpi{border:1px solid var(--line);border-radius:6px;padding:6px 12px;font-size:12px;color:var(--muted);cursor:pointer;background:var(--paper)}
  .dsp .kpi b{display:block;font-family:var(--head);font-size:16px;color:var(--ink)}
  .dsp .kpi.on{border-color:var(--accent);background:var(--accent-soft)}
  .dsp table{width:100%;border-collapse:collapse;font-size:12.5px}
  .dsp th{font-family:var(--head);font-size:11px;letter-spacing:.06em;text-transform:uppercase;color:var(--muted);text-align:left;padding:8px 6px;border-bottom:1px solid var(--line);white-space:nowrap}
  .dsp td{padding:8px 6px;border-bottom:1px solid var(--line-soft);vertical-align:top}
  .dsp td.m{font-family:var(--mono);font-size:12px;white-space:nowrap}
  .dsp tr:hover td{background:var(--ground)}
  .dsp .acts{display:flex;gap:4px;white-space:nowrap}
  .dsp .acts button{border:1px solid var(--line);background:var(--paper);border-radius:4px;padding:3px 8px;cursor:pointer;font-size:12px}
  .dsp .acts button:hover{border-color:var(--accent);color:var(--accent)}
  .dsp .acts button.del:hover{border-color:var(--crit);color:var(--crit)}
  .dsp .foot{color:var(--faint);font-size:12px;margin-top:10px;display:flex;justify-content:space-between;flex-wrap:wrap;gap:8px}
  .dsp .empty{color:var(--muted);text-align:center;padding:28px}
  .dsp .small{color:var(--faint);font-size:11.5px}
  .dsp-pill{display:inline-block;font-family:var(--head);font-size:10px;letter-spacing:.05em;text-transform:uppercase;border-radius:999px;padding:2px 8px;white-space:nowrap}
  .dsp-pill.eval{background:var(--sunken);color:var(--muted)} .dsp-pill.fordsp{background:#FBEBD3;color:#8A5A0B} .dsp-pill.appr{background:var(--accent-soft);color:var(--accent)} .dsp-pill.done{background:#DFF1E5;color:#2A7A4B} .dsp-pill.cancel{background:#F3E1DF;color:var(--crit);text-decoration:line-through}
  .dm{position:fixed;inset:0;background:rgba(22,32,42,.45);display:flex;align-items:flex-start;justify-content:center;padding:32px 16px;z-index:200;overflow:auto}
  .dm[hidden]{display:none}
  .dm .box{background:var(--paper);border:1px solid var(--line);border-radius:10px;width:900px;max-width:100%;box-shadow:0 16px 48px rgba(22,32,42,.25);display:grid;gap:14px;padding:22px 24px}
  .dm h2{font-family:var(--head);font-size:16px;margin:0;background:none;border:0;padding:0;display:flex;justify-content:space-between;align-items:center}
  .dm h2 button{border:0;background:none;font-size:20px;cursor:pointer;color:var(--muted)}
  .dm .sub{color:var(--muted);font-size:12.5px;margin-top:-8px}
  .dm h3{font-family:var(--head);font-size:11px;letter-spacing:.08em;text-transform:uppercase;color:var(--muted);margin:6px 0 0;padding-bottom:4px;border-bottom:1px solid var(--line-soft)}
  .dm .grid{display:grid;grid-template-columns:repeat(4,1fr);gap:8px 12px}
  .dm .grid label{display:grid;gap:4px;font-size:12px;color:var(--muted)}
  .dm .grid label.w2{grid-column:span 2} .dm .grid label.w4{grid-column:span 4}
  .dm .grid input,.dm .grid select,.dm .grid textarea{border:1px solid var(--line);border-radius:6px;padding:7px 9px;background:var(--paper);font-size:13px;width:100%}
  .dm .grid textarea{min-height:56px;resize:vertical}
  .dm .grid input:focus,.dm .grid select:focus,.dm .grid textarea:focus{outline:none;border-color:var(--accent)}
  .dm .grid .chk{display:flex;align-items:center;gap:8px;align-self:end;padding-bottom:8px;color:var(--ink)}
  .dm .grid .chk input{width:auto}
  .dm .btns{display:flex;gap:8px;justify-content:flex-end;border-top:1px solid var(--line);padding-top:14px;align-items:center}
  .dm .btns .msg{flex:1;font-size:12.5px;color:var(--muted)} .dm .btns .msg.err{color:var(--crit)}
  .dm table{width:100%;border-collapse:collapse;font-size:12.5px}
  .dm th{font-family:var(--head);font-size:11px;letter-spacing:.06em;text-transform:uppercase;color:var(--muted);text-align:left;padding:6px;border-bottom:1px solid var(--line)}
  .dm td{padding:6px;border-bottom:1px solid var(--line-soft);vertical-align:top}
  .dm td.m{font-family:var(--mono);font-size:12px}
  .dm .hint{font-size:11.5px;color:var(--faint)}
  .dsp-secbtn{display:flex;gap:10px;align-items:center;margin-top:10px}
  @media(max-width:760px){.dm .grid{grid-template-columns:1fr 1fr}.dm .grid label.w4{grid-column:span 2}}
  @media print{.dsp,.dm{display:none!important}}`;
  document.head.appendChild(css);

  /* ===================== data ===================== */
  let rows = [];            // all disposal rows
  let channel = null;
  const selected = new Set();
  const filt = { q: '', status: '', company: '' };
  let sortKey = 'updated_at', sortAsc = false;

  async function load(){
    const { data, error } = await sb.from('itat_disposals').select('*').order('updated_at', { ascending: false });
    if (error) throw new Error(error.message);
    rows = data || [];
    for (const id of [...selected]) if (!rows.some(r => r.id === id)) selected.delete(id);
    render(); updateTab();
  }
  function nextRef(company){
    const abbr = abbrOf(company), d = today().replace(/-/g, '');
    let max = 0; const re = new RegExp('^' + abbr + '-DSP-\\d{8}-(\\d+)$');
    rows.forEach(r => { const m = re.exec(r.ref_no || ''); if (m) max = Math.max(max, parseInt(m[1], 10)); });
    return `${abbr}-DSP-${d}-${String(max + 1).padStart(2, '0')}`;
  }
  async function save(rec){
    const isNew = !rec.id;
    const row = { ...rec, updated_by: currentUser?.id || null, updated_at: new Date().toISOString() };
    ['qty','acquisition_cost','disposal_value','buyout_amount'].forEach(k => { if (row[k] === '' || row[k] === undefined || row[k] === null || isNaN(Number(row[k]))) row[k] = k === 'qty' ? 1 : null; else row[k] = Number(row[k]); });
    ['assessed_date','acquisition_date','disposal_date','approved_date','buyout_date'].forEach(k => { if (!row[k]) row[k] = null; });
    if (isNew) { delete row.id; row.created_by = currentUser?.id || null; if (!row.ref_no) row.ref_no = nextRef(row.company); }
    const { data, error } = await sb.from('itat_disposals').upsert(row).select().single();
    if (error) throw new Error(error.message);
    const i = rows.findIndex(r => r.id === data.id); if (i >= 0) rows[i] = data; else rows.unshift(data);
    render(); updateTab();
    return data;
  }
  async function remove(id){
    const { error } = await sb.from('itat_disposals').delete().eq('id', id);
    if (error) throw new Error(error.message);
    rows = rows.filter(r => r.id !== id); selected.delete(id); render(); updateTab();
  }

  /* ===================== view: list ===================== */
  const view = document.createElement('div'); view.className = 'dsp'; view.id = 'disposalView'; view.hidden = true;
  view.innerHTML = `
    <div class="head">
      <div><h2 class="title">Irreparable IT Assets — For Disposal</h2>
        <div class="sub">Register of IT equipment assessed as beyond economical repair and subject for disposal. Workflow: For evaluation → For disposal → Approved → Disposed.</div></div>
      <div style="display:flex;gap:8px;flex-wrap:wrap"><button class="btn primary" id="dspAdd">+ Add asset</button><button class="btn" id="dspAddMany" title="Enter several irreparable assets at once — each row becomes its own disposal item">+ Add multiple</button><button class="btn" id="dspPull">Pull from turnovers</button></div>
    </div>
    <div class="kpis" id="dspKpis"></div>
    <div class="bar">
      <input id="dspQ" type="search" placeholder="Search ref, tag, serial, model, user…" autocomplete="off">
      <select id="dspStatus"><option value="">All statuses</option><option value="open">Open (not yet disposed)</option><option value="buyout">Paid under buyout</option>${STATUSES.map(s => `<option>${s}</option>`).join('')}</select>
      <select id="dspCompany"><option value="">All companies</option></select>
      <span class="sp"></span>
      <button class="btn" id="dspForm" title="Generate the IT Asset Disposal Form / Certificate of Disposal for the ticked items">Disposal Form (selected)</button>
      <button class="btn" id="dspSetStatus" title="Change the status of the ticked items">Set status ▾</button>
      <button class="btn" id="dspPrint">Print list</button>
      <button class="btn" id="dspCsv">Export CSV</button>
    </div>
    <div class="tablewrap"><table>
      <thead><tr><th><input type="checkbox" id="dspAll" title="Select all shown"></th><th data-sort="ref_no">Ref. No.</th><th data-sort="company">Company</th><th data-sort="asset_type">Asset</th><th>Tag / Serial</th><th data-sort="last_user">Last user</th><th>Reason / defect</th><th data-sort="status">Status</th><th>Disposal</th><th data-sort="updated_at">Updated</th><th></th></tr></thead>
      <tbody id="dspRows"></tbody>
    </table></div>
    <div class="foot"><span id="dspFoot"></span><span class="small">Tick items, then use "Disposal Form (selected)" to generate the printable form for approval and certification.</span></div>`;
  document.getElementById('recordsView').insertAdjacentElement('afterend', view);
  const $ = s => view.querySelector(s);

  function filtered(){
    const q = filt.q.trim().toLowerCase();
    let list = rows.filter(r => (!filt.company || r.company === filt.company)
      && (!filt.status || (filt.status === 'open' ? !['Disposed','Cancelled'].includes(r.status) : filt.status === 'buyout' ? !!r.buyout_paid : r.status === filt.status))
      && (!q || [r.ref_no, r.company, r.asset_type, r.asset_tag, r.serial_no, r.description, r.last_user, r.department, r.reason, r.turnover_ctrl_no, r.disposal_method, r.recipient, r.disposal_ref, r.remarks, r.status].join(' ').toLowerCase().includes(q)));
    list.sort((a, b) => { const x = a[sortKey] ?? '', y = b[sortKey] ?? ''; const c = x < y ? -1 : x > y ? 1 : 0; return sortAsc ? c : -c; });
    return list;
  }
  function render(){
    // company filter options
    const sel = $('#dspCompany'), cur = sel.value; const names = [...new Set(rows.map(r => r.company).filter(Boolean))].sort();
    sel.innerHTML = '<option value="">All companies</option>' + names.map(n => `<option ${n === cur ? 'selected' : ''}>${E(n)}</option>`).join('');
    // KPIs
    const counts = Object.fromEntries(STATUSES.map(s => [s, rows.filter(r => r.status === s).length]));
    $('#dspKpis').innerHTML = [['', 'All', rows.length], ...STATUSES.map(s => [s, s, counts[s]])].map(([v, l, n]) => `<button type="button" class="kpi ${filt.status === v ? 'on' : ''}" data-status="${E(v)}">${E(l)}<b>${n}</b></button>`).join('');
    $('#dspKpis').querySelectorAll('.kpi').forEach(b => b.onclick = () => { filt.status = b.dataset.status; $('#dspStatus').value = filt.status; render(); });
    const list = filtered();
    $('#dspRows').innerHTML = list.length ? list.map(r => `<tr data-id="${r.id}">
      <td><input type="checkbox" data-sel ${selected.has(r.id) ? 'checked' : ''}></td>
      <td class="m">${E(r.ref_no || '')}${r.turnover_ctrl_no ? `<br><span class="small" title="From turnover record">↳ ${E(r.turnover_ctrl_no)}</span>` : ''}</td>
      <td>${E(r.company || '')}</td>
      <td><b>${E(r.asset_type || '')}</b>${r.qty > 1 ? ` ×${r.qty}` : ''}<br><span class="small">${E(r.description || '')}</span></td>
      <td class="m">${E(r.asset_tag || '')}<br><span class="small">${E(r.serial_no || '')}</span></td>
      <td>${E(r.last_user || '')}<br><span class="small">${E(r.department || '')}</span></td>
      <td>${E(r.reason || '')}${r.assessed_by ? `<br><span class="small">Assessed by ${E(r.assessed_by)}${r.assessed_date ? ' · ' + E(fmtD(r.assessed_date)) : ''}</span>` : ''}</td>
      <td><span class="dsp-pill ${statusCls(r.status)}">${E(r.status)}</span>${r.buyout_paid ? `<br><span class="dsp-pill done" title="Paid by the employee under Section 7 Asset Buyout${r.buyout_ref ? ' · OR/AR ' + E(r.buyout_ref) : ''}">Buyout paid</span>` : ''}${r.approved_by && ['Approved','Disposed'].includes(r.status) ? `<br><span class="small">by ${E(r.approved_by)}</span>` : ''}</td>
      <td>${r.disposal_method ? E(r.disposal_method) : '<span class="small">—</span>'}${r.disposal_date ? `<br><span class="small">${E(fmtD(r.disposal_date))}${r.recipient ? ' · ' + E(r.recipient) : ''}</span>` : ''}</td>
      <td class="small" style="white-space:nowrap">${E(fmtD(r.updated_at))}</td>
      <td><div class="acts"><button type="button" data-edit>Edit</button><button type="button" class="del" data-del>Remove</button></div></td></tr>`).join('')
      : `<tr><td colspan="11" class="empty">${rows.length ? 'No items match the current filter.' : 'No assets listed for disposal yet. Use <b>+ Add asset</b>, <b>+ Add multiple</b> or <b>Pull from turnovers</b>.'}</td></tr>`;
    $('#dspFoot').textContent = `${list.length} of ${rows.length} item(s)` + (selected.size ? ` · ${selected.size} selected` : '');
    $('#dspAll').checked = list.length > 0 && list.every(r => selected.has(r.id));
    $('#dspRows').querySelectorAll('[data-sel]').forEach(c => c.onchange = () => { const id = c.closest('tr').dataset.id; c.checked ? selected.add(id) : selected.delete(id); $('#dspFoot').textContent = `${list.length} of ${rows.length} item(s)` + (selected.size ? ` · ${selected.size} selected` : ''); });
    $('#dspRows').querySelectorAll('[data-edit]').forEach(b => b.onclick = () => openEdit(rows.find(r => r.id === b.closest('tr').dataset.id)));
    $('#dspRows').querySelectorAll('[data-del]').forEach(b => b.onclick = async () => {
      if (b.dataset.armed !== '1') { b.dataset.armed = '1'; b.textContent = 'Confirm'; setTimeout(() => { b.dataset.armed = ''; b.textContent = 'Remove'; }, 4000); return; }
      try { await remove(b.closest('tr').dataset.id); flash('Item removed from the disposal list.'); } catch (e) { alert(e.message); }
    });
  }
  const flash = m => { const st = document.getElementById('state'); if (st) st.textContent = m; };
  $('#dspQ').addEventListener('input', () => { filt.q = $('#dspQ').value; render(); });
  $('#dspStatus').addEventListener('change', () => { filt.status = $('#dspStatus').value; render(); });
  $('#dspCompany').addEventListener('change', () => { filt.company = $('#dspCompany').value; render(); });
  $('#dspAll').addEventListener('change', () => { const list = filtered(); list.forEach(r => $('#dspAll').checked ? selected.add(r.id) : selected.delete(r.id)); render(); });
  view.querySelectorAll('th[data-sort]').forEach(th => { th.style.cursor = 'pointer'; th.onclick = () => { const k = th.dataset.sort; if (sortKey === k) sortAsc = !sortAsc; else { sortKey = k; sortAsc = k !== 'updated_at'; } render(); }; });
  $('#dspAdd').onclick = () => openEdit(null);
  $('#dspAddMany').onclick = () => openMulti();
  $('#dspPull').onclick = () => openPull(null);
  $('#dspCsv').onclick = exportCsv;
  $('#dspPrint').onclick = () => openDoc(buildListDoc(filtered()));
  $('#dspForm').onclick = () => { const items = rows.filter(r => selected.has(r.id)); if (!items.length) { alert('Tick at least one item in the list first.'); return; } openDoc(buildFormDoc(items)); };
  // bulk status
  const statusMenu = document.createElement('div'); statusMenu.className = 'menu-list'; statusMenu.hidden = true; statusMenu.style.right = 'auto';
  statusMenu.innerHTML = STATUSES.map(s => `<button type="button" data-s="${s}">${s}</button>`).join('');
  $('#dspSetStatus').parentElement.style.position = 'relative'; $('#dspSetStatus').insertAdjacentElement('afterend', statusMenu);
  $('#dspSetStatus').onclick = e => { e.stopPropagation(); if (!selected.size) { alert('Tick at least one item in the list first.'); return; } statusMenu.hidden = !statusMenu.hidden; const r = $('#dspSetStatus').getBoundingClientRect(), p = $('#dspSetStatus').parentElement.getBoundingClientRect(); statusMenu.style.left = (r.left - p.left) + 'px'; statusMenu.style.top = (r.bottom - p.top + 6) + 'px'; };
  document.addEventListener('click', () => { statusMenu.hidden = true; });
  statusMenu.querySelectorAll('button').forEach(b => b.onclick = async () => {
    const s = b.dataset.s; const items = rows.filter(r => selected.has(r.id));
    let extra = {};
    if (s === 'Approved') { const who = prompt('Approved by (name):', items[0]?.approved_by || ''); if (who === null) return; extra = { approved_by: who, approved_date: today() }; }
    if (s === 'Disposed') { const m = prompt('Disposal method:\n' + METHODS.map((x, i) => (i + 1) + '. ' + x).join('\n') + '\n\nType the number or the method:', ''); if (m === null) return; const method = /^\d+$/.test(m.trim()) ? METHODS[parseInt(m, 10) - 1] || m : m; extra = { disposal_method: method, disposal_date: today() }; }
    try { for (const it of items) await save({ ...it, status: s, ...extra }); flash(`${items.length} item(s) set to "${s}".`); } catch (e) { alert(e.message); }
  });

  /* ===================== tab in toolbar ===================== */
  const tab = document.createElement('button'); tab.className = 'tab'; tab.id = 'tabDisposal'; tab.role = 'tab'; tab.hidden = true;
  tab.innerHTML = 'Disposal <span class="badge" id="dspCount">0</span>';
  document.querySelector('.toolbar .tabs').appendChild(tab);
  function updateTab(){ document.getElementById('dspCount').textContent = rows.filter(r => !['Disposed','Cancelled'].includes(r.status)).length; }
  const origShowView = showView;
  showView = function (v) {
    if (v === 'disposal') {
      document.getElementById('recordsView').hidden = true; document.getElementById('form').hidden = true; view.hidden = false;
      document.getElementById('tabRecords').classList.remove('on'); document.getElementById('tabForm').classList.remove('on'); tab.classList.add('on');
      render(); return;
    }
    view.hidden = true; tab.classList.remove('on'); origShowView(v);
  };
  tab.onclick = () => showView('disposal'); // "+ New form" and record open go through showView('form'), which leaves this view

  /* ===================== add / edit modal ===================== */
  const em = document.createElement('div'); em.className = 'dm'; em.hidden = true;
  em.innerHTML = `
    <div class="box" role="dialog" aria-label="Disposal item">
      <h2><span id="dmTitle">Add irreparable asset</span> <button type="button" id="dmClose" aria-label="Close">×</button></h2>
      <div class="sub">Record the asset, why it is beyond repair, and — as the workflow progresses — the approval and disposal details.</div>
      <form id="dmForm" autocomplete="off">
        <input type="hidden" name="id"><input type="hidden" name="turnover_id"><input type="hidden" name="ref_no">
        <h3>Asset</h3>
        <div class="grid">
          <label class="w2">Company <select name="company" required><option value="">— select —</option></select></label>
          <label>Ref. No. <input name="ref_no_view" readonly placeholder="auto"></label>
          <label>Turnover Control No. <input name="turnover_ctrl_no" placeholder="if from a turnover"></label>
          <label>Asset type <input name="asset_type" list="dmTypes" required><datalist id="dmTypes">${ASSET_TYPES.map(t => `<option value="${E(t)}">`).join('')}</datalist></label>
          <label>Asset Tag / ID <input name="asset_tag" class="mono"></label>
          <label>Serial No. <input name="serial_no" class="mono"></label>
          <label>Qty <input name="qty" type="number" min="1" value="1"></label>
          <label class="w4">Description / Model <input name="description"></label>
          <label class="w2">Last user / custodian <input name="last_user"></label>
          <label class="w2">Department <input name="department"></label>
          <label>Acquisition date <input name="acquisition_date" type="date"></label>
          <label>Acquisition cost (PHP) <input name="acquisition_cost" type="number" step="0.01" min="0"></label>
        </div>
        <h3>Assessment</h3>
        <div class="grid">
          <label class="w4">Reason / defect — why the asset is irreparable <textarea name="reason" placeholder="e.g. Motherboard failure, no display; repair quote exceeds replacement cost; parts no longer available"></textarea></label>
          <label class="w2">Assessed by (IT) <input name="assessed_by"></label>
          <label>Assessment date <input name="assessed_date" type="date"></label>
          <label class="chk"><input type="checkbox" name="data_wiped"> Data wiped / storage removed</label>
        </div>
        <h3>Status &amp; approval</h3>
        <div class="grid">
          <label>Status <select name="status">${STATUSES.map(s => `<option>${s}</option>`).join('')}</select></label>
          <label class="w2">Approved by (Management) <input name="approved_by"></label>
          <label>Approval date <input name="approved_date" type="date"></label>
          <label class="w2">Co-signatory — IT Manager <input name="it_manager" placeholder="IT Manager's name"></label>
          <label class="w2">Co-signatory — Administrative Department <input name="admin_signatory" placeholder="Administrative Department signatory"></label>
          <label class="w2">Co-signatory — Finance / Accounting <input name="finance_signatory" placeholder="Finance / Accounting (Fixed Assets) signatory"></label>
        </div>
        <h3>Buyout (Section 7)</h3>
        <div class="grid">
          <label class="chk w4"><input type="checkbox" name="buyout_paid"> The employee already <b>paid</b> for this asset under the Asset Buyout option (Section 7 of the turnover form)</label>
          <label>OR / AR No. <input name="buyout_ref" class="mono" placeholder="from the buyout"></label>
          <label>Amount paid (PHP) <input name="buyout_amount" type="number" step="0.01" min="0"></label>
          <label>Date paid <input name="buyout_date" type="date"></label>
        </div>
        <h3>Disposal</h3>
        <div class="grid">
          <label class="w2">Disposal method <select name="disposal_method"><option value="">— not yet —</option>${METHODS.map(m => `<option>${m}</option>`).join('')}</select></label>
          <label>Disposal date <input name="disposal_date" type="date"></label>
          <label>Proceeds / value (PHP) <input name="disposal_value" type="number" step="0.01" min="0"></label>
          <label class="w2">Recipient (recycler / buyer / donee) <input name="recipient"></label>
          <label class="w2">Reference (certificate / OR / gate pass no.) <input name="disposal_ref" class="mono"></label>
          <label class="w4">Remarks <input name="remarks"></label>
        </div>
        <div class="btns"><span class="msg" id="dmMsg"></span><button type="button" class="btn" id="dmCancel">Cancel</button><button type="submit" class="btn primary" id="dmSave">Save</button></div>
      </form>
    </div>`;
  document.body.appendChild(em);
  const F = em.querySelector('#dmForm');
  const dmMsg = (t, err) => { const m = em.querySelector('#dmMsg'); m.textContent = t || ''; m.classList.toggle('err', !!err); };
  function fillCompanies(){ const s = F.elements.company; const cur = s.value; s.innerHTML = '<option value="">— select —</option>' + companies().map(c => `<option>${E(c.name)}</option>`).join('') + [...new Set(rows.map(r => r.company).filter(n => n && !companies().some(c => c.name === n)))].map(n => `<option>${E(n)}</option>`).join(''); s.value = cur; }
  function openEdit(rec, presets){
    fillCompanies(); F.reset(); dmMsg('');
    const last = k => (rows.find(x => x[k]) || {})[k] || ''; // reuse the co-signatories from the most recent item
    const r = rec || { status: 'For evaluation', qty: 1, assessed_date: today(), it_manager: last('it_manager'), admin_signatory: last('admin_signatory'), finance_signatory: last('finance_signatory'), assessed_by: (typeof currentUser !== 'undefined' && currentUser) ? (currentUser.user_metadata?.full_name || '') : '', company: (typeof companyName === 'function' && typeof collect === 'function') ? companyName(collect()) : '', ...(presets || {}) };
    for (const el of F.elements) { if (!el.name || el.name === 'ref_no_view') continue; if (el.type === 'checkbox') el.checked = !!r[el.name]; else el.value = r[el.name] ?? ''; }
    if (r.company && !F.elements.company.value) { F.elements.company.insertAdjacentHTML('beforeend', `<option>${E(r.company)}</option>`); F.elements.company.value = r.company; }
    F.elements.ref_no_view.value = r.ref_no || (r.company ? nextRef(r.company) + ' (auto)' : 'auto');
    em.querySelector('#dmTitle').textContent = rec ? 'Edit disposal item — ' + (rec.ref_no || '') : 'Add irreparable asset';
    em.hidden = false; F.elements.asset_type.focus();
  }
  F.elements.company.addEventListener('change', () => { if (!F.elements.id.value) F.elements.ref_no_view.value = F.elements.company.value ? nextRef(F.elements.company.value) + ' (auto)' : 'auto'; });
  F.elements.buyout_paid.addEventListener('change', () => { if (F.elements.buyout_paid.checked) { if (!F.elements.disposal_method.value) F.elements.disposal_method.value = 'Sold to employee (buyout)'; if (!F.elements.recipient.value) F.elements.recipient.value = F.elements.last_user.value; if (!F.elements.disposal_ref.value) F.elements.disposal_ref.value = F.elements.buyout_ref.value; if (!F.elements.disposal_value.value) F.elements.disposal_value.value = F.elements.buyout_amount.value; if (!F.elements.disposal_date.value) F.elements.disposal_date.value = F.elements.buyout_date.value; } });
  F.elements.status.addEventListener('change', () => { const s = F.elements.status.value; if (s === 'Approved' && !F.elements.approved_date.value) F.elements.approved_date.value = today(); if (s === 'Disposed' && !F.elements.disposal_date.value) F.elements.disposal_date.value = today(); });
  F.addEventListener('submit', async e => {
    e.preventDefault(); const rec = {};
    for (const el of F.elements) { if (!el.name || el.name === 'ref_no_view') continue; rec[el.name] = el.type === 'checkbox' ? el.checked : el.value; }
    if (!rec.id) delete rec.id; if (!rec.turnover_id) rec.turnover_id = null; if (!rec.ref_no) delete rec.ref_no;
    const btn = em.querySelector('#dmSave'); btn.disabled = true; btn.textContent = 'Saving…';
    try { const saved = await save(rec); em.hidden = true; flash(`Saved ${saved.ref_no}.`); } catch (err) { dmMsg(err.message, true); }
    btn.disabled = false; btn.textContent = 'Save';
  });
  em.querySelector('#dmClose').onclick = em.querySelector('#dmCancel').onclick = () => { em.hidden = true; };
  em.addEventListener('click', e => { if (e.target === em) em.hidden = true; });

  /* ===================== add multiple assets at once ===================== */
  const mm = document.createElement('div'); mm.className = 'dm'; mm.hidden = true;
  const typeOpts = ASSET_TYPES.map(t => `<option>${E(t)}</option>`).join('') + '<option value="__other">Other (type below)</option>';
  mm.innerHTML = `
    <div class="box" role="dialog" aria-label="Add multiple assets" style="width:1180px">
      <h2>Add multiple irreparable assets <button type="button" id="mmClose" aria-label="Close">×</button></h2>
      <div class="sub">Fill one row per asset. The details below apply to every row; each row is saved as its own disposal item with its own Ref. No. Empty rows are ignored.</div>
      <h3>Common details</h3>
      <div class="grid">
        <label class="w2">Company <select id="mmCompany" required><option value="">— select —</option></select></label>
        <label>Status <select id="mmStatus">${STATUSES.map(s => `<option>${s}</option>`).join('')}</select></label>
        <label>Assessment date <input id="mmDate" type="date"></label>
        <label class="w2">Assessed by (IT) <input id="mmAssessed"></label>
        <label>Co-signatory — IT Manager <input id="mmItMgr"></label>
        <label>Co-signatory — Admin. Dept. <input id="mmAdmin"></label>
        <label class="w2">Co-signatory — Finance / Accounting <input id="mmFinance"></label>
        <label class="w2">Last user / custodian (default for all rows) <input id="mmUser"></label>
        <label class="w2">Department (default for all rows) <input id="mmDept"></label>
      </div>
      <h3>Assets</h3>
      <div class="tablewrap"><table id="mmTable">
        <thead><tr><th>#</th><th style="min-width:150px">Asset type</th><th>Tag / ID</th><th>Serial No.</th><th style="min-width:160px">Description / Model</th><th style="width:56px">Qty</th><th>Last user</th><th>Dept.</th><th style="min-width:180px">Reason / defect</th><th><label class="chk" style="padding:0;gap:4px;font-size:11px"><input type="checkbox" id="mmWipedAll" title="Set data-wiped on all rows"> Wiped</label></th><th title="Already paid by the employee under Section 7 Asset Buyout">Buyout paid / OR no.</th><th></th></tr></thead>
        <tbody id="mmRows"></tbody>
      </table></div>
      <div style="display:flex;gap:8px;align-items:center"><button type="button" class="btn" id="mmAddRow">+ Add row</button><button type="button" class="btn" id="mmAdd5">+ 5 rows</button><span class="hint" style="margin:0">Tip: press Enter in the Reason cell to jump to (or add) the next row.</span></div>
      <div class="btns"><span class="msg" id="mmMsg"></span><button type="button" class="btn" id="mmCancel">Cancel</button><button type="button" class="btn primary" id="mmSave">Save all</button></div>
    </div>`;
  document.body.appendChild(mm);
  const M = s => mm.querySelector(s);
  const mmStyle = document.createElement('style');
  mmStyle.textContent = `.dm #mmTable td{padding:3px 3px}.dm #mmTable input,.dm #mmTable select{border:1px solid var(--line);border-radius:4px;padding:5px 6px;background:var(--paper);font-size:12.5px;width:100%;min-width:60px}.dm #mmTable input:focus,.dm #mmTable select:focus{outline:none;border-color:var(--accent)}.dm #mmTable td.n{color:var(--muted);font-family:var(--mono);font-size:11px;text-align:center}.dm #mmTable button.x{border:0;background:none;color:var(--muted);cursor:pointer;font-size:16px}.dm #mmTable button.x:hover{color:var(--crit)}.dm #mmTable tr.bad td{background:#FBECEA}`;
  document.head.appendChild(mmStyle);
  function mmRow(){
    const tr = document.createElement('tr');
    tr.innerHTML = `<td class="n"></td>
      <td><select data-k="asset_type">${'<option value=""></option>' + typeOpts}</select><input data-k="asset_type_other" placeholder="Other type" hidden style="margin-top:3px"></td>
      <td><input data-k="asset_tag" class="mono"></td><td><input data-k="serial_no" class="mono"></td><td><input data-k="description"></td>
      <td><input data-k="qty" type="number" min="1" value="1"></td><td><input data-k="last_user" placeholder="(default)"></td><td><input data-k="department" placeholder="(default)"></td>
      <td><input data-k="reason"></td><td style="text-align:center"><input type="checkbox" data-k="data_wiped"></td><td style="white-space:nowrap"><input type="checkbox" data-k="buyout_paid" title="Paid under buyout"> <input data-k="buyout_ref" class="mono" placeholder="OR/AR no." style="width:90px;display:inline-block"></td><td><button type="button" class="x" title="Remove row">×</button></td>`;
    tr.querySelector('[data-k=asset_type]').onchange = e => { const o = tr.querySelector('[data-k=asset_type_other]'); o.hidden = e.target.value !== '__other'; if (!o.hidden) o.focus(); };
    tr.querySelector('button.x').onclick = () => { tr.remove(); mmRenumber(); if (!M('#mmRows').children.length) mmRow(); };
    M('#mmRows').appendChild(tr); mmRenumber(); return tr;
  }
  function mmRenumber(){ [...M('#mmRows').children].forEach((tr, i) => tr.querySelector('td.n').textContent = i + 1); }
  function mmRowData(tr){
    const g = k => tr.querySelector(`[data-k=${k}]`);
    let type = g('asset_type').value; if (type === '__other') type = g('asset_type_other').value.trim();
    const d = { asset_type: type, asset_tag: g('asset_tag').value.trim(), serial_no: g('serial_no').value.trim(), description: g('description').value.trim(), qty: g('qty').value || 1, last_user: g('last_user').value.trim() || M('#mmUser').value.trim(), department: g('department').value.trim() || M('#mmDept').value.trim(), reason: g('reason').value.trim(), data_wiped: g('data_wiped').checked, buyout_paid: g('buyout_paid').checked, buyout_ref: g('buyout_ref').value.trim() };
    if (d.buyout_paid) { d.disposal_method = 'Sold to employee (buyout)'; d.disposal_ref = d.buyout_ref; d.recipient = d.last_user; }
    d._empty = !type && !d.asset_tag && !d.serial_no && !d.description && !d.reason;
    return d;
  }
  function openMulti(){
    const sel = M('#mmCompany'); const cur = sel.value;
    sel.innerHTML = '<option value="">— select —</option>' + companies().map(c => `<option>${E(c.name)}</option>`).join('') + [...new Set(rows.map(r => r.company).filter(n => n && !companies().some(c => c.name === n)))].map(n => `<option>${E(n)}</option>`).join('');
    sel.value = cur || ((typeof companyName === 'function' && typeof collect === 'function') ? companyName(collect()) : '') || '';
    const last = k => (rows.find(x => x[k]) || {})[k] || '';
    M('#mmStatus').value = 'For evaluation'; M('#mmDate').value = today();
    if (!M('#mmAssessed').value) M('#mmAssessed').value = last('assessed_by');
    if (!M('#mmItMgr').value) M('#mmItMgr').value = last('it_manager');
    if (!M('#mmAdmin').value) M('#mmAdmin').value = last('admin_signatory');
    if (!M('#mmFinance').value) M('#mmFinance').value = last('finance_signatory');
    M('#mmRows').innerHTML = ''; for (let i = 0; i < 5; i++) mmRow();
    M('#mmMsg').textContent = ''; M('#mmMsg').classList.remove('err'); mm.hidden = false;
    M('#mmRows').querySelector('select').focus();
  }
  M('#mmAddRow').onclick = () => mmRow().querySelector('select').focus();
  M('#mmAdd5').onclick = () => { for (let i = 0; i < 5; i++) mmRow(); };
  M('#mmWipedAll').onchange = e => M('#mmRows').querySelectorAll('[data-k=data_wiped]').forEach(c => c.checked = e.target.checked);
  M('#mmRows').addEventListener('keydown', e => { // Enter in the last cell adds a new row
    if (e.key === 'Enter' && e.target.dataset.k === 'reason') { e.preventDefault(); const tr = e.target.closest('tr'); const next = tr.nextElementSibling || mmRow(); next.querySelector('select').focus(); }
  });
  M('#mmSave').onclick = async () => {
    const company = M('#mmCompany').value; const msg = (t, err) => { M('#mmMsg').textContent = t || ''; M('#mmMsg').classList.toggle('err', !!err); };
    if (!company) { msg('Select the company first.', true); M('#mmCompany').focus(); return; }
    const trs = [...M('#mmRows').children]; const items = []; let bad = 0;
    trs.forEach(tr => { const d = mmRowData(tr); tr.classList.remove('bad'); if (d._empty) return; if (!d.asset_type) { tr.classList.add('bad'); bad++; return; } delete d._empty; items.push(d); });
    if (bad) { msg(`${bad} row(s) have details but no asset type (highlighted).`, true); return; }
    if (!items.length) { msg('Fill in at least one asset row.', true); return; }
    const common = { company, status: M('#mmStatus').value, assessed_date: M('#mmDate').value, assessed_by: M('#mmAssessed').value.trim(), it_manager: M('#mmItMgr').value.trim(), admin_signatory: M('#mmAdmin').value.trim(), finance_signatory: M('#mmFinance').value.trim() };
    if (common.status === 'Approved') common.approved_date = today();
    const btn = M('#mmSave'); btn.disabled = true; let n = 0;
    try {
      for (const it of items) { btn.textContent = `Saving ${n + 1} of ${items.length}…`; await save({ ...common, ...it }); n++; }
      mm.hidden = true; flash(`${n} asset(s) added to the disposal list.`); if (view.hidden) showView('disposal');
    } catch (e) { msg(`Saved ${n} of ${items.length}; stopped at row ${n + 1}: ${e.message}`, true); [...M('#mmRows').children].filter(tr => !mmRowData(tr)._empty).slice(0, n).forEach(tr => tr.remove()); mmRenumber(); }
    btn.disabled = false; btn.textContent = 'Save all';
  };
  M('#mmClose').onclick = M('#mmCancel').onclick = () => { mm.hidden = true; };
  mm.addEventListener('click', e => { if (e.target === mm) mm.hidden = true; });

  /* ===================== pull from turnover records ===================== */
  const pm = document.createElement('div'); pm.className = 'dm'; pm.hidden = true;
  pm.innerHTML = `
    <div class="box" role="dialog" aria-label="Pull from turnovers" style="width:980px">
      <h2><span id="pmTitle">Pull damaged assets from turnover records</span> <button type="button" id="pmClose" aria-label="Close">×</button></h2>
      <div class="sub">Assets marked <b>Damaged</b> in Section 2 of saved turnover checklists, or belonging to a checklist whose asset status is <b>For Disposal</b>. Items already in the disposal list are skipped. Tick the ones that are irreparable.</div>
      <div class="tablewrap"><table><thead><tr><th><input type="checkbox" id="pmAll"></th><th>Control No.</th><th>Employee</th><th>Asset</th><th>Tag / Serial</th><th>Description</th><th>Remarks</th><th>Why listed</th></tr></thead><tbody id="pmRows"></tbody></table></div>
      <div class="hint">Each pulled item is added with status "For evaluation" and keeps a link to its turnover record (control no.). You can edit the reason and other details afterwards.</div>
      <div class="btns"><span class="msg" id="pmMsg"></span><button type="button" class="btn" id="pmCancel">Cancel</button><button type="button" class="btn primary" id="pmAdd">Add selected to disposal list</button></div>
    </div>`;
  document.body.appendChild(pm);
  let candidates = [];
  function candidatesFrom(records){
    const out = [];
    for (const rec of records) {
      const forDsp = !!rec.s_disposal; const co = (typeof companyName === 'function') ? companyName(rec) : (rec.company || '');
      ASSET_TYPES.forEach((t, i) => {
        const tag = rec[`a${i}_tag`] || '', sn = rec[`a${i}_sn`] || '', desc = rec[`a${i}_desc`] || '', rem = rec[`a${i}_rem`] || '';
        if (!tag && !sn && !desc) return;
        const dmg = !!rec[`a${i}_dmg`]; const remHit = /irrepar|beyond repair|for disposal|dispos|unrepair|condemn/i.test(rem);
        const boOn = rec.bo_enabled === true || rec.bo_enabled === 'true' || rec.bo_enabled === 'on' || rec.bo_enabled === 1; const bo = boOn && !!rec[`bo_item${i}`]; const boPaid = bo && rec.bo_pay_status === 'Fully paid';
        if (!dmg && !forDsp && !remHit && !bo) return;
        if (rows.some(r => r.turnover_id === rec._id && r.asset_type === t)) return; // already listed
        out.push({ turnover_id: rec._id, turnover_ctrl_no: rec.ctrl_no || '', company: co, asset_type: t, asset_tag: tag, serial_no: sn, description: desc, last_user: rec.emp_name || '', department: rec.emp_dept || '', reason: [dmg ? 'Marked damaged at turnover' : '', rem].filter(Boolean).join(' — '), assessed_by: rec.sg2_name || '', assessed_date: rec.emp_date || today(), status: 'For evaluation', qty: 1, buyout_paid: boPaid, buyout_ref: bo ? (rec.bo_or_no || '') : '', buyout_amount: bo ? (rec.bo_amount_paid || rec.bo_amount || null) : null, buyout_date: bo ? (rec.bo_paid_date || rec.bo_date || null) : null, ...(boPaid ? { disposal_method: 'Sold to employee (buyout)', disposal_ref: rec.bo_or_no || '', disposal_value: rec.bo_amount_paid || rec.bo_amount || null, disposal_date: rec.bo_paid_date || rec.bo_date || null, recipient: rec.emp_name || '' } : {}), why: [dmg ? 'Damaged' : '', forDsp ? 'Status: For Disposal' : '', remHit ? 'Remark' : '', bo ? (boPaid ? 'Buyout: PAID' : 'Buyout: ' + (rec.bo_pay_status || 'unpaid')) : ''].filter(Boolean).join(', '), pre: dmg && (forDsp || remHit) || remHit, emp: rec.emp_name || '' });
      });
    }
    return out;
  }
  function openPull(onlyRecordId){
    const recs = (typeof store !== 'undefined' && store.records) ? [...store.records.values()].filter(r => !onlyRecordId || r._id === onlyRecordId) : [];
    candidates = candidatesFrom(recs);
    pm.querySelector('#pmTitle').textContent = onlyRecordId ? 'Add damaged assets from this turnover' : 'Pull damaged assets from turnover records';
    pm.querySelector('#pmRows').innerHTML = candidates.length ? candidates.map((c, i) => `<tr><td><input type="checkbox" data-i="${i}" ${c.pre || onlyRecordId ? 'checked' : ''}></td><td class="m">${E(c.turnover_ctrl_no)}</td><td>${E(c.emp)}<br><span class="hint">${E(c.department)}</span></td><td><b>${E(c.asset_type)}</b></td><td class="m">${E(c.asset_tag)}<br>${E(c.serial_no)}</td><td>${E(c.description)}</td><td>${E(c.reason.replace('Marked damaged at turnover — ', '').replace('Marked damaged at turnover', ''))}</td><td class="hint">${E(c.why)}</td></tr>`).join('')
      : `<tr><td colspan="8" class="empty" style="text-align:center;color:var(--muted);padding:20px">${onlyRecordId ? 'No damaged asset rows in this record (mark the item as Damaged in Section 2, or tick "For Disposal" in Section 6, then save).' : 'No new candidates — every damaged / for-disposal asset in the saved turnover records is already in the list.'}</td></tr>`;
    pm.querySelector('#pmMsg').textContent = ''; pm.querySelector('#pmMsg').classList.remove('err'); pm.hidden = false;
  }
  pm.querySelector('#pmAll').onchange = () => pm.querySelectorAll('#pmRows input[type=checkbox]').forEach(c => c.checked = pm.querySelector('#pmAll').checked);
  pm.querySelector('#pmAdd').onclick = async () => {
    const picked = [...pm.querySelectorAll('#pmRows input[type=checkbox]:checked')].map(c => candidates[+c.dataset.i]);
    if (!picked.length) { pm.querySelector('#pmMsg').textContent = 'Tick at least one asset.'; return; }
    const btn = pm.querySelector('#pmAdd'); btn.disabled = true; btn.textContent = 'Adding…';
    const last = k => (rows.find(x => x[k]) || {})[k] || ''; // reuse the co-signatories from the most recent item
    try { for (const c of picked) { const { why, pre, emp, ...rec } = c; rec.it_manager = last('it_manager'); rec.admin_signatory = last('admin_signatory'); rec.finance_signatory = last('finance_signatory'); await save(rec); } pm.hidden = true; flash(`${picked.length} asset(s) added to the disposal list.`); if (view.hidden) showView('disposal'); }
    catch (e) { pm.querySelector('#pmMsg').textContent = e.message; pm.querySelector('#pmMsg').classList.add('err'); }
    btn.disabled = false; btn.textContent = 'Add selected to disposal list';
  };
  pm.querySelector('#pmClose').onclick = pm.querySelector('#pmCancel').onclick = () => { pm.hidden = true; };
  pm.addEventListener('click', e => { if (e.target === pm) pm.hidden = true; });
  document.addEventListener('keydown', e => { if (e.key === 'Escape') { em.hidden = true; pm.hidden = true; mm.hidden = true; statusMenu.hidden = true; } });

  // Section 6 helper button: add this record's damaged items to the disposal list
  const statusBox = document.querySelector('[name=s_disposal]')?.closest('.status');
  if (statusBox) {
    const wrap = document.createElement('div'); wrap.className = 'dsp-secbtn noprint';
    wrap.innerHTML = `<button type="button" class="btn" id="btnToDisposal">Add damaged items to Disposal list</button><span class="hint" style="margin:0">Lists this record's damaged / for-disposal assets in the Irreparable IT Assets register (save the record first).</span>`;
    statusBox.appendChild(wrap);
    wrap.querySelector('#btnToDisposal').onclick = async () => {
      if (typeof currentId === 'undefined' || !currentId) { alert('Save the record first (Ctrl+S), then try again.'); return; }
      try { if (typeof saveCurrent === 'function') await saveCurrent(true, true); } catch (e) {}
      openPull(currentId);
    };
  }

  /* ===================== CSV ===================== */
  function exportCsv(){
    const cols = ['ref_no','status','company','asset_type','qty','asset_tag','serial_no','description','last_user','department','turnover_ctrl_no','reason','assessed_by','assessed_date','data_wiped','acquisition_date','acquisition_cost','approved_by','approved_date','it_manager','admin_signatory','finance_signatory','disposal_method','disposal_date','disposal_value','recipient','disposal_ref','buyout_paid','buyout_ref','buyout_amount','buyout_date','remarks','created_at','updated_at'];
    const q = v => '"' + String(v ?? '').replace(/"/g, '""') + '"';
    const text = [cols.join(','), ...filtered().map(r => cols.map(c => q((c === 'data_wiped' || c === 'buyout_paid') ? (r[c] ? 'Yes' : 'No') : r[c])).join(','))].join('\r\n');
    if (typeof download === 'function') download('it-asset-disposal-' + today() + '.csv', '\ufeff' + text, 'text/csv');
  }

  /* ===================== printable documents ===================== */
  function openDoc(html){ const w = window.open('', '_blank'); if (!w) { alert('Pop-up blocked — please allow pop-ups for this site to generate the form.'); return; } w.document.open(); w.document.write(html); w.document.close(); }
  const sig = name => { const u = (typeof window.itatSignatureFor === 'function') ? window.itatSignatureFor(name) : ''; return u ? `<img class="sig" src="${u}" alt="">` : ''; };
  const DOC_CSS = `
@page{size:A4;margin:14mm 14mm 16mm}
*{box-sizing:border-box}body{font-family:Arial,Helvetica,sans-serif;font-size:11.5px;color:#111;margin:0;padding:24px;background:#eee}
.sheet{background:#fff;max-width:800px;margin:0 auto;padding:28px 32px;box-shadow:0 2px 12px rgba(0,0,0,.15);position:relative}
.hdr{display:flex;align-items:center;gap:16px;border-bottom:2px solid #111;padding-bottom:10px;margin-bottom:12px}
.hdr img{height:54px;max-width:170px;object-fit:contain}.hdr .co{font-size:15px;font-weight:700;letter-spacing:.02em}.hdr .sub{font-size:10.5px;color:#444}
.hdr .ref{margin-left:auto;text-align:right;font-size:10.5px;line-height:1.5}.hdr .ref b{font-family:Consolas,monospace;font-size:12px}
h1{font-size:16px;text-align:center;letter-spacing:.06em;margin:4px 0 2px}.tagline{text-align:center;font-size:10.5px;color:#444;margin-bottom:12px}
h2{font-size:11px;letter-spacing:.08em;text-transform:uppercase;background:#f0f0f0;border-left:4px solid #111;padding:4px 8px;margin:14px 0 6px}
table{width:100%;border-collapse:collapse;margin-top:4px}th,td{border:1px solid #333;padding:4px 5px;vertical-align:top;font-size:10px}th{background:#f0f0f0;font-size:9px;text-transform:uppercase;letter-spacing:.04em}td.c{text-align:center}td.m{font-family:Consolas,monospace}td.r{text-align:right}
.grid{display:grid;grid-template-columns:repeat(4,1fr);gap:6px 14px}.grid .f{border-bottom:1px solid #999;padding:2px 0 3px;min-height:26px}.grid .f.w2{grid-column:span 2}
.lbl{display:block;font-size:9px;text-transform:uppercase;letter-spacing:.05em;color:#555}.val{font-size:11.5px;min-height:14px}
ol,ul{margin:4px 0 0 18px;padding:0;font-size:10.5px;line-height:1.45}li{margin-bottom:3px}
.cert{border:1px solid #333;padding:8px 10px;font-size:10.5px;line-height:1.5;margin-top:6px}.cert label{display:inline-block;margin-right:14px}.cert .bx{display:inline-block;width:11px;height:11px;border:1px solid #111;vertical-align:-2px;margin-right:4px;text-align:center;font-size:9px;line-height:10px}
.signs{display:grid;grid-template-columns:1fr 1fr;gap:22px 28px;margin-top:10px}.sg{padding-top:34px;position:relative}.sg img.sig{position:absolute;left:6px;bottom:44px;height:46px;max-width:70%;object-fit:contain;object-position:left bottom}.sg .line{border-top:1px solid #111;padding-top:3px;font-weight:700;font-size:11px;min-height:18px}.sg .role{font-size:9.5px;color:#444}.sg .dt{font-size:9.5px;color:#444;margin-top:6px}.sg .dt span{display:inline-block;border-bottom:1px solid #111;min-width:110px;margin-left:4px}
.stamp{position:absolute;right:32px;top:110px;transform:rotate(-8deg);border:3px solid;border-radius:6px;padding:4px 14px;font-weight:800;font-size:20px;letter-spacing:.12em;text-align:center;opacity:.85;-webkit-print-color-adjust:exact;print-color-adjust:exact}.stamp small{display:block;font-size:9px;letter-spacing:.04em;font-weight:600}.stamp.done{color:#2A7A4B;border-color:#2A7A4B}.stamp.appr{color:#0F6E7A;border-color:#0F6E7A}
.foot{margin-top:14px;font-size:9px;color:#666;display:flex;justify-content:space-between;border-top:1px solid #ccc;padding-top:4px}
.bar{max-width:800px;margin:0 auto 12px;display:flex;gap:8px;justify-content:flex-end}.bar button{border:1px solid #333;background:#fff;padding:7px 14px;border-radius:4px;cursor:pointer;font-size:12px}.bar button.p{background:#111;color:#fff}
.land .sheet{max-width:1080px}
@media print{body{background:#fff;padding:0}.sheet{box-shadow:none;padding:0;max-width:none}.bar{display:none}.signs,.cert{break-inside:avoid}tr{break-inside:avoid}}`;
  const docHead = (title, extra) => `<!DOCTYPE html><html lang="en"><head><meta charset="utf-8"><title>${E(title)}</title><style>${DOC_CSS}${extra || ''}</style></head><body>
<div class="bar"><button onclick="window.close()">Close</button><button class="p" onclick="window.print()">Print / Save as PDF</button></div>`;
  const docTail = `<script>window.addEventListener('load',()=>{ setTimeout(()=>{ try{ window.print(); }catch(e){} }, 400); });<\/script></body></html>`;
  const hdr = (co, logo, refHtml, sub) => `<div class="hdr">${logo ? `<img src="${logo}" alt="">` : ''}<div><div class="co">${E(co)}</div><div class="sub">${sub || 'Information Technology Department'}</div></div><div class="ref">${refHtml}</div></div>`;
  const logoFor = co => (typeof LOGOS !== 'undefined' && LOGOS[co]) || '';
  const coOf = items => { const names = [...new Set(items.map(r => r.company).filter(Boolean))]; return names.length === 1 ? names[0] : (names.length ? names.join(' / ') : 'Meatplus Group'); };

  function buildListDoc(items){
    const co = coOf(items), gen = fmtD(today());
    const rowsHtml = items.map((r, i) => `<tr><td class="c">${i + 1}</td><td class="m">${E(r.ref_no || '')}</td><td>${E(r.company || '')}</td><td>${E(r.asset_type || '')}${r.qty > 1 ? ' ×' + r.qty : ''}<br><span style="color:#444">${E(r.description || '')}</span></td><td class="m">${E(r.asset_tag || '')}<br>${E(r.serial_no || '')}</td><td>${E(r.last_user || '')}<br><span style="color:#444">${E(r.department || '')}</span></td><td>${E(r.reason || '')}</td><td>${E(r.assessed_by || '')}<br>${E(fmtD(r.assessed_date))}</td><td class="c">${E(r.status || '')}</td><td>${E(r.disposal_method || '')}${r.disposal_date ? '<br>' + E(fmtD(r.disposal_date)) : ''}${r.recipient ? '<br>' + E(r.recipient) : ''}</td></tr>`).join('');
    const filterTxt = [filt.status ? 'Status: ' + (filt.status === 'open' ? 'Open' : filt.status === 'buyout' ? 'Paid under buyout' : filt.status) : '', filt.company ? 'Company: ' + filt.company : '', filt.q ? 'Search: "' + filt.q + '"' : ''].filter(Boolean).join(' · ');
    return docHead('Irreparable IT Assets for Disposal — List', '@page{size:A4 landscape}') + `<div class="land"><div class="sheet">
  ${hdr(co, items.length && [...new Set(items.map(r => r.company))].length === 1 ? logoFor(co) : '', `Date generated: ${E(gen)}<br>Items: <b>${items.length}</b>${filterTxt ? '<br>' + E(filterTxt) : ''}`)}
  <h1>IRREPARABLE IT ASSETS SUBJECT FOR DISPOSAL</h1>
  <div class="tagline">Register of IT equipment assessed as beyond economical repair &middot; prepared by the IT Department</div>
  <table><thead><tr><th style="width:22px">#</th><th style="width:118px">Ref. No.</th><th>Company</th><th>Asset / Description</th><th style="width:105px">Tag / Serial</th><th>Last user / Dept.</th><th>Reason / defect</th><th style="width:80px">Assessed by</th><th style="width:66px">Status</th><th>Disposal</th></tr></thead><tbody>${rowsHtml || '<tr><td colspan="10" class="c">No items</td></tr>'}</tbody></table>
  <div class="signs">
    <div class="sg"><div class="line"></div><div class="role">Prepared by &mdash; IT Department</div><div class="dt">Date:<span></span></div></div>
    <div class="sg"><div class="line">${E([...new Set(items.map(r => r.it_manager).filter(Boolean))].join(', '))}</div><div class="role">Co-signatory &mdash; IT Manager</div><div class="dt">Date:<span></span></div></div>
    <div class="sg"><div class="line">${E([...new Set(items.map(r => r.admin_signatory).filter(Boolean))].join(', '))}</div><div class="role">Co-signatory &mdash; Administrative Department</div><div class="dt">Date:<span></span></div></div>
    <div class="sg"><div class="line">${E([...new Set(items.map(r => r.finance_signatory).filter(Boolean))].join(', '))}</div><div class="role">Co-signatory &mdash; Finance / Accounting (Fixed Assets)</div><div class="dt">Date:<span></span></div></div>
  </div>
  <div class="foot"><span>${E(co)} &middot; Irreparable IT Assets for Disposal</span><span>Generated ${E(gen)}</span></div>
</div></div>` + docTail;
  }

  function buildFormDoc(items){
    const co = coOf(items), gen = fmtD(today());
    const single = [...new Set(items.map(r => r.company))].length === 1;
    const first = items[0] || {};
    const ref = items.length === 1 ? (first.ref_no || '') : `${single ? abbrOf(co) : 'ITAT'}-DSP-BATCH-${today().replace(/-/g, '')}`;
    const allDisposed = items.length && items.every(r => r.status === 'Disposed'), allApproved = items.length && items.every(r => ['Approved','Disposed'].includes(r.status));
    const total = items.reduce((s, r) => s + (Number(r.acquisition_cost) || 0), 0), proceeds = items.reduce((s, r) => s + (Number(r.disposal_value) || 0), 0);
    const rowsHtml = items.map((r, i) => `<tr><td class="c">${i + 1}</td><td class="m">${E(r.ref_no || '')}</td><td>${E(r.asset_type || '')}${r.qty > 1 ? ' ×' + r.qty : ''}<br><span style="color:#444">${E(r.description || '')}</span></td><td class="m">${E(r.asset_tag || '')}<br>${E(r.serial_no || '')}</td><td>${E(r.last_user || '')}<br><span style="color:#444">${E(r.department || '')}${r.turnover_ctrl_no ? '<br>TO: ' + E(r.turnover_ctrl_no) : ''}</span></td><td>${E(r.reason || '')}</td><td>${E(fmtD(r.acquisition_date))}</td><td class="r">${E(money(r.acquisition_cost))}</td><td class="c">${r.data_wiped ? '☑' : '☐'}</td></tr>${r.buyout_paid ? `<tr><td></td><td colspan="8" style="border-top:0;color:#2A7A4B;font-size:9.5px"><b>PAID UNDER BUYOUT</b> — sold to ${E(r.last_user || 'the employee')}${r.buyout_ref ? ' · OR/AR No. ' + E(r.buyout_ref) : ''}${r.buyout_amount ? ' · PHP ' + E(money(r.buyout_amount)) : ''}${r.buyout_date ? ' · ' + E(fmtD(r.buyout_date)) : ''} (see Asset Buyout Form${r.turnover_ctrl_no ? ' ' + E(r.turnover_ctrl_no) + '-BO' : ''})</td></tr>` : ''}`).join('')
      + Array.from({ length: Math.max(0, 3 - items.length) }, () => '<tr><td class="c">&nbsp;</td><td></td><td></td><td></td><td></td><td></td><td></td><td></td><td></td></tr>').join('');
    const methods = [...new Set(items.map(r => r.disposal_method).filter(Boolean))].join(', ');
    const recips = [...new Set(items.map(r => r.recipient).filter(Boolean))].join(', ');
    const refs = [...new Set(items.map(r => r.disposal_ref).filter(Boolean))].join(', ');
    const dates = [...new Set(items.map(r => r.disposal_date).filter(Boolean))].map(fmtD).join(', ');
    const assessors = [...new Set(items.map(r => r.assessed_by).filter(Boolean))]; const approvers = [...new Set(items.map(r => r.approved_by).filter(Boolean))]; const adminSig = [...new Set(items.map(r => r.admin_signatory).filter(Boolean))].join(', '); const itMgr = [...new Set(items.map(r => r.it_manager).filter(Boolean))].join(', '); const finSig = [...new Set(items.map(r => r.finance_signatory).filter(Boolean))].join(', ');
    const bx = on => `<span class="bx">${on ? '✓' : ''}</span>`;
    return docHead('IT Asset Disposal Form ' + ref) + `<div class="sheet">
  ${hdr(co, single ? logoFor(co) : '', `Disposal Ref. No.: <b>${E(ref)}</b><br>Items: <b>${items.length}</b><br>Date generated: ${E(gen)}`)}
  ${allDisposed ? `<div class="stamp done">DISPOSED<small>${E(dates)}</small></div>` : allApproved ? `<div class="stamp appr">APPROVED<small>${E(approvers.join(', '))}</small></div>` : ''}
  <h1>IT ASSET DISPOSAL FORM</h1>
  <div class="tagline">Request for Disposal of Irreparable IT Equipment &middot; Certificate of Disposal</div>

  <h2>1. Irreparable IT Asset(s) for Disposal</h2>
  <table><thead><tr><th style="width:22px">#</th><th style="width:112px">Ref. No.</th><th>Item / Description</th><th style="width:100px">Tag / Serial</th><th>Last user / Dept.</th><th>Reason / defect (beyond economical repair)</th><th style="width:62px">Acquired</th><th style="width:66px">Cost (PHP)</th><th style="width:34px">Data wiped</th></tr></thead><tbody>${rowsHtml}</tbody>
  <tfoot><tr><th colspan="7" style="text-align:right">Total acquisition cost</th><th style="text-align:right">${E(money(total))}</th><th></th></tr></tfoot></table>

  <h2>2. Technical Assessment</h2>
  <div class="grid">
    <div class="f w2"><span class="lbl">Assessed by (IT)</span><div class="val">${E(assessors.join(', '))}</div></div>
    <div class="f"><span class="lbl">Assessment date</span><div class="val">${E([...new Set(items.map(r => r.assessed_date).filter(Boolean))].map(fmtD).join(', '))}</div></div>
    <div class="f"><span class="lbl">Current status</span><div class="val">${E([...new Set(items.map(r => r.status))].join(', '))}</div></div>
  </div>
  <div class="cert">The IT Department certifies that the asset(s) listed above have been inspected and found to be <b>irreparable / beyond economical repair</b> (repair cost exceeds the value of the equipment, parts are no longer available, or the unit is obsolete and unsafe for use), and that they are no longer fit for redeployment within the company.</div>

  <h2>3. Recommended / Actual Disposal</h2>
  <div class="grid">
    <div class="f w2"><span class="lbl">Disposal method</span><div class="val">${E(methods)}</div></div>
    <div class="f"><span class="lbl">Disposal date</span><div class="val">${E(dates)}</div></div>
    <div class="f"><span class="lbl">Proceeds (PHP)</span><div class="val">${E(proceeds ? money(proceeds) : '')}</div></div>
    <div class="f w2"><span class="lbl">Recipient (recycler / buyer / donee)</span><div class="val">${E(recips)}</div></div>
    <div class="f w2"><span class="lbl">Reference (certificate / OR / gate pass no.)</span><div class="val" style="font-family:Consolas,monospace">${E(refs)}</div></div>
    ${items.some(r => r.buyout_paid) ? `<div class="f w4" style="grid-column:span 4"><span class="lbl">Paid under Asset Buyout (Section 7)</span><div class="val">${E(items.filter(r => r.buyout_paid).map(r => (r.ref_no || '') + ' — ' + (r.last_user || 'employee') + (r.buyout_ref ? ' · OR/AR ' + r.buyout_ref : '') + (r.buyout_amount ? ' · PHP ' + money(r.buyout_amount) : '')).join('; '))}</div></div>` : ''}<div class="f w4" style="grid-column:span 4"><span class="lbl">Remarks</span><div class="val">${E([...new Set(items.map(r => r.remarks).filter(Boolean))].join('; '))}</div></div>
  </div>
  <div class="cert" style="margin-top:8px"><b>Pre-disposal checklist:</b>
    <label>${bx(items.every(r => r.data_wiped))} All storage media wiped or physically destroyed</label>
    <label>${bx(false)} Company labels / asset tags removed or defaced</label>
    <label>${bx(false)} Licensed software deactivated / licenses recovered</label>
    <label>${bx(false)} Reusable parts and accessories retained</label>
    <label>${bx(allDisposed)} Removed from IT asset register and fixed-asset ledger</label>
  </div>

  <h2>4. Approval</h2>
  <ol>
    <li>The asset(s) listed in Section 1 are recommended for disposal by the IT Department based on the technical assessment in Section 2.</li>
    <li>Upon approval, the asset(s) shall be disposed of using the method in Section 3, in accordance with company policy and applicable environmental regulations on electronic waste (RA 6969 / DENR guidelines). Any proceeds shall be remitted to Finance.</li>
    <li>Upon disposal, the asset(s) shall be written off from the fixed-asset register and removed from the IT asset inventory.</li>
  </ol>
  <div class="signs">
    <div class="sg">${sig(assessors[0])}<div class="line">${E(assessors[0] || '')}</div><div class="role">Prepared / Assessed by &mdash; IT Department</div><div class="dt">Date:<span>${E(fmtD(first.assessed_date))}</span></div></div>
    <div class="sg">${sig(finSig)}<div class="line">${E(finSig)}</div><div class="role">Co-signatory &mdash; Finance / Accounting (Fixed Assets)</div><div class="dt">Date:<span></span></div></div>
    <div class="sg">${sig(itMgr)}<div class="line">${E(itMgr)}</div><div class="role">Co-signatory &mdash; IT Manager</div><div class="dt">Date:<span></span></div></div>
    <div class="sg">${sig(adminSig)}<div class="line">${E(adminSig)}</div><div class="role">Co-signatory &mdash; Administrative Department</div><div class="dt">Date:<span></span></div></div>
    <div class="sg"><div class="line">${E(approvers.join(', '))}</div><div class="role">Approved by &mdash; Management</div><div class="dt">Date:<span>${E(fmtD(first.approved_date))}</span></div></div>
    <div class="sg"><div class="line">${E(recips)}</div><div class="role">Received by &mdash; Recycler / Buyer / Donee (signature over printed name)</div><div class="dt">Date:<span>${E(dates)}</span></div></div>
  </div>

  <h2>5. Certificate of Disposal</h2>
  <div class="cert">This certifies that the IT asset(s) enumerated in Section 1 under Disposal Ref. No. <b>${E(ref)}</b> were disposed of on <b>${E(dates) || '____________'}</b> by <b>${E(methods) || '____________________'}</b>${recips ? ' through <b>' + E(recips) + '</b>' : ''}, that all company data contained therein has been securely erased or destroyed, and that the asset(s) have been removed from the company's records.<br><br>
    Certified by: <u style="text-decoration:none;border-bottom:1px solid #111;padding:0 8px;display:inline-block;min-width:200px">${E(itMgr)}</u> &nbsp; IT Manager &nbsp;&nbsp;&nbsp; Co-signed by: <u style="text-decoration:none;border-bottom:1px solid #111;padding:0 8px;display:inline-block;min-width:200px">${E(adminSig)}</u> &nbsp; Administrative Department &nbsp;&nbsp;&nbsp; Date: ______________</div>
  <div class="foot"><span>${E(co)} &middot; IT Asset Disposal Form</span><span>${E(ref)} &middot; Generated ${E(gen)}</span></div>
</div>` + docTail;
  }
  window.itatDisposalFormFor = ids => openDoc(buildFormDoc(rows.filter(r => ids.includes(r.id))));

  /* ===================== session hooks ===================== */
  function subscribe(){ if (channel) return; channel = sb.channel('itat-disposals').on('postgres_changes', { event: '*', schema: 'public', table: 'itat_disposals' }, () => load().catch(() => {})).subscribe(); }
  const origStart = start;
  start = async function (session) { await origStart(session); if (!currentUser) return; tab.hidden = false; try { await load(); subscribe(); } catch (e) { flash('Disposal list: ' + e.message); } };
  const origStop = stop;
  stop = function () { origStop(); tab.hidden = true; view.hidden = true; em.hidden = true; pm.hidden = true; mm.hidden = true; rows = []; selected.clear(); if (channel) { sb.removeChannel(channel); channel = null; } };
  if (typeof currentUser !== 'undefined' && currentUser) { tab.hidden = false; load().then(subscribe).catch(() => {}); }
})();

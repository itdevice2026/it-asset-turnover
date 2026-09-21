/* IT Asset Turnover — Asset Buyout / Proof of Purchase section. Works with both the online and offline forms. */
(function(){
  const css = document.createElement('style');
  css.textContent = `
  .bo-head{display:flex;align-items:center;gap:10px;margin:4px 0 10px}
  .bo-head input{width:16px;height:16px;accent-color:var(--accent);margin:0}
  .bo-head b{font-size:13.5px}
  .bo-body{display:grid;gap:12px;border:1px solid var(--line);border-radius:6px;padding:14px 16px;background:var(--ground)}
  .bo-body[hidden]{display:none}
  .bo-grid{display:grid;grid-template-columns:repeat(4,1fr);gap:10px 16px}
  .bo-grid .f{grid-template-columns:1fr;gap:3px}
  .bo-grid .f.wide{grid-column:span 2}
  .bo-grid select{border:0;border-bottom:1px solid var(--line);padding:3px 4px;background:transparent;width:100%}
  .bo-items{display:grid;grid-template-columns:repeat(auto-fill,minmax(230px,1fr));gap:4px 16px}
  .bo-items label{display:flex;gap:8px;align-items:center;font-size:12.5px}
  .bo-items input{accent-color:var(--accent);width:14px;height:14px;margin:0}
  .bo-items .tag{font-family:var(--mono);font-size:11px;color:var(--muted)}
  .bo-terms{font-size:12px;color:var(--muted);border-left:3px solid var(--accent);padding:6px 10px;background:var(--paper)}
  .bo-signs{display:grid;grid-template-columns:1fr 1fr;gap:16px}
  .bo-signs .sign{background:var(--paper)}
  .bo-total{font-family:var(--mono);font-weight:600}
  .bo-gen{display:flex;align-items:center;gap:12px;flex-wrap:wrap}
  .bo-pay{display:grid;grid-template-columns:repeat(4,1fr);gap:10px 16px;align-items:end;border-top:1px dashed var(--line);padding-top:12px}
  .bo-pay .f{grid-template-columns:1fr;gap:3px}
  .bo-pay select{border:0;border-bottom:1px solid var(--line);padding:3px 4px;background:transparent;width:100%}
  .bo-bal{font-family:var(--mono);font-weight:600;font-size:14px;padding:3px 0;border-bottom:1px solid var(--line)}
  .bo-badge{display:inline-block;font-family:var(--head);font-size:10.5px;letter-spacing:.08em;text-transform:uppercase;border-radius:4px;padding:2px 9px;border:2px solid;margin-left:10px;vertical-align:middle}
  .bo-badge.paid{color:#2A7A4B;border-color:#2A7A4B;background:#DFF1E5}
  .bo-badge.partial{color:#9A5B00;border-color:#C98A1B;background:#FFF1D6}
  .bo-badge.unpaid{color:#B3261E;border-color:#B3261E;background:#FBE3E1}
  .bo-badge[hidden]{display:none}
  .rec-pay{display:inline-block;font-family:var(--head);font-size:10px;letter-spacing:.05em;text-transform:uppercase;border-radius:999px;padding:1px 8px;margin:3px 0 0 4px}
  .rec-pay.paid{background:#DFF1E5;color:#2A7A4B} .rec-pay.partial{background:#FFF1D6;color:#9A5B00} .rec-pay.unpaid{background:#FBE3E1;color:#B3261E}
  @media(max-width:700px){.bo-pay{grid-template-columns:1fr 1fr}}
  @media print{.bo-gen{display:none!important}}
  @media(max-width:700px){.bo-grid{grid-template-columns:1fr 1fr}.bo-signs{grid-template-columns:1fr}}
  @media print{
    .bo-body{background:#fff;border-color:#000}
    .bo-terms{color:#000;border-left-color:#000;background:#fff}
    .bo-pay select{border-bottom:1px solid #777;background:#fff}
    .bo-badge{-webkit-print-color-adjust:exact;print-color-adjust:exact}
    .bo-grid select{border-bottom:1px solid #777;background:#fff}
    .bo-off .bo-body{display:none!important}
    .bo-off .bo-none{display:block!important}
    .buyout-sec{break-inside:auto}
    .att-print:empty{display:none!important}
  }`;
  document.head.appendChild(css);

  const attachSec = document.querySelector('.attach-sec');
  if (!attachSec) return;

  // ---- Section: Asset Buyout / Proof of Purchase (inserted before Supporting Documents) ----
  const sec = document.createElement('section');
  sec.className = 'buyout-sec bo-off';
  sec.innerHTML = `
    <h2>7. Asset Buyout / Proof of Purchase <span class="bo-badge" id="boBadge" hidden></span></h2>
    <div class="bo-head"><input type="checkbox" id="boEnabled" name="bo_enabled"><label for="boEnabled"><b>The employee is purchasing (buying out) IT asset(s) listed in this turnover</b></label></div>
    <div class="bo-none" style="display:none;font-size:11px;color:#555">No asset buyout — all items surrendered to the company.</div>
    <div class="bo-body" id="boBody" hidden>
      <div class="hint" style="margin:0">Items purchased (tick the assets being bought out; details are taken from Section 2)</div>
      <div class="bo-items" id="boItems"></div>
      <div class="bo-grid">
        <div class="f"><label>Agreed buyout amount (PHP)</label><input name="bo_amount" inputmode="decimal" placeholder="0.00"></div>
        <div class="f"><label>Payment method</label><select name="bo_method"><option value="">— Select —</option><option>Cash</option><option>Salary deduction</option><option>Bank transfer</option><option>GCash / e-wallet</option><option>Deducted from final pay</option><option>Other</option></select></div>
        <div class="f"><label>OR / AR No. (Official / Acknowledgment Receipt)</label><input name="bo_or_no" style="font-family:var(--mono)"></div>
        <div class="f"><label>Date paid</label><input name="bo_date" type="date"></div>
        <div class="f"><label>Basis of valuation</label><select name="bo_basis"><option value="">— Select —</option><option>Net book value</option><option>Fair market / appraised value</option><option>Fully depreciated (nominal value)</option><option>Company-approved price list</option><option>Other</option></select></div>
        <div class="f"><label>Approved by (Management / Finance)</label><input name="bo_approved_by"></div>
        <div class="f wide"><label>Remarks (condition sold, inclusions, accessories, warranty status)</label><input name="bo_remarks"></div>
      </div>
      <div class="bo-pay">
        <div class="f"><label>Payment status</label><select name="bo_pay_status" id="boPayStatus"><option value="">— Select —</option><option>Unpaid</option><option>Partially paid</option><option>Fully paid</option></select></div>
        <div class="f"><label>Amount paid to date (PHP)</label><input name="bo_amount_paid" inputmode="decimal" placeholder="0.00"></div>
        <div class="f"><label>Balance (PHP)</label><div class="bo-bal" id="boBalance">—</div></div>
        <div class="f"><label>Date fully paid</label><input name="bo_paid_date" type="date"></div>
      </div>
      <div class="bo-gen noprint"><button type="button" class="btn" id="btnBuyoutForm">Generate Buyout Form</button><span class="hint" style="margin:0">Opens the printable IT Asset Buyout Form (Deed of Sale &amp; Proof of Purchase) filled from this record.</span></div>
      <div class="bo-terms"><b>Terms of sale.</b> The item(s) ticked above are sold to the employee on an <b>"as-is, where-is"</b> basis, with no warranty from the company. Company data, licenses and accounts have been removed or transferred before release. Upon full payment, ownership passes to the employee and the item(s) are removed from the company's fixed-asset register. This section, together with the official receipt referenced above, serves as the employee's <b>proof of purchase</b>.</div>
      <div class="bo-signs">
        <div class="sign">
          <div class="role">Purchased by (Buyer)</div><div class="who">Employee — signature confirms receipt of the item(s) and acceptance of the terms</div>
          <div><input name="bo_buyer_name"><div class="cap">Signature over printed name</div></div>
          <div class="row"><span></span><div><input name="bo_buyer_date" type="date" style="padding-top:4px"><div class="cap">Date</div></div></div>
        </div>
        <div class="sign">
          <div class="role">Payment received / released by</div><div class="who">Finance / Cashier or authorized company representative</div>
          <div><input name="bo_rcvd_name"><div class="cap">Signature over printed name</div></div>
          <div class="row"><span></span><div><input name="bo_rcvd_date" type="date" style="padding-top:4px"><div class="cap">Date</div></div></div>
        </div>
      </div>
    </div>`;
  attachSec.parentNode.insertBefore(sec, attachSec);

  // Renumber the sections that follow (Supporting Documents → 8, Sign-off → 9)
  let n = 8;
  let el = attachSec;
  while (el) { const h = el.querySelector('h2'); if (h) h.textContent = h.textContent.replace(/^\d+\./, n + '.'); n++; el = el.nextElementSibling; if (el && el.tagName !== 'SECTION') break; }

  // Tick-list of the 10 asset rows from Section 2 (checkbox per row; label shows type + tag/serial live)
  const ASSET_TYPES = (typeof ASSETS !== 'undefined') ? ASSETS : ['Laptop/Desktop','Monitor','Keyboard','Mouse','Laptop Charger/Adapter','Docking Station','Headset','Mobile Device/Tablet','External HDD/SSD/USB','Other IT Equipment'];
  const items = document.getElementById('boItems');
  items.innerHTML = ASSET_TYPES.map((a, i) => `<label><input type="checkbox" name="bo_item${i}"><span>${a}</span> <span class="tag" data-bo-tag="${i}"></span></label>`).join('');
  function refreshTags(){
    ASSET_TYPES.forEach((a, i) => {
      const tag = (document.querySelector(`[name=a${i}_tag]`)||{}).value || '';
      const sn = (document.querySelector(`[name=a${i}_sn]`)||{}).value || '';
      const t = items.querySelector(`[data-bo-tag="${i}"]`); if (t) t.textContent = [tag, sn].filter(Boolean).join(' · ');
    });
  }
  document.getElementById('assets').addEventListener('input', refreshTags);

  // Show/hide the detail block; keep print state in sync
  const enabled = document.getElementById('boEnabled'), body = document.getElementById('boBody');
  function sync(){ body.hidden = !enabled.checked; sec.classList.toggle('bo-off', !enabled.checked); refreshTags(); }
  enabled.addEventListener('change', sync);
  // fill()/newForm() set values programmatically without events — observe the checkbox
  const form = document.getElementById('form');
  form.addEventListener('input', () => { if (body.hidden === enabled.checked) sync(); });
  setInterval(() => { if (body.hidden === enabled.checked) sync(); else refreshTags(); }, 300);

  // ---- Payment status (is the buyout already paid?) ----
  const num = v => { const n = parseFloat(String(v ?? '').replace(/[^0-9.]/g, '')); return isFinite(n) ? n : 0; };
  const money = n => n.toLocaleString('en-PH', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  function payInfo(o){
    if (!o.bo_enabled) return null;
    const amount = num(o.bo_amount), paid = num(o.bo_amount_paid);
    let status = o.bo_pay_status || '';
    if (!status) status = amount > 0 && paid >= amount ? 'Fully paid' : paid > 0 ? 'Partially paid' : 'Unpaid';
    const cls = status === 'Fully paid' ? 'paid' : status === 'Partially paid' ? 'partial' : 'unpaid';
    const balance = Math.max(0, amount - (status === 'Fully paid' ? amount : paid));
    return { status, cls, amount, paid: status === 'Fully paid' ? amount : paid, balance, label: status === 'Fully paid' ? 'PAID' : status === 'Partially paid' ? 'PARTIALLY PAID' : 'UNPAID' };
  }
  window.itatBuyoutPayInfo = payInfo;
  const badge = document.getElementById('boBadge'), balEl = document.getElementById('boBalance'), payStatusEl = document.getElementById('boPayStatus');
  function refreshPay(){
    const o = collect(); const p = payInfo(o);
    if (!p) { badge.hidden = true; balEl.textContent = '—'; return; }
    badge.hidden = false; badge.className = 'bo-badge ' + p.cls; badge.textContent = p.label + (p.cls === 'paid' && o.bo_paid_date ? ' · ' + o.bo_paid_date : '');
    balEl.textContent = p.amount ? 'PHP ' + money(p.balance) : '—';
    balEl.style.color = p.balance > 0 ? '#B3261E' : '#2A7A4B';
  }
  payStatusEl.addEventListener('change', () => {
    const o = collect(); const paidEl = document.querySelector('[name=bo_amount_paid]'), dateEl = document.querySelector('[name=bo_paid_date]');
    if (payStatusEl.value === 'Fully paid') { if (o.bo_amount) paidEl.value = o.bo_amount; if (!dateEl.value) dateEl.value = o.bo_date || new Date().toISOString().slice(0,10); }
    if (payStatusEl.value === 'Unpaid') { paidEl.value = ''; dateEl.value = ''; }
    form.dispatchEvent(new Event('input', { bubbles: true }));
  });
  form.addEventListener('input', refreshPay);
  setInterval(refreshPay, 600);

  // Records list: show the buyout payment status under the Draft/Signed pill, plus a filter
  const recRows = document.getElementById('recRows');
  const qReason = document.getElementById('qReason');
  let qPay = null;
  if (qReason) {
    qPay = document.createElement('select'); qPay.id = 'qPay'; qPay.setAttribute('aria-label', 'Filter by buyout payment');
    qPay.innerHTML = '<option value="">All records</option><option value="any">With buyout</option><option value="unpaid">Buyout unpaid / partial</option><option value="paid">Buyout paid</option>';
    qReason.insertAdjacentElement('afterend', qPay);
    qPay.addEventListener('change', decorateRecords);
  }
  function decorateRecords(){
    if (!recRows || typeof store === 'undefined') return;
    recRows.querySelectorAll('tr[data-id]').forEach(tr => {
      const r = store.records.get(tr.dataset.id); const p = r ? payInfo(r) : null;
      let el = tr.querySelector('.rec-pay');
      if (p) { if (!el) { el = document.createElement('span'); el.className = 'rec-pay'; const pill = tr.querySelector('.status-pill'); (pill || tr.firstElementChild).insertAdjacentElement(pill ? 'afterend' : 'beforeend', el); } el.className = 'rec-pay ' + p.cls; el.textContent = 'Buyout: ' + p.label + (p.balance > 0 ? ' · bal ' + money(p.balance) : ''); }
      else if (el) el.remove();
      const f = qPay ? qPay.value : '';
      tr.hidden = f === 'any' ? !p : f === 'unpaid' ? !(p && p.cls !== 'paid') : f === 'paid' ? !(p && p.cls === 'paid') : false;
    });
  }
  if (recRows) new MutationObserver(() => { if (!recRows.dataset.busy) { recRows.dataset.busy = '1'; decorateRecords(); delete recRows.dataset.busy; } }).observe(recRows, { childList: true });

  // Section 6: extra asset status
  const statusChecks = document.querySelector('.status .checks');
  if (statusChecks && !document.querySelector('[name=s_sold]')) {
    const l = document.createElement('label'); l.className = 'ck';
    l.innerHTML = '<input type="checkbox" name="s_sold"><span>Sold to employee (buyout)</span>';
    const other = statusChecks.querySelector('[name=s_other]');
    statusChecks.insertBefore(l, other ? other.closest('label') : null);
  }
  // Supporting Documents: proof-of-payment document type
  const attType = document.getElementById('attType');
  if (attType && ![...attType.options].some(o => /Official Receipt/i.test(o.text))) {
    const o = document.createElement('option'); o.textContent = 'Proof of payment / Official Receipt (buyout)';
    attType.insertBefore(o, attType.options[attType.options.length - 1]);
  }
  sync();

  /* ===================== Generated document: IT Asset Buyout Form ===================== */
  const E = (typeof esc === 'function') ? esc : (s => String(s ?? '').replace(/[&<>"]/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c])));
  function amountWords(v){
    const n = Math.round(parseFloat(String(v).replace(/[^0-9.]/g, '')) * 100); if (!isFinite(n) || n < 0) return '';
    const ones = ['','One','Two','Three','Four','Five','Six','Seven','Eight','Nine','Ten','Eleven','Twelve','Thirteen','Fourteen','Fifteen','Sixteen','Seventeen','Eighteen','Nineteen'];
    const tens = ['','','Twenty','Thirty','Forty','Fifty','Sixty','Seventy','Eighty','Ninety'];
    const chunk = x => (x >= 100 ? ones[Math.floor(x/100)] + ' Hundred' + (x%100 ? ' ' : '') : '') + (x%100 < 20 ? ones[x%100] : tens[Math.floor((x%100)/10)] + (x%10 ? '-' + ones[x%10] : ''));
    const words = x => { if (x === 0) return 'Zero'; const parts = []; const sc = [[1e9,'Billion'],[1e6,'Million'],[1e3,'Thousand'],[1,'']]; for (const [d, name] of sc) { const q = Math.floor(x/d); if (q) { parts.push(chunk(q) + (name ? ' ' + name : '')); x %= d; } } return parts.join(' '); };
    const pesos = Math.floor(n/100), cents = n%100;
    return words(pesos) + ' Peso' + (pesos === 1 ? '' : 's') + (cents ? ' and ' + String(cents).padStart(2,'0') + '/100' : ' Only');
  }
  const B = (v, n) => v ? E(v) : '&nbsp;'.repeat(n);
  const fmtDate = d => { if (!d) return ''; const x = new Date(d + (String(d).length === 10 ? 'T00:00:00' : '')); return isNaN(x) ? d : x.toLocaleDateString('en-PH', { year:'numeric', month:'long', day:'numeric' }); };
  const fmtAmt = v => { const n = parseFloat(String(v).replace(/[^0-9.]/g, '')); return isFinite(n) ? n.toLocaleString('en-PH', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : (v || ''); };
  function reasonText(o){ const m = { r_resign:'Resignation', r_term:'End of contract / Termination', r_transfer:'Transfer', r_reassign:'Reassignment', r_replace:'Replacement / Upgrade' }; const r = Object.keys(m).filter(k => o[k]).map(k => m[k]); if (o.r_other) r.push(o.r_other_txt || 'Other'); return r.join(', '); }

  function buildBuyoutDoc(){
    const o = collect();
    const co = companyName(o), abbr = (document.querySelector('#company option:checked')||{}).dataset?.abbr || '';
    const logo = (typeof LOGOS !== 'undefined' && LOGOS[o.company]) || '';
    const ref = (o.ctrl_no || '').trim() ? o.ctrl_no.trim() + '-BO' : (abbr ? abbr + '-BO-' + new Date().toISOString().slice(0,10).replace(/-/g,'') : '');
    const items = ASSET_TYPES.map((t, i) => o['bo_item' + i] ? { n: i + 1, type: t, tag: o['a'+i+'_tag'], sn: o['a'+i+'_sn'], desc: o['a'+i+'_desc'], cond: o['a'+i+'_good'] ? 'Good' : o['a'+i+'_dmg'] ? 'Damaged' : '', rem: o['a'+i+'_rem'] } : null).filter(Boolean);
    const rows = (items.length ? items : [{}]).map((it, k) => `<tr><td class="c">${it.n ? k + 1 : ''}</td><td>${E(it.type||'')}</td><td class="m">${E(it.tag||'')}</td><td class="m">${E(it.sn||'')}</td><td>${E(it.desc||'')}</td><td class="c">${E(it.cond||'')}</td><td>${E(it.rem||'')}</td></tr>`).join('')
      + Array.from({ length: Math.max(0, 4 - items.length) }, () => '<tr><td class="c">&nbsp;</td><td></td><td></td><td></td><td></td><td></td><td></td></tr>').join('');
    const amt = fmtAmt(o.bo_amount), words = amountWords(o.bo_amount);
    const today = fmtDate(new Date().toISOString().slice(0,10));
    const pay = payInfo(o);
    const sig = name => { const u = (typeof window.itatSignatureFor === 'function') ? window.itatSignatureFor(name) : ''; return u ? `<img class="sig" src="${u}" alt="">` : ''; };
    return `<!DOCTYPE html><html lang="en"><head><meta charset="utf-8"><title>IT Asset Buyout Form ${E(ref)}</title>
<style>
@page{size:A4;margin:14mm 14mm 16mm}
*{box-sizing:border-box}body{font-family:Arial,Helvetica,sans-serif;font-size:11.5px;color:#111;margin:0;padding:24px;background:#eee}
.sheet{background:#fff;max-width:800px;margin:0 auto;padding:28px 32px;box-shadow:0 2px 12px rgba(0,0,0,.15)}
.hdr{display:flex;align-items:center;gap:16px;border-bottom:2px solid #111;padding-bottom:10px;margin-bottom:12px}
.hdr img{height:54px;max-width:170px;object-fit:contain}.hdr .co{font-size:15px;font-weight:700;letter-spacing:.02em}.hdr .sub{font-size:10.5px;color:#444}
.hdr .ref{margin-left:auto;text-align:right;font-size:10.5px;line-height:1.5}.hdr .ref b{font-family:Consolas,monospace;font-size:12px}
h1{font-size:16px;text-align:center;letter-spacing:.06em;margin:4px 0 2px}.tagline{text-align:center;font-size:10.5px;color:#444;margin-bottom:12px}
h2{font-size:11px;letter-spacing:.08em;text-transform:uppercase;background:#f0f0f0;border-left:4px solid #111;padding:4px 8px;margin:14px 0 6px}
.grid{display:grid;grid-template-columns:repeat(4,1fr);gap:6px 14px}.grid .f{border-bottom:1px solid #999;padding:2px 0 3px;min-height:26px}.grid .f.w2{grid-column:span 2}
.lbl{display:block;font-size:9px;text-transform:uppercase;letter-spacing:.05em;color:#555}.val{font-size:11.5px;min-height:14px}
table{width:100%;border-collapse:collapse;margin-top:4px}th,td{border:1px solid #333;padding:4px 5px;vertical-align:top;font-size:10.5px}th{background:#f0f0f0;font-size:9.5px;text-transform:uppercase;letter-spacing:.04em}td.c{text-align:center}td.m{font-family:Consolas,monospace}
.pay{display:grid;grid-template-columns:1fr 1fr;gap:6px 18px}.amt{grid-column:span 2;display:flex;gap:12px;align-items:baseline;border:1px solid #333;padding:8px 10px;margin-bottom:4px}.amt .num{font-size:16px;font-weight:700;font-family:Consolas,monospace}.amt .wds{font-style:italic}
ol{margin:4px 0 0 18px;padding:0;font-size:10.5px;line-height:1.45}ol li{margin-bottom:3px}
.signs{display:grid;grid-template-columns:1fr 1fr;gap:22px 28px;margin-top:10px}.sg{padding-top:34px;position:relative}.sg img.sig{position:absolute;left:6px;bottom:44px;height:46px;max-width:70%;object-fit:contain;object-position:left bottom}.sg .line{border-top:1px solid #111;padding-top:3px;font-weight:700;font-size:11px}.sg .role{font-size:9.5px;color:#444}.sg .dt{font-size:9.5px;color:#444;margin-top:8px}.sg .dt span{display:inline-block;min-width:110px;border-bottom:1px solid #111;margin-left:4px;text-align:center;font-weight:600;color:#111}
.stub{margin-top:18px;border:1px dashed #333;padding:10px 12px}.stub .t{font-size:11px;font-weight:700;letter-spacing:.06em;text-transform:uppercase;margin-bottom:6px}.stub p{margin:0 0 6px;line-height:1.7}.stub u{text-decoration:none;border-bottom:1px solid #111;padding:0 8px;font-weight:600}
.sheet{position:relative}.stamp{position:absolute;right:32px;top:110px;transform:rotate(-8deg);border:3px solid;border-radius:6px;padding:4px 14px;font-weight:800;font-size:20px;letter-spacing:.12em;text-align:center;opacity:.85;-webkit-print-color-adjust:exact;print-color-adjust:exact}.stamp small{display:block;font-size:9px;letter-spacing:.04em;font-weight:600}.stamp.paid{color:#2A7A4B;border-color:#2A7A4B}.stamp.partial{color:#9A5B00;border-color:#C98A1B}.stamp.unpaid{color:#B3261E;border-color:#B3261E}
.foot{margin-top:14px;font-size:9px;color:#666;display:flex;justify-content:space-between;border-top:1px solid #ccc;padding-top:4px}
.bar{max-width:800px;margin:0 auto 12px;display:flex;gap:8px;justify-content:flex-end}.bar button{border:1px solid #333;background:#fff;padding:7px 14px;border-radius:4px;cursor:pointer;font-size:12px}.bar button.p{background:#111;color:#fff}
@media print{body{background:#fff;padding:0}.sheet{box-shadow:none;padding:0;max-width:none}.bar{display:none}.stub{break-inside:avoid}.signs{break-inside:avoid}}
</style></head><body>
<div class="bar"><button onclick="window.close()">Close</button><button class="p" onclick="window.print()">Print / Save as PDF</button></div>
<div class="sheet">
  <div class="hdr">${logo ? `<img src="${logo}" alt="">` : ''}<div><div class="co">${E(co)}</div><div class="sub">Information Technology Department</div></div>
    <div class="ref">Buyout Ref. No.: <b>${E(ref)}</b><br>Turnover Control No.: <b>${E(o.ctrl_no||'')}</b><br>Date generated: ${E(today)}</div></div>
  ${pay ? `<div class="stamp ${pay.cls}">${pay.label}${pay.cls === 'paid' && o.bo_paid_date ? '<small>' + E(fmtDate(o.bo_paid_date)) + '</small>' : pay.balance > 0 ? '<small>Balance PHP ' + E(money(pay.balance)) + '</small>' : ''}</div>` : ''}
  <h1>IT ASSET BUYOUT FORM</h1>
  <div class="tagline">Deed of Sale of Company IT Asset to Employee &middot; Proof of Purchase</div>

  <h2>1. Buyer (Employee) Information</h2>
  <div class="grid">
    <div class="f w2"><span class="lbl">Employee name</span><div class="val">${E(o.emp_name||'')}</div></div>
    <div class="f"><span class="lbl">Employee ID</span><div class="val">${E(o.emp_id||'')}</div></div>
    <div class="f"><span class="lbl">Date of turnover</span><div class="val">${E(fmtDate(o.emp_date))}</div></div>
    <div class="f"><span class="lbl">Department</span><div class="val">${E(o.emp_dept||'')}</div></div>
    <div class="f"><span class="lbl">Position</span><div class="val">${E(o.emp_pos||'')}</div></div>
    <div class="f"><span class="lbl">Immediate supervisor</span><div class="val">${E(o.emp_sup||'')}</div></div>
    <div class="f"><span class="lbl">Reason for turnover</span><div class="val">${E(reasonText(o))}</div></div>
  </div>

  <h2>2. IT Asset(s) Sold</h2>
  <table><thead><tr><th style="width:26px">#</th><th style="width:120px">Item</th><th style="width:95px">Asset Tag</th><th style="width:110px">Serial No.</th><th>Description / Model</th><th style="width:64px">Condition</th><th style="width:120px">Remarks</th></tr></thead><tbody>${rows}</tbody></table>

  <h2>3. Sale &amp; Payment Details</h2>
  <div class="pay">
    <div class="amt"><span class="lbl" style="display:inline">Total buyout price</span><span class="num">PHP ${E(amt)}</span><span class="wds">${E(words)}</span></div>
    <div class="f" style="border-bottom:1px solid #999;padding:2px 0"><span class="lbl">Basis of valuation</span><div class="val">${E(o.bo_basis||'')}</div></div>
    <div class="f" style="border-bottom:1px solid #999;padding:2px 0"><span class="lbl">Payment method</span><div class="val">${E(o.bo_method||'')}</div></div>
    <div class="f" style="border-bottom:1px solid #999;padding:2px 0"><span class="lbl">OR / AR No.</span><div class="val" style="font-family:Consolas,monospace">${E(o.bo_or_no||'')}</div></div>
    <div class="f" style="border-bottom:1px solid #999;padding:2px 0"><span class="lbl">Date paid</span><div class="val">${E(fmtDate(o.bo_date))}</div></div>
    <div class="f" style="border-bottom:1px solid #999;padding:2px 0"><span class="lbl">Payment status</span><div class="val">${pay ? E(pay.status) + (pay.cls === 'paid' && o.bo_paid_date ? ' (' + E(fmtDate(o.bo_paid_date)) + ')' : '') : ''}</div></div>
    <div class="f" style="border-bottom:1px solid #999;padding:2px 0"><span class="lbl">Amount paid / Balance</span><div class="val">${pay && pay.amount ? 'PHP ' + E(money(pay.paid)) + ' / balance PHP ' + E(money(pay.balance)) : ''}</div></div>
    <div class="f" style="border-bottom:1px solid #999;padding:2px 0;grid-column:span 2"><span class="lbl">Remarks / inclusions</span><div class="val">${E(o.bo_remarks||'')}</div></div>
  </div>

  <h2>4. Terms and Conditions of Sale</h2>
  <ol>
    <li><b>${E(co)}</b> (the "Company") sells, transfers and conveys to the employee named above (the "Buyer") the IT asset(s) listed in Section 2 for the total price stated in Section 3.</li>
    <li>The asset(s) are sold on an <b>"as-is, where-is"</b> basis. The Company gives no warranty as to condition, fitness for purpose, remaining useful life, or manufacturer warranty coverage.</li>
    <li>All company data, files, e-mail/account profiles, and licensed software (including operating system volume licenses and Microsoft 365) have been removed, transferred or deactivated before release. Software licenses are <b>not</b> transferred with the asset unless expressly stated in the remarks.</li>
    <li>Ownership and risk pass to the Buyer upon full payment and release of the asset(s). The asset(s) are thereafter removed from the Company's fixed-asset register and IT asset inventory.</li>
    <li>Where payment is by salary deduction or deduction from final pay, the Buyer authorizes the Company to deduct the amount stated in Section 3 from the Buyer's compensation in accordance with company policy and applicable law.</li>
    <li>This form, together with the Official/Acknowledgment Receipt referenced in Section 3, serves as the Buyer's <b>proof of purchase</b>.</li>
  </ol>

  <h2>5. Acknowledgment and Approval</h2>
  <div class="signs">
    <div class="sg"><div class="line">${E(o.bo_buyer_name||o.emp_name||'')}</div><div class="role">Buyer (Employee) &mdash; I have read and accept the terms above and acknowledge receipt of the asset(s)</div><div class="dt">Date:<span>${E(fmtDate(o.bo_buyer_date))}</span></div></div>
    <div class="sg">${sig(o.sg2_name)}<div class="line">${E(o.sg2_name||'')}</div><div class="role">Released by &mdash; IT Department</div><div class="dt">Date:<span>${E(fmtDate(o.sg2_date))}</span></div></div>
    <div class="sg"><div class="line">${E(o.bo_rcvd_name||'')}</div><div class="role">Payment received by &mdash; Finance / Cashier</div><div class="dt">Date:<span>${E(fmtDate(o.bo_rcvd_date))}</span></div></div>
    <div class="sg"><div class="line">${E(o.bo_approved_by||'')}</div><div class="role">Approved by &mdash; Management / Finance</div><div class="dt">Date:<span></span></div></div>
  </div>

  <div class="stub">
    <div class="t">Acknowledgment Receipt</div>
    <p>Received from <u>${B(o.emp_name,30)}</u> the amount of <u>PHP ${B(amt,12)}</u> (<u>${B(words,40)}</u>) as full payment for the IT asset(s) listed above under Buyout Ref. No. <u>${E(ref)}</u>.</p>
    <p>OR / AR No. <u>${B(o.bo_or_no,16)}</u> &nbsp; Date <u>${B(fmtDate(o.bo_date),16)}</u> &nbsp; Received by <u>${B(o.bo_rcvd_name,30)}</u> (signature over printed name)</p>
  </div>
  <div class="foot"><span>${E(co)} &middot; IT Asset Buyout Form</span><span>${E(ref)} &middot; Generated ${E(today)}</span></div>
</div>
<script>window.addEventListener('load',()=>{ setTimeout(()=>{ try{ window.print(); }catch(e){} }, 400); });<\/script>
</body></html>`;
  }
  document.getElementById('btnBuyoutForm').addEventListener('click', () => {
    const w = window.open('', '_blank');
    if (!w) { alert('Pop-up blocked — please allow pop-ups for this site to generate the buyout form.'); return; }
    w.document.open(); w.document.write(buildBuyoutDoc()); w.document.close();
  });
})();

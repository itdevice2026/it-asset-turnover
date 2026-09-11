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
  @media(max-width:700px){.bo-grid{grid-template-columns:1fr 1fr}.bo-signs{grid-template-columns:1fr}}
  @media print{
    .bo-body{background:#fff;border-color:#000}
    .bo-terms{color:#000;border-left-color:#000;background:#fff}
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
    <h2>7. Asset Buyout / Proof of Purchase</h2>
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
})();

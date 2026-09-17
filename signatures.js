/* IT Asset Turnover — Signature library. A signature image is linked to a signatory's name; whenever that name is typed
   in the Received/Verified by (IT) or Noted by (Supervisor) field, the stored signature appears above the name (on screen, in print and in the
   generated Buyout Form). Works with the online form (Supabase table itat_signatures) and the offline form (localStorage). */
(function(){
  const css = document.createElement('style');
  css.textContent = `
  .sig-wrap{position:relative}
  .sig-wrap.sig-on{padding-top:34px}
  .sig-img{position:absolute;left:6px;bottom:20px;height:58px;max-width:75%;object-fit:contain;object-position:left bottom;pointer-events:none;z-index:1}
  .sig-wrap.sig-on input{position:relative;z-index:2;background:transparent!important}
  .sm{position:fixed;inset:0;background:rgba(22,32,42,.45);display:flex;align-items:flex-start;justify-content:center;padding:40px 16px;z-index:200;overflow:auto}
  .sm[hidden]{display:none}
  .sm .box{background:var(--paper);border:1px solid var(--line);border-radius:10px;width:820px;max-width:100%;box-shadow:0 16px 48px rgba(22,32,42,.25);display:grid;gap:14px;padding:22px 24px}
  .sm h2{font-family:var(--head);font-size:16px;margin:0;background:none;border:0;padding:0;display:flex;justify-content:space-between;align-items:center}
  .sm h2 button{border:0;background:none;font-size:20px;cursor:pointer;color:var(--muted)}
  .sm .sub{color:var(--muted);font-size:12.5px;margin-top:-8px}
  .sm table{width:100%;border-collapse:collapse;font-size:12.5px}
  .sm th{font-family:var(--head);font-size:11px;letter-spacing:.06em;text-transform:uppercase;color:var(--muted);text-align:left;padding:6px;border-bottom:1px solid var(--line)}
  .sm td{padding:7px 6px;border-bottom:1px solid var(--line-soft);vertical-align:middle}
  .sm td img{height:44px;max-width:220px;object-fit:contain;background:#fff;border:1px dashed var(--line);padding:2px 6px}
  .sm .acts button{border:1px solid var(--line);background:var(--paper);border-radius:4px;padding:3px 8px;cursor:pointer;font-size:12px}
  .sm .acts button:hover{border-color:var(--crit);color:var(--crit)}
  .sm form{display:grid;grid-template-columns:1.3fr 1.3fr auto auto;gap:8px;align-items:end;border-top:1px solid var(--line);padding-top:14px}
  .sm form label{display:grid;gap:4px;font-size:12px;color:var(--muted)}
  .sm form input[type=text]{border:1px solid var(--line);border-radius:6px;padding:7px 9px;background:var(--paper);font-size:13px}
  .sm form input[type=file]{font-size:12px}
  .sm form .chk{display:flex;align-items:center;gap:6px;font-size:12px;color:var(--muted);white-space:nowrap;padding-bottom:8px}
  .sm .preview{display:flex;align-items:center;gap:12px;font-size:12px;color:var(--muted);min-height:56px}
  .sm .preview img{height:52px;max-width:260px;object-fit:contain;background:#fff;border:1px dashed var(--line);padding:2px 6px}
  .sm .msg{font-size:12.5px;min-height:16px;color:var(--muted)} .sm .msg.err{color:var(--crit)}
  .sm .hint{font-size:11.5px;color:var(--faint)}
  @media(max-width:700px){.sm form{grid-template-columns:1fr 1fr}}
  @media print{.sig-wrap.sig-on{padding-top:30px}.sig-img{bottom:16px;height:54px}.sm{display:none!important}}`;
  document.head.appendChild(css);

  const norm = s => String(s || '').toUpperCase().replace(/[.,]/g, ' ').replace(/[^A-Z0-9Ñ ]/g, '').replace(/\s+/g, ' ').trim();
  const online = typeof sb !== 'undefined' && sb && sb.from;
  const LS_KEY = 'itat_signatures';
  let sigs = []; // [{name, name_key, data_url}]
  // Built-in signatures (used when the library has no entry for the same name)
  const SEED = [
    { name: 'NOMER LANDEZA STA ANA', name_key: 'NOMER LANDEZA STA ANA', data_url: 'data:image/png;base64,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' }
  ];
  const withSeed = list => list.concat(SEED.filter(x => !list.some(y => y.name_key === x.name_key)));

  /* ---------- storage ---------- */
  async function load(){
    if (online) {
      const { data, error } = await sb.from('itat_signatures').select('name,name_key,data_url').order('name');
      if (error) throw new Error(error.message);
      sigs = withSeed(data || []);
    } else {
      try { sigs = withSeed(JSON.parse(localStorage.getItem(LS_KEY) || '[]')); } catch (e) { sigs = withSeed([]); }
    }
    applyAll();
  }
  async function save(name, data_url){
    const name_key = norm(name);
    if (!name_key) throw new Error('Enter the signatory\'s name.');
    if (online) {
      const { error } = await sb.from('itat_signatures').upsert({ name: name.trim(), name_key, data_url, updated_at: new Date().toISOString() }, { onConflict: 'name_key' });
      if (error) throw new Error(error.message);
    } else {
      sigs = sigs.filter(s => s.name_key !== name_key); sigs.push({ name: name.trim(), name_key, data_url });
      localStorage.setItem(LS_KEY, JSON.stringify(sigs.filter(x => !SEED.includes(x))));
    }
    await load();
  }
  async function remove(name_key){
    if (online) { const { error } = await sb.from('itat_signatures').delete().eq('name_key', name_key); if (error) throw new Error(error.message); }
    else { sigs = sigs.filter(s => s.name_key !== name_key); localStorage.setItem(LS_KEY, JSON.stringify(sigs.filter(x => !SEED.includes(x)))); }
    await load();
  }
  function find(name){ const k = norm(name); return k ? sigs.find(s => s.name_key === k) : null; }

  /* ---------- image processing: resize, optional white background → transparent ---------- */
  function processImage(file, transparent){
    return new Promise((res, rej) => {
      const img = new Image();
      img.onload = () => {
        const maxW = 600, maxH = 220; let w = img.width, h = img.height; const r = Math.min(1, maxW / w, maxH / h); w = Math.round(w * r); h = Math.round(h * r);
        const cv = document.createElement('canvas'); cv.width = w; cv.height = h; const cx = cv.getContext('2d'); cx.drawImage(img, 0, 0, w, h);
        if (transparent) {
          const id = cx.getImageData(0, 0, w, h), d = id.data;
          for (let i = 0; i < d.length; i += 4) {
            const lum = (d[i] + d[i+1] + d[i+2]) / 3;
            if (lum > 235) d[i+3] = 0; else if (lum > 170) d[i+3] = Math.round(d[i+3] * (235 - lum) / 65);
          }
          cx.putImageData(id, 0, 0);
        }
        res(cv.toDataURL('image/png'));
      };
      img.onerror = () => rej(new Error('Could not read the image file.'));
      img.src = URL.createObjectURL(file);
    });
  }

  /* ---------- apply signatures to name fields ---------- */
  const NAME_FIELDS = ['sg2_name','sg3_name']; // Received/Verified by (IT) and Noted by (Supervisor) only — never the employee
  function applyTo(input){
    const wrap = input.parentElement; if (!wrap) return;
    wrap.classList.add('sig-wrap');
    let img = wrap.querySelector('.sig-img');
    const s = find(input.value);
    if (s) { if (!img) { img = document.createElement('img'); img.className = 'sig-img'; img.alt = ''; wrap.insertBefore(img, input); } if (img.src !== s.data_url) img.src = s.data_url; wrap.classList.add('sig-on'); }
    else { if (img) img.remove(); wrap.classList.remove('sig-on'); }
  }
  function applyAll(){ NAME_FIELDS.forEach(n => document.querySelectorAll(`[name=${n}]`).forEach(applyTo)); }
  const form = document.getElementById('form');
  form.addEventListener('input', e => { if (e.target && NAME_FIELDS.includes(e.target.name)) applyTo(e.target); });
  setInterval(applyAll, 500); // fill()/newForm() set values without events
  window.itatSignatureFor = name => (find(name) || {}).data_url || ''; // used by the generated Buyout Form

  /* ---------- modal ---------- */
  const modal = document.createElement('div'); modal.className = 'sm'; modal.hidden = true;
  modal.innerHTML = `
    <div class="box" role="dialog" aria-label="Signatures">
      <h2>Signatures <button type="button" id="smClose" aria-label="Close">×</button></h2>
      <div class="sub">Link a signature image to a signatory's name. When that exact name is typed in the <b>Received / Verified by</b> (IT Department) or <b>Noted by</b> (Immediate Supervisor / Department Head) field of the sign-off section, the signature appears above the name automatically — on screen, in print and in the generated Buyout Form.</div>
      <div class="tablewrap"><table>
        <thead><tr><th>Name</th><th>Signature</th><th></th></tr></thead>
        <tbody id="smRows"><tr><td colspan="3" style="color:var(--muted);text-align:center;padding:16px">Loading…</td></tr></tbody>
      </table></div>
      <form id="smForm" autocomplete="off">
        <label>Signatory name (as it will be typed) <input id="smName" type="text" required placeholder="JUAN DELA CRUZ"></label>
        <label>Signature image (PNG/JPG) <input id="smFile" type="file" accept="image/*" required></label>
        <label class="chk"><input id="smTrans" type="checkbox" checked> Make white background transparent</label>
        <button class="btn primary" type="submit" id="smAdd">Save signature</button>
      </form>
      <div class="preview" id="smPreview">Preview appears here after choosing an image.</div>
      <div class="hint">Tip: sign in black ink on white paper, photograph or scan it, and crop close to the signature. Matching ignores letter case, extra spaces and punctuation (e.g. "Nomer L. Sta. Ana" = "NOMER L STA ANA").</div>
      <div class="msg" id="smMsg"></div>
    </div>`;
  document.body.appendChild(modal);
  const $ = s => modal.querySelector(s);
  const E = (typeof esc === 'function') ? esc : (s => String(s ?? '').replace(/[&<>"]/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c])));
  const msg = (t, err) => { const m = $('#smMsg'); m.textContent = t || ''; m.classList.toggle('err', !!err); };
  function render(){
    $('#smRows').innerHTML = sigs.length ? sigs.map(s => `<tr data-key="${E(s.name_key)}"><td><b>${E(s.name)}</b></td><td><img src="${s.data_url}" alt=""></td><td class="acts"><button type="button" data-use>Use in form</button> <button type="button" data-remove>Remove</button></td></tr>`).join('')
      : '<tr><td colspan="3" style="color:var(--muted);text-align:center;padding:16px">No signatures saved yet.</td></tr>';
    $('#smRows').querySelectorAll('[data-remove]').forEach(b => b.onclick = async () => {
      const key = b.closest('tr').dataset.key;
      if (b.dataset.armed !== '1') { b.dataset.armed = '1'; b.textContent = 'Confirm remove'; setTimeout(() => { b.dataset.armed = ''; b.textContent = 'Remove'; }, 4000); return; }
      try { await remove(key); render(); msg('Signature removed.'); } catch (e) { msg(e.message, true); }
    });
    $('#smRows').querySelectorAll('[data-use]').forEach(b => b.onclick = () => {
      const key = b.closest('tr').dataset.key; const s = sigs.find(x => x.name_key === key);
      const target = [...document.querySelectorAll('[name=sg2_name],[name=sg3_name]')].find(i => !i.value.trim()) || document.querySelector('[name=sg2_name]');
      target.value = s.name; target.dispatchEvent(new Event('input', { bubbles: true })); modal.hidden = true; target.focus();
    });
  }
  let pending = '';
  async function preview(){
    const f = $('#smFile').files[0]; if (!f) { pending = ''; $('#smPreview').textContent = 'Preview appears here after choosing an image.'; return; }
    try { pending = await processImage(f, $('#smTrans').checked); $('#smPreview').innerHTML = `<img src="${pending}" alt=""><span>${Math.round(pending.length * 0.75 / 1024)} KB · this is how it will print</span>`; }
    catch (e) { pending = ''; msg(e.message, true); }
  }
  $('#smFile').addEventListener('change', preview); $('#smTrans').addEventListener('change', preview);
  $('#smForm').addEventListener('submit', async e => {
    e.preventDefault(); if (!pending) { msg('Choose a signature image first.', true); return; }
    const btn = $('#smAdd'); btn.disabled = true; btn.textContent = 'Saving…'; msg('');
    try { await save($('#smName').value, pending); render(); msg('Signature saved and linked to ' + $('#smName').value.trim().toUpperCase() + '.'); $('#smForm').reset(); pending = ''; $('#smPreview').textContent = 'Preview appears here after choosing an image.'; }
    catch (err) { msg(err.message, true); }
    btn.disabled = false; btn.textContent = 'Save signature';
  });
  $('#smClose').onclick = () => { modal.hidden = true; };
  modal.addEventListener('click', e => { if (e.target === modal) modal.hidden = true; });
  document.addEventListener('keydown', e => { if (e.key === 'Escape' && !modal.hidden) modal.hidden = true; });

  // Toolbar button (next to "IT users" / Data menu)
  const btn = document.createElement('button'); btn.className = 'btn'; btn.id = 'btnSignatures'; btn.textContent = 'Signatures';
  btn.onclick = async () => { modal.hidden = false; msg(''); try { await load(); render(); } catch (e) { $('#smRows').innerHTML = `<tr><td colspan="3" style="color:var(--crit);padding:12px">${E(e.message)}</td></tr>`; } };
  const menu = document.querySelector('.toolbar .menu'); menu.parentNode.insertBefore(btn, menu);

  if (online) {
    btn.hidden = true;
    const origStart = start; start = async function (session) { await origStart(session); btn.hidden = false; load().catch(() => {}); };
    const origStop = stop; stop = function () { origStop(); btn.hidden = true; modal.hidden = true; sigs = []; applyAll(); };
    if (typeof currentUser !== 'undefined' && currentUser) { btn.hidden = false; load().catch(() => {}); }
  } else {
    load().catch(() => {});
  }
})();

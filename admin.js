/* IT Asset Turnover — IT user management (admins only). Loaded after the main script. */
(function(){
  const css = document.createElement('style');
  css.textContent = `
  .um{position:fixed;inset:0;background:rgba(22,32,42,.45);display:flex;align-items:flex-start;justify-content:center;padding:40px 16px;z-index:200;overflow:auto}
  .um[hidden]{display:none}
  .um .box{background:var(--paper);border:1px solid var(--line);border-radius:10px;width:760px;max-width:100%;box-shadow:0 16px 48px rgba(22,32,42,.25);display:grid;gap:14px;padding:22px 24px}
  .um h2{font-family:var(--head);font-size:16px;margin:0;background:none;border:0;padding:0;display:flex;justify-content:space-between;align-items:center}
  .um h2 button{border:0;background:none;font-size:20px;cursor:pointer;color:var(--muted)}
  .um .sub{color:var(--muted);font-size:12.5px;margin-top:-8px}
  .um table{width:100%;border-collapse:collapse;font-size:12.5px}
  .um th{font-family:var(--head);font-size:11px;letter-spacing:.06em;text-transform:uppercase;color:var(--muted);text-align:left;padding:6px;border-bottom:1px solid var(--line)}
  .um td{padding:7px 6px;border-bottom:1px solid var(--line-soft);vertical-align:middle}
  .um td select{border:1px solid var(--line);border-radius:4px;padding:3px 6px;background:var(--paper)}
  .um .acts{display:flex;gap:4px;white-space:nowrap}
  .um .acts button{border:1px solid var(--line);background:var(--paper);border-radius:4px;padding:3px 8px;cursor:pointer;font-size:12px}
  .um .acts button:hover{border-color:var(--accent);color:var(--accent)}
  .um .acts button.del:hover{border-color:var(--crit);color:var(--crit)}
  .um .pill{display:inline-block;font-family:var(--head);font-size:10px;letter-spacing:.05em;text-transform:uppercase;border-radius:999px;padding:1px 8px}
  .um .pill.ok{background:#DFF1E5;color:#2A7A4B} .um .pill.no{background:var(--sunken);color:var(--muted)}
  .um form{display:grid;grid-template-columns:1.4fr 1.2fr .7fr 1fr auto;gap:8px;align-items:end;border-top:1px solid var(--line);padding-top:14px}
  .um form label{display:grid;gap:4px;font-size:12px;color:var(--muted)}
  .um form input,.um form select{border:1px solid var(--line);border-radius:6px;padding:7px 9px;background:var(--paper);font-size:13px}
  .um form input:focus,.um form select:focus{outline:none;border-color:var(--accent)}
  .um .msg{font-size:12.5px;min-height:16px;color:var(--muted)} .um .msg.err{color:var(--crit)}
  .um .hint{font-size:11.5px;color:var(--faint)}
  @media(max-width:700px){.um form{grid-template-columns:1fr 1fr}}`;
  document.head.appendChild(css);

  const modal = document.createElement('div');
  modal.className = 'um'; modal.hidden = true;
  modal.innerHTML = `
    <div class="box" role="dialog" aria-label="IT users">
      <h2>IT users <button type="button" id="umClose" aria-label="Close">×</button></h2>
      <div class="sub">Accounts allowed to open this system. Adding a user creates their login if they don't have one yet (the same login works for other Meatplus apps on this platform).</div>
      <div class="tablewrap"><table>
        <thead><tr><th>Email</th><th>Name</th><th>Role</th><th>Login</th><th>Added</th><th></th></tr></thead>
        <tbody id="umRows"><tr><td colspan="6" style="color:var(--muted);text-align:center;padding:16px">Loading…</td></tr></tbody>
      </table></div>
      <form id="umForm" autocomplete="off">
        <label>Email <input id="umEmail" type="email" required placeholder="name@meatplus.ph"></label>
        <label>Full name <input id="umName" type="text" placeholder="Juan dela Cruz"></label>
        <label>Role <select id="umRole"><option value="staff">Staff</option><option value="admin">Admin</option></select></label>
        <label>Temporary password <input id="umPass" type="text" minlength="8" placeholder="8+ characters" autocomplete="new-password"></label>
        <button class="btn primary" type="submit" id="umAdd">Add user</button>
      </form>
      <div class="hint">Temporary password is only needed for a brand-new login; leave it blank if the person already signs in to another system here. Staff can create and edit records; Admins can also manage users.</div>
      <div class="msg" id="umMsg"></div>
    </div>`;
  document.body.appendChild(modal);

  const $ = (s) => modal.querySelector(s);
  const msg = (t, err) => { const m = $('#umMsg'); m.textContent = t || ''; m.classList.toggle('err', !!err); };
  async function call(body){
    const { data, error } = await sb.functions.invoke('itat-admin', { body });
    if (error) { let detail = error.message; try { const ctx = await error.context?.json(); if (ctx?.error) detail = ctx.error; } catch(e){} throw new Error(detail); }
    if (data?.error) throw new Error(data.error);
    return data;
  }
  async function load(){
    try {
      const { users } = await call({ action: 'list' });
      const me = (currentUser?.email || '').toLowerCase();
      $('#umRows').innerHTML = users.length ? users.map(u => `<tr data-email="${esc(u.email)}">
        <td><b>${esc(u.email)}</b>${u.email.toLowerCase()===me?' <span class="hint">(you)</span>':''}</td>
        <td>${esc(u.full_name||'—')}</td>
        <td><select data-role ${u.email.toLowerCase()===me?'disabled':''}><option value="staff" ${u.role==='staff'?'selected':''}>Staff</option><option value="admin" ${u.role==='admin'?'selected':''}>Admin</option></select></td>
        <td><span class="pill ${u.has_login?'ok':'no'}">${u.has_login?'Active':'No login'}</span></td>
        <td style="white-space:nowrap;color:var(--muted)">${u.added_at ? new Date(u.added_at).toLocaleDateString() : ''}</td>
        <td><div class="acts"><button type="button" data-reset ${u.has_login?'':'disabled'}>Reset password</button><button type="button" class="del" data-remove ${u.email.toLowerCase()===me?'disabled':''}>Remove</button></div></td></tr>`).join('')
        : '<tr><td colspan="6" style="color:var(--muted);text-align:center;padding:16px">No users yet.</td></tr>';
      $('#umRows').querySelectorAll('[data-role]').forEach(sel => sel.onchange = async () => {
        const email = sel.closest('tr').dataset.email;
        try { const r = await call({ action: 'set_role', email, role: sel.value }); msg(r.message); } catch (e) { msg(e.message, true); load(); }
      });
      $('#umRows').querySelectorAll('[data-remove]').forEach(b => b.onclick = async () => {
        const email = b.closest('tr').dataset.email;
        if (b.dataset.armed !== '1') { b.dataset.armed = '1'; b.textContent = 'Confirm remove'; setTimeout(() => { b.dataset.armed = ''; b.textContent = 'Remove'; }, 4000); return; }
        try { const r = await call({ action: 'remove', email }); msg(r.message); load(); } catch (e) { msg(e.message, true); }
      });
      $('#umRows').querySelectorAll('[data-reset]').forEach(b => b.onclick = async () => {
        const email = b.closest('tr').dataset.email;
        const tr = b.closest('tr');
        if (!tr.querySelector('[data-newpass]')) {
          const cell = b.parentElement; cell.innerHTML = `<input data-newpass type="text" placeholder="New temporary password" minlength="8" style="border:1px solid var(--line);border-radius:4px;padding:3px 6px;width:170px"> <button type="button" data-savepass>Save</button> <button type="button" data-cancelpass>Cancel</button>`;
          cell.querySelector('[data-cancelpass]').onclick = load;
          cell.querySelector('[data-savepass]').onclick = async () => {
            const password = cell.querySelector('[data-newpass]').value;
            try { const r = await call({ action: 'reset_password', email, password }); msg(r.message + ' — give the new password to ' + email + ' privately.'); load(); } catch (e) { msg(e.message, true); }
          };
          cell.querySelector('[data-newpass]').focus();
        }
      });
    } catch (e) { $('#umRows').innerHTML = `<tr><td colspan="6" style="color:var(--crit);padding:12px">${esc(e.message)}</td></tr>`; }
  }
  $('#umForm').addEventListener('submit', async (e) => {
    e.preventDefault(); const btn = $('#umAdd'); btn.disabled = true; btn.textContent = 'Adding…'; msg('');
    try {
      const r = await call({ action: 'add', email: $('#umEmail').value, full_name: $('#umName').value, role: $('#umRole').value, password: $('#umPass').value });
      msg(r.message + (r.created ? ' — give the temporary password to the user privately; they can change it after signing in.' : ''));
      $('#umForm').reset(); load();
    } catch (err) { msg(err.message, true); }
    btn.disabled = false; btn.textContent = 'Add user';
  });
  $('#umClose').onclick = () => { modal.hidden = true; };
  modal.addEventListener('click', (e) => { if (e.target === modal) modal.hidden = true; });
  document.addEventListener('keydown', (e) => { if (e.key === 'Escape' && !modal.hidden) modal.hidden = true; });

  // Toolbar button, shown only to admins after sign-in
  const btn = document.createElement('button');
  btn.className = 'btn'; btn.id = 'btnUsers'; btn.textContent = 'IT users'; btn.hidden = true;
  btn.onclick = () => { modal.hidden = false; msg(''); load(); };
  const menu = document.querySelector('.toolbar .menu');
  menu.parentNode.insertBefore(btn, menu);
  const origStart = start;
  start = async function (session) { await origStart(session); btn.hidden = !(currentUser && currentUser.itatRole === 'admin'); };
  const origStop = stop;
  stop = function () { origStop(); btn.hidden = true; modal.hidden = true; };
})();

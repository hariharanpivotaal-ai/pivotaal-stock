// Web App URL is kept in config.js (upload it once, never overwritten again)
const KEY = 'pivotaalstock2026';

const $ = (s, el = document) => el.querySelector(s);
const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
function me() { try { return JSON.parse(localStorage.getItem('pse_user')); } catch (e) { return null; } }

async function api(action, data, pinOverride) {
  const u = me();
  const res = await fetch(API, {
    method: 'POST',
    body: JSON.stringify({ key: KEY, action, pin: pinOverride || (u && u.pin) || '', data: data || {} })
  });
  const j = await res.json();
  if (!j.ok) throw new Error(j.error || 'Server error');
  return j;
}

function toast(msg, bad) {
  let t = $('#toast');
  if (!t) { t = document.createElement('div'); t.id = 'toast'; t.setAttribute('role', 'status'); document.body.appendChild(t); }
  t.textContent = msg; t.className = bad ? 'show bad' : 'show';
  clearTimeout(t._h); t._h = setTimeout(() => t.className = '', 3800);
}

function today() { const d = new Date(); d.setMinutes(d.getMinutes() - d.getTimezoneOffset()); return d.toISOString().slice(0, 10); }

function userBar(u) {
  const c = $('#user'); if (!c) return;
  c.textContent = u.name + ' (log out)';
  c.onclick = () => { if (confirm('Log out ' + u.name + '?')) { localStorage.removeItem('pse_user'); location.href = 'index.html'; } };
}

// Permission check for the logged-in user
function can(p) { const u = me(); return !!u && (u.admin || (u.perms || []).includes(p)); }

// Login gate. perms = list of permission keys (any one is enough). null = any logged-in user.
function gate(perms, start) {
  let u = me();
  if (u && !u.perms) { localStorage.removeItem('pse_user'); u = null; } // old login, ask PIN again
  const main = $('main');
  if (u && (!perms || perms.some(can))) { userBar(u); main.hidden = false; start(u); return; }
  main.hidden = true;
  const box = document.createElement('div');
  box.className = 'card login';
  box.innerHTML = u
    ? `<h2>No access</h2><p>${esc(u.name)}, you don't have permission for this page.</p>
       <a class="btn ghost" href="index.html">Back to home</a><button class="btn" id="lo">Log in as someone else</button>`
    : `<h2>Enter your PIN</h2><input id="pin" type="password" inputmode="numeric" autocomplete="off" aria-label="PIN">
       <button class="btn" id="go">Log in</button><p class="hint" id="err"></p>`;
  main.after(box);
  if (u) { $('#lo').onclick = () => { localStorage.removeItem('pse_user'); location.reload(); }; return; }
  const go = async () => {
    const pin = $('#pin').value.trim(); if (!pin) return;
    $('#go').disabled = true; $('#err').textContent = '';
    try {
      const r = await api('login', {}, pin);
      localStorage.setItem('pse_user', JSON.stringify({ name: r.user.name, admin: r.user.admin, perms: r.user.perms, pin }));
      location.reload();
    } catch (e) { $('#err').textContent = e.message; $('#go').disabled = false; }
  };
  $('#go').onclick = go;
  $('#pin').onkeydown = e => { if (e.key === 'Enter') go(); };
  $('#pin').focus();
}

// Shrink photo on the phone before upload (fast on mobile data)
function resizeImage(file, max = 1000) {
  return new Promise((ok, fail) => {
    const img = new Image();
    img.onload = () => {
      const s = Math.min(1, max / Math.max(img.width, img.height));
      const c = document.createElement('canvas');
      c.width = Math.round(img.width * s); c.height = Math.round(img.height * s);
      c.getContext('2d').drawImage(img, 0, 0, c.width, c.height);
      const url = c.toDataURL('image/jpeg', 0.82);
      URL.revokeObjectURL(img.src);
      ok({ b64: url.split(',')[1], mime: 'image/jpeg', url });
    };
    img.onerror = () => fail(new Error('Could not read this image'));
    img.src = URL.createObjectURL(file);
  });
}

function thumb(url) { return url ? `<img class="thumb" src="${esc(url)}" alt="" loading="lazy">` : `<div class="thumb none"></div>`; }

// Filter bar: Product + Style (+ Status) + search. Keeps your filter after save.
function skuFilter(box, skus, render, withStatus, holder) {
  holder = holder || box;
  const st = holder._st || (holder._st = { p: '', s: '', q: '', a: withStatus ? 'Active' : '' });
  const uniq = (list, k) => [...new Set(list.map(x => x[k]).filter(Boolean))].sort();
  const opt = v => `<option>${esc(v)}</option>`;
  box.innerHTML = `<div class="filters">
      <select class="fp" aria-label="Filter by product"><option value="">All products</option>${uniq(skus, 'product').map(opt).join('')}</select>
      <select class="fs" aria-label="Filter by style"></select>
      ${withStatus ? '<select class="fa" aria-label="Filter by status"><option value="Active">Active</option><option value="Inactive">Inactive</option><option value="">All status</option></select>' : ''}
    </div>
    <input class="fq" type="search" placeholder="Search colour, print or SKU code" aria-label="Search SKU">
    <div class="hint fc"></div>`;
  const fp = $('.fp', box), fs = $('.fs', box), fa = $('.fa', box), fq = $('.fq', box);
  const fillStyles = () => {
    const list = fp.value ? skus.filter(x => x.product === fp.value) : skus;
    fs.innerHTML = '<option value="">All styles</option>' + uniq(list, 'style').map(opt).join('');
    fs.value = st.s;
  };
  fp.value = st.p; fillStyles(); if (fa) fa.value = st.a; fq.value = st.q;
  const run = () => {
    st.p = fp.value; st.s = fs.value; st.q = fq.value.trim(); if (fa) st.a = fa.value;
    const q = st.q.toLowerCase();
    const f = skus.filter(x => (!st.p || x.product === st.p) && (!st.s || x.style === st.s)
      && (!fa || !st.a || (x.status || 'Active') === st.a)
      && (!q || [x.parent, x.name, x.style, x.product].join(' ').toLowerCase().includes(q)));
    $('.fc', box).textContent = 'Showing ' + f.length + ' of ' + skus.length + ' SKUs';
    render(f);
  };
  fp.onchange = () => { fillStyles(); run(); };
  fs.onchange = run; if (fa) fa.onchange = run; fq.oninput = run;
  run();
}

// SKU picker for entry forms (reused in Phase 2)
function skuPicker(box, skus, onPick) {
  box.innerHTML = '<div class="pf"></div><div class="pick-list"></div>';
  const list = $('.pick-list', box);
  skuFilter($('.pf', box), skus, f => {
    list.innerHTML = f.length
      ? f.slice(0, 50).map(p => `<div class="pick-item" data-p="${esc(p.parent)}" tabindex="0" style="cursor:pointer">${thumb(p.image)}
          <div><b>${esc(p.name)}</b><div class="hint">${esc(p.product)} ${esc(p.style)} | ${esc(p.parent)}</div></div></div>`).join('')
        + (f.length > 50 ? '<p class="hint">Showing first 50. Use the filters to narrow down.</p>' : '')
      : '<p class="hint">No SKU found. Change the filters or create it in Create SKU.</p>';
  }, false, box);
  const choose = e => { const it = e.target.closest('.pick-item'); if (it) onPick(skus.find(p => p.parent === it.dataset.p), true); };
  list.onclick = choose;
  list.onkeydown = e => { if (e.key === 'Enter') choose(e); };
}

// Size-wise stock table: rows In production / Ready / Reserved / Available
function stockTable(S, rows) {
  rows = rows || ['inProd', 'ready', 'reserved', 'avail'];
  const R = { inProd: ['In production', 'b-prod'], ready: ['Ready', 'b-ready'], reserved: ['Reserved', 'b-res'], avail: ['Available', 'b-avail'] };
  const sum = k => S.reduce((a, s) => a + (s[k] || 0), 0);
  return `<div class="stk"><table><thead><tr><th></th>${S.map(s => `<th>${esc(s.size)}</th>`).join('')}<th class="tt">Total</th></tr></thead><tbody>
    ${rows.map(k => `<tr class="${k === 'avail' ? 'sumrow' : ''}"><th><span class="${R[k][1]}">${R[k][0]}</span></th>
      ${S.map(s => `<td>${s[k] || 0}</td>`).join('')}<td class="tt">${sum(k)}</td></tr>`).join('')}</tbody></table></div>`;
}
// WhatsApp link (adds 91 for 10-digit Indian numbers)
function waLink(phone, msg) {
  let p = String(phone || '').replace(/\D/g, '');
  if (p.length === 10) p = '91' + p;
  return 'https://wa.me/' + p + '?text=' + encodeURIComponent(msg);
}
function fileToB64(file) {
  return new Promise((ok, fail) => { const r = new FileReader(); r.onload = () => ok(String(r.result).split(',')[1]); r.onerror = () => fail(new Error('Could not read file')); r.readAsDataURL(file); });
}
const STAGE = { READY: ['Ready to dispatch', 'b-ready'], PART: ['Partly ready', 'b-prod'], PROD: ['In production', 'b-prod'] };
function statusBadge(r) {
  if (r.status === 'Cancelled') return '<span class="b-short">Cancelled</span>';
  if (r.status === 'Closed') return '<span class="b-off">Closed</span>';
  const s = STAGE[r.stage] || STAGE.PROD;
  return `<span class="${s[1]}">${s[0]}</span>${r.status === 'Part dispatched' ? ' <span class="b-avail">Part dispatched</span>' : ''}`;
}

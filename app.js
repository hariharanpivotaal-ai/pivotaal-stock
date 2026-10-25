// ===== STEP: paste your Apps Script Web App URL here =====
const API = 'https://script.google.com/macros/s/AKfycbwfQfyqVuFbvYs6S5Cf0Y7rj9hkdR5ydXkqflLAPAXGborC0i-gV9qP9sIuKdsoe7yN/exec';
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

// Login gate. roles = null means any logged-in user.
function gate(roles, start) {
  const u = me(), main = $('main');
  if (u && (!roles || u.roles.some(r => roles.includes(r)))) { userBar(u); main.hidden = false; start(u); return; }
  main.hidden = true;
  const box = document.createElement('div');
  box.className = 'card login';
  box.innerHTML = u
    ? `<h2>No access</h2><p>${esc(u.name)}, this page is not in your role.</p>
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
      localStorage.setItem('pse_user', JSON.stringify({ name: r.user.name, roles: r.user.roles, pin }));
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

// Searchable SKU list (reused in Phase 2 forms)
function skuPicker(box, skus, onPick) {
  box.innerHTML = `<input type="search" placeholder="Search colour, print, style or SKU" aria-label="Search SKU"><div class="pick-list"></div>`;
  const inp = $('input', box), list = $('.pick-list', box);
  const draw = () => {
    const q = inp.value.trim().toLowerCase();
    const f = skus.filter(p => !q || [p.parent, p.name, p.style, p.product].join(' ').toLowerCase().includes(q)).slice(0, 30);
    list.innerHTML = f.length
      ? f.map(p => `<div class="pick-item" data-p="${esc(p.parent)}" tabindex="0">${thumb(p.image)}
          <div><b>${esc(p.name)}</b><div class="hint">${esc(p.product)} ${esc(p.style)} | ${esc(p.parent)}</div></div></div>`).join('')
      : '<p class="hint">No SKU found. Create it in Create SKU first.</p>';
  };
  const choose = e => { const it = e.target.closest('.pick-item'); if (it) onPick(skus.find(p => p.parent === it.dataset.p), true); };
  list.onclick = choose;
  list.onkeydown = e => { if (e.key === 'Enter') choose(e); };
  inp.oninput = draw; draw();
}

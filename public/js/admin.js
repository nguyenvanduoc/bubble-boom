// ============================================================
// TRANG QUẢN TRỊ: đăng nhập, tìm người chơi, cấp / trừ xu, xem lịch sử
// Gọi API /api/admin/... của server bằng fetch()
// ============================================================
const $ = (s) => document.querySelector(s);
const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
const fmt = (n) => Number(n).toLocaleString('vi-VN');
const ago = (t) => {
  if (!t) return 'chưa từng';
  const s = Math.round((Date.now() - t) / 1000);
  if (s < 60) return 'vừa xong';
  if (s < 3600) return `${Math.floor(s / 60)} phút trước`;
  if (s < 86400) return `${Math.floor(s / 3600)} giờ trước`;
  return new Date(t).toLocaleDateString('vi-VN');
};
const ss = {     // sessionStorage: phiên đăng nhập mất khi đóng tab (an toàn hơn localStorage)
  get: () => { try { return sessionStorage.getItem('bb-admin') || ''; } catch { return ''; } },
  set: (v) => { try { v ? sessionStorage.setItem('bb-admin', v) : sessionStorage.removeItem('bb-admin'); } catch { /* bỏ qua */ } },
};

let token = ss.get();
let players = [];
let selected = null;
let refreshTimer = null;

let toastTimer;
function toast(msg) {
  const t = $('#toast'); t.textContent = msg; t.classList.add('show');
  clearTimeout(toastTimer); toastTimer = setTimeout(() => t.classList.remove('show'), 2800);
}

/** Gọi API admin. Tự đăng xuất khi phiên hết hạn */
async function api(path, { method = 'GET', body } = {}) {
  const res = await fetch('/api/admin/' + path, {
    method,
    headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + token },
    body: body ? JSON.stringify(body) : undefined,
  });
  const data = await res.json().catch(() => ({}));
  if (res.status === 401 && path !== 'login') { logout(false); throw new Error(data.error || 'Phiên đăng nhập đã hết hạn'); }
  if (!res.ok) throw new Error(data.error || `Lỗi ${res.status}`);
  return data;
}

// ---------- đăng nhập / đăng xuất ----------
$('#login-form').onsubmit = async (e) => {
  e.preventDefault();
  try {
    const r = await api('login', { method: 'POST', body: { password: $('#pw').value } });
    token = r.token; ss.set(token); $('#pw').value = '';
    showDash();
  } catch (err) { toast(err.message); }
};
function logout(callServer = true) {
  if (callServer && token) api('logout', { method: 'POST' }).catch(() => {});
  token = ''; ss.set('');
  clearInterval(refreshTimer);
  $('#dash').classList.add('hidden'); $('#login').classList.remove('hidden');
}
$('#logout').onclick = () => logout();

function showDash() {
  $('#login').classList.add('hidden'); $('#dash').classList.remove('hidden');
  load();
  clearInterval(refreshTimer);
  refreshTimer = setInterval(load, 10000);          // tự làm mới 10 giây / lần
}

// ---------- danh sách người chơi ----------
let searchTimer;
$('#q').oninput = () => { clearTimeout(searchTimer); searchTimer = setTimeout(load, 250); };
$('#refresh').onclick = load;

async function load() {
  try {
    const [p, l] = await Promise.all([api('players?q=' + encodeURIComponent($('#q').value.trim())), api('log')]);
    players = p.players;
    $('#st-total').textContent = fmt(p.total);
    $('#st-online').textContent = fmt(p.online);
    $('#st-coins').textContent = fmt(p.coins);
    $('#players').innerHTML = players.length ? players.map((x, i) => `
      <tr>
        <td><span class="dot ${x.online ? 'on' : ''}" title="${x.online ? 'Đang online' : 'Offline'}"></span><code>${esc(x.pid)}</code></td>
        <td>${esc(x.name) || '<span class="muted">(chưa đặt tên)</span>'}</td>
        <td class="num"><b>${fmt(x.coins)}</b></td>
        <td class="num">${x.games} / ${x.wins}</td>
        <td>${x.online ? '<b class="plus">Online</b>' : ago(x.lastSeen)}</td>
        <td><button class="btn primary small" data-i="${i}">🪙 Cấp xu</button></td>
      </tr>`).join('') : '<tr><td colspan="6" class="muted">Không có người chơi nào</td></tr>';
    $('#players').querySelectorAll('[data-i]').forEach((b) => { b.onclick = () => openGrant(players[+b.dataset.i]); });
    $('#log').innerHTML = l.log.length ? l.log.map((e) => `
      <tr>
        <td>${new Date(e.time).toLocaleString('vi-VN')}</td>
        <td><code>${esc(e.pid)}</code> ${esc(e.name)}</td>
        <td class="num ${e.amount > 0 ? 'plus' : 'minus'}">${e.amount > 0 ? '+' : ''}${fmt(e.amount)}</td>
        <td class="num">${fmt(e.before)} → ${fmt(e.after)}</td>
        <td>${esc(e.reason) || '<span class="muted">-</span>'}</td>
      </tr>`).join('') : '<tr><td colspan="5" class="muted">Chưa cấp xu lần nào</td></tr>';
  } catch (err) { toast(err.message); }
}

// ---------- hộp thoại cấp xu ----------
const dlg = $('#grant');
function openGrant(p) {
  selected = p;
  $('#g-name').textContent = p.name || p.pid;
  $('#g-pid').textContent = p.pid;
  $('#g-coins').textContent = fmt(p.coins);
  $('#g-amount').value = ''; $('#g-reason').value = ''; $('#g-preview').textContent = '';
  dlg.showModal();
  $('#g-amount').focus();
}
$('#g-cancel').onclick = () => dlg.close();
document.querySelectorAll('[data-amt]').forEach((b) => {
  b.onclick = () => { $('#g-amount').value = b.dataset.amt; preview(); };
});
$('#g-amount').oninput = preview;
function preview() {
  const n = Math.trunc(Number($('#g-amount').value));
  if (!selected || !n) { $('#g-preview').textContent = ''; return; }
  const after = Math.max(0, selected.coins + n);
  $('#g-preview').innerHTML = `Sau khi ${n > 0 ? 'cấp' : 'trừ'}: <b>${fmt(selected.coins)} → ${fmt(after)} xu</b>`;
}
$('#grant-form').onsubmit = async (e) => {
  e.preventDefault();
  const amount = Math.trunc(Number($('#g-amount').value));
  if (!amount) return toast('Nhập số xu khác 0');
  $('#g-ok').disabled = true;
  try {
    const r = await api('grant', { method: 'POST', body: { pid: selected.pid, amount, reason: $('#g-reason').value } });
    dlg.close();
    const real = r.entry.after - r.entry.before;             // số xu thực sự thay đổi (ví không xuống dưới 0)
    toast(`${real >= 0 ? 'Đã cấp' : 'Đã trừ'} ${fmt(Math.abs(real))} xu cho ${selected.name || selected.pid} (còn ${fmt(r.coins)})`);
    load();
  } catch (err) { toast(err.message); } finally { $('#g-ok').disabled = false; }
};

// Mở lại trang mà phiên còn hạn -> vào thẳng bảng điều khiển
if (token) api('log').then(showDash).catch(() => logout(false));

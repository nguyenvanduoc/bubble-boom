// ============================================================
// CLIENT: giao diện, kết nối, dự đoán chuyển động & nội suy
// ============================================================
import { TICK_MS, TIMING, CHARACTERS, CHAR_BY_ID, MAPS, MAP_BY_ID, TEAMS, ITEMS, MAX_PLAYERS, SHOP, SHOP_TABS, ITEM_IDS, MAX_EQUIP, REWARD } from '../shared/constants.js';
import { movePlayer, speedOf, decodePlayer, decodeBomb, decodeFlame, decodeDart } from '../shared/engine.js';
import { Renderer, paintCharPreview, paintMapPreview, paintShopPreview, drawItem, TILE } from './render.js';
import { Input } from './input.js';
import { sfx } from './audio.js';
import { connectOnline, connectOffline } from './net.js';

const $ = (s) => document.querySelector(s);
const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
const store = {
  get: (k, d) => { try { return localStorage.getItem(k) ?? d; } catch { return d; } },
  set: (k, v) => { try { localStorage.setItem(k, v); } catch { /* chế độ riêng tư */ } },
};

const params = new URLSearchParams(location.search);
const S = {
  conn: null, myId: null, offline: false,
  name: store.get('bb-name', ''), charId: store.get('bb-char', 'bin'),
  room: null, lobby: null, game: null, pendingJoin: params.get('room'), offlineSetup: false, ping: 0,
  profile: null, shopBack: 'scr-lobby',
};
if (!CHAR_BY_ID[S.charId]) S.charId = 'bin';
if (params.has('debug')) window.bb = S;   // mở trang với ?debug để xem trạng thái trong Console

const renderer = new Renderer($('#cv'));
const input = new Input();
input.bindTouch($('#touch'));

// ---------------- tiện ích giao diện ----------------
const currentScreen = () => document.querySelector('.screen.active')?.id;
function show(id) {
  document.querySelectorAll('.screen').forEach((s) => s.classList.toggle('active', s.id === id));
  input.enabled = id === 'scr-game';
}
let toastTimer;
function toast(msg) {
  const t = $('#toast'); t.textContent = msg; t.classList.add('show');
  clearTimeout(toastTimer); toastTimer = setTimeout(() => t.classList.remove('show'), 2600);
}
function itemCanvas(type, size = 34) {
  const c = document.createElement('canvas'); const d = Math.min(devicePixelRatio || 1, 2);
  c.width = c.height = 40 * d; const ctx = c.getContext('2d'); ctx.scale(d, d); drawItem(ctx, type, 20, 20, 0);
  c.style.width = c.style.height = size + 'px'; return c;
}
const charStats = (c) => `<span class="stats"><span>💧${c.b[0]}/${c.b[1]}</span><span>🌊${c.r[0]}/${c.r[1]}</span><span>👟${c.s[0]}/${c.s[1]}</span></span>`;

// ---------------- MÀN HÌNH CHÍNH ----------------
$('#in-name').value = S.name;
function renderCharGrid() {
  const grid = $('#char-grid'); grid.innerHTML = '';
  for (const c of CHARACTERS) {
    const b = document.createElement('button');
    b.className = 'char-card' + (c.id === S.charId ? ' sel' : '');
    b.innerHTML = `<canvas></canvas><div><b>${c.name}</b><small>${c.desc}</small>${charStats(c)}</div>`;
    paintCharPreview(b.querySelector('canvas'), c.id);
    b.onclick = () => { setChar(c.id); renderCharGrid(); };
    grid.appendChild(b);
  }
}
function setChar(id) {
  S.charId = id; store.set('bb-char', id);
  if (S.conn) S.conn.send({ t: 'char', char: id });
}
renderCharGrid();
for (const [type, it] of Object.entries(ITEMS)) {
  const d = document.createElement('div');
  d.appendChild(itemCanvas(type));
  d.insertAdjacentHTML('beforeend', `<span><b>${it.name}</b> – ${it.desc}</span>`);
  $('#item-help').appendChild(d);
}
for (const m of MAPS) $('#in-room-map').insertAdjacentHTML('beforeend', `<option value="${m.id}">${m.name}</option>`);

function readName() {
  S.name = $('#in-name').value.trim().slice(0, 16) || `Người chơi ${(Math.random() * 900 + 100) | 0}`;
  $('#in-name').value = S.name; store.set('bb-name', S.name);
}

const serverUrl = params.get('server') || (location.protocol.startsWith('http') ? `${location.protocol === 'https:' ? 'wss' : 'ws'}://${location.host}/ws` : null);
if (!serverUrl) $('#server-note').textContent = 'Chế độ online cần chạy server (npm start). Bạn vẫn có thể chơi với bot.';

$('#btn-online').onclick = async () => {
  sfx.unlock(); readName();
  if (!serverUrl) return toast('Không có server online. Hãy chạy "npm start"');
  closeConn();
  try {
    $('#btn-online').disabled = true;
    S.conn = await connectOnline(serverUrl, onMsg, () => { if (!S.offline) { toast('Mất kết nối server'); S.conn = null; S.game = null; show('scr-home'); } });
    S.offline = false;
    startPing();
  } catch (e) { toast(e.message); } finally { $('#btn-online').disabled = false; }
};
$('#btn-offline').onclick = () => {
  sfx.unlock(); readName(); closeConn();
  S.offline = true; S.offlineSetup = true;
  S.conn = connectOffline(onMsg);
};
function closeConn() { if (S.conn) { S.conn.close(); S.conn = null; } S.room = null; S.game = null; }

// ---------------- SẢNH ----------------
$('#lobby-back').onclick = () => { closeConn(); show('scr-home'); };
$('#btn-refresh').onclick = () => S.conn?.send({ t: 'list' });
$('#btn-create').onclick = () => S.conn?.send({ t: 'create', name: $('#in-room-name').value, map: $('#in-room-map').value });
$('#btn-join').onclick = () => { const code = $('#in-code').value.trim().toUpperCase(); if (code) S.conn?.send({ t: 'join', room: code }); };
$('#in-code').addEventListener('keydown', (e) => { if (e.key === 'Enter') $('#btn-join').click(); });

function renderLobby() {
  const L = S.lobby; if (!L) return;
  $('#online-count').textContent = `🟢 ${L.online} online`;
  const list = $('#room-list');
  if (!L.rooms.length) { list.innerHTML = '<div class="empty">Chưa có phòng nào. Tạo phòng mới để rủ bạn bè!</div>'; return; }
  list.innerHTML = L.rooms.map((r) => `
    <div class="room-item">
      <div class="info"><b>${esc(r.name)}</b><span class="muted small">#${r.id} · ${MAP_BY_ID[r.map]?.name || ''} · ${r.status === 'playing' ? 'Đang chơi' : 'Đang chờ'}</span></div>
      <span class="pill">${r.count}/${r.max}</span>
      <button class="btn primary small" data-join="${r.id}" ${r.status !== 'waiting' || r.count >= r.max ? 'disabled' : ''}>Vào</button>
    </div>`).join('');
  list.querySelectorAll('[data-join]').forEach((b) => { b.onclick = () => S.conn.send({ t: 'join', room: b.dataset.join }); });
}

// ---------------- PHÒNG CHỜ ----------------
$('#room-leave').onclick = () => {
  if (S.offline) { closeConn(); show('scr-home'); } else S.conn.send({ t: 'leave' });
  S.room = null;
};
$('#btn-addbot').onclick = () => S.conn.send({ t: 'addBot' });
$('#btn-ready').onclick = () => {
  const r = S.room; if (!r) return;
  if (r.host === S.myId) S.conn.send({ t: 'start' });
  else S.conn.send({ t: 'ready', v: !r.members.find((m) => m.id === S.myId)?.ready });
};
$('#room-copy').onclick = async () => {
  if (S.offline) return toast('Chế độ offline không mời được bạn bè');
  const link = `${location.origin}${location.pathname}?room=${S.room.id}`;
  try { await navigator.clipboard.writeText(link); toast('Đã sao chép link mời!'); } catch { toast(link); }
};
$('#chat-form').onsubmit = (e) => {
  e.preventDefault(); const v = $('#chat-in').value.trim();
  if (v) S.conn.send({ t: 'chat', text: v }); $('#chat-in').value = '';
};

function renderRoom() {
  const r = S.room; if (!r) return;
  const host = r.host === S.myId;
  $('#room-title').textContent = r.name;
  $('#room-code').textContent = r.id;
  $('#room-count').textContent = `(${r.members.length}/${MAX_PLAYERS})`;
  const slots = $('#slots'); slots.innerHTML = '';
  for (let i = 0; i < MAX_PLAYERS; i++) {
    const m = r.members[i];
    const el = document.createElement('div');
    if (!m) {
      el.className = 'slot empty-slot';
      el.innerHTML = host ? '<button class="btn small">+ Bot</button>' : 'Trống';
      if (host) el.querySelector('button').onclick = () => S.conn.send({ t: 'addBot' });
      slots.appendChild(el); continue;
    }
    el.className = 'slot';
    el.style.setProperty('--team', TEAMS[m.team].color);
    const canEditTeam = (m.id === S.myId || (host && m.bot)) && r.status === 'waiting';
    el.innerHTML = `
      <span class="tag">${m.id === r.host ? '👑 Chủ phòng' : m.bot ? '🤖 Bot' : ''}</span>
      ${host && m.id !== S.myId ? '<button class="btn ghost small kick" title="Mời ra">✕</button>' : ''}
      <canvas></canvas>
      <div class="nm">${esc(m.name)}${m.id === S.myId ? ' (bạn)' : ''}</div>
      <select ${canEditTeam ? '' : 'disabled'}>${TEAMS.map((t, ti) => `<option value="${ti}" ${ti === m.team ? 'selected' : ''}>Đội ${t.name}</option>`).join('')}</select>
      ${m.id === r.host || m.bot ? '' : `<span class="badge ${m.ready ? 'ok' : ''}">${m.ready ? 'Sẵn sàng' : 'Chưa sẵn sàng'}</span>`}
      <div class="gear-row"></div>`;
    paintCharPreview(el.querySelector('canvas'), m.charId, 0, m.outfit);
    if (r.gear) for (const g of m.gear || []) { const c = itemCanvas(SHOP[g].icon, 22); c.title = SHOP[g].name; el.querySelector('.gear-row').appendChild(c); }
    el.querySelector('select').onchange = (e) => S.conn.send({ t: 'team', team: +e.target.value, id: m.id });
    el.querySelector('.kick')?.addEventListener('click', () => S.conn.send({ t: 'kick', id: m.id }));
    slots.appendChild(el);
  }
  $('#btn-addbot').style.display = host ? '' : 'none';
  $('#gear-toggle').checked = r.gear; $('#gear-toggle').disabled = !host;
  const me = r.members.find((m) => m.id === S.myId);
  $('#btn-ready').textContent = host ? '▶ Bắt đầu' : me?.ready ? 'Huỷ sẵn sàng' : 'Sẵn sàng';
  // bản đồ
  const ml = $('#map-list'); ml.innerHTML = '';
  for (const map of MAPS) {
    const b = document.createElement('button');
    b.className = 'map-card' + (map.id === r.map ? ' sel' : ''); b.disabled = !host;
    b.innerHTML = `<canvas></canvas><span>${map.name}</span>`;
    paintMapPreview(b.querySelector('canvas'), map);
    b.onclick = () => S.conn.send({ t: 'map', map: map.id });
    ml.appendChild(b);
  }
  // nhân vật
  const cr = $('#room-chars'); cr.innerHTML = '';
  for (const c of CHARACTERS) {
    const b = document.createElement('button');
    b.className = me?.charId === c.id ? 'sel' : ''; b.title = `${c.name} – ${c.desc}`;
    b.innerHTML = '<canvas></canvas>'; paintCharPreview(b.querySelector('canvas'), c.id, 0, S.profile?.outfit);
    b.onclick = () => setChar(c.id);
    cr.appendChild(b);
  }
}
function addChat(from, text) {
  const log = $('#chat-log');
  log.insertAdjacentHTML('beforeend', `<div><b>${esc(from)}:</b> ${esc(text)}</div>`);
  log.scrollTop = log.scrollHeight;
  if (S.game) {
    const gc = $('#game-chat');
    const d = document.createElement('div'); d.innerHTML = `<b>${esc(from)}:</b> ${esc(text)}`;
    gc.appendChild(d); while (gc.children.length > 5) gc.firstChild.remove();
    setTimeout(() => d.remove(), 7000);
  }
}

// ---------------- CỬA HÀNG ----------------
$('#gear-toggle').onchange = (e) => S.conn.send({ t: 'gear', v: e.target.checked });
document.querySelectorAll('[data-shop]').forEach((b) => { b.onclick = openShop; });
$('#shop-back').onclick = () => {
  const back = S.shopBack === 'scr-room' && !S.room ? (S.offline ? 'scr-home' : 'scr-lobby') : S.shopBack;
  show(back);
};
function openShop() {
  if (!S.profile) return toast('Đang tải ví xu, thử lại sau giây lát');
  S.shopBack = currentScreen();
  S.tryOn = null;
  renderShop();
  show('scr-shop');
}
function updateCoins() {
  document.querySelectorAll('.coins').forEach((el) => { el.textContent = `🪙 ${S.profile ? S.profile.coins : 0}`; });
  // mã người chơi công khai (offline không có admin nên ẩn đi)
  document.querySelectorAll('.pid-line').forEach((el) => el.classList.toggle('hidden', S.offline || !S.profile?.pid));
  document.querySelectorAll('.pid').forEach((el) => { el.textContent = S.profile?.pid || '…'; });
}
document.querySelectorAll('[data-copy-pid]').forEach((b) => {
  b.onclick = async () => {
    const pid = S.profile?.pid; if (!pid) return;
    try { await navigator.clipboard.writeText(pid); toast('Đã sao chép mã ' + pid); } catch { toast('Mã của bạn: ' + pid); }
  };
});
const TAB_NOTES = {
  item: 'Mua bao nhiêu cũng được. Mỗi trận tự mang theo tối đa số lượng ghi trên thẻ; dùng không hết được hoàn lại.',
  outfit: 'Trang phục chỉ đổi ngoại hình, mọi người trong trận đều nhìn thấy. Bấm "Thử" để xem trước.',
  skin: 'Đổi kiểu quả bóng nước bạn đặt trong trận. Bấm "Thử" để xem trước.',
  gear: `Tăng chỉ số khi vào trận (không vượt giới hạn nhân vật). Mặc tối đa ${MAX_EQUIP} món. Chủ phòng có thể tắt.`,
};
S.shopTab = 'item';
function renderShop() {
  const P = S.profile; if (!P) return;
  updateCoins();
  // tab
  $('#shop-tabs').innerHTML = SHOP_TABS.map((t) => `<button class="tab ${t.kind === S.shopTab ? 'on' : ''}" data-tab="${t.kind}">${t.icon} ${t.name}</button>`).join('');
  $('#shop-tabs').querySelectorAll('[data-tab]').forEach((b) => { b.onclick = () => { S.shopTab = b.dataset.tab; renderShop(); }; });
  $('#shop-tab-note').textContent = TAB_NOTES[S.shopTab];
  // danh sách hàng
  const list = $('#shop-list'); list.innerHTML = '';
  for (const [id, it] of Object.entries(SHOP)) {
    if (it.kind !== S.shopTab) continue;
    const owned = P.owned.includes(id);
    const using = it.kind === 'outfit' ? P.outfit === id : it.kind === 'skin' ? P.skin === id : P.equipped.includes(id);
    const card = document.createElement('div');
    card.className = 'shop-card' + (using ? ' worn' : '') + (S.tryOn === id ? ' trying' : '');
    card.appendChild(itemCanvas(it.icon, 56));
    const info = document.createElement('div'); info.className = 'info';
    const status = it.kind === 'item'
      ? `Trong kho: <b>${P.inv[id]}</b> · mang ${it.carry}/trận · phím <kbd>${it.key}</kbd>`
      : using ? '✅ Đang dùng' : owned ? 'Đã có' : `<b class="price">${it.price} 🪙</b>`;
    info.innerHTML = `<b class="nm">${it.name}</b><small>${it.desc}</small><span class="have">${status}</span>`;
    const acts = document.createElement('div'); acts.className = 'acts';
    const btn = (label, cls, disabled, onClick) => {
      const b = document.createElement('button'); b.className = 'btn small ' + cls; b.textContent = label;
      b.disabled = disabled; b.onclick = onClick; acts.appendChild(b);
    };
    const buy = (qty) => S.conn.send({ t: 'buy', item: id, qty });
    if (it.kind === 'item') {
      btn(`Mua 1 · ${it.price}🪙`, 'primary', it.price > P.coins, () => buy(1));
      btn(`Mua 5 · ${it.price * 5}🪙`, '', it.price * 5 > P.coins, () => buy(5));
    } else if (!owned) {
      if (it.kind !== 'gear') btn(S.tryOn === id ? 'Bỏ thử' : 'Thử', '', false, () => { S.tryOn = S.tryOn === id ? null : id; renderShop(); });
      btn(`Mua · ${it.price}🪙`, 'primary', it.price > P.coins, () => { S.tryOn = null; buy(1); });
    } else {
      btn(using ? (it.kind === 'gear' ? 'Tháo ra' : 'Bỏ dùng') : (it.kind === 'gear' ? 'Mặc vào' : 'Dùng'), using ? '' : 'primary', false,
        () => S.conn.send({ t: 'equip', item: id, on: !using }));
    }
    card.append(info, acts);
    list.appendChild(card);
  }
  // cột bên trái: hành trang mang vào trận + đồ đang dùng
  $('#shop-bag').innerHTML = '';
  for (const id of ITEM_IDS) {
    const it = SHOP[id], take = Math.min(P.inv[id], it.carry);
    const d = document.createElement('div'); d.className = 'bag-slot' + (take ? '' : ' empty');
    d.title = `${it.name}: mang ${take}/${it.carry} vào trận (kho có ${P.inv[id]})`;
    d.appendChild(itemCanvas(it.icon, 40));
    d.insertAdjacentHTML('beforeend', `<span class="cnt">${take}/${it.carry}</span><kbd>${it.key}</kbd>`);
    $('#shop-bag').appendChild(d);
  }
  const wearing = [P.outfit, P.skin, ...P.equipped].filter(Boolean).map((id) => SHOP[id].name);
  $('#shop-wearing').textContent = wearing.length ? wearing.join(' · ') : 'Chưa dùng món nào';
  $('#shop-earn').innerHTML = `🎮 Mỗi trận <b>+${REWARD.play}</b> · 🏆 Thắng <b>+${REWARD.win}</b> · 💥 Hạ đối thủ <b>+${REWARD.kill}</b> · 📦 Phá thùng <b>+${REWARD.box}</b>`;
  $('#wallet-note').textContent = S.offline
    ? 'Đang chơi offline: ví này lưu trong trình duyệt, tách riêng với ví online.'
    : `Ví online lưu trên server. Đã chơi ${P.games} trận, thắng ${P.wins}.`;
  paintPreview();
}
/** Khung nhân vật xem trước: đang "Thử" món nào thì mặc món đó */
function paintPreview(t = 0) {
  const P = S.profile; if (!P) return;
  const tryIt = S.tryOn && SHOP[S.tryOn];
  const outfit = tryIt?.kind === 'outfit' ? S.tryOn : P.outfit;
  const skin = tryIt?.kind === 'skin' ? S.tryOn : P.skin;
  paintShopPreview($('#shop-preview'), S.charId, outfit, skin, t);
}
setInterval(() => { if (currentScreen() === 'scr-shop') paintPreview(performance.now() / 1000); }, 50);

// ---------------- NHẬN TIN TỪ SERVER ----------------
function onMsg(m) {
  switch (m.t) {
    case 'welcome':
      S.myId = m.id;
      S.conn.send({ t: 'hello', name: S.name, char: S.charId, token: store.get('bb-token', '') });
      if (S.offline) S.conn.send({ t: 'create', name: 'Luyện tập với bot', map: MAPS[0].id });
      break;
    case 'lobby':
      S.lobby = m;
      if (!S.offline) S.room = null;   // server chỉ gửi danh sách sảnh cho người KHÔNG ở trong phòng
      if (!S.offline && !S.room) {
        if (S.pendingJoin) { S.conn.send({ t: 'join', room: S.pendingJoin }); S.pendingJoin = null; }
        if (currentScreen() === 'scr-shop') S.shopBack = 'scr-lobby';   // đang ở cửa hàng thì không kéo ra
        else if (!S.game) show('scr-lobby');
      }
      renderLobby();
      break;
    case 'room':
      S.room = m.room;
      if (S.offlineSetup) { S.offlineSetup = false; for (let i = 0; i < 3; i++) S.conn.send({ t: 'addBot' }); }
      if (m.room.status === 'waiting' && (!S.game || S.game.ended)) {
        const fromGame = !!S.game;
        endGameView();
        if (fromGame || currentScreen() !== 'scr-shop') show('scr-room'); else S.shopBack = 'scr-room';
      }
      renderRoom();
      break;
    case 'start': startGame(m); break;
    case 's': onSnapshot(m); break;
    case 'end': showResult(m.result); break;
    case 'chat': addChat(m.from, m.text); break;
    case 'err': toast(m.msg); break;
    case 'profile':
      S.profile = m.profile;
      if (m.token) store.set('bb-token', m.token);
      updateCoins();
      if (currentScreen() === 'scr-shop') renderShop();
      if (m.msg) { toast(m.msg); sfx.pick(); }
      break;
    case 'pong': S.ping = Math.round(performance.now() - m.c); break;
  }
}
let pingTimer;
function startPing() {
  clearInterval(pingTimer);
  pingTimer = setInterval(() => S.conn && !S.offline && S.conn.send({ t: 'ping', c: performance.now() }), 2000);
}

// ============================================================
//                     TRẬN ĐẤU
// ============================================================
function startGame(m) {
  S.game = {
    info: new Map(m.players.map((p) => [p.id, p])),
    grid: m.g, snaps: [], latest: null, pending: [], seq: 0,
    pred: null, prev: null, corr: { x: 0, y: 0 }, me: null, myDir: 2, myMoving: false,
    acc: 0, phase: 'countdown', ended: false, lastCount: -1, goAt: 0, ghosts: [],
  };
  renderer.setMap(MAP_BY_ID[m.map]);
  renderer.particles = [];
  $('#result').classList.add('hidden');
  $('#game-chat').innerHTML = '';
  const touchUi = matchMedia('(pointer: coarse)').matches || navigator.maxTouchPoints > 0;
  $('#touch').classList.toggle('hidden', !touchUi);
  document.body.classList.toggle('touch-ui', touchUi);
  buildMeHud();
  document.activeElement?.blur();
  show('scr-game');
  requestAnimationFrame(fitCanvas);
}
function endGameView() { S.game = null; $('#result').classList.add('hidden'); }

let exitArmed = 0;
$('#game-exit').onclick = (e) => {
  e.currentTarget.blur();
  if (performance.now() - exitArmed > 2500) { exitArmed = performance.now(); return toast('Bấm ✕ lần nữa để thoát trận'); }
  if (S.offline) { closeConn(); show('scr-home'); } else { S.conn.send({ t: 'leave' }); S.game = null; S.room = null; }
};
// ---------------- TOÀN MÀN HÌNH / THU NHỎ ----------------
// Dùng Fullscreen API (có tiền tố webkit cho Safari). Trình duyệt không hỗ trợ (iPhone)
// -> "toàn màn hình giả": phóng bàn chơi chiếm hết cửa sổ bằng CSS.
const root = document.documentElement;
const fsElement = () => document.fullscreenElement || document.webkitFullscreenElement;
const isFull = () => !!fsElement() || document.body.classList.contains('fs-fake');
async function toggleFullscreen() {
  if (isFull()) {
    try { screen.orientation?.unlock?.(); } catch { /* không hỗ trợ */ }
    if (fsElement()) await (document.exitFullscreen || document.webkitExitFullscreen).call(document).catch(() => {});
    document.body.classList.remove('fs-fake');
  } else {
    const req = root.requestFullscreen || root.webkitRequestFullscreen;
    try {
      if (!req) throw new Error('không hỗ trợ');
      await req.call(root, { navigationUI: 'hide' });
      // Điện thoại Android: tự xoay ngang cho bàn chơi to hơn (iPhone không hỗ trợ -> bỏ qua)
      if (document.body.classList.contains('touch-ui')) screen.orientation?.lock?.('landscape').catch(() => {});
    } catch {
      document.body.classList.add('fs-fake');
    }
  }
  updateFullscreenUi();
}
function updateFullscreenUi() {
  const on = isFull();
  document.body.classList.toggle('fs', on);
  const b = $('#btn-fs');
  b.textContent = on ? '🗗' : '⛶';
  b.title = on ? 'Thu nhỏ (phím F hoặc Esc)' : 'Toàn màn hình (phím F)';
  requestAnimationFrame(fitCanvas);
}
/** Vẽ canvas đúng độ phân giải màn hình theo kích thước đang hiển thị */
function fitCanvas() {
  const cv = $('#cv');
  if (cv.clientWidth) renderer.resize((cv.clientWidth * (window.devicePixelRatio || 1)) / (TILE * 15));
}
$('#btn-fs').onclick = (e) => { e.currentTarget.blur(); toggleFullscreen(); };
document.addEventListener('fullscreenchange', updateFullscreenUi);
document.addEventListener('webkitfullscreenchange', updateFullscreenUi);
addEventListener('resize', () => requestAnimationFrame(fitCanvas));
addEventListener('keydown', (e) => {
  if (e.target.tagName === 'INPUT' || e.repeat) return;
  if (e.code === 'KeyF' && currentScreen() === 'scr-game') { e.preventDefault(); toggleFullscreen(); }
  if (e.code === 'Escape' && document.body.classList.contains('fs-fake')) toggleFullscreen();   // Esc thoát chế độ giả
});

$('#btn-mute').onclick = (e) => { e.currentTarget.textContent = sfx.toggle() ? '🔇' : '🔊'; e.currentTarget.blur(); };

// chat trong trận
addEventListener('keydown', (e) => {
  if (!S.game || e.key !== 'Enter' || e.target.tagName === 'INPUT') return;
  e.preventDefault(); $('#game-chat-form').classList.remove('hidden'); $('#game-chat-in').focus();
});
$('#game-chat-in').addEventListener('keydown', (e) => {
  if (e.key === 'Escape') { e.target.value = ''; e.target.blur(); }
});
$('#game-chat-in').addEventListener('blur', () => $('#game-chat-form').classList.add('hidden'));
$('#game-chat-form').onsubmit = (e) => {
  e.preventDefault(); const v = $('#game-chat-in').value.trim();
  if (v) S.conn.send({ t: 'chat', text: v });
  $('#game-chat-in').value = ''; $('#game-chat-in').blur();
};

/** Nhận snapshot từ server: lưu vào bộ đệm + hoà giải (reconcile) vị trí của mình */
function onSnapshot(s) {
  const G = S.game; if (!G) return;
  if (s.g) G.grid = s.g;
  const snap = {
    at: performance.now(), ph: s.ph, tl: s.tl, cd: s.cd,
    players: s.p.map((a) => ({ ...decodePlayer(a), ...pickInfo(G.info.get(a[0])) })),
    bombs: s.b.map(decodeBomb), flames: s.f.map(decodeFlame), darts: (s.dt || []).map(decodeDart),
  };
  // Bóng dự đoán: server đã có bóng của mình ở ô đó -> bỏ bóng dự đoán; quá lâu không thấy -> server từ chối
  const wait = Math.max(450, S.ping * 2 + 250);
  G.ghosts = G.ghosts.filter((g) => snap.at - g.born < wait
    && !snap.bombs.some((b) => b.owner === S.myId && Math.round(b.x) === g.x && Math.round(b.y) === g.y));
  G.snaps.push(snap); if (G.snaps.length > 30) G.snaps.shift();
  G.latest = snap; G.phase = s.ph;
  handleEvents(s.e, snap);

  const me = snap.players.find((p) => p.id === S.myId);
  if (!me) return;
  G.me = me;
  // Bỏ các input server đã xử lý, rồi "chơi lại" các input chưa xử lý từ vị trí server
  G.pending = G.pending.filter((i) => i.q > me.ack);
  const sim = { x: me.x, y: me.y, state: me.state, mount: me.mount, speedLv: me.speedLv };
  const world = { grid: G.grid, bombs: snap.bombs };
  if (s.ph === 'play' && me.state !== 'dead') {
    for (const i of G.pending) if (i.d) movePlayer(world, sim, i.d, (speedOf(sim) * TICK_MS) / 1000);
  }
  if (G.pred) {
    const dx = G.pred.x - sim.x, dy = G.pred.y - sim.y;
    if (Math.hypot(dx, dy) < 2) { G.corr.x += dx; G.corr.y += dy; G.prev.x -= dx; G.prev.y -= dy; }
    else { G.corr = { x: 0, y: 0 }; G.prev = { ...sim }; }
  } else G.prev = { ...sim };
  G.pred = sim;
}
const pickInfo = (i) => (i ? { name: i.name, charId: i.charId, team: i.team, bot: i.bot, outfit: i.outfit, skin: i.skin } : {});

/** Mỗi tick client (30Hz): đọc phím -> gửi server -> tự dự đoán di chuyển ngay */
function localTick() {
  const G = S.game;
  const act = input.consume();
  if (!G || !G.latest || !G.pred || !G.me || G.me.state === 'dead' || G.phase === 'end') return;
  // t: loại tin nhắn ('in') · f: ném phi tiêu · r: bom hẹn giờ
  const inp = { t: 'in', q: ++G.seq, d: input.dir(), b: act.b, n: act.n, s: act.s, f: act.t, r: act.r };
  S.conn.send(inp);
  predictBombs(G, act);
  G.pending.push(inp); if (G.pending.length > 90) G.pending.shift();
  G.prev = { ...G.pred };
  if (G.phase === 'play' && inp.d) movePlayer({ grid: G.grid, bombs: G.latest.bombs }, G.pred, inp.d, (speedOf(G.pred) * TICK_MS) / 1000);
  if (inp.d) G.myDir = inp.d;
  G.myMoving = !!inp.d && G.phase === 'play';
}

/**
 * DỰ ĐOÁN ĐẶT BÓNG: hiện quả bóng NGAY khi bấm phím (không chờ server ~50-150ms).
 * Kiểm tra giống hệt luật server (còn lượt bóng, ô trống) để hiếm khi đoán sai.
 */
function predictBombs(G, act) {
  const me = G.me;
  if (G.phase !== 'play' || me.state !== 'alive' || (!act.b && !act.r)) return;
  const x = Math.round(G.pred.x), y = Math.round(G.pred.y);
  const all = [...G.latest.bombs, ...G.ghosts];
  const cellFree = G.grid[y * 15 + x] === '.' && !all.some((b) => Math.round(b.x) === x && Math.round(b.y) === y);
  const born = performance.now();
  if (act.b && cellFree && all.filter((b) => b.owner === S.myId && !b.remote).length < me.maxBombs) {
    G.ghosts.push({ id: 'g' + born, ghost: true, owner: S.myId, x, y, born, range: me.range, remote: false });
    sfx.place();
  } else if (act.r && cellFree && !me.remoteOn && me.remotes > 0 && !G.ghosts.some((g) => g.remote)) {
    G.ghosts.push({ id: 'g' + born, ghost: true, owner: S.myId, x, y, born, range: me.range + 1, remote: true });
    sfx.place();
  }
  if (act.t && me.darts > 0) sfx.kick();
}

/** Nội suy người chơi khác giữa 2 snapshot (vẽ trễ ~80ms để luôn mượt) */
function interpolated(now) {
  const G = S.game, snaps = G.snaps;
  const rt = now - (S.offline ? 40 : 90);
  let a = snaps[0], b = snaps[snaps.length - 1];
  for (let i = snaps.length - 1; i > 0; i--) if (snaps[i - 1].at <= rt) { a = snaps[i - 1]; b = snaps[i]; break; }
  const k = b.at > a.at ? Math.max(0, Math.min(1, (rt - a.at) / (b.at - a.at))) : 1;
  const lerp = (p, q, key) => (q && Math.abs(q[key] - p[key]) < 2 ? q[key] + (p[key] - q[key]) * k : p[key]);
  const players = b.players.map((p) => { const q = a.players.find((o) => o.id === p.id); return { ...p, x: lerp(p, q, 'x'), y: lerp(p, q, 'y') }; });
  // Bóng, tia nước, phi tiêu: lấy snapshot MỚI NHẤT (không vẽ trễ) để phản hồi nhanh nhất
  const L = G.latest, since = now - L.at, prevL = snaps[snaps.length - 2];
  const bombs = L.bombs.map((bb) => {
    const q = bb.moving && prevL ? prevL.bombs.find((o) => o.id === bb.id) : null;   // bóng đang bị đẩy: nội suy
    const kk = Math.min(1, since / TICK_MS);
    return { ...bb, x: q ? q.x + (bb.x - q.x) * kk : bb.x, y: q ? q.y + (bb.y - q.y) * kk : bb.y, left: bb.left - since };
  });
  for (const g of G.ghosts) bombs.push({ ...g, left: (g.remote ? TIMING.REMOTE_MAX : TIMING.BOMB_FUSE) - (now - g.born) });
  const step = Math.min(0.6, (since / 1000) * 15);                                   // phi tiêu bay tiếp giữa 2 snapshot
  const darts = L.darts.map((d) => ({ ...d, x: d.x + [0, 0, 0, -step, step][d.d], y: d.y + [0, -step, step, 0, 0][d.d] }));
  return { players, bombs, flames: L.flames.map((f) => ({ ...f, left: f.left - since })), darts };
}

function handleEvents(events, snap) {
  const pos = (id) => snap.players.find((p) => p.id === id);
  let drops = 0;
  for (const e of events || []) {
    switch (e.k) {
      case 'place': if (e.id !== S.myId) sfx.place(); break;          // bóng của mình đã kêu lúc dự đoán
      case 'dart': if (e.id !== S.myId) sfx.kick(); break;
      case 'dartHit': renderer.splash(e.x, e.y, 5, '#c7d3e0'); break;
      case 'boom': sfx.boom(); renderer.splash(e.x, e.y, 12); renderer.bump(3); break;
      case 'burn': renderer.splash(e.x, e.y, 6, '#ffe28a'); break;
      case 'kick': sfx.kick(); break;
      case 'go': sfx.go(); S.game.goAt = performance.now(); break;
      case 'drop': renderer.drop(e.x, e.y); if (!drops++) sfx.drop(); break;
      case 'pick': {
        if (e.id === S.myId) { sfx.pick(); const p = pos(e.id); if (p) renderer.floatText(p.x, p.y, '+ ' + ITEMS[e.item].name, '#fff36b'); }
        break;
      }
      case 'trap': { sfx.trap(); const p = pos(e.id); if (p) renderer.floatText(p.x, p.y, p.id === S.myId ? 'Bị nhốt! Nhấn Z' : 'Bị nhốt!', '#bfe9ff'); break; }
      case 'pop': {
        sfx.pop(); renderer.splash(e.x, e.y, 24, '#d6f3ff'); renderer.bump(5);
        const p = pos(e.id), by = e.by ? S.game.info.get(e.by) : null;
        if (p) renderer.floatText(e.x, e.y, by ? `${by.name} hạ ${p.name}` : `${p.name} bị loại`, '#ffffff');
        if (e.id === S.myId) toast('Bạn đã bị loại! Xem tiếp trận đấu nhé.');
        break;
      }
      case 'rescue': case 'needle': { sfx.rescue(); const p = pos(e.id); if (p) renderer.floatText(p.x, p.y, e.k === 'rescue' ? 'Được cứu!' : 'Thoát bằng kim!', '#7dffb0'); break; }
      case 'shield': sfx.pick(); break;
      case 'unmount': { sfx.pop(); const p = pos(e.id); if (p) renderer.floatText(p.x, p.y, 'Mất slime!', '#7dffb0'); break; }
    }
  }
}

// ---------------- HUD ----------------
// [icon, trường dữ liệu, phím dùng]
const ME_STATS = [['bomb', 'maxBombs'], ['range', 'range'], ['speed', 'speedLv'], ['kick', 'kick'], ['mount', 'mount'],
  ['needle', 'needles', 'Z'], ['shield', 'shields', 'X'], ['dart', 'darts', 'C'], ['remote', 'remotes', 'V']];
function buildMeHud() {
  const box = $('#hud-me'); box.innerHTML = '';
  for (const [type, , key] of ME_STATS) {
    const d = document.createElement('div'); d.className = 'stat' + (key ? ' slot-item' : '');
    d.title = (ITEMS[type] || SHOP[type]).name + (key ? ` (phím ${key})` : '');
    d.appendChild(itemCanvas(type, 30)); d.insertAdjacentHTML('beforeend', `<span></span>${key ? `<kbd>${key}</kbd>` : ''}`);
    box.appendChild(d);
  }
}
let hudKey = '';
function updateHud(view) {
  const G = S.game, L = G.latest;
  const sec = Math.ceil(L.tl / 1000);
  const timer = $('#hud-timer');
  timer.textContent = `${Math.floor(sec / 60)}:${String(sec % 60).padStart(2, '0')}`;
  timer.classList.toggle('danger', L.ph === 'play' && L.tl <= TIMING.SUDDEN_DEATH);
  $('#hud-ping').textContent = S.offline ? 'Offline' : `${S.ping} ms`;
  const key = view.players.map((p) => p.id + p.state + p.kills).join() + JSON.stringify(G.me && [...ME_STATS.map(([, f]) => G.me[f]), G.me.remoteOn]);
  if (key === hudKey) return;
  hudKey = key;
  $('#hud-players').innerHTML = view.players.map((p) => `
    <span class="hud-p ${p.state}" style="--team:${TEAMS[p.team].color}">${p.state === 'trapped' ? '🫧' : p.state === 'dead' ? '💀' : '🙂'} ${esc(p.name)}${p.kills ? ` ×${p.kills}` : ''}</span>`).join('');
  if (G.me) {
    $('#hud-me').querySelectorAll('.stat').forEach((el, i) => {
      const v = G.me[ME_STATS[i][1]];
      const remoteReady = ME_STATS[i][0] === 'remote' && G.me.remoteOn;     // đã đặt -> bấm V để kích nổ
      el.querySelector('span').textContent = remoteReady ? 'Nổ!' : typeof v === 'boolean' ? (v ? '✓' : '–') : v;
      el.classList.toggle('off', !v && !remoteReady);
      el.classList.toggle('armed', remoteReady);
    });
  }
}
function updateCountdown() {
  const G = S.game, L = G.latest, el = $('#countdown');
  let text = '';
  if (L.ph === 'countdown') text = String(Math.ceil(L.cd / 1000) || 1);
  else if (G.goAt && performance.now() - G.goAt < 700) text = 'BẮT ĐẦU!';
  if (text !== el.textContent) {
    el.textContent = text;
    if (text) { el.classList.remove('pop'); void el.offsetWidth; el.classList.add('pop'); if (/\d/.test(text)) sfx.count(); }
  }
}

function showResult(res) {
  const G = S.game; if (!G) return;
  G.ended = true;
  const myTeam = G.info.get(S.myId)?.team;
  const win = !res.draw && res.team === myTeam;
  (res.draw ? sfx.lose : win ? sfx.win : sfx.lose)();
  const title = res.draw ? ['HOÀ!', 'draw'] : win ? ['CHIẾN THẮNG!', 'win'] : ['THUA RỒI!', 'lose'];
  const rows = [...res.stats].sort((a, b) => res.winners.includes(b.id) - res.winners.includes(a.id) || b.kills - a.kills)
    .map((s) => `<tr><td><span style="color:${TEAMS[s.team].color}">●</span> ${esc(s.name)}${s.id === S.myId ? ' (bạn)' : ''}</td><td>${res.winners.includes(s.id) ? '🏆' : ''}</td><td>${s.kills} hạ</td><td>${res.coins?.[s.id] != null ? `+${res.coins[s.id]} 🪙` : ''}</td></tr>`).join('');
  const r = $('#result');
  r.innerHTML = `<div class="card"><h2 class="${title[1]}">${title[0]}</h2>
    <div class="muted">${res.draw ? 'Không đội nào trụ lại' : `Đội ${TEAMS[res.team].name} thắng`}</div>
    <table>${rows}</table><p class="muted small">Quay về phòng sau ${TIMING.RESULT_TIME / 1000} giây...</p></div>`;
  r.classList.remove('hidden');
}

// ---------------- VÒNG LẶP VẼ (requestAnimationFrame) ----------------
let last = performance.now();
function frame(now) {
  const dtMs = Math.min(100, now - last); last = now;
  const G = S.game;
  if (G && G.latest) {
    G.acc += dtMs;
    while (G.acc >= TICK_MS) { G.acc -= TICK_MS; localTick(); }
    const view = interpolated(now);
    // vị trí của mình = dự đoán (mượt theo alpha) + phần hiệu chỉnh đang tắt dần
    const decay = Math.exp(-dtMs / 90);
    G.corr.x *= decay; G.corr.y *= decay;
    if (G.pred && G.me) {
      const al = G.acc / TICK_MS;
      const mine = view.players.find((p) => p.id === S.myId);
      if (mine) {
        mine.x = G.prev.x + (G.pred.x - G.prev.x) * al + G.corr.x;
        mine.y = G.prev.y + (G.pred.y - G.prev.y) * al + G.corr.y;
        Object.assign(mine, { ...G.me, x: mine.x, y: mine.y, dir: G.myDir, moving: G.myMoving && G.me.state === 'alive', name: mine.name, charId: mine.charId, team: mine.team });
      }
    }
    renderer.draw({ grid: G.grid, players: view.players.filter((p) => p.state !== 'dead'), bombs: view.bombs, flames: view.flames, darts: view.darts, myId: S.myId, time: now, dt: dtMs / 1000 });
    updateHud(view);
    updateCountdown();
  }
  requestAnimationFrame(frame);
}
requestAnimationFrame(frame);

// hiệu ứng nhân vật nhún nhảy ở màn hình chính
setInterval(() => {
  if (!$('#scr-home').classList.contains('active')) return;
  const sel = document.querySelector('.char-card.sel canvas');
  if (sel) paintCharPreview(sel, S.charId, performance.now() / 1000);
}, 50);

// Mở bằng link mời ?room=XXXX -> tự kết nối online sau khi có tên
if (S.pendingJoin) {
  $('#server-note').textContent = `Bạn được mời vào phòng #${S.pendingJoin}. Nhập tên rồi bấm "Chơi Online".`;
}

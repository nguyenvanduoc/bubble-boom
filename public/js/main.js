// ============================================================
// CLIENT: giao diện, kết nối, dự đoán chuyển động & nội suy
// ============================================================
import { TICK_MS, TIMING, CHARACTERS, CHAR_BY_ID, MAPS, MAP_BY_ID, TEAMS, ITEMS, MAX_PLAYERS } from '../shared/constants.js';
import { movePlayer, speedOf, decodePlayer, decodeBomb, decodeFlame } from '../shared/engine.js';
import { Renderer, paintCharPreview, paintMapPreview, drawItem, TILE } from './render.js';
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
};
if (!CHAR_BY_ID[S.charId]) S.charId = 'bin';

const renderer = new Renderer($('#cv'));
const input = new Input();
input.bindTouch($('#touch'));

// ---------------- tiện ích giao diện ----------------
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
      ${m.id === r.host || m.bot ? '' : `<span class="badge ${m.ready ? 'ok' : ''}">${m.ready ? 'Sẵn sàng' : 'Chưa sẵn sàng'}</span>`}`;
    paintCharPreview(el.querySelector('canvas'), m.charId);
    el.querySelector('select').onchange = (e) => S.conn.send({ t: 'team', team: +e.target.value, id: m.id });
    el.querySelector('.kick')?.addEventListener('click', () => S.conn.send({ t: 'kick', id: m.id }));
    slots.appendChild(el);
  }
  $('#btn-addbot').style.display = host ? '' : 'none';
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
    b.innerHTML = '<canvas></canvas>'; paintCharPreview(b.querySelector('canvas'), c.id);
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

// ---------------- NHẬN TIN TỪ SERVER ----------------
function onMsg(m) {
  switch (m.t) {
    case 'welcome':
      S.myId = m.id;
      S.conn.send({ t: 'hello', name: S.name, char: S.charId });
      if (S.offline) S.conn.send({ t: 'create', name: 'Luyện tập với bot', map: MAPS[0].id });
      break;
    case 'lobby':
      S.lobby = m;
      if (!S.offline) S.room = null;   // server chỉ gửi danh sách sảnh cho người KHÔNG ở trong phòng
      if (!S.offline && !S.room) {
        if (S.pendingJoin) { S.conn.send({ t: 'join', room: S.pendingJoin }); S.pendingJoin = null; }
        if (!S.game) show('scr-lobby');
      }
      renderLobby();
      break;
    case 'room':
      S.room = m.room;
      if (S.offlineSetup) { S.offlineSetup = false; for (let i = 0; i < 3; i++) S.conn.send({ t: 'addBot' }); }
      if (m.room.status === 'waiting' && (!S.game || S.game.ended)) { endGameView(); show('scr-room'); }
      renderRoom();
      break;
    case 'start': startGame(m); break;
    case 's': onSnapshot(m); break;
    case 'end': showResult(m.result); break;
    case 'chat': addChat(m.from, m.text); break;
    case 'err': toast(m.msg); break;
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
    acc: 0, phase: 'countdown', ended: false, lastCount: -1, goAt: 0,
  };
  renderer.setTheme(MAP_BY_ID[m.map].theme);
  renderer.particles = [];
  $('#result').classList.add('hidden');
  $('#game-chat').innerHTML = '';
  $('#touch').classList.toggle('hidden', !(matchMedia('(pointer: coarse)').matches || navigator.maxTouchPoints > 0));
  buildMeHud();
  document.activeElement?.blur();
  show('scr-game');
}
function endGameView() { S.game = null; $('#result').classList.add('hidden'); }

let exitArmed = 0;
$('#game-exit').onclick = (e) => {
  e.currentTarget.blur();
  if (performance.now() - exitArmed > 2500) { exitArmed = performance.now(); return toast('Bấm ✕ lần nữa để thoát trận'); }
  if (S.offline) { closeConn(); show('scr-home'); } else { S.conn.send({ t: 'leave' }); S.game = null; S.room = null; }
};
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
    bombs: s.b.map(decodeBomb), flames: s.f.map(decodeFlame),
  };
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
const pickInfo = (i) => (i ? { name: i.name, charId: i.charId, team: i.team, bot: i.bot } : {});

/** Mỗi tick client (30Hz): đọc phím -> gửi server -> tự dự đoán di chuyển ngay */
function localTick() {
  const G = S.game;
  const act = input.consume();
  if (!G || !G.latest || !G.pred || !G.me || G.me.state === 'dead' || G.phase === 'end') return;
  const inp = { t: 'in', q: ++G.seq, d: input.dir(), b: act.b, n: act.n, s: act.s };
  S.conn.send(inp);
  G.pending.push(inp); if (G.pending.length > 90) G.pending.shift();
  G.prev = { ...G.pred };
  if (G.phase === 'play' && inp.d) movePlayer({ grid: G.grid, bombs: G.latest.bombs }, G.pred, inp.d, (speedOf(G.pred) * TICK_MS) / 1000);
  if (inp.d) G.myDir = inp.d;
  G.myMoving = !!inp.d && G.phase === 'play';
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
  const bombs = b.bombs.map((bb) => {
    const q = a.bombs.find((o) => o.id === bb.id);
    return { ...bb, x: lerp(bb, q, 'x'), y: lerp(bb, q, 'y'), left: q ? q.left + (bb.left - q.left) * k : bb.left };
  });
  return { players, bombs, flames: b.flames };
}

function handleEvents(events, snap) {
  const pos = (id) => snap.players.find((p) => p.id === id);
  let drops = 0;
  for (const e of events || []) {
    switch (e.k) {
      case 'place': sfx.place(); break;
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
const ME_STATS = [['bomb', 'maxBombs'], ['range', 'range'], ['speed', 'speedLv'], ['needle', 'needles'], ['shield', 'shields'], ['kick', 'kick'], ['mount', 'mount']];
function buildMeHud() {
  const box = $('#hud-me'); box.innerHTML = '';
  for (const [type] of ME_STATS) {
    const d = document.createElement('div'); d.className = 'stat'; d.title = ITEMS[type].name;
    d.appendChild(itemCanvas(type, 30)); d.insertAdjacentHTML('beforeend', '<span></span>');
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
  const key = view.players.map((p) => p.id + p.state + p.kills).join() + JSON.stringify(G.me && ME_STATS.map(([, f]) => G.me[f]));
  if (key === hudKey) return;
  hudKey = key;
  $('#hud-players').innerHTML = view.players.map((p) => `
    <span class="hud-p ${p.state}" style="--team:${TEAMS[p.team].color}">${p.state === 'trapped' ? '🫧' : p.state === 'dead' ? '💀' : '🙂'} ${esc(p.name)}${p.kills ? ` ×${p.kills}` : ''}</span>`).join('');
  if (G.me) {
    $('#hud-me').querySelectorAll('.stat').forEach((el, i) => {
      const v = G.me[ME_STATS[i][1]];
      el.querySelector('span').textContent = typeof v === 'boolean' ? (v ? '✓' : '–') : v;
      el.classList.toggle('off', !v);
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
    .map((s) => `<tr><td><span style="color:${TEAMS[s.team].color}">●</span> ${esc(s.name)}${s.id === S.myId ? ' (bạn)' : ''}</td><td>${res.winners.includes(s.id) ? '🏆' : ''}</td><td>${s.kills} hạ</td></tr>`).join('');
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
    renderer.draw({ grid: G.grid, players: view.players.filter((p) => p.state !== 'dead'), bombs: view.bombs, flames: view.flames, myId: S.myId, time: now, dt: dtMs / 1000 });
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

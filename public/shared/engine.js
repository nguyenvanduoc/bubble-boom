// ============================================================
// ENGINE MÔ PHỎNG GAME (chạy trên server, và trong trình duyệt khi chơi offline)
// Server là "nguồn sự thật" (authoritative): client chỉ gửi phím bấm,
// server tính vị trí, bóng nổ, ai bị nhốt... rồi gửi trạng thái về.
// ============================================================
import {
  COLS, ROWS, TICK_MS, TIMING, DIRS, ITEMS, ITEM_BY_CH, CHARACTERS, CHAR_BY_ID,
  MAPS, MAP_BY_ID, SPAWN_ORDER, BOX_DENSITY, ITEM_CHANCE, KICK_SPEED,
  TRAPPED_SPEED, MOUNT_SPEED, speedFromLevel,
} from './constants.js';

const EPS = 1e-4;
export const idx = (x, y) => y * COLS + x;
export const inBounds = (x, y) => x >= 0 && y >= 0 && x < COLS && y < ROWS;
/** Làm tròn 3 chữ số thập phân để server và client tính ra kết quả GIỐNG HỆT nhau */
export const quant = (v) => Math.round(v * 1000) / 1000;

// ---------------- Tạo bản đồ ----------------
function randomItemCh(rng) {
  const list = Object.values(ITEMS);
  let r = rng() * list.reduce((s, it) => s + it.weight, 0);
  for (const it of list) { if ((r -= it.weight) <= 0) return it.ch; }
  return list[0].ch;
}

export function buildMap(mapDef, rng = Math.random) {
  const grid = new Array(COLS * ROWS).fill('.');
  const hidden = new Map();          // vật phẩm giấu trong thùng: index -> ký tự
  const spawns = {};
  for (let y = 0; y < ROWS; y++) {
    for (let x = 0; x < COLS; x++) {
      const ch = mapDef.rows[y][x];
      const i = idx(x, y);
      if (ch === '#' || ch === '~') grid[i] = '#';          // '~' nước biển = chặn như tường
      else if (ch === 'x' || (ch === '?' && rng() < BOX_DENSITY)) grid[i] = 'x';
      else if (ch >= '1' && ch <= '6') spawns[ch] = { x, y };
      if (grid[i] === 'x' && rng() < ITEM_CHANCE) hidden.set(i, randomItemCh(rng));
    }
  }
  return { grid, hidden, spawns };
}

// ---------------- Va chạm & di chuyển (DÙNG CHUNG server + client) ----------------
/** world = { grid, bombs } ; trả về true nếu ô (x,y) chặn người chơi */
export function cellBlocked(world, x, y) {
  if (!inBounds(x, y)) return true;
  const c = world.grid[idx(x, y)];
  if (c === '#' || c === 'x' || c === 'y') return true;   // tường, thùng, thùng đang vỡ
  for (const b of world.bombs) if (Math.round(b.x) === x && Math.round(b.y) === y) return true;
  return false;
}

export function speedOf(p) {
  if (p.state === 'trapped') return TRAPPED_SPEED;
  const base = speedFromLevel(p.speedLv);
  return p.mount ? Math.max(base, MOUNT_SPEED) : base;
}

/**
 * Di chuyển người chơi theo lưới có "trượt góc": khi rẽ mà lệch làn
 * một chút, nhân vật tự trượt vào làn rồi mới đi tiếp (giống game gốc thể loại này).
 * onBlocked(cx, cy, dx, dy) được gọi khi bị chặn - dùng cho Găng Đẩy bóng.
 */
export function movePlayer(world, p, dir, dist, onBlocked) {
  if (!dir) return;
  const [dx, dy] = DIRS[dir];
  if (dx) moveAxis(world, p, 'x', 'y', dx, dist, onBlocked);
  else moveAxis(world, p, 'y', 'x', dy, dist, onBlocked);
  p.x = quant(p.x); p.y = quant(p.y);
}

function moveAxis(world, p, A, B, s, dist, onBlocked) {
  const blocked = (ca, cb) => (A === 'x' ? cellBlocked(world, ca, cb) : cellBlocked(world, cb, ca));
  let rem = dist;
  const lane0 = Math.round(p[B]);
  const off = p[B] - lane0;
  if (Math.abs(off) > EPS) {
    // Đang lệch làn: chọn làn gần nhất còn trống phía trước để trượt vào
    const ca = Math.round(p[A]);
    const lanes = [lane0];
    if (Math.abs(off) > 0.28) lanes.push(lane0 + Math.sign(off));
    let lane = null;
    for (const l of lanes) if (!blocked(ca + s, l)) { lane = l; break; }
    if (lane === null) return;
    const need = lane - p[B];
    const m = Math.min(Math.abs(need), rem);
    p[B] += Math.sign(need) * m;
    rem -= m;
    if (Math.abs(lane - p[B]) > EPS) return;
    p[B] = lane;
  }
  if (rem <= EPS) return;
  const lane = Math.round(p[B]);
  const cur = p[A];
  const edge = s > 0 ? Math.ceil(cur - EPS) : Math.floor(cur + EPS);
  const next = edge + s;
  let target = cur + s * rem;
  if (blocked(next, lane)) {
    target = s > 0 ? Math.min(target, edge) : Math.max(target, edge);
    if (Math.abs(target - edge) < EPS && onBlocked) {
      if (A === 'x') onBlocked(next, lane, s, 0); else onBlocked(lane, next, 0, s);
    }
  }
  p[A] = target;
}

/** Danh sách ô theo hình xoắn ốc từ viền ngoài vào giữa */
function spiralOrder() {
  const out = [];
  let x0 = 0, y0 = 0, x1 = COLS - 1, y1 = ROWS - 1;
  while (x0 <= x1 && y0 <= y1) {
    for (let x = x0; x <= x1; x++) out.push(idx(x, y0));
    for (let y = y0 + 1; y <= y1; y++) out.push(idx(x1, y));
    if (y0 < y1) for (let x = x1 - 1; x >= x0; x--) out.push(idx(x, y1));
    if (x0 < x1) for (let y = y1 - 1; y > y0; y--) out.push(idx(x0, y));
    x0++; y0++; x1--; y1--;
  }
  return out;
}

// ---------------- Mã hoá gọn dữ liệu gửi qua mạng ----------------
const STATES = ['alive', 'trapped', 'dead'];
export const PLAYER_FIELDS = ['id', 'x', 'y', 'dir', 'moving', 'state', 'trapLeft', 'inv', 'shieldLeft',
  'mount', 'kick', 'maxBombs', 'range', 'speedLv', 'needles', 'shields', 'ack', 'kills'];
export function decodePlayer(arr) {
  const o = {};
  PLAYER_FIELDS.forEach((f, i) => { o[f] = arr[i]; });
  o.state = STATES[o.state]; o.moving = !!o.moving; o.mount = !!o.mount; o.kick = !!o.kick; o.inv = !!o.inv;
  return o;
}
export const decodeBomb = (a) => ({ id: a[0], x: a[1], y: a[2], left: a[3], owner: a[4], range: a[5], moving: !!a[6] });
export const decodeFlame = (a) => ({ x: a[0], y: a[1], k: a[2], d: a[3], left: a[4] });

// ============================================================
//                         LỚP GAME
// ============================================================
export class Game {
  /** players: [{ id, name, charId, team, bot, loadout? }] - loadout lấy từ cửa hàng (profile.js) */
  constructor({ mapId, players, rng = Math.random }) {
    this.map = MAP_BY_ID[mapId] || MAPS[0];
    this.rng = rng;
    const { grid, hidden, spawns } = buildMap(this.map, rng);
    this.grid = grid;
    this.hidden = hidden;
    this.now = 0;
    this.phase = 'countdown';      // countdown -> play -> end
    this.playStart = TIMING.COUNTDOWN;
    this.players = new Map();
    this.bombs = [];
    this.flames = [];
    this.breaking = [];
    this.events = [];              // sự kiện gửi kèm snapshot (âm thanh, hiệu ứng)
    this.gridVersion = 1;
    this.nextBombId = 1;
    this.result = null;
    this.spiral = spiralOrder();   // thứ tự tường rơi khi thu hẹp bản đồ
    this.fallen = 0;
    players.forEach((info, i) => {
      const sp = spawns[SPAWN_ORDER[i]] || spawns['1'];
      const ch = CHAR_BY_ID[info.charId] || CHARACTERS[0];
      const lo = info.loadout || {};
      const bon = lo.bonus || {};
      this.players.set(info.id, {
        id: info.id, name: info.name, charId: ch.id, team: info.team, bot: !!info.bot,
        x: sp.x, y: sp.y, dir: 2, moving: false,
        // chỉ số khởi đầu = nhân vật + trang bị, nhưng không vượt giới hạn của nhân vật
        maxBombs: Math.min(ch.b[0] + (bon.b | 0), ch.b[1]),
        range: Math.min(ch.r[0] + (bon.r | 0), ch.r[1]),
        speedLv: Math.min(ch.s[0] + (bon.s | 0), ch.s[1]),
        needles: lo.needles | 0, shields: lo.shields | 0, kick: !!lo.kick, mount: false,
        trapBonus: lo.trapBonus | 0, gear: lo.gear || [], boxes: 0,
        state: 'alive', trapUntil: 0, trappedBy: null, invulnUntil: 0, shieldUntil: 0,
        kills: 0, ack: 0, queue: [], budget: 0, deadAt: 0, ai: {},
      });
    });
  }

  infoList() {
    return [...this.players.values()].map((p) => ({ id: p.id, name: p.name, charId: p.charId, team: p.team, bot: p.bot }));
  }

  bombAt(x, y) {
    return this.bombs.find((b) => Math.round(b.x) === x && Math.round(b.y) === y) || null;
  }

  /** Nhận input của người chơi: { q: số thứ tự, d: hướng 0-4, b: đặt bóng, n: dùng kim, s: dùng khiên } */
  pushInput(id, inp) {
    const p = this.players.get(id);
    if (!p || typeof inp !== 'object') return;
    p.queue.push({ q: inp.q | 0, d: Math.max(0, Math.min(4, inp.d | 0)), b: !!inp.b, n: !!inp.n, s: !!inp.s });
    if (p.queue.length > 15) p.queue.splice(0, p.queue.length - 15); // mạng lag quá -> bỏ bớt
  }

  removePlayer(id) {
    const p = this.players.get(id);
    if (p && p.state !== 'dead') this.die(p, null);
  }

  // ---------------- Vòng lặp chính: gọi mỗi TICK_MS ----------------
  tick() {
    this.now += TICK_MS;
    const now = this.now;
    if (this.phase === 'countdown' && now >= TIMING.COUNTDOWN) {
      this.phase = 'play';
      this.events.push({ k: 'go' });
    }
    // 1) Xử lý input. "budget" giới hạn tối đa 1 input/tick trung bình (chống hack tốc độ)
    for (const p of this.players.values()) {
      p.budget = Math.min(p.budget + 1, 4);
      while (p.queue.length && p.budget >= 1) { p.budget--; this.applyInput(p, p.queue.shift()); }
    }
    if (this.phase !== 'play') { this.flushOld(); return; }

    this.suddenDeath();
    this.updateSlidingBombs();
    // 2) Bóng đến giờ nổ (kể cả nổ dây chuyền)
    for (let guard = 0; guard < 64; guard++) {
      const i = this.bombs.findIndex((b) => b.at <= now);
      if (i < 0) break;
      const [b] = this.bombs.splice(i, 1);
      this.explode(b);
    }
    // 3) Thùng vỡ xong -> lộ vật phẩm
    this.breaking = this.breaking.filter((br) => {
      if (br.at > now) return true;
      this.grid[br.i] = this.hidden.get(br.i) || '.';
      this.hidden.delete(br.i);
      this.gridVersion++;
      return false;
    });
    this.flushOld();
    // 4) Tia nước trúng người
    const fire = new Map();
    for (const f of this.flames) fire.set(idx(f.x, f.y), f.owner);
    for (const p of this.players.values()) {
      if (p.state !== 'alive') continue;
      const k = idx(Math.round(p.x), Math.round(p.y));
      if (fire.has(k)) this.hit(p, fire.get(k));
    }
    // 5) Bong bóng: hết giờ thì vỡ; đồng đội chạm = cứu; đối thủ chạm = vỡ
    for (const p of this.players.values()) {
      if (p.state !== 'trapped') continue;
      if (now >= p.trapUntil) { this.die(p, p.trappedBy); continue; }
      for (const q of this.players.values()) {
        if (q === p || q.state !== 'alive') continue;
        if (Math.abs(q.x - p.x) < 0.7 && Math.abs(q.y - p.y) < 0.7) {
          if (q.team === p.team) {
            p.state = 'alive'; p.invulnUntil = now + TIMING.RESCUE_INVULN;
            this.events.push({ k: 'rescue', id: p.id, by: q.id });
          } else this.die(p, q.id);
          break;
        }
      }
    }
    // 6) Nhặt vật phẩm
    for (const p of this.players.values()) {
      if (p.state !== 'alive') continue;
      const i = idx(Math.round(p.x), Math.round(p.y));
      const type = ITEM_BY_CH[this.grid[i]];
      if (type) { this.grid[i] = '.'; this.gridVersion++; this.applyItem(p, type); }
    }
    // 7) Kiểm tra thắng thua
    this.checkEnd();
  }

  /** Thu hẹp bản đồ: tường rơi từ ngoài vào trong, ai đứng dưới sẽ thua ngay */
  suddenDeath() {
    const passed = TIMING.SUDDEN_DEATH - this.timeLeft();
    if (passed < 0) return;
    const want = Math.min(this.spiral.length, Math.floor(passed / TIMING.SUDDEN_STEP) + 1);
    while (this.fallen < want) {
      const k = this.spiral[this.fallen++];
      if (this.grid[k] === '#') continue;
      const x = k % COLS, y = (k / COLS) | 0;
      this.grid[k] = '#'; this.hidden.delete(k); this.gridVersion++;
      this.breaking = this.breaking.filter((br) => br.i !== k);
      this.bombs = this.bombs.filter((b) => Math.round(b.x) !== x || Math.round(b.y) !== y);
      for (const p of this.players.values()) {
        if (p.state !== 'dead' && Math.abs(p.x - x) < 0.75 && Math.abs(p.y - y) < 0.75) this.die(p, null);
      }
      this.events.push({ k: 'drop', x, y });
    }
  }

  flushOld() {
    if (this.flames.length) this.flames = this.flames.filter((f) => f.until > this.now);
  }

  applyInput(p, inp) {
    p.ack = inp.q;
    if (this.phase !== 'play' || p.state === 'dead') { p.moving = false; return; }
    const now = this.now;
    if (inp.n && p.state === 'trapped' && p.needles > 0) {
      p.needles--; p.state = 'alive'; p.invulnUntil = now + TIMING.RESCUE_INVULN;
      this.events.push({ k: 'needle', id: p.id });
    }
    if (inp.s && p.state === 'alive' && p.shields > 0 && now >= p.shieldUntil) {
      p.shields--; p.shieldUntil = now + TIMING.SHIELD_TIME;
      this.events.push({ k: 'shield', id: p.id });
    }
    if (inp.b && p.state === 'alive') this.placeBomb(p);
    if (inp.d) {
      p.dir = inp.d; p.moving = true;
      movePlayer(this, p, inp.d, (speedOf(p) * TICK_MS) / 1000, (cx, cy, dx, dy) => {
        if (!p.kick || p.state !== 'alive') return;
        const b = this.bombAt(cx, cy);
        if (b && !b.vx && !b.vy) { b.vx = dx; b.vy = dy; this.events.push({ k: 'kick', x: cx, y: cy }); }
      });
    } else p.moving = false;
  }

  placeBomb(p) {
    const cx = Math.round(p.x), cy = Math.round(p.y);
    if (this.bombs.filter((b) => b.owner === p.id).length >= p.maxBombs) return;
    if (this.bombAt(cx, cy) || this.grid[idx(cx, cy)] !== '.') return;
    this.bombs.push({ id: this.nextBombId++, owner: p.id, x: cx, y: cy, range: p.range,
      at: this.now + TIMING.BOMB_FUSE, vx: 0, vy: 0 });
    this.events.push({ k: 'place', x: cx, y: cy });
  }

  updateSlidingBombs() {
    for (const b of this.bombs) {
      if (!b.vx && !b.vy) continue;
      const A = b.vx ? 'x' : 'y', B = b.vx ? 'y' : 'x';
      const s = b.vx || b.vy;
      const lane = Math.round(b[B]);
      const cur = b[A];
      const edge = s > 0 ? Math.ceil(cur - EPS) : Math.floor(cur + EPS);
      const next = edge + s;
      const nx = A === 'x' ? next : lane, ny = A === 'x' ? lane : next;
      let target = cur + (s * KICK_SPEED * TICK_MS) / 1000;
      if (this.slideBlocked(b, nx, ny)) {
        target = s > 0 ? Math.min(target, edge) : Math.max(target, edge);
        if (Math.abs(target - edge) < EPS) { b.vx = 0; b.vy = 0; }
      }
      b[A] = quant(target);
    }
  }

  slideBlocked(bomb, x, y) {
    if (!inBounds(x, y)) return true;
    const c = this.grid[idx(x, y)];
    if (c === '#' || c === 'x' || c === 'y') return true;
    if (this.bombs.some((o) => o !== bomb && Math.round(o.x) === x && Math.round(o.y) === y)) return true;
    for (const p of this.players.values()) {
      if (p.state !== 'dead' && Math.abs(p.x - x) < 0.75 && Math.abs(p.y - y) < 0.75) return true;
    }
    return false;
  }

  addFlame(x, y, k, d, owner) {
    this.flames.push({ x, y, k, d, owner, until: this.now + TIMING.FLAME_TIME });
  }

  explode(b) {
    const now = this.now;
    const cx = Math.round(b.x), cy = Math.round(b.y);
    this.addFlame(cx, cy, 'c', 0, b.owner);
    for (let d = 1; d <= 4; d++) {
      const [dx, dy] = DIRS[d];
      for (let i = 1; i <= b.range; i++) {
        const x = cx + dx * i, y = cy + dy * i;
        if (!inBounds(x, y)) break;
        const k = idx(x, y);
        const c = this.grid[k];
        if (c === '#' || c === 'y') break;
        if (c === 'x') {                         // thùng: tia dừng lại, thùng bắt đầu vỡ
          this.grid[k] = 'y'; this.gridVersion++;
          this.breaking.push({ i: k, at: now + TIMING.BOX_BREAK_TIME });
          const owner = this.players.get(b.owner);
          if (owner) owner.boxes++;                // đếm thùng phá được -> thưởng xu
          break;
        }
        const other = this.bombAt(x, y);
        if (other) {                             // nổ dây chuyền
          other.at = Math.min(other.at, now + TIMING.CHAIN_DELAY);
          other.vx = other.vy = 0; other.x = x; other.y = y;
          this.addFlame(x, y, 'e', d, b.owner);
          break;
        }
        if (ITEM_BY_CH[c]) { this.grid[k] = '.'; this.gridVersion++; this.events.push({ k: 'burn', x, y }); }
        this.addFlame(x, y, i === b.range ? 'e' : 'a', d, b.owner);
      }
    }
    this.events.push({ k: 'boom', x: cx, y: cy });
  }

  hit(p, ownerId) {
    const now = this.now;
    if (now < p.invulnUntil || now < p.shieldUntil) return;
    if (p.mount) {
      p.mount = false; p.invulnUntil = now + TIMING.MOUNT_LOSS_INVULN;
      this.events.push({ k: 'unmount', id: p.id });
      return;
    }
    p.state = 'trapped'; p.trapUntil = now + TIMING.TRAP_TIME + p.trapBonus; p.trappedBy = ownerId; p.moving = false;
    this.events.push({ k: 'trap', id: p.id });
  }

  die(p, killerId) {
    p.state = 'dead'; p.deadAt = this.now;
    const killer = killerId != null ? this.players.get(killerId) : null;
    if (killer && killer.team !== p.team) killer.kills++;
    this.events.push({ k: 'pop', id: p.id, x: p.x, y: p.y, by: killerId });
  }

  applyItem(p, type) {
    const ch = CHAR_BY_ID[p.charId];
    switch (type) {
      case 'bomb': p.maxBombs = Math.min(p.maxBombs + 1, ch.b[1]); break;
      case 'range': p.range = Math.min(p.range + 1, ch.r[1]); break;
      case 'speed': p.speedLv = Math.min(p.speedLv + 1, ch.s[1]); break;
      case 'maxrange': p.range = ch.r[1]; break;
      case 'needle': p.needles = Math.min(p.needles + 1, 3); break;
      case 'shield': p.shields = Math.min(p.shields + 1, 3); break;
      case 'kick': p.kick = true; break;
      case 'mount': p.mount = true; break;
    }
    this.events.push({ k: 'pick', id: p.id, item: type });
  }

  timeLeft() {
    if (this.phase === 'countdown') return TIMING.MATCH_TIME;
    return Math.max(0, TIMING.MATCH_TIME - (this.now - this.playStart));
  }

  checkEnd() {
    if (this.phase !== 'play') return;
    const left = new Set(), alive = new Set();
    for (const p of this.players.values()) {
      if (p.state !== 'dead') left.add(p.team);
      if (p.state === 'alive') alive.add(p.team);
    }
    if (left.size === 0) return this.finish(null);
    if (left.size === 1 && alive.size === 1) return this.finish([...left][0]);
    if (this.timeLeft() <= 0) return this.finish(null);
  }

  finish(team) {
    this.phase = 'end';
    const players = [...this.players.values()];
    this.result = {
      draw: team === null,
      team,
      winners: team === null ? [] : players.filter((p) => p.team === team).map((p) => p.id),
      stats: players.map((p) => ({ id: p.id, name: p.name, team: p.team, kills: p.kills, boxes: p.boxes, bot: p.bot, alive: p.state !== 'dead' })),
    };
    this.events.push({ k: 'end' });
  }

  /** Ảnh chụp trạng thái gửi cho client. includeGrid: gửi lưới khi có thay đổi */
  snapshot(includeGrid) {
    const now = this.now;
    const s = {
      t: 's', now, ph: this.phase, tl: Math.round(this.timeLeft()),
      cd: Math.max(0, TIMING.COUNTDOWN - now),
      p: [...this.players.values()].map((p) => [
        p.id, p.x, p.y, p.dir, p.moving ? 1 : 0, STATES.indexOf(p.state),
        p.state === 'trapped' ? Math.max(0, Math.round(p.trapUntil - now)) : 0,
        now < p.invulnUntil ? 1 : 0, Math.max(0, Math.round(p.shieldUntil - now)),
        p.mount ? 1 : 0, p.kick ? 1 : 0, p.maxBombs, p.range, p.speedLv, p.needles, p.shields, p.ack, p.kills,
      ]),
      b: this.bombs.map((b) => [b.id, b.x, b.y, Math.max(0, Math.round(b.at - now)), b.owner, b.range, b.vx || b.vy ? 1 : 0]),
      f: this.flames.map((f) => [f.x, f.y, f.k, f.d, Math.round(f.until - now)]),
      e: this.events,
    };
    if (includeGrid) { s.g = this.grid.join(''); s.gv = this.gridVersion; }
    return s;
  }

  flushEvents() { this.events = []; }
}

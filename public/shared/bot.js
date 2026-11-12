// ============================================================
// AI ĐƠN GIẢN CHO BOT: né bóng, phá thùng, nhặt đồ, đi chọc bong bóng đối thủ
// Bot tạo ra input giống hệt người chơi thật -> dùng chung luật engine.
// ============================================================
import { COLS, ROWS, DIRS, TIMING } from './constants.js';
import { idx, inBounds, speedOf } from './engine.js';

const N = COLS * ROWS;
const solid = (c) => c === '#' || c === 'x' || c === 'y';

/** Các ô bị tia nước của 1 quả bóng quét qua */
function blastCells(game, b, bombCells) {
  const out = [idx(b.x, b.y)];
  for (let d = 1; d <= 4; d++) {
    const [dx, dy] = DIRS[d];
    for (let i = 1; i <= b.range; i++) {
      const x = b.x + dx * i, y = b.y + dy * i;
      if (!inBounds(x, y)) break;
      const k = idx(x, y);
      if (solid(game.grid[k])) break;
      out.push(k);
      if (bombCells.has(k)) break;
    }
  }
  return out;
}

/** danger[i] = thời điểm sớm nhất ô i bị tia nước (Infinity = an toàn) */
function dangerMap(game, extra) {
  // Bom Hẹn Giờ có thể bị kích nổ bất cứ lúc nào -> coi như sắp nổ
  const bombs = game.bombs.map((b) => ({ x: Math.round(b.x), y: Math.round(b.y), range: b.range, at: b.remote ? Math.min(b.at, game.now + 400) : b.at }));
  if (extra) bombs.push(extra);
  const bombCells = new Map(bombs.map((b) => [idx(b.x, b.y), b]));
  const blasts = bombs.map((b) => blastCells(game, b, bombCells));
  // lan truyền nổ dây chuyền
  for (let it = 0; it < 4; it++) {
    bombs.forEach((b, j) => {
      for (const k of blasts[j]) { const o = bombCells.get(k); if (o && o.at > b.at) o.at = b.at; }
    });
  }
  const danger = new Array(N).fill(Infinity);
  bombs.forEach((b, j) => { for (const k of blasts[j]) danger[k] = Math.min(danger[k], b.at); });
  for (const f of game.flames) danger[idx(f.x, f.y)] = game.now;
  return { danger, bombCells };
}

/** BFS tìm đường. ok(k, dist) quyết định có đi qua ô k được không. goal(k) = đích */
function bfs(game, start, bombCells, ok, goal) {
  const prev = new Int16Array(N).fill(-1);
  const dist = new Int16Array(N).fill(-1);
  dist[start] = 0;
  const q = [start];
  for (let h = 0; h < q.length; h++) {
    const k = q[h];
    if (goal(k, dist[k])) {
      let c = k;
      while (prev[c] !== -1 && prev[c] !== start) c = prev[c];
      return { target: k, first: k === start ? start : c, dist: dist[k] };
    }
    const x = k % COLS, y = (k / COLS) | 0;
    for (let d = 1; d <= 4; d++) {
      const nx = x + DIRS[d][0], ny = y + DIRS[d][1];
      if (!inBounds(nx, ny)) continue;
      const nk = idx(nx, ny);
      if (dist[nk] !== -1 || solid(game.grid[nk]) || bombCells.has(nk)) continue;
      if (!ok(nk, dist[k] + 1)) continue;
      dist[nk] = dist[k] + 1; prev[nk] = k; q.push(nk);
    }
  }
  return null;
}

function dirTo(p, cx, cy, k) {
  const tx = k % COLS, ty = (k / COLS) | 0;
  if (tx === cx && ty === cy) {                 // đã ở đích -> căn vào giữa ô
    if (Math.abs(p.x - cx) > 0.06) return p.x < cx ? 4 : 3;
    if (Math.abs(p.y - cy) > 0.06) return p.y < cy ? 2 : 1;
    return 0;
  }
  if (tx > cx) return 4; if (tx < cx) return 3; if (ty > cy) return 2; return 1;
}

/** Giá trị của việc đặt bóng tại (cx,cy): số thùng phá được + đối thủ trong tầm */
function bombValue(game, p, cx, cy) {
  let v = 0;
  for (let d = 1; d <= 4; d++) {
    const [dx, dy] = DIRS[d];
    for (let i = 1; i <= p.range; i++) {
      const x = cx + dx * i, y = cy + dy * i;
      if (!inBounds(x, y)) break;
      const c = game.grid[idx(x, y)];
      if (c === 'x') { v += 1; break; }
      if (c === '#' || c === 'y') break;
      for (const o of game.players.values()) {
        if (o.team === p.team || o.state !== 'alive') continue;
        const ox = Math.round(o.x), oy = Math.round(o.y);
        if (ox === x && oy === y) v += 4;                       // đối thủ nằm trên đường tia nước
        else if (Math.abs(ox - x) + Math.abs(oy - y) === 1) v += 0.6; // sát đường tia -> ép góc
      }
    }
  }
  return v;
}

export function thinkBot(game, p) {
  const ai = p.ai;
  ai.q = (ai.q | 0) + 1;
  const inp = { q: ai.q, d: 0, b: 0, n: 0, s: 0 };
  if (game.phase !== 'play' || p.state === 'dead') return inp;
  const now = game.now;

  if (p.state === 'trapped') {                       // bị nhốt: có kim thì dùng sau 1 nhịp "phản xạ"
    if (p.needles > 0) {
      if (!ai.needleAt) ai.needleAt = now + 300 + Math.random() * 900;
      if (now >= ai.needleAt) { inp.n = 1; ai.needleAt = 0; }
    }
    return inp;
  }

  const cx = Math.round(p.x), cy = Math.round(p.y), start = idx(cx, cy);
  const msPerCell = 1000 / speedOf(p);
  const { danger, bombCells } = dangerMap(game);
  bombCells.delete(start);                           // được đi ra khỏi quả bóng đang đứng

  // 1) Đang đứng trong vùng nguy hiểm -> chạy tới ô an toàn gần nhất
  if (danger[start] !== Infinity) {
    const path = bfs(game, start, bombCells,
      (k, dist) => danger[k] === Infinity || danger[k] - now > dist * msPerCell + 250,
      (k) => danger[k] === Infinity);
    if (path) inp.d = dirTo(p, cx, cy, path.first);
    else if (p.shields > 0 && danger[start] - now < 400) inp.s = 1;
    return inp;
  }

  // 2) Có nên đặt bóng ở đây không? (chỉ khi chắc chắn chạy thoát được)
  const myBombs = game.bombs.filter((b) => b.owner === p.id).length;
  const centered = Math.abs(p.x - cx) < 0.3 && Math.abs(p.y - cy) < 0.3;
  if (centered && myBombs < p.maxBombs && now >= (ai.bombCd || 0) && !game.bombAt(cx, cy)) {
    const value = bombValue(game, p, cx, cy);
    if (value > 0) {
      const extra = { x: cx, y: cy, range: p.range, at: now + TIMING.BOMB_FUSE };
      const dm = dangerMap(game, extra);
      dm.bombCells.delete(start);
      const esc = bfs(game, start, dm.bombCells,
        (k, dist) => dm.danger[k] - now > dist * msPerCell + 250,
        (k) => dm.danger[k] === Infinity);
      if (esc && esc.dist * msPerCell < TIMING.BOMB_FUSE - 900) {
        inp.b = 1;
        ai.bombCd = now + 400 + Math.random() * 900;
        inp.d = dirTo(p, cx, cy, esc.first);
        return inp;
      }
      ai.bad = ai.bad || {};
      ai.bad[start] = now + 3000;                    // chỗ này đặt bóng không thoát được -> tạm bỏ qua
    }
  }

  // 3) Chọn mục tiêu: chọc bong bóng đối thủ > cứu đồng đội > nhặt đồ > chỗ phá thùng > áp sát đối thủ
  if (!ai.biasAt || now > ai.biasAt) { ai.bias = Array.from({ length: N }, () => Math.random() * 2); ai.biasAt = now + 4000; }
  const special = new Map();
  for (const o of game.players.values()) {
    if (o === p || o.state === 'dead') continue;
    const k = idx(Math.round(o.x), Math.round(o.y));
    if (o.state === 'trapped') special.set(k, (special.get(k) || 0) + (o.team !== p.team ? 40 : 30));
    else if (o.team !== p.team) special.set(k, (special.get(k) || 0) + 7);
  }
  let best = null, bestScore = -Infinity;
  bfs(game, start, bombCells, (k) => danger[k] === Infinity, (k, dist) => {
    let score = -Infinity;
    const c = game.grid[k];
    if (special.has(k)) score = special.get(k) - dist * 0.4;
    if (c !== '.' && !solid(c)) score = Math.max(score, 12 - dist * 0.6);   // vật phẩm
    if (!(ai.bad && ai.bad[k] > now)) {
      const v = bombValue(game, p, k % COLS, (k / COLS) | 0);
      if (v > 0) score = Math.max(score, v * 2.5 - dist * 0.8);
    }
    score += ai.bias[k];
    if (score > bestScore) { bestScore = score; best = { k, dist }; }
    return false;                                    // duyệt hết vùng đi được
  });
  if (best) {
    const path = bfs(game, start, bombCells, (k) => danger[k] === Infinity, (k) => k === best.k);
    if (path) inp.d = dirTo(p, cx, cy, path.first);
  }

  // 4) Chống kẹt: đứng im quá lâu thì đi lung tung một chút
  if (inp.d && ai.lx === p.x && ai.ly === p.y) ai.stuck = (ai.stuck | 0) + 1; else ai.stuck = 0;
  ai.lx = p.x; ai.ly = p.y;
  if (ai.stuck > 15) {
    const options = [1, 2, 3, 4].filter((d) => {
      const nx = cx + DIRS[d][0], ny = cy + DIRS[d][1];
      return inBounds(nx, ny) && !solid(game.grid[idx(nx, ny)]) && danger[idx(nx, ny)] === Infinity;
    });
    if (options.length) inp.d = options[(Math.random() * options.length) | 0];
  }
  return inp;
}

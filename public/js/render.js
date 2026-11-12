// ============================================================
// VẼ GAME BẰNG CANVAS 2D (không cần file ảnh - mọi thứ vẽ bằng code)
// ============================================================
import { COLS, ROWS, TIMING, CHAR_BY_ID, TEAMS, ITEM_BY_CH } from '../shared/constants.js';

export const TILE = 48;
export const W = COLS * TILE, H = ROWS * TILE;

const HAIR = { cap: '#5a3a2a', cloud: '#2f74d0', ears: '#8a5a2b', band: '#2d1b4e', bear: '#e4e4ee', bow: '#23865a' };
const hash = (x, y) => { let h = x * 374761393 + y * 668265263; h = (h ^ (h >> 13)) * 1274126177; return ((h ^ (h >> 16)) >>> 0) / 4294967296; };

function rr(ctx, x, y, w, h, r) {
  ctx.beginPath();
  if (ctx.roundRect) ctx.roundRect(x, y, w, h, r);
  else { ctx.moveTo(x + r, y); ctx.arcTo(x + w, y, x + w, y + h, r); ctx.arcTo(x + w, y + h, x, y + h, r); ctx.arcTo(x, y + h, x, y, r); ctx.arcTo(x, y, x + w, y, r); ctx.closePath(); }
}
function ell(ctx, x, y, rx, ry, fill) { ctx.beginPath(); ctx.ellipse(x, y, rx, ry, 0, 0, Math.PI * 2); ctx.fillStyle = fill; ctx.fill(); }
function circ(ctx, x, y, r, fill) { ell(ctx, x, y, r, r, fill); }

// ---------------- NHÂN VẬT ----------------
/** Vẽ nhân vật tại gốc toạ độ (0,0) = tâm ô. dir: 1 lên 2 xuống 3 trái 4 phải */
export function drawCharacter(ctx, charId, dir = 2, t = 0, moving = false) {
  const ch = CHAR_BY_ID[charId] || CHAR_BY_ID.bin;
  const hair = HAIR[ch.hat];
  const step = moving ? Math.sin(t * 14) : 0;
  const bob = moving ? -Math.abs(Math.sin(t * 14)) * 2.5 : Math.sin(t * 3) * 0.7;
  const side = dir === 3 ? -1 : dir === 4 ? 1 : 0;
  ctx.save();
  // chân
  ell(ctx, -6, 17 + step * 1.6, 5.5, 3.8, '#3d2c40');
  ell(ctx, 6, 17 - step * 1.6, 5.5, 3.8, '#3d2c40');
  ctx.translate(0, bob);
  // đuôi sóc (phía sau)
  if (ch.hat === 'ears' && dir !== 2) {
    ctx.save(); ctx.translate(-side * 10 || 10, 4); ctx.rotate(side ? -side * 0.5 : 0.3);
    ell(ctx, 0, -6, 8, 13, ch.body); ell(ctx, 1, -9, 4, 8, '#e0b080'); ctx.restore();
  }
  // thân
  ell(ctx, 0, 8, 12.5, 10.5, ch.body);
  ell(ctx, side * 2, 10, 7.5, 6.5, 'rgba(255,255,255,0.35)');
  // tay
  ell(ctx, -12, 8 - step * 2, 4.2, 4.2, ch.skin);
  ell(ctx, 12, 8 + step * 2, 4.2, 4.2, ch.skin);
  // đầu
  circ(ctx, 0, -8, 15, ch.skin);
  // tóc nền
  ctx.fillStyle = hair;
  ctx.beginPath();
  if (dir === 1) ctx.arc(0, -8, 15.2, 0, Math.PI * 2);
  else ctx.arc(0, -9, 15.4, Math.PI * 1.02, Math.PI * 1.98);
  ctx.fill();
  if (dir !== 1) {
    // mái tóc lởm chởm phía trước
    ctx.beginPath();
    for (let i = -3; i <= 3; i++) { const px = i * 4.4 + side * 3; ctx.moveTo(px - 3.5, -15); ctx.lineTo(px, -9 + (i % 2) * 1.5); ctx.lineTo(px + 3.5, -15); }
    ctx.fill();
    // mắt
    const ex = side * 4;
    for (const s of side ? [side * 2.5 - 4, side * 2.5 + 4] : [-5.5, 5.5]) {
      ell(ctx, ex + s, -5, 2.6, 3.6, '#1d1530');
      circ(ctx, ex + s + 0.9, -6.4, 1.1, '#fff');
    }
    if (!side) { circ(ctx, -9.5, -0.5, 2.6, 'rgba(255,110,130,0.45)'); circ(ctx, 9.5, -0.5, 2.6, 'rgba(255,110,130,0.45)'); }
    ctx.strokeStyle = '#7a3b3b'; ctx.lineWidth = 1.3; ctx.beginPath(); ctx.arc(ex, -1, 2.4, 0.15 * Math.PI, 0.85 * Math.PI); ctx.stroke();
  }
  // phụ kiện đầu
  switch (ch.hat) {
    case 'cap':
      ctx.fillStyle = ch.body; ctx.beginPath(); ctx.arc(0, -13, 13.5, Math.PI, 0); ctx.fill();
      if (dir !== 1) ell(ctx, side * 9, -13, 11, 3.6, ch.acc);
      circ(ctx, 0, -26, 2.5, ch.acc);
      break;
    case 'cloud':
      for (const [cx, cy, r] of [[-9, -21, 6.5], [0, -25, 8], [9, -21, 6.5], [-3, -19, 6], [5, -19, 6]]) circ(ctx, cx, cy, r, '#fff');
      circ(ctx, 2, -26, 3, '#e8f4ff');
      break;
    case 'ears':
      for (const s of [-1, 1]) {
        ctx.fillStyle = ch.body; ctx.beginPath(); ctx.moveTo(s * 5, -20); ctx.lineTo(s * 13, -32); ctx.lineTo(s * 15, -16); ctx.fill();
        ctx.fillStyle = '#f0b9a0'; ctx.beginPath(); ctx.moveTo(s * 8, -20); ctx.lineTo(s * 12.5, -28); ctx.lineTo(s * 13.5, -18); ctx.fill();
      }
      break;
    case 'band':
      ctx.fillStyle = ch.acc; rr(ctx, -15, -16, 30, 5, 2.5); ctx.fill();
      if (dir !== 1) { ctx.fillStyle = '#ff7b2e'; ctx.beginPath(); ctx.moveTo(side * 6 + 1, -18); ctx.lineTo(side * 6 - 3, -13); ctx.lineTo(side * 6, -13); ctx.lineTo(side * 6 - 2, -9); ctx.lineTo(side * 6 + 3, -14.5); ctx.lineTo(side * 6, -14.5); ctx.fill(); }
      ctx.fillStyle = ch.acc; ctx.beginPath(); ctx.moveTo(side ? -side * 14 : 12, -14); ctx.lineTo(side ? -side * 24 : 22, -18 + Math.sin(t * 10) * 2); ctx.lineTo(side ? -side * 22 : 21, -10); ctx.fill();
      break;
    case 'bear':
      for (const s of [-1, 1]) { circ(ctx, s * 11, -21, 6, ch.body); circ(ctx, s * 11, -21, 3.2, ch.acc); }
      if (dir !== 1) circ(ctx, side * 4, 1.5, 1.8, '#5b3b4b');
      break;
    case 'bow':
      ctx.fillStyle = ch.acc;
      ctx.beginPath(); ctx.moveTo(0, -22); ctx.lineTo(-11, -29); ctx.lineTo(-11, -15); ctx.closePath(); ctx.fill();
      ctx.beginPath(); ctx.moveTo(0, -22); ctx.lineTo(11, -29); ctx.lineTo(11, -15); ctx.closePath(); ctx.fill();
      circ(ctx, 0, -22, 3.6, '#ff8cc0');
      break;
  }
  ctx.restore();
}

// ---------------- VẬT PHẨM ----------------
const ITEM_COLORS = { bomb: '#2f8cff', range: '#22c3e6', speed: '#ffb21a', maxrange: '#a24bff', needle: '#8aa0b8', shield: '#ffcc33', kick: '#ff5a4f', mount: '#3ed37a' };
function drawItemIcon(ctx, type) {
  switch (type) {
    case 'bomb':
      circ(ctx, 0, 2, 9, '#2f8cff'); circ(ctx, -3, -1, 3, 'rgba(255,255,255,.7)');
      ctx.fillStyle = '#1b5fc0'; ctx.beginPath(); ctx.moveTo(-3, -7); ctx.lineTo(3, -7); ctx.lineTo(0, -4); ctx.fill();
      break;
    case 'range': case 'maxrange': {
      const c = type === 'range' ? '#22c3e6' : '#a24bff';
      ctx.fillStyle = '#e8f6ff'; rr(ctx, -3.5, -12, 7, 7, 2); ctx.fill();
      ctx.fillStyle = '#9b6a3a'; rr(ctx, -4.5, -14, 9, 3.5, 1.5); ctx.fill();
      circ(ctx, 0, 3, 9.5, '#e8f6ff'); circ(ctx, 0, 4, 8, c); circ(ctx, -3, 1, 2.4, 'rgba(255,255,255,.8)');
      if (type === 'maxrange') star(ctx, 0, 4, 4.5, '#fff6a0');
      break;
    }
    case 'speed':
      ctx.fillStyle = '#ff5a4f'; rr(ctx, -9, -4, 14, 10, 4); ctx.fill(); rr(ctx, -2, 0, 12, 6, 3); ctx.fill();
      ctx.fillStyle = '#fff'; rr(ctx, -10, 5, 21, 3.5, 1.7); ctx.fill();
      ctx.strokeStyle = '#ffb21a'; ctx.lineWidth = 2; ctx.lineCap = 'round';
      for (const y of [-7, -2]) { ctx.beginPath(); ctx.moveTo(-14, y); ctx.lineTo(-10, y); ctx.stroke(); }
      break;
    case 'needle':
      ctx.save(); ctx.rotate(-0.8);
      ctx.fillStyle = '#c7d3e0'; ctx.beginPath(); ctx.moveTo(0, -13); ctx.lineTo(2.4, 9); ctx.lineTo(-2.4, 9); ctx.fill();
      ctx.strokeStyle = '#6f7f92'; ctx.lineWidth = 1.2; ctx.strokeRect(-1, 3, 2, 4);
      ctx.restore();
      break;
    case 'shield':
      ctx.fillStyle = '#ffcc33'; ctx.beginPath(); ctx.moveTo(0, -11); ctx.lineTo(10, -7); ctx.quadraticCurveTo(9, 7, 0, 12); ctx.quadraticCurveTo(-9, 7, -10, -7); ctx.closePath(); ctx.fill();
      star(ctx, 0, 0, 5, '#fff');
      break;
    case 'kick':
      circ(ctx, 0, 1, 8.5, '#ff5a4f'); ctx.fillStyle = '#ff5a4f'; rr(ctx, -9, -4, 7, 13, 3); ctx.fill();
      ctx.fillStyle = '#fff'; rr(ctx, -3, 8, 11, 3, 1.5); ctx.fill();
      break;
    case 'mount':
      ctx.fillStyle = '#3ed37a'; ctx.beginPath(); ctx.moveTo(-11, 8); ctx.quadraticCurveTo(-12, -11, 0, -11); ctx.quadraticCurveTo(12, -11, 11, 8); ctx.closePath(); ctx.fill();
      circ(ctx, -4, -2, 2.2, '#123'); circ(ctx, 4, -2, 2.2, '#123'); circ(ctx, -5, -6, 2, 'rgba(255,255,255,.7)');
      break;
  }
}
function star(ctx, x, y, r, fill) {
  ctx.fillStyle = fill; ctx.beginPath();
  for (let i = 0; i < 10; i++) { const a = -Math.PI / 2 + (i * Math.PI) / 5, rad = i % 2 ? r * 0.45 : r; ctx.lineTo(x + Math.cos(a) * rad, y + Math.sin(a) * rad); }
  ctx.fill();
}
/** Vẽ vật phẩm trong bong bóng nhỏ - dùng cho cả HUD */
export function drawItem(ctx, type, x, y, t = 0) {
  ctx.save(); ctx.translate(x, y + Math.sin(t * 4 + x) * 2);
  circ(ctx, 0, 0, 18, 'rgba(255,255,255,0.85)');
  ctx.lineWidth = 2.5; ctx.strokeStyle = ITEM_COLORS[type]; ctx.beginPath(); ctx.arc(0, 0, 17, 0, Math.PI * 2); ctx.stroke();
  drawItemIcon(ctx, type);
  ctx.restore();
}

// ---------------- CHỦ ĐỀ BẢN ĐỒ ----------------
const THEMES = [
  { g1: '#93d46e', g2: '#88cb63', deco: '#6fb44c' },  // Làng Gió
  { g1: '#f3d593', g2: '#ecca7f', deco: '#d6ac62' },  // Sa Mạc
  { g1: '#ffe6f1', g2: '#ffd9ea', deco: '#ffb3d1' },  // Đảo Kẹo
];

function drawWall(ctx, x, y, theme) {
  const px = x * TILE, py = y * TILE, v = hash(x, y);
  ctx.save(); ctx.translate(px, py);
  ell(ctx, 24, 42, 20, 5, 'rgba(0,0,0,0.18)');
  if (theme === 0) {
    if (v < 0.35) {          // cây
      ctx.fillStyle = '#7a4f2a'; rr(ctx, 20, 26, 8, 16, 3); ctx.fill();
      circ(ctx, 24, 18, 15, '#3f9b4a'); circ(ctx, 16, 22, 9, '#47ab52'); circ(ctx, 32, 22, 9, '#47ab52'); circ(ctx, 20, 13, 5, 'rgba(255,255,255,.18)');
    } else {                 // nhà nhỏ
      const roof = ['#e2574c', '#3f7fe0', '#f29a2e'][(v * 3) | 0];
      ctx.fillStyle = '#f6e6c8'; rr(ctx, 7, 18, 34, 26, 3); ctx.fill();
      ctx.fillStyle = roof; ctx.beginPath(); ctx.moveTo(2, 21); ctx.lineTo(24, 2); ctx.lineTo(46, 21); ctx.closePath(); ctx.fill();
      ctx.fillStyle = '#8c5a35'; rr(ctx, 19, 29, 10, 15, 2); ctx.fill();
      ctx.fillStyle = '#8fd3ff'; rr(ctx, 10, 25, 7, 7, 1.5); ctx.fill(); rr(ctx, 31, 25, 7, 7, 1.5); ctx.fill();
    }
  } else if (theme === 1) {
    if (v < 0.45) {          // xương rồng
      ctx.fillStyle = '#4caf50'; rr(ctx, 18, 4, 12, 40, 6); ctx.fill(); rr(ctx, 6, 16, 8, 16, 4); ctx.fill(); rr(ctx, 34, 12, 8, 16, 4); ctx.fill();
      ctx.fillRect(12, 26, 8, 5); ctx.fillRect(28, 22, 8, 5);
      ctx.fillStyle = 'rgba(255,255,255,.25)'; rr(ctx, 21, 7, 3, 32, 1.5); ctx.fill();
    } else {                 // đá
      ctx.fillStyle = '#b07a46'; rr(ctx, 3, 8, 42, 36, 12); ctx.fill();
      ctx.fillStyle = '#c99060'; rr(ctx, 6, 9, 34, 22, 10); ctx.fill();
      circ(ctx, 15, 16, 4, 'rgba(255,255,255,.2)');
    }
  } else {
    if (v < 0.4) {           // kẹo mút
      ctx.fillStyle = '#fff'; rr(ctx, 22, 22, 5, 22, 2); ctx.fill();
      circ(ctx, 24, 17, 15, ['#ff6fa8', '#7cc8ff', '#ffd35c'][(v * 7.5) | 0]);
      ctx.strokeStyle = 'rgba(255,255,255,.75)'; ctx.lineWidth = 3; ctx.beginPath(); ctx.arc(24, 17, 9, 0, Math.PI * 1.5); ctx.stroke(); ctx.beginPath(); ctx.arc(24, 17, 4, Math.PI, Math.PI * 2.6); ctx.stroke();
    } else {                 // khối kẹo
      ctx.fillStyle = '#b97ce8'; rr(ctx, 3, 3, 42, 41, 10); ctx.fill();
      ctx.save(); rr(ctx, 3, 3, 42, 41, 10); ctx.clip(); ctx.fillStyle = 'rgba(255,255,255,.35)';
      for (let i = -48; i < 60; i += 14) { ctx.beginPath(); ctx.moveTo(i, 48); ctx.lineTo(i + 7, 48); ctx.lineTo(i + 55, 0); ctx.lineTo(i + 48, 0); ctx.fill(); }
      ctx.restore();
    }
  }
  ctx.restore();
}

function drawBox(ctx, x, y, theme, scale = 1, alpha = 1) {
  const v = hash(x + 99, y + 7);
  ctx.save(); ctx.translate(x * TILE + 24, y * TILE + 24); ctx.scale(scale, scale); ctx.globalAlpha = alpha; ctx.translate(-24, -24);
  ell(ctx, 24, 43, 18, 4, 'rgba(0,0,0,0.15)');
  if (theme === 0) {
    ctx.fillStyle = '#c98b4b'; rr(ctx, 5, 6, 38, 37, 5); ctx.fill();
    ctx.strokeStyle = '#9c6532'; ctx.lineWidth = 3; ctx.strokeRect(10, 11, 28, 27);
    ctx.beginPath(); ctx.moveTo(10, 11); ctx.lineTo(38, 38); ctx.stroke();
    ctx.fillStyle = 'rgba(255,255,255,.2)'; rr(ctx, 7, 8, 34, 4, 2); ctx.fill();
  } else if (theme === 1) {
    ctx.fillStyle = '#d9874f'; ctx.beginPath(); ctx.moveTo(14, 8); ctx.lineTo(34, 8); ctx.quadraticCurveTo(46, 26, 34, 43); ctx.lineTo(14, 43); ctx.quadraticCurveTo(2, 26, 14, 8); ctx.fill();
    ctx.fillStyle = '#b8683a'; rr(ctx, 12, 5, 24, 6, 3); ctx.fill();
    ctx.fillStyle = '#f2c38a'; ctx.fillRect(10, 22, 28, 4);
  } else {
    const c = ['#5ec8ff', '#ffcf4a', '#7be08f', '#ff8fb8'][(v * 4) | 0];
    ctx.fillStyle = c; rr(ctx, 5, 10, 38, 33, 6); ctx.fill();
    ctx.fillStyle = 'rgba(255,255,255,.9)'; ctx.fillRect(21, 10, 6, 33); ctx.fillRect(5, 23, 38, 6);
    circ(ctx, 18, 8, 5, '#ff5fa2'); circ(ctx, 30, 8, 5, '#ff5fa2'); circ(ctx, 24, 10, 3, '#ff8cc0');
  }
  ctx.restore();
}

// ============================================================
export class Renderer {
  constructor(canvas) {
    this.cv = canvas;
    this.ctx = canvas.getContext('2d');
    this.dpr = Math.min(window.devicePixelRatio || 1, 2);
    canvas.width = W * this.dpr; canvas.height = H * this.dpr;
    this.layer = document.createElement('canvas');
    this.layer.width = W * this.dpr; this.layer.height = H * this.dpr;
    this.theme = 0; this.grid = ''; this.particles = []; this.shake = 0; this.breakStart = new Map(); this.drops = [];
  }

  setTheme(theme) { this.theme = theme; this.grid = ''; }

  /** Vẽ lại lớp nền tĩnh (cỏ, tường, thùng) khi lưới thay đổi */
  setGrid(grid) {
    if (grid === this.grid) return;
    this.grid = grid;
    const ctx = this.layer.getContext('2d');
    ctx.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);
    const th = THEMES[this.theme];
    for (let y = 0; y < ROWS; y++) for (let x = 0; x < COLS; x++) {
      ctx.fillStyle = (x + y) % 2 ? th.g1 : th.g2; ctx.fillRect(x * TILE, y * TILE, TILE, TILE);
      const v = hash(x, y);
      if (v > 0.6) {
        ctx.fillStyle = th.deco;
        if (this.theme === 2) { circ(ctx, x * TILE + v * 40, y * TILE + (1 - v) * 40, 2, ['#ff8fb8', '#7cc8ff', '#ffd35c'][(v * 30) % 3 | 0]); }
        else { ctx.fillRect(x * TILE + v * 36, y * TILE + 10 + v * 20, 2, 6); ctx.fillRect(x * TILE + v * 36 + 4, y * TILE + 12 + v * 20, 2, 4); }
      }
    }
    for (let y = 0; y < ROWS; y++) for (let x = 0; x < COLS; x++) {
      const c = grid[y * COLS + x];
      if (c === '#') drawWall(ctx, x, y, this.theme);
      else if (c === 'x') drawBox(ctx, x, y, this.theme);
    }
  }

  // ---------- hiệu ứng ----------
  splash(x, y, n = 14, color = '#7fd8ff') {
    for (let i = 0; i < n; i++) {
      const a = Math.random() * Math.PI * 2, s = 60 + Math.random() * 160;
      this.particles.push({ x: x * TILE + 24, y: y * TILE + 24, vx: Math.cos(a) * s, vy: Math.sin(a) * s - 40, life: 0.5 + Math.random() * 0.3, t: 0, r: 2 + Math.random() * 3, color });
    }
  }
  floatText(x, y, text, color = '#fff') {
    this.particles.push({ x: x * TILE + 24, y: y * TILE, vx: 0, vy: -40, life: 1.1, t: 0, text, color });
  }
  drop(x, y) { this.drops.push({ x, y, t: 0 }); this.shake = Math.max(this.shake, 3); }
  bump(n = 4) { this.shake = Math.max(this.shake, n); }

  // ---------- vẽ 1 khung hình ----------
  /** view = { grid, players:[...], bombs:[...], flames:[...], myId, time, dt } */
  draw(view) {
    const { ctx } = this;
    const t = view.time / 1000, dt = view.dt;
    ctx.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);
    ctx.clearRect(0, 0, W, H);
    ctx.save();
    if (this.shake > 0.1) { ctx.translate((Math.random() - 0.5) * this.shake, (Math.random() - 0.5) * this.shake); this.shake *= 0.86; }
    this.setGrid(view.grid);
    ctx.drawImage(this.layer, 0, 0, W, H);

    // thùng đang vỡ + vật phẩm
    for (let i = 0; i < view.grid.length; i++) {
      const c = view.grid[i];
      const x = i % COLS, y = (i / COLS) | 0;
      if (c === 'y') {
        if (!this.breakStart.has(i)) { this.breakStart.set(i, view.time); this.splash(x, y, 6, '#c98b4b'); }
        const k = Math.min(1, (view.time - this.breakStart.get(i)) / TIMING.BOX_BREAK_TIME);
        drawBox(ctx, x, y, this.theme, 1 + k * 0.25, 1 - k);
      } else {
        this.breakStart.delete(i);
        const item = ITEM_BY_CH[c];
        if (item) drawItem(ctx, item, x * TILE + 24, y * TILE + 22, t);
      }
    }

    // tia nước
    for (const f of view.flames) this.drawFlame(f, t);

    // bóng nước + người chơi, sắp theo y để tạo chiều sâu
    const sprites = [];
    for (const b of view.bombs) sprites.push({ y: b.y, fn: () => this.drawBomb(b, t, view) });
    for (const p of view.players) if (p.state !== 'dead' || view.time - (p.deadT || 0) < 0) sprites.push({ y: p.y + 0.01, fn: () => this.drawPlayer(p, t, p.id === view.myId) });
    sprites.sort((a, b) => a.y - b.y).forEach((s) => s.fn());

    // tường rơi (thu hẹp bản đồ)
    this.drops = this.drops.filter((d) => {
      d.t += dt;
      const k = Math.min(1, d.t / 0.25);
      ctx.save(); ctx.globalAlpha = 1 - k; ctx.fillStyle = 'rgba(60,40,30,.6)';
      rr(ctx, d.x * TILE + 4, d.y * TILE + 4 - (1 - k) * 30, 40, 40, 8); ctx.fill(); ctx.restore();
      return d.t < 0.25;
    });

    // hạt hiệu ứng
    this.particles = this.particles.filter((p) => {
      p.t += dt; p.x += p.vx * dt; p.y += p.vy * dt;
      const a = 1 - p.t / p.life;
      if (a <= 0) return false;
      ctx.globalAlpha = a;
      if (p.text) {
        ctx.font = '800 15px "Baloo 2", system-ui, sans-serif'; ctx.textAlign = 'center';
        ctx.lineWidth = 4; ctx.strokeStyle = 'rgba(20,30,60,.8)'; ctx.strokeText(p.text, p.x, p.y); ctx.fillStyle = p.color; ctx.fillText(p.text, p.x, p.y);
      } else { p.vy += 500 * dt; circ(ctx, p.x, p.y, p.r, p.color); }
      ctx.globalAlpha = 1;
      return true;
    });
    ctx.restore();
  }

  drawFlame(f, t) {
    const { ctx } = this;
    const cx = f.x * TILE + 24, cy = f.y * TILE + 24;
    const life = Math.max(0, f.left) / TIMING.FLAME_TIME;          // 1 -> 0
    const w = 30 * Math.min(1, life * 2.2) * (1 + Math.sin(t * 40 + f.x + f.y) * 0.06);
    ctx.save(); ctx.translate(cx, cy);
    if (f.d === 1 || f.d === 2) ctx.rotate(Math.PI / 2);   // tia dọc = xoay tia ngang 90°
    if (f.d === 1 || f.d === 3) ctx.scale(-1, 1);          // lên/trái = lật gương
    const paint = (width, color) => {
      ctx.fillStyle = color;
      if (f.k === 'c') circ(ctx, 0, 0, width * 0.62, color);             // tâm nổ
      else if (f.k === 'a') ctx.fillRect(-25, -width / 2, 50, width);     // thân tia
      else { ctx.fillRect(-25, -width / 2, 33, width); circ(ctx, 8, 0, width / 2, color); } // đầu tia bo tròn
    };
    paint(w + 8, 'rgba(46,150,255,0.55)');
    paint(w, '#5fd0ff');
    paint(w * 0.45, '#f2fdff');
    ctx.restore();
  }

  drawBomb(b, t, view) {
    const { ctx } = this;
    const left = b.left;                                             // ms còn lại tới lúc nổ
    const k = 1 - left / TIMING.BOMB_FUSE;
    const freq = 4 + k * 14;
    const s = 1 + Math.sin(t * freq) * (0.05 + k * 0.07);
    const x = b.x * TILE + 24, y = b.y * TILE + 25;
    const owner = view.players.find((p) => p.id === b.owner);
    const team = owner ? TEAMS[owner.team].color : '#2f8cff';
    ell(ctx, x, y + 15, 14, 4, 'rgba(0,0,0,.2)');
    ctx.save(); ctx.translate(x, y); ctx.scale(s, 1 / s);
    const flash = left < 600 && Math.floor(t * 16) % 2 === 0;
    const g = ctx.createRadialGradient(-5, -6, 2, 0, 0, 18);
    g.addColorStop(0, flash ? '#ffffff' : '#bfe9ff'); g.addColorStop(0.5, flash ? '#ffd0d0' : '#3fa5ff'); g.addColorStop(1, flash ? '#ff5a5a' : '#1c63d6');
    circ(ctx, 0, 0, 16, g);
    circ(ctx, -6, -6, 4, 'rgba(255,255,255,.75)');
    ctx.fillStyle = team; ctx.beginPath(); ctx.moveTo(-4, -17); ctx.lineTo(4, -17); ctx.lineTo(0, -12); ctx.fill();
    ctx.restore();
    // vòng đếm thời gian nổ
    ctx.lineWidth = 3; ctx.lineCap = 'round';
    ctx.strokeStyle = 'rgba(255,255,255,.35)'; ctx.beginPath(); ctx.arc(x, y, 21, 0, Math.PI * 2); ctx.stroke();
    ctx.strokeStyle = left < 1000 ? '#ff4d5e' : left < 2000 ? '#ffc21a' : '#ffffff';
    ctx.beginPath(); ctx.arc(x, y, 21, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * (left / TIMING.BOMB_FUSE)); ctx.stroke();
  }

  drawPlayer(p, t, isMe) {
    const { ctx } = this;
    const x = p.x * TILE + 24, y = p.y * TILE + 22;
    const team = TEAMS[p.team] || TEAMS[0];
    ctx.save();
    if (p.state === 'dead') ctx.globalAlpha = 0.35;
    if (p.inv && Math.floor(t * 12) % 2 === 0) ctx.globalAlpha = 0.45;
    ell(ctx, x, y + 21, 14, 4.5, 'rgba(0,0,0,.22)');
    if (isMe) { ctx.strokeStyle = team.color; ctx.lineWidth = 2.5; ctx.beginPath(); ctx.ellipse(x, y + 21, 17, 6, 0, 0, Math.PI * 2); ctx.stroke(); }
    ctx.translate(x, y);
    const trapped = p.state === 'trapped';
    if (p.mount) {                                                   // slime cưỡi
      const sq = 1 + Math.sin(t * 10) * 0.05;
      ctx.save(); ctx.scale(sq, 1 / sq);
      ctx.fillStyle = '#3ed37a'; ctx.beginPath(); ctx.moveTo(-17, 20); ctx.quadraticCurveTo(-18, 2, 0, 2); ctx.quadraticCurveTo(18, 2, 17, 20); ctx.closePath(); ctx.fill();
      circ(ctx, -10, 12, 2, '#123'); circ(ctx, 10, 12, 2, '#123');
      ctx.restore(); ctx.translate(0, -8);
    }
    if (trapped) ctx.translate(0, Math.sin(t * 3) * 3 - 4);
    drawCharacter(ctx, p.charId, p.dir, t + (p.id.charCodeAt(1) || 0), p.moving && !trapped);
    if (trapped) {                                                   // bị nhốt trong bong bóng
      const wob = 1 + Math.sin(t * 6) * 0.04;
      ctx.save(); ctx.scale(wob, 1 / wob);
      const g = ctx.createRadialGradient(-8, -12, 4, 0, 0, 30);
      g.addColorStop(0, 'rgba(255,255,255,.45)'); g.addColorStop(0.7, 'rgba(120,200,255,.25)'); g.addColorStop(1, 'rgba(80,170,255,.55)');
      circ(ctx, 0, 0, 29, g);
      ctx.strokeStyle = 'rgba(255,255,255,.8)'; ctx.lineWidth = 2; ctx.beginPath(); ctx.arc(0, 0, 29, 0, Math.PI * 2); ctx.stroke();
      ell(ctx, -11, -15, 6, 3.5, 'rgba(255,255,255,.8)');
      ctx.restore();
      const k = p.trapLeft / TIMING.TRAP_TIME;                       // vòng đếm ngược vỡ bong bóng
      ctx.strokeStyle = k < 0.35 ? '#ff4d5e' : '#ffffff'; ctx.lineWidth = 3.5; ctx.lineCap = 'round';
      ctx.beginPath(); ctx.arc(0, 0, 33, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * k); ctx.stroke();
    }
    if (p.shieldLeft > 0) {
      ctx.save(); ctx.rotate(t * 3); ctx.setLineDash([6, 5]); ctx.strokeStyle = '#ffcc33'; ctx.lineWidth = 3;
      ctx.beginPath(); ctx.arc(0, 0, 28, 0, Math.PI * 2); ctx.stroke(); ctx.restore();
    }
    ctx.restore();
    // tên
    ctx.font = '700 11px "Baloo 2", system-ui, sans-serif'; ctx.textAlign = 'center';
    const name = p.name || '';
    const tw = ctx.measureText(name).width + 10;
    const ny = y - (p.mount ? 46 : 38) - (trapped ? 6 : 0);
    ctx.fillStyle = team.color; rr(ctx, x - tw / 2, ny - 10, tw, 14, 7); ctx.fill();
    ctx.fillStyle = '#fff'; ctx.fillText(name, x, ny + 1);
  }
}

/** Vẽ ảnh xem trước nhân vật vào 1 canvas nhỏ (dùng ở menu) */
export function paintCharPreview(canvas, charId, t = 0) {
  const ctx = canvas.getContext('2d');
  const d = Math.min(window.devicePixelRatio || 1, 2);
  if (canvas.width !== 64 * d) { canvas.width = 64 * d; canvas.height = 64 * d; }
  ctx.setTransform(d, 0, 0, d, 0, 0); ctx.clearRect(0, 0, 64, 64);
  ctx.translate(32, 36);
  ell(ctx, 0, 21, 14, 4, 'rgba(0,0,0,.15)');
  drawCharacter(ctx, charId, 2, t, false);
}

/** Ảnh thu nhỏ bản đồ */
export function paintMapPreview(canvas, mapDef) {
  const ctx = canvas.getContext('2d');
  const s = 8; canvas.width = COLS * s; canvas.height = ROWS * s;
  const th = THEMES[mapDef.theme];
  const wall = ['#e2574c', '#b07a46', '#b97ce8'][mapDef.theme], box = ['#c98b4b', '#d9874f', '#5ec8ff'][mapDef.theme];
  mapDef.rows.forEach((row, y) => [...row].forEach((c, x) => {
    ctx.fillStyle = c === '#' ? wall : c === '?' || c === 'x' ? box : (x + y) % 2 ? th.g1 : th.g2;
    if (c === '?') ctx.globalAlpha = 0.55;
    ctx.fillRect(x * s, y * s, s, s); ctx.globalAlpha = 1;
  }));
}

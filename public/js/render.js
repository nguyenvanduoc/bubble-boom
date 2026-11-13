// ============================================================
// VẼ GAME BẰNG CANVAS 2D (không cần file ảnh - mọi thứ vẽ bằng code)
// ============================================================
import { COLS, ROWS, TIMING, CHAR_BY_ID, TEAMS, ITEM_BY_CH } from '../shared/constants.js';

export const TILE = 48;
export const W = COLS * TILE, H = ROWS * TILE;

const HAIR = { cap: '#5a3a2a', cloud: '#2f74d0', ears: '#8a5a2b', band: '#2d1b4e', bear: '#e4e4ee', bow: '#23865a' };
// Số giả ngẫu nhiên cố định theo ô (x,y) -> mỗi ô luôn cùng một kiểu trang trí.
// Math.imul = phép nhân số nguyên 32-bit, tránh tràn số làm mất tính ngẫu nhiên.
const hash = (x, y) => {
  let h = (Math.imul(x, 374761393) + Math.imul(y, 668265263)) | 0;
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
};

function rr(ctx, x, y, w, h, r) {
  ctx.beginPath();
  if (ctx.roundRect) ctx.roundRect(x, y, w, h, r);
  else { ctx.moveTo(x + r, y); ctx.arcTo(x + w, y, x + w, y + h, r); ctx.arcTo(x + w, y + h, x, y + h, r); ctx.arcTo(x, y + h, x, y, r); ctx.arcTo(x, y, x + w, y, r); ctx.closePath(); }
}
function ell(ctx, x, y, rx, ry, fill) { ctx.beginPath(); ctx.ellipse(x, y, rx, ry, 0, 0, Math.PI * 2); ctx.fillStyle = fill; ctx.fill(); }
function circ(ctx, x, y, r, fill) { ell(ctx, x, y, r, r, fill); }

// ---------------- NHÂN VẬT ----------------
const HAT_OUTFITS = new Set(['pirate', 'wizard', 'crown']);

/** Áo choàng đỏ bay phía sau */
function drawCape(ctx, t, moving, front) {
  const sway = Math.sin(t * (moving ? 14 : 3)) * (moving ? 4 : 1.5);
  ctx.fillStyle = front ? '#d62839' : '#b81f30';
  ctx.beginPath(); ctx.moveTo(-10, -2); ctx.lineTo(10, -2);
  ctx.quadraticCurveTo(16 + sway, 12, 13 + sway, 24); ctx.lineTo(-13 + sway, 24);
  ctx.quadraticCurveTo(-16 + sway, 12, -10, -2); ctx.fill();
  ctx.fillStyle = '#ffd23f'; circ(ctx, -8, -1, 2.4, '#ffd23f'); circ(ctx, 8, -1, 2.4, '#ffd23f');
}

/** Mũ / kính của trang phục (vẽ đè lên đầu) */
function drawOutfitTop(ctx, outfit, dir, side, t) {
  switch (outfit) {
    case 'pirate':
      ell(ctx, 0, -18, 18, 5, '#22202a');
      ctx.fillStyle = '#22202a'; ctx.beginPath(); ctx.arc(0, -19, 12, Math.PI, 0); ctx.fill();
      ctx.fillStyle = '#ffd23f'; ctx.fillRect(-12, -20, 24, 2);
      if (dir !== 1) {
        circ(ctx, side * 3, -25, 3, '#fff');
        ctx.strokeStyle = '#fff'; ctx.lineWidth = 1.4; ctx.beginPath();
        ctx.moveTo(side * 3 - 4, -21); ctx.lineTo(side * 3 + 4, -27); ctx.moveTo(side * 3 + 4, -21); ctx.lineTo(side * 3 - 4, -27); ctx.stroke();
      }
      break;
    case 'wizard':
      ell(ctx, 0, -17, 18, 4.5, '#5b2a9e');
      ctx.fillStyle = '#7b3fd6'; ctx.beginPath(); ctx.moveTo(-13, -18); ctx.quadraticCurveTo(-2, -30, 6 + Math.sin(t * 3) * 2, -44); ctx.quadraticCurveTo(6, -28, 13, -18); ctx.closePath(); ctx.fill();
      star(ctx, -3, -26, 3.2, '#ffe066'); star(ctx, 4, -34, 2.4, '#ffe066'); star(ctx, 6 + Math.sin(t * 3) * 2, -44, 2.6, '#fff6a0');
      break;
    case 'crown':
      ctx.fillStyle = '#f5c518'; ctx.beginPath();
      ctx.moveTo(-12, -18); ctx.lineTo(-12, -29); ctx.lineTo(-6, -23); ctx.lineTo(0, -32); ctx.lineTo(6, -23); ctx.lineTo(12, -29); ctx.lineTo(12, -18); ctx.closePath(); ctx.fill();
      ctx.fillStyle = '#e0a800'; ctx.fillRect(-12, -21, 24, 3);
      circ(ctx, 0, -25, 2.4, '#e2473d'); circ(ctx, -7, -21.5, 1.6, '#3d8bff'); circ(ctx, 7, -21.5, 1.6, '#3d8bff');
      if (Math.sin(t * 4) > 0.7) star(ctx, 9, -31, 2.5, '#fff');
      break;
    case 'shades':
      if (dir === 1) break;
      ctx.fillStyle = '#16131f';
      { const ex = side * 4 + side * 2.5;
        rr(ctx, ex - 11, -8.5, 9.5, 6.5, 2.5); ctx.fill(); rr(ctx, ex + 1.5, -8.5, 9.5, 6.5, 2.5); ctx.fill();
        ctx.fillRect(ex - 2, -7, 4, 1.6);
        ctx.fillStyle = 'rgba(255,255,255,.6)'; ctx.fillRect(ex - 9, -7.5, 3, 1.3); ctx.fillRect(ex + 3.5, -7.5, 3, 1.3); }
      break;
  }
}

/** Vẽ nhân vật tại gốc toạ độ (0,0) = tâm ô. dir: 1 lên 2 xuống 3 trái 4 phải. outfit: trang phục từ cửa hàng */
export function drawCharacter(ctx, charId, dir = 2, t = 0, moving = false, outfit = null) {
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
  if (outfit === 'cape' && dir !== 1) drawCape(ctx, t, moving, false);
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
  if (outfit === 'cape' && dir === 1) drawCape(ctx, t, moving, true);
  // phụ kiện đầu (bỏ qua nếu đang đội mũ từ cửa hàng)
  switch (HAT_OUTFITS.has(outfit) ? '' : ch.hat) {
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
  if (outfit) drawOutfitTop(ctx, outfit, dir, side, t);
  ctx.restore();
}

// ---------------- BÓNG NƯỚC (các kiểu skin) ----------------
/** Vẽ thân quả bóng tại gốc toạ độ, bán kính 16. flash: nháy đỏ sắp nổ */
export function drawBalloon(ctx, skin, flash = false, t = 0) {
  const grad = (a, b, c) => { const g = ctx.createRadialGradient(-5, -6, 2, 0, 0, 18); g.addColorStop(0, a); g.addColorStop(0.5, b); g.addColorStop(1, c); return g; };
  ctx.save();
  switch (skin) {
    case 'straw':
      circ(ctx, 0, 0, 16, grad('#ffb3b3', '#ff4d5e', '#c81d34'));
      for (const [x, y] of [[-7, -2], [0, -7], [6, 0], [-3, 6], [5, 8], [-9, 6], [9, -6]]) ell(ctx, x, y, 1.3, 2, '#ffe066');
      ctx.fillStyle = '#2fc46b'; for (const a of [-0.6, 0, 0.6]) { ctx.save(); ctx.rotate(a); ctx.beginPath(); ctx.moveTo(-3, -14); ctx.lineTo(0, -21); ctx.lineTo(3, -14); ctx.fill(); ctx.restore(); }
      break;
    case 'melon':
      circ(ctx, 0, 0, 16, grad('#b6f5c4', '#3fbf5f', '#1f7a3a'));
      ctx.save(); ctx.beginPath(); ctx.arc(0, 0, 16, 0, Math.PI * 2); ctx.clip();
      ctx.strokeStyle = '#1b6b33'; ctx.lineWidth = 3;
      for (const x of [-10, -3.5, 3.5, 10]) { ctx.beginPath(); ctx.moveTo(x * 0.6, -17); ctx.quadraticCurveTo(x * 1.25, 0, x * 0.6, 17); ctx.stroke(); }
      ctx.restore();
      break;
    case 'pumpkin':
      circ(ctx, 0, 0, 16, grad('#ffd59e', '#ff9a2e', '#d9650f'));
      ctx.strokeStyle = 'rgba(180,80,10,.55)'; ctx.lineWidth = 1.6;
      for (const rx of [5, 10.5]) { ctx.beginPath(); ctx.ellipse(0, 0, rx, 15.5, 0, 0, Math.PI * 2); ctx.stroke(); }
      ctx.fillStyle = '#6d4a24'; rr(ctx, -2, -21, 4, 7, 1.5); ctx.fill();
      ell(ctx, 5, -17, 5, 2.4, '#2fc46b');
      break;
    case 'star':
      circ(ctx, 0, 0, 16, grad('#fff6c2', '#ffd23f', '#f29a00'));
      star(ctx, 0, 1, 9, '#fffdf0');
      break;
    case 'gold':
      circ(ctx, 0, 0, 16, grad('#fffbe0', '#f5c518', '#a77300'));
      star(ctx, -6, -6, 3.5 + Math.sin(t * 6) * 1.2, '#ffffff'); star(ctx, 7, 5, 2.2, '#fff6c2');
      break;
    case 'remote':                                   // Bom Hẹn Giờ: bóng sẫm màu có ăng-ten
      circ(ctx, 0, 0, 16, grad('#7d8299', '#3a3f55', '#1a1c27'));
      ctx.strokeStyle = '#ffd23f'; ctx.lineWidth = 2.5; ctx.beginPath(); ctx.arc(0, 0, 11, 0.2, Math.PI - 0.2); ctx.stroke();
      ctx.strokeStyle = '#9aa0b5'; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(4, -14); ctx.lineTo(8, -23); ctx.stroke();
      circ(ctx, 8, -24, 3, Math.floor(t * 4) % 2 ? '#ff4d5e' : '#7a1f2a');
      break;
    default:
      circ(ctx, 0, 0, 16, grad('#bfe9ff', '#3fa5ff', '#1c63d6'));
  }
  if (skin !== 'remote') circ(ctx, -6, -6, 4, 'rgba(255,255,255,.7)');
  if (flash) circ(ctx, 0, 0, 16, 'rgba(255,90,90,.55)');
  ctx.restore();
}

/** Phi tiêu */
function drawDartShape(ctx) {
  ctx.fillStyle = '#c7d3e0'; ctx.beginPath(); ctx.moveTo(14, 0); ctx.lineTo(6, -3); ctx.lineTo(6, 3); ctx.fill();
  ctx.fillStyle = '#7a4a24'; ctx.fillRect(-8, -1.5, 15, 3);
  ctx.fillStyle = '#e2473d'; ctx.beginPath(); ctx.moveTo(-8, 0); ctx.lineTo(-15, -6); ctx.lineTo(-11, 0); ctx.lineTo(-15, 6); ctx.fill();
}

// ---------------- VẬT PHẨM ----------------
const ITEM_COLORS = { bomb: '#2f8cff', range: '#22c3e6', speed: '#ffb21a', maxrange: '#a24bff', needle: '#8aa0b8', shield: '#ffcc33', kick: '#ff5a4f', mount: '#3ed37a',
  boots: '#2f8cff', bag: '#ff7a2f', nozzle: '#22c3e6', glove: '#ffb21a', vest: '#ff5a4f',
  dart: '#e2473d', remote: '#3a3f55', outfit: '#a55bff', skin: '#ff8fb8' };
function drawItemIcon(ctx, type) {
  if (type.startsWith('outfit:')) {              // trang phục: vẽ nhân vật Bin mặc thử
    ctx.save(); ctx.translate(0, 5); ctx.scale(0.5, 0.5); drawCharacter(ctx, 'bin', 2, 0, false, type.slice(7)); ctx.restore(); return;
  }
  if (type.startsWith('skin:')) { ctx.save(); ctx.scale(0.72, 0.72); drawBalloon(ctx, type.slice(5)); ctx.restore(); return; }
  switch (type) {
    case 'dart': ctx.save(); ctx.rotate(-0.7); ctx.scale(0.95, 0.95); drawDartShape(ctx); ctx.restore(); break;
    case 'remote': ctx.save(); ctx.translate(-1, 3); ctx.scale(0.62, 0.62); drawBalloon(ctx, 'remote', false, 0.6); ctx.restore(); break;
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
    // ----- trang bị cửa hàng -----
    case 'boots':                                   // giày có cánh
      ctx.fillStyle = '#2f8cff'; rr(ctx, -6, -11, 9, 16, 3); ctx.fill(); rr(ctx, -6, 0, 16, 7, 3); ctx.fill();
      ctx.fillStyle = '#fff'; rr(ctx, -7, 6, 18, 3, 1.5); ctx.fill();
      ctx.fillStyle = '#e8f6ff'; ctx.beginPath(); ctx.moveTo(-6, -8); ctx.quadraticCurveTo(-16, -12, -14, -2); ctx.quadraticCurveTo(-10, -6, -6, -3); ctx.fill();
      break;
    case 'bag':                                     // balo đựng bóng
      ctx.fillStyle = '#ff7a2f'; rr(ctx, -9, -8, 18, 19, 6); ctx.fill();
      ctx.fillStyle = '#d95a1a'; rr(ctx, -9, -8, 18, 8, 5); ctx.fill();
      ctx.strokeStyle = '#d95a1a'; ctx.lineWidth = 2; ctx.beginPath(); ctx.arc(0, -8, 5, Math.PI, 0); ctx.stroke();
      circ(ctx, 0, 5, 4.5, '#2f8cff'); circ(ctx, -1.5, 3.5, 1.4, 'rgba(255,255,255,.8)');
      break;
    case 'nozzle':                                  // súng nước
      ctx.fillStyle = '#ffb21a'; rr(ctx, -11, -4, 20, 8, 3); ctx.fill(); rr(ctx, -6, 2, 7, 10, 2); ctx.fill();
      ctx.fillStyle = '#ff7a2f'; rr(ctx, 8, -2.5, 5, 5, 1.5); ctx.fill();
      circ(ctx, -4, -8, 5, '#22c3e6'); circ(ctx, -5.5, -9.5, 1.5, 'rgba(255,255,255,.8)');
      circ(ctx, 15, 0, 1.6, '#7fd8ff'); circ(ctx, 15, -4, 1.2, '#7fd8ff');
      break;
    case 'glove':                                   // găng vàng
      circ(ctx, 1, 1, 8.5, '#ffb21a'); ctx.fillStyle = '#ffb21a'; rr(ctx, -9, -4, 7, 13, 3); ctx.fill();
      ctx.fillStyle = '#fff'; rr(ctx, -3, 8, 12, 3, 1.5); ctx.fill(); star(ctx, 2, 0, 4, '#fff6a0');
      break;
    case 'vest':                                    // áo phao
      ctx.fillStyle = '#ff5a4f'; ctx.beginPath(); ctx.moveTo(-10, -9); ctx.lineTo(-4, -11); ctx.lineTo(0, -6); ctx.lineTo(4, -11); ctx.lineTo(10, -9); ctx.lineTo(10, 11); ctx.lineTo(-10, 11); ctx.closePath(); ctx.fill();
      ctx.fillStyle = '#fff'; ctx.fillRect(-10, -1, 20, 3); ctx.fillRect(-10, 5, 20, 3);
      ctx.fillStyle = '#1f2a44'; ctx.fillRect(-1, -6, 2, 17);
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
  ctx.lineWidth = 2.5; ctx.strokeStyle = ITEM_COLORS[type] || ITEM_COLORS[type.split(':')[0]]; ctx.beginPath(); ctx.arc(0, 0, 17, 0, Math.PI * 2); ctx.stroke();
  drawItemIcon(ctx, type);
  ctx.restore();
}

// ---------------- CHỦ ĐỀ BẢN ĐỒ ----------------
const THEMES = [
  { g1: '#93d46e', g2: '#88cb63', deco: '#6fb44c' },  // Làng Gió
  { g1: '#f3d593', g2: '#ecca7f', deco: '#d6ac62' },  // Sa Mạc
  { g1: '#ffe6f1', g2: '#ffd9ea', deco: '#ffb3d1' },  // Đảo Kẹo
  { g1: '#c9965c', g2: '#c08d53', deco: '#9c6a3a' },  // Thuyền Chiến (sàn gỗ)
  { g1: '#eaf6ff', g2: '#ddf0ff', deco: '#b9e0ff' },  // Băng Tuyết
  { g1: '#6db35a', g2: '#64a952', deco: '#4f8f3f' },  // Rừng Nấm
];
const WATER = '#3d9be0';

/** Ô nước biển: nền xanh + sóng trắng nhỏ */
function drawWater(ctx, x, y) {
  const px = x * TILE, py = y * TILE, v = hash(x, y);
  ctx.fillStyle = WATER; ctx.fillRect(px, py, TILE, TILE);
  ctx.strokeStyle = 'rgba(255,255,255,.45)'; ctx.lineWidth = 2; ctx.lineCap = 'round';
  for (const [ox, oy] of [[8 + v * 10, 14], [22 - v * 8, 32]]) {
    ctx.beginPath(); ctx.arc(px + ox, py + oy, 5, Math.PI * 1.1, Math.PI * 1.9); ctx.arc(px + ox + 9, py + oy, 5, Math.PI * 1.1, Math.PI * 1.9); ctx.stroke();
  }
}

function drawWall(ctx, x, y, theme) {
  const px = x * TILE, py = y * TILE;
  const v = hash(x, y);
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
  } else if (theme === 3) {
    if (v < 0.5) {           // đại bác
      ctx.fillStyle = '#7a4f2a'; rr(ctx, 9, 28, 30, 11, 3); ctx.fill();
      circ(ctx, 15, 40, 5.5, '#3b3b46'); circ(ctx, 33, 40, 5.5, '#3b3b46'); circ(ctx, 15, 40, 2, '#8a8a99'); circ(ctx, 33, 40, 2, '#8a8a99');
      ctx.fillStyle = '#4a4a58'; rr(ctx, 6, 15, 34, 14, 7); ctx.fill();
      circ(ctx, 40, 22, 7.5, '#5a5a6a'); circ(ctx, 40, 22, 4, '#1f1f26');
      ctx.fillStyle = 'rgba(255,255,255,.2)'; rr(ctx, 10, 17, 22, 3, 1.5); ctx.fill();
    } else {                 // cột buồm
      ctx.fillStyle = '#7a4f2a'; rr(ctx, 21, 0, 6, 46, 2); ctx.fill();
      ctx.fillStyle = '#fbf6ea'; ctx.beginPath(); ctx.moveTo(6, 6); ctx.lineTo(42, 6); ctx.quadraticCurveTo(38, 22, 42, 34); ctx.lineTo(6, 34); ctx.quadraticCurveTo(10, 22, 6, 6); ctx.fill();
      ctx.fillStyle = '#e2574c'; ctx.fillRect(6, 17, 36, 5);
      ctx.fillStyle = '#1f2a44'; ctx.beginPath(); ctx.moveTo(27, 0); ctx.lineTo(37, 3); ctx.lineTo(27, 6); ctx.fill();
    }
  } else if (theme === 4) {
    if (v < 0.45) {          // người tuyết
      circ(ctx, 24, 33, 12, '#ffffff'); circ(ctx, 24, 15, 9, '#ffffff');
      circ(ctx, 21, 13, 1.6, '#1f2a44'); circ(ctx, 27, 13, 1.6, '#1f2a44');
      ctx.fillStyle = '#ff8a1f'; ctx.beginPath(); ctx.moveTo(24, 16); ctx.lineTo(31, 18); ctx.lineTo(24, 19); ctx.fill();
      ctx.fillStyle = '#e2574c'; rr(ctx, 15, 21, 18, 4, 2); ctx.fill(); rr(ctx, 27, 21, 4, 10, 2); ctx.fill();
      ctx.fillStyle = '#1f2a44'; rr(ctx, 16, 2, 16, 5, 2); ctx.fill(); rr(ctx, 19, -4, 10, 8, 2); ctx.fill();
    } else {                 // khối băng
      ctx.fillStyle = '#7cc4f5'; rr(ctx, 4, 4, 40, 40, 8); ctx.fill();
      ctx.fillStyle = '#a9dcff'; ctx.beginPath(); ctx.moveTo(8, 8); ctx.lineTo(40, 8); ctx.lineTo(24, 26); ctx.closePath(); ctx.fill();
      ctx.strokeStyle = 'rgba(255,255,255,.8)'; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(12, 34); ctx.lineTo(20, 26); ctx.moveTo(30, 38); ctx.lineTo(38, 28); ctx.stroke();
    }
  } else if (theme === 5) {
    if (v < 0.55) {          // nấm khổng lồ
      ctx.fillStyle = '#f6e7cf'; rr(ctx, 17, 22, 14, 22, 5); ctx.fill();
      ctx.fillStyle = ['#e2473d', '#9b5bff', '#ff8a1f'][(v * 5.4) | 0] || '#e2473d';
      ctx.beginPath(); ctx.ellipse(24, 22, 21, 17, 0, Math.PI, 0); ctx.closePath(); ctx.fill();
      for (const [dx, dy, r] of [[14, 14, 3.5], [27, 9, 3], [33, 17, 3], [21, 18, 2.2]]) circ(ctx, dx, dy, r, '#fff');
    } else {                 // đá phủ rêu
      ctx.fillStyle = '#8a8f99'; rr(ctx, 4, 9, 40, 35, 13); ctx.fill();
      ctx.fillStyle = '#3f9b4a'; rr(ctx, 4, 9, 40, 12, 10); ctx.fill();
      circ(ctx, 14, 30, 3, 'rgba(255,255,255,.15)');
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
  } else if (theme === 3) {                       // thùng rượu gỗ
    ctx.fillStyle = '#a8693a'; rr(ctx, 9, 6, 30, 37, 12); ctx.fill();
    ctx.fillStyle = '#6d6d78'; ctx.fillRect(9, 13, 30, 4); ctx.fillRect(9, 32, 30, 4);
    ctx.fillStyle = 'rgba(0,0,0,.15)'; ctx.fillRect(18, 6, 2, 37); ctx.fillRect(28, 6, 2, 37);
    ctx.fillStyle = 'rgba(255,255,255,.2)'; rr(ctx, 12, 8, 5, 30, 2.5); ctx.fill();
  } else if (theme === 4) {                       // đống tuyết
    ctx.fillStyle = '#cfe6f7'; rr(ctx, 5, 12, 38, 31, 14); ctx.fill();
    ctx.fillStyle = '#ffffff'; rr(ctx, 5, 9, 38, 27, 13); ctx.fill();
    star(ctx, 15, 18, 3.5, '#bfe3ff'); star(ctx, 32, 24, 2.5, '#bfe3ff');
  } else if (theme === 5) {                       // gốc cây
    ctx.fillStyle = '#7a4a24'; rr(ctx, 8, 16, 32, 27, 6); ctx.fill();
    ell(ctx, 24, 16, 16, 7, '#d9a86c');
    ctx.strokeStyle = '#a8713c'; ctx.lineWidth = 1.5; ctx.beginPath(); ctx.ellipse(24, 16, 10, 4, 0, 0, Math.PI * 2); ctx.stroke();
    ctx.beginPath(); ctx.ellipse(24, 16, 4.5, 1.8, 0, 0, Math.PI * 2); ctx.stroke();
    ctx.fillStyle = '#5ea84d'; circ(ctx, 12, 40, 4, '#5ea84d'); circ(ctx, 37, 41, 3, '#5ea84d');
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

  /**
   * Đổi độ phân giải vẽ (khi phóng to toàn màn hình) để hình không bị mờ.
   * pr = số điểm ảnh thật cho mỗi điểm ảnh của bàn chơi gốc 720x624.
   */
  resize(pr) {
    pr = Math.min(3, Math.max(1, Math.round(pr * 4) / 4));     // làm tròn 0.25 để không vẽ lại liên tục
    if (pr === this.dpr) return;
    this.dpr = pr;
    this.cv.width = W * pr; this.cv.height = H * pr;
    this.layer.width = W * pr; this.layer.height = H * pr;
    this.grid = '';                                             // buộc vẽ lại lớp nền
  }

  /** Chọn bản đồ: lấy chủ đề màu + vị trí các ô nước '~' */
  setMap(mapDef) { this.theme = mapDef.theme; this.rows = mapDef.rows; this.grid = ''; }

  /** Vẽ lại lớp nền tĩnh (cỏ, tường, thùng) khi lưới thay đổi */
  setGrid(grid) {
    if (grid === this.grid) return;
    this.grid = grid;
    const ctx = this.layer.getContext('2d');
    ctx.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);
    const th = THEMES[this.theme];
    for (let y = 0; y < ROWS; y++) for (let x = 0; x < COLS; x++) {
      ctx.fillStyle = (x + y) % 2 ? th.g1 : th.g2; ctx.fillRect(x * TILE, y * TILE, TILE, TILE);
      if (this.theme === 3) {                       // sàn tàu: ván gỗ + đinh
        ctx.fillStyle = th.deco; ctx.fillRect(x * TILE, y * TILE + 15, TILE, 1.5); ctx.fillRect(x * TILE, y * TILE + 31, TILE, 1.5);
        circ(ctx, x * TILE + 4, y * TILE + 8, 1.2, th.deco); circ(ctx, x * TILE + 44, y * TILE + 40, 1.2, th.deco);
      }
      if (this.rows && this.rows[y][x] === '~') { drawWater(ctx, x, y); continue; }
      const v = hash(x, y);
      if (v > 0.6) {
        ctx.fillStyle = th.deco;
        if (this.theme === 2) { circ(ctx, x * TILE + v * 40, y * TILE + (1 - v) * 40, 2, ['#ff8fb8', '#7cc8ff', '#ffd35c'][(v * 30) % 3 | 0]); }
        else if (this.theme === 4) star(ctx, x * TILE + 8 + v * 30, y * TILE + 8 + (1 - v) * 30, 3, th.deco);
        else if (this.theme === 5) { circ(ctx, x * TILE + v * 40, y * TILE + 12 + v * 20, 2.2, '#fff6a0'); circ(ctx, x * TILE + v * 40 + 5, y * TILE + 14 + v * 20, 2, '#ff9fc4'); }
        else if (this.theme !== 3) { ctx.fillRect(x * TILE + v * 36, y * TILE + 10 + v * 20, 2, 6); ctx.fillRect(x * TILE + v * 36 + 4, y * TILE + 12 + v * 20, 2, 4); }
      }
    }
    for (let y = 0; y < ROWS; y++) for (let x = 0; x < COLS; x++) {
      const c = grid[y * COLS + x];
      if (c === '#' && this.rows && this.rows[y][x] === '~') continue;   // nước đã vẽ ở lớp nền
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
    for (const d of view.darts || []) this.drawDart(d);

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
    const total = b.remote ? TIMING.REMOTE_MAX : TIMING.BOMB_FUSE;
    const left = Math.max(0, b.left);                                // ms còn lại tới lúc nổ
    const k = 1 - left / total;
    const freq = b.remote ? 3 : 4 + k * 14;
    const s = 1 + Math.sin(t * freq) * (0.05 + (b.remote ? 0 : k * 0.07));
    const x = b.x * TILE + 24, y = b.y * TILE + 25;
    const owner = view.players.find((p) => p.id === b.owner);
    const team = owner ? TEAMS[owner.team].color : '#2f8cff';
    ell(ctx, x, y + 15, 14, 4, 'rgba(0,0,0,.2)');
    ctx.save(); ctx.translate(x, y); ctx.scale(s, 1 / s);
    if (b.ghost) ctx.globalAlpha = 0.85;                             // bóng dự đoán, chờ server xác nhận
    drawBalloon(ctx, b.remote ? 'remote' : owner?.skin, !b.remote && left < 600 && Math.floor(t * 16) % 2 === 0, t);
    if (!b.remote) { ctx.fillStyle = team; ctx.beginPath(); ctx.moveTo(-4, -17); ctx.lineTo(4, -17); ctx.lineTo(0, -12); ctx.fill(); }
    ctx.restore();
    // vòng đếm thời gian nổ (Bom Hẹn Giờ: vòng tím = thời gian tự nổ)
    ctx.lineWidth = 3; ctx.lineCap = 'round';
    ctx.strokeStyle = 'rgba(255,255,255,.35)'; ctx.beginPath(); ctx.arc(x, y, 21, 0, Math.PI * 2); ctx.stroke();
    ctx.strokeStyle = b.remote ? '#a55bff' : left < 1000 ? '#ff4d5e' : left < 2000 ? '#ffc21a' : '#ffffff';
    ctx.beginPath(); ctx.arc(x, y, 21, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * (left / total)); ctx.stroke();
  }

  drawDart(d) {
    const { ctx } = this;
    ctx.save(); ctx.translate(d.x * TILE + 24, d.y * TILE + 24);
    ctx.rotate([0, -Math.PI / 2, Math.PI / 2, Math.PI, 0][d.d]);
    ctx.globalAlpha = 0.35; ctx.fillStyle = '#fff'; ctx.fillRect(-30, -1, 18, 2); ctx.globalAlpha = 1;
    drawDartShape(ctx);
    ctx.restore();
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
    drawCharacter(ctx, p.charId, p.dir, t + (p.id.charCodeAt(1) || 0), p.moving && !trapped, p.outfit);
    if (trapped) {                                                   // bị nhốt trong bong bóng
      const wob = 1 + Math.sin(t * 6) * 0.04;
      ctx.save(); ctx.scale(wob, 1 / wob);
      const g = ctx.createRadialGradient(-8, -12, 4, 0, 0, 30);
      g.addColorStop(0, 'rgba(255,255,255,.45)'); g.addColorStop(0.7, 'rgba(120,200,255,.25)'); g.addColorStop(1, 'rgba(80,170,255,.55)');
      circ(ctx, 0, 0, 29, g);
      ctx.strokeStyle = 'rgba(255,255,255,.8)'; ctx.lineWidth = 2; ctx.beginPath(); ctx.arc(0, 0, 29, 0, Math.PI * 2); ctx.stroke();
      ell(ctx, -11, -15, 6, 3.5, 'rgba(255,255,255,.8)');
      ctx.restore();
      const k = Math.min(1, p.trapLeft / TIMING.TRAP_TIME);         // vòng đếm ngược vỡ bong bóng
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
export function paintCharPreview(canvas, charId, t = 0, outfit = null) {
  const ctx = canvas.getContext('2d');
  const d = Math.min(window.devicePixelRatio || 1, 2);
  if (canvas.width !== 64 * d) { canvas.width = 64 * d; canvas.height = 64 * d; }
  ctx.setTransform(d, 0, 0, d, 0, 0); ctx.clearRect(0, 0, 64, 64);
  ctx.translate(32, 36);
  ell(ctx, 0, 21, 14, 4, 'rgba(0,0,0,.15)');
  drawCharacter(ctx, charId, 2, t, false, outfit);
}

/** Khung xem trước trong cửa hàng: nhân vật mặc trang phục + quả bóng đang dùng */
export function paintShopPreview(canvas, charId, outfit, skin, t = 0) {
  const ctx = canvas.getContext('2d');
  const d = Math.min(window.devicePixelRatio || 1, 2), w = 240, h = 170;
  if (canvas.width !== w * d) { canvas.width = w * d; canvas.height = h * d; }
  ctx.setTransform(d, 0, 0, d, 0, 0); ctx.clearRect(0, 0, w, h);
  const g = ctx.createLinearGradient(0, 0, 0, h); g.addColorStop(0, '#bfe9ff'); g.addColorStop(1, '#93d46e');
  rr(ctx, 0, 0, w, h, 16); ctx.fillStyle = g; ctx.fill();
  ell(ctx, 90, 150, 34, 8, 'rgba(0,0,0,.15)'); ell(ctx, 180, 150, 20, 5, 'rgba(0,0,0,.15)');
  ctx.save(); ctx.translate(90, 104); ctx.scale(2.1, 2.1); drawCharacter(ctx, charId, 2, t, false, outfit); ctx.restore();
  ctx.save(); ctx.translate(180, 118 + Math.sin(t * 3) * 3); ctx.scale(1.5, 1.5); drawBalloon(ctx, skin, false, t);
  ctx.fillStyle = '#3d8bff'; ctx.beginPath(); ctx.moveTo(-4, -17); ctx.lineTo(4, -17); ctx.lineTo(0, -12); ctx.fill(); ctx.restore();
}

/** Ảnh thu nhỏ bản đồ */
export function paintMapPreview(canvas, mapDef) {
  const ctx = canvas.getContext('2d');
  const s = 8; canvas.width = COLS * s; canvas.height = ROWS * s;
  const th = THEMES[mapDef.theme];
  const wall = ['#e2574c', '#b07a46', '#b97ce8', '#4a4a58', '#7cc4f5', '#e2473d'][mapDef.theme];
  const box = ['#c98b4b', '#d9874f', '#5ec8ff', '#a8693a', '#ffffff', '#7a4a24'][mapDef.theme];
  mapDef.rows.forEach((row, y) => [...row].forEach((c, x) => {
    ctx.fillStyle = c === '~' ? WATER : c === '#' ? wall : c === '?' || c === 'x' ? box : (x + y) % 2 ? th.g1 : th.g2;
    if (c === '?') ctx.globalAlpha = 0.55;
    ctx.fillRect(x * s, y * s, s, s); ctx.globalAlpha = 1;
  }));
}

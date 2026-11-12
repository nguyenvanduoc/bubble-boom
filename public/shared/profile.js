// ============================================================
// HỒ SƠ NGƯỜI CHƠI: ví xu, kho vật phẩm, trang bị
// Chỉ là dữ liệu + hàm thuần -> dùng chung cho server (lưu file) và offline (lưu trình duyệt)
// ============================================================
import { SHOP, MAX_EQUIP, START_COINS, REWARD } from './constants.js';

export function newProfile() {
  return { coins: START_COINS, inv: { needle: 0, shield: 0 }, owned: [], equipped: [], games: 0, wins: 0 };
}

/** Bổ sung trường còn thiếu + loại dữ liệu sai (khi đọc từ file / localStorage) */
export function fixProfile(p) {
  const d = newProfile();
  p.coins = Number.isFinite(p.coins) ? Math.max(0, Math.floor(p.coins)) : d.coins;
  p.inv = { needle: Math.max(0, p.inv?.needle | 0), shield: Math.max(0, p.inv?.shield | 0) };
  p.owned = Array.isArray(p.owned) ? [...new Set(p.owned.filter((id) => SHOP[id]?.kind === 'gear'))] : [];
  p.equipped = Array.isArray(p.equipped) ? p.equipped.filter((id) => p.owned.includes(id)).slice(0, MAX_EQUIP) : [];
  p.games = p.games | 0; p.wins = p.wins | 0;
  return p;
}

/** Mua hàng. Trả về chuỗi lỗi, hoặc null nếu thành công */
export function buy(p, id, qty = 1) {
  const it = SHOP[id];
  if (!it) return 'Vật phẩm không tồn tại';
  qty = it.kind === 'gear' ? 1 : Math.max(1, Math.min(10, qty | 0));
  if (it.kind === 'gear' && p.owned.includes(id)) return 'Bạn đã có trang bị này rồi';
  const cost = it.price * qty;
  if (p.coins < cost) return `Không đủ xu (cần ${cost}, đang có ${p.coins})`;
  p.coins -= cost;
  if (it.kind === 'gear') {
    p.owned.push(id);
    if (p.equipped.length < MAX_EQUIP) p.equipped.push(id);   // còn chỗ thì mặc luôn
  } else p.inv[id] += qty;
  return null;
}

/** Mặc / tháo trang bị */
export function equip(p, id, on) {
  if (!p.owned.includes(id)) return 'Bạn chưa có trang bị này';
  if (!on) { p.equipped = p.equipped.filter((x) => x !== id); return null; }
  if (p.equipped.includes(id)) return null;
  if (p.equipped.length >= MAX_EQUIP) return `Chỉ mặc được tối đa ${MAX_EQUIP} trang bị, hãy tháo bớt`;
  p.equipped.push(id);
  return null;
}

/** Lúc bắt đầu trận: lấy vật phẩm ra khỏi kho + cộng chỉ số từ trang bị */
export function takeLoadout(p) {
  const needles = Math.min(p.inv.needle, SHOP.needle.carry);
  const shields = Math.min(p.inv.shield, SHOP.shield.carry);
  p.inv.needle -= needles; p.inv.shield -= shields;
  const lo = { needles, shields, bonus: { b: 0, r: 0, s: 0 }, kick: false, trapBonus: 0, gear: [...p.equipped] };
  for (const id of p.equipped) {
    const it = SHOP[id];
    for (const k in it.bonus || {}) lo.bonus[k] += it.bonus[k];
    if (it.kick) lo.kick = true;
    if (it.trapBonus) lo.trapBonus += it.trapBonus;
  }
  return lo;
}

/** Hết trận: hoàn vật phẩm chưa dùng (không vượt số đã mang vào) + cộng xu thưởng */
export function settle(p, lo, gp, won) {
  if (lo) {
    p.inv.needle += Math.min(gp.needles, lo.needles);
    p.inv.shield += Math.min(gp.shields, lo.shields);
  }
  const coins = REWARD.play + gp.kills * REWARD.kill + gp.boxes * REWARD.box + (won ? REWARD.win : 0);
  p.coins += coins; p.games++; if (won) p.wins++;
  return coins;
}

/** Kho lưu trong bộ nhớ (mặc định nếu không truyền kho nào) */
export class MemoryStore {
  constructor() { this.data = {}; }
  get(token) { return fixProfile(this.data[token] || (this.data[token] = newProfile())); }
  save() {}
}

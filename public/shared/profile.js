// ============================================================
// HỒ SƠ NGƯỜI CHƠI: ví xu, kho vật phẩm, trang phục, bóng nước, phụ kiện
// Chỉ là dữ liệu + hàm thuần -> dùng chung cho server (lưu file) và offline (lưu trình duyệt)
// ============================================================
import { SHOP, ITEM_IDS, MAX_EQUIP, START_COINS, REWARD } from './constants.js';

// Mã người chơi CÔNG KHAI (đưa cho admin khi cần cấp xu). Khác với token bí mật dùng để mở ví.
const PID_ABC = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
export const genPid = () => 'BB' + Array.from({ length: 6 }, () => PID_ABC[(Math.random() * PID_ABC.length) | 0]).join('');
export const PID_RE = /^BB[A-Z0-9]{6}$/;
export const MAX_GRANT = 1_000_000;   // admin cấp/trừ tối đa 1 triệu xu mỗi lần

export function newProfile() {
  return {
    pid: genPid(), name: '', lastSeen: 0,
    coins: START_COINS,
    inv: Object.fromEntries(ITEM_IDS.map((id) => [id, 0])),  // { needle, shield, dart, remote }
    owned: [],          // trang phục / bóng / phụ kiện đã mua
    equipped: [],       // phụ kiện đang mặc (tối đa MAX_EQUIP)
    outfit: null,       // trang phục đang mặc
    skin: null,         // kiểu bóng đang dùng
    games: 0, wins: 0,
  };
}

/** Bổ sung trường còn thiếu + loại dữ liệu sai (khi đọc từ file / localStorage, hoặc bản cũ) */
export function fixProfile(p) {
  if (!PID_RE.test(p.pid)) p.pid = genPid();
  p.name = String(p.name || '').slice(0, 16);
  p.lastSeen = Number(p.lastSeen) || 0;
  p.coins = Number.isFinite(p.coins) ? Math.max(0, Math.floor(p.coins)) : START_COINS;
  const inv = p.inv || {};
  p.inv = Object.fromEntries(ITEM_IDS.map((id) => [id, Math.max(0, inv[id] | 0)]));
  p.owned = Array.isArray(p.owned) ? [...new Set(p.owned.filter((id) => SHOP[id] && SHOP[id].kind !== 'item'))] : [];
  p.equipped = Array.isArray(p.equipped) ? p.equipped.filter((id) => p.owned.includes(id) && SHOP[id].kind === 'gear').slice(0, MAX_EQUIP) : [];
  if (!p.owned.includes(p.outfit) || SHOP[p.outfit]?.kind !== 'outfit') p.outfit = null;
  if (!p.owned.includes(p.skin) || SHOP[p.skin]?.kind !== 'skin') p.skin = null;
  p.games = p.games | 0; p.wins = p.wins | 0;
  return p;
}

/** Mua hàng: trừ xu. Trả về chuỗi lỗi, hoặc null nếu thành công */
export function buy(p, id, qty = 1) {
  const it = SHOP[id];
  if (!it) return 'Món hàng không tồn tại';
  qty = it.kind === 'item' ? Math.max(1, Math.min(10, qty | 0)) : 1;
  if (it.kind !== 'item' && p.owned.includes(id)) return 'Bạn đã có món này rồi';
  const cost = it.price * qty;
  if (p.coins < cost) return `Không đủ xu (cần ${cost}, đang có ${p.coins})`;
  p.coins -= cost;
  if (it.kind === 'item') { p.inv[id] += qty; return null; }
  p.owned.push(id);
  // mua xong tự mặc/dùng luôn cho tiện
  if (it.kind === 'outfit') p.outfit = id;
  else if (it.kind === 'skin') p.skin = id;
  else if (p.equipped.length < MAX_EQUIP) p.equipped.push(id);
  return null;
}

/** Mặc / tháo (trang phục, bóng nước: 1 món; phụ kiện: tối đa MAX_EQUIP món) */
export function equip(p, id, on) {
  const it = SHOP[id];
  if (!it || !p.owned.includes(id)) return 'Bạn chưa có món này';
  if (it.kind === 'outfit') { p.outfit = on ? id : null; return null; }
  if (it.kind === 'skin') { p.skin = on ? id : null; return null; }
  if (!on) { p.equipped = p.equipped.filter((x) => x !== id); return null; }
  if (p.equipped.includes(id)) return null;
  if (p.equipped.length >= MAX_EQUIP) return `Chỉ mặc được tối đa ${MAX_EQUIP} phụ kiện, hãy tháo bớt`;
  p.equipped.push(id);
  return null;
}

/** Lúc bắt đầu trận: lấy vật phẩm ra khỏi kho (tối đa "carry" mỗi loại) + cộng chỉ số phụ kiện */
export function takeLoadout(p) {
  const items = {};
  for (const id of ITEM_IDS) { items[id] = Math.min(p.inv[id], SHOP[id].carry); p.inv[id] -= items[id]; }
  const lo = { items, bonus: { b: 0, r: 0, s: 0 }, kick: false, trapBonus: 0, gear: [...p.equipped] };
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
  if (lo) for (const id of ITEM_IDS) p.inv[id] += Math.min(gp[SHOP[id].field] | 0, lo.items[id]);
  const coins = REWARD.play + gp.kills * REWARD.kill + gp.boxes * REWARD.box + (won ? REWARD.win : 0);
  p.coins += coins; p.games++; if (won) p.wins++;
  return coins;
}

/** Admin cấp (số dương) hoặc trừ (số âm) xu. Trả về { error } hoặc { before, after } */
export function adminGrant(p, amount) {
  if (!Number.isInteger(amount) || amount === 0) return { error: 'Số xu phải là số nguyên khác 0' };
  if (Math.abs(amount) > MAX_GRANT) return { error: `Mỗi lần tối đa ${MAX_GRANT.toLocaleString('vi-VN')} xu` };
  const before = p.coins;
  p.coins = Math.max(0, p.coins + amount);   // không để ví bị âm
  return { before, after: p.coins };
}

/** Kho lưu trong bộ nhớ (mặc định nếu không truyền kho nào) */
export class MemoryStore {
  constructor() { this.data = {}; }
  get(token) { return fixProfile(this.data[token] || (this.data[token] = newProfile())); }
  entries() { return Object.entries(this.data).map(([t, p]) => [t, fixProfile(p)]); }
  findPid(pid) { return this.entries().find(([, p]) => p.pid === pid) || null; }
  save() {}
}

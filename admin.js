// ============================================================
// API QUẢN TRỊ: đăng nhập admin, xem người chơi, cấp / trừ xu, lịch sử
// Mọi đường dẫn bắt đầu bằng /api/admin/
// ============================================================
import { randomBytes, timingSafeEqual, createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { writeFile, rename } from 'node:fs/promises';
import { adminGrant, PID_RE } from './public/shared/profile.js';

const SESSION_MS = 12 * 60 * 60 * 1000;   // phiên đăng nhập 12 giờ
const MAX_FAILS = 5;                       // sai 5 lần -> khoá 10 phút
const LOCK_MS = 10 * 60 * 1000;
const LOG_KEEP = 1000;                     // giữ 1000 dòng lịch sử gần nhất

/** Bỏ dấu tiếng Việt để tìm "minh" ra "Minh", "Mính"... */
const fold = (s) => String(s).normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/đ/g, 'd').replace(/Đ/g, 'D').toLowerCase();

export function createAdmin({ store, lobby, password, logFile }) {
  const sessions = new Map();              // phiên: chuỗi ngẫu nhiên -> hạn dùng
  const fails = new Map();                 // IP -> { n: số lần sai, until }
  let log = [];
  try { log = JSON.parse(readFileSync(logFile, 'utf8')); } catch { /* chưa có lịch sử */ }
  let saveTimer = null;
  const saveLog = () => {
    if (saveTimer) return;
    saveTimer = setTimeout(async () => {
      saveTimer = null;
      await writeFile(logFile + '.tmp', JSON.stringify(log.slice(-LOG_KEEP)));
      await rename(logFile + '.tmp', logFile);
    }, 1000);
  };

  // So sánh mật khẩu thời gian cố định (băm trước để 2 chuỗi luôn dài bằng nhau)
  const sha = (s) => createHash('sha256').update(String(s ?? '')).digest();
  const passwordOk = (pw) => timingSafeEqual(sha(pw), sha(password));

  const send = (res, code, obj) => {
    res.writeHead(code, { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' });
    res.end(JSON.stringify(obj));
  };

  /** Đọc JSON trong thân request (tối đa 10KB) */
  const readBody = (req) => new Promise((resolve, reject) => {
    let size = 0; const chunks = [];
    req.on('data', (c) => { size += c.length; if (size > 10240) { reject(new Error('Dữ liệu quá lớn')); req.destroy(); } else chunks.push(c); });
    req.on('end', () => { try { resolve(JSON.parse(Buffer.concat(chunks).toString() || '{}')); } catch { reject(new Error('JSON không hợp lệ')); } });
    req.on('error', reject);
  });

  /** Trả về true nếu request này là của API admin (đã được xử lý) */
  return async function handleAdmin(req, res, url) {
    if (!url.pathname.startsWith('/api/admin/')) return false;
    const route = url.pathname.slice('/api/admin/'.length);
    const ip = req.socket.remoteAddress || '?';
    try {
      // ---------- đăng nhập ----------
      if (route === 'login' && req.method === 'POST') {
        const f = fails.get(ip);
        if (f && f.n >= MAX_FAILS && Date.now() < f.until) { send(res, 429, { error: 'Sai quá nhiều lần, thử lại sau 10 phút' }); return true; }
        const { password: pw } = await readBody(req);
        if (!passwordOk(pw)) {
          const n = f && Date.now() < f.until ? f.n + 1 : 1;
          fails.set(ip, { n, until: Date.now() + LOCK_MS });
          send(res, 401, { error: `Sai mật khẩu (còn ${Math.max(0, MAX_FAILS - n)} lần thử)` });
          return true;
        }
        fails.delete(ip);
        const token = randomBytes(24).toString('hex');
        sessions.set(token, Date.now() + SESSION_MS);
        send(res, 200, { token });
        return true;
      }

      // ---------- các API còn lại cần đăng nhập ----------
      const auth = String(req.headers.authorization || '').replace(/^Bearer\s+/i, '');
      const exp = sessions.get(auth);
      if (!exp || exp < Date.now()) { sessions.delete(auth); send(res, 401, { error: 'Chưa đăng nhập hoặc phiên đã hết hạn' }); return true; }

      if (route === 'logout' && req.method === 'POST') { sessions.delete(auth); send(res, 200, { ok: true }); return true; }

      if (route === 'players' && req.method === 'GET') {
        const q = fold(url.searchParams.get('q') || '').trim();
        const online = lobby.onlineTokens();
        const list = store.entries()
          .filter(([, p]) => !q || fold(p.pid).includes(q) || fold(p.name).includes(q))
          .map(([t, p]) => ({ pid: p.pid, name: p.name, coins: p.coins, games: p.games, wins: p.wins, lastSeen: p.lastSeen, online: online.has(t) }))
          .sort((a, b) => b.online - a.online || b.lastSeen - a.lastSeen)
          .slice(0, 200);
        const all = store.entries();
        send(res, 200, { players: list, total: all.length, online: online.size, coins: all.reduce((s, [, p]) => s + p.coins, 0) });
        return true;
      }

      if (route === 'grant' && req.method === 'POST') {
        const { pid, amount, reason } = await readBody(req);
        const code = String(pid || '').toUpperCase().trim();
        if (!PID_RE.test(code)) { send(res, 400, { error: 'Mã người chơi không hợp lệ (dạng BBxxxxxx)' }); return true; }
        const found = store.findPid(code);
        if (!found) { send(res, 404, { error: 'Không tìm thấy người chơi ' + code }); return true; }
        const [token, p] = found;
        const r = adminGrant(p, Number(amount));
        if (r.error) { send(res, 400, { error: r.error }); return true; }
        store.save();
        const entry = { time: Date.now(), pid: p.pid, name: p.name, amount: Number(amount), before: r.before, after: r.after,
          reason: String(reason || '').replace(/[\u0000-\u001f<>]/g, '').slice(0, 100), ip };
        log.push(entry); if (log.length > LOG_KEEP) log = log.slice(-LOG_KEEP);
        saveLog();
        // Người chơi đang online thấy ngay số xu mới + thông báo
        const amt = Number(amount);
        lobby.notifyProfile(token, amt > 0 ? `🎁 Admin đã tặng bạn ${amt.toLocaleString('vi-VN')} xu!` : `Admin đã điều chỉnh ${amt.toLocaleString('vi-VN')} xu`);
        console.log(`[admin] ${ip} cấp ${amt} xu cho ${p.pid} (${p.name}): ${r.before} -> ${r.after}. Lý do: ${entry.reason || '-'}`);
        send(res, 200, { ok: true, coins: r.after, entry });
        return true;
      }

      if (route === 'log' && req.method === 'GET') { send(res, 200, { log: log.slice(-100).reverse() }); return true; }

      send(res, 404, { error: 'Không có API này' });
    } catch (e) {
      send(res, 400, { error: e.message });
    }
    return true;
  };
}

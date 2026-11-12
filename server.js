// ============================================================
// SERVER: phục vụ file tĩnh (HTML/JS/CSS) + WebSocket cho chơi online
// Chạy: npm install && npm start  -> mở http://localhost:3000
// ============================================================
import http from 'node:http';
import { readFile } from 'node:fs/promises';
import { extname, join, resolve, sep, dirname } from 'node:path';
import { randomBytes } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { WebSocketServer } from 'ws';
import { Lobby } from './public/shared/rooms.js';
import { FileStore } from './profile-store.js';
import { createAdmin } from './admin.js';

const PORT = Number(process.env.PORT) || 3000;
const PUBLIC = resolve(join(fileURLToPath(new URL('.', import.meta.url)), 'public'));
const MIME = {
  '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8', '.json': 'application/json', '.svg': 'image/svg+xml',
  '.png': 'image/png', '.ico': 'image/x-icon',
};

// ---------- HTTP: trả file trong thư mục public ----------
const server = http.createServer(async (req, res) => {
  try {
    const url = new URL(req.url, 'http://x');
    if (url.pathname === '/health') { res.writeHead(200); return res.end('ok'); }
    if (await admin(req, res, url)) return;                  // API quản trị /api/admin/...
    // Xét dấu '/' trên URL TRƯỚC khi đổi sang đường dẫn hệ điều hành
    // (Windows dùng '\' nên kiểm tra sau khi normalize sẽ sai -> lỗi "Not found")
    let rel = decodeURIComponent(url.pathname);
    if (rel.endsWith('/')) rel += 'index.html';
    const file = resolve(PUBLIC, '.' + rel);
    if (!file.startsWith(PUBLIC + sep)) { res.writeHead(403); return res.end(); } // chặn ../ đọc file ngoài
    const data = await readFile(file);
    res.writeHead(200, { 'Content-Type': MIME[extname(file)] || 'application/octet-stream', 'Cache-Control': 'no-cache' });
    res.end(data);
  } catch {
    res.writeHead(404); res.end('Not found');
  }
});

// ---------- WebSocket: mỗi kết nối = 1 người chơi ----------
const ROOT = fileURLToPath(new URL('.', import.meta.url));
const DATA_FILE = process.env.DATA_FILE || join(ROOT, 'data', 'profiles.json');
const store = new FileStore(DATA_FILE);
const lobby = new Lobby(store);

// ---------- Quản trị: mật khẩu lấy từ biến môi trường ADMIN_PASSWORD ----------
// Không đặt -> tạo mật khẩu ngẫu nhiên mỗi lần chạy và in ra terminal
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || randomBytes(6).toString('hex');
const admin = createAdmin({ store, lobby, password: ADMIN_PASSWORD, logFile: join(dirname(DATA_FILE), 'admin-log.json') });
const wss = new WebSocketServer({ server, path: '/ws', maxPayload: 4096, perMessageDeflate: false });

wss.on('connection', (ws) => {
  ws.isAlive = true;
  ws.on('pong', () => { ws.isAlive = true; });
  const client = lobby.connect((msg) => {
    if (ws.readyState === ws.OPEN) ws.send(typeof msg === 'string' ? msg : JSON.stringify(msg));
  });
  ws.on('message', (data) => {
    let msg;
    try { msg = JSON.parse(data); } catch { return; }
    lobby.handle(client, msg);
  });
  ws.on('close', () => lobby.disconnect(client));
});

// Ngắt kết nối "chết" (mất mạng mà không đóng socket) sau ~20 giây
setInterval(() => {
  for (const ws of wss.clients) {
    if (!ws.isAlive) { ws.terminate(); continue; }
    ws.isAlive = false; ws.ping();
  }
}, 10000);

// Báo lỗi dễ hiểu khi cổng đã bị chương trình khác (thường là server cũ) chiếm
function onListenError(err) {
  if (err.code === 'EADDRINUSE') {
    console.error(`\n❌ Cổng ${PORT} đang bị chiếm (có thể server cũ vẫn đang chạy ở terminal khác).`);
    console.error('   Cách 1: tắt server cũ (Ctrl + C ở terminal đó) rồi chạy lại npm start');
    console.error(`   Cách 2: chạy ở cổng khác. PowerShell: $env:PORT=${PORT + 1}; npm start   |   Mac/Linux: PORT=${PORT + 1} npm start\n`);
    process.exit(1);
  }
  throw err;
}
server.on('error', onListenError);
wss.on('error', () => {});   // lỗi cổng đã được server.on('error') xử lý, tránh in lặp 2 lần

// Tắt server (Ctrl + C) -> lưu ví xu của mọi người trước khi thoát
for (const sig of ['SIGINT', 'SIGTERM']) process.on(sig, () => { store.flushSync(); process.exit(0); });

server.listen(PORT, () => {
  console.log(`🎈 Bubble Boom chạy tại http://localhost:${PORT}`);
  console.log(`🔐 Trang quản trị: http://localhost:${PORT}/admin.html`);
  if (!process.env.ADMIN_PASSWORD) {
    console.log(`   Mật khẩu admin TẠM (đổi mỗi lần chạy): ${ADMIN_PASSWORD}`);
    console.log('   Muốn cố định: PowerShell  $env:ADMIN_PASSWORD="matkhau-cua-ban"; npm start');
  } else if (ADMIN_PASSWORD.length < 8) {
    console.log('   ⚠️  ADMIN_PASSWORD nên dài ít nhất 8 ký tự');
  }
});

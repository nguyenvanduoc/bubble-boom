// ============================================================
// SERVER: phục vụ file tĩnh (HTML/JS/CSS) + WebSocket cho chơi online
// Chạy: npm install && npm start  -> mở http://localhost:3000
// ============================================================
import http from 'node:http';
import { readFile } from 'node:fs/promises';
import { extname, join, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';
import { WebSocketServer } from 'ws';
import { Lobby } from './public/shared/rooms.js';

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
const lobby = new Lobby();
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

server.listen(PORT, () => console.log(`🎈 Bubble Boom chạy tại http://localhost:${PORT}`));

// ============================================================
// KẾT NỐI: online (WebSocket tới server) hoặc offline (chạy Lobby ngay trong trình duyệt)
// Cả hai trả về cùng 1 giao diện { send(obj), close(), offline }
// ============================================================
import { Lobby } from '../shared/rooms.js';

export function connectOnline(url, onMsg, onClose) {
  return new Promise((resolve, reject) => {
    const ws = new WebSocket(url);
    const timer = setTimeout(() => { ws.close(); reject(new Error('Hết thời gian kết nối')); }, 6000);
    ws.onopen = () => {
      clearTimeout(timer);
      resolve({
        offline: false,
        send: (m) => ws.readyState === 1 && ws.send(JSON.stringify(m)),
        close: () => { ws.onclose = null; ws.close(); },
      });
    };
    ws.onmessage = (e) => onMsg(JSON.parse(e.data));
    ws.onerror = () => { clearTimeout(timer); reject(new Error('Không kết nối được server')); };
    ws.onclose = () => onClose && onClose();
  });
}

export function connectOffline(onMsg) {
  const lobby = new Lobby();
  // queueMicrotask: giao tin nhắn bất đồng bộ giống mạng thật, tránh gọi lồng nhau
  const client = lobby.connect((m) => queueMicrotask(() => onMsg(typeof m === 'string' ? JSON.parse(m) : m)));
  return {
    offline: true,
    send: (m) => lobby.handle(client, m),
    close: () => lobby.disconnect(client),
  };
}

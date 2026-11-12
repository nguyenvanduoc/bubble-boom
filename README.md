# 🎈 Bubble Boom: game thả bóng nước online

Game thả bóng nước kiểu Bomberman, chơi nhiều người theo phòng. Nhân vật, bản đồ và hình ảnh đều được thiết kế mới và vẽ hoàn toàn bằng code Canvas, không dùng file ảnh hay âm thanh nào.

## Chạy thử

```bash
npm install
npm start          # mở http://localhost:3000
```

- **Chơi với bot:** bấm "Chơi với Bot". Chế độ này chạy hoàn toàn trong trình duyệt, không cần server.
- **Chơi online:** bấm "Chơi Online" → Tạo phòng → bấm "Mã XXXX 📋" để copy link mời cho bạn bè.
- **Chơi mạng LAN:** bạn bè mở `http://<IP-máy-bạn>:3000`.
- **Kết nối tới server khác:** thêm tham số vào link, ví dụ `index.html?server=wss://ten-mien/ws`.

## Đưa lên mạng (miễn phí / rẻ)

Bất kỳ dịch vụ nào hỗ trợ **Node.js + WebSocket** đều dùng được, ví dụ Render, Railway hay Fly.io.

- Build: `npm install`
- Start: `npm start`. Server tự đọc biến `PORT` mà dịch vụ cấp.
- Hoặc dùng `Dockerfile` có sẵn.
- `/health` trả về `ok` để dịch vụ kiểm tra server còn sống.

## Luật & thời gian (sửa trong `public/shared/constants.js`)

| Thông số | Giá trị | Ý nghĩa |
|---|---|---|
| `BOMB_FUSE` | 3000ms | Bóng nổ sau 3 giây |
| `CHAIN_DELAY` | 80ms | Bóng bị tia nước chạm sẽ nổ dây chuyền |
| `FLAME_TIME` | 550ms | Thời gian tia nước tồn tại |
| `BOX_BREAK_TIME` | 450ms | Thời gian thùng vỡ trước khi lộ vật phẩm |
| `TRAP_TIME` | 4500ms | Thời gian bị nhốt trong bong bóng rồi vỡ |
| `RESCUE_INVULN` | 1200ms | Thời gian bất tử sau khi được cứu hoặc dùng kim |
| `SHIELD_TIME` | 2500ms | Thời gian khiên bảo vệ |
| `MATCH_TIME` | 3 phút | Thời lượng tối đa 1 trận |
| `SUDDEN_DEATH` | 45s cuối | Tường rơi xoắn ốc để thu hẹp bản đồ |

**Phím:** ←↑↓→ / WASD di chuyển · Space/J đặt bóng · Z/K dùng kim · X/L bật khiên · Enter chat.

## Cấu trúc

```
server.js                 HTTP tĩnh + WebSocket
public/
  index.html, style.css   Giao diện
  shared/                 DÙNG CHUNG server & trình duyệt
    constants.js          Thông số, nhân vật, vật phẩm, bản đồ
    engine.js             Luật game: di chuyển, nổ, nhốt, thắng thua
    bot.js                AI bot
    rooms.js              Sảnh + phòng + vòng lặp 30 tick/giây
  js/
    main.js               Giao diện, dự đoán chuyển động, nội suy
    render.js             Vẽ Canvas
    net.js                Kết nối online/offline
    input.js              Bàn phím + nút cảm ứng
    audio.js              Âm thanh tổng hợp (Web Audio)
```

## Kiến trúc mạng

1. **Server quyết định mọi thứ (authoritative):** client chỉ gửi phím bấm `{q, d, b, n, s}`. Server tính vị trí, bóng nổ, ai bị nhốt. Cách này chống hack.
2. **Dự đoán phía client (prediction):** nhân vật của bạn di chuyển ngay khi bấm phím, không phải chờ server trả lời.
3. **Hoà giải (reconciliation):** mỗi snapshot có `ack` là input cuối cùng server đã xử lý. Client lấy vị trí server rồi chạy lại các input chưa được xử lý, sau đó làm mượt phần lệch.
4. **Nội suy (interpolation):** người chơi khác được vẽ trễ khoảng 90ms, nằm giữa 2 snapshot, nên chuyển động luôn mượt dù mạng giật.
5. Lưới bản đồ chỉ được gửi lại khi thay đổi (`gridVersion`), giúp tiết kiệm băng thông.

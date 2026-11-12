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

## Cửa hàng & ví xu

Cửa hàng có 4 tab. Mua thì trừ xu ngay; vật phẩm được tự động mang vào trận.

| Tab | Món | Giá | Ghi chú |
|---|---|---|---|
| 🎒 Vật phẩm | Kim Bạc (phím **Z**) | 40 | Tự thoát bong bóng. Mang tối đa 3 mỗi trận |
| | Khiên Sao (**X**) | 60 | Bất tử 2,5 giây. Mang tối đa 2 |
| | Phi Tiêu (**C**) | 50 | Ném thẳng: kích nổ bóng nước, chọc vỡ đối thủ đang bị nhốt. Mang tối đa 5 |
| | Bom Hẹn Giờ (**V**) | 80 | Đặt quả bóng đặc biệt (tầm +1). Bấm V lần nữa để kích nổ; tự nổ sau 8 giây. Mang tối đa 2 |
| 👒 Trang phục | Mũ Cướp Biển, Mũ Phù Thuỷ, Kính Râm, Áo Choàng Đỏ, Vương Miện | 250–900 | Chỉ đổi ngoại hình, có nút "Thử" |
| 🎈 Bóng nước | Dâu Tây, Dưa Hấu, Bí Ngô, Ngôi Sao, Hoàng Kim | 200–1000 | Đổi kiểu quả bóng bạn đặt |
| ⚙️ Phụ kiện | Giày Lướt Sóng, Balo Bóng, Vòi Rồng, Găng Thần, Áo Phao | 250–400 | Cộng chỉ số khi vào trận, mặc tối đa 2 món |

- Vật phẩm dùng không hết sẽ được hoàn lại vào kho sau trận. Phím số `1`–`4` cũng dùng được.
- Người mới được tặng 300 xu. Thưởng sau mỗi trận: +20 khi tham gia, +60 khi thắng, +15 cho mỗi đối thủ hạ được, +1 cho mỗi thùng phá được.
- Chủ phòng có thể **tắt phụ kiện và vật phẩm** để đấu công bằng. Trang phục và kiểu bóng vẫn hiển thị.
- **Ví online** lưu trên server ở file `data/profiles.json` (đổi chỗ lưu bằng biến `DATA_FILE`). **Ví offline** lưu trong trình duyệt.
- Một số dịch vụ miễn phí xoá ổ đĩa mỗi lần khởi động lại. Khi đó cần gắn ổ đĩa lưu trữ (persistent disk) để giữ ví.

## Giảm độ trễ khi đặt bóng

- Client **dự đoán** việc đặt bóng: quả bóng hiện và kêu ngay khi bấm phím, rồi được thay bằng bóng thật khi server xác nhận. Nếu server từ chối, bóng dự đoán tự biến mất.
- Bóng, tia nước và phi tiêu được vẽ theo dữ liệu **mới nhất** của server. Chỉ nhân vật của người khác mới được vẽ trễ một chút để chuyển động mượt.
- Mở trang với `?debug` để xem trạng thái game qua biến `bb` trong Console.

## Bản đồ (8 bản đồ)

Làng Gió · Sa Mạc Cát · Đảo Kẹo · **Thuyền Chiến** · **Hải Chiến Hai Tàu** · **Băng Tuyết** · **Rừng Nấm** · **Quảng Trường**.
Ký hiệu trong `constants.js`: `#` tường, `~` nước biển, `?` có thể là thùng, `x` chắc chắn là thùng, `.` ô trống, `1`–`6` điểm xuất phát.

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
profile-store.js          Lưu ví xu của người chơi ra file JSON
public/
  index.html, style.css   Giao diện
  shared/                 DÙNG CHUNG server & trình duyệt
    constants.js          Thông số, nhân vật, vật phẩm, cửa hàng, bản đồ
    profile.js            Ví xu: mua, mặc trang bị, mang đồ vào trận, thưởng
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

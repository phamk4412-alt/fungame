# ♠ Poker cùng bạn bè (Texas Hold'em online, tối đa 6 người)

Bàn poker Texas Hold'em chạy trên trình duyệt. Mỗi người mở link trên máy tính hoặc điện thoại của mình là ngồi chung bàn, chơi realtime với nhau. Chip là chip ảo, không có tiền thật.

## Tính năng

- Tối đa **6 người** một bàn. Nhiều phòng chạy cùng lúc, mỗi phòng có một mã riêng.
- Luật Texas Hold'em đầy đủ: small blind 10 / big blind 20, preflop → flop → turn → river → lật bài.
- Bỏ bài, check, theo, tố (kéo thanh để chọn số chip), all-in.
- Tự tính **side pot** khi có người all-in, chia đều khi hòa.
- Tự nhận diện tay bài: mậu thầu, đôi, thú, sám cô, sảnh, thùng, cù lũ, tứ quý, thùng phá sảnh.
- Mỗi lượt có **30 giây**, hết giờ tự check hoặc bỏ bài.
- Tải lại trang hay rớt mạng vẫn giữ ghế trong 60 giây.
- Hết chip phải ngồi chờ **3 phút**, sau đó mới bấm được **Mua lại 1000 chip** để chơi tiếp (đổi thời gian ở hằng số `BUST_WAIT_MS` trong `game.js`).
- Có khung chat và nhật ký từng ván. Chơi được trên điện thoại.

## Cách chạy

Cần cài [Node.js](https://nodejs.org) bản 18 trở lên.

```bash
git clone https://github.com/phamk4412-alt/fungame.git
cd fungame
npm install
npm start
```

Mở trình duyệt vào **http://localhost:3000**, nhập tên, để trống mã phòng rồi bấm **Vào bàn** để tạo phòng mới.

Muốn đổi cổng thì chạy `PORT=8080 npm start` (Windows PowerShell: `$env:PORT=8080; npm start`).

## Mời bạn bè vào chơi

Trong bàn, bấm **📋 Sao chép link mời** rồi gửi link cho bạn bè (Zalo, Messenger...). Bạn bè mở link, nhập tên là ngồi vào bàn. Khi có từ 2 người trở lên, bấm **▶ Bắt đầu chơi**. Từ ván thứ hai trở đi, bài được chia tự động.

Link chỉ dùng được khi bạn bè truy cập được vào máy đang chạy server. Có 3 cách:

### 1. Cùng mạng Wi‑Fi

Tìm địa chỉ IP của máy bạn (Windows: `ipconfig`, macOS/Linux: `ifconfig` hoặc `ip addr`), ví dụ `192.168.1.5`. Bạn bè cùng Wi‑Fi mở `http://192.168.1.5:3000`. Nếu không vào được, hãy cho phép Node.js qua tường lửa (Windows Firewall).

### 2. Chơi qua Internet ngay từ máy của bạn (nhanh nhất)

Dùng công cụ "đường hầm" để tạo link công khai trỏ về máy bạn. Giữ `npm start` đang chạy, mở thêm một cửa sổ terminal:

```bash
# Cách A: Cloudflare Tunnel (miễn phí, không cần đăng ký)
npx cloudflared tunnel --url http://localhost:3000

# Cách B: ngrok (cần tạo tài khoản miễn phí tại ngrok.com)
ngrok http 3000
```

Lệnh sẽ in ra một link dạng `https://xxxx.trycloudflare.com`. Mở link đó, tạo phòng, bấm **Sao chép link mời** và gửi cho bạn bè. Máy bạn phải bật trong lúc chơi.

### 3. Đưa lên mạng để chơi bất cứ lúc nào (Render, miễn phí)

1. Vào [render.com](https://render.com), đăng nhập bằng GitHub.
2. Chọn **New → Web Service**, chọn repo `fungame`.
3. Điền Build Command `npm install`, Start Command `npm start`, chọn gói **Free**.
4. Bấm **Create Web Service**, chờ vài phút là có link dạng `https://fungame-xxxx.onrender.com` để gửi bạn bè.

Gói miễn phí sẽ "ngủ" khi không có ai vào, lần đầu mở có thể mất khoảng 30 giây để khởi động lại. Railway, Fly.io hay VPS chạy Node cũng dùng được tương tự (server hỗ trợ WebSocket và đọc cổng từ biến `PORT`).

## Cách chơi nhanh

- Mỗi người được chia 2 lá úp. Trên bàn lần lượt lật 3 lá (flop), 1 lá (turn), 1 lá (river).
- Ghép 5 lá đẹp nhất từ 2 lá của mình và 5 lá trên bàn. Tay mạnh nhất ăn pot.
- Đến lượt mình (khung tên sáng vàng), chọn **Bỏ bài**, **Check/Theo**, **Tố** hoặc **All-in**.

## Cấu trúc mã nguồn

| File | Nội dung |
| --- | --- |
| `server.js` | Server HTTP + WebSocket, quản lý phòng |
| `game.js` | Luật chơi: chia bài, vòng cược, side pot, chia tiền |
| `handeval.js` | Chấm điểm tay bài |
| `public/` | Giao diện (HTML, CSS, JS) |
| `test.js` | Kiểm thử: `npm test` mô phỏng 2000 ván ngẫu nhiên |

Muốn đổi số chip ban đầu, mức blind hay thời gian mỗi lượt, sửa các hằng số ở đầu file `game.js`.

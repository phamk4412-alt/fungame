# ♠ Fungame: chơi bài cùng bạn bè (Poker và Xì dách, tối đa 6 người)

Các bàn chơi bài chạy trên trình duyệt. Mỗi người mở link trên máy tính hoặc điện thoại của mình là ngồi chung bàn, chơi realtime với nhau. Chip là chip ảo, không có tiền thật.

Hiện có 2 game, chọn khi tạo phòng mới:

- **♠ Poker** (Texas Hold'em): người chơi đấu với nhau.
- **🃏 Xì dách** (luật Việt Nam): mỗi người đấu với nhà cái là máy. Chơi một mình cũng được.

Vào phòng bằng link mời thì tự vào đúng game của phòng đó.

## Tính năng Poker

- Tối đa **6 người** một bàn. Nhiều phòng chạy cùng lúc, mỗi phòng có một mã riêng.
- Luật Texas Hold'em đầy đủ: small blind 10 / big blind 20, preflop → flop → turn → river → lật bài.
- Bỏ bài, check, theo, tố (kéo thanh để chọn số chip), all-in.
- Tự tính **side pot** khi có người all-in, chia đều khi hòa.
- Tự nhận diện tay bài: mậu thầu, đôi, thú, sám cô, sảnh, thùng, cù lũ, tứ quý, thùng phá sảnh.
- Mỗi lượt có **30 giây**, hết giờ tự check hoặc bỏ bài.
- Tải lại trang hay rớt mạng vẫn giữ ghế trong 60 giây.
- Hết chip phải ngồi chờ **3 phút**, sau đó mới bấm được **Mua lại 1000 chip** để chơi tiếp (đổi thời gian ở hằng số `BUST_WAIT_MS` trong `game.js`).
- Có khung chat và nhật ký từng ván. Chơi được trên điện thoại.

## Luật Xì dách

- Tối đa **6 người** cùng đấu với **nhà cái (máy)**. Mỗi người có 1000 chip ảo.
- Đầu ván có **15 giây đặt cược** (từ 10 đến 500 chip). Ai không cược thì ngồi ngoài ván đó. Cược xong hết thì chia bài luôn.
- Mỗi người và nhà cái được 2 lá. Lá đầu của nhà cái lật ngửa.
- **Tính điểm:** 2 đến 9 theo số, 10/J/Q/K là 10. Lá **A**: khi có 2 lá thì tính 10 hoặc 11, khi có 3 lá thì 1 hoặc 10, từ 4 lá trở lên chỉ tính 1.
- **Xì bàn** (2 lá A) thắng gấp 3. **Xì dách** (A với 10/J/Q/K) thắng gấp 2. Có xì bàn hay xì dách thì lật bài luôn.
- Nếu nhà cái có xì bàn hoặc xì dách thì lật ngay và tính tiền cả bàn (ai có bài bằng thì hòa).
- Đến lượt mình (20 giây), chọn **Rút bài** hoặc **Dằn bài**. Dưới **16 điểm là non**, phải rút tiếp mới được dằn.
- **Ngũ linh:** rút đủ 5 lá mà không quá 21 điểm, thắng gấp 2. Hai bên cùng ngũ linh thì ai ít điểm hơn thắng.
- **Quắc:** quá 21 điểm. Bài quắc vẫn được giấu tới lúc lật. Người quắc thì thua, nhưng nếu **nhà cái cũng quắc thì hòa**.
- Thứ tự mạnh: xì bàn > xì dách > ngũ linh > điểm thường (cao hơn thắng) > quắc.
- Nhà cái lật bài sau cùng và rút tới khi đủ **17 điểm** hoặc đủ 5 lá.
- Hết giờ mà chưa chọn thì tự rút nếu còn non, đủ điểm thì tự dằn.
- Hết chip cũng phải chờ 3 phút rồi mới mua lại được, như bên Poker.

Muốn đổi mức cược, thời gian hay tỉ lệ ăn, sửa các hằng số ở đầu file `xidach.js`.

## Cách chạy

Cần cài [Node.js](https://nodejs.org) bản 18 trở lên.

```bash
git clone https://github.com/phamk4412-alt/fungame.git
cd fungame
npm install
npm start
```

Mở trình duyệt vào **http://localhost:3000**, nhập tên, chọn game, để trống mã phòng rồi bấm **Vào bàn** để tạo phòng mới.

Muốn đổi cổng thì chạy `PORT=8080 npm start` (Windows PowerShell: `$env:PORT=8080; npm start`).

## Mời bạn bè vào chơi

Trong bàn, bấm **📋 Sao chép link mời** rồi gửi link cho bạn bè (Zalo, Messenger...). Bạn bè mở link, nhập tên là ngồi vào bàn. Poker cần từ 2 người trở lên, Xì dách thì 1 người cũng chơi được. Bấm **▶ Bắt đầu chơi**, từ ván thứ hai trở đi bài được chia tự động.

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

## Cách chơi nhanh (Poker)

- Mỗi người được chia 2 lá úp. Trên bàn lần lượt lật 3 lá (flop), 1 lá (turn), 1 lá (river).
- Ghép 5 lá đẹp nhất từ 2 lá của mình và 5 lá trên bàn. Tay mạnh nhất ăn pot.
- Đến lượt mình (khung tên sáng vàng), chọn **Bỏ bài**, **Check/Theo**, **Tố** hoặc **All-in**.

## Cấu trúc mã nguồn

| File | Nội dung |
| --- | --- |
| `server.js` | Server HTTP + WebSocket, quản lý phòng |
| `game.js` | Luật Poker: chia bài, vòng cược, side pot, chia tiền |
| `handeval.js` | Chấm điểm tay bài Poker |
| `xidach.js` | Luật Xì dách: đặt cược, rút/dằn, nhà cái, tính tiền |
| `public/` | Giao diện (HTML, CSS, JS) |
| `test.js` | Kiểm thử: `npm test` mô phỏng 2000 ván Poker và 2000 ván Xì dách |

Muốn đổi số chip ban đầu, mức blind hay thời gian mỗi lượt, sửa các hằng số ở đầu file `game.js`.

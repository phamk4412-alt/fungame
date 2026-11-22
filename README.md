# ♠ Fungame: chơi bài cùng bạn bè (Poker và Xì dách, tối đa 6 người)

Các bàn chơi bài chạy trên trình duyệt. Mỗi người mở link trên máy tính hoặc điện thoại của mình là ngồi chung bàn, chơi realtime với nhau. Chip là chip ảo, không có tiền thật.

Hiện có 2 game, chọn khi tạo phòng mới:

- **♠ Poker** (Texas Hold'em): người chơi đấu với nhau.
- **🃏 Xì dách** (luật Việt Nam): ai muốn thì xin làm cái, không thì thay phiên nhau. Chơi một mình thì máy làm cái.

Vào phòng bằng link mời thì tự vào đúng game của phòng đó.

Ngoài ra có **🎣 Câu Cá 3D** (mở ở `/fish.html` hoặc bấm link ở sảnh) và **✈️ Patrol** (mở ở `/patrol.html`).

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

- Tối đa **6 người**, mỗi người có 1000 chip ảo.
- **Chọn làm cái:** ai muốn làm cái thì bấm **🎩 Xin làm cái** ở thanh trên cùng. Người đó giữ cái mọi ván (từ ván sau nếu đang chơi dở) cho tới khi bấm **Thôi làm cái**, hết chip hoặc rời bàn. Mỗi lúc chỉ một người giữ cái.
- **Thay phiên làm cái:** không ai xin làm cái thì mỗi ván một người làm nhà cái, lần lượt theo vòng ghế. Chỉ có một mình trong phòng thì máy làm cái (máy rút tới khi đủ 17 điểm rồi lật hết).
- Đầu ván có **15 giây** để các nhà con đặt cược (từ 10 đến 500 chip). Nhà cái không cược. Ai không cược thì ngồi ngoài ván đó.
- Mỗi người và nhà cái được 2 lá. Bài nhà cái úp, chỉ nhà cái xem được.
- **Tính điểm:** 2 đến 9 theo số, 10/J/Q/K là 10. Lá **A**: khi có 2 lá thì tính 10 hoặc 11, khi có 3 lá thì 1 hoặc 10, từ 4 lá trở lên chỉ tính 1.
- **Xì bàn** (2 lá A) ăn gấp 3. **Xì dách** (A với 10/J/Q/K) ăn gấp 2. Nhà con có xì bàn hay xì dách thì lật luôn, ăn ngay.
- Nhà cái có xì bàn hoặc xì dách thì lật ngay, ăn cả bàn theo tỉ lệ đó (nhà con có bài bằng thì hòa).
- Lần lượt từng nhà con (20 giây mỗi lượt) chọn **Rút bài** hoặc **Dằn bài**, tối đa 5 lá. Dưới **16 điểm là non**, phải rút tiếp.
- **Ngũ linh:** đủ 5 lá mà không quá 21 điểm, ăn gấp 2, chỉ thua xì bàn và xì dách. Hai bên cùng ngũ linh thì ai ít điểm hơn thắng.
- **Quắc:** quá 21 điểm. Bài quắc vẫn giấu tới lúc bị lật. Người quắc thì thua, nhưng nếu **nhà cái cũng quắc thì hòa**.
- **Lượt nhà cái** (30 giây mỗi bước): nhà cái tự quyết **rút thêm** hay dừng. Đủ **15 điểm** trở lên thì được **lật từng nhà** (tính tiền riêng nhà đó ngay với bài hiện tại), rồi rút tiếp hay lật nhà khác tùy ý, hoặc bấm **Lật hết**. Nhà cái quắc hoặc đủ 5 lá thì phải lật hết.
- Hết giờ mà chưa chọn: nhà con non thì tự rút, đủ điểm thì tự dằn; nhà cái non thì tự rút, đủ điểm thì tự lật hết.
- Nhà cái chỉ đền được số chip đang có. Nhà cái rời bàn giữa ván thì ván đó hủy và trả lại tiền cược.
- Hết chip phải chờ 3 phút rồi mới mua lại được, như bên Poker.

Muốn đổi mức cược, thời gian hay tỉ lệ ăn, sửa các hằng số ở đầu file `xidach.js`.

## Patrol

Đồ chơi lái chiến đấu cơ pixel art, một file duy nhất `public/patrol.html` (không thư viện, không ảnh; chỉ tải font Google). Thế giới là height field lặp liền mạch sinh bằng web worker lúc tải, ray-march trong fragment shader WebGL2; buồng lái và HUD vẽ bằng Canvas 2D. Chữ trong game bằng tiếng Anh.

Điều khiển: chuột lái (bay tự do mọi hướng: nhào lộn, bay ngửa), Q/E = bánh lái, bấm = lộn vòng, giữ chuột trái = đốt sau, chuột phải hoặc F = bắn tên lửa, Space = đổi góc nhìn (từ trên, bám đuôi, buồng lái). Có nút cảm ứng trên điện thoại. Âm thanh tắt sẵn, bật ở góc phải.

**Chọn máy bay:** Kestrel (cân bằng), Heron (cánh tam giác, nhanh nhất), Wasp (nhẹ, xoay nhanh nhất, ít máu), Bison (chậm, nhiều máu, 6 tên lửa). Thông số nằm ở bảng `PLANES` đầu phần GAME trong `patrol.html`; máu phía server ở `patrol/server.js`.

**Chơi nhiều người:** nhập tên và **mã phòng** ở màn hình đầu; ai cùng mã phòng thì bay chung một bầu trời (tối đa 12 người/phòng), thấy tên và khoảng cách của nhau, khóa mục tiêu rồi bắn tên lửa. Mỗi phát trúng mất 55 máu; bị bắn hạ hoặc đâm vào núi/mặt nước là chết, 4 giây sau hồi sinh. Góc trái hiện bảng điểm (hạ/chết) và tin tức trận. Khi phòng chỉ có mình bạn sẽ có 2 máy bay tập bắn (DRONE) bay cùng. Mạng chạy qua WebSocket của `server.js` với tin nhắn `pt:*` (`patrol/server.js`); mở file trực tiếp không có server thì vẫn chơi được với drone.

## Lá Chắn Ngôn Từ (5 giây trước nút Gửi)

Gameshow chống bạo lực mạng cho sân khấu: laptop nối máy chiếu, mở `/lachan/` (hoặc mở thẳng file `public/lachan/index.html`, không cần server, không cần Wi-Fi). Giao diện mô phỏng mạng xã hội của Minh Anh, một sinh viên bị "bóc phốt" sai sự thật; các đội giữ thanh **Chỉ số Tinh thần** không về 0.

- **Màn 1 · Soi Bóng Tối:** 5 bình luận, phân loại Góp ý xây dựng (phím A) hay Bạo lực mạng (phím B), có giải thích sau mỗi câu.
- **Màn 2 · Cơn Bão Bình Luận:** 60 giây, bình luận ác ý trôi lên ngày càng nhanh; chọn đúng kỹ năng cho bình luận MỤC TIÊU: 1 Chụp bằng chứng, 2 Chặn & Báo cáo, 3 Khóa bình luận, 4 Cầu cứu hỗ trợ. Bình luận chạm đỉnh làm Tinh thần giảm.
- **Màn 3 · 5 Giây Đảo Ngược:** vào vai bạn cùng lớp, 3 tình huống trong nhóm chat, chọn 1 trong 3 cách phản hồi (phím 1–3) để hồi Tinh thần cho Minh Anh.
- HP về 0 thì phát cảnh kết thúc: tin nhắn cuối của Minh Anh không ai trả lời, sáng hôm sau chỗ ngồi của bạn ấy trong lớp bỏ trống, rồi tới màn **Hậu quả của bạo lực mạng** (với người bị bắt nạt, với người bắt nạt) kèm Tổng đài 111. Cảnh này cố ý không mô tả chuyện gì đã xảy ra. Hết game với HP trên 50% thì phát **kết thúc có hậu**: cả lớp nhắn động viên, sáng hôm sau Minh Anh đi học, cô điểm danh "Dạ, có ạ!", bạn ấy cười nói vui vẻ với mọi người, rồi tới màn vinh danh (vỗ tay, pháo giấy). Nội dung hai cảnh nằm ở `endings.scene` và `endings.goodScene` trong `data.json`.

### Đấu Trường (cả lớp chơi bằng điện thoại)

Mở `/lachan/arena.html` trên máy chiếu (hoặc bấm **👥 ĐẤU TRƯỜNG** ở màn hình chính). Màn hình hiện mã QR và mã phòng 4 ký tự; khán giả quét QR hoặc vào `/lachan/play.html` trên điện thoại, nhập tên, chọn đội (hoặc để tự xếp cho đều). Cần server đang chạy (bản trên Render) và điện thoại có mạng.

- 13 câu: 5 câu Màn 1, 5 bình luận Màn 2 (chọn kỹ năng), 3 tình huống Màn 3. Mỗi câu 20 giây, trả lời càng nhanh càng nhiều điểm (1000 → 500). Màn 3 chấm theo mức phương án giúp Minh Anh hồi phục.
- Đội xếp hạng theo **điểm trung bình mỗi người**, nên đội đông hay ít người đều công bằng. Màn chiếu hiện số người đã trả lời, số người chọn từng đáp án, giải thích và top 5 cá nhân.
- **Mỗi đội giữ một thanh Tinh thần riêng** (hiện cạnh tên đội), tính theo câu trả lời của thành viên đội đó; thanh lớn ở giữa là của cả lớp. Kết thúc khi hết câu hoặc khi mọi đội đều về 0. Đội trên 50% thì thắng.
- **Mỗi đội một cái kết trên điện thoại:** đội thắng xem kết có hậu, đội thua xem cảnh kết thúc buồn và màn hậu quả (có số 111, bấm để gọi). Xem xong bấm "Xem kết quả của bạn" để thấy điểm và hạng.
- **Máy chiếu luôn chiếu kết có hậu** kèm bảng xếp hạng ghi rõ đội nào giữ được, đội nào chưa. MC bấm **🌧️ Chiếu kết buồn** để cả lớp cùng xem kết buồn và hậu quả (bấm lại để về kết có hậu).
- MC: Space để bắt đầu / công bố đáp án / sang câu sau. Bấm 2 lần vào tên một người trong phòng chờ để mời ra (ví dụ tên không phù hợp). Mất mạng thì tự nối lại, điểm vẫn giữ.
- Chỉnh thời gian, điểm, mức tăng giảm Tinh thần ở `settings.arena` trong `data.json`.

Phím MC: Space tiếp tục, P tạm dừng, F toàn màn hình, M âm thanh, H về màn hình chính. Chọn đội đang chơi ở góc trên; bảng điểm 4 đội lưu trong trình duyệt. Máy chiếu 4:3 (1024×768) dùng bố cục 2 cột, không phải cuộn trang. Âm thanh tổng hợp bằng Web Audio, avatar vẽ bằng SVG, không tải gì từ mạng.

**Sửa nội dung:** toàn bộ câu hỏi, bình luận, đáp án, điểm cộng/trừ, tốc độ, tên đội nằm trong `public/lachan/data.json`. Sửa xong chạy `node public/lachan/build-data.js` để cập nhật `data.js` (bản sao dùng khi mở bằng file://). `npm test` kiểm tra dữ liệu hợp lệ.

## Câu Cá 3D

Game câu cá 3D chạy ngay trên trình duyệt, mở ở `/fish.html` (trang chủ có nút **🎣 Câu Cá 3D**). Đăng ký bằng tên và mật khẩu, tiến trình lưu lâu dài trên server.

- **4 hồ:** Hồ Sen Làng Quê (có sẵn), Hồ Rừng Thông (sáng sớm sương mù), Vịnh Đá Vôi (cột đá vôi, thuyền buồm), Hồ Băng Cực Quang (tuyết rơi, đêm có cực quang). Mở khóa bằng xu.
- **28 loài cá**, 4 độ hiếm: Thường, Hiếm, Sử thi, Huyền thoại. Mỗi loài chỉ ra ở một hồ và vào một số giờ nhất định (bình minh, ban ngày, hoàng hôn, ban đêm). **Một ngày trong game dài 24 phút**, mọi người thấy cùng một giờ.
- **Cách câu:** giữ nút (hoặc phím Space) để lấy đà, thả ra để quăng, kéo màn hình để chọn hướng. Chờ phao chìm hẳn rồi bấm giật cần, bấm sớm là cá chạy. Khi kéo cá, bên phải màn hình hiện một thanh dọc: giữ Space, giữ chuột hoặc giữ nút để nâng thanh trắng, thả ra thì nó rơi xuống. Phải giữ que cá màu xám luôn nằm trong thanh trắng thì thanh tiến trình đầy dần, que ra ngoài thì tiến trình tụt, tụt hết là cá sổng. Cá càng to, càng khỏe, càng hiếm thì que chạy nhanh và hay lao xa hơn, thanh trắng ngắn hơn; cần xịn giúp thanh trắng dài hơn và kéo nhanh hơn.
- **Cửa hàng:** 4 loại cần (càng xịn càng chịu được cá khỏe, kéo nhanh và may mắn hơn), 4 loại mồi (mồi xịn ra cá hiếm nhiều hơn), thùng đá to hơn. Bán cá lấy xu.
- **Vô hạn tiền:** mọi người chơi đều có tiền ∞, mua cần, mồi, hồ, thùng đá không bị trừ tiền. Muốn bật lại kinh tế thì đổi `UNLIMITED_MONEY` trong `fish/api.js` thành `false`.
- **Chơi cùng bạn bè:** ai đứng cùng hồ sẽ thấy nhau trên các cầu câu bên cạnh, thấy phao và cần cong khi bạn đang kéo cá. Cả server thấy tin "vừa câu được cá hiếm". Có bảng xếp hạng cá to nhất, câu nhiều nhất và kỷ lục từng loài. Góc trên trái luôn hiện hạng của mình, người đứng đầu và hai người sát bên, điểm là tổng giá trị cá đã câu.
- **Hình ảnh:** mặc định là góc nhìn thứ nhất, thấy hai tay cầm cần và máy câu, cần cong theo sức cá; nút 🎥 đổi sang góc nhìn thứ ba thấy cả người. Mặt nước phản chiếu có gợn sóng theo phao, bầu trời vật lý đổi màu theo giờ, sao, trăng, đèn lồng, đom đóm, bóng đổ, cỏ cây lay theo gió, cây bụt mọc rủ rêu đứng trong nước, ánh sáng loá (bloom). Thỉnh thoảng trời đổ mưa (mọi người cùng hồ thấy mưa cùng lúc): mây xám, sương mù dày, hạt mưa rơi và tiếng mưa. Trong ⚙️ Cài đặt chọn chất lượng Thấp, Vừa hoặc Cao; điện thoại mặc định là Vừa.

Muốn đổi loài cá, giá cần, mồi hay độ dài một ngày trong game, sửa `fish/logic.js`.

### Lưu dữ liệu (bắt buộc khi chạy trên Render)

Tiến trình câu cá phải còn nguyên qua nhiều ngày, nên game cần một cơ sở dữ liệu Postgres. Server đọc địa chỉ từ biến môi trường `DATABASE_URL` và tự tạo bảng `fish_players` khi chạy lần đầu.

Cách miễn phí đơn giản nhất là [Neon](https://neon.tech):

1. Đăng ký Neon (đăng nhập bằng GitHub được), tạo project mới, chọn vùng **Singapore** cho gần Việt Nam.
2. Ở trang project, bấm **Connect** và sao chép chuỗi kết nối dạng `postgresql://...neon.tech/neondb?sslmode=require`.
3. Vào [Render](https://dashboard.render.com), mở service `fungame`, chọn **Environment → Add Environment Variable**: Key là `DATABASE_URL`, Value là chuỗi vừa chép. Bấm **Save**, Render tự khởi động lại.

Supabase hay Postgres của Render cũng dùng được, chỉ cần dán chuỗi kết nối vào `DATABASE_URL`. Lưu ý Postgres miễn phí của Render bị xóa sau 30 ngày.

Không có `DATABASE_URL` thì game lưu vào file `data/fish.json`. Cách này chỉ hợp khi chạy trên máy mình, vì trên Render mỗi lần server khởi động lại là mất hết.

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

Trong bàn, bấm **📋 Sao chép link mời** rồi gửi link cho bạn bè (Zalo, Messenger...). Bạn bè mở link, nhập tên là ngồi vào bàn. Poker cần từ 2 người trở lên, Xì dách thì 1 người cũng chơi được (máy làm cái). Bấm **▶ Bắt đầu chơi**, từ ván thứ hai trở đi bài được chia tự động.

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
| `xidach.js` | Luật Xì dách: thay phiên làm cái, đặt cược, rút/dằn, lật từng nhà, tính tiền |
| `store.js` | Lưu người chơi Câu cá 3D vào Postgres (hoặc file khi chạy trên máy) |
| `fish/logic.js` | Luật Câu cá 3D: hồ, loài cá, giờ trong ngày, cần, mồi, thùng đá |
| `fish/api.js` | API `/api/fish/`: đăng ký, quăng câu, kéo cá, bán, mua, bạn bè cùng hồ, xếp hạng |
| `public/fish.html`, `public/fish/` | Giao diện Câu cá 3D: cảnh hồ (`world.js`), cá, người, cần, dây (`models.js`), hiệu ứng, âm thanh, vòng chơi (`main.js`) |
| `public/` | Giao diện (HTML, CSS, JS), Câu Cá 3D ở `fish.html` (Three.js tải từ CDN) |
| `test.js`, `fish/test.js` | Kiểm thử: `npm test` mô phỏng 2000 ván Poker, 2000 ván Xì dách và luật Câu cá 3D |

Muốn đổi số chip ban đầu, mức blind hay thời gian mỗi lượt, sửa các hằng số ở đầu file `game.js`.

# Sải Cánh SC-4 — bản Unity

Mô phỏng bay máy bay huấn luyện 4 chỗ SC-4 trên Unity 6 (built-in render pipeline). Mọi thứ — địa hình, cây, mây, sân bay, máy bay, buồng lái, âm thanh — được dựng bằng mã khi bấm Play.

## Mở dự án

1. Cài **Unity Hub**, trong Hub cài **Unity 6 (6000.0 LTS)**. Không cần thêm module nào.
2. Unity Hub → **Add → Add project from disk** → chọn thư mục `unity/SaiCanh`.
3. Mở dự án (lần đầu Unity tạo thư mục `Library`, mất vài phút).
4. Bấm **Play** ở bất kỳ cảnh nào, hoặc menu **Sải Cánh → Bay ngay** (Ctrl+Shift+P). Game tự dựng thế giới trong 10–30 giây.

Nên chơi trong cửa sổ Game ở chế độ *Maximize On Play* để chuột không lẫn với cửa sổ khác.

## Bắt đầu

Menu đầu tiên có 6 bài bay. Bài 1 là **buồng lái nguội trên sân đỗ**: phải làm đúng quy trình (danh sách kiểm tra phím **K**) mới nổ máy, lăn ra và cất cánh được. Đọc **Sổ tay bay** bằng phím **M** (nội dung ở `Assets/SaiCanh/Resources/SoTayBay.txt`).

## Cấu trúc mã

| Tệp | Vai trò |
|---|---|
| `Scripts/FlightModel.cs` | Mô hình bay 6 bậc tự do, bánh xe, va chạm (bản C# của `public/flight/physics.js`) |
| `Scripts/AircraftSystems.cs` | Điện, nhiên liệu, đánh lửa, khởi động, ngập xăng, băng chế hoà khí, chân không, con quay |
| `Scripts/Cockpit.cs`, `Scripts/Gauges.cs` | Buồng lái 3D, đồng hồ, hơn 40 công tắc/núm/cần bấm được |
| `Scripts/Procedures.cs` | 12 giai đoạn checklist, chấm điểm lỗi quy trình, ATIS, đài kiểm soát |
| `Scripts/TerrainBuilder.cs`, `Scripts/WorldGen.cs` | Unity Terrain 7×7 ô, lớp kết cấu, cây, cỏ |
| `Scripts/AirportBuilder.cs`, `Scripts/Environment.cs` | Sân bay, thị trấn, bầu trời, mây, nước |
| `Scripts/EngineAudio.cs` | Âm thanh tổng hợp thời gian thực |
| `Scripts/FlightGame.cs`, `Scripts/Hud.cs` | Khởi động, điều khiển, camera, giao diện |
| `Resources/*.shader` | Nước, mây, chữ 3D, mặt nhựa đường, chân trời nhân tạo |

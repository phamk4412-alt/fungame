// Quy trình bay chuẩn: danh sách kiểm tra theo từng giai đoạn (tự đánh dấu khi làm đúng),
// giám sát lỗi quy trình (trừ điểm), đài kiểm soát không lưu và bản tin ATIS.
using System;
using System.Collections.Generic;
using UnityEngine;

namespace SaiCanh
{
    public class CheckItem
    {
        public string what, action;
        public Func<bool> cond; // null = mục tự xác nhận (nhấp để đánh dấu)
        public bool done;
    }

    public class CheckPhase
    {
        public string title;
        public readonly List<CheckItem> items = new List<CheckItem>();
        public bool Complete { get { foreach (var i in items) if (!i.done) return false; return true; } }
        public int Done { get { int n = 0; foreach (var i in items) if (i.done) n++; return n; } }
    }

    public class Procedures
    {
        public readonly List<CheckPhase> phases = new List<CheckPhase>();
        public int current;
        public int score = 100;
        public readonly List<string> log = new List<string>();
        readonly HashSet<string> once = new HashSet<string>();
        readonly SimState S;
        AircraftSystems Sys { get { return S.sys; } }

        // ATC
        public bool atisHeard, taxiCleared, takeoffCleared, landingCleared, runupDone;
        public int assignedSquawk;
        public string subtitle = "", subtitleWho = "";
        public float subtitleT;
        readonly Queue<KeyValuePair<string, string>> radioQueue = new Queue<KeyValuePair<string, string>>();
        float radioDelay, atisListen, levelT;
        bool magL, magR, carbChecked, idleChecked, ctlElevUp, ctlElevDn, ctlAilL, ctlAilR, turnedOnTaxi;
        double taxiHdg0 = -1;
        public bool wasAirborne, landed;
        public string lastTouchdown = "";
        double maxSink;
        public bool finished;

        public Procedures(SimState s) { S = s; Build(); }

        static double Wrap180(double a) { a %= 360; if (a > 180) a -= 360; if (a < -180) a += 360; return a; }

        CheckPhase P(string t) { var p = new CheckPhase { title = t }; phases.Add(p); return p; }
        void I(CheckPhase p, string what, string action, Func<bool> c) { p.items.Add(new CheckItem { what = what, action = action, cond = c }); }

        bool OnGround { get { return S.model != null && S.model.onGround; } }
        double Kt { get { return S.iasKt; } }
        double Gs { get { return S.gsKt; } }

        void Build()
        {
            var p = P("1. Trước khi khởi động");
            I(p, "Phanh đỗ", "KÉO", () => Sys.parkingBrake);
            I(p, "Van xăng", "CẢ HAI", () => Sys.fuelSel == FuelSel.Both);
            I(p, "Công tắc ĐIỆN TỬ", "TẮT", () => !Sys.avionics);
            I(p, "Cầu chì", "KIỂM TRA (đều ấn vào)", null);
            I(p, "Master BAT", "BẬT", () => Sys.masterBat);
            I(p, "Mức xăng hai bình", "KIỂM TRA", () => Sys.ElecPower && Sys.fuelL > 5 && Sys.fuelR > 5);
            I(p, "Đèn hiệu (beacon)", "BẬT", () => Sys.beacon && Sys.masterBat);

            p = P("2. Khởi động động cơ");
            I(p, "Hỗn hợp", "GIÀU (đẩy hết vào)", () => Sys.mixture > 0.95);
            I(p, "Sấy chế hoà khí", "TẮT (đẩy vào)", () => Sys.carbHeat < 0.5);
            I(p, "Bơm mồi", "2–3 lần (máy nguội)", () => Sys.primeCount >= 2 || Sys.running);
            I(p, "Cần ga", "HÉ khoảng 1 cm (5–15%)", () => Sys.throttle > 0.04 && Sys.throttle < 0.2);
            I(p, "Khu vực cánh quạt", "QUANG — hô to \"QUANG CÁNH QUẠT!\"", null);
            I(p, "Khoá từ trường", "START, nhả về BOTH khi máy nổ", () => Sys.running && Sys.mag == Mag.Both);
            I(p, "Áp dầu", "LÊN XANH trong 30 giây", () => Sys.running && Sys.oilPress > 25);

            p = P("3. Sau khi nổ máy");
            I(p, "Cần ga", "1000 v/ph", () => Sys.running && Sys.rpm > 850 && Sys.rpm < 1250);
            I(p, "Master ALT", "BẬT — ampe kế dương", () => Sys.masterAlt && Sys.running);
            I(p, "Công tắc ĐIỆN TỬ", "BẬT", () => Sys.avionics && Sys.running);
            I(p, "Nghe ATIS 127.55", "Ghi gió, áp suất QNH", () => atisHeard);
            I(p, "Áp kế (Kollsman)", "CHỈNH theo QNH của ATIS", () => Math.Abs(Sys.baro - S.qnh) < 0.015);
            I(p, "Con quay hướng", "KHỚP với la bàn từ", () => Sys.gyro > 0.5 && Math.Abs(Wrap180(Sys.hdgDrift)) < 2.5);
            I(p, "Đèn hàng hải", "BẬT", () => Sys.navLight);
            I(p, "Gọi đài 118.30 xin lăn", "Nhấn T để gọi", () => taxiCleared);

            p = P("4. Lăn bánh");
            I(p, "Đèn lăn", "BẬT", () => Sys.taxiLight);
            I(p, "Phanh đỗ", "NHẢ, thử phanh khi bắt đầu lăn", () => !Sys.parkingBrake && Gs > 2);
            I(p, "La bàn, con quay, đồng hồ rẽ", "KIỂM TRA khi rẽ", () => turnedOnTaxi);
            I(p, "Tốc độ lăn", "≤ 15 kt (đi bộ nhanh)", () => Gs > 3 && Gs < 15);

            p = P("5. Chạy thử động cơ (tại điểm chờ A1)");
            I(p, "Phanh đỗ", "KÉO", () => Sys.parkingBrake && Gs < 1);
            I(p, "Cánh lái", "TỰ DO, ĐÚNG CHIỀU (lái hết các phía)", () => ctlElevUp && ctlElevDn && ctlAilL && ctlAilR);
            I(p, "Trim", "VẠCH CẤT CÁNH (+10…+20%)", () => S.ctl.trim > 0.08 && S.ctl.trim < 0.22);
            I(p, "Cần ga", "1700 v/ph", () => Sys.rpm > 1600 && Sys.rpm < 1800 && OnGround);
            I(p, "Từ trường", "THỬ L rồi R (giảm ≤ 125 v/ph), về BOTH", () => magL && magR && Sys.mag == Mag.Both);
            I(p, "Sấy chế hoà khí", "THỬ (vòng tua giảm), rồi TẮT", () => carbChecked && Sys.carbHeat < 0.5);
            I(p, "Chân không, áp dầu, nhiệt dầu", "TRONG VẠCH XANH", () => Sys.suction > 4.5 && Sys.oilPress > 50 && Sys.running);
            I(p, "Ga chạy chậm", "KIỂM TRA (máy không tắt)", () => idleChecked);
            I(p, "Cần ga", "1000 v/ph", () => runupDone && Sys.rpm < 1250);

            p = P("6. Trước khi cất cánh");
            I(p, "Cửa, cửa sổ, dây an toàn", "ĐÓNG — CÀI", null);
            I(p, "Cánh tà", "0°–10°", () => Sys.flapLever <= 1);
            I(p, "Bộ phát đáp", "ALT — mã theo đài", () => Sys.xpdrMode == 3 && (assignedSquawk == 0 || Sys.squawk == assignedSquawk));
            I(p, "Đèn đáp, đèn chớp", "BẬT", () => Sys.landLight && Sys.strobe);
            I(p, "Bơm xăng phụ", "BẬT", () => Sys.fuelPump);
            I(p, "Xin phép cất cánh", "Nhấn T (tần số 118.30)", () => takeoffCleared);
            I(p, "Phanh đỗ", "NHẢ", () => !Sys.parkingBrake);

            p = P("7. Cất cánh");
            I(p, "Cần ga", "HẾT CỠ — hỗn hợp GIÀU", () => Sys.throttle > 0.95 && Sys.mixture > 0.9);
            I(p, "Vòng tua & tốc độ", "> 2200 v/ph, tốc độ tăng", () => Sys.rpm > 2200 && Kt > 30);
            I(p, "Nâng mũi", "ở 55 kt", () => wasAirborne);
            I(p, "Leo cao", "Vy 74 kt", () => wasAirborne && S.aglFt > 300 && Kt > 65 && Kt < 85);

            p = P("8. Leo cao");
            I(p, "Cánh tà", "THU (trên 500 ft)", () => wasAirborne && Sys.flapLever == 0 && S.aglFt > 400);
            I(p, "Bơm xăng phụ", "TẮT (trên 1000 ft)", () => wasAirborne && !Sys.fuelPump && S.aglFt > 800);
            I(p, "Đồng hồ động cơ", "TRONG VẠCH XANH", () => wasAirborne && Sys.oilPress > 50 && Sys.oilTemp < 245);

            p = P("9. Bay bằng");
            I(p, "Cần ga", "2200–2400 v/ph", () => wasAirborne && Sys.rpm > 2150 && Sys.rpm < 2450);
            I(p, "Trim", "CHỈNH để giữ độ cao không cần tay", () => levelT > 15);
            I(p, "Hỗn hợp", "CHỈNH NGHÈO trên 3000 ft (EGT đỉnh → giàu hơn chút)", () => S.altFt < 3000 || Sys.mixture < 0.95);

            p = P("10. Trước khi hạ cánh");
            I(p, "ATIS, áp kế", "KIỂM TRA", () => atisHeard && Math.Abs(Sys.baro - S.qnh) < 0.015);
            I(p, "Hỗn hợp", "GIÀU", () => wasAirborne && Sys.mixture > 0.95);
            I(p, "Sấy chế hoà khí", "BẬT trước khi giảm ga", () => wasAirborne && Sys.carbHeat > 0.5);
            I(p, "Bơm xăng phụ, đèn đáp", "BẬT", () => wasAirborne && Sys.fuelPump && Sys.landLight);
            I(p, "Xin phép hạ cánh", "Nhấn T (118.30)", () => landingCleared);
            I(p, "Cánh tà", "Theo nhu cầu, dưới 85 kt", () => wasAirborne && Sys.flapLever >= 1 && Kt < 85);

            p = P("11. Sau khi hạ cánh");
            I(p, "Sấy chế hoà khí", "TẮT", () => landed && Sys.carbHeat < 0.5);
            I(p, "Cánh tà", "THU", () => landed && Sys.flapLever == 0);
            I(p, "Bộ phát đáp", "CHỜ (SBY)", () => landed && Sys.xpdrMode == 1);
            I(p, "Đèn đáp, đèn chớp / đèn lăn", "TẮT / BẬT", () => landed && !Sys.landLight && !Sys.strobe && Sys.taxiLight);
            I(p, "Bơm xăng phụ", "TẮT", () => landed && !Sys.fuelPump);

            p = P("12. Tắt máy");
            I(p, "Phanh đỗ", "KÉO", () => landed && Sys.parkingBrake);
            I(p, "Công tắc ĐIỆN TỬ", "TẮT", () => landed && !Sys.avionics);
            I(p, "Hỗn hợp", "CẮT (máy tắt)", () => landed && !Sys.running && Sys.mixture < 0.12);
            I(p, "Khoá từ trường", "OFF — rút chìa", () => landed && !Sys.running && Sys.mag == Mag.Off);
            I(p, "Master, đèn hiệu", "TẮT", () => landed && !Sys.masterBat);
        }

        /// <summary>Đặt danh sách theo kịch bản: các giai đoạn trước start coi như đã xong.</summary>
        public void StartAt(int phase)
        {
            current = phase;
            for (int i = 0; i < phase && i < phases.Count; i++) foreach (var it in phases[i].items) it.done = true;
            if (phase >= 3) { atisHeard = true; taxiCleared = true; }
            if (phase >= 5) runupDone = true;
            if (phase >= 6) { takeoffCleared = phase >= 7; assignedSquawk = 0; }
            if (phase >= 9) { wasAirborne = true; takeoffCleared = true; }
        }

        public void Violation(string id, int pts, string msg)
        {
            if (once.Contains(id)) return;
            once.Add(id);
            score = Math.Max(0, score - pts);
            log.Add("−" + pts + "  " + msg);
            Say("Lỗi quy trình", msg + " (−" + pts + " điểm)");
        }

        public void Note(string msg) { log.Add(msg); }

        void Say(string who, string msg) { radioQueue.Enqueue(new KeyValuePair<string, string>(who, msg)); }

        bool ComOn(double f) { return Sys.AvionicsPower && Math.Abs(S.comActive - f) < 0.005; }

        bool NearHoldShort()
        {
            if (S.model == null) return false;
            double x = S.model.pos.x, z = S.model.pos.z;
            return x > WorldCfg.RunwayWidth / 2 + 5 && x < AirportBuilder.TwX + 10 && Math.Abs(z - AirportBuilder.Connectors[2]) < 40
                || Math.Abs(x - AirportBuilder.TwX) < 12 && z > AirportBuilder.Connectors[2] - 60;
        }

        static bool OnRunway(double x, double z) { return Math.Abs(x) < WorldCfg.RunwayWidth / 2 && Math.Abs(z) < WorldCfg.RunwayLength / 2 + 20; }

        /// <summary>Nhấn nút nói (phím T).</summary>
        public void PushToTalk()
        {
            if (!Sys.AvionicsPower) { Say("Hệ thống", "Radio không có điện — bật Master BAT và công tắc ĐIỆN TỬ"); return; }
            if (ComOn(AirportBuilder.AtisFreq)) { Say("Hệ thống", "Đây là tần số ATIS, chỉ nghe. Đổi COM sang 118.30 để gọi đài"); return; }
            if (!ComOn(AirportBuilder.TowerFreq) && !ComOn(AirportBuilder.GroundFreq))
            {
                Say("Hệ thống", "Không ai trả lời trên " + S.comActive.ToString("0.000") + " — đài Sải Cánh: 118.30 (nhập ở ô chờ rồi bấm ⇆)");
                return;
            }
            var m = S.model;
            if (m == null) return;
            if (OnGround && !taxiCleared && !landed)
            {
                Say("VN-A4K", "Đài Sải Cánh, VN-A4K ở sân đỗ" + (atisHeard ? ", đã có thông báo Alpha" : "") + ", xin lăn ra cất cánh.");
                if (!atisHeard) Violation("noatis", 2, "Gọi đài khi chưa nghe ATIS");
                assignedSquawk = 4521;
                Say("Đài Sải Cánh", "VN-A4K, lăn ra đường băng 36 theo đường lăn A, dừng chờ tại A1. QNH " + S.qnh.ToString("0.00") + ", mã squawk 4521.");
                taxiCleared = true;
                return;
            }
            if (OnGround && taxiCleared && !takeoffCleared && !landed)
            {
                if (!NearHoldShort()) { Say("VN-A4K", "VN-A4K đang lăn."); Say("Đài Sải Cánh", "VN-A4K, tiếp tục lăn tới điểm chờ A1, báo khi sẵn sàng."); return; }
                Say("VN-A4K", "VN-A4K tại A1, sẵn sàng cất cánh.");
                if (!runupDone) Say("Đài Sải Cánh", "VN-A4K, nhắc: hoàn tất chạy thử động cơ trước khi cất cánh.");
                Say("Đài Sải Cánh", "VN-A4K, gió " + S.windFromDeg.ToString("000") + " độ " + S.windKt.ToString("0") + " kt, đường băng 36, được phép cất cánh.");
                takeoffCleared = true;
                return;
            }
            if (!OnGround && !landingCleared)
            {
                double d = Math.Sqrt(m.pos.x * m.pos.x + m.pos.z * m.pos.z) / 1852;
                Say("VN-A4K", "Đài Sải Cánh, VN-A4K cách sân " + d.ToString("0") + " hải lý, xin hạ cánh.");
                Say("Đài Sải Cánh", "VN-A4K, vào vòng lượn trái đường băng 36, gió " + S.windFromDeg.ToString("000") + " độ " + S.windKt.ToString("0") + " kt, QNH " + S.qnh.ToString("0.00") + ", được phép hạ cánh.");
                landingCleared = true;
                return;
            }
            if (landed && OnGround)
            {
                Say("VN-A4K", "VN-A4K đã ra khỏi đường băng, xin lăn về sân đỗ.");
                Say("Đài Sải Cánh", "VN-A4K, lăn về sân đỗ theo đường lăn A. Cảm ơn, chúc ngày tốt lành.");
                return;
            }
            Say("Đài Sải Cánh", "VN-A4K, đã rõ.");
        }

        /// <summary>Gọi mỗi khung hình.</summary>
        public void Update(float dt)
        {
            var m = S.model; if (m == null) return;
            var sys = Sys;

            // --- ATIS ---
            if (ComOn(AirportBuilder.AtisFreq))
            {
                atisListen += dt;
                if (subtitleWho != "ATIS" || subtitleT <= 0)
                {
                    subtitleWho = "ATIS";
                    subtitle = "Sải Cánh, thông báo Alpha. Gió " + S.windFromDeg.ToString("000") + " độ " + S.windKt.ToString("0") + " kt, tầm nhìn 10 km, mây rải rác 4500 ft, nhiệt độ 18, điểm sương 15, QNH " + S.qnh.ToString("0.00") + ". Đường băng 36 đang sử dụng. Độ ẩm cao: đề phòng băng chế hoà khí.";
                    subtitleT = 9;
                }
                if (atisListen > 5 && !atisHeard) { atisHeard = true; Note("Đã nghe ATIS"); }
            }
            else atisListen = 0;

            // hàng đợi radio
            if (subtitleT > 0) subtitleT -= dt;
            radioDelay -= dt;
            if (radioQueue.Count > 0 && radioDelay <= 0 && (subtitleT <= 1.5f || subtitleWho == "ATIS"))
            {
                var r = radioQueue.Dequeue();
                subtitleWho = r.Key; subtitle = r.Value; subtitleT = 4 + r.Value.Length * 0.045f;
                radioDelay = 1.2f;
            }

            // --- phát hiện thao tác chạy thử ---
            if (OnGround && sys.running && sys.rpm > 1500 && sys.rpm < 2000 && S.gsKt < 2)
            {
                if (sys.mag == Mag.L) magL = true;
                if (sys.mag == Mag.R) magR = true;
                if (sys.carbHeat > 0.5) carbChecked = true;
            }
            if (OnGround && sys.running && sys.throttle < 0.05 && sys.rpm < 900) { if (magL && magR) idleChecked = true; }
            if (magL && magR && carbChecked && idleChecked) runupDone = true;
            if (S.ctl.elevator > 0.9) ctlElevUp = true; if (S.ctl.elevator < -0.9) ctlElevDn = true;
            if (S.ctl.aileron > 0.9) ctlAilR = true; if (S.ctl.aileron < -0.9) ctlAilL = true;
            if (OnGround && S.gsKt > 3)
            {
                if (taxiHdg0 < 0) taxiHdg0 = S.heading;
                if (Math.Abs(Wrap180(S.heading - taxiHdg0)) > 45) turnedOnTaxi = true;
            }
            if (!OnGround && Math.Abs(S.vsFpm) < 200 && S.aglFt > 1000 && Math.Abs(S.ctl.elevator) < 0.1) levelT += dt; else levelT = Math.Max(0, levelT - dt * 2);

            // --- giám sát lỗi ---
            if (sys.starterWithAvionics) Violation("startav", 5, "Đề máy khi ĐIỆN TỬ đang bật (xung điện có thể hỏng radio)");
            if (sys.cranking && sys.crankTime > 10) Violation("crank", 5, "Đề máy liên tục quá 10 giây — để mô-tơ đề nguội 30 giây");
            if (sys.flooded) Violation("flood", 3, "Bơm mồi quá nhiều, động cơ ngập xăng");
            if (OnGround && S.gsKt > 22 && !OnRunway(m.pos.x, m.pos.z)) Violation("taxifast", 5, "Lăn bánh quá nhanh ngoài đường băng (> 20 kt)");
            if (OnGround && S.gsKt > 3 && !taxiCleared) Violation("notaxi", 5, "Lăn bánh khi chưa được đài cho phép");
            if (sys.running && !sys.beacon && sys.rpm > 300) Violation("beacon", 3, "Động cơ đang chạy mà đèn hiệu (beacon) tắt");
            if (OnGround && sys.parkingBrake && sys.throttle > 0.8) Violation("pbrake", 2, "Tăng ga lớn khi phanh đỗ còn kéo");
            if (OnGround && OnRunway(m.pos.x, m.pos.z) && !takeoffCleared && !landed && S.gsKt > 1) Violation("incursion", 10, "Vào đường băng khi chưa được phép cất cánh");
            if (!OnGround && !wasAirborne && S.aglFt > 20)
            {
                wasAirborne = true;
                if (!takeoffCleared) Violation("notko", 10, "Cất cánh khi chưa được đài cho phép");
                if (!runupDone) Violation("norunup", 10, "Cất cánh khi chưa chạy thử động cơ (kiểm tra từ trường, sấy CHK)");
                if (sys.flapLever > 1) Violation("tkoflap", 5, "Cất cánh với cánh tà lớn hơn 10°");
                if (sys.carbHeat > 0.5) Violation("tkocarb", 5, "Cất cánh khi sấy chế hoà khí đang BẬT (mất công suất)");
                if (sys.xpdrMode != 3) Violation("tkoxpdr", 3, "Cất cánh khi bộ phát đáp chưa ở ALT");
                if (Math.Abs(sys.baro - S.qnh) > 0.02) Violation("tkobaro", 3, "Cất cánh khi áp kế chưa chỉnh theo QNH");
                if (sys.fuelSel != FuelSel.Both) Violation("tkofuel", 5, "Cất cánh khi van xăng không ở CẢ HAI");
                if (sys.mixture < 0.9) Violation("tkomix", 5, "Cất cánh khi hỗn hợp chưa GIÀU");
                Note("Cất cánh lúc " + S.timeOfDayHours.ToString("0.00") + " giờ");
                if (current < 6) current = 6;
            }
            if (!OnGround && sys.flapLever > 0 && S.iasKt > 88) Violation("vfe", 5, "Vượt tốc độ tối đa khi có cánh tà (Vfe 85 kt)");
            if (S.iasKt > 163) Violation("vne", 10, "Vượt tốc độ cấm (Vne 163 kt)");
            if (!OnGround && m.stall > 0.6) Violation("stall", 5, "Máy bay bị thất tốc");
            if (!OnGround && S.aglFt < 1000 && sys.throttle < 0.3 && sys.carbHeat < 0.5 && wasAirborne && S.iasKt > 40) Violation("approachcarb", 2, "Giảm ga xuống thấp mà chưa bật sấy chế hoà khí");
            // hạ cánh
            if (wasAirborne && !landed && m.touchdown > maxSink) maxSink = m.touchdown;
            if (wasAirborne && OnGround && !landed && S.gsKt < 60)
            {
                landed = true;
                if (!landingCleared) Violation("nolnd", 10, "Hạ cánh khi chưa được đài cho phép");
                double sink = Math.Max(maxSink, m.touchdown);
                lastTouchdown = sink < 1.0 ? "Chạm đất rất êm (" + (sink * 196.85).ToString("0") + " ft/ph)" : sink < 2.0 ? "Chạm đất tốt (" + (sink * 196.85).ToString("0") + " ft/ph)" : "Chạm đất mạnh (" + (sink * 196.85).ToString("0") + " ft/ph)";
                if (sink >= 2.5) Violation("hard", 5, "Chạm đất mạnh");
                if (!OnRunway(m.pos.x, m.pos.z)) Violation("offrw", 10, "Hạ cánh ngoài đường băng");
                Note(lastTouchdown);
                if (current < 10) current = 10;
            }

            // --- đánh dấu danh sách ---
            for (int i = 0; i <= current && i < phases.Count; i++)
                foreach (var it in phases[i].items)
                    if (!it.done && it.cond != null && it.cond()) it.done = true;
            // tự chuyển sang giai đoạn kế khi xong
            if (current < phases.Count - 1 && phases[current].Complete) current++;
            if (!finished && landed && phases[phases.Count - 1].Complete) { finished = true; Note("Hoàn thành chuyến bay"); }
        }
    }
}

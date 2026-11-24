// Hệ thống máy bay: điện, nhiên liệu, đánh lửa, động cơ pít-tông, chân không, đèn.
// Động cơ chỉ nổ khi làm đúng quy trình (nhiên liệu, hỗn hợp, bơm mồi, ga hé, đánh lửa, đề máy).
using System;

namespace SaiCanh
{
    public enum Mag { Off = 0, R = 1, L = 2, Both = 3, Start = 4 }
    public enum FuelSel { Off = 0, Left = 1, Both = 2, Right = 3 }

    /// <summary>Toàn bộ công tắc trong buồng lái và trạng thái các hệ thống.</summary>
    public class AircraftSystems
    {
        // --- công tắc & cần ---
        public bool masterBat, masterAlt, avionics, fuelPump, beacon, landLight, taxiLight, navLight, strobe, pitotHeat, panelLight;
        public Mag mag = Mag.Off;
        public FuelSel fuelSel = FuelSel.Both;
        public double throttle, mixture = 1, carbHeat; // 0..1
        public bool parkingBrake = true;
        public int flapLever; // 0..3
        public int primeCount;
        public double baro = 29.92; // inHg
        public double hdgBug;
        public double comFreq = 122.800, navFreq = 110.50;
        public int xpdrMode = 1; // 0 TẮT, 1 CHỜ, 2 BẬT, 3 ALT
        public int squawk = 1200;

        // --- trạng thái ---
        public bool running, cranking;
        public double rpm, oilPress, oilTemp = 60, egt, suction, gyro, crankTime, fuelLine = 1;
        public double fuelL = 24, fuelR = 24; // gallon
        public double battery = 1, busVolts, amps, hobbs = 1873.4;
        public double hdgDrift; // độ lệch của đồng hồ hướng con quay
        public double power; // 0..1 công suất ra cánh quạt
        public double aiPitch, aiRoll; // đồng hồ chân trời nhân tạo (trễ khi con quay yếu)
        public string lastEvent = "";
        public bool flooded;
        public double carbIce; // 0..1 băng trong chế hoà khí
        public bool carbIceEnabled = true; // độ ẩm cao: có thể đóng băng
        public bool starterWithAvionics; // đề máy khi điện tử đang bật (sai quy trình)
        public double vacuumFailT = -1; // >= 0: bơm chân không hỏng (bài tập sự cố)
        public bool altFail; // máy phát hỏng
        public bool engineFail; // động cơ hỏng (bài tập sự cố)

        public bool ElecPower { get { return busVolts > 18; } }
        public bool AvionicsPower { get { return ElecPower && avionics; } }
        public bool Ignition { get { return mag != Mag.Off; } }
        public bool FuelAvailable
        {
            get
            {
                switch (fuelSel)
                {
                    case FuelSel.Left: return fuelL > 0.05;
                    case FuelSel.Right: return fuelR > 0.05;
                    case FuelSel.Both: return fuelL + fuelR > 0.05;
                    default: return false;
                }
            }
        }

        /// <summary>Đặt sẵn ở trạng thái động cơ đang chạy, đèn bật (xuất phát nhanh).</summary>
        public void SetReady(bool airborne)
        {
            masterBat = masterAlt = avionics = beacon = navLight = strobe = true;
            landLight = airborne ? false : true;
            mag = Mag.Both; fuelSel = FuelSel.Both; mixture = 1; carbHeat = 0; carbIce = 0; flooded = false;
            engineFail = altFail = false; vacuumFailT = -1; starterWithAvionics = false;
            parkingBrake = false; primeCount = 2; xpdrMode = 3;
            running = true; rpm = airborne ? 2300 : 900; oilPress = 70; oilTemp = 175; suction = 5; gyro = 1; fuelLine = 1; busVolts = 28; battery = 1;
            throttle = airborne ? 0.75 : 0.1;
        }

        /// <summary>Đặt về buồng lái nguội: mọi thứ tắt.</summary>
        public void SetColdDark()
        {
            masterBat = masterAlt = avionics = fuelPump = beacon = landLight = taxiLight = navLight = strobe = pitotHeat = panelLight = false;
            mag = Mag.Off; fuelSel = FuelSel.Both; mixture = 0; carbHeat = 0; throttle = 0;
            parkingBrake = true; flapLever = 0; primeCount = 0; flooded = false; carbIce = 0;
            engineFail = altFail = false; vacuumFailT = -1; starterWithAvionics = false;
            running = cranking = false; rpm = 0; oilPress = 0; oilTemp = 60; suction = 0; gyro = 0; crankTime = 0; fuelLine = 1;
            battery = 1; busVolts = 0; xpdrMode = 0;
        }

        /// <summary>Một lần bơm mồi (đẩy-kéo cần primer).</summary>
        public void Prime()
        {
            if (!FuelAvailable) { lastEvent = "Bơm mồi: không có nhiên liệu (van đang TẮT)"; return; }
            primeCount++;
            if (primeCount > 6) { flooded = true; lastEvent = "Bơm mồi quá nhiều: động cơ bị ngập xăng"; }
            else lastEvent = "Bơm mồi lần " + primeCount;
        }

        static double Clamp(double x, double a, double b) { return x < a ? a : x > b ? b : x; }

        /// <summary>Cập nhật hệ thống. speed: tốc độ khí (m/s), alt: độ cao (m).</summary>
        public void Update(double dt, double speed, double alt, double pitchTrue, double rollTrue)
        {
            // --- điện ---
            double load = 0;
            if (masterBat)
            {
                load += 3;
                if (avionics) load += 6;
                if (beacon) load += 2;
                if (landLight) load += 8;
                if (taxiLight) load += 6;
                if (navLight) load += 3;
                if (strobe) load += 4;
                if (pitotHeat) load += 10;
                if (fuelPump) load += 3;
                if (panelLight) load += 1;
            }
            bool charging = running && masterAlt && masterBat && rpm > 800 && !altFail;
            cranking = mag == Mag.Start && masterBat && battery > 0.08;
            if (cranking) { load += 120; if (avionics) starterWithAvionics = true; }
            double batV = 23 + battery * 1.6 - (cranking ? 3.5 : 0);
            busVolts = !masterBat ? 0 : charging ? 28.2 : Math.Max(0, batV);
            if (charging) { amps = Math.Max(-2, (1 - battery) * 40 + 2); battery = Math.Min(1, battery + dt * 0.002); }
            else if (masterBat) { amps = -load * 0.6; battery = Math.Max(0, battery - load * dt / 3600 / 35); }
            else amps = 0;

            // --- nhiên liệu tới động cơ ---
            if (FuelAvailable) fuelLine = Math.Min(1, fuelLine + dt * 0.2);
            else fuelLine = Math.Max(0, fuelLine - dt / 25); // còn khoảng 25 giây xăng trong ống

            bool fuelOk = fuelLine > 0.02;
            double bestMix = Clamp(1 - alt / 9000, 0.35, 1);
            double mixF = mixture < 0.12 ? 0 : 1 - Math.Min(0.7, Math.Abs(mixture - bestMix) * 0.9);
            bool spark = mag == Mag.Both || mag == Mag.L || mag == Mag.R || mag == Mag.Start;

            // --- khởi động ---
            if (!running && cranking)
            {
                crankTime += dt;
                rpm += (260 - rpm) * Math.Min(1, dt * 3);
                if (flooded)
                {
                    // quy trình động cơ ngập: ga mở hết, hỗn hợp cắt, đề cho thoát xăng
                    if (throttle > 0.8 && mixture < 0.12 && crankTime > 2.5) { flooded = false; primeCount = 2; crankTime = 0; lastEvent = "Đã xả hết xăng ngập — đưa ga về hé, hỗn hợp GIÀU rồi đề lại"; }
                }
                else if (spark && fuelOk && mixture > 0.25 && throttle < 0.5)
                {
                    double need = oilTemp > 120 ? 1.0 : primeCount >= 1 ? 1.4 : 7.0;
                    if (throttle < 0.02) need += 2.5; // ga đóng kín khó nổ
                    if (crankTime > need) { running = true; lastEvent = "Động cơ đã nổ"; }
                }
            }
            if (!cranking) crankTime = 0;

            // --- đang chạy ---
            if (running)
            {
                if (!spark) { running = false; lastEvent = "Tắt máy: khoá điện OFF"; }
                else if (!fuelOk) { running = false; lastEvent = "Động cơ chết máy: hết xăng tới động cơ (kiểm tra van nhiên liệu)"; }
                else if (mixture < 0.12) { running = false; lastEvent = "Tắt máy: hỗn hợp CẮT"; }
                else if (engineFail) { running = false; lastEvent = "ĐỘNG CƠ HỎNG! Giữ tốc độ lượn 65 kt, chọn bãi hạ cánh"; }
                else if (carbIce > 0.97) { running = false; lastEvent = "Động cơ chết máy vì băng chế hoà khí — bật SẤY CHẾ HOÀ KHÍ rồi khởi động lại"; }
            }
            // --- băng chế hoà khí: hình thành khi ga nhỏ, độ ẩm cao; tan khi bật sấy ---
            if (carbIceEnabled && running && carbHeat < 0.5)
            {
                double rate = throttle < 0.35 ? 1.0 / 420 : throttle < 0.7 ? 1.0 / 1500 : 0;
                carbIce = Math.Min(1, carbIce + rate * dt);
            }
            if (carbHeat >= 0.5) carbIce = Math.Max(0, carbIce - dt / 40);
            if (!carbIceEnabled) carbIce = 0;
            if (running)
            {
                double drop = (mag == Mag.L ? 75 : mag == Mag.R ? 100 : 0) + carbHeat * 90;
                double target = 650 + throttle * 1850 + speed * 6 - drop - carbIce * carbIce * 900;
                target *= 0.55 + 0.45 * mixF;
                rpm += (Clamp(target, 500, 2750) - rpm) * Math.Min(1, dt * 2.5);
                power = Clamp((rpm - 600) / 1900, 0, 1) * (0.4 + 0.6 * mixF) * (1 - carbHeat * 0.1);
                oilPress += (55 + rpm / 120 - oilPress) * Math.Min(1, dt * 1.5);
                oilTemp += (150 + power * 45 - oilTemp) * dt / 160;
                egt += (900 + power * 450 + (1 - mixture) * 300 - egt) * Math.Min(1, dt * 0.8);
                double gph = 1.6 + 8.4 * power * (0.5 + 0.5 * mixture);
                double burn = gph / 3600 * dt;
                if (fuelSel == FuelSel.Both) { fuelL = Math.Max(0, fuelL - burn / 2); fuelR = Math.Max(0, fuelR - burn / 2); }
                else if (fuelSel == FuelSel.Left) fuelL = Math.Max(0, fuelL - burn);
                else if (fuelSel == FuelSel.Right) fuelR = Math.Max(0, fuelR - burn);
                hobbs += dt / 3600;
                if (primeCount > 0 && rpm > 800) primeCount = 0; // xăng mồi đã cháy hết
            }
            else
            {
                double wind = speed > 25 ? speed * 18 : 0; // cánh quạt quay gió
                if (!cranking) rpm += (wind - rpm) * Math.Min(1, dt * 0.8);
                power = 0;
                oilPress += (0 - oilPress) * Math.Min(1, dt * 0.8);
                oilTemp += (60 - oilTemp) * dt / 600;
                egt += (0 - egt) * Math.Min(1, dt * 0.2);
            }

            // --- chân không & con quay ---
            bool vacOk = running && vacuumFailT < 0;
            suction += ((vacOk ? Clamp(rpm / 2000 * 5.2, 0, 5.3) : 0) - suction) * Math.Min(1, dt * 2);
            gyro += ((suction > 3.5 ? 1 : suction / 3.5) - gyro) * dt / 25;
            double follow = gyro > 0.6 ? 8 : gyro * 2;
            aiPitch += (pitchTrue - aiPitch) * Math.Min(1, dt * follow);
            aiRoll += (rollTrue - aiRoll) * Math.Min(1, dt * follow);
            if (gyro < 0.3) { aiRoll += dt * 4 * (0.3 - gyro); } // con quay đổ khi không đủ chân không
            hdgDrift += dt * (gyro > 0.5 ? 0.004 : 0.05);
        }
    }
}

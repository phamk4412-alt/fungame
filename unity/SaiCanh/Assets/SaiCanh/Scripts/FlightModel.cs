// Mô hình bay 6 bậc tự do — bản C# của public/flight/physics.js.
// Tính trong hệ "bản đồ" tay phải (x đông, y lên, z nam; mũi máy bay là -Z thân) bằng số double,
// rồi FlightGame đổi sang hệ Unity (z lật dấu) khi vẽ.
using System;

namespace SaiCanh
{
    /// <summary>Vector 3 chiều số thực kép.</summary>
    public struct V3
    {
        public double x, y, z;
        public V3(double x, double y, double z) { this.x = x; this.y = y; this.z = z; }
        public static V3 operator +(V3 a, V3 b) { return new V3(a.x + b.x, a.y + b.y, a.z + b.z); }
        public static V3 operator -(V3 a, V3 b) { return new V3(a.x - b.x, a.y - b.y, a.z - b.z); }
        public static V3 operator *(V3 a, double s) { return new V3(a.x * s, a.y * s, a.z * s); }
        public static double Dot(V3 a, V3 b) { return a.x * b.x + a.y * b.y + a.z * b.z; }
        public static V3 Cross(V3 a, V3 b) { return new V3(a.y * b.z - a.z * b.y, a.z * b.x - a.x * b.z, a.x * b.y - a.y * b.x); }
        public double Len { get { return Math.Sqrt(x * x + y * y + z * z); } }
        public V3 Norm { get { double l = Len; return l > 0 ? this * (1 / l) : this; } }
        public static readonly V3 Zero = new V3(0, 0, 0);
    }

    /// <summary>Quaternion (x,y,z,w) theo quy ước tay phải.</summary>
    public struct Q4
    {
        public double x, y, z, w;
        public Q4(double x, double y, double z, double w) { this.x = x; this.y = y; this.z = z; this.w = w; }

        public V3 Rotate(V3 v)
        {
            double ix = w * v.x + y * v.z - z * v.y;
            double iy = w * v.y + z * v.x - x * v.z;
            double iz = w * v.z + x * v.y - y * v.x;
            double iw = -x * v.x - y * v.y - z * v.z;
            return new V3(
                ix * w + iw * -x + iy * -z - iz * -y,
                iy * w + iw * -y + iz * -x - ix * -z,
                iz * w + iw * -z + ix * -y - iy * -x);
        }

        /// <summary>Từ hướng mũi (độ, 0 = bắc, 90 = đông), góc ngóc, góc nghiêng (rad).</summary>
        public static Q4 FromEuler(double headingDeg, double pitch, double roll)
        {
            double yaw = -headingDeg * Math.PI / 180;
            double c1 = Math.Cos(yaw / 2), s1 = Math.Sin(yaw / 2);
            double c2 = Math.Cos(pitch / 2), s2 = Math.Sin(pitch / 2);
            double c3 = Math.Cos(-roll / 2), s3 = Math.Sin(-roll / 2);
            return new Q4(
                s2 * c1 * c3 + c2 * s1 * s3,
                c2 * s1 * c3 - s2 * c1 * s3,
                c2 * c1 * s3 - s2 * s1 * c3,
                c2 * c1 * c3 + s2 * s1 * s3);
        }
    }

    /// <summary>Đầu vào điều khiển bay.</summary>
    public class FlightControls
    {
        public double elevator, aileron, rudder; // -1..1 (kéo cần = +, nghiêng phải = +, mũi phải = +)
        public double trim = 0.15;
        public int flaps; // nấc 0..3
        public double brakeL, brakeR; // 0..1
        public bool assist = true; // tự phối hợp bánh lái hướng khi bay
    }

    /// <summary>Môi trường tiêm vào mô hình bay (độ cao mặt đất, gió).</summary>
    public interface IFlightEnv
    {
        /// <summary>Độ cao mặt va chạm tại (x, zMap); water = true nếu là mặt nước.</summary>
        double Surface(double x, double z, out bool water);
        V3 SurfaceNormal(double x, double z);
        V3 Wind(double t, V3 pos);
    }

    /// <summary>Thông số máy bay SC-4 (đạo hàm khí động công khai của máy bay huấn luyện 4 chỗ cánh trên).</summary>
    public static class Spec
    {
        public const double Mass = 1100, S = 16.2, B = 11.0, C = 1.49;
        public static readonly double[] I = { 1285, 1825, 2667 };
        public const double Power = 120000, PropEff = 0.8, StaticThrust = 2700;
        public const double CL0 = 0.31, CLa = 5.14, AlphaStall = 0.27, CD0 = 0.031, K = 0.054, CYb = -0.31;
        public const double Cm0 = -0.015, Cma = -0.89, Cmq = -12.4, Cmde = 1.28;
        public const double Clb = -0.089, Clp = -0.47, Clr = 0.096, Clda = 0.178;
        public const double Cnb = 0.065, Cnp = -0.03, Cnr = -0.099, Cndr = 0.0657, Cnda = -0.03;
        public const double ElevMax = 0.26, AilMax = 0.3, RudMax = 0.47, TrimMax = 0.12, SteerMax = 0.3;
        public static readonly double[] FlapDeg = { 0, 10, 20, 30 };
        public const double MaxSink = 4.5, Vne = 84;

        public struct Gear { public string name; public V3 p; public double k, c, mu; public bool steer, brakeL, brakeR; }
        public static readonly Gear[] Gears =
        {
            new Gear { name = "nose", p = new V3(0, -1.2, -1.75), k = 45000, c = 5200, steer = true },
            new Gear { name = "left", p = new V3(-1.25, -1.2, 0.35), k = 70000, c = 7000, brakeL = true },
            new Gear { name = "right", p = new V3(1.25, -1.2, 0.35), k = 70000, c = 7000, brakeR = true },
            new Gear { name = "tail", p = new V3(0, 0.1, 5.2), k = 60000, c = 6000, mu = 0.45 },
        };
        public static readonly V3[] Hull =
        {
            new V3(-5.5, 0.95, 0.15), new V3(5.5, 0.95, 0.15), new V3(0, 1.55, 5.5),
            new V3(0, -0.98, -2.9), new V3(0, -0.75, 1.8), new V3(0, 1.1, -0.6),
        };
    }

    /// <summary>Trạng thái và bước mô phỏng máy bay.</summary>
    public class FlightModel
    {
        const double G = 9.81;
        public V3 pos, vel;
        public Q4 q;
        public V3 w; // p,q,r (rad/s) hệ chuẩn hàng không
        public double t, flapPos;
        public string crashed;
        public bool onGround;
        public int contacts;
        public double alpha, beta, stall, ias = 0, gload = 1, wheelSpeed, touchdown, thrust;
        readonly IFlightEnv env;

        public FlightModel(IFlightEnv env) { this.env = env; Reset(new V3(0, 600, 0), 0, 55, false); }

        public static double AirDensity(double h) { return 1.225 * Math.Exp(-Math.Max(0, h) / 8500); }

        public void Reset(V3 p, double headingDeg, double speed, bool ground)
        {
            pos = p; q = Q4.FromEuler(headingDeg, 0, 0);
            vel = Fwd * speed; w = V3.Zero; t = 0; crashed = null; onGround = ground; flapPos = 0;
            alpha = beta = stall = 0; gload = 1; ias = speed;
        }

        public V3 Fwd { get { return q.Rotate(new V3(0, 0, -1)); } }
        public V3 Right { get { return q.Rotate(new V3(1, 0, 0)); } }
        public V3 Up { get { return q.Rotate(new V3(0, 1, 0)); } }

        /// <summary>Tiến mô phỏng dt giây. power: công suất động cơ 0..1 (đã tính hỗn hợp, độ cao…).</summary>
        public void Step(double dt, FlightControls c, double power)
        {
            if (crashed != null) return;
            int n = Math.Max(1, (int)Math.Ceiling(dt * 240));
            double h = dt / n;
            touchdown = 0;
            for (int i = 0; i < n && crashed == null; i++) Sub(h, c, power);
        }

        static double Clamp(double x, double a, double b) { return x < a ? a : x > b ? b : x; }
        static double Sm(double a, double b, double x) { double tt = Clamp((x - a) / (b - a), 0, 1); return tt * tt * (3 - 2 * tt); }

        void Sub(double dt, FlightControls c, double power)
        {
            t += dt;
            V3 F = Fwd, R = Right, U = Up, D = U * -1;
            double rho = AirDensity(pos.y);
            double flapTarget = Spec.FlapDeg[Math.Max(0, Math.Min(3, c.flaps))];
            flapPos += Clamp(flapTarget - flapPos, -3 * dt, 3 * dt);
            double flapF = flapPos / 30;

            V3 gust = env.Wind(t, pos);
            V3 vAir = vel - gust;
            double V = vAir.Len;
            double u = V3.Dot(vAir, F), v = V3.Dot(vAir, R), ww = V3.Dot(vAir, D);
            double p = w.x, qq = w.y, r = w.z;
            V3 force = new V3(0, -G * Spec.Mass, 0);
            V3 mom = V3.Zero;
            alpha = 0; beta = 0; stall = 0;
            if (V > 0.5)
            {
                alpha = Math.Atan2(ww, u);
                beta = Math.Asin(Clamp(v / V, -1, 1));
                double qbar = 0.5 * rho * V * V;
                double aStall = Spec.AlphaStall - flapF * 0.03;
                stall = Sm(aStall, aStall + 0.12, Math.Abs(alpha));
                double CLlin = Spec.CL0 + Spec.CLa * alpha + flapF * 0.55;
                double CLplate = 1.05 * Math.Sin(2 * alpha) + flapF * 0.25;
                double CL = CLlin * (1 - stall) + CLplate * stall;
                double sa = Math.Sin(alpha), ca = Math.Cos(alpha), sb = Math.Sin(beta);
                double CD = Spec.CD0 + Spec.K * CLlin * CLlin * (1 - stall) + flapF * 0.065 + 1.1 * stall * sa * sa + 0.6 * sb * sb;
                double rudder = c.rudder;
                if (c.assist && !onGround) rudder = Clamp(rudder + beta * 4 - r * 0.6, -1, 1);
                double qS = qbar * Spec.S;
                double X = qS * (-CD * ca + CL * sa);
                double Z = qS * (-CD * sa - CL * ca);
                double Y = qS * (Spec.CYb * beta);
                force = force + F * X + R * Y + D * Z;
                double qTail = Math.Max(qbar, 0.5 * rho * (V * V + power * 350));
                double kb = Spec.B / (2 * Math.Max(V, 8)), kc = Spec.C / (2 * Math.Max(V, 8));
                double de = (c.elevator > 0 ? c.elevator * Spec.ElevMax : c.elevator * Spec.ElevMax * 0.75) + c.trim * Spec.TrimMax;
                double da = c.aileron * Spec.AilMax, dr = rudder * Spec.RudMax;
                double Cl = Spec.Clb * beta + Spec.Clp * (1 - 0.7 * stall) * p * kb + Spec.Clr * r * kb;
                double Cm = Spec.Cm0 + Spec.Cma * alpha + Spec.Cmq * qq * kc - stall * 0.12;
                double Cn = Spec.Cnb * beta + Spec.Cnp * p * kb + Spec.Cnr * r * kb;
                mom = mom + new V3(
                    qS * Spec.B * (Cl + Spec.Clda * da * (1 - 0.5 * stall)),
                    qS * Spec.C * Cm + qTail * Spec.S * Spec.C * Spec.Cmde * de,
                    qS * Spec.B * Cn + qTail * Spec.S * Spec.B * (Spec.Cndr * dr + Spec.Cnda * da));
                if (stall > 0.3) mom.x += qS * Spec.B * 0.02 * stall * (beta >= 0 ? 1 : -1);
            }

            // động cơ + cánh quạt
            double pw = Spec.Power * (rho / 1.225) * power;
            thrust = Math.Min(Spec.StaticThrust * power * (rho / 1.225), pw * Spec.PropEff / Math.Max(u, 1));
            force = force + F * thrust;

            // bánh xe
            int cts = 0; wheelSpeed = 0;
            V3 wW = WorldOmega(F, R, D);
            foreach (var g in Spec.Gears)
            {
                V3 rW = q.Rotate(g.p);
                V3 pt = pos + rW;
                bool water;
                double sh = env.Surface(pt.x, pt.z, out water);
                double pen = sh - pt.y;
                if (pen <= 0) continue;
                V3 vPt = vel + V3.Cross(wW, rW);
                V3 nrm = water ? new V3(0, 1, 0) : env.SurfaceNormal(pt.x, pt.z);
                double vn = V3.Dot(vPt, nrm);
                if (water) { Crash("Máy bay lao xuống nước"); return; }
                if (-vn > Spec.MaxSink) { Crash("Hạ cánh quá mạnh"); return; }
                if (-vn > 0.6) touchdown = Math.Max(touchdown, -vn);
                if (g.mu == 0) cts++;
                double Fn = Math.Max(0, g.k * pen - g.c * vn);
                V3 heading = F;
                if (g.steer)
                {
                    double ang = -c.rudder * Spec.SteerMax;
                    heading = F * Math.Cos(ang) + R * -Math.Sin(ang);
                }
                V3 fw = (heading + nrm * -V3.Dot(heading, nrm)).Norm;
                V3 lat = V3.Cross(fw, nrm);
                double vLong = V3.Dot(vPt, fw), vLat = V3.Dot(vPt, lat);
                double brake = g.brakeL ? c.brakeL : g.brakeR ? c.brakeR : 0;
                double muRoll = g.mu > 0 ? g.mu : 0.025 + brake * 0.65;
                double fLat = -Clamp(vLat / 0.25, -1, 1) * 0.85 * Fn;
                double fLong = -Clamp(vLong / 0.25, -1, 1) * muRoll * Fn;
                V3 Fg = nrm * Fn + lat * fLat + fw * fLong;
                force = force + Fg;
                V3 tq = V3.Cross(rW, Fg);
                mom = mom + new V3(V3.Dot(tq, F), V3.Dot(tq, R), V3.Dot(tq, D));
                wheelSpeed = Math.Max(wheelSpeed, Math.Abs(vLong));
            }
            contacts = cts;
            onGround = cts > 0;

            // tích phân
            V3 acc = force * (1 / Spec.Mass);
            vel = vel + acc * dt;
            pos = pos + vel * dt;
            var I = Spec.I;
            V3 Iw = new V3(I[0] * p, I[1] * qq, I[2] * r);
            V3 gyro = V3.Cross(w, Iw);
            w = new V3(p + (mom.x - gyro.x) / I[0] * dt, qq + (mom.y - gyro.y) / I[1] * dt, r + (mom.z - gyro.z) / I[2] * dt);
            V3 o = WorldOmega(F, R, D);
            double hh = 0.5 * dt;
            Q4 nq = new Q4(
                q.x + hh * (o.x * q.w + o.y * q.z - o.z * q.y),
                q.y + hh * (o.y * q.w + o.z * q.x - o.x * q.z),
                q.z + hh * (o.z * q.w + o.x * q.y - o.y * q.x),
                q.w + hh * (-o.x * q.x - o.y * q.y - o.z * q.z));
            double ql = Math.Sqrt(nq.x * nq.x + nq.y * nq.y + nq.z * nq.z + nq.w * nq.w);
            q = new Q4(nq.x / ql, nq.y / ql, nq.z / ql, nq.w / ql);

            foreach (var hp in Spec.Hull)
            {
                V3 pt = pos + q.Rotate(hp);
                bool water;
                double sh = env.Surface(pt.x, pt.z, out water);
                if (pt.y < sh) { Crash(water ? "Máy bay lao xuống nước" : "Máy bay đâm vào địa hình"); return; }
            }

            double lift = V3.Dot(acc + new V3(0, G, 0), U) / G;
            ias = V * Math.Sqrt(rho / 1.225);
            gload += (lift - gload) * Math.Min(1, dt * 8);
        }

        V3 WorldOmega(V3 F, V3 R, V3 D) { return F * w.x + R * w.y + D * w.z; }

        public void Crash(string why) { crashed = why; vel = V3.Zero; w = V3.Zero; }

        /// <summary>Hướng mũi (độ 0..360), ngóc, nghiêng (rad).</summary>
        public void Attitude(out double heading, out double pitch, out double roll)
        {
            V3 F = Fwd, R = Right, U = Up;
            pitch = Math.Asin(Clamp(F.y, -1, 1));
            heading = Math.Atan2(F.x, -F.z) * 180 / Math.PI;
            if (heading < 0) heading += 360;
            roll = Math.Atan2(-R.y, U.y);
        }
    }
}

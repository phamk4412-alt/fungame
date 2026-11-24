// Địa hình thủ tục của Sải Cánh — bản C# của public/flight/terrain.js (cùng kết quả).
// Hệ toạ độ "bản đồ" (giống bản web): x đông, y lên, zMap nam. Trong Unity: zUnity = -zMap (bắc là +z).
using System;

namespace SaiCanh
{
    /// <summary>Cấu hình bản đồ: sân bay, thị trấn, hồ, bờ biển.</summary>
    public static class WorldCfg
    {
        public const float Sea = 0f;
        public const float AirportX = 0f, AirportZ = 0f, AirportElev = 62f, AirportHalfW = 420f, AirportHalfL = 1350f, AirportBlend = 900f;
        public const float RunwayLength = 1800f, RunwayWidth = 30f;
        public const float TownX = 2300f, TownZ = 500f, TownR = 900f;
        public const float LakeX = -5200f, LakeZ = -1800f, LakeR = 1700f;
        public const float CoastZ = 7500f, MountainZ = -5000f;
    }

    /// <summary>Nhiễu gradient 2D tất định và các hàm độ cao, mặt nạ rừng/phố/sân bay.</summary>
    public static class WorldGen
    {
        static readonly byte[] Perm = new byte[512];
        static readonly float[] Gx = new float[256];
        static readonly float[] Gy = new float[256];

        static WorldGen()
        {
            uint s = 1337;
            Func<double> rnd = () => { s = unchecked(s * 1103515245u + 12345u); return s / 4294967296.0; };
            int[] p = new int[256];
            for (int i = 0; i < 256; i++) p[i] = i;
            for (int i = 255; i > 0; i--)
            {
                int j = (int)Math.Floor(rnd() * (i + 1));
                int t = p[i]; p[i] = p[j]; p[j] = t;
            }
            for (int i = 0; i < 512; i++) Perm[i] = (byte)p[i & 255];
            for (int i = 0; i < 256; i++)
            {
                double a = rnd() * Math.PI * 2;
                Gx[i] = (float)Math.Cos(a);
                Gy[i] = (float)Math.Sin(a);
            }
        }

        /// <summary>Nhiễu gradient 2D, khoảng [-0.7, 0.7].</summary>
        public static double Noise(double x, double y)
        {
            double xi = Math.Floor(x), yi = Math.Floor(y);
            double xf = x - xi, yf = y - yi;
            int X = ((int)xi) & 255, Y = ((int)yi) & 255;
            double u = xf * xf * xf * (xf * (xf * 6 - 15) + 10);
            double v = yf * yf * yf * (yf * (yf * 6 - 15) + 10);
            int aa = Perm[Perm[X] + Y], ab = Perm[Perm[X] + Y + 1];
            int ba = Perm[Perm[X + 1] + Y], bb = Perm[Perm[X + 1] + Y + 1];
            double n00 = Gx[aa] * xf + Gy[aa] * yf;
            double n10 = Gx[ba] * (xf - 1) + Gy[ba] * yf;
            double n01 = Gx[ab] * xf + Gy[ab] * (yf - 1);
            double n11 = Gx[bb] * (xf - 1) + Gy[bb] * (yf - 1);
            double x1 = n00 + (n10 - n00) * u;
            double x2 = n01 + (n11 - n01) * u;
            return x1 + (x2 - x1) * v;
        }

        /// <summary>Tổng nhiễu nhiều quãng tám.</summary>
        public static double Fbm(double x, double y, int oct = 5, double gain = 0.5)
        {
            double a = 1, f = 1, s = 0, n = 0;
            for (int i = 0; i < oct; i++)
            {
                s += a * Noise(x * f + i * 17.3, y * f - i * 9.1);
                n += a; a *= gain; f *= 2.03;
            }
            return s / n;
        }

        /// <summary>Nhiễu gợn cho sống núi.</summary>
        public static double Ridged(double x, double y, int oct = 6)
        {
            double a = 0.5, f = 1, s = 0, w = 1;
            for (int i = 0; i < oct; i++)
            {
                double n = 1 - Math.Abs(Noise(x * f + i * 31.7, y * f + i * 11.3) * 1.45);
                n *= n; n *= w;
                w = Math.Min(1, Math.Max(0, n * 1.6));
                s += n * a; a *= 0.5; f *= 2.1;
            }
            return s;
        }

        public static double Smooth(double a, double b, double x)
        {
            double t = Math.Min(1, Math.Max(0, (x - a) / (b - a)));
            return t * t * (3 - 2 * t);
        }

        static double Mix(double a, double b, double t) { return a + (b - a) * t; }

        public static double AirportMask(double x, double z)
        {
            double dx = Math.Max(0, Math.Abs(x - WorldCfg.AirportX) - WorldCfg.AirportHalfW);
            double dz = Math.Max(0, Math.Abs(z - WorldCfg.AirportZ) - WorldCfg.AirportHalfL);
            return 1 - Smooth(0, WorldCfg.AirportBlend, Math.Sqrt(dx * dx + dz * dz));
        }

        public static double TownMask(double x, double z)
        {
            double dz = (z - WorldCfg.TownZ) * 1.3;
            double d = Math.Sqrt((x - WorldCfg.TownX) * (x - WorldCfg.TownX) + dz * dz) + Fbm(x / 700, z / 700, 2) * 400;
            return 1 - Smooth(WorldCfg.TownR * 0.6, WorldCfg.TownR, d);
        }

        static double LakeMask(double x, double z)
        {
            double dz = (z - WorldCfg.LakeZ) * 1.4;
            double d = Math.Sqrt((x - WorldCfg.LakeX) * (x - WorldCfg.LakeX) + dz * dz) + Fbm(x / 900 + 3, z / 900, 3) * 900;
            return 1 - Smooth(WorldCfg.LakeR * 0.7, WorldCfg.LakeR, d);
        }

        /// <summary>Độ cao mặt đất (m) tại toạ độ bản đồ (x, zMap). Âm là dưới nước.</summary>
        public static double Height(double x, double z)
        {
            double k = 1.0 / 1000, X = x * k, Z = z * k;
            double h = 70 + 95 * Fbm(X * 0.32, Z * 0.32, 5) + 18 * Fbm(X * 1.7, Z * 1.7, 3);
            double north = (WorldCfg.MountainZ - z) * k + 3.2 * Fbm(X * 0.07 + 5, Z * 0.07, 3);
            double m = Smooth(-1.5, 6, north);
            double r = Ridged(X * 0.21, Z * 0.21, 6);
            h += m * (r * 2100 + 260 * Fbm(X * 0.6, Z * 0.6, 4)) + Smooth(-3, 2, north) * 120;
            double south = (z - WorldCfg.CoastZ) * k + 3 * Fbm(X * 0.11 - 4, Z * 0.11, 3);
            double s = Smooth(-0.6, 1.4, south);
            h = Mix(h, -40 - 30 * s, s);
            h = Mix(h, -18, LakeMask(x, z));
            h = Mix(h, WorldCfg.AirportElev, AirportMask(x, z));
            double t = TownMask(x, z);
            if (t > 0) h = Mix(h, 0.5 * h + 0.5 * (WorldCfg.AirportElev + 8), t * 0.7);
            return h;
        }

        /// <summary>Mật độ rừng 0..1.</summary>
        public static double Forest(double x, double z, double h)
        {
            if (h < 4 || h > 1650) return 0;
            double X = x / 1000, Z = z / 1000;
            double f = Fbm(X * 0.55 + 7.3, Z * 0.55 - 2.1, 4) + 0.12 * Fbm(X * 3.1, Z * 3.1, 2);
            f = Smooth(0.02, 0.16, f + (h > 300 ? 0.08 : 0));
            f *= 1 - AirportMask(x, z);
            f *= 1 - TownMask(x, z);
            f *= 1 - Smooth(1350, 1650, h);
            return f;
        }

        /// <summary>Pháp tuyến (hệ bản đồ, tay phải).</summary>
        public static void Normal(double x, double z, double e, out double nx, out double ny, out double nz)
        {
            double hx = Height(x + e, z) - Height(x - e, z);
            double hz = Height(x, z + e) - Height(x, z - e);
            nx = -hx; ny = 2 * e; nz = -hz;
            double l = Math.Sqrt(nx * nx + ny * ny + nz * nz);
            nx /= l; ny /= l; nz /= l;
        }

        /// <summary>Có nằm trên mặt nhựa đường băng không (toạ độ bản đồ).</summary>
        public static bool OnRunway(double x, double z)
        {
            return Math.Abs(x) < WorldCfg.RunwayWidth / 2 + 3 && Math.Abs(z) < WorldCfg.RunwayLength / 2 + 20;
        }

        /// <summary>Ô ruộng: trả về chỉ số loại cây trồng 0..6 và có phải bờ rào không.</summary>
        public static int FieldCell(double x, double z, out double hedge)
        {
            double wx = x + (Noise(x / 900, z / 900) * 0.7) * 300, wz = z + (Noise(x / 900 + 7, z / 900) * 0.7) * 300;
            double ca = 0.42, cs = Math.Cos(ca), sn = Math.Sin(ca);
            double rx = cs * wx - sn * wz, rz = sn * wx + cs * wz;
            double cw = 190, chh = 130;
            double cx = Math.Floor(rx / cw), cz = Math.Floor(rz / chh);
            uint hc = Hash((int)cx, (int)cz, 1);
            if ((hc & 0xffff) / 65535.0 > 0.55) { cw *= 0.5; cx = Math.Floor(rx / cw) + 91; }
            double fx = rx / cw - Math.Floor(rx / cw), fz = rz / chh - Math.Floor(rz / chh);
            double ex = Math.Min(fx, 1 - fx) * cw, ez = Math.Min(fz, 1 - fz) * chh;
            uint hk = Hash((int)cx, (int)cz, 17);
            hedge = ((Hash((int)cx, (int)cz, 3) & 0xffff) / 65535.0 > 0.45) ? 1 - Smooth(1.5, 4.5, Math.Min(ex, ez)) : 0;
            return (int)(hk % 7);
        }

        public static uint Hash(int x, int y, int s)
        {
            unchecked
            {
                uint h = (uint)x * 374761393u + (uint)y * 668265263u + (uint)s * 982451653u;
                h = (h ^ (h >> 13)) * 1274126177u;
                return h ^ (h >> 16);
            }
        }

        public static float Hash01(int x, int y, int s) { return (Hash(x, y, s) & 0xffffff) / 16777215f; }
    }
}

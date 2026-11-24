// Sinh kết cấu bằng mã: cỏ, ruộng, đất rừng, đá, tuyết, cát, nhựa đường, pháp tuyến sóng, ngọn cỏ, mây.
using System;
using UnityEngine;

namespace SaiCanh
{
    public static class TexGen
    {
        /// <summary>Nhiễu lặp liền (tileable) trên ô n×n với chu kỳ period.</summary>
        static double TileNoise(double x, double y, int period, int seed)
        {
            // trộn 4 góc để lặp liền mạch
            double fx = x / period, fy = y / period;
            double a = WorldGen.Fbm(x / period * 4 + seed, y / period * 4 - seed, 4);
            double b = WorldGen.Fbm((x - period) / period * 4 + seed, y / period * 4 - seed, 4);
            double c = WorldGen.Fbm(x / period * 4 + seed, (y - period) / period * 4 - seed, 4);
            double d = WorldGen.Fbm((x - period) / period * 4 + seed, (y - period) / period * 4 - seed, 4);
            double ab = a + (b - a) * fx, cd = c + (d - c) * fx;
            return ab + (cd - ab) * fy;
        }

        static Texture2D New(int n, bool linear = false)
        {
            var t = new Texture2D(n, n, TextureFormat.RGBA32, true, linear);
            t.wrapMode = TextureWrapMode.Repeat;
            t.filterMode = FilterMode.Trilinear;
            t.anisoLevel = 8;
            return t;
        }

        /// <summary>Kết cấu mặt đất: hai màu trộn theo nhiễu + hạt nhỏ + (tuỳ chọn) luống cày.</summary>
        public static Texture2D Ground(Color a, Color b, int seed, float grain = 0.08f, float rows = 0, Color? speck = null, int n = 256)
        {
            var t = New(n);
            var px = new Color[n * n];
            var rnd = new System.Random(seed);
            for (int y = 0; y < n; y++)
                for (int x = 0; x < n; x++)
                {
                    double v = TileNoise(x, y, n, seed) * 1.6 + 0.5;
                    double v2 = TileNoise(x * 4 % n, y * 4 % n, n, seed + 7) * 0.8;
                    Color c = Color.Lerp(a, b, Mathf.Clamp01((float)(v + v2 * 0.5)));
                    float g = (float)(rnd.NextDouble() - 0.5) * grain;
                    c = new Color(c.r + g, c.g + g, c.b + g * 0.8f);
                    if (rows > 0)
                    {
                        float r = Mathf.Sin(y / (float)n * Mathf.PI * 2 * rows);
                        c *= 0.9f + 0.1f * r;
                    }
                    if (speck.HasValue && rnd.NextDouble() < 0.012) c = Color.Lerp(c, speck.Value, 0.6f);
                    c.a = 1;
                    px[y * n + x] = c;
                }
            t.SetPixels(px);
            t.Apply(true);
            return t;
        }

        /// <summary>Bản đồ pháp tuyến sóng nước (lặp liền).</summary>
        public static Texture2D WaveNormals(int n = 256)
        {
            var t = New(n, true);
            var h = new float[n * n];
            for (int y = 0; y < n; y++)
                for (int x = 0; x < n; x++)
                    h[y * n + x] = (float)(TileNoise(x, y, n, 31) + 0.5 * TileNoise(x * 2 % n, y * 2 % n, n, 47));
            var px = new Color[n * n];
            for (int y = 0; y < n; y++)
                for (int x = 0; x < n; x++)
                {
                    float dx = h[y * n + (x + 1) % n] - h[y * n + (x + n - 1) % n];
                    float dy = h[((y + 1) % n) * n + x] - h[((y + n - 1) % n) * n + x];
                    var nv = new Vector3(-dx * 18, -dy * 18, 1).normalized;
                    px[y * n + x] = new Color(nv.x * 0.5f + 0.5f, nv.y * 0.5f + 0.5f, nv.z * 0.5f + 0.5f, 1);
                }
            t.SetPixels(px);
            t.Apply(true);
            return t;
        }

        /// <summary>Ngọn cỏ cho chi tiết địa hình (nền trong suốt).</summary>
        public static Texture2D GrassBlades(int n = 128)
        {
            var t = new Texture2D(n, n, TextureFormat.RGBA32, true);
            t.wrapMode = TextureWrapMode.Clamp;
            var px = new Color[n * n];
            var rnd = new System.Random(5);
            for (int k = 0; k < 26; k++)
            {
                float x0 = (float)rnd.NextDouble() * n, lean = ((float)rnd.NextDouble() - 0.5f) * 0.5f;
                float hgt = n * (0.55f + 0.45f * (float)rnd.NextDouble()), w = 2.2f + (float)rnd.NextDouble() * 2;
                Color col = Color.Lerp(new Color(0.32f, 0.45f, 0.16f), new Color(0.55f, 0.62f, 0.28f), (float)rnd.NextDouble());
                for (int y = 0; y < hgt && y < n; y++)
                {
                    float f = y / hgt;
                    float cx = x0 + lean * y, half = w * (1 - f);
                    for (int x = Mathf.Max(0, (int)(cx - half - 1)); x <= Mathf.Min(n - 1, (int)(cx + half + 1)); x++)
                    {
                        float a = Mathf.Clamp01(half + 0.5f - Mathf.Abs(x - cx));
                        if (a <= 0) continue;
                        Color c = col * (0.65f + 0.35f * f);
                        var o = px[y * n + x];
                        px[y * n + x] = new Color(c.r, c.g, c.b, Mathf.Max(o.a, a));
                    }
                }
            }
            t.SetPixels(px);
            t.Apply(true);
            return t;
        }

        /// <summary>Một cụm mây mềm (độ trong suốt theo nhiễu).</summary>
        public static Texture2D Puff(int n = 128)
        {
            var t = new Texture2D(n, n, TextureFormat.RGBA32, true);
            t.wrapMode = TextureWrapMode.Clamp;
            var px = new Color[n * n];
            for (int y = 0; y < n; y++)
                for (int x = 0; x < n; x++)
                {
                    float dx = (x + 0.5f) / n * 2 - 1, dy = (y + 0.5f) / n * 2 - 1;
                    float r = Mathf.Sqrt(dx * dx + dy * dy);
                    float nz = (float)WorldGen.Fbm(x / 22.0 + 3, y / 22.0, 4) * 0.9f;
                    float a = Mathf.Clamp01(1 - (r + nz * 0.5f) * 1.15f);
                    a = a * a * (3 - 2 * a);
                    px[y * n + x] = new Color(1, 1, 1, a * 0.9f);
                }
            t.SetPixels(px);
            t.Apply(true);
            return t;
        }

        /// <summary>Nhựa đường có vệt cao su.</summary>
        public static Texture2D Asphalt(Color baseC, int seed, int n = 256)
        {
            var t = Ground(baseC * 0.92f, baseC * 1.08f, seed, 0.12f, 0, new Color(0.15f, 0.15f, 0.15f), n);
            return t;
        }

        /// <summary>Kết cấu tuỳ ý từ hàm màu theo (u, v).</summary>
        public static Texture2D Paint(int w, int h, Func<float, float, Color> f, bool clamp = true)
        {
            var t = new Texture2D(w, h, TextureFormat.RGBA32, true);
            t.wrapMode = clamp ? TextureWrapMode.Clamp : TextureWrapMode.Repeat;
            t.anisoLevel = 8;
            var px = new Color[w * h];
            for (int y = 0; y < h; y++)
                for (int x = 0; x < w; x++)
                    px[y * w + x] = f((x + 0.5f) / w, (y + 0.5f) / h);
            t.SetPixels(px);
            t.Apply(true);
            return t;
        }
    }
}

// Công cụ dựng lưới 3D bằng mã: thân theo mặt cắt, cánh biên dạng NACA, ống, lăng trụ, vật liệu.
// Toạ độ thân máy bay trong Unity: x phải, y lên, z tới trước (mũi = +z).
using System.Collections.Generic;
using UnityEngine;
using UnityEngine.Rendering;

namespace SaiCanh
{
    public static class ProcMesh
    {
        /// <summary>Đảo tam giác sao cho mặt trước hướng ra xa điểm tham chiếu của từng tam giác.</summary>
        static void Orient(List<Vector3> v, List<int> idx, System.Func<Vector3, Vector3> refOf)
        {
            for (int i = 0; i < idx.Count; i += 3)
            {
                Vector3 a = v[idx[i]], b = v[idx[i + 1]], c = v[idx[i + 2]];
                Vector3 n = Vector3.Cross(b - a, c - a);
                Vector3 cen = (a + b + c) / 3f;
                if (Vector3.Dot(n, cen - refOf(cen)) < 0) { int t = idx[i + 1]; idx[i + 1] = idx[i + 2]; idx[i + 2] = t; }
            }
        }

        static Mesh Build(List<Vector3> v, List<int> idx, List<Vector2> uv = null)
        {
            var m = new Mesh();
            if (v.Count > 65000) m.indexFormat = IndexFormat.UInt32;
            m.SetVertices(v);
            m.SetTriangles(idx, 0);
            if (uv != null) m.SetUVs(0, uv);
            m.RecalculateNormals();
            m.RecalculateBounds();
            return m;
        }

        /// <summary>Điểm siêu elip trên mặt cắt (góc a: 0 = nóc, π/2 = bên phải).</summary>
        public static Vector3 Section(float z, float w, float h, float yc, float e, float a)
        {
            float s = Mathf.Sin(a), c = Mathf.Cos(a);
            float x = Mathf.Sign(s) * Mathf.Pow(Mathf.Abs(s), 2f / e) * w / 2f;
            float y = Mathf.Sign(c) * Mathf.Pow(Mathf.Abs(c), 2f / e) * h / 2f;
            return new Vector3(x, yc + y, z);
        }

        /// <summary>Thân dựng từ dãy mặt cắt {z, rộng, cao, tâm y, mũ} (z đã theo Unity: mũi +z).</summary>
        public static Mesh Loft(float[][] sec, int seg = 32, bool inward = false, int rowsPerSpan = 1)
        {
            var v = new List<Vector3>(); var uv = new List<Vector2>(); var idx = new List<int>();
            var rows = new List<float[]>();
            for (int j = 0; j < sec.Length - 1; j++)
                for (int k = 0; k < rowsPerSpan; k++)
                {
                    float t = k / (float)rowsPerSpan;
                    var a = sec[j]; var b = sec[j + 1];
                    var r = new float[5];
                    for (int i = 0; i < 5; i++) r[i] = Mathf.Lerp(a[i], b[i], t);
                    rows.Add(r);
                }
            rows.Add(sec[sec.Length - 1]);
            float z0 = rows[0][0], z1 = rows[rows.Count - 1][0];
            for (int j = 0; j < rows.Count; j++)
            {
                var s = rows[j];
                for (int i = 0; i <= seg; i++)
                {
                    v.Add(Section(s[0], s[1], s[2], s[3], s[4], i / (float)seg * Mathf.PI * 2));
                    uv.Add(new Vector2(i / (float)seg, (s[0] - z0) / (z1 - z0)));
                }
                if (j > 0)
                    for (int i = 0; i < seg; i++)
                    {
                        int a = (j - 1) * (seg + 1) + i, b = a + 1, c = a + seg + 1, d = c + 1;
                        idx.Add(a); idx.Add(b); idx.Add(c); idx.Add(b); idx.Add(d); idx.Add(c);
                    }
            }
            Orient(v, idx, p => { var s = SectionAt(sec, p.z); return new Vector3(0, s[3], p.z); });
            if (inward) for (int i = 0; i < idx.Count; i += 3) { int t = idx[i + 1]; idx[i + 1] = idx[i + 2]; idx[i + 2] = t; }
            return Build(v, idx, uv);
        }

        /// <summary>Nội suy mặt cắt tại z.</summary>
        public static float[] SectionAt(float[][] sec, float z)
        {
            // sec có thể xếp z tăng hoặc giảm
            for (int i = 1; i < sec.Length; i++)
            {
                float za = sec[i - 1][0], zb = sec[i][0];
                if ((z - za) * (z - zb) <= 0)
                {
                    float t = Mathf.Abs(zb - za) < 1e-5f ? 0 : (z - za) / (zb - za);
                    var r = new float[5];
                    for (int k = 0; k < 5; k++) r[k] = Mathf.Lerp(sec[i - 1][k], sec[i][k], t);
                    return r;
                }
            }
            return Mathf.Abs(z - sec[0][0]) < Mathf.Abs(z - sec[sec.Length - 1][0]) ? sec[0] : sec[sec.Length - 1];
        }

        /// <summary>Cánh biên dạng NACA dọc trục x từ x0 tới x1; mép trước ở z = 0, dây cung chạy về -z.</summary>
        public static Mesh Wing(float x0, float x1, float c0, float c1, float thick = 0.12f, float camber = 0.02f, float sweep = 0, float dihedral = 0, int seg = 16)
        {
            var up = new List<Vector2>(); var lo = new List<Vector2>();
            for (int i = 0; i <= seg; i++)
            {
                float xc = 0.5f - 0.5f * Mathf.Cos(Mathf.PI * i / seg);
                float yt = 5 * thick * (0.2969f * Mathf.Sqrt(xc) - 0.126f * xc - 0.3516f * xc * xc + 0.2843f * xc * xc * xc - 0.1036f * xc * xc * xc * xc);
                float yc = camber == 0 ? 0 : (xc < 0.4f ? camber / 0.16f * (0.8f * xc - xc * xc) : camber / 0.36f * (0.2f + 0.8f * xc - xc * xc));
                up.Add(new Vector2(xc, yc + yt)); lo.Add(new Vector2(xc, yc - yt));
            }
            var ring = new List<Vector2>();
            for (int i = seg; i >= 0; i--) ring.Add(up[i]);
            for (int i = 1; i <= seg; i++) ring.Add(lo[i]);
            int N = ring.Count, spans = 6;
            var v = new List<Vector3>(); var idx = new List<int>();
            var centers = new List<Vector3>();
            for (int j = 0; j <= spans; j++)
            {
                float s = j / (float)spans;
                float x = Mathf.Lerp(x0, x1, s), ch = Mathf.Lerp(c0, c1, s);
                float dz = sweep * Mathf.Abs(x - x0), dy = Mathf.Tan(dihedral) * Mathf.Abs(x - x0);
                foreach (var p in ring) v.Add(new Vector3(x, dy + p.y * ch, -(dz + p.x * ch)));
                centers.Add(new Vector3(x, dy, -(dz + 0.42f * ch)));
            }
            for (int j = 0; j < spans; j++)
                for (int i = 0; i < N - 1; i++)
                {
                    int a = j * N + i, b = a + 1, c = a + N, d = c + 1;
                    idx.Add(a); idx.Add(c); idx.Add(b); idx.Add(b); idx.Add(c); idx.Add(d);
                }
            int sideStart = idx.Count;
            foreach (int j in new[] { 0, spans })
            {
                int b0 = j * N;
                for (int i = 1; i < N - 2; i++) { idx.Add(b0); idx.Add(b0 + i); idx.Add(b0 + i + 1); }
            }
            float xmid = (x0 + x1) / 2;
            Orient(v, idx, p =>
            {
                float s = Mathf.Clamp01((p.x - x0) / (x1 - x0 == 0 ? 1 : x1 - x0));
                int k = Mathf.Clamp(Mathf.RoundToInt(s * spans), 0, spans);
                var c = centers[k];
                // nắp hai đầu: tham chiếu là tâm cánh
                if (Mathf.Abs(p.x - x0) < 1e-4f || Mathf.Abs(p.x - x1) < 1e-4f) return new Vector3(xmid, c.y, c.z);
                return new Vector3(p.x, c.y, c.z);
            });
            return Build(v, idx);
        }

        /// <summary>Ống tròn chạy qua chuỗi điểm (đường cong Catmull-Rom).</summary>
        public static Mesh Tube(IList<Vector3> pts, float r, int sides = 8, int perSeg = 6)
        {
            var path = new List<Vector3>();
            for (int i = 0; i < pts.Count - 1; i++)
            {
                Vector3 p0 = pts[Mathf.Max(0, i - 1)], p1 = pts[i], p2 = pts[i + 1], p3 = pts[Mathf.Min(pts.Count - 1, i + 2)];
                for (int k = 0; k < perSeg; k++)
                {
                    float t = k / (float)perSeg, t2 = t * t, t3 = t2 * t;
                    path.Add(0.5f * (2 * p1 + (-p0 + p2) * t + (2 * p0 - 5 * p1 + 4 * p2 - p3) * t2 + (-p0 + 3 * p1 - 3 * p2 + p3) * t3));
                }
            }
            path.Add(pts[pts.Count - 1]);
            var v = new List<Vector3>(); var idx = new List<int>();
            Vector3 prevN = Vector3.zero;
            for (int i = 0; i < path.Count; i++)
            {
                Vector3 tan = (path[Mathf.Min(path.Count - 1, i + 1)] - path[Mathf.Max(0, i - 1)]).normalized;
                Vector3 n = i == 0 ? Vector3.Cross(tan, Mathf.Abs(tan.y) < 0.9f ? Vector3.up : Vector3.right).normalized : Vector3.Cross(Vector3.Cross(tan, prevN), tan).normalized;
                prevN = n;
                Vector3 bn = Vector3.Cross(tan, n);
                for (int s = 0; s <= sides; s++)
                {
                    float a = s / (float)sides * Mathf.PI * 2;
                    v.Add(path[i] + (n * Mathf.Cos(a) + bn * Mathf.Sin(a)) * r);
                }
                if (i > 0)
                    for (int s = 0; s < sides; s++)
                    {
                        int a = (i - 1) * (sides + 1) + s, b = a + 1, c = a + sides + 1, d = c + 1;
                        idx.Add(a); idx.Add(b); idx.Add(c); idx.Add(b); idx.Add(d); idx.Add(c);
                    }
            }
            int rowLen = sides + 1;
            Orient(v, idx, p =>
            {
                // tham chiếu: điểm gần nhất trên đường tâm
                int best = 0; float bd = float.MaxValue;
                for (int i = 0; i < path.Count; i++) { float d = (path[i] - p).sqrMagnitude; if (d < bd) { bd = d; best = i; } }
                return path[best];
            });
            return Build(v, idx);
        }

        /// <summary>Lăng trụ từ đa giác lồi trong mặt phẳng (y, -z) dày theo x (dùng cho đuôi đứng).</summary>
        public static Mesh Fin(Vector2[] shape, float thick)
        {
            var v = new List<Vector3>(); var idx = new List<int>();
            int n = shape.Length;
            foreach (float sx in new[] { -thick / 2, thick / 2 })
                foreach (var p in shape) v.Add(new Vector3(sx, p.y, -p.x));
            for (int i = 1; i < n - 1; i++) { idx.Add(0); idx.Add(i); idx.Add(i + 1); idx.Add(n); idx.Add(n + i + 1); idx.Add(n + i); }
            for (int i = 0; i < n; i++) { int j = (i + 1) % n; idx.Add(i); idx.Add(j); idx.Add(n + i); idx.Add(j); idx.Add(n + j); idx.Add(n + i); }
            Vector3 c = Vector3.zero; foreach (var p in v) c += p; c /= v.Count;
            Orient(v, idx, p => c);
            return Build(v, idx);
        }

        // ---------- vật liệu ----------
        static Shader std;
        public static Shader Std { get { if (std == null) std = Shader.Find("Standard"); return std; } }

        public static Material Mat(Color c, float smooth = 0.3f, float metal = 0f)
        {
            var m = new Material(Std) { color = c };
            m.SetFloat("_Glossiness", smooth);
            m.SetFloat("_Metallic", metal);
            m.enableInstancing = true;
            return m;
        }

        public static Material Mat(string hex, float smooth = 0.3f, float metal = 0f) { return Mat(Hex(hex), smooth, metal); }

        /// <summary>Vật liệu trong suốt (kính).</summary>
        public static Material Glass(Color c, float smooth = 0.95f)
        {
            var m = Mat(c, smooth, 0.1f);
            m.SetFloat("_Mode", 3);
            m.SetInt("_SrcBlend", (int)BlendMode.One);
            m.SetInt("_DstBlend", (int)BlendMode.OneMinusSrcAlpha);
            m.SetInt("_ZWrite", 0);
            m.DisableKeyword("_ALPHATEST_ON");
            m.DisableKeyword("_ALPHABLEND_ON");
            m.EnableKeyword("_ALPHAPREMULTIPLY_ON");
            m.renderQueue = 3000;
            return m;
        }

        /// <summary>Vật liệu phát sáng (đèn).</summary>
        public static Material Emissive(Color c, float intensity = 2f)
        {
            var m = Mat(c * 0.2f, 0.5f);
            m.EnableKeyword("_EMISSION");
            m.SetColor("_EmissionColor", c * intensity);
            return m;
        }

        public static Color Hex(string h)
        {
            Color c; ColorUtility.TryParseHtmlString(h.StartsWith("#") ? h : "#" + h, out c);
            return c;
        }

        /// <summary>Tạo vật thể có lưới + vật liệu, gắn vào cha.</summary>
        public static GameObject Obj(string name, Mesh mesh, Material mat, Transform parent, Vector3 pos = default(Vector3), bool shadows = true)
        {
            var go = new GameObject(name);
            go.transform.SetParent(parent, false);
            go.transform.localPosition = pos;
            go.AddComponent<MeshFilter>().sharedMesh = mesh;
            var mr = go.AddComponent<MeshRenderer>();
            mr.sharedMaterial = mat;
            mr.shadowCastingMode = shadows ? ShadowCastingMode.On : ShadowCastingMode.Off;
            return go;
        }

        /// <summary>Khối nguyên thuỷ (hộp, trụ, cầu…) không có collider.</summary>
        public static GameObject Prim(PrimitiveType t, Transform parent, Vector3 pos, Vector3 scale, Material mat, bool keepCollider = false)
        {
            var go = GameObject.CreatePrimitive(t);
            if (!keepCollider) Object.Destroy(go.GetComponent<Collider>());
            go.transform.SetParent(parent, false);
            go.transform.localPosition = pos;
            go.transform.localScale = scale;
            go.GetComponent<MeshRenderer>().sharedMaterial = mat;
            return go;
        }
    }
}

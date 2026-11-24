// Đồng hồ cơ học dựng bằng mã: mặt số vẽ theo điểm ảnh (vạch, cung màu), số bằng chữ 3D, kim quay, kính, viền.
// Hệ toạ độ bảng: x phải, y lên, -z hướng về phi công. Góc tính theo chiều kim đồng hồ từ đỉnh (độ).
using System.Collections.Generic;
using UnityEngine;

namespace SaiCanh
{
    /// <summary>Bút vẽ mặt đồng hồ: toạ độ chuẩn hoá -1..1, góc theo chiều kim đồng hồ từ đỉnh.</summary>
    public class FacePainter
    {
        readonly int n;
        readonly Color[] px;
        public FacePainter(int size, Color bg, bool round = true)
        {
            n = size; px = new Color[n * n];
            for (int y = 0; y < n; y++)
                for (int x = 0; x < n; x++)
                {
                    float u = (x + 0.5f) / n * 2 - 1, v = (y + 0.5f) / n * 2 - 1;
                    float r = Mathf.Sqrt(u * u + v * v);
                    // mặt số hơi tối dần ra mép cho có chiều sâu
                    Color c = bg * (1.08f - 0.16f * r);
                    c.a = round ? Mathf.Clamp01((1 - r) * n * 0.5f + 0.5f) : 1;
                    px[y * n + x] = c;
                }
        }

        static Vector2 P(float aDeg, float r) { float a = aDeg * Mathf.Deg2Rad; return new Vector2(Mathf.Sin(a) * r, Mathf.Cos(a) * r); }

        void Blend(int x, int y, Color c, float a)
        {
            if (x < 0 || y < 0 || x >= n || y >= n || a <= 0) return;
            int k = y * n + x;
            Color o = px[k];
            float al = o.a;
            px[k] = new Color(Mathf.Lerp(o.r, c.r, a), Mathf.Lerp(o.g, c.g, a), Mathf.Lerp(o.b, c.b, a), al);
        }

        /// <summary>Đoạn thẳng giữa hai điểm chuẩn hoá, độ dày w (đơn vị chuẩn hoá).</summary>
        public void Seg(Vector2 a, Vector2 b, float w, Color c)
        {
            Vector2 pa = (a + Vector2.one) * 0.5f * n, pb = (b + Vector2.one) * 0.5f * n;
            float hw = w * 0.5f * n * 0.5f;
            int x0 = Mathf.FloorToInt(Mathf.Min(pa.x, pb.x) - hw - 2), x1 = Mathf.CeilToInt(Mathf.Max(pa.x, pb.x) + hw + 2);
            int y0 = Mathf.FloorToInt(Mathf.Min(pa.y, pb.y) - hw - 2), y1 = Mathf.CeilToInt(Mathf.Max(pa.y, pb.y) + hw + 2);
            Vector2 d = pb - pa; float L2 = Mathf.Max(1e-5f, d.sqrMagnitude);
            for (int y = y0; y <= y1; y++)
                for (int x = x0; x <= x1; x++)
                {
                    Vector2 p = new Vector2(x + 0.5f, y + 0.5f);
                    float t = Mathf.Clamp01(Vector2.Dot(p - pa, d) / L2);
                    float dist = (pa + d * t - p).magnitude;
                    Blend(x, y, c, Mathf.Clamp01(hw + 0.5f - dist));
                }
        }

        /// <summary>Vạch chia theo bán kính.</summary>
        public void Tick(float aDeg, float r0, float r1, float w, Color c) { Seg(P(aDeg, r0), P(aDeg, r1), w, c); }

        /// <summary>Nhiều vạch đều nhau từ a0 tới a1.</summary>
        public void Ticks(float a0, float a1, int count, float r0, float r1, float w, Color c)
        {
            for (int i = 0; i <= count; i++) Tick(Mathf.Lerp(a0, a1, i / (float)count), r0, r1, w, c);
        }

        /// <summary>Cung màu (vành khuyên) từ góc a0 tới a1.</summary>
        public void Arc(float a0, float a1, float r0, float r1, Color c)
        {
            float lo = Mathf.Min(a0, a1), hi = Mathf.Max(a0, a1);
            for (int y = 0; y < n; y++)
                for (int x = 0; x < n; x++)
                {
                    float u = (x + 0.5f) / n * 2 - 1, v = (y + 0.5f) / n * 2 - 1;
                    float r = Mathf.Sqrt(u * u + v * v);
                    if (r < r0 - 0.02f || r > r1 + 0.02f) continue;
                    float a = Mathf.Atan2(u, v) * Mathf.Rad2Deg;
                    // đưa a vào khoảng gần [lo, hi]
                    while (a < lo - 180) a += 360;
                    while (a > lo + 180) a -= 360;
                    if (a < lo - 1 || a > hi + 1) continue;
                    float px1 = 0.5f * n;
                    float edge = Mathf.Min((r - r0) * px1, (r1 - r) * px1, (a - lo) * Mathf.Deg2Rad * r * px1, (hi - a) * Mathf.Deg2Rad * r * px1);
                    Blend(x, y, c, Mathf.Clamp01(edge + 0.5f));
                }
        }

        /// <summary>Hình tròn đặc.</summary>
        public void Disc(Vector2 cen, float r, Color c)
        {
            Vector2 pc = (cen + Vector2.one) * 0.5f * n; float pr = r * 0.5f * n;
            for (int y = (int)(pc.y - pr - 2); y <= pc.y + pr + 2; y++)
                for (int x = (int)(pc.x - pr - 2); x <= pc.x + pr + 2; x++)
                    Blend(x, y, c, Mathf.Clamp01(pr + 0.5f - (new Vector2(x + 0.5f, y + 0.5f) - pc).magnitude));
        }

        /// <summary>Hình chữ nhật đặc (toạ độ chuẩn hoá).</summary>
        public void Box(float x0, float y0, float x1, float y1, Color c) { Seg(new Vector2(x0, (y0 + y1) / 2), new Vector2(x1, (y0 + y1) / 2), Mathf.Abs(y1 - y0), c); }

        public Texture2D Done(bool alpha = true)
        {
            var t = new Texture2D(n, n, TextureFormat.RGBA32, true);
            t.wrapMode = TextureWrapMode.Clamp;
            t.anisoLevel = 4;
            t.SetPixels(px);
            t.Apply(true);
            return t;
        }
    }

    /// <summary>Dựng các phần của một đồng hồ tròn trên bảng.</summary>
    public static class GaugeKit
    {
        public static readonly Color FaceBlack = new Color(0.055f, 0.058f, 0.062f);
        public static readonly Color Ink = new Color(0.93f, 0.93f, 0.9f);
        public static readonly Color Green = new Color(0.1f, 0.75f, 0.25f), Yellow = new Color(0.95f, 0.8f, 0.1f), Red = new Color(0.9f, 0.12f, 0.08f), WhiteArc = new Color(0.92f, 0.92f, 0.92f);
        static Mesh needleMesh, quadMesh;
        static Material bezelMat, glassMat, needleMat, orangeMat;
        public static int Layer = 30;
        public static readonly List<Material> FaceMats = new List<Material>();

        public static Material BezelMat { get { if (bezelMat == null) bezelMat = ProcMesh.Mat(new Color(0.09f, 0.09f, 0.1f), 0.55f, 0.3f); return bezelMat; } }
        public static Material NeedleMat
        {
            get
            {
                if (needleMat == null) { needleMat = ProcMesh.Mat(new Color(0.95f, 0.95f, 0.92f), 0.4f); needleMat.EnableKeyword("_EMISSION"); needleMat.SetColor("_EmissionColor", new Color(0.2f, 0.2f, 0.19f)); FaceMats.Add(needleMat); }
                return needleMat;
            }
        }
        public static Material OrangeMat
        {
            get
            {
                if (orangeMat == null) { orangeMat = ProcMesh.Mat(new Color(1f, 0.55f, 0.1f), 0.4f); orangeMat.EnableKeyword("_EMISSION"); orangeMat.SetColor("_EmissionColor", new Color(0.3f, 0.14f, 0.02f)); }
                return orangeMat;
            }
        }
        public static Material GlassMat { get { if (glassMat == null) glassMat = ProcMesh.Glass(new Color(0.6f, 0.7f, 0.75f, 0.06f), 0.97f); return glassMat; } }

        public static Mesh Quad
        {
            get
            {
                if (quadMesh == null)
                {
                    var go = GameObject.CreatePrimitive(PrimitiveType.Quad);
                    quadMesh = go.GetComponent<MeshFilter>().sharedMesh;
                    Object.DestroyImmediate(go);
                }
                return quadMesh;
            }
        }

        /// <summary>Kim thon dài 1 (hướng +y), gốc tại 0, có đuôi ngắn.</summary>
        public static Mesh NeedleMesh
        {
            get
            {
                if (needleMesh == null)
                {
                    var v = new[] { new Vector3(-0.06f, -0.22f, 0), new Vector3(0.06f, -0.22f, 0), new Vector3(0.035f, 0.82f, 0), new Vector3(0, 1f, 0), new Vector3(-0.035f, 0.82f, 0) };
                    // mặt trước hướng -z (về phi công): thứ tự theo chiều kim đồng hồ khi nhìn từ -z
                    var idx = new[] { 0, 4, 1, 1, 4, 2, 2, 4, 3 };
                    needleMesh = new Mesh { vertices = v, triangles = idx };
                    needleMesh.RecalculateNormals(); needleMesh.RecalculateBounds();
                    var nn = needleMesh.normals;
                    if (nn[0].z > 0) { needleMesh.triangles = new[] { 0, 1, 4, 1, 2, 4, 2, 3, 4 }; needleMesh.RecalculateNormals(); }
                }
                return needleMesh;
            }
        }

        public static GameObject Child(string name, Transform parent, Vector3 pos)
        {
            var go = new GameObject(name);
            go.layer = Layer;
            go.transform.SetParent(parent, false);
            go.transform.localPosition = pos;
            return go;
        }

        public static GameObject QuadObj(string name, Transform parent, Vector3 pos, Vector2 size, Material mat)
        {
            var go = Child(name, parent, pos);
            go.transform.localScale = new Vector3(size.x, size.y, 1);
            go.AddComponent<MeshFilter>().sharedMesh = Quad;
            var mr = go.AddComponent<MeshRenderer>();
            mr.sharedMaterial = mat;
            mr.shadowCastingMode = UnityEngine.Rendering.ShadowCastingMode.Off;
            return go;
        }

        /// <summary>Vật liệu mặt số có phát sáng nhẹ (đọc được trong bóng râm), sáng hơn khi bật đèn bảng.</summary>
        public static Material FaceMat(Texture2D tex, bool cutout = false)
        {
            var m = ProcMesh.Mat(Color.white, 0.25f);
            m.mainTexture = tex;
            m.EnableKeyword("_EMISSION");
            m.SetTexture("_EmissionMap", tex);
            m.SetColor("_EmissionColor", new Color(0.16f, 0.16f, 0.16f));
            if (cutout)
            {
                m.SetFloat("_Mode", 1);
                m.SetFloat("_Cutoff", 0.5f);
                m.EnableKeyword("_ALPHATEST_ON");
                m.renderQueue = 2450;
            }
            FaceMats.Add(m);
            return m;
        }

        /// <summary>Gốc đồng hồ tròn: mặt số, viền, kính. Trả về Transform gốc (tâm mặt số, z=0 là mặt bảng).</summary>
        public static Transform Round(Transform panel, string name, Vector2 pos, float d, Texture2D face)
        {
            var g = Child(name, panel, new Vector3(pos.x, pos.y, 0)).transform;
            var housing = ProcMesh.Prim(PrimitiveType.Cylinder, g, new Vector3(0, 0, -0.004f), new Vector3(d * 1.08f, 0.004f, d * 1.08f), BezelMat);
            housing.transform.localRotation = Quaternion.Euler(90, 0, 0);
            housing.layer = Layer;
            QuadObj("Mat", g, new Vector3(0, 0, -0.0085f), new Vector2(d, d), FaceMat(face, true));
            var ring = new List<Vector3>();
            for (int i = 0; i <= 33; i++) { float a = i / 32f * Mathf.PI * 2; ring.Add(new Vector3(Mathf.Cos(a), Mathf.Sin(a), 0) * d * 0.51f + new Vector3(0, 0, -0.012f)); }
            var bz = ProcMesh.Obj("Vien", ProcMesh.Tube(ring, d * 0.035f, 8, 2), BezelMat, g, Vector3.zero, false);
            bz.layer = Layer;
            var glass = QuadObj("Kinh", g, new Vector3(0, 0, -0.016f), new Vector2(d * 1.02f, d * 1.02f), GlassMat);
            return g;
        }

        /// <summary>Kim quay quanh tâm đồng hồ; trả về Transform trục để xoay (Euler z = -góc).</summary>
        public static Transform Needle(Transform gauge, float len, float width, float z = -0.011f, Material mat = null)
        {
            var pivot = Child("Truc", gauge, new Vector3(0, 0, z)).transform;
            var n = Child("Kim", pivot, Vector3.zero);
            n.transform.localScale = new Vector3(width / 0.12f, len, 1);
            n.AddComponent<MeshFilter>().sharedMesh = NeedleMesh;
            var mr = n.AddComponent<MeshRenderer>();
            mr.sharedMaterial = mat ?? NeedleMat;
            mr.shadowCastingMode = UnityEngine.Rendering.ShadowCastingMode.Off;
            var cap = ProcMesh.Prim(PrimitiveType.Cylinder, pivot, new Vector3(0, 0, -0.0005f), new Vector3(width * 1.6f, 0.0015f, width * 1.6f), BezelMat);
            cap.transform.localRotation = Quaternion.Euler(90, 0, 0);
            cap.layer = Layer;
            return pivot;
        }

        public static void Set(Transform pivot, float clockwiseDeg) { pivot.localRotation = Quaternion.Euler(0, 0, -clockwiseDeg); }

        /// <summary>Số trên mặt đồng hồ (chữ 3D).</summary>
        public static TextMesh Label(Transform gauge, string s, float aDeg, float r, float d, float size, Color? c = null)
        {
            float a = aDeg * Mathf.Deg2Rad;
            var t = Text3D.Make(s, gauge, new Vector3(Mathf.Sin(a) * r * d * 0.5f, Mathf.Cos(a) * r * d * 0.5f, -0.009f), size, c ?? Ink, TextAnchor.MiddleCenter, Layer);
            return t;
        }

        public static TextMesh Text(Transform parent, string s, Vector3 pos, float size, Color c, TextAnchor anchor = TextAnchor.MiddleCenter)
        {
            return Text3D.Make(s, parent, pos, size, c, anchor, Layer);
        }
    }
}

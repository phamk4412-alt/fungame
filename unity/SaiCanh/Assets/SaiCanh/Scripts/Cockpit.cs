// Buồng lái SC-4: vỏ trong có ô kính, khung cửa, bảng đồng hồ 3D, hơn 40 công tắc/núm/cần bấm được bằng chuột.
// Chuột trái: bật / xoay theo chiều kim đồng hồ / kéo cần. Chuột phải (nhấp nhanh): ngược lại. Lăn chuột: xoay núm.
using System;
using System.Collections.Generic;
using UnityEngine;

namespace SaiCanh
{
    /// <summary>Một bộ phận bấm được trong buồng lái.</summary>
    public class CockpitControl
    {
        public string label;
        public Transform t;
        public Bounds box; // hộp chọn trong toạ độ cục bộ của t
        public Func<string> state;
        public Action<int> click; // +1 chuột trái, -1 chuột phải
        public Action<float> scroll;
        public Action<float> drag; // kéo dọc (đơn vị: phần màn hình)
        public Action press, release;
        public string hint;
    }

    public class Cockpit
    {
        public const int Layer = 30;
        public static readonly Vector3 Eye = new Vector3(-0.32f, 0.76f, 0.45f);
        public GameObject root;
        public readonly List<CockpitControl> controls = new List<CockpitControl>();
        public Action<int> onSound; // 0 công tắc, 1 núm, 2 cần
        readonly SimState S;
        AircraftSystems Sys { get { return S.sys; } }
        Transform panel;

        // kim & bộ phận chuyển động
        Transform asi, altH, altT, altTT, vsi, tach, suction, amm, clockH, clockM, clockS, fuelL, fuelR, oilT, oilP, egt, volts, ffl;
        Transform hiCard, hiBug, tcPlane, tcBall, aiRing, cdiNeedle, cdiCard, compassCard, trimPtr;
        Material aiMat;
        TextMesh kollsman, hobbs, comText, navText, xpdrText, gpsText, gpsText2, cdiFlag, flapText;
        Transform gpsIcon; Material gpsMat; GameObject gpsScreen, gpsOff;
        readonly Dictionary<string, Transform> rockers = new Dictionary<string, Transform>();
        Transform key, primer, throttle, mixture, carb, flapLever, fuelSelector, trimWheel, parkBrake;
        readonly List<Transform> yokes = new List<Transform>(), yokeWheels = new List<Transform>(), pedals = new List<Transform>();
        readonly List<KeyValuePair<Material, Func<bool>>> annunciators = new List<KeyValuePair<Material, Func<bool>>>();
        readonly List<Material> displays = new List<Material>();
        Light flood;
        float primerAnim;
        public bool keyHeld;

        Material trim, black, plastic, chrome, leather, seat, panelMat;

        public Cockpit(SimState s, Transform parent, Texture2D map)
        {
            S = s;
            GaugeKit.FaceMats.Clear(); emis.Clear();
            root = new GameObject("BuongLai");
            root.transform.SetParent(parent, false);
            trim = ProcMesh.Mat("#b9b4a8", 0.15f);
            black = ProcMesh.Mat("#18191b", 0.3f);
            plastic = ProcMesh.Mat("#8f8a80", 0.2f);
            chrome = ProcMesh.Mat("#cfd3d6", 0.85f, 1f);
            leather = ProcMesh.Mat("#2c2d30", 0.15f);
            seat = ProcMesh.Mat(Color.white, 0.05f);
            seat.mainTexture = TexGen.Ground(ProcMesh.Hex("#26304a"), ProcMesh.Hex("#323e5c"), 41, 0.12f, 40);
            seat.mainTextureScale = new Vector2(3, 3);
            panelMat = ProcMesh.Mat(Color.white, 0.2f);
            panelMat.mainTexture = TexGen.Ground(ProcMesh.Hex("#2b2d30"), ProcMesh.Hex("#34373a"), 42, 0.1f);

            Shell();
            Panel(map);
            Quadrant();
            Floor();
            SetLayer(root.transform, Layer);
        }

        static void SetLayer(Transform t, int l) { t.gameObject.layer = l; foreach (Transform c in t) SetLayer(c, l); }

        GameObject Box(Transform p, Vector3 pos, Vector3 size, Material m, Vector3? euler = null)
        {
            var g = ProcMesh.Prim(PrimitiveType.Cube, p, pos, size, m);
            if (euler.HasValue) g.transform.localRotation = Quaternion.Euler(euler.Value);
            return g;
        }

        GameObject Cyl(Transform p, Vector3 pos, float d, float len, Material m, Vector3 euler)
        {
            var g = ProcMesh.Prim(PrimitiveType.Cylinder, p, pos, new Vector3(d, len / 2, d), m);
            g.transform.localRotation = Quaternion.Euler(euler);
            return g;
        }

        CockpitControl Add(string label, Transform t, Vector3 size, Func<string> state, Action<int> click = null, Action<float> scroll = null, Action<float> drag = null, string hint = null)
        {
            var c = new CockpitControl { label = label, t = t, box = new Bounds(Vector3.zero, size), state = state, click = click, scroll = scroll, drag = drag, hint = hint };
            controls.Add(c);
            return c;
        }

        void Sound(int k) { if (onSound != null) onSound(k); }

        // ================= vỏ cabin =================
        static Vector3 ShellPoint(float zWeb, float a, float k = 0.485f)
        {
            var s = ProcMesh.SectionAt(AircraftVisual.BodyWeb, zWeb);
            float sn = Mathf.Sin(a), cs = Mathf.Cos(a);
            float x = Mathf.Sign(sn) * Mathf.Pow(Mathf.Abs(sn), 2 / s[4]) * s[1] * k;
            float y = s[3] + Mathf.Sign(cs) * Mathf.Pow(Mathf.Abs(cs), 2 / s[4]) * s[2] * k;
            return new Vector3(x, y, zWeb);
        }

        /// <summary>Điểm trên vỏ ở độ cao y (phía sd = ±1), toạ độ web.</summary>
        static Vector3 ShellAtY(float zWeb, float y, int sd)
        {
            float lo = 0, hi = Mathf.PI;
            for (int i = 0; i < 30; i++) { float m = (lo + hi) / 2; if (ShellPoint(zWeb, m).y > y) lo = m; else hi = m; }
            var p = ShellPoint(zWeb, (lo + hi) / 2);
            p.x *= sd;
            return p;
        }

        static Vector3 W2U(Vector3 w) { return new Vector3(w.x, w.y, -w.z); }

        void Shell()
        {
            var R = root.transform;
            int seg = 128, rows = 180;
            float z0 = -1.6f, z1 = 2.3f;
            var v = new List<Vector3>(); var idx = new List<int>();
            for (int j = 0; j <= rows; j++)
            {
                float z = z0 + (z1 - z0) * j / rows;
                for (int i = 0; i <= seg; i++) v.Add(W2U(ShellPoint(z, i / (float)seg * Mathf.PI * 2)));
            }
            for (int j = 0; j < rows; j++)
                for (int i = 0; i < seg; i++)
                {
                    int a = j * (seg + 1) + i, b = a + 1, c = a + seg + 1, d = c + 1;
                    Vector3 cen = (v[a] + v[d]) / 2;
                    if (AircraftVisual.IsWindow(cen.x, cen.y, -cen.z)) continue;
                    idx.Add(a); idx.Add(b); idx.Add(c); idx.Add(b); idx.Add(d); idx.Add(c);
                }
            // mặt hướng vào trong (về trục thân)
            for (int i = 0; i < idx.Count; i += 3)
            {
                Vector3 A = v[idx[i]], B = v[idx[i + 1]], C = v[idx[i + 2]];
                Vector3 n = Vector3.Cross(B - A, C - A), cen = (A + B + C) / 3;
                var s = ProcMesh.SectionAt(AircraftVisual.BodyWeb, -cen.z);
                if (Vector3.Dot(n, new Vector3(0, s[3], cen.z) - cen) < 0) { int t = idx[i + 1]; idx[i + 1] = idx[i + 2]; idx[i + 2] = t; }
            }
            var m = new Mesh { indexFormat = UnityEngine.Rendering.IndexFormat.UInt32 };
            m.SetVertices(v); m.SetTriangles(idx, 0); m.RecalculateNormals(); m.RecalculateBounds();
            ProcMesh.Obj("VoTrong", m, trim, R);
            // lớp vỏ ngoài (chỉ đổ bóng, che nắng vào cabin đúng như thân thật)
            var mo = UnityEngine.Object.Instantiate(m);
            var go = ProcMesh.Obj("VoBong", mo, trim, R);
            go.transform.localScale = new Vector3(1.03f, 1.0f, 1.0f);
            go.GetComponent<MeshRenderer>().shadowCastingMode = UnityEngine.Rendering.ShadowCastingMode.ShadowsOnly;

            // khung cửa sổ
            var frame = ProcMesh.Mat("#9d988e", 0.2f);
            const float SILL = 0.5f;
            foreach (int sd in new[] { -1, 1 })
            {
                var pa = new List<Vector3>();
                for (int i = 0; i <= 6; i++) { float t = i / 6f; pa.Add(W2U(ShellAtY(-1.5f + t * 0.58f, SILL + t * 0.7f, sd) * 0.985f)); }
                ProcMesh.Obj("TruA", ProcMesh.Tube(pa, 0.028f, 8, 6), frame, R);
                var sill = new List<Vector3>(); var top = new List<Vector3>();
                for (float z = -1.56f; z <= 1.06f; z += 0.08f)
                {
                    sill.Add(W2U(ShellAtY(z, SILL + (z > 0.3f ? 0.06f : 0), sd) * 0.99f));
                    if (z >= -0.94f) top.Add(W2U(ShellAtY(z, z > 0.3f ? 1.08f : 1.13f, sd) * 0.99f));
                }
                ProcMesh.Obj("BauCua", ProcMesh.Tube(sill, 0.034f, 8, 3), frame, R);
                ProcMesh.Obj("MepTren", ProcMesh.Tube(top, 0.03f, 8, 3), frame, R);
                foreach (float z in new[] { 0.2f, 1.05f })
                {
                    var pb = new List<Vector3>();
                    for (float y = SILL; y <= 1.131f; y += 0.1f) pb.Add(W2U(ShellAtY(z, y, sd) * 0.985f));
                    ProcMesh.Obj("TruB", ProcMesh.Tube(pb, z < 0.5f ? 0.07f : 0.03f, 8, 4), frame, R);
                }
                // tay vịn cửa
                Box(R, new Vector3(sd * 0.53f, 0.26f, 0.35f), new Vector3(0.06f, 0.05f, 0.55f), ProcMesh.Mat("#77726a", 0.15f));
                Box(R, new Vector3(sd * 0.54f, 0.36f, 0.62f), new Vector3(0.03f, 0.03f, 0.12f), chrome);
                // tấm che nắng
                var vis = Box(R, new Vector3(sd * 0.26f, 1.06f, 0.88f), new Vector3(0.34f, 0.006f, 0.16f), ProcMesh.Mat("#5b574f", 0.1f), new Vector3(-12, 0, 0));
            }
            var wtop = new List<Vector3>();
            for (int k = 0; k <= 12; k++) { float a = -0.9f + k * 0.15f; var p = ShellPoint(-0.92f, a) * 0.985f; p.z = -0.92f; wtop.Add(W2U(p)); }
            ProcMesh.Obj("MepKinh", ProcMesh.Tube(wtop, 0.03f, 8, 4), frame, R);
            Box(R, new Vector3(0, 0.92f, 1.24f), new Vector3(0.03f, 0.82f, 0.03f), trim, new Vector3(-42, 0, 0)); // trụ giữa kính
            // vách sau, trần
            var bh = Cyl(R, new Vector3(0, 0.45f, -1.7f), 1.1f, 0.02f, trim, new Vector3(90, 0, 0));
            bh.transform.localScale = new Vector3(1.1f, 0.01f, 1.45f);
            // đèn trần (đèn chiếu bảng khi bay đêm)
            var fl = new GameObject("DenBang"); fl.transform.SetParent(R, false); fl.transform.localPosition = new Vector3(0, 1.0f, 0.7f);
            flood = fl.AddComponent<Light>(); flood.type = LightType.Point; flood.range = 1.6f; flood.intensity = 0.9f; flood.color = new Color(1f, 0.78f, 0.6f); flood.enabled = false;
            flood.cullingMask = 1 << Layer;
            // la bàn từ
            var cmp = GaugeKit.Child("LaBan", R, new Vector3(0, 1.04f, 1.0f)).transform;
            Box(cmp, Vector3.zero, new Vector3(0.09f, 0.07f, 0.07f), black);
            Cyl(cmp, new Vector3(0, 0.07f, 0.02f), 0.012f, 0.08f, black, Vector3.zero);
            compassCard = GaugeKit.Child("The", cmp, new Vector3(0, -0.002f, -0.03f)).transform;
            var card = ProcMesh.Prim(PrimitiveType.Cylinder, compassCard, Vector3.zero, new Vector3(0.06f, 0.012f, 0.06f), ProcMesh.Mat("#101010", 0.3f));
            for (int d = 0; d < 360; d += 30)
            {
                string lbl = d == 0 ? "N" : d == 90 ? "E" : d == 180 ? "S" : d == 270 ? "W" : (d / 10).ToString();
                float a = d * Mathf.Deg2Rad;
                // thẻ la bàn nhìn từ phía sau: chữ E nằm bên TRÁI chữ N như la bàn thật
                var t = Text3D.Make(lbl, compassCard, new Vector3(-Mathf.Sin(a) * 0.0305f, 0, -Mathf.Cos(a) * 0.0305f), 0.009f, Color.white, TextAnchor.MiddleCenter, Layer);
                t.transform.localRotation = Quaternion.Euler(0, d, 0);
            }
            Box(cmp, new Vector3(0, -0.002f, -0.0365f), new Vector3(0.002f, 0.03f, 0.001f), ProcMesh.Emissive(new Color(1, 0.5f, 0.1f), 1));
            var cg = GaugeKit.QuadObj("Kinh", cmp, new Vector3(0, -0.002f, -0.036f), new Vector2(0.07f, 0.04f), GaugeKit.GlassMat);
        }

        // ================= bảng đồng hồ =================
        void Panel(Texture2D map)
        {
            panel = GaugeKit.Child("Bang", root.transform, new Vector3(0, 0.28f, 1.22f)).transform;
            panel.localRotation = Quaternion.Euler(6, 0, 0);
            var P = panel;
            Box(P, new Vector3(0, 0, 0.012f), new Vector3(1.14f, 0.41f, 0.024f), panelMat);
            // mái che nắng
            Box(P, new Vector3(0, 0.215f, -0.06f), new Vector3(1.12f, 0.025f, 0.2f), leather, new Vector3(-4, 0, 0));
            Cyl(P, new Vector3(0, 0.205f, -0.16f), 0.05f, 1.12f, leather, new Vector3(0, 0, 90));
            // bảng phụ dưới (cụm cần ga)
            Box(P, new Vector3(0.05f, -0.255f, 0.0f), new Vector3(0.34f, 0.11f, 0.03f), black, new Vector3(-12, 0, 0));
            Box(P, new Vector3(0, -0.29f, 0.12f), new Vector3(1.1f, 0.06f, 0.22f), black);

            SixPack();
            EngineGauges();
            Radios(map);
            Switches();
            Decor();
        }

        Texture2D StdFace(float a0, float a1, int major, int minor, float[][] arcs = null, Color? bg = null)
        {
            var f = new FacePainter(256, bg ?? GaugeKit.FaceBlack);
            if (arcs != null) foreach (var a in arcs) f.Arc(a[0], a[1], a[2], a[3], new Color(a[4], a[5], a[6]));
            f.Ticks(a0, a1, major * minor, 0.8f, 0.9f, 0.014f, GaugeKit.Ink);
            f.Ticks(a0, a1, major, 0.72f, 0.92f, 0.03f, GaugeKit.Ink);
            return f.Done();
        }

        static float[] ArcSpec(float a0, float a1, float r0, float r1, Color c) { return new[] { a0, a1, r0, r1, c.r, c.g, c.b }; }

        static float AsiAngle(double kt)
        {
            if (kt < 40) return (float)(kt / 40 * 28);
            return (float)(28 + Math.Min(kt - 40, 165) / 160 * 300);
        }

        void SixPack()
        {
            var P = panel;
            float d = 0.083f;
            // --- đồng hồ tốc độ (kt) ---
            var f = new FacePainter(256, GaugeKit.FaceBlack);
            f.Arc(AsiAngle(40), AsiAngle(85), 0.6f, 0.66f, GaugeKit.WhiteArc);
            f.Arc(AsiAngle(48), AsiAngle(129), 0.67f, 0.76f, GaugeKit.Green);
            f.Arc(AsiAngle(129), AsiAngle(163), 0.67f, 0.76f, GaugeKit.Yellow);
            f.Tick(AsiAngle(163), 0.62f, 0.92f, 0.035f, GaugeKit.Red);
            for (int k = 40; k <= 200; k += 5) f.Tick(AsiAngle(k), k % 10 == 0 ? 0.76f : 0.82f, 0.92f, k % 10 == 0 ? 0.028f : 0.014f, GaugeKit.Ink);
            var g = GaugeKit.Round(P, "TocDo", new Vector2(-0.417f, 0.11f), d, f.Done());
            for (int k = 40; k <= 200; k += 20) GaugeKit.Label(g, k.ToString(), AsiAngle(k), 0.56f, d, 0.0075f);
            GaugeKit.Text(g, "TỐC ĐỘ", new Vector3(0, 0.014f, -0.009f), 0.0045f, GaugeKit.Ink);
            GaugeKit.Text(g, "KNOTS", new Vector3(0, -0.016f, -0.009f), 0.004f, GaugeKit.Ink);
            asi = GaugeKit.Needle(g, d * 0.42f, 0.0045f);

            // --- chân trời nhân tạo ---
            var ai = GaugeKit.Child("ChanTroi", P, new Vector3(-0.32f, 0.11f, 0)).transform;
            var hs = ProcMesh.Prim(PrimitiveType.Cylinder, ai, new Vector3(0, 0, -0.004f), new Vector3(d * 1.08f, 0.004f, d * 1.08f), GaugeKit.BezelMat);
            hs.transform.localRotation = Quaternion.Euler(90, 0, 0);
            var ash = Shader.Find("SaiCanh/Attitude");
            aiMat = ash != null ? new Material(ash) : ProcMesh.Mat("#3a6aa8");
            GaugeKit.QuadObj("Cau", ai, new Vector3(0, 0, -0.0085f), new Vector2(d * 0.86f, d * 0.86f), aiMat);
            var rf = new FacePainter(256, new Color(0.1f, 0.25f, 0.5f));
            // vòng chia độ nghiêng: trong suốt ở giữa
            var ringTex = TexGen.Paint(256, 256, (u, v) =>
            {
                float x = u * 2 - 1, y = v * 2 - 1, r = Mathf.Sqrt(x * x + y * y);
                if (r > 1) return new Color(0, 0, 0, 0);
                if (r < 0.78f) return new Color(0, 0, 0, 0);
                float a = Mathf.Atan2(x, y) * Mathf.Rad2Deg;
                bool tick = false;
                foreach (float t in new[] { -60f, -30f, -20f, -10f, 0f, 10f, 20f, 30f, 60f, -45f, 45f })
                    if (Mathf.Abs(a - t) < (Mathf.Abs(t) % 30 == 0 ? 1.6f : 1.0f) && r < 0.95f) tick = true;
                Color c = y > 0 ? new Color(0.12f, 0.33f, 0.62f) : new Color(0.32f, 0.2f, 0.1f);
                if (tick) c = Color.white;
                return c;
            });
            var ringGo = GaugeKit.QuadObj("VongNghieng", ai, new Vector3(0, 0, -0.0095f), new Vector2(d, d), GaugeKit.FaceMat(ringTex, true));
            aiRing = ringGo.transform;
            // biểu tượng máy bay cố định (cam)
            var om = GaugeKit.OrangeMat;
            Box(ai, new Vector3(-0.017f, 0, -0.012f), new Vector3(0.022f, 0.0028f, 0.002f), om);
            Box(ai, new Vector3(0.017f, 0, -0.012f), new Vector3(0.022f, 0.0028f, 0.002f), om);
            Box(ai, new Vector3(0, 0, -0.012f), new Vector3(0.004f, 0.004f, 0.002f), om);
            Box(ai, new Vector3(0, 0.036f, -0.012f), new Vector3(0.003f, 0.006f, 0.002f), om); // chỉ báo nghiêng trên
            var ring = new List<Vector3>();
            for (int i = 0; i <= 33; i++) { float a = i / 32f * Mathf.PI * 2; ring.Add(new Vector3(Mathf.Cos(a), Mathf.Sin(a), 0) * d * 0.51f + new Vector3(0, 0, -0.012f)); }
            ProcMesh.Obj("Vien", ProcMesh.Tube(ring, d * 0.035f, 8, 2), GaugeKit.BezelMat, ai, Vector3.zero, false);
            GaugeKit.QuadObj("Kinh", ai, new Vector3(0, 0, -0.016f), new Vector2(d * 1.02f, d * 1.02f), GaugeKit.GlassMat);

            // --- cao độ kế ---
            f = new FacePainter(256, GaugeKit.FaceBlack);
            f.Ticks(0, 360, 50, 0.84f, 0.92f, 0.012f, GaugeKit.Ink);
            f.Ticks(0, 360, 10, 0.74f, 0.92f, 0.03f, GaugeKit.Ink);
            f.Box(0.12f, -0.12f, 0.42f, 0.06f, new Color(0.02f, 0.02f, 0.02f)); // cửa sổ Kollsman
            g = GaugeKit.Round(P, "CaoDo", new Vector2(-0.223f, 0.11f), d, f.Done());
            for (int k = 0; k < 10; k++) GaugeKit.Label(g, k.ToString(), k * 36, 0.6f, d, 0.009f);
            GaugeKit.Text(g, "CAO ĐỘ", new Vector3(0, 0.012f, -0.009f), 0.0042f, GaugeKit.Ink);
            kollsman = GaugeKit.Text(g, "29.92", new Vector3(0.0113f, -0.0012f, -0.0095f), 0.0045f, GaugeKit.Ink);
            altTT = GaugeKit.Needle(g, d * 0.45f, 0.0016f);
            altT = GaugeKit.Needle(g, d * 0.26f, 0.0062f, -0.0115f);
            altH = GaugeKit.Needle(g, d * 0.42f, 0.0042f, -0.012f);
            var baro = Cyl(g, new Vector3(-0.034f, -0.034f, -0.012f), 0.016f, 0.014f, black, new Vector3(90, 0, 0));
            Add("Núm chỉnh áp suất (Kollsman)", baro.transform, new Vector3(1.4f, 2f, 1.4f), () => Sys.baro.ToString("0.00") + " inHg (ATIS: " + S.qnh.ToString("0.00") + ")",
                dir => { Sys.baro = Math.Round(Math.Max(28.0, Math.Min(31.0, Sys.baro + dir * 0.01)), 2); Sound(1); },
                w => { Sys.baro = Math.Round(Math.Max(28.0, Math.Min(31.0, Sys.baro + w * 0.01)), 2); Sound(1); }, null, "Lăn chuột hoặc nhấp trái/phải để chỉnh");

            // --- đồng hồ rẽ & trượt ---
            f = new FacePainter(256, GaugeKit.FaceBlack);
            f.Tick(-90, 0.62f, 0.9f, 0.03f, GaugeKit.Ink); f.Tick(90, 0.62f, 0.9f, 0.03f, GaugeKit.Ink);
            f.Tick(-110, 0.62f, 0.9f, 0.03f, GaugeKit.Ink); f.Tick(110, 0.62f, 0.9f, 0.03f, GaugeKit.Ink);
            f.Arc(150, 210, 0.36f, 0.46f, new Color(0.25f, 0.25f, 0.25f)); // ống bi
            g = GaugeKit.Round(P, "ReTruot", new Vector2(-0.417f, 0.012f), d, f.Done());
            GaugeKit.Text(g, "L", new Vector3(-0.034f, -0.016f, -0.009f), 0.006f, GaugeKit.Ink);
            GaugeKit.Text(g, "R", new Vector3(0.034f, -0.016f, -0.009f), 0.006f, GaugeKit.Ink);
            GaugeKit.Text(g, "2 MIN", new Vector3(0, -0.03f, -0.009f), 0.004f, GaugeKit.Ink);
            GaugeKit.Text(g, "RẼ & TRƯỢT", new Vector3(0, 0.02f, -0.009f), 0.0042f, GaugeKit.Ink);
            tcPlane = GaugeKit.Child("MayBayNho", g, new Vector3(0, 0, -0.011f)).transform;
            Box(tcPlane, Vector3.zero, new Vector3(0.056f, 0.003f, 0.001f), GaugeKit.NeedleMat);
            Box(tcPlane, Vector3.zero, new Vector3(0.006f, 0.006f, 0.001f), GaugeKit.NeedleMat);
            Box(tcPlane, new Vector3(0, 0.006f, 0), new Vector3(0.0025f, 0.009f, 0.001f), GaugeKit.NeedleMat);
            tcBall = ProcMesh.Prim(PrimitiveType.Sphere, g, new Vector3(0, -0.017f, -0.011f), Vector3.one * 0.0065f, black).transform;

            // --- con quay hướng ---
            var hi = GaugeKit.Child("HuongConQuay", P, new Vector3(-0.32f, 0.012f, 0)).transform;
            var hsg = ProcMesh.Prim(PrimitiveType.Cylinder, hi, new Vector3(0, 0, -0.004f), new Vector3(d * 1.08f, 0.004f, d * 1.08f), GaugeKit.BezelMat);
            hsg.transform.localRotation = Quaternion.Euler(90, 0, 0);
            f = new FacePainter(256, GaugeKit.FaceBlack);
            f.Ticks(0, 360, 72, 0.84f, 0.95f, 0.012f, GaugeKit.Ink);
            f.Ticks(0, 360, 36, 0.76f, 0.95f, 0.024f, GaugeKit.Ink);
            hiCard = GaugeKit.QuadObj("The", hi, new Vector3(0, 0, -0.0085f), new Vector2(d * 0.92f, d * 0.92f), GaugeKit.FaceMat(f.Done(), true)).transform;
            for (int k = 0; k < 12; k++)
            {
                string lbl = k == 0 ? "N" : k == 3 ? "E" : k == 6 ? "S" : k == 9 ? "W" : (k * 3).ToString();
                var t = Text3D.Make(lbl, hiCard, new Vector3(Mathf.Sin(k * 30 * Mathf.Deg2Rad) * 0.31f, Mathf.Cos(k * 30 * Mathf.Deg2Rad) * 0.31f, -0.001f), 0.11f, GaugeKit.Ink, TextAnchor.MiddleCenter, Layer);
                t.transform.localRotation = Quaternion.Euler(0, 0, -k * 30);
            }
            hiBug = GaugeKit.Child("Bug", hi, new Vector3(0, 0, -0.0105f)).transform;
            Box(hiBug, new Vector3(0, d * 0.43f, 0), new Vector3(0.006f, 0.005f, 0.001f), GaugeKit.OrangeMat);
            // máy bay cố định + vạch chuẩn
            Box(hi, new Vector3(0, 0, -0.012f), new Vector3(0.003f, 0.03f, 0.001f), GaugeKit.OrangeMat);
            Box(hi, new Vector3(0, -0.004f, -0.012f), new Vector3(0.026f, 0.003f, 0.001f), GaugeKit.OrangeMat);
            Box(hi, new Vector3(0, d * 0.47f, -0.012f), new Vector3(0.0025f, 0.008f, 0.001f), GaugeKit.OrangeMat);
            ProcMesh.Obj("Vien", ProcMesh.Tube(ring, d * 0.035f, 8, 2), GaugeKit.BezelMat, hi, Vector3.zero, false);
            GaugeKit.QuadObj("Kinh", hi, new Vector3(0, 0, -0.016f), new Vector2(d * 1.02f, d * 1.02f), GaugeKit.GlassMat);
            var push = Cyl(hi, new Vector3(-0.034f, -0.034f, -0.012f), 0.015f, 0.014f, black, new Vector3(90, 0, 0));
            Add("Núm chỉnh con quay hướng (PUSH: khớp la bàn)", push.transform, new Vector3(1.4f, 2f, 1.4f),
                () => "Lệch " + Wrap180(Sys.hdgDrift).ToString("+0;-0") + "° so với la bàn",
                dir => { if (dir > 0) Sys.hdgDrift = 0; else Sys.hdgDrift -= 1; Sound(1); },
                w => { Sys.hdgDrift += w; Sound(1); }, null, "Nhấp trái để khớp với la bàn từ, lăn chuột để chỉnh tay");
            var bugK = Cyl(hi, new Vector3(0.034f, -0.034f, -0.012f), 0.015f, 0.014f, GaugeKit.OrangeMat, new Vector3(90, 0, 0));
            Add("Núm vạch hướng (HDG bug)", bugK.transform, new Vector3(1.4f, 2f, 1.4f), () => ((int)Mathf.Repeat((float)Sys.hdgBug, 360)).ToString("000") + "°",
                dir => { Sys.hdgBug = Mathf.Repeat((float)Sys.hdgBug + dir * 5, 360); Sound(1); },
                w => { Sys.hdgBug = Mathf.Repeat((float)Sys.hdgBug + w * 1, 360); Sound(1); });

            // --- tốc độ lên xuống ---
            f = new FacePainter(256, GaugeKit.FaceBlack);
            for (int k = -20; k <= 20; k++) { float a = VsiAngle(k * 100); f.Tick(a, k % 5 == 0 ? 0.74f : 0.83f, 0.92f, k % 5 == 0 ? 0.03f : 0.014f, GaugeKit.Ink); }
            g = GaugeKit.Round(P, "LenXuong", new Vector2(-0.223f, 0.012f), d, f.Done());
            foreach (int k in new[] { 0, 5, 10, 15, 20 }) { GaugeKit.Label(g, k == 0 ? "0" : (k / 5).ToString(), VsiAngle(k * 100), 0.58f, d, 0.0075f); if (k > 0) GaugeKit.Label(g, (k / 5).ToString(), VsiAngle(-k * 100), 0.58f, d, 0.0075f); }
            GaugeKit.Text(g, "LÊN", new Vector3(0.006f, 0.017f, -0.009f), 0.004f, GaugeKit.Ink);
            GaugeKit.Text(g, "XUỐNG", new Vector3(0.006f, -0.017f, -0.009f), 0.004f, GaugeKit.Ink);
            GaugeKit.Text(g, "×1000 FT/PH", new Vector3(0.012f, 0, -0.009f), 0.0034f, GaugeKit.Ink);
            vsi = GaugeKit.Needle(g, d * 0.42f, 0.0045f);
        }

        static float VsiAngle(double fpm) { return (float)(-90 + Math.Max(-2000, Math.Min(2000, fpm)) / 2000 * 170); }
        static double Wrap180(double a) { a = a % 360; if (a > 180) a -= 360; if (a < -180) a += 360; return a; }

        void SmallGauge(string name, string title, Vector2 pos, float d, float a0, float a1, string lo, string hi, float[][] arcs, out Transform needle, string[] mid = null)
        {
            var g = GaugeKit.Round(panel, name, pos, d, StdFace(a0, a1, 4, 2, arcs));
            GaugeKit.Text(g, title, new Vector3(0, -0.012f, -0.009f), 0.0042f, GaugeKit.Ink);
            GaugeKit.Label(g, lo, a0, 0.55f, d, 0.0052f);
            GaugeKit.Label(g, hi, a1, 0.55f, d, 0.0052f);
            if (mid != null) GaugeKit.Label(g, mid[0], (a0 + a1) / 2, 0.55f, d, 0.0052f);
            needle = GaugeKit.Needle(g, d * 0.4f, 0.0035f);
        }

        void EngineGauges()
        {
            var P = panel;
            float d = 0.083f;
            // vòng tua
            var f = new FacePainter(256, GaugeKit.FaceBlack);
            f.Arc(TachA(2100), TachA(2700), 0.7f, 0.8f, GaugeKit.Green);
            f.Tick(TachA(2700), 0.62f, 0.92f, 0.035f, GaugeKit.Red);
            for (int k = 0; k <= 35; k++) f.Tick(TachA(k * 100), k % 5 == 0 ? 0.74f : 0.83f, 0.92f, k % 5 == 0 ? 0.03f : 0.014f, GaugeKit.Ink);
            var g = GaugeKit.Round(P, "VongTua", new Vector2(-0.12f, 0.012f), d, f.Done());
            for (int k = 0; k <= 35; k += 5) GaugeKit.Label(g, (k / 1).ToString(), TachA(k * 100), 0.56f, d, 0.0075f);
            GaugeKit.Text(g, "VÒNG/PHÚT", new Vector3(0, 0.014f, -0.009f), 0.004f, GaugeKit.Ink);
            GaugeKit.Text(g, "×100", new Vector3(0, -0.012f, -0.009f), 0.004f, GaugeKit.Ink);
            hobbs = GaugeKit.Text(g, "01873.4", new Vector3(0, -0.022f, -0.0095f), 0.0045f, GaugeKit.Ink);
            tach = GaugeKit.Needle(g, d * 0.42f, 0.0045f);

            float s = 0.058f;
            SmallGauge("XangTrai", "XĂNG T", new Vector2(0.255f, 0.135f), s, -60, 60, "E", "F", new[] { ArcSpec(-60, -45, 0.7f, 0.8f, GaugeKit.Red) }, out fuelL, new[] { "1/2" });
            SmallGauge("XangPhai", "XĂNG P", new Vector2(0.32f, 0.135f), s, -60, 60, "E", "F", new[] { ArcSpec(-60, -45, 0.7f, 0.8f, GaugeKit.Red) }, out fuelR, new[] { "1/2" });
            SmallGauge("NhietDau", "NHIỆT DẦU", new Vector2(0.385f, 0.135f), s, -60, 60, "75", "250", new[] { ArcSpec(-40, 50, 0.7f, 0.8f, GaugeKit.Green), ArcSpec(55, 60, 0.6f, 0.9f, GaugeKit.Red) }, out oilT);
            SmallGauge("ApDau", "ÁP DẦU", new Vector2(0.45f, 0.135f), s, -60, 60, "0", "115", new[] { ArcSpec(-60, -36, 0.7f, 0.8f, GaugeKit.Red), ArcSpec(-8, 36, 0.7f, 0.8f, GaugeKit.Green), ArcSpec(55, 60, 0.6f, 0.9f, GaugeKit.Red) }, out oilP);
            SmallGauge("EGT", "EGT", new Vector2(0.255f, 0.06f), s, -60, 60, "", "", null, out egt);
            SmallGauge("Volt", "VÔN", new Vector2(0.32f, 0.06f), s, -60, 60, "16", "32", new[] { ArcSpec(-60, 15, 0.7f, 0.8f, GaugeKit.Red), ArcSpec(18, 50, 0.7f, 0.8f, GaugeKit.Green) }, out volts);
            SmallGauge("LuuLuong", "GAL/GIỜ", new Vector2(0.385f, 0.06f), s, -60, 60, "0", "19", new[] { ArcSpec(-50, 15, 0.7f, 0.8f, GaugeKit.Green) }, out ffl);
            SmallGauge("ChanKhong", "CHÂN KHÔNG", new Vector2(-0.515f, 0.04f), 0.055f, -60, 60, "3", "7", new[] { ArcSpec(-15, 15, 0.7f, 0.8f, GaugeKit.Green) }, out suction);
            SmallGauge("Ampe", "AMPE", new Vector2(-0.515f, -0.028f), 0.05f, -60, 60, "-60", "+60", null, out amm);
            // đồng hồ giờ
            f = new FacePainter(256, GaugeKit.FaceBlack);
            f.Ticks(0, 360, 60, 0.86f, 0.93f, 0.012f, GaugeKit.Ink);
            f.Ticks(0, 360, 12, 0.76f, 0.93f, 0.03f, GaugeKit.Ink);
            g = GaugeKit.Round(P, "DongHo", new Vector2(-0.515f, 0.115f), 0.058f, f.Done());
            foreach (int h in new[] { 12, 3, 6, 9 }) GaugeKit.Label(g, h.ToString(), h * 30, 0.58f, 0.058f, 0.006f);
            clockH = GaugeKit.Needle(g, 0.016f, 0.003f, -0.0105f);
            clockM = GaugeKit.Needle(g, 0.024f, 0.0022f, -0.011f);
            clockS = GaugeKit.Needle(g, 0.025f, 0.0008f, -0.0115f, GaugeKit.OrangeMat);
            // ô số Hobbs riêng
            var hb = Box(P, new Vector3(0.45f, 0.06f, -0.004f), new Vector3(0.05f, 0.022f, 0.008f), black);
            GaugeKit.Text(P, "HOBBS", new Vector3(0.45f, 0.078f, -0.009f), 0.004f, GaugeKit.Ink);
        }

        static float TachA(double rpm) { return (float)(-130 + Math.Min(3500, rpm) / 3500 * 260); }

        // ================= máy vô tuyến, GPS, đèn cảnh báo =================
        Material Display(Color c)
        {
            var m = ProcMesh.Mat(Color.black, 0.9f);
            m.EnableKeyword("_EMISSION");
            m.SetColor("_EmissionColor", c);
            emis[m] = c;
            displays.Add(m);
            return m;
        }

        void Radios(Texture2D map)
        {
            var P = panel;
            float cx = 0.06f;
            // đèn cảnh báo
            Box(P, new Vector3(cx, 0.172f, -0.003f), new Vector3(0.25f, 0.034f, 0.006f), black);
            string[] names = { "ĐIỆN THẤP", "ÁP DẦU", "CHÂN KHÔNG", "XĂNG T", "XĂNG P", "PHANH ĐỖ", "ĐỀ MÁY", "BĂNG CHK" };
            Func<bool>[] conds =
            {
                () => Sys.masterBat && Sys.busVolts < 25.5, () => Sys.oilPress < 20, () => Sys.suction < 3.5,
                () => Sys.fuelL < 5, () => Sys.fuelR < 5, () => Sys.parkingBrake, () => Sys.cranking, () => Sys.carbIce > 0.35,
            };
            for (int i = 0; i < names.Length; i++)
            {
                float x = cx - 0.105f + (i % 4) * 0.07f, y = 0.181f - (i / 4) * 0.017f;
                Color col = i < 3 ? new Color(1f, 0.15f, 0.1f) : i == 6 ? new Color(1f, 0.75f, 0.1f) : new Color(1f, 0.6f, 0.05f);
                var m = Display(col);
                Box(P, new Vector3(x, y, -0.0065f), new Vector3(0.066f, 0.014f, 0.002f), m);
                GaugeKit.Text(P, names[i], new Vector3(x, y, -0.0078f), 0.0052f, new Color(0.32f, 0.3f, 0.28f));
                var cond = conds[i];
                annunciators.Add(new KeyValuePair<Material, Func<bool>>(m, () => (S.annTest || cond()) && Sys.ElecPower));
            }

            // COM / NAV
            Box(P, new Vector3(cx, 0.115f, -0.004f), new Vector3(0.25f, 0.066f, 0.008f), ProcMesh.Mat("#202224", 0.4f));
            Box(P, new Vector3(cx - 0.02f, 0.127f, -0.0085f), new Vector3(0.17f, 0.018f, 0.001f), ProcMesh.Mat("#050806", 0.9f));
            Box(P, new Vector3(cx - 0.02f, 0.101f, -0.0085f), new Vector3(0.17f, 0.018f, 0.001f), ProcMesh.Mat("#050806", 0.9f));
            comText = GaugeKit.Text(P, "", new Vector3(cx - 0.02f, 0.127f, -0.0095f), 0.0105f, new Color(0.45f, 1f, 0.5f));
            navText = GaugeKit.Text(P, "", new Vector3(cx - 0.02f, 0.101f, -0.0095f), 0.0105f, new Color(0.45f, 1f, 0.5f));
            GaugeKit.Text(P, "COM", new Vector3(cx - 0.115f, 0.127f, -0.0095f), 0.0045f, GaugeKit.Ink);
            GaugeKit.Text(P, "NAV", new Vector3(cx - 0.115f, 0.101f, -0.0095f), 0.0045f, GaugeKit.Ink);
            // nút đổi tần số + núm
            foreach (int row in new[] { 0, 1 })
            {
                float y = row == 0 ? 0.127f : 0.101f;
                bool com = row == 0;
                var sw = Box(P, new Vector3(cx + 0.077f, y, -0.01f), new Vector3(0.014f, 0.009f, 0.006f), ProcMesh.Mat("#3a3c3f", 0.3f));
                GaugeKit.Text(P, "⇆", new Vector3(cx + 0.077f, y, -0.0135f), 0.007f, GaugeKit.Ink);
                Add(com ? "Nút đổi tần số COM" : "Nút đổi tần số NAV", sw.transform, Vector3.one * 1.3f,
                    () => com ? "Đang dùng " + S.comActive.ToString("0.000") + " — chờ " + S.comStby.ToString("0.000") : "Đang dùng " + S.navActive.ToString("0.00") + " — chờ " + S.navStby.ToString("0.00"),
                    dir => { if (com) { var t = S.comActive; S.comActive = S.comStby; S.comStby = t; } else { var t = S.navActive; S.navActive = S.navStby; S.navStby = t; } Sound(0); });
                var outer = Cyl(P, new Vector3(cx + 0.105f, y, -0.012f), 0.02f, 0.01f, black, new Vector3(90, 0, 0));
                var inner = Cyl(P, new Vector3(cx + 0.105f, y, -0.018f), 0.012f, 0.008f, ProcMesh.Mat("#2a2a2a", 0.4f), new Vector3(90, 0, 0));
                Action<int, bool> tune = (dirn, big) =>
                {
                    if (com)
                    {
                        double f = S.comStby + dirn * (big ? 1 : 0.025);
                        if (f < 118) f += 19; if (f > 136.99) f -= 19;
                        S.comStby = Math.Round(f / 0.025) * 0.025;
                    }
                    else
                    {
                        double f = S.navStby + dirn * (big ? 1 : 0.05);
                        if (f < 108) f += 10; if (f > 117.95) f -= 10;
                        S.navStby = Math.Round(f / 0.05) * 0.05;
                    }
                    Sound(1);
                };
                Add(com ? "Núm COM (MHz)" : "Núm NAV (MHz)", outer.transform, new Vector3(1.1f, 2f, 1.1f), () => com ? S.comStby.ToString("0.000") : S.navStby.ToString("0.00"), dir => tune(dir, true), w => tune(w > 0 ? 1 : -1, true));
                Add(com ? "Núm COM (kHz)" : "Núm NAV (kHz)", inner.transform, new Vector3(1.3f, 2f, 1.3f), () => com ? S.comStby.ToString("0.000") : S.navStby.ToString("0.00"), dir => tune(dir, false), w => tune(w > 0 ? 1 : -1, false));
            }

            // GPS
            Box(P, new Vector3(cx, 0.03f, -0.004f), new Vector3(0.25f, 0.095f, 0.008f), ProcMesh.Mat("#1b1c1e", 0.4f));
            gpsMat = new Material(Shader.Find("Unlit/Texture") ?? ProcMesh.Std);
            gpsMat.mainTexture = map;
            gpsScreen = GaugeKit.QuadObj("BanDo", P, new Vector3(cx - 0.03f, 0.03f, -0.0087f), new Vector2(0.12f, 0.08f), gpsMat);
            gpsOff = GaugeKit.QuadObj("TatMan", P, new Vector3(cx - 0.03f, 0.03f, -0.0088f), new Vector2(0.12f, 0.08f), ProcMesh.Mat("#030405", 0.9f));
            gpsIcon = GaugeKit.Child("MayBay", P, new Vector3(cx - 0.03f, 0.03f, -0.0095f)).transform;
            var tri = new Mesh { vertices = new[] { new Vector3(0, 0.006f, 0), new Vector3(0.0035f, -0.004f, 0), new Vector3(-0.0035f, -0.004f, 0) }, triangles = new[] { 0, 1, 2 } };
            tri.RecalculateNormals(); if (tri.normals[0].z > 0) tri.triangles = new[] { 0, 2, 1 }; tri.RecalculateNormals();
            ProcMesh.Obj("Tam", tri, ProcMesh.Emissive(new Color(1f, 0.6f, 0.1f), 2), gpsIcon, Vector3.zero, false);
            gpsText = GaugeKit.Text(P, "", new Vector3(cx + 0.034f, 0.063f, -0.0095f), 0.0052f, new Color(0.7f, 1f, 0.8f), TextAnchor.UpperLeft);
            gpsText2 = GaugeKit.Text(P, "", new Vector3(cx - 0.088f, 0.066f, -0.0095f), 0.0046f, new Color(1f, 1f, 1f), TextAnchor.UpperLeft);
            Box(P, new Vector3(cx + 0.065f, 0.03f, -0.0086f), new Vector3(0.11f, 0.08f, 0.001f), ProcMesh.Mat("#050806", 0.9f));
            foreach (int k in new[] { -1, 1 })
            {
                var b = Box(P, new Vector3(cx + 0.045f + k * 0.022f, -0.006f, -0.01f), new Vector3(0.016f, 0.009f, 0.005f), ProcMesh.Mat("#3a3c3f", 0.3f));
                GaugeKit.Text(P, k < 0 ? "−" : "+", new Vector3(cx + 0.045f + k * 0.022f, -0.006f, -0.013f), 0.008f, GaugeKit.Ink);
                int kk = k;
                Add(k < 0 ? "GPS: thu nhỏ bản đồ" : "GPS: phóng to bản đồ", b.transform, Vector3.one * 1.3f, () => "Tầm " + new[] { "2", "5", "12" }[S.gpsZoom] + " km",
                    dir => { S.gpsZoom = Mathf.Clamp(S.gpsZoom - kk, 0, 2); Sound(0); });
            }

            // bộ phát đáp
            Box(P, new Vector3(cx, -0.045f, -0.004f), new Vector3(0.25f, 0.04f, 0.008f), ProcMesh.Mat("#202224", 0.4f));
            Box(P, new Vector3(cx - 0.02f, -0.045f, -0.0085f), new Vector3(0.12f, 0.018f, 0.001f), ProcMesh.Mat("#050806", 0.9f));
            xpdrText = GaugeKit.Text(P, "", new Vector3(cx - 0.02f, -0.045f, -0.0095f), 0.0085f, new Color(1f, 0.72f, 0.3f));
            GaugeKit.Text(P, "XPDR", new Vector3(cx - 0.11f, -0.045f, -0.0095f), 0.0045f, GaugeKit.Ink);
            var mode = Cyl(P, new Vector3(cx + 0.095f, -0.045f, -0.012f), 0.018f, 0.01f, black, new Vector3(90, 0, 0));
            string[] modes = { "TẮT", "CHỜ", "BẬT", "ALT" };
            Add("Núm chế độ bộ phát đáp", mode.transform, new Vector3(1.2f, 2f, 1.2f), () => modes[Sys.xpdrMode],
                dir => { Sys.xpdrMode = Mathf.Clamp(Sys.xpdrMode + dir, 0, 3); Sound(1); }, w => { Sys.xpdrMode = Mathf.Clamp(Sys.xpdrMode + (w > 0 ? 1 : -1), 0, 3); Sound(1); });
            for (int dgt = 0; dgt < 4; dgt++)
            {
                int pos = 3 - dgt;
                var b = Box(P, new Vector3(cx - 0.047f + dgt * 0.018f, -0.06f, -0.01f), new Vector3(0.012f, 0.006f, 0.005f), ProcMesh.Mat("#3a3c3f", 0.3f));
                Add("Mã squawk — chữ số " + (dgt + 1), b.transform, Vector3.one * 1.4f, () => Sys.squawk.ToString("0000"),
                    dir => { Sys.squawk = SquawkDigit(Sys.squawk, pos, dir); Sound(0); }, w => { Sys.squawk = SquawkDigit(Sys.squawk, pos, w > 0 ? 1 : -1); Sound(0); });
            }

            // VOR / CDI
            var g = GaugeKit.Child("VOR", P, new Vector3(-0.12f, 0.11f, 0)).transform;
            float d = 0.083f;
            var hs = ProcMesh.Prim(PrimitiveType.Cylinder, g, new Vector3(0, 0, -0.004f), new Vector3(d * 1.08f, 0.004f, d * 1.08f), GaugeKit.BezelMat);
            hs.transform.localRotation = Quaternion.Euler(90, 0, 0);
            var ff = new FacePainter(256, GaugeKit.FaceBlack);
            ff.Ticks(0, 360, 72, 0.84f, 0.95f, 0.012f, GaugeKit.Ink);
            ff.Ticks(0, 360, 36, 0.78f, 0.95f, 0.024f, GaugeKit.Ink);
            cdiCard = GaugeKit.QuadObj("The", g, new Vector3(0, 0, -0.0085f), new Vector2(d * 0.98f, d * 0.98f), GaugeKit.FaceMat(ff.Done(), true)).transform;
            for (int k = 0; k < 12; k++)
            {
                var t = Text3D.Make(k == 0 ? "N" : k == 3 ? "E" : k == 6 ? "S" : k == 9 ? "W" : (k * 3).ToString(), cdiCard, new Vector3(Mathf.Sin(k * 30 * Mathf.Deg2Rad) * 0.33f, Mathf.Cos(k * 30 * Mathf.Deg2Rad) * 0.33f, -0.001f), 0.1f, GaugeKit.Ink, TextAnchor.MiddleCenter, Layer);
                t.transform.localRotation = Quaternion.Euler(0, 0, -k * 30);
            }
            var dots = new FacePainter(256, new Color(0, 0, 0, 0));
            var dotTex = TexGen.Paint(256, 64, (u, v) =>
            {
                float x = u * 2 - 1, y = v * 2 - 1;
                for (int k = -5; k <= 5; k++) { if (k == 0) continue; float dx = x - k * 0.18f; if (dx * dx + y * y * 0.0625f * 16 < 0.0016f) return Color.white; }
                return new Color(0, 0, 0, 0);
            });
            GaugeKit.QuadObj("Cham", g, new Vector3(0, 0, -0.0092f), new Vector2(d * 0.7f, d * 0.175f), GaugeKit.FaceMat(dotTex, true));
            cdiNeedle = GaugeKit.Child("KimCDI", g, new Vector3(0, 0, -0.011f)).transform;
            Box(cdiNeedle, Vector3.zero, new Vector3(0.0022f, d * 0.62f, 0.0008f), GaugeKit.NeedleMat);
            cdiFlag = GaugeKit.Text(g, "OFF", new Vector3(0.017f, 0.012f, -0.0115f), 0.006f, new Color(1, 0.3f, 0.2f));
            Box(g, new Vector3(0, d * 0.47f, -0.012f), new Vector3(0.0025f, 0.008f, 0.001f), GaugeKit.OrangeMat);
            var ring = new List<Vector3>();
            for (int i = 0; i <= 33; i++) { float a = i / 32f * Mathf.PI * 2; ring.Add(new Vector3(Mathf.Cos(a), Mathf.Sin(a), 0) * d * 0.51f + new Vector3(0, 0, -0.012f)); }
            ProcMesh.Obj("Vien", ProcMesh.Tube(ring, d * 0.035f, 8, 2), GaugeKit.BezelMat, g, Vector3.zero, false);
            GaugeKit.QuadObj("Kinh", g, new Vector3(0, 0, -0.016f), new Vector2(d * 1.02f, d * 1.02f), GaugeKit.GlassMat);
            var obs = Cyl(g, new Vector3(-0.034f, -0.034f, -0.012f), 0.016f, 0.014f, black, new Vector3(90, 0, 0));
            Add("Núm OBS (chọn hướng bay theo đài VOR)", obs.transform, new Vector3(1.4f, 2f, 1.4f), () => ((int)S.obs).ToString("000") + "°",
                dir => { S.obs = Mathf.Repeat((float)S.obs + dir * 5, 360); Sound(1); }, w => { S.obs = Mathf.Repeat((float)S.obs + w, 360); Sound(1); });
        }

        static int SquawkDigit(int code, int pos, int dir)
        {
            int[] dg = { code / 1000 % 10, code / 100 % 10, code / 10 % 10, code % 10 };
            int i = 3 - pos;
            dg[i] = (dg[i] + dir + 8) % 8;
            return dg[0] * 1000 + dg[1] * 100 + dg[2] * 10 + dg[3];
        }

        // ================= công tắc =================
        Transform Rocker(string id, string label, Vector2 pos, Func<bool> get, Action<bool> set, Material paddle = null, float w = 0.014f)
        {
            var P = panel;
            Box(P, new Vector3(pos.x, pos.y, -0.003f), new Vector3(w + 0.006f, 0.03f, 0.006f), black);
            var piv = GaugeKit.Child("CongTac_" + id, P, new Vector3(pos.x, pos.y, -0.006f)).transform;
            Box(piv, new Vector3(0, 0, -0.004f), new Vector3(w, 0.024f, 0.008f), paddle ?? ProcMesh.Mat("#ececec", 0.4f));
            Box(piv, new Vector3(0, 0.008f, -0.0085f), new Vector3(w * 0.9f, 0.003f, 0.001f), ProcMesh.Mat("#a0a0a0", 0.3f));
            GaugeKit.Text(P, label, new Vector3(pos.x, pos.y + 0.024f, -0.007f), 0.0043f, GaugeKit.Ink);
            rockers[id] = piv;
            Add(label.Replace("\n", " "), piv, new Vector3(w + 0.006f, 0.032f, 0.02f), () => get() ? "BẬT" : "TẮT",
                dir => { set(!get()); Sound(0); });
            return piv;
        }

        void Switches()
        {
            var P = panel;
            var red = ProcMesh.Mat("#b3241c", 0.4f);
            float y = -0.16f;
            Rocker("alt", "ALT", new Vector2(-0.47f, y), () => Sys.masterAlt, v => Sys.masterAlt = v, red, 0.012f);
            Rocker("bat", "BAT", new Vector2(-0.452f, y), () => Sys.masterBat, v => { Sys.masterBat = v; if (!v) Sys.masterAlt = false; }, red, 0.012f);
            GaugeKit.Text(P, "MASTER", new Vector3(-0.461f, y - 0.025f, -0.007f), 0.004f, GaugeKit.Ink);
            string[] ids = { "pump", "beacon", "land", "taxi", "nav", "strobe", "pitot", "panel" };
            string[] lbl = { "BƠM\nXĂNG", "ĐÈN\nHIỆU", "ĐÈN\nĐÁP", "ĐÈN\nLĂN", "ĐÈN\nHH", "ĐÈN\nCHỚP", "SẤY\nPITOT", "ĐÈN\nBẢNG" };
            Func<bool>[] gets = { () => Sys.fuelPump, () => Sys.beacon, () => Sys.landLight, () => Sys.taxiLight, () => Sys.navLight, () => Sys.strobe, () => Sys.pitotHeat, () => Sys.panelLight };
            Action<bool>[] sets = { v => Sys.fuelPump = v, v => Sys.beacon = v, v => Sys.landLight = v, v => Sys.taxiLight = v, v => Sys.navLight = v, v => Sys.strobe = v, v => Sys.pitotHeat = v, v => Sys.panelLight = v };
            for (int i = 0; i < ids.Length; i++) Rocker(ids[i], lbl[i], new Vector2(-0.4f + i * 0.036f, y), gets[i], sets[i]);
            // thanh cầu chì nằm dưới hàng công tắc
            Box(P, new Vector3(-0.27f, y - 0.03f, -0.002f), new Vector3(0.3f, 0.004f, 0.004f), ProcMesh.Mat("#555555", 0.3f));
            Rocker("avionics", "ĐIỆN TỬ", new Vector2(0.0f, -0.105f), () => Sys.avionics, v => Sys.avionics = v, ProcMesh.Mat("#2a5fae", 0.4f), 0.018f);
            // nút thử đèn cảnh báo
            var tb = Box(P, new Vector3(0.16f, -0.105f, -0.007f), new Vector3(0.012f, 0.012f, 0.008f), ProcMesh.Mat("#3a3c3f", 0.3f));
            GaugeKit.Text(P, "THỬ ĐÈN", new Vector3(0.16f, -0.088f, -0.007f), 0.0042f, GaugeKit.Ink);
            var tc = Add("Nút thử đèn cảnh báo", tb.transform, Vector3.one * 1.4f, () => S.annTest ? "Đang thử" : "Giữ để thử", null);
            tc.press = () => { S.annTest = true; Sound(0); };
            tc.release = () => S.annTest = false;

            // khoá điện (từ trường)
            var kb = Cyl(P, new Vector3(-0.515f, -0.095f, -0.004f), 0.036f, 0.008f, chrome, new Vector3(90, 0, 0));
            key = GaugeKit.Child("ChiaKhoa", P, new Vector3(-0.515f, -0.095f, -0.012f)).transform;
            Cyl(key, Vector3.zero, 0.016f, 0.012f, black, new Vector3(90, 0, 0));
            Box(key, new Vector3(0, 0.006f, -0.012f), new Vector3(0.006f, 0.026f, 0.004f), ProcMesh.Mat("#c8c8c0", 0.7f, 0.8f));
            Box(key, new Vector3(0, 0.017f, -0.012f), new Vector3(0.018f, 0.014f, 0.003f), ProcMesh.Mat("#202020", 0.3f));
            string[] mags = { "OFF", "R", "L", "BOTH", "START" };
            for (int i = 0; i < 5; i++)
            {
                float a = (-60 + i * 30) * Mathf.Deg2Rad;
                GaugeKit.Text(P, mags[i], new Vector3(-0.515f + Mathf.Sin(a) * 0.03f, -0.095f + Mathf.Cos(a) * 0.03f, -0.007f), 0.0042f, i == 4 ? new Color(1, 0.6f, 0.3f) : GaugeKit.Ink);
            }
            var kc = Add("Khoá từ trường / Đề máy", key, new Vector3(0.04f, 0.045f, 0.03f),
                () => mags[(int)Sys.mag] + (Sys.mag == Mag.Both ? " — giữ chuột trái để ĐỀ MÁY" : ""),
                dir =>
                {
                    if (dir < 0 && (int)Sys.mag > 0) { Sys.mag = (Mag)((int)Sys.mag - 1); Sound(1); }
                    else if (dir > 0 && (int)Sys.mag < 3) { Sys.mag = (Mag)((int)Sys.mag + 1); Sound(1); }
                }, null, null, "Nhấp trái: xoay phải, nhấp phải: xoay trái. Ở BOTH giữ chuột trái để đề");
            kc.press = () => { if (Sys.mag == Mag.Both) { Sys.mag = Mag.Start; keyHeld = true; Sound(1); } };
            kc.release = () => { if (Sys.mag == Mag.Start) { Sys.mag = Mag.Both; } keyHeld = false; };

            // bơm mồi
            Cyl(P, new Vector3(-0.515f, -0.165f, -0.004f), 0.022f, 0.008f, chrome, new Vector3(90, 0, 0));
            primer = GaugeKit.Child("BomMoi", P, new Vector3(-0.515f, -0.165f, -0.008f)).transform;
            Cyl(primer, new Vector3(0, 0, -0.01f), 0.006f, 0.02f, chrome, new Vector3(90, 0, 0));
            Cyl(primer, new Vector3(0, 0, -0.022f), 0.02f, 0.012f, black, new Vector3(90, 0, 0));
            GaugeKit.Text(P, "BƠM MỒI", new Vector3(-0.515f, -0.142f, -0.007f), 0.0042f, GaugeKit.Ink);
            Add("Bơm mồi (primer)", primer, new Vector3(0.024f, 0.024f, 0.03f), () => "Đã bơm " + Sys.primeCount + " lần",
                dir => { if (primerAnim <= 0) { primerAnim = 1; Sys.Prime(); Sound(2); } }, null, null, "Mỗi lần nhấp = kéo ra và đẩy vào một lần. Máy nguội: 2–3 lần");

            // phanh đỗ (tay kéo chữ T dưới bảng)
            parkBrake = GaugeKit.Child("PhanhDo", root.transform, new Vector3(-0.5f, 0.03f, 1.14f)).transform;
            Cyl(parkBrake, new Vector3(0, 0, 0.03f), 0.008f, 0.06f, chrome, new Vector3(90, 0, 0));
            Box(parkBrake, new Vector3(0, 0, -0.002f), new Vector3(0.07f, 0.014f, 0.016f), red);
            GaugeKit.Text(parkBrake, "PHANH ĐỖ", new Vector3(0, 0.016f, -0.01f), 0.0055f, GaugeKit.Ink);
            Add("Phanh đỗ", parkBrake, new Vector3(0.08f, 0.03f, 0.03f), () => Sys.parkingBrake ? "KÉO (đang hãm)" : "NHẢ",
                dir => { Sys.parkingBrake = !Sys.parkingBrake; Sound(2); });
        }

        // ================= cụm cần ga, cánh tà, cần lái =================
        Transform Plunger(string name, Vector3 pos, Material knobMat, float knobD, string label, bool ridged)
        {
            var P = panel;
            Cyl(P, new Vector3(pos.x, pos.y, pos.z + 0.002f), knobD * 0.9f, 0.006f, chrome, new Vector3(90, 0, 0));
            var t = GaugeKit.Child(name, P, pos).transform;
            Cyl(t, new Vector3(0, 0, -0.04f), 0.007f, 0.08f, chrome, new Vector3(90, 0, 0));
            var k = Cyl(t, new Vector3(0, 0, -0.085f), knobD, 0.022f, knobMat, new Vector3(90, 0, 0));
            if (ridged) for (int i = 0; i < 10; i++) { float a = i / 10f * Mathf.PI * 2; Box(t, new Vector3(Mathf.Cos(a) * knobD * 0.5f, Mathf.Sin(a) * knobD * 0.5f, -0.085f), new Vector3(0.002f, 0.002f, 0.02f), knobMat); }
            GaugeKit.Text(P, label, new Vector3(pos.x, pos.y - 0.028f, pos.z - 0.004f), 0.0045f, GaugeKit.Ink);
            return t;
        }

        void Quadrant()
        {
            var P = panel;
            float y = -0.245f;
            carb = Plunger("SayCHK", new Vector3(-0.06f, y, -0.012f), ProcMesh.Mat("#777777", 0.3f), 0.022f, "SẤY CHK", false);
            throttle = Plunger("CanGa", new Vector3(0.0f, y, -0.012f), ProcMesh.Mat("#111111", 0.4f), 0.028f, "GA", false);
            mixture = Plunger("HonHop", new Vector3(0.06f, y, -0.012f), ProcMesh.Mat("#b01010", 0.4f), 0.024f, "HỖN HỢP", true);
            Add("Sấy chế hoà khí", carb, new Vector3(0.026f, 0.026f, 0.2f), () => Sys.carbHeat > 0.5 ? "BẬT (kéo ra)" : "TẮT",
                dir => { Sys.carbHeat = Sys.carbHeat > 0.5 ? 0 : 1; Sound(2); }, null, null, "Bật trước khi giảm ga xuống thấp (hạ độ cao, hạ cánh)").box.center = new Vector3(0, 0, -0.08f);
            var th = Add("Cần ga", throttle, new Vector3(0.03f, 0.03f, 0.2f), () => (Sys.throttle * 100).ToString("0") + "%  (" + Sys.rpm.ToString("0") + " v/ph)",
                dir => { Sys.throttle = Mathf.Clamp01((float)Sys.throttle + dir * 0.05f); Sound(2); },
                w => Sys.throttle = Mathf.Clamp01((float)Sys.throttle + w * 0.03f),
                dy => Sys.throttle = Mathf.Clamp01((float)Sys.throttle + dy * 1.5f), "Kéo chuột lên/xuống hoặc lăn chuột. Phím Q/E");
            th.box.center = new Vector3(0, 0, -0.08f);
            var mx = Add("Cần hỗn hợp", mixture, new Vector3(0.028f, 0.028f, 0.2f), () => Sys.mixture < 0.12 ? "CẮT (ngắt nhiên liệu)" : Sys.mixture > 0.97 ? "GIÀU" : (Sys.mixture * 100).ToString("0") + "%",
                dir => { Sys.mixture = Mathf.Clamp01((float)Sys.mixture + dir * 0.05f); Sound(2); },
                w => Sys.mixture = Mathf.Clamp01((float)Sys.mixture + w * 0.03f),
                dy => Sys.mixture = Mathf.Clamp01((float)Sys.mixture + dy * 1.5f), "Đẩy hết vào = GIÀU, kéo hết ra = CẮT (tắt máy)");
            mx.box.center = new Vector3(0, 0, -0.08f);

            // cần cánh tà
            Box(P, new Vector3(0.14f, -0.25f, -0.004f), new Vector3(0.008f, 0.075f, 0.004f), ProcMesh.Mat("#050505", 0.2f));
            string[] fl = { "0°", "10°", "20°", "30°" };
            for (int i = 0; i < 4; i++) GaugeKit.Text(P, fl[i], new Vector3(0.158f, -0.218f - i * 0.022f, -0.007f), 0.0045f, GaugeKit.Ink);
            GaugeKit.Text(P, "CÁNH TÀ", new Vector3(0.14f, -0.202f, -0.007f), 0.0045f, GaugeKit.Ink);
            flapLever = GaugeKit.Child("CanCanhTa", P, new Vector3(0.14f, -0.218f, -0.006f)).transform;
            Box(flapLever, new Vector3(0, 0, -0.01f), new Vector3(0.004f, 0.004f, 0.02f), chrome);
            Box(flapLever, new Vector3(0, 0, -0.022f), new Vector3(0.024f, 0.012f, 0.008f), ProcMesh.Mat("#e8e8e8", 0.4f));
            Add("Cần cánh tà", flapLever, new Vector3(0.03f, 0.02f, 0.04f), () => fl[Sys.flapLever] + (Math.Abs(S.model != null ? S.model.flapPos - Spec.FlapDeg[Sys.flapLever] : 0) > 0.5 ? " (đang chạy)" : ""),
                dir => { Sys.flapLever = Mathf.Clamp(Sys.flapLever + dir, 0, 3); Sound(2); }, w => { Sys.flapLever = Mathf.Clamp(Sys.flapLever + (w < 0 ? 1 : -1), 0, 3); Sound(2); },
                null, "Nhấp trái hạ một nấc, nhấp phải thu một nấc. Phím F6/F7").box.center = new Vector3(0, 0, -0.02f);
            flapText = null;

            // cần lái kép
            foreach (float x in new[] { -0.32f, 0.3f })
            {
                var col = GaugeKit.Child("CotLai", root.transform, new Vector3(x, 0.22f, 1.18f)).transform;
                Cyl(col, new Vector3(0, 0, -0.1f), 0.032f, 0.3f, chrome, new Vector3(90, 0, 0));
                var wheel = GaugeKit.Child("VoLang", col, new Vector3(0, 0, -0.25f)).transform;
                var pts = new List<Vector3> { new Vector3(-0.15f, 0.06f, 0), new Vector3(-0.14f, -0.02f, 0), new Vector3(-0.08f, -0.06f, 0), new Vector3(0.08f, -0.06f, 0), new Vector3(0.14f, -0.02f, 0), new Vector3(0.15f, 0.06f, 0) };
                ProcMesh.Obj("Sung", ProcMesh.Tube(pts, 0.017f, 10, 8), black, wheel);
                foreach (int sd in new[] { -1, 1 }) Cyl(wheel, new Vector3(sd * 0.152f, 0.09f, 0), 0.04f, 0.09f, black, Vector3.zero);
                Box(wheel, new Vector3(0, -0.03f, 0), new Vector3(0.11f, 0.06f, 0.04f), black);
                Cyl(wheel, new Vector3(0, -0.03f, -0.021f), 0.036f, 0.002f, chrome, new Vector3(90, 0, 0));
                yokes.Add(col); yokeWheels.Add(wheel);
            }
            // bàn đạp lái
            foreach (float x in new[] { -0.32f, 0.3f })
                foreach (int sd in new[] { -1, 1 })
                {
                    var pd = GaugeKit.Child("BanDap", root.transform, new Vector3(x + sd * 0.08f, -0.38f, 1.08f)).transform;
                    Box(pd, Vector3.zero, new Vector3(0.07f, 0.12f, 0.015f), black, new Vector3(-25, 0, 0));
                    pedals.Add(pd);
                }
            // ghế
            foreach (float x in new[] { -0.32f, 0.3f })
            {
                Box(root.transform, new Vector3(x, -0.24f, 0.15f), new Vector3(0.46f, 0.12f, 0.5f), seat);
                Box(root.transform, new Vector3(x, 0.14f, -0.15f), new Vector3(0.46f, 0.7f, 0.12f), seat, new Vector3(-10, 0, 0));
                Box(root.transform, new Vector3(x, 0.6f, -0.24f), new Vector3(0.26f, 0.16f, 0.08f), seat, new Vector3(-10, 0, 0));
            }
            Box(root.transform, new Vector3(0, -0.24f, -0.95f), new Vector3(1.0f, 0.14f, 0.5f), seat);
            Box(root.transform, new Vector3(0, 0.12f, -1.22f), new Vector3(1.0f, 0.6f, 0.12f), seat, new Vector3(-9, 0, 0));
        }

        void Floor()
        {
            var R = root.transform;
            Box(R, new Vector3(0, -0.52f, -0.35f), new Vector3(1.12f, 0.03f, 3.2f), ProcMesh.Mat("#2b2a28", 0.05f));
            Box(R, new Vector3(0, -0.44f, 0.66f), new Vector3(0.16f, 0.14f, 0.5f), black); // hộp giữa sàn
            // van chọn bình xăng
            fuelSelector = GaugeKit.Child("VanXang", R, new Vector3(0, -0.365f, 0.62f)).transform;
            fuelSelector.localRotation = Quaternion.Euler(70, 0, 0); // mặt hướng lên-về phi công
            var plate = TexGen.Paint(128, 128, (u, v) =>
            {
                float x = u * 2 - 1, y = v * 2 - 1, r = Mathf.Sqrt(x * x + y * y);
                if (r > 1) return new Color(0, 0, 0, 0);
                return r > 0.93f ? new Color(0.7f, 0.7f, 0.7f) : new Color(0.12f, 0.12f, 0.12f);
            });
            GaugeKit.QuadObj("Mat", fuelSelector, Vector3.zero, new Vector2(0.13f, 0.13f), GaugeKit.FaceMat(plate, true));
            string[] fs = { "TẮT", "TRÁI", "CẢ HAI", "PHẢI" };
            float[] ang = { 180, -90, 0, 90 };
            for (int i = 0; i < 4; i++)
            {
                float a = ang[i] * Mathf.Deg2Rad;
                GaugeKit.Text(fuelSelector, fs[i], new Vector3(Mathf.Sin(a) * 0.045f, Mathf.Cos(a) * 0.045f, -0.002f), 0.0085f, i == 0 ? new Color(1, 0.35f, 0.25f) : GaugeKit.Ink);
            }
            var handle = GaugeKit.Child("Tay", fuelSelector, new Vector3(0, 0, -0.01f)).transform;
            Box(handle, new Vector3(0, 0.01f, 0), new Vector3(0.016f, 0.07f, 0.02f), ProcMesh.Mat("#c03020", 0.4f));
            Box(handle, new Vector3(0, 0.038f, -0.002f), new Vector3(0.006f, 0.012f, 0.022f), ProcMesh.Mat("#f0f0f0", 0.4f));
            GaugeKit.Text(fuelSelector, "VAN XĂNG", new Vector3(0, -0.075f, -0.002f), 0.007f, GaugeKit.Ink);
            Add("Van chọn bình xăng", fuelSelector, new Vector3(0.13f, 0.13f, 0.05f), () => fs[(int)Sys.fuelSel],
                dir =>
                {
                    // thứ tự xoay: TRÁI → CẢ HAI → PHẢI → TẮT
                    int[] order = { 1, 2, 3, 0 };
                    int idx = Array.IndexOf(order, (int)Sys.fuelSel);
                    idx = Mathf.Clamp(idx + dir, 0, 3);
                    Sys.fuelSel = (FuelSel)order[idx]; Sound(1);
                }, null, null, "Nhìn xuống sàn giữa hai ghế (phím 3). Luôn để CẢ HAI khi cất/hạ cánh");
            selHandle = handle;

            // bánh trim
            trimWheel = GaugeKit.Child("BanhTrim", R, new Vector3(0, -0.3f, 0.86f)).transform;
            var tw = Cyl(trimWheel, Vector3.zero, 0.14f, 0.025f, black, new Vector3(0, 0, 90));
            for (int i = 0; i < 12; i++) { float a = i / 12f * Mathf.PI * 2; Box(trimWheel, new Vector3(0, Mathf.Cos(a) * 0.07f, Mathf.Sin(a) * 0.07f), new Vector3(0.03f, 0.006f, 0.006f), plastic); }
            Box(R, new Vector3(0.03f, -0.3f, 0.86f), new Vector3(0.004f, 0.12f, 0.06f), black);
            trimPtr = GaugeKit.Child("ChiTrim", R, new Vector3(0.034f, -0.3f, 0.86f)).transform;
            Box(trimPtr, Vector3.zero, new Vector3(0.002f, 0.004f, 0.012f), GaugeKit.OrangeMat);
            GaugeKit.Text(R, "TRIM\nMŨI XUỐNG ↑", new Vector3(0.04f, -0.22f, 0.86f), 0.008f, GaugeKit.Ink).transform.localRotation = Quaternion.Euler(0, 90, 0);
            Add("Bánh chỉnh trim độ cao", trimWheel, new Vector3(0.04f, 0.16f, 0.16f), () => "Trim " + (S.ctl.trim * 100).ToString("+0;-0") + "% (dương = ngóc mũi)",
                dir => { S.ctl.trim = Math.Max(-1, Math.Min(1, S.ctl.trim + dir * 0.05)); Sound(1); },
                w => S.ctl.trim = Math.Max(-1, Math.Min(1, S.ctl.trim + w * 0.02)),
                dy => S.ctl.trim = Math.Max(-1, Math.Min(1, S.ctl.trim - dy * 1.2)), "Lăn chuột hoặc phím Home/End. Cất cánh: đặt vạch TAKE OFF (+15%)");
        }
        Transform selHandle;

        void Decor()
        {
            var P = panel;
            // cầu chì
            var cb = ProcMesh.Mat("#0c0c0c", 0.4f);
            string[] cbn = { "ALT", "BAT", "ĐÈN", "PITOT", "BƠM", "RADIO", "GPS", "XPDR", "TC", "ĐỀ", "ĐHỒ", "QUẠT" };
            for (int i = 0; i < 12; i++)
            {
                float x = 0.29f + (i % 6) * 0.04f, y = -0.03f - (i / 6) * 0.04f;
                Cyl(P, new Vector3(x, y, -0.006f), 0.012f, 0.012f, cb, new Vector3(90, 0, 0));
                GaugeKit.Text(P, cbn[i], new Vector3(x, y + 0.014f, -0.007f), 0.0038f, GaugeKit.Ink);
            }
            // hộc đựng đồ
            Box(P, new Vector3(0.39f, -0.15f, -0.004f), new Vector3(0.25f, 0.075f, 0.006f), ProcMesh.Mat("#2f3134", 0.25f));
            Box(P, new Vector3(0.39f, -0.12f, -0.009f), new Vector3(0.05f, 0.006f, 0.006f), chrome);
            GaugeKit.Text(P, "SẢI CÁNH SC-4", new Vector3(0.39f, -0.155f, -0.008f), 0.009f, new Color(0.75f, 0.75f, 0.72f));
            GaugeKit.Text(P, "VN-A4K", new Vector3(0.39f, -0.172f, -0.008f), 0.006f, new Color(0.65f, 0.65f, 0.62f));
            // bảng tốc độ giới hạn
            GaugeKit.Text(P, "Vs0 40  Vs1 48  Vx 62  Vy 74  Va 99  Vfe 85  Vno 129  Vne 163 KT", new Vector3(-0.27f, -0.205f, -0.005f), 0.0042f, new Color(0.85f, 0.85f, 0.8f));
        }

        // ================= cập nhật =================
        float hobbsShown;

        public void Update(float dt)
        {
            var sys = Sys; var m = S.model;
            bool elec = sys.ElecPower, av = sys.AvionicsPower;
            GaugeKit.Set(asi, AsiAngle(S.iasKt));
            double ia = S.IndicatedAltFt;
            GaugeKit.Set(altH, (float)(ia % 1000 / 1000 * 360));
            GaugeKit.Set(altT, (float)(ia % 10000 / 10000 * 360));
            GaugeKit.Set(altTT, (float)(ia % 100000 / 100000 * 360));
            kollsman.text = sys.baro.ToString("0.00");
            GaugeKit.Set(vsi, VsiAngle(S.vsFpm));
            GaugeKit.Set(tach, TachA(sys.rpm));
            GaugeKit.Set(suction, (float)Mathf.Clamp(((float)sys.suction - 5) / 2 * 60, -65, 65));
            GaugeKit.Set(amm, elec ? Mathf.Clamp((float)sys.amps, -60, 60) : 0);
            GaugeKit.Set(fuelL, elec ? (float)(sys.fuelL / 26 * 120 - 60) : -62);
            GaugeKit.Set(fuelR, elec ? (float)(sys.fuelR / 26 * 120 - 60) : -62);
            GaugeKit.Set(oilT, (float)Mathf.Clamp(((float)sys.oilTemp - 75) / 175 * 120 - 60, -62, 62));
            GaugeKit.Set(oilP, (float)Mathf.Clamp((float)sys.oilPress / 115 * 120 - 60, -62, 62));
            GaugeKit.Set(egt, elec ? (float)Mathf.Clamp(((float)sys.egt - 900) / 700 * 120 - 50, -62, 62) : -62);
            GaugeKit.Set(volts, elec ? Mathf.Clamp(((float)sys.busVolts - 16) / 16 * 120 - 60, -62, 62) : -62);
            double gph = sys.running ? 1.6 + 8.4 * sys.power * (0.5 + 0.5 * sys.mixture) : 0;
            GaugeKit.Set(ffl, elec ? (float)(gph / 19 * 120 - 60) : -60);
            float hrs = S.timeOfDayHours;
            GaugeKit.Set(clockH, hrs % 12 / 12 * 360); GaugeKit.Set(clockM, hrs % 1 * 360); GaugeKit.Set(clockS, (hrs * 60) % 1 * 360);
            if (Mathf.Abs(hobbsShown - (float)sys.hobbs) > 0.05f) { hobbsShown = (float)sys.hobbs; hobbs.text = sys.hobbs.ToString("00000.0"); }

            // chân trời nhân tạo (theo con quay)
            aiMat.SetFloat("_Pitch", (float)-sys.aiPitch);
            aiMat.SetFloat("_Roll", (float)(sys.aiRoll * Mathf.Deg2Rad));
            aiRing.localRotation = Quaternion.Euler(0, 0, (float)sys.aiRoll);
            // con quay hướng
            float hiHdg = (float)(S.heading + sys.hdgDrift);
            hiCard.localRotation = Quaternion.Euler(0, 0, hiHdg);
            hiBug.localRotation = Quaternion.Euler(0, 0, hiHdg - (float)sys.hdgBug);
            // rẽ & trượt (điện)
            float tr = elec ? Mathf.Clamp((float)S.turnRate / 3f * 20f, -30, 30) : 0;
            tcPlane.localRotation = Quaternion.Slerp(tcPlane.localRotation, Quaternion.Euler(0, 0, -tr), dt * 6);
            var bp = tcBall.localPosition;
            float bx = Mathf.Clamp((float)S.slip * 0.012f, -0.017f, 0.017f);
            bp.x = Mathf.Lerp(bp.x, bx, dt * 5); bp.y = -0.017f - (1 - Mathf.Cos(bp.x / 0.034f)) * 0.01f;
            tcBall.localPosition = bp;
            // la bàn từ: đung đưa khi nghiêng
            compassCard.localRotation = Quaternion.Slerp(compassCard.localRotation, Quaternion.Euler(0, -(float)S.heading, Mathf.Clamp((float)S.rollDeg * 0.15f, -8, 8)), dt * 3);

            // VOR
            bool vorOk = av && Math.Abs(S.navActive - AirportBuilder.VorFreq) < 0.01;
            if (vorOk && m != null)
            {
                double dx = m.pos.x - AirportBuilder.Vor.x, dz = m.pos.z - AirportBuilder.Vor.y;
                double radial = Math.Atan2(dx, -dz) * 180 / Math.PI; if (radial < 0) radial += 360;
                double diff = Wrap180(radial - S.obs);
                bool from = Math.Abs(diff) < 90;
                double dev = from ? -diff : Wrap180(radial - S.obs - 180); // dương = kim lệch phải (bay sang phải)
                float off = Mathf.Clamp((float)dev / 10f, -1, 1) * 0.026f;
                cdiNeedle.localPosition = new Vector3(Mathf.Lerp(cdiNeedle.localPosition.x, off, dt * 3), 0, -0.011f);
                cdiFlag.text = from ? "FR" : "TO";
                cdiFlag.color = Color.white;
            }
            else { cdiFlag.text = "OFF"; cdiFlag.color = new Color(1, 0.3f, 0.2f); cdiNeedle.localPosition = new Vector3(Mathf.Lerp(cdiNeedle.localPosition.x, 0, dt), 0, -0.011f); }
            cdiCard.localRotation = Quaternion.Euler(0, 0, (float)S.obs);

            // máy vô tuyến
            comText.text = av ? S.comActive.ToString("0.000") + "   " + S.comStby.ToString("0.000") : "";
            navText.text = av ? S.navActive.ToString("0.00") + "    " + S.navStby.ToString("0.00") : "";
            string[] modes = { "", "SBY", "ON", "ALT" };
            xpdrText.text = av && sys.xpdrMode > 0 ? modes[sys.xpdrMode] + "  " + sys.squawk.ToString("0000") + (sys.xpdrMode == 3 ? "  FL" + Math.Max(0, Math.Round(S.altFt / 100)).ToString("000") : "") : "";
            gpsScreen.SetActive(av); gpsOff.SetActive(!av); gpsIcon.gameObject.SetActive(av);
            if (av && m != null)
            {
                float span = new[] { 2000f, 5000f, 12000f }[S.gpsZoom], world = TerrainBuilder.Tiles * TerrainBuilder.TileSize;
                float sx = span / world, sy = sx * 0.08f / 0.12f;
                float u = (float)(m.pos.x - TerrainBuilder.Origin) / world, v = (float)(-m.pos.z - TerrainBuilder.Origin) / world;
                gpsMat.mainTextureScale = new Vector2(sx, sy);
                gpsMat.mainTextureOffset = new Vector2(u - sx / 2, v - sy / 2);
                gpsIcon.localRotation = Quaternion.Euler(0, 0, -(float)S.trackDeg);
                double dA = Math.Sqrt(m.pos.x * m.pos.x + m.pos.z * m.pos.z) / 1852;
                double brg = Math.Atan2(-m.pos.x, m.pos.z) * 180 / Math.PI; if (brg < 0) brg += 360;
                gpsText.text = "GS  " + S.gsKt.ToString("0") + " kt\nTRK " + S.trackDeg.ToString("000") + "°\nALT " + S.altFt.ToString("0") + "\nSC  " + dA.ToString("0.0") + " nm\nBRG " + brg.ToString("000") + "°";
                gpsText2.text = new[] { "2 km", "5 km", "12 km" }[S.gpsZoom];
            }
            else { gpsText.text = ""; gpsText2.text = ""; }

            // đèn cảnh báo & màn hình
            foreach (var a in annunciators)
            {
                bool on = a.Value();
                a.Key.SetColor("_EmissionColor", on ? EmissionOf(a.Key) : Color.black);
            }
            float panelGlow = sys.panelLight && elec ? 0.55f : 0.16f;
            foreach (var fm in GaugeKit.FaceMats) if (fm != GaugeKit.NeedleMat) fm.SetColor("_EmissionColor", new Color(panelGlow, panelGlow * 0.97f, panelGlow * 0.92f));
            flood.enabled = sys.panelLight && elec;

            // công tắc
            SetRocker("bat", sys.masterBat); SetRocker("alt", sys.masterAlt); SetRocker("avionics", sys.avionics);
            SetRocker("pump", sys.fuelPump); SetRocker("beacon", sys.beacon); SetRocker("land", sys.landLight); SetRocker("taxi", sys.taxiLight);
            SetRocker("nav", sys.navLight); SetRocker("strobe", sys.strobe); SetRocker("pitot", sys.pitotHeat); SetRocker("panel", sys.panelLight);
            key.localRotation = Quaternion.Euler(0, 0, -(-60 + (int)sys.mag * 30));
            if (primerAnim > 0) { primerAnim = Mathf.Max(0, primerAnim - dt * 1.6f); }
            primer.localPosition = new Vector3(-0.515f, -0.165f, -0.008f - Mathf.Sin(primerAnim * Mathf.PI) * 0.05f);
            throttle.localPosition = new Vector3(0, -0.245f, -0.012f - (float)(1 - sys.throttle) * 0.07f);
            mixture.localPosition = new Vector3(0.06f, -0.245f, -0.012f - (float)(1 - sys.mixture) * 0.07f);
            carb.localPosition = new Vector3(-0.06f, -0.245f, -0.012f - (float)sys.carbHeat * 0.05f);
            flapLever.localPosition = Vector3.Lerp(flapLever.localPosition, new Vector3(0.14f, -0.218f - sys.flapLever * 0.022f, -0.006f), dt * 10);
            parkBrake.localPosition = new Vector3(-0.5f, 0.03f, 1.14f - (sys.parkingBrake ? 0.05f : 0));
            float[] selAng = { 180, -90, 0, 90 };
            selHandle.localRotation = Quaternion.Slerp(selHandle.localRotation, Quaternion.Euler(0, 0, -selAng[(int)sys.fuelSel]), dt * 12);
            trimWheel.localRotation = Quaternion.Euler((float)S.ctl.trim * 400, 0, 0);
            trimPtr.localPosition = new Vector3(0.034f, -0.3f + (float)S.ctl.trim * 0.05f, 0.86f);
            for (int i = 0; i < yokes.Count; i++)
            {
                yokes[i].gameObject.SetActive(!S.hideYokes);
                yokes[i].localPosition = new Vector3(yokes[i].localPosition.x, 0.22f, 1.16f - (float)S.ctl.elevator * 0.07f);
                yokeWheels[i].localRotation = Quaternion.Euler(0, 0, -(float)S.ctl.aileron * 40);
            }
            for (int i = 0; i < pedals.Count; i++)
            {
                int sd = i % 2 == 0 ? -1 : 1;
                var p = pedals[i].localPosition;
                float brake = (float)(sd < 0 ? S.ctl.brakeL : S.ctl.brakeR);
                pedals[i].localPosition = new Vector3(p.x, p.y, 1.08f - sd * (float)S.ctl.rudder * 0.05f);
                pedals[i].localRotation = Quaternion.Euler(-brake * 12, 0, 0);
            }
        }

        static readonly Dictionary<Material, Color> emis = new Dictionary<Material, Color>();
        Color EmissionOf(Material m)
        {
            Color c;
            if (!emis.TryGetValue(m, out c)) { c = m.GetColor("_EmissionColor"); if (c.maxColorComponent < 0.01f) c = new Color(1, 0.5f, 0.1f); emis[m] = c; }
            return c;
        }

        void SetRocker(string id, bool on)
        {
            Transform t;
            if (rockers.TryGetValue(id, out t)) t.localRotation = Quaternion.Slerp(t.localRotation, Quaternion.Euler(on ? -14 : 14, 0, 0), 0.5f);
        }

        /// <summary>Tìm bộ phận dưới tia chuột (kiểm tra hộp cục bộ, không cần collider vật lý).</summary>
        public CockpitControl Pick(Ray ray, out float dist)
        {
            CockpitControl best = null; dist = float.MaxValue;
            foreach (var c in controls)
            {
                if (c.t == null || !c.t.gameObject.activeInHierarchy) continue;
                var inv = c.t.worldToLocalMatrix;
                var o = inv.MultiplyPoint3x4(ray.origin);
                var d = inv.MultiplyVector(ray.direction);
                float tmin, tmax;
                if (!RayBox(o, d, c.box, out tmin, out tmax)) continue;
                // đổi khoảng cách về hệ thế giới
                Vector3 hit = c.t.localToWorldMatrix.MultiplyPoint3x4(o + d * tmin);
                float wd = (hit - ray.origin).magnitude;
                if (wd < dist) { dist = wd; best = c; }
            }
            return best;
        }

        static bool RayBox(Vector3 o, Vector3 d, Bounds b, out float tmin, out float tmax)
        {
            tmin = -float.MaxValue; tmax = float.MaxValue;
            for (int i = 0; i < 3; i++)
            {
                float lo = b.min[i], hi = b.max[i];
                if (Mathf.Abs(d[i]) < 1e-9f) { if (o[i] < lo || o[i] > hi) return false; continue; }
                float t1 = (lo - o[i]) / d[i], t2 = (hi - o[i]) / d[i];
                if (t1 > t2) { float t = t1; t1 = t2; t2 = t; }
                tmin = Mathf.Max(tmin, t1); tmax = Mathf.Min(tmax, t2);
                if (tmin > tmax) return false;
            }
            return tmax > 0;
        }
    }
}

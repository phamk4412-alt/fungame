// Máy bay SC-4 nhìn từ bên ngoài: thân sơn, cánh biên dạng, thanh chống, cánh lái chuyển động,
// cánh quạt mờ khi quay, đèn hàng hải, đèn hiệu, đèn chớp, đèn hạ cánh.
using UnityEngine;

namespace SaiCanh
{
    public class AircraftVisual
    {
        /// <summary>Mặt cắt thân cabin + đuôi theo toạ độ web (z hướng đuôi): {z, rộng, cao, tâm y, mũ}.</summary>
        public static readonly float[][] BodyWeb =
        {
            new[] { -1.62f, 1.1f, 1.0f, 0.04f, 3.0f }, new[] { -1.3f, 1.14f, 1.5f, 0.27f, 3.2f }, new[] { -0.95f, 1.18f, 1.86f, 0.35f, 3.4f },
            new[] { 0.0f, 1.18f, 1.9f, 0.35f, 3.4f }, new[] { 0.8f, 1.12f, 1.78f, 0.37f, 3.2f }, new[] { 1.55f, 0.94f, 1.36f, 0.45f, 3.0f },
            new[] { 2.5f, 0.66f, 0.92f, 0.5f, 2.8f }, new[] { 3.6f, 0.44f, 0.6f, 0.55f, 2.6f }, new[] { 4.7f, 0.26f, 0.4f, 0.6f, 2.4f },
            new[] { 5.65f, 0.08f, 0.16f, 0.62f, 2.2f },
        };
        static readonly float[][] CowlWeb =
        {
            new[] { -2.98f, 0.5f, 0.46f, -0.07f, 2.2f }, new[] { -2.85f, 0.8f, 0.72f, -0.06f, 2.4f }, new[] { -2.55f, 0.96f, 0.88f, -0.03f, 2.6f },
            new[] { -2.1f, 1.05f, 0.96f, 0.0f, 2.8f }, new[] { -1.62f, 1.1f, 1.0f, 0.04f, 3.0f },
        };

        /// <summary>Đổi mặt cắt kiểu web (z đuôi) sang Unity (z mũi).</summary>
        public static float[][] ToUnity(float[][] web)
        {
            var r = new float[web.Length][];
            for (int i = 0; i < web.Length; i++) { r[i] = (float[])web[i].Clone(); r[i][0] = -r[i][0]; }
            return r;
        }

        /// <summary>Ô kính (toạ độ web) — dùng chung cho sơn bên ngoài và vỏ trong buồng lái.</summary>
        public static bool IsWindow(float x, float y, float z, float sill = 0.5f)
        {
            float ax = Mathf.Abs(x);
            if (z < -0.92f && y > sill + Mathf.Max(0, 0.62f - ax) * 0.15f) return true;
            if (ax > 0.3f && z >= -0.92f && z < 0.1f && y > sill && y < 1.13f) return true;
            if (ax > 0.3f && z > 0.3f && z < 1.05f && y > sill + 0.06f && y < 1.08f) return true;
            if (z > 1.15f && z < 1.75f && y > 0.95f && ax < 0.42f) return true;
            return false;
        }

        public GameObject root, cabin, always;
        Transform ailL, ailR, flapL, flapR, elev, rud, noseGear, blades;
        Material bladeMat, discMat;
        GameObject disc, beacon, strobeL, strobeR, navL, navR, navT;
        Light landSpot, taxiSpot, beaconLight;
        float propAngle;

        static Texture2D Livery(Color main, Color accent)
        {
            int W = 1024, H = 1024;
            var tex = new Texture2D(W, H, TextureFormat.RGBA32, true);
            var px = new Color32[W * H];
            var sec = BodyWeb;
            Color32 white = new Color(0.95f, 0.95f, 0.93f), glass = new Color(0.04f, 0.07f, 0.09f);
            for (int j = 0; j < H; j++)
            {
                float v = j / (float)(H - 1);
                float zWeb = Mathf.Lerp(sec[0][0], sec[sec.Length - 1][0], v);
                var s = ProcMesh.SectionAt(sec, zWeb);
                for (int i = 0; i < W; i++)
                {
                    float u = i / (float)(W - 1);
                    Vector3 p = ProcMesh.Section(zWeb, s[1], s[2], s[3], s[4], u * Mathf.PI * 2);
                    Color c = white;
                    float side = Mathf.Abs(u - 0.5f); // 0 = bụng, 0.5 = nóc
                    if (side < 0.08f) c = main; // bụng
                    else if (Mathf.Abs(side - 0.19f) < 0.018f) c = main; // sọc chính
                    else if (Mathf.Abs(side - 0.165f) < 0.006f) c = accent;
                    if (IsWindow(p.x, p.y, zWeb, 0.52f)) c = glass;
                    px[j * W + i] = c;
                }
            }
            tex.SetPixels32(px);
            tex.Apply(true);
            tex.anisoLevel = 8;
            return tex;
        }

        static Vector3 U(float x, float y, float zWeb) { return new Vector3(x, y, -zWeb); }

        public AircraftVisual(Transform parent, Color main, Color accent, string reg)
        {
            root = new GameObject("MayBay_" + reg);
            root.transform.SetParent(parent, false);
            cabin = new GameObject("ThanCabin"); cabin.transform.SetParent(root.transform, false);
            always = new GameObject("LuonHien"); always.transform.SetParent(root.transform, false);
            var A = always.transform;

            var paint = ProcMesh.Mat(Color.white, 0.78f, 0.05f);
            paint.mainTexture = Livery(main, accent);
            var white = ProcMesh.Mat(new Color(0.95f, 0.95f, 0.93f), 0.75f, 0.05f);
            var trim = ProcMesh.Mat(main, 0.75f, 0.05f);
            var metal = ProcMesh.Mat(new Color(0.62f, 0.64f, 0.66f), 0.75f, 0.9f);
            var tire = ProcMesh.Mat(new Color(0.07f, 0.07f, 0.07f), 0.15f);

            ProcMesh.Obj("NapDongCo", ProcMesh.Loft(ToUnity(CowlWeb), 32, false, 3), white, A);
            ProcMesh.Obj("Than", ProcMesh.Loft(ToUnity(BodyWeb), 40, false, 3), paint, cabin.transform);

            // cánh trên
            float wingY = 1.22f, wingLE = 0.95f; // mép trước ở z = +0.95 (Unity)
            foreach (int s in new[] { -1, 1 })
            {
                ProcMesh.Obj("CanhTrong", ProcMesh.Wing(s * 0.5f, s * 2.6f, 1.6f, 1.6f, 0.13f, 0.02f, 0, 0.026f), white, A, new Vector3(0, wingY, wingLE));
                ProcMesh.Obj("CanhNgoai", ProcMesh.Wing(s * 2.6f, s * 5.45f, 1.6f, 1.12f, 0.12f, 0.02f, 0.04f, 0.026f), white, A, new Vector3(0, wingY + Mathf.Tan(0.026f) * 2.1f, wingLE));
                Vector3 a = new Vector3(s * 0.56f, -0.42f, 0.25f), b = new Vector3(s * 2.65f, wingY + 0.08f, 0.4f);
                var strut = ProcMesh.Prim(PrimitiveType.Cylinder, A, (a + b) / 2, new Vector3(0.08f, (b - a).magnitude / 2, 0.035f), white);
                strut.transform.localRotation = Quaternion.FromToRotation(Vector3.up, (b - a).normalized);
            }
            ProcMesh.Obj("CanhGiua", ProcMesh.Wing(-0.5f, 0.5f, 1.6f, 1.6f, 0.13f, 0.02f), white, A, new Vector3(0, wingY, wingLE));

            System.Func<float, float, float, float, float, Transform> hinge = (x0, x1, chord, z, y) =>
            {
                var pv = new GameObject("BanLe").transform;
                pv.SetParent(A, false);
                pv.localPosition = new Vector3(0, y, z);
                ProcMesh.Obj("Mat", ProcMesh.Wing(x0, x1, chord, chord, 0.08f, 0), white, pv);
                return pv;
            };
            ailL = hinge(-5.3f, -3.2f, 0.34f, wingLE - 1.12f, wingY + 0.12f);
            ailR = hinge(3.2f, 5.3f, 0.34f, wingLE - 1.12f, wingY + 0.12f);
            flapL = hinge(-3.1f, -0.6f, 0.38f, wingLE - 1.22f, wingY + 0.06f);
            flapR = hinge(0.6f, 3.1f, 0.38f, wingLE - 1.22f, wingY + 0.06f);

            foreach (int s in new[] { -1, 1 })
                ProcMesh.Obj("DuoiNgang", ProcMesh.Wing(s * 0.1f, s * 1.75f, 0.95f, 0.7f, 0.1f, 0, 0.12f), white, A, new Vector3(0, 0.6f, -4.55f));
            elev = new GameObject("CanhLaiDoCao").transform; elev.SetParent(A, false); elev.localPosition = new Vector3(0, 0.6f, -5.42f);
            foreach (int s in new[] { -1, 1 }) ProcMesh.Obj("Mat", ProcMesh.Wing(s * 0.1f, s * 1.7f, 0.42f, 0.34f, 0.08f, 0), trim, elev);
            var fin = ProcMesh.Obj("DuoiDung", ProcMesh.Fin(new[] { new Vector2(0, 0), new Vector2(1.55f, 0), new Vector2(1.5f, 1.15f), new Vector2(1.05f, 1.15f), new Vector2(-0.6f, 0.05f) }, 0.1f), trim, A, new Vector3(0, 0.62f, -3.95f));
            rud = new GameObject("BanhLaiHuong").transform; rud.SetParent(A, false); rud.localPosition = new Vector3(0, 0.62f, -5.5f);
            ProcMesh.Obj("Mat", ProcMesh.Fin(new[] { new Vector2(0, 0), new Vector2(0.42f, 0.05f), new Vector2(0.36f, 1.12f), new Vector2(0, 1.15f) }, 0.07f), white, rud);

            // số đăng ký trên thân sau
            foreach (int s in new[] { -1, 1 })
            {
                var t = Text3D.Make(reg, A, new Vector3(s * 0.27f, 0.62f, -2.7f), 0.11f, accent);
                t.transform.localRotation = Quaternion.Euler(0, s * -90f, 0);
                t.transform.SetParent(cabin.transform, true);
            }

            // càng
            foreach (int s in new[] { -1, 1 })
            {
                var w = ProcMesh.Prim(PrimitiveType.Cylinder, A, new Vector3(s * 1.25f, -0.95f, -0.35f), new Vector3(0.5f, 0.08f, 0.5f), tire);
                w.transform.localRotation = Quaternion.Euler(0, 0, 90);
                var hub = ProcMesh.Prim(PrimitiveType.Cylinder, A, new Vector3(s * 1.25f, -0.95f, -0.35f), new Vector3(0.24f, 0.085f, 0.24f), metal);
                hub.transform.localRotation = Quaternion.Euler(0, 0, 90);
                Vector3 a = new Vector3(s * 0.45f, -0.55f, -0.3f), b = new Vector3(s * 1.2f, -0.92f, -0.35f);
                var leg = ProcMesh.Prim(PrimitiveType.Cube, A, (a + b) / 2, new Vector3((b - a).magnitude, 0.05f, 0.12f), metal);
                leg.transform.localRotation = Quaternion.Euler(0, 0, Mathf.Atan2(b.y - a.y, b.x - a.x) * Mathf.Rad2Deg);
                var pant = ProcMesh.Obj("OpBanh", ProcMesh.Loft(new[] { new[] { 0.38f, 0.05f, 0.08f, -0.95f, 2.5f }, new[] { 0.28f, 0.2f, 0.34f, -0.93f, 2.5f }, new[] { 0f, 0.24f, 0.42f, -0.9f, 2.5f }, new[] { -0.3f, 0.2f, 0.32f, -0.9f, 2.5f }, new[] { -0.55f, 0.04f, 0.08f, -0.88f, 2.5f } }, 16, false, 2), trim, A);
                pant.transform.localPosition = new Vector3(s * 1.25f, 0, -0.35f);
            }
            noseGear = new GameObject("CangMui").transform; noseGear.SetParent(A, false); noseGear.localPosition = new Vector3(0, -0.45f, 1.75f);
            ProcMesh.Prim(PrimitiveType.Cylinder, noseGear, new Vector3(0, -0.25f, 0), new Vector3(0.09f, 0.28f, 0.09f), metal);
            var nw = ProcMesh.Prim(PrimitiveType.Cylinder, noseGear, new Vector3(0, -0.52f, 0), new Vector3(0.44f, 0.07f, 0.44f), tire);
            nw.transform.localRotation = Quaternion.Euler(0, 0, 90);

            // cánh quạt
            var prop = new GameObject("CanhQuat").transform; prop.SetParent(A, false); prop.localPosition = new Vector3(0, -0.06f, 3.02f);
            var spinner = ProcMesh.Obj("Chop", ProcMesh.Loft(new[] { new[] { 0.42f, 0.01f, 0.01f, 0f, 2f }, new[] { 0.3f, 0.2f, 0.2f, 0f, 2f }, new[] { 0.1f, 0.36f, 0.36f, 0f, 2f }, new[] { -0.02f, 0.4f, 0.4f, 0f, 2f } }, 20, false, 3), trim, prop);
            blades = new GameObject("Canh").transform; blades.SetParent(prop, false);
            bladeMat = ProcMesh.Mat(new Color(0.12f, 0.13f, 0.14f), 0.4f, 0.4f);
            for (int i = 0; i < 2; i++)
            {
                var b = ProcMesh.Prim(PrimitiveType.Cube, blades, new Vector3(0, i == 0 ? 0.52f : -0.52f, 0), new Vector3(0.11f, 0.86f, 0.02f), bladeMat);
                b.transform.localRotation = Quaternion.Euler(0, i == 0 ? 14 : -14, 0);
            }
            discMat = ProcMesh.Glass(new Color(0.1f, 0.1f, 0.1f, 0f), 0.3f);
            disc = ProcMesh.Prim(PrimitiveType.Cylinder, prop, Vector3.zero, new Vector3(1.9f, 0.002f, 1.9f), discMat);
            disc.transform.localRotation = Quaternion.Euler(90, 0, 0);
            disc.GetComponent<MeshRenderer>().shadowCastingMode = UnityEngine.Rendering.ShadowCastingMode.Off;

            // đèn
            navL = ProcMesh.Prim(PrimitiveType.Sphere, A, new Vector3(-5.48f, wingY + 0.18f, wingLE - 0.15f), Vector3.one * 0.1f, ProcMesh.Emissive(Color.red, 4));
            navR = ProcMesh.Prim(PrimitiveType.Sphere, A, new Vector3(5.48f, wingY + 0.18f, wingLE - 0.15f), Vector3.one * 0.1f, ProcMesh.Emissive(Color.green, 4));
            navT = ProcMesh.Prim(PrimitiveType.Sphere, A, new Vector3(0, 0.66f, -5.68f), Vector3.one * 0.08f, ProcMesh.Emissive(Color.white, 3));
            strobeL = ProcMesh.Prim(PrimitiveType.Sphere, A, new Vector3(-5.5f, wingY + 0.18f, wingLE - 0.35f), Vector3.one * 0.08f, ProcMesh.Emissive(Color.white, 12));
            strobeR = ProcMesh.Prim(PrimitiveType.Sphere, A, new Vector3(5.5f, wingY + 0.18f, wingLE - 0.35f), Vector3.one * 0.08f, ProcMesh.Emissive(Color.white, 12));
            beacon = ProcMesh.Prim(PrimitiveType.Sphere, A, new Vector3(0, 1.8f, -5.05f), Vector3.one * 0.12f, ProcMesh.Emissive(new Color(1, 0.1f, 0.05f), 8));
            var bl = new GameObject("DenHieu"); bl.transform.SetParent(beacon.transform, false);
            beaconLight = bl.AddComponent<Light>(); beaconLight.type = LightType.Point; beaconLight.color = new Color(1, 0.15f, 0.1f); beaconLight.range = 12;
            landSpot = MakeSpot(A, new Vector3(-1.4f, wingY - 0.05f, wingLE - 0.05f), 2.5f, 34, 260);
            taxiSpot = MakeSpot(A, new Vector3(1.4f, wingY - 0.05f, wingLE - 0.05f), 8f, 60, 90);
        }

        static Light MakeSpot(Transform parent, Vector3 pos, float down, float angle, float range)
        {
            var go = new GameObject("DenPha");
            go.transform.SetParent(parent, false);
            go.transform.localPosition = pos;
            go.transform.localRotation = Quaternion.Euler(down, 0, 0);
            var l = go.AddComponent<Light>();
            l.type = LightType.Spot; l.spotAngle = angle; l.range = range; l.intensity = 3; l.color = new Color(1, 0.96f, 0.88f);
            l.enabled = false;
            return l;
        }

        /// <summary>Cập nhật cánh lái, cánh quạt và đèn.</summary>
        public void Animate(float dt, FlightControls c, AircraftSystems s, float flapDeg, float t, bool inside)
        {
            ailL.localRotation = Quaternion.Euler((float)-c.aileron * 20, 0, 0);
            ailR.localRotation = Quaternion.Euler((float)c.aileron * 20, 0, 0);
            flapL.localRotation = flapR.localRotation = Quaternion.Euler(flapDeg, 0, 0);
            elev.localRotation = Quaternion.Euler((float)(-c.elevator * 20 - c.trim * 3), 0, 0);
            rud.localRotation = Quaternion.Euler(0, (float)c.rudder * 23, 0);
            noseGear.localRotation = Quaternion.Euler(0, (float)c.rudder * 17, 0);
            propAngle += (float)(s.rpm / 60.0 * 360.0) * dt;
            blades.localRotation = Quaternion.Euler(0, 0, propAngle);
            float fast = Mathf.Clamp01(((float)s.rpm - 500) / 900);
            blades.gameObject.SetActive(fast < 0.95f);
            var dc = discMat.color; dc.a = fast * (inside ? 0.06f : 0.2f); discMat.color = dc;
            bool p = s.ElecPower;
            navL.SetActive(p && s.navLight); navR.SetActive(p && s.navLight); navT.SetActive(p && s.navLight);
            bool flashB = p && s.beacon && (t * 1.2f) % 1 < 0.15f;
            beacon.SetActive(flashB); beaconLight.enabled = flashB;
            bool flashS = p && s.strobe && ((t % 1.1f) < 0.05f || ((t % 1.1f) > 0.12f && (t % 1.1f) < 0.16f));
            strobeL.SetActive(flashS); strobeR.SetActive(flashS);
            landSpot.enabled = p && s.landLight; taxiSpot.enabled = p && s.taxiLight;
        }
    }
}

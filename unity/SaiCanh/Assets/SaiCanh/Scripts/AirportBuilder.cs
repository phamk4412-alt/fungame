// Sân bay Sải Cánh (độ cao 62 m): đường băng 18/36 dài 1800 m có vạch sơn chuẩn, đường lăn có vạch vàng,
// sân đỗ, nhà chứa mái vòm, nhà ga, đài kiểm soát, ống gió, đèn lề, đèn thềm, PAPI, đài VOR; thị trấn bên cạnh.
// Toạ độ bản đồ (x đông, zMap nam) → Unity (x, y, -zMap).
using System.Collections.Generic;
using UnityEngine;

namespace SaiCanh
{
    public class AirportBuilder
    {
        public const float Elev = WorldCfg.AirportElev;
        public const float TwX = 130f; // đường lăn song song
        public static readonly float[] Connectors = { -860f, 0f, 860f };
        public const float ApronX0 = 138f, ApronX1 = 330f, ApronZ0 = -40f, ApronZ1 = 200f;
        /// <summary>Đài VOR "SCV" (toạ độ bản đồ).</summary>
        public static readonly Vector2 Vor = new Vector2(-260f, -1250f);
        public const double VorFreq = 113.70, TowerFreq = 118.30, AtisFreq = 127.55, GroundFreq = 121.90;

        /// <summary>Điểm có thuộc mặt nhựa/bê tông không (cộng thêm lề margin, m).</summary>
        public static bool IsPaved(double x, double z, double m = 0)
        {
            double half = WorldCfg.RunwayLength / 2;
            if (System.Math.Abs(x) < WorldCfg.RunwayWidth / 2 + 4 + m && System.Math.Abs(z) < half + 40 + m) return true;
            if (System.Math.Abs(x - TwX) < 8 + m && System.Math.Abs(z) < half - 20 + m) return true;
            foreach (var c in Connectors) if (x > -m && x < TwX + m && System.Math.Abs(z - c) < 8 + m) return true;
            if (x > ApronX0 - m && x < ApronX1 + m && z > ApronZ0 - m && z < ApronZ1 + m) return true;
            if (x > ApronX1 - m && x < 420 + m && z > -90 - m && z < 260 + m) return true; // khu nhà chứa, nhà ga
            return false;
        }

        static Vector3 U(float x, float y, float zMap) { return new Vector3(x, y, -zMap); }

        Transform root;
        Material asphalt, asphaltDark, concrete, white, yellow, edgeLight, greenLight, redLight;
        readonly List<Material> papi = new List<Material>();
        Transform sock, towerBeacon;
        public readonly List<AircraftVisual> parked = new List<AircraftVisual>();

        static Material Paved(Texture2D tex, Color c, float offset, float gloss = 0.12f)
        {
            var sh = Shader.Find("SaiCanh/Paved");
            var m = sh != null ? new Material(sh) : ProcMesh.Mat(c, gloss);
            m.mainTexture = tex;
            m.color = c;
            m.SetFloat("_Glossiness", gloss);
            m.SetFloat("_Offset", offset);
            m.enableInstancing = true;
            return m;
        }

        /// <summary>Lưới chữ nhật nằm ngang (toạ độ bản đồ), UV theo mét / uvScale.</summary>
        static void Rect(List<Vector3> v, List<Vector2> uv, List<int> idx, float x0, float x1, float z0, float z1, float y, float uvScale)
        {
            int b = v.Count;
            v.Add(U(x0, y, z0)); v.Add(U(x1, y, z0)); v.Add(U(x1, y, z1)); v.Add(U(x0, y, z1));
            uv.Add(new Vector2(x0, z0) / uvScale); uv.Add(new Vector2(x1, z0) / uvScale); uv.Add(new Vector2(x1, z1) / uvScale); uv.Add(new Vector2(x0, z1) / uvScale);
            // mặt hướng lên (+y): thứ tự theo chiều kim đồng hồ khi nhìn từ trên xuống trong Unity
            idx.Add(b); idx.Add(b + 2); idx.Add(b + 1); idx.Add(b); idx.Add(b + 3); idx.Add(b + 2);
        }

        GameObject Flat(string name, Material mat, System.Action<List<Vector3>, List<Vector2>, List<int>> fill)
        {
            var v = new List<Vector3>(); var uv = new List<Vector2>(); var idx = new List<int>();
            fill(v, uv, idx);
            // bảo đảm mặt hướng lên
            for (int i = 0; i < idx.Count; i += 3)
            {
                Vector3 n = Vector3.Cross(v[idx[i + 1]] - v[idx[i]], v[idx[i + 2]] - v[idx[i]]);
                if (n.y < 0) { int t = idx[i + 1]; idx[i + 1] = idx[i + 2]; idx[i + 2] = t; }
            }
            var m = new Mesh();
            if (v.Count > 65000) m.indexFormat = UnityEngine.Rendering.IndexFormat.UInt32;
            m.SetVertices(v); m.SetUVs(0, uv); m.SetTriangles(idx, 0);
            m.RecalculateNormals(); m.RecalculateBounds();
            var go = ProcMesh.Obj(name, m, mat, root, Vector3.zero, false);
            go.GetComponent<MeshRenderer>().receiveShadows = true;
            return go;
        }

        public void Build(Transform parent)
        {
            root = new GameObject("SanBay").transform;
            root.SetParent(parent, false);
            float y = Elev + 0.03f;
            float half = WorldCfg.RunwayLength / 2, hw = WorldCfg.RunwayWidth / 2;

            asphalt = Paved(TexGen.Asphalt(ProcMesh.Hex("#5f605d"), 3), Color.white, -1);
            asphaltDark = Paved(TexGen.Asphalt(ProcMesh.Hex("#484946"), 4), Color.white, -1);
            concrete = Paved(TexGen.Ground(ProcMesh.Hex("#8d8c86"), ProcMesh.Hex("#a3a29b"), 21, 0.06f), Color.white, -1);
            white = Paved(null, ProcMesh.Hex("#ecebe6"), -3, 0.3f);
            yellow = Paved(null, ProcMesh.Hex("#d9b437"), -3, 0.3f);

            Flat("DuongBang", asphalt, (v, uv, idx) => Rect(v, uv, idx, -hw - 3, hw + 3, -half - 30, half + 30, y, 24));
            Flat("DuongLan", asphaltDark, (v, uv, idx) =>
            {
                Rect(v, uv, idx, TwX - 8, TwX + 8, -half + 20, half - 20, y - 0.01f, 16);
                foreach (var c in Connectors) Rect(v, uv, idx, hw + 3, TwX - 8, c - 8, c + 8, y - 0.01f, 16);
            });
            Flat("SanDo", concrete, (v, uv, idx) =>
            {
                Rect(v, uv, idx, ApronX0, ApronX1, ApronZ0, ApronZ1, y - 0.01f, 20);
                Rect(v, uv, idx, ApronX1, 420, -90, 260, y - 0.01f, 20);
            });

            // vạch sơn đường băng
            Flat("VachSon", white, (v, uv, idx) =>
            {
                for (float z = -half + 130; z < half - 130; z += 50) Rect(v, uv, idx, -0.45f, 0.45f, z, z + 30, y, 10); // tim
                foreach (int s in new[] { -1, 1 })
                {
                    float zt = s * (half - 6);
                    for (int i = 0; i < 6; i++) // vạch thềm (piano keys)
                    {
                        float xa = 2.3f + i * 2.2f;
                        Rect(v, uv, idx, xa, xa + 1.6f, zt - 15, zt + 15, y, 10);
                        Rect(v, uv, idx, -xa - 1.6f, -xa, zt - 15, zt + 15, y, 10);
                    }
                    float za = s * (half - 300); // vạch điểm ngắm
                    Rect(v, uv, idx, 5, 9, za - 22, za + 22, y, 10); Rect(v, uv, idx, -9, -5, za - 22, za + 22, y, 10);
                    foreach (float k in new[] { 150f, 450f, 600f }) // vạch vùng chạm bánh
                    {
                        float zk = s * (half - k);
                        for (int q = 0; q < (k < 200 ? 3 : 2); q++)
                        {
                            float xq = 4 + q * 2.5f;
                            Rect(v, uv, idx, xq, xq + 1.5f, zk - 11, zk + 11, y, 10);
                            Rect(v, uv, idx, -xq - 1.5f, -xq, zk - 11, zk + 11, y, 10);
                        }
                    }
                    Rect(v, uv, idx, -hw, hw, s * (half + 1) - 0.6f, s * (half + 1) + 0.6f, y, 10); // vạch ngang cuối
                }
                Rect(v, uv, idx, -hw + 0.3f, -hw + 1.2f, -half, half, y, 10); // vạch lề
                Rect(v, uv, idx, hw - 1.2f, hw - 0.3f, -half, half, y, 10);
            });
            Flat("VachVang", yellow, (v, uv, idx) =>
            {
                Rect(v, uv, idx, TwX - 0.2f, TwX + 0.2f, -half + 20, half - 20, y, 10);
                foreach (var c in Connectors)
                {
                    Rect(v, uv, idx, hw + 3, TwX, c - 0.2f, c + 0.2f, y, 10);
                    // vạch dừng chờ (hold short) 2 nét liền + 2 nét đứt
                    for (int k = 0; k < 2; k++) Rect(v, uv, idx, hw + 22 + k * 0.6f, hw + 22.3f + k * 0.6f, c - 8, c + 8, y, 10);
                    for (float zz = c - 8; zz < c + 8; zz += 1.8f) for (int k = 0; k < 2; k++) Rect(v, uv, idx, hw + 23.6f + k * 0.6f, hw + 23.9f + k * 0.6f, zz, zz + 1f, y, 10);
                }
                for (int i = 0; i < 5; i++) { float zp = 30 + i * 30; Rect(v, uv, idx, ApronX0 + 10, ApronX0 + 120, zp - 0.15f, zp + 0.15f, y, 10); }
                Rect(v, uv, idx, ApronX0, TwX + 8, 19.8f, 20.2f, y, 10);
            });

            // số hiệu đường băng
            foreach (int s in new[] { 1, -1 })
            {
                var t = Text3D.Make(s > 0 ? "36" : "18", root, U(0, y + 0.02f, s * (half - 52)), 26f, new Color(0.86f, 0.86f, 0.84f));
                t.transform.localRotation = Quaternion.Euler(90, s > 0 ? 0 : 180, 0);
                t.transform.localScale = new Vector3(0.55f, 1, 1);
            }

            // biển báo đường lăn
            var signMat = ProcMesh.Mat("#d8b02c", 0.3f);
            foreach (var c in Connectors)
            {
                var sg = ProcMesh.Prim(PrimitiveType.Cube, root, U(hw + 26, Elev + 0.6f, c - 12), new Vector3(0.25f, 0.9f, 2.4f), ProcMesh.Mat("#111111"));
                var tx = Text3D.Make(c > 0 ? "A1  36" : c < 0 ? "A3  18" : "A2", root, U(hw + 25.8f, Elev + 0.62f, c - 12), 0.5f, ProcMesh.Hex("#f0c020"));
                tx.transform.localRotation = Quaternion.Euler(0, 90, 0);
            }

            // đèn lề, đèn thềm
            edgeLight = ProcMesh.Emissive(new Color(1f, 0.92f, 0.7f), 3);
            greenLight = ProcMesh.Emissive(new Color(0.3f, 1f, 0.45f), 3);
            redLight = ProcMesh.Emissive(new Color(1f, 0.2f, 0.12f), 3);
            var sphere = SphereMesh();
            var edge = new List<Matrix4x4>(); var green = new List<Matrix4x4>(); var red = new List<Matrix4x4>();
            for (float z = -half; z <= half; z += 60)
            {
                edge.Add(Matrix4x4.TRS(U(-hw - 2, Elev + 0.35f, z), Quaternion.identity, Vector3.one * 0.35f));
                edge.Add(Matrix4x4.TRS(U(hw + 2, Elev + 0.35f, z), Quaternion.identity, Vector3.one * 0.35f));
            }
            for (float x = -hw; x <= hw; x += 3)
            {
                green.Add(Matrix4x4.TRS(U(x, Elev + 0.3f, half + 3), Quaternion.identity, Vector3.one * 0.35f));
                green.Add(Matrix4x4.TRS(U(x, Elev + 0.3f, -half - 3), Quaternion.identity, Vector3.one * 0.35f));
            }
            var blue = new List<Matrix4x4>();
            for (float z = -half + 20; z <= half - 20; z += 45) { blue.Add(Matrix4x4.TRS(U(TwX - 9, Elev + 0.3f, z), Quaternion.identity, Vector3.one * 0.3f)); blue.Add(Matrix4x4.TRS(U(TwX + 9, Elev + 0.3f, z), Quaternion.identity, Vector3.one * 0.3f)); }
            Combine("DenLe", sphere, edge, edgeLight);
            Combine("DenTheM", sphere, green, greenLight);
            Combine("DenDuongLan", sphere, blue, ProcMesh.Emissive(new Color(0.25f, 0.4f, 1f), 3));

            // PAPI bên trái thềm 36
            for (int i = 0; i < 4; i++)
            {
                var m = ProcMesh.Emissive(Color.white, 4);
                papi.Add(m);
                var box = ProcMesh.Prim(PrimitiveType.Cube, root, U(-hw - 14 - i * 9, Elev + 0.5f, half - 300), new Vector3(1.2f, 0.8f, 0.6f), m);
                ProcMesh.Prim(PrimitiveType.Cube, root, U(-hw - 14 - i * 9, Elev + 0.2f, half - 300), new Vector3(0.3f, 0.4f, 0.3f), ProcMesh.Mat("#444444"));
            }

            Buildings(y);
            Windsock();
            VorStation();
        }

        static Mesh SphereMesh()
        {
            var go = GameObject.CreatePrimitive(PrimitiveType.Sphere);
            var m = go.GetComponent<MeshFilter>().sharedMesh;
            Object.DestroyImmediate(go);
            return m;
        }

        void Combine(string name, Mesh mesh, List<Matrix4x4> mats, Material mat)
        {
            var ci = new CombineInstance[mats.Count];
            for (int i = 0; i < mats.Count; i++) ci[i] = new CombineInstance { mesh = mesh, transform = mats[i] };
            var m = new Mesh { indexFormat = UnityEngine.Rendering.IndexFormat.UInt32 };
            m.CombineMeshes(ci, true, true);
            ProcMesh.Obj(name, m, mat, root, Vector3.zero, false);
        }

        /// <summary>Nửa trụ (mái vòm nhà chứa) dọc trục x cục bộ.</summary>
        static Mesh Vault(float r, float len, int seg)
        {
            var v = new List<Vector3>(); var idx = new List<int>();
            for (int i = 0; i <= seg; i++)
            {
                float a = Mathf.PI * i / seg;
                v.Add(new Vector3(-len / 2, Mathf.Sin(a) * r, Mathf.Cos(a) * r));
                v.Add(new Vector3(len / 2, Mathf.Sin(a) * r, Mathf.Cos(a) * r));
                if (i > 0) { int b = (i - 1) * 2; idx.Add(b); idx.Add(b + 1); idx.Add(b + 2); idx.Add(b + 1); idx.Add(b + 3); idx.Add(b + 2); }
            }
            for (int i = 0; i < idx.Count; i += 3)
            {
                Vector3 a = v[idx[i]], b = v[idx[i + 1]], c = v[idx[i + 2]];
                Vector3 n = Vector3.Cross(b - a, c - a), cen = (a + b + c) / 3;
                if (Vector3.Dot(n, new Vector3(0, cen.y, cen.z)) < 0) { int t = idx[i + 1]; idx[i + 1] = idx[i + 2]; idx[i + 2] = t; }
            }
            var m = new Mesh(); m.SetVertices(v); m.SetTriangles(idx, 0); m.RecalculateNormals(); m.RecalculateBounds();
            return m;
        }

        void Buildings(float y)
        {
            var hangar = ProcMesh.Mat("#b9bec2", 0.55f, 0.6f);
            var door = ProcMesh.Mat("#6d7378", 0.5f, 0.5f);
            var bld = ProcMesh.Mat("#e9e4d8", 0.2f);
            var glass = ProcMesh.Mat("#1d2a33", 0.92f, 0.8f);
            var roof = ProcMesh.Mat("#5a5f63", 0.3f, 0.3f);
            for (int i = 0; i < 3; i++)
            {
                float hz = -55 + i * 45;
                var h = ProcMesh.Obj("NhaChua", Vault(15, 38, 24), hangar, root, U(375, Elev, hz));
                var back = ProcMesh.Prim(PrimitiveType.Cube, root, U(394, Elev + 7, hz), new Vector3(0.4f, 14, 30), hangar);
                var d = ProcMesh.Prim(PrimitiveType.Cube, root, U(356.2f, Elev + 6.5f, hz), new Vector3(0.3f, 13, 26), door);
                var t = Text3D.Make("SẢI CÁNH  " + (i + 1), root, U(355.9f, Elev + 11f, hz), 1.4f, ProcMesh.Hex("#203040"));
                t.transform.localRotation = Quaternion.Euler(0, 90, 0);
            }
            // nhà ga
            ProcMesh.Prim(PrimitiveType.Cube, root, U(375, Elev + 4, 190), new Vector3(28, 8, 60), bld);
            ProcMesh.Prim(PrimitiveType.Cube, root, U(360.9f, Elev + 4.6f, 190), new Vector3(0.3f, 2.6f, 56), glass);
            ProcMesh.Prim(PrimitiveType.Cube, root, U(375, Elev + 8.2f, 190), new Vector3(29, 0.5f, 61), roof);
            var name = Text3D.Make("CẢNG HÀNG KHÔNG SẢI CÁNH", root, U(360.6f, Elev + 6.8f, 190), 1.6f, ProcMesh.Hex("#1e4f8c"));
            name.transform.localRotation = Quaternion.Euler(0, 90, 0);
            // đài kiểm soát
            var tw = ProcMesh.Prim(PrimitiveType.Cylinder, root, U(352, Elev + 11, 250), new Vector3(6, 11, 6), bld);
            ProcMesh.Prim(PrimitiveType.Cylinder, root, U(352, Elev + 24, 250), new Vector3(10, 2, 10), glass);
            ProcMesh.Prim(PrimitiveType.Cylinder, root, U(352, Elev + 26.4f, 250), new Vector3(11.5f, 0.4f, 11.5f), roof);
            towerBeacon = ProcMesh.Prim(PrimitiveType.Sphere, root, U(352, Elev + 27.4f, 250), Vector3.one * 1.1f, ProcMesh.Emissive(new Color(0.4f, 1f, 0.55f), 5)).transform;
            // trạm xăng
            ProcMesh.Prim(PrimitiveType.Cylinder, root, U(300, Elev + 2, -70), new Vector3(4, 2, 4), ProcMesh.Mat("#e0e0e0", 0.5f, 0.3f));
            ProcMesh.Prim(PrimitiveType.Cube, root, U(292, Elev + 0.9f, -70), new Vector3(1.2f, 1.8f, 0.8f), ProcMesh.Mat("#c0392b", 0.5f));

            // máy bay đỗ
            string[][] liv = { new[] { "#c0392b", "#2c3e50", "VN-B3K" }, new[] { "#1f5fa8", "#f1c40f", "VN-C7M" }, new[] { "#2e7d32", "#e8e8e8", "VN-D2H" } };
            for (int i = 0; i < liv.Length; i++)
            {
                var p = new AircraftVisual(root, ProcMesh.Hex(liv[i][0]), ProcMesh.Hex(liv[i][1]), liv[i][2]);
                p.root.transform.position = U(250, Elev + 1.2f, 120 + i * 30);
                p.root.transform.rotation = Quaternion.Euler(0, -90, 0); // mũi về phía tây
                p.Animate(0, new FlightControls(), new AircraftSystems(), 0, 0, false); // máy đỗ: tắt hết đèn
                parked.Add(p);
            }
        }

        void Windsock()
        {
            float x = -45, z = WorldCfg.RunwayLength / 2 - 260;
            ProcMesh.Prim(PrimitiveType.Cylinder, root, U(x, Elev + 3, z), new Vector3(0.16f, 3, 0.16f), ProcMesh.Mat("#dddddd", 0.4f));
            sock = new GameObject("OngGio").transform;
            sock.SetParent(root, false);
            sock.localPosition = U(x, Elev + 5.8f, z);
            var tex = TexGen.Paint(64, 16, (u, v) => ((int)(u * 5) % 2 == 0) ? ProcMesh.Hex("#ff5a1f") : ProcMesh.Hex("#f2f2f2"));
            var mat = ProcMesh.Mat(Color.white, 0.2f);
            mat.mainTexture = tex;
            var pts = new List<Vector3>();
            for (int i = 0; i <= 5; i++) pts.Add(new Vector3(0, 0, i * 0.7f));
            // ống côn: dùng Loft với mặt cắt tròn
            var sec = new float[6][];
            for (int i = 0; i <= 5; i++) sec[i] = new[] { i * 0.7f, 0.9f - i * 0.08f, 0.9f - i * 0.08f, 0f, 2f };
            ProcMesh.Obj("Vai", ProcMesh.Loft(sec, 14, false, 1), mat, sock);
        }

        void VorStation()
        {
            var w = ProcMesh.Mat("#f2f2f2", 0.3f);
            ProcMesh.Prim(PrimitiveType.Cylinder, root, U(Vor.x, (float)WorldGen.Height(Vor.x, Vor.y) + 2, Vor.y), new Vector3(9, 2, 9), w);
            ProcMesh.Prim(PrimitiveType.Cylinder, root, U(Vor.x, (float)WorldGen.Height(Vor.x, Vor.y) + 5, Vor.y), new Vector3(1.5f, 2, 1.5f), w);
        }

        /// <summary>Cập nhật ống gió, đèn đài, PAPI. wind: vector gió hệ bản đồ (m/s), planeMap: vị trí máy bay (bản đồ).</summary>
        public void Update(float t, Vector3 windMap, Vector3 planeMap)
        {
            if (sock != null)
            {
                float spd = new Vector2(windMap.x, windMap.z).magnitude;
                // ống gió chỉ theo hướng gió thổi tới
                Vector3 dirU = new Vector3(windMap.x, 0, -windMap.z);
                if (dirU.sqrMagnitude > 0.01f)
                {
                    float droop = Mathf.Lerp(70, 2, Mathf.Clamp01(spd / 7.7f));
                    sock.rotation = Quaternion.LookRotation(dirU) * Quaternion.Euler(droop + Mathf.Sin(t * 2.3f) * 3, Mathf.Sin(t * 1.3f) * 6, 0);
                }
            }
            if (towerBeacon != null) towerBeacon.gameObject.SetActive((t * 0.5f) % 1 < 0.5f);
            float half = WorldCfg.RunwayLength / 2;
            float dz = planeMap.z - (half - 300);
            float ang = Mathf.Atan2(planeMap.y - Elev, Mathf.Max(1, dz)) * Mathf.Rad2Deg;
            float[] lim = { 3.5f, 3.17f, 2.83f, 2.5f };
            for (int i = 0; i < papi.Count; i++)
            {
                bool whiteL = dz < 0 || ang > lim[i];
                papi[i].SetColor("_EmissionColor", (whiteL ? new Color(1, 0.97f, 0.9f) : new Color(1, 0.12f, 0.06f)) * 5);
                papi[i].color = whiteL ? Color.white : Color.red;
            }
        }
    }

    /// <summary>Thị trấn: nhà mái ngói, khối phố cao hơn ở trung tâm, gộp lưới theo cụm.</summary>
    public static class TownBuilder
    {
        public static void Build(Transform parent)
        {
            var root = new GameObject("ThiTran").transform;
            root.SetParent(parent, false);
            var wallMats = new[] { ProcMesh.Mat("#e8e0d0", 0.15f), ProcMesh.Mat("#d9c9a8", 0.15f), ProcMesh.Mat("#f2efe8", 0.15f), ProcMesh.Mat("#c9ced2", 0.2f) };
            var roofMats = new[] { ProcMesh.Mat("#9a3b26", 0.2f), ProcMesh.Mat("#6b3a2a", 0.2f), ProcMesh.Mat("#4f5458", 0.3f, 0.3f) };
            var cube = Cube(); var prism = Prism();
            var walls = new List<CombineInstance>[4]; var roofs = new List<CombineInstance>[3];
            for (int i = 0; i < 4; i++) walls[i] = new List<CombineInstance>();
            for (int i = 0; i < 3; i++) roofs[i] = new List<CombineInstance>();
            float R = WorldCfg.TownR + 300;
            for (float z = WorldCfg.TownZ - R; z < WorldCfg.TownZ + R; z += 26)
                for (float x = WorldCfg.TownX - R; x < WorldCfg.TownX + R; x += 24)
                {
                    int gx = Mathf.RoundToInt(x), gz = Mathf.RoundToInt(z);
                    // chừa đường phố theo lưới
                    if (Mathf.Abs(Mathf.Repeat(x - WorldCfg.TownX, 120)) < 24 || Mathf.Abs(Mathf.Repeat(z - WorldCfg.TownZ, 130)) < 26) continue;
                    float px = x + (WorldGen.Hash01(gx, gz, 1) - 0.5f) * 8, pz = z + (WorldGen.Hash01(gx, gz, 2) - 0.5f) * 8;
                    double tm = WorldGen.TownMask(px, pz);
                    if (WorldGen.Hash01(gx, gz, 3) > tm * 1.1) continue;
                    if (AirportBuilder.IsPaved(px, pz, 30)) continue;
                    float h = (float)WorldGen.Height(px, pz);
                    if (h < 2) continue;
                    float dc = new Vector2(px - WorldCfg.TownX, pz - WorldCfg.TownZ).magnitude;
                    bool tall = dc < 300 && WorldGen.Hash01(gx, gz, 4) < 0.5f;
                    float w = 7 + WorldGen.Hash01(gx, gz, 5) * 6, l = 8 + WorldGen.Hash01(gx, gz, 6) * 8;
                    float hh = tall ? 9 + WorldGen.Hash01(gx, gz, 7) * 18 : 3.2f + WorldGen.Hash01(gx, gz, 7) * 3;
                    var rot = Quaternion.Euler(0, (WorldGen.Hash01(gx, gz, 8) < 0.5f ? 0 : 90) + 24, 0);
                    Vector3 basePos = new Vector3(px, h - 1, -pz);
                    int wm = (int)(WorldGen.Hash01(gx, gz, 9) * 3.99f);
                    walls[wm].Add(new CombineInstance { mesh = cube, transform = Matrix4x4.TRS(basePos + Vector3.up * (hh + 1) / 2, rot, new Vector3(w, hh + 1, l)) });
                    if (tall) roofs[2].Add(new CombineInstance { mesh = cube, transform = Matrix4x4.TRS(basePos + Vector3.up * (hh + 1.15f), rot, new Vector3(w + 0.4f, 0.3f, l + 0.4f)) });
                    else roofs[WorldGen.Hash01(gx, gz, 10) < 0.7f ? 0 : 1].Add(new CombineInstance { mesh = prism, transform = Matrix4x4.TRS(basePos + Vector3.up * (hh + 1), rot, new Vector3(w + 0.8f, 2.6f, l + 0.8f)) });
                }
            for (int i = 0; i < 4; i++) Emit(root, "Tuong" + i, walls[i], wallMats[i]);
            for (int i = 0; i < 3; i++) Emit(root, "Mai" + i, roofs[i], roofMats[i]);
        }

        static void Emit(Transform root, string name, List<CombineInstance> list, Material mat)
        {
            for (int s = 0; s < list.Count; s += 2000)
            {
                var part = list.GetRange(s, Mathf.Min(2000, list.Count - s));
                var m = new Mesh { indexFormat = UnityEngine.Rendering.IndexFormat.UInt32 };
                m.CombineMeshes(part.ToArray(), true, true);
                ProcMesh.Obj(name, m, mat, root, Vector3.zero, true);
            }
        }

        static Mesh Cube()
        {
            var go = GameObject.CreatePrimitive(PrimitiveType.Cube);
            var m = go.GetComponent<MeshFilter>().sharedMesh;
            Object.DestroyImmediate(go);
            return m;
        }

        /// <summary>Mái dốc hai phía: lăng trụ tam giác, đáy rộng 1×1 tại y=0, đỉnh y=1.</summary>
        static Mesh Prism()
        {
            var v = new List<Vector3>(); var idx = new List<int>();
            Vector3 a = new Vector3(-0.5f, 0, -0.5f), b = new Vector3(0.5f, 0, -0.5f), c = new Vector3(0, 1, -0.5f);
            Vector3 d = new Vector3(-0.5f, 0, 0.5f), e = new Vector3(0.5f, 0, 0.5f), f = new Vector3(0, 1, 0.5f);
            System.Action<Vector3, Vector3, Vector3> tri = (p, q, r) =>
            {
                int k = v.Count; v.Add(p); v.Add(q); v.Add(r);
                Vector3 n = Vector3.Cross(q - p, r - p), cen = (p + q + r) / 3;
                if (Vector3.Dot(n, cen - new Vector3(0, 0.33f, 0)) < 0) { idx.Add(k); idx.Add(k + 2); idx.Add(k + 1); } else { idx.Add(k); idx.Add(k + 1); idx.Add(k + 2); }
            };
            tri(a, b, c); tri(d, e, f);
            tri(a, c, f); tri(a, f, d);
            tri(b, e, f); tri(b, f, c);
            var m = new Mesh(); m.SetVertices(v); m.SetTriangles(idx, 0); m.RecalculateNormals(); m.RecalculateBounds();
            return m;
        }
    }
}

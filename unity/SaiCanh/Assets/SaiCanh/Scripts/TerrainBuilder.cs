// Dựng địa hình bằng Unity Terrain: 7×7 ô 4096 m (28 km), độ cao từ WorldGen, 8 lớp kết cấu
// (cỏ, ruộng vàng, ruộng xanh, đất cày, đất rừng, đá, tuyết, cát), cây rừng 3 loài và cỏ chi tiết quanh sân bay.
// Tính toán nặng chạy song song nhiều luồng (WorldGen là hàm thuần, an toàn đa luồng).
using System;
using System.Collections;
using System.Collections.Generic;
using System.Threading.Tasks;
using UnityEngine;

namespace SaiCanh
{
    public class TerrainBuilder
    {
        public const int Tiles = 7;
        public const float TileSize = 4096f;
        public const int HeightRes = 257;
        public const float BaseY = -80f, SizeY = 2800f;
        public static float Origin { get { return -Tiles * TileSize / 2f; } }

        public readonly Terrain[,] terrains = new Terrain[Tiles, Tiles];
        public float progress;
        public string status = "";

        /// <summary>Số lớp cây; tăng/giảm theo chất lượng.</summary>
        public float treeSpacing = 20f;
        public int treeTiles = 3; // số ô ở giữa (3×3) có cây
        public int grassTiles = 1; // 1 = chỉ ô sân bay, 3 = 3×3

        TerrainLayer[] layers;
        TreePrototype[] trees;
        DetailPrototype[] details;

        TerrainLayer Layer(Texture2D t, float size)
        {
            var l = new TerrainLayer { diffuseTexture = t, tileSize = new Vector2(size, size), smoothness = 0.05f, metallic = 0 };
            return l;
        }

        void MakeAssets(Transform holder)
        {
            status = "Tạo kết cấu mặt đất";
            layers = new[]
            {
                Layer(TexGen.Ground(ProcMesh.Hex("#4f6b2c"), ProcMesh.Hex("#6f8a3a"), 11, 0.07f, 0, ProcMesh.Hex("#8a8a4a")), 14), // 0 cỏ
                Layer(TexGen.Ground(ProcMesh.Hex("#a9944f"), ProcMesh.Hex("#c4ae66"), 12, 0.06f, 22), 30), // 1 ruộng vàng
                Layer(TexGen.Ground(ProcMesh.Hex("#4c6a27"), ProcMesh.Hex("#5f8030"), 13, 0.06f, 30), 26), // 2 ruộng xanh
                Layer(TexGen.Ground(ProcMesh.Hex("#5e4a35"), ProcMesh.Hex("#76603f"), 14, 0.08f, 34), 24), // 3 đất cày
                Layer(TexGen.Ground(ProcMesh.Hex("#22331a"), ProcMesh.Hex("#34462a"), 15, 0.1f, 0, ProcMesh.Hex("#4a3a26")), 18), // 4 đất rừng
                Layer(TexGen.Ground(ProcMesh.Hex("#6c6660"), ProcMesh.Hex("#8f8a82"), 16, 0.14f, 0, ProcMesh.Hex("#4a4642")), 40), // 5 đá
                Layer(TexGen.Ground(ProcMesh.Hex("#e8eef4"), ProcMesh.Hex("#ffffff"), 17, 0.03f), 30), // 6 tuyết
                Layer(TexGen.Ground(ProcMesh.Hex("#c8b88e"), ProcMesh.Hex("#ddd0a8"), 18, 0.05f), 12), // 7 cát
            };

            status = "Tạo cây";
            var bark = ProcMesh.Mat("#4a3826", 0.1f);
            trees = new[]
            {
                new TreePrototype { prefab = TreeMaker.Pine(holder, bark, ProcMesh.Mat("#1f3a20", 0.1f)), bendFactor = 0 },
                new TreePrototype { prefab = TreeMaker.Pine(holder, bark, ProcMesh.Mat("#2a4626", 0.1f)), bendFactor = 0 },
                new TreePrototype { prefab = TreeMaker.Broadleaf(holder, bark, ProcMesh.Mat("#3a5a26", 0.12f)), bendFactor = 0 },
                new TreePrototype { prefab = TreeMaker.Broadleaf(holder, bark, ProcMesh.Mat("#4d6b2e", 0.12f)), bendFactor = 0 },
            };

            var grassTex = TexGen.GrassBlades();
            details = new[]
            {
                new DetailPrototype
                {
                    prototypeTexture = grassTex, renderMode = DetailRenderMode.GrassBillboard, usePrototypeMesh = false,
                    minWidth = 0.5f, maxWidth = 0.9f, minHeight = 0.25f, maxHeight = 0.55f, noiseSpread = 0.3f,
                    healthyColor = ProcMesh.Hex("#8aa04a"), dryColor = ProcMesh.Hex("#b3a35c"),
                },
            };
        }

        /// <summary>Dựng toàn bộ địa hình (coroutine, cập nhật progress 0..1).</summary>
        public IEnumerator Build(Transform parent)
        {
            var root = new GameObject("DiaHinh").transform;
            root.SetParent(parent, false);
            var holder = new GameObject("MauCay").transform;
            holder.SetParent(root, false);
            holder.position = new Vector3(0, -5000, 0);
            MakeAssets(holder);
            yield return null;

            int total = Tiles * Tiles, done = 0;
            int c = Tiles / 2;
            // xây từ giữa ra ngoài để vùng sân bay có trước
            var order = new List<Vector2Int>();
            for (int j = 0; j < Tiles; j++) for (int i = 0; i < Tiles; i++) order.Add(new Vector2Int(i, j));
            order.Sort((a, b) => (Mathf.Abs(a.x - c) + Mathf.Abs(a.y - c)).CompareTo(Mathf.Abs(b.x - c) + Mathf.Abs(b.y - c)));
            foreach (var ij in order)
            {
                int i = ij.x, j = ij.y;
                int ring = Mathf.Max(Mathf.Abs(i - c), Mathf.Abs(j - c));
                status = "Dựng địa hình ô " + (done + 1) + "/" + total;
                Task<TileData> task = Task.Run(() => Compute(i, j, ring));
                while (!task.IsCompleted) yield return null;
                if (task.Exception != null) { Debug.LogException(task.Exception); continue; }
                terrains[i, j] = Create(task.Result, root);
                done++;
                progress = done / (float)total;
                yield return null;
            }
            for (int j = 0; j < Tiles; j++)
                for (int i = 0; i < Tiles; i++)
                {
                    var t = terrains[i, j];
                    if (t == null) continue;
                    t.SetNeighbors(i > 0 ? terrains[i - 1, j] : null, j < Tiles - 1 ? terrains[i, j + 1] : null,
                                   i < Tiles - 1 ? terrains[i + 1, j] : null, j > 0 ? terrains[i, j - 1] : null);
                }
            status = "Xong địa hình";
        }

        class TileData
        {
            public int i, j, ring;
            public float[,] heights;
            public float[,,] alpha;
            public int alphaRes;
            public List<TreeInstance> trees;
            public int[,] grass;
            public int detailRes;
        }

        /// <summary>Toạ độ Unity của góc ô (x, z nhỏ nhất).</summary>
        public static Vector2 TileCorner(int i, int j) { return new Vector2(Origin + i * TileSize, Origin + j * TileSize); }

        TileData Compute(int i, int j, int ring)
        {
            var d = new TileData { i = i, j = j, ring = ring };
            Vector2 c0 = TileCorner(i, j);
            int N = HeightRes;
            float step = TileSize / (N - 1);
            var hs = new float[N, N];
            var hRaw = new float[N, N];
            Parallel.For(0, N, row =>
            {
                double zU = c0.y + row * step;
                for (int col = 0; col < N; col++)
                {
                    double x = c0.x + col * step;
                    double h = WorldGen.Height(x, -zU);
                    hRaw[row, col] = (float)h;
                    hs[row, col] = Mathf.Clamp01((float)((h - BaseY) / SizeY));
                }
            });
            d.heights = hs;

            // lớp kết cấu
            int A = ring <= 1 ? 512 : 256;
            d.alphaRes = A;
            var al = new float[A, A, 8];
            float astep = TileSize / A;
            Parallel.For(0, A, row =>
            {
                double zU = c0.y + (row + 0.5) * astep;
                var w = new float[8];
                for (int col = 0; col < A; col++)
                {
                    double x = c0.x + (col + 0.5) * astep;
                    double zM = -zU;
                    float fr = (float)(row + 0.5f) / A * (N - 1), fc = (float)(col + 0.5f) / A * (N - 1);
                    float h = Sample(hRaw, fr, fc, N);
                    float hx = Sample(hRaw, fr, Mathf.Min(N - 1, fc + 1), N) - Sample(hRaw, fr, Mathf.Max(0, fc - 1), N);
                    float hz = Sample(hRaw, Mathf.Min(N - 1, fr + 1), fc, N) - Sample(hRaw, Mathf.Max(0, fr - 1), fc, N);
                    float slope = Mathf.Sqrt(hx * hx + hz * hz) / (2 * step);
                    Splat(x, zM, h, slope, w);
                    for (int k = 0; k < 8; k++) al[row, col, k] = w[k];
                }
            });
            d.alpha = al;

            // cây
            d.trees = new List<TreeInstance>();
            int tc = Tiles / 2, tr = treeTiles / 2;
            if (Mathf.Abs(i - tc) <= tr && Mathf.Abs(j - tc) <= tr)
            {
                int n = (int)(TileSize / treeSpacing);
                var lists = new List<TreeInstance>[n];
                Parallel.For(0, n, row =>
                {
                    var list = new List<TreeInstance>();
                    for (int col = 0; col < n; col++)
                    {
                        int gx = i * n + col, gz = j * n + row;
                        float jx = WorldGen.Hash01(gx, gz, 1), jz = WorldGen.Hash01(gx, gz, 2), pr = WorldGen.Hash01(gx, gz, 3);
                        float u = (col + jx) / n, v = (row + jz) / n;
                        double x = c0.x + u * TileSize, zU = c0.y + v * TileSize;
                        float h = Sample(hRaw, v * (N - 1), u * (N - 1), N);
                        double f = WorldGen.Forest(x, -zU, h);
                        // cây lẻ dọc bờ ruộng
                        double hedge;
                        if (f < 0.05 && h > 5 && h < 400 && WorldGen.TownMask(x, -zU) < 0.2 && WorldGen.AirportMask(x, -zU) < 0.05)
                        {
                            WorldGen.FieldCell(x, -zU, out hedge);
                            f = hedge * 0.35;
                        }
                        if (pr > f) continue;
                        float sz = 0.75f + WorldGen.Hash01(gx, gz, 4) * 0.6f;
                        int proto = h > 500 ? (WorldGen.Hash01(gx, gz, 5) < 0.85f ? 0 : 1) : (int)(WorldGen.Hash01(gx, gz, 5) * 3.99f);
                        list.Add(new TreeInstance
                        {
                            position = new Vector3(u, (h - BaseY) / SizeY, v),
                            prototypeIndex = proto,
                            widthScale = sz, heightScale = sz * (0.85f + WorldGen.Hash01(gx, gz, 6) * 0.35f),
                            rotation = WorldGen.Hash01(gx, gz, 7) * Mathf.PI * 2,
                            color = Color.white, lightmapColor = Color.white,
                        });
                    }
                    lists[row] = list;
                });
                foreach (var l in lists) d.trees.AddRange(l);
            }

            // cỏ chi tiết
            int gr = grassTiles / 2;
            if (Mathf.Abs(i - tc) <= gr && Mathf.Abs(j - tc) <= gr)
            {
                int R = 1024;
                d.detailRes = R;
                var g = new int[R, R];
                float gstep = TileSize / R;
                Parallel.For(0, R, row =>
                {
                    for (int col = 0; col < R; col++)
                    {
                        double x = c0.x + (col + 0.5) * gstep, zM = -(c0.y + (row + 0.5) * gstep);
                        if (AirportBuilder.IsPaved(x, zM, 4)) continue;
                        float h = Sample(hRaw, (row + 0.5f) / R * (N - 1), (col + 0.5f) / R * (N - 1), N);
                        if (h < 3) continue;
                        double f = WorldGen.Forest(x, zM, h);
                        if (f > 0.5) continue;
                        double dist = Math.Sqrt(x * x + zM * zM);
                        g[row, col] = dist < 1600 ? 6 : 3;
                    }
                });
                d.grass = g;
            }
            return d;
        }

        static float Sample(float[,] h, float r, float c, int N)
        {
            int r0 = Mathf.Clamp((int)r, 0, N - 2), c0 = Mathf.Clamp((int)c, 0, N - 2);
            float fr = r - r0, fc = c - c0;
            float a = h[r0, c0] + (h[r0, c0 + 1] - h[r0, c0]) * fc;
            float b = h[r0 + 1, c0] + (h[r0 + 1, c0 + 1] - h[r0 + 1, c0]) * fc;
            return a + (b - a) * fr;
        }

        /// <summary>Trọng số 8 lớp tại một điểm (toạ độ bản đồ).</summary>
        static void Splat(double x, double z, float h, float slope, float[] w)
        {
            for (int k = 0; k < 8; k++) w[k] = 0;
            float grass = 1;
            // ruộng ở vùng thấp
            double air = WorldGen.AirportMask(x, z), town = WorldGen.TownMask(x, z);
            double forest = WorldGen.Forest(x, z, h);
            float field = (float)(WorldGen.Smooth(380, 220, h) * (1 - air) * (1 - town * 0.8));
            if (field > 0)
            {
                double hedge;
                int crop = WorldGen.FieldCell(x, z, out hedge);
                int layer = crop <= 1 ? 1 : crop <= 3 ? 2 : crop == 4 ? 0 : 3;
                w[layer] += field;
                w[4] += (float)hedge * field * 0.8f;
                grass -= field;
            }
            if (grass > 0) w[0] += grass;
            float fo = (float)forest;
            for (int k = 0; k < 8; k++) w[k] *= 1 - fo;
            w[4] += fo;
            // thị trấn: đất nện xen cỏ
            if (town > 0.2) { float t = (float)town * 0.5f; for (int k = 0; k < 8; k++) w[k] *= 1 - t; w[3] += t * 0.5f; w[7] += t * 0.5f; }
            // bờ biển, hồ
            float sand = (float)WorldGen.Smooth(7, 1.5, h);
            // đá theo độ dốc và độ cao
            float rock = Mathf.Clamp01((slope - 0.45f) * 3f) + (float)WorldGen.Smooth(1100, 1500, h) * 0.7f;
            rock = Mathf.Clamp01(rock + (float)WorldGen.Fbm(x / 300, z / 300, 2) * 0.6f * (h > 600 ? 1 : 0));
            float snow = (float)WorldGen.Smooth(1550, 1800, h + WorldGen.Fbm(x / 500, z / 500, 3) * 300) * Mathf.Clamp01(1.4f - slope);
            float s = 0; for (int k = 0; k < 8; k++) s += w[k];
            for (int k = 0; k < 8; k++) w[k] = w[k] / Mathf.Max(1e-4f, s) * (1 - sand) * (1 - rock) * (1 - snow);
            w[7] += sand * (1 - rock);
            w[5] += rock * (1 - snow);
            w[6] += snow;
            s = 0; for (int k = 0; k < 8; k++) s += w[k];
            for (int k = 0; k < 8; k++) w[k] /= Mathf.Max(1e-4f, s);
        }

        Terrain Create(TileData d, Transform root)
        {
            var td = new TerrainData();
            td.heightmapResolution = HeightRes;
            td.size = new Vector3(TileSize, SizeY, TileSize);
            td.SetHeights(0, 0, d.heights);
            td.alphamapResolution = d.alphaRes;
            td.baseMapResolution = 512;
            td.terrainLayers = layers;
            td.SetAlphamaps(0, 0, d.alpha);
            td.treePrototypes = trees;
            if (d.trees.Count > 0) td.SetTreeInstances(d.trees.ToArray(), false);
            if (d.grass != null)
            {
                // Unity 2022.2+: chọn chế độ "số cây mỗi ô" (mặc định mới là độ phủ 0..255)
                var mi = typeof(TerrainData).GetMethod("SetDetailScatterMode");
                if (mi != null)
                {
                    var enumT = mi.GetParameters()[0].ParameterType;
                    mi.Invoke(td, new object[] { Enum.ToObject(enumT, 1) });
                }
                td.SetDetailResolution(d.detailRes, 16);
                td.detailPrototypes = details;
                td.SetDetailLayer(0, 0, 0, d.grass);
                td.wavingGrassAmount = 0.25f; td.wavingGrassSpeed = 0.4f; td.wavingGrassStrength = 0.3f;
                td.wavingGrassTint = ProcMesh.Hex("#b7c48a");
            }
            var go = Terrain.CreateTerrainGameObject(td);
            go.name = "O_" + d.i + "_" + d.j;
            go.transform.SetParent(root, false);
            Vector2 c0 = TileCorner(d.i, d.j);
            go.transform.position = new Vector3(c0.x, BaseY, c0.y);
            var t = go.GetComponent<Terrain>();
            t.heightmapPixelError = d.ring <= 1 ? 3 : 6;
            t.basemapDistance = 1800;
            t.treeDistance = 2200;
            t.treeBillboardDistance = 2200;
            t.treeCrossFadeLength = 0;
            t.treeMaximumFullLODCount = 2000;
            t.detailObjectDistance = 160;
            t.detailObjectDensity = 1;
            t.drawInstanced = true;
            t.shadowCastingMode = UnityEngine.Rendering.ShadowCastingMode.On;
            t.groupingID = 1;
            t.allowAutoConnect = true;
            return t;
        }

        /// <summary>Độ cao mặt đất hiển thị (khớp lưới Terrain) tại toạ độ bản đồ.</summary>
        public float SampleHeight(double x, double zMap)
        {
            float zU = (float)-zMap;
            int i = Mathf.FloorToInt(((float)x - Origin) / TileSize), j = Mathf.FloorToInt((zU - Origin) / TileSize);
            if (i >= 0 && j >= 0 && i < Tiles && j < Tiles && terrains[i, j] != null)
                return terrains[i, j].SampleHeight(new Vector3((float)x, 0, zU)) + BaseY;
            return (float)WorldGen.Height(x, zMap);
        }
    }

    /// <summary>Mẫu cây đơn giản (lưới thấp) cho Terrain.</summary>
    public static class TreeMaker
    {
        static Mesh Cone(float r, float h, float y0, int sides, float jitter, int seed)
        {
            var v = new List<Vector3>(); var idx = new List<int>();
            var rnd = new System.Random(seed);
            v.Add(new Vector3(0, y0 + h, 0));
            for (int i = 0; i < sides; i++)
            {
                float a = i / (float)sides * Mathf.PI * 2;
                float rr = r * (1 + ((float)rnd.NextDouble() - 0.5f) * jitter);
                v.Add(new Vector3(Mathf.Cos(a) * rr, y0 + ((float)rnd.NextDouble() - 0.5f) * jitter * 0.4f, Mathf.Sin(a) * rr));
            }
            v.Add(new Vector3(0, y0 + h * 0.08f, 0));
            int bot = v.Count - 1;
            for (int i = 0; i < sides; i++)
            {
                int a = 1 + i, b = 1 + (i + 1) % sides;
                idx.Add(0); idx.Add(b); idx.Add(a);
                idx.Add(bot); idx.Add(a); idx.Add(b);
            }
            var m = new Mesh(); m.SetVertices(v); m.SetTriangles(idx, 0); m.RecalculateNormals(); m.RecalculateBounds();
            return m;
        }

        static Mesh Blob(float r, float y, int seed)
        {
            // khối cầu méo (icosphere bậc 1)
            var go = GameObject.CreatePrimitive(PrimitiveType.Sphere);
            var src = go.GetComponent<MeshFilter>().sharedMesh;
            UnityEngine.Object.DestroyImmediate(go);
            var v = src.vertices;
            var rnd = new System.Random(seed);
            for (int i = 0; i < v.Length; i++)
            {
                var p = v[i];
                float n = (float)WorldGen.Noise(p.x * 3 + seed, p.z * 3 + p.y * 2) * 0.5f;
                v[i] = new Vector3(p.x * 2 * r * (1 + n), y + p.y * 2 * r * 0.85f * (1 + n), p.z * 2 * r * (1 + n));
            }
            var m = new Mesh(); m.vertices = v; m.triangles = src.triangles; m.RecalculateNormals(); m.RecalculateBounds();
            return m;
        }

        static GameObject Assemble(Transform holder, string name, Mesh trunk, Mesh crown, Material bark, Material leaf)
        {
            var ci = new[] { new CombineInstance { mesh = trunk, transform = Matrix4x4.identity }, new CombineInstance { mesh = crown, transform = Matrix4x4.identity } };
            var m = new Mesh();
            m.CombineMeshes(ci, false, false);
            var go = new GameObject(name);
            go.transform.SetParent(holder, false);
            go.AddComponent<MeshFilter>().sharedMesh = m;
            bark.enableInstancing = leaf.enableInstancing = true;
            go.AddComponent<MeshRenderer>().sharedMaterials = new[] { bark, leaf };
            return go;
        }

        public static GameObject Pine(Transform holder, Material bark, Material leaf)
        {
            var trunk = Cone(0.35f, 4f, 0, 5, 0, 1);
            var ci = new[]
            {
                new CombineInstance { mesh = Cone(2.6f, 6f, 2.5f, 7, 0.3f, 2), transform = Matrix4x4.identity },
                new CombineInstance { mesh = Cone(2.0f, 5f, 5.5f, 7, 0.3f, 3), transform = Matrix4x4.identity },
                new CombineInstance { mesh = Cone(1.3f, 4f, 8.5f, 6, 0.3f, 4), transform = Matrix4x4.identity },
            };
            var crown = new Mesh(); crown.CombineMeshes(ci, true, true);
            return Assemble(holder, "Thong", trunk, crown, bark, leaf);
        }

        public static GameObject Broadleaf(Transform holder, Material bark, Material leaf)
        {
            var trunk = Cone(0.4f, 5f, 0, 5, 0, 5);
            return Assemble(holder, "CayLa", trunk, Blob(2.8f, 6.2f, 9), bark, leaf);
        }
    }
}

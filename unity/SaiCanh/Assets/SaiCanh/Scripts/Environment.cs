// Bầu trời, mặt trời, sương mù, ánh sáng môi trường, mặt nước và các đám mây tích.
using System.Collections.Generic;
using UnityEngine;
using UnityEngine.Rendering;

namespace SaiCanh
{
    /// <summary>Thời điểm trong ngày: góc mặt trời và màu sắc.</summary>
    public struct TimeOfDay
    {
        public string name;
        public float sunElev, sunAz, exposure, fogDensity;
        public Color sun, fog, sky, cloudLit, cloudShade;
        public float hour;
    }

    public class Environment
    {
        public static readonly TimeOfDay[] Times =
        {
            new TimeOfDay { name = "Buổi sáng", hour = 8.5f, sunElev = 24, sunAz = 115, exposure = 1.25f, fogDensity = 0.000045f,
                sun = new Color(1f, 0.93f, 0.82f), fog = new Color(0.7f, 0.78f, 0.86f), sky = new Color(0.55f, 0.7f, 0.88f), cloudLit = new Color(1f, 0.98f, 0.95f), cloudShade = new Color(0.62f, 0.67f, 0.76f) },
            new TimeOfDay { name = "Buổi trưa", hour = 12.5f, sunElev = 62, sunAz = 190, exposure = 1.15f, fogDensity = 0.00004f,
                sun = new Color(1f, 0.98f, 0.93f), fog = new Color(0.72f, 0.8f, 0.9f), sky = new Color(0.5f, 0.68f, 0.9f), cloudLit = Color.white, cloudShade = new Color(0.66f, 0.7f, 0.78f) },
            new TimeOfDay { name = "Hoàng hôn", hour = 18.1f, sunElev = 5, sunAz = 285, exposure = 1.4f, fogDensity = 0.00006f,
                sun = new Color(1f, 0.62f, 0.36f), fog = new Color(0.86f, 0.66f, 0.52f), sky = new Color(0.62f, 0.6f, 0.7f), cloudLit = new Color(1f, 0.72f, 0.5f), cloudShade = new Color(0.42f, 0.38f, 0.46f) },
        };

        public Light sun;
        public TimeOfDay time;
        GameObject water;
        Material waterMat, cloudMat, skyMat;
        readonly List<Transform> clouds = new List<Transform>();
        ReflectionProbe probe;
        Transform root;

        public void Build(Transform parent, int timeIndex, int cloudCount)
        {
            root = new GameObject("MoiTruong").transform;
            root.SetParent(parent, false);
            time = Times[Mathf.Clamp(timeIndex, 0, Times.Length - 1)];

            var sg = new GameObject("MatTroi");
            sg.transform.SetParent(root, false);
            sun = sg.AddComponent<Light>();
            sun.type = LightType.Directional;
            sun.shadows = LightShadows.Soft;
            sun.shadowStrength = 0.85f;
            sun.shadowBias = 0.03f; sun.shadowNormalBias = 0.25f;
            RenderSettings.sun = sun;

            var skySh = Shader.Find("Skybox/Procedural");
            if (skySh != null)
            {
                skyMat = new Material(skySh);
                skyMat.SetFloat("_SunSize", 0.035f);
                skyMat.SetFloat("_SunSizeConvergence", 6f);
                skyMat.SetFloat("_AtmosphereThickness", 0.95f);
                skyMat.SetColor("_GroundColor", new Color(0.42f, 0.44f, 0.46f));
                RenderSettings.skybox = skyMat;
            }
            RenderSettings.fog = true;
            RenderSettings.fogMode = FogMode.ExponentialSquared;
            RenderSettings.ambientMode = AmbientMode.Skybox;
            RenderSettings.defaultReflectionMode = DefaultReflectionMode.Skybox;

            // mặt nước: tấm lớn bám theo camera
            var wsh = Shader.Find("SaiCanh/Water");
            waterMat = wsh != null ? new Material(wsh) : ProcMesh.Mat("#123a4a", 0.9f);
            waterMat.SetTexture("_Wave", TexGen.WaveNormals());
            water = GameObject.CreatePrimitive(PrimitiveType.Plane);
            Object.Destroy(water.GetComponent<Collider>());
            water.name = "MatNuoc";
            water.transform.SetParent(root, false);
            water.transform.localScale = new Vector3(9000, 1, 9000); // 90 km
            water.GetComponent<MeshRenderer>().sharedMaterial = waterMat;
            water.GetComponent<MeshRenderer>().shadowCastingMode = ShadowCastingMode.Off;

            Clouds(cloudCount);
            Apply(time);

            // đầu dò phản chiếu bầu trời (cho sơn máy bay, kính, nước)
            var pg = new GameObject("PhanChieu");
            pg.transform.SetParent(root, false);
            probe = pg.AddComponent<ReflectionProbe>();
            probe.mode = ReflectionProbeMode.Realtime;
            probe.refreshMode = ReflectionProbeRefreshMode.ViaScripting;
            probe.timeSlicingMode = ReflectionProbeTimeSlicingMode.NoTimeSlicing;
            probe.size = new Vector3(100000, 20000, 100000);
            probe.cullingMask = 0; // chỉ bầu trời
            probe.clearFlags = ReflectionProbeClearFlags.Skybox;
            probe.resolution = 128;
            probe.importance = 0;
            probe.RenderProbe();
        }

        public void Apply(TimeOfDay t)
        {
            time = t;
            sun.transform.rotation = Quaternion.Euler(t.sunElev, t.sunAz, 0);
            sun.color = t.sun;
            sun.intensity = Mathf.Lerp(0.75f, 1.25f, Mathf.Clamp01(t.sunElev / 40f));
            if (skyMat != null) skyMat.SetFloat("_Exposure", t.exposure);
            RenderSettings.fogColor = t.fog;
            RenderSettings.fogDensity = t.fogDensity;
            RenderSettings.ambientIntensity = 1.0f;
            if (waterMat != null) waterMat.SetColor("_Sky", t.sky);
            if (cloudMat != null) { cloudMat.SetColor("_Lit", t.cloudLit); cloudMat.SetColor("_Shade", t.cloudShade); }
            DynamicGI.UpdateEnvironment();
            if (probe != null) probe.RenderProbe();
        }

        void Clouds(int count)
        {
            var sh = Shader.Find("SaiCanh/Cloud");
            if (sh == null) return;
            cloudMat = new Material(sh);
            cloudMat.mainTexture = TexGen.Puff();
            var rnd = new System.Random(77);
            for (int c = 0; c < count; c++)
            {
                float cx = (float)(rnd.NextDouble() - 0.5) * 36000, cz = (float)(rnd.NextDouble() - 0.5) * 36000;
                float baseY = 1350 + (float)rnd.NextDouble() * 500;
                float size = 260 + (float)rnd.NextDouble() * 520;
                if (new Vector2(cx, cz).magnitude < 1500) continue; // trời quang trên sân bay
                var v = new List<Vector3>(); var n = new List<Vector3>(); var uv = new List<Vector2>(); var col = new List<Color>(); var idx = new List<int>();
                int puffs = 10 + rnd.Next(14);
                float top = 0;
                var centers = new List<Vector3>();
                for (int p = 0; p < puffs; p++)
                {
                    float a = (float)rnd.NextDouble() * Mathf.PI * 2, r = (float)rnd.NextDouble() * size;
                    float py = (float)rnd.NextDouble() * size * 0.55f * (1 - r / size * 0.6f);
                    centers.Add(new Vector3(Mathf.Cos(a) * r, py, Mathf.Sin(a) * r * 0.7f));
                    top = Mathf.Max(top, py);
                }
                // đáy phẳng: thêm hàng hình nộm dẹt ở đáy
                for (int p = 0; p < 6; p++) centers.Add(new Vector3(((float)rnd.NextDouble() - 0.5f) * size * 1.4f, 0, ((float)rnd.NextDouble() - 0.5f) * size));
                foreach (var cc in centers)
                {
                    float pr = size * (0.45f + (float)rnd.NextDouble() * 0.35f);
                    float lit = Mathf.Clamp01(0.35f + 0.65f * cc.y / Mathf.Max(1, top));
                    int b = v.Count;
                    v.Add(new Vector3(-pr, -pr, 0)); v.Add(new Vector3(pr, -pr, 0)); v.Add(new Vector3(pr, pr, 0)); v.Add(new Vector3(-pr, pr, 0));
                    for (int k = 0; k < 4; k++) { n.Add(cc); col.Add(new Color(lit, lit, lit, 0.85f)); }
                    uv.Add(new Vector2(0, 0)); uv.Add(new Vector2(1, 0)); uv.Add(new Vector2(1, 1)); uv.Add(new Vector2(0, 1));
                    idx.Add(b); idx.Add(b + 1); idx.Add(b + 2); idx.Add(b); idx.Add(b + 2); idx.Add(b + 3);
                }
                var m = new Mesh();
                m.SetVertices(v); m.SetNormals(n); m.SetUVs(0, uv); m.SetColors(col); m.SetTriangles(idx, 0);
                m.bounds = new Bounds(new Vector3(0, size * 0.3f, 0), new Vector3(size * 3.2f, size * 2.2f, size * 3.2f));
                var go = ProcMesh.Obj("May", m, cloudMat, root, new Vector3(cx, baseY, cz), false);
                go.GetComponent<MeshRenderer>().receiveShadows = false;
                clouds.Add(go.transform);
            }
        }

        /// <summary>Mặt nước bám camera; mây trôi theo gió.</summary>
        public void Update(Vector3 camPos, Vector3 windUnity, float dt)
        {
            if (water != null) water.transform.position = new Vector3(Mathf.Round(camPos.x / 500) * 500, WorldCfg.Sea, Mathf.Round(camPos.z / 500) * 500);
            Vector3 drift = new Vector3(windUnity.x, 0, windUnity.z) * dt;
            foreach (var c in clouds)
            {
                var p = c.position + drift;
                if (p.x - camPos.x > 18000) p.x -= 36000; else if (p.x - camPos.x < -18000) p.x += 36000;
                if (p.z - camPos.z > 18000) p.z -= 36000; else if (p.z - camPos.z < -18000) p.z += 36000;
                c.position = p;
            }
        }
    }
}

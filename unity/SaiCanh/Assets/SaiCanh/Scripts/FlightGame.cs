// Điều khiển chính của Sải Cánh: tự dựng cảnh khi bấm Play, nhận phím/chuột/cần lái, chạy mô phỏng,
// đặt camera buồng lái (2 camera: thế giới + buồng lái) và camera ngoài, âm thanh, kịch bản bay.
using System;
using System.Collections;
using System.Threading.Tasks;
using UnityEngine;

namespace SaiCanh
{
    /// <summary>Môi trường vật lý: mặt đất theo Terrain, mặt nước, gió có giật.</summary>
    public class GameEnv : IFlightEnv
    {
        public TerrainBuilder terrain;
        public SimState S;
        public double gustiness = 1;

        public double Surface(double x, double z, out bool water)
        {
            double h = terrain != null ? terrain.SampleHeight(x, z) : WorldGen.Height(x, z);
            water = h < WorldCfg.Sea;
            return water ? WorldCfg.Sea : h;
        }

        public V3 SurfaceNormal(double x, double z)
        {
            bool w;
            double e = 2;
            double hx = Surface(x + e, z, out w) - Surface(x - e, z, out w);
            double hz = Surface(x, z + e, out w) - Surface(x, z - e, out w);
            return new V3(-hx, 2 * e, -hz).Norm;
        }

        public V3 Wind(double t, V3 pos)
        {
            bool w;
            double agl = Math.Max(0, pos.y - Surface(pos.x, pos.z, out w));
            double prof = Math.Min(1, Math.Log(1 + agl / 0.3) / Math.Log(1 + 300 / 0.3)) * 0.6 + 0.4;
            double to = (S.windFromDeg + 180) * Math.PI / 180;
            double spd = S.windKt * 0.5144 * prof * (1 + 0.18 * gustiness * WorldGen.Noise(t * 0.21, 3.1));
            double tx = gustiness * 0.9 * WorldGen.Noise(t * 1.3 + pos.x * 0.01, pos.z * 0.01) * Math.Min(1, agl / 50);
            double ty = gustiness * 0.6 * WorldGen.Noise(pos.x * 0.008 + 11, t * 1.7 + pos.z * 0.008) * Math.Min(1, agl / 50);
            return new V3(Math.Sin(to) * spd + tx, ty, -Math.Cos(to) * spd + tx * 0.5);
        }
    }

    public partial class FlightGame : MonoBehaviour
    {
        public static FlightGame I;

        [RuntimeInitializeOnLoadMethod(RuntimeInitializeLoadType.AfterSceneLoad)]
        static void Boot()
        {
            if (FindObjectOfType<FlightGame>() != null) return;
            new GameObject("SaiCanh").AddComponent<FlightGame>();
        }

        public readonly SimState S = new SimState();
        public Procedures proc;
        GameEnv env;
        TerrainBuilder terrain;
        AirportBuilder airport;
        Environment world;
        AircraftVisual visual;
        Cockpit cockpit;
        EngineAudio audioEng;
        Transform plane, eyeRig;
        Camera worldCam, pitCam;
        Texture2D gpsMap;

        public bool ready, inside = true, paused = true, showHud = true, showChecklist = true, showManual;
        public int scenario, timeIndex;
        public float loadProgress;
        public string loadStatus = "Đang khởi tạo…";
        float yaw, pitch = -10, fov = 62, orbitYaw = 200, orbitPitch = 12, orbitDist = 18;
        float engineFailAt = -1;
        double lastHdg;
        CockpitControl hover, active;
        Vector3 mouseDown; bool rightDrag, leftDrag;
        float rudderKey;
        bool camInit;
        public string toast = ""; public float toastT;
        string lastEvt = "";

        public static readonly string[] Scenarios =
        {
            "Buồng lái nguội — sân đỗ (đầy đủ quy trình)",
            "Máy đã nổ — tại điểm chờ A1 (chạy thử động cơ)",
            "Đầu đường băng 36 — sẵn sàng cất cánh",
            "Chặng cuối hạ cánh đường băng 36",
            "Bay tự do trên vùng núi phía bắc",
            "Bài tập sự cố: hỏng động cơ khi đang bay",
        };

        void Awake()
        {
            I = this;
            Application.targetFrameRate = 60;
            QualitySettings.vSyncCount = 1;
            QualitySettings.antiAliasing = 4;
            QualitySettings.shadows = ShadowQuality.All;
            QualitySettings.shadowResolution = ShadowResolution.VeryHigh;
            QualitySettings.shadowCascades = 4;
            QualitySettings.shadowDistance = 1400;
            QualitySettings.shadowProjection = ShadowProjection.StableFit;
            QualitySettings.anisotropicFiltering = AnisotropicFiltering.ForceEnable;
            QualitySettings.lodBias = 2;
            QualitySettings.pixelLightCount = 6;
            // bỏ camera/đèn mặc định của cảnh trống
            foreach (var c in FindObjectsOfType<Camera>()) Destroy(c.gameObject);
            foreach (var l in FindObjectsOfType<Light>()) Destroy(l.gameObject);
            foreach (var a in FindObjectsOfType<AudioListener>()) Destroy(a);
        }

        IEnumerator Start()
        {
            // camera tạm cho màn hình chờ
            var camGo = new GameObject("CameraTheGioi");
            worldCam = camGo.AddComponent<Camera>();
            worldCam.nearClipPlane = 1.5f; worldCam.farClipPlane = 32000;
            worldCam.clearFlags = CameraClearFlags.Skybox;
            worldCam.cullingMask = ~(1 << Cockpit.Layer);
            worldCam.allowMSAA = true; worldCam.allowHDR = false;
            camGo.AddComponent<AudioListener>();
            worldCam.transform.position = new Vector3(600, 400, -2500);
            worldCam.transform.rotation = Quaternion.Euler(8, -10, 0);

            loadStatus = "Bầu trời và mặt nước";
            world = new Environment();
            world.Build(transform, timeIndex, 140);
            yield return null;

            terrain = new TerrainBuilder();
            env = new GameEnv { terrain = terrain, S = S };
            var tb = StartCoroutine(terrain.Build(transform));
            while (terrain.progress < 1) { loadProgress = terrain.progress * 0.8f; loadStatus = terrain.status; yield return null; }
            yield return tb;

            loadStatus = "Sân bay và thị trấn"; loadProgress = 0.82f; yield return null;
            airport = new AirportBuilder();
            airport.Build(transform);
            TownBuilder.Build(transform);
            loadStatus = "Bản đồ GPS"; loadProgress = 0.88f; yield return null;
            var mapTask = Task.Run(() => MapPixels(512));
            while (!mapTask.IsCompleted) yield return null;
            gpsMap = new Texture2D(512, 512, TextureFormat.RGBA32, true);
            gpsMap.SetPixels(mapTask.Result); gpsMap.Apply(true);
            gpsMap.wrapMode = TextureWrapMode.Clamp;

            loadStatus = "Máy bay và buồng lái"; loadProgress = 0.93f; yield return null;
            plane = new GameObject("VN-A4K").transform;
            plane.SetParent(transform, false);
            visual = new AircraftVisual(plane, ProcMesh.Hex("#a3171d"), ProcMesh.Hex("#1a2a44"), "VN-A4K");
            cockpit = new Cockpit(S, plane, gpsMap);
            eyeRig = new GameObject("MatPhiCong").transform;
            eyeRig.SetParent(plane, false);
            eyeRig.localPosition = Cockpit.Eye;
            var pg = new GameObject("CameraBuongLai");
            pg.transform.SetParent(eyeRig, false);
            pitCam = pg.AddComponent<Camera>();
            pitCam.nearClipPlane = 0.03f; pitCam.farClipPlane = 50;
            pitCam.clearFlags = CameraClearFlags.Depth;
            pitCam.cullingMask = 1 << Cockpit.Layer;
            pitCam.depth = 1; pitCam.allowMSAA = true; pitCam.allowHDR = false;

            audioEng = gameObject.AddComponent<EngineAudio>();
            cockpit.onSound = k => audioEng.Click(k);

            proc = new Procedures(S);
            S.model = new FlightModel(env);
            loadProgress = 1; ready = true;
            StartScenario(0);
            paused = true; // mở menu chọn bài bay
        }

        // ---------- bản đồ GPS ----------
        static Color[] MapPixels(int n)
        {
            var px = new Color[n * n];
            float world = TerrainBuilder.Tiles * TerrainBuilder.TileSize, o = TerrainBuilder.Origin;
            Parallel.For(0, n, j =>
            {
                for (int i = 0; i < n; i++)
                {
                    double x = o + (i + 0.5) / n * world, zU = o + (j + 0.5) / n * world, z = -zU;
                    double h = WorldGen.Height(x, z);
                    Color c;
                    if (h < 0) c = Color.Lerp(new Color(0.16f, 0.34f, 0.55f), new Color(0.08f, 0.2f, 0.38f), Mathf.Clamp01((float)-h / 40));
                    else
                    {
                        double f = WorldGen.Forest(x, z, h);
                        c = Color.Lerp(new Color(0.42f, 0.55f, 0.3f), new Color(0.62f, 0.55f, 0.4f), Mathf.Clamp01((float)h / 900));
                        c = Color.Lerp(c, new Color(0.9f, 0.9f, 0.92f), Mathf.Clamp01(((float)h - 1300) / 400));
                        c = Color.Lerp(c, new Color(0.18f, 0.36f, 0.18f), (float)f * 0.7f);
                        if (WorldGen.TownMask(x, z) > 0.5) c = Color.Lerp(c, new Color(0.75f, 0.68f, 0.6f), 0.6f);
                        // tô bóng địa hình
                        double hx = WorldGen.Height(x + 40, z) - h;
                        c *= Mathf.Clamp(1 - (float)hx / 120, 0.6f, 1.3f);
                    }
                    if (AirportBuilder.IsPaved(x, z, 25)) c = Color.Lerp(c, new Color(0.15f, 0.15f, 0.17f), 0.85f);
                    double dv = Math.Sqrt((x - AirportBuilder.Vor.x) * (x - AirportBuilder.Vor.x) + (z - AirportBuilder.Vor.y) * (z - AirportBuilder.Vor.y));
                    if (dv < 120) c = new Color(0.3f, 0.5f, 1f);
                    c.a = 1;
                    px[j * n + i] = c;
                }
            });
            return px;
        }

        // ---------- kịch bản ----------
        public void StartScenario(int k)
        {
            scenario = k;
            var sys = S.sys; var m = S.model;
            proc = new Procedures(S);
            S.ctl.trim = 0.15; S.ctl.elevator = S.ctl.aileron = S.ctl.rudder = 0;
            S.comActive = 122.800; S.comStby = AirportBuilder.TowerFreq; S.navActive = 110.50; S.navStby = AirportBuilder.VorFreq;
            sys.baro = 29.92; sys.fuelL = sys.fuelR = 24; sys.hdgDrift = 7; sys.squawk = 1200; sys.carbIce = 0;
            engineFailAt = -1;
            double gh;
            bool w;
            switch (k)
            {
                case 0:
                    sys.SetColdDark();
                    gh = env.Surface(200, 60, out w);
                    m.Reset(new V3(200, gh + 1.2, 60), 270, 0, true);
                    proc.StartAt(0);
                    yaw = 0; pitch = -10;
                    break;
                case 1:
                    sys.SetReady(false); sys.parkingBrake = true; sys.hdgDrift = 0; sys.baro = S.qnh; sys.taxiLight = true; sys.landLight = false; sys.strobe = false;
                    sys.xpdrMode = 1; sys.squawk = 4521;
                    S.comActive = AirportBuilder.TowerFreq; S.comStby = AirportBuilder.AtisFreq; S.navActive = AirportBuilder.VorFreq;
                    gh = env.Surface(58, 860, out w);
                    m.Reset(new V3(58, gh + 1.2, 860), 330, 0, true);
                    proc.StartAt(4); proc.assignedSquawk = 4521;
                    break;
                case 2:
                    sys.SetReady(false); sys.hdgDrift = 0; sys.baro = S.qnh; sys.fuelPump = true; sys.strobe = true; sys.landLight = true;
                    sys.squawk = 4521; sys.xpdrMode = 3;
                    S.comActive = AirportBuilder.TowerFreq; S.navActive = AirportBuilder.VorFreq;
                    gh = env.Surface(0, 880, out w);
                    m.Reset(new V3(0, gh + 1.2, 880), 0, 0, true);
                    proc.StartAt(6); proc.takeoffCleared = true; proc.assignedSquawk = 4521;
                    break;
                case 3:
                    sys.SetReady(true); sys.hdgDrift = 0; sys.baro = S.qnh; sys.throttle = 0.42; sys.flapLever = 1; sys.carbHeat = 1;
                    S.comActive = AirportBuilder.TowerFreq; S.navActive = AirportBuilder.VorFreq; S.obs = 360;
                    m.Reset(new V3(0, 62 + 330, 900 + 6000), 0, 38, false);
                    m.flapPos = 10; S.ctl.trim = 0.35;
                    proc.StartAt(9);
                    break;
                case 4:
                    sys.SetReady(true); sys.hdgDrift = 0; sys.baro = S.qnh;
                    S.comActive = AirportBuilder.TowerFreq; S.navActive = AirportBuilder.VorFreq;
                    m.Reset(new V3(-800, 1700, -2500), 350, 52, false);
                    proc.StartAt(8);
                    break;
                default:
                    sys.SetReady(true); sys.hdgDrift = 0; sys.baro = S.qnh;
                    S.comActive = AirportBuilder.TowerFreq; S.navActive = AirportBuilder.VorFreq;
                    m.Reset(new V3(1500, 62 + 900, 3500), 300, 52, false);
                    proc.StartAt(8);
                    engineFailAt = 25;
                    break;
            }
            S.ctl.flaps = sys.flapLever;
            sys.mag = k == 0 ? Mag.Off : Mag.Both;
            sys.Update(0.01, m.ias, m.pos.y, 0, 0);
            S.simTime = 0;
            S.timeOfDayHours = Environment.Times[timeIndex].hour;
            lastHdg = -1;
            paused = false;
            Toast(Scenarios[k]);
        }

        public void SetTime(int k)
        {
            timeIndex = k;
            world.Apply(Environment.Times[k]);
            S.timeOfDayHours = Environment.Times[k].hour;
        }

        public void Toast(string s) { toast = s; toastT = 5; }

        // ---------- vòng lặp ----------
        void Update()
        {
            if (!ready) return;
            if (Input.GetKeyDown(KeyCode.Escape)) { if (showManual) showManual = false; else paused = !paused; }
            if (paused) { UpdateCameras(); return; }
            float dt = Mathf.Min(Time.deltaTime, 0.05f);
            Keys(dt);
            Mouse(dt);

            var sys = S.sys; var m = S.model;
            S.simTime += dt;
            S.timeOfDayHours += dt / 3600f;
            if (engineFailAt > 0 && S.simTime > engineFailAt) { sys.engineFail = true; engineFailAt = -1; }

            // điều khiển bay (cánh tà chạy điện)
            if (sys.ElecPower) S.ctl.flaps = sys.flapLever;
            bool brakeKey = Input.GetKey(KeyCode.B) && !Input.GetKey(KeyCode.LeftShift);
            S.ctl.brakeL = S.ctl.brakeR = sys.parkingBrake || brakeKey ? 1 : 0;
            if (m.crashed == null)
            {
                m.Step(dt, S.ctl, sys.power);
                if (m.crashed != null) { sys.running = false; Toast("Tai nạn: " + m.crashed); }
            }
            double hd, pr, rr;
            m.Attitude(out hd, out pr, out rr);
            S.heading = hd; S.pitchDeg = pr * 180 / Math.PI; S.rollDeg = rr * 180 / Math.PI;
            if (lastHdg >= 0) { double dh = hd - lastHdg; if (dh > 180) dh -= 360; if (dh < -180) dh += 360; S.turnRate += (dh / dt - S.turnRate) * Math.Min(1, dt * 3); }
            lastHdg = hd;
            S.slip += ((m.onGround ? 0 : -m.beta * 180 / Math.PI * 0.6) - S.slip) * Math.Min(1, dt * 4);
            S.altFt = m.pos.y * 3.28084;
            S.vsFpm += (m.vel.y * 196.85 - S.vsFpm) * Math.Min(1, dt * 1.5);
            S.iasKt = m.ias * 1.94384;
            double gs = Math.Sqrt(m.vel.x * m.vel.x + m.vel.z * m.vel.z);
            S.gsKt = gs * 1.94384;
            if (gs > 1) { S.trackDeg = Math.Atan2(m.vel.x, -m.vel.z) * 180 / Math.PI; if (S.trackDeg < 0) S.trackDeg += 360; } else S.trackDeg = hd;
            bool ww;
            S.aglFt = (m.pos.y - 1.2 - env.Surface(m.pos.x, m.pos.z, out ww)) * 3.28084;
            var wv = env.Wind(m.t, m.pos);
            S.windMap = new Vector3((float)wv.x, (float)wv.y, (float)wv.z);

            sys.Update(dt, m.ias, m.pos.y, S.pitchDeg, S.rollDeg);
            if (sys.lastEvent != lastEvt) { lastEvt = sys.lastEvent; if (lastEvt.Length > 0) Toast(lastEvt); }
            proc.Update(dt);
            if (m.touchdown > 0.8 && audioEng != null) audioEng.Touchdown((float)m.touchdown / 3);

            // hiển thị
            plane.position = new Vector3((float)m.pos.x, (float)m.pos.y, (float)-m.pos.z);
            plane.rotation = new Quaternion((float)-m.q.x, (float)-m.q.y, (float)m.q.z, (float)m.q.w);
            visual.Animate(dt, S.ctl, sys, (float)m.flapPos, S.simTime, inside);
            cockpit.Update(dt);
            airport.Update(S.simTime, S.windMap, new Vector3((float)m.pos.x, (float)m.pos.y, (float)m.pos.z));
            world.Update(worldCam.transform.position, new Vector3(S.windMap.x, 0, -S.windMap.z), dt);
            UpdateCameras();

            // âm thanh
            audioEng.rpm = (float)sys.rpm; audioEng.power = (float)sys.power; audioEng.airspeed = (float)m.ias;
            audioEng.rolling = m.onGround ? (float)m.wheelSpeed : 0; audioEng.cranking = sys.cranking && !sys.running ? 1 : 0;
            audioEng.stallWarn = !m.onGround && m.alpha > Spec.AlphaStall - 0.06 && sys.ElecPower ? 1 : 0;
            audioEng.inside = inside ? 1 : 0;
            if (toastT > 0) toastT -= dt;
        }

        void Keys(float dt)
        {
            var sys = S.sys; var c = S.ctl;
            bool shift = Input.GetKey(KeyCode.LeftShift) || Input.GetKey(KeyCode.RightShift);
            // cần lái: phím mũi tên / WASD / cần lái thật (trục Horizontal, Vertical)
            float ax = Input.GetAxis("Horizontal"), ay = Input.GetAxis("Vertical");
            c.aileron = Mathf.Clamp(ax, -1, 1);
            c.elevator = Mathf.Clamp(-ay, -1, 1);
            float rt = (Input.GetKey(KeyCode.X) ? 1 : 0) - (Input.GetKey(KeyCode.Z) ? 1 : 0);
            rudderKey = Mathf.MoveTowards(rudderKey, rt, dt * (rt == 0 ? 3 : 2));
            c.rudder = rudderKey;
            // ga, hỗn hợp
            float th = (Input.GetKey(KeyCode.E) || Input.GetKey(KeyCode.PageUp) ? 1 : 0) - (Input.GetKey(KeyCode.Q) || Input.GetKey(KeyCode.PageDown) ? 1 : 0);
            if (th != 0) sys.throttle = Mathf.Clamp01((float)sys.throttle + th * dt * 0.5f);
            float mx = (Input.GetKey(KeyCode.RightBracket) ? 1 : 0) - (Input.GetKey(KeyCode.LeftBracket) ? 1 : 0);
            if (mx != 0) sys.mixture = Mathf.Clamp01((float)sys.mixture + mx * dt * 0.4f);
            if (Input.GetKey(KeyCode.Home)) c.trim = Math.Max(-1, c.trim - dt * 0.25);
            if (Input.GetKey(KeyCode.End)) c.trim = Math.Min(1, c.trim + dt * 0.25);
            if (Input.GetKeyDown(KeyCode.F6)) { sys.flapLever = Mathf.Max(0, sys.flapLever - 1); audioEng.Click(2); }
            if (Input.GetKeyDown(KeyCode.F7)) { sys.flapLever = Mathf.Min(3, sys.flapLever + 1); audioEng.Click(2); }
            if (Input.GetKeyDown(KeyCode.B) && shift) { sys.parkingBrake = !sys.parkingBrake; audioEng.Click(2); }
            if (Input.GetKeyDown(KeyCode.T)) proc.PushToTalk();
            if (Input.GetKeyDown(KeyCode.K)) showChecklist = !showChecklist;
            if (Input.GetKeyDown(KeyCode.M)) showManual = !showManual;
            if (Input.GetKeyDown(KeyCode.H)) showHud = !showHud;
            if (Input.GetKeyDown(KeyCode.Y)) S.hideYokes = !S.hideYokes;
            if (Input.GetKeyDown(KeyCode.C)) inside = !inside;
            if (Input.GetKeyDown(KeyCode.R) && (S.model.crashed != null || shift)) StartScenario(scenario);
            // góc nhìn nhanh
            if (Input.GetKeyDown(KeyCode.Alpha1)) View(0, -10, 62);
            if (Input.GetKeyDown(KeyCode.Alpha2)) View(-2, -30, 42);
            if (Input.GetKeyDown(KeyCode.Alpha3)) View(60, -66, 55);
            if (Input.GetKeyDown(KeyCode.Alpha4)) View(25, -24, 38);
            if (Input.GetKeyDown(KeyCode.Alpha5)) View(-6, -42, 44);
            if (Input.GetKeyDown(KeyCode.Alpha6)) View(-75, -5, 62);
            if (Input.GetKeyDown(KeyCode.Alpha7)) View(75, -5, 62);
        }

        void View(float y, float p, float f) { inside = true; yaw = y; pitch = p; fov = f; }

        void Mouse(float dt)
        {
            Vector3 mp = Input.mousePosition;
            hover = null;
            if (inside && pitCam != null && !showManual && !OverGuiWindow(mp))
            {
                float d;
                hover = cockpit.Pick(pitCam.ScreenPointToRay(mp), out d);
            }
            // chuột phải: kéo để nhìn quanh, nhấp nhanh để xoay ngược
            if (Input.GetMouseButtonDown(1)) { mouseDown = mp; rightDrag = false; }
            if (Input.GetMouseButton(1))
            {
                Vector3 dm = new Vector3(Input.GetAxis("Mouse X"), Input.GetAxis("Mouse Y"), 0);
                if ((mp - mouseDown).magnitude > 6) rightDrag = true;
                if (rightDrag)
                {
                    if (inside) { yaw = Mathf.Clamp(yaw + dm.x * 3f * fov / 60, -165, 165); pitch = Mathf.Clamp(pitch + dm.y * 3f * fov / 60, -80, 70); }
                    else { orbitYaw += dm.x * 4; orbitPitch = Mathf.Clamp(orbitPitch - dm.y * 3, -10, 80); }
                }
            }
            if (Input.GetMouseButtonUp(1) && !rightDrag && hover != null && hover.click != null) hover.click(-1);
            // chuột trái: nhấp / giữ / kéo
            if (Input.GetMouseButtonDown(0))
            {
                mouseDown = mp; leftDrag = false; active = hover;
                if (active != null && active.press != null) active.press();
            }
            if (Input.GetMouseButton(0) && active != null && active.drag != null)
            {
                float dy = Input.GetAxis("Mouse Y") * 0.02f;
                if ((mp - mouseDown).magnitude > 4) leftDrag = true;
                if (leftDrag && dy != 0) active.drag(dy);
            }
            if (Input.GetMouseButtonUp(0))
            {
                if (active != null)
                {
                    if (active.release != null) active.release();
                    if (!leftDrag && active.click != null) active.click(1);
                }
                active = null;
            }
            if (Input.GetMouseButtonDown(2)) View(0, -10, 62);
            float wheel = Input.mouseScrollDelta.y;
            if (wheel != 0)
            {
                if (hover != null && hover.scroll != null) hover.scroll(wheel);
                else if (inside) fov = Mathf.Clamp(fov - wheel * 4, 22, 85);
                else orbitDist = Mathf.Clamp(orbitDist * (1 - wheel * 0.1f), 7, 120);
            }
        }

        void UpdateCameras()
        {
            if (plane == null || pitCam == null) return;
            bool wasInside = pitCam.enabled;
            if (!camInit || inside != wasInside || cockpit.root.activeSelf != inside)
            {
                camInit = true;
                pitCam.enabled = inside;
                cockpit.root.SetActive(inside);
                visual.cabin.SetActive(!inside);
                SetLayer(visual.root.transform, inside ? Cockpit.Layer : 0);
                worldCam.nearClipPlane = inside ? 1.5f : 0.5f;
            }
            if (inside)
            {
                eyeRig.localRotation = Quaternion.Euler(-pitch, yaw, 0);
                pitCam.fieldOfView = fov;
                worldCam.fieldOfView = fov;
                worldCam.transform.SetPositionAndRotation(pitCam.transform.position, pitCam.transform.rotation);
            }
            else
            {
                worldCam.fieldOfView = 55;
                var q = plane.rotation;
                float hdg = Quaternion.LookRotation(Vector3.ProjectOnPlane(q * Vector3.forward, Vector3.up).sqrMagnitude > 1e-4 ? Vector3.ProjectOnPlane(q * Vector3.forward, Vector3.up) : Vector3.forward).eulerAngles.y;
                var rot = Quaternion.Euler(orbitPitch, hdg + orbitYaw, 0);
                Vector3 target = plane.position + Vector3.up * 0.8f;
                Vector3 pos = target - rot * Vector3.forward * orbitDist;
                bool w;
                float g = (float)env.Surface(pos.x, -pos.z, out w) + 1.5f;
                if (pos.y < g) pos.y = g;
                worldCam.transform.SetPositionAndRotation(pos, Quaternion.LookRotation(target - pos));
            }
        }

        static void SetLayer(Transform t, int l) { t.gameObject.layer = l; foreach (Transform c in t) SetLayer(c, l); }

        public CockpitControl Hover { get { return hover; } }
    }
}

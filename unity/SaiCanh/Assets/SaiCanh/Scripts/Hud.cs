// Giao diện trên màn hình (IMGUI): màn hình chờ, menu bài bay, thông số, danh sách kiểm tra,
// sổ tay bay, phụ đề radio, chú thích khi rê chuột lên công tắc, thông báo tai nạn và điểm quy trình.
using System.Collections.Generic;
using UnityEngine;

namespace SaiCanh
{
    public partial class FlightGame
    {
        GUIStyle box, title, label, small, item, itemDone, btn, sub, tip, big;
        Texture2D bgDark, bgPanel, bgAccent;
        float uiScale = 1;
        Vector2 manualScroll, logScroll;
        int manualChapter, viewPhase = -1;
        List<KeyValuePair<string, string>> manual;
        Rect rChecklist, rMenu, rManual, rHud;

        static Texture2D Solid(Color c) { var t = new Texture2D(1, 1); t.SetPixel(0, 0, c); t.Apply(); return t; }

        void Styles()
        {
            if (box != null) return;
            bgDark = Solid(new Color(0.04f, 0.05f, 0.07f, 0.82f));
            bgPanel = Solid(new Color(0.08f, 0.1f, 0.13f, 0.92f));
            bgAccent = Solid(new Color(0.85f, 0.45f, 0.12f, 0.95f));
            box = new GUIStyle(GUI.skin.box) { normal = { background = bgDark }, padding = new RectOffset(14, 14, 10, 10) };
            title = new GUIStyle(GUI.skin.label) { fontSize = 22, fontStyle = FontStyle.Bold, normal = { textColor = new Color(1f, 0.78f, 0.45f) } };
            big = new GUIStyle(title) { fontSize = 40, alignment = TextAnchor.MiddleCenter };
            label = new GUIStyle(GUI.skin.label) { fontSize = 17, richText = true, wordWrap = true, normal = { textColor = new Color(0.92f, 0.94f, 0.96f) } };
            small = new GUIStyle(label) { fontSize = 14, normal = { textColor = new Color(0.75f, 0.8f, 0.85f) } };
            item = new GUIStyle(label) { fontSize = 16 };
            itemDone = new GUIStyle(item) { normal = { textColor = new Color(0.45f, 0.85f, 0.5f) } };
            btn = new GUIStyle(GUI.skin.button) { fontSize = 17, padding = new RectOffset(10, 10, 8, 8), normal = { background = bgPanel, textColor = Color.white }, hover = { background = bgAccent, textColor = Color.white }, active = { background = bgAccent } };
            sub = new GUIStyle(label) { fontSize = 20, alignment = TextAnchor.UpperCenter };
            tip = new GUIStyle(label) { fontSize = 15, normal = { background = bgPanel, textColor = Color.white }, padding = new RectOffset(10, 10, 6, 6) };
        }

        float VW { get { return Screen.width / uiScale; } }
        float VH { get { return Screen.height / uiScale; } }

        bool OverGuiWindow(Vector3 mp)
        {
            Vector2 g = new Vector2(mp.x, Screen.height - mp.y) / uiScale;
            if (paused) return true;
            if (showChecklist && rChecklist.Contains(g)) return true;
            if (showManual && rManual.Contains(g)) return true;
            return false;
        }

        void LoadManual()
        {
            manual = new List<KeyValuePair<string, string>>();
            var ta = Resources.Load<TextAsset>("SoTayBay");
            string txt = ta != null ? ta.text : "# Sổ tay\nKhông tìm thấy tệp Resources/SoTayBay.txt";
            string head = null; var sb = new System.Text.StringBuilder();
            foreach (var raw in txt.Split('\n'))
            {
                string line = raw.TrimEnd('\r');
                if (line.StartsWith("# "))
                {
                    if (head != null) manual.Add(new KeyValuePair<string, string>(head, sb.ToString()));
                    head = line.Substring(2); sb.Length = 0; continue;
                }
                if (line.StartsWith("## ")) line = "\n<b><color=#ffc773>" + line.Substring(3) + "</color></b>";
                else if (line.StartsWith("- ")) line = "  •  " + line.Substring(2);
                line = line.Replace("**", "");
                sb.AppendLine(line);
            }
            if (head != null) manual.Add(new KeyValuePair<string, string>(head, sb.ToString()));
        }

        void OnGUI()
        {
            Styles();
            uiScale = Mathf.Max(0.6f, Screen.height / 1080f);
            GUI.matrix = Matrix4x4.Scale(new Vector3(uiScale, uiScale, 1));
            float W = VW, H = VH;

            if (!ready)
            {
                GUI.DrawTexture(new Rect(0, 0, W, H), bgPanel);
                GUI.Label(new Rect(0, H * 0.32f, W, 60), "SẢI CÁNH  SC-4", big);
                GUI.Label(new Rect(0, H * 0.32f + 64, W, 30), "Mô phỏng bay chân thực — Unity", new GUIStyle(sub) { normal = { textColor = new Color(0.8f, 0.85f, 0.9f) } });
                var bar = new Rect(W * 0.3f, H * 0.55f, W * 0.4f, 14);
                GUI.DrawTexture(bar, bgDark);
                GUI.DrawTexture(new Rect(bar.x, bar.y, bar.width * loadProgress, bar.height), bgAccent);
                GUI.Label(new Rect(0, bar.y + 24, W, 30), loadStatus, sub);
                return;
            }

            var m = S.model; var sys = S.sys;
            if (showHud) Info(m, sys);
            if (showChecklist) Checklist(W);
            else rChecklist = new Rect();

            // phụ đề radio
            if (proc.subtitleT > 0 && proc.subtitle.Length > 0)
            {
                string who = proc.subtitleWho;
                string col = who == "VN-A4K" ? "#ffffff" : who == "ATIS" ? "#9fd7ff" : who == "Lỗi quy trình" ? "#ff8a7a" : who == "Hệ thống" ? "#cccccc" : "#ffd36e";
                var r = new Rect(W * 0.18f, H - 150, W * 0.64f, 90);
                GUI.Label(r, "<b><color=" + col + ">" + who + ":</color></b> " + proc.subtitle, sub);
            }
            if (toastT > 0) GUI.Label(new Rect(W * 0.2f, 18, W * 0.6f, 60), toast, new GUIStyle(sub) { normal = { textColor = new Color(1f, 0.9f, 0.7f) } });

            // chú thích công tắc
            var hv = Hover;
            if (hv != null && !paused)
            {
                Vector2 mp = new Vector2(Input.mousePosition.x, Screen.height - Input.mousePosition.y) / uiScale;
                string s = "<b>" + hv.label + "</b>: " + (hv.state != null ? hv.state() : "") + (hv.hint != null ? "\n<color=#b9c4cf>" + hv.hint + "</color>" : "");
                var sz = tip.CalcSize(new GUIContent(s));
                float w = Mathf.Min(520, sz.x + 10), h = tip.CalcHeight(new GUIContent(s), w);
                GUI.Label(new Rect(Mathf.Min(mp.x + 18, W - w - 10), mp.y + 22, w, h), s, tip);
            }
            // tâm ngắm nhỏ để biết đang trỏ vào đâu
            if (inside && !paused && hv != null)
            {
                Vector2 mp = new Vector2(Input.mousePosition.x, Screen.height - Input.mousePosition.y) / uiScale;
                GUI.DrawTexture(new Rect(mp.x - 3, mp.y - 3, 6, 6), bgAccent);
            }

            if (m.crashed != null)
            {
                GUI.DrawTexture(new Rect(0, H * 0.35f, W, 170), bgDark);
                GUI.Label(new Rect(0, H * 0.35f + 20, W, 60), m.crashed, big);
                GUI.Label(new Rect(0, H * 0.35f + 95, W, 40), "Nhấn R để bay lại bài này — Esc để chọn bài khác", sub);
            }
            if (proc.finished && !paused)
            {
                var r = new Rect(W / 2 - 330, H * 0.2f, 660, 120);
                GUI.Box(r, "", box);
                GUI.Label(new Rect(r.x, r.y + 14, r.width, 44), "Hoàn thành chuyến bay!", big);
                GUI.Label(new Rect(r.x, r.y + 70, r.width, 30), "Điểm quy trình: " + proc.score + "/100   " + proc.lastTouchdown, sub);
            }

            if (showManual) Manual(W, H); else rManual = new Rect();
            if (paused) Menu(W, H);
        }

        void Info(FlightModel m, AircraftSystems sys)
        {
            rHud = new Rect(16, 16, 330, 196);
            GUI.Box(rHud, "", box);
            string s =
                "<b>TỐC ĐỘ</b> " + S.iasKt.ToString("0") + " kt    <b>CAO</b> " + S.IndicatedAltFt.ToString("0") + " ft\n" +
                "<b>HƯỚNG</b> " + S.heading.ToString("000") + "°    <b>LÊN/XUỐNG</b> " + S.vsFpm.ToString("+0;-0") + "\n" +
                "<b>VÒNG TUA</b> " + sys.rpm.ToString("0") + "   <b>CÁNH TÀ</b> " + m.flapPos.ToString("0") + "°\n" +
                "<b>GIÓ</b> " + S.windFromDeg.ToString("000") + "°/" + S.windKt.ToString("0") + " kt   <b>G</b> " + m.gload.ToString("0.0") + "\n" +
                "<b>ĐIỂM QUY TRÌNH</b> " + proc.score + "/100\n" +
                "<color=#9aa6b2>K checklist · M sổ tay · T gọi đài · Esc menu</color>";
            GUI.Label(new Rect(30, 24, 310, 186), s, small);
        }

        void Checklist(float W)
        {
            int ph = viewPhase >= 0 ? viewPhase : proc.current;
            ph = Mathf.Clamp(ph, 0, proc.phases.Count - 1);
            var p = proc.phases[ph];
            float h = 92 + p.items.Count * 46;
            rChecklist = new Rect(W - 480, 16, 464, h + 150);
            GUI.Box(rChecklist, "", box);
            GUI.Label(new Rect(rChecklist.x + 14, 24, 300, 30), "DANH SÁCH KIỂM TRA", title);
            if (GUI.Button(new Rect(rChecklist.xMax - 106, 24, 42, 32), "◀", btn)) viewPhase = Mathf.Max(0, ph - 1);
            if (GUI.Button(new Rect(rChecklist.xMax - 58, 24, 42, 32), "▶", btn)) viewPhase = Mathf.Min(proc.phases.Count - 1, ph + 1);
            GUI.Label(new Rect(rChecklist.x + 14, 58, 430, 28), "<b>" + p.title + "</b>  (" + p.Done + "/" + p.items.Count + ")" + (ph == proc.current ? "  <color=#ffb35a>◀ hiện tại</color>" : ""), label);
            float y = 92;
            foreach (var it in p.items)
            {
                var r = new Rect(rChecklist.x + 14, y, 436, 44);
                string mark = it.done ? "<color=#6fe08a>✔</color>" : it.cond == null ? "<color=#ffd36e>☐</color>" : "<color=#8899aa>○</color>";
                string text = mark + "  " + it.what + " <color=#8899aa>……</color> <b>" + it.action + "</b>" + (it.cond == null && !it.done ? " <color=#ffd36e>(nhấp)</color>" : "");
                if (it.cond == null && !it.done) { if (GUI.Button(r, "", GUIStyle.none)) it.done = true; }
                GUI.Label(r, text, it.done ? itemDone : item);
                y += 46;
            }
            if (viewPhase >= 0 && GUI.Button(new Rect(rChecklist.x + 14, y + 4, 200, 34), "Về mục hiện tại", btn)) viewPhase = -1;
            // nhật ký lỗi gần nhất
            int n = proc.log.Count;
            string lg = "";
            for (int i = Mathf.Max(0, n - 3); i < n; i++) lg += proc.log[i] + "\n";
            GUI.Label(new Rect(rChecklist.x + 14, y + 44, 436, 100), "<color=#ffb0a0>" + lg + "</color>", small);
        }

        void Manual(float W, float H)
        {
            if (manual == null) LoadManual();
            rManual = new Rect(W / 2 - 600, 40, 1200, H - 80);
            GUI.Box(rManual, "", box);
            GUI.Label(new Rect(rManual.x + 20, rManual.y + 14, 700, 34), "SỔ TAY BAY SC-4", title);
            if (GUI.Button(new Rect(rManual.xMax - 140, rManual.y + 12, 120, 34), "Đóng (M)", btn)) showManual = false;
            float y = rManual.y + 60;
            for (int i = 0; i < manual.Count; i++)
            {
                var st = new GUIStyle(btn) { alignment = TextAnchor.MiddleLeft, fontSize = 15, wordWrap = true };
                if (i == manualChapter) st.normal.background = bgAccent;
                if (GUI.Button(new Rect(rManual.x + 16, y, 300, 38), manual[i].Key, st)) { manualChapter = i; manualScroll = Vector2.zero; }
                y += 42;
            }
            var view = new Rect(rManual.x + 336, rManual.y + 60, rManual.width - 356, rManual.height - 80);
            string body = manual[Mathf.Clamp(manualChapter, 0, manual.Count - 1)].Value;
            float bh = label.CalcHeight(new GUIContent(body), view.width - 30);
            manualScroll = GUI.BeginScrollView(view, manualScroll, new Rect(0, 0, view.width - 24, bh + 20));
            GUI.Label(new Rect(0, 0, view.width - 30, bh + 10), body, label);
            GUI.EndScrollView();
        }

        void Menu(float W, float H)
        {
            rMenu = new Rect(W / 2 - 420, H / 2 - 400, 840, 800);
            GUI.Box(rMenu, "", box);
            GUI.Label(new Rect(rMenu.x, rMenu.y + 16, rMenu.width, 50), "SẢI CÁNH  SC-4", big);
            float y = rMenu.y + 80;
            GUI.Label(new Rect(rMenu.x + 30, y, 500, 30), "Chọn bài bay", title); y += 36;
            for (int i = 0; i < Scenarios.Length; i++)
            {
                if (GUI.Button(new Rect(rMenu.x + 30, y, rMenu.width - 60, 40), (i + 1) + ".  " + Scenarios[i], new GUIStyle(btn) { alignment = TextAnchor.MiddleLeft })) StartScenario(i);
                y += 46;
            }
            y += 10;
            GUI.Label(new Rect(rMenu.x + 30, y, 300, 30), "Thời điểm", title);
            for (int i = 0; i < Environment.Times.Length; i++)
            {
                var st = new GUIStyle(btn); if (i == timeIndex) st.normal.background = bgAccent;
                if (GUI.Button(new Rect(rMenu.x + 200 + i * 200, y, 190, 36), Environment.Times[i].name, st)) SetTime(i);
            }
            y += 50;
            GUI.Label(new Rect(rMenu.x + 30, y, 300, 30), "Thời tiết", title);
            var ci = new GUIStyle(btn); if (S.sys.carbIceEnabled) ci.normal.background = bgAccent;
            if (GUI.Button(new Rect(rMenu.x + 200, y, 290, 36), "Băng chế hoà khí: " + (S.sys.carbIceEnabled ? "CÓ" : "KHÔNG"), ci)) S.sys.carbIceEnabled = !S.sys.carbIceEnabled;
            if (GUI.Button(new Rect(rMenu.x + 500, y, 310, 36), "Gió: " + S.windFromDeg.ToString("000") + "° / " + S.windKt.ToString("0") + " kt", btn))
            {
                S.windKt = S.windKt >= 18 ? 0 : S.windKt + 6;
                S.windFromDeg = S.windKt == 0 ? 340 : (S.windFromDeg + 20) % 360;
            }
            y += 56;
            if (GUI.Button(new Rect(rMenu.x + 30, y, 250, 44), "▶  Tiếp tục bay", btn)) paused = false;
            if (GUI.Button(new Rect(rMenu.x + 295, y, 250, 44), "Sổ tay bay (M)", btn)) { showManual = true; }
            if (GUI.Button(new Rect(rMenu.x + 560, y, 250, 44), "Thoát", btn)) Application.Quit();
            y += 58;
            GUI.Label(new Rect(rMenu.x + 30, y, rMenu.width - 60, 140),
                "<b>Điều khiển:</b> mũi tên / WASD hoặc cần lái = cánh lái · Z/X = bánh lái hướng · Q/E = ga · [ ] = hỗn hợp · Home/End = trim · F6/F7 = cánh tà · B = phanh, Shift+B = phanh đỗ · T = gọi đài · C = trong/ngoài · 1–7 = góc nhìn nhanh · Y = ẩn cần lái · chuột phải kéo = nhìn quanh · lăn chuột = phóng to/xoay núm · chuột trái = bấm công tắc, giữ khoá ở BOTH để đề máy.",
                small);
        }
    }
}

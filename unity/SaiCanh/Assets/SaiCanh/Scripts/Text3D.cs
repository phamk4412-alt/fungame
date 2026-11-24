// Chữ 3D cho nhãn công tắc, số đăng ký, mặt đồng hồ — TextMesh với shader che khuất theo chiều sâu.
using UnityEngine;

namespace SaiCanh
{
    public static class Text3D
    {
        static Font font;
        static Shader shader;
        static readonly System.Collections.Generic.List<Material> mats = new System.Collections.Generic.List<Material>();
        static bool hooked;

        static void Rebuilt(Font f)
        {
            if (f != font) return;
            foreach (var m in mats) if (m != null) m.mainTexture = f.material.mainTexture;
        }

        /// <summary>Phông chữ dựng sẵn của Unity (Unity 6: LegacyRuntime.ttf, bản cũ: Arial.ttf).</summary>
        public static Font Font
        {
            get
            {
                if (font == null)
                {
                    try { font = Resources.GetBuiltinResource<Font>("LegacyRuntime.ttf"); } catch { font = null; }
                    if (font == null) { try { font = Resources.GetBuiltinResource<Font>("Arial.ttf"); } catch { font = null; } }
                    if (font == null) font = Font.CreateDynamicFontFromOSFont("Arial", 32);
                    if (!hooked) { Font.textureRebuilt += Rebuilt; hooked = true; }
                }
                return font;
            }
        }

        /// <summary>Tạo một dòng chữ. size: chiều cao chữ (m).</summary>
        public static TextMesh Make(string text, Transform parent, Vector3 pos, float size, Color color, TextAnchor anchor = TextAnchor.MiddleCenter, int layer = -1)
        {
            var go = new GameObject("Chu_" + (text.Length > 12 ? text.Substring(0, 12) : text));
            go.transform.SetParent(parent, false);
            go.transform.localPosition = pos;
            if (layer >= 0) go.layer = layer; else if (parent != null) go.layer = parent.gameObject.layer;
            var tm = go.AddComponent<TextMesh>();
            tm.font = Font;
            tm.fontSize = 64;
            tm.characterSize = size * 10f / 64f; // chiều cao dòng ≈ fontSize × characterSize / 10
            tm.anchor = anchor;
            tm.alignment = anchor == TextAnchor.MiddleLeft || anchor == TextAnchor.UpperLeft || anchor == TextAnchor.LowerLeft ? TextAlignment.Left : TextAlignment.Center;
            tm.color = color;
            tm.text = text;
            var mr = go.GetComponent<MeshRenderer>();
            if (shader == null) shader = Shader.Find("SaiCanh/Text3D");
            var m = new Material(shader != null ? shader : Font.material.shader);
            m.mainTexture = Font.material.mainTexture;
            m.color = color;
            mr.sharedMaterial = m;
            mats.Add(m);
            mr.shadowCastingMode = UnityEngine.Rendering.ShadowCastingMode.Off;
            mr.receiveShadows = false;
            return tm;
        }
    }
}

// Âm thanh tổng hợp thời gian thực: tiếng nổ động cơ 4 xi-lanh, cánh quạt, mô-tơ đề, gió, bánh xe lăn,
// còi báo thất tốc, tiếng lốp chạm đất, tiếng lách cách công tắc. Không cần tệp âm thanh.
using System;
using UnityEngine;

namespace SaiCanh
{
    [RequireComponent(typeof(AudioSource))]
    public class EngineAudio : MonoBehaviour
    {
        // tham số (luồng chính ghi, luồng âm thanh đọc)
        public volatile float rpm, power, airspeed, rolling, stallWarn, cranking, inside = 1, master = 0.8f;
        double phase, propPhase, crankPhase, hornPhase;
        float lp1, lp2, wind1, wind2, rumble;
        uint seed = 22222;
        int sampleRate = 48000;
        AudioSource clicks;
        AudioClip[] clickClips;
        AudioClip screech;

        void Awake()
        {
            sampleRate = AudioSettings.outputSampleRate;
            var src = GetComponent<AudioSource>();
            src.clip = AudioClip.Create("Im", sampleRate, 1, sampleRate, false);
            src.loop = true; src.spatialBlend = 0; src.playOnAwake = true;
            src.Play();
            var go = new GameObject("TiengBam");
            go.transform.SetParent(transform, false);
            clicks = go.AddComponent<AudioSource>();
            clicks.spatialBlend = 0;
            clickClips = new[] { MakeClick(0.012f, 2400, 0.5f), MakeClick(0.02f, 1300, 0.35f), MakeClick(0.07f, 380, 0.4f) };
            screech = MakeScreech();
        }

        float Noise() { seed = seed * 1664525u + 1013904223u; return (seed >> 8) / 8388608f - 1f; }

        AudioClip MakeClick(float len, float freq, float vol)
        {
            int n = (int)(sampleRate * len);
            var d = new float[n];
            var r = new System.Random(3);
            for (int i = 0; i < n; i++)
            {
                float t = i / (float)sampleRate, env = Mathf.Exp(-t / len * 5);
                d[i] = (Mathf.Sin(2 * Mathf.PI * freq * t) * 0.6f + ((float)r.NextDouble() * 2 - 1) * 0.4f) * env * vol;
            }
            var c = AudioClip.Create("Bam", n, 1, sampleRate, false);
            c.SetData(d, 0);
            return c;
        }

        AudioClip MakeScreech()
        {
            int n = (int)(sampleRate * 0.35f);
            var d = new float[n];
            var r = new System.Random(9);
            float lp = 0;
            for (int i = 0; i < n; i++)
            {
                float t = i / (float)sampleRate, env = Mathf.Sin(Mathf.Min(1, t / 0.02f) * Mathf.PI / 2) * Mathf.Exp(-t * 7);
                lp += (((float)r.NextDouble() * 2 - 1) - lp) * 0.25f;
                d[i] = (lp * 0.7f + Mathf.Sin(2 * Mathf.PI * (900 + 300 * Mathf.Sin(t * 40)) * t) * 0.15f) * env * 0.6f;
            }
            var c = AudioClip.Create("Lop", n, 1, sampleRate, false);
            c.SetData(d, 0);
            return c;
        }

        /// <summary>0: công tắc, 1: núm xoay, 2: cần gạt.</summary>
        public void Click(int kind) { if (clicks != null) clicks.PlayOneShot(clickClips[Mathf.Clamp(kind, 0, 2)], master); }

        public void Touchdown(float strength) { if (clicks != null) clicks.PlayOneShot(screech, Mathf.Clamp01(strength) * master); }

        void OnAudioFilterRead(float[] data, int channels)
        {
            float r = rpm, pw = power, spd = airspeed, roll = rolling, sw = stallWarn, cr = cranking, ins = inside, vol = master;
            double fire = r / 60.0 * 2; // 4 xi-lanh 4 thì: 2 lần nổ mỗi vòng
            double prop = r / 60.0 * 2; // cánh quạt 2 lá
            float dt = 1f / sampleRate;
            float engVol = Mathf.Clamp01(r / 600f) * (0.35f + 0.65f * pw);
            float windVol = Mathf.Clamp01(spd / 70f);
            for (int i = 0; i < data.Length; i += channels)
            {
                phase += fire * dt; if (phase > 1) phase -= 1;
                propPhase += prop * dt; if (propPhase > 1) propPhase -= 1;
                // xung nổ: nhọn, lẫn nhiễu
                float p = (float)phase;
                float pulse = Mathf.Exp(-p * 9f) * (1 + Noise() * 0.35f) - 0.11f;
                float exhaust = pulse + 0.35f * Mathf.Sin((float)(phase * Math.PI * 4)) + 0.12f * Noise();
                lp1 += (exhaust - lp1) * Mathf.Clamp01(0.08f + r / 9000f);
                float eng = lp1 * engVol;
                float buzz = (Mathf.Sin((float)(propPhase * Math.PI * 2)) * 0.5f + Mathf.Sin((float)(propPhase * Math.PI * 6)) * 0.15f) * Mathf.Clamp01((r - 400) / 1500f) * 0.25f;
                // gió
                float n = Noise();
                wind1 += (n - wind1) * 0.02f; wind2 += (wind1 - wind2) * 0.05f;
                float wind = (wind1 * 0.7f + (n - wind1) * 0.03f) * windVol * (ins > 0.5f ? 0.6f : 1.4f);
                // mô-tơ đề
                float crank = 0;
                if (cr > 0.5f)
                {
                    crankPhase += 360 * dt; if (crankPhase > 1) crankPhase -= 1;
                    crank = (Mathf.Sin((float)(crankPhase * Math.PI * 2)) * 0.3f + Noise() * 0.1f) * 0.5f + Mathf.Sin((float)(phase * Math.PI * 2)) * 0.2f;
                }
                // bánh xe lăn
                rumble += (Noise() - rumble) * 0.01f;
                float rum = rumble * Mathf.Clamp01(roll / 25f) * 2.2f;
                // còi thất tốc
                float horn = 0;
                if (sw > 0.5f) { hornPhase += 2800 * dt; if (hornPhase > 1) hornPhase -= 1; horn = (hornPhase < 0.5 ? 0.18f : -0.18f) * 0.8f; }
                float s = (eng * 0.9f + buzz + wind + crank + rum) * (ins > 0.5f ? 0.75f : 1f);
                lp2 += (s - lp2) * (ins > 0.5f ? 0.35f : 0.9f); // cabin cách âm: cắt bớt âm cao
                float o = (lp2 + horn) * vol;
                o = o / (1 + Mathf.Abs(o)); // nén mềm
                for (int c = 0; c < channels; c++) data[i + c] = o;
            }
        }
    }
}

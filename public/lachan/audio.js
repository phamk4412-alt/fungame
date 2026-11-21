// Âm thanh tổng hợp bằng Web Audio — không cần file âm thanh, chạy offline hoàn toàn.
(function () {
  'use strict';
  let ctx = null;
  let master = null;
  let muted = false;

  function ac() {
    if (!ctx) {
      const AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return null;
      ctx = new AC();
      master = ctx.createGain();
      master.gain.value = 0.8;
      master.connect(ctx.destination);
    }
    if (ctx.state === 'suspended') ctx.resume();
    return ctx;
  }

  function tone(freq, start, dur, opts) {
    const c = ac();
    if (!c || muted) return;
    const o = opts || {};
    const t0 = c.currentTime + start;
    const osc = c.createOscillator();
    const g = c.createGain();
    osc.type = o.type || 'sine';
    osc.frequency.setValueAtTime(freq, t0);
    if (o.slideTo) osc.frequency.exponentialRampToValueAtTime(o.slideTo, t0 + dur);
    const vol = o.vol == null ? 0.25 : o.vol;
    g.gain.setValueAtTime(0.0001, t0);
    g.gain.exponentialRampToValueAtTime(vol, t0 + (o.attack || 0.005));
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
    osc.connect(g).connect(master);
    osc.start(t0);
    osc.stop(t0 + dur + 0.05);
  }

  function noise(start, dur, opts) {
    const c = ac();
    if (!c || muted) return;
    const o = opts || {};
    const len = Math.max(1, Math.floor(c.sampleRate * dur));
    const buf = c.createBuffer(1, len, c.sampleRate);
    const d = buf.getChannelData(0);
    for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
    const src = c.createBufferSource();
    src.buffer = buf;
    const f = c.createBiquadFilter();
    f.type = o.filter || 'bandpass';
    f.frequency.value = o.freq || 1500;
    f.Q.value = o.q || 0.8;
    const g = c.createGain();
    const t0 = c.currentTime + start;
    const vol = o.vol == null ? 0.3 : o.vol;
    g.gain.setValueAtTime(0.0001, t0);
    g.gain.exponentialRampToValueAtTime(vol, t0 + (o.attack || 0.004));
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
    src.connect(f).connect(g).connect(master);
    src.start(t0);
  }

  const Sound = {
    unlock() { ac(); },
    setMuted(m) { muted = m; },
    isMuted() { return muted; },

    /** Tiếng "ting ting" thông báo mạng xã hội. */
    ting() {
      tone(1568, 0, 0.18, { type: 'sine', vol: 0.18 });
      tone(2093, 0.07, 0.25, { type: 'sine', vol: 0.14 });
    },
    /** Dồn dập nhiều thông báo cùng lúc. */
    notifBurst(n) {
      for (let i = 0; i < (n || 5); i++) {
        const s = i * 0.09 + Math.random() * 0.04;
        const base = 1400 + Math.random() * 500;
        tone(base, s, 0.12, { vol: 0.1 });
        tone(base * 1.33, s + 0.05, 0.14, { vol: 0.08 });
      }
    },
    /** Còi cảnh báo đỏ khi HP thấp. */
    alarm() {
      tone(880, 0, 0.22, { type: 'square', vol: 0.07, slideTo: 620 });
      tone(880, 0.26, 0.22, { type: 'square', vol: 0.07, slideTo: 620 });
    },
    correct() {
      tone(784, 0, 0.12, { type: 'triangle', vol: 0.22 });
      tone(1175, 0.08, 0.2, { type: 'triangle', vol: 0.2 });
    },
    wrong() {
      tone(196, 0, 0.3, { type: 'sawtooth', vol: 0.12, slideTo: 110 });
      noise(0, 0.15, { freq: 400, vol: 0.12 });
    },
    hit() {
      tone(120, 0, 0.35, { type: 'sine', vol: 0.35, slideTo: 50 });
      noise(0, 0.2, { freq: 300, filter: 'lowpass', vol: 0.25 });
    },
    shatter() {
      noise(0, 0.25, { freq: 4000, q: 0.6, vol: 0.18 });
      tone(2600, 0, 0.08, { vol: 0.08 });
    },
    whoosh() {
      noise(0, 0.45, { freq: 900, q: 0.5, vol: 0.15, attack: 0.15 });
    },
    tick(urgent) {
      tone(urgent ? 1320 : 990, 0, 0.05, { type: 'square', vol: urgent ? 0.09 : 0.04 });
    },
    heartbeat() {
      tone(70, 0, 0.18, { vol: 0.45 });
      tone(62, 0.22, 0.2, { vol: 0.35 });
    },
    /** Hồi máu: hợp âm đi lên. */
    heal() {
      [523, 659, 784, 1047].forEach((f, i) => tone(f, i * 0.07, 0.35, { type: 'triangle', vol: 0.14 }));
    },
    /** Tiếng vỗ tay khi thắng: hàng trăm tiếng "bộp" ngẫu nhiên. */
    applause(seconds) {
      const dur = seconds || 3.5;
      for (let i = 0; i < dur * 70; i++) {
        const s = Math.random() * dur;
        const fade = 1 - s / dur;
        noise(s, 0.03 + Math.random() * 0.03, { freq: 1200 + Math.random() * 1800, q: 1.2, vol: 0.12 * fade + 0.02 });
      }
      [523, 659, 784, 1047, 1319].forEach((f, i) => tone(f, i * 0.12, 0.6, { type: 'triangle', vol: 0.12 }));
    },
    /** Nhạc báo hậu quả (HP = 0). */
    doom() {
      tone(220, 0, 1.4, { type: 'sawtooth', vol: 0.1, slideTo: 82 });
      tone(233, 0.05, 1.4, { type: 'sawtooth', vol: 0.08, slideTo: 87 });
      noise(0, 1.2, { freq: 200, filter: 'lowpass', vol: 0.2, attack: 0.3 });
    },
    start() {
      [392, 523, 659, 784].forEach((f, i) => tone(f, i * 0.09, 0.3, { type: 'triangle', vol: 0.16 }));
    },
  };

  window.Sound = Sound;
})();

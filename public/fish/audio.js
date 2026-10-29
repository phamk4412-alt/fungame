// Âm thanh tự tổng hợp bằng Web Audio: sóng nước, chim hót, dế kêu, tiếng bắn nước, máy cuộn dây
export class Sound {
  constructor() {
    this.ctx = null;
    this.muted = localStorage.getItem('fish.mute') === '1';
    this.night = 0;
    this.lake = 'sen';
    this.reelGain = null;
    this.tensionOsc = null;
  }

  start() {
    if (this.ctx) {
      if (this.ctx.state === 'suspended') this.ctx.resume();
      return;
    }
    const Ctx = window.AudioContext || window.webkitAudioContext;
    if (!Ctx) return;
    this.ctx = new Ctx();
    this.master = this.ctx.createGain();
    this.master.gain.value = this.muted ? 0 : 0.8;
    this.master.connect(this.ctx.destination);
    this.noiseBuf = this.makeNoise(2);
    this.ambient();
    this.tick = setInterval(() => this.critters(), 700);
  }

  setMuted(m) {
    this.muted = m;
    localStorage.setItem('fish.mute', m ? '1' : '0');
    if (this.master) this.master.gain.value = m ? 0 : 0.8;
  }

  makeNoise(sec) {
    const buf = this.ctx.createBuffer(1, this.ctx.sampleRate * sec, this.ctx.sampleRate);
    const d = buf.getChannelData(0);
    let last = 0;
    for (let i = 0; i < d.length; i++) {
      const w = Math.random() * 2 - 1;
      last = (last + 0.02 * w) / 1.02; // nhiễu nâu, nghe như sóng
      d[i] = last * 3.5 * 0.5 + w * 0.5;
    }
    return buf;
  }

  noise(loop = false) {
    const s = this.ctx.createBufferSource();
    s.buffer = this.noiseBuf;
    s.loop = loop;
    return s;
  }

  ambient() {
    const c = this.ctx;
    // sóng vỗ nhẹ
    const src = this.noise(true);
    const lp = c.createBiquadFilter();
    lp.type = 'lowpass';
    lp.frequency.value = 500;
    const g = c.createGain();
    g.gain.value = 0.06;
    const lfo = c.createOscillator();
    lfo.frequency.value = 0.15;
    const lfoG = c.createGain();
    lfoG.gain.value = 0.03;
    lfo.connect(lfoG).connect(g.gain);
    src.connect(lp).connect(g).connect(this.master);
    src.start();
    lfo.start();
    // gió
    const wind = this.noise(true);
    const bp = c.createBiquadFilter();
    bp.type = 'bandpass';
    bp.frequency.value = 900;
    bp.Q.value = 0.4;
    this.windGain = c.createGain();
    this.windGain.gain.value = 0.015;
    wind.connect(bp).connect(this.windGain).connect(this.master);
    wind.start(0, 0.7);
    // tiếng máy cuộn: nhiễu cao, bật khi đang kéo
    const reel = this.noise(true);
    const hp = c.createBiquadFilter();
    hp.type = 'highpass';
    hp.frequency.value = 3000;
    this.reelGain = c.createGain();
    this.reelGain.gain.value = 0;
    const am = c.createOscillator();
    am.type = 'square';
    am.frequency.value = 28;
    const amG = c.createGain();
    amG.gain.value = 0.5;
    const amOut = c.createGain();
    amOut.gain.value = 0.5;
    am.connect(amG).connect(amOut.gain);
    reel.connect(hp).connect(amOut).connect(this.reelGain).connect(this.master);
    reel.start();
    am.start();
    // dây căng kêu cót két
    this.tensionOsc = c.createOscillator();
    this.tensionOsc.type = 'sawtooth';
    this.tensionOsc.frequency.value = 180;
    const tf = c.createBiquadFilter();
    tf.type = 'bandpass';
    tf.frequency.value = 800;
    tf.Q.value = 6;
    this.tensionGain = c.createGain();
    this.tensionGain.gain.value = 0;
    this.tensionOsc.connect(tf).connect(this.tensionGain).connect(this.master);
    this.tensionOsc.start();
  }

  setFight(reeling, tension) {
    if (!this.ctx) return;
    const t = this.ctx.currentTime;
    this.reelGain.gain.setTargetAtTime(reeling ? 0.09 : 0, t, 0.05);
    const danger = Math.max(0, tension - 0.75) * 4;
    this.tensionGain.gain.setTargetAtTime(Math.min(0.05, danger * 0.05), t, 0.05);
    this.tensionOsc.frequency.setTargetAtTime(140 + tension * 260, t, 0.05);
  }

  env(node, peak, attack, decay) {
    const t = this.ctx.currentTime;
    node.gain.setValueAtTime(0, t);
    node.gain.linearRampToValueAtTime(peak, t + attack);
    node.gain.exponentialRampToValueAtTime(0.0001, t + attack + decay);
  }

  splash(size = 1) {
    if (!this.ctx) return;
    const c = this.ctx;
    const s = this.noise();
    const f = c.createBiquadFilter();
    f.type = 'bandpass';
    f.frequency.value = 1400 - Math.min(size, 3) * 250;
    f.Q.value = 0.7;
    const g = c.createGain();
    s.connect(f).connect(g).connect(this.master);
    this.env(g, 0.25 * Math.min(1.6, 0.4 + size * 0.5), 0.005, 0.25 + size * 0.2);
    s.start(0, Math.random());
    s.stop(c.currentTime + 1.2);
  }

  plop() {
    if (!this.ctx) return;
    const c = this.ctx;
    const o = c.createOscillator();
    o.type = 'sine';
    o.frequency.setValueAtTime(900, c.currentTime);
    o.frequency.exponentialRampToValueAtTime(220, c.currentTime + 0.12);
    const g = c.createGain();
    o.connect(g).connect(this.master);
    this.env(g, 0.12, 0.003, 0.15);
    o.start();
    o.stop(c.currentTime + 0.25);
  }

  whoosh() {
    if (!this.ctx) return;
    const c = this.ctx;
    const s = this.noise();
    const f = c.createBiquadFilter();
    f.type = 'bandpass';
    f.Q.value = 2;
    f.frequency.setValueAtTime(400, c.currentTime);
    f.frequency.exponentialRampToValueAtTime(2500, c.currentTime + 0.35);
    const g = c.createGain();
    s.connect(f).connect(g).connect(this.master);
    this.env(g, 0.2, 0.08, 0.35);
    s.start(0, Math.random());
    s.stop(c.currentTime + 0.6);
  }

  snap() {
    if (!this.ctx) return;
    const c = this.ctx;
    const s = this.noise();
    const f = c.createBiquadFilter();
    f.type = 'highpass';
    f.frequency.value = 2500;
    const g = c.createGain();
    s.connect(f).connect(g).connect(this.master);
    this.env(g, 0.5, 0.001, 0.12);
    s.start();
    s.stop(c.currentTime + 0.3);
  }

  tone(freq, when, dur, type = 'triangle', vol = 0.12) {
    const c = this.ctx;
    const o = c.createOscillator();
    o.type = type;
    o.frequency.value = freq;
    const g = c.createGain();
    o.connect(g).connect(this.master);
    const t = c.currentTime + when;
    g.gain.setValueAtTime(0, t);
    g.gain.linearRampToValueAtTime(vol, t + 0.02);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.start(t);
    o.stop(t + dur + 0.05);
  }

  bite() {
    if (!this.ctx) return;
    this.tone(660, 0, 0.12, 'square', 0.06);
    this.tone(880, 0.1, 0.18, 'square', 0.06);
  }

  fanfare(rarity) {
    if (!this.ctx) return;
    const scales = [
      [523, 659, 784],
      [523, 659, 784, 1047],
      [392, 523, 659, 784, 1047, 1319],
      [262, 392, 523, 659, 784, 1047, 1319, 1568],
    ];
    scales[rarity].forEach((f, i) => this.tone(f, i * 0.09, 0.5 + rarity * 0.2, 'triangle', 0.1));
    if (rarity >= 2) [523, 659, 784].forEach((f) => this.tone(f * 2, scales[rarity].length * 0.09, 1.6, 'sine', 0.06));
  }

  fail() {
    if (!this.ctx) return;
    this.tone(330, 0, 0.25, 'triangle', 0.1);
    this.tone(247, 0.18, 0.4, 'triangle', 0.1);
  }

  coin() {
    if (!this.ctx) return;
    this.tone(988, 0, 0.1, 'square', 0.05);
    this.tone(1319, 0.08, 0.3, 'square', 0.05);
  }

  // chim hót ban ngày, dế và ếch ban đêm
  critters() {
    if (!this.ctx || this.muted) return;
    const c = this.ctx;
    if (this.night < 0.5) {
      if (Math.random() < (this.lake === 'bang' ? 0.05 : 0.3)) {
        const base = 2200 + Math.random() * 1800;
        const n = 2 + Math.floor(Math.random() * 4);
        for (let i = 0; i < n; i++) {
          const o = c.createOscillator();
          o.type = 'sine';
          const t = c.currentTime + i * 0.11;
          o.frequency.setValueAtTime(base, t);
          o.frequency.exponentialRampToValueAtTime(base * (1.3 + Math.random() * 0.4), t + 0.07);
          const g = c.createGain();
          g.gain.setValueAtTime(0, t);
          g.gain.linearRampToValueAtTime(0.025, t + 0.01);
          g.gain.exponentialRampToValueAtTime(0.0001, t + 0.09);
          o.connect(g).connect(this.master);
          o.start(t);
          o.stop(t + 0.1);
        }
      }
    } else if (this.lake !== 'bang') {
      // dế
      const o = c.createOscillator();
      o.type = 'square';
      o.frequency.value = 4300 + Math.random() * 300;
      const am = c.createOscillator();
      am.frequency.value = 32;
      const amG = c.createGain();
      amG.gain.value = 0.012;
      const g = c.createGain();
      g.gain.value = 0;
      am.connect(amG).connect(g.gain);
      o.connect(g).connect(this.master);
      o.start();
      am.start();
      o.stop(c.currentTime + 0.35);
      am.stop(c.currentTime + 0.35);
      // ếch kêu ở hồ sen
      if (this.lake === 'sen' && Math.random() < 0.25) {
        const f = c.createOscillator();
        f.type = 'sawtooth';
        f.frequency.value = 110 + Math.random() * 40;
        const lp = c.createBiquadFilter();
        lp.type = 'lowpass';
        lp.frequency.value = 600;
        const fg = c.createGain();
        f.connect(lp).connect(fg).connect(this.master);
        this.env(fg, 0.05, 0.02, 0.18);
        f.start();
        f.stop(c.currentTime + 0.25);
      }
    }
  }
}

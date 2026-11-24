// Âm thanh tổng hợp bằng WebAudio: tiếng máy pít-tông, gió, còi báo thất tốc, tiếng lốp chạm đất.
export class Sound {
  constructor() {
    this.ctx = null;
    this.on = true;
  }

  start() {
    if (this.ctx) { this.ctx.resume(); return; }
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return;
    const c = (this.ctx = new AC());
    this.master = c.createGain();
    this.master.gain.value = this.on ? 0.7 : 0;
    this.cabin = c.createBiquadFilter(); // lọc giảm khi ngồi trong buồng lái
    this.cabin.type = 'lowpass';
    this.cabin.frequency.value = 2400;
    this.cabin.connect(this.master);
    this.master.connect(c.destination);

    // động cơ: hai sóng răng cưa lệch nhau + nhịp nổ
    this.eng = c.createGain(); this.eng.gain.value = 0;
    const lp = c.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 700; lp.Q.value = 2;
    this.engLp = lp;
    this.eng.connect(lp); lp.connect(this.cabin);
    this.o1 = c.createOscillator(); this.o1.type = 'sawtooth';
    this.o2 = c.createOscillator(); this.o2.type = 'square';
    this.o3 = c.createOscillator(); this.o3.type = 'sawtooth';
    const g2 = c.createGain(); g2.gain.value = 0.4;
    const g3 = c.createGain(); g3.gain.value = 0.3;
    this.o1.connect(this.eng); this.o2.connect(g2); g2.connect(this.eng); this.o3.connect(g3); g3.connect(this.eng);
    // điều biên theo nhịp nổ xi lanh
    this.lfo = c.createOscillator(); this.lfo.type = 'sine';
    this.lfoG = c.createGain(); this.lfoG.gain.value = 0.35;
    this.lfo.connect(this.lfoG); this.lfoG.connect(this.eng.gain);
    [this.o1, this.o2, this.o3, this.lfo].forEach((o) => o.start());

    // gió + tiếng cánh quạt (nhiễu lọc)
    const len = c.sampleRate * 2;
    const buf = c.createBuffer(1, len, c.sampleRate);
    const d = buf.getChannelData(0);
    let b0 = 0;
    for (let i = 0; i < len; i++) { b0 = 0.97 * b0 + 0.03 * (Math.random() * 2 - 1); d[i] = b0 * 4; }
    const noise = c.createBufferSource(); noise.buffer = buf; noise.loop = true;
    this.windF = c.createBiquadFilter(); this.windF.type = 'bandpass'; this.windF.frequency.value = 500; this.windF.Q.value = 0.6;
    this.wind = c.createGain(); this.wind.gain.value = 0;
    noise.connect(this.windF); this.windF.connect(this.wind); this.wind.connect(this.cabin);
    // ầm ầm bánh xe trên đường băng
    this.rollF = c.createBiquadFilter(); this.rollF.type = 'lowpass'; this.rollF.frequency.value = 160;
    this.roll = c.createGain(); this.roll.gain.value = 0;
    noise.connect(this.rollF); this.rollF.connect(this.roll); this.roll.connect(this.cabin);
    noise.start();

    // còi thất tốc
    this.horn = c.createOscillator(); this.horn.type = 'triangle'; this.horn.frequency.value = 1650;
    this.hornG = c.createGain(); this.hornG.gain.value = 0;
    this.horn.connect(this.hornG); this.hornG.connect(this.master);
    this.horn.start();
  }

  setOn(on) {
    this.on = on;
    if (this.master) this.master.gain.value = on ? 0.7 : 0;
  }

  /** Cập nhật mỗi khung: rpm, tốc độ (m/s), mức thất tốc, đang lăn bánh, trong buồng lái. */
  update(s) {
    if (!this.ctx) return;
    const t = this.ctx.currentTime;
    const f = Math.max(8, s.rpm / 60 * 2); // tần số nổ (4 xi lanh)
    this.o1.frequency.setTargetAtTime(f, t, 0.05);
    this.o2.frequency.setTargetAtTime(f * 0.5, t, 0.05);
    this.o3.frequency.setTargetAtTime(f * 2.02, t, 0.05);
    this.lfo.frequency.setTargetAtTime(f / 2, t, 0.05);
    const run = s.rpm > 200 ? 1 : 0;
    this.eng.gain.setTargetAtTime(run * (0.08 + 0.1 * s.throttle), t, 0.08);
    this.engLp.frequency.setTargetAtTime(400 + s.rpm * 0.35, t, 0.1);
    this.wind.gain.setTargetAtTime(Math.min(0.5, (s.speed / 70) ** 2 * 0.35), t, 0.1);
    this.windF.frequency.setTargetAtTime(300 + s.speed * 12, t, 0.1);
    this.roll.gain.setTargetAtTime(s.ground ? Math.min(0.6, s.speed / 30) : 0, t, 0.05);
    const stall = s.stallWarn ? 0.12 : 0;
    this.hornG.gain.setTargetAtTime(stall, t, 0.03);
    this.cabin.frequency.setTargetAtTime(s.inside ? 1800 : 6000, t, 0.2);
  }

  /** Tiếng lốp rít khi chạm đất. */
  chirp(strength) {
    if (!this.ctx || !this.on) return;
    const c = this.ctx, t = c.currentTime;
    const o = c.createOscillator(); o.type = 'sawtooth';
    o.frequency.setValueAtTime(900, t); o.frequency.exponentialRampToValueAtTime(300, t + 0.25);
    const g = c.createGain(); g.gain.setValueAtTime(Math.min(0.25, 0.08 * strength), t); g.gain.exponentialRampToValueAtTime(0.001, t + 0.3);
    const bp = c.createBiquadFilter(); bp.type = 'bandpass'; bp.frequency.value = 1200;
    o.connect(bp); bp.connect(g); g.connect(this.master);
    o.start(t); o.stop(t + 0.32);
  }

  /** Tiếng va chạm khi rơi. */
  crash() {
    if (!this.ctx || !this.on) return;
    const c = this.ctx, t = c.currentTime;
    const len = c.sampleRate;
    const buf = c.createBuffer(1, len, c.sampleRate);
    const d = buf.getChannelData(0);
    for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / len, 3);
    const src = c.createBufferSource(); src.buffer = buf;
    const lp = c.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 600;
    const g = c.createGain(); g.gain.value = 0.9;
    src.connect(lp); lp.connect(g); g.connect(this.master);
    src.start(t);
    this.eng.gain.setTargetAtTime(0, t, 0.1);
  }
}

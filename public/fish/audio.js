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
    // tiếng máy cuộn: vù vù của bánh răng, bật khi đang quay tay quay
    const reel = this.noise(true);
    const rbp2 = c.createBiquadFilter();
    rbp2.type = 'bandpass';
    rbp2.frequency.value = 1700;
    rbp2.Q.value = 1.2;
    this.reelGain = c.createGain();
    this.reelGain.gain.value = 0;
    const am = c.createOscillator();
    am.type = 'sine';
    am.frequency.value = 22;
    const amG = c.createGain();
    amG.gain.value = 0.4;
    const amOut = c.createGain();
    amOut.gain.value = 0.6;
    am.connect(amG).connect(amOut.gain);
    reel.connect(rbp2).connect(amOut).connect(this.reelGain).connect(this.master);
    reel.start(0, 0.3);
    am.start();
    this.reelAm = am;
    // nước sủi khi cá quẫy dưới chân
    const churn = this.noise(true);
    const clp = c.createBiquadFilter();
    clp.type = 'lowpass';
    clp.frequency.value = 650;
    this.churnGain = c.createGain();
    this.churnGain.gain.value = 0;
    churn.connect(clp).connect(this.churnGain).connect(this.master);
    churn.start(0, 0.9);
    this.clickBuf = this.makeClick();
    this.clickT = 0;
    this.creakT = 1;
    // tiếng mưa rơi lộp độp trên mặt hồ
    const rain = this.noise(true);
    const rbp = c.createBiquadFilter();
    rbp.type = 'highpass';
    rbp.frequency.value = 1800;
    this.rainGain = c.createGain();
    this.rainGain.gain.value = 0;
    rain.connect(rbp).connect(this.rainGain).connect(this.master);
    rain.start(0, 1.3);
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

  setRain(r) {
    if (!this.rainGain) return;
    this.rainGain.gain.setTargetAtTime(r * 0.07, this.ctx.currentTime, 1.5);
  }

  // tiếng "tách" kim loại của bánh cóc trong máy câu
  makeClick() {
    const sr = this.ctx.sampleRate;
    const buf = this.ctx.createBuffer(1, Math.floor(sr * 0.03), sr);
    const d = buf.getChannelData(0);
    for (let i = 0; i < d.length; i++) {
      const t = i / sr;
      const ring = Math.sin(t * 2 * Math.PI * 3900) * 0.6 + Math.sin(t * 2 * Math.PI * 6100) * 0.4;
      d[i] = (ring * 0.7 + (Math.random() * 2 - 1) * 0.5) * Math.exp(-t * 260);
    }
    return buf;
  }

  click(when, vol, rate) {
    const s = this.ctx.createBufferSource();
    s.buffer = this.clickBuf;
    s.playbackRate.value = rate;
    const g = this.ctx.createGain();
    g.gain.value = vol;
    s.connect(g).connect(this.master);
    s.start(when);
  }

  // tiếng cần cong kêu răng rắc khi bị kéo mạnh
  creak(strength) {
    const c = this.ctx;
    const o = c.createOscillator();
    o.type = 'sawtooth';
    const t = c.currentTime;
    const f0 = 70 + Math.random() * 40;
    o.frequency.setValueAtTime(f0, t);
    o.frequency.linearRampToValueAtTime(f0 * (1.2 + Math.random() * 0.4), t + 0.25);
    const lp = c.createBiquadFilter();
    lp.type = 'bandpass';
    lp.frequency.value = 420;
    lp.Q.value = 3;
    const trem = c.createOscillator();
    trem.frequency.value = 35 + Math.random() * 25;
    const tg = c.createGain();
    tg.gain.value = 0.5;
    const g = c.createGain();
    const out = c.createGain();
    trem.connect(tg).connect(g.gain);
    o.connect(lp).connect(g).connect(out).connect(this.master);
    this.env(out, 0.06 * strength, 0.04, 0.3);
    o.start();
    trem.start();
    o.stop(t + 0.4);
    trem.stop(t + 0.4);
  }

  // f: {reeling, inside, surging, tension} khi đang dằng co, null khi không
  setFight(f, dt = 0) {
    if (!this.ctx) return;
    const t = this.ctx.currentTime;
    const on = !!f;
    const reeling = on && f.reeling;
    // cá đang kéo dây ra: drag rít liên hồi, càng lao mạnh càng dồn dập
    const drag = on && (!f.inside || f.surging);
    this.reelGain.gain.setTargetAtTime(reeling ? 0.05 : 0, t, 0.05);
    this.reelAm.frequency.setTargetAtTime(reeling ? 22 : 10, t, 0.1);
    this.churnGain.gain.setTargetAtTime(on ? (f.surging ? 0.09 : 0.03) : 0, t, f && f.surging ? 0.05 : 0.3);
    const tension = on ? f.tension : 0;
    const danger = Math.max(0, tension - 0.6) * 2.5;
    this.tensionGain.gain.setTargetAtTime(Math.min(0.04, danger * 0.04), t, 0.05);
    this.tensionOsc.frequency.setTargetAtTime(140 + tension * 260 + Math.random() * 20, t, 0.05);
    if (!on || this.muted) return;
    // lách cách: quay tay quay ~18 tiếng/giây, drag xả dây 35-70 tiếng/giây
    const rate = drag ? (f.surging ? 70 : 38) : reeling ? 18 : 0;
    if (rate > 0) {
      // clickT = còn bao lâu tới tiếng tách kế tiếp, xếp lịch trước 60 ms cho đều
      this.clickT = Math.max(-0.05, this.clickT - dt);
      while (this.clickT < 0.06) {
        const when = t + Math.max(0, this.clickT);
        if (drag) this.click(when, 0.11 + (f.surging ? 0.05 : 0), 1.15 + Math.random() * 0.1);
        else this.click(when, 0.07, 0.85 + Math.random() * 0.08);
        this.clickT += (1 / rate) * (0.85 + Math.random() * 0.3);
      }
    } else this.clickT = 0;
    this.creakT -= dt;
    if (this.creakT <= 0 && tension > 0.7) {
      this.creak(Math.min(1.5, tension));
      this.creakT = 0.6 + Math.random() * 1.2;
    }
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

  // tiếng thủy quái gầm: răng cưa trầm trượt xuống, rè rè qua lọc
  roar(len = 2.2) {
    if (!this.ctx) return;
    const c = this.ctx;
    const t = c.currentTime;
    const out = c.createGain();
    out.connect(this.master);
    out.gain.setValueAtTime(0, t);
    out.gain.linearRampToValueAtTime(0.32, t + 0.15);
    out.gain.setValueAtTime(0.32, t + len * 0.6);
    out.gain.exponentialRampToValueAtTime(0.0001, t + len);
    const lp = c.createBiquadFilter();
    lp.type = 'lowpass';
    lp.frequency.setValueAtTime(900, t);
    lp.frequency.linearRampToValueAtTime(350, t + len);
    lp.Q.value = 4;
    lp.connect(out);
    for (const [f, d] of [[62, 0], [93, 4], [124, -6]]) {
      const o = c.createOscillator();
      o.type = 'sawtooth';
      o.frequency.setValueAtTime(f * 1.25, t);
      o.frequency.linearRampToValueAtTime(f * 0.8, t + len);
      o.detune.value = d * 10;
      const wob = c.createOscillator();
      wob.frequency.value = 9 + Math.random() * 6;
      const wg = c.createGain();
      wg.gain.value = f * 0.12;
      wob.connect(wg).connect(o.frequency);
      o.connect(lp);
      o.start(t);
      wob.start(t);
      o.stop(t + len + 0.1);
      wob.stop(t + len + 0.1);
    }
    const n = this.noise();
    const bp = c.createBiquadFilter();
    bp.type = 'bandpass';
    bp.frequency.value = 500;
    bp.Q.value = 0.8;
    const ng = c.createGain();
    ng.gain.value = 0.6;
    n.connect(bp).connect(ng).connect(out);
    n.start(t, Math.random());
    n.stop(t + len + 0.1);
  }

  // ầm ầm dưới đáy hồ trước khi quái trồi lên
  rumble(len = 3) {
    if (!this.ctx) return;
    const c = this.ctx;
    const n = this.noise();
    const lp = c.createBiquadFilter();
    lp.type = 'lowpass';
    lp.frequency.value = 120;
    const g = c.createGain();
    n.connect(lp).connect(g).connect(this.master);
    const t = c.currentTime;
    g.gain.setValueAtTime(0, t);
    g.gain.linearRampToValueAtTime(0.9, t + len * 0.8);
    g.gain.exponentialRampToValueAtTime(0.0001, t + len);
    n.start(t, Math.random());
    n.stop(t + len + 0.1);
  }

  // gỗ vỡ răng rắc
  crunch() {
    if (!this.ctx) return;
    const c = this.ctx;
    for (let i = 0; i < 7; i++) {
      const n = this.noise();
      const bp = c.createBiquadFilter();
      bp.type = 'bandpass';
      bp.frequency.value = 600 + Math.random() * 1800;
      bp.Q.value = 2;
      const g = c.createGain();
      n.connect(bp).connect(g).connect(this.master);
      const t = c.currentTime + i * 0.045 + Math.random() * 0.03;
      g.gain.setValueAtTime(0, t);
      g.gain.linearRampToValueAtTime(0.5, t + 0.004);
      g.gain.exponentialRampToValueAtTime(0.0001, t + 0.12);
      n.start(t, Math.random());
      n.stop(t + 0.15);
    }
    this.splash(3);
  }

  // cú giật mạnh: tiếng đập trầm và dây kêu tưng
  slam() {
    if (!this.ctx) return;
    const c = this.ctx;
    const o = c.createOscillator();
    o.type = 'sine';
    const t = c.currentTime;
    o.frequency.setValueAtTime(110, t);
    o.frequency.exponentialRampToValueAtTime(38, t + 0.35);
    const g = c.createGain();
    o.connect(g).connect(this.master);
    g.gain.setValueAtTime(0.6, t);
    g.gain.exponentialRampToValueAtTime(0.0001, t + 0.5);
    o.start(t);
    o.stop(t + 0.55);
    this.tone(1900, 0, 0.25, 'triangle', 0.05);
    this.splash(2.5);
  }

  // máy đuôi tôm của Lão Ngư
  motor(on) {
    if (!this.ctx) return;
    const c = this.ctx;
    if (on && !this.motorOsc) {
      const o = c.createOscillator();
      o.type = 'sawtooth';
      o.frequency.value = 46;
      const am = c.createOscillator();
      am.frequency.value = 23;
      const amG = c.createGain();
      amG.gain.value = 0.03;
      const g = c.createGain();
      g.gain.value = 0.03;
      const lp = c.createBiquadFilter();
      lp.type = 'lowpass';
      lp.frequency.value = 500;
      am.connect(amG).connect(g.gain);
      o.connect(lp).connect(g).connect(this.master);
      o.start();
      am.start();
      this.motorOsc = [o, am];
    } else if (!on && this.motorOsc) {
      for (const o of this.motorOsc) o.stop();
      this.motorOsc = null;
    }
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

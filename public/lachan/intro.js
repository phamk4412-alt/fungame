// LÁ CHẮN NGÔN TỪ — video mở đầu (~80 giây) giải thích trò chơi để làm gì.
// Mọi khung hình là hàm của thời gian t, nên vừa phát trực tiếp được, vừa ghi thành MP4 từng khung
// (window.__intro.seek(t) + window.__intro.renderAudio() cho nhạc nền).
(function () {
  'use strict';
  const D = window.LCNT_DATA;
  const DURATION = 80;
  const $ = (id) => document.getElementById(id);
  const stage = $('stage');
  const clamp = (x, a, b) => Math.max(a, Math.min(b, x));
  const ease = (x) => 1 - Math.pow(1 - clamp(x, 0, 1), 3);
  const back = (x) => { x = clamp(x, 0, 1); const c = 1.7; return 1 + (c + 1) * Math.pow(x - 1, 3) + c * Math.pow(x - 1, 2); };
  const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

  // ---------- Nội dung lấy từ data.json ----------
  $('tTitle').textContent = D.meta.title;
  $('tSub').textContent = D.meta.subtitle;
  $('finalMsg').textContent = D.meta.finalMessage;
  const POST = D.post.text;
  const victim = D.characters.victim;

  // Bình luận cho cảnh mưa bình luận: chọn những câu miệt thị/hùa theo, tránh câu đe dọa hay kích động tự hại.
  const COMMENTS = [
    ['Trà My', 'Nhìn cái mặt là biết loại gian lận rồi 🙄'],
    ['Hội Hóng Hớt', '=))))) lên thớt rồi kìa ae ơi vào xem đi'],
    ['Hùa Theo Team', 'Ai cũng nói vậy thì chắc là đúng thôi 😂😂'],
    ['Khoa Nguyễn', 'Mặt dày thật, còn dám đăng story cười nữa à?'],
    ['Page Biến Căng', 'Tag hết bạn bè vào đây coi biến nè!!! 🔥🔥🔥'],
    ['Văn Toàn', 'Đồ ngu, học hành gì tầm này mà đòi điểm cao.'],
    ['Nhóm Chém Gió', 'Ae vào cmt dạo cho vui nào 🍿🍿🍿'],
    ['Lan Phương', 'Bạn cùng phòng nó kể nó còn trộm đồ nữa đó.'],
    ['Ae Thích Drama', 'Hóng phần 2!!! Ai có thêm biến thì thả vào đây'],
    ['Bé Na', 'Đúng loại hai mặt, nhìn đã thấy ghét.'],
    ['Minh Tú', 'Share mạnh cho cả khoa biết mặt đi mọi người'],
  ];
  const C_START = 9.2, C_GAP = 0.72, SLOT = 118;
  const cmtsBox = $('cmts');
  const cmtEls = COMMENTS.map(([name, text]) => {
    const el = document.createElement('div');
    el.className = 'cmt';
    el.innerHTML = `<div class="cav">${window.Avatar.svg(window.Avatar.fromName(name), name.length % 3 ? 'smirk' : 'neutral')}</div><div class="bub"><b>${esc(name)}</b>${esc(text)}</div>`;
    el.style.opacity = 0;
    cmtsBox.appendChild(el);
    return el;
  });

  // Ba màn chơi
  $('rounds').innerHTML = [D.round1, D.round2, D.round3].map((r, i) =>
    `<div class="round a pop" data-in="${46.4 + i * 2.1}"><em>MÀN ${i + 1}</em><b>${esc(r.name)}</b><span>${esc(r.goal)}</span></div>`).join('');

  const sections = [...document.querySelectorAll('.sc')].map((el) => ({ el, from: +el.dataset.from, to: +el.dataset.to }));
  const anims = [...document.querySelectorAll('.a')].map((el) => {
    const sc = sections.find((s) => s.el.contains(el));
    return { el, t0: +el.dataset.in, t1: el.dataset.out ? +el.dataset.out : sc.to, kind: el.classList.contains('pop') ? 'pop' : el.classList.contains('stamp') ? 'stamp' : 'up' };
  });

  // ---------- Vẽ một khung hình ----------
  let mood = null;
  function setMood(m) {
    if (m === mood) return;
    mood = m;
    $('victimAv').innerHTML = window.Avatar.svg(victim.avatar, m);
  }
  const fmt = (n) => Math.round(n).toLocaleString('vi-VN');
  const kfmt = (n) => (n >= 1000 ? (n / 1000).toFixed(1).replace('.', ',') + 'K' : String(Math.round(n)));

  function render(t) {
    for (const s of sections) {
      const o = Math.min(ease((t - s.from) / 0.5), 1 - ease((t - (s.to - 0.5)) / 0.5));
      s.el.style.opacity = clamp(o, 0, 1);
      s.el.style.visibility = o > 0 ? 'visible' : 'hidden';
    }
    for (const a of anims) {
      const p = (t - a.t0) / (a.kind === 'up' ? 0.7 : 0.55);
      if (p <= 0 || t > a.t1) { a.el.style.opacity = 0; continue; }
      a.el.style.opacity = clamp(p * 1.6, 0, 1);
      if (a.kind === 'up') a.el.style.transform = `translateY(${(1 - ease(p)) * 50}px)`;
      else if (a.kind === 'pop') a.el.style.transform = `scale(${0.6 + 0.4 * back(p)})`;
      else a.el.style.transform = `rotate(-12deg) scale(${1 + 1.5 * (1 - ease(p * 1.4))})`;
    }

    // Cảnh 2: gõ bài viết, số đếm tăng, bình luận trôi lên, Tinh thần tụt.
    const typed = Math.floor(clamp((t - 6.3) / 2.6, 0, 1) * POST.length);
    $('postText').textContent = POST.slice(0, typed);
    const g = ease((t - 8.6) / 8.6);
    $('cReact').textContent = kfmt(4200 * g);
    $('cCmt').textContent = fmt(1900 * g);
    $('cShare').textContent = fmt(860 * g);
    const shown = clamp(Math.floor((t - C_START) / C_GAP) + 1, 0, COMMENTS.length);
    const last = C_START + (shown - 1) * C_GAP;
    const slide = shown ? 1 - ease((t - last) / 0.35) : 0;
    cmtEls.forEach((el, i) => {
      if (i >= shown) { el.style.opacity = 0; return; }
      const fromBottom = shown - 1 - i;
      const y = 470 - SLOT * (fromBottom + 1) + slide * SLOT;
      el.style.top = y + 'px';
      el.style.opacity = i === shown - 1 ? 1 - slide : 1;
    });
    const hp = 100 - 82 * ease((t - 9.4) / 8);
    $('hpFill').style.width = hp + '%';
    $('hpFill').style.background = hp > 60 ? 'linear-gradient(90deg,#3ee39b,#8ff0c4)' : hp > 30 ? 'linear-gradient(90deg,#ffcf4a,#ffe08a)' : 'linear-gradient(90deg,#ff4b5c,#ff8a8a)';
    $('hpNum').textContent = Math.round(hp) + '%';
    $('hpNum').style.color = hp > 60 ? '#3ee39b' : hp > 30 ? '#ffcf4a' : '#ff4b5c';
    setMood(t < 9.6 ? 'happy' : t < 11.5 ? 'neutral' : t < 13.5 ? 'worried' : t < 15.5 ? 'sad' : 'cry');

    // Cảnh 6: đếm ngược 5 → 1
    const c = $('count');
    const k = (t - 61.4) / 0.95;
    if (k < 0) { c.style.opacity = 0; }
    else if (k < 5) {
      const n = 5 - Math.floor(k), f = k % 1;
      c.textContent = n;
      c.style.opacity = 1 - clamp((f - 0.75) / 0.25, 0, 1) * 0.6;
      c.style.transform = `scale(${1.35 - 0.35 * ease(f * 2.5)})`;
    } else {
      c.textContent = '💗';
      c.style.opacity = ease((k - 5) * 2);
      c.style.transform = `scale(${0.6 + 0.4 * back((k - 5) * 1.5)})`;
    }

    $('prog').style.width = (clamp(t / DURATION, 0, 1) * 100) + '%';
  }

  // ---------- Nhạc nền tổng hợp (Web Audio), dùng chung cho phát trực tiếp và xuất file ----------
  const NOTE = (m) => 440 * Math.pow(2, (m - 69) / 12);
  // [thời điểm, độ dài, các nốt MIDI]
  const CHORDS = [
    [0, 5.6, [57, 64, 69, 72]],              // Am: mở đầu
    [5.6, 3.5, [57, 60, 64]], [9.1, 4, [53, 57, 60]], [13.1, 4, [52, 56, 59]], [17.1, 4, [45, 57, 60, 64]], // căng thẳng
    [21, 4.75, [50, 53, 57]], [25.75, 4.75, [52, 56, 59, 62]],  // Dm – E
    [30.5, 3.5, [53, 57, 60, 64]], [34, 3.5, [48, 55, 60, 64]], [37.5, 3.5, [55, 59, 62, 67]], [41, 3.5, [57, 60, 64, 69]], // F–C–G–Am
    [44.5, 4, [53, 57, 60, 65]], [48.5, 4, [48, 55, 60, 64]], [52.5, 4, [55, 59, 62, 67]], [56.5, 4, [48, 55, 60, 64, 67]],
    [60.5, 5.9, [45, 57, 64]],               // lặng trước đếm ngược
    [66.4, 4.6, [48, 55, 60, 64, 72]], [71, 4.5, [53, 57, 60, 65, 69]], [75.5, 4.5, [48, 55, 60, 64, 72]], // C – F – C
  ];

  function schedule(ctx, out, from, t0) {
    // from: giây trong video tại thời điểm t0 của AudioContext
    const at = (s) => t0 + (s - from);
    const master = ctx.createGain();
    master.gain.value = 1.0;
    const lp = ctx.createBiquadFilter();
    lp.type = 'lowpass'; lp.frequency.value = 2200;
    master.connect(lp); lp.connect(out);

    for (const [s, len, notes] of CHORDS) {
      if (s + len < from) continue;
      for (const m of notes) {
        for (const det of [-6, 6]) {
          const o = ctx.createOscillator(), g = ctx.createGain();
          o.type = m < 50 ? 'sine' : 'triangle';
          o.frequency.value = NOTE(m); o.detune.value = det;
          const a = Math.max(at(s), ctx.currentTime), e = at(s + len + 0.6);
          const v = (m < 50 ? 0.09 : 0.045) / notes.length * 3;
          g.gain.setValueAtTime(0, a);
          g.gain.linearRampToValueAtTime(v, Math.max(a + 0.01, at(s + 0.9)));
          g.gain.setValueAtTime(v, Math.max(a + 0.02, at(s + len - 0.2)));
          g.gain.linearRampToValueAtTime(0, e);
          o.connect(g); g.connect(master);
          o.start(a); o.stop(e + 0.05);
        }
      }
    }
    const blip = (s, f, v, dur, type) => {
      if (s < from) return;
      const o = ctx.createOscillator(), g = ctx.createGain();
      o.type = type || 'sine'; o.frequency.value = f;
      g.gain.setValueAtTime(0, at(s)); g.gain.linearRampToValueAtTime(v, at(s) + 0.01); g.gain.exponentialRampToValueAtTime(0.0001, at(s) + dur);
      o.connect(g); g.connect(master); o.start(at(s)); o.stop(at(s) + dur + 0.05);
    };
    // Tiếng thông báo cho từng bình luận
    COMMENTS.forEach((_, i) => { const s = C_START + i * C_GAP; blip(s, 1568, 0.07, 0.18); blip(s + 0.07, 2093, 0.05, 0.22); });
    // Nhịp tim khi Tinh thần tụt
    for (let s = 11; s < 20.5; s += 0.82) { blip(s, 62, 0.35, 0.22); blip(s + 0.2, 55, 0.25, 0.25); }
    // Dấu đóng "ẢNH CẮT GHÉP"
    blip(17.6, 110, 0.4, 0.5, 'square');
    // Tiếng "Gửi"
    blip(23.4, 880, 0.12, 0.25); blip(23.5, 1320, 0.1, 0.3);
    // Mỗi thẻ mục tiêu / màn chơi
    [32.4, 34.4, 36.4, 46.4, 48.5, 50.6].forEach((s, i) => blip(s, NOTE(72 + [0, 4, 7, 0, 4, 7][i]), 0.09, 0.6));
    // Đếm ngược
    for (let i = 0; i < 5; i++) blip(61.4 + i * 0.95, 880, 0.12, 0.12, 'triangle');
    blip(66.15, NOTE(84), 0.1, 1.2); blip(66.2, NOTE(88), 0.08, 1.2); blip(66.25, NOTE(91), 0.07, 1.4);
    return master;
  }

  function wav(buf) {
    const n = buf.length, ch = buf.numberOfChannels, rate = buf.sampleRate;
    const dv = new DataView(new ArrayBuffer(44 + n * ch * 2));
    const w = (o, s) => { for (let i = 0; i < s.length; i++) dv.setUint8(o + i, s.charCodeAt(i)); };
    w(0, 'RIFF'); dv.setUint32(4, 36 + n * ch * 2, true); w(8, 'WAVE'); w(12, 'fmt ');
    dv.setUint32(16, 16, true); dv.setUint16(20, 1, true); dv.setUint16(22, ch, true); dv.setUint32(24, rate, true);
    dv.setUint32(28, rate * ch * 2, true); dv.setUint16(32, ch * 2, true); dv.setUint16(34, 16, true); w(36, 'data'); dv.setUint32(40, n * ch * 2, true);
    const chans = [...Array(ch)].map((_, c) => buf.getChannelData(c));
    let o = 44;
    for (let i = 0; i < n; i++) for (let c = 0; c < ch; c++) { dv.setInt16(o, clamp(chans[c][i], -1, 1) * 32767, true); o += 2; }
    return new Uint8Array(dv.buffer);
  }

  // ---------- Phát trực tiếp ----------
  let t = 0, playing = false, lastNow = 0, actx = null, bus = null, muted = false;
  function startAudio() {
    if (muted) return;
    actx = actx || new (window.AudioContext || window.webkitAudioContext)();
    actx.resume();
    stopAudio();
    bus = schedule(actx, actx.destination, t, actx.currentTime + 0.05);
  }
  function stopAudio() { if (bus) { try { bus.disconnect(); } catch (e) { /* đã ngắt */ } bus = null; } }
  function loop(now) {
    if (!playing) return;
    t += (now - lastNow) / 1000; lastNow = now;
    if (t >= DURATION) { t = DURATION; playing = false; stopAudio(); $('ui').classList.remove('hide'); $('playBtn').textContent = '↺ Xem lại'; }
    render(t);
    if (playing) requestAnimationFrame(loop);
  }
  function play() { if (t >= DURATION) t = 0; playing = true; lastNow = performance.now(); $('ui').classList.add('hide'); startAudio(); requestAnimationFrame(loop); }
  function pause() { playing = false; stopAudio(); }
  function seek(s) { t = clamp(s, 0, DURATION); render(t); if (playing) startAudio(); }

  function fit() {
    const k = Math.min(innerWidth / 1920, innerHeight / 1080);
    stage.style.transform = `scale(${k}) translate(-50%, -50%)`;
  }
  addEventListener('resize', fit);
  fit();
  render(0.0001);
  render(2.6); // khung chờ: hiện sẵn tựa đề sau lớp nút Phát

  $('playBtn').onclick = () => { t = 0; play(); };
  addEventListener('keydown', (e) => {
    if (e.code === 'Space') { e.preventDefault(); if (playing) pause(); else play(); }
    else if (e.key === 'ArrowRight') seek(t + 5);
    else if (e.key === 'ArrowLeft') seek(t - 5);
    else if (e.key === 'm' || e.key === 'M') { muted = !muted; if (muted) stopAudio(); else if (playing) startAudio(); }
    else if (e.key === 'f' || e.key === 'F') { if (document.fullscreenElement) document.exitFullscreen(); else document.documentElement.requestFullscreen().catch(() => {}); }
  });
  stage.addEventListener('click', () => { if (playing) pause(); else play(); });

  // ---------- Móc cho công cụ ghi hình (tools/lachan-intro-video.js) ----------
  window.__intro = {
    duration: DURATION,
    seek(s) { playing = false; document.body.classList.add('rec'); $('ui').classList.add('hide'); t = s; render(s); },
    async renderAudio() {
      const rate = 44100;
      const ctx = new OfflineAudioContext(2, Math.ceil(rate * DURATION), rate);
      schedule(ctx, ctx.destination, 0, 0);
      const bytes = wav(await ctx.startRendering());
      let s = '';
      for (let i = 0; i < bytes.length; i += 0x8000) s += String.fromCharCode.apply(null, bytes.subarray(i, i + 0x8000));
      return btoa(s);
    },
  };
  if (/[?&]autoplay/.test(location.search)) play();
})();

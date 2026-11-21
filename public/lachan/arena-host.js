// Đấu Trường — màn máy chiếu: tạo phòng, hiện QR, điều khiển câu hỏi, công bố kết quả.
(function () {
  'use strict';
  const R = window.LCRules;
  const S = window.Sound;
  const A = window.Avatar;
  const $ = (id) => document.getElementById(id);
  const esc = (s) => String(s == null ? '' : s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

  const TEAM_COLORS = ['#4f8cff', '#ff4b5c', '#ffcf4a', '#b07cff'];
  const OPTS = [{ c: '#e8475f', s: '▲' }, { c: '#2f7bff', s: '◆' }, { c: '#d99a00', s: '●' }, { c: '#1fa463', s: '■' }];
  const ROUND_NAMES = {};
  const RING = 2 * Math.PI * 52;

  let D = null;
  let ws = null;
  let st = null; // trạng thái mới nhất từ server
  let prev = { phase: null, qIndex: -2 };
  let deadline = 0;
  let lastSec = -1;
  let ending = null;
  let retry = 0;

  // ---------- Kết nối ----------
  function saved() {
    try { return JSON.parse(sessionStorage.getItem('lcnt.host') || 'null') || {}; } catch (e) { return {}; }
  }
  function connect() {
    const proto = location.protocol === 'https:' ? 'wss' : 'ws';
    ws = new WebSocket(`${proto}://${location.host}`);
    ws.onopen = () => {
      retry = 0;
      $('conn').classList.remove('on');
      const s = saved();
      ws.send(JSON.stringify({ type: 'lc:host', room: s.code, key: s.key }));
    };
    ws.onmessage = (ev) => {
      const msg = JSON.parse(ev.data);
      if (msg.type === 'lc:hosted') {
        try { sessionStorage.setItem('lcnt.host', JSON.stringify({ code: msg.code, key: msg.key })); } catch (e) { /* bỏ qua */ }
        showCode(msg.code);
      } else if (msg.type === 'lc:state') {
        render(msg.state);
      }
    };
    ws.onclose = () => {
      $('conn').classList.add('on');
      setTimeout(connect, Math.min(5000, 500 * 2 ** retry++));
    };
  }
  function cmd(c, extra) {
    if (ws && ws.readyState === 1) ws.send(JSON.stringify(Object.assign({ type: 'lc:cmd', cmd: c }, extra || {})));
  }

  function showCode(code) {
    const url = `${location.origin}/lachan/play.html?r=${code}`;
    $('topCode').textContent = code;
    $('bigCode').textContent = code;
    $('joinUrl').textContent = url.replace(/^https?:\/\//, '');
    const qr = window.qrcode(0, 'M');
    qr.addData(url);
    qr.make();
    $('qr').innerHTML = qr.createSvgTag({ cellSize: 8, margin: 2, scalable: true });
  }

  // ---------- Hiển thị ----------
  function screen(id) {
    ['lobby', 'play', 'final'].forEach((s) => $(s).classList.toggle('on', s === id));
  }

  function moodFor(hp) {
    const C = D.settings;
    if (hp > 80) return ['happy', '😊', 'Ổn định'];
    if (hp > C.midHp) return ['neutral', '🙂', 'Hơi chao đảo'];
    if (hp > C.lowHp) return ['worried', '😟', 'Bất an'];
    if (hp > 10) return ['sad', '😢', 'Suy sụp'];
    return ['cry', '💔', 'Kiệt quệ'];
  }

  function setHp(hp, delta) {
    const C = D.settings;
    $('hpPanel').dataset.level = R.hpLevel(hp, C.lowHp, C.midHp);
    $('hpFill').style.width = hp + '%';
    $('hpGhost').style.width = hp + '%';
    $('hpValue').textContent = hp + '%';
    const [mood, icon, label] = moodFor(hp);
    if ($('victimAvatar').dataset.mood !== mood) {
      $('victimAvatar').innerHTML = A.svg(D.characters.victim.avatar, mood);
      $('victimAvatar').dataset.mood = mood;
    }
    $('hpMoodIcon').textContent = icon;
    $('hpMood').textContent = label;
    const d = $('hpDelta');
    if (delta) {
      d.className = 'hp-delta-big ' + (delta < 0 ? 'minus' : 'plus');
      d.textContent = (delta > 0 ? '+' : '') + delta + ' Tinh thần';
    } else {
      d.className = 'hp-delta-big';
      d.textContent = '';
    }
  }

  function renderLobby(s) {
    $('teamCols').innerHTML = D.teams.map((t, i) => {
      const ps = s.players.filter((p) => p.team === i);
      return `<div class="panel team-col" style="--tc:${TEAM_COLORS[i]}"><h3>${esc(t)}<small>${ps.length} người</small></h3>
        <div class="chips">${ps.map((p) => `<span class="chip ${p.connected ? '' : 'off'}" data-id="${esc(p.id)}">${esc(p.name)}</span>`).join('')}</div></div>`;
    }).join('');
    $('startBtn').disabled = !s.players.length;
    $('startBtn').style.opacity = s.players.length ? 1 : 0.5;
  }

  function cardHtml(c) {
    const av = c.avatar || A.fromName(c.author);
    return `<div class="panel q-card"><div class="avatar">${A.svg(av, av.style === 'anon' ? null : 'smirk')}</div>
      <div><b>${esc(c.author)}</b>${c.handle ? `<small>${esc(c.handle)}</small>` : ''}<p>${esc(c.text)}</p></div></div>`;
  }

  function chatHtml(ch) {
    const vName = D.characters.victim.name;
    return `<div class="panel q-chat"><div class="ch-head">💬 ${esc(ch.where)} · ${esc(ch.members)}</div>${ch.messages.map((m) => {
      const isV = m.author === vName;
      const av = isV ? D.characters.victim.avatar : A.fromName(m.author);
      return `<div class="m ${isV ? 'victim' : ''}"><div class="avatar">${A.svg(av, isV ? 'sad' : 'smirk')}</div><p><b>${esc(m.author)}</b>${esc(m.text)}${m.image ? `<span class="img"><br>🖼️ ${esc(m.image)}</span>` : ''}</p></div>`;
    }).join('')}</div>`;
  }

  function buildQuestion(s) {
    const q = s.question;
    $('qBadge').textContent = `MÀN ${q.round} · ${ROUND_NAMES[q.round]}`;
    $('qCount').textContent = `Câu ${s.qIndex + 1}/${s.total}`;
    $('qPrompt').textContent = q.prompt;
    $('qBody').innerHTML = q.card ? cardHtml(q.card) : chatHtml(q.chat);
    $('opts').className = 'opts n' + q.options.length;
    $('opts').innerHTML = q.options.map((o, i) => `<div class="opt-tile" style="--oc:${OPTS[i].c}" data-i="${i}"><span class="bar"></span><span class="shape">${OPTS[i].s}</span><span class="lbl">${o.icon ? o.icon + ' ' : ''}${esc(o.label)}</span><em class="hp-tag"></em><span class="cnt">0</span></div>`).join('');
    $('explain').innerHTML = '';
  }

  function revealQuestion(s) {
    const q = s.question;
    const total = Math.max(1, s.counts.reduce((a, b) => a + b, 0));
    $('opts').querySelectorAll('.opt-tile').forEach((el, i) => {
      el.classList.toggle('right', i === q.answer);
      el.classList.toggle('wrong', i !== q.answer && !(q.kind === 'empathy' && q.options[i].hp > 0));
      el.querySelector('.cnt').textContent = s.counts[i];
      el.querySelector('.bar').style.width = (100 * s.counts[i]) / total + '%';
      const tag = el.querySelector('.hp-tag');
      if (q.kind === 'empathy') tag.textContent = (q.options[i].hp > 0 ? '+' : '') + q.options[i].hp;
    });
    const best = q.options[q.answer];
    $('explain').innerHTML = q.kind === 'empathy'
      ? `<b>💚 ${esc(best.verdict)}</b> ${esc(q.explain)}`
      : `<b>${q.round === 1 ? (q.options[q.answer].icon + ' ' + esc(q.options[q.answer].label) + (q.type ? ' · ' + esc(q.type) : '')) : (q.options[q.answer].icon + ' ' + esc(q.options[q.answer].label))}.</b> ${esc(q.explain)}`;
  }

  function renderStandings(s) {
    const max = Math.max(1, ...s.teams.map((t) => t.avg));
    $('standings').innerHTML = s.teams.map((t, r) => `<div class="st-row" style="--tc:${TEAM_COLORS[t.team]}"><span class="rk">${r + 1}</span><span class="nm">${esc(t.name)} <small>${t.count} người</small></span><span class="val">${t.avg.toLocaleString('vi-VN')}</span><span class="bar"><i style="width:${(100 * t.avg) / max}%"></i></span></div>`).join('');
    $('topPlayers').innerHTML = '<div class="panel-title">CÁ NHÂN XUẤT SẮC</div>' + s.players.slice(0, 5).map((p) => `<div class="tp" style="--tc:${TEAM_COLORS[p.team]}"><span><i></i>${esc(p.name)}</span><b>${p.score.toLocaleString('vi-VN')}${s.phase === 'reveal' && p.lastPoints ? `<em>+${p.lastPoints}</em>` : ''}</b></div>`).join('');
  }

  function podiumHtml(s) {
    const order = [1, 0, 2, 3].filter((i) => i < s.teams.length);
    return `<div class="podium">${order.map((r) => { const t = s.teams[r]; return `<div class="pod p${r + 1}" style="--tc:${TEAM_COLORS[t.team]}"><b>${esc(t.name)}</b><small>${t.avg.toLocaleString('vi-VN')} điểm TB · ${t.count} người</small><div class="blk">${r + 1}</div></div>`; }).join('')}</div>
      <div class="mvp">${s.players.slice(0, 3).map((p, i) => `<span>${['🥇', '🥈', '🥉'][i]} ${esc(p.name)} · ${p.score.toLocaleString('vi-VN')}</span>`).join('')}</div>`;
  }

  function renderEnd(s) {
    // Thắng: Minh Anh đi học lại, cười nói với cả lớp. Thua: cảnh kết thúc an toàn rồi tới màn hậu quả.
    // Cả hai đều kết bằng bảng xếp hạng đội.
    const win = s.outcome === 'win';
    screen('play');
    if (!win) S.doom();
    ending = window.LCEnding.play($('lceRoot'), D, {
      kind: win ? 'good' : 'bad',
      sound: S,
      stats: win ? `<div><b>${s.hp}%</b><small>Tinh thần cuối</small></div><div><b>${s.players.length}</b><small>người cùng bảo vệ</small></div>` : '',
      extra: `<div class="podium-wrap"><h3>BẢNG XẾP HẠNG ĐỘI${win ? '' : ' · Tinh thần cuối của Minh Anh: ' + s.hp + '%'}</h3>${podiumHtml(s)}</div>`,
      onDone(btns) {
        btns.innerHTML = `<button id="lceAgain">${win ? '↻ Chơi lại' : '↻ Chơi lại, lần này hãy lên tiếng'}</button>`;
        btns.querySelector('#lceAgain').onclick = () => cmd('reset');
        if (win) confetti();
      },
    });
  }

  function render(s) {
    st = s;
    $('topPeople').textContent = s.players.length;
    const changed = s.phase !== prev.phase || s.qIndex !== prev.qIndex;
    if (s.phase !== 'end' && ending) { ending.stop(); ending = null; }
    if (s.phase === 'lobby') {
      screen('lobby');
      renderLobby(s);
      stopConfetti();
    } else if (s.phase === 'question' || s.phase === 'reveal') {
      screen('play');
      if (s.qIndex !== prev.qIndex || prev.phase === 'lobby' || prev.phase === 'end' || prev.phase === null) {
        buildQuestion(s);
        S.whoosh();
      }
      $('qCol').classList.toggle('reveal', s.phase === 'reveal');
      $('answered').textContent = `${s.answered}/${s.expected}`;
      if (s.phase === 'question') {
        deadline = performance.now() + s.endsIn;
        $('nextBtn').innerHTML = 'Công bố đáp án <kbd>Space</kbd>';
        setHp(s.hp, 0);
      } else {
        deadline = 0;
        if (changed) {
          revealQuestion(s);
          setHp(s.hp, s.hpDelta);
          if (s.hpDelta >= 0) S.heal(); else S.wrong();
          if (s.hpDelta < 0) flash('red'); else flash('green');
        }
        const last = s.hp <= 0 || s.qIndex >= s.total - 1;
        $('nextBtn').innerHTML = `${last ? 'Xem kết cục' : 'Câu tiếp theo'} ▶ <kbd>Space</kbd>`;
      }
      renderStandings(s);
    } else if (s.phase === 'end' && changed) {
      deadline = 0;
      renderEnd(s);
    }
    prev = { phase: s.phase, qIndex: s.qIndex };
  }

  function flash(color) {
    const f = $('flash');
    f.className = 'flash ' + color;
    void f.offsetWidth;
    f.classList.add('go');
  }

  // Đồng hồ chạy mượt theo hạn chót server gửi
  function loop() {
    if (st && st.phase === 'question' && deadline) {
      const left = Math.max(0, (deadline - performance.now()) / 1000);
      const sec = Math.ceil(left);
      $('timerNum').textContent = sec;
      $('ringFg').style.strokeDasharray = RING;
      $('ringFg').style.strokeDashoffset = RING * (1 - left / st.seconds);
      $('timer').classList.toggle('urgent', left <= 5);
      if (sec !== lastSec) { lastSec = sec; if (sec <= 5 && sec > 0) S.tick(true); }
    } else if (st && st.phase !== 'question') {
      $('timerNum').textContent = '--';
      $('ringFg').style.strokeDashoffset = 0;
      $('timer').classList.remove('urgent');
    }
    requestAnimationFrame(loop);
  }

  // ---------- Pháo giấy ----------
  let confettiRun = 0;
  function stopConfetti() {
    confettiRun++;
    const cv = $('confetti');
    cv.getContext('2d').clearRect(0, 0, cv.width, cv.height);
    cv.classList.remove('on');
  }
  function confetti() {
    const run = ++confettiRun;
    const cv = $('confetti');
    const ctx = cv.getContext('2d');
    cv.width = innerWidth; cv.height = innerHeight;
    const ps = Array.from({ length: 220 }, () => ({ x: Math.random() * cv.width, y: -20 - Math.random() * cv.height * 0.6, vx: (Math.random() - 0.5) * 3, vy: 2 + Math.random() * 4, r: Math.random() * 3, vr: (Math.random() - 0.5) * 0.3, w: 6 + Math.random() * 8, c: TEAM_COLORS[Math.floor(Math.random() * 4)] }));
    let t = 0;
    cv.classList.add('on');
    (function frame() {
      t++;
      ctx.clearRect(0, 0, cv.width, cv.height);
      ps.forEach((p) => { p.x += p.vx; p.y += p.vy; p.r += p.vr; p.vy += 0.03; ctx.save(); ctx.translate(p.x, p.y); ctx.rotate(p.r); ctx.fillStyle = p.c; ctx.fillRect(-p.w / 2, -p.w / 4, p.w, p.w / 2); ctx.restore(); });
      if (run !== confettiRun) return;
      if (t < 300) requestAnimationFrame(frame); else stopConfetti();
    })();
  }

  // ---------- Sự kiện ----------
  function primary() {
    S.unlock();
    if (!st) return;
    if (st.phase === 'lobby') cmd('start');
    else if (st.phase === 'question' || st.phase === 'reveal') cmd('next');
    else if (st.phase === 'end' && ending) ending.skip();
  }

  function bind() {
    $('startBtn').addEventListener('click', primary);
    $('nextBtn').addEventListener('click', primary);
    $('muteBtn').addEventListener('click', () => { S.setMuted(!S.isMuted()); $('muteBtn').textContent = S.isMuted() ? '🔇' : '🔊'; });
    $('fsBtn').addEventListener('click', toggleFs);
    let armed = null;
    $('teamCols').addEventListener('click', (e) => {
      const chip = e.target.closest('.chip');
      if (!chip) return;
      if (armed === chip.dataset.id) { cmd('kick', { id: chip.dataset.id }); armed = null; return; }
      armed = chip.dataset.id;
      document.querySelectorAll('.chip.armed').forEach((c) => c.classList.remove('armed'));
      chip.classList.add('armed');
      setTimeout(() => { if (armed === chip.dataset.id) { armed = null; chip.classList.remove('armed'); } }, 3000);
    });
    document.addEventListener('keydown', (e) => {
      if (e.repeat) return;
      const k = e.key.toLowerCase();
      if (k === ' ' || k === 'enter') { e.preventDefault(); primary(); }
      else if (k === 'f') toggleFs();
      else if (k === 'm') $('muteBtn').click();
    });
  }

  function toggleFs() {
    if (!document.fullscreenElement) document.documentElement.requestFullscreen && document.documentElement.requestFullscreen().catch(() => {});
    else document.exitFullscreen();
  }

  async function loadData() {
    try {
      const res = await fetch('data.json', { cache: 'no-store' });
      if (!res.ok) throw new Error(res.status);
      return await res.json();
    } catch (e) {
      if (window.LCNT_DATA) return window.LCNT_DATA;
      throw e;
    }
  }

  window.__arenaHost = { state: () => st, cmd };

  loadData().then((data) => {
    D = data;
    [1, 2, 3].forEach((n) => { ROUND_NAMES[n] = D['round' + n].name; });
    const v = D.characters.victim;
    $('heroAvatar').innerHTML = A.svg(v.avatar, 'neutral');
    $('heroText').textContent = `${D.post.text.slice(0, 120)}… Mỗi đội thi xem ai nhanh và đúng nhất, nhưng Tinh thần của Minh Anh là của chung: cả lớp phải cùng giữ cho bạn ấy.`;
    $('victimName').textContent = v.name;
    $('victimHandle').textContent = v.handle;
    $('winHp').textContent = D.settings.winHp;
    setHp(D.settings.hpStart, 0);
    screen('lobby');
    renderLobby({ players: [] });
    bind();
    connect();
    requestAnimationFrame(loop);
  });
})();

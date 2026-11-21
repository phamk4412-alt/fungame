// LÁ CHẮN NGÔN TỪ — điều khiển 3 màn chơi, thanh Tinh thần, điểm đội và hiệu ứng.
(function () {
  'use strict';
  const R = window.LCRules;
  const S = window.Sound;
  const A = window.Avatar;
  const $ = (id) => document.getElementById(id);
  const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

  let D = null; // nội dung game (data.json)
  let CFG = null; // D.settings

  const G = {
    round: 0, // 0 = chưa chơi, 1..3
    phase: 'intro', // intro | splash | play | reveal | end
    hp: 100,
    team: 0,
    scores: [],
    roundScore: 0,
    paused: false,
    notif: 0,
    timeLeft: 0,
    timeMax: 1,
    lastTickSec: -1,
    alarmT: 0,
    r1: null,
    r2: null,
    r3: null,
  };

  // ---------- Tải dữ liệu ----------
  async function loadData() {
    try {
      const res = await fetch('data.json', { cache: 'no-store' });
      if (!res.ok) throw new Error(res.status);
      return await res.json();
    } catch (e) {
      // Mở trực tiếp bằng file:// thì fetch bị chặn: dùng bản sao data.js
      if (window.LCNT_DATA) return window.LCNT_DATA;
      throw e;
    }
  }

  // ---------- Lưu điểm đội ----------
  function loadScores() {
    try {
      const s = JSON.parse(localStorage.getItem('lcnt.scores') || 'null');
      if (Array.isArray(s) && s.length === D.teams.length) return s;
    } catch (e) { /* bỏ qua */ }
    return D.teams.map(() => 0);
  }
  function saveScores() {
    try { localStorage.setItem('lcnt.scores', JSON.stringify(G.scores)); } catch (e) { /* bỏ qua */ }
  }

  // ---------- Khởi tạo giao diện tĩnh ----------
  function setupStatic() {
    const v = D.characters.victim;
    const w = D.characters.witness;
    const p = D.characters.page;
    $('victimName').textContent = v.name;
    $('victimHandle').textContent = v.handle;
    $('victimBio').textContent = v.bio;
    $('victimFollowers').textContent = v.followers;
    $('witnessAvatar').innerHTML = A.svg(w.avatar, 'neutral');
    $('witnessName').textContent = w.name;
    $('witnessRole').textContent = w.role;
    $('pageAvatar').innerHTML = A.svg(p.avatar);
    $('pageName').textContent = p.name;
    $('postTime').textContent = D.post.time;
    $('postAudience').textContent = D.post.audience;
    $('postText').textContent = D.post.text;
    $('postImageCap').textContent = D.post.image;
    $('postReacts').textContent = D.post.reactions;
    $('postComments').textContent = D.post.comments;
    $('postShares').textContent = D.post.shares;
    $('introTitle').textContent = D.meta.title;
    $('introSub').textContent = D.meta.subtitle;
    $('introTag').textContent = D.meta.tagline;
    $('brandSub').textContent = D.meta.subtitle;
    $('introRounds').innerHTML = [D.round1, D.round2, D.round3].map((r, i) =>
      `<button class="intro-round" data-round="${i + 1}"><em>MÀN ${i + 1}</em><b>${esc(r.name)}</b><small>${esc(r.goal)}</small></button>`).join('');
    const opts = D.teams.map((t, i) => `<option value="${i}">${esc(t)}</option>`).join('');
    $('teamSelect').innerHTML = opts;
    $('introTeam').innerHTML = opts;
    G.scores = loadScores();
    renderTeams();
    setHp(CFG.hpStart, true);
    renderIdleActions();
  }

  // ---------- Thanh Tinh thần ----------
  function moodFor(hp) {
    if (hp > 80) return ['happy', '😊', 'Ổn định'];
    if (hp > CFG.midHp) return ['neutral', '🙂', 'Hơi chao đảo'];
    if (hp > CFG.lowHp) return ['worried', '😟', 'Bất an'];
    if (hp > 10) return ['sad', '😢', 'Suy sụp'];
    return ['cry', '💔', 'Kiệt quệ'];
  }

  let ghostTimer = 0;
  function setHp(v, silent) {
    const before = G.hp;
    G.hp = R.clampHp(v);
    const lvl = R.hpLevel(G.hp, CFG.lowHp, CFG.midHp);
    const panel = $('hpPanel');
    panel.dataset.level = lvl;
    document.body.dataset.hp = lvl;
    $('hpFill').style.width = G.hp + '%';
    $('hpValue').textContent = G.hp + '%';
    const [mood, icon, label] = moodFor(G.hp);
    if ($('victimAvatar').dataset.mood !== mood) {
      $('victimAvatar').innerHTML = A.svg(D.characters.victim.avatar, mood);
      $('victimAvatar').dataset.mood = mood;
    }
    $('hpMoodIcon').textContent = icon;
    $('hpMood').textContent = label;
    clearTimeout(ghostTimer);
    if (silent) {
      $('hpGhost').style.width = G.hp + '%';
      return;
    }
    const d = G.hp - before;
    if (d === 0) return;
    if (d < 0) {
      $('hpGhost').style.width = before + '%';
      ghostTimer = setTimeout(() => { $('hpGhost').style.width = G.hp + '%'; }, 450);
      panel.classList.remove('hurt'); void panel.offsetWidth; panel.classList.add('hurt');
    } else {
      $('hpGhost').style.width = G.hp + '%';
      panel.classList.remove('healed'); void panel.offsetWidth; panel.classList.add('healed');
    }
    const el = document.createElement('span');
    el.className = d < 0 ? 'minus' : 'plus';
    el.textContent = (d > 0 ? '+' : '') + d;
    $('hpDelta').appendChild(el);
    setTimeout(() => el.remove(), 1400);
  }

  function changeHp(d) {
    setHp(G.hp + d);
    if (d < 0) flash('red');
    if (G.hp <= 0 && G.phase !== 'end') {
      setTimeout(() => endGame('fail'), 650);
      G.phase = 'end';
    }
  }

  // ---------- Điểm ----------
  function addScore(n) {
    if (!n) return;
    G.roundScore += n;
    G.scores[G.team] += n;
    saveScores();
    renderTeams(true);
    $('roundScore').textContent = `· vòng này +${G.roundScore}`;
  }

  function renderTeams(bump) {
    const order = G.scores.map((s, i) => ({ s, i })).sort((a, b) => b.s - a.s);
    $('teams').innerHTML = order.map((o, rank) =>
      `<li class="${o.i === G.team ? 'me' : ''} ${bump && o.i === G.team ? 'bump' : ''}"><span class="rk">${rank + 1}</span><span class="nm">${esc(D.teams[o.i])}</span><b>${o.s.toLocaleString('vi-VN')}</b></li>`).join('');
  }

  function setTeam(i) {
    G.team = Math.max(0, Math.min(D.teams.length - 1, +i || 0));
    $('teamSelect').value = String(G.team);
    $('introTeam').value = String(G.team);
    renderTeams();
  }

  // ---------- Đồng hồ ----------
  const RING = 2 * Math.PI * 52;
  function setTimer(left, max, label) {
    G.timeLeft = left;
    G.timeMax = max;
    const sec = Math.max(0, Math.ceil(left));
    $('timerNum').textContent = max ? sec : '--';
    if (label) $('timerLabel').textContent = label;
    const frac = max ? Math.max(0, left / max) : 1;
    const fg = $('ringFg');
    fg.style.strokeDasharray = RING;
    fg.style.strokeDashoffset = RING * (1 - frac);
    const urgent = max && left <= 5;
    document.querySelector('.timer').classList.toggle('urgent', !!urgent);
    if (max && sec !== G.lastTickSec && G.phase === 'play') {
      G.lastTickSec = sec;
      if (sec <= 5 && sec > 0) S.tick(true);
    }
  }

  // ---------- Hiệu ứng ----------
  function flash(color) {
    const f = $('flash');
    f.className = 'flash ' + color;
    void f.offsetWidth;
    f.classList.add('go');
  }
  function shake(el) {
    el = el || document.querySelector('.layout');
    el.classList.remove('shake'); void el.offsetWidth; el.classList.add('shake');
  }
  function toast(html, kind) {
    const t = document.createElement('div');
    t.className = 'toast ' + (kind || '');
    t.innerHTML = html;
    $('toasts').appendChild(t);
    while ($('toasts').children.length > 3) $('toasts').firstChild.remove();
    setTimeout(() => t.classList.add('out'), 2600);
    setTimeout(() => t.remove(), 3100);
  }
  function bumpNotif(n) {
    G.notif += n;
    const b = $('notifCount');
    b.textContent = G.notif > 999 ? '999+' : G.notif;
    const bell = document.querySelector('.bell');
    bell.classList.remove('ringing'); void bell.offsetWidth; bell.classList.add('ringing');
  }

  function showOverlay(id) {
    ['introScreen', 'roundScreen', 'endScreen'].forEach((o) => $(o).classList.toggle('show', o === id));
  }

  function setStepUi() {
    document.querySelectorAll('#steps button').forEach((b) => {
      const r = +b.dataset.round;
      b.classList.toggle('active', r === G.round);
      b.classList.toggle('done', r < G.round);
    });
    document.body.dataset.round = G.round;
    const r = D['round' + G.round];
    $('roundBadge').textContent = r ? r.badge : 'Sẵn sàng';
    $('roundGoal').textContent = r ? r.goal : 'Nhận diện · Tự vệ · Đồng cảm';
    $('rolePanel').classList.toggle('show', G.round === 3);
  }

  // ---------- Điều hướng vòng chơi ----------
  function goRound(n, opts) {
    stopConfetti();
    clearStage();
    G.round = n;
    G.phase = 'splash';
    G.paused = false;
    $('pausedTag').classList.remove('show');
    G.roundScore = 0;
    $('roundScore').textContent = '';
    if (opts && opts.hp != null) setHp(opts.hp, true);
    setStepUi();
    setTimer(0, 0, 'giây');
    renderIdleActions();
    const r = D['round' + n];
    $('rsNum').textContent = 'MÀN ' + n;
    $('rsName').textContent = r.name;
    $('rsGoal').textContent = r.goal;
    $('rsIntro').textContent = r.intro;
    let extra = '';
    if (n === 1) {
      extra = `<div class="rs-choices"><span class="c-good">${D.round1.choices.constructive.icon} ${esc(D.round1.choices.constructive.label)}</span><span class="vs">hay</span><span class="c-bad">${D.round1.choices.bully.icon} ${esc(D.round1.choices.bully.label)}</span></div>`;
    } else if (n === 2) {
      extra = '<div class="rs-skills">' + D.round2.skills.map((s) => `<div><span>${s.icon}</span><b>${esc(s.label)}</b><small>${esc(s.hint)}</small></div>`).join('') + '</div>';
    } else {
      const w = D.characters.witness;
      extra = `<div class="rs-role"><div class="avatar md">${A.svg(w.avatar, 'neutral')}</div><div><b>${esc(w.name)}</b><small>${esc(w.role)}</small></div></div>`;
    }
    $('rsExtra').innerHTML = extra;
    showOverlay('roundScreen');
    S.whoosh();
  }

  function beginRound() {
    if (G.phase !== 'splash') return;
    showOverlay(null);
    S.start();
    G.phase = 'play';
    if (G.round === 1) startR1();
    else if (G.round === 2) startR2();
    else startR3();
  }

  function nextRound() {
    if (G.round < 3) goRound(G.round + 1);
    else endGame(R.outcome(G.hp, CFG.winHp));
  }

  function clearStage() {
    $('stage').innerHTML = '';
    $('stage').className = 'stage';
    $('combo').textContent = '';
    $('post').classList.remove('compact', 'dim');
    G.r1 = G.r2 = G.r3 = null;
    document.body.classList.remove('drama');
  }

  function renderIdleActions() {
    $('actionsTitle').textContent = 'BẢNG ĐIỀU KHIỂN';
    $('actions').innerHTML = '<div class="idle">Chờ MC bắt đầu vòng chơi…</div>';
  }

  // ======================================================
  //  MÀN 1 — SOI BÓNG TỐI
  // ======================================================
  function startR1() {
    G.r1 = { idx: 0, answered: false };
    $('post').classList.add('dim');
    showR1Item();
  }

  function commentCard(c, extraClass) {
    const av = c.avatar || A.fromName(c.author);
    return `<div class="comment ${extraClass || ''}">
      <div class="avatar sm">${A.svg(av, av.style === 'anon' ? null : 'smirk')}</div>
      <div class="bubble"><div class="c-head"><b>${esc(c.author)}</b>${c.handle ? `<small>${esc(c.handle)}</small>` : ''}${c.time ? `<small>· ${esc(c.time)}</small>` : ''}</div>
      <p>${esc(c.text)}</p><div class="c-actions"><span>Thích</span><span>Phản hồi</span><span>Chia sẻ</span></div></div></div>`;
  }

  function showR1Item() {
    const items = D.round1.items;
    const it = items[G.r1.idx];
    G.r1.answered = false;
    G.phase = 'play';
    G.lastTickSec = -1;
    const dots = items.map((_, i) => `<i class="${i < G.r1.idx ? 'done ' + (G.r1.results && G.r1.results[i] ? 'ok' : 'bad') : ''} ${i === G.r1.idx ? 'cur' : ''}"></i>`).join('');
    $('stage').className = 'stage r1';
    $('stage').innerHTML = `<div class="r1-wrap">
      <div class="r1-top"><span class="r1-count">Bình luận ${G.r1.idx + 1}/${items.length}</span><span class="dots">${dots}</span></div>
      <div class="r1-card enter" id="r1Card">${commentCard(it, 'big')}<div class="verdict" id="r1Verdict"></div></div>
      <div class="r1-question">Đây là <b class="g">góp ý xây dựng</b> hay <b class="b">bạo lực mạng</b>?</div>
    </div>`;
    const ch = D.round1.choices;
    $('actionsTitle').textContent = 'PHÂN LOẠI BÌNH LUẬN';
    $('actions').innerHTML = `
      <button class="act act-good" data-choice="constructive"><span class="ic">${ch.constructive.icon}</span><span class="lb">${esc(ch.constructive.label)}</span><kbd>${ch.constructive.key}</kbd></button>
      <button class="act act-bad" data-choice="bully"><span class="ic">${ch.bully.icon}</span><span class="lb">${esc(ch.bully.label)}</span><kbd>${ch.bully.key}</kbd></button>`;
    $('actions').querySelectorAll('[data-choice]').forEach((b) => b.addEventListener('click', () => answerR1(b.dataset.choice)));
    setTimer(CFG.round1.secondsPerItem, CFG.round1.secondsPerItem, 'giây');
    S.ting();
    bumpNotif(3);
  }

  function answerR1(choice) {
    if (!G.r1 || G.r1.answered || G.phase !== 'play') return;
    G.r1.answered = true;
    G.phase = 'reveal';
    const it = D.round1.items[G.r1.idx];
    const timeout = choice === null;
    const correct = !timeout && choice === it.answer;
    G.r1.results = G.r1.results || [];
    G.r1.results[G.r1.idx] = correct;
    const cfg = CFG.round1;
    if (correct) {
      addScore(R.classifyScore(cfg, true, G.timeLeft));
      if (cfg.correctHp) changeHp(cfg.correctHp);
      S.correct();
      flash('green');
    } else {
      changeHp(timeout ? cfg.timeoutHp : cfg.wrongHp);
      S.wrong();
      shake($('r1Card'));
    }
    const isBully = it.answer === 'bully';
    $('r1Card').classList.add(isBully ? 'is-bully' : 'is-good');
    $('r1Verdict').innerHTML = `<span class="stamp-big ${correct ? 'ok' : 'bad'}">${timeout ? '⏰ HẾT GIỜ' : correct ? '✓ CHÍNH XÁC' : '✗ CHƯA ĐÚNG'}</span>
      <div class="type ${isBully ? 'b' : 'g'}">${isBully ? '⚠️ BẠO LỰC MẠNG' : '💬 GÓP Ý XÂY DỰNG'} · ${esc(it.type)}</div>
      <p>${esc(it.explain)}</p>`;
    $('r1Verdict').classList.add('show');
    $('actions').querySelectorAll('[data-choice]').forEach((b) => {
      b.disabled = true;
      if (b.dataset.choice === it.answer) b.classList.add('right');
      else if (b.dataset.choice === choice) b.classList.add('wrongpick');
    });
    const last = G.r1.idx >= D.round1.items.length - 1;
    const nb = document.createElement('button');
    nb.className = 'act act-next';
    nb.innerHTML = `<span class="lb">${last ? 'Sang Màn 2' : 'Bình luận tiếp'} ▶</span><kbd>Space</kbd>`;
    nb.addEventListener('click', nextR1);
    $('actions').appendChild(nb);
  }

  function nextR1() {
    if (!G.r1 || G.phase !== 'reveal') return;
    if (G.r1.idx >= D.round1.items.length - 1) { roundDone(); return; }
    G.r1.idx++;
    showR1Item();
  }

  function tickR1(dt) {
    if (G.phase !== 'play' || !G.r1 || G.r1.answered) return;
    setTimer(G.timeLeft - dt, CFG.round1.secondsPerItem);
    if (G.timeLeft <= 0) answerR1(null);
  }

  // ======================================================
  //  MÀN 2 — CƠN BÃO BÌNH LUẬN
  // ======================================================
  function startR2() {
    const seed = (Date.now() & 0xffff) ^ 0x5eed;
    const rand = R.rng(seed);
    G.r2 = { t: 0, next: 0.4, queue: R.stormOrder(D.round2.comments, rand), rand, list: [], combo: 0, best: 0, handled: 0, missed: 0, selected: null, uid: 0 };
    $('post').classList.add('compact');
    $('stage').className = 'stage r2';
    $('stage').innerHTML = '<div class="lane" id="lane"><div class="lane-top">⚠ VÙNG NGUY HIỂM · bình luận chạm đỉnh sẽ làm Tinh thần giảm</div></div>';
    $('actionsTitle').textContent = 'KỸ NĂNG TỰ VỆ';
    $('actions').innerHTML = D.round2.skills.map((s) =>
      `<button class="act skill" data-skill="${s.id}"><span class="ic">${s.icon}</span><span class="lb">${esc(s.label)}<small>${esc(s.hint)}</small></span><kbd>${s.key}</kbd></button>`).join('');
    $('actions').querySelectorAll('[data-skill]').forEach((b) => b.addEventListener('click', () => useSkill(b.dataset.skill)));
    setTimer(CFG.round2.duration, CFG.round2.duration, 'giây');
    G.lastTickSec = -1;
    S.notifBurst(6);
  }

  function spawnComment() {
    const r2 = G.r2;
    if (!r2.queue.length) r2.queue = R.stormOrder(D.round2.comments, r2.rand);
    const c = r2.queue.shift();
    const lane = $('lane');
    const H = lane.clientHeight;
    const prog = r2.t / CFG.round2.duration;
    const el = document.createElement('div');
    const id = ++r2.uid;
    el.className = 'storm';
    el.innerHTML = commentCard(c);
    const offset = (id % 3) * 4; // so le trái/phải cho tự nhiên
    el.style.left = (2 + offset) + '%';
    el.style.right = (2 + (8 - offset)) + '%';
    lane.appendChild(el);
    const h = el.offsetHeight;
    const item = { id, c, el, y: H, h, speed: (H + h * 0.4) / R.riseDuration(CFG.round2, prog), dead: false };
    el.style.transform = `translateY(${item.y}px)`;
    el.addEventListener('click', () => { r2.selected = item.id; updateTarget(); });
    r2.list.push(item);
    S.ting();
    bumpNotif(1 + Math.floor(Math.random() * 4));
    updateTarget();
  }

  function currentTarget() {
    const r2 = G.r2;
    if (!r2) return null;
    const alive = r2.list.filter((i) => !i.dead);
    if (r2.selected) {
      const s = alive.find((i) => i.id === r2.selected);
      if (s) return s;
      r2.selected = null;
    }
    let best = null;
    alive.forEach((i) => { if (!best || i.y < best.y) best = i; });
    return best;
  }

  function updateTarget() {
    const t = currentTarget();
    G.r2.list.forEach((i) => i.el.classList.toggle('target', i === t));
  }

  function killComment(item, cls, delay) {
    item.dead = true;
    item.el.classList.remove('target');
    item.el.classList.add(cls);
    setTimeout(() => item.el.remove(), delay || 600);
    G.r2.list = G.r2.list.filter((i) => i !== item);
  }

  function useSkill(id) {
    if (G.round !== 2 || G.phase !== 'play' || G.paused || !G.r2) return;
    const btn = $('actions').querySelector(`[data-skill="${id}"]`);
    const t = currentTarget();
    if (!t) return;
    const skill = D.round2.skills.find((s) => s.id === id);
    const right = D.round2.skills.find((s) => s.id === t.c.skill);
    const r2 = G.r2;
    if (t.c.skill === id) {
      r2.combo++;
      r2.best = Math.max(r2.best, r2.combo);
      r2.handled++;
      addScore(R.stormScore(CFG.round2, r2.combo));
      if (CFG.round2.correctHp) changeHp(CFG.round2.correctHp);
      const tag = document.createElement('div');
      tag.className = 'res-tag ok';
      tag.textContent = `${skill.icon} ${skill.label}`;
      t.el.appendChild(tag);
      killComment(t, 'solved', 700);
      S.shatter();
      S.correct();
      pulse(btn, 'ok');
      toast(`<b>${skill.icon} ${esc(skill.label)}</b> ${esc(t.c.why)}`, 'ok');
    } else {
      r2.combo = 0;
      changeHp(CFG.round2.wrongHp);
      S.wrong();
      shake(t.el);
      pulse(btn, 'bad');
      toast(`<b>Chưa đúng!</b> Bình luận này cần <b>${right.icon} ${esc(right.label)}</b>: ${esc(right.hint.toLowerCase())}.`, 'bad');
    }
    renderCombo();
    updateTarget();
  }

  function pulse(btn, kind) {
    if (!btn) return;
    btn.classList.remove('ok', 'bad'); void btn.offsetWidth; btn.classList.add(kind);
  }

  function renderCombo() {
    const c = G.r2 ? G.r2.combo : 0;
    $('combo').innerHTML = c >= 2 ? `<span class="combo-x">COMBO ×${c}</span>` : '';
  }

  function tickR2(dt) {
    const r2 = G.r2;
    if (!r2 || G.phase !== 'play') return;
    r2.t += dt;
    const cfg = CFG.round2;
    setTimer(cfg.duration - r2.t, cfg.duration);
    r2.next -= dt;
    if (r2.next <= 0 && r2.t < cfg.duration - 1.5) {
      spawnComment();
      r2.next = R.spawnInterval(cfg, r2.t / cfg.duration);
    }
    for (const it of r2.list.slice()) {
      it.y -= it.speed * dt;
      it.el.style.transform = `translateY(${it.y}px)`;
      if (it.y <= 0) {
        r2.missed++;
        r2.combo = 0;
        renderCombo();
        killComment(it, 'hit', 500);
        S.hit();
        shake();
        changeHp(cfg.missHp);
        if (G.phase !== 'play') return;
        updateTarget();
      }
    }
    if (r2.t >= cfg.duration) {
      r2.list.slice().forEach((it) => killComment(it, 'fade', 500));
      roundDone();
    }
  }

  // ======================================================
  //  MÀN 3 — 5 GIÂY ĐẢO NGƯỢC
  // ======================================================
  function startR3() {
    G.r3 = { idx: 0, chosen: false, timers: [] };
    $('post').classList.add('compact');
    showSituation();
  }

  function showSituation() {
    const r3 = G.r3;
    const s = D.round3.situations[r3.idx];
    r3.chosen = false;
    r3.ready = false;
    G.phase = 'play';
    G.lastTickSec = -1;
    r3.timers.forEach(clearTimeout);
    r3.timers = [];
    const total = D.round3.situations.length;
    $('stage').className = 'stage r3';
    $('stage').innerHTML = `<div class="chat">
      <div class="chat-head"><div class="chat-ic">${s.where.indexOf('riêng') >= 0 ? A.svg(D.characters.victim.avatar, 'sad') : '<span>👥</span>'}</div><div><b>${esc(s.where)}</b><small>${esc(s.members)}</small></div><span class="sit-count">Tình huống ${r3.idx + 1}/${total}</span></div>
      <div class="chat-body" id="chatBody"></div>
      <div class="chat-q" id="chatQ"><div class="q">${esc(s.question)}</div><div class="opts" id="opts"></div></div>
      <div class="drama-num" id="dramaNum"></div>
    </div>`;
    const body = $('chatBody');
    s.messages.forEach((m, i) => {
      r3.timers.push(setTimeout(() => {
        const isVictim = m.author === D.characters.victim.name;
        const av = isVictim ? D.characters.victim.avatar : A.fromName(m.author);
        const div = document.createElement('div');
        div.className = 'msg' + (isVictim ? ' victim' : '');
        div.innerHTML = `<div class="avatar xs">${A.svg(av, isVictim ? 'sad' : 'smirk')}</div><div class="m-bub"><b>${esc(m.author)}</b><p>${esc(m.text)}</p>${m.image ? `<div class="m-img"><span>🖼️</span>${esc(m.image)}</div>` : ''}</div>`;
        body.appendChild(div);
        S.ting();
        bumpNotif(1);
      }, 350 + i * 750));
    });
    const optsAt = 350 + s.messages.length * 750 + 200;
    r3.timers.push(setTimeout(() => {
      $('opts').innerHTML = s.options.map((o, i) => `<button class="opt" data-i="${i}"><kbd>${i + 1}</kbd><span>${esc(o.text)}</span></button>`).join('');
      $('opts').querySelectorAll('.opt').forEach((b) => b.addEventListener('click', () => chooseR3(+b.dataset.i)));
      $('chatQ').classList.add('show');
      r3.ready = true;
      setTimer(CFG.round3.secondsPerSituation, CFG.round3.secondsPerSituation, 'giây');
    }, optsAt));
    $('actionsTitle').textContent = 'PHẢN HỒI CỦA BẠN';
    $('actions').innerHTML = s.options.map((o, i) => `<button class="act choice" data-i="${i}"><span class="ic">${i + 1}</span><span class="lb">Phương án ${i + 1}</span><kbd>${i + 1}</kbd></button>`).join('');
    $('actions').querySelectorAll('.choice').forEach((b) => b.addEventListener('click', () => chooseR3(+b.dataset.i)));
    setTimer(CFG.round3.secondsPerSituation, CFG.round3.secondsPerSituation, 'giây');
  }

  function chooseR3(i) {
    const r3 = G.r3;
    if (!r3 || r3.chosen || !r3.ready || G.phase !== 'play') return;
    r3.chosen = true;
    G.phase = 'reveal';
    document.body.classList.remove('drama');
    $('dramaNum').textContent = '';
    const s = D.round3.situations[r3.idx];
    const timeout = i === null;
    const o = timeout ? null : s.options[i];
    const best = s.options.reduce((b, x, k) => (x.hp > s.options[b].hp ? k : b), 0);
    const delta = timeout ? CFG.round3.timeoutHp : o.hp;
    changeHp(delta);
    addScore(R.empathyScore(CFG.round3, delta));
    if (delta > 0) {
      S.heal();
      flash('green');
      if (delta >= 25) burstHearts();
    } else {
      S.wrong();
    }
    document.querySelectorAll('#opts .opt').forEach((b, k) => {
      b.disabled = true;
      const op = s.options[k];
      b.classList.add(op.hp > 0 ? (k === best ? 'best' : 'okish') : 'harm');
      if (k === i) b.classList.add('picked');
      b.insertAdjacentHTML('beforeend', `<em class="hp-tag">${op.hp > 0 ? '+' : ''}${op.hp}</em>`);
    });
    document.querySelectorAll('#actions .choice').forEach((b, k) => { b.disabled = true; if (k === i) b.classList.add('picked'); if (k === best) b.classList.add('right'); });
    const shown = o || s.options[best];
    const fb = document.createElement('div');
    fb.className = 'r3-feedback ' + (delta > 0 ? 'good' : 'bad');
    fb.innerHTML = timeout
      ? `<b>⏰ Hết giờ — im lặng cũng là một lựa chọn.</b><p>Cách tốt nhất: <b>${esc(shown.verdict)}</b>. ${esc(shown.explain)}</p>`
      : `<b>${delta > 0 ? '💚' : '💔'} ${esc(o.verdict)} (${delta > 0 ? '+' : ''}${delta} Tinh thần)</b><p>${esc(o.explain)}</p>`;
    $('chatQ').appendChild(fb);
    const last = r3.idx >= D.round3.situations.length - 1;
    const nb = document.createElement('button');
    nb.className = 'act act-next';
    nb.innerHTML = `<span class="lb">${last ? 'Xem kết quả' : 'Tình huống tiếp'} ▶</span><kbd>Space</kbd>`;
    nb.addEventListener('click', nextR3);
    $('actions').appendChild(nb);
    if (G.round === 3) {
      const reply = document.createElement('div');
      reply.className = 'msg me';
      reply.innerHTML = `<div class="m-bub"><b>${esc(D.characters.witness.name)} (bạn)</b><p>${esc(timeout ? '…' : o.text)}</p></div><div class="avatar xs">${A.svg(D.characters.witness.avatar, delta > 0 ? 'happy' : 'neutral')}</div>`;
      $('chatBody').appendChild(reply);
    }
  }

  function nextR3() {
    if (!G.r3 || G.phase !== 'reveal') return;
    if (G.r3.idx >= D.round3.situations.length - 1) { G.phase = 'end'; endGame(R.outcome(G.hp, CFG.winHp)); return; }
    G.r3.idx++;
    showSituation();
  }

  function tickR3(dt) {
    const r3 = G.r3;
    if (!r3 || !r3.ready || r3.chosen || G.phase !== 'play') return;
    setTimer(G.timeLeft - dt, CFG.round3.secondsPerSituation);
    const drama = G.timeLeft <= CFG.round3.dramaSeconds;
    document.body.classList.toggle('drama', drama);
    if (drama) {
      const n = Math.max(0, Math.ceil(G.timeLeft));
      const dn = $('dramaNum');
      if (dn.textContent !== String(n)) {
        dn.textContent = n > 0 ? n : '';
        dn.classList.remove('pop'); void dn.offsetWidth; dn.classList.add('pop');
        if (n > 0) S.heartbeat();
      }
    }
    if (G.timeLeft <= 0) chooseR3(null);
  }

  function burstHearts() {
    const wrap = document.querySelector('.col-left');
    for (let i = 0; i < 14; i++) {
      const h = document.createElement('span');
      h.className = 'heart';
      h.textContent = ['💚', '💖', '✨', '🤝'][i % 4];
      h.style.left = 10 + Math.random() * 80 + '%';
      h.style.animationDelay = Math.random() * 0.5 + 's';
      wrap.appendChild(h);
      setTimeout(() => h.remove(), 2200);
    }
  }

  // ---------- Kết thúc vòng / game ----------
  function roundDone() {
    G.phase = 'reveal';
    const r = G.round;
    let stats = `<div><b>+${G.roundScore}</b><small>điểm vòng này</small></div><div><b>${G.hp}%</b><small>Tinh thần</small></div>`;
    if (r === 1 && G.r1) {
      const ok = (G.r1.results || []).filter(Boolean).length;
      stats += `<div><b>${ok}/${D.round1.items.length}</b><small>phân loại đúng</small></div>`;
    }
    if (r === 2 && G.r2) {
      stats += `<div><b>${G.r2.handled}</b><small>bình luận xử lý</small></div><div><b>×${G.r2.best}</b><small>combo cao nhất</small></div><div><b>${G.r2.missed}</b><small>lọt lưới</small></div>`;
    }
    toast(`<b>Hoàn thành ${esc(D['round' + r].name)}!</b> +${G.roundScore} điểm`, 'ok');
    setTimeout(() => {
      if (G.phase === 'end') return;
      goRound(r + 1);
      $('rsExtra').insertAdjacentHTML('afterbegin', `<div class="prev-stats"><span>Kết quả ${esc(D['round' + r].name)}</span>${stats}</div>`);
    }, r === 2 ? 900 : 300);
  }

  function endGame(kind) {
    G.phase = 'end';
    document.body.classList.remove('drama');
    if (G.r3) G.r3.timers.forEach(clearTimeout);
    const e = D.endings[kind];
    const card = $('endCard');
    card.className = 'end-card ' + kind;
    $('endIcon').textContent = kind === 'fail' ? '⚠️' : kind === 'win' ? '🏆' : '🌧️';
    $('endTitle').textContent = e.title;
    $('endLead').textContent = e.lead;
    $('endPoints').innerHTML = e.points.map((p) => `<li>${esc(p)}</li>`).join('');
    $('endHelp').textContent = e.help || '';
    $('endHelp').style.display = e.help ? '' : 'none';
    $('endStats').innerHTML = kind === 'fail' && G.round < 3 ? '' :
      `<div><b>${G.hp}%</b><small>Tinh thần cuối</small></div><div><b>${G.scores[G.team].toLocaleString('vi-VN')}</b><small>điểm ${esc(D.teams[G.team])}</small></div>`;
    $('endMsg').textContent = kind === 'fail' && G.round < 3 ? '' : D.meta.finalMessage;
    const revive = kind === 'fail' && G.round < 3;
    $('endCta').textContent = revive ? '▶ ' + e.cta : '↻ Chơi lại từ đầu';
    $('endCta').onclick = () => {
      if (revive) goRound(3, { hp: CFG.failReviveHp });
      else { setHp(CFG.hpStart, true); G.notif = 0; $('notifCount').textContent = '0'; goRound(1); }
    };
    showOverlay('endScreen');
    stopConfetti();
    if (kind === 'win') { S.applause(4); confetti(); }
    else { S.doom(); }
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
    const cols = ['#4f8cff', '#ff4d8d', '#ffd166', '#3ee39b', '#b07cff'];
    const ps = Array.from({ length: 220 }, () => ({ x: Math.random() * cv.width, y: -20 - Math.random() * cv.height * 0.6, vx: (Math.random() - 0.5) * 3, vy: 2 + Math.random() * 4, r: Math.random() * Math.PI, vr: (Math.random() - 0.5) * 0.3, w: 6 + Math.random() * 8, c: cols[Math.floor(Math.random() * cols.length)] }));
    let t = 0;
    cv.classList.add('on');
    (function frame() {
      t++;
      ctx.clearRect(0, 0, cv.width, cv.height);
      ps.forEach((p) => {
        p.x += p.vx; p.y += p.vy; p.r += p.vr; p.vy += 0.03;
        ctx.save(); ctx.translate(p.x, p.y); ctx.rotate(p.r);
        ctx.fillStyle = p.c; ctx.fillRect(-p.w / 2, -p.w / 4, p.w, p.w / 2);
        ctx.restore();
      });
      if (run !== confettiRun) return;
      if (t < 300) requestAnimationFrame(frame);
      else stopConfetti();
    })();
  }

  // ---------- Vòng lặp chính ----------
  let last = performance.now();
  function loop(now) {
    const dt = Math.min(0.1, (now - last) / 1000);
    last = now;
    if (!G.paused && D) {
      if (G.round === 1) tickR1(dt);
      else if (G.round === 2) tickR2(dt);
      else if (G.round === 3) tickR3(dt);
      if ((G.phase === 'play' || G.phase === 'reveal') && G.hp > 0 && G.hp <= CFG.lowHp) {
        G.alarmT -= dt;
        if (G.alarmT <= 0) { S.alarm(); G.alarmT = 2.2; }
      }
    }
    requestAnimationFrame(loop);
  }

  function togglePause() {
    if (G.phase !== 'play' && G.phase !== 'reveal') return;
    G.paused = !G.paused;
    $('pausedTag').classList.toggle('show', G.paused);
    document.body.classList.toggle('paused', G.paused);
    $('pauseBtn').textContent = G.paused ? '▶' : '⏸';
  }

  function toggleMute() {
    S.setMuted(!S.isMuted());
    $('muteBtn').textContent = S.isMuted() ? '🔇' : '🔊';
  }

  function toggleFs() {
    if (!document.fullscreenElement) document.documentElement.requestFullscreen && document.documentElement.requestFullscreen().catch(() => {});
    else document.exitFullscreen();
  }

  function goHome() {
    stopConfetti();
    clearStage();
    G.round = 0;
    G.phase = 'intro';
    G.paused = false;
    $('pausedTag').classList.remove('show');
    document.body.classList.remove('paused');
    setHp(CFG.hpStart, true);
    G.notif = 0;
    $('notifCount').textContent = '0';
    setStepUi();
    setTimer(0, 0, 'giây');
    renderIdleActions();
    showOverlay('introScreen');
  }

  function startFrom(n) {
    S.unlock();
    setTeam($('introTeam').value);
    if (n === 1 || n === 2) setHp(CFG.hpStart, true);
    if (n === 3) setHp(CFG.round3.jumpHp, true);
    goRound(n);
  }

  // ---------- Sự kiện ----------
  function bind() {
    $('startBtn').addEventListener('click', () => startFrom(1));
    $('introRounds').addEventListener('click', (e) => {
      const b = e.target.closest('[data-round]');
      if (b) startFrom(+b.dataset.round);
    });
    $('rsStart').addEventListener('click', beginRound);
    $('steps').addEventListener('click', (e) => {
      const b = e.target.closest('[data-round]');
      if (!b) return;
      S.unlock();
      const n = +b.dataset.round;
      goRound(n, { hp: n === 3 ? (G.round === 3 || G.hp <= CFG.lowHp ? G.hp : CFG.round3.jumpHp) : (n === 1 ? CFG.hpStart : G.hp || CFG.hpStart) });
    });
    $('teamSelect').addEventListener('change', (e) => setTeam(e.target.value));
    $('introTeam').addEventListener('change', (e) => setTeam(e.target.value));
    $('pauseBtn').addEventListener('click', togglePause);
    $('muteBtn').addEventListener('click', toggleMute);
    $('fsBtn').addEventListener('click', toggleFs);
    $('homeBtn').addEventListener('click', goHome);
    $('endHome').addEventListener('click', goHome);
    let armed = 0;
    $('resetScores').addEventListener('click', (e) => {
      const b = e.currentTarget;
      if (Date.now() - armed < 3000) {
        G.scores = D.teams.map(() => 0); saveScores(); renderTeams();
        b.textContent = 'Đã xóa ✓'; armed = 0;
        setTimeout(() => { b.textContent = 'Xóa bảng điểm'; }, 1500);
      } else {
        armed = Date.now(); b.textContent = 'Bấm lần nữa để xóa';
        setTimeout(() => { if (armed) b.textContent = 'Xóa bảng điểm'; }, 3000);
      }
    });

    document.addEventListener('keydown', (e) => {
      if (e.target.tagName === 'SELECT' || e.repeat) return;
      const k = e.key.toLowerCase();
      if (k === 'f') { toggleFs(); return; }
      if (k === 'm') { toggleMute(); return; }
      if (k === 'p') { togglePause(); return; }
      if (k === 'h') { goHome(); return; }
      if (k === ' ' || k === 'enter') {
        e.preventDefault();
        if (G.phase === 'intro') startFrom(1);
        else if (G.phase === 'splash') beginRound();
        else if (G.phase === 'reveal' && !G.paused) {
          if (G.round === 1) nextR1();
          else if (G.round === 3) nextR3();
        } else if (G.phase === 'end') $('endCta').click();
        return;
      }
      if (G.paused) return;
      if (G.round === 1) {
        if (k === 'a') answerR1('constructive');
        if (k === 'b') answerR1('bully');
      } else if (G.round === 2) {
        const s = D.round2.skills.find((x) => x.key === k);
        if (s) useSkill(s.id);
      } else if (G.round === 3 && /^[1-9]$/.test(k)) {
        const i = +k - 1;
        const s = D.round3.situations[G.r3 ? G.r3.idx : 0];
        if (G.r3 && s && i < s.options.length) chooseR3(i);
      }
    });
    window.addEventListener('resize', () => { if (G.r2) G.r2.list.forEach((i) => { i.h = i.el.offsetHeight; }); });
  }

  // Móc kiểm thử (Playwright): đọc trạng thái, điều khiển thời gian
  window.__lcnt = {
    state: () => ({ round: G.round, phase: G.phase, hp: G.hp, team: G.team, scores: G.scores.slice(), roundScore: G.roundScore, storm: G.r2 ? G.r2.list.length : 0 }),
    target: () => { const t = currentTarget(); return t ? t.c.skill : null; },
    step: (sec) => { const n = Math.ceil(sec / 0.05); for (let i = 0; i < n; i++) { if (G.round === 1) tickR1(0.05); else if (G.round === 2) tickR2(0.05); else if (G.round === 3) tickR3(0.05); } },
    setHp: (v) => setHp(v),
  };

  loadData().then((data) => {
    D = data;
    CFG = data.settings;
    setupStatic();
    bind();
    setStepUi();
    requestAnimationFrame(loop);
  }).catch((e) => {
    document.body.innerHTML = '<p style="color:#fff;padding:40px;font:20px sans-serif">Không tải được data.json: ' + esc(e.message || e) + '</p>';
  });
})();

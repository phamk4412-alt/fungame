// Đấu Trường — điện thoại người chơi: vào phòng bằng mã/QR, chọn đội, bấm đáp án.
(function () {
  'use strict';
  const $ = (id) => document.getElementById(id);
  const esc = (s) => String(s == null ? '' : s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const TEAM_COLORS = ['#4f8cff', '#ff4b5c', '#ffcf4a', '#b07cff'];
  const OPTS = [{ c: '#e8475f', s: '▲' }, { c: '#2f7bff', s: '◆' }, { c: '#d99a00', s: '●' }, { c: '#1fa463', s: '■' }];

  const store = {
    get(k) { try { return localStorage.getItem(k); } catch (e) { return null; } },
    set(k, v) { try { localStorage.setItem(k, v); } catch (e) { /* bỏ qua */ } },
    del(k) { try { localStorage.removeItem(k); } catch (e) { /* bỏ qua */ } },
  };

  let D = null;
  let ws = null;
  let st = null;
  let pickedTeam = null;
  let joined = null; // mã phòng đã vào
  let deadline = 0;
  let retry = 0;
  let shownKey = '';

  let pid = store.get('lcnt.pid');
  if (!pid) { pid = 'p' + Math.random().toString(36).slice(2) + Date.now().toString(36); store.set('lcnt.pid', pid); }

  function view(id) {
    document.querySelectorAll('.view').forEach((v) => v.classList.toggle('on', v.id === id));
  }

  function send(m) {
    if (ws && ws.readyState === 1) ws.send(JSON.stringify(m));
  }

  function connect() {
    const proto = location.protocol === 'https:' ? 'wss' : 'ws';
    ws = new WebSocket(`${proto}://${location.host}`);
    ws.onopen = () => {
      retry = 0;
      $('conn').classList.remove('on');
      const again = store.get('lcnt.room');
      if (again) send({ type: 'lc:join', room: again, name: store.get('lcnt.name') || '', playerId: pid });
    };
    ws.onmessage = (ev) => {
      const m = JSON.parse(ev.data);
      if (m.type === 'lc:joined') {
        joined = m.code;
        store.set('lcnt.room', m.code);
      } else if (m.type === 'lc:error') {
        if (m.fatal) { joined = null; store.del('lcnt.room'); view('vJoin'); }
        $('joinErr').textContent = m.message;
      } else if (m.type === 'lc:state') {
        render(m.state);
      }
    };
    ws.onclose = () => {
      $('conn').classList.add('on');
      setTimeout(connect, Math.min(5000, 400 * 2 ** retry++));
    };
  }

  function teamButtons(el, selected, withAuto) {
    el.innerHTML = (withAuto ? `<button type="button" class="auto ${selected == null ? 'sel' : ''}" data-t="">🎲 Tự xếp đội</button>` : '') +
      D.teams.map((t, i) => `<button type="button" style="--tc:${TEAM_COLORS[i]}" class="${selected === i ? 'sel' : ''}" data-t="${i}">${esc(t)}</button>`).join('');
  }

  function render(s) {
    st = s;
    const me = s.me;
    if (!me) return;
    $('me').innerHTML = `<b>${esc(me.name)}</b> · <span style="color:${TEAM_COLORS[me.team]}">${esc(D.teams[me.team])}</span><br>${me.score.toLocaleString('vi-VN')} điểm`;
    const key = `${s.phase}:${s.qIndex}:${me.answer}:${me.team}`;
    if (key === shownKey && s.phase !== 'question') return;
    shownKey = key;
    if (s.phase === 'lobby') {
      view('vWait');
      $('waitTitle').textContent = 'Đã vào phòng!';
      $('waitText').innerHTML = `Bạn ở <b style="color:${TEAM_COLORS[me.team]}">${esc(D.teams[me.team])}</b>. Nhìn lên màn hình lớn và chờ MC bắt đầu. Có thể đổi đội:`;
      teamButtons($('teamSwitch'), me.team, false);
    } else if (s.phase === 'question') {
      deadline = performance.now() + s.endsIn;
      if (me.answer == null) {
        if (!$('vQ').classList.contains('on') || $('answers').dataset.q !== String(s.qIndex)) showQuestion(s);
      } else {
        view('vRes');
        $('resIc').textContent = OPTS[me.answer].s;
        $('resIc').style.color = OPTS[me.answer].c;
        $('resTitle').textContent = 'Đã chọn!';
        $('resText').textContent = 'Chờ mọi người trả lời và nhìn lên màn hình lớn nhé.';
        stats(s);
      }
    } else if (s.phase === 'reveal') {
      view('vRes');
      $('resIc').style.color = '';
      const q = s.question;
      if (me.answer == null) {
        $('resIc').textContent = '⏰';
        $('resTitle').textContent = 'Hết giờ!';
        $('resText').textContent = 'Im lặng cũng là một lựa chọn. Câu sau nhanh tay hơn nhé.';
      } else if (q.kind === 'empathy') {
        const o = q.options[me.answer];
        $('resIc').textContent = o.hp > 0 ? (me.correct ? '💚' : '🙂') : '💔';
        $('resTitle').textContent = o.verdict;
        $('resText').innerHTML = `${me.lastPoints ? `<span class="plus">+${me.lastPoints} điểm</span><br>` : ''}${esc(o.explain)}`;
      } else {
        $('resIc').textContent = me.correct ? '✅' : '❌';
        $('resTitle').textContent = me.correct ? 'Chính xác!' : 'Chưa đúng';
        $('resText').innerHTML = `${me.correct ? `<span class="plus">+${me.lastPoints} điểm</span><br>` : `Đáp án: <b>${esc(q.options[q.answer].label)}</b><br>`}${esc(q.explain)}`;
      }
      stats(s);
    } else if (s.phase === 'end') {
      view('vEnd');
      const teamRank = s.teams.findIndex((t) => t.team === me.team) + 1;
      $('endScore').textContent = me.score.toLocaleString('vi-VN');
      $('endRank').textContent = `${me.rank}/${me.of}`;
      $('endTeam').textContent = `#${teamRank}`;
      const cq = D.endings.consequences;
      if (s.outcome === 'win') {
        $('endIc').textContent = teamRank === 1 ? '🏆' : '🛡️';
        $('endTitle').textContent = D.endings.win.title;
        $('endText').textContent = `${D.endings.goodScene.closing} ${s.teams[0].name} dẫn đầu.`;
        $('endHelp').innerHTML = '';
      } else {
        $('endIc').textContent = '🌧️';
        $('endTitle').textContent = 'Cả lớp chưa giữ được Minh Anh';
        $('endText').textContent = 'Nhìn lên màn hình lớn. ' + D.meta.finalMessage;
        $('endHelp').innerHTML = `<div class="hot"><a href="tel:${esc(cq.hotline)}">${esc(cq.hotline)}</a><span>${esc(cq.hotlineLabel)}</span></div>${esc(cq.help)}<br>${esc(cq.police)}`;
      }
    }
  }

  function stats(s) {
    $('resScore').textContent = s.me.score.toLocaleString('vi-VN');
    $('resRank').textContent = `${s.me.rank}/${s.me.of}`;
    $('resHp').textContent = s.hp + '%';
  }

  function showQuestion(s) {
    view('vQ');
    const q = s.question;
    $('qBadge').textContent = `Màn ${q.round} · Câu ${s.qIndex + 1}/${s.total}`;
    $('qPrompt').textContent = q.prompt;
    const quote = q.card ? q.card.author + ': "' + q.card.text + '"' : '';
    $('qQuote').textContent = quote;
    $('qQuote').style.display = quote ? '' : 'none';
    $('answers').className = 'answers n' + q.options.length;
    $('answers').dataset.q = s.qIndex;
    $('answers').innerHTML = q.options.map((o, i) => `<button class="ans" style="--oc:${OPTS[i].c}" data-i="${i}"><span class="shape">${OPTS[i].s}</span><span>${o.icon ? o.icon + ' ' : ''}${esc(o.label)}</span></button>`).join('');
  }

  function loop() {
    if (st && st.phase === 'question' && deadline) {
      const sec = Math.max(0, Math.ceil((deadline - performance.now()) / 1000));
      $('qTime').textContent = sec;
      $('qTime').classList.toggle('urgent', sec <= 5);
    }
    requestAnimationFrame(loop);
  }

  function bind() {
    const params = new URLSearchParams(location.search);
    $('code').value = (params.get('r') || store.get('lcnt.room') || '').toUpperCase();
    $('name').value = store.get('lcnt.name') || '';
    teamButtons($('teamPick'), pickedTeam, true);
    $('teamPick').addEventListener('click', (e) => {
      const b = e.target.closest('[data-t]');
      if (!b) return;
      pickedTeam = b.dataset.t === '' ? null : +b.dataset.t;
      teamButtons($('teamPick'), pickedTeam, true);
    });
    $('teamSwitch').addEventListener('click', (e) => {
      const b = e.target.closest('[data-t]');
      if (b) send({ type: 'lc:team', team: +b.dataset.t });
    });
    $('joinForm').addEventListener('submit', (e) => {
      e.preventDefault();
      const name = $('name').value.trim();
      const code = $('code').value.trim().toUpperCase();
      if (!name || !code) return;
      $('joinErr').textContent = '';
      store.set('lcnt.name', name);
      // Đổi phòng hoặc vào lần đầu: tạo người chơi mới trong phòng đó
      send({ type: 'lc:join', room: code, name, playerId: pid, team: pickedTeam });
    });
    $('answers').addEventListener('click', (e) => {
      const b = e.target.closest('.ans');
      if (!b || !st) return;
      if (navigator.vibrate) navigator.vibrate(30);
      send({ type: 'lc:answer', q: st.qIndex, choice: +b.dataset.i });
      b.style.opacity = 0.6;
    });
  }

  fetch('data.json', { cache: 'no-store' }).then((r) => r.json()).then((data) => {
    D = data;
    bind();
    connect();
    requestAnimationFrame(loop);
  }).catch(() => {
    document.body.innerHTML = '<p style="padding:2rem">Không tải được trò chơi. Hãy tải lại trang.</p>';
  });
})();

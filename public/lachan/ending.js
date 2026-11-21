// Cảnh kết thúc của Lá Chắn Ngôn Từ, dùng cho chế độ một đội và Đấu Trường.
//  - Kết thúc buồn (thua): tin nhắn không ai trả lời → lớp học với chỗ ngồi bỏ trống → hậu quả của bạo lực mạng.
//    Cố ý KHÔNG mô tả chuyện gì đã xảy ra với Minh Anh: chỉ có sự vắng mặt và lời kêu gọi tìm sự giúp đỡ.
//  - Kết thúc có hậu (thắng): cả lớp nhắn động viên → sáng hôm sau Minh Anh đi học, cười nói vui vẻ với mọi người.
(function () {
  'use strict';
  const A = window.Avatar;
  const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

  const W = 960;
  const H = 600;
  const SEAT_ROW = 2; // chỗ của Minh Anh: hàng gần nhất, sát cửa sổ
  const SEAT_COL = 0;
  // Ai ngồi ở đâu (hàng, cột) để đặt bong bóng lời thoại
  const NAMED = { 'Hoàng Nam': [2, 1], 'Trà My': [0, 1], 'Quốc Bảo': [1, 2] };
  const FILLERS = ['Đức Huy', 'Kim Ngân', 'Tuấn Kiệt', 'Thu Hà', 'Lan Phương', 'Hải Đăng', 'Gia Khánh', 'Minh Tú', 'Văn Toàn', 'Khoa Nguyễn', 'Bé Na', 'Trang'];

  function seatPos(row, col) {
    const scale = 0.78 + row * 0.11;
    return { scale, x: 120 + col * 205 + (row - 1) * (col - 1.5) * 16, y: 300 + row * 92 };
  }

  /** Lớp học nhìn từ cuối lớp: 3 hàng × 4 bàn. good = Minh Anh có mặt, cả lớp vui; ngược lại chỗ của bạn ấy bỏ trống. */
  function classroomSvg(D, good, board) {
    const byPos = {};
    Object.keys(NAMED).forEach((n) => { byPos[NAMED[n].join(',')] = n; });
    let k = 0;
    let seats = '';
    for (let row = 0; row < 3; row++) {
      for (let col = 0; col < 4; col++) {
        const { scale, x, y } = seatPos(row, col);
        const isHer = row === SEAT_ROW && col === SEAT_COL;
        const empty = isHer && !good;
        let person = '';
        if (!empty) {
          const name = isHer ? D.characters.victim.name : byPos[row + ',' + col] || FILLERS[k++ % FILLERS.length];
          const av = isHer ? D.characters.victim.avatar : name === D.characters.witness.name ? D.characters.witness.avatar : A.fromName(name);
          const mood = good ? 'happy' : 'neutral';
          person = `<g transform="translate(${x - 34 * scale} ${y - 92 * scale}) scale(${scale * 0.68})" class="mate ${isHer ? 'her' : ''}">${A.svg(av, mood).replace('<svg', '<svg width="100" height="100"')}</g>`;
        }
        seats += `<g class="seat ${empty ? 'empty' : ''} ${isHer ? 'hers' : ''}">
          ${empty ? `<rect x="${x - 40 * scale}" y="${y - 58 * scale}" width="${80 * scale}" height="${46 * scale}" rx="6" class="chair-back"/>` : ''}
          ${person}
          <rect x="${x - 62 * scale}" y="${y - 12 * scale}" width="${124 * scale}" height="${18 * scale}" rx="4" class="desk-top"/>
          <rect x="${x - 56 * scale}" y="${y + 6 * scale}" width="${112 * scale}" height="${44 * scale}" class="desk-front"/>
        </g>`;
      }
    }
    return `<svg viewBox="0 0 ${W} ${H}" class="classroom ${good ? 'good' : ''}" aria-label="${good ? 'Lớp học, Minh Anh đã đi học lại' : 'Lớp học, một chỗ ngồi bỏ trống'}">
      <defs>
        <linearGradient id="lcWall${good ? 'G' : ''}" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="${good ? '#f3e3c3' : '#2a3147'}"/><stop offset="1" stop-color="${good ? '#e2c99c' : '#1a1f30'}"/></linearGradient>
        <linearGradient id="lcBeam" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#ffe9b0" stop-opacity=".55"/><stop offset="1" stop-color="#ffe9b0" stop-opacity="0"/></linearGradient>
      </defs>
      <rect width="${W}" height="${H}" fill="url(#lcWall${good ? 'G' : ''})"/>
      <rect y="420" width="${W}" height="180" fill="${good ? '#b98f5f' : '#151927'}"/>
      <rect x="250" y="40" width="460" height="150" rx="6" fill="#1f3a2e" stroke="#6b5132" stroke-width="10"/>
      <text x="480" y="105" text-anchor="middle" class="board">Thứ Hai</text>
      <text x="480" y="150" text-anchor="middle" class="board small">${esc(board)}</text>
      <rect x="20" y="30" width="130" height="150" rx="4" fill="${good ? '#bfe3ff' : '#9fc3e8'}" opacity="${good ? 0.9 : 0.5}"/>
      <path d="M85 30 V180 M20 105 H150" stroke="${good ? '#8a6a45' : '#3b4258'}" stroke-width="8"/>
      <polygon points="20,30 150,30 250,560 0,560" fill="url(#lcBeam)" class="beam"/>
      ${seats}
    </svg>`;
  }

  /** Vị trí bong bóng lời thoại (phần trăm khung lớp học) trên đầu người nói. */
  function bubbleAt(D, who) {
    const rc = who === D.characters.victim.name ? [SEAT_ROW, SEAT_COL] : NAMED[who] || [0, 3];
    const { scale, x, y } = seatPos(rc[0], rc[1]);
    return { left: (x / W) * 100, top: ((y - 96 * scale) / H) * 100 };
  }

  function chatMsg(D, m) {
    const isV = m.author === D.characters.victim.name;
    const av = isV ? D.characters.victim.avatar : m.author === D.characters.witness.name ? D.characters.witness.avatar : A.fromName(m.author);
    const el = document.createElement('div');
    el.className = 'lce-msg' + (isV ? '' : ' other');
    el.innerHTML = `<div class="avatar xs">${A.svg(av, isV ? m.mood || 'sad' : 'happy')}</div><p>${isV ? '' : `<b>${esc(m.author)}</b>`}${esc(m.text)}</p>`;
    return el;
  }

  /**
   * Phát cảnh kết thúc trong `root` (một phần tử phủ toàn màn hình).
   * @param {HTMLElement} root
   * @param {object} D nội dung data.json
   * @param {{kind?: 'good'|'bad', onDone?: Function, sound?: object, extra?: string, stats?: string}} opts
   *   kind: 'bad' (mặc định) hoặc 'good'; extra: HTML thêm vào màn cuối (bảng xếp hạng); stats: HTML ô số liệu
   * @returns {{skip: Function, stop: Function}}
   */
  function play(root, D, opts) {
    const o = opts || {};
    const good = o.kind === 'good';
    const sc = good ? D.endings.goodScene : D.endings.scene;
    const cq = D.endings.consequences;
    const win = D.endings.win;
    const timers = [];
    const at = (ms, fn) => timers.push(setTimeout(fn, ms));
    const S = o.sound;

    const finalHtml = good
      ? `<div class="lce-step lce-cons lce-win" id="lceCons">
          <div class="lce-trophy">🏆</div>
          <h1>${esc(win.title)}</h1>
          <p class="lce-lead">${esc(win.lead)}</p>
          ${o.stats ? `<div class="lce-stats">${o.stats}</div>` : ''}
          <ul class="lce-points">${win.points.map((t) => `<li>${esc(t)}</li>`).join('')}</ul>
          <p class="lce-final">${esc(D.meta.finalMessage)}</p>
          ${o.extra || ''}
          <div class="lce-btns" id="lceBtns"></div>
        </div>`
      : `<div class="lce-step lce-cons" id="lceCons">
          <h1>${esc(cq.title)}</h1>
          <div class="lce-cols">
            <section><h3>💔 ${esc(cq.victimTitle)}</h3><ul>${cq.victim.map((t) => `<li>${esc(t)}</li>`).join('')}</ul></section>
            <section><h3>⚖️ ${esc(cq.bullyTitle)}</h3><ul>${cq.bully.map((t) => `<li>${esc(t)}</li>`).join('')}</ul></section>
          </div>
          <div class="lce-help">
            <div class="lce-hotline"><b>${esc(cq.hotline)}</b><small>${esc(cq.hotlineLabel)}</small></div>
            <div><h3>🤝 ${esc(cq.helpTitle)}</h3><p>${esc(cq.help)}</p><p class="police">🚓 ${esc(cq.police)}</p></div>
          </div>
          <p class="lce-final">${esc(D.meta.finalMessage)}</p>
          ${o.extra || ''}
          <div class="lce-btns" id="lceBtns"></div>
        </div>`;

    const afterLines = good ? [sc.closing] : sc.after;
    const lastLine = good ? sc.lesson : sc.question;
    root.innerHTML = `<div class="lce ${good ? 'good' : 'bad'}">
      <div class="lce-step lce-chat" id="lceChat">
        <div class="lce-phone">
          <div class="lce-phone-head">${esc(sc.chatTitle)}</div>
          <div class="lce-msgs" id="lceMsgs"></div>
          ${good ? '' : `<div class="lce-seen" id="lceSeen">${esc(sc.seen)}</div>`}
        </div>
        ${good ? '' : `<p class="lce-caption" id="lceNoReply">${esc(sc.noReply)}</p>`}
      </div>
      <div class="lce-step lce-title" id="lceMorning"><span>${esc(sc.morning)}</span></div>
      <div class="lce-step lce-class" id="lceClass">
        <div class="lce-class-label">${esc(sc.classTitle)}</div>
        <div class="lce-classwrap" id="lceClassWrap">${classroomSvg(D, good, good ? sc.board : 'Sĩ số: 16 · Có mặt: 15')}</div>
        <p class="lce-caption" id="lceRoll">${esc(sc.rollCall)}</p>
        <p class="lce-caption ${good ? 'happy' : 'soft'}" id="lceSilence">${esc(good ? sc.answer : sc.silence)}</p>
        ${good ? '' : `<p class="lce-caption" id="lceEmpty">${esc(sc.emptySeat)}</p>`}
      </div>
      <div class="lce-step lce-title lce-after" id="lceAfter">${afterLines.map((t, i) => `<p style="--d:${i * 2.2}s">${esc(t)}</p>`).join('')}<p class="q" style="--d:${afterLines.length * 2.2}s">${esc(lastLine)}</p></div>
      ${finalHtml}
      <button class="lce-skip" id="lceSkip">Bỏ qua ⏭</button>
    </div>`;
    const $ = (id) => root.querySelector('#' + id);
    const show = (id) => root.querySelectorAll('.lce-step').forEach((s) => s.classList.toggle('on', s.id === id));
    let done = false;
    let room3d = null; // lớp học 3D (ending3d.js); không có WebGL thì dùng hình SVG
    const drop3d = () => { if (room3d) { room3d.dispose(); room3d = null; } };
    const finish = () => {
      if (done) return;
      done = true;
      drop3d();
      timers.forEach(clearTimeout);
      timers.length = 0;
      show('lceCons');
      $('lceSkip').style.display = 'none';
      if (good && S && S.applause) S.applause(4);
      if (o.onDone) o.onDone($('lceBtns'));
    };

    root.classList.add('show');
    root.classList.toggle('good', good);
    show('lceChat');
    let t;
    if (good) {
      // 1) Cả lớp nhắn động viên Minh Anh
      if (S && S.joy) S.joy();
      sc.messages.forEach((m, i) => at(600 + i * 1300, () => {
        $('lceMsgs').appendChild(chatMsg(D, Object.assign({ mood: 'happy' }, m)));
        if (S && S.ting) S.ting();
      }));
      t = 600 + sc.messages.length * 1300 + 1600;
    } else {
      // 1) Tin nhắn cuối, "đã xem" nhưng không ai trả lời
      if (S && S.sorrow) S.sorrow();
      sc.lastMessages.forEach((text, i) => at(700 + i * 1500, () => {
        $('lceMsgs').appendChild(chatMsg(D, { author: D.characters.victim.name, text }));
        if (S && S.ting) S.ting();
      }));
      t = 700 + sc.lastMessages.length * 1500;
      at(t, () => $('lceSeen').classList.add('on'));
      at(t + 1800, () => $('lceNoReply').classList.add('on'));
      t += 4600;
    }
    // 2) "Sáng hôm sau"
    at(t, () => show('lceMorning'));
    t += 3000;
    // 3) Lớp học
    at(t, () => {
      show('lceClass');
      if (window.LCClass3D) {
        const wrap = $('lceClassWrap');
        const svg = wrap.querySelector('svg');
        room3d = window.LCClass3D.mount(wrap, {
          good, D, board: good ? sc.board : 'Sĩ số: 16 · Có mặt: 15',
          avatarFor: (n) => (n === D.characters.witness.name ? D.characters.witness.avatar : A.fromName(n)),
        });
        if (room3d && svg) svg.remove();
        wrap.classList.toggle('is3d', !!room3d);
      }
    });
    at(t + 1200, () => $('lceRoll').classList.add('on'));
    at(t + 3000, () => { $('lceSilence').classList.add('on'); if (good && S && S.correct) S.correct(); });
    if (good) {
      at(t + 3600, () => { const her = root.querySelector('.seat.hers'); if (her) her.classList.add('lit'); });
      sc.bubbles.forEach((b, i) => at(t + 4400 + i * 1500, () => {
        const el = document.createElement('div');
        el.className = 'lce-bubble' + (b.who === D.characters.victim.name ? ' her' : '');
        if (room3d) room3d.track(b.who, el);
        else {
          const pos = bubbleAt(D, b.who);
          el.style.left = pos.left + '%';
          el.style.top = pos.top + '%';
        }
        el.textContent = b.text;
        el.dataset.who = b.who;
        // Mỗi người chỉ một bong bóng: câu mới thay câu cũ
        $('lceClassWrap').querySelectorAll('.lce-bubble').forEach((x) => { if (x.dataset.who === b.who) x.remove(); });
        $('lceClassWrap').appendChild(el);
        if (S && S.ting) S.ting();
      }));
      t += 4400 + sc.bubbles.length * 1500 + 2200;
    } else {
      at(t + 5200, () => { $('lceEmpty').classList.add('on'); const em = root.querySelector('.seat.empty'); if (em) em.classList.add('lit'); });
      t += 9000;
    }
    // 4) Lời kết
    at(t, () => show('lceAfter'));
    at(t + 600, drop3d);
    t += 2200 * (afterLines.length + 1) + 2400;
    // 5) Màn cuối: hậu quả + số hỗ trợ (thua) hoặc vinh danh (thắng)
    at(t, finish);
    $('lceSkip').addEventListener('click', finish);
    return {
      skip: finish,
      stop() { drop3d(); timers.forEach(clearTimeout); root.classList.remove('show', 'good'); root.innerHTML = ''; },
    };
  }

  window.LCEnding = { play };
})();

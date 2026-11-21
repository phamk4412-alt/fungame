// Cảnh kết thúc khi thua: tin nhắn không ai trả lời → lớp học với chỗ ngồi bỏ trống → hậu quả của bạo lực mạng.
// Cố ý KHÔNG mô tả chuyện gì đã xảy ra với Minh Anh: chỉ có sự vắng mặt và lời kêu gọi tìm sự giúp đỡ.
(function () {
  'use strict';
  const A = window.Avatar;
  const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

  /** Lớp học nhìn từ cuối lớp: 4 dãy bàn, các bạn ngồi kín, riêng bàn cạnh cửa sổ trống. */
  function classroomSvg() {
    const names = ['Đức Huy', 'Kim Ngân', 'Tuấn Kiệt', 'Trà My', 'Quốc Bảo', 'Thu Hà', 'Lan Phương', 'Hải Đăng', 'Gia Khánh', 'Minh Tú', 'Văn Toàn', 'Khoa Nguyễn', 'Bé Na', 'Hoàng Nam', 'Trang'];
    let seats = '';
    let k = 0;
    // 3 hàng × 4 bàn; bàn trống: hàng gần nhất, sát cửa sổ (cột 0)
    for (let row = 0; row < 3; row++) {
      for (let col = 0; col < 4; col++) {
        const scale = 0.78 + row * 0.11;
        const x = 120 + col * 205 + (row - 1) * (col - 1.5) * 16;
        const y = 300 + row * 92;
        const empty = row === 2 && col === 0;
        let person = '';
        if (!empty) {
          const av = A.fromName(names[k++ % names.length]);
          person = `<g transform="translate(${x - 34 * scale} ${y - 92 * scale}) scale(${scale * 0.68})" class="mate">${A.svg(av, 'neutral').replace('<svg', '<svg width="100" height="100"')}</g>`;
        }
        seats += `<g class="${empty ? 'seat empty' : 'seat'}">
          ${empty ? `<rect x="${x - 40 * scale}" y="${y - 58 * scale}" width="${80 * scale}" height="${46 * scale}" rx="6" class="chair-back"/>` : ''}
          ${person}
          <rect x="${x - 62 * scale}" y="${y - 12 * scale}" width="${124 * scale}" height="${18 * scale}" rx="4" class="desk-top"/>
          <rect x="${x - 56 * scale}" y="${y + 6 * scale}" width="${112 * scale}" height="${44 * scale}" class="desk-front"/>
        </g>`;
      }
    }
    return `<svg viewBox="0 0 960 600" class="classroom" aria-label="Lớp học, một chỗ ngồi bỏ trống">
      <defs>
        <linearGradient id="lcWall" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#2a3147"/><stop offset="1" stop-color="#1a1f30"/></linearGradient>
        <linearGradient id="lcBeam" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#ffe9b0" stop-opacity=".55"/><stop offset="1" stop-color="#ffe9b0" stop-opacity="0"/></linearGradient>
      </defs>
      <rect width="960" height="600" fill="url(#lcWall)"/>
      <rect y="420" width="960" height="180" fill="#151927"/>
      <rect x="250" y="40" width="460" height="150" rx="6" fill="#1f3a2e" stroke="#6b5132" stroke-width="10"/>
      <text x="480" y="105" text-anchor="middle" class="board">Thứ Hai</text>
      <text x="480" y="150" text-anchor="middle" class="board small">Sĩ số: 16 · Có mặt: 15</text>
      <rect x="20" y="30" width="130" height="150" rx="4" fill="#9fc3e8" opacity=".5"/>
      <path d="M85 30 V180 M20 105 H150" stroke="#3b4258" stroke-width="8"/>
      <polygon points="20,30 150,30 250,560 0,560" fill="url(#lcBeam)" class="beam"/>
      ${seats}
    </svg>`;
  }

  /**
   * Phát cảnh kết thúc trong `root` (một phần tử phủ toàn màn hình).
   * @param {HTMLElement} root
   * @param {object} D nội dung data.json
   * @param {{onDone?: Function, sound?: object, extra?: string}} opts extra: HTML thêm vào màn hậu quả (ví dụ bảng xếp hạng)
   * @returns {{skip: Function, stop: Function}}
   */
  function play(root, D, opts) {
    const o = opts || {};
    const sc = D.endings.scene;
    const cq = D.endings.consequences;
    const v = D.characters.victim;
    const timers = [];
    const at = (ms, fn) => timers.push(setTimeout(fn, ms));
    root.innerHTML = `<div class="lce">
      <div class="lce-step lce-chat" id="lceChat">
        <div class="lce-phone">
          <div class="lce-phone-head">${esc(sc.chatTitle)}</div>
          <div class="lce-msgs" id="lceMsgs"></div>
          <div class="lce-seen" id="lceSeen">${esc(sc.seen)}</div>
        </div>
        <p class="lce-caption" id="lceNoReply">${esc(sc.noReply)}</p>
      </div>
      <div class="lce-step lce-title" id="lceMorning"><span>${esc(sc.morning)}</span></div>
      <div class="lce-step lce-class" id="lceClass">
        <div class="lce-class-label">${esc(sc.classTitle)}</div>
        ${classroomSvg()}
        <p class="lce-caption" id="lceRoll">${esc(sc.rollCall)}</p>
        <p class="lce-caption soft" id="lceSilence">${esc(sc.silence)}</p>
        <p class="lce-caption" id="lceEmpty">${esc(sc.emptySeat)}</p>
      </div>
      <div class="lce-step lce-title lce-after" id="lceAfter">${sc.after.map((t, i) => `<p style="--d:${i * 2.2}s">${esc(t)}</p>`).join('')}<p class="q" style="--d:${sc.after.length * 2.2}s">${esc(sc.question)}</p></div>
      <div class="lce-step lce-cons" id="lceCons">
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
      </div>
      <button class="lce-skip" id="lceSkip">Bỏ qua ⏭</button>
    </div>`;
    const $ = (id) => root.querySelector('#' + id);
    const show = (id) => {
      root.querySelectorAll('.lce-step').forEach((s) => s.classList.toggle('on', s.id === id));
    };
    const S = o.sound;
    const finish = () => {
      timers.forEach(clearTimeout);
      timers.length = 0;
      show('lceCons');
      $('lceSkip').style.display = 'none';
      if (o.onDone) o.onDone($('lceBtns'));
    };

    // 1) Tin nhắn cuối, "đã xem" nhưng không ai trả lời
    root.classList.add('show');
    show('lceChat');
    if (S && S.sorrow) S.sorrow();
    sc.lastMessages.forEach((t, i) => at(700 + i * 1500, () => {
      const m = document.createElement('div');
      m.className = 'lce-msg';
      m.innerHTML = `<div class="avatar xs">${A.svg(v.avatar, 'sad')}</div><p>${esc(t)}</p>`;
      $('lceMsgs').appendChild(m);
      if (S && S.ting) S.ting();
    }));
    let t = 700 + sc.lastMessages.length * 1500;
    at(t, () => $('lceSeen').classList.add('on'));
    at(t + 1800, () => $('lceNoReply').classList.add('on'));
    t += 4600;
    // 2) "Sáng hôm sau"
    at(t, () => show('lceMorning'));
    t += 3000;
    // 3) Lớp học, chỗ ngồi trống
    at(t, () => show('lceClass'));
    at(t + 1200, () => $('lceRoll').classList.add('on'));
    at(t + 3600, () => $('lceSilence').classList.add('on'));
    at(t + 5200, () => { $('lceEmpty').classList.add('on'); root.querySelector('.seat.empty').classList.add('lit'); });
    t += 9000;
    // 4) Những ngày sau
    at(t, () => show('lceAfter'));
    t += 2200 * (sc.after.length + 1) + 2400;
    // 5) Hậu quả + số hỗ trợ
    at(t, finish);
    $('lceSkip').addEventListener('click', finish);
    return {
      skip: finish,
      stop() { timers.forEach(clearTimeout); root.classList.remove('show'); root.innerHTML = ''; },
    };
  }

  window.LCEnding = { play };
})();

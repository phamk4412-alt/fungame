// LÁ CHẮN NGÔN TỪ — bộ phát "video" vẽ bằng HTML: video mở đầu và video riêng trước mỗi màn.
// Mỗi khung hình là hàm của thời gian t (giây), nên vừa phát trực tiếp trên máy chiếu,
// vừa xuất thành MP4 từng khung (tools/lachan-intro-video.js).
//
//   const v = LCVideo.create(container, 'r1', { onEnd })   // 'intro' | 'r1' | 'r2' | 'r3'
//   v.play(); v.pause(); v.seek(t); v.stop(); v.setMuted(true); await v.renderAudio()
(function () {
  'use strict';
  const D = window.LCNT_DATA;
  const A = window.Avatar;
  const clamp = (x, a, b) => Math.max(a, Math.min(b, x));
  const ease = (x) => 1 - Math.pow(1 - clamp(x, 0, 1), 3);
  const back = (x) => { x = clamp(x, 0, 1); const c = 1.7; return 1 + (c + 1) * Math.pow(x - 1, 3) + c * Math.pow(x - 1, 2); };
  const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  const NOTE = (m) => 440 * Math.pow(2, (m - 69) / 12);
  const fmt = (n) => Math.round(n).toLocaleString('vi-VN');
  const S = D.settings.arena;

  /** Màu và biểu tượng riêng của từng màn: dùng chung cho video, máy chiếu và điện thoại. */
  const THEMES = {
    1: { icon: '🔍', name: D.round1.name, goal: D.round1.goal, accent: '#38d9ff' },
    2: { icon: '⛈️', name: D.round2.name, goal: D.round2.goal, accent: '#ffcf4a' },
    3: { icon: '⏪', name: D.round3.name, goal: D.round3.goal, accent: '#ff8fb1' },
  };

  // Ba nút "3 · 2 · 1" cuối mỗi video màn
  const countdown = (t0, word) => `<div class="cd" data-cd="${t0}" data-word="${esc(word)}"></div>`;
  function countHook(root, t) {
    root.querySelectorAll('[data-cd]').forEach((el) => {
      const k = t - Number(el.dataset.cd);
      if (k < 0) { el.style.opacity = 0; return; }
      const i = Math.floor(k);
      const f = k - i;
      el.textContent = i < 3 ? String(3 - i) : el.dataset.word;
      el.style.opacity = i < 3 ? 1 - clamp((f - 0.7) / 0.3, 0, 1) * 0.7 : ease(f * 3);
      el.style.transform = `scale(${i < 3 ? 1.4 - 0.4 * ease(f * 2.5) : 0.6 + 0.4 * back(f * 2)})`;
    });
  }

  // ======================= Video mở đầu =======================
  const INTRO_COMMENTS = [
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

  const intro = {
    duration: 80,
    theme: 0,
    html: () => `
    <section class="sc" data-from="0" data-to="5.6"><div class="title-wrap">
      <div class="a pop shield" data-in="0.4">🛡️</div>
      <h1 class="a up" data-in="1.0">${esc(D.meta.title)}</h1>
      <p class="a up sub" data-in="1.8">${esc(D.meta.subtitle)}</p></div></section>

    <section class="sc" data-from="5.6" data-to="21">
      <div class="phone a up" data-in="5.9">
        <div class="post">
          <div class="post-head"><span class="page-ico">📢</span><div><b>Tin Nóng Sinh Viên</b><small>2 giờ · 🌐 Công khai</small></div></div>
          <p class="post-text" id="postText"></p>
          <div class="post-img"><span>BẢNG ĐIỂM GIỮA KỲ</span><b>5.0 → 9.5</b><em class="a stamp" data-in="17.6">ẢNH CẮT GHÉP</em></div>
          <div class="post-stats"><span>👍😡😂 <b id="cReact">0</b></span><span><b id="cCmt">0</b> bình luận · <b id="cShare">0</b> chia sẻ</span></div>
        </div>
        <div class="cmts" id="cmts">${INTRO_COMMENTS.map(([n, txt]) => `<div class="cmt"><div class="cav">${A.svg(A.fromName(n), n.length % 3 ? 'smirk' : 'neutral')}</div><div class="bub"><b>${esc(n)}</b>${esc(txt)}</div></div>`).join('')}</div>
      </div>
      <div class="victim a up" data-in="7.2">
        <div class="av" id="victimAv"></div>
        <b>${esc(D.characters.victim.name)}</b><small>Sinh viên năm 2</small>
        <div class="hp"><span>Tinh thần</span><div class="bar"><i id="hpFill"></i></div><em id="hpNum">100%</em></div>
      </div>
      <div class="cap a up" data-in="17.8" data-out="21">Bảng điểm là <b class="pink">ảnh cắt ghép</b>. Minh Anh không gian lận.<br>Nhưng <b>1.900</b> bình luận thì là thật.</div>
    </section>

    <section class="sc" data-from="21" data-to="30.5"><div class="big-line">
      <p class="a up" data-in="21.4">Bạo lực mạng không cần nắm đấm.</p>
      <p class="a up pink" data-in="23.4">Chỉ cần một cú nhấn <span class="send">Gửi ➤</span></p>
      <p class="a up small" data-in="26.2">Người viết quên ngay sau vài giây. Người đọc có thể mang theo rất lâu.</p></div></section>

    <section class="sc" data-from="30.5" data-to="44.5">
      <h2 class="a up" data-in="30.8">Trò chơi này để làm gì?</h2>
      <div class="cards3">
        <div class="card a pop" data-in="32.4" style="--c:#4f8cff"><i>🔍</i><b>Nhận ra</b><span>Phân biệt góp ý xây dựng và bạo lực mạng</span></div>
        <div class="card a pop" data-in="34.4" style="--c:#ffcf4a"><i>🛡️</i><b>Tự vệ</b><span>Biết lưu bằng chứng, chặn, khóa bình luận, tìm người giúp</span></div>
        <div class="card a pop" data-in="36.4" style="--c:#3ee39b"><i>💬</i><b>Lên tiếng</b><span>Chọn lời nói đồng cảm khi thấy bạn mình bị tấn công</span></div>
      </div>
      <p class="a up foot" data-in="39.4">Không có ai bị chấm là “người xấu” ở đây. Chúng ta chỉ tập <b>dừng lại 5 giây</b> trước khi viết.</p>
    </section>

    <section class="sc" data-from="44.5" data-to="60.5">
      <h2 class="a up" data-in="44.8">Cách chơi</h2>
      <div class="rounds">${[1, 2, 3].map((r, i) => `<div class="round a pop" data-in="${46.4 + i * 2.1}" style="--c:${THEMES[r].accent}"><em>${THEMES[r].icon} MÀN ${r}</em><b>${esc(THEMES[r].name)}</b><span>${esc(THEMES[r].goal)}</span></div>`).join('')}</div>
      <div class="howto a up" data-in="53.6">
        <div><i>📱</i>Quét mã QR trên màn hình</div>
        <div><i>👥</i>Vào một đội, trả lời thật nhanh</div>
        <div><i>💗</i>Cả lớp cùng giữ <b>Tinh thần</b> của Minh Anh trên <b>50%</b></div>
      </div>
    </section>

    <section class="sc" data-from="60.5" data-to="71"><div class="count-wrap">
      <p class="a up" data-in="60.8">Trước khi nhấn Gửi, hãy dừng lại</p>
      <div class="count" id="count">5</div>
      <p class="a up small" data-in="66.4">${esc(D.meta.finalMessage)}</p></div></section>

    <section class="sc" data-from="71" data-to="99"><div class="title-wrap">
      <div class="a pop shield" data-in="71.3">🛡️</div>
      <h1 class="a up" data-in="71.8">Sẵn sàng chưa?</h1>
      <p class="a up sub" data-in="72.6">Cầm điện thoại lên. Cả lớp là lá chắn của Minh Anh.</p>
      <p class="a up hot" data-in="74">Nếu bạn đang bị bắt nạt trên mạng: kể với người bạn tin, hoặc gọi <b>111</b> (miễn phí, 24/7).</p></div></section>`,
    hook(root, t, $, st) {
      const POST = D.post.text;
      $('postText').textContent = POST.slice(0, Math.floor(clamp((t - 6.3) / 2.6, 0, 1) * POST.length));
      const g = ease((t - 8.6) / 8.6);
      $('cReact').textContent = (4200 * g >= 1000 ? (4.2 * g).toFixed(1).replace('.', ',') + 'K' : fmt(4200 * g));
      $('cCmt').textContent = fmt(1900 * g);
      $('cShare').textContent = fmt(860 * g);
      const els = root.querySelectorAll('.cmt');
      const shown = clamp(Math.floor((t - C_START) / C_GAP) + 1, 0, els.length);
      const slide = shown ? 1 - ease((t - (C_START + (shown - 1) * C_GAP)) / 0.35) : 0;
      els.forEach((el, i) => {
        if (i >= shown) { el.style.opacity = 0; return; }
        el.style.top = (470 - SLOT * (shown - i) + slide * SLOT) + 'px';
        el.style.opacity = i === shown - 1 ? 1 - slide : 1;
      });
      const hp = 100 - 82 * ease((t - 9.4) / 8);
      setHp($('hpFill'), $('hpNum'), hp);
      st.mood($('victimAv'), D.characters.victim.avatar, t < 9.6 ? 'happy' : t < 11.5 ? 'neutral' : t < 13.5 ? 'worried' : t < 15.5 ? 'sad' : 'cry');
      const c = $('count');
      const k = (t - 61.4) / 0.95;
      if (k < 0) c.style.opacity = 0;
      else if (k < 5) {
        const f = k % 1;
        c.textContent = 5 - Math.floor(k);
        c.style.opacity = 1 - clamp((f - 0.75) / 0.25, 0, 1) * 0.6;
        c.style.transform = `scale(${1.35 - 0.35 * ease(f * 2.5)})`;
      } else {
        c.textContent = '💗';
        c.style.opacity = ease((k - 5) * 2);
        c.style.transform = `scale(${0.6 + 0.4 * back((k - 5) * 1.5)})`;
      }
    },
    chords: [
      [0, 5.6, [57, 64, 69, 72]],
      [5.6, 3.5, [57, 60, 64]], [9.1, 4, [53, 57, 60]], [13.1, 4, [52, 56, 59]], [17.1, 4, [45, 57, 60, 64]],
      [21, 4.75, [50, 53, 57]], [25.75, 4.75, [52, 56, 59, 62]],
      [30.5, 3.5, [53, 57, 60, 64]], [34, 3.5, [48, 55, 60, 64]], [37.5, 3.5, [55, 59, 62, 67]], [41, 3.5, [57, 60, 64, 69]],
      [44.5, 4, [53, 57, 60, 65]], [48.5, 4, [48, 55, 60, 64]], [52.5, 4, [55, 59, 62, 67]], [56.5, 4, [48, 55, 60, 64, 67]],
      [60.5, 5.9, [45, 57, 64]],
      [66.4, 4.6, [48, 55, 60, 64, 72]], [71, 4.5, [53, 57, 60, 65, 69]], [75.5, 4.5, [48, 55, 60, 64, 72]],
    ],
    sfx() {
      const s = [];
      INTRO_COMMENTS.forEach((_, i) => { const x = C_START + i * C_GAP; s.push([x, 1568, 0.07, 0.18], [x + 0.07, 2093, 0.05, 0.22]); });
      for (let x = 11; x < 20.5; x += 0.82) s.push([x, 62, 0.35, 0.22], [x + 0.2, 55, 0.25, 0.25]);
      s.push([17.6, 110, 0.4, 0.5, 'square'], [23.4, 880, 0.12, 0.25], [23.5, 1320, 0.1, 0.3]);
      [32.4, 34.4, 36.4, 46.4, 48.5, 50.6].forEach((x, i) => s.push([x, NOTE(72 + [0, 4, 7][i % 3]), 0.09, 0.6]));
      for (let i = 0; i < 5; i++) s.push([61.4 + i * 0.95, 880, 0.12, 0.12, 'triangle']);
      s.push([66.15, NOTE(84), 0.1, 1.2], [66.2, NOTE(88), 0.08, 1.2], [66.25, NOTE(91), 0.07, 1.4]);
      return s;
    },
  };

  function setHp(fill, num, hp) {
    const col = hp > 60 ? ['#3ee39b', '#8ff0c4'] : hp > 30 ? ['#ffcf4a', '#ffe08a'] : ['#ff4b5c', '#ff8a8a'];
    fill.style.width = hp + '%';
    fill.style.background = `linear-gradient(90deg,${col[0]},${col[1]})`;
    num.textContent = Math.round(hp) + '%';
    num.style.color = col[0];
  }

  // Đầu mỗi video màn: biểu tượng lớn, "MÀN n", tên màn, mục tiêu
  const roundTitle = (r, flashAt) => `
    <section class="sc" data-from="0" data-to="5"><div class="title-wrap">
      <div class="a pop ricon" data-in="0.3">${THEMES[r].icon}</div>
      <p class="a up rno" data-in="0.8">MÀN ${r}</p>
      <h1 class="a up rname" data-in="1.2">${esc(THEMES[r].name.toUpperCase())}</h1>
      <p class="a up sub" data-in="2.0">${esc(THEMES[r].goal)}</p></div>${flashAt || ''}</section>`;

  // Cuối mỗi video màn: nhiệm vụ + đếm ngược
  const taskScene = (from, to, lines, word) => `
    <section class="sc" data-from="${from}" data-to="${to}"><div class="task">
      <p class="a up tk-h" data-in="${from + 0.3}">NHIỆM VỤ</p>
      ${lines.map((l, i) => `<p class="a up tk-l" data-in="${from + 0.9 + i * 0.9}">${l}</p>`).join('')}
      ${countdown(to - 3.6, word)}</div></section>`;

  // ======================= Màn 1 · Soi Bóng Tối =======================
  // Bình luận mẫu viết riêng cho video (không trùng câu hỏi thật, để không lộ đáp án).
  const R1_SAMPLES = [
    ['Thu Hà', 'Bài này chưa có nguồn rõ ràng, mọi người nên chờ khoa xác minh.', 1],
    ['Quốc Bảo', 'Loại này đáng bị cả trường tẩy chay 😤', 0],
    ['Ngọc Lan', 'Page nên che mặt bạn ấy lại, đăng vậy là vi phạm quyền riêng tư.', 1],
    ['Tuấn Anh', 'Ai có fb bố mẹ nó không, gửi cho xem nào 😏', 0],
  ];
  const r1 = {
    duration: 31,
    theme: 1,
    html: () => roundTitle(1) + `
    <section class="sc" data-from="5" data-to="15.5">
      <p class="a up story" data-in="5.2">2 giờ sau, bài bóc phốt đã có hàng trăm bình luận…</p>
      <div class="feed">${R1_SAMPLES.map(([n, txt, good], i) => `<div class="fcard a up" data-in="${5.8 + i * 0.45}"><div class="cav">${A.svg(A.fromName(n), good ? 'neutral' : 'smirk')}</div><p><b>${esc(n)}</b>${esc(txt)}</p>
        <em class="a stamp ${good ? 'ok' : 'bad'}" data-in="${8.9 + i * 1.5}">${good ? '👍 GÓP Ý' : '⚠️ BẠO LỰC MẠNG'}</em></div>`).join('')}<div class="lens" id="lens"><span>🔍</span></div></div>
    </section>
    <section class="sc" data-from="15.5" data-to="23.5">
      <h2 class="a up" data-in="15.8">Soi kỹ trước khi kết luận</h2>
      <div class="vs">
        <div class="vcol a pop" data-in="16.8" style="--c:#3ee39b"><b>👍 Góp ý xây dựng</b><span>Bàn về sự việc</span><span>Có lý lẽ, có nguồn</span><span>Tôn trọng con người</span></div>
        <div class="vcol a pop" data-in="18.2" style="--c:#ff4b5c"><b>⚠️ Bạo lực mạng</b><span>Miệt thị, chửi bới</span><span>Bịa đặt, vu khống</span><span>Đe dọa, lộ thông tin</span></div>
      </div>
    </section>` + taskScene(23.5, 31, [
      `<b>${D.round1.items.length} bình luận</b> · ${S.secondsPerQuestion} giây mỗi câu`,
      'Chọn: <b class="g">👍 Góp ý xây dựng</b> hay <b class="r">⚠️ Bạo lực mạng</b>?',
      'Đúng và nhanh: nhiều điểm. Sai hoặc im lặng: Tinh thần Minh Anh giảm.',
    ], 'SOI!'),
    hook(root, t, $) {
      // Kính lúp lướt qua từng bình luận, dừng lại thì đóng dấu
      const lens = $('lens');
      const cards = root.querySelectorAll('.fcard');
      const k = clamp((t - 8.3) / 1.5, 0, cards.length - 0.01);
      const i = Math.floor(k), f = k - i;
      const c = cards[i];
      if (c && t > 7.6) {
        const y0 = c.offsetTop + c.offsetHeight / 2;
        const prev = cards[Math.max(0, i - 1)];
        const yp = prev.offsetTop + prev.offsetHeight / 2;
        const y = i === 0 ? y0 : yp + (y0 - yp) * ease(f * 3);
        lens.style.opacity = clamp((t - 7.6) * 2, 0, 1) * (1 - clamp((t - 14.6) * 2, 0, 1));
        lens.style.transform = `translate(${560 + Math.sin(t * 2.2) * 60}px, ${y - 110}px)`;
      } else lens.style.opacity = 0;
      countHook(root, t);
    },
    chords: [
      [0, 5, [45, 52, 57, 60]], [5, 3.5, [45, 57, 60, 64]], [8.5, 3.5, [41, 53, 57, 60]], [12, 3.5, [43, 55, 59, 62]],
      [15.5, 4, [48, 55, 60, 64]], [19.5, 4, [43, 55, 59, 62]], [23.5, 4, [45, 57, 60, 64]], [27.5, 3.5, [40, 52, 56, 59, 64]],
    ],
    sfx() {
      const s = [[0.3, NOTE(81), 0.1, 1.2], [0.35, NOTE(88), 0.06, 1.4]];
      R1_SAMPLES.forEach((x, i) => s.push([8.9 + i * 1.5, x[2] ? NOTE(84) : 98, x[2] ? 0.1 : 0.35, x[2] ? 0.4 : 0.35, x[2] ? 'sine' : 'square']));
      s.push([16.8, NOTE(76), 0.09, 0.6], [18.2, NOTE(69), 0.09, 0.6]);
      for (let i = 0; i < 3; i++) s.push([27.4 + i, 880, 0.13, 0.12, 'triangle']);
      s.push([30.4, NOTE(81), 0.12, 0.9], [30.45, NOTE(88), 0.09, 0.9]);
      return s;
    },
  };

  // ======================= Màn 2 · Cơn Bão Bình Luận =======================
  const STORM = ['=)))))', 'lên thớt rồi 🍿', 'share mạnh!!!', 'biến căng 🔥', 'tẩy chay đi', 'hóng phần 2', 'tag hết vào', 'ai có ảnh nữa k', 'đúng là loại…', '😂😂😂', 'cả khoa biết rồi', 'ghét thật sự', 'vào xem đi ae', '🍿🍿🍿', 'nghe nói còn…', 'thế mà cũng…'];
  const r2 = {
    duration: 31,
    theme: 2,
    html: () => roundTitle(2) + `
    <section class="sc" data-from="5" data-to="14.5">
      <p class="a up story" data-in="5.2">Bài viết bị chia sẻ <b>860</b> lần. Bình luận đổ về như bão.</p>
      <div class="storm" id="storm">${STORM.map((x) => `<span>${esc(x)}</span>`).join('')}</div>
      <div class="buzz a pop" data-in="6">
        <div class="av" id="r2Av"></div>
        <div class="badge" id="r2Badge">0</div>
      </div>
    </section>
    <section class="sc" data-from="14.5" data-to="23.5">
      <h2 class="a up" data-in="14.8">Không cần cãi tay đôi. Cần đúng <span class="hl">kỹ năng</span>.</h2>
      <div class="skills">${D.round2.skills.map((k, i) => `<div class="skill a pop" data-in="${15.8 + i * 1.2}"><i>${k.icon}</i><b>${esc(k.label)}</b><span>${esc(k.hint)}</span></div>`).join('')}</div>
    </section>` + taskScene(23.5, 31, [
      `<b>${S.stormCount} bình luận ác ý</b> · ${S.secondsPerQuestion} giây mỗi câu`,
      'Chọn <b class="y">kỹ năng đúng</b> cho từng bình luận',
      'Chọn đúng: Minh Anh đứng vững. Chọn sai: cơn bão mạnh thêm.',
    ], 'GIỮ VỮNG!'),
    hook(root, t, $, st) {
      // Bình luận bay chéo như mưa, ngày càng dày
      root.querySelectorAll('#storm span').forEach((el, i) => {
        const speed = 0.55 + (i % 5) * 0.09;
        const start = 5.3 + i * 0.32;
        const p = ((t - start) * speed) % 1.6;
        if (t < start || t > 14.6) { el.style.opacity = 0; return; }
        const x = ((i * 397) % 1700) + 40 - p * 260;
        const y = 150 + p * 700;
        el.style.opacity = clamp(1.6 - p, 0, 1);
        el.style.transform = `translate(${x}px, ${y}px) rotate(-8deg)`;
      });
      const n = Math.floor(clamp((t - 6) / 7, 0, 1) * 120);
      $('r2Badge').textContent = n > 99 ? '99+' : n;
      const buzz = root.querySelector('.buzz');
      if (t > 6.6 && t < 14.5) buzz.style.translate = `${Math.sin(t * 60) * 5}px 0`;
      st.mood($('r2Av'), D.characters.victim.avatar, t < 8 ? 'neutral' : t < 11 ? 'worried' : 'sad');
      // Chớp sét
      const fl = [0.6, 3.1, 7.4, 11.8].reduce((m, x) => Math.max(m, t >= x ? clamp(1 - (t - x) / 0.35, 0, 1) : 0), 0);
      st.flash(fl * 0.75);
      countHook(root, t);
    },
    chords: [
      [0, 5, [38, 50, 53, 57]], [5, 3, [38, 50, 53, 57]], [8, 3, [36, 48, 51, 55]], [11, 3.5, [37, 49, 53, 56]],
      [14.5, 4.5, [41, 53, 57, 60]], [19, 4.5, [43, 55, 58, 62]], [23.5, 4, [38, 50, 53, 57]], [27.5, 3.5, [45, 57, 61, 64]],
    ],
    sfx() {
      const s = [];
      [0.6, 3.1, 7.4, 11.8].forEach((x) => s.push(['noise', x, 1.6, 0.5, 180], ['noise', x, 0.25, 0.25, 3000]));
      s.push(['noise', 5, 9.6, 0.09, 5000]); // tiếng mưa
      for (let x = 6.2; x < 14; x += 0.22 + ((x * 7) % 0.3)) s.push([x, 1568 + ((x * 1000) % 400), 0.035, 0.12]);
      D.round2.skills.forEach((_, i) => s.push([15.8 + i * 1.2, NOTE(72 + [0, 3, 7, 10][i]), 0.1, 0.6]));
      for (let i = 0; i < 3; i++) s.push([27.4 + i, 880, 0.13, 0.12, 'triangle']);
      s.push([30.4, NOTE(81), 0.12, 0.9], [30.45, NOTE(85), 0.09, 0.9], ['noise', 30.4, 1, 0.3, 200]);
      return s;
    },
  };

  // ======================= Màn 3 · 5 Giây Đảo Ngược =======================
  const R3_CHAT = [
    ['Đức Huy', 'Ê thấy bài bóc phốt chưa 😂', 0],
    ['Kim Ngân', 'Nó học lớp mình đó', 0],
    ['Gia Khang', 'Ai lưu ảnh nó không, làm meme đi', 0],
    [D.characters.victim.name, 'Mọi người ơi, chuyện đó không phải sự thật…', 1],
  ];
  const r3 = {
    duration: 32,
    theme: 3,
    html: () => roundTitle(3) + `
    <section class="sc" data-from="5" data-to="15.5">
      <p class="a up story" data-in="5.2">23:47 · Nhóm chat lớp vẫn sáng đèn.</p>
      <div class="chat">
        <div class="ch-head">💬 Lớp K22 Truyền thông · 41 thành viên</div>
        ${R3_CHAT.map(([n, txt, v], i) => `<div class="msg ${v ? 'v' : ''} a up" data-in="${6.2 + i * 1.5}"><div class="cav">${A.svg(v ? D.characters.victim.avatar : A.fromName(n), v ? 'sad' : 'smirk')}</div><p><b>${esc(n)}</b>${esc(txt)}</p></div>`).join('')}
        <p class="seen a up" data-in="12.6">Đã xem bởi 32 người · không ai trả lời</p>
      </div>
    </section>
    <section class="sc" data-from="15.5" data-to="24">
      <div class="witness a pop" data-in="15.8"><div class="av">${A.svg(D.characters.witness.avatar, 'worried')}</div>
        <p>Bạn là <b>${esc(D.characters.witness.name)}</b><small>${esc(D.characters.witness.role)}</small></p></div>
      <p class="a up story2" data-in="17.4">Bạn có <b>5 giây</b> trước nút Gửi. Bạn sẽ…</p>
      <div class="ways">
        <span class="a pop" data-in="18.6" style="--c:#ff4b5c">🤝 Hùa theo?</span>
        <span class="a pop" data-in="19.5" style="--c:#9aa3c7">🤐 Im lặng?</span>
        <span class="a pop" data-in="20.4" style="--c:#3ee39b">💬 Lên tiếng?</span>
      </div>
    </section>` + taskScene(24, 32, [
      `<b>${D.round3.situations.length} tình huống</b> trong nhóm chat · ${S.secondsPerQuestion} giây mỗi câu`,
      'Chọn cách phản hồi <b class="p">tử tế và an toàn</b> nhất',
      'Một lời đúng lúc có thể đảo ngược tất cả.',
    ], 'ĐẢO NGƯỢC!'),
    hook(root, t, $) {
      // Đồng hồ "tua ngược" ở cảnh tiêu đề
      const ic = root.querySelector('.ricon');
      if (t < 5) ic.style.rotate = `${-ease(t / 2.5) * 360}deg`;
      countHook(root, t);
    },
    chords: [
      [0, 5, [48, 55, 60, 64]], [5, 3.5, [45, 52, 57, 60]], [8.5, 3.5, [41, 53, 57, 60]], [12, 3.5, [43, 55, 59, 62]],
      [15.5, 4.25, [48, 55, 60, 64]], [19.75, 4.25, [53, 57, 60, 65]], [24, 4, [43, 55, 59, 62, 67]], [28, 4, [48, 55, 60, 64, 72]],
    ],
    sfx() {
      const s = [[0.3, NOTE(84), 0.08, 0.3], [0.45, NOTE(79), 0.08, 0.3], [0.6, NOTE(76), 0.08, 0.3], [0.75, NOTE(72), 0.1, 0.8]];
      R3_CHAT.forEach((_, i) => s.push([6.2 + i * 1.5, 1175, 0.07, 0.2], [6.28 + i * 1.5, 1568, 0.05, 0.2]));
      s.push([15.8, NOTE(76), 0.09, 0.8]);
      [18.6, 19.5, 20.4].forEach((x, i) => s.push([x, NOTE([67, 64, 72][i]), 0.09, 0.6]));
      for (let i = 0; i < 3; i++) s.push([28.4 + i, 880, 0.13, 0.12, 'triangle']);
      s.push([31.4, NOTE(84), 0.12, 1], [31.45, NOTE(88), 0.09, 1], [31.5, NOTE(91), 0.08, 1]);
      return s;
    },
  };

  const VIDEOS = { intro, r1, r2, r3 };

  // ======================= Âm thanh =======================
  let noiseBuf = null;
  function noise(ctx) {
    if (noiseBuf && noiseBuf.sampleRate === ctx.sampleRate) return noiseBuf;
    noiseBuf = ctx.createBuffer(1, ctx.sampleRate * 2, ctx.sampleRate);
    const d = noiseBuf.getChannelData(0);
    let s = 1;
    for (let i = 0; i < d.length; i++) { s = (s * 16807) % 2147483647; d[i] = (s / 2147483647) * 2 - 1; }
    return noiseBuf;
  }

  function schedule(ctx, out, v, from, t0) {
    const at = (s) => t0 + (s - from);
    const master = ctx.createGain();
    master.gain.value = 1.0;
    const lp = ctx.createBiquadFilter();
    lp.type = 'lowpass'; lp.frequency.value = 2400;
    master.connect(lp); lp.connect(out);
    const now = ctx.currentTime;
    for (const [s, len, notes] of v.chords) {
      if (s + len < from) continue;
      for (const m of notes) for (const det of [-6, 6]) {
        const o = ctx.createOscillator(), g = ctx.createGain();
        o.type = m < 50 ? 'sine' : 'triangle';
        o.frequency.value = NOTE(m); o.detune.value = det;
        const a = Math.max(at(s), now), e = at(s + len + 0.6);
        const vol = (m < 50 ? 0.09 : 0.045) / notes.length * 3;
        g.gain.setValueAtTime(0, a);
        g.gain.linearRampToValueAtTime(vol, Math.max(a + 0.01, at(s + 0.9)));
        g.gain.setValueAtTime(vol, Math.max(a + 0.02, at(s + len - 0.2)));
        g.gain.linearRampToValueAtTime(0, e);
        o.connect(g); g.connect(master);
        o.start(a); o.stop(e + 0.05);
      }
    }
    for (const x of v.sfx()) {
      if (x[0] === 'noise') {
        const [, s, dur, vol, freq] = x;
        if (s + dur < from) continue;
        const src = ctx.createBufferSource(), f = ctx.createBiquadFilter(), g = ctx.createGain();
        src.buffer = noise(ctx); src.loop = true;
        f.type = freq < 1000 ? 'lowpass' : 'bandpass'; f.frequency.value = freq;
        const a = Math.max(at(s), now);
        g.gain.setValueAtTime(0, a); g.gain.linearRampToValueAtTime(vol, a + 0.05); g.gain.exponentialRampToValueAtTime(0.0001, Math.max(a + 0.1, at(s + dur)));
        src.connect(f); f.connect(g); g.connect(master); src.start(a); src.stop(at(s + dur) + 0.1);
        continue;
      }
      const [s, freq, vol, dur, type] = x;
      if (s < from) continue;
      const o = ctx.createOscillator(), g = ctx.createGain();
      o.type = type || 'sine'; o.frequency.value = freq;
      g.gain.setValueAtTime(0, at(s)); g.gain.linearRampToValueAtTime(vol, at(s) + 0.01); g.gain.exponentialRampToValueAtTime(0.0001, at(s) + dur);
      o.connect(g); g.connect(master); o.start(at(s)); o.stop(at(s) + dur + 0.05);
    }
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

  let sharedCtx = null;

  /**
   * Gắn một video vào phần tử container (sân khấu 1920×1080 tự co giãn vừa container).
   * @param {HTMLElement} container
   * @param {'intro'|'r1'|'r2'|'r3'} id
   * @param {{onEnd?: () => void, muted?: boolean}} [opts]
   */
  function create(container, id, opts) {
    const v = VIDEOS[id];
    if (!v) throw new Error('Không có video ' + id);
    const o = opts || {};
    container.innerHTML = `<div class="lcv" data-theme="${v.theme}"><div class="lcv-stage"><div class="bg"><i class="b1"></i><i class="b2"></i><i class="b3"></i></div><div class="fx"></div>${v.html()}<div class="flashfx"></div><div class="progress"><i></i></div></div></div>`;
    const root = container.querySelector('.lcv-stage');
    const $ = (x) => root.querySelector('#' + x);
    const sections = [...root.querySelectorAll('.sc')].map((el) => ({ el, from: +el.dataset.from, to: +el.dataset.to }));
    const anims = [...root.querySelectorAll('.a')].map((el) => {
      const sc = sections.find((s) => s.el.contains(el));
      return { el, t0: +el.dataset.in, t1: el.dataset.out ? +el.dataset.out : sc.to, kind: el.classList.contains('pop') ? 'pop' : el.classList.contains('stamp') ? 'stamp' : 'up' };
    });
    const moods = new WeakMap();
    const st = {
      mood(el, av, m) { if (moods.get(el) !== m) { moods.set(el, m); el.innerHTML = A.svg(av, m); } },
      flash(x) { root.querySelector('.flashfx').style.opacity = x; },
    };

    function render(t) {
      for (const s of sections) {
        const k = clamp(Math.min(ease((t - s.from) / 0.5), 1 - ease((t - (s.to - 0.5)) / 0.5)), 0, 1);
        s.el.style.opacity = k;
        s.el.style.visibility = k > 0 ? 'visible' : 'hidden';
      }
      for (const a of anims) {
        const p = (t - a.t0) / (a.kind === 'up' ? 0.7 : 0.55);
        if (p <= 0 || t > a.t1) { a.el.style.opacity = 0; continue; }
        a.el.style.opacity = clamp(p * 1.6, 0, 1);
        if (a.kind === 'up') a.el.style.transform = `translateY(${(1 - ease(p)) * 50}px)`;
        else if (a.kind === 'pop') a.el.style.transform = `scale(${0.6 + 0.4 * back(p)})`;
        else a.el.style.transform = `rotate(-10deg) scale(${1 + 1.5 * (1 - ease(p * 1.4))})`;
      }
      if (v.hook) v.hook(root, t, $, st);
      root.querySelector('.progress i').style.width = (clamp(t / v.duration, 0, 1) * 100) + '%';
    }

    function fit() {
      const k = Math.min(container.clientWidth / 1920, container.clientHeight / 1080) || 1;
      root.style.transform = `translate(-50%, -50%) scale(${k})`;
    }
    const ro = window.ResizeObserver ? new ResizeObserver(fit) : null;
    if (ro) ro.observe(container); else addEventListener('resize', fit);
    fit();

    let t = 0, playing = false, last = 0, bus = null, muted = !!o.muted, raf = 0, ended = false;
    const audio = () => {
      if (muted) return;
      try {
        sharedCtx = sharedCtx || new (window.AudioContext || window.webkitAudioContext)();
        sharedCtx.resume();
        stopAudio();
        bus = schedule(sharedCtx, sharedCtx.destination, v, t, sharedCtx.currentTime + 0.05);
      } catch (e) { /* không có âm thanh vẫn chiếu được */ }
    };
    const stopAudio = () => { if (bus) { try { bus.disconnect(); } catch (e) { /* đã ngắt */ } bus = null; } };
    function loop(now) {
      if (!playing) return;
      t += (now - last) / 1000; last = now;
      if (t >= v.duration) {
        t = v.duration; playing = false; stopAudio(); render(t);
        if (!ended) { ended = true; if (o.onEnd) o.onEnd(); }
        return;
      }
      render(t);
      raf = requestAnimationFrame(loop);
    }
    render(0.0001);

    return {
      duration: v.duration,
      get time() { return t; },
      get playing() { return playing; },
      play() { if (t >= v.duration) { t = 0; ended = false; } playing = true; last = performance.now(); audio(); cancelAnimationFrame(raf); raf = requestAnimationFrame(loop); },
      pause() { playing = false; stopAudio(); },
      seek(s) { t = clamp(s, 0, v.duration); render(t); if (playing) audio(); },
      setMuted(m) { muted = m; if (m) stopAudio(); else if (playing) audio(); },
      stop() { playing = false; stopAudio(); cancelAnimationFrame(raf); if (ro) ro.disconnect(); container.innerHTML = ''; },
      /** Nhạc nền của cả video dưới dạng WAV (base64), dùng khi xuất MP4. */
      async renderAudio() {
        const rate = 44100;
        const ctx = new OfflineAudioContext(2, Math.ceil(rate * v.duration), rate);
        schedule(ctx, ctx.destination, v, 0, 0);
        const bytes = wav(await ctx.startRendering());
        let s = '';
        for (let i = 0; i < bytes.length; i += 0x8000) s += String.fromCharCode.apply(null, bytes.subarray(i, i + 0x8000));
        return btoa(s);
      },
    };
  }

  window.LCVideo = { create, THEMES, ids: Object.keys(VIDEOS), durations: Object.fromEntries(Object.entries(VIDEOS).map(([k, x]) => [k, x.duration])) };
})();

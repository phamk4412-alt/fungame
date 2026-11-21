// Luật chơi chế độ Đấu Trường (nhiều người): thuần, không đụng DOM hay mạng.
// Dùng chung cho server (Node) và bài kiểm thử.
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory(require('./rules'));
  else root.LCArenaRules = factory(root.LCRules);
})(typeof self !== 'undefined' ? self : this, function (R) {
  'use strict';

  /**
   * Tạo bộ câu hỏi từ data.json: 5 câu Màn 1, `arena.stormCount` câu Màn 2, 3 câu Màn 3.
   * @param {object} D nội dung game
   * @param {number} seed hạt giống để chọn bình luận Màn 2
   */
  function buildQuestions(D, seed) {
    const qs = [];
    const ch = D.round1.choices;
    const r1Keys = ['constructive', 'bully'];
    D.round1.items.forEach((it) => {
      qs.push({
        round: 1,
        kind: 'choice',
        prompt: 'Đây là góp ý xây dựng hay bạo lực mạng?',
        card: { author: it.author, handle: it.handle || '', text: it.text, avatar: it.avatar || null },
        options: r1Keys.map((k) => ({ label: ch[k].label, icon: ch[k].icon })),
        answer: r1Keys.indexOf(it.answer),
        type: it.type,
        explain: it.explain,
      });
    });
    const skills = D.round2.skills;
    const picked = R.stormOrder(D.round2.comments, R.rng(seed >>> 0)).slice(0, D.settings.arena.stormCount);
    picked.forEach((c) => {
      qs.push({
        round: 2,
        kind: 'choice',
        prompt: 'Minh Anh nên dùng kỹ năng nào với bình luận này?',
        card: { author: c.author, handle: '', text: c.text, avatar: null },
        options: skills.map((s) => ({ label: s.label, icon: s.icon, hint: s.hint })),
        answer: skills.findIndex((s) => s.id === c.skill),
        explain: c.why,
      });
    });
    D.round3.situations.forEach((s) => {
      const hps = s.options.map((o) => o.hp);
      qs.push({
        round: 3,
        kind: 'empathy',
        prompt: s.question,
        chat: { where: s.where, members: s.members, messages: s.messages },
        options: s.options.map((o) => ({ label: o.text, verdict: o.verdict, explain: o.explain, hp: o.hp })),
        answer: hps.indexOf(Math.max(...hps)),
        explain: s.options[hps.indexOf(Math.max(...hps))].explain,
      });
    });
    return qs;
  }

  /** Hệ số tốc độ: trả lời ngay = 1, trả lời lúc hết giờ = minPoints/maxPoints. */
  function speedPoints(cfg, elapsedSec) {
    const f = Math.max(0, Math.min(1, elapsedSec / cfg.secondsPerQuestion));
    return Math.round(cfg.maxPoints - (cfg.maxPoints - cfg.minPoints) * f);
  }

  /**
   * Điểm một người nhận được cho một câu.
   * Câu phân loại: đúng mới có điểm. Câu đồng cảm: phương án càng làm Minh Anh hồi phục càng nhiều điểm.
   */
  function questionPoints(cfg, q, choice, elapsedSec) {
    if (choice == null || choice < 0 || choice >= q.options.length) return 0;
    if (q.kind === 'choice') return choice === q.answer ? speedPoints(cfg, elapsedSec) : 0;
    const best = q.options[q.answer].hp;
    const hp = q.options[choice].hp;
    if (hp <= 0 || best <= 0) return 0;
    return Math.round((speedPoints(cfg, elapsedSec) * hp) / best);
  }

  /** Người chơi có trả lời đúng (hoặc chọn phương án tốt nhất) không. */
  function isCorrect(q, choice) {
    return choice === q.answer;
  }

  /**
   * Cả phòng cùng giữ Tinh thần của Minh Anh.
   * Câu phân loại: tỉ lệ đúng càng cao càng hồi, thấp thì tụt (nội suy missHp → hitHp).
   * Câu đồng cảm: trung bình HP của các phương án mọi người chọn; ai không chọn tính timeoutHp.
   * @param {object} cfg settings.arena
   * @param {object} q câu hỏi
   * @param {Array<number|null>} choices lựa chọn của từng người được tính (null = không trả lời)
   */
  function hpDelta(cfg, q, choices) {
    if (!choices.length) return 0;
    if (q.kind === 'choice') {
      const ok = choices.filter((c) => c === q.answer).length;
      return Math.round(R.lerp(cfg.missHp, cfg.hitHp, ok / choices.length));
    }
    const sum = choices.reduce((s, c) => s + (c == null || !q.options[c] ? cfg.timeoutHp : q.options[c].hp), 0);
    return Math.round(sum / choices.length);
  }

  /**
   * Xếp hạng đội theo điểm trung bình mỗi thành viên (công bằng khi đội đông ít khác nhau),
   * hòa thì theo tổng điểm.
   * @param {string[]} names tên đội
   * @param {{team:number, score:number}[]} players
   */
  function teamStandings(names, players) {
    const rows = names.map((name, i) => {
      const ms = players.filter((p) => p.team === i);
      const total = ms.reduce((s, p) => s + p.score, 0);
      return { team: i, name, count: ms.length, total, avg: ms.length ? Math.round(total / ms.length) : 0 };
    });
    return rows.slice().sort((a, b) => b.avg - a.avg || b.total - a.total || a.team - b.team);
  }

  /** Đội ít người nhất (để xếp người mới vào), hòa thì đội đứng trước. */
  function smallestTeam(teamCount, players) {
    let best = 0;
    let bestN = Infinity;
    for (let i = 0; i < teamCount; i++) {
      const n = players.filter((p) => p.team === i).length;
      if (n < bestN) { best = i; bestN = n; }
    }
    return best;
  }

  /** Kết cục Đấu Trường: chỉ thắng khi cả phòng giữ Tinh thần trên ngưỡng. */
  function arenaOutcome(hp, winHp) {
    return hp > winHp ? 'win' : 'lose';
  }

  return { buildQuestions, speedPoints, questionPoints, isCorrect, hpDelta, teamStandings, smallestTeam, arenaOutcome };
});

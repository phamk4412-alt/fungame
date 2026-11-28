// Phòng Đấu Trường của Lá Chắn Ngôn Từ: máy chiếu (MC) điều khiển, khán giả trả lời bằng điện thoại.
// Lớp Arena chỉ giữ trạng thái và luật; mạng (WebSocket) nằm ở lachan/server.js.
const AR = require('../public/lachan/arena-rules');

class Arena {
  /**
   * @param {string} code mã phòng
   * @param {object} data nội dung data.json
   * @param {{now?: () => number, seed?: number}} [opts] now() trả mili giây (tiêm vào để kiểm thử)
   */
  constructor(code, data, opts) {
    const o = opts || {};
    this.code = code;
    this.D = data;
    this.cfg = data.settings.arena;
    this.now = o.now || Date.now;
    this.seed = o.seed;
    this.players = new Map(); // id -> { id, name, team, score, connected, answers: [] }
    this.reset();
  }

  /** Về phòng chờ, giữ người chơi nhưng xóa điểm. */
  reset() {
    const seed = this.seed != null ? this.seed : Math.floor(Math.random() * 0xffffffff);
    this.questions = AR.buildQuestions(this.D, seed);
    this.phase = 'lobby'; // lobby | story | question | reveal | end
    this.qIndex = -1;
    this.startedAt = 0;
    this.deadline = 0;
    this.hp = this.D.settings.hpStart;
    this.lastHpDelta = 0;
    this.eligible = new Set();
    this.outcome = null;
    // Mỗi đội giữ một thanh Tinh thần riêng: đội nào trên mức thắng thì xem kết có hậu
    this.teamHp = this.D.teams.map(() => this.D.settings.hpStart);
    this.teamOutcome = null;
    for (const p of this.players.values()) {
      p.score = 0;
      p.answers = [];
      p.lastPoints = 0;
    }
  }

  get question() {
    return this.questions[this.qIndex] || null;
  }

  /** Thêm hoặc nối lại người chơi. Trả về lỗi (chuỗi) hoặc null. */
  join(id, name, team) {
    let p = this.players.get(id);
    if (!p) {
      if (this.players.size >= this.cfg.maxPlayers) return 'Phòng đã đủ người.';
      if (!name) return 'Hãy nhập tên.';
      p = { id, name: this.uniqueName(name), team: 0, score: 0, connected: 0, answers: [], lastPoints: 0 };
      p.team = this.validTeam(team) ? team : AR.smallestTeam(this.D.teams.length, [...this.players.values()]);
      this.players.set(id, p);
    }
    if (this.phase === 'question') this.eligible.add(id);
    return null;
  }

  validTeam(t) {
    return Number.isInteger(t) && t >= 0 && t < this.D.teams.length;
  }

  uniqueName(name) {
    const taken = new Set([...this.players.values()].map((p) => p.name.toLowerCase()));
    if (!taken.has(name.toLowerCase())) return name;
    for (let i = 2; ; i++) {
      const n = `${name.slice(0, 13)} ${i}`;
      if (!taken.has(n.toLowerCase())) return n;
    }
  }

  /** Người chơi đổi đội: chỉ được khi còn ở phòng chờ. */
  setTeam(id, team) {
    const p = this.players.get(id);
    if (!p || this.phase !== 'lobby' || !this.validTeam(team)) return;
    p.team = team;
  }

  /** MC mời một người ra khỏi phòng (ví dụ đặt tên không phù hợp). */
  kick(id) {
    this.players.delete(id);
    this.eligible.delete(id);
  }

  setConnected(id, delta) {
    const p = this.players.get(id);
    if (p) p.connected = Math.max(0, p.connected + delta);
  }

  start() {
    if (this.phase !== 'lobby' || !this.players.size) return;
    this.openQuestion(0);
  }

  /**
   * Sang câu i. Câu đầu của mỗi màn mở pha 'story': máy chiếu chiếu video của màn,
   * điện thoại chờ; MC (hoặc video tự hết) bấm tiếp mới bắt đầu tính giờ.
   */
  openQuestion(i) {
    const prev = this.questions[i - 1];
    this.qIndex = i;
    if (this.cfg.roundVideos !== false && (!prev || prev.round !== this.questions[i].round)) {
      this.phase = 'story';
      for (const p of this.players.values()) p.lastPoints = 0;
      return;
    }
    this.beginQuestion();
  }

  beginQuestion() {
    this.phase = 'question';
    this.startedAt = this.now();
    this.deadline = this.startedAt + this.cfg.secondsPerQuestion * 1000;
    this.eligible = new Set([...this.players.values()].filter((p) => p.connected > 0).map((p) => p.id));
    for (const p of this.players.values()) p.lastPoints = 0;
  }

  /** Người chơi trả lời. Mỗi câu chỉ một lần. Trả về true nếu được ghi nhận. */
  answer(id, qIndex, choice) {
    const p = this.players.get(id);
    const q = this.question;
    if (!p || this.phase !== 'question' || qIndex !== this.qIndex || !q) return false;
    if (!Number.isInteger(choice) || choice < 0 || choice >= q.options.length) return false;
    if (p.answers[qIndex] != null) return false;
    const elapsed = (this.now() - this.startedAt) / 1000;
    p.answers[qIndex] = choice;
    p.lastPoints = AR.questionPoints(this.cfg, q, choice, elapsed);
    p.score += p.lastPoints;
    this.eligible.add(id);
    if (this.allAnswered()) this.reveal();
    return true;
  }

  allAnswered() {
    const ids = [...this.eligible].filter((id) => {
      const p = this.players.get(id);
      return p && p.connected > 0;
    });
    return ids.length > 0 && ids.every((id) => this.players.get(id).answers[this.qIndex] != null);
  }

  /** Hết giờ hoặc MC bấm: công bố đáp án, cập nhật Tinh thần của Minh Anh. */
  reveal() {
    if (this.phase !== 'question') return;
    const q = this.question;
    const choices = [...this.eligible].filter((id) => this.players.has(id)).map((id) => {
      const a = this.players.get(id).answers[this.qIndex];
      return a == null ? null : a;
    });
    this.lastHpDelta = AR.hpDelta(this.cfg, q, choices);
    this.hp = Math.max(0, Math.min(100, this.hp + this.lastHpDelta));
    this.teamHp = this.teamHp.map((h, t) => {
      const mine = [...this.eligible].map((id) => this.players.get(id)).filter((p) => p && p.team === t).map((p) => (p.answers[this.qIndex] == null ? null : p.answers[this.qIndex]));
      return mine.length ? Math.max(0, Math.min(100, h + AR.hpDelta(this.cfg, q, mine))) : h;
    });
    this.phase = 'reveal';
  }

  /** MC bấm tiếp: câu sau, hoặc kết thúc khi hết câu / Tinh thần về 0. */
  next() {
    if (this.phase === 'story') { this.beginQuestion(); return; }
    if (this.phase === 'question') { this.reveal(); return; }
    if (this.phase !== 'reveal') return;
    // Kết thúc sớm khi mọi đội đang chơi đều đã để Tinh thần về 0
    const active = this.activeTeams();
    const allDown = active.length ? active.every((t) => this.teamHp[t] <= 0) : this.hp <= 0;
    if (allDown || this.qIndex >= this.questions.length - 1) {
      this.phase = 'end';
      this.outcome = AR.arenaOutcome(this.hp, this.D.settings.winHp);
      this.teamOutcome = this.teamHp.map((h, t) => (active.includes(t) ? AR.arenaOutcome(h, this.D.settings.winHp) : null));
      return;
    }
    this.openQuestion(this.qIndex + 1);
  }

  /** Các đội đang có người chơi. */
  activeTeams() {
    const set = new Set([...this.players.values()].map((p) => p.team));
    return this.D.teams.map((_, i) => i).filter((i) => set.has(i));
  }

  /** Gọi định kỳ: tự công bố đáp án khi hết giờ. Trả về true nếu trạng thái đổi. */
  tick() {
    if (this.phase === 'question' && this.now() >= this.deadline) {
      this.reveal();
      return true;
    }
    return false;
  }

  counts() {
    const q = this.question;
    if (!q) return [];
    const c = q.options.map(() => 0);
    for (const p of this.players.values()) {
      const a = p.answers[this.qIndex];
      if (a != null) c[a]++;
    }
    return c;
  }

  ranking() {
    return [...this.players.values()].sort((a, b) => b.score - a.score || a.name.localeCompare(b.name));
  }

  publicQuestion(withAnswer) {
    const q = this.question;
    if (!q) return null;
    const out = { round: q.round, kind: q.kind, prompt: q.prompt, card: q.card || null, chat: q.chat || null };
    out.options = q.options.map((o) => {
      const x = { label: o.label, icon: o.icon || null, hint: o.hint || null };
      if (withAnswer && q.kind === 'empathy') Object.assign(x, { hp: o.hp, verdict: o.verdict, explain: o.explain });
      return x;
    });
    if (withAnswer) Object.assign(out, { answer: q.answer, explain: q.explain, type: q.type || null });
    return out;
  }

  common() {
    const showAnswer = this.phase === 'reveal' || this.phase === 'end';
    return {
      code: this.code,
      phase: this.phase,
      qIndex: this.qIndex,
      total: this.questions.length,
      endsIn: this.phase === 'question' ? Math.max(0, this.deadline - this.now()) : 0,
      seconds: this.cfg.secondsPerQuestion,
      round: this.question ? this.question.round : null,
      // Trong lúc chiếu video của màn, chưa gửi câu hỏi
      question: this.phase === 'story' ? null : this.publicQuestion(showAnswer),
      hp: this.hp,
      hpDelta: showAnswer ? this.lastHpDelta : 0,
      winHp: this.D.settings.winHp,
      outcome: this.outcome,
      teams: AR.teamStandings(this.D.teams, [...this.players.values()]).map((r) => Object.assign(r, {
        hp: this.teamHp[r.team],
        outcome: this.teamOutcome ? this.teamOutcome[r.team] : null,
      })),
    };
  }

  /** Trạng thái cho máy chiếu: thấy hết. */
  stateForHost() {
    const s = this.common();
    const rank = this.ranking();
    s.players = rank.map((p) => ({ id: p.id, name: p.name, team: p.team, score: p.score, connected: p.connected > 0, answered: p.answers[this.qIndex] != null, lastPoints: p.lastPoints }));
    s.answered = rank.filter((p) => p.answers[this.qIndex] != null).length;
    s.expected = [...this.eligible].filter((id) => { const p = this.players.get(id); return p && p.connected > 0; }).length;
    s.counts = s.phase === 'question' ? null : this.counts();
    return s;
  }

  /** Trạng thái cho điện thoại của một người: không lộ đáp án trước khi công bố. */
  stateForPlayer(id) {
    const s = this.common();
    const p = this.players.get(id);
    if (!p) return Object.assign(s, { me: null });
    const rank = this.ranking();
    const mine = p.answers[this.qIndex];
    s.me = {
      name: p.name,
      team: p.team,
      score: p.score,
      rank: rank.indexOf(p) + 1,
      of: rank.length,
      answer: mine == null ? null : mine,
      lastPoints: this.phase === 'question' ? 0 : p.lastPoints,
      correct: this.phase === 'question' || mine == null ? null : AR.isCorrect(this.question, mine),
      teamHp: this.teamHp[p.team],
      outcome: this.teamOutcome ? this.teamOutcome[p.team] : null,
    };
    return s;
  }
}

module.exports = { Arena };

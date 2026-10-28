// Logic một bàn Texas Hold'em (tối đa 6 người)
const crypto = require('crypto');
const { bestHand, compareScores } = require('./handeval');

const MAX_SEATS = 6;
const START_CHIPS = 1000;
const SMALL_BLIND = 10;
const BIG_BLIND = 20;
const TURN_SECONDS = 30;
const NEXT_HAND_DELAY = 6000;
const BUST_WAIT_MS = 3 * 60 * 1000; // hết tiền phải chờ 3 phút mới được mua lại

function newDeck() {
  const deck = [];
  for (const s of 'shdc') for (const r of '23456789TJQKA') deck.push(r + s);
  // Xáo bài bằng Fisher-Yates với số ngẫu nhiên an toàn
  for (let i = deck.length - 1; i > 0; i--) {
    const j = crypto.randomInt(i + 1);
    [deck[i], deck[j]] = [deck[j], deck[i]];
  }
  return deck;
}

class Table {
  constructor(code, onChange) {
    this.code = code;
    this.onChange = onChange; // gọi khi trạng thái thay đổi để phát cho mọi người
    this.seats = new Array(MAX_SEATS).fill(null);
    this.dealer = -1;
    this.stage = 'waiting'; // waiting | preflop | flop | turn | river | showdown
    this.board = [];
    this.deck = [];
    this.currentBet = 0;
    this.minRaise = BIG_BLIND;
    this.toAct = -1;
    this.turnDeadline = 0;
    this.turnTimer = null;
    this.nextHandTimer = null;
    this.results = null; // kết quả ván vừa xong
    this.log = [];
    this.handNo = 0;
  }

  // ---------- Quản lý người chơi ----------

  addPlayer(id, name) {
    const existing = this.seats.findIndex((p) => p && p.id === id);
    if (existing >= 0) {
      this.seats[existing].connected = true;
      this.seats[existing].name = name || this.seats[existing].name;
      return existing;
    }
    const seat = this.seats.findIndex((p) => p === null);
    if (seat < 0) return -1;
    this.seats[seat] = {
      id,
      name: name || `Người chơi ${seat + 1}`,
      chips: START_CHIPS,
      cards: [],
      bet: 0,
      totalBet: 0,
      folded: true,
      allIn: false,
      acted: false,
      inHand: false,
      connected: true,
      leaveAfterHand: false,
    };
    this.addLog(`${this.seats[seat].name} đã vào bàn.`);
    return seat;
  }

  seatOf(id) {
    return this.seats.findIndex((p) => p && p.id === id);
  }

  setConnected(id, connected) {
    const i = this.seatOf(id);
    if (i >= 0) this.seats[i].connected = connected;
  }

  removePlayer(id) {
    const i = this.seatOf(id);
    if (i < 0) return;
    const p = this.seats[i];
    if (this.isHandRunning() && p.inHand && !p.folded) {
      // Đang trong ván: bỏ bài rồi rời sau khi ván xong
      p.leaveAfterHand = true;
      if (this.toAct === i) this.act(id, { type: 'fold' });
      else {
        p.folded = true;
        this.addLog(`${p.name} bỏ bài (rời bàn).`);
        this.checkHandProgress();
      }
      return;
    }
    if (this.isHandRunning() && p.inHand) {
      p.leaveAfterHand = true;
      return;
    }
    this.addLog(`${p.name} đã rời bàn.`);
    this.seats[i] = null;
  }

  rebuy(id) {
    const i = this.seatOf(id);
    if (i < 0) return;
    const p = this.seats[i];
    if (p.chips > 0 || (this.isHandRunning() && p.inHand)) return;
    if (p.rebuyAt && Date.now() < p.rebuyAt) {
      const secs = Math.ceil((p.rebuyAt - Date.now()) / 1000);
      return `Bạn phải chờ thêm ${secs} giây nữa mới được mua lại chip.`;
    }
    p.chips = START_CHIPS;
    p.rebuyAt = 0;
    this.addLog(`${p.name} mua thêm ${START_CHIPS} chip.`);
    this.maybeAutoStart();
  }

  isEmpty() {
    return this.seats.every((p) => p === null || !p.connected);
  }

  addLog(text) {
    this.log.push(text);
    if (this.log.length > 50) this.log.shift();
  }

  // ---------- Vòng chơi ----------

  isHandRunning() {
    return ['preflop', 'flop', 'turn', 'river'].includes(this.stage);
  }

  eligiblePlayers() {
    return this.seats
      .map((p, i) => (p && p.chips > 0 && !p.leaveAfterHand ? i : -1))
      .filter((i) => i >= 0);
  }

  canStart() {
    return !this.isHandRunning() && this.eligiblePlayers().length >= 2;
  }

  maybeAutoStart() {
    // Sau ván đầu tiên, tự chia ván mới khi đủ người
    if (this.handNo > 0 && this.stage === 'waiting' && this.canStart() && !this.nextHandTimer) {
      this.scheduleNextHand();
    }
  }

  // Vị trí tiếp theo (theo chiều kim đồng hồ) thỏa điều kiện
  nextSeat(from, pred) {
    for (let k = 1; k <= MAX_SEATS; k++) {
      const i = (from + k) % MAX_SEATS;
      if (this.seats[i] && pred(this.seats[i], i)) return i;
    }
    return -1;
  }

  startHand() {
    clearTimeout(this.nextHandTimer);
    this.nextHandTimer = null;
    if (!this.canStart()) {
      this.stage = 'waiting';
      this.onChange();
      return false;
    }

    this.handNo++;
    this.results = null;
    this.board = [];
    this.deck = newDeck();
    this.currentBet = 0;
    this.minRaise = BIG_BLIND;

    for (const p of this.seats) {
      if (!p) continue;
      p.cards = [];
      p.bet = 0;
      p.totalBet = 0;
      p.allIn = false;
      p.acted = false;
      p.inHand = p.chips > 0 && !p.leaveAfterHand;
      p.folded = !p.inHand;
    }

    const inHand = (p) => p.inHand;
    this.dealer = this.nextSeat(this.dealer < 0 ? MAX_SEATS - 1 : this.dealer, inHand);
    const headsUp = this.seats.filter((p) => p && p.inHand).length === 2;
    // Đối đầu 2 người: nhà cái là người đặt small blind
    const sb = headsUp ? this.dealer : this.nextSeat(this.dealer, inHand);
    const bb = this.nextSeat(sb, inHand);

    for (let r = 0; r < 2; r++) {
      let i = sb;
      do {
        if (this.seats[i] && this.seats[i].inHand) this.seats[i].cards.push(this.deck.pop());
        i = (i + 1) % MAX_SEATS;
      } while (i !== sb);
    }

    this.stage = 'preflop';
    this.addLog(`--- Ván #${this.handNo} ---`);
    this.postBlind(sb, SMALL_BLIND, 'small blind');
    this.postBlind(bb, BIG_BLIND, 'big blind');
    this.currentBet = BIG_BLIND;

    this.toAct = this.nextSeat(bb, (p) => p.inHand && !p.folded && !p.allIn);
    this.checkHandProgress();
    return true;
  }

  postBlind(i, amount, label) {
    const p = this.seats[i];
    const paid = Math.min(amount, p.chips);
    p.chips -= paid;
    p.bet += paid;
    p.totalBet += paid;
    if (p.chips === 0) p.allIn = true;
    this.addLog(`${p.name} đặt ${label} ${paid}.`);
  }

  activePlayers() {
    return this.seats.filter((p) => p && p.inHand && !p.folded);
  }

  pot() {
    return this.seats.reduce((s, p) => s + (p ? p.totalBet : 0), 0);
  }

  // Hành động của người chơi: fold / check / call / raise (amount = tổng cược vòng này) / allin
  act(id, action) {
    const i = this.seatOf(id);
    if (i < 0 || i !== this.toAct || !this.isHandRunning()) return 'Chưa tới lượt bạn.';
    const p = this.seats[i];
    const toCall = this.currentBet - p.bet;

    switch (action.type) {
      case 'fold':
        p.folded = true;
        this.addLog(`${p.name} bỏ bài.`);
        break;
      case 'check':
        if (toCall > 0) return 'Không thể check, phải theo hoặc bỏ.';
        this.addLog(`${p.name} check.`);
        break;
      case 'call': {
        if (toCall <= 0) return this.act(id, { type: 'check' });
        const paid = Math.min(toCall, p.chips);
        this.putChips(p, paid);
        this.addLog(`${p.name} theo ${paid}${p.allIn ? ' (all-in)' : ''}.`);
        break;
      }
      case 'raise':
      case 'allin': {
        const maxTotal = p.bet + p.chips;
        let target = action.type === 'allin' ? maxTotal : Math.floor(Number(action.amount));
        if (!Number.isFinite(target)) return 'Số tiền không hợp lệ.';
        target = Math.min(target, maxTotal);
        if (target <= this.currentBet) {
          // All-in không đủ để theo -> coi như theo
          if (target === maxTotal) return this.act(id, { type: 'call' });
          return 'Mức tố phải lớn hơn cược hiện tại.';
        }
        const raiseSize = target - this.currentBet;
        if (raiseSize < this.minRaise && target < maxTotal) {
          return `Tố tối thiểu tới ${this.currentBet + this.minRaise}.`;
        }
        this.putChips(p, target - p.bet);
        if (raiseSize >= this.minRaise) {
          this.minRaise = raiseSize;
          // Tố hợp lệ: mọi người khác phải hành động lại
          for (const q of this.seats) if (q && q !== p) q.acted = false;
        }
        this.currentBet = target;
        this.addLog(
          p.allIn ? `${p.name} ALL-IN ${target}!` : `${p.name} tố lên ${target}.`
        );
        break;
      }
      default:
        return 'Hành động không hợp lệ.';
    }
    p.acted = true;
    this.toAct = this.nextSeat(
      i,
      (q) => q.inHand && !q.folded && !q.allIn && (!q.acted || q.bet < this.currentBet)
    );
    this.checkHandProgress();
    return null;
  }

  putChips(p, amount) {
    p.chips -= amount;
    p.bet += amount;
    p.totalBet += amount;
    if (p.chips === 0) p.allIn = true;
  }

  // Kiểm tra vòng cược đã xong chưa, sang street mới / showdown
  checkHandProgress() {
    clearTimeout(this.turnTimer);
    const active = this.activePlayers();

    if (active.length === 1) {
      this.finishHand([active[0]]);
      return;
    }

    const canAct = active.filter((p) => !p.allIn);
    const roundDone = canAct.every((p) => p.acted && p.bet === this.currentBet);
    // Chỉ còn ≤1 người có thể hành động và đã theo đủ -> lật hết bài
    const nobodyToBet =
      canAct.length === 0 || (canAct.length === 1 && canAct[0].bet >= this.currentBet);

    if (roundDone || nobodyToBet) {
      if (nobodyToBet) {
        while (this.board.length < 5) this.dealStreet();
        this.showdown();
        return;
      }
      if (this.stage === 'river') {
        this.showdown();
        return;
      }
      this.dealStreet();
      this.checkHandProgress();
      return;
    }

    this.startTurnTimer();
    this.onChange();
  }

  dealStreet() {
    for (const p of this.seats) {
      if (!p) continue;
      p.bet = 0;
      p.acted = false;
    }
    this.currentBet = 0;
    this.minRaise = BIG_BLIND;
    this.deck.pop(); // đốt 1 lá
    if (this.board.length === 0) {
      this.board.push(this.deck.pop(), this.deck.pop(), this.deck.pop());
      this.stage = 'flop';
    } else if (this.board.length === 3) {
      this.board.push(this.deck.pop());
      this.stage = 'turn';
    } else {
      this.board.push(this.deck.pop());
      this.stage = 'river';
    }
    // Sau flop: người đầu tiên bên trái nhà cái hành động trước
    this.toAct = this.nextSeat(this.dealer, (q) => q.inHand && !q.folded && !q.allIn);
  }

  startTurnTimer() {
    clearTimeout(this.turnTimer);
    if (this.toAct < 0) return;
    const p = this.seats[this.toAct];
    // Người mất kết nối: chờ ngắn hơn
    const secs = p && p.connected ? TURN_SECONDS : 5;
    this.turnDeadline = Date.now() + secs * 1000;
    this.turnTimer = setTimeout(() => {
      const cur = this.seats[this.toAct];
      if (!cur) return;
      const toCall = this.currentBet - cur.bet;
      this.act(cur.id, { type: toCall > 0 ? 'fold' : 'check' });
    }, secs * 1000);
  }

  showdown() {
    const active = this.activePlayers();
    for (const p of active) p.hand = bestHand([...p.cards, ...this.board]);
    this.finishHand(active, true);
  }

  // Chia pot (kể cả side pot) cho người thắng
  finishHand(active, isShowdown = false) {
    clearTimeout(this.turnTimer);
    this.toAct = -1;
    const players = this.seats.filter((p) => p && p.inHand);
    const winnings = new Map();

    if (!isShowdown) {
      const winner = active[0];
      winnings.set(winner, this.pot());
    } else {
      // Các mức đóng góp tạo thành main pot + side pot
      const levels = [...new Set(players.map((p) => p.totalBet).filter((x) => x > 0))].sort(
        (a, b) => a - b
      );
      let prev = 0;
      for (const level of levels) {
        const contributors = players.filter((p) => p.totalBet >= level);
        // Mỗi người (kể cả đã bỏ bài) góp phần nằm giữa prev và level
        const amount = players.reduce(
          (sum, p) => sum + Math.min(p.totalBet, level) - Math.min(p.totalBet, prev),
          0
        );
        prev = level;
        const eligible = contributors.filter((p) => !p.folded);
        if (amount <= 0) continue;
        if (eligible.length === 0) {
          // Không ai đủ điều kiện (hiếm) -> trả lại người đóng góp lớn nhất còn trong bài
          const fallback = active[0];
          winnings.set(fallback, (winnings.get(fallback) || 0) + amount);
          continue;
        }
        let best = [];
        for (const p of eligible) {
          if (!best.length) best = [p];
          else {
            const c = compareScores(p.hand.score, best[0].hand.score);
            if (c > 0) best = [p];
            else if (c === 0) best.push(p);
          }
        }
        const share = Math.floor(amount / best.length);
        let remainder = amount - share * best.length;
        // Chip lẻ cho người gần bên trái nhà cái nhất
        const order = (p) => (this.seats.indexOf(p) - this.dealer - 1 + MAX_SEATS) % MAX_SEATS;
        best.sort((a, b) => order(a) - order(b));
        for (const w of best) {
          let win = share;
          if (remainder > 0) {
            win++;
            remainder--;
          }
          winnings.set(w, (winnings.get(w) || 0) + win);
        }
      }
    }

    const summary = [];
    for (const [p, amount] of winnings) {
      p.chips += amount;
      const handName = p.hand ? ` với ${p.hand.name}` : '';
      this.addLog(`🏆 ${p.name} thắng ${amount}${handName}.`);
      summary.push({ seat: this.seats.indexOf(p), name: p.name, amount, hand: p.hand ? p.hand.name : null, cards: p.hand ? p.hand.cards : null });
    }

    // Ai hết tiền phải ngồi ngoài 3 phút
    for (const p of this.seats) {
      if (p && p.inHand && p.chips === 0 && !p.rebuyAt) {
        p.rebuyAt = Date.now() + BUST_WAIT_MS;
        this.addLog(`💸 ${p.name} hết tiền, phải chờ 3 phút mới được chơi tiếp.`);
      }
    }

    this.results = {
      winners: summary,
      showdown: isShowdown,
      revealed: isShowdown
        ? active.map((p) => ({ seat: this.seats.indexOf(p), cards: p.cards, hand: p.hand.name }))
        : [],
    };
    this.stage = 'showdown';
    for (const p of this.seats) {
      if (!p) continue;
      p.bet = 0;
      delete p.hand;
    }

    // Dọn người đã rời bàn
    for (let i = 0; i < MAX_SEATS; i++) {
      const p = this.seats[i];
      if (p && p.leaveAfterHand) {
        this.addLog(`${p.name} đã rời bàn.`);
        this.seats[i] = null;
      }
    }

    this.onChange();
    this.scheduleNextHand();
  }

  scheduleNextHand() {
    clearTimeout(this.nextHandTimer);
    this.nextHandTimer = setTimeout(() => {
      this.nextHandTimer = null;
      for (const p of this.seats) if (p) p.inHand = false;
      if (!this.startHand()) {
        this.stage = 'waiting';
        this.onChange();
      }
    }, NEXT_HAND_DELAY);
  }

  // ---------- Trạng thái gửi cho từng người (giấu bài người khác) ----------

  stateFor(id) {
    const me = this.seatOf(id);
    const revealed = new Map();
    if (this.results) for (const r of this.results.revealed) revealed.set(r.seat, r);

    return {
      code: this.code,
      stage: this.stage,
      handNo: this.handNo,
      board: this.board,
      pot: this.pot(),
      currentBet: this.currentBet,
      minRaise: this.minRaise,
      dealer: this.dealer,
      toAct: this.toAct,
      turnDeadline: this.turnDeadline,
      bigBlind: BIG_BLIND,
      mySeat: me,
      canStart: this.canStart() && this.handNo === 0,
      results: this.results,
      log: this.log.slice(-30),
      seats: this.seats.map((p, i) => {
        if (!p) return null;
        let cards = null;
        if (i === me) cards = p.cards;
        else if (revealed.has(i)) cards = revealed.get(i).cards;
        else if (p.inHand && p.cards.length) cards = p.cards.map(() => '??');
        return {
          name: p.name,
          chips: p.chips,
          bet: p.bet,
          totalBet: p.totalBet,
          folded: p.folded,
          allIn: p.allIn,
          inHand: p.inHand,
          connected: p.connected,
          rebuyAt: p.rebuyAt || 0,
          cards,
          handName: revealed.has(i) ? revealed.get(i).hand : null,
        };
      }),
    };
  }
}

module.exports = { Table, MAX_SEATS };

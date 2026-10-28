// Logic một bàn Xì dách (luật Việt Nam), tối đa 6 người.
// Người chơi thay phiên làm cái mỗi ván; chỉ còn 1 người thì máy làm cái.
const crypto = require('crypto');

const MAX_SEATS = 6;
const START_CHIPS = 1000;
const MIN_BET = 10;
const MAX_BET = 500;
const BET_SECONDS = 15;
const TURN_SECONDS = 20;
const DEALER_SECONDS = 30;
const PLAYER_MIN = 16; // người chơi dưới 16 điểm là "non", bắt buộc rút thêm
const DEALER_MIN = 15; // nhà cái phải đủ 15 điểm mới được lật bài
const BOT_STAND = 17; // máy làm cái rút tới khi đủ 17 điểm
const BOT_DRAW_DELAY = 900;
const NEXT_HAND_DELAY = 7000;
const BUST_WAIT_MS = 3 * 60 * 1000; // hết tiền phải chờ 3 phút mới được mua lại

const PAYOUT = { xiban: 3, xidach: 2, ngulinh: 2, normal: 1, bust: 1 };
const KIND_NAME = { xiban: 'Xì bàn', xidach: 'Xì dách', ngulinh: 'Ngũ linh', bust: 'Quắc' };
const KIND_RANK = { bust: 0, normal: 1, ngulinh: 2, xidach: 3, xiban: 4 };

function newDeck() {
  const deck = [];
  for (const s of 'shdc') for (const r of '23456789TJQKA') deck.push(r + s);
  for (let i = deck.length - 1; i > 0; i--) {
    const j = crypto.randomInt(i + 1);
    [deck[i], deck[j]] = [deck[j], deck[i]];
  }
  return deck;
}

// Tính điểm theo luật Việt: 2 lá thì A = 10 hoặc 11, 3 lá thì A = 1 hoặc 10, từ 4 lá A = 1
function points(cards) {
  let base = 0;
  let aces = 0;
  for (const c of cards) {
    if (c[0] === 'A') aces++;
    else base += 'TJQK'.includes(c[0]) ? 10 : Number(c[0]);
  }
  const opts = cards.length <= 2 ? [10, 11] : cards.length === 3 ? [1, 10] : [1];
  let totals = [base];
  for (let k = 0; k < aces; k++) totals = totals.flatMap((t) => opts.map((o) => t + o));
  const ok = totals.filter((t) => t <= 21);
  return ok.length ? Math.max(...ok) : Math.min(...totals);
}

function evalHand(cards) {
  const pts = points(cards);
  let kind = 'normal';
  if (cards.length === 2 && cards[0][0] === 'A' && cards[1][0] === 'A') kind = 'xiban';
  else if (cards.length === 2 && cards.some((c) => c[0] === 'A') && cards.some((c) => 'TJQK'.includes(c[0]))) kind = 'xidach';
  else if (pts > 21) kind = 'bust';
  else if (cards.length === 5) kind = 'ngulinh';
  return { kind, points: pts, name: KIND_NAME[kind] || `${pts} điểm` };
}

function isSpecial(h) {
  return h.kind === 'xiban' || h.kind === 'xidach';
}

// So bài người chơi với nhà cái: 1 thắng, 0 hòa, -1 thua
function compare(p, d) {
  if (p.kind === 'bust' && d.kind === 'bust') return 0; // cùng quắc thì hòa
  if (KIND_RANK[p.kind] !== KIND_RANK[d.kind]) return KIND_RANK[p.kind] > KIND_RANK[d.kind] ? 1 : -1;
  if (p.kind === 'normal') return Math.sign(p.points - d.points);
  if (p.kind === 'ngulinh') return Math.sign(d.points - p.points); // ngũ linh ít điểm hơn thì thắng
  return 0;
}

class XiDachTable {
  constructor(code, onChange) {
    this.game = 'xidach';
    this.code = code;
    this.onChange = onChange;
    this.seats = new Array(MAX_SEATS).fill(null);
    this.stage = 'waiting'; // waiting | betting | playing | dealer | result
    this.deck = [];
    this.dealerSeat = -1; // -1: máy làm cái
    this.lastDealer = -1;
    this.dealerCards = [];
    this.dealerShown = false; // nhà cái đã lật bài cho cả bàn xem chưa
    this.order = []; // thứ tự lượt người chơi
    this.toAct = -1;
    this.deadline = 0;
    this.timer = null;
    this.log = [];
    this.handNo = 0;
  }

  // ---------- Quản lý người chơi ----------

  addPlayer(id, name) {
    const existing = this.seatOf(id);
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
      bet: 0,
      lastBet: 50,
      cards: [],
      inHand: false,
      done: false,
      settled: false,
      hand: null,
      result: null,
      connected: true,
      leaveAfterHand: false,
      rebuyAt: 0,
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

  isRunning() {
    return this.stage === 'playing' || this.stage === 'dealer';
  }

  removePlayer(id) {
    const i = this.seatOf(id);
    if (i < 0) return;
    const p = this.seats[i];
    if (i === this.dealerSeat && (this.isRunning() || this.stage === 'betting')) {
      // Nhà cái bỏ đi giữa ván: trả lại tiền cược chưa tính cho mọi người
      this.addLog(`Nhà cái ${p.name} rời bàn, ván này hủy, trả lại tiền cược.`);
      for (const q of this.seats) {
        if (q && q.inHand && !q.settled) {
          q.chips += q.bet;
          q.bet = 0;
          q.inHand = false;
        }
      }
      this.seats[i] = null;
      this.dealerSeat = -1;
      this.endHand();
      return;
    }
    if (p.inHand && !p.settled && this.isRunning()) {
      // Đang có tiền cược trên bàn: dằn bài rồi rời sau ván
      p.leaveAfterHand = true;
      if (this.toAct === i) this.act(id, { type: 'stand', force: true });
      return;
    }
    if (p.inHand && this.stage === 'betting') {
      p.chips += p.bet;
      p.bet = 0;
    }
    this.addLog(`${p.name} đã rời bàn.`);
    this.seats[i] = null;
    if (this.stage === 'betting') this.checkBets();
  }

  rebuy(id) {
    const i = this.seatOf(id);
    if (i < 0) return;
    const p = this.seats[i];
    if (p.chips > 0 || p.bet > 0) return;
    if (p.rebuyAt && Date.now() < p.rebuyAt) {
      const secs = Math.ceil((p.rebuyAt - Date.now()) / 1000);
      return `Bạn phải chờ thêm ${secs} giây nữa mới được mua lại chip.`;
    }
    p.chips = START_CHIPS;
    p.rebuyAt = 0;
    this.addLog(`${p.name} mua thêm ${START_CHIPS} chip.`);
  }

  addLog(text) {
    this.log.push(text);
    if (this.log.length > 50) this.log.shift();
  }

  stop() {
    clearTimeout(this.timer);
  }

  setTimer(ms, fn) {
    clearTimeout(this.timer);
    this.deadline = Date.now() + ms;
    this.timer = setTimeout(fn, ms);
  }

  dealer() {
    return this.dealerSeat >= 0 ? this.seats[this.dealerSeat] : null;
  }

  dealerName() {
    const d = this.dealer();
    return d ? d.name : 'Nhà cái (máy)';
  }

  // ---------- Vòng chơi ----------

  canStart() {
    return this.stage === 'waiting' && this.seats.some((p) => p && p.chips > 0);
  }

  maybeAutoStart() {}

  manualStart() {
    if (this.canStart()) this.startHand();
  }

  // Chọn nhà cái: lần lượt theo vòng ghế, chỉ còn 1 người có chip thì máy làm cái
  pickDealer() {
    const ready = (p) => p && p.chips > 0 && p.connected;
    if (this.seats.filter(ready).length < 2) return -1;
    for (let k = 1; k <= MAX_SEATS; k++) {
      const i = (this.lastDealer + k + MAX_SEATS) % MAX_SEATS;
      if (ready(this.seats[i])) return i;
    }
    return -1;
  }

  // Bắt đầu ván: chọn nhà cái, nhà con đặt cược
  startHand() {
    if (!this.seats.some((p) => p && p.chips > 0 && p.connected)) {
      this.stage = 'waiting';
      this.onChange();
      return false;
    }
    this.handNo++;
    this.stage = 'betting';
    this.dealerCards = [];
    this.dealerShown = false;
    this.toAct = -1;
    for (const p of this.seats) {
      if (!p) continue;
      p.cards = [];
      p.bet = 0;
      p.hand = null;
      p.result = null;
      p.done = false;
      p.settled = false;
      p.inHand = false;
    }
    this.dealerSeat = this.pickDealer();
    if (this.dealerSeat >= 0) this.lastDealer = this.dealerSeat;
    this.addLog(`--- Ván #${this.handNo}: ${this.dealerName()} làm cái ---`);
    this.setTimer(BET_SECONDS * 1000, () => this.deal());
    this.onChange();
    return true;
  }

  placeBet(i, amount) {
    const p = this.seats[i];
    if (this.stage !== 'betting') return 'Chưa tới lúc đặt cược.';
    if (i === this.dealerSeat) return 'Nhà cái không đặt cược.';
    if (p.inHand) return 'Bạn đã đặt cược rồi.';
    amount = Math.floor(Number(amount));
    if (!Number.isFinite(amount) || amount < MIN_BET) return `Cược tối thiểu ${MIN_BET}.`;
    amount = Math.min(amount, MAX_BET, p.chips);
    p.chips -= amount;
    p.bet = amount;
    p.lastBet = amount;
    p.inHand = true;
    this.addLog(`${p.name} cược ${amount}.`);
    this.checkBets();
    return null;
  }

  // Mọi nhà con có chip đã cược xong thì chia bài luôn
  checkBets() {
    const waiting = this.seats.some(
      (p, i) => p && i !== this.dealerSeat && p.chips > 0 && !p.inHand && p.connected
    );
    if (!waiting && this.seats.some((p) => p && p.inHand)) this.deal();
  }

  // Tính tiền một nhà con với bài hiện tại của nhà cái
  settlePlayer(i) {
    const p = this.seats[i];
    if (!p || !p.inHand || p.settled) return;
    const d = evalHand(this.dealerCards);
    const dealer = this.dealer();
    const r = compare(p.hand, d);
    let delta = 0;
    if (r > 0) {
      delta = p.bet * PAYOUT[p.hand.kind];
      if (dealer) delta = Math.min(delta, dealer.chips); // nhà cái chỉ đền được số chip đang có
    } else if (r < 0) {
      // Thua xì bàn / xì dách / ngũ linh của nhà cái thì đền theo tỉ lệ, tối đa số chip có
      delta = -Math.min(p.bet * (PAYOUT[d.kind] || 1), p.bet + p.chips);
    }
    p.chips += p.bet + delta;
    if (dealer) dealer.chips -= delta;
    p.result = { outcome: r, delta };
    p.settled = true;
    p.done = true;
    const label = p.hand.kind === 'normal' ? `${p.hand.points} điểm` : p.hand.name;
    if (r > 0) this.addLog(`🏆 ${p.name} thắng ${delta} (${label}).`);
    else if (r < 0) this.addLog(`${p.name} thua ${-delta} (${label}).`);
    else this.addLog(`${p.name} hòa (${label}).`);
    p.bet = 0;
  }

  deal() {
    clearTimeout(this.timer);
    const players = this.seats.filter((p) => p && p.inHand);
    if (!players.length) {
      this.addLog('Không ai đặt cược. Bấm Bắt đầu để chơi tiếp.');
      this.stage = 'waiting';
      this.onChange();
      return;
    }
    this.deck = newDeck();
    // Thứ tự: bắt đầu từ người ngồi sau nhà cái
    this.order = [];
    for (let k = 1; k <= MAX_SEATS; k++) {
      const i = (this.dealerSeat + k + MAX_SEATS) % MAX_SEATS;
      if (this.seats[i] && this.seats[i].inHand) this.order.push(i);
    }
    for (let r = 0; r < 2; r++) {
      for (const i of this.order) this.seats[i].cards.push(this.deck.pop());
      this.dealerCards.push(this.deck.pop());
    }
    this.stage = 'playing';
    for (const i of this.order) this.seats[i].hand = evalHand(this.seats[i].cards);

    const d = evalHand(this.dealerCards);
    if (isSpecial(d)) {
      // Nhà cái có xì bàn / xì dách: lật bài và tính tiền cả bàn ngay
      this.addLog(`Nhà cái có ${d.name}!`);
      this.finish();
      return;
    }
    for (const i of this.order) {
      const p = this.seats[i];
      if (isSpecial(p.hand)) {
        // Nhà con có xì bàn / xì dách: lật luôn, ăn ngay
        this.addLog(`🎉 ${p.name} có ${p.hand.name}!`);
        this.settlePlayer(i);
      }
    }
    this.toAct = -1;
    this.nextTurn();
  }

  nextTurn() {
    const pos = this.order.indexOf(this.toAct);
    const next = this.order.slice(pos + 1).find((i) => !this.seats[i].done);
    if (next === undefined) {
      this.toAct = -1;
      this.dealerTurn();
      return;
    }
    this.toAct = next;
    const p = this.seats[next];
    const secs = p.connected ? TURN_SECONDS : 3;
    this.setTimer(secs * 1000, () => this.autoPlay(next));
    this.onChange();
  }

  // Hết giờ: non thì tự rút, đủ tuổi thì tự dằn
  autoPlay(i) {
    const p = this.seats[i];
    if (!p || this.toAct !== i) return;
    if (p.hand.points < PLAYER_MIN) {
      this.act(p.id, { type: 'hit' });
      if (this.toAct === i) this.autoPlay(i);
    } else {
      this.act(p.id, { type: 'stand' });
    }
  }

  unsettled() {
    return this.order.filter((i) => this.seats[i] && !this.seats[i].settled);
  }

  // Tới lượt nhà cái
  dealerTurn() {
    if (!this.unsettled().length) {
      this.finish();
      return;
    }
    this.stage = 'dealer';
    if (this.dealerSeat < 0) {
      // Máy làm cái: rút tới khi đủ 17 điểm hoặc đủ 5 lá
      const step = () => {
        const d = evalHand(this.dealerCards);
        if (d.kind === 'normal' && d.points < BOT_STAND) {
          this.dealerCards.push(this.deck.pop());
          this.onChange();
          this.setTimer(BOT_DRAW_DELAY, step);
        } else {
          this.finish();
        }
      };
      this.dealerShown = true;
      this.onChange();
      this.setTimer(BOT_DRAW_DELAY, step);
      return;
    }
    this.startDealerTimer();
    this.onChange();
  }

  startDealerTimer() {
    const d = this.dealer();
    const secs = d && d.connected ? DEALER_SECONDS : 3;
    this.setTimer(secs * 1000, () => this.autoDealer());
  }

  // Nhà cái hết giờ: non thì tự rút, đủ tuổi thì lật hết
  autoDealer() {
    if (this.stage !== 'dealer' || this.dealerSeat < 0) return;
    const h = evalHand(this.dealerCards);
    if (h.kind === 'normal' && h.points < DEALER_MIN) {
      this.dealerAct({ type: 'hit' });
      if (this.stage === 'dealer') this.autoDealer();
    } else {
      this.dealerAct({ type: 'revealAll' });
    }
  }

  // Nhà cái: hit (rút), reveal (lật một nhà, seat), revealAll (lật hết)
  dealerAct(action) {
    const h = evalHand(this.dealerCards);
    if (action.type === 'hit') {
      if (h.kind !== 'normal') return 'Không rút thêm được nữa.';
      this.dealerCards.push(this.deck.pop());
      this.addLog(`Nhà cái rút thêm lá thứ ${this.dealerCards.length}.`);
      const nh = evalHand(this.dealerCards);
      // Quắc hoặc đủ 5 lá thì phải lật hết
      if (nh.kind !== 'normal') {
        this.finish();
        return null;
      }
      this.startDealerTimer();
      this.onChange();
      return null;
    }
    if (action.type === 'reveal' || action.type === 'revealAll') {
      if (h.kind === 'normal' && h.points < DEALER_MIN) {
        return `Nhà cái dưới ${DEALER_MIN} điểm là non, phải rút thêm.`;
      }
      if (action.type === 'revealAll') {
        this.finish();
        return null;
      }
      const seat = Number(action.seat);
      if (!this.unsettled().includes(seat)) return 'Nhà này đã lật rồi.';
      this.dealerShown = true;
      this.addLog(`Nhà cái lật bài với ${this.seats[seat].name} (${h.name}).`);
      this.settlePlayer(seat);
      if (!this.unsettled().length) this.finish();
      else {
        this.startDealerTimer();
        this.onChange();
      }
      return null;
    }
    return 'Hành động không hợp lệ.';
  }

  // Hành động: bet (amount) / hit (rút) / stand (dằn); nhà cái: hit / reveal / revealAll
  act(id, action) {
    const i = this.seatOf(id);
    if (i < 0) return 'Bạn chưa ngồi vào bàn.';
    const p = this.seats[i];
    if (action.type === 'bet') return this.placeBet(i, action.amount);
    if (this.stage === 'dealer' && i === this.dealerSeat) return this.dealerAct(action);
    if (this.stage !== 'playing' || this.toAct !== i) return 'Chưa tới lượt bạn.';

    if (action.type === 'hit') {
      if (p.cards.length >= 5) return 'Đã đủ 5 lá.';
      p.cards.push(this.deck.pop());
      p.hand = evalHand(p.cards);
      this.addLog(`${p.name} rút thêm lá thứ ${p.cards.length}.`);
      // Quắc, đủ 21 hoặc đủ 5 lá thì tự dằn (quắc vẫn giấu bài tới lúc lật)
      if (p.hand.kind !== 'normal' || p.hand.points === 21) {
        p.done = true;
        this.nextTurn();
      } else {
        this.setTimer((p.connected ? TURN_SECONDS : 3) * 1000, () => this.autoPlay(i));
        this.onChange();
      }
      return null;
    }
    if (action.type === 'stand') {
      if (p.hand.points < PLAYER_MIN && !action.force) return `Dưới ${PLAYER_MIN} điểm là non, phải rút thêm.`;
      p.done = true;
      this.addLog(`${p.name} dằn bài.`);
      this.nextTurn();
      return null;
    }
    return 'Hành động không hợp lệ.';
  }

  // Lật bài nhà cái và tính tiền mọi nhà còn lại
  finish() {
    clearTimeout(this.timer);
    this.toAct = -1;
    this.dealerShown = true;
    const d = evalHand(this.dealerCards);
    this.addLog(`Nhà cái: ${d.name}${d.kind === 'bust' ? ` (${d.points})` : ''}.`);
    for (const i of this.order) this.settlePlayer(i);
    this.endHand();
  }

  endHand() {
    clearTimeout(this.timer);
    this.toAct = -1;
    for (const p of this.seats) {
      if (p && p.chips === 0 && p.bet === 0 && !p.rebuyAt && (p.inHand || this.seats.indexOf(p) === this.dealerSeat)) {
        p.rebuyAt = Date.now() + BUST_WAIT_MS;
        this.addLog(`💸 ${p.name} hết tiền, phải chờ 3 phút mới được chơi tiếp.`);
      }
    }
    this.stage = 'result';
    for (let i = 0; i < MAX_SEATS; i++) {
      const p = this.seats[i];
      if (p && p.leaveAfterHand) {
        this.addLog(`${p.name} đã rời bàn.`);
        this.seats[i] = null;
        if (i === this.dealerSeat) this.dealerSeat = -1;
      }
    }
    this.onChange();
    this.setTimer(NEXT_HAND_DELAY, () => this.startHand());
  }

  // ---------- Trạng thái gửi cho từng người (giấu bài người khác) ----------

  stateFor(id) {
    const me = this.seatOf(id);
    const iAmDealer = me >= 0 && me === this.dealerSeat;
    const dealerOpen = this.dealerShown || iAmDealer;
    const dealerCards = dealerOpen
      ? this.dealerCards
      : this.dealerCards.map((c, k) => (k === 0 && this.dealerSeat < 0 ? c : '??'));
    return {
      game: 'xidach',
      code: this.code,
      stage: this.stage,
      handNo: this.handNo,
      toAct: this.toAct,
      deadline: this.deadline,
      turnSeconds: this.stage === 'dealer' ? DEALER_SECONDS : TURN_SECONDS,
      minBet: MIN_BET,
      maxBet: MAX_BET,
      playerMin: PLAYER_MIN,
      dealerMin: DEALER_MIN,
      mySeat: me,
      canStart: this.canStart(),
      dealer: {
        seat: this.dealerSeat,
        name: this.dealerName(),
        cards: dealerCards,
        hand: dealerOpen && this.dealerCards.length ? evalHand(this.dealerCards) : null,
      },
      log: this.log.slice(-30),
      seats: this.seats.map((p, i) => {
        if (!p) return null;
        const visible = i === me || p.settled || this.stage === 'result';
        return {
          name: p.name,
          chips: p.chips,
          bet: p.bet,
          lastBet: p.lastBet,
          inHand: p.inHand,
          done: p.done,
          settled: p.settled,
          isDealer: i === this.dealerSeat,
          connected: p.connected,
          rebuyAt: p.rebuyAt || 0,
          cards: visible ? p.cards : p.cards.map(() => '??'),
          hand: visible ? p.hand : null,
          result: p.result,
        };
      }),
    };
  }
}

module.exports = { XiDachTable, evalHand, compare, points, MAX_SEATS };

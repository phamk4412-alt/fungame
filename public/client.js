// Giao diện người chơi: kết nối WebSocket và vẽ bàn
const $ = (id) => document.getElementById(id);

// Mỗi trình duyệt có 1 id riêng để tải lại trang vẫn giữ được ghế
let playerId = localStorage.getItem('poker.playerId');
if (!playerId) {
  playerId = (crypto.randomUUID && crypto.randomUUID()) || String(Math.random()).slice(2);
  localStorage.setItem('poker.playerId', playerId);
}

const params = new URLSearchParams(location.search);
$('roomInput').value = params.get('room') || '';
$('nameInput').value = localStorage.getItem('poker.name') || '';

// Game chọn khi tạo phòng mới (vào phòng có sẵn thì theo game của phòng)
let chosenGame = localStorage.getItem('fungame.game') || 'poker';
function pickGame(game) {
  chosenGame = game;
  localStorage.setItem('fungame.game', game);
  for (const b of document.querySelectorAll('.pick')) b.classList.toggle('active', b.dataset.game === game);
}
pickGame(chosenGame);
for (const b of document.querySelectorAll('.pick')) b.onclick = () => pickGame(b.dataset.game);

const GAME_NAMES = { poker: '♠ Poker', xidach: '🃏 Xì dách' };

let ws = null;
let state = null;
let roomCode = null;
let name = '';

// Vị trí 6 ghế quanh bàn (%), vị trí 0 luôn là bạn (giữa dưới)
const SEAT_POS = [
  [50, 104], [3, 78], [3, 22], [50, -4], [97, 22], [97, 78],
];
const BET_POS = [
  [50, 72], [22, 68], [22, 32], [50, 28], [78, 32], [78, 68],
];

function join() {
  name = $('nameInput').value.trim() || 'Khách';
  localStorage.setItem('poker.name', name);
  connect($('roomInput').value.trim());
}

function connect(room) {
  const proto = location.protocol === 'https:' ? 'wss' : 'ws';
  ws = new WebSocket(`${proto}://${location.host}`);
  ws.onopen = () => ws.send(JSON.stringify({ type: 'join', room, name, playerId, game: chosenGame }));
  ws.onmessage = (e) => {
    const msg = JSON.parse(e.data);
    if (msg.type === 'state') {
      state = msg.state;
      if (roomCode !== state.code) {
        roomCode = state.code;
        history.replaceState(null, '', `?room=${roomCode}`);
      }
      $('lobby').classList.add('hidden');
      $('game').classList.remove('hidden');
      render(msg.chat);
    } else if (msg.type === 'error') {
      toast(msg.message);
    }
  };
  ws.onclose = () => {
    // Tự kết nối lại khi rớt mạng
    if (roomCode) setTimeout(() => connect(roomCode), 1500);
  };
}

function send(msg) {
  if (ws && ws.readyState === WebSocket.OPEN) ws.send(JSON.stringify(msg));
}

function toast(text) {
  const t = $('toast');
  t.textContent = text;
  t.classList.remove('hidden');
  clearTimeout(toast.timer);
  toast.timer = setTimeout(() => t.classList.add('hidden'), 2500);
}

// ---------- Vẽ ----------

const SUITS = { s: '♠', h: '♥', d: '♦', c: '♣' };
function cardEl(code, small, highlight) {
  const el = document.createElement('div');
  el.className = 'card' + (small ? ' small' : '');
  if (code === '??') {
    el.classList.add('back');
    return el;
  }
  const rank = code[0] === 'T' ? '10' : code[0];
  const suit = code[1];
  if (suit === 'h' || suit === 'd') el.classList.add('red');
  if (highlight) el.classList.add('win');
  el.innerHTML = `<span>${rank}</span><span class="suit">${SUITS[suit]}</span>`;
  return el;
}

function fmt(n) {
  return n.toLocaleString('vi-VN');
}

function escapeHtml(s) {
  return s.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
}

function render(chat) {
  const s = state;
  $('roomCode').textContent = s.code;
  $('gameName').textContent = GAME_NAMES[s.game] || '';
  document.title = `${GAME_NAMES[s.game] || 'Fungame'} · phòng ${s.code}`;
  if (s.game === 'xidach') {
    renderXd(chat);
    return;
  }
  for (const id of ['xdBetBox', 'xdPlayBox', 'xdDealerBox', 'xdClaimBtn']) $(id).classList.add('hidden');
  $('pot').textContent = s.pot > 0 ? `Pot: ${fmt(s.pot)}` : '';

  // Lá bài thắng được viền vàng
  const winCards = new Set();
  if (s.results) for (const w of s.results.winners) for (const c of w.cards || []) winCards.add(c);

  const board = $('board');
  board.innerHTML = '';
  for (const c of s.board) board.appendChild(cardEl(c, false, winCards.has(c)));

  // Dòng trạng thái
  const seated = s.seats.filter(Boolean).length;
  let status = '';
  if (s.stage === 'waiting') {
    status = seated < 2 ? 'Đang chờ thêm người chơi... Gửi link mời cho bạn bè nhé!' : 'Đủ người rồi, bấm Bắt đầu!';
    if (s.handNo > 0 && seated >= 2) status = 'Đang chờ người chơi có chip...';
  } else if (s.stage === 'showdown' && s.results) {
    status = s.results.winners
      .map((w) => `${escapeHtml(w.name)} thắng ${fmt(w.amount)}${w.hand ? ` (${w.hand})` : ''}`)
      .join(' · ') + ' — ván mới sắp bắt đầu';
  } else if (s.toAct >= 0 && s.seats[s.toAct]) {
    status = s.toAct === s.mySeat ? '👉 Tới lượt bạn!' : `Đang chờ ${escapeHtml(s.seats[s.toAct].name)}...`;
  }
  $('status').innerHTML = status;
  $('startBtn').classList.toggle('hidden', !(s.canStart && s.stage === 'waiting'));

  renderSeats();
  renderActions();
  renderLog(chat);
}

function renderSeats() {
  const s = state;
  const box = $('seats');
  box.innerHTML = '';
  const offset = s.mySeat >= 0 ? s.mySeat : 0;
  const winners = new Set((s.results ? s.results.winners : []).map((w) => w.seat));

  for (let i = 0; i < 6; i++) {
    const pos = (i - offset + 6) % 6;
    const p = s.seats[i];
    const el = document.createElement('div');
    el.className = 'seat';
    el.style.left = SEAT_POS[pos][0] + '%';
    el.style.top = SEAT_POS[pos][1] + '%';

    if (!p) {
      el.classList.add('empty');
      el.innerHTML = '<div class="cards"></div><div class="info">Ghế trống</div>';
      box.appendChild(el);
      continue;
    }

    if (i === s.mySeat) el.classList.add('me');
    if (i === s.toAct) el.classList.add('turn');
    if (p.inHand && p.folded && s.stage !== 'waiting') el.classList.add('folded');
    if (!p.connected) el.classList.add('offline');
    if (s.stage === 'showdown' && winners.has(i)) el.classList.add('winner');

    const cards = document.createElement('div');
    cards.className = 'cards';
    if (p.cards && !(p.folded && i !== s.mySeat)) {
      for (const c of p.cards) cards.appendChild(cardEl(c, true));
    }
    el.appendChild(cards);

    const info = document.createElement('div');
    info.className = 'info';
    let tag = '';
    if (p.allIn) tag = 'ALL-IN';
    else if (p.handName) tag = p.handName;
    else if (p.inHand && p.folded) tag = 'Bỏ bài';
    else if (p.chips === 0) tag = 'Hết tiền';
    else if (!p.inHand && s.stage !== 'waiting') tag = 'Chờ ván sau';
    info.innerHTML =
      `<div class="name">${escapeHtml(p.name)}${i === s.mySeat ? ' (bạn)' : ''}</div>` +
      `<div class="chips">💰 ${fmt(p.chips)}</div>` +
      (tag ? `<div class="tag">${tag}</div>` : '');
    if (i === s.dealer && s.stage !== 'waiting') info.innerHTML += '<div class="dealer-btn">D</div>';
    if (i === s.toAct) {
      const left = Math.max(0, s.turnDeadline - Date.now());
      info.innerHTML += `<div class="timer" style="width:${Math.min(100, left / 300)}%"></div>`;
    }
    el.appendChild(info);
    box.appendChild(el);

    if (p.bet > 0) {
      const bet = document.createElement('div');
      bet.className = 'bet';
      bet.style.left = BET_POS[pos][0] + '%';
      bet.style.top = BET_POS[pos][1] + '%';
      bet.textContent = `🪙 ${fmt(p.bet)}`;
      box.appendChild(bet);
    }
  }
}

function renderActions() {
  const s = state;
  const me = s.seats[s.mySeat];
  const myTurn = me && s.toAct === s.mySeat;
  $('actions').classList.toggle('hidden', !myTurn);
  $('rebuyBox').classList.toggle('hidden', !(me && me.chips === 0 && !(me.inHand && s.stage !== 'showdown' && s.stage !== 'waiting')));
  renderRebuy();
  if (!myTurn) return;

  const toCall = s.currentBet - me.bet;
  const maxTotal = me.bet + me.chips;
  $('callBtn').textContent = toCall > 0 ? `Theo ${fmt(Math.min(toCall, me.chips))}` : 'Check';
  $('callBtn').dataset.type = toCall > 0 ? 'call' : 'check';

  const minTotal = Math.min(maxTotal, s.currentBet === 0 ? s.bigBlind : s.currentBet + s.minRaise);
  const canRaise = maxTotal > s.currentBet && me.chips > toCall;
  $('raiseBtn').textContent = s.currentBet === 0 ? 'Cược' : 'Tố lên';
  for (const id of ['raiseRange', 'raiseInput', 'raiseBtn']) $(id).disabled = !canRaise;
  $('allinBtn').disabled = me.chips === 0;
  const range = $('raiseRange');
  range.min = minTotal;
  range.max = maxTotal;
  range.step = s.bigBlind / 2;
  if (!range.dataset.hand || range.dataset.hand !== `${s.handNo}-${s.stage}-${s.currentBet}`) {
    range.dataset.hand = `${s.handNo}-${s.stage}-${s.currentBet}`;
    range.value = minTotal;
    $('raiseInput').value = minTotal;
  }
}

function renderLog(chat) {
  const log = $('log');
  const atBottom = log.scrollHeight - log.scrollTop - log.clientHeight < 30;
  log.innerHTML = state.log
    .map((l) => {
      const cls = l.startsWith('---') ? 'hand' : l.startsWith('🏆') ? 'win' : '';
      return `<div class="log-line ${cls}">${escapeHtml(l)}</div>`;
    })
    .join('');
  if (atBottom) log.scrollTop = log.scrollHeight;

  const msgs = $('chatMsgs');
  const chatBottom = msgs.scrollHeight - msgs.scrollTop - msgs.clientHeight < 30;
  msgs.innerHTML = (chat || [])
    .map((m) => `<div><b>${escapeHtml(m.name)}:</b> ${escapeHtml(m.text)}</div>`)
    .join('');
  if (chatBottom) msgs.scrollTop = msgs.scrollHeight;
}

// Hết tiền phải chờ 3 phút mới được mua lại
function renderRebuy() {
  const me = state && state.seats[state.mySeat];
  if (!me || me.chips > 0) return;
  const left = Math.max(0, Math.ceil((me.rebuyAt - Date.now()) / 1000));
  $('rebuyBtn').disabled = left > 0;
  $('rebuyMsg').textContent = left > 0
    ? `Bạn đã hết chip. Chờ ${Math.floor(left / 60)}:${String(left % 60).padStart(2, '0')} nữa mới được chơi tiếp.`
    : 'Bạn đã hết chip.';
}

// ---------- Xì dách ----------

function handLabel(h) {
  if (!h) return '';
  return h.kind === 'normal' ? `${h.points} điểm` : h.kind === 'bust' ? `Quắc (${h.points})` : h.name;
}

function secondsLeft() {
  return Math.max(0, Math.ceil((state.deadline - Date.now()) / 1000));
}

function xdStatus() {
  const s = state;
  const me = s.seats[s.mySeat];
  if (s.stage === 'waiting') {
    return s.handNo === 0
      ? 'Ai muốn làm cái thì bấm 🎩 Xin làm cái, không thì thay phiên nhau. Chơi một mình thì máy làm cái.'
      : 'Bấm Bắt đầu để chơi ván mới.';
  }
  const iAmDealer = me && me.isDealer;
  if (s.stage === 'betting') {
    if (iAmDealer) return `🎩 Ván này bạn làm cái. Chờ nhà con đặt cược... (${secondsLeft()}s)`;
    return me && me.inHand
      ? `Đã cược, chờ mọi người... (${secondsLeft()}s)`
      : `Đặt cược đi nào! Còn ${secondsLeft()} giây`;
  }
  if (s.stage === 'playing' && s.toAct >= 0) {
    if (iAmDealer) return `🎩 Bạn làm cái. Chờ ${escapeHtml(s.seats[s.toAct].name)} rút bài xong là tới lượt bạn lật bài...`;
    return s.toAct === s.mySeat ? '👉 Tới lượt bạn!' : `Đang chờ ${escapeHtml(s.seats[s.toAct].name)}...`;
  }
  if (s.stage === 'dealer') {
    if (iAmDealer) {
      const h = s.dealer.hand;
      if (h && h.kind === 'normal' && h.points < s.dealerMin) {
        return `👉 Bạn mới có ${h.points} điểm, phải rút đủ ${s.dealerMin} điểm mới được lật bài (${secondsLeft()}s)`;
      }
      return `👉 Tới lượt bạn làm cái: bấm vào nhà nào để lật bài nhà đó, rút thêm, hoặc lật hết (${secondsLeft()}s)`;
    }
    return `Đang chờ nhà cái ${escapeHtml(s.dealer.name)}...`;
  }
  if (s.stage === 'result') {
    const r = me && me.result;
    let text = '';
    if (iAmDealer) {
      const net = s.seats.reduce((sum, p) => sum - (p && p.result ? p.result.delta : 0), 0);
      text = net > 0 ? `🎉 Làm cái lời ${fmt(net)}!` : net < 0 ? `Làm cái lỗ ${fmt(-net)}.` : 'Làm cái hòa vốn.';
    }
    if (r) text = r.outcome > 0 ? `🎉 Bạn thắng ${fmt(r.delta)}!` : r.outcome < 0 ? `Bạn thua ${fmt(-r.delta)}.` : 'Hòa.';
    return `${text} Ván mới sắp bắt đầu...`;
  }
  return '';
}

function renderXd(chat) {
  const s = state;
  const d = s.dealer;
  $('pot').textContent = `🎩 ${d.seat >= 0 && d.seat === s.mySeat ? 'Bạn làm cái' : d.name}${d.hand ? ' · ' + handLabel(d.hand) : ''}`;
  if (s.stage === 'waiting' && !d.cards.length) $('pot').textContent = '';
  const board = $('board');
  board.innerHTML = '';
  for (const c of d.cards) board.appendChild(cardEl(c));
  $('status').innerHTML = xdStatus();
  $('startBtn').classList.toggle('hidden', !s.canStart);
  $('actions').classList.add('hidden');
  renderXdSeats();
  renderXdActions();
  renderLog(chat);
}

function renderXdSeats() {
  const s = state;
  const box = $('seats');
  box.innerHTML = '';
  const offset = s.mySeat >= 0 ? s.mySeat : 0;
  for (let i = 0; i < 6; i++) {
    const pos = (i - offset + 6) % 6;
    const p = s.seats[i];
    const el = document.createElement('div');
    el.className = 'seat';
    el.style.left = SEAT_POS[pos][0] + '%';
    el.style.top = SEAT_POS[pos][1] + '%';
    if (!p) {
      el.classList.add('empty');
      el.innerHTML = '<div class="cards"></div><div class="info">Ghế trống</div>';
      box.appendChild(el);
      continue;
    }
    if (i === s.mySeat) el.classList.add('me');
    const dealerTurn = p.isDealer && s.stage === 'dealer';
    // Nhà cái bấm vào ghế để lật bài nhà đó
    const me = s.seats[s.mySeat];
    if (me && me.isDealer && s.stage === 'dealer' && p.inHand && !p.settled) {
      el.classList.add('revealable');
      el.title = 'Bấm để lật bài nhà này';
      el.onclick = () => send({ type: 'action', action: { type: 'reveal', seat: i } });
    }
    if (i === s.toAct || dealerTurn) el.classList.add('turn');
    if (!p.connected) el.classList.add('offline');
    if (p.result && p.result.outcome > 0) el.classList.add('winner');
    if (p.result && p.result.outcome < 0) el.classList.add('folded');

    const cards = document.createElement('div');
    cards.className = 'cards' + (p.cards.length > 3 ? ' many' : '');
    for (const c of p.cards) cards.appendChild(cardEl(c, true));
    el.appendChild(cards);

    let tag = '';
    if (p.isDealer && s.stage !== 'waiting') tag = '🎩 Nhà cái';
    else if (p.result) {
      const r = p.result;
      tag = `${handLabel(p.hand)} · ${r.outcome > 0 ? '+' + fmt(r.delta) : r.outcome < 0 ? '-' + fmt(-r.delta) : 'Hòa'}`;
    } else if (p.hand) tag = handLabel(p.hand);
    else if (p.done) tag = 'Đã dằn';
    else if (p.chips === 0 && !p.inHand) tag = 'Hết tiền';
    else if (s.stage === 'betting' && !p.inHand) tag = 'Đang chọn cược...';
    else if ((s.stage === 'playing' || s.stage === 'dealer') && !p.inHand) tag = 'Chờ ván sau';
    const info = document.createElement('div');
    info.className = 'info';
    info.innerHTML =
      `<div class="name">${escapeHtml(p.name)}${i === s.mySeat ? ' (bạn)' : ''}</div>` +
      `<div class="chips">💰 ${fmt(p.chips)}</div>` +
      (tag ? `<div class="tag">${tag}</div>` : '');
    if (p.isDealer && s.stage !== 'waiting') info.innerHTML += '<div class="dealer-btn">C</div>';
    if (i === s.toAct || dealerTurn) {
      const left = Math.max(0, s.deadline - Date.now());
      info.innerHTML += `<div class="timer" style="width:${Math.min(100, left / (s.turnSeconds * 10))}%"></div>`;
    }
    el.appendChild(info);
    box.appendChild(el);

    if (p.bet > 0) {
      const bet = document.createElement('div');
      bet.className = 'bet';
      bet.style.left = BET_POS[pos][0] + '%';
      bet.style.top = BET_POS[pos][1] + '%';
      bet.textContent = `🪙 ${fmt(p.bet)}`;
      box.appendChild(bet);
    }
  }
}

function renderXdActions() {
  const s = state;
  const me = s.seats[s.mySeat];
  const canBet = me && !me.isDealer && s.stage === 'betting' && !me.inHand && me.chips > 0;
  $('xdBetBox').classList.toggle('hidden', !canBet);
  if (canBet && $('xdBetInput').dataset.hand !== String(s.handNo)) {
    $('xdBetInput').dataset.hand = String(s.handNo);
    $('xdBetInput').value = Math.min(me.lastBet, me.chips, s.maxBet);
  }
  const myTurn = me && s.stage === 'playing' && s.toAct === s.mySeat;
  $('xdPlayBox').classList.toggle('hidden', !myTurn);
  if (myTurn && me.hand) {
    const non = me.hand.points < s.playerMin;
    $('xdPoints').textContent = `Bạn có ${me.hand.points} điểm${non ? ' (non, phải rút)' : ''}`;
    $('xdStandBtn').disabled = non;
    $('xdHitBtn').disabled = me.cards.length >= 5;
  }
  // Nhà cái: rút thêm, lật từng nhà hoặc lật hết
  const dealing = me && me.isDealer && s.stage === 'dealer';
  $('xdDealerBox').classList.toggle('hidden', !dealing);
  if (dealing && s.dealer.hand) {
    const h = s.dealer.hand;
    const non = h.kind === 'normal' && h.points < s.dealerMin;
    $('xdDealerPoints').textContent = `Bạn có ${h.points} điểm${non ? ` (dưới ${s.dealerMin} phải rút)` : ''}`;
    $('xdDealerHit').disabled = h.kind !== 'normal';
    $('xdRevealAll').disabled = non;
    const list = $('xdRevealList');
    list.innerHTML = '';
    s.seats.forEach((p, i) => {
      if (!p || !p.inHand || p.settled) return;
      const b = document.createElement('button');
      b.className = 'btn small';
      b.textContent = `Lật ${p.name} (${p.cards.length} lá)`;
      b.disabled = non;
      b.onclick = () => send({ type: 'action', action: { type: 'reveal', seat: i } });
      list.appendChild(b);
    });
  }
  // Nút xin làm cái / thôi làm cái
  const claim = $('xdClaimBtn');
  claim.classList.toggle('hidden', !me);
  if (me) {
    const holder = s.wantDealer >= 0 ? s.seats[s.wantDealer] : null;
    claim.disabled = !!holder && s.wantDealer !== s.mySeat;
    claim.dataset.on = s.wantDealer === s.mySeat ? '' : '1';
    claim.textContent = s.wantDealer === s.mySeat
      ? 'Thôi làm cái'
      : holder ? `🎩 ${holder.name} đang giữ cái` : '🎩 Xin làm cái';
  }
  $('rebuyBox').classList.toggle('hidden', !(me && me.chips === 0 && me.bet === 0));
  renderRebuy();
}

$('xdClaimBtn').onclick = (e) => send({ type: 'action', action: { type: 'claimDealer', on: !!e.currentTarget.dataset.on } });

for (const b of document.querySelectorAll('.chip')) {
  b.onclick = () => {
    const add = Number(b.dataset.add);
    const input = $('xdBetInput');
    input.value = add ? Math.min((Number(input.value) || 0) + add, state.maxBet) : 0;
  };
}
$('xdBetBtn').onclick = () => send({ type: 'action', action: { type: 'bet', amount: Number($('xdBetInput').value) } });
$('xdHitBtn').onclick = () => send({ type: 'action', action: { type: 'hit' } });
$('xdStandBtn').onclick = () => send({ type: 'action', action: { type: 'stand' } });
$('xdDealerHit').onclick = () => send({ type: 'action', action: { type: 'hit' } });
$('xdRevealAll').onclick = () => send({ type: 'action', action: { type: 'revealAll' } });

// Cập nhật thanh đếm giờ mỗi giây
setInterval(() => {
  if (!state) return;
  if (state.game === 'xidach') {
    if (state.toAct >= 0 || state.stage === 'dealer') renderXdSeats();
    if (state.stage === 'betting' || state.stage === 'dealer') $('status').innerHTML = xdStatus();
  } else if (state.toAct >= 0) renderSeats();
  renderRebuy();
}, 1000);

// ---------- Sự kiện ----------

$('joinBtn').onclick = join;
// Không trả về false trong onkeydown, nếu không trình duyệt sẽ chặn gõ phím
for (const id of ['nameInput', 'roomInput']) {
  $(id).addEventListener('keydown', (e) => {
    if (e.key === 'Enter') join();
  });
}
$('startBtn').onclick = () => send({ type: 'start' });
$('foldBtn').onclick = () => send({ type: 'action', action: { type: 'fold' } });
$('callBtn').onclick = (e) => send({ type: 'action', action: { type: e.target.dataset.type } });
$('raiseBtn').onclick = () => send({ type: 'action', action: { type: 'raise', amount: Number($('raiseInput').value) } });
$('allinBtn').onclick = () => send({ type: 'action', action: { type: 'allin' } });
$('raiseRange').oninput = (e) => ($('raiseInput').value = e.target.value);
$('raiseInput').oninput = (e) => ($('raiseRange').value = e.target.value);
$('rebuyBtn').onclick = () => send({ type: 'rebuy' });
$('leaveBtn').onclick = () => {
  send({ type: 'leave' });
  roomCode = null;
  ws.close();
  location.href = location.pathname;
};
$('copyBtn').onclick = async () => {
  const link = `${location.origin}${location.pathname}?room=${roomCode}`;
  try {
    await navigator.clipboard.writeText(link);
    toast('Đã sao chép link mời: ' + link);
  } catch {
    prompt('Gửi link này cho bạn bè:', link);
  }
};
$('chatForm').onsubmit = (e) => {
  e.preventDefault();
  const text = $('chatInput').value.trim();
  if (text) send({ type: 'chat', text });
  $('chatInput').value = '';
};
for (const tab of document.querySelectorAll('.tab')) {
  tab.onclick = () => {
    document.querySelectorAll('.tab').forEach((t) => t.classList.toggle('active', t === tab));
    $('log').classList.toggle('hidden', tab.dataset.tab !== 'log');
    $('chat').classList.toggle('hidden', tab.dataset.tab !== 'chat');
  };
}

// Mở bằng link mời mà đã có tên -> vào thẳng bàn
if (params.get('room') && $('nameInput').value) join();

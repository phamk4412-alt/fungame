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
  ws.onopen = () => ws.send(JSON.stringify({ type: 'join', room, name, playerId }));
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

// Cập nhật thanh đếm giờ mỗi giây
setInterval(() => {
  if (state && state.toAct >= 0) renderSeats();
}, 1000);

// ---------- Sự kiện ----------

$('joinBtn').onclick = join;
$('nameInput').onkeydown = $('roomInput').onkeydown = (e) => e.key === 'Enter' && join();
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

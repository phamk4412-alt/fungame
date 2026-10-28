// Kiểm thử nhanh: đánh giá tay bài + mô phỏng nhiều ván ngẫu nhiên, kiểm tra tổng chip không đổi
const assert = require('assert');
const { bestHand, compareScores } = require('./handeval');
const { Table } = require('./game');

const h = (s) => bestHand(s.split(' '));
assert.strictEqual(h('As Ks Qs Js Ts 2d 3c').name, 'Thùng phá sảnh');
assert.strictEqual(h('Ah 2d 3c 4s 5h 9d Kc').name, 'Sảnh');
assert.strictEqual(h('Ah Ad Ac Kd Ks 2c 3d').name, 'Cù lũ');
assert.strictEqual(h('2h 2d 3c 3s 9h 9d Kc').name, 'Thú (hai đôi)');
assert.ok(compareScores(h('Ah Kd 3c 3s 9h 8d 2c').score, h('Qh Jd 3h 3d 9c 8s 2d').score) > 0);
assert.ok(compareScores(h('6h 2d 3c 4s 5h 9d Kc').score, h('Ah 2d 3c 4s 5h 9d Kc').score) > 0);
console.log('✓ Đánh giá tay bài đúng');

// Mô phỏng
const table = new Table('TEST', () => {});
const ids = ['a', 'b', 'c', 'd', 'e', 'f'];
ids.forEach((id) => table.addPlayer(id, id.toUpperCase()));

let hands = 0;
for (let n = 0; n < 2000; n++) {
  for (const p of table.seats) if (p && p.chips === 0) p.chips = 1000; // rebuy
  const before = table.seats.reduce((s, p) => s + p.chips, 0);
  table.startHand();
  clearTimeout(table.nextHandTimer);
  let guard = 0;
  while (table.isHandRunning()) {
    assert.ok(guard++ < 200, 'Ván không kết thúc');
    const p = table.seats[table.toAct];
    assert.ok(p && !p.folded && !p.allIn, 'toAct không hợp lệ');
    const toCall = table.currentBet - p.bet;
    const r = Math.random();
    let action;
    if (r < 0.15) action = { type: 'fold' };
    else if (r < 0.55) action = { type: toCall > 0 ? 'call' : 'check' };
    else if (r < 0.9) action = { type: 'raise', amount: table.currentBet + table.minRaise + Math.floor(Math.random() * 100) };
    else action = { type: 'allin' };
    const err = table.act(p.id, action);
    if (err) assert.strictEqual(table.act(p.id, { type: toCall > 0 ? 'call' : 'check' }), null);
  }
  clearTimeout(table.turnTimer);
  clearTimeout(table.nextHandTimer);
  const after = table.seats.reduce((s, p) => s + p.chips, 0);
  assert.strictEqual(after, before, `Chip bị lệch ở ván ${n}: ${before} -> ${after}`);
  hands++;
}
console.log(`✓ Mô phỏng ${hands} ván, tổng chip luôn được bảo toàn`);

// ---------- Xì dách ----------
const { XiDachTable, evalHand, compare } = require('./xidach');
const e = (s) => evalHand(s.split(' '));
assert.strictEqual(e('Ah Ad').kind, 'xiban');
assert.strictEqual(e('As Kd').kind, 'xidach');
assert.strictEqual(e('Ts Ad').kind, 'xidach');
assert.strictEqual(e('Ah 9d').points, 20); // 2 lá: A = 11
assert.strictEqual(e('Ah 5d').points, 16); // 2 lá: A = 11
assert.strictEqual(e('Ah 5d 5c').points, 20); // 3 lá: A = 10
assert.strictEqual(e('Ah 5d 9c').points, 15); // 3 lá: A = 1
assert.strictEqual(e('Ah Ad 5c 9c').points, 16); // 4 lá: A = 1
assert.strictEqual(e('2h 3d 4c 5s 6h').kind, 'ngulinh');
assert.strictEqual(e('Kh Qd 5c').kind, 'bust');
assert.strictEqual(compare(e('Kh Qd 5c'), e('Kh Qd 9c')), 0); // cùng quắc thì hòa
assert.strictEqual(compare(e('Kh Qd 5c'), e('Kh 8d')), -1);
assert.strictEqual(compare(e('Kh 8d'), e('Kh Qd 9c')), 1);
assert.strictEqual(compare(e('2h 3d 4c 5s 6h'), e('As Kd')), -1);
assert.strictEqual(compare(e('2h 3d 4c 5s 6h'), e('Kh Qd Ac')), 1);
assert.strictEqual(compare(e('2h 3d 4c 5s 2c'), e('2h 3d 4c 5s 6h')), 1); // ngũ linh ít điểm thắng
assert.strictEqual(compare(e('Kh 9d'), e('Kh 9c')), 0);
console.log('✓ Tính điểm Xì dách đúng');

// Mô phỏng nhiều ván Xì dách bằng cách gọi thẳng các bước, bỏ qua hẹn giờ
function fakeTimers(t) {
  const real = t.setTimer.bind(t);
  t.setTimer = (ms, fn) => {
    real(ms, () => {});
    t.pending = fn;
  };
}

function playHand(t, skipOne) {
  t.startHand();
  assert.strictEqual(t.stage, 'betting');
  const players = t.seats.map((p, i) => i).filter((i) => t.seats[i] && i !== t.dealerSeat);
  const skip = skipOne ? players[Math.floor(Math.random() * players.length)] : -1;
  for (const i of players) {
    if (i === skip || t.seats[i].chips === 0) continue;
    assert.strictEqual(t.act(t.seats[i].id, { type: 'bet', amount: 10 + Math.floor(Math.random() * 300) }), null);
  }
  if (t.dealerSeat >= 0) assert.ok(t.act(t.seats[t.dealerSeat].id, { type: 'bet', amount: 50 }), 'Nhà cái không được cược');
  if (t.stage === 'betting') t.pending(); // hết giờ cược -> chia bài
  let guard = 0;
  while (t.stage === 'playing') {
    assert.ok(guard++ < 100, 'Ván Xì dách không kết thúc');
    const p = t.seats[t.toAct];
    assert.ok(p && p.inHand && !p.done);
    if (p.hand.points < 16) assert.ok(t.act(p.id, { type: 'stand' }), 'Non mà vẫn dằn được');
    t.act(p.id, { type: Math.random() < 0.5 || p.hand.points < 16 ? 'hit' : 'stand' });
  }
  while (t.stage === 'dealer') {
    assert.ok(guard++ < 200, 'Nhà cái không kết thúc');
    if (t.dealerSeat < 0) {
      t.pending();
      continue;
    }
    const id = t.seats[t.dealerSeat].id;
    const h = evalHand(t.dealerCards);
    const left = t.seats.map((q, i) => i).filter((i) => t.seats[i] && t.seats[i].inHand && !t.seats[i].settled);
    if (h.points < 15) {
      assert.ok(t.act(id, { type: 'reveal', seat: left[0] }), 'Nhà cái non mà vẫn lật được');
      assert.strictEqual(t.act(id, { type: 'hit' }), null);
      continue;
    }
    const r = Math.random();
    if (r < 0.4) assert.strictEqual(t.act(id, { type: 'reveal', seat: left[0] }), null);
    else if (r < 0.7 && h.points < 19) assert.strictEqual(t.act(id, { type: 'hit' }), null);
    else assert.strictEqual(t.act(id, { type: 'revealAll' }), null);
  }
  assert.strictEqual(t.stage, 'result');
}

const xd = new XiDachTable('XD', () => {});
['a', 'b', 'c', 'd', 'e', 'f'].forEach((id) => xd.addPlayer(id, id.toUpperCase()));
fakeTimers(xd);
const dealers = new Set();
let rounds = 0;
for (let n = 0; n < 2000; n++) {
  for (const p of xd.seats) if (p.chips === 0) p.chips = 1000;
  const before = xd.seats.reduce((sum, p) => sum + p.chips, 0);
  playHand(xd, true);
  dealers.add(xd.dealerSeat);
  assert.ok(xd.dealerSeat >= 0, 'Đông người mà máy vẫn làm cái');
  for (const p of xd.seats) {
    assert.ok(p.cards.length <= 5 && p.chips >= 0);
    if (p.inHand) assert.ok(p.settled, 'Có nhà chưa được tính tiền');
  }
  const after = xd.seats.reduce((sum, p) => sum + p.chips, 0);
  assert.strictEqual(after, before, `Chip bị lệch ở ván Xì dách ${n}: ${before} -> ${after}`);
  rounds++;
}
assert.strictEqual(dealers.size, 6, 'Không thay phiên làm cái đủ 6 người');
xd.stop();
console.log(`✓ Mô phỏng ${rounds} ván Xì dách thay phiên làm cái, tổng chip luôn được bảo toàn`);

// Xin làm cái: người xin giữ cái mỗi ván, thôi thì quay lại thay phiên
const claim = new XiDachTable('CLAIM', () => {});
['a', 'b', 'c'].forEach((id) => claim.addPlayer(id, id.toUpperCase()));
fakeTimers(claim);
assert.strictEqual(claim.act('c', { type: 'claimDealer', on: true }), null);
assert.ok(claim.act('b', { type: 'claimDealer', on: true }), 'Hai người cùng giữ cái được');
for (let n = 0; n < 20; n++) {
  for (const p of claim.seats) if (p && p.chips === 0) p.chips = 1000;
  playHand(claim, false);
  if (claim.seats[2].chips > 0 || claim.dealerSeat === 2) assert.strictEqual(claim.dealerSeat, 2, 'Người xin làm cái không được làm cái');
}
assert.strictEqual(claim.act('c', { type: 'claimDealer', on: false }), null);
claim.seats[2].chips = Math.max(claim.seats[2].chips, 100);
const seen = new Set();
for (let n = 0; n < 6; n++) {
  for (const p of claim.seats) if (p && p.chips === 0) p.chips = 1000;
  playHand(claim, false);
  seen.add(claim.dealerSeat);
}
assert.strictEqual(seen.size, 3, 'Thôi làm cái mà không thay phiên lại');
claim.stop();
console.log('✓ Xin làm cái / thôi làm cái đúng');

// Chơi một mình: máy làm cái, rút tới 17
const solo = new XiDachTable('SOLO', () => {});
solo.addPlayer('x', 'X');
fakeTimers(solo);
for (let n = 0; n < 500; n++) {
  if (solo.seats[0].chips === 0) solo.seats[0].chips = 1000;
  const before = solo.seats[0].chips;
  playHand(solo, false);
  assert.strictEqual(solo.dealerSeat, -1);
  const d = evalHand(solo.dealerCards);
  assert.ok(d.kind !== 'normal' || d.points >= 17 || solo.dealerCards.length === 2);
  assert.strictEqual(solo.seats[0].chips - before, solo.seats[0].result.delta);
}
solo.stop();
console.log('✓ Chơi một mình với máy làm cái đúng luật');
process.exit(0);

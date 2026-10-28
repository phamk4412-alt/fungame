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
const xd = new XiDachTable('XD', () => {});
['a', 'b', 'c', 'd', 'e', 'f'].forEach((id) => xd.addPlayer(id, id.toUpperCase()));
const realSetTimer = xd.setTimer.bind(xd);
let pending = null;
xd.setTimer = (ms, fn) => {
  realSetTimer(ms, () => {});
  pending = fn;
};
let rounds = 0;
for (let n = 0; n < 2000; n++) {
  for (const p of xd.seats) if (p.chips === 0) p.chips = 1000;
  xd.startHand();
  assert.strictEqual(xd.stage, 'betting');
  const before = new Map(xd.seats.map((p) => [p, p.chips]));
  // Một người không cược để kiểm tra ngồi ngoài
  for (const p of xd.seats.slice(0, 5)) assert.strictEqual(xd.act(p.id, { type: 'bet', amount: 10 + Math.floor(Math.random() * 300) }), null);
  pending(); // hết giờ cược -> chia bài
  let guard = 0;
  while (xd.stage === 'playing') {
    assert.ok(guard++ < 100, 'Ván Xì dách không kết thúc');
    const p = xd.seats[xd.toAct];
    assert.ok(p && p.inHand && !p.done);
    if (p.hand.points < 16) assert.ok(xd.act(p.id, { type: 'stand' }), 'Non mà vẫn dằn được');
    const r = Math.random();
    xd.act(p.id, { type: r < 0.5 || p.hand.points < 16 ? 'hit' : 'stand' });
  }
  while (xd.stage === 'dealer') pending();
  assert.strictEqual(xd.stage, 'result');
  const d = evalHand(xd.dealerCards);
  assert.ok(d.kind !== 'normal' || d.points >= 17 || xd.dealerCards.length === 2);
  for (const p of xd.seats) {
    assert.ok(p.cards.length <= 5);
    if (!p.inHand) {
      assert.strictEqual(p.chips, before.get(p));
      continue;
    }
    assert.strictEqual(p.chips - before.get(p), p.result.delta);
  }
  rounds++;
}
xd.stop();
console.log(`✓ Mô phỏng ${rounds} ván Xì dách, tiền thắng thua luôn khớp`);
process.exit(0);

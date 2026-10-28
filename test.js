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
process.exit(0);

// Kiểm thử Lá Chắn Ngôn Từ: luật chơi thuần + tính hợp lệ của data.json
const assert = require('assert');
const fs = require('fs');
const path = require('path');
const R = require('../public/lachan/rules');

const dir = path.join(__dirname, '..', 'public', 'lachan');
const D = JSON.parse(fs.readFileSync(path.join(dir, 'data.json'), 'utf8'));
const C = D.settings;

// HP
assert.strictEqual(R.clampHp(-20), 0);
assert.strictEqual(R.clampHp(140), 100);
assert.strictEqual(R.hpLevel(C.lowHp, C.lowHp, C.midHp), 'danger');
assert.strictEqual(R.hpLevel(C.midHp, C.lowHp, C.midHp), 'warn');
assert.strictEqual(R.hpLevel(C.midHp + 1, C.lowHp, C.midHp), 'good');

// Màn 2 tăng tốc dần
const c2 = C.round2;
assert.strictEqual(R.spawnInterval(c2, 0), c2.spawnStart);
assert.strictEqual(R.spawnInterval(c2, 1), c2.spawnEnd);
assert.ok(R.spawnInterval(c2, 0.5) < c2.spawnStart && R.spawnInterval(c2, 0.5) > c2.spawnEnd);
assert.ok(R.riseDuration(c2, 1) < R.riseDuration(c2, 0));
assert.strictEqual(R.stormScore(c2, 1), c2.correctScore);
assert.strictEqual(R.stormScore(c2, 3), c2.correctScore + 2 * c2.comboBonus);
assert.strictEqual(R.stormScore(c2, 999), c2.correctScore + c2.comboCap * c2.comboBonus);

// Điểm Màn 1, Màn 3, kết cục
assert.strictEqual(R.classifyScore(C.round1, false, 10), 0);
assert.strictEqual(R.classifyScore(C.round1, true, 10.7), C.round1.correctScore + 10 * C.round1.speedBonusPerSecond);
assert.strictEqual(R.empathyScore(C.round3, -15), 0);
assert.strictEqual(R.empathyScore(C.round3, 30), 30 * C.round3.scorePerHp);
assert.strictEqual(R.outcome(0, C.winHp), 'fail');
assert.strictEqual(R.outcome(C.winHp, C.winHp), 'lose');
assert.strictEqual(R.outcome(C.winHp + 1, C.winHp), 'win');

// Ngẫu nhiên có hạt giống: lặp lại được, không trùng kỹ năng liền nhau
const a = R.stormOrder(D.round2.comments, R.rng(42)).map((x) => x.text);
const b = R.stormOrder(D.round2.comments, R.rng(42)).map((x) => x.text);
assert.deepStrictEqual(a, b);
const order = R.stormOrder(D.round2.comments, R.rng(7));
assert.strictEqual(order.length, D.round2.comments.length);
for (let i = 1; i < order.length; i++) assert.notStrictEqual(order[i].skill, order[i - 1].skill, 'hai bình luận liền nhau cùng kỹ năng');
console.log('✓ Lá Chắn Ngôn Từ: luật chơi đúng');

// Dữ liệu
assert.strictEqual(D.round1.items.length, 5, 'Màn 1 cần 5 bình luận');
D.round1.items.forEach((it) => {
  assert.ok(D.round1.choices[it.answer], 'đáp án Màn 1 không hợp lệ: ' + it.answer);
  assert.ok(it.text && it.explain && it.type);
});
assert.ok(D.round1.items.some((i) => i.answer === 'bully') && D.round1.items.some((i) => i.answer === 'constructive'));
const skills = D.round2.skills.map((s) => s.id);
assert.deepStrictEqual(skills.slice().sort(), ['block', 'evidence', 'help', 'lock']);
D.round2.comments.forEach((c) => assert.ok(skills.includes(c.skill), 'kỹ năng lạ: ' + c.skill));
skills.forEach((s) => assert.ok(D.round2.comments.filter((c) => c.skill === s).length >= 3, 'quá ít bình luận cho ' + s));
assert.strictEqual(D.round3.situations.length, 3);
D.round3.situations.forEach((s) => {
  assert.strictEqual(s.options.length, 3);
  const best = Math.max(...s.options.map((o) => o.hp));
  assert.ok(best > 0, 'mỗi tình huống cần một cách phản hồi tốt');
  assert.strictEqual(s.options.filter((o) => o.hp === best).length, 1, 'chỉ một phương án tốt nhất');
});
// Hồi sinh sau khi HP = 0 vẫn có thể thắng nếu chọn đúng hết Màn 3
const heal = D.round3.situations.reduce((s, x) => s + Math.max(...x.options.map((o) => o.hp)), 0);
assert.ok(C.failReviveHp + heal > C.winHp, 'không thể thắng sau khi hồi sinh');
['fail', 'win', 'lose'].forEach((k) => assert.ok(D.endings[k].title));

// data.js phải trùng data.json
const js = fs.readFileSync(path.join(dir, 'data.js'), 'utf8');
const copy = JSON.parse(js.slice(js.indexOf('=') + 1).trim().replace(/;$/, ''));
assert.deepStrictEqual(copy, D, 'data.js lệch data.json — chạy: node public/lachan/build-data.js');
console.log('✓ Lá Chắn Ngôn Từ: dữ liệu hợp lệ');

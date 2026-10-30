// Kiểm thử luật Câu cá 3D: node fish/test.js
const assert = require('assert');
const L = require('./logic');

// Giờ trong game: 24 phút thật là một ngày
assert.strictEqual(L.gameHour(0), 0);
assert.strictEqual(L.gameHour(6 * 60000), 6);
assert.strictEqual(L.phaseOf(5.5), 'dawn');
assert.strictEqual(L.phaseOf(12), 'day');
assert.strictEqual(L.phaseOf(18), 'dusk');
assert.strictEqual(L.phaseOf(23), 'night');
assert.strictEqual(L.phaseOf(2), 'night');
console.log('✓ Ngày đêm trong game chạy theo đồng hồ chung');

// Hồ nào cũng luôn có cá để câu vào mọi giờ
for (const lake of L.LAKE_ORDER) {
  for (const phase of Object.keys(L.PHASES)) assert.ok(L.available(lake, phase).length >= 2, `${lake} ${phase}`);
}
for (const [id, f] of Object.entries(L.FISH)) assert.ok(L.LAKES[f.lake] && f.w[0] < f.w[1], id);
console.log('✓ Mỗi hồ đều có cá vào mọi giờ');

// Cá chỉ ra đúng hồ, đúng giờ; mồi vàng ra nhiều cá huyền thoại hơn
const count = (bait) => {
  let legend = 0;
  for (let i = 0; i < 20000; i++) {
    const { id } = L.rollFish('sen', 'dawn', bait, 'tre');
    const f = L.FISH[id];
    assert.strictEqual(f.lake, 'sen');
    assert.ok(f.times.includes('dawn'));
    if (f.rarity === 3) legend++;
  }
  return legend;
};
const plain = count('giun');
const gold = count('moi_vang');
assert.ok(gold > plain * 3, `mồi vàng ${gold} so với giun ${plain}`);
for (let i = 0; i < 2000; i++) {
  const { id } = L.rollFish('sen', 'day', 'giun', 'tre');
  assert.notStrictEqual(id, 'chep_rong'); // Chép hóa rồng chỉ ra lúc bình minh
}
console.log('✓ Cá ra theo hồ, theo giờ và theo mồi');

// Quăng, chờ cá cắn, kéo lên, bán
const t0 = 1_000_000_000;
const p = L.newPlayer('a', 'A', t0);
assert.ok(L.startCast(p, 'vinh', 'giun', t0).error); // chưa mở hồ
assert.ok(L.startCast(p, 'sen', 'moi_vang', t0).error); // chưa có mồi
const { cast } = L.startCast(p, 'sen', 'tom', t0);
assert.strictEqual(p.baits.tom, 4);
assert.ok(L.land(p, cast.id, true, t0 + 100).error); // kéo lên trước khi cá cắn là gian lận
const { cast: c2 } = L.startCast(p, 'sen', 'giun', t0);
const res = L.land(p, c2.id, true, t0 + c2.biteIn + 3000);
assert.ok(res.fish && res.record && res.biggest);
assert.strictEqual(p.fish.length, 1);
assert.ok(L.land(p, c2.id, true, t0 + 99999).error); // không kéo hai lần
assert.strictEqual(L.scoreOf(p), res.fish.v); // điểm hạng cộng giá trị cá
const { cast: c3 } = L.startCast(p, 'sen', 'giun', t0);
assert.ok(L.land(p, c3.id, false, t0).lost);
const money = p.money;
const sold = L.sell(p, 'all');
assert.strictEqual(sold.total, res.fish.v);
assert.strictEqual(p.money, money + res.fish.v);
assert.strictEqual(p.fish.length, 0);
console.log('✓ Quăng, kéo, bán cá đúng luật');

// Mua sắm và thùng đá
p.money = 100000;
assert.strictEqual(L.buy(p, 'rod', 'titan'), null);
assert.strictEqual(p.rod, 'titan');
assert.strictEqual(L.buy(p, 'lake', 'bang'), null);
assert.strictEqual(p.lake, 'bang');
assert.strictEqual(L.buy(p, 'bait', 'moi_vang'), null);
assert.strictEqual(p.baits.moi_vang, 5);
assert.strictEqual(L.buy(p, 'cooler'), null);
assert.strictEqual(L.coolerSize(p), 25);
p.money = 0;
assert.ok(L.buy(p, 'rod', 'long'));
assert.strictEqual(L.buy(p, 'rod', 'long', true), null); // tài khoản vô hạn tiền
assert.strictEqual(p.rod, 'long');
assert.strictEqual(p.money, 0);
p.fish = Array.from({ length: 25 }, () => ({ s: 'ca_bang', w: 1, v: 10, at: t0 }));
assert.ok(L.startCast(p, 'bang', 'giun', t0).error); // thùng đầy
console.log('✓ Mua cần, mồi, hồ, thùng đá');

// Nhiệm vụ Lão Ngư và thủy quái
const q = L.newPlayer('q', 'Q', t0);
assert.ok(L.questItem(q, 0)); // chưa nhận nhiệm vụ
assert.strictEqual(L.acceptQuest(q, 'sen'), null);
for (let i = 0; i < L.QUEST.items; i++) assert.strictEqual(L.questItem(q, i), null);
assert.strictEqual(L.questItem(q, 0), null); // nhặt lại không tính hai lần
assert.ok(L.questItem(q, 99));
assert.strictEqual(q.quest.items.length, L.QUEST.items);
assert.ok(!L.questDone(q.quest));
for (let i = 0; i < L.QUEST.fish + 2; i++) {
  const { cast: qc } = L.startCast(q, 'sen', 'giun', t0);
  L.land(q, qc.id, true, t0 + qc.biteIn + 2000);
}
assert.strictEqual(q.quest.fish, L.QUEST.fish);
assert.ok(L.questDone(q.quest));
for (const lake of L.LAKE_ORDER) {
  for (const ph of Object.keys(L.PHASES)) assert.ok(L.available(lake, ph).every(([, f]) => !f.boss)); // thủy quái không cắn câu thường
}
const b = L.newBoss('sen', 'Q', t0);
assert.strictEqual(L.hitBoss(b, 'q', 1000, t0), false); // không ai hạ được trong một cú
assert.ok(b.hp > L.BOSS_HP - 2);
L.hitBoss(b, 'r', 1, t0 + 1000); // người thứ hai vào đánh, thủy quái trâu thêm
assert.strictEqual(b.max, L.BOSS_HP * 1.5);
let tt = t0;
let killed = false;
while (!killed && tt < t0 + L.BOSS_TTL_MS) {
  tt += 1000;
  killed = L.hitBoss(b, 'q', 1, tt) || L.hitBoss(b, 'r', 1, tt);
}
assert.ok(killed);
const mins = (tt - t0) / 60000;
assert.ok(mins > 2.5 && mins < 5, `hai người hạ thủy quái trong ${mins} phút`);
assert.deepStrictEqual(L.bossWinners(b).sort(), ['q', 'r']);
const before = q.fish.length;
const won = L.bossReward(q, b, tt);
assert.strictEqual(q.fish.length, before + 1);
assert.strictEqual(won.fish.s, 'quai_sen');
console.log('✓ Nhiệm vụ Lão Ngư và thủy quái');

// Kiểm thử luật Căn cứ tận thế: node raid/test.js
const assert = require('assert');
const L = require('./logic');

const H = 3600000;
const t0 = Date.UTC(2026, 9, 28, 3, 0); // thứ Tư 28/10/2026, 10:00 giờ Việt Nam

// Sản xuất khi offline, dừng ở sức chứa
const p = L.newPlayer('a', 'A', t0);
L.settle(p, t0 + 2 * H);
assert.strictEqual(Math.round(p.resources.scrap), 600 + 120);
assert.strictEqual(Math.round(p.resources.fuel), 400 + 80);
L.settle(p, t0 + 1000 * H);
for (const r of L.RESOURCES) assert.strictEqual(p.resources[r], L.capacity(p));
console.log('✓ Vật tư tự tăng khi offline và dừng ở sức chứa');

// Xây xong giữa chừng thì từ lúc đó sản xuất theo cấp mới
const q = L.newPlayer('b', 'B', t0);
assert.strictEqual(L.startUpgrade(q, 'scrap', t0), null);
const cost = L.upgradeCost('scrap', 1);
assert.strictEqual(q.resources.scrap, 600 - cost.scrap);
assert.ok(L.startUpgrade(q, 'fuel', t0)); // chỉ một thợ xây
const done = q.build.finishAt;
L.settle(q, done + H);
assert.strictEqual(q.buildings.scrap, 2);
const expect = 600 - cost.scrap + 60 * ((done - t0) / H) + 120;
assert.ok(Math.abs(q.resources.scrap - expect) < 1e-6);
q.resources = { scrap: 9999, fuel: 9999, food: 9999 };
assert.strictEqual(L.startUpgrade(q, 'scrap', done + H), 'Nâng Trụ sở trước để mở cấp cao hơn.');
assert.strictEqual(L.startUpgrade(q, 'wall', done + H), null);
console.log('✓ Nâng cấp theo thời gian thực, giới hạn bởi Trụ sở');

// Lịch cướp theo giờ Việt Nam
const sat18 = Date.UTC(2026, 9, 31, 11, 0); // thứ Bảy 18:00 VN
const sat19 = Date.UTC(2026, 9, 31, 12, 0); // thứ Bảy 19:00 VN
const sun2359 = Date.UTC(2026, 10, 1, 16, 59); // Chủ nhật 23:59 VN
const mon0 = Date.UTC(2026, 10, 1, 17, 0); // thứ Hai 00:00 VN
assert.strictEqual(L.raidWindow(t0).open, false);
assert.strictEqual(L.raidWindow(t0).opensAt, sat19);
assert.strictEqual(L.raidWindow(sat18).open, false);
assert.strictEqual(L.raidWindow(sat19).open, true);
assert.strictEqual(L.raidWindow(sun2359).open, true);
assert.strictEqual(L.raidWindow(sun2359).week, L.raidWindow(sat19).week);
assert.strictEqual(L.raidWindow(mon0).open, false);
assert.strictEqual(L.raidWindow(mon0).opensAt, sat19 + 7 * 24 * H);
assert.strictEqual(L.raidWindow(sat18, true).open, true);
console.log('✓ Chỉ mở cướp từ 19:00 thứ Bảy tới hết Chủ nhật (giờ Việt Nam)');

// Trận cướp
const atk = L.newPlayer('x', 'Kẻ cướp', t0);
const def = L.newPlayer('y', 'Nạn nhân', t0);
atk.buildings.barracks = 1;
atk.resources.food = 5000;
atk.resources.fuel = 5000;
assert.strictEqual(L.trainTroops(atk, 11), 'Doanh trại chỉ chứa được 10 chiến binh.');
assert.strictEqual(L.trainTroops(atk, 10), null);
assert.strictEqual(atk.troops, 10);
assert.ok(L.raid(atk, def, t0, L.raidWindow(t0)).error);
def.resources = { scrap: 1150, fuel: 150, food: 550 };
const win = L.raidWindow(sat19);
const res = L.raid(atk, def, sat19, win, () => 0.5);
assert.ok(res.won);
assert.deepStrictEqual(res.loot, { scrap: 250, fuel: 0, food: 100 });
assert.strictEqual(def.resources.scrap, 900);
assert.strictEqual(atk.resources.scrap, 850);
assert.ok(def.shieldUntil > sat19);
assert.ok(L.raid(atk, def, sat19 + 1, win).error, 'đang có khiên');
assert.strictEqual(L.raidsLeft(atk, win.week), L.RAIDS_PER_WEEKEND - 1);
assert.strictEqual(L.raidsLeft(atk, 'tuần khác'), L.RAIDS_PER_WEEKEND);

// Phòng thủ mạnh thì kẻ cướp thua và mất quân
const fort = L.newPlayer('z', 'Pháo đài', t0);
fort.buildings.wall = 5;
fort.buildings.turret = 5;
const before = atk.troops;
const lose = L.raid(atk, fort, sat19, win, () => 0.5);
assert.strictEqual(lose.won, false);
assert.ok(atk.troops < before);
assert.strictEqual(fort.shieldUntil, 0);
for (let i = 0; i < 5; i++) L.raid(atk, fort, sat19, win);
assert.strictEqual(L.raidsLeft(atk, win.week), 0);
console.log('✓ Cướp: tính thắng thua, cướp 25% phần không giấu, khiên 12 giờ, giới hạn lượt');

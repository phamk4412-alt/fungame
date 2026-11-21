// Kiểm thử Đấu Trường Lá Chắn Ngôn Từ: luật thuần + lớp Arena với đồng hồ giả.
const assert = require('assert');
const fs = require('fs');
const path = require('path');
const AR = require('../public/lachan/arena-rules');
const { Arena } = require('../lachan/arena');

const D = JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'public', 'lachan', 'data.json'), 'utf8'));
const C = D.settings.arena;

function test(name, fn) {
  fn();
  console.log('  ✓ ' + name);
}

/** Phòng có đồng hồ giả: clock.t là mili giây hiện tại. */
function makeArena(n) {
  const clock = { t: 1000 };
  const a = new Arena('TEST', D, { now: () => clock.t, seed: 42 });
  for (let i = 0; i < n; i++) {
    a.join('p' + i, 'Người ' + i, null);
    a.setConnected('p' + i, +1);
  }
  return { a, clock };
}

console.log('Đấu Trường Lá Chắn Ngôn Từ:');

test('bộ câu hỏi có đủ 3 màn và đáp án hợp lệ', () => {
  const qs = AR.buildQuestions(D, 42);
  assert.strictEqual(qs.length, D.round1.items.length + C.stormCount + D.round3.situations.length);
  assert.deepStrictEqual([...new Set(qs.map((q) => q.round))], [1, 2, 3]);
  qs.forEach((q) => assert.ok(q.answer >= 0 && q.answer < q.options.length));
  assert.deepStrictEqual(AR.buildQuestions(D, 42).map((q) => q.prompt + (q.card ? q.card.text : '')), qs.map((q) => q.prompt + (q.card ? q.card.text : '')));
});

test('trả lời nhanh được nhiều điểm hơn, sai thì 0 điểm', () => {
  const q = AR.buildQuestions(D, 1)[0];
  assert.strictEqual(AR.questionPoints(C, q, q.answer, 0), C.maxPoints);
  assert.strictEqual(AR.questionPoints(C, q, q.answer, C.secondsPerQuestion), C.minPoints);
  assert.strictEqual(AR.questionPoints(C, q, 1 - q.answer, 0), 0);
  assert.strictEqual(AR.questionPoints(C, q, null, 0), 0);
});

test('câu đồng cảm cho điểm theo mức hồi Tinh thần của phương án', () => {
  const q = AR.buildQuestions(D, 1).find((x) => x.kind === 'empathy');
  const harm = q.options.findIndex((o) => o.hp < 0);
  const half = q.options.findIndex((o, i) => o.hp > 0 && i !== q.answer);
  assert.strictEqual(AR.questionPoints(C, q, q.answer, 0), C.maxPoints);
  assert.strictEqual(AR.questionPoints(C, q, harm, 0), 0);
  assert.strictEqual(AR.questionPoints(C, q, half, 0), Math.round((C.maxPoints * q.options[half].hp) / q.options[q.answer].hp));
});

test('Tinh thần tăng khi cả phòng đúng, tụt mạnh khi cả phòng sai', () => {
  const q = AR.buildQuestions(D, 1)[0];
  assert.strictEqual(AR.hpDelta(C, q, [q.answer, q.answer]), C.hitHp);
  assert.strictEqual(AR.hpDelta(C, q, [null, 1 - q.answer]), C.missHp);
  assert.strictEqual(AR.hpDelta(C, q, []), 0);
  const e = AR.buildQuestions(D, 1).find((x) => x.kind === 'empathy');
  assert.strictEqual(AR.hpDelta(C, e, [e.answer, null]), Math.round((e.options[e.answer].hp + C.timeoutHp) / 2));
});

test('xếp hạng đội theo điểm trung bình, người mới vào đội ít người nhất', () => {
  const rows = AR.teamStandings(['A', 'B'], [{ team: 0, score: 900 }, { team: 0, score: 100 }, { team: 1, score: 600 }]);
  assert.deepStrictEqual(rows.map((r) => r.name), ['B', 'A']);
  assert.strictEqual(rows[1].avg, 500);
  assert.strictEqual(AR.smallestTeam(3, [{ team: 0 }, { team: 1 }]), 2);
  const { a } = makeArena(8);
  const sizes = D.teams.map((_, i) => [...a.players.values()].filter((p) => p.team === i).length);
  assert.deepStrictEqual(sizes, D.teams.map(() => 8 / D.teams.length));
});

test('tên trùng được đánh số, phòng chờ mới cho đổi đội', () => {
  const { a } = makeArena(0);
  a.join('x', 'Lan', null);
  a.join('y', 'lan', null);
  assert.strictEqual(a.players.get('y').name, 'lan 2');
  a.setTeam('x', 3);
  assert.strictEqual(a.players.get('x').team, 3);
  a.setConnected('x', 1);
  a.start();
  a.setTeam('x', 1);
  assert.strictEqual(a.players.get('x').team, 3);
});

test('điện thoại không thấy đáp án trước khi công bố', () => {
  const { a } = makeArena(2);
  a.start();
  const s = a.stateForPlayer('p0');
  assert.strictEqual(s.question.answer, undefined);
  assert.strictEqual(s.question.explain, undefined);
  a.next();
  assert.strictEqual(a.phase, 'reveal');
  assert.strictEqual(a.stateForPlayer('p0').question.answer, a.question.answer);
});

test('mỗi câu chỉ trả lời một lần, mọi người trả lời xong thì tự công bố', () => {
  const { a, clock } = makeArena(2);
  a.start();
  const q = a.question;
  clock.t += 2000;
  assert.ok(a.answer('p0', 0, q.answer));
  assert.ok(!a.answer('p0', 0, 1 - q.answer));
  assert.strictEqual(a.phase, 'question');
  assert.ok(a.answer('p1', 0, 1 - q.answer));
  assert.strictEqual(a.phase, 'reveal');
  assert.strictEqual(a.players.get('p0').score, AR.speedPoints(C, 2));
  assert.strictEqual(a.players.get('p1').score, 0);
  assert.strictEqual(a.stateForPlayer('p0').me.correct, true);
});

test('hết giờ thì tự công bố, người không trả lời làm Tinh thần tụt', () => {
  const { a, clock } = makeArena(3);
  a.start();
  clock.t += C.secondsPerQuestion * 1000 - 1;
  assert.ok(!a.tick());
  clock.t += 1;
  assert.ok(a.tick());
  assert.strictEqual(a.phase, 'reveal');
  assert.strictEqual(a.hp, D.settings.hpStart + C.missHp);
});

test('cả phòng trả lời đúng hết thì thắng', () => {
  const { a } = makeArena(4);
  a.start();
  while (a.phase !== 'end') {
    if (a.phase === 'question') for (const id of a.players.keys()) a.answer(id, a.qIndex, a.question.answer);
    a.next();
  }
  assert.strictEqual(a.outcome, 'win');
  assert.ok(a.hp > D.settings.winHp);
});

test('cả phòng trả lời sai liên tục thì Tinh thần về 0 và kết thúc sớm với kết cục thua', () => {
  const { a } = makeArena(4);
  a.start();
  let asked = 0;
  while (a.phase !== 'end') {
    if (a.phase === 'question') {
      asked++;
      const wrong = a.question.options.findIndex((o, i) => i !== a.question.answer && (o.hp == null || o.hp < 0));
      for (const id of a.players.keys()) a.answer(id, a.qIndex, wrong);
    }
    a.next();
  }
  assert.strictEqual(a.outcome, 'lose');
  assert.strictEqual(a.hp, 0);
  assert.ok(asked < a.questions.length, 'phải kết thúc trước câu cuối');
});

test('chơi lại xóa điểm nhưng giữ người chơi', () => {
  const { a } = makeArena(2);
  a.start();
  a.answer('p0', 0, a.question.answer);
  a.reset();
  assert.strictEqual(a.phase, 'lobby');
  assert.strictEqual(a.players.size, 2);
  assert.strictEqual(a.players.get('p0').score, 0);
  assert.strictEqual(a.hp, D.settings.hpStart);
});

test('MC mời người chơi ra khỏi phòng', () => {
  const { a } = makeArena(2);
  a.kick('p1');
  assert.ok(!a.players.has('p1'));
  assert.strictEqual(a.stateForPlayer('p1').me, null);
});

// Màn kết thúc khi thua: dữ liệu cảnh cuối phải có số hỗ trợ và không mô tả cách thức nào
const sc = D.endings.scene;
const cq = D.endings.consequences;
test('cảnh thua có số Tổng đài 111 và không có từ ngữ mô tả cách thức', () => {
  assert.strictEqual(cq.hotline, '111');
  const text = JSON.stringify(sc).toLowerCase();
  ['ban công', 'nhảy', 'rơi', 'cầu', 'tự tử', 'tự vẫn', 'chết'].forEach((w) => assert.ok(!text.includes(w), 'cảnh cuối có từ: ' + w));
});

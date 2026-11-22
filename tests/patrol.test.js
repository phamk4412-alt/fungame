// Kiểm thử phòng không chiến Patrol (pt:*): vào phòng, bắn trúng, hạ, rơi, hồi sinh, rời phòng.
const assert = require('assert');
const pt = require('../patrol/server');

function test(name, fn) {
  fn();
  console.log('  ✓ ' + name);
}

/** WebSocket giả: ghi lại mọi tin nhắn nhận được. */
function fakeWs() {
  const ws = { OPEN: 1, readyState: 1, got: [], send(s) { ws.got.push(JSON.parse(s)); } };
  ws.last = (type) => [...ws.got].reverse().find((m) => m.type === type);
  return ws;
}
function join(room, name, plane) {
  const ws = fakeWs();
  pt.handle(ws, { type: 'pt:join', room, name, plane });
  return ws;
}

console.log('Patrol nhiều người:');

test('hai người cùng mã phòng thì thấy nhau', () => {
  const a = join('t1', 'Ann', 'wasp');
  const b = join('T1', 'Bob', 'bison');
  assert.strictEqual(a.last('pt:welcome').room, 'T1');
  assert.strictEqual(b.last('pt:welcome').players.length, 1);
  assert.strictEqual(a.last('pt:join').pl.name, 'Bob');
  assert.strictEqual(a.last('pt:join').pl.hp, pt.PLANES.bison.hp);
  pt.close(a); pt.close(b);
});

test('vị trí và tên lửa được chuyển cho người khác, không gửi lại người gửi', () => {
  const a = join('T2', 'Ann', 'kestrel'), b = join('T2', 'Bob', 'heron');
  pt.handle(a, { type: 'pt:s', p: [1, 2, 3], f: [0, 0, -1], u: [0, 1, 0], v: 200, ab: 1 });
  pt.handle(a, { type: 'pt:fire', mid: 'm1', p: [1, 2, 3], v: [0, 0, -200], tgt: b.pt.p.id, gp: [0, 0, 0] });
  assert.deepStrictEqual(b.last('pt:s').p, [1, 2, 3]);
  assert.strictEqual(b.last('pt:fire').tgt, b.pt.p.id);
  assert.strictEqual(a.last('pt:s'), undefined);
  pt.close(a); pt.close(b);
});

test('trúng tên lửa thì mất máu, đủ phát thì bị hạ và được tính điểm', () => {
  const a = join('T3', 'Ann', 'kestrel'), b = join('T3', 'Bob', 'wasp');
  const bid = b.pt.p.id;
  pt.handle(a, { type: 'pt:hit', victim: bid, mid: 'm1' });
  assert.strictEqual(b.last('pt:hp').hp, pt.PLANES.wasp.hp - pt.MISSILE_DMG);
  pt.handle(a, { type: 'pt:hit', victim: bid, mid: 'm2' });
  const k = a.last('pt:kill');
  assert.strictEqual(k.victim, bid);
  assert.strictEqual(k.killer, a.pt.p.id);
  assert.deepStrictEqual(k.score.find((s) => s.id === a.pt.p.id), { id: a.pt.p.id, kills: 1, deaths: 0 });
  pt.handle(a, { type: 'pt:hit', victim: bid, mid: 'm3' }); // đã chết: bỏ qua
  assert.strictEqual(a.got.filter((m) => m.type === 'pt:kill').length, 1);
  pt.close(a); pt.close(b);
});

test('đâm núi tính một lần chết, hồi sinh thì đầy máu', () => {
  const a = join('T4', 'Ann', 'bison'), b = join('T4', 'Bob', 'kestrel');
  pt.handle(a, { type: 'pt:crash', p: [0, 0, 0] });
  pt.handle(a, { type: 'pt:crash', p: [0, 0, 0] });
  assert.strictEqual(b.got.filter((m) => m.type === 'pt:kill' && m.how === 'crash').length, 1);
  pt.handle(a, { type: 'pt:respawn', p: [5, 900, 5], f: [0, 0, -1], u: [0, 1, 0] });
  assert.strictEqual(b.last('pt:respawn').hp, pt.PLANES.bison.hp);
  pt.close(a); pt.close(b);
});

test('không tự bắn mình, rời phòng thì báo và phòng trống bị xóa', () => {
  const a = join('T5', 'Ann', 'kestrel'), b = join('T5', 'Bob', 'kestrel');
  pt.handle(a, { type: 'pt:hit', victim: a.pt.p.id });
  assert.strictEqual(a.pt.p.hp, pt.PLANES.kestrel.hp);
  const aid = a.pt.p.id;
  pt.close(a);
  assert.strictEqual(b.last('pt:gone').id, aid);
  pt.close(b);
  assert.strictEqual(pt.rooms.has('T5'), false);
});

console.log('Patrol: tất cả đều qua.');

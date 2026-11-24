// Kiểm thử mô hình bay Sải Cánh: bay bằng không cần lái, cất cánh, thất tốc, hạ cánh mạnh, địa hình tất định.
const assert = require('assert');

function test(name, fn) {
  return Promise.resolve(fn()).then(() => console.log('  ✓ ' + name));
}

(async () => {
  const P = await import('../public/flight/physics.js');
  const T = await import('../public/flight/terrain.js');
  const env = { surface: T.surfaceAt, normal: (x, z) => T.normalAt(x, z, 1.5) };
  const fresh = () => ({ a: new P.Aircraft(env), c: P.makeControls() });
  const deg = (r) => (r * 180) / Math.PI;

  console.log('Sải Cánh — mô hình bay:');

  await test('địa hình tất định: cùng toạ độ cho cùng độ cao, sân bay phẳng', () => {
    assert.strictEqual(T.heightAt(1234.5, -987.25), T.heightAt(1234.5, -987.25));
    for (const z of [-850, 0, 850]) assert.ok(Math.abs(T.heightAt(0, z) - T.WORLD.airport.elev) < 0.01);
    assert.ok(T.heightAt(0, 14000) < 0, 'phía nam là biển');
    assert.ok(T.heightAt(0, -14000) > 300, 'phía bắc là núi');
  });

  await test('hướng mũi: quatFromEuler(90) chỉ về hướng đông', () => {
    const f = P.qrot(P.quatFromEuler(90), [0, 0, -1]);
    assert.ok(f[0] > 0.999);
  });

  await test('bay bằng 60 giây không chạm cần lái thì giữ độ cao và tốc độ', () => {
    const { a, c } = fresh();
    a.reset([0, 900, 0], 0, 55);
    c.throttle = 0.7;
    a.step(60, c);
    assert.strictEqual(a.crashed, null);
    assert.ok(Math.abs(a.pos[1] - 900) < 40, 'độ cao ' + a.pos[1]);
    assert.ok(a.out.ias > 45 && a.out.ias < 65, 'tốc độ ' + a.out.ias);
    assert.ok(Math.abs(deg(a.attitude().roll)) < 3);
  });

  await test('đứng yên trên đường băng thì ba bánh chạm đất, không trôi', () => {
    const { a, c } = fresh();
    a.reset([0, T.WORLD.airport.elev + 1.16, 860], 0, 0, true);
    a.step(3, c);
    assert.strictEqual(a.out.contacts, 3);
    assert.ok(Math.hypot(...a.vel) < 0.05);
  });

  await test('cất cánh: ga tối đa, kéo cần ở 55 kt thì rời đất trong 450 m', () => {
    const { a, c } = fresh();
    a.reset([0, T.WORLD.airport.elev + 1.16, 860], 0, 0, true);
    c.throttle = 1;
    let t = 0, lift = null;
    while (t < 40 && lift === null) {
      if (a.out.ias * 1.944 > 55) c.elevator = 0.45;
      a.step(0.02, c); t += 0.02;
      if (c.elevator && a.out.contacts === 0) lift = 860 - a.pos[2];
    }
    assert.ok(lift !== null && lift < 450, 'quãng chạy đà ' + lift);
    assert.strictEqual(a.crashed, null);
  });

  await test('kéo hết cần khi tắt máy thì thất tốc', () => {
    const { a, c } = fresh();
    a.reset([0, 1500, 0], 0, 40);
    c.throttle = 0; c.elevator = 1;
    let stall = 0;
    for (let i = 0; i < 200; i++) { a.step(0.05, c); stall = Math.max(stall, a.out.stall); }
    assert.ok(stall > 0.5);
  });

  await test('nghiêng cánh: đẩy cần sang phải thì máy bay nghiêng phải và rẽ phải', () => {
    const { a, c } = fresh();
    a.reset([0, 900, 0], 0, 55);
    c.throttle = 0.7; c.aileron = 0.6;
    a.step(1.2, c);
    c.aileron = 0; c.elevator = 0.15;
    a.step(8, c);
    const at = a.attitude();
    assert.ok(deg(at.roll) > 10, 'nghiêng ' + deg(at.roll));
    assert.ok(at.heading > 10 && at.heading < 180, 'hướng ' + at.heading);
  });

  await test('rơi thẳng xuống đường băng 6 m/s thì vỡ máy bay', () => {
    const { a, c } = fresh();
    a.reset([0, T.WORLD.airport.elev + 2, 0], 0, 0);
    a.vel = [0, -6, 0];
    a.step(1, c);
    assert.ok(a.crashed);
  });

  await test('hạ cánh nhẹ 1.5 m/s rồi phanh thì dừng hẳn, không vỡ', () => {
    const { a, c } = fresh();
    a.reset([0, T.WORLD.airport.elev + 1.5, 0], 0, 0);
    a.vel = [0, -1.5, -30];
    c.throttle = 0; c.brake = 1; c.elevator = 0.2;
    a.step(20, c);
    assert.strictEqual(a.crashed, null);
    assert.ok(Math.hypot(...a.vel) < 0.1);
  });

  await test('lao xuống biển thì báo rơi xuống nước', () => {
    const { a, c } = fresh();
    a.reset([0, 6, 15000], 0, 40);
    a.vel = [0, -8, -40];
    a.step(2, c);
    assert.ok(/nước/.test(a.crashed || ''));
  });

  console.log('Tất cả kiểm thử Sải Cánh đều qua.');
})().catch((e) => { console.error(e); process.exit(1); });

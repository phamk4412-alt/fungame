// Địa hình thủ tục của game Sải Cánh: cùng một hàm độ cao dùng cho cả vẽ lẫn va chạm.
// Hệ trục: x hướng đông, y hướng lên, z hướng nam (−z là hướng bắc). Đơn vị mét.

/** Cấu hình thế giới: sân bay, thị trấn, hồ. Sửa ở đây để đổi bản đồ. */
export const WORLD = {
  sea: 0,
  airport: { x: 0, z: 0, elev: 62, halfW: 420, halfL: 1350, blend: 900 },
  runway: { x: 0, z: 0, length: 1800, width: 30, heading: 0 },
  town: { x: 2300, z: 500, r: 900 },
  lake: { x: -5200, z: -1800, r: 1700 },
  coastZ: 7500, // bờ biển phía nam
  mountainZ: -5000, // núi bắt đầu dâng lên ở phía bắc
};

// Nhiễu gradient 2D với bảng hoán vị cố định (tất định, không phụ thuộc Math.random)
const PERM = new Uint8Array(512);
const GX = new Float32Array(256);
const GY = new Float32Array(256);
(function seedTables() {
  let s = 1337;
  const rnd = () => ((s = (Math.imul(s, 1103515245) + 12345) >>> 0) / 4294967296);
  const p = [];
  for (let i = 0; i < 256; i++) p.push(i);
  for (let i = 255; i > 0; i--) {
    const j = Math.floor(rnd() * (i + 1));
    [p[i], p[j]] = [p[j], p[i]];
  }
  for (let i = 0; i < 512; i++) PERM[i] = p[i & 255];
  for (let i = 0; i < 256; i++) {
    const a = rnd() * Math.PI * 2;
    GX[i] = Math.cos(a);
    GY[i] = Math.sin(a);
  }
})();

/** Nhiễu gradient 2D, giá trị khoảng [-0.7, 0.7]. */
export function noise(x, y) {
  const xi = Math.floor(x), yi = Math.floor(y);
  const xf = x - xi, yf = y - yi;
  const X = xi & 255, Y = yi & 255;
  const u = xf * xf * xf * (xf * (xf * 6 - 15) + 10);
  const v = yf * yf * yf * (yf * (yf * 6 - 15) + 10);
  const aa = PERM[PERM[X] + Y], ab = PERM[PERM[X] + Y + 1];
  const ba = PERM[PERM[X + 1] + Y], bb = PERM[PERM[X + 1] + Y + 1];
  const n00 = GX[aa] * xf + GY[aa] * yf;
  const n10 = GX[ba] * (xf - 1) + GY[ba] * yf;
  const n01 = GX[ab] * xf + GY[ab] * (yf - 1);
  const n11 = GX[bb] * (xf - 1) + GY[bb] * (yf - 1);
  const x1 = n00 + (n10 - n00) * u;
  const x2 = n01 + (n11 - n01) * u;
  return x1 + (x2 - x1) * v;
}

/** Tổng nhiễu nhiều quãng tám (fbm). */
export function fbm(x, y, oct = 5, gain = 0.5) {
  let a = 1, f = 1, s = 0, n = 0;
  for (let i = 0; i < oct; i++) {
    s += a * noise(x * f + i * 17.3, y * f - i * 9.1);
    n += a;
    a *= gain;
    f *= 2.03;
  }
  return s / n;
}

/** Nhiễu gợn (ridged) cho sống núi sắc. */
export function ridged(x, y, oct = 6) {
  let a = 0.5, f = 1, s = 0, w = 1;
  for (let i = 0; i < oct; i++) {
    let n = 1 - Math.abs(noise(x * f + i * 31.7, y * f + i * 11.3) * 1.45);
    n *= n;
    n *= w;
    w = Math.min(1, Math.max(0, n * 1.6));
    s += n * a;
    a *= 0.5;
    f *= 2.1;
  }
  return s;
}

export const smooth = (a, b, x) => {
  const t = Math.min(1, Math.max(0, (x - a) / (b - a)));
  return t * t * (3 - 2 * t);
};
const mix = (a, b, t) => a + (b - a) * t;

/** Mức ảnh hưởng của sân bay tại (x,z): 1 trong khu sân bay, giảm dần ra ngoài. */
export function airportMask(x, z) {
  const A = WORLD.airport;
  const dx = Math.max(0, Math.abs(x - A.x) - A.halfW);
  const dz = Math.max(0, Math.abs(z - A.z) - A.halfL);
  const d = Math.hypot(dx, dz);
  return 1 - smooth(0, A.blend, d);
}

/** Mức thuộc thị trấn (0..1). */
export function townMask(x, z) {
  const T = WORLD.town;
  const d = Math.hypot(x - T.x, (z - T.z) * 1.3) + fbm(x / 700, z / 700, 2) * 400;
  return 1 - smooth(T.r * 0.6, T.r, d);
}

function lakeMask(x, z) {
  const L = WORLD.lake;
  const d = Math.hypot(x - L.x, (z - L.z) * 1.4) + fbm(x / 900 + 3, z / 900, 3) * 900;
  return 1 - smooth(L.r * 0.7, L.r, d);
}

/** Độ cao mặt đất (m) tại toạ độ thế giới (x,z). Dưới 0 là nước. */
export function heightAt(x, z) {
  const k = 1 / 1000;
  const X = x * k, Z = z * k;
  // đồi thấp nhấp nhô quanh thung lũng
  let h = 70 + 95 * fbm(X * 0.32, Z * 0.32, 5) + 18 * fbm(X * 1.7, Z * 1.7, 3);
  // dãy núi phía bắc (z âm)
  const north = (WORLD.mountainZ - z) * k + 3.2 * fbm(X * 0.07 + 5, Z * 0.07, 3);
  const m = smooth(-1.5, 6, north);
  const r = ridged(X * 0.21, Z * 0.21, 6);
  h += m * (r * 2100 + 260 * fbm(X * 0.6, Z * 0.6, 4)) + smooth(-3, 2, north) * 120;
  // biển phía nam
  const south = (z - WORLD.coastZ) * k + 3 * fbm(X * 0.11 - 4, Z * 0.11, 3);
  const s = smooth(-0.6, 1.4, south);
  h = mix(h, -40 - 30 * s, s);
  // hồ phía tây
  const lk = lakeMask(x, z);
  h = mix(h, -18, lk);
  // san phẳng sân bay
  const a = airportMask(x, z);
  h = mix(h, WORLD.airport.elev, a);
  // thị trấn: làm dịu địa hình
  const t = townMask(x, z);
  if (t > 0) h = mix(h, 0.5 * h + 0.5 * (WORLD.airport.elev + 8), t * 0.7);
  return h;
}

/** Mật độ rừng (0..1) tại (x,z). Khớp với màu rừng trên địa hình và cây 3D. */
export function forestAt(x, z, h) {
  if (h === undefined) h = heightAt(x, z);
  if (h < 4 || h > 1650) return 0;
  const X = x / 1000, Z = z / 1000;
  let f = fbm(X * 0.55 + 7.3, Z * 0.55 - 2.1, 4) + 0.12 * fbm(X * 3.1, Z * 3.1, 2);
  f = smooth(0.02, 0.16, f + (h > 300 ? 0.08 : 0));
  f *= 1 - airportMask(x, z);
  f *= 1 - townMask(x, z);
  f *= 1 - smooth(1350, 1650, h);
  return f;
}

/** Pháp tuyến bề mặt bằng sai phân trung tâm. */
export function normalAt(x, z, e = 2) {
  const hx = heightAt(x + e, z) - heightAt(x - e, z);
  const hz = heightAt(x, z + e) - heightAt(x, z - e);
  const nx = -hx, ny = 2 * e, nz = -hz;
  const l = Math.hypot(nx, ny, nz);
  return [nx / l, ny / l, nz / l];
}

/** Mặt va chạm: đất hoặc mặt nước (0). Trả về {h, water}. */
export function surfaceAt(x, z) {
  const h = heightAt(x, z);
  return h < WORLD.sea ? { h: WORLD.sea, water: true } : { h, water: false };
}

/** Có nằm trên đường băng (mặt nhựa) không. */
export function onRunway(x, z) {
  const R = WORLD.runway;
  return Math.abs(x - R.x) < R.width / 2 + 3 && Math.abs(z - R.z) < R.length / 2 + 20;
}

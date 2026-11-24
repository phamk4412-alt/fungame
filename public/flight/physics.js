// Mô hình bay 6 bậc tự do cho máy bay cánh quạt hạng nhẹ của Sải Cánh.
// Dùng các đạo hàm khí động học công khai của một máy bay huấn luyện 4 chỗ cánh trên.
// Hệ toạ độ thế giới: x đông, y lên, z nam. Trục thân máy bay (giống Three.js): mũi = -Z, cánh phải = +X, nóc = +Y.
// Mô men tính trong hệ chuẩn hàng không: p lăn (phải xuống +), q chúc ngóc (ngóc +), r hướng (mũi sang phải +).

/** Thông số máy bay — mọi con số chỉnh tay đều nằm ở đây. */
export const SPEC = {
  name: 'SC-4 Sải Cánh',
  mass: 1100, // kg
  S: 16.2, // diện tích cánh m²
  b: 11.0, // sải cánh m
  c: 1.49, // dây cung trung bình m
  I: [1285, 1825, 2667], // quán tính lăn, chúc ngóc, hướng (kg m²)
  power: 120000, // W công suất động cơ ở mực nước biển
  propEff: 0.8,
  staticThrust: 2700, // N
  CL0: 0.31, CLa: 5.14, CLmaxAlpha: 0.27, // rad góc thất tốc khi không thả cánh tà
  CD0: 0.031, K: 0.054,
  CYb: -0.31,
  Cm0: -0.015, Cma: -0.89, Cmq: -12.4, Cmde: 1.28,
  Clb: -0.089, Clp: -0.47, Clr: 0.096, Clda: 0.178,
  Cnb: 0.065, Cnp: -0.03, Cnr: -0.099, Cndr: 0.0657, Cnda: -0.03,
  elevMax: 0.26, ailMax: 0.3, rudMax: 0.47, trimMax: 0.12,
  flapDeg: [0, 10, 20, 30],
  steerMax: 0.3, // rad bánh mũi
  // điểm tiếp đất (toạ độ thân, đáy lốp)
  gear: [
    { name: 'nose', p: [0, -1.2, -1.75], k: 45000, c: 5200, steer: true, brake: false },
    { name: 'left', p: [-1.25, -1.2, 0.35], k: 70000, c: 7000, steer: false, brake: true },
    { name: 'right', p: [1.25, -1.2, 0.35], k: 70000, c: 7000, steer: false, brake: true },
    // gờ đuôi: cọ đất khi ngóc quá cao thì trượt chứ không vỡ
    { name: 'tail', p: [0, 0.1, 5.2], k: 60000, c: 6000, steer: false, brake: false, mu: 0.45 },
  ],
  // điểm thân máy bay — chạm đất là rơi
  hull: [
    [-5.5, 0.95, 0.15], [5.5, 0.95, 0.15], [0, 1.55, 5.5],
    [0, -0.98, -2.9], [0, -0.75, 1.8], [0, 1.1, -0.6],
  ],
  maxSinkLanding: 4.5, // m/s
  vne: 84, // m/s tốc độ cấm vượt (~163 kt)
};

const G = 9.81;

// --- toán vector/quaternion gọn ---
const dot = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
const cross = (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
const add = (a, b) => [a[0] + b[0], a[1] + b[1], a[2] + b[2]];
const scale = (a, s) => [a[0] * s, a[1] * s, a[2] * s];
const len = (a) => Math.hypot(a[0], a[1], a[2]);
const norm = (a) => { const l = len(a) || 1; return [a[0] / l, a[1] / l, a[2] / l]; };
const clamp = (x, a, b) => (x < a ? a : x > b ? b : x);
const smooth = (a, b, x) => { const t = clamp((x - a) / (b - a), 0, 1); return t * t * (3 - 2 * t); };

/** Xoay vector v bằng quaternion q = [x,y,z,w]. */
export function qrot(q, v) {
  const [x, y, z, w] = q;
  const ix = w * v[0] + y * v[2] - z * v[1];
  const iy = w * v[1] + z * v[0] - x * v[2];
  const iz = w * v[2] + x * v[1] - y * v[0];
  const iw = -x * v[0] - y * v[1] - z * v[2];
  return [
    ix * w + iw * -x + iy * -z - iz * -y,
    iy * w + iw * -y + iz * -x - ix * -z,
    iz * w + iw * -z + ix * -y - iy * -x,
  ];
}

/** Quaternion từ hướng mũi (độ, 0 = bắc, 90 = đông), góc ngóc và góc nghiêng (rad). */
export function quatFromEuler(headingDeg, pitch = 0, roll = 0) {
  // thứ tự: hướng quanh Y, ngóc quanh X, nghiêng quanh Z (như Three.js 'YXZ')
  const yaw = -headingDeg * Math.PI / 180;
  const c1 = Math.cos(yaw / 2), s1 = Math.sin(yaw / 2);
  const c2 = Math.cos(pitch / 2), s2 = Math.sin(pitch / 2);
  const c3 = Math.cos(-roll / 2), s3 = Math.sin(-roll / 2);
  return [
    s2 * c1 * c3 + c2 * s1 * s3,
    c2 * s1 * c3 - s2 * c1 * s3,
    c2 * c1 * s3 - s2 * s1 * c3,
    c2 * c1 * c3 + s2 * s1 * s3,
  ];
}

/** Mật độ không khí theo độ cao (kg/m³). */
export const airDensity = (h) => 1.225 * Math.exp(-Math.max(0, h) / 8500);

/** Bộ điều khiển mặc định (đầu vào của người chơi). */
export function makeControls() {
  return { elevator: 0, aileron: 0, rudder: 0, throttle: 0, flaps: 0, brake: 0, trim: 0.15, assist: true };
}

/**
 * Máy bay: trạng thái + bước mô phỏng.
 * Nhận `env` để tiêm phụ thuộc: { surface(x,z) -> {h, water}, normal(x,z) -> [x,y,z], gust(t, pos) -> [x,y,z] }.
 */
export class Aircraft {
  constructor(env, spec = SPEC) {
    this.env = env;
    this.spec = spec;
    this.reset([0, 600, 0], 0, 55);
  }

  /** Đặt lại máy bay tại vị trí, hướng (độ) và vận tốc (m/s) cho trước. */
  reset(pos, headingDeg, speed, onGround = false) {
    this.pos = pos.slice();
    this.q = quatFromEuler(headingDeg, 0, 0);
    this.vel = scale(this.fwd(), speed);
    this.w = [0, 0, 0]; // p,q,r (rad/s) trong hệ chuẩn
    this.t = 0;
    this.crashed = null;
    this.onGround = onGround;
    this.flapPos = 0; // độ, chạy dần về mức đặt
    this.rpm = onGround ? 750 : 2300;
    this.out = { alpha: 0, beta: 0, ias: speed, stall: 0, gload: 1, contacts: 0, wheelSpeed: 0, touchdown: 0, skid: 0 };
  }

  fwd() { return qrot(this.q, [0, 0, -1]); }
  right() { return qrot(this.q, [1, 0, 0]); }
  up() { return qrot(this.q, [0, 1, 0]); }

  /** Tiến mô phỏng một khoảng dt (s), tự chia nhỏ bước 1/240 s. */
  step(dt, ctl) {
    if (this.crashed) return;
    const n = Math.max(1, Math.ceil(dt * 240));
    const h = dt / n;
    this.out.touchdown = 0;
    for (let i = 0; i < n && !this.crashed; i++) this.substep(h, ctl);
  }

  substep(dt, ctl) {
    const S = this.spec;
    this.t += dt;
    const F = this.fwd(), R = this.right(), U = this.up();
    const D = scale(U, -1);
    const rho = airDensity(this.pos[1]);

    // cánh tà chạy từ từ (≈ 3 độ/s)
    const flapTarget = S.flapDeg[clamp(ctl.flaps | 0, 0, S.flapDeg.length - 1)];
    this.flapPos += clamp(flapTarget - this.flapPos, -3 * dt, 3 * dt);
    const flapF = this.flapPos / 30;

    // gió giật nhẹ
    const gust = this.env.gust ? this.env.gust(this.t, this.pos) : [0, 0, 0];
    const vAir = [this.vel[0] - gust[0], this.vel[1] - gust[1], this.vel[2] - gust[2]];
    const V = len(vAir);
    const u = dot(vAir, F), v = dot(vAir, R), w = dot(vAir, D);
    const [p, q, r] = this.w;

    let force = [0, -G * S.mass, 0];
    let mom = [0, 0, 0]; // L, M, N (hệ chuẩn)

    // --- khí động học ---
    let alpha = 0, beta = 0, stall = 0;
    if (V > 0.5) {
      alpha = Math.atan2(w, u);
      beta = Math.asin(clamp(v / V, -1, 1));
      const qbar = 0.5 * rho * V * V;
      const aStall = S.CLmaxAlpha - flapF * 0.03;
      stall = smooth(aStall, aStall + 0.12, Math.abs(alpha));
      const CLlin = S.CL0 + S.CLa * alpha + flapF * 0.55;
      const CLplate = 1.05 * Math.sin(2 * alpha) + flapF * 0.25;
      const CL = CLlin * (1 - stall) + CLplate * stall;
      const CD = S.CD0 + S.K * CLlin * CLlin * (1 - stall) + flapF * 0.065 + 1.1 * stall * Math.sin(alpha) ** 2 + 0.6 * Math.sin(beta) ** 2;
      // trợ lái tự phối hợp (tránh trượt ngang) khi bay
      let rudder = ctl.rudder;
      if (ctl.assist && !this.onGround) rudder = clamp(rudder + beta * 4 - r * 0.6, -1, 1);
      const ca = Math.cos(alpha), sa = Math.sin(alpha);
      const qS = qbar * S.S;
      const X = qS * (-CD * ca + CL * sa);
      const Z = qS * (-CD * sa - CL * ca);
      const Y = qS * (S.CYb * beta);
      force = add(force, add(add(scale(F, X), scale(R, Y)), scale(D, Z)));
      // luồng gió cánh quạt thổi qua đuôi: giúp bánh lái hiệu quả khi chạy chậm
      const qTail = Math.max(qbar, 0.5 * rho * (V * V + ctl.throttle * 350));
      const kb = S.b / (2 * Math.max(V, 8)), kc = S.c / (2 * Math.max(V, 8));
      const de = (ctl.elevator > 0 ? ctl.elevator * S.elevMax : ctl.elevator * S.elevMax * 0.75) + ctl.trim * S.trimMax;
      const da = ctl.aileron * S.ailMax;
      const dr = rudder * S.rudMax;
      const Cl = S.Clb * beta + S.Clp * (1 - 0.7 * stall) * p * kb + S.Clr * r * kb;
      const Cm = S.Cm0 + S.Cma * alpha + S.Cmq * q * kc - stall * 0.12;
      const Cn = S.Cnb * beta + S.Cnp * p * kb + S.Cnr * r * kb;
      const ctrlL = S.Clda * da * (1 - 0.5 * stall);
      const ctrlM = S.Cmde * de;
      const ctrlN = S.Cndr * dr + S.Cnda * da;
      mom = add(mom, [
        qS * S.b * Cl + qbar * S.S * S.b * ctrlL,
        qS * S.c * Cm + qTail * S.S * S.c * ctrlM,
        qS * S.b * Cn + qTail * S.S * S.b * ctrlN,
      ]);
      // thất tốc: cánh rơi lệch theo trượt ngang
      if (stall > 0.3) mom[0] += qS * S.b * 0.02 * stall * Math.sign(beta || 1);
    }

    // --- động cơ & cánh quạt ---
    const pw = S.power * (rho / 1.225) * ctl.throttle;
    const thrust = Math.min(S.staticThrust * ctl.throttle * (rho / 1.225), (pw * S.propEff) / Math.max(u, 1));
    force = add(force, scale(F, thrust));
    const rpmTarget = clamp(700 + ctl.throttle * 1750 + Math.max(0, u) * 6, 650, 2750);
    this.rpm += (rpmTarget - this.rpm) * Math.min(1, dt * 2.5);

    // --- bánh xe ---
    let contacts = 0, wheelSpeed = 0, skid = 0;
    const wW = this.worldOmega(F, R, D);
    for (const g of S.gear) {
      const rW = qrot(this.q, g.p);
      const pt = add(this.pos, rW);
      const surf = this.env.surface(pt[0], pt[2]);
      const pen = surf.h - pt[1];
      if (pen <= 0) continue;
      const vPt = add(this.vel, cross(wW, rW));
      const nrm = surf.water ? [0, 1, 0] : this.env.normal(pt[0], pt[2]);
      const vn = dot(vPt, nrm);
      if (surf.water) { this.crash('Máy bay lao xuống nước'); return; }
      if (-vn > S.maxSinkLanding) { this.crash('Hạ cánh quá mạnh'); return; }
      if (-vn > 0.6) this.out.touchdown = Math.max(this.out.touchdown, -vn);
      if (!g.mu) contacts++;
      else this.out.tailStrike = 1;
      const Fn = Math.max(0, g.k * pen - g.c * vn);
      let heading = F;
      if (g.steer) {
        const ang = -ctl.rudder * S.steerMax;
        heading = add(scale(F, Math.cos(ang)), scale(R, -Math.sin(ang)));
      }
      const fw = norm(add(heading, scale(nrm, -dot(heading, nrm))));
      const lat = cross(fw, nrm);
      const vLong = dot(vPt, fw), vLat = dot(vPt, lat);
      const muRoll = g.mu || 0.025 + (g.brake ? ctl.brake * 0.65 : 0);
      const fLat = -clamp(vLat / 0.25, -1, 1) * 0.85 * Fn;
      const fLong = -clamp(vLong / 0.25, -1, 1) * muRoll * Fn;
      const Fg = add(add(scale(nrm, Fn), scale(lat, fLat)), scale(fw, fLong));
      force = add(force, Fg);
      const tq = cross(rW, Fg);
      mom = add(mom, [dot(tq, F), dot(tq, R), dot(tq, D)]);
      wheelSpeed = Math.max(wheelSpeed, Math.abs(vLong));
      skid = Math.max(skid, Math.abs(vLat));
    }
    this.onGround = contacts > 0;

    // --- tích phân ---
    const acc = scale(force, 1 / S.mass);
    this.vel = add(this.vel, scale(acc, dt));
    this.pos = add(this.pos, scale(this.vel, dt));
    const I = S.I;
    const Iw = [I[0] * p, I[1] * q, I[2] * r];
    const gyro = cross(this.w, Iw);
    this.w = [
      p + ((mom[0] - gyro[0]) / I[0]) * dt,
      q + ((mom[1] - gyro[1]) / I[1]) * dt,
      r + ((mom[2] - gyro[2]) / I[2]) * dt,
    ];
    const ww = this.worldOmega(F, R, D);
    const [qx, qy, qz, qw] = this.q;
    const h = 0.5 * dt;
    const nq = [
      qx + h * (ww[0] * qw + ww[1] * qz - ww[2] * qy),
      qy + h * (ww[1] * qw + ww[2] * qx - ww[0] * qz),
      qz + h * (ww[2] * qw + ww[0] * qy - ww[1] * qx),
      qw + h * (-ww[0] * qx - ww[1] * qy - ww[2] * qz),
    ];
    const ql = Math.hypot(nq[0], nq[1], nq[2], nq[3]);
    this.q = [nq[0] / ql, nq[1] / ql, nq[2] / ql, nq[3] / ql];

    // --- thân máy bay chạm đất ---
    for (const hp of S.hull) {
      const pt = add(this.pos, qrot(this.q, hp));
      const surf = this.env.surface(pt[0], pt[2]);
      if (pt[1] < surf.h) { this.hitPoint = hp; this.crash(surf.water ? 'Máy bay lao xuống nước' : 'Máy bay đâm vào địa hình'); return; }
    }

    const liftAcc = dot(add(acc, [0, G, 0]), U) / G;
    const o = this.out;
    o.alpha = alpha; o.beta = beta; o.stall = stall;
    o.ias = V * Math.sqrt(rho / 1.225);
    o.gload += (liftAcc - o.gload) * Math.min(1, dt * 8);
    o.contacts = contacts; o.wheelSpeed = wheelSpeed; o.skid = skid;
    o.thrust = thrust;
  }

  worldOmega(F, R, D) {
    const [p, q, r] = this.w;
    return add(add(scale(F, p), scale(R, q)), scale(D, r));
  }

  crash(reason) {
    this.crashed = reason;
    this.vel = [0, 0, 0];
    this.w = [0, 0, 0];
  }

  /** Góc hướng (độ 0-360), ngóc và nghiêng (rad) để vẽ đồng hồ. */
  attitude() {
    const F = this.fwd(), R = this.right(), U = this.up();
    const pitch = Math.asin(clamp(F[1], -1, 1));
    let heading = Math.atan2(F[0], -F[2]) * 180 / Math.PI;
    if (heading < 0) heading += 360;
    // nghiêng: góc giữa cánh phải và mặt phẳng ngang
    const roll = Math.atan2(-R[1], U[1]);
    return { heading, pitch, roll };
  }
}

// Mô hình 3D: cá, người câu, cần câu, dây câu, phao
import * as THREE from 'three';
import { rng } from './noise.js';
import { time } from './world.js';

const UP = new THREE.Vector3(0, 1, 0);
const tmp = new THREE.Vector3();
const tmp2 = new THREE.Vector3();

// ---------- Cá ----------

function fishTexture(look, seed) {
  const W = 512;
  const H = 256;
  const c = document.createElement('canvas');
  c.width = W;
  c.height = H;
  const g = c.getContext('2d');
  const r = rng(seed);
  const grd = g.createLinearGradient(0, 0, 0, H);
  grd.addColorStop(0, look.back);
  grd.addColorStop(0.42, look.back);
  grd.addColorStop(0.7, look.belly);
  grd.addColorStop(1, look.belly);
  g.fillStyle = grd;
  g.fillRect(0, 0, W, H);
  const spot = look.spot || '#1a1a1a';
  const dot = (x, y, rad, color, alpha) => {
    g.globalAlpha = alpha;
    g.fillStyle = color;
    g.beginPath();
    g.ellipse(x, y, rad, rad * (0.7 + r() * 0.5), r() * 3, 0, Math.PI * 2);
    g.fill();
    g.globalAlpha = 1;
  };
  switch (look.pattern) {
    case 'scales':
      for (let y = 6; y < H * 0.85; y += 11) {
        for (let x = (y / 11) % 2 ? 6 : 12; x < W * 0.86; x += 13) {
          g.strokeStyle = 'rgba(0,0,0,0.18)';
          g.lineWidth = 1.6;
          g.beginPath();
          g.arc(x, y, 7, 0.2, Math.PI - 0.2);
          g.stroke();
          g.strokeStyle = 'rgba(255,255,255,0.12)';
          g.beginPath();
          g.arc(x, y - 2, 6, 0.4, Math.PI - 0.4);
          g.stroke();
        }
      }
      break;
    case 'stripes':
      for (let i = 0; i < 8; i++) {
        const x = W * (0.15 + i * 0.085);
        g.fillStyle = 'rgba(20,25,20,0.32)';
        g.fillRect(x, 0, W * 0.03, H * 0.62);
      }
      break;
    case 'dots':
      for (let i = 0; i < 170; i++) dot(r() * W * 0.85, r() * H * 0.72, 2 + r() * 5, spot, 0.75);
      break;
    case 'trout': {
      const band = g.createLinearGradient(0, H * 0.36, 0, H * 0.58);
      band.addColorStop(0, 'rgba(0,0,0,0)');
      band.addColorStop(0.5, look.band);
      band.addColorStop(1, 'rgba(0,0,0,0)');
      g.fillStyle = band;
      g.fillRect(0, H * 0.36, W * 0.85, H * 0.22);
      for (let i = 0; i < 220; i++) dot(r() * W * 0.86, r() * H * 0.62, 1.5 + r() * 3.5, spot, 0.85);
      break;
    }
    case 'koi':
      for (let i = 0; i < 7; i++) dot(W * (0.12 + r() * 0.72), H * (0.05 + r() * 0.42), 20 + r() * 42, spot, 0.95);
      for (let i = 0; i < 5; i++) dot(W * (0.2 + r() * 0.6), H * (0.05 + r() * 0.35), 6 + r() * 14, '#151515', 0.85);
      break;
    case 'blotch':
      for (let i = 0; i < 22; i++) dot(r() * W * 0.86, r() * H * 0.68, 8 + r() * 18, '#151510', 0.35);
      break;
    case 'mackerel':
      g.strokeStyle = spot;
      g.lineWidth = 4;
      for (let k = 0; k < 18; k++) {
        const x0 = W * 0.08 + k * W * 0.045;
        g.beginPath();
        for (let y = 0; y < H * 0.45; y += 4) g.lineTo(x0 + Math.sin(y * 0.09 + k) * 8, y);
        g.stroke();
      }
      break;
    case 'pike':
      for (let i = 0; i < 140; i++) dot(r() * W * 0.86, H * 0.08 + r() * H * 0.6, 3 + r() * 4, spot, 0.8);
      break;
    case 'plates':
      for (let x = 30; x < W * 0.86; x += 30) {
        for (const y of [H * 0.06, H * 0.42]) {
          g.fillStyle = 'rgba(235,235,225,0.75)';
          g.beginPath();
          g.moveTo(x, y - 8);
          g.lineTo(x + 9, y);
          g.lineTo(x, y + 8);
          g.lineTo(x - 9, y);
          g.fill();
        }
      }
      break;
    case 'aurora': {
      const a = g.createLinearGradient(0, 0, W, 0);
      a.addColorStop(0, '#3cffb4');
      a.addColorStop(0.35, '#38c8ff');
      a.addColorStop(0.7, '#a070ff');
      a.addColorStop(1, '#ff70d0');
      g.globalAlpha = 0.75;
      g.fillStyle = a;
      g.fillRect(0, 0, W, H * 0.7);
      g.globalAlpha = 1;
      for (let i = 0; i < 90; i++) dot(r() * W * 0.86, r() * H * 0.7, 1.5 + r() * 3, '#ffffff', 0.9);
      break;
    }
    default:
      for (let i = 0; i < 600; i++) dot(r() * W, r() * H, 1 + r() * 1.5, 'rgba(0,0,0,0.5)', 0.15);
  }
  // đường bên thân và mang cá
  g.strokeStyle = 'rgba(255,255,255,0.25)';
  g.lineWidth = 2;
  g.beginPath();
  g.moveTo(0, H * 0.47);
  g.bezierCurveTo(W * 0.3, H * 0.44, W * 0.6, H * 0.4, W * 0.8, H * 0.38);
  g.stroke();
  g.strokeStyle = 'rgba(0,0,0,0.35)';
  g.lineWidth = 4;
  g.beginPath();
  g.arc(W * 0.95, H * 0.5, H * 0.38, Math.PI * 0.6, Math.PI * 1.4);
  g.stroke();
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 4;
  return tex;
}

function finShape(points) {
  const s = new THREE.Shape();
  s.moveTo(points[0][0], points[0][1]);
  for (let i = 1; i < points.length; i += 2) s.quadraticCurveTo(points[i][0], points[i][1], points[i + 1][0], points[i + 1][1]);
  return new THREE.ShapeGeometry(s, 8);
}

// Cá dài 1 đơn vị theo trục X, đầu quay về +X
export function makeFish(look, seed = 1) {
  const group = new THREE.Group();
  const h = look.h;
  const wr = look.ray ? 3.2 : look.flat ? 0.2 : look.eel ? 0.6 + look.eel * 0.4 : 0.46;
  const eel = look.eel || 0;
  const H = (u) => {
    let s = Math.pow(Math.max(0, Math.sin(Math.PI * Math.pow(u, 1.25))), 0.62);
    if (look.ray) s = Math.max(0, 1 - Math.abs(u - 0.55) / 0.45);
    const e = Math.min(1, u * 6, (1 - u) * 5);
    s = s * (1 - eel) + e * 0.8 * eel;
    return Math.max(s, 0.1 * (1 - Math.min(1, u / 0.15))) * h * 0.5;
  };
  const NU = 48;
  const NV = 28;
  const pos = [];
  const uv = [];
  const idx = [];
  for (let i = 0; i <= NU; i++) {
    const u = i / NU;
    const hu = H(u);
    for (let j = 0; j <= NV; j++) {
      const a = (j / NV) * Math.PI * 2;
      const cy = Math.sin(a);
      const cz = Math.cos(a);
      const belly = cy < 0 ? (look.ray ? 0.5 : 1.08) : 1;
      const wu = look.ray ? hu * wr : hu * wr * (1 - 0.25 * Math.abs(cy));
      pos.push(u - 0.5, cy * hu * belly, cz * wu);
      uv.push(u, (cy + 1) / 2);
    }
  }
  for (let i = 0; i < NU; i++) {
    for (let j = 0; j < NV; j++) {
      const a = i * (NV + 1) + j;
      const b = a + NV + 1;
      idx.push(a, b, a + 1, b, b + 1, a + 1);
    }
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  geo.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
  geo.setIndex(idx);
  geo.computeVertexNormals();

  const swim = { uSpeed: { value: 8 }, uAmp: { value: 0.06 }, uPhase: { value: 0 } };
  const map = fishTexture(look, seed);
  const bodyMat = new THREE.MeshPhysicalMaterial({
    map,
    roughness: 0.32,
    metalness: 0.2,
    clearcoat: 0.9,
    clearcoatRoughness: 0.15,
    emissive: look.glow ? new THREE.Color(look.glow) : new THREE.Color(0),
    emissiveMap: look.glow ? map : null,
    emissiveIntensity: look.glow ? 0.9 : 0,
  });
  bodyMat.onBeforeCompile = (shader) => {
    shader.uniforms.uTime = time;
    Object.assign(shader.uniforms, swim);
    shader.vertexShader = shader.vertexShader
      .replace('#include <common>', '#include <common>\nuniform float uTime; uniform float uSpeed; uniform float uAmp; uniform float uPhase;')
      .replace(
        '#include <begin_vertex>',
        `#include <begin_vertex>
        float tt = clamp(0.62 - position.x, 0.0, 1.2);
        transformed.z += sin(uTime * uSpeed + uPhase - position.x * 7.0) * uAmp * tt * tt;`,
      );
  };
  const body = new THREE.Mesh(geo, bodyMat);
  body.castShadow = true;
  group.add(body);

  const finMat = new THREE.MeshStandardMaterial({
    color: look.fin,
    side: THREE.DoubleSide,
    transparent: true,
    opacity: 0.88,
    roughness: 0.45,
    emissive: look.glow ? new THREE.Color(look.glow) : new THREE.Color(0),
    emissiveIntensity: look.glow ? 0.8 : 0,
  });

  // đuôi
  const tailPivot = new THREE.Group();
  tailPivot.position.x = -0.49;
  const th = look.ray ? 0.05 : Math.max(0.16, h * 0.62);
  const tail = look.ray
    ? new THREE.Mesh(new THREE.CylinderGeometry(0.004, 0.012, 0.9, 5).rotateZ(Math.PI / 2).translate(-0.45, 0, 0), finMat)
    : new THREE.Mesh(
      look.fork
        ? finShape([[0.02, 0], [-0.08, th * 0.25], [-0.24, th], [-0.15, th * 0.1], [-0.1, 0], [-0.15, -th * 0.1], [-0.24, -th], [-0.08, -th * 0.25], [0.02, 0]])
        : finShape([[0.02, 0], [-0.06, th * 0.4], [-0.18, th * 0.85], [-0.24, 0], [-0.18, -th * 0.85], [-0.06, -th * 0.4], [0.02, 0]]),
      finMat,
    );
  tailPivot.add(tail);
  group.add(tailPivot);

  if (!look.ray) {
    // vây lưng
    const dh = h * (look.eel ? 0.25 : 0.42);
    const dorsal = new THREE.Mesh(
      look.eel
        ? finShape([[-0.4, 0], [-0.1, dh * 1.2], [0.25, 0]])
        : finShape([[-0.16, 0], [-0.12, dh * 0.9], [0.06, dh], [0.14, dh * 0.4], [0.16, 0]]),
      finMat,
    );
    dorsal.position.set(look.eel ? 0 : -0.02, H(0.5) * 0.92, 0);
    group.add(dorsal);
    // vây hậu môn
    const anal = new THREE.Mesh(finShape([[-0.12, 0], [-0.1, -dh * 0.5], [0.02, -dh * 0.35], [0.02, 0], [0.0, 0]]), finMat);
    anal.position.set(-0.2, -H(0.3) * 0.95, 0);
    group.add(anal);
    // vây ngực
    for (const s of [-1, 1]) {
      const pec = new THREE.Mesh(finShape([[0, 0], [-0.04, -0.04], [-0.12, -0.03], [-0.06, 0.01], [0, 0]]), finMat);
      pec.position.set(0.24, -H(0.74) * 0.35, s * H(0.74) * wr * 0.9);
      pec.rotation.set(s * 0.6, s * 0.5, 0);
      group.add(pec);
    }
  }

  // mắt
  const eyeR = Math.max(0.022, h * 0.075);
  const eyeMat = new THREE.MeshPhysicalMaterial({ color: look.glow ? '#fff6c0' : '#e8d8a0', roughness: 0.1, clearcoat: 1 });
  const pupilMat = new THREE.MeshStandardMaterial({ color: '#050505', roughness: 0.05 });
  const eyeU = look.ray ? 0.82 : 0.86;
  for (const s of [-1, 1]) {
    const eye = new THREE.Mesh(new THREE.SphereGeometry(eyeR, 16, 10), eyeMat);
    const ey = look.ray ? H(eyeU) * 0.6 : H(eyeU) * 0.3;
    const ez = look.ray ? s * 0.06 : s * H(eyeU) * wr * 0.82;
    eye.position.set(eyeU - 0.5, ey, ez);
    const pupil = new THREE.Mesh(new THREE.SphereGeometry(eyeR * 0.62, 12, 8), pupilMat);
    pupil.position.set(eyeR * 0.15, 0, s * eyeR * 0.5);
    eye.add(pupil);
    group.add(eye);
  }

  // râu cá
  if (look.barbel) {
    const barbMat = new THREE.MeshStandardMaterial({ color: look.fin, roughness: 0.6 });
    for (const s of [-1, 1]) {
      const curve = new THREE.CatmullRomCurve3([
        new THREE.Vector3(0.49, -H(0.97) * 0.4, s * 0.01),
        new THREE.Vector3(0.52, -h * 0.12, s * h * 0.12),
        new THREE.Vector3(0.48, -h * 0.25, s * h * 0.25),
      ]);
      group.add(new THREE.Mesh(new THREE.TubeGeometry(curve, 8, 0.004, 4), barbMat));
    }
  }

  return {
    group,
    swim,
    setSwim(speed, amp) {
      swim.uSpeed.value = speed;
      swim.uAmp.value = amp;
    },
    update() {
      const ph = time.value * swim.uSpeed.value + swim.uPhase.value + 0.49 * 7;
      tailPivot.position.z = Math.sin(ph) * swim.uAmp.value * 1.24;
      tailPivot.rotation.y = -Math.cos(ph) * swim.uAmp.value * 5;
    },
    dispose() {
      group.traverse((o) => {
        if (o.geometry) o.geometry.dispose();
      });
      bodyMat.dispose();
      finMat.dispose();
      map.dispose();
    },
  };
}

// Cá trong hình: chiều dài thật theo cân nặng
export function fishLength(look, weight, wmax) {
  return look.len * (0.45 + 0.55 * Math.cbrt(weight / wmax)) * 1.25;
}

// ---------- Cần câu ----------

export const ROD_LOOK = {
  tre: { length: 3.4, r0: 0.024, r1: 0.006, color: '#c9a45a', alt: '#a8853f', grip: '#6a4a2a', metal: 0, rough: 0.6 },
  carbon: { length: 3.8, r0: 0.02, r1: 0.004, color: '#1c1e24', alt: '#b81e2a', grip: '#2a2a2a', metal: 0.4, rough: 0.25 },
  titan: { length: 4.0, r0: 0.021, r1: 0.004, color: '#aab4c0', alt: '#5a6472', grip: '#202428', metal: 0.85, rough: 0.2 },
  long: { length: 4.3, r0: 0.024, r1: 0.005, color: '#e4b23a', alt: '#c0261e', grip: '#5a1010', metal: 0.9, rough: 0.18, glow: '#ff6a00' },
};

export class Rod {
  constructor(kind) {
    this.group = new THREE.Group();
    this.look = ROD_LOOK[kind] || ROD_LOOK.tre;
    const L = this.look;
    this.N = 18;
    this.segs = [];
    const mainMat = new THREE.MeshStandardMaterial({ color: L.color, metalness: L.metal, roughness: L.rough, emissive: L.glow || '#000', emissiveIntensity: L.glow ? 0.15 : 0 });
    const altMat = new THREE.MeshStandardMaterial({ color: L.alt, metalness: L.metal, roughness: L.rough });
    const gripMat = new THREE.MeshStandardMaterial({ color: L.grip, roughness: 0.9 });
    const tipMat = new THREE.MeshStandardMaterial({ color: '#ff3b2f', emissive: '#ff2010', emissiveIntensity: 0.4 });
    for (let i = 0; i < this.N; i++) {
      const t0 = i / this.N;
      const t1 = (i + 1) / this.N;
      const grip = i < 2;
      const r0 = grip ? L.r0 * 1.6 : THREE.MathUtils.lerp(L.r0, L.r1, t0);
      const r1 = grip ? L.r0 * 1.5 : THREE.MathUtils.lerp(L.r0, L.r1, t1);
      const g = new THREE.CylinderGeometry(r1, r0, 1, 8, 1);
      g.translate(0, 0.5, 0);
      const mat = grip ? gripMat : i === this.N - 1 ? tipMat : i % 4 === 3 ? altMat : mainMat;
      const m = new THREE.Mesh(g, mat);
      m.castShadow = true;
      this.segs.push(m);
      this.group.add(m);
    }
    // ống cuộn dây
    this.reel = new THREE.Group();
    const metal = new THREE.MeshStandardMaterial({ color: '#c8ccd2', metalness: 0.9, roughness: 0.25 });
    const spool = new THREE.Mesh(new THREE.CylinderGeometry(0.045, 0.045, 0.05, 20), metal);
    spool.rotation.z = Math.PI / 2;
    const stem = new THREE.Mesh(new THREE.BoxGeometry(0.012, 0.06, 0.02), metal);
    stem.position.y = 0.04;
    this.crank = new THREE.Group();
    const arm = new THREE.Mesh(new THREE.BoxGeometry(0.01, 0.07, 0.012), metal);
    arm.position.y = 0.035;
    const knob = new THREE.Mesh(new THREE.CylinderGeometry(0.01, 0.01, 0.03, 8), new THREE.MeshStandardMaterial({ color: '#222' }));
    knob.position.set(0.018, 0.07, 0);
    knob.rotation.z = Math.PI / 2;
    this.crank.add(arm, knob);
    this.crank.position.x = 0.035;
    spool.position.y = -0.0;
    this.reel.add(spool, stem, this.crank);
    this.group.add(this.reel);
    this.tip = new THREE.Vector3();
    this.points = Array.from({ length: this.N + 1 }, () => new THREE.Vector3());
    this.spin = 0;
  }

  // base, dir: gốc và hướng cần (toạ độ thế giới); pull: điểm dây kéo về, bend: độ cong 0..1
  update(base, dir, pull, bend, reeling, dt) {
    const L = this.look.length;
    const rest = tmp.copy(base).addScaledVector(dir, L);
    if (pull && bend > 0) {
      const toward = tmp2.copy(pull).sub(rest).normalize();
      rest.addScaledVector(toward, bend * L * 0.42);
      rest.y -= bend * L * 0.08;
    } else {
      rest.y -= L * 0.03; // ngọn hơi rủ xuống vì trọng lượng
    }
    const end = rest.sub(base).normalize().multiplyScalar(L * (1 - bend * 0.08)).add(base);
    const ctrl = base.clone().addScaledVector(dir, L * 0.5);
    for (let i = 0; i <= this.N; i++) {
      const s = i / this.N;
      const a = (1 - s) * (1 - s);
      const b = 2 * (1 - s) * s;
      const c = s * s;
      this.points[i].set(
        a * base.x + b * ctrl.x + c * end.x,
        a * base.y + b * ctrl.y + c * end.y,
        a * base.z + b * ctrl.z + c * end.z,
      );
    }
    for (let i = 0; i < this.N; i++) {
      const p0 = this.points[i];
      const p1 = this.points[i + 1];
      const m = this.segs[i];
      m.position.copy(p0);
      tmp2.copy(p1).sub(p0);
      const len = tmp2.length();
      m.quaternion.setFromUnitVectors(UP, tmp2.normalize());
      m.scale.set(1, len, 1);
    }
    this.tip.copy(this.points[this.N]);
    // ống cuộn dưới cần, gần tay cầm
    const rp = this.points[2];
    const rd = tmp2.copy(this.points[3]).sub(rp).normalize();
    this.reel.position.copy(rp);
    this.reel.quaternion.setFromUnitVectors(new THREE.Vector3(0, 0, -1), rd);
    this.reel.rotateZ(Math.PI);
    this.reel.translateY(0.03);
    if (reeling) this.spin += dt * 14;
    this.crank.rotation.x = this.spin;
  }
}

// ---------- Dây câu (mô phỏng dây mềm) ----------

export class FishingLine {
  constructor(n = 34, color = '#eef6ff') {
    this.n = n;
    this.p = Array.from({ length: n }, () => new THREE.Vector3());
    this.prev = Array.from({ length: n }, () => new THREE.Vector3());
    this.geo = new THREE.BufferGeometry();
    this.arr = new Float32Array(n * 3);
    this.geo.setAttribute('position', new THREE.BufferAttribute(this.arr, 3));
    this.mesh = new THREE.Line(this.geo, new THREE.LineBasicMaterial({ color, transparent: true, opacity: 0.75 }));
    this.mesh.frustumCulled = false;
    this.length = 1;
    this.endFree = true;
    this.inited = false;
  }

  reset(at) {
    for (let i = 0; i < this.n; i++) {
      this.p[i].copy(at);
      this.prev[i].copy(at);
    }
    this.inited = true;
  }

  // tip: ngọn cần; end: đầu dây (phao/cá) nếu bị ghim; waterY: hàm độ cao mặt nước
  step(dt, tip, end, waterY) {
    if (!this.inited) this.reset(tip);
    dt = Math.min(dt, 0.033);
    const seg = this.length / (this.n - 1);
    for (let i = 1; i < this.n; i++) {
      const p = this.p[i];
      const v = tmp.copy(p).sub(this.prev[i]).multiplyScalar(0.97);
      this.prev[i].copy(p);
      p.add(v);
      p.y -= 9.8 * dt * dt;
      const wy = waterY(p.x, p.z);
      if (p.y < wy) {
        p.y = wy;
        this.prev[i].lerp(p, 0.5);
      }
    }
    for (let it = 0; it < 14; it++) {
      this.p[0].copy(tip);
      if (end) this.p[this.n - 1].copy(end);
      for (let i = 0; i < this.n - 1; i++) {
        const a = this.p[i];
        const b = this.p[i + 1];
        tmp.copy(b).sub(a);
        const d = tmp.length() || 1e-6;
        if (d <= seg) continue; // dây chỉ căng, không đẩy
        const diff = (d - seg) / d;
        const fixedA = i === 0;
        const fixedB = i + 1 === this.n - 1 && end;
        if (fixedA && fixedB) continue;
        if (fixedA) b.addScaledVector(tmp, -diff);
        else if (fixedB) a.addScaledVector(tmp, diff);
        else {
          a.addScaledVector(tmp, diff * 0.5);
          b.addScaledVector(tmp, -diff * 0.5);
        }
      }
    }
    for (let i = 0; i < this.n; i++) this.arr.set([this.p[i].x, this.p[i].y, this.p[i].z], i * 3);
    this.geo.attributes.position.needsUpdate = true;
  }

  get endPoint() {
    return this.p[this.n - 1];
  }
}

// ---------- Phao ----------

export function makeBobber() {
  const g = new THREE.Group();
  const red = new THREE.MeshStandardMaterial({ color: '#e8261c', roughness: 0.35, emissive: '#ff2000', emissiveIntensity: 0.1 });
  const white = new THREE.MeshStandardMaterial({ color: '#f4f4f0', roughness: 0.35 });
  const top = new THREE.Mesh(new THREE.SphereGeometry(0.075, 18, 10, 0, Math.PI * 2, 0, Math.PI / 2), red);
  const bot = new THREE.Mesh(new THREE.SphereGeometry(0.075, 18, 10, 0, Math.PI * 2, Math.PI / 2, Math.PI / 2), white);
  bot.scale.y = 1.5;
  const stick = new THREE.Mesh(new THREE.CylinderGeometry(0.008, 0.008, 0.2, 6), red);
  stick.position.y = 0.13;
  const glowMat = new THREE.MeshStandardMaterial({ color: '#c8ff9a', emissive: '#7dff3a', emissiveIntensity: 0 });
  const glow = new THREE.Mesh(new THREE.SphereGeometry(0.016, 8, 6), glowMat);
  glow.position.y = 0.24;
  g.add(top, bot, stick, glow);
  g.userData.glow = glowMat;
  g.traverse((o) => (o.castShadow = true));
  return g;
}

// ---------- Người câu ----------

function limb(mat, r) {
  const m = new THREE.Mesh(new THREE.CapsuleGeometry(r, 1, 4, 10), mat);
  m.castShadow = true;
  return m;
}

// đặt khúc tay/chân nối từ a tới b
function place(m, a, b, r) {
  m.position.copy(a).add(b).multiplyScalar(0.5);
  tmp.copy(b).sub(a);
  const len = tmp.length();
  m.quaternion.setFromUnitVectors(UP, tmp.normalize());
  m.scale.set(1, len / (1 + 2 * r) + 0.0001, 1);
}

// IK hai khúc: tìm khuỷu tay
function solveArm(S, T, a, b, hint) {
  const d = Math.min(tmp.copy(T).sub(S).length(), a + b - 1e-3);
  const dir = tmp.copy(T).sub(S).normalize();
  const x = (a * a - b * b + d * d) / (2 * d);
  const hgt = Math.sqrt(Math.max(0, a * a - x * x));
  const side = tmp2.copy(hint).addScaledVector(dir, -hint.dot(dir)).normalize();
  return S.clone().addScaledVector(dir, x).addScaledVector(side, hgt);
}

export const OUTFITS = [
  { shirt: '#2f6fb0', pants: '#3a3f4a', vest: '#7a7048' },
  { shirt: '#c0392b', pants: '#2c3440', vest: '#5a6040' },
  { shirt: '#3c8c4a', pants: '#4a3a2a', vest: '#8a7a50' },
  { shirt: '#e0a020', pants: '#2a3a4a', vest: '#4a5040' },
  { shirt: '#8e44ad', pants: '#30343c', vest: '#6a6a48' },
  { shirt: '#f0f0ea', pants: '#3a4a5a', vest: '#7a6a40' },
];

export class Angler {
  constructor({ hat = 'cap', outfit = 0, rod = 'tre' } = {}) {
    const o = OUTFITS[outfit % OUTFITS.length];
    this.group = new THREE.Group();
    const skin = new THREE.MeshStandardMaterial({ color: '#e0b48a', roughness: 0.7 });
    const shirt = new THREE.MeshStandardMaterial({ color: o.shirt, roughness: 0.85 });
    const pants = new THREE.MeshStandardMaterial({ color: o.pants, roughness: 0.9 });
    const vest = new THREE.MeshStandardMaterial({ color: o.vest, roughness: 0.9 });
    const boot = new THREE.MeshStandardMaterial({ color: '#2a2420', roughness: 0.7 });
    this.body = new THREE.Group();
    this.group.add(this.body);
    for (const s of [-1, 1]) {
      const leg = limb(pants, 0.075);
      leg.position.set(s * 0.1, 0.47, 0);
      leg.scale.y = 0.66;
      const shoe = new THREE.Mesh(new THREE.BoxGeometry(0.13, 0.09, 0.27), boot);
      shoe.position.set(s * 0.1, 0.05, -0.04);
      shoe.castShadow = true;
      this.body.add(leg, shoe);
    }
    const torso = new THREE.Mesh(new THREE.CapsuleGeometry(0.16, 0.36, 6, 14), shirt);
    torso.position.y = 1.17;
    torso.scale.set(1.12, 1, 0.72);
    torso.castShadow = true;
    const vestM = new THREE.Mesh(new THREE.CapsuleGeometry(0.168, 0.26, 6, 14), vest);
    vestM.position.y = 1.12;
    vestM.scale.set(1.14, 1, 0.78);
    vestM.castShadow = true;
    const belt = new THREE.Mesh(new THREE.CylinderGeometry(0.17, 0.17, 0.05, 16), new THREE.MeshStandardMaterial({ color: '#2a2018' }));
    belt.position.y = 0.88;
    belt.scale.set(1.1, 1, 0.75);
    const neck = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.055, 0.1, 8), skin);
    neck.position.y = 1.5;
    this.head = new THREE.Group();
    this.head.position.y = 1.62;
    const head = new THREE.Mesh(new THREE.SphereGeometry(0.115, 20, 14), skin);
    head.scale.set(0.95, 1.05, 1);
    head.castShadow = true;
    const hair = new THREE.Mesh(new THREE.SphereGeometry(0.118, 20, 14, 0, Math.PI * 2, 0, Math.PI * 0.55), new THREE.MeshStandardMaterial({ color: '#1e1a16' }));
    hair.position.set(0, 0.01, 0.01);
    this.head.add(head, hair);
    if (hat === 'nonla') {
      const m = new THREE.MeshStandardMaterial({ color: '#dcc68e', roughness: 0.85, side: THREE.DoubleSide });
      const cone = new THREE.Mesh(new THREE.ConeGeometry(0.33, 0.24, 32, 1, true), m);
      cone.position.y = 0.12;
      cone.castShadow = true;
      for (let k = 1; k < 5; k++) {
        const ring = new THREE.Mesh(new THREE.TorusGeometry(0.33 * (k / 5), 0.003, 4, 32), new THREE.MeshStandardMaterial({ color: '#b89a5a' }));
        ring.rotation.x = Math.PI / 2;
        ring.position.y = 0.12 + 0.12 - 0.24 * (k / 5);
        this.head.add(ring);
      }
      this.head.add(cone);
    } else if (hat === 'beanie') {
      const m = new THREE.MeshStandardMaterial({ color: '#c0392b', roughness: 0.95 });
      const b = new THREE.Mesh(new THREE.SphereGeometry(0.125, 16, 10, 0, Math.PI * 2, 0, Math.PI * 0.55), m);
      b.position.y = 0.02;
      const pom = new THREE.Mesh(new THREE.SphereGeometry(0.04, 10, 8), new THREE.MeshStandardMaterial({ color: '#f4f4f4' }));
      pom.position.y = 0.14;
      this.head.add(b, pom);
    } else {
      const m = new THREE.MeshStandardMaterial({ color: o.shirt, roughness: 0.8 });
      const crown = new THREE.Mesh(new THREE.SphereGeometry(0.122, 16, 10, 0, Math.PI * 2, 0, Math.PI * 0.5), m);
      crown.position.y = 0.025;
      const brim = new THREE.Mesh(new THREE.CylinderGeometry(0.09, 0.09, 0.012, 16, 1, false, 0, Math.PI), m);
      brim.position.set(0, 0.03, -0.1);
      brim.rotation.y = Math.PI / 2;
      brim.scale.z = 1.3;
      this.head.add(crown, brim);
    }
    this.body.add(torso, vestM, belt, neck, this.head);
    this.arms = [-1, 1].map((s) => {
      const up = limb(shirt, 0.05);
      const fore = limb(shirt, 0.045);
      const hand = new THREE.Mesh(new THREE.SphereGeometry(0.048, 10, 8), skin);
      this.body.add(up, fore, hand);
      return { s, up, fore, hand, shoulder: new THREE.Vector3(s * 0.23, 1.42, 0) };
    });
    this.rod = new Rod(rod);
    this.rodKind = rod;
    this.pitch = 0.55;
    this.aimYaw = 0;
    this.reeling = false;
    this.breath = Math.random() * 6;
    this._base = new THREE.Vector3();
    this._dir = new THREE.Vector3();
  }

  setRod(kind, scene) {
    if (kind === this.rodKind) return;
    scene.remove(this.rod.group);
    this.rod = new Rod(kind);
    this.rodKind = kind;
    scene.add(this.rod.group);
  }

  // toạ độ cục bộ của gốc cần và hướng cần
  localRod() {
    const p = this.pitch;
    const y = this.aimYaw;
    const dir = new THREE.Vector3(Math.sin(y) * Math.cos(p), Math.sin(p), -Math.cos(y) * Math.cos(p));
    const base = new THREE.Vector3(0.14, 1.0 + Math.max(0, Math.sin(p - 0.6)) * 0.25, -0.2);
    return { base, dir };
  }

  update(dt, pull, bend) {
    this.breath += dt;
    this.body.position.y = Math.sin(this.breath * 1.6) * 0.006;
    this.head.rotation.x = 0.12 + (pull ? 0.12 : 0);
    const { base, dir } = this.localRod();
    // tay phải cầm sau ống cuộn, tay trái cầm phía trước
    const right = base.clone().addScaledVector(dir, 0.1);
    if (this.reeling) {
      right.x += 0.05;
      right.y += Math.sin(this.breath * 14) * 0.035;
      right.z += Math.cos(this.breath * 14) * 0.035;
    }
    const left = base.clone().addScaledVector(dir, 0.42);
    for (const arm of this.arms) {
      const S = arm.shoulder.clone();
      const T = arm.s > 0 ? right : left;
      const E = solveArm(S, T, 0.3, 0.29, new THREE.Vector3(arm.s * 0.8, -0.6, 0.2));
      place(arm.up, S, E, 0.05);
      place(arm.fore, E, T, 0.045);
      arm.hand.position.copy(T);
    }
    this.group.updateMatrixWorld(true);
    this._base.copy(base).applyMatrix4(this.group.matrixWorld);
    this._dir.copy(dir).transformDirection(this.group.matrixWorld);
    this.rod.update(this._base, this._dir, pull, bend, this.reeling, dt);
  }
}

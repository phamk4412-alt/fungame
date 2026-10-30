// Mô hình 3D: cá, người câu, cần câu, dây câu, phao
import * as THREE from 'three';
import { rng, noise2 } from './noise.js';
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

// vảy cá nổi khối: dùng làm bump map và độ nhám
function scaleTexture(look) {
  const W = 512;
  const H = 256;
  const c = document.createElement('canvas');
  c.width = W;
  c.height = H;
  const g = c.getContext('2d');
  g.fillStyle = '#808080';
  g.fillRect(0, 0, W, H);
  const step = look.pattern === 'plain' || look.eel ? 7 : 10;
  for (let y = 0; y < H + step; y += step * 0.8) {
    for (let x = (Math.round(y / (step * 0.8)) % 2) * step * 0.5; x < W * 0.84; x += step) {
      const grd = g.createRadialGradient(x - step * 0.2, y, 0, x, y, step * 0.75);
      grd.addColorStop(0, '#d0d0d0');
      grd.addColorStop(0.75, '#9a9a9a');
      grd.addColorStop(1, '#505050');
      g.fillStyle = grd;
      g.beginPath();
      g.arc(x, y, step * 0.75, -Math.PI / 2, Math.PI / 2);
      g.fill();
    }
  }
  // đầu cá trơn, không vảy
  const head = g.createLinearGradient(W * 0.8, 0, W * 0.86, 0);
  head.addColorStop(0, 'rgba(128,128,128,0)');
  head.addColorStop(1, 'rgba(128,128,128,1)');
  g.fillStyle = head;
  g.fillRect(W * 0.8, 0, W * 0.2, H);
  const t = new THREE.CanvasTexture(c);
  t.anisotropy = 4;
  return t;
}

// vây: có tia vây, mép mỏng trong suốt
function finTexture(color, glow) {
  const c = document.createElement('canvas');
  c.width = c.height = 128;
  const g = c.getContext('2d');
  const base = new THREE.Color(color);
  const grd = g.createLinearGradient(0, 0, 128, 0);
  grd.addColorStop(0, `rgba(${base.r * 255},${base.g * 255},${base.b * 255},0.95)`);
  grd.addColorStop(1, `rgba(${base.r * 255},${base.g * 255},${base.b * 255},0.45)`);
  g.fillStyle = grd;
  g.fillRect(0, 0, 128, 128);
  g.strokeStyle = glow ? 'rgba(255,255,255,0.55)' : 'rgba(0,0,0,0.35)';
  g.lineWidth = 1.4;
  for (let i = -6; i <= 6; i++) {
    g.beginPath();
    g.moveTo(0, 64);
    g.quadraticCurveTo(64, 64 + i * 6, 128, 64 + i * 11);
    g.stroke();
  }
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

function eyeTexture(glow) {
  const c = document.createElement('canvas');
  c.width = c.height = 64;
  const g = c.getContext('2d');
  const grd = g.createRadialGradient(32, 32, 4, 32, 32, 32);
  grd.addColorStop(0, '#000');
  grd.addColorStop(0.42, '#000');
  grd.addColorStop(0.46, glow ? '#fff2a0' : '#d8b04a');
  grd.addColorStop(0.8, glow ? '#ffb000' : '#8a6a20');
  grd.addColorStop(1, '#2a2010');
  g.fillStyle = grd;
  g.fillRect(0, 0, 64, 64);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

// UV của vây theo khung bao, để tia vây chạy từ gốc ra mép
function finShape(points) {
  const s = new THREE.Shape();
  s.moveTo(points[0][0], points[0][1]);
  for (let i = 1; i < points.length; i += 2) s.quadraticCurveTo(points[i][0], points[i][1], points[i + 1][0], points[i + 1][1]);
  const g = new THREE.ShapeGeometry(s, 10);
  g.computeBoundingBox();
  const b = g.boundingBox;
  const p = g.attributes.position;
  const uv = g.attributes.uv;
  const x0 = points[0][0];
  const span = Math.max(Math.abs(b.max.x - x0), Math.abs(b.min.x - x0), 1e-3);
  const hy = Math.max(Math.abs(b.max.y), Math.abs(b.min.y), 1e-3);
  for (let i = 0; i < p.count; i++) uv.setXY(i, Math.abs(p.getX(i) - x0) / span, 0.5 + (p.getY(i) / hy) * 0.5);
  return g;
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
    // nắp mang nhô nhẹ, mõm thon lại
    if (!look.ray) s *= 1 + 0.035 * Math.exp(-Math.pow((u - 0.78) / 0.025, 2)) - 0.08 * Math.max(0, u - 0.93) / 0.07;
    return Math.max(s, 0.1 * (1 - Math.min(1, u / 0.15))) * h * 0.5;
  };
  const NU = 72;
  const NV = 40;
  const pos = [];
  const uv = [];
  const idx = [];
  for (let i = 0; i <= NU; i++) {
    const u = i / NU;
    const hu = H(u);
    // sống lưng cong hơn bụng, mõm hơi chúc xuống
    const camber = look.ray ? 0 : hu * 0.12 - Math.max(0, u - 0.85) * h * 0.25;
    for (let j = 0; j <= NV; j++) {
      const a = (j / NV) * Math.PI * 2;
      const cy = Math.sin(a);
      const cz = Math.cos(a);
      const belly = cy < 0 ? (look.ray ? 0.5 : 0.95) : look.ray ? 1 : 1.06;
      const wu = look.ray ? hu * wr : hu * wr * (1 - 0.22 * Math.abs(cy));
      // miệng: rãnh nhỏ ở đầu mõm
      const mouth = !look.ray && u > 0.965 && Math.abs(cy + 0.1) < 0.18 ? 0.75 : 1;
      pos.push(u - 0.5, cy * hu * belly * mouth + camber, cz * wu * mouth);
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
  const bump = scaleTexture(look);
  const bodyMat = new THREE.MeshPhysicalMaterial({
    map,
    bumpMap: bump,
    bumpScale: 1.2,
    roughness: 0.3,
    roughnessMap: bump,
    metalness: look.pattern === 'plain' || look.pattern === 'mackerel' ? 0.45 : 0.25,
    clearcoat: 1,
    clearcoatRoughness: 0.12,
    iridescence: 0.55,
    iridescenceIOR: 1.35,
    iridescenceThicknessRange: [180, 520],
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

  const finMap = finTexture(look.fin, look.glow);
  const finMat = new THREE.MeshPhysicalMaterial({
    map: finMap,
    side: THREE.DoubleSide,
    transparent: true,
    depthWrite: false,
    roughness: 0.35,
    transmission: 0.2,
    clearcoat: 0.6,
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
        ? finShape([[0.02, 0], [-0.08, th * 0.25], [-0.25, th], [-0.15, th * 0.1], [-0.11, 0], [-0.15, -th * 0.1], [-0.25, -th], [-0.08, -th * 0.25], [0.02, 0]])
        : finShape([[0.02, 0], [-0.06, th * 0.45], [-0.19, th * 0.85], [-0.22, 0.02], [-0.21, -0.02], [-0.19, -th * 0.85], [-0.06, -th * 0.45], [0.02, 0], [0.02, 0]]),
      finMat,
    );
  tailPivot.add(tail);
  group.add(tailPivot);

  const fins = [];
  if (!look.ray) {
    // vây lưng
    const dh = h * (look.eel ? 0.25 : 0.42);
    const dorsal = new THREE.Mesh(
      look.eel
        ? finShape([[-0.4, 0], [-0.1, dh * 1.2], [0.25, 0]])
        : finShape([[0.16, 0], [0.14, dh * 1.05], [0.02, dh * 0.9], [-0.12, dh * 0.5], [-0.16, 0]]),
      finMat,
    );
    dorsal.position.set(look.eel ? 0 : -0.02, H(0.5) * 1.0 + H(0.5) * 0.12, 0);
    group.add(dorsal);
    // vây mỡ của cá hồi
    if (look.pattern === 'trout') {
      const adipose = new THREE.Mesh(finShape([[0.03, 0], [0.0, 0.035], [-0.03, 0]]), finMat);
      adipose.position.set(-0.3, H(0.2) * 1.08, 0);
      group.add(adipose);
    }
    // vây hậu môn
    const anal = new THREE.Mesh(finShape([[0.04, 0], [0.0, -dh * 0.55], [-0.1, -dh * 0.4], [-0.12, -0.01], [-0.12, 0]]), finMat);
    anal.position.set(-0.2, -H(0.3) * 0.92, 0);
    group.add(anal);
    for (const s of [-1, 1]) {
      // vây ngực, phe phẩy
      const pec = new THREE.Mesh(finShape([[0, 0], [-0.03, -0.05], [-0.13, -0.04], [-0.07, 0.015], [0, 0]]), finMat);
      const pivot = new THREE.Group();
      pivot.position.set(0.22, -H(0.72) * 0.35, s * H(0.72) * wr * 0.92);
      pivot.rotation.set(s * 0.6, s * 0.5, 0);
      pivot.add(pec);
      group.add(pivot);
      fins.push({ pivot, s, base: s * 0.5 });
      // vây bụng
      const pel = new THREE.Mesh(finShape([[0, 0], [-0.03, -0.035], [-0.09, -0.03], [-0.05, 0.01], [0, 0]]), finMat);
      pel.position.set(0.02, -H(0.52) * 0.85, s * H(0.52) * wr * 0.5);
      pel.rotation.set(s * 0.9, s * 0.25, 0);
      group.add(pel);
    }
  }

  // mắt: tròng có viền vàng, giác mạc bóng
  const eyeR = Math.max(0.024, h * 0.08);
  const eyeTex = eyeTexture(look.glow);
  const irisMat = new THREE.MeshStandardMaterial({ map: eyeTex, roughness: 0.2, emissive: look.glow ? '#ffcc40' : '#000', emissiveIntensity: look.glow ? 0.4 : 0 });
  const corneaMat = new THREE.MeshPhysicalMaterial({ color: '#ffffff', roughness: 0.02, transmission: 1, thickness: 0.01, clearcoat: 1, transparent: true, opacity: 0.25 });
  const eyeU = look.ray ? 0.82 : 0.87;
  for (const s of [-1, 1]) {
    const eye = new THREE.Group();
    const ey = look.ray ? H(eyeU) * 0.6 : H(eyeU) * 0.28 + H(eyeU) * 0.12;
    const ez = look.ray ? s * 0.06 : s * H(eyeU) * wr * 0.8;
    eye.position.set(eyeU - 0.5, ey, ez);
    const iris = new THREE.Mesh(new THREE.CircleGeometry(eyeR, 24), irisMat);
    iris.rotation.y = s > 0 ? 0 : Math.PI;
    iris.position.z = s * 0.002;
    const cornea = new THREE.Mesh(new THREE.SphereGeometry(eyeR * 1.02, 16, 10, 0, Math.PI * 2, 0, Math.PI / 2), corneaMat);
    cornea.rotation.x = s * Math.PI / 2;
    cornea.scale.y = 0.45;
    eye.add(iris, cornea);
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
      group.add(new THREE.Mesh(new THREE.TubeGeometry(curve, 10, 0.004, 5), barbMat));
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
      for (const f of fins) f.pivot.rotation.y = f.base + Math.sin(time.value * 6 + f.s) * 0.25;
    },
    dispose() {
      group.traverse((o) => {
        if (o.geometry) o.geometry.dispose();
      });
      for (const m of [bodyMat, finMat, irisMat, corneaMat, map, bump, finMap, eyeTex]) m.dispose();
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
    // máy câu: lồng cuộn có dây, hai má kim loại, chân gắn cần, tay quay hai núm
    this.reel = new THREE.Group();
    const metal = new THREE.MeshStandardMaterial({ color: '#c8ccd2', metalness: 0.9, roughness: 0.25 });
    const dark = new THREE.MeshStandardMaterial({ color: '#2a2e34', metalness: 0.6, roughness: 0.35 });
    const lineMat = new THREE.MeshStandardMaterial({ color: '#dfe8e0', roughness: 0.5 });
    const spool = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.03, 0.046, 24), lineMat);
    spool.rotation.z = Math.PI / 2;
    const plates = [-1, 1].map((k) => {
      const p = new THREE.Mesh(new THREE.CylinderGeometry(0.046, 0.046, 0.01, 28), k < 0 ? dark : metal);
      p.rotation.z = Math.PI / 2;
      p.position.x = k * 0.029;
      return p;
    });
    const cap = new THREE.Mesh(new THREE.CylinderGeometry(0.022, 0.03, 0.012, 20), metal);
    cap.rotation.z = Math.PI / 2;
    cap.position.x = 0.039;
    const stem = new THREE.Mesh(new THREE.BoxGeometry(0.014, 0.05, 0.03), dark);
    stem.position.y = 0.045;
    const foot = new THREE.Mesh(new THREE.BoxGeometry(0.016, 0.006, 0.07), metal);
    foot.position.y = 0.07;
    this.crank = new THREE.Group();
    const arm = new THREE.Mesh(new THREE.BoxGeometry(0.006, 0.11, 0.014), metal);
    const knobMat = new THREE.MeshStandardMaterial({ color: '#141414', roughness: 0.6 });
    for (const k of [-1, 1]) {
      const knob = new THREE.Mesh(new THREE.CapsuleGeometry(0.009, 0.016, 4, 10), knobMat);
      knob.rotation.z = Math.PI / 2;
      knob.position.set(0.016, k * 0.05, 0);
      this.crank.add(knob);
    }
    this.crank.add(arm);
    this.crank.position.x = 0.05;
    this.reel.add(spool, ...plates, cap, stem, foot, this.crank);
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

// vải: caro cho áo, bò cho quần, vải dù cho áo gile
const texCache = new Map();
function clothTexture(kind, color) {
  const key = kind + color;
  if (texCache.has(key)) return texCache.get(key);
  const c = document.createElement('canvas');
  c.width = c.height = 128;
  const g = c.getContext('2d');
  const base = new THREE.Color(color);
  g.fillStyle = `#${base.getHexString()}`;
  g.fillRect(0, 0, 128, 128);
  const r = rng(kind.length * 31 + c.width);
  if (kind === 'plaid') {
    const dark = base.clone().multiplyScalar(0.55);
    const light = base.clone().lerp(new THREE.Color('#ffffff'), 0.35);
    g.globalAlpha = 0.55;
    g.fillStyle = `#${dark.getHexString()}`;
    for (let i = 0; i < 128; i += 32) {
      g.fillRect(i, 0, 12, 128);
      g.fillRect(0, i, 128, 12);
    }
    g.globalAlpha = 0.5;
    g.fillStyle = `#${light.getHexString()}`;
    for (let i = 20; i < 128; i += 32) {
      g.fillRect(i, 0, 2, 128);
      g.fillRect(0, i, 128, 2);
    }
  }
  // sợi vải li ti
  g.globalAlpha = kind === 'denim' ? 0.25 : 0.12;
  for (let i = 0; i < 2200; i++) {
    g.fillStyle = r() < 0.5 ? '#000' : '#fff';
    const x = r() * 128;
    const y = r() * 128;
    if (kind === 'denim') g.fillRect(x, y, 3, 1);
    else g.fillRect(x, y, 1, 1);
  }
  g.globalAlpha = 1;
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.repeat.set(kind === 'plaid' ? 3 : 2, kind === 'plaid' ? 3 : 4);
  texCache.set(key, t);
  return t;
}

// khúc tay chân thuôn, cao 1 đơn vị dọc trục Y, có khớp tròn ở đầu
function segment(mat, r0, r1) {
  const g = new THREE.CylinderGeometry(r1, r0, 1, 14, 1, false);
  const m = new THREE.Mesh(g, mat);
  m.castShadow = true;
  return m;
}

function joint(mat, r) {
  const m = new THREE.Mesh(new THREE.SphereGeometry(r, 14, 10), mat);
  m.castShadow = true;
  return m;
}

// đặt khúc nối từ a tới b
function place(m, a, b) {
  m.position.copy(a).add(b).multiplyScalar(0.5);
  tmp.copy(b).sub(a);
  const len = tmp.length();
  m.quaternion.setFromUnitVectors(UP, tmp.normalize());
  m.scale.set(1, len + 0.0001, 1);
}

// Bàn tay nắm quanh cán cần. Trục +Y hướng về khuỷu tay, cán cần chạy dọc trục X.
// Bốn ngón gồm ba đốt cuộn tròn quanh cán, ngón cái ôm chéo, có móng tay.
function makeHand(skin, s) {
  const hand = new THREE.Group();
  const nailMat = new THREE.MeshStandardMaterial({ color: '#e8c0b0', roughness: 0.25 });
  const palm = new THREE.Mesh(new THREE.SphereGeometry(0.05, 18, 14), skin);
  palm.scale.set(0.95, 0.85, 0.5);
  palm.position.set(0, -0.035, 0.012);
  hand.add(palm);
  const wrist = new THREE.Mesh(new THREE.SphereGeometry(0.034, 14, 10), skin);
  wrist.scale.set(1.1, 1, 0.75);
  hand.add(wrist);
  // tâm cán cần nằm trước lòng bàn tay
  const cy = -0.07;
  const cz = -0.024;
  const R = 0.027;
  const at = (x, deg, r = R) => new THREE.Vector3(x, cy + Math.cos((deg * Math.PI) / 180) * r, cz + Math.sin((deg * Math.PI) / 180) * r);
  const lens = [0.92, 1, 0.97, 0.82];
  [-0.026, -0.009, 0.009, 0.025].forEach((x, i) => {
    const L = lens[i];
    const pts = [at(x * 1.05, 30, R * 1.25), at(x, -60 * L, R * 1.15), at(x, -150 * L, R * 1.1), at(x * 0.95, -215 * L, R * 1.02)];
    for (let k = 0; k < 3; k++) {
      const rr = 0.0105 - k * 0.0012;
      const seg = segment(skin, rr, rr * 0.92);
      place(seg, pts[k], pts[k + 1]);
      hand.add(seg);
      const kn = joint(skin, rr * 1.02);
      kn.position.copy(pts[k]);
      hand.add(kn);
    }
    const tipJ = joint(skin, 0.0085);
    tipJ.position.copy(pts[3]);
    const nail = new THREE.Mesh(new THREE.SphereGeometry(0.0075, 8, 6), nailMat);
    nail.scale.set(1, 0.4, 1.2);
    nail.position.copy(pts[3]).add(new THREE.Vector3(0, 0.002, 0.004));
    hand.add(tipJ, nail);
  });
  // ngón cái: từ gò cái vòng qua cán, đè lên ngón trỏ
  const t0 = new THREE.Vector3(s * -0.04, -0.03, -0.004);
  const t1 = new THREE.Vector3(s * -0.045, -0.062, -0.042);
  const t2 = new THREE.Vector3(s * -0.018, -0.08, -0.058);
  const mound = joint(skin, 0.02);
  mound.scale.set(1, 1.3, 1);
  mound.position.copy(t0);
  const a = segment(skin, 0.0135, 0.012);
  place(a, t0, t1);
  const b = segment(skin, 0.012, 0.0105);
  place(b, t1, t2);
  const kn = joint(skin, 0.012);
  kn.position.copy(t1);
  const tip = joint(skin, 0.0105);
  tip.position.copy(t2);
  hand.add(mound, a, b, kn, tip);
  hand.traverse((m) => (m.castShadow = true));
  return hand;
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

// thân người dựng bằng mặt tiện: hông, eo, ngực, vai
function torsoGeo(scale = 1, phiStart = 0, phiLength = Math.PI * 2) {
  const prof = [
    [0.0, 0.0], [0.148, 0.0], [0.155, 0.06], [0.145, 0.16], [0.15, 0.26], [0.168, 0.38], [0.178, 0.46], [0.17, 0.53], [0.13, 0.585], [0.06, 0.61], [0.0, 0.615],
  ].map(([r, y]) => new THREE.Vector2(r * scale, y));
  const g = new THREE.LatheGeometry(prof, 28, phiStart, phiLength);
  g.scale(1.08, 1, 0.68);
  return g;
}

export const OUTFITS = [
  { shirt: '#2f6fb0', pants: '#33415a', vest: '#6f6a48', skin: '#d8a982', hair: '#1c1612' },
  { shirt: '#b0332a', pants: '#2c3440', vest: '#56603e', skin: '#c99872', hair: '#2a1f18' },
  { shirt: '#3c7c4a', pants: '#4a3e30', vest: '#80744c', skin: '#e2b994', hair: '#15110e' },
  { shirt: '#d89a1e', pants: '#2a3a4a', vest: '#4a5040', skin: '#b98a62', hair: '#3a2a1c' },
  { shirt: '#6e4a9e', pants: '#30343c', vest: '#66664a', skin: '#e8c4a0', hair: '#4a3020' },
  { shirt: '#e8e6dc', pants: '#3a4a5a', vest: '#7a6a40', skin: '#c48e66', hair: '#0f0d0c' },
];

export class Angler {
  constructor({ hat = 'cap', outfit = 0, rod = 'tre' } = {}) {
    const o = OUTFITS[outfit % OUTFITS.length];
    this.group = new THREE.Group();
    const skin = new THREE.MeshPhysicalMaterial({ color: o.skin, roughness: 0.55, sheen: 0.4, sheenColor: new THREE.Color('#ff9a7a'), sheenRoughness: 0.6 });
    const shirt = new THREE.MeshStandardMaterial({ map: clothTexture('plaid', o.shirt), roughness: 0.9 });
    const pants = new THREE.MeshStandardMaterial({ map: clothTexture('denim', o.pants), roughness: 0.95 });
    const vest = new THREE.MeshStandardMaterial({ map: clothTexture('canvas', o.vest), roughness: 0.92, side: THREE.DoubleSide });
    const leather = new THREE.MeshStandardMaterial({ color: '#3a2a1e', roughness: 0.55 });
    const sole = new THREE.MeshStandardMaterial({ color: '#141210', roughness: 0.8 });
    const hairMat = new THREE.MeshStandardMaterial({ color: o.hair, roughness: 0.75 });
    this.body = new THREE.Group();
    this.group.add(this.body);
    const add = (m) => {
      m.castShadow = true;
      this.body.add(m);
      return m;
    };

    // chân: đùi, gối, bắp chân, giày
    this.legs = [-1, 1].map((s) => {
      const hip = new THREE.Vector3(s * 0.095, 0.93, 0);
      const knee = new THREE.Vector3(s * 0.1, 0.51, -0.035);
      const ankle = new THREE.Vector3(s * 0.1, 0.11, 0.0);
      const thigh = add(segment(pants, 0.088, 0.066));
      place(thigh, hip, knee);
      add(joint(pants, 0.066)).position.copy(knee);
      const calf = add(segment(pants, 0.064, 0.05));
      place(calf, knee, ankle);
      const boot = new THREE.Group();
      const upper = new THREE.Mesh(new THREE.CylinderGeometry(0.055, 0.06, 0.13, 12), leather);
      upper.position.y = 0.09;
      const foot = new THREE.Mesh(new THREE.SphereGeometry(0.06, 14, 10), leather);
      foot.scale.set(0.95, 0.6, 2.1);
      foot.position.set(0, 0.045, -0.055);
      const so = new THREE.Mesh(new THREE.BoxGeometry(0.11, 0.025, 0.28), sole);
      so.position.set(0, 0.012, -0.05);
      boot.add(upper, foot, so);
      boot.position.set(s * 0.1, 0, 0);
      boot.rotation.y = s * -0.12;
      boot.traverse((m) => (m.castShadow = true));
      this.body.add(boot);
      return { thigh, calf };
    });

    // hông, thân, áo gile hở trước, thắt lưng
    const pelvis = add(new THREE.Mesh(new THREE.SphereGeometry(0.16, 20, 12), pants));
    pelvis.scale.set(1.08, 0.7, 0.72);
    pelvis.position.y = 0.92;
    const torso = add(new THREE.Mesh(torsoGeo(1), shirt));
    torso.position.y = 0.9;
    const vestM = add(new THREE.Mesh(torsoGeo(1.06, Math.PI * 1.1, Math.PI * 1.8), vest));
    vestM.position.y = 0.94;
    vestM.scale.y = 0.82;
    for (const s of [-1, 1]) {
      // túi áo gile
      const pocket = add(new THREE.Mesh(new THREE.BoxGeometry(0.085, 0.09, 0.03), vest));
      pocket.position.set(s * 0.085, 1.1, -0.115);
      pocket.rotation.y = s * 0.35;
      const flap = add(new THREE.Mesh(new THREE.BoxGeometry(0.09, 0.025, 0.035), vest));
      flap.position.set(s * 0.085, 1.155, -0.118);
      flap.rotation.y = s * 0.35;
    }
    const belt = add(new THREE.Mesh(new THREE.TorusGeometry(0.152, 0.02, 6, 28), leather));
    belt.rotation.x = Math.PI / 2;
    belt.scale.set(1.08, 0.7, 1);
    belt.position.y = 0.96;
    const buckle = add(new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.035, 0.012), new THREE.MeshStandardMaterial({ color: '#c8b070', metalness: 0.9, roughness: 0.3 })));
    buckle.position.set(0, 0.96, -0.108);
    const collar = add(new THREE.Mesh(new THREE.TorusGeometry(0.068, 0.02, 8, 20), shirt));
    collar.rotation.x = Math.PI / 2 - 0.2;
    collar.position.set(0, 1.5, 0.005);

    // cổ, đầu, mặt
    const neck = add(new THREE.Mesh(new THREE.CylinderGeometry(0.048, 0.058, 0.12, 12), skin));
    neck.position.y = 1.54;
    this.head = new THREE.Group();
    this.head.position.y = 1.66;
    this.body.add(this.head);
    const hp = (m) => {
      m.castShadow = true;
      this.head.add(m);
      return m;
    };
    const skull = hp(new THREE.Mesh(new THREE.SphereGeometry(0.105, 24, 18), skin));
    skull.scale.set(0.92, 1.06, 1.02);
    const jaw = hp(new THREE.Mesh(new THREE.SphereGeometry(0.08, 18, 12), skin));
    jaw.scale.set(1, 0.85, 1.05);
    jaw.position.set(0, -0.05, -0.018);
    const nose = hp(new THREE.Mesh(new THREE.ConeGeometry(0.017, 0.045, 8), skin));
    nose.rotation.x = -Math.PI / 2 + 0.3;
    nose.position.set(0, -0.012, -0.105);
    for (const s of [-1, 1]) {
      const ear = hp(new THREE.Mesh(new THREE.SphereGeometry(0.024, 10, 8), skin));
      ear.scale.set(0.45, 1, 0.8);
      ear.position.set(s * 0.096, -0.005, 0.005);
      const white = hp(new THREE.Mesh(new THREE.SphereGeometry(0.014, 10, 8), new THREE.MeshStandardMaterial({ color: '#f2efe8', roughness: 0.2 })));
      white.position.set(s * 0.036, 0.016, -0.088);
      const iris = hp(new THREE.Mesh(new THREE.SphereGeometry(0.0075, 8, 6), new THREE.MeshStandardMaterial({ color: '#2a1a10', roughness: 0.1 })));
      iris.position.set(s * 0.036, 0.016, -0.1);
      const brow = hp(new THREE.Mesh(new THREE.BoxGeometry(0.036, 0.008, 0.012), hairMat));
      brow.position.set(s * 0.036, 0.036, -0.094);
      brow.rotation.z = s * -0.12;
    }
    const mouth = hp(new THREE.Mesh(new THREE.BoxGeometry(0.03, 0.005, 0.006), new THREE.MeshStandardMaterial({ color: '#8a4a3a' })));
    mouth.position.set(0, -0.058, -0.094);
    // tóc: chỏm có nhấp nhô, phủ gáy
    const hairGeo = new THREE.SphereGeometry(0.11, 24, 16, 0, Math.PI * 2, 0, Math.PI * 0.62);
    const hpos = hairGeo.attributes.position;
    for (let i = 0; i < hpos.count; i++) {
      tmp.fromBufferAttribute(hpos, i);
      const k = 1 + noise2(tmp.x * 90, tmp.z * 90, 3) * 0.06;
      hpos.setXYZ(i, tmp.x * k, tmp.y * k, tmp.z * k);
    }
    hairGeo.computeVertexNormals();
    const hair = hp(new THREE.Mesh(hairGeo, hairMat));
    hair.scale.set(0.95, 1.05, 1.05);
    hair.position.set(0, 0.01, 0.012);
    hair.rotation.x = -0.35;

    if (hat === 'nonla') {
      const m = new THREE.MeshStandardMaterial({ map: nonLaTexture(), roughness: 0.85, side: THREE.DoubleSide });
      const cone = hp(new THREE.Mesh(new THREE.ConeGeometry(0.34, 0.25, 40, 1, true), m));
      cone.position.y = 0.15;
      const rim = hp(new THREE.Mesh(new THREE.TorusGeometry(0.34, 0.006, 5, 40), new THREE.MeshStandardMaterial({ color: '#a8884a' })));
      rim.rotation.x = Math.PI / 2;
      rim.position.y = 0.025;
      // quai nón
      const strap = hp(new THREE.Mesh(new THREE.TorusGeometry(0.1, 0.004, 4, 24, Math.PI), new THREE.MeshStandardMaterial({ color: '#c0302a' })));
      strap.position.set(0, -0.02, 0);
      strap.rotation.set(Math.PI, Math.PI / 2, 0);
    } else if (hat === 'beanie') {
      const knit = new THREE.MeshStandardMaterial({ map: clothTexture('denim', '#b0302a'), roughness: 1 });
      const b = hp(new THREE.Mesh(new THREE.SphereGeometry(0.118, 20, 12, 0, Math.PI * 2, 0, Math.PI * 0.55), knit));
      b.position.y = 0.022;
      const cuff = hp(new THREE.Mesh(new THREE.TorusGeometry(0.108, 0.018, 8, 24), knit));
      cuff.rotation.x = Math.PI / 2;
      cuff.position.y = 0.02;
      const pom = hp(new THREE.Mesh(new THREE.IcosahedronGeometry(0.036, 2), new THREE.MeshStandardMaterial({ color: '#f4f4f4', roughness: 1 })));
      pom.position.y = 0.14;
    } else {
      const m = new THREE.MeshStandardMaterial({ map: clothTexture('canvas', '#4a5a3a'), roughness: 0.85 });
      const crown = hp(new THREE.Mesh(new THREE.SphereGeometry(0.114, 20, 12, 0, Math.PI * 2, 0, Math.PI * 0.5), m));
      crown.position.y = 0.03;
      crown.scale.set(1, 0.9, 1.05);
      const brim = hp(new THREE.Mesh(new THREE.CylinderGeometry(0.095, 0.095, 0.01, 20, 1, false, 0, Math.PI), m));
      brim.position.set(0, 0.035, -0.09);
      brim.rotation.set(0.12, Math.PI / 2, 0);
      brim.scale.z = 1.3;
    }

    // tay: vai, bắp tay áo, khuỷu, cẳng tay xắn áo, bàn tay nắm cần
    this.arms = [-1, 1].map((s) => {
      const shoulderJ = add(joint(shirt, 0.068));
      const up = add(segment(shirt, 0.062, 0.05));
      const elbow = add(joint(shirt, 0.05));
      const cuff = add(segment(shirt, 0.05, 0.05));
      const fore = add(segment(skin, 0.042, 0.032));
      const hand = makeHand(skin, s);
      this.body.add(hand);
      // khuỷu tay trần, chỉ hiện ở góc nhìn thứ nhất cho cẳng tay khỏi bị cụt
      const bare = add(joint(skin, 0.044));
      bare.scale.set(1, 1.15, 1);
      bare.visible = false;
      return { s, shoulderJ, up, elbow, cuff, fore, hand, bare, shoulder: new THREE.Vector3(s * 0.19, 1.42, 0) };
    });
    this.rod = new Rod(rod);
    this.rodKind = rod;
    this.pitch = 0.55;
    this.aimYaw = 0;
    this.lean = 0;
    this.fp = false; // góc nhìn thứ nhất: chỉ hiện cẳng tay, bàn tay và cần
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

  setFirstPerson(on) {
    this.fp = on;
    const keep = new Set();
    for (const arm of this.arms) for (const m of [arm.fore, arm.hand, arm.bare]) keep.add(m);
    for (const c of this.body.children) c.visible = !on || keep.has(c);
    for (const arm of this.arms) arm.bare.visible = on;
  }

  // toạ độ cục bộ của gốc cần và hướng cần
  localRod() {
    const p = this.pitch;
    const y = this.aimYaw;
    const dir = new THREE.Vector3(Math.sin(y) * Math.cos(p), Math.sin(p), -Math.cos(y) * Math.cos(p));
    // góc nhìn thứ nhất: cần đưa ra trước ngực cho thấy hai tay và ống cuộn ở đáy màn hình
    const base = this.fp
      ? new THREE.Vector3(0.15 + this.lean * 0.05 + Math.sin(y) * 0.1, 1.2 + Math.max(0, Math.sin(p - 0.6)) * 0.12, -0.55)
      : new THREE.Vector3(0.12 + this.lean * 0.08, 1.0 + Math.max(0, Math.sin(p - 0.6)) * 0.25, -0.2);
    return { base, dir };
  }

  update(dt, pull, bend) {
    this.breath += dt;
    this.body.position.y = Math.sin(this.breath * 1.6) * 0.006;
    // nghiêng người theo hướng ghì cần
    this.body.rotation.z = THREE.MathUtils.lerp(this.body.rotation.z, -this.lean * 0.09, Math.min(1, dt * 6));
    this.body.rotation.x = THREE.MathUtils.lerp(this.body.rotation.x, bend > 0.3 ? 0.08 : 0, Math.min(1, dt * 4));
    this.head.rotation.x = 0.12 + (pull ? 0.12 : 0);
    this.head.rotation.y = this.aimYaw * -0.5;
    const { base, dir } = this.localRod();
    // tay phải cầm sau ống cuộn, tay trái cầm phía trước
    const right = base.clone().addScaledVector(dir, 0.1);
    if (this.reeling) {
      right.x += 0.05;
      right.y += Math.sin(this.breath * 14) * 0.035;
      right.z += Math.cos(this.breath * 14) * 0.035;
    }
    const left = base.clone().addScaledVector(dir, this.fp ? 0.3 : 0.42);
    for (const arm of this.arms) {
      const S = arm.shoulder.clone();
      if (this.fp) S.z -= 0.12; // người rướn ra trước

      const T = arm.s > 0 ? right : left;
      const E = solveArm(S, T, 0.29, 0.27, new THREE.Vector3(arm.s * 0.8, -0.6, 0.25));
      arm.shoulderJ.position.copy(S);
      place(arm.up, S, E);
      arm.elbow.position.copy(E);
      arm.bare.position.copy(E);
      const mid = E.clone().lerp(T, 0.22);
      place(arm.cuff, E, mid);
      place(arm.fore, mid, T);
      // bàn tay quay theo cẳng tay, các ngón cuộn quanh cán cần
      const hy = tmp.copy(E).sub(T).normalize();
      const hx = tmp2.copy(dir).addScaledVector(hy, -dir.dot(hy));
      if (hx.lengthSq() < 1e-4) hx.set(1, 0, 0);
      hx.normalize();
      const hz = new THREE.Vector3().crossVectors(hx, hy);
      arm.hand.quaternion.setFromRotationMatrix(new THREE.Matrix4().makeBasis(hx, hy, hz));
      // cổ tay lùi ra sau để tâm nắm tay nằm đúng trên cán cần
      const W = T.clone().addScaledVector(hy, 0.07).addScaledVector(hz, 0.024);
      arm.hand.position.copy(W);
      // góc nhìn thứ nhất không có khuỷu và tay áo nên cẳng tay kéo dài từ khuỷu
      place(arm.fore, this.fp ? E : mid, W);
    }
    this.group.updateMatrixWorld(true);
    this._base.copy(base).applyMatrix4(this.group.matrixWorld);
    this._dir.copy(dir).transformDirection(this.group.matrixWorld);
    this.rod.update(this._base, this._dir, pull, bend, this.reeling, dt);
  }
}

let nonLaTex = null;
function nonLaTexture() {
  if (nonLaTex) return nonLaTex;
  const c = document.createElement('canvas');
  c.width = 256;
  c.height = 64;
  const g = c.getContext('2d');
  g.fillStyle = '#dcc68e';
  g.fillRect(0, 0, 256, 64);
  const r = rng(5);
  // lá nón xếp dọc, vòng nan ngang
  for (let x = 0; x < 256; x += 6) {
    g.fillStyle = `rgba(120,90,40,${0.12 + r() * 0.12})`;
    g.fillRect(x, 0, 1, 64);
  }
  for (let y = 4; y < 64; y += 10) {
    g.fillStyle = 'rgba(140,105,50,0.45)';
    g.fillRect(0, y, 256, 1.5);
  }
  nonLaTex = new THREE.CanvasTexture(c);
  nonLaTex.colorSpace = THREE.SRGBColorSpace;
  return nonLaTex;
}

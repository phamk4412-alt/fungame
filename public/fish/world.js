// Thế giới 3D của game câu cá: địa hình quanh hồ, mặt nước phản chiếu, bầu trời, ngày đêm, cây cối
import * as THREE from 'three';
import { Water } from 'three/addons/objects/Water.js';
import { Sky } from 'three/addons/objects/Sky.js';
import { mergeGeometries, mergeVertices } from 'three/addons/utils/BufferGeometryUtils.js';
import { rng, fbm, ridge, noise2, smoothstep, lerp, clamp } from './noise.js';

export const QUALITY = {
  thap: { name: 'Thấp', ratio: 1, shadows: 0, reflection: 256, bloom: false, veg: 0.35, grass: 0, seg: 170, clouds: 10 },
  vua: { name: 'Vừa', ratio: 1.5, shadows: 1024, reflection: 512, bloom: true, veg: 0.7, grass: 9000, seg: 230, clouds: 18 },
  cao: { name: 'Cao', ratio: 2, shadows: 2048, reflection: 1024, bloom: true, veg: 1, grass: 26000, seg: 300, clouds: 26 },
};

export const THEMES = {
  sen: {
    seed: 11, center: [0, 0], R: [74, 56], depth: 5, edge: 0.2, hills: 9, mountains: 70, base: 3,
    colors: { mud: '#4b4530', sand: '#a08e64', grass: '#4d7a2a', grass2: '#7d9f3c', rock: '#77705d' },
    snowLine: null, rockLine: 40,
    water: { color: '#1f4a36', shallow: '#4f7a44', foam: '#e4ecd8', distortion: 1.1, size: 3.5, waves: 1 },
    trees: [['bamboo', 110], ['broad', 170], ['palm', 70]],
    swamp: 34, // cây bụt mọc rủ rêu đứng trong nước
    grass: ['#3f6e22', '#a6c457'], lotus: true, reeds: true, fireflies: true, flowers: ['#ff8fb8', '#fff3a0', '#ffffff'],
    hut: 'choi', hat: 'nonla', fog: 0.0015, mist: 0.004, sky: { turbidity: 2.4, rayleigh: 2 },
  },
  thong: {
    seed: 23, center: [0, 0], R: [88, 64], depth: 9, edge: 0.25, hills: 22, mountains: 150, base: 6,
    colors: { mud: '#3d3a2c', sand: '#857a5c', grass: '#3a5a26', grass2: '#56733a', rock: '#6b6a64' },
    snowLine: 120, rockLine: 30,
    water: { color: '#123c44', shallow: '#4c6e58', foam: '#e8f0ee', distortion: 0.9, size: 3.2, waves: 0.8 },
    trees: [['pine', 520], ['broad', 40]],
    swamp: 16,
    grass: ['#2f4f1e', '#86a650'], reeds: true, fireflies: true, flowers: ['#ffe066', '#b0a0ff'],
    hut: 'cabin', hat: 'cap', fog: 0.0017, mist: 0.007, sky: { turbidity: 2.6, rayleigh: 1.8 },
  },
  vinh: {
    seed: 37, center: [0, -170], R: [340, 262], depth: 14, edge: 0.12, hills: 26, mountains: 110, base: 2, karst: true,
    colors: { mud: '#6d6650', sand: '#d6c697', grass: '#4f7a32', grass2: '#6f9640', rock: '#8c8a80' },
    snowLine: null, rockLine: 12,
    water: { color: '#0d5f63', shallow: '#3fb8a8', foam: '#f4fbf8', distortion: 2.2, size: 2.2, waves: 1.8 },
    trees: [['palm', 120], ['broad', 90]],
    grass: ['#56782c', '#c4c46a'], hut: 'raft', hat: 'nonla', fog: 0.001, mist: 0.002, sky: { turbidity: 2.2, rayleigh: 1.9 },
  },
  bang: {
    seed: 51, center: [0, 0], R: [92, 66], depth: 10, edge: 0.22, hills: 26, mountains: 190, base: 7,
    colors: { mud: '#3c4248', sand: '#c9d2d8', grass: '#e6edf2', grass2: '#ffffff', rock: '#5c646c' },
    snowLine: 0, rockLine: 20,
    water: { color: '#0c2a3a', shallow: '#4f7f94', foam: '#ffffff', distortion: 0.8, size: 3.6, waves: 0.6 },
    trees: [['pine', 340]],
    grass: null, snow: true, ice: true, aurora: true,
    hut: 'igloo', hat: 'beanie', fog: 0.002, mist: 0.004, sky: { turbidity: 2, rayleigh: 1.4 },
  },
};

export const time = { value: 0 }; // đồng hồ chung cho mọi shader

const tmpV = new THREE.Vector3();
const tmpC = new THREE.Color();

function col(hex) {
  return new THREE.Color(hex);
}

function paint(geo, color) {
  const c = color instanceof THREE.Color ? color : col(color);
  const n = geo.attributes.position.count;
  const arr = new Float32Array(n * 3);
  for (let i = 0; i < n; i++) arr.set([c.r, c.g, c.b], i * 3);
  geo.setAttribute('color', new THREE.BufferAttribute(arr, 3));
  return geo;
}

function clean(geo) {
  geo = geo.index ? geo.toNonIndexed() : geo;
  geo.deleteAttribute('uv');
  return geo;
}

function blob(r, detail, rand, amt = 0.25) {
  let g = new THREE.IcosahedronGeometry(r, detail);
  g.deleteAttribute('uv');
  g.deleteAttribute('normal');
  g = mergeVertices(g);
  const p = g.attributes.position;
  for (let i = 0; i < p.count; i++) {
    tmpV.fromBufferAttribute(p, i);
    const k = 1 + (rand() - 0.5) * 2 * amt;
    p.setXYZ(i, tmpV.x * k, tmpV.y * k * 0.85, tmpV.z * k);
  }
  g.computeVertexNormals();
  return g.toNonIndexed();
}

// Gió lay cây cỏ: cộng thêm độ lệch theo chiều cao
function windy(material, strength) {
  material.userData.wind = { value: strength };
  material.onBeforeCompile = (shader) => {
    shader.uniforms.uTime = time;
    shader.uniforms.uWind = material.userData.wind;
    shader.vertexShader = shader.vertexShader
      .replace('#include <common>', '#include <common>\nuniform float uTime;\nuniform float uWind;')
      .replace(
        '#include <begin_vertex>',
        `#include <begin_vertex>
        vec3 wpos = vec3(0.0);
        #ifdef USE_INSTANCING
          wpos = (instanceMatrix * vec4(0.0, 0.0, 0.0, 1.0)).xyz;
        #endif
        float hh = max(position.y, 0.0);
        float sway = sin(uTime * 1.6 + wpos.x * 0.31 + wpos.z * 0.23) * 0.6 + sin(uTime * 2.7 + wpos.z * 0.7) * 0.3;
        transformed.x += sway * hh * hh * uWind;
        transformed.z += sway * 0.6 * hh * hh * uWind;`,
      );
  };
  return material;
}

// ---------- Cây cối ----------

function pineGeo(rand, snowy) {
  const parts = [];
  const h = 1;
  const trunk = clean(new THREE.CylinderGeometry(0.018, 0.035, 0.45, 6));
  trunk.translate(0, 0.22, 0);
  parts.push(paint(trunk, '#4a3626'));
  const layers = 5;
  for (let k = 0; k < layers; k++) {
    const r = (0.2 - k * 0.032) * (0.9 + rand() * 0.2);
    const cone = clean(new THREE.ConeGeometry(r, 0.3, 9, 1));
    const pos = cone.attributes.position;
    for (let i = 0; i < pos.count; i++) {
      tmpV.fromBufferAttribute(pos, i);
      if (tmpV.y < 0) {
        const j = 1 + (noise2(tmpV.x * 40, tmpV.z * 40, k) - 0.5) * 0.5;
        pos.setXYZ(i, tmpV.x * j, tmpV.y - noise2(tmpV.x * 30, tmpV.z * 30, k + 5) * 0.04, tmpV.z * j);
      }
    }
    cone.translate(0, 0.25 + k * 0.15, 0);
    cone.computeVertexNormals();
    const green = col('#24432a').lerp(col('#3b6232'), k / layers + rand() * 0.2);
    const n = cone.attributes.normal;
    const arr = new Float32Array(pos.count * 3);
    for (let i = 0; i < pos.count; i++) {
      tmpC.copy(green);
      if (snowy && n.getY(i) > 0.25) tmpC.lerp(col('#f2f6fa'), 0.85);
      arr.set([tmpC.r, tmpC.g, tmpC.b], i * 3);
    }
    cone.setAttribute('color', new THREE.BufferAttribute(arr, 3));
    parts.push(cone);
  }
  const g = mergeGeometries(parts);
  g.scale(h, h, h);
  return g;
}

function broadGeo(rand) {
  const parts = [];
  const trunk = clean(new THREE.CylinderGeometry(0.025, 0.05, 0.55, 7));
  trunk.translate(0, 0.27, 0);
  parts.push(paint(trunk, '#5a4330'));
  const n = 4 + Math.floor(rand() * 3);
  for (let i = 0; i < n; i++) {
    const r = 0.14 + rand() * 0.1;
    const b = blob(r, 1, rand, 0.3);
    const a = rand() * Math.PI * 2;
    const d = i === 0 ? 0 : 0.1 + rand() * 0.08;
    b.translate(Math.cos(a) * d, 0.62 + rand() * 0.18 - (i === 0 ? -0.06 : 0), Math.sin(a) * d);
    parts.push(paint(b, col('#2f5a22').lerp(col('#5e8a34'), rand())));
  }
  return mergeGeometries(parts);
}

// Cây bụt mọc (bách đầm lầy): gốc xòe đứng trong nước, tán dẹt nhiều tầng, rêu rủ thành sợi
function cypressGeo(rand) {
  const parts = [];
  const prof = [];
  for (let i = 0; i <= 10; i++) {
    const t = i / 10;
    prof.push(new THREE.Vector2(0.022 + 0.07 * Math.pow(1 - t, 3.2) + (t > 0.85 ? (t - 0.85) * 0.05 : 0), t * 0.78));
  }
  const trunk = clean(new THREE.LatheGeometry(prof, 9));
  const tp = trunk.attributes.position;
  for (let i = 0; i < tp.count; i++) {
    tmpV.fromBufferAttribute(tp, i);
    // gốc có múi như rễ bạnh
    const ang = Math.atan2(tmpV.z, tmpV.x);
    const k = 1 + Math.max(0, 0.25 - tmpV.y) * 1.6 * Math.max(0, Math.cos(ang * 5));
    tp.setXYZ(i, tmpV.x * k, tmpV.y, tmpV.z * k);
  }
  trunk.computeVertexNormals();
  parts.push(paint(trunk, '#5c5246'));
  const layers = 4 + Math.floor(rand() * 3);
  const pads = [];
  for (let i = 0; i < layers; i++) {
    const r = 0.13 + rand() * 0.1;
    const b = blob(r, 1, rand, 0.35);
    b.scale(1, 0.38, 1);
    const a = rand() * Math.PI * 2;
    const d = i === 0 ? 0 : 0.08 + rand() * 0.14;
    const x = Math.cos(a) * d;
    const z = Math.sin(a) * d;
    const y = 0.62 + rand() * 0.32;
    b.translate(x, y, z);
    pads.push([x, y, z, r]);
    parts.push(paint(b, col('#3a5a2c').lerp(col('#6a8a48'), rand())));
    // cành ngang đỡ tầng lá
    const br = clean(new THREE.CylinderGeometry(0.008, 0.014, d + 0.02, 5));
    br.rotateZ(Math.PI / 2);
    br.rotateY(-a);
    br.translate(x / 2, y - 0.03, z / 2);
    parts.push(paint(br, '#4e463c'));
  }
  // rêu rủ: dải mỏng treo dưới mép các tầng lá
  for (const [x, y, z, r] of pads) {
    const n = 7 + Math.floor(rand() * 6);
    for (let k = 0; k < n; k++) {
      const len = 0.12 + rand() * 0.24;
      const w = 0.012 + rand() * 0.016;
      const strand = clean(new THREE.PlaneGeometry(w, len, 1, 3));
      const sp = strand.attributes.position;
      for (let i = 0; i < sp.count; i++) {
        tmpV.fromBufferAttribute(sp, i);
        const v = 0.5 - tmpV.y / len; // 0 đỉnh .. 1 đuôi
        sp.setXYZ(i, tmpV.x * (1 - v * 0.7), tmpV.y, tmpV.z + v * v * 0.02);
      }
      const a = rand() * Math.PI * 2;
      const rr = r * (0.55 + rand() * 0.5);
      strand.rotateY(rand() * Math.PI);
      strand.translate(x + Math.cos(a) * rr, y - 0.03 - len / 2, z + Math.sin(a) * rr);
      parts.push(paint(strand, col('#8a9a78').lerp(col('#5e6e4e'), rand())));
    }
  }
  return mergeGeometries(parts);
}

function palmGeo(rand) {
  const parts = [];
  const segs = 7;
  const lean = 0.18 + rand() * 0.2;
  let top = new THREE.Vector3();
  for (let i = 0; i < segs; i++) {
    const t0 = i / segs;
    const t1 = (i + 1) / segs;
    const p0 = new THREE.Vector3(lean * t0 * t0, t0, 0);
    const p1 = new THREE.Vector3(lean * t1 * t1, t1, 0);
    const seg = clean(new THREE.CylinderGeometry(0.022 - t1 * 0.006, 0.026 - t0 * 0.006, p0.distanceTo(p1), 7));
    const q = new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), p1.clone().sub(p0).normalize());
    seg.applyQuaternion(q);
    seg.translate((p0.x + p1.x) / 2, (p0.y + p1.y) / 2, 0);
    parts.push(paint(seg, i % 2 ? '#7a6248' : '#6a543c'));
    top = p1;
  }
  const fronds = 9;
  for (let f = 0; f < fronds; f++) {
    const g = clean(new THREE.PlaneGeometry(0.12, 0.42, 2, 6));
    const p = g.attributes.position;
    for (let i = 0; i < p.count; i++) {
      tmpV.fromBufferAttribute(p, i);
      const v = tmpV.y / 0.42 + 0.5; // 0 gốc .. 1 ngọn
      const w = Math.sin(Math.PI * Math.min(1, v * 1.2)) * (1 - v * 0.5);
      const x = tmpV.x * w * 1.4;
      p.setXYZ(i, x, Math.abs(x) * 0.4 - v * v * 0.22, v * 0.42);
    }
    g.rotateY((f / fronds) * Math.PI * 2 + rand() * 0.3);
    g.translate(top.x, top.y, top.z);
    g.computeVertexNormals();
    parts.push(paint(g, col('#3d6b28').lerp(col('#7a9a3a'), rand())));
  }
  const coco = blob(0.03, 0, rand, 0.1);
  coco.translate(top.x, top.y - 0.03, 0.02);
  parts.push(paint(coco, '#5a4a20'));
  return mergeGeometries(parts);
}

function bambooGeo(rand) {
  const parts = [];
  const culms = 8 + Math.floor(rand() * 5);
  for (let c = 0; c < culms; c++) {
    const a = rand() * Math.PI * 2;
    const d = rand() * 0.06;
    const h = 0.75 + rand() * 0.35;
    const lx = Math.cos(a) * (0.12 + rand() * 0.15);
    const lz = Math.sin(a) * (0.12 + rand() * 0.15);
    const segs = 5;
    let prev = new THREE.Vector3(Math.cos(a) * d, 0, Math.sin(a) * d);
    for (let i = 1; i <= segs; i++) {
      const t = i / segs;
      const p = new THREE.Vector3(Math.cos(a) * d + lx * t * t, h * t, Math.sin(a) * d + lz * t * t);
      const seg = clean(new THREE.CylinderGeometry(0.006, 0.007, p.distanceTo(prev), 5));
      seg.applyQuaternion(new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), p.clone().sub(prev).normalize()));
      seg.translate((p.x + prev.x) / 2, (p.y + prev.y) / 2, (p.z + prev.z) / 2);
      parts.push(paint(seg, col('#6f8a3a').lerp(col('#9aa04c'), rand())));
      if (t > 0.45) {
        for (let k = 0; k < 4; k++) {
          const leaf = clean(new THREE.PlaneGeometry(0.018, 0.11, 1, 2));
          leaf.translate(0, -0.05, 0);
          leaf.rotateZ(1.2 + rand() * 0.8);
          leaf.rotateY(rand() * Math.PI * 2);
          leaf.translate(p.x, p.y, p.z);
          parts.push(paint(leaf, col('#4f7a2a').lerp(col('#8fae48'), rand())));
        }
      }
      prev = p;
    }
  }
  const g = mergeGeometries(parts);
  g.computeVertexNormals();
  return g;
}

function reedGeo(rand) {
  const parts = [];
  for (let i = 0; i < 9; i++) {
    const h = 0.9 + rand() * 0.9;
    const g = clean(new THREE.PlaneGeometry(0.035, h, 1, 4));
    const p = g.attributes.position;
    for (let k = 0; k < p.count; k++) {
      tmpV.fromBufferAttribute(p, k);
      const v = tmpV.y / h + 0.5;
      p.setXYZ(k, tmpV.x * (1 - v * 0.8), v * h, v * v * 0.25);
    }
    g.rotateY(rand() * Math.PI * 2);
    g.translate((rand() - 0.5) * 0.5, 0, (rand() - 0.5) * 0.5);
    parts.push(paint(g, col('#5b6f30').lerp(col('#9b9a50'), rand())));
    if (i % 3 === 0) {
      const head = clean(new THREE.CylinderGeometry(0.025, 0.025, 0.2, 6));
      const x = (rand() - 0.5) * 0.4;
      const z = (rand() - 0.5) * 0.4;
      head.translate(x, h * 1.05, z);
      parts.push(paint(head, '#5a3a20'));
      const stem = clean(new THREE.CylinderGeometry(0.005, 0.006, h * 1.2, 4));
      stem.translate(x, h * 0.6, z);
      parts.push(paint(stem, '#6b7a3a'));
    }
  }
  const g = mergeGeometries(parts);
  g.computeVertexNormals();
  return g;
}

function rockGeo(rand) {
  const g = blob(0.5, 1, rand, 0.35);
  g.scale(1, 0.6, 1);
  return paint(g, '#ffffff');
}

// Cột đá vôi khổng lồ của vịnh
function karstGeo(rand, seed) {
  let g = new THREE.CylinderGeometry(0.55, 1, 1, 28, 22, false);
  g.deleteAttribute('uv');
  g.deleteAttribute('normal');
  g = mergeVertices(g);
  const p = g.attributes.position;
  const lean = (rand() - 0.5) * 0.3;
  for (let i = 0; i < p.count; i++) {
    tmpV.fromBufferAttribute(p, i);
    const y = tmpV.y + 0.5;
    const a = Math.atan2(tmpV.z, tmpV.x);
    const n = fbm(Math.cos(a) * 1.8 + seed, y * 3 + Math.sin(a) * 1.8, seed, 4);
    const bulge = 1 + Math.sin(y * Math.PI) * 0.25;
    const k = (0.65 + n * 0.8) * bulge * (y > 0.97 ? 0.75 : 1);
    p.setXYZ(i, tmpV.x * k + lean * y * y, y + (y > 0.97 ? (n - 0.5) * 0.12 : 0), tmpV.z * k);
  }
  g.computeVertexNormals();
  g = g.toNonIndexed();
  const n = g.attributes.normal;
  const pos = g.attributes.position;
  const arr = new Float32Array(pos.count * 3);
  for (let i = 0; i < pos.count; i++) {
    tmpV.fromBufferAttribute(pos, i);
    const streak = noise2(Math.atan2(tmpV.z, tmpV.x) * 6, tmpV.y * 2, seed + 4);
    tmpC.set('#a6a397').lerp(col('#5f5d55'), streak * 0.8);
    if (tmpV.y < 0.06) tmpC.lerp(col('#3f4038'), 0.7);
    const green = n.getY(i) > 0.35 || noise2(tmpV.x * 4, tmpV.y * 9, seed + 8) > 0.72;
    if (green && tmpV.y > 0.12) tmpC.set('#36602a').lerp(col('#5c8a3a'), noise2(tmpV.x * 9, tmpV.z * 9, seed));
    arr.set([tmpC.r, tmpC.g, tmpC.b], i * 3);
  }
  g.setAttribute('color', new THREE.BufferAttribute(arr, 3));
  return g;
}

// ---------- Kết cấu nước ----------

// Bản đồ pháp tuyến sóng nước, tự tạo, lặp liền mạch
function waterNormals() {
  const N = 256;
  const hgt = new Float32Array(N * N);
  const r = rng(7);
  const waves = [];
  for (let i = 0; i < 46; i++) {
    const f = 1 + Math.floor(r() * (i < 10 ? 4 : 14));
    const a = r() * Math.PI * 2;
    waves.push([Math.round(Math.cos(a) * f), Math.round(Math.sin(a) * f), r() * 6.28, 1 / (f + 1)]);
  }
  for (let y = 0; y < N; y++) {
    for (let x = 0; x < N; x++) {
      let s = 0;
      for (const [kx, ky, ph, amp] of waves) s += Math.sin(((kx * x + ky * y) / N) * Math.PI * 2 + ph) * amp;
      hgt[y * N + x] = s;
    }
  }
  const data = new Uint8Array(N * N * 4);
  for (let y = 0; y < N; y++) {
    for (let x = 0; x < N; x++) {
      const hx = hgt[y * N + ((x + 1) % N)] - hgt[y * N + ((x - 1 + N) % N)];
      const hy = hgt[((y + 1) % N) * N + x] - hgt[((y - 1 + N) % N) * N + x];
      const v = new THREE.Vector3(-hx * 0.9, -hy * 0.9, 1).normalize();
      const i = (y * N + x) * 4;
      data[i] = (v.x * 0.5 + 0.5) * 255;
      data[i + 1] = (v.y * 0.5 + 0.5) * 255;
      data[i + 2] = (v.z * 0.5 + 0.5) * 255;
      data[i + 3] = 255;
    }
  }
  const tex = new THREE.DataTexture(data, N, N);
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
  tex.magFilter = THREE.LinearFilter;
  tex.minFilter = THREE.LinearMipmapLinearFilter;
  tex.generateMipmaps = true;
  tex.needsUpdate = true;
  return tex;
}

function softSprite(inner, outer) {
  const c = document.createElement('canvas');
  c.width = c.height = 128;
  const g = c.getContext('2d');
  const grd = g.createRadialGradient(64, 64, 0, 64, 64, 64);
  grd.addColorStop(0, inner);
  grd.addColorStop(1, outer);
  g.fillStyle = grd;
  g.fillRect(0, 0, 128, 128);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

function cloudTexture(seed) {
  const c = document.createElement('canvas');
  c.width = 256;
  c.height = 128;
  const g = c.getContext('2d');
  const r = rng(seed);
  for (let i = 0; i < 26; i++) {
    const x = 40 + r() * 176;
    const y = 50 + r() * 40 - Math.abs(x - 128) * 0.12;
    const rad = 14 + r() * 30;
    const grd = g.createRadialGradient(x, y, 0, x, y, rad);
    grd.addColorStop(0, 'rgba(255,255,255,0.55)');
    grd.addColorStop(1, 'rgba(255,255,255,0)');
    g.fillStyle = grd;
    g.beginPath();
    g.arc(x, y, rad, 0, Math.PI * 2);
    g.fill();
  }
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

// ---------- Thế giới ----------

export class World {
  constructor(renderer, quality) {
    this.renderer = renderer;
    this.q = QUALITY[quality] || QUALITY.vua;
    this.scene = new THREE.Scene();
    this.camera = new THREE.PerspectiveCamera(55, 1, 0.1, 6000);
    this.scene.fog = new THREE.FogExp2(0xa0b8cc, 0.003);
    this.lakeGroup = null;
    this.sunDir = new THREE.Vector3(0, 1, 0);
    this.night = 0;
    this.rain = 0;
    this.ripples = Array.from({ length: 10 }, () => new THREE.Vector4(0, 0, -100, 0));
    this.rippleIdx = 0;
    this.buildGlobal();
    this.buildRain();
  }

  // Mưa: các vệt nước rơi quanh camera, độ dày theo this.rain (0..1)
  buildRain() {
    const n = 3200;
    const pos = new Float32Array(n * 6);
    const seed = new Float32Array(n * 2);
    for (let i = 0; i < n; i++) {
      const x = (Math.random() - 0.5) * 50;
      const y = Math.random() * 24;
      const z = (Math.random() - 0.5) * 50;
      pos.set([x, y, z, x, y, z], i * 6);
      seed.set([0, 1], i * 2);
    }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    geo.setAttribute('tail', new THREE.BufferAttribute(seed, 1));
    const mat = new THREE.ShaderMaterial({
      uniforms: { uTime: time, uCenter: { value: new THREE.Vector3() }, uRain: { value: 0 }, uLight: { value: 1 } },
      vertexShader: `uniform float uTime; uniform vec3 uCenter; uniform float uRain; attribute float tail; varying float vA;
        void main(){ vec3 p = position; float sp = 16.0 + fract(position.x * 7.13) * 6.0;
        p.y = mod(p.y - uTime * sp, 24.0) - 4.0 + uCenter.y; p.y += tail * 0.55; p.x += tail * 0.06;
        p.xz = mod(p.xz - uCenter.xz + 25.0, 50.0) - 25.0 + uCenter.xz;
        vA = step(fract(position.z * 3.7), uRain) * (1.0 - tail * 0.7);
        gl_Position = projectionMatrix * modelViewMatrix * vec4(p, 1.0); }`,
      fragmentShader: `uniform float uLight; varying float vA; void main(){ if (vA < 0.01) discard; gl_FragColor = vec4(vec3(0.78, 0.84, 0.9) * uLight, vA * 0.38); }`,
      transparent: true,
      depthWrite: false,
    });
    const lines = new THREE.LineSegments(geo, mat);
    lines.frustumCulled = false;
    lines.visible = false;
    this.scene.add(lines);
    this.rainLines = lines;
  }

  setRain(r) {
    this.rain = this.theme && this.theme.snow ? 0 : r;
  }

  buildGlobal() {
    const s = this.scene;
    // Bầu trời vật lý
    this.sky = new Sky();
    this.sky.scale.setScalar(5000);
    // giảm độ chói của trời ban trưa để còn thấy màu xanh
    this.sky.material.uniforms.skyGain = { value: 1 };
    this.sky.material.fragmentShader = this.sky.material.fragmentShader
      .replace('uniform vec3 up;', 'uniform vec3 up;\nuniform float skyGain;')
      .replace('gl_FragColor = vec4( retColor, 1.0 );', 'gl_FragColor = vec4( retColor * skyGain, 1.0 );');
    s.add(this.sky);

    // Vòm trời đêm có sao lấp lánh
    const starCount = 2600;
    const starPos = new Float32Array(starCount * 3);
    const starSize = new Float32Array(starCount);
    const r = rng(99);
    for (let i = 0; i < starCount; i++) {
      const u = r() * Math.PI * 2;
      const v = Math.acos(1 - r() * 1.05);
      const rad = 4200;
      starPos.set([Math.cos(u) * Math.sin(v) * rad, Math.cos(v) * rad, Math.sin(u) * Math.sin(v) * rad], i * 3);
      starSize[i] = 1 + Math.pow(r(), 6) * 5;
    }
    const sg = new THREE.BufferGeometry();
    sg.setAttribute('position', new THREE.BufferAttribute(starPos, 3));
    sg.setAttribute('size', new THREE.BufferAttribute(starSize, 1));
    this.starMat = new THREE.ShaderMaterial({
      uniforms: { uTime: time, uNight: { value: 0 }, uRatio: { value: 1 } },
      vertexShader: `attribute float size; varying float vTw; uniform float uTime; uniform float uRatio;
        void main(){ vec4 mv = modelViewMatrix * vec4(position,1.0); gl_Position = projectionMatrix * mv;
        vTw = 0.6 + 0.4 * sin(uTime * (1.5 + size) + position.x * 0.01);
        gl_PointSize = size * uRatio * 1.3; }`,
      fragmentShader: `uniform float uNight; varying float vTw;
        void main(){ float d = length(gl_PointCoord - 0.5); float a = smoothstep(0.5, 0.0, d);
        gl_FragColor = vec4(vec3(1.0, 0.96, 0.9) * 2.2, a * vTw * uNight); }`,
      transparent: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
    });
    this.stars = new THREE.Points(sg, this.starMat);
    this.stars.renderOrder = -1;
    this.stars.frustumCulled = false;
    s.add(this.stars);

    // Mặt trăng và quầng sáng
    this.moon = new THREE.Group();
    const moonDisc = new THREE.Mesh(
      new THREE.SphereGeometry(60, 32, 16),
      new THREE.MeshBasicMaterial({ color: new THREE.Color(3.2, 3.1, 2.8), fog: false }),
    );
    const halo = new THREE.Sprite(new THREE.SpriteMaterial({
      map: softSprite('rgba(200,215,255,0.5)', 'rgba(120,140,200,0)'), fog: false, depthWrite: false, blending: THREE.AdditiveBlending,
    }));
    halo.scale.setScalar(700);
    this.moon.add(moonDisc, halo);
    s.add(this.moon);

    // Mây bay
    this.clouds = new THREE.Group();
    const cr = rng(5);
    const tex = [cloudTexture(1), cloudTexture(2), cloudTexture(3)];
    for (let i = 0; i < this.q.clouds; i++) {
      const m = new THREE.SpriteMaterial({ map: tex[i % 3], transparent: true, depthWrite: false, fog: false, opacity: 0.85 });
      const sp = new THREE.Sprite(m);
      const a = cr() * Math.PI * 2;
      const d = 1400 + cr() * 1500;
      sp.position.set(Math.cos(a) * d, 260 + cr() * 420, Math.sin(a) * d);
      const w = 700 + cr() * 900;
      sp.scale.set(w, w * 0.42, 1);
      sp.userData = { a, d, speed: 0.002 + cr() * 0.004 };
      this.clouds.add(sp);
    }
    s.add(this.clouds);

    // Ánh sáng
    this.hemi = new THREE.HemisphereLight(0xbfd6ff, 0x4a4030, 0.8);
    s.add(this.hemi);
    this.sun = new THREE.DirectionalLight(0xffffff, 3);
    this.sun.castShadow = !!this.q.shadows;
    if (this.q.shadows) {
      this.sun.shadow.mapSize.set(this.q.shadows, this.q.shadows);
      const sc = this.sun.shadow.camera;
      sc.left = -38;
      sc.right = 38;
      sc.top = 38;
      sc.bottom = -38;
      sc.near = 1;
      sc.far = 400;
      this.sun.shadow.bias = -0.0004;
      this.sun.shadow.normalBias = 0.04;
    }
    s.add(this.sun, this.sun.target);

    // Mặt nước phản chiếu, có sóng lăn tăn, gợn sóng theo phao và bọt sát bờ
    const wn = waterNormals();
    this.water = new Water(new THREE.PlaneGeometry(6000, 6000), {
      textureWidth: this.q.reflection,
      textureHeight: this.q.reflection,
      waterNormals: wn,
      sunDirection: new THREE.Vector3(0, 1, 0),
      sunColor: 0xffffff,
      waterColor: 0x1f4a36,
      distortionScale: 2.4,
      fog: true,
    });
    this.water.rotation.x = -Math.PI / 2;
    const wm = this.water.material;
    Object.assign(wm.uniforms, {
      depthMap: { value: null },
      depthBounds: { value: new THREE.Vector3(0, 0, 1) },
      ripples: { value: this.ripples },
      shallowColor: { value: new THREE.Color() },
      foamColor: { value: new THREE.Color() },
      nightGlow: { value: 0 },
    });
    wm.fragmentShader = wm.fragmentShader
      .replace(
        'uniform vec3 waterColor;',
        `uniform vec3 waterColor;
        uniform sampler2D depthMap; uniform vec3 depthBounds; uniform vec4 ripples[10];
        uniform vec3 shallowColor; uniform vec3 foamColor;`,
      )
      .replace(
        'vec3 surfaceNormal = normalize( noise.xzy * vec3( 1.5, 1.0, 1.5 ) );',
        `vec3 surfaceNormal = normalize( noise.xzy * vec3( 1.5, 1.0, 1.5 ) );
        vec2 rip = vec2(0.0);
        for (int i = 0; i < 10; i++) {
          vec4 rp = ripples[i];
          float age = time - rp.z;
          if (age < 0.0 || age > 5.0) continue;
          vec2 dd = worldPosition.xz - rp.xy;
          float dist = length(dd);
          float front = age * 1.4;
          float k = dist - front;
          float w = sin(k * 7.0) * exp(-abs(k) * 2.2) * exp(-age * 0.8) * rp.w;
          rip += dd / (dist + 0.001) * w;
        }
        surfaceNormal = normalize(surfaceNormal + vec3(rip.x, 0.0, rip.y));`,
      )
      .replace(
        'gl_FragColor = vec4( outgoingLight, alpha );',
        `vec2 duv = (worldPosition.xz - depthBounds.xy) / depthBounds.z;
        float depth = 12.0;
        if (duv.x > 0.0 && duv.x < 1.0 && duv.y > 0.0 && duv.y < 1.0) depth = texture2D(depthMap, duv).r * 12.0;
        float shallow = 1.0 - smoothstep(0.0, 4.0, depth);
        outgoingLight = mix(outgoingLight, outgoingLight * 0.55 + shallowColor * (0.35 + diffuseLight.r * 0.15), shallow * 0.7);
        float foam = (1.0 - smoothstep(0.0, 0.45, depth)) * (0.55 + 0.45 * sin(time * 1.4 + worldPosition.x * 0.9 + worldPosition.z * 0.6 + noise.x * 5.0));
        outgoingLight = mix(outgoingLight, foamColor * (0.4 + diffuseLight.r * 0.4), clamp(foam, 0.0, 1.0) * 0.6);
        gl_FragColor = vec4( outgoingLight, alpha * mix(0.35, 1.0, smoothstep(0.0, 1.4, depth)) );`,
      );
    wm.transparent = true;
    this.water.receiveShadow = false;
    s.add(this.water);

    // Vòm trời đêm xanh thẫm để đêm không đen kịt
    this.nightDome = new THREE.Mesh(
      new THREE.SphereGeometry(4400, 32, 16),
      new THREE.ShaderMaterial({
        uniforms: { uNight: { value: 0 } },
        vertexShader: 'varying vec3 vP; void main(){ vP = normalize(position); gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }',
        fragmentShader: `uniform float uNight; varying vec3 vP;
          void main(){ float h = clamp(vP.y, 0.0, 1.0);
          vec3 c = mix(vec3(0.05, 0.08, 0.16), vec3(0.008, 0.015, 0.045), pow(h, 0.5));
          gl_FragColor = vec4(c * uNight, 1.0); }`,
        side: THREE.BackSide,
        depthWrite: false,
        blending: THREE.AdditiveBlending,
        transparent: true,
      }),
    );
    this.nightDome.renderOrder = -2;
    s.add(this.nightDome);
  }

  // Dựng toàn bộ cảnh riêng của một hồ
  setLake(id, mySpot = 0) {
    if (this.lakeGroup) {
      this.scene.remove(this.lakeGroup);
      this.lakeGroup.traverse((o) => {
        if (o.geometry) o.geometry.dispose();
        if (o.material) [].concat(o.material).forEach((m) => m.dispose());
      });
    }
    const T = THEMES[id] || THEMES.sen;
    this.theme = T;
    this.lakeId = id;
    this.lamps = [];
    this.boats = [];
    this.lampLight = null;
    this.rand = rng(T.seed * 7 + 1);
    const g = new THREE.Group();
    this.lakeGroup = g;
    this.scene.add(g);

    this.spots = this.computeSpots();
    this.mySpot = mySpot;
    const me = this.spots[mySpot] || this.spots[0];
    this.focus = me.stand.clone();

    this.buildTerrain(g, me);
    this.buildDepthMap();
    for (const sp of this.spots) g.add(this.buildDock(sp, sp === me));
    this.buildHut(g, me);
    this.scatterTrees(g);
    this.scatterRocks(g);
    if (T.karst) this.buildKarsts(g);
    if (T.swamp) this.scatterSwamp(g);
    if (T.reeds) this.scatterReeds(g);
    if (T.lotus) this.buildLotus(g);
    if (T.grass && this.q.grass) this.buildGrass(g, me);
    if (T.flowers) this.buildFlowers(g, me);
    if (T.ice) this.buildIce(g);
    this.fireflies = T.fireflies ? this.buildFireflies(g, me) : null;
    this.snow = T.snow ? this.buildSnow(g) : null;
    this.aurora = T.aurora ? this.buildAurora(g, me) : null;

    this.lampLight = new THREE.PointLight(0xffb060, 0, 18, 1.6);
    g.add(this.lampLight);
    this.setMySpot(mySpot);

    const w = this.water.material.uniforms;
    w.waterColor.value.set(T.water.color);
    w.shallowColor.value.set(T.water.shallow);
    w.foamColor.value.set(T.water.foam);
    w.distortionScale.value = T.water.distortion;
    w.size.value = T.water.size;
  }

  // đổi chỗ đứng của mình (máy chủ chia chỗ để bạn bè thấy nhau)
  setMySpot(i) {
    const sp = this.spots[i] || this.spots[0];
    this.mySpot = this.spots.indexOf(sp);
    this.focus.copy(sp.stand);
    this.lampLight.position.copy(sp.lampPos);
    this.sun.target.position.copy(this.focus);
  }

  heightAt(x, z) {
    const T = this.theme;
    const [cx, cz] = T.center;
    const [rx, rz] = T.R;
    let r = Math.hypot((x - cx) / rx, (z - cz) / rz);
    r *= 1 + (fbm(x * 0.011, z * 0.011, T.seed) - 0.5) * 2 * T.edge;
    if (r < 1) {
      const t = 1 - r;
      return -T.depth * smoothstep(0, 0.4, t) * (0.75 + 0.5 * fbm(x * 0.03, z * 0.03, T.seed + 3)) - t * 0.6;
    }
    const t = r - 1;
    const R = Math.min(rx, rz);
    const m = t * R; // khoảng cách tới bờ, tính bằng mét
    let h = 1.1 * smoothstep(0, 6, m) + T.base * smoothstep(2, 60, m);
    h += T.hills * smoothstep(5, 90, m) * (fbm(x * 0.017, z * 0.017, T.seed + 5) - 0.3) * 1.6;
    h += T.mountains * smoothstep(90, 420, m) * (0.25 + ridge(x * 0.0045, z * 0.0045, T.seed + 9));
    h += (noise2(x * 0.3, z * 0.3, T.seed + 2) - 0.5) * 0.25 * smoothstep(1, 4, m);
    return h;
  }

  waveAt(x, z, t) {
    const a = this.theme ? this.theme.water.waves : 1;
    return (Math.sin(x * 0.55 + t * 1.3) * 0.022 + Math.sin(z * 0.73 + t * 1.7 + 1.3) * 0.018 + Math.sin((x + z) * 1.9 + t * 2.8) * 0.006) * a;
  }

  // điểm bờ hồ cách chỗ đứng giữa "off" mét dọc theo bờ, kèm hướng nhìn ra giữa hồ
  shorePoint(off) {
    const T = this.theme;
    const [cx, cz] = T.center;
    const [rx, rz] = T.R;
    const a = Math.PI / 2 + off / Math.max(rx, rz) * (rx > 200 ? 1 : 1.25);
    const dir = new THREE.Vector3(Math.cos(a) * rx, 0, Math.sin(a) * rz).normalize();
    let shore = null;
    for (let s = 0.5; s < 1.6; s += 0.002) {
      const x = cx + Math.cos(a) * rx * s;
      const z = cz + Math.sin(a) * rz * s;
      if (this.heightAt(x, z) > 0.35) {
        shore = new THREE.Vector3(x, 0, z);
        break;
      }
    }
    shore = shore || new THREE.Vector3(cx + dir.x * rx, 0, cz + dir.z * rz);
    const face = new THREE.Vector3(cx - shore.x, 0, cz - shore.z).normalize();
    return { shore, face };
  }

  computeSpots() {
    const offsets = [0, -8, 8, -16, 16, -24];
    return offsets.map((off) => {
      const { shore, face } = this.shorePoint(off);
      const stand = shore.clone().addScaledVector(face, 8.5);
      stand.y = 0.62;
      return { shore, face, stand, yaw: Math.atan2(-face.x, -face.z) };
    });
  }

  // đứng được ở đây không: trên bờ hoặc trên cầu câu; trả về độ cao chỗ đặt chân, không đứng được thì null
  groundAt(x, z) {
    const h = this.heightAt(x, z);
    for (const sp of this.spots) {
      const dx = x - sp.shore.x;
      const dz = z - sp.shore.z;
      const along = dx * sp.face.x + dz * sp.face.z;
      const across = -dx * sp.face.z + dz * sp.face.x;
      if (along > -2.6 && along < 9 && Math.abs(across) < 1.05) return Math.max(0.62, h);
    }
    return h > 0.15 ? h : null;
  }

  buildTerrain(g, me) {
    const T = this.theme;
    const C = T.colors;
    const seg = this.q.seg;
    const geo = new THREE.PlaneGeometry(2, 2, seg, seg);
    geo.rotateX(-Math.PI / 2);
    const p = geo.attributes.position;
    const S = 1600;
    // Lưới dày gần chỗ đứng, thưa dần ra xa
    for (let i = 0; i < p.count; i++) {
      const u = p.getX(i);
      const v = p.getZ(i);
      const x = me.shore.x + Math.sign(u) * Math.pow(Math.abs(u), 1.9) * S;
      const z = me.shore.z + Math.sign(v) * Math.pow(Math.abs(v), 1.9) * S;
      p.setXYZ(i, x, this.heightAt(x, z), z);
    }
    geo.computeVertexNormals();
    const n = geo.attributes.normal;
    const colors = new Float32Array(p.count * 3);
    const cMud = col(C.mud);
    const cSand = col(C.sand);
    const cGrass = col(C.grass);
    const cGrass2 = col(C.grass2);
    const cRock = col(C.rock);
    const cSnow = col('#f4f7fb');
    for (let i = 0; i < p.count; i++) {
      const x = p.getX(i);
      const y = p.getY(i);
      const z = p.getZ(i);
      const ny = n.getY(i);
      const nz = fbm(x * 0.05, z * 0.05, T.seed + 11, 3);
      if (y < -0.3) tmpC.copy(cSand).lerp(cMud, smoothstep(-0.3, -3, y));
      else if (y < 0.9 + nz * 0.8) tmpC.copy(cSand).lerp(cMud, 0.15 * nz);
      else {
        tmpC.copy(cGrass).lerp(cGrass2, smoothstep(0.35, 0.75, nz));
        tmpC.lerp(cSand, smoothstep(1.5, 0.9, y) * 0.5);
      }
      const rocky = smoothstep(0.86, 0.7, ny) + smoothstep(T.rockLine, T.rockLine + 30, y + nz * 20) * 0.8;
      if (y > 0.5) tmpC.lerp(cRock, clamp(rocky, 0, 1));
      if (T.snowLine !== null && y > T.snowLine + nz * 25) tmpC.lerp(cSnow, smoothstep(0.55, 0.8, ny));
      colors.set([tmpC.r, tmpC.g, tmpC.b], i * 3);
    }
    geo.setAttribute('color', new THREE.BufferAttribute(colors, 3));
    const mat = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.95, metalness: 0 });
    const mesh = new THREE.Mesh(geo, mat);
    mesh.receiveShadow = !!this.q.shadows;
    g.add(mesh);
  }

  buildDepthMap() {
    const T = this.theme;
    const N = 256;
    const half = Math.max(T.R[0], T.R[1]) * 1.25;
    const x0 = T.center[0] - half;
    const z0 = T.center[1] - half;
    const data = new Uint8Array(N * N * 4);
    for (let j = 0; j < N; j++) {
      for (let i = 0; i < N; i++) {
        const x = x0 + ((i + 0.5) / N) * half * 2;
        const z = z0 + ((j + 0.5) / N) * half * 2;
        const d = clamp(-this.heightAt(x, z) / 12, 0, 1);
        const k = (j * N + i) * 4;
        data[k] = d * 255;
        data[k + 3] = 255;
      }
    }
    if (this.depthTex) this.depthTex.dispose();
    const tex = new THREE.DataTexture(data, N, N);
    tex.magFilter = THREE.LinearFilter;
    tex.minFilter = THREE.LinearFilter;
    tex.needsUpdate = true;
    this.depthTex = tex;
    const u = this.water.material.uniforms;
    u.depthMap.value = tex;
    u.depthBounds.value.set(x0, z0, half * 2);
  }

  buildDock(sp, mine) {
    const parts = [];
    const r = rng(Math.floor(sp.shore.x * 13 + sp.shore.z * 7) + 3);
    const snowy = this.lakeId === 'bang';
    const len = 11.5;
    const width = 2.3;
    // ván sàn
    for (let d = -2.5; d < len - 2.5; d += 0.26) {
      const plank = clean(new THREE.BoxGeometry(width * (0.96 + r() * 0.08), 0.06, 0.23));
      plank.rotateY((r() - 0.5) * 0.03);
      plank.translate((r() - 0.5) * 0.06, 0.6 + (r() - 0.5) * 0.015, -d);
      const c = col('#7a5a3a').lerp(col('#a07a50'), r());
      if (snowy) c.lerp(col('#e8eef4'), 0.55);
      parts.push(paint(plank, c));
    }
    // dầm và cọc
    for (const side of [-1, 1]) {
      const beam = clean(new THREE.BoxGeometry(0.14, 0.16, len));
      beam.translate(side * (width / 2 - 0.12), 0.5, -(len / 2 - 2.5));
      parts.push(paint(beam, '#4f3a26'));
      for (let d = -2; d <= len - 2.6; d += 2.4) {
        const bottom = Math.min(-0.5, this.heightAt(sp.shore.x + sp.face.x * d, sp.shore.z + sp.face.z * d) - 0.5);
        const h = 1.6 - bottom;
        const post = clean(new THREE.CylinderGeometry(0.09, 0.11, h, 7));
        post.translate(side * (width / 2 - 0.05), 0.95 - h / 2, -d);
        parts.push(paint(post, '#3e2e20'));
      }
    }
    // lan can một bên và đèn lồng ở đầu cầu
    const rail = clean(new THREE.BoxGeometry(0.06, 0.06, len - 7));
    rail.translate(width / 2 - 0.05, 1.05, -(len / 2 - 3));
    parts.push(paint(rail, '#5b4430'));
    const lanternPost = clean(new THREE.CylinderGeometry(0.05, 0.06, 1.9, 6));
    lanternPost.translate(-(width / 2 - 0.05), 1.55, -(len - 2.7));
    parts.push(paint(lanternPost, '#3e2e20'));
    if (mine) {
      // xô, hộp đồ nghề
      const bucket = clean(new THREE.CylinderGeometry(0.17, 0.13, 0.32, 14));
      bucket.translate(0.7, 0.79, -(len - 4.4));
      parts.push(paint(bucket, '#2f6fa8'));
      const box = clean(new THREE.BoxGeometry(0.45, 0.22, 0.28));
      box.translate(-0.6, 0.74, -(len - 4.9));
      parts.push(paint(box, '#b8402a'));
      const lid = clean(new THREE.BoxGeometry(0.47, 0.04, 0.3));
      lid.translate(-0.6, 0.87, -(len - 4.9));
      parts.push(paint(lid, '#8a2c1c'));
    }
    const geo = mergeGeometries(parts);
    geo.computeVertexNormals();
    const mesh = new THREE.Mesh(geo, new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.85 }));
    mesh.castShadow = mesh.receiveShadow = !!this.q.shadows;
    const group = new THREE.Group();
    group.add(mesh);
    // đèn lồng phát sáng ban đêm
    const lamp = new THREE.Mesh(
      new THREE.SphereGeometry(0.11, 12, 8),
      new THREE.MeshStandardMaterial({ color: '#fff0c0', emissive: '#ffb347', emissiveIntensity: 0 }),
    );
    lamp.position.set(-(width / 2 - 0.05), 2.58, -(len - 2.7));
    const cap = new THREE.Mesh(new THREE.ConeGeometry(0.17, 0.14, 8), new THREE.MeshStandardMaterial({ color: '#2a2a2a' }));
    cap.position.set(lamp.position.x, 2.72, lamp.position.z);
    group.add(lamp, cap);
    this.lamps = this.lamps || [];
    this.lamps.push(lamp.material);
    group.position.copy(sp.shore);
    group.position.y = 0;
    group.rotation.y = sp.yaw;
    group.updateMatrixWorld(true);
    sp.lampPos = lamp.getWorldPosition(new THREE.Vector3());
    return group;
  }

  buildHut(g, me) {
    const T = this.theme;
    const side = new THREE.Vector3(-me.face.z, 0, me.face.x);
    const at = me.shore.clone().addScaledVector(me.face, -9).addScaledVector(side, 11);
    at.y = this.heightAt(at.x, at.z);
    const parts = [];
    if (T.hut === 'choi' || T.hut === 'raft') {
      for (const [x, z] of [[-1.4, -1.2], [1.4, -1.2], [-1.4, 1.2], [1.4, 1.2]]) {
        const post = clean(new THREE.CylinderGeometry(0.07, 0.08, 2.4, 6));
        post.translate(x, 1.2, z);
        parts.push(paint(post, '#6a5030'));
      }
      const floor = clean(new THREE.BoxGeometry(3.2, 0.12, 2.8));
      floor.translate(0, 0.5, 0);
      parts.push(paint(floor, '#8a6a40'));
      const roof = clean(new THREE.ConeGeometry(2.7, 1.5, 4, 1));
      roof.rotateY(Math.PI / 4);
      roof.scale(1.25, 1, 1.1);
      roof.translate(0, 3.1, 0);
      parts.push(paint(roof, '#b89a5a'));
      const hammock = clean(new THREE.CylinderGeometry(0.4, 0.4, 2.4, 10, 1, true, Math.PI, Math.PI));
      hammock.rotateZ(Math.PI / 2);
      hammock.scale(1, 0.6, 1);
      hammock.translate(0, 1.4, 0);
      parts.push(paint(hammock, '#c24a3a'));
    } else if (T.hut === 'cabin') {
      const body = clean(new THREE.BoxGeometry(4, 2.4, 3.2));
      body.translate(0, 1.2, 0);
      parts.push(paint(body, '#6b4a2e'));
      for (let y = 0.2; y < 2.4; y += 0.32) {
        const log = clean(new THREE.CylinderGeometry(0.15, 0.15, 4.2, 8));
        log.rotateZ(Math.PI / 2);
        log.translate(0, y, 1.62);
        parts.push(paint(log, '#7d5836'));
      }
      const roof = clean(new THREE.CylinderGeometry(0.01, 2.6, 1.5, 4, 1));
      roof.rotateY(Math.PI / 4);
      roof.scale(1.15, 1, 0.9);
      roof.translate(0, 3.15, 0);
      parts.push(paint(roof, '#3b3430'));
      const chimney = clean(new THREE.BoxGeometry(0.45, 1.4, 0.45));
      chimney.translate(1.1, 3.5, 0.3);
      parts.push(paint(chimney, '#6a6560'));
      const window1 = clean(new THREE.BoxGeometry(0.7, 0.6, 0.05));
      window1.translate(-0.9, 1.4, 1.79);
      parts.push(paint(window1, '#ffcf7a'));
      this.windowGlow = true;
    } else if (T.hut === 'igloo') {
      const dome = clean(new THREE.SphereGeometry(2, 20, 10, 0, Math.PI * 2, 0, Math.PI / 2));
      parts.push(paint(dome, '#eef4fa'));
      const door = clean(new THREE.CylinderGeometry(0.7, 0.7, 1.4, 12, 1, false, 0, Math.PI));
      door.rotateX(Math.PI / 2);
      door.translate(0, 0, 1.8);
      parts.push(paint(door, '#dfe8f0'));
    }
    if (!parts.length) return;
    const geo = mergeGeometries(parts);
    geo.computeVertexNormals();
    const mesh = new THREE.Mesh(geo, new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.9, side: THREE.DoubleSide }));
    mesh.position.copy(at);
    if (T.hut === 'raft') mesh.position.y = Math.max(at.y, 0);
    mesh.rotation.y = me.yaw + 0.6;
    mesh.castShadow = mesh.receiveShadow = !!this.q.shadows;
    g.add(mesh);
  }

  // Có chỗ trống trên cạn để đặt cây không
  landOk(x, z, minH, maxH, slopeMax) {
    const h = this.heightAt(x, z);
    if (h < minH || h > maxH) return null;
    const dx = this.heightAt(x + 1.5, z) - h;
    const dz = this.heightAt(x, z + 1.5) - h;
    if (Math.hypot(dx, dz) / 1.5 > slopeMax) return null;
    for (const sp of this.spots) {
      // chừa lối ra cầu câu
      const ox = x - sp.shore.x;
      const oz = z - sp.shore.z;
      const along = -(ox * sp.face.x + oz * sp.face.z);
      const across = Math.abs(ox * sp.face.z - oz * sp.face.x);
      if (along > -9 && along < 14 && across < 5) return null;
      if (Math.hypot(ox, oz) < 6) return null;
    }
    return h;
  }

  instanced(geo, mat, list, shadows) {
    const mesh = new THREE.InstancedMesh(geo, mat, list.length);
    const m = new THREE.Matrix4();
    const q = new THREE.Quaternion();
    list.forEach((it, i) => {
      q.setFromEuler(new THREE.Euler(it.tilt || 0, it.rot, (it.tilt2 || 0)));
      m.compose(it.pos, q, it.scale);
      mesh.setMatrixAt(i, m);
      if (it.color) mesh.setColorAt(i, it.color);
    });
    mesh.castShadow = !!shadows;
    mesh.receiveShadow = !!this.q.shadows;
    return mesh;
  }

  scatterTrees(g) {
    const T = this.theme;
    const r = this.rand;
    const [cx, cz] = T.center;
    const reach = Math.max(T.R[0], T.R[1]) * 1.2 + 260;
    for (const [kind, count] of T.trees) {
      const variants = [0, 1, 2].map(() => {
        if (kind === 'pine') return pineGeo(r, T.snow);
        if (kind === 'broad') return broadGeo(r);
        if (kind === 'palm') return palmGeo(r);
        return bambooGeo(r);
      });
      const lists = variants.map(() => ({ near: [], far: [] }));
      const n = Math.floor(count * this.q.veg);
      let placed = 0;
      for (let tries = 0; placed < n && tries < n * 30; tries++) {
        // nhiều cây gần mép hồ hơn
        const a = r() * Math.PI * 2;
        const rr = Math.pow(r(), 1.6);
        const x = cx + Math.cos(a) * (T.R[0] + rr * reach * 0.8) * (0.85 + r() * 0.3);
        const z = cz + Math.sin(a) * (T.R[1] + rr * reach * 0.8) * (0.85 + r() * 0.3);
        const maxH = T.snowLine !== null && T.snowLine > 0 ? T.snowLine : 80;
        const h = this.landOk(x, z, kind === 'palm' ? 0.6 : 1.2, maxH, kind === 'pine' ? 0.9 : 0.6);
        if (h === null) continue;
        if (fbm(x * 0.02, z * 0.02, T.seed + 40, 3) < (kind === 'pine' ? 0.35 : 0.42)) continue;
        const size = kind === 'pine' ? 14 + r() * 14 : kind === 'palm' ? 8 + r() * 6 : kind === 'bamboo' ? 7 + r() * 5 : 7 + r() * 7;
        const item = {
          pos: new THREE.Vector3(x, h - 0.2, z),
          rot: r() * Math.PI * 2,
          tilt: (r() - 0.5) * 0.08,
          scale: new THREE.Vector3(size * (0.85 + r() * 0.3), size, size * (0.85 + r() * 0.3)),
          color: new THREE.Color().setHSL(0, 0, 0.8 + r() * 0.35),
        };
        const near = item.pos.distanceTo(this.focus) < 70;
        lists[placed % 3][near ? 'near' : 'far'].push(item);
        placed++;
      }
      variants.forEach((geo, i) => {
        const mat = windy(new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.85, side: THREE.DoubleSide }), kind === 'pine' ? 0.012 : 0.03);
        for (const which of ['near', 'far']) {
          const list = lists[i][which];
          if (list.length) g.add(this.instanced(geo, mat, list, which === 'near' && this.q.shadows));
        }
      });
    }
  }

  scatterRocks(g) {
    const r = this.rand;
    const T = this.theme;
    const list = [];
    const n = Math.floor(160 * this.q.veg);
    for (let tries = 0; list.length < n && tries < n * 20; tries++) {
      const a = r() * Math.PI * 2;
      const s = 0.95 + r() * 0.4;
      const x = T.center[0] + Math.cos(a) * T.R[0] * s;
      const z = T.center[1] + Math.sin(a) * T.R[1] * s;
      const h = this.landOk(x, z, -1.2, 30, 3);
      if (h === null) continue;
      const k = 0.4 + Math.pow(r(), 3) * 3;
      list.push({
        pos: new THREE.Vector3(x, h - k * 0.15, z),
        rot: r() * 6.28,
        tilt: (r() - 0.5) * 0.5,
        scale: new THREE.Vector3(k * (1 + r()), k, k * (1 + r() * 0.6)),
        color: col(T.colors.rock).multiplyScalar(0.8 + r() * 0.4),
      });
    }
    const mat = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.9 });
    g.add(this.instanced(rockGeo(r), mat, list, this.q.shadows));
  }

  buildKarsts(g) {
    const r = this.rand;
    const T = this.theme;
    const geos = [karstGeo(r, 1), karstGeo(r, 2), karstGeo(r, 3)];
    const lists = [[], [], []];
    const count = 34;
    let placed = 0;
    for (let tries = 0; placed < count && tries < 2000; tries++) {
      const x = (r() - 0.5) * 1100;
      const z = this.focus.z - 60 - r() * 900;
      const d = Math.hypot(x - this.focus.x, z - this.focus.z);
      if (d < 75) continue;
      if (Math.abs(x - this.focus.x) < 40 && d < 140) continue; // chừa chỗ quăng câu
      const h = 30 + r() * 80 + d * 0.05;
      const rad = 12 + r() * 26;
      lists[placed % 3].push({ pos: new THREE.Vector3(x, -3, z), rot: r() * 6.28, scale: new THREE.Vector3(rad, h, rad * (0.7 + r() * 0.6)) });
      placed++;
    }
    const mat = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.92 });
    geos.forEach((geo, i) => lists[i].length && g.add(this.instanced(geo, mat, lists[i], false)));
    // thuyền buồm xa xa
    for (let i = 0; i < 3; i++) {
      const boat = this.junk();
      boat.position.set((r() - 0.5) * 300, 0, this.focus.z - 150 - r() * 250);
      boat.rotation.y = r() * 6.28;
      boat.userData.bob = r() * 6;
      g.add(boat);
      (this.boats = this.boats || []).push(boat);
    }
  }

  junk() {
    const grp = new THREE.Group();
    const hull = new THREE.Mesh(new THREE.BoxGeometry(3, 1.2, 12), new THREE.MeshStandardMaterial({ color: '#5a3a22', roughness: 0.8 }));
    hull.position.y = 0.4;
    const sailMat = new THREE.MeshStandardMaterial({ color: '#b8452a', side: THREE.DoubleSide, roughness: 0.9 });
    for (let i = 0; i < 3; i++) {
      const sail = new THREE.Mesh(new THREE.PlaneGeometry(5 - i * 0.8, 7 - i), sailMat);
      sail.position.set(0, 5 - i * 0.3, -3 + i * 3);
      sail.rotation.y = Math.PI / 2 + 0.2;
      grp.add(sail);
    }
    grp.add(hull);
    return grp;
  }

  // cây bụt mọc mọc trong nước nông ven hồ, chừa khoảng trống trước chỗ đứng để còn quăng câu
  scatterSwamp(g) {
    const r = this.rand;
    const T = this.theme;
    const variants = [0, 1, 2].map(() => cypressGeo(r));
    const lists = variants.map(() => []);
    const n = Math.floor(T.swamp * Math.max(0.5, this.q.veg));
    let placed = 0;
    for (let tries = 0; placed < n && tries < n * 60; tries++) {
      const a = r() * Math.PI * 2;
      const s = 0.78 + r() * 0.26;
      const x = T.center[0] + Math.cos(a) * T.R[0] * s;
      const z = T.center[1] + Math.sin(a) * T.R[1] * s;
      const h = this.heightAt(x, z);
      if (h > 0.4 || h < -2.6) continue;
      if (this.spots.some((sp) => Math.hypot(x - sp.stand.x, z - sp.stand.z) < 16)) continue;
      const size = 11 + r() * 9;
      lists[placed % 3].push({
        pos: new THREE.Vector3(x, h - 0.4, z),
        rot: r() * Math.PI * 2,
        tilt: (r() - 0.5) * 0.06,
        scale: new THREE.Vector3(size * (0.85 + r() * 0.3), size, size * (0.85 + r() * 0.3)),
        color: new THREE.Color().setHSL(0, 0, 0.85 + r() * 0.3),
      });
      placed++;
    }
    variants.forEach((geo, i) => {
      if (!lists[i].length) return;
      const mat = windy(new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.9, side: THREE.DoubleSide }), 0.02);
      g.add(this.instanced(geo, mat, lists[i], this.q.shadows));
    });
  }

  scatterReeds(g) {
    const r = this.rand;
    const T = this.theme;
    const list = [];
    const n = Math.floor(260 * this.q.veg);
    for (let tries = 0; list.length < n && tries < n * 30; tries++) {
      const a = r() * Math.PI * 2;
      const s = 0.9 + r() * 0.15;
      const x = T.center[0] + Math.cos(a) * T.R[0] * s;
      const z = T.center[1] + Math.sin(a) * T.R[1] * s;
      const h = this.landOk(x, z, -0.7, 0.5, 2);
      if (h === null) continue;
      if (noise2(x * 0.05, z * 0.05, 3) < 0.4) continue;
      const k = 1 + r() * 0.8;
      list.push({ pos: new THREE.Vector3(x, h, z), rot: r() * 6.28, scale: new THREE.Vector3(k, k, k) });
    }
    const mat = windy(new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.8, side: THREE.DoubleSide }), 0.05);
    if (list.length) g.add(this.instanced(reedGeo(r), mat, list, false));
  }

  buildLotus(g) {
    const r = this.rand;
    const T = this.theme;
    const pads = [];
    const flowers = [];
    const patches = 14;
    for (let p = 0; p < patches; p++) {
      const a = r() * Math.PI * 2;
      const s = 0.55 + r() * 0.38;
      const px = T.center[0] + Math.cos(a) * T.R[0] * s;
      const pz = T.center[1] + Math.sin(a) * T.R[1] * s;
      if (Math.hypot(px - this.focus.x, pz - this.focus.z) < 18) continue;
      const n = Math.floor((30 + r() * 30) * this.q.veg);
      for (let i = 0; i < n; i++) {
        const x = px + (r() - 0.5) * 22;
        const z = pz + (r() - 0.5) * 16;
        if (this.heightAt(x, z) > -0.3) continue;
        const k = 0.5 + r() * 0.6;
        pads.push({ pos: new THREE.Vector3(x, 0.03 + r() * 0.01, z), rot: r() * 6.28, scale: new THREE.Vector3(k, k, k), color: new THREE.Color().setHSL(0.25 + r() * 0.06, 0.55, 0.22 + r() * 0.12) });
        if (r() < 0.12) flowers.push({ pos: new THREE.Vector3(x + 0.1, 0.05, z), rot: r() * 6.28, scale: new THREE.Vector3(1, 1, 1).multiplyScalar(0.8 + r() * 0.5) });
      }
    }
    const padGeo = new THREE.CircleGeometry(0.55, 18, 0.25, Math.PI * 2 - 0.5);
    padGeo.rotateX(-Math.PI / 2);
    padGeo.deleteAttribute('uv');
    paint(padGeo, '#ffffff');
    const padMat = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.5, side: THREE.DoubleSide });
    if (pads.length) g.add(this.instanced(padGeo, padMat, pads, false));
    const parts = [];
    for (let i = 0; i < 10; i++) {
      const petal = clean(new THREE.SphereGeometry(0.1, 8, 6));
      petal.scale(0.45, 1.2, 0.25);
      const ring = i < 6 ? 0 : 1;
      petal.translate(0, 0.1, 0.06);
      petal.rotateX(ring ? 0.25 : 0.55);
      petal.rotateY((i / (ring ? 4 : 6)) * Math.PI * 2 + ring * 0.4);
      parts.push(paint(petal, ring ? '#ffd3e4' : '#ff7fae'));
    }
    const core = clean(new THREE.CylinderGeometry(0.035, 0.03, 0.05, 10));
    core.translate(0, 0.12, 0);
    parts.push(paint(core, '#f2d24a'));
    const flowerGeo = mergeGeometries(parts);
    flowerGeo.computeVertexNormals();
    const flowerMat = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.6, emissive: '#ff6fa0', emissiveIntensity: 0.08 });
    if (flowers.length) g.add(this.instanced(flowerGeo, flowerMat, flowers, false));
  }

  buildGrass(g, me) {
    const T = this.theme;
    const r = this.rand;
    const blade = new THREE.PlaneGeometry(0.07, 0.55, 1, 4);
    blade.translate(0, 0.275, 0);
    const p = blade.attributes.position;
    const colors = new Float32Array(p.count * 3);
    const base = col(T.grass[0]);
    const tip = col(T.grass[1]);
    for (let i = 0; i < p.count; i++) {
      const y = p.getY(i) / 0.55;
      p.setX(i, p.getX(i) * (1 - y * 0.85));
      p.setZ(i, y * y * 0.12);
      tmpC.copy(base).lerp(tip, y);
      colors.set([tmpC.r, tmpC.g, tmpC.b], i * 3);
    }
    blade.setAttribute('color', new THREE.BufferAttribute(colors, 3));
    const nrm = blade.attributes.normal;
    for (let i = 0; i < nrm.count; i++) nrm.setXYZ(i, 0, 1, 0);
    blade.deleteAttribute('uv');
    const list = [];
    const n = this.q.grass;
    for (let tries = 0; list.length < n && tries < n * 6; tries++) {
      const x = me.shore.x + (r() - 0.5) * 90;
      const z = me.shore.z + (r() - 0.2) * 70;
      const h = this.landOk(x, z, 0.75, 12, 0.7);
      if (h === null) continue;
      if (fbm(x * 0.08, z * 0.08, 77, 2) < 0.38) continue;
      const k = 0.7 + r() * 0.9;
      list.push({ pos: new THREE.Vector3(x, h - 0.03, z), rot: r() * 6.28, scale: new THREE.Vector3(k, k * (0.7 + r() * 0.8), k), color: new THREE.Color().setHSL(0, 0, 0.75 + r() * 0.45) });
    }
    const mat = windy(new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.9, side: THREE.DoubleSide }), 0.35);
    if (list.length) g.add(this.instanced(blade, mat, list, false));
  }

  buildFlowers(g, me) {
    const T = this.theme;
    const r = this.rand;
    const geo = clean(new THREE.IcosahedronGeometry(0.06, 0));
    geo.translate(0, 0.35, 0);
    paint(geo, '#ffffff');
    const list = [];
    for (let tries = 0; list.length < 400 * this.q.veg && tries < 6000; tries++) {
      const x = me.shore.x + (r() - 0.5) * 120;
      const z = me.shore.z + (r() - 0.2) * 80;
      const h = this.landOk(x, z, 0.9, 12, 0.6);
      if (h === null || noise2(x * 0.1, z * 0.1, 9) < 0.55) continue;
      list.push({ pos: new THREE.Vector3(x, h, z), rot: 0, scale: new THREE.Vector3(1, 1, 1), color: col(T.flowers[list.length % T.flowers.length]) });
    }
    const mat = windy(new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.6 }), 0.3);
    if (list.length) g.add(this.instanced(geo, mat, list, false));
  }

  buildIce(g) {
    const r = this.rand;
    const T = this.theme;
    const list = [];
    for (let tries = 0; list.length < 50 && tries < 800; tries++) {
      const a = r() * Math.PI * 2;
      const s = Math.sqrt(r()) * 0.95;
      const x = T.center[0] + Math.cos(a) * T.R[0] * s;
      const z = T.center[1] + Math.sin(a) * T.R[1] * s;
      if (Math.hypot(x - this.focus.x, z - this.focus.z) < 55) continue;
      if (this.heightAt(x, z) > -0.8) continue;
      const k = 1.5 + r() * 6;
      list.push({ pos: new THREE.Vector3(x, 0.05, z), rot: r() * 6.28, scale: new THREE.Vector3(k, 0.25 + r() * 0.3, k * (0.5 + r())) });
    }
    let geo = new THREE.CylinderGeometry(1, 1.1, 1, 7, 1);
    geo.deleteAttribute('uv');
    paint(geo, '#e9f3fa');
    const mat = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.3, metalness: 0.05, flatShading: true });
    if (list.length) g.add(this.instanced(geo, mat, list, false));
  }

  buildFireflies(g, me) {
    const n = 160;
    const pos = new Float32Array(n * 3);
    const seed = new Float32Array(n);
    const r = this.rand;
    for (let i = 0; i < n; i++) {
      const x = me.shore.x + (r() - 0.5) * 110;
      const z = me.shore.z + (r() - 0.35) * 70;
      pos.set([x, Math.max(0.3, this.heightAt(x, z)) + 0.5 + r() * 3, z], i * 3);
      seed[i] = r() * 100;
    }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    geo.setAttribute('seed', new THREE.BufferAttribute(seed, 1));
    const mat = new THREE.ShaderMaterial({
      uniforms: { uTime: time, uNight: { value: 0 }, uRatio: { value: this.renderer.getPixelRatio() } },
      vertexShader: `attribute float seed; uniform float uTime; uniform float uRatio; varying float vA;
        void main(){ vec3 p = position + vec3(sin(uTime*0.5+seed)*1.5, sin(uTime*0.8+seed*1.3)*0.5, cos(uTime*0.4+seed)*1.5);
        vec4 mv = modelViewMatrix * vec4(p,1.0); gl_Position = projectionMatrix * mv;
        vA = pow(max(0.0, sin(uTime*2.0 + seed*3.0)), 3.0);
        gl_PointSize = 26.0 * uRatio / -mv.z; }`,
      fragmentShader: `uniform float uNight; varying float vA;
        void main(){ float d = length(gl_PointCoord-0.5); float a = smoothstep(0.5,0.0,d);
        gl_FragColor = vec4(vec3(1.6, 2.2, 0.6), a * vA * uNight); }`,
      transparent: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
    });
    const pts = new THREE.Points(geo, mat);
    pts.frustumCulled = false;
    g.add(pts);
    return mat;
  }

  buildSnow(g) {
    const n = 2500;
    const pos = new Float32Array(n * 3);
    const r = this.rand;
    for (let i = 0; i < n; i++) pos.set([(r() - 0.5) * 80, r() * 30, (r() - 0.5) * 80], i * 3);
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    const mat = new THREE.ShaderMaterial({
      uniforms: { uTime: time, uCenter: { value: new THREE.Vector3() }, uRatio: { value: this.renderer.getPixelRatio() } },
      vertexShader: `uniform float uTime; uniform vec3 uCenter; uniform float uRatio;
        void main(){ vec3 p = position; p.y = mod(p.y - uTime * 1.2, 30.0);
        p.x += sin(uTime * 0.6 + position.z) * 1.2; p.z += cos(uTime*0.5 + position.x) * 0.8;
        p.xz = mod(p.xz - uCenter.xz + 40.0, 80.0) - 40.0 + uCenter.xz;
        vec4 mv = modelViewMatrix * vec4(p, 1.0); gl_Position = projectionMatrix * mv;
        gl_PointSize = 10.0 * uRatio / -mv.z; }`,
      fragmentShader: `void main(){ float d = length(gl_PointCoord-0.5); gl_FragColor = vec4(1.0,1.0,1.0, smoothstep(0.5,0.1,d)*0.9); }`,
      transparent: true,
      depthWrite: false,
    });
    const pts = new THREE.Points(geo, mat);
    pts.frustumCulled = false;
    g.add(pts);
    return mat;
  }

  buildAurora(g, me) {
    const mat = new THREE.ShaderMaterial({
      uniforms: { uTime: time, uNight: { value: 0 } },
      vertexShader: 'varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }',
      fragmentShader: `uniform float uTime; uniform float uNight; varying vec2 vUv;
        float h(float x){ return fract(sin(x*127.1)*43758.5453); }
        float n(float x){ float i = floor(x); float f = fract(x); return mix(h(i), h(i+1.0), f*f*(3.0-2.0*f)); }
        void main(){
          float x = vUv.x * 14.0;
          float curtain = n(x + uTime * 0.15) * 0.6 + n(x * 3.1 - uTime * 0.3) * 0.4;
          float rays = 0.6 + 0.4 * sin(vUv.x * 220.0 + n(x*2.0)*8.0 + uTime);
          float fadeY = smoothstep(0.0, 0.25, vUv.y) * (1.0 - smoothstep(0.35, 1.0, vUv.y));
          vec3 c = mix(vec3(0.1, 1.0, 0.55), vec3(0.65, 0.25, 1.0), smoothstep(0.3, 0.9, vUv.y));
          float a = curtain * rays * fadeY * smoothstep(0.0, 0.15, vUv.x) * smoothstep(1.0, 0.85, vUv.x);
          gl_FragColor = vec4(c * 1.6, a * uNight * 0.8);
        }`,
      transparent: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
      side: THREE.DoubleSide,
      fog: false,
    });
    for (let i = 0; i < 3; i++) {
      const geo = new THREE.PlaneGeometry(2600, 700, 80, 1);
      const p = geo.attributes.position;
      for (let k = 0; k < p.count; k++) {
        const x = p.getX(k);
        p.setZ(k, Math.sin(x * 0.0025 + i * 2) * 400 + Math.sin(x * 0.006 + i) * 120);
      }
      const m = new THREE.Mesh(geo, mat);
      m.position.set(me.stand.x + (i - 1) * 400, 650 + i * 120, me.stand.z - 1800 - i * 300);
      m.rotation.x = -0.15;
      m.renderOrder = -1;
      g.add(m);
    }
    return mat;
  }

  addRipple(x, z, strength = 1) {
    this.ripples[this.rippleIdx].set(x, z, time.value, strength);
    this.rippleIdx = (this.rippleIdx + 1) % this.ripples.length;
  }

  // Chỉnh trời theo giờ trong game
  setHour(hour) {
    const T = this.theme;
    const th = ((hour - 6) / 12) * Math.PI;
    const sun = new THREE.Vector3(Math.cos(th) * 0.95, Math.sin(th) * 0.8, -0.55).normalize();
    this.sunDir.copy(sun);
    const elev = sun.y;
    const day = smoothstep(-0.12, 0.08, elev);
    this.night = 1 - smoothstep(-0.2, 0.02, elev);
    const golden = smoothstep(0.35, 0.02, elev) * day;

    const su = this.sky.material.uniforms;
    su.sunPosition.value.copy(sun);
    su.turbidity.value = T.sky.turbidity + golden * 4;
    su.rayleigh.value = T.sky.rayleigh + golden * 1.5;
    su.mieCoefficient.value = 0.005;
    su.mieDirectionalG.value = 0.8;
    su.skyGain.value = lerp(0.42, 1, golden) * (1 - this.night) + this.night;

    const moonDir = sun.clone().multiplyScalar(-1);
    moonDir.y = Math.abs(moonDir.y) * 0.8 + 0.12;
    moonDir.normalize();
    this.moon.position.copy(this.focus).addScaledVector(moonDir, 3600);
    this.moon.visible = this.night > 0.02;

    // nắng ấm khi thấp, trắng khi lên cao; đêm dùng ánh trăng xanh nhạt
    const sunCol = new THREE.Color('#ff9a4a').lerp(new THREE.Color('#fff4e6'), smoothstep(0.02, 0.45, elev));
    const moonCol = new THREE.Color('#8fa8ff');
    const lightDir = day > 0.05 ? sun : moonDir;
    this.sun.position.copy(this.focus).addScaledVector(lightDir, 160);
    this.sun.target.position.copy(this.focus);
    this.sun.color.copy(day > 0.05 ? sunCol : moonCol);
    this.sun.intensity = day > 0.05 ? 3.2 * day : 0.5 * this.night;

    const skyTop = new THREE.Color('#9cc4f0').lerp(new THREE.Color('#f0a878'), golden * 0.6);
    skyTop.lerp(new THREE.Color('#1a2a50'), this.night);
    this.hemi.color.copy(skyTop);
    this.hemi.groundColor.set('#4a4030').lerp(new THREE.Color('#0a0c14'), this.night);
    this.hemi.intensity = 0.6 + day * 0.8 + this.night * 0.25;

    const fogDay = new THREE.Color('#a8c0d8');
    const fogGold = new THREE.Color('#e0a07a');
    const fogNight = new THREE.Color('#0b1424');
    const fog = fogDay.lerp(fogGold, golden * 0.55).lerp(fogNight, this.night);
    if (T.snow) fog.lerp(new THREE.Color('#c8d8e8'), 0.3 * (1 - this.night));
    this.scene.fog.color.copy(fog);
    const mist = hour > 4.5 && hour < 9 ? Math.sin(((hour - 4.5) / 4.5) * Math.PI) : 0;
    this.scene.fog.density = T.fog + mist * T.mist;

    const w = this.water.material.uniforms;
    w.sunDirection.value.copy(day > 0.05 ? sun : moonDir);
    w.sunColor.value.copy(day > 0.05 ? sunCol : new THREE.Color('#9fb4ff').multiplyScalar(0.16));
    const wc = new THREE.Color(T.water.color);
    w.waterColor.value.copy(wc.multiplyScalar(0.25 + 0.75 * day));
    w.shallowColor.value.set(T.water.shallow).multiplyScalar(0.15 + 0.85 * day);
    w.foamColor.value.set(T.water.foam).multiplyScalar(0.2 + 0.8 * day);

    this.starMat.uniforms.uNight.value = this.night;
    this.nightDome.material.uniforms.uNight.value = this.night;
    for (const m of this.clouds.children) {
      m.material.color.set('#ffffff').lerp(new THREE.Color('#ffb07a'), golden).lerp(new THREE.Color('#1c2438'), this.night * 0.92);
      m.material.opacity = 0.6 + golden * 0.3 - this.night * 0.3;
    }
    const lampOn = smoothstep(0.15, -0.05, elev);
    for (const m of this.lamps || []) m.emissiveIntensity = lampOn * 4;
    if (this.lampLight) this.lampLight.intensity = lampOn * 9;
    if (this.fireflies) this.fireflies.uniforms.uNight.value = this.night;
    if (this.aurora) this.aurora.uniforms.uNight.value = this.night;
    this.renderer.toneMappingExposure = 0.42 + day * 0.12 + this.night * 0.25;

    // trời mưa: mây xám dày, sương mù, nắng yếu, mặt nước gợn nhiều
    const rain = this.rain;
    if (rain > 0) {
      const grey = new THREE.Color('#8e9aa4').multiplyScalar(0.25 + 0.75 * day);
      this.scene.fog.color.lerp(grey, rain * 0.7);
      this.scene.fog.density += rain * 0.009;
      su.skyGain.value *= 1 - rain * 0.35;
      su.turbidity.value += rain * 8;
      this.sun.intensity *= 1 - rain * 0.7;
      this.hemi.intensity *= 1 - rain * 0.15;
      this.hemi.color.lerp(new THREE.Color('#b8c4cc'), rain * 0.5 * day);
      w.sunColor.value.multiplyScalar(1 - rain * 0.8);
      for (const m of this.clouds.children) {
        m.material.color.lerp(new THREE.Color('#6a747c').multiplyScalar(0.3 + 0.7 * day), rain * 0.8);
        m.material.opacity = Math.min(1, m.material.opacity + rain * 0.35);
      }
    }
    w.distortionScale.value = this.theme.water.distortion * (1 + rain * 1.4);
    if (this.rainLines) {
      this.rainLines.visible = rain > 0.01;
      this.rainLines.material.uniforms.uRain.value = rain;
      this.rainLines.material.uniforms.uLight.value = 0.35 + 0.65 * day;
    }
  }

  update(dt, camera) {
    for (const c of this.clouds.children) {
      c.userData.a += c.userData.speed * dt * 0.05;
      c.position.x = Math.cos(c.userData.a) * c.userData.d + this.focus.x;
      c.position.z = Math.sin(c.userData.a) * c.userData.d + this.focus.z;
    }
    this.stars.position.copy(camera.position);
    this.nightDome.position.copy(camera.position);
    this.water.material.uniforms.time.value = time.value;
    if (this.snow) this.snow.uniforms.uCenter.value.copy(camera.position);
    if (this.rainLines) this.rainLines.material.uniforms.uCenter.value.copy(camera.position);
    // hạt mưa lốm đốm trên mặt nước gần chỗ đứng
    if (this.rain > 0.2 && Math.random() < this.rain * dt * 2) {
      const a = Math.random() * Math.PI * 2;
      const d = 4 + Math.random() * 14;
      this.addRipple(camera.position.x + Math.cos(a) * d, camera.position.z + Math.sin(a) * d, 0.25);
    }
    for (const b of this.boats || []) b.position.y = Math.sin(time.value * 0.8 + b.userData.bob) * 0.25;
  }
}

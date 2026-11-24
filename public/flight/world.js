// Thế giới 3D của Sải Cánh: địa hình chia ô theo cây tứ phân, bầu trời, mây, nước, rừng cây, thị trấn.
import * as THREE from 'three';
import { Water } from 'three/addons/objects/Water.js';
import { Sky } from 'three/addons/objects/Sky.js';
import { heightAt, forestAt, townMask, airportMask, WORLD, fbm } from './terrain.js';

/** Cấu hình chất lượng đồ hoạ. */
export const QUALITY = {
  low: { label: 'Thấp', ratio: 0.75, shadow: 1024, water: 0, trees: 1100, treeStep: 18, clouds: 110, lod: 1.0, segs: 24 },
  mid: { label: 'Vừa', ratio: 1, shadow: 2048, water: 384, trees: 1900, treeStep: 15, clouds: 170, lod: 1.25, segs: 32 },
  high: { label: 'Cao', ratio: 1.5, shadow: 4096, water: 640, trees: 2800, treeStep: 12, clouds: 240, lod: 1.5, segs: 40 },
};

/** Thời điểm trong ngày: hướng mặt trời, màu nắng, màu sương. */
export const TIMES = {
  morning: { label: 'Sáng sớm', elev: 14, az: 105, sun: 0xffe2b8, sunI: 2.6, hemiSky: 0x9fb8d8, hemiGround: 0x5a5040, hemiI: 0.9, fog: 0xb9c6d2, fogD: 0.000052, turbidity: 3.2, rayleigh: 1.4, exposure: 0.52 },
  noon: { label: 'Giữa trưa', elev: 58, az: 160, sun: 0xfff6ea, sunI: 3.1, hemiSky: 0xa9c4e6, hemiGround: 0x5b5a46, hemiI: 1.0, fog: 0xbfd0e2, fogD: 0.000045, turbidity: 2.2, rayleigh: 1.0, exposure: 0.46 },
  sunset: { label: 'Hoàng hôn', elev: 4.5, az: 248, sun: 0xffa35c, sunI: 2.4, hemiSky: 0x8f8fb0, hemiGround: 0x4a3a30, hemiI: 0.75, fog: 0xc9a58e, fogD: 0.00006, turbidity: 5, rayleigh: 2.2, exposure: 0.6 },
};

export const LAYER_NEAR = 1; // lớp vẽ gần (buồng lái, máy bay) với mặt phẳng gần riêng

// ---------- GLSL dùng chung ----------
const GLSL_NOISE = /* glsl */ `
float h21(vec2 p){ p = fract(p * vec2(123.34, 456.21)); p += dot(p, p + 45.32); return fract(p.x * p.y); }
float vn(vec2 p){ vec2 i = floor(p), f = fract(p); f = f * f * (3. - 2. * f);
  return mix(mix(h21(i), h21(i + vec2(1., 0.)), f.x), mix(h21(i + vec2(0., 1.)), h21(i + vec2(1., 1.)), f.x), f.y); }
float fbm3(vec2 p){ return (vn(p) * .5 + vn(p * 2.03 + 3.1) * .25 + vn(p * 4.07 - 1.7) * .125) / .875; }
vec3 lin(vec3 c){ return c * c * (c * .31 + .69); }
`;

// Tô màu địa hình kiểu ảnh vệ tinh: ruộng, rừng, đá, tuyết, bãi cát, phố
const TERRAIN_COLOR = /* glsl */ `
vec3 terrainColor(vec3 wp, vec3 n, vec3 msk, float px) {
  float h = wp.y;
  float slope = 1. - n.y;
  vec2 p = wp.xz;
  float big = fbm3(p / 2600.);
  float mid = fbm3(p / 340.);
  float fine = vn(p / 3.5) * (1. - smoothstep(1.5, 5., px));
  vec3 grassA = lin(vec3(.33, .42, .19)), grassB = lin(vec3(.47, .51, .27)), dry = lin(vec3(.60, .56, .38));
  vec3 col = mix(grassA, grassB, smoothstep(.35, .7, mid));
  col = mix(col, dry, smoothstep(.55, .8, big) * .6);

  // ruộng đồng chia ô
  vec2 wq = p + (vec2(vn(p / 900.), vn(p / 900. + 7.)) - .5) * 300.;
  float ca = .42, cs = cos(ca), sn = sin(ca);
  vec2 r = mat2(cs, -sn, sn, cs) * wq;
  vec2 cellSize = vec2(190., 130.);
  vec2 cid = floor(r / cellSize);
  float hc = h21(cid);
  if (hc > .55) { cellSize.x *= .5; cid = floor(r / cellSize) + 91.; }
  vec2 cf = fract(r / cellSize);
  float k = h21(cid + 17.);
  vec3 fc = k < .17 ? vec3(.40, .50, .19) : k < .32 ? vec3(.63, .58, .31) : k < .46 ? vec3(.49, .39, .27)
          : k < .62 ? vec3(.31, .44, .17) : k < .76 ? vec3(.70, .64, .40) : k < .88 ? vec3(.45, .47, .25) : vec3(.37, .33, .23);
  fc = mix(lin(fc) * (.9 + .2 * h21(cid + 5.)), col, .22);
  float rows = sin((k > .5 ? r.x : r.y) * 1.6) * .5 + .5;
  fc *= 1. - .08 * rows * (1. - smoothstep(.6, 2.5, px));
  vec2 ed = min(cf, 1. - cf) * cellSize;
  float hedge = (1. - smoothstep(1.5, 4.5, min(ed.x, ed.y))) * step(.45, h21(cid + 3.)) * (1. - smoothstep(4., 14., px));
  fc = mix(fc, lin(vec3(.16, .24, .11)), hedge * .85);
  float fw = (1. - msk.x) * smoothstep(330., 230., h) * (1. - smoothstep(.06, .13, slope)) * (1. - msk.y) * (1. - msk.z)
           * smoothstep(3., 9., h) * smoothstep(.28, .42, vn(p / 2300. + 11.));
  col = mix(col, fc, fw);

  // rừng: tán cây lốm đốm
  float crowns = vn(p / 4.) * .5 + vn(p / 11.) * .3 + vn(p / 60.) * .2;
  vec3 forest = mix(lin(vec3(.24, .34, .15)), lin(vec3(.36, .46, .21)), crowns * (1. - smoothstep(2., 8., px)) + mid * .3);
  forest = mix(forest, lin(vec3(.17, .22, .12)), smoothstep(500., 1300., h) * .7);
  col = mix(col, forest, smoothstep(.15, .6, msk.x));

  // phố: mái nhà, đường
  vec2 tg = fract(p / 60.); float road = step(min(tg.x, tg.y), .12);
  vec3 town = mix(lin(vec3(.55, .50, .46)) * (.8 + .4 * vn(p / 9.)), lin(vec3(.30, .30, .31)), road);
  col = mix(col, town, msk.y * .85);

  // sân bay: cỏ cắt sọc
  float mow = step(.5, fract(p.x / 24.));
  col = mix(col, lin(vec3(.36, .46, .22)) * (.95 + .08 * mow), msk.z * .85);

  // đá trên sườn dốc, núi cao
  float strata = vn(vec2(p.x / 40., h / 6.)) * .5 + vn(p / 13.) * .5;
  vec3 rock = mix(lin(vec3(.30, .28, .25)), lin(vec3(.49, .46, .41)), strata);
  float rk = smoothstep(.28, .45, slope + mid * .12) + smoothstep(1500., 1900., h + mid * 200.) * .7;
  col = mix(col, rock, clamp(rk, 0., 1.));

  // tuyết
  float sline = 1550. + (big - .5) * 500. + (mid - .5) * 160.;
  float snow = smoothstep(sline, sline + 120., h) * (1. - smoothstep(.45, .7, slope));
  col = mix(col, lin(vec3(.93, .95, .98)), snow);

  // bãi cát ven nước
  col = mix(col, lin(vec3(.74, .68, .52)), (1. - smoothstep(2., 7., h + (mid - .5) * 6.)) * (1. - msk.z));
  col = mix(col, lin(vec3(.48, .44, .34)), 1. - smoothstep(-3., 1., h));

  col *= .92 + .16 * mid + .07 * (fine - .5);
  return col;
}
`;

function terrainMaterial() {
  const mat = new THREE.MeshStandardMaterial({ roughness: 0.96, metalness: 0, envMapIntensity: 0.35 });
  mat.onBeforeCompile = (sh) => {
    sh.vertexShader = sh.vertexShader
      .replace('#include <common>', '#include <common>\nattribute vec3 aMask;\nvarying vec3 vMask;\nvarying vec3 vWP;\nvarying vec3 vWN;')
      .replace('#include <begin_vertex>', '#include <begin_vertex>\nvMask = aMask;\nvWP = (modelMatrix * vec4(position, 1.)).xyz;\nvWN = normal;');
    sh.fragmentShader = sh.fragmentShader
      .replace('#include <common>', '#include <common>\nvarying vec3 vMask;\nvarying vec3 vWP;\nvarying vec3 vWN;\n' + GLSL_NOISE + TERRAIN_COLOR)
      .replace('vec4 diffuseColor = vec4( diffuse, opacity );',
        'float pxs = length(fwidth(vWP.xz));\nvec4 diffuseColor = vec4(terrainColor(vWP, normalize(vWN), vMask, pxs), 1.);');
  };
  return mat;
}

// ---------- Ô địa hình ----------
function buildChunk(cx, cz, size, segs, mat) {
  const n = segs + 1;
  const step = size / segs;
  const x0 = cx - size / 2, z0 = cz - size / 2;
  // độ cao có viền 1 ô để tính pháp tuyến
  const W = n + 2;
  const H = new Float32Array(W * W);
  for (let j = 0; j < W; j++) for (let i = 0; i < W; i++) H[j * W + i] = heightAt(x0 + (i - 1) * step, z0 + (j - 1) * step);
  const skirt = 4 * segs;
  const pos = new Float32Array((n * n + skirt) * 3);
  const nor = new Float32Array((n * n + skirt) * 3);
  const msk = new Float32Array((n * n + skirt) * 3);
  let v = 0;
  for (let j = 0; j < n; j++) {
    for (let i = 0; i < n; i++, v++) {
      const x = x0 + i * step, z = z0 + j * step;
      const h = H[(j + 1) * W + i + 1];
      pos[v * 3] = x; pos[v * 3 + 1] = h; pos[v * 3 + 2] = z;
      const hx = H[(j + 1) * W + i + 2] - H[(j + 1) * W + i];
      const hz = H[(j + 2) * W + i + 1] - H[j * W + i + 1];
      const nx = -hx, ny = 2 * step, nz = -hz, l = Math.hypot(nx, ny, nz);
      nor[v * 3] = nx / l; nor[v * 3 + 1] = ny / l; nor[v * 3 + 2] = nz / l;
      msk[v * 3] = forestAt(x, z, h); msk[v * 3 + 1] = townMask(x, z); msk[v * 3 + 2] = airportMask(x, z) > 0.98 ? 1 : airportMask(x, z) * 0.8;
    }
  }
  const idx = [];
  for (let j = 0; j < segs; j++) {
    for (let i = 0; i < segs; i++) {
      const a = j * n + i, b = a + 1, c = a + n, d = c + 1;
      idx.push(a, c, b, b, c, d);
    }
  }
  // váy che khe nối giữa các ô khác mức chi tiết
  const drop = size * 0.02 + 4;
  const edge = [];
  for (let i = 0; i < segs; i++) edge.push(i);
  for (let j = 0; j < segs; j++) edge.push(j * n + segs);
  for (let i = segs; i > 0; i--) edge.push(segs * n + i);
  for (let j = segs; j > 0; j--) edge.push(j * n);
  const base = v;
  for (let e = 0; e < edge.length; e++, v++) {
    const s = edge[e];
    pos[v * 3] = pos[s * 3]; pos[v * 3 + 1] = pos[s * 3 + 1] - drop; pos[v * 3 + 2] = pos[s * 3 + 2];
    for (let c = 0; c < 3; c++) { nor[v * 3 + c] = nor[s * 3 + c]; msk[v * 3 + c] = msk[s * 3 + c]; }
  }
  for (let e = 0; e < edge.length; e++) {
    const a = edge[e], b = edge[(e + 1) % edge.length];
    const a2 = base + e, b2 = base + ((e + 1) % edge.length);
    idx.push(a, b, a2, b, b2, a2);
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  g.setAttribute('normal', new THREE.BufferAttribute(nor, 3));
  g.setAttribute('aMask', new THREE.BufferAttribute(msk, 3));
  g.setIndex(idx);
  g.computeBoundingSphere();
  const m = new THREE.Mesh(g, mat);
  m.receiveShadow = true;
  m.matrixAutoUpdate = false;
  return m;
}

class TerrainLOD {
  constructor(scene, q) {
    this.scene = scene;
    this.mat = terrainMaterial();
    this.cache = new Map();
    this.shown = new Set();
    this.q = q;
    this.root = 16384;
    this.minSize = 256;
  }

  wanted(cam) {
    const out = [];
    const R = this.root;
    const rx = Math.round(cam.x / R), rz = Math.round(cam.z / R);
    const camH = Math.max(0, cam.y - Math.max(0, heightAt(cam.x, cam.z)));
    const rec = (cx, cz, size) => {
      const dx = Math.max(0, Math.abs(cam.x - cx) - size / 2);
      const dz = Math.max(0, Math.abs(cam.z - cz) - size / 2);
      const d = Math.hypot(dx, dz, camH * 0.5);
      if (size > this.minSize && d < size * this.q.lod) {
        const h = size / 4;
        rec(cx - h, cz - h, size / 2); rec(cx + h, cz - h, size / 2);
        rec(cx - h, cz + h, size / 2); rec(cx + h, cz + h, size / 2);
      } else out.push(cx + ',' + cz + ',' + size);
    };
    for (let j = -2; j <= 2; j++) for (let i = -2; i <= 2; i++) rec((rx + i) * R, (rz + j) * R, R);
    return out;
  }

  update(cam, budgetMs = 6, force = false) {
    const keys = this.wanted(cam);
    const t0 = performance.now();
    let missing = 0;
    for (const k of keys) {
      if (this.cache.has(k)) continue;
      if (!force && performance.now() - t0 > budgetMs) { missing++; continue; }
      const [cx, cz, size] = k.split(',').map(Number);
      const segs = size >= 8192 ? 16 : this.q.segs;
      const m = buildChunk(cx, cz, size, segs, this.mat);
      m.userData.used = 0;
      this.cache.set(k, m);
    }
    if (missing === 0) {
      const next = new Set(keys);
      for (const k of this.shown) if (!next.has(k)) this.scene.remove(this.cache.get(k));
      for (const k of next) if (!this.shown.has(k)) this.scene.add(this.cache.get(k));
      this.shown = next;
      // dọn bớt ô cũ
      if (this.cache.size > 700) {
        for (const [k, m] of this.cache) {
          if (!next.has(k)) { m.geometry.dispose(); this.cache.delete(k); }
          if (this.cache.size < 450) break;
        }
      }
    }
    return missing;
  }
}

// ---------- Cây ----------
function treeGeometries() {
  const pine = [];
  const trunk = new THREE.CylinderGeometry(0.18, 0.28, 3, 5).translate(0, 1.5, 0);
  pine.push(paint(trunk, 0x4a3524));
  for (let i = 0; i < 3; i++) {
    const r = 2.6 - i * 0.65, h = 4.2 - i * 0.6;
    pine.push(paint(new THREE.ConeGeometry(r, h, 7).translate(0, 2.6 + i * 2.1 + h / 2, 0), [0x2c5426, 0x33602b, 0x3d6c31][i]));
  }
  const broad = [];
  broad.push(paint(new THREE.CylinderGeometry(0.22, 0.32, 3.4, 5).translate(0, 1.7, 0), 0x50392a));
  const crown = new THREE.IcosahedronGeometry(3.1, 1);
  const p = crown.attributes.position;
  for (let i = 0; i < p.count; i++) {
    const s = 1 + 0.18 * Math.sin(p.getX(i) * 2.1 + p.getY(i) * 1.3) * Math.cos(p.getZ(i) * 1.7);
    p.setXYZ(i, p.getX(i) * s, p.getY(i) * s * 0.85, p.getZ(i) * s);
  }
  crown.translate(0, 5.6, 0);
  broad.push(paint(crown, 0x4a7237));
  return { pine: merge(pine), broad: merge(broad) };
}

function paint(g, hex) {
  g = g.index ? g.toNonIndexed() : g;
  g.computeVertexNormals();
  const c = new THREE.Color(hex);
  const n = g.attributes.position.count;
  const col = new Float32Array(n * 3);
  for (let i = 0; i < n; i++) {
    const y = g.attributes.position.getY(i);
    const k = 0.75 + 0.25 * Math.min(1, y / 9);
    col[i * 3] = c.r * k; col[i * 3 + 1] = c.g * k; col[i * 3 + 2] = c.b * k;
  }
  g.setAttribute('color', new THREE.BufferAttribute(col, 3));
  return g;
}

function merge(list) {
  let n = 0;
  for (const g of list) n += g.attributes.position.count;
  const pos = new Float32Array(n * 3), nor = new Float32Array(n * 3), col = new Float32Array(n * 3);
  let o = 0;
  for (const g of list) {
    pos.set(g.attributes.position.array, o * 3);
    nor.set(g.attributes.normal.array, o * 3);
    col.set(g.attributes.color.array, o * 3);
    o += g.attributes.position.count;
  }
  const out = new THREE.BufferGeometry();
  out.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  out.setAttribute('normal', new THREE.BufferAttribute(nor, 3));
  out.setAttribute('color', new THREE.BufferAttribute(col, 3));
  return out;
}

function hash(i, j, s) {
  let h = Math.imul(i, 374761393) + Math.imul(j, 668265263) + Math.imul(s, 982451653);
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  return ((h ^ (h >>> 16)) >>> 0) / 4294967295;
}

class Trees {
  constructor(scene, q) {
    this.scene = scene;
    this.q = q;
    this.cell = 400;
    this.cells = new Map();
    const g = treeGeometries();
    this.geo = g;
    this.mat = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.92, envMapIntensity: 0.3 });
  }

  buildCell(ci, cj) {
    const C = this.cell, step = this.q.treeStep;
    const pineM = [], broadM = [];
    const m = new THREE.Matrix4(), qt = new THREE.Quaternion(), s = new THREE.Vector3(), p = new THREE.Vector3();
    const up = new THREE.Vector3(0, 1, 0);
    for (let j = 0; j < C / step; j++) {
      for (let i = 0; i < C / step; i++) {
        const r1 = hash(ci * 64 + i, cj * 64 + j, 1), r2 = hash(ci * 64 + i, cj * 64 + j, 2), r3 = hash(ci * 64 + i, cj * 64 + j, 3);
        const x = ci * C + (i + r1) * step, z = cj * C + (j + r2) * step;
        const h = heightAt(x, z);
        const f = forestAt(x, z, h);
        if (r3 > f * 1.05 - 0.05) continue;
        const sc = 0.7 + hash(i, j, ci * 7 + cj) * 0.75;
        s.set(sc, sc * (0.85 + r1 * 0.35), sc);
        qt.setFromAxisAngle(up, r2 * 6.28);
        p.set(x, h - 0.4, z);
        m.compose(p, qt, s);
        const pineChance = 0.35 + Math.min(0.6, Math.max(0, (h - 250) / 700));
        (r1 < pineChance ? pineM : broadM).push(m.clone());
      }
    }
    const group = new THREE.Group();
    const make = (geo, list) => {
      if (!list.length) return;
      const im = new THREE.InstancedMesh(geo, this.mat, list.length);
      const col = new THREE.Color();
      list.forEach((mm, k) => {
        im.setMatrixAt(k, mm);
        const v = 0.8 + hash(k, ci, cj) * 0.4;
        col.setRGB(v, v * (0.95 + hash(cj, k, 9) * 0.1), v * 0.9);
        im.setColorAt(k, col);
      });
      im.castShadow = true;
      im.receiveShadow = false;
      im.computeBoundingSphere();
      group.add(im);
    };
    make(this.geo.pine, pineM);
    make(this.geo.broad, broadM);
    return group;
  }

  update(cam, budgetMs = 4) {
    const R = this.q.trees, C = this.cell;
    const camH = cam.y - Math.max(0, heightAt(cam.x, cam.z));
    const radius = camH > 1400 ? R * 0.4 : R;
    const ci0 = Math.floor(cam.x / C), cj0 = Math.floor(cam.z / C);
    const n = Math.ceil(radius / C);
    const t0 = performance.now();
    const keep = new Set();
    const todo = [];
    for (let j = -n; j <= n; j++) {
      for (let i = -n; i <= n; i++) {
        const cx = (ci0 + i + 0.5) * C, cz = (cj0 + j + 0.5) * C;
        const d = Math.hypot(cx - cam.x, cz - cam.z);
        if (d > radius + C) continue;
        const k = (ci0 + i) + ',' + (cj0 + j);
        keep.add(k);
        if (!this.cells.has(k)) todo.push([d, ci0 + i, cj0 + j, k]);
      }
    }
    todo.sort((a, b) => a[0] - b[0]);
    for (const [, i, j, k] of todo) {
      if (performance.now() - t0 > budgetMs) break;
      const g = this.buildCell(i, j);
      this.cells.set(k, g);
      this.scene.add(g);
    }
    for (const [k, g] of this.cells) {
      if (!keep.has(k)) {
        this.scene.remove(g);
        g.children.forEach((c) => c.dispose());
        this.cells.delete(k);
      }
    }
  }
}

// ---------- Thị trấn ----------
function buildTown(scene) {
  const T = WORLD.town;
  const walls = [], roofs = [];
  const m = new THREE.Matrix4(), q = new THREE.Quaternion(), s = new THREE.Vector3(), p = new THREE.Vector3();
  const up = new THREE.Vector3(0, 1, 0);
  const wallCols = [0xe8dcc4, 0xf2e6a8, 0xd9c2a0, 0xc8d4d8, 0xf0f0ea, 0xe3b98f, 0xb8c8a8];
  const roofCols = [0xa0442c, 0x8a3a26, 0x5a5f66, 0xb5532f, 0x6b4a3a];
  for (let z = T.z - T.r; z < T.z + T.r; z += 30) {
    for (let x = T.x - T.r; x < T.x + T.r; x += 30) {
      const t = townMask(x, z);
      const r = hash(Math.round(x), Math.round(z), 5);
      if (t < 0.25 || r > t * 0.95) continue;
      const fx = x + 8 + hash(x, z, 6) * 6, fz = z + 8 + hash(x, z, 7) * 6;
      const h = heightAt(fx, fz);
      const center = Math.hypot(fx - T.x, fz - T.z) < T.r * 0.28;
      const storeys = center ? 2 + Math.floor(hash(x, z, 8) * 5) : 1 + Math.floor(hash(x, z, 8) * 2);
      const w = 8 + hash(x, z, 9) * 7, d = 7 + hash(x, z, 10) * 6, hh = storeys * 3.2;
      q.setFromAxisAngle(up, 0.42 + (hash(x, z, 11) < 0.2 ? Math.PI / 2 : 0));
      p.set(fx, h + hh / 2 - 0.5, fz); s.set(w, hh + 1, d);
      walls.push([m.compose(p, q, s).clone(), wallCols[Math.floor(hash(x, z, 12) * wallCols.length)]]);
      if (!center || hash(x, z, 13) < 0.4) {
        const rh = 2 + w * 0.15;
        p.set(fx, h + hh + rh / 2, fz); s.set(w * 0.78, rh, d * 0.78);
        roofs.push([m.compose(p, q, s).clone(), roofCols[Math.floor(hash(x, z, 14) * roofCols.length)]]);
      }
    }
  }
  const wallGeo = new THREE.BoxGeometry(1, 1, 1);
  const roofGeo = new THREE.ConeGeometry(0.72, 1, 4, 1).rotateY(Math.PI / 4);
  const mk = (geo, list, rough) => {
    const im = new THREE.InstancedMesh(geo, new THREE.MeshStandardMaterial({ roughness: rough, envMapIntensity: 0.4 }), list.length);
    const c = new THREE.Color();
    list.forEach(([mm, col], i) => { im.setMatrixAt(i, mm); im.setColorAt(i, c.set(col)); });
    im.castShadow = true; im.receiveShadow = true;
    scene.add(im);
  };
  mk(wallGeo, walls, 0.85);
  mk(roofGeo, roofs, 0.7);
}

// ---------- Mây ----------
function cloudTexture() {
  // khối mây bông: nhiều hạt mờ chồng lên nhau rồi bào mòn mép bằng nhiễu
  const N = 256;
  const c = document.createElement('canvas');
  c.width = c.height = N;
  const g = c.getContext('2d');
  let s = 9;
  const rnd = () => ((s = (Math.imul(s, 1103515245) + 12345) >>> 0) / 4294967296);
  for (let i = 0; i < 220; i++) {
    const a = rnd() * Math.PI * 2, rr = Math.pow(rnd(), 0.7) * 78;
    const x = 128 + Math.cos(a) * rr, y = 128 + Math.sin(a) * rr * 0.75;
    const rad = 10 + rnd() * 26;
    const grd = g.createRadialGradient(x, y, 0, x, y, rad);
    grd.addColorStop(0, 'rgba(255,255,255,0.16)');
    grd.addColorStop(1, 'rgba(255,255,255,0)');
    g.fillStyle = grd;
    g.beginPath(); g.arc(x, y, rad, 0, Math.PI * 2); g.fill();
  }
  const img = g.getImageData(0, 0, N, N);
  for (let y = 0; y < N; y++) for (let x = 0; x < N; x++) {
    const d = Math.hypot(x - 128, (y - 128) * 1.1) / 128;
    const n = fbm(x / 22, y / 22, 4) * 0.5 + 0.5;
    const i = (y * N + x) * 4 + 3;
    const v = img.data[i] / 255 * 1.9 * (0.55 + n * 0.9) * Math.max(0, 1 - d * d);
    img.data[i] = Math.min(255, Math.pow(Math.min(1, v), 1.2) * 255);
  }
  g.putImageData(img, 0, 0);
  return new THREE.CanvasTexture(c);
}

class Clouds {
  constructor(scene, q, fog) {
    const L = 44000;
    const quad = new THREE.PlaneGeometry(1, 1);
    const geo = new THREE.InstancedBufferGeometry();
    geo.index = quad.index;
    geo.attributes.position = quad.attributes.position;
    geo.attributes.uv = quad.attributes.uv;
    const pos = [], size = [], shade = [], rot = [];
    let s = 4242;
    const rnd = () => ((s = (Math.imul(s, 1103515245) + 12345) >>> 0) / 4294967296);
    for (let c = 0; c < q.clouds; c++) {
      const cx = (rnd() - 0.5) * L, cz = (rnd() - 0.5) * L;
      if (Math.abs(cx) < 1500 && Math.abs(cz) < 2500) continue; // trời quang ngay trên sân bay
      const base = 1500 + rnd() * 600;
      const R = 250 + rnd() * 700;
      const tall = 0.5 + rnd() * 0.9;
      const puffs = 12 + Math.floor(rnd() * 16);
      for (let k = 0; k < puffs; k++) {
        const a = rnd() * 6.28, rr = Math.sqrt(rnd()) * R;
        const y = Math.pow(rnd(), 1.6) * R * tall * (1 - rr / R * 0.6);
        pos.push(cx + Math.cos(a) * rr, base + y, cz + Math.sin(a) * rr * 0.8);
        size.push((R * 0.75 + rnd() * R * 0.6) * (1 - y / (R * tall + 1) * 0.35));
        shade.push(Math.min(1, y / (R * tall * 0.8 + 1)));
        rot.push(rnd() * 6.28);
      }
    }
    geo.setAttribute('iPos', new THREE.InstancedBufferAttribute(new Float32Array(pos), 3));
    geo.setAttribute('iSize', new THREE.InstancedBufferAttribute(new Float32Array(size), 1));
    geo.setAttribute('iShade', new THREE.InstancedBufferAttribute(new Float32Array(shade), 1));
    geo.setAttribute('iRot', new THREE.InstancedBufferAttribute(new Float32Array(rot), 1));
    geo.instanceCount = size.length;
    this.uniforms = {
      uTex: { value: cloudTexture() },
      uSunDir: { value: new THREE.Vector3(0, 1, 0) },
      uSun: { value: new THREE.Color(1, 1, 1) },
      uShadow: { value: new THREE.Color(0.5, 0.55, 0.65) },
      uFog: { value: fog.color },
      uFogD: { value: fog.density },
      uL: { value: L },
      uWind: { value: new THREE.Vector2(0, 0) },
    };
    const mat = new THREE.ShaderMaterial({
      uniforms: this.uniforms,
      transparent: true,
      depthWrite: false,
      vertexShader: /* glsl */ `
        attribute vec3 iPos; attribute float iSize; attribute float iShade; attribute float iRot;
        uniform float uL; uniform vec2 uWind;
        varying vec2 vUv; varying float vShade; varying float vDist; varying vec3 vDir;
        void main() {
          vec3 c = iPos; c.xz += uWind;
          c.xz = cameraPosition.xz + mod(c.xz - cameraPosition.xz + uL * .5, uL) - uL * .5;
          vec3 right = vec3(viewMatrix[0][0], viewMatrix[1][0], viewMatrix[2][0]);
          vec3 up = vec3(viewMatrix[0][1], viewMatrix[1][1], viewMatrix[2][1]);
          float cr = cos(iRot), sr = sin(iRot);
          vec2 q = mat2(cr, -sr, sr, cr) * position.xy;
          vec3 wp = c + (right * q.x + up * q.y) * iSize;
          vUv = uv; vShade = iShade + position.y * .35;
          vDist = distance(wp, cameraPosition);
          vDir = normalize(wp - cameraPosition);
          gl_Position = projectionMatrix * viewMatrix * vec4(wp, 1.);
        }`,
      fragmentShader: /* glsl */ `
        uniform sampler2D uTex; uniform vec3 uSunDir, uSun, uShadow, uFog; uniform float uFogD;
        varying vec2 vUv; varying float vShade; varying float vDist; varying vec3 vDir;
        void main() {
          float a = texture2D(uTex, vUv).a;
          if (a < .01) discard;
          float lit = clamp(vShade, 0., 1.);
          float silver = pow(max(dot(vDir, uSunDir), 0.), 8.) * (1. - a) * 1.5;
          vec3 col = mix(uShadow, uSun, .35 + .65 * lit) + uSun * silver;
          float f = 1. - exp(-pow(vDist * uFogD * .8, 2.));
          col = mix(col, uFog, f);
          float near = smoothstep(30., 260., vDist);
          gl_FragColor = vec4(col, a * near * (1. - smoothstep(18000., 21500., vDist)));
          #include <tonemapping_fragment>
          #include <colorspace_fragment>
        }`,
    });
    this.mesh = new THREE.Mesh(geo, mat);
    this.mesh.frustumCulled = false;
    this.mesh.renderOrder = 5;
    scene.add(this.mesh);
  }
}

// ---------- Nước ----------
function waterNormals() {
  const N = 256;
  const hgt = new Float32Array(N * N);
  let s = 7;
  const r = () => ((s = (Math.imul(s, 1103515245) + 12345) >>> 0) / 4294967296);
  const waves = [];
  for (let i = 0; i < 46; i++) {
    const f = 1 + Math.floor(r() * (i < 10 ? 4 : 14));
    const a = r() * Math.PI * 2;
    waves.push([Math.round(Math.cos(a) * f), Math.round(Math.sin(a) * f), r() * 6.28, 1 / (f + 1)]);
  }
  for (let y = 0; y < N; y++) for (let x = 0; x < N; x++) {
    let v = 0;
    for (const [kx, ky, ph, amp] of waves) v += Math.sin(((kx * x + ky * y) / N) * Math.PI * 2 + ph) * amp;
    hgt[y * N + x] = v;
  }
  const data = new Uint8Array(N * N * 4);
  for (let y = 0; y < N; y++) for (let x = 0; x < N; x++) {
    const hx = hgt[y * N + ((x + 1) % N)] - hgt[y * N + ((x - 1 + N) % N)];
    const hy = hgt[((y + 1) % N) * N + x] - hgt[((y - 1 + N) % N) * N + x];
    const v = new THREE.Vector3(-hx * 0.9, -hy * 0.9, 1).normalize();
    const i = (y * N + x) * 4;
    data[i] = (v.x * 0.5 + 0.5) * 255; data[i + 1] = (v.y * 0.5 + 0.5) * 255; data[i + 2] = (v.z * 0.5 + 0.5) * 255; data[i + 3] = 255;
  }
  const tex = new THREE.DataTexture(data, N, N);
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
  tex.magFilter = THREE.LinearFilter;
  tex.minFilter = THREE.LinearMipmapLinearFilter;
  tex.generateMipmaps = true;
  tex.needsUpdate = true;
  return tex;
}

/** Thế giới: dựng mọi thứ, cập nhật theo vị trí máy quay. */
export class World {
  constructor(renderer, scene, quality, timeKey) {
    this.renderer = renderer;
    this.scene = scene;
    this.q = QUALITY[quality] || QUALITY.mid;
    const T = TIMES[timeKey] || TIMES.morning;
    this.T = T;
    scene.fog = new THREE.FogExp2(T.fog, T.fogD);

    // bầu trời: hoà dần vào màu sương ở chân trời cho liền mạch với địa hình xa
    const sky = new Sky();
    sky.scale.setScalar(60000);
    const u = sky.material.uniforms;
    u.turbidity.value = T.turbidity; u.rayleigh.value = T.rayleigh;
    u.mieCoefficient.value = 0.004; u.mieDirectionalG.value = 0.82;
    u.uHaze = { value: new THREE.Color(T.fog) };
    u.uGain = { value: 1 };
    sky.material.fragmentShader = sky.material.fragmentShader
      .replace('uniform vec3 up;', 'uniform vec3 up;\nuniform vec3 uHaze;\nuniform float uGain;')
      .replace('gl_FragColor = vec4( retColor, 1.0 );',
        `retColor *= uGain;
        float hz = 1.0 - smoothstep(-0.01, 0.16, direction.y);
        vec3 hazeLin = uHaze;
        retColor = mix(retColor, hazeLin, hz * 0.92);
        gl_FragColor = vec4( retColor, 1.0 );`);
    this.sky = sky;
    scene.add(sky);

    const sunDir = new THREE.Vector3().setFromSphericalCoords(1, THREE.MathUtils.degToRad(90 - T.elev), THREE.MathUtils.degToRad(T.az));
    // az đo từ bắc theo chiều kim đồng hồ: bắc là -z
    sunDir.set(Math.sin(THREE.MathUtils.degToRad(T.az)) * Math.cos(THREE.MathUtils.degToRad(T.elev)), Math.sin(THREE.MathUtils.degToRad(T.elev)), -Math.cos(THREE.MathUtils.degToRad(T.az)) * Math.cos(THREE.MathUtils.degToRad(T.elev)));
    this.sunDir = sunDir;
    u.sunPosition.value.copy(sunDir).multiplyScalar(1000);

    const sun = new THREE.DirectionalLight(T.sun, T.sunI);
    sun.castShadow = true;
    sun.shadow.mapSize.set(this.q.shadow, this.q.shadow);
    const sc = sun.shadow.camera;
    sc.left = -45; sc.right = 45; sc.top = 45; sc.bottom = -45; sc.near = 1; sc.far = 600;
    sun.shadow.bias = -0.0003;
    sun.shadow.normalBias = 0.03;
    sun.layers.enableAll();
    sc.layers.enableAll();
    this.sun = sun;
    scene.add(sun, sun.target);
    const hemi = new THREE.HemisphereLight(T.hemiSky, T.hemiGround, T.hemiI);
    hemi.layers.enableAll();
    scene.add(hemi);
    this.hemi = hemi;

    // ánh sáng môi trường từ bầu trời (phản chiếu trên vỏ máy bay)
    const pm = new THREE.PMREMGenerator(renderer);
    const envScene = new THREE.Scene();
    const sky2 = new Sky();
    sky2.scale.setScalar(1000);
    Object.assign(sky2.material.uniforms.turbidity, { value: T.turbidity });
    sky2.material.uniforms.rayleigh.value = T.rayleigh;
    sky2.material.uniforms.sunPosition.value.copy(sunDir);
    envScene.add(sky2);
    const ground = new THREE.Mesh(new THREE.CircleGeometry(900, 16).rotateX(-Math.PI / 2), new THREE.MeshBasicMaterial({ color: 0x4a5236 }));
    ground.position.y = -5;
    envScene.add(ground);
    this.env = pm.fromScene(envScene, 0.02).texture;
    scene.environment = this.env;

    this.terrain = new TerrainLOD(scene, this.q);
    this.trees = new Trees(scene, this.q);
    buildTown(scene);
    this.clouds = new Clouds(scene, this.q, scene.fog);
    this.clouds.uniforms.uSunDir.value.copy(sunDir);
    this.clouds.uniforms.uSun.value.set(T.sun).lerp(new THREE.Color(1, 1, 1), 0.5).multiplyScalar(2.1 / T.exposure * 0.5);
    this.clouds.uniforms.uShadow.value.set(T.hemiSky).multiplyScalar(1.15 / T.exposure * 0.5);

    // nước biển và hồ
    if (this.q.water) {
      this.water = new Water(new THREE.PlaneGeometry(120000, 120000), {
        textureWidth: this.q.water, textureHeight: this.q.water,
        waterNormals: waterNormals(), sunDirection: sunDir.clone(), sunColor: T.sun,
        waterColor: 0x0e3445, distortionScale: 2.2, fog: true,
      });
      this.water.material.uniforms.size.value = 0.35;
    } else {
      this.water = new THREE.Mesh(new THREE.PlaneGeometry(120000, 120000),
        new THREE.MeshStandardMaterial({ color: 0x0f3a4d, roughness: 0.15, metalness: 0.2 }));
    }
    this.water.rotation.x = -Math.PI / 2;
    this.water.position.y = WORLD.sea;
    scene.add(this.water);
    this.time = 0;
  }

  /** Dựng hết địa hình cần thiết quanh điểm xuất phát (màn hình tải). */
  prime(cam) {
    this.terrain.update(cam, 0, true);
    this.trees.update(cam, 1e9);
  }

  update(dt, camera, focus) {
    this.time += dt;
    const c = camera.position;
    this.terrain.update(c, 5);
    this.trees.update(c, 3);
    this.sky.position.copy(c);
    this.water.position.x = Math.round(c.x / 1000) * 1000;
    this.water.position.z = Math.round(c.z / 1000) * 1000;
    if (this.water.material.uniforms && this.water.material.uniforms.time) this.water.material.uniforms.time.value += dt * 0.6;
    this.clouds.uniforms.uWind.value.set(this.time * 3, this.time * 1.2);
    // bóng đổ đi theo máy bay
    this.sun.position.copy(focus).addScaledVector(this.sunDir, 250);
    this.sun.target.position.copy(focus);
    this.sun.target.updateMatrixWorld();
  }
}

export { fbm };

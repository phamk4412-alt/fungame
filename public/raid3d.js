// Căn cứ tận thế 3D: đi lại trong căn cứ bằng góc nhìn thứ 3, nâng cấp công trình và nhặt phế liệu
import * as THREE from 'three';

const $ = (id) => document.getElementById(id);

const RES = [
  ['scrap', '🔩', 'Sắt vụn'],
  ['fuel', '🛢️', 'Nhiên liệu'],
  ['food', '🥫', 'Lương thực'],
];
const RES_NAME = Object.fromEntries(RES.map(([r, , n]) => [r, n]));

const token = localStorage.getItem('raid.token');
if (!token) location.href = '/raid.html';

let state = null;
let stateAt = 0;
let clockSkew = 0;

function esc(s) {
  return String(s).replace(/[&<>"']/g, (c) => `&#${c.charCodeAt(0)};`);
}
function fmt(n) {
  return Math.floor(n).toLocaleString('vi-VN');
}
function serverNow() {
  return Date.now() + clockSkew;
}
function duration(ms) {
  const s = Math.max(0, Math.ceil(ms / 1000));
  const d = Math.floor(s / 86400);
  const h = Math.floor((s % 86400) / 3600);
  const m = Math.floor((s % 3600) / 60);
  if (d) return `${d} ngày ${h} giờ`;
  if (h) return `${h} giờ ${m} phút`;
  if (m) return `${m} phút ${s % 60} giây`;
  return `${s % 60} giây`;
}

let toastTimer;
function toast(text) {
  $('toast').textContent = text;
  $('toast').classList.remove('hidden');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => $('toast').classList.add('hidden'), 3000);
}

async function api(method, path, body) {
  const res = await fetch('/api/raid/' + path, {
    method,
    headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + token },
    body: body ? JSON.stringify(body) : undefined,
  });
  const data = await res.json().catch(() => ({ error: 'Không kết nối được máy chủ.' }));
  if (res.status === 401) {
    localStorage.removeItem('raid.token');
    location.href = '/raid.html';
  }
  if (!res.ok) throw new Error(data.error || 'Có lỗi xảy ra.');
  if (data.state) setState(data.state);
  return data;
}

function currentRes(r) {
  const base = state.resources[r];
  if (base >= state.capacity) return base;
  return Math.min(state.capacity, base + (state.rates[r] * (Date.now() - stateAt)) / 3600000);
}
function canPay(cost) {
  return RES.every(([r]) => currentRes(r) >= (cost[r] || 0));
}

// ---------- Cảnh 3D ----------

const canvas = $('view');
const renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;

const scene = new THREE.Scene();
const SKY = 0xc98b55;
scene.background = new THREE.Color(SKY);
scene.fog = new THREE.Fog(SKY, 40, 120);

const camera = new THREE.PerspectiveCamera(60, 1, 0.1, 300);

scene.add(new THREE.HemisphereLight(0xffd9a8, 0x3b2a1a, 0.9));
const sun = new THREE.DirectionalLight(0xffc98a, 1.6);
sun.position.set(30, 50, 20);
sun.castShadow = true;
sun.shadow.mapSize.set(2048, 2048);
Object.assign(sun.shadow.camera, { left: -45, right: 45, top: 45, bottom: -45, near: 1, far: 150 });
scene.add(sun);
scene.add(sun.target);

const mats = {};
function mat(color) {
  if (!mats[color]) mats[color] = new THREE.MeshStandardMaterial({ color, flatShading: true, roughness: 0.9 });
  return mats[color];
}
function mesh(geo, color, x = 0, y = 0, z = 0) {
  const m = new THREE.Mesh(geo, typeof color === 'number' ? mat(color) : color);
  m.position.set(x, y, z);
  m.castShadow = true;
  m.receiveShadow = true;
  return m;
}
const box = (w, h, d) => new THREE.BoxGeometry(w, h, d);
const cyl = (rt, rb, h, n = 10) => new THREE.CylinderGeometry(rt, rb, h, n);

// Nền đất hoang
const ground = new THREE.Mesh(new THREE.PlaneGeometry(400, 400), mat(0x8a6a48));
ground.rotation.x = -Math.PI / 2;
ground.receiveShadow = true;
scene.add(ground);
const yard = new THREE.Mesh(new THREE.CircleGeometry(22, 48), mat(0x6f5a44));
yard.rotation.x = -Math.PI / 2;
yard.position.y = 0.01;
yard.receiveShadow = true;
scene.add(yard);

// Ngẫu nhiên cố định để bãi hoang lần nào vào cũng giống nhau
let seed = 7;
function rnd() {
  seed = (seed * 16807) % 2147483647;
  return (seed - 1) / 2147483646;
}

const obstacles = []; // { x, z, r } để nhân vật không đi xuyên

function addWreck(x, z) {
  const g = new THREE.Group();
  const colors = [0x6b4b3a, 0x4f5b4a, 0x5a4a6a, 0x7a3a2a];
  const c = colors[Math.floor(rnd() * colors.length)];
  g.add(mesh(box(4, 1.1, 2), c, 0, 0.7, 0));
  g.add(mesh(box(2.2, 0.9, 1.8), c, -0.3, 1.6, 0));
  for (const [wx, wz] of [[-1.3, 1], [1.3, 1], [-1.3, -1], [1.3, -1]]) {
    const w = mesh(cyl(0.4, 0.4, 0.3, 8), 0x222222, wx, 0.4, wz);
    w.rotation.x = Math.PI / 2;
    g.add(w);
  }
  g.position.set(x, 0, z);
  g.rotation.y = rnd() * Math.PI * 2;
  g.rotation.z = (rnd() - 0.5) * 0.3;
  scene.add(g);
  obstacles.push({ x, z, r: 2.2 });
}
function addRock(x, z) {
  const s = 0.6 + rnd() * 1.6;
  const r = mesh(new THREE.DodecahedronGeometry(s, 0), 0x7d7066, x, s * 0.5, z);
  r.rotation.set(rnd() * 3, rnd() * 3, rnd() * 3);
  scene.add(r);
  if (s > 1) obstacles.push({ x, z, r: s });
}
function addDeadTree(x, z) {
  const g = new THREE.Group();
  g.add(mesh(cyl(0.15, 0.3, 4, 6), 0x3d2b1f, 0, 2, 0));
  for (let i = 0; i < 3; i++) {
    const b = mesh(cyl(0.05, 0.12, 1.8, 5), 0x3d2b1f, 0, 2.5 + i * 0.5, 0);
    b.rotation.z = (i % 2 ? 1 : -1) * (0.6 + rnd() * 0.4);
    b.rotation.y = rnd() * 6;
    b.position.x = Math.sin(b.rotation.z) * -0.6;
    g.add(b);
  }
  g.position.set(x, 0, z);
  scene.add(g);
  obstacles.push({ x, z, r: 0.5 });
}
for (let i = 0; i < 70; i++) {
  const a = rnd() * Math.PI * 2;
  const d = 28 + rnd() * 60;
  const x = Math.cos(a) * d;
  const z = Math.sin(a) * d;
  const k = rnd();
  if (k < 0.2) addWreck(x, z);
  else if (k < 0.7) addRock(x, z);
  else addDeadTree(x, z);
}

// ---------- Công trình ----------

// Vị trí: Trụ sở ở giữa, 6 công trình quanh vòng, Tường rào là hàng rào bao quanh (cổng ở phía nam)
const SLOTS = {
  hq: [0, -2],
  scrap: [-12, -8],
  fuel: [12, -8],
  food: [-14, 5],
  storage: [14, 5],
  turret: [-7, 14],
  barracks: [7, 14],
  wall: [0, 22],
};
const BASE_R = 22;

function scaffold(g, w, h) {
  // giàn giáo màu vàng khi đang xây
  const y = mat(0xd9a520);
  for (const [x, z] of [[-w, -w], [w, -w], [-w, w], [w, w]]) g.add(mesh(box(0.15, h, 0.15), y, x, h / 2, z));
  g.add(mesh(box(w * 2, 0.12, 0.15), y, 0, h, -w));
  g.add(mesh(box(w * 2, 0.12, 0.15), y, 0, h, w));
}

function buildMesh(key, level, building) {
  const g = new THREE.Group();
  const s = 1 + level * 0.12;
  let h = 1;
  if (level === 0) {
    // nền móng chưa xây
    g.add(mesh(box(4, 0.2, 4), 0x5a4a3a, 0, 0.1, 0));
    g.add(mesh(cyl(0.08, 0.08, 1.4, 6), 0x3a2a1a, 1.6, 0.7, 1.6));
    g.add(mesh(box(1, 0.6, 0.06), 0xd9a520, 1.6, 1.4, 1.62));
    h = 1.8;
  } else if (key === 'hq') {
    h = 3 + level * 0.5;
    g.add(mesh(box(6 * s, h, 5 * s), 0x6d6255, 0, h / 2, 0));
    g.add(mesh(box(6.4 * s, 0.4, 5.4 * s), 0x4a3b2c, 0, h + 0.2, 0));
    g.add(mesh(box(1.6, 2, 0.2), 0x3a2a1a, 0, 1, 2.5 * s + 0.05));
    g.add(mesh(cyl(0.08, 0.12, 3 + level * 0.3, 6), 0x999999, 1.8 * s, h + 1.5 + level * 0.15, -1.2 * s));
    for (let i = 0; i < Math.min(level, 5); i++) g.add(mesh(box(0.8, 0.5, 0.05), 0xffcf6b, -2 * s + i * 1, h * 0.65, 2.5 * s + 0.03));
    h += 3 + level * 0.3;
  } else if (key === 'scrap') {
    for (let i = 0; i < 2 + level; i++) {
      const a = (i / (2 + level)) * Math.PI * 2;
      const r = i === 0 ? 0 : 1.6 * s;
      const c = mesh(new THREE.ConeGeometry(1 + rnd() * 0.6, 1.2 + level * 0.15, 6), [0x777777, 0x8a5a3a, 0x666e74][i % 3], Math.cos(a) * r, 0.6, Math.sin(a) * r);
      g.add(c);
    }
    const crane = mesh(box(0.3, 3 + level * 0.2, 0.3), 0xc9752c, -2 * s, 1.5 + level * 0.1, -1.5);
    g.add(crane);
    h = 3.5 + level * 0.2;
  } else if (key === 'fuel') {
    const th = 2 + level * 0.35;
    g.add(mesh(cyl(1.4 * s, 1.4 * s, th, 14), 0x8a8f7a, 0, th / 2, 0));
    g.add(mesh(cyl(1.45 * s, 1.45 * s, 0.2, 14), 0xb84a2a, 0, th * 0.7, 0));
    if (level > 1) g.add(mesh(cyl(0.9, 0.9, th * 0.7, 12), 0x7a7f6a, 2.4 * s, th * 0.35, 0.5));
    const pipe = mesh(cyl(0.15, 0.15, 3, 6), 0x555555, -1.8 * s, 0.6, 0);
    pipe.rotation.z = Math.PI / 2;
    g.add(pipe);
    h = th + 0.6;
  } else if (key === 'food') {
    const gh = 1.6 + level * 0.15;
    const glass = new THREE.MeshStandardMaterial({ color: 0xa8d8a0, transparent: true, opacity: 0.45, roughness: 0.2 });
    g.add(mesh(box(5 * s, gh, 3.2), glass, 0, gh / 2, 0));
    for (let i = 0; i < 2 + level; i++) g.add(mesh(new THREE.SphereGeometry(0.35, 6, 5), 0x5f9a3a, -2 * s + (i * 4 * s) / (1 + level), 0.4, (i % 2) - 0.5));
    h = gh + 0.5;
  } else if (key === 'storage') {
    const n = Math.min(1 + Math.ceil(level / 2), 5);
    const colors = [0xa0522d, 0x3d6b8a, 0x6b7a3d, 0x8a3d3d, 0x7a6a3d];
    for (let i = 0; i < n; i++) {
      const layer = i >= 3 ? 1 : 0;
      g.add(mesh(box(4, 2, 1.8), colors[i], 0, 1 + layer * 2, -1.9 + (i % 3) * 1.9));
    }
    h = n > 3 ? 4.5 : 2.5;
  } else if (key === 'turret') {
    const th = 3 + level * 0.4;
    for (const [x, z] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) g.add(mesh(box(0.25, th, 0.25), 0x5a5048, x, th / 2, z));
    g.add(mesh(box(2.8, 0.3, 2.8), 0x4a4038, 0, th, 0));
    g.add(mesh(box(1.6, 1, 1.6), 0x55604a, 0, th + 0.65, 0));
    const barrel = mesh(cyl(0.12, 0.12, 2 + level * 0.1, 6), 0x2a2a2a, 0, th + 0.7, 1.4);
    barrel.rotation.x = Math.PI / 2;
    g.add(barrel);
    g.userData.spin = g.children[g.children.length - 2];
    h = th + 1.5;
  } else if (key === 'barracks') {
    const n = Math.min(1 + Math.floor(level / 2), 4);
    for (let i = 0; i < n; i++) {
      const tent = mesh(new THREE.ConeGeometry(1.8, 2.2, 4), 0x5f6b3a, -((n - 1) * 1.9) / 2 + i * 1.9, 1.1, 0);
      tent.rotation.y = Math.PI / 4;
      g.add(tent);
    }
    g.add(mesh(cyl(0.05, 0.05, 4, 5), 0x888888, 2.5, 2, -1.5));
    g.add(mesh(box(1, 0.6, 0.04), 0x8a2a2a, 3, 3.6, -1.5));
    h = 4.2;
  } else if (key === 'wall') {
    // cổng: hai trụ và thanh chắn
    g.add(mesh(box(0.8, 3 + level * 0.2, 0.8), 0x5a5048, -2.5, 1.5 + level * 0.1, 0));
    g.add(mesh(box(0.8, 3 + level * 0.2, 0.8), 0x5a5048, 2.5, 1.5 + level * 0.1, 0));
    g.add(mesh(box(5.8, 0.3, 0.3), 0xd9a520, 0, 2.6 + level * 0.2, 0));
    h = 3.5 + level * 0.2;
  }
  if (building) scaffold(g, 2.6, h);
  g.userData.height = h;
  return g;
}

// Hàng rào quanh căn cứ, cao dần theo cấp Tường rào
let fence = null;
function buildFence(level) {
  if (fence) scene.remove(fence);
  fence = new THREE.Group();
  if (level > 0) {
    const n = 64;
    const h = 1 + level * 0.25;
    const color = level >= 6 ? 0x6a6a6a : level >= 3 ? 0x7a6450 : 0x6b4b2a;
    for (let i = 0; i < n; i++) {
      const a = (i / n) * Math.PI * 2;
      const x = Math.sin(a) * BASE_R;
      const z = Math.cos(a) * BASE_R;
      if (Math.abs(x) < 3.5 && z > 0) continue; // chừa cổng
      const p = mesh(box(2.2, h, 0.35), color, x, h / 2, z);
      p.rotation.y = a;
      p.rotation.z = (i % 3) * 0.04 - 0.04;
      fence.add(p);
      if (level >= 4 && i % 4 === 0) fence.add(mesh(cyl(0.12, 0.12, h + 1.2, 5), 0x444444, x, (h + 1.2) / 2, z));
    }
  }
  scene.add(fence);
}

const buildingObjs = {}; // key -> { group, sig, label }
for (const [key, [x, z]] of Object.entries(SLOTS)) {
  const label = document.createElement('div');
  label.className = 'label';
  $('labels').appendChild(label);
  buildingObjs[key] = { group: null, sig: '', label, x, z };
  if (key !== 'wall') obstacles.push({ x, z, r: key === 'hq' ? 4 : 2.8 });
}

function syncBuildings() {
  for (const [key, b] of Object.entries(state.buildings)) {
    const o = buildingObjs[key];
    const building = state.build && state.build.key === key;
    const sig = `${b.level}|${building}`;
    if (sig !== o.sig) {
      if (o.group) scene.remove(o.group);
      o.group = buildMesh(key, b.level, building);
      o.group.position.set(o.x, 0, o.z);
      if (key !== 'wall') o.group.rotation.y = Math.atan2(-o.x, -o.z); // quay mặt vào giữa
      scene.add(o.group);
      o.sig = sig;
      if (key === 'wall') buildFence(b.level);
    }
    o.label.innerHTML = `${b.icon} ${esc(b.name)} <b>CẤP ${b.level}</b>${building ? ' 🔨' : ''}`;
  }
}

// ---------- Điểm nhặt phế liệu ----------

const SPOT_COUNT = 6;
const spots = [];
for (let i = 0; i < SPOT_COUNT; i++) {
  const a = (i / SPOT_COUNT) * Math.PI * 2 + 0.4;
  const x = Math.cos(a) * 38;
  const z = Math.sin(a) * 38;
  const g = new THREE.Group();
  const kind = RES[i % 3][0];
  const color = { scrap: 0x8a8a8a, fuel: 0x8a3a2a, food: 0x6a8a3a }[kind];
  if (kind === 'fuel') {
    for (let k = 0; k < 3; k++) {
      const barrel = mesh(cyl(0.45, 0.45, 1.2, 10), color, k - 1, 0.6, (k % 2) * 0.6);
      if (k === 2) barrel.rotation.z = Math.PI / 2;
      g.add(barrel);
    }
  } else if (kind === 'food') {
    for (let k = 0; k < 4; k++) g.add(mesh(box(0.9, 0.7, 0.9), 0x9a7a4a, (k % 2) - 0.5, 0.35 + Math.floor(k / 2) * 0.7, (k % 2) * 0.3));
  } else {
    g.add(mesh(new THREE.ConeGeometry(1.4, 1.2, 6), color, 0, 0.6, 0));
    g.add(mesh(box(1.6, 0.2, 0.3), 0x6a4a3a, 0.6, 1, 0.3));
  }
  const glow = new THREE.Mesh(new THREE.RingGeometry(1.8, 2.2, 24), new THREE.MeshBasicMaterial({ color: 0x8fc24a, transparent: true, opacity: 0.7 }));
  glow.rotation.x = -Math.PI / 2;
  glow.position.y = 0.05;
  g.add(glow);
  g.position.set(x, 0, z);
  scene.add(g);
  const label = document.createElement('div');
  label.className = 'label';
  $('labels').appendChild(label);
  spots.push({ i, x, z, kind, group: g, glow, label });
}

// ---------- Nhân vật ----------

const hero = new THREE.Group();
const legL = new THREE.Group();
const legR = new THREE.Group();
const armL = new THREE.Group();
const armR = new THREE.Group();
legL.add(mesh(box(0.3, 0.8, 0.3), 0x3a3a2a, 0, -0.4, 0));
legR.add(mesh(box(0.3, 0.8, 0.3), 0x3a3a2a, 0, -0.4, 0));
legL.position.set(-0.2, 0.85, 0);
legR.position.set(0.2, 0.85, 0);
armL.add(mesh(box(0.22, 0.7, 0.22), 0x6b5a3a, 0, -0.35, 0));
armR.add(mesh(box(0.22, 0.7, 0.22), 0x6b5a3a, 0, -0.35, 0));
armL.position.set(-0.45, 1.6, 0);
armR.position.set(0.45, 1.6, 0);
hero.add(legL, legR, armL, armR);
hero.add(mesh(box(0.75, 0.8, 0.45), 0x6b5a3a, 0, 1.25, 0)); // áo khoác
hero.add(mesh(box(0.6, 0.65, 0.3), 0x4a5a3a, 0, 1.3, -0.35)); // ba lô
hero.add(mesh(new THREE.SphereGeometry(0.28, 10, 8), 0xd9a87a, 0, 1.95, 0)); // đầu
hero.add(mesh(box(0.42, 0.15, 0.1), 0x2a2a2a, 0, 1.98, 0.25)); // kính phòng độc
hero.add(mesh(cyl(0.32, 0.36, 0.18, 10), 0x4a4a3a, 0, 2.18, 0)); // mũ
scene.add(hero);
hero.position.set(0, 0, 30);
hero.rotation.y = Math.PI;

// ---------- Điều khiển ----------

const isTouch = matchMedia('(pointer: coarse)').matches;
if (isTouch) document.body.classList.add('touch');
const KEY_HINT = isTouch ? '' : ' (E)';

const keys = new Set();
let yaw = 0; // camera nhìn về hướng -z khi yaw = 0
let pitch = 0.35;
let dist = 9;
const stickVec = { x: 0, y: 0 };

addEventListener('keydown', (e) => {
  keys.add(e.key.toLowerCase());
  if (e.key.toLowerCase() === 'e' || e.key === 'Enter') interact();
});
addEventListener('keyup', (e) => keys.delete(e.key.toLowerCase()));
addEventListener('blur', () => keys.clear());


let dragId = null;
let lastX = 0;
let lastY = 0;
canvas.addEventListener('pointerdown', (e) => {
  dragId = e.pointerId;
  lastX = e.clientX;
  lastY = e.clientY;
  try { canvas.setPointerCapture(e.pointerId); } catch {}
});
canvas.addEventListener('pointermove', (e) => {
  if (e.pointerId !== dragId) return;
  yaw -= (e.clientX - lastX) * 0.006;
  pitch = Math.min(1.2, Math.max(0.05, pitch + (e.clientY - lastY) * 0.004));
  lastX = e.clientX;
  lastY = e.clientY;
});
canvas.addEventListener('pointerup', () => (dragId = null));
canvas.addEventListener('pointercancel', () => (dragId = null));
canvas.addEventListener('wheel', (e) => {
  dist = Math.min(18, Math.max(4, dist + e.deltaY * 0.01));
  e.preventDefault();
}, { passive: false });

// Cần điều khiển ảo
const stick = $('stick');
let stickId = null;
function moveStick(e) {
  const r = stick.getBoundingClientRect();
  let x = (e.clientX - (r.left + r.width / 2)) / (r.width / 2);
  let y = (e.clientY - (r.top + r.height / 2)) / (r.height / 2);
  const len = Math.hypot(x, y);
  if (len > 1) {
    x /= len;
    y /= len;
  }
  stickVec.x = x;
  stickVec.y = y;
  $('knob').style.transform = `translate(${x * 35}px, ${y * 35}px)`;
}
stick.addEventListener('pointerdown', (e) => {
  stickId = e.pointerId;
  try { stick.setPointerCapture(e.pointerId); } catch {}
  moveStick(e);
});
stick.addEventListener('pointermove', (e) => e.pointerId === stickId && moveStick(e));
function releaseStick() {
  stickId = null;
  stickVec.x = stickVec.y = 0;
  $('knob').style.transform = '';
}
stick.addEventListener('pointerup', releaseStick);
stick.addEventListener('pointercancel', releaseStick);

// ---------- Tương tác ----------

let near = null; // { type: 'building', key } | { type: 'spot', i }
let promptSig = '';

function findNear() {
  let best = null;
  let bestD = Infinity;
  for (const [key, o] of Object.entries(buildingObjs)) {
    const reach = key === 'hq' ? 7 : 5;
    const d = Math.hypot(hero.position.x - o.x, hero.position.z - o.z);
    if (d < reach && d < bestD) {
      best = { type: 'building', key };
      bestD = d;
    }
  }
  for (const s of spots) {
    const d = Math.hypot(hero.position.x - s.x, hero.position.z - s.z);
    if (d < 4 && d < bestD) {
      best = { type: 'spot', i: s.i };
      bestD = d;
    }
  }
  return best;
}

function costHtml(cost) {
  return RES.filter(([r]) => cost[r])
    .map(([r, icon]) => `<span class="${currentRes(r) < cost[r] ? 'short' : ''}">${icon} ${fmt(cost[r])}</span>`)
    .join('');
}

function renderPrompt() {
  const p = $('prompt');
  if (!near || !state) {
    if (promptSig) {
      p.classList.add('hidden');
      promptSig = '';
    }
    return;
  }
  const now = serverNow();
  let html;
  if (near.type === 'building') {
    const b = state.buildings[near.key];
    const busy = !!state.build;
    let action;
    if (b.maxed) action = '<p>Đã đạt cấp tối đa.</p>';
    else if (b.locked) action = '<p>Nâng Trụ sở để mở cấp tiếp.</p>';
    else if (busy && state.build.key === near.key) action = `<p>🔨 Đang xây, còn ${duration(state.build.finishAt - now)}.</p>`;
    else {
      const ok = !busy && canPay(b.cost);
      action = `<div class="cost">${costHtml(b.cost)}<span>⏱ ${duration(b.timeMs)}</span></div>
        <button class="btn primary" data-act="1" ${ok ? '' : 'disabled'}>${b.level ? 'Nâng lên cấp ' + (b.level + 1) : 'Xây'}${KEY_HINT}</button>
        ${busy ? '<p>Thợ xây đang bận công trình khác.</p>' : ''}`;
    }
    html = `<h3>${b.icon} ${esc(b.name)} <span>CẤP ${b.level}</span></h3><p>${esc(b.desc)}</p>${action}`;
  } else {
    const s = spots[near.i];
    const readyAt = state.scavengeReadyAt[near.i];
    html = `<h3>🔎 Đống đổ nát <span>${RES_NAME[s.kind]}</span></h3>`;
    html += readyAt > now
      ? `<p>Đã nhặt sạch. Quay lại sau ${duration(readyAt - now)}.</p>`
      : `<p>Lục lọi để kiếm thêm ${RES_NAME[s.kind].toLowerCase()}.</p><button class="btn primary" data-act="1">Nhặt${KEY_HINT}</button>`;
  }
  if (html === promptSig) return;
  promptSig = html;
  p.innerHTML = html;
  p.classList.remove('hidden');
  const btn = p.querySelector('[data-act]');
  if (btn) btn.onclick = interact;
}

let acting = false;
async function interact() {
  if (!near || !state || acting) return;
  acting = true;
  try {
    if (near.type === 'building') {
      const b = state.buildings[near.key];
      if (b.maxed || b.locked || state.build) return;
      await api('POST', 'upgrade', { key: near.key });
      toast(`🔨 Bắt đầu nâng ${b.name}.`);
    } else {
      if (state.scavengeReadyAt[near.i] > serverNow()) return;
      const { result } = await api('POST', 'scavenge', { spot: near.i });
      toast(result.amount ? `+${result.amount} ${RES_NAME[result.resource].toLowerCase()}` : 'Kho đầy, không mang thêm được.');
    }
  } catch (err) {
    toast(err.message);
  } finally {
    acting = false;
    promptSig = '';
  }
}

// ---------- HUD ----------

function setState(s) {
  state = s;
  stateAt = Date.now();
  clockSkew = s.now - stateAt;
  syncBuildings();
  promptSig = '';
}

function renderHud() {
  const now = serverNow();
  $('resBar').innerHTML = RES.map(([r, icon]) => {
    const v = currentRes(r);
    const full = v >= state.capacity;
    return `<div class="res ${full ? 'full' : ''}">${icon} <b>${fmt(v)}</b><small> / ${fmt(state.capacity)} · +${fmt(state.rates[r])}/giờ</small></div>`;
  }).join('');

  const r = state.raid;
  $('banner').className = 'banner' + (r.open ? ' open' : '');
  $('banner').innerHTML = r.open
    ? `🔥 Đang mở cướp, còn ${duration(r.closesAt - now)}. Vào <a href="/raid.html" style="color:inherit">Bảng 2D</a> để chọn mục tiêu.`
    : `🕊️ Mở cướp sau ${duration(r.opensAt - now)}`;
  if (state.build) {
    const b = state.buildings[state.build.key];
    $('queue').className = 'queue busy';
    $('queue').textContent = `🔨 ${b.name} lên cấp ${b.level + 1}: còn ${duration(state.build.finishAt - now)}`;
    if (state.build.finishAt <= now) refresh();
  } else {
    $('queue').className = 'queue';
    $('queue').textContent = '🧰 Thợ xây đang rảnh. Đi tới công trình để nâng cấp.';
  }
  for (const s of spots) {
    const ready = state.scavengeReadyAt[s.i] <= now;
    s.glow.visible = ready;
    s.label.className = 'label' + (ready ? ' ready' : '');
    s.label.textContent = ready ? `🔎 Nhặt ${RES_NAME[s.kind].toLowerCase()}` : `⏳ ${duration(state.scavengeReadyAt[s.i] - now)}`;
  }
  renderPrompt();
}

let refreshing = false;
async function refresh() {
  if (refreshing) return;
  refreshing = true;
  try {
    await api('GET', 'me');
  } catch {
    // thử lại lần sau
  }
  setTimeout(() => (refreshing = false), 2000);
}

// ---------- Vòng lặp ----------

const tmp = new THREE.Vector3();
function placeLabel(el, x, y, z) {
  tmp.set(x, y, z);
  const d = tmp.distanceTo(camera.position);
  tmp.project(camera);
  if (tmp.z > 1 || d > 70) {
    el.style.display = 'none';
    return;
  }
  el.style.display = '';
  el.style.left = ((tmp.x + 1) / 2) * innerWidth + 'px';
  el.style.top = ((1 - tmp.y) / 2) * innerHeight + 'px';
}

function resize() {
  renderer.setSize(innerWidth, innerHeight, false);
  camera.aspect = innerWidth / innerHeight;
  camera.fov = camera.aspect < 1 ? 75 : 60; // điện thoại dựng đứng thì nhìn rộng hơn
  camera.updateProjectionMatrix();
}
addEventListener('resize', resize);
resize();

const clock = new THREE.Clock();
let walk = 0;
let hudTimer = 0;
function frame() {
  const dt = Math.min(clock.getDelta(), 0.05);

  // hướng đi theo camera
  let fx = 0;
  let fz = 0;
  if (keys.has('w') || keys.has('arrowup')) fz -= 1;
  if (keys.has('s') || keys.has('arrowdown')) fz += 1;
  if (keys.has('a') || keys.has('arrowleft')) fx -= 1;
  if (keys.has('d') || keys.has('arrowright')) fx += 1;
  fx += stickVec.x;
  fz += stickVec.y;
  const len = Math.hypot(fx, fz);
  const moving = len > 0.1;
  if (moving) {
    const run = keys.has('shift') ? 1.6 : 1;
    const speed = 7 * run * Math.min(1, len);
    fx /= len;
    fz /= len;
    const sin = Math.sin(yaw);
    const cos = Math.cos(yaw);
    const mx = fx * cos + fz * sin;
    const mz = -fx * sin + fz * cos;
    hero.position.x += mx * speed * dt;
    hero.position.z += mz * speed * dt;
    const target = Math.atan2(mx, mz);
    let diff = target - hero.rotation.y;
    diff = Math.atan2(Math.sin(diff), Math.cos(diff));
    hero.rotation.y += diff * Math.min(1, dt * 12);
    walk += dt * speed * 1.4;
  } else {
    walk *= 0.85;
  }
  // va chạm
  for (const o of obstacles) {
    const dx = hero.position.x - o.x;
    const dz = hero.position.z - o.z;
    const d = Math.hypot(dx, dz);
    const min = o.r + 0.5;
    if (d < min && d > 0.001) {
      hero.position.x = o.x + (dx / d) * min;
      hero.position.z = o.z + (dz / d) * min;
    }
  }
  const far = Math.hypot(hero.position.x, hero.position.z);
  if (far > 95) {
    hero.position.x *= 95 / far;
    hero.position.z *= 95 / far;
  }
  const swing = moving ? Math.sin(walk) * 0.7 : 0;
  legL.rotation.x = swing;
  legR.rotation.x = -swing;
  armL.rotation.x = -swing * 0.8;
  armR.rotation.x = swing * 0.8;
  hero.position.y = moving ? Math.abs(Math.sin(walk)) * 0.08 : 0;

  // camera sau lưng
  const tx = hero.position.x;
  const tz = hero.position.z;
  camera.position.set(
    tx + Math.sin(yaw) * Math.cos(pitch) * dist,
    1.8 + Math.sin(pitch) * dist,
    tz + Math.cos(yaw) * Math.cos(pitch) * dist,
  );
  camera.lookAt(tx, 1.6, tz);
  sun.position.set(tx + 30, 50, tz + 20);
  sun.target.position.set(tx, 0, tz);

  if (state) {
    const t = clock.elapsedTime;
    for (const o of Object.values(buildingObjs)) {
      if (o.group && o.group.userData.spin) o.group.userData.spin.rotation.y = Math.sin(t * 0.5) * 0.8;
      placeLabel(o.label, o.x, (o.group ? o.group.userData.height : 2) + 0.8, o.z);
    }
    for (const s of spots) {
      s.glow.material.opacity = 0.4 + Math.sin(t * 3) * 0.3;
      placeLabel(s.label, s.x, 2.4, s.z);
    }
    near = findNear();
    hudTimer -= dt;
    if (hudTimer <= 0) {
      hudTimer = 0.25;
      renderHud();
    }
  }

  renderer.render(scene, camera);
  requestAnimationFrame(frame);
}

api('GET', 'me')
  .then(() => {
    $('loading').classList.add('hidden');
    renderHud();
  })
  .catch((err) => {
    $('loading').textContent = err.message;
  });
setInterval(refresh, 30000);
requestAnimationFrame(frame);

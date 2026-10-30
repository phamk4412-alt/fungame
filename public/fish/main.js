// Câu Cá 3D: vòng chơi, điều khiển, giao diện, nói chuyện với máy chủ
import * as THREE from 'three';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';
import { World, QUALITY, time } from './world.js';
import { makeFish, fishLength, Angler, FishingLine, makeBobber } from './models.js';
import { Effects } from './fx.js';
import { makeBoat, makeJar, Debris, Monster } from './boss.js';
import { Sound } from './audio.js';
import { clamp, lerp, smoothstep } from './noise.js';

const $ = (id) => document.getElementById(id);
const esc = (s) => String(s).replace(/[&<>"']/g, (c) => `&#${c.charCodeAt(0)};`);
const fmt = (n) => Math.round(n).toLocaleString('vi-VN');
const kg = (w) => `${w.toLocaleString('vi-VN', { maximumFractionDigits: 2 })} kg`;
const mobile = matchMedia('(pointer: coarse)').matches;
// góc nhìn: 'fp' thứ nhất (thấy hai tay cầm cần), 'tp' thứ ba (thấy cả người)
let view = localStorage.getItem('fish.view') || 'fp';

let token = localStorage.getItem('fish.token');
let C = null; // danh mục: hồ, cá, cần, mồi
let me = null; // trạng thái người chơi
let clockSkew = 0;
const serverNow = () => Date.now() + clockSkew;

// ---------- Máy chủ ----------

async function api(method, path, body) {
  const res = await fetch('/api/fish/' + path, {
    method,
    headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: 'Bearer ' + token } : {}) },
    body: body ? JSON.stringify(body) : undefined,
  });
  const data = await res.json().catch(() => ({ error: 'Không kết nối được máy chủ.' }));
  if (res.status === 401 && token) {
    localStorage.removeItem('fish.token');
    token = null;
    location.reload();
  }
  if (!res.ok) throw new Error(data.error || 'Có lỗi xảy ra.');
  if (data.state) setState(data.state);
  return data;
}

function setState(s) {
  me = s;
  clockSkew = s.now - Date.now();
  renderHud();
}

let toastTimer;
function toast(text, ms = 2800) {
  $('toast').textContent = text;
  $('toast').classList.remove('hidden');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => $('toast').classList.add('hidden'), ms);
}

let bannerTimer;
function banner(html, color = '#fff', ms = 1600) {
  const b = $('banner');
  b.innerHTML = html;
  b.style.color = color;
  b.classList.remove('hidden');
  b.style.animation = 'none';
  void b.offsetWidth;
  b.style.animation = '';
  clearTimeout(bannerTimer);
  bannerTimer = setTimeout(() => b.classList.add('hidden'), ms);
}

function hint(text) {
  $('hint').textContent = text || '';
  $('hint').classList.toggle('hidden', !text);
}

// ---------- Cảnh 3D ----------

let quality = localStorage.getItem('fish.quality');
if (!QUALITY[quality]) quality = mobile ? 'vua' : 'cao';
const Q = QUALITY[quality];

const canvas = $('view');
const renderer = new THREE.WebGLRenderer({ canvas, antialias: !Q.bloom && quality !== 'thap', powerPreference: 'high-performance' });
renderer.setPixelRatio(Math.min(devicePixelRatio, Q.ratio));
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.shadowMap.enabled = !!Q.shadows;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;

const world = new World(renderer, quality);
const scene = world.scene;
const camera = world.camera;
scene.add(camera);
const fx = new Effects(scene, renderer.getPixelRatio());
const showLight = new THREE.PointLight(0xffffff, 0, 6, 1.2);
showLight.position.set(0.6, 0.8, -0.4);
camera.add(showLight);
const sound = new Sound();

let composer = null;
let bloom = null;
if (Q.bloom) {
  composer = new EffectComposer(renderer);
  composer.addPass(new RenderPass(scene, camera));
  bloom = new UnrealBloomPass(new THREE.Vector2(256, 256), 0.45, 0.55, 0.88);
  composer.addPass(bloom);
  composer.addPass(new OutputPass());
}

let baseFov = 55;
function resize() {
  const w = innerWidth;
  const h = innerHeight;
  renderer.setSize(w, h, false);
  camera.aspect = w / h;
  baseFov = (w < h ? 68 : 55) + (view === 'fp' ? 8 : 0);
  camera.fov = baseFov;
  camera.updateProjectionMatrix();
  if (composer) {
    composer.setSize(w, h);
    bloom.resolution.set(w / 2, h / 2);
  }
}
addEventListener('resize', resize);
resize();

// ---------- Người câu ----------

const player = { angler: null, line: new FishingLine(), bobber: makeBobber() };
scene.add(player.line.mesh, player.bobber);

function outfitOf(id) {
  let h = 0;
  for (const c of String(id)) h = (h * 31 + c.charCodeAt(0)) >>> 0;
  return h;
}

function spawnPlayer() {
  if (player.angler) scene.remove(player.angler.group, player.angler.rod.group);
  const sp = world.spots[world.mySpot];
  player.angler = new Angler({ hat: world.theme.hat, outfit: outfitOf(me.id), rod: me.rod });
  player.angler.group.position.copy(sp.stand);
  player.angler.group.rotation.y = sp.yaw;
  scene.add(player.angler.group, player.angler.rod.group);
  player.angler.setFirstPerson(view === 'fp');
  player.line.inited = false;
}

function setView(v) {
  view = v;
  localStorage.setItem('fish.view', v);
  player.angler?.setFirstPerson(v === 'fp');
  cam.inited = false;
  resize();
  $('viewBtn').textContent = v === 'fp' ? '🎥' : '👁️';
}

// ---------- Trạng thái câu ----------

const G = {
  mode: 'idle',
  t: 0, // thời gian trong chế độ hiện tại
  held: false,
  power: 0,
  bait: localStorage.getItem('fish.bait') || 'giun',
  cast: null, // dữ liệu máy chủ cho lần quăng này
  castPending: null,
  target: new THREE.Vector3(),
  bob: new THREE.Vector3(),
  flight: null,
  biteAt: 0,
  nibbles: [],
  f: null, // trạng thái kéo cá
  fishPos: new THREE.Vector3(),
  show: null,
  jump: null,
};

function setMode(m) {
  G.mode = m;
  G.t = 0;
  updateControls();
}

const ROD_STATS = () => C.rods.find((r) => r.id === me.rod) || C.rods[0];
const stand = () => world.spots[world.mySpot].stand;
const face = () => world.spots[world.mySpot].face;

function waterY(x, z) {
  return world.waveAt(x, z, time.value);
}

function aimDirection() {
  // hướng quăng theo góc xoay camera, giới hạn trong mặt hồ phía trước
  const f = face();
  const a = clamp(cam.yaw, -0.75, 0.75);
  return new THREE.Vector3(f.x * Math.cos(a) - f.z * Math.sin(a), 0, f.x * Math.sin(a) + f.z * Math.cos(a)).normalize();
}

function press() {
  sound.start();
  if (!me || $('sheet').classList.contains('hidden') === false || !$('talk').classList.contains('hidden')) return;
  G.held = true;
  $('action').classList.add('held');
  $('baitMenu').classList.add('hidden');
  switch (G.mode) {
    case 'idle':
      if (me.fish.length >= me.coolerSize) {
        toast('Thùng đá đầy rồi, bán bớt cá đi đã!');
        openPanel('cooler');
        return;
      }
      if (G.bait !== 'giun' && !(me.baits[G.bait] > 0)) G.bait = 'giun';
      setMode('charge');
      break;
    case 'wait':
      if (G.nibbles.some((n) => Math.abs(n - G.t) < 0.45)) {
        banner('Giật sớm quá!<small>Cá hoảng sợ bỏ chạy</small>', '#ffb86a');
      } else {
        toast('Đã thu cần.');
      }
      abandon();
      break;
    case 'bite':
      startFight();
      break;
    case 'show':
      collect();
      break;
    case 'walk':
      walkAction();
      break;
    default:
  }
}

function release() {
  G.held = false;
  $('action').classList.remove('held');
  if (G.mode === 'charge') doCast();
}

function doCast() {
  const power = G.power;
  const dir = aimDirection();
  const s = stand();
  let dist = 7 + power * 34;
  // nếu rơi vào bờ thì kéo ngắn lại
  while (dist > 4 && world.heightAt(s.x + dir.x * dist, s.z + dir.z * dist) > -0.6) dist -= 1;
  G.target.set(s.x + dir.x * dist, 0, s.z + dir.z * dist);
  const tip = player.angler.rod.tip.clone();
  const T = 0.75 + dist * 0.016;
  const g = new THREE.Vector3(0, -9.8, 0);
  const v = G.target.clone().sub(tip).addScaledVector(g, -0.5 * T * T).divideScalar(T);
  G.flight = { from: tip, v, T, g };
  G.cast = null;
  G.castFailed = false;
  sound.whoosh();
  setMode('flying');
  // quăng trúng vòng xoáy lúc thủy quái đang ở hồ thì nó đớp mồi, không cần hỏi máy chủ
  if (bossActive() && Math.hypot(G.target.x - B.spot.x, G.target.z - B.spot.z) < 15) {
    G.cast = { boss: true, biteIn: 1500 + Math.random() * 1200, gotAt: performance.now(), power: 3, rarity: 3 };
    return;
  }
  G.castPending = api('POST', 'cast', { lake: world.lakeId, bait: G.bait })
    .then((d) => {
      G.cast = { ...d.cast, gotAt: performance.now() };
      renderBait();
    })
    .catch((e) => {
      toast(e.message);
      G.castFailed = true;
    });
}

function landed() {
  world.addRipple(G.target.x, G.target.z, 1);
  fx.splashAt(G.target, 0.3);
  sound.plop();
  G.bob.copy(G.target);
  setMode('wait');
  G.nibbles = [];
  G.biteAt = 0;
}

function scheduleBite() {
  // cá cắn đúng giờ máy chủ hẹn, trước đó vài lần rỉa mồi
  const sinceGot = (performance.now() - G.cast.gotAt) / 1000;
  const biteIn = Math.max(G.cast.biteIn / 1000 - sinceGot, 1.2);
  G.biteAt = G.t + biteIn;
  const n = 1 + Math.floor(Math.random() * 3);
  for (let i = 0; i < n; i++) {
    const at = G.t + 0.6 + Math.random() * Math.max(0.2, biteIn - 1.4);
    G.nibbles.push(at);
  }
}

function abandon(lostMsg) {
  if (G.f?.boss) endBossFight();
  if (G.cast && !G.cast.boss) api('POST', 'land', { castId: G.cast.id, ok: false }).catch(() => {});
  G.cast = null;
  if (lostMsg) {
    banner(lostMsg[0] + (lostMsg[1] ? `<small>${lostMsg[1]}</small>` : ''), '#ff8a7a', 1900);
    sound.fail();
  }
  G.reelFrom = (G.mode === 'fight' ? G.fishPos : G.bob).clone();
  setMode('reelin');
}

function startFight() {
  const c = G.cast;
  if (c.boss) return startBossFight();
  const rod = ROD_STATS();
  // độ khó: cá càng to, càng khỏe và càng hiếm thì que cá chạy càng nhanh, thanh trắng càng ngắn
  const D = clamp((c.power / rod.strength) * 0.7 + c.rarity * 0.12, 0.1, 1.2);
  G.f = {
    D,
    size: clamp(0.38 - D * 0.14 + (rod.strength - 1) * 0.04 + (rod.bar || 0), 0.15, 0.5), // chiều cao thanh trắng
    y: 0, // đáy thanh trắng (0 đáy, 1 đỉnh)
    vy: 0,
    m: 0.5, // vị trí que cá
    mv: 0,
    goal: 0.5,
    goalT: 0.8,
    inside: true,
    T: 0.45,
    P: 0.25,
    surging: false,
    angle: 0,
    dist: G.bob.distanceTo(stand()),
    splashT: 0,
  };
  G.fishPos.copy(G.bob);
  $('fight').style.setProperty('--rar', C.rarity[c.rarity].color);
  banner(`DÍNH RỒI!<small>Giữ ${mobile ? 'nút' : 'Space hoặc chuột'} để nâng thanh trắng, giữ que cá trong thanh</small>`, '#7fffd4', 1600);
  fx.splashAt(G.bob, 0.8 + c.power * 0.6);
  sound.splash(1);
  navigator.vibrate?.(60);
  setMode('fight');
}

function loseFight(kind) {
  sound.setFight(null);
  if (kind === 'snap') {
    sound.snap();
    navigator.vibrate?.([80, 40, 80]);
    abandon(['ĐỨT DÂY!', 'Que cá ra ngoài thanh trắng quá lâu']);
  } else {
    abandon(['Cá sổng mất!', 'Giữ que cá luôn nằm trong thanh trắng']);
  }
}

async function winFight() {
  sound.setFight(null);
  setMode('landing');
  G.jump = null;
  const from = G.fishPos.clone();
  try {
    const d = await api('POST', 'land', { castId: G.cast.id, ok: true });
    G.cast = null;
    rankTimer = 0; // cập nhật hạng ngay sau khi câu được
    beginShow(d, from);
  } catch (e) {
    toast(e.message);
    G.cast = null;
    G.reelFrom = from;
    setMode('reelin');
  }
}

// ---------- Khoe cá ----------

function beginShow(d, from) {
  const id = d.fish.s;
  const info = C.fish[id];
  const len = fishLength(info.look, d.fish.w, info.w[1]);
  const model = makeFish(info.look, Math.floor(d.fish.w * 100) + id.length);
  model.setSwim(10, 0.08);
  scene.add(model.group);
  const rarity = C.rarity[info.rarity];
  G.show = { model, d, info, len, from, t: 0, rarity };
  fx.splashAt(from, 1.2 + info.rarity * 0.5, new THREE.Color(rarity.color));
  sound.splash(2);
  world.addRipple(from.x, from.z, 2);
  setMode('show');
  setTimeout(() => {
    if (G.mode !== 'show') return;
    sound.fanfare(info.rarity);
    $('catchRarity').textContent = rarity.name;
    $('catchRarity').style.color = rarity.color;
    $('catchName').textContent = info.name;
    $('catchWeight').textContent = kg(d.fish.w);
    $('catchLen').textContent = `${Math.round(len * 100)} cm`;
    $('catchValue').textContent = `${fmt(d.fish.v)} xu`;
    const rec = d.biggest ? '🏆 Con cá to nhất bạn từng câu!' : d.record ? '⭐ Kỷ lục mới cho loài này!' : '';
    $('catchRecord').textContent = rec;
    $('catchRecord').classList.toggle('hidden', !rec);
    $('catch').classList.remove('hidden');
    $('vignette').classList.add('on');
    if (info.rarity >= 2) banner(info.rarity === 3 ? '✨ HUYỀN THOẠI ✨' : 'SỬ THI!', rarity.color, 2400);
  }, 900);
}

function collect() {
  if (!G.show) return;
  if (G.show.boss) B.monster.dive(B.spot);
  else {
    scene.remove(G.show.model.group);
    G.show.model.dispose();
  }
  G.show = null;
  $('catch').classList.add('hidden');
  $('vignette').classList.remove('on');
  setMode('idle');
}

// ---------- Cập nhật mỗi khung hình ----------

function updateGame(dt) {
  G.t += dt;
  const a = player.angler;
  if (!a) return;
  let pull = null;
  let bend = 0;
  let lineEnd = null;
  let lineLen = 0.9;
  let targetPitch = 0.55 + Math.sin(time.value * 0.7) * 0.02;
  let targetYaw = 0;
  a.reeling = false;
  a.walking = false;
  player.bobber.visible = true;

  const aimAt = (p) => {
    const rel = p.clone().sub(a.group.position);
    const yaw = -a.group.rotation.y;
    const lx = rel.x * Math.cos(yaw) + rel.z * Math.sin(yaw);
    const lz = -rel.x * Math.sin(yaw) + rel.z * Math.cos(yaw);
    return clamp(Math.atan2(lx, -lz), -0.8, 0.8);
  };

  switch (G.mode) {
    case 'idle':
      targetYaw = clamp(cam.yaw, -0.75, 0.75) * (view === 'fp' ? 0.85 : 0.5);
      hint(G.t > 0.3 ? (mobile ? 'Giữ nút để lấy đà, thả ra để quăng · kéo màn hình để nhìn quanh' : 'Giữ nút hoặc phím Space để lấy đà, thả ra để quăng · kéo chuột để nhìn quanh') : '');
      break;
    case 'charge': {
      G.power = 0.5 - 0.5 * Math.cos(G.t * 3.2);
      $('powerFill').style.width = `${G.power * 100}%`;
      targetPitch = 2.25;
      targetYaw = clamp(cam.yaw, -0.75, 0.75);
      hint(`Lực quăng ${Math.round(G.power * 100)}% · thả ra để quăng`);
      break;
    }
    case 'flying': {
      const fl = G.flight;
      const t = Math.min(G.t, fl.T);
      G.bob.copy(fl.from).addScaledVector(fl.v, t).addScaledVector(fl.g, 0.5 * t * t);
      targetPitch = G.t < 0.15 ? 0.15 : 0.4;
      a.pitch = G.t < 0.12 ? lerp(2.25, 0.1, G.t / 0.12) : a.pitch;
      targetYaw = aimAt(G.target);
      lineEnd = G.bob;
      lineLen = player.angler.rod.tip.distanceTo(G.bob) * 1.03 + 0.5;
      hint('');
      if (G.t >= fl.T) landed();
      break;
    }
    case 'wait': {
      if (G.castFailed) {
        G.reelFrom = G.bob.clone();
        setMode('reelin');
        break;
      }
      if (G.cast && !G.biteAt) scheduleBite();
      let dip = 0;
      for (const n of G.nibbles) {
        const k = G.t - n;
        if (k > 0 && k < 0.5) {
          dip = Math.max(dip, Math.sin((k / 0.5) * Math.PI) * 0.06);
          if (k < dt * 1.5) {
            world.addRipple(G.bob.x, G.bob.z, 0.35);
            sound.plop();
          }
        }
      }
      G.bob.y = waterY(G.bob.x, G.bob.z) - dip;
      targetPitch = 0.42;
      targetYaw = aimAt(G.bob);
      lineEnd = G.bob;
      lineLen = player.angler.rod.tip.distanceTo(G.bob) * 1.05;
      hint(G.cast ? 'Chờ phao chìm hẳn rồi bấm giật cần · bấm sớm là cá chạy' : 'Đang thả mồi...');
      if (G.biteAt && G.t >= G.biteAt) {
        setMode('bite');
        G.biteAt = 0;
        sound.bite();
        sound.splash(0.6);
        navigator.vibrate?.(120);
        fx.splashAt(G.bob, 0.5);
        world.addRipple(G.bob.x, G.bob.z, 1.4);
        banner('❗ CÁ CẮN ❗', '#ff6a4a', 900);
      }
      break;
    }
    case 'bite': {
      const win = G.cast?.boss ? 1.4 : G.cast && G.cast.rarity === 3 ? 0.8 : 1.15;
      const k = Math.min(1, G.t * 5);
      G.bob.y = waterY(G.bob.x, G.bob.z) - 0.28 * k;
      G.bob.x += Math.sin(G.t * 9) * 0.004;
      if (Math.random() < 0.3) world.addRipple(G.bob.x, G.bob.z, 0.6);
      targetPitch = 0.42;
      targetYaw = aimAt(G.bob);
      lineEnd = G.bob;
      lineLen = player.angler.rod.tip.distanceTo(G.bob) * 0.99;
      bend = 0.15;
      pull = G.bob;
      hint('BẤM NGAY ĐỂ GIẬT CẦN!');
      if (G.t > win) abandon(['Cá ăn mất mồi!', 'Phao chìm là phải giật liền']);
      break;
    }
    case 'fight':
      fight(dt);
      pull = G.fishPos;
      bend = clamp(G.f.T, 0, 1.1) * 0.85;
      targetPitch = 0.7 + G.f.T * 0.25;
      targetYaw = clamp(aimAt(G.fishPos), -1.1, 1.1);
      a.reeling = G.held;
      lineEnd = G.fishPos;
      lineLen = player.angler.rod.tip.distanceTo(G.fishPos) * (G.f.T < 0.15 ? 1.06 : 0.995);
      if (G.f.boss) bend = clamp(G.f.T, 0, 1.2) * 0.95;
      G.bob.set(G.fishPos.x, waterY(G.fishPos.x, G.fishPos.z) - 0.04, G.fishPos.z);
      break;
    case 'landing':
      pull = G.fishPos;
      bend = 0.6;
      targetPitch = 0.95;
      lineEnd = G.fishPos;
      lineLen = player.angler.rod.tip.distanceTo(G.fishPos);
      break;
    case 'walk':
      updateWalk(dt);
      targetPitch = view === 'fp' ? 0.45 : 1.15;
      break;
    case 'show': {
      const s = G.show;
      if (s.boss) {
        updateBossShow(dt);
        player.bobber.visible = false;
        targetPitch = 0.95;
        hint('');
        break;
      }
      s.t += dt;
      const k = Math.min(1, s.t / 0.9);
      // cá vọt khỏi mặt nước bay vào tay
      const hold = camera.localToWorld(new THREE.Vector3(0, 0.12, -1.7));
      const arc = s.from.clone().lerp(hold, smoothstep(0, 1, k));
      arc.y += Math.sin(k * Math.PI) * (view === 'fp' ? 0.9 : 2.2);
      const viewW = 2 * 1.7 * Math.tan(THREE.MathUtils.degToRad(camera.fov / 2)) * camera.aspect;
      const scale = k < 1 ? s.len : lerp(s.len, Math.min(1.15, viewW * 0.78), smoothstep(0, 0.4, s.t - 0.9));
      s.model.group.position.copy(arc);
      s.model.group.scale.setScalar(scale);
      s.model.group.quaternion.copy(camera.quaternion);
      s.model.group.rotateY(Math.sin(s.t * 0.8) * 0.5);
      s.model.group.rotateZ(k < 1 ? Math.sin(s.t * 20) * 0.4 : Math.sin(s.t * 3) * 0.08);
      s.model.update();
      if (s.t > 0.9 && Math.random() < (s.info.rarity + 1) * 0.12) fx.burst(arc, s.rarity.color, 3, 0.6 + s.info.rarity * 0.3);
      if (k < 1) {
        lineEnd = arc;
        lineLen = player.angler.rod.tip.distanceTo(arc);
        pull = arc;
        bend = 0.5;
      }
      player.bobber.visible = false;
      targetPitch = 0.95;
      hint('');
      break;
    }
    case 'reelin': {
      const k = Math.min(1, G.t / 0.8);
      G.bob.copy(G.reelFrom).lerp(player.angler.rod.tip, k);
      G.bob.y = Math.max(G.bob.y, waterY(G.bob.x, G.bob.z));
      lineEnd = G.bob;
      lineLen = player.angler.rod.tip.distanceTo(G.bob) * 1.02;
      a.reeling = true;
      if (k >= 1) {
        player.line.reset(player.angler.rod.tip);
        setMode('idle');
      }
      break;
    }
    default:
  }

  if (G.mode !== 'flying' || G.t > 0.12) a.pitch = lerp(a.pitch, targetPitch, Math.min(1, dt * (G.mode === 'charge' ? 9 : 4)));
  a.aimYaw = lerp(a.aimYaw, targetYaw, Math.min(1, dt * 4));
  a.lean = G.mode === 'fight' ? clamp(G.f.angle * 1.3, -1, 1) : 0;
  a.update(dt, pull, bend);
  player.line.length = lineLen;
  player.line.step(dt, a.rod.tip, lineEnd, waterY);
  if (lineEnd) player.bobber.position.copy(G.mode === 'fight' || G.mode === 'landing' ? G.bob : lineEnd);
  else player.bobber.position.copy(player.line.endPoint);
  player.bobber.rotation.z = G.mode === 'fight' ? Math.sin(time.value * 8) * 0.4 : 0;
  player.bobber.userData.glow.emissiveIntensity = world.night * 3;
  sound.setFight(G.mode === 'fight' ? { reeling: G.held, inside: G.f.inside, surging: G.f.surging, tension: G.f.T } : null, dt);
  if (G.jump) updateJump(dt);
}

function fight(dt) {
  if (G.f.boss) return bossFight(dt);
  const f = G.f;
  const c = G.cast;
  const rod = ROD_STATS();
  const D = f.D;

  // thanh trắng: giữ Space/chuột thì bay lên, thả ra thì rơi xuống
  f.vy += (G.held ? 2.8 : -2.4) * dt;
  f.vy = clamp(f.vy, -1.5, 1.5);
  f.y += f.vy * dt;
  if (f.y < 0) {
    f.y = 0;
    f.vy = -f.vy * 0.35;
  }
  if (f.y > 1 - f.size) {
    f.y = 1 - f.size;
    f.vy = Math.min(0, f.vy);
  }

  // que cá: chọn chỗ mới để bơi tới, cá khó thì đổi chỗ nhanh và hay lao xa đột ngột
  f.goalT -= dt;
  if (f.goalT <= 0) {
    const dart = Math.random() < 0.12 + D * 0.25;
    f.surging = dart;
    const span = dart ? 0.5 + D * 0.4 : 0.15 + D * 0.3;
    f.goal = clamp(f.m + (Math.random() * 2 - 1) * span, 0.03, 0.97);
    if (dart && Math.abs(f.goal - f.m) < 0.25) f.goal = f.m < 0.5 ? clamp(f.m + 0.4, 0, 0.97) : clamp(f.m - 0.4, 0.03, 1);
    f.goalT = (dart ? 0.5 : 0.6 + Math.random() * 1.3) / (0.7 + D * 0.5);
    if (dart && Math.random() < 0.3 + c.rarity * 0.1) startJump();
  }
  // cần êm (Poseidon) làm cá giật yếu hẳn
  const calm = 1 - (rod.calm || 0);
  const pull = (f.surging ? 16 : 8) * (0.6 + D * 0.5) * (f.surging ? calm : 1);
  f.mv += ((f.goal - f.m) * pull - f.mv * (f.surging ? 5 : 6)) * dt;
  f.m = clamp(f.m + f.mv * dt + Math.sin(time.value * (5 + D * 6)) * 0.004 * D * calm, 0.01, 0.99);

  // que trong thanh trắng thì kéo được cá vào, ra ngoài thì cá kéo ngược ra
  f.inside = f.m >= f.y && f.m <= f.y + f.size;
  const fill = (0.17 * Math.sqrt(rod.reel)) / (0.7 + D * 0.4);
  const drain = 0.09 * (0.6 + D * 0.5);
  f.P = clamp(f.P + (f.inside ? fill : -drain) * dt, 0, 1);
  f.T += ((f.inside ? 0.45 + 0.08 * Math.sin(time.value * 4) : 0.95) - f.T) * Math.min(1, dt * 4);

  // con cá dưới nước bơi ngang theo que cá
  f.angle += ((f.m - 0.5) * 1.3 - f.angle) * Math.min(1, dt * 3);
  const d = lerp(f.dist, 2.2, f.P);
  const fc = face();
  const dir = new THREE.Vector3(fc.x * Math.cos(f.angle) - fc.z * Math.sin(f.angle), 0, fc.x * Math.sin(f.angle) + fc.z * Math.cos(f.angle));
  const target3 = stand().clone().addScaledVector(dir, d);
  target3.y = -0.35;
  G.fishPos.lerp(target3, Math.min(1, dt * 2.5));
  f.splashT -= dt;
  if (f.splashT <= 0) {
    f.splashT = f.surging ? 0.12 : 0.5 + Math.random() * 0.6;
    fx.splashAt(G.fishPos, (f.surging ? 0.35 : 0.15) + c.power * 0.3);
    world.addRipple(G.fishPos.x, G.fishPos.z, f.surging ? 0.9 : 0.4);
    if (f.surging && Math.random() < 0.3) sound.splash(0.4 + c.power * 0.3);
  }

  // giao diện thanh kéo cá
  $('zone').style.bottom = `${f.y * 100}%`;
  $('zone').style.height = `${f.size * 100}%`;
  $('zone').classList.toggle('in', f.inside);
  $('mark').style.bottom = `${f.m * 100}%`;
  $('progress').style.height = `${f.P * 100}%`;
  $('progress').classList.toggle('low', f.P < 0.2);
  $('fight').classList.toggle('danger', !f.inside && f.P < 0.2);
  hint(
    f.inside
      ? `Giỏi lắm! Còn ${Math.max(0, d - 2.2).toFixed(1)} m nữa`
      : f.m > f.y + f.size
        ? `Que cá ở trên, ${mobile ? 'giữ nút' : 'giữ Space hoặc chuột'} để nâng thanh trắng lên!`
        : 'Que cá ở dưới, thả ra cho thanh trắng rơi xuống!',
  );
  camShake = Math.max(camShake, (f.surging ? 0.03 + 0.03 * D : 0.008) * calm);
  if (f.P <= 0) loseFight('slack');
  else if (f.P >= 1) winFight();
}

// Bóng cá nhảy khỏi mặt nước khi vùng vẫy
const RARE_GLOW = ['#ffffff', '#4fb3ff', '#c27bff', '#ffc93c'];
let shadowFish = null;
function startJump() {
  if (G.jump) return;
  if (!shadowFish || shadowFish.rarity !== G.cast.rarity) {
    if (shadowFish) {
      scene.remove(shadowFish.group);
      shadowFish.dispose();
    }
    shadowFish = makeFish({ len: 1, h: 0.3, back: '#1a2626', belly: '#4a5a58', fin: '#1a2626', pattern: 'plain', glow: G.cast.rarity >= 2 ? RARE_GLOW[G.cast.rarity] : null }, 3);
    shadowFish.rarity = G.cast.rarity;
    scene.add(shadowFish.group);
  }
  const size = Math.max(0.35, G.cast.size * 1.3);
  shadowFish.group.scale.setScalar(size);
  shadowFish.setSwim(16, 0.12);
  G.jump = { t: 0, T: 0.7 + size * 0.25, from: G.fishPos.clone(), h: 0.6 + size * 1.1, yaw: Math.random() * 6.28 };
  fx.splashAt(G.fishPos, 0.6 + size);
  sound.splash(1 + size);
}

function updateJump(dt) {
  const j = G.jump;
  j.t += dt;
  const k = j.t / j.T;
  shadowFish.group.visible = k < 1;
  if (k >= 1) {
    fx.splashAt(G.fishPos, 0.8 + G.cast?.size || 1);
    world.addRipple(G.fishPos.x, G.fishPos.z, 1.5);
    sound.splash(1.2);
    G.jump = null;
    return;
  }
  const p = G.fishPos.clone();
  p.y = Math.sin(k * Math.PI) * j.h - 0.1;
  shadowFish.group.position.copy(p);
  shadowFish.group.rotation.set(0, j.yaw, 0);
  shadowFish.group.rotateZ(lerp(1.1, -1.1, k));
  shadowFish.update();
}

// ---------- Camera ----------

const cam = { yaw: 0, pitch: 0.18, dist: 5.2, look: new THREE.Vector3(), pos: new THREE.Vector3(), inited: false };
let camShake = 0;
let drag = null;
let canvasHold = false;
canvas.addEventListener('pointerdown', (e) => {
  sound.start();
  // lúc kéo cá, bấm giữ chuột ở đâu cũng là nâng thanh trắng
  if (G.mode === 'fight') {
    canvas.setPointerCapture(e.pointerId);
    canvasHold = true;
    press();
    return;
  }
  drag = { x: e.clientX, y: e.clientY, yaw: cam.yaw, pitch: cam.pitch };
  canvas.setPointerCapture(e.pointerId);
  $('baitMenu').classList.add('hidden');
});
canvas.addEventListener('pointermove', (e) => {
  if (!drag) return;
  cam.yaw = drag.yaw - ((e.clientX - drag.x) / innerWidth) * 2.4;
  if (G.mode !== 'walk') cam.yaw = clamp(cam.yaw, -1.4, 1.4);
  cam.pitch = clamp(drag.pitch + ((e.clientY - drag.y) / innerHeight) * 1.2, -0.05, 0.75);
});
canvas.addEventListener('pointerup', () => {
  drag = null;
  if (canvasHold) release();
  canvasHold = false;
});
canvas.addEventListener('wheel', (e) => (cam.dist = clamp(cam.dist + e.deltaY * 0.004, 2.8, 9)), { passive: true });

// hướng nhìn ngang: lúc đi bộ theo người, lúc câu theo chỗ đứng cộng góc kéo màn hình
function viewFwd() {
  if (G.mode === 'walk') {
    const v = viewYaw();
    return new THREE.Vector3(-Math.sin(v), 0, -Math.cos(v));
  }
  const f = world.spots[world.mySpot].face;
  const yaw = cam.yaw;
  return new THREE.Vector3(f.x * Math.cos(yaw) - f.z * Math.sin(yaw), 0, f.x * Math.sin(yaw) + f.z * Math.cos(yaw));
}

function updateCamera(dt) {
  if (!player.angler) return;
  // lúc xem cảnh thủy quái thì máy quay zoom vào như ống nhòm
  const wantFov = cine.on && G.mode !== 'fight' ? baseFov * cine.zoom : baseFov;
  if (Math.abs(camera.fov - wantFov) > 0.05) {
    camera.fov = lerp(camera.fov, wantFov, Math.min(1, dt * 2.5));
    camera.updateProjectionMatrix();
  }
  // cảnh cắt có máy quay riêng: bay theo xuồng, người mình hiện đủ thân để không thấy tay lơ lửng
  if (cine.on && cine.pos && G.mode !== 'fight') {
    if (!cine.active) {
      cine.active = true;
      cine.cam.copy(camera.position);
      cine.lookCur.copy(camera.position).add(camera.getWorldDirection(new THREE.Vector3()).multiplyScalar(20));
      player.angler.setFirstPerson(false);
    }
    cine.cam.lerp(cine.pos, Math.min(1, dt * 2.2));
    cine.lookCur.lerp(cine.look, Math.min(1, dt * 4));
    camera.position.copy(cine.cam);
    camShake *= Math.pow(0.02, dt);
    camera.position.x += (Math.random() - 0.5) * camShake;
    camera.position.y += (Math.random() - 0.5) * camShake;
    camera.lookAt(cine.lookCur);
    return;
  }
  if (cine.active) {
    cine.active = false;
    player.angler.setFirstPerson(view === 'fp');
  }
  if (view === 'fp') return updateCameraFP(dt);
  const back = viewFwd();
  const right = new THREE.Vector3(-back.z, 0, back.x);
  const base = G.mode === 'walk' ? player.angler.group.position : world.spots[world.mySpot].stand;
  let dist = cam.dist;
  let lookAt = base.clone().addScaledVector(back, 18);
  lookAt.y = 0.8 + cam.pitch * -6;
  if (G.mode === 'fight' || G.mode === 'bite' || G.mode === 'wait') {
    const k = G.mode === 'fight' ? 0.55 : 0.3;
    lookAt.lerp(G.bob, k);
    lookAt.y = Math.max(lookAt.y, 0.2);
  }
  if (cine.on && G.mode !== 'fight') lookAt.lerp(cine.look, 0.85);
  const pos = base.clone().addScaledVector(back, -dist).addScaledVector(right, G.mode === 'walk' ? 0.6 : 1.5);
  pos.y = base.y + 1.9 + cam.pitch * 5;
  if (G.mode === 'show') {
    dist = 3;
  }
  if (!cam.inited) {
    cam.pos.copy(pos);
    cam.look.copy(lookAt);
    cam.inited = true;
  }
  const k = Math.min(1, dt * (G.mode === 'show' ? 1.5 : G.mode === 'walk' ? 8 : 3));
  if (G.mode !== 'show' || G.show.t < 0.9 || G.show.boss) {
    cam.pos.lerp(pos, k);
    cam.look.lerp(lookAt, k);
  }
  camera.position.copy(cam.pos);
  camShake *= Math.pow(0.02, dt);
  camera.position.x += (Math.random() - 0.5) * camShake;
  camera.position.y += (Math.random() - 0.5) * camShake;
  camera.lookAt(cam.look);
}

// Góc nhìn thứ nhất: mắt ở đầu người câu, nhìn theo hướng kéo màn hình, lúc có cá thì nhìn theo phao
function updateCameraFP(dt) {
  const a = player.angler;
  const eye = a.group.localToWorld(new THREE.Vector3(0, 1.66 + a.body.position.y, 0.04));
  const fwd = viewFwd();
  const down = 0.1 + cam.pitch * 0.55;
  let look = eye.clone().addScaledVector(fwd, 20);
  look.y = eye.y - Math.tan(down) * 20;
  if (G.mode === 'fight' || G.mode === 'bite' || G.mode === 'wait' || G.mode === 'landing') {
    const k = G.mode === 'fight' ? 0.6 : 0.35;
    const tgt = G.bob.clone();
    tgt.y += 0.6;
    look.lerp(tgt, k);
  }
  if (cine.on && G.mode !== 'fight') look.lerp(cine.look, 0.85);
  if (!cam.inited) {
    cam.pos.copy(eye);
    cam.look.copy(look);
    cam.inited = true;
  }
  const k = Math.min(1, dt * 4);
  cam.pos.copy(eye);
  if (G.mode === 'walk') cam.look.copy(look);
  else if (G.mode !== 'show' || G.show.t < 0.9 || G.show.boss) cam.look.lerp(look, k);
  camera.position.copy(cam.pos);
  // thở nhẹ, lúc kéo cá thì rung theo sức cá
  camera.position.y += Math.sin(time.value * 1.6) * 0.006;
  camShake *= Math.pow(0.02, dt);
  camera.position.x += (Math.random() - 0.5) * camShake * 0.5;
  camera.position.y += (Math.random() - 0.5) * camShake * 0.5;
  camera.lookAt(cam.look);
}

// ---------- Bảng hạng góc trên trái ----------

let rankTimer = 0;
async function pollRank() {
  try {
    const d = await api('GET', 'rank');
    $('rankNum').innerHTML = `${d.rank}<small>/${d.total}</small>`;
    $('rankRows').innerHTML = d.rows
      .map((r) => `<div class="rk-row ${r.me ? 'me' : ''} ${r.rank === 1 ? 'first' : ''}"><span class="rk-pos">${r.rank}</span><span class="rk-name">${esc(r.name)}</span><span class="rk-score">${fmt(r.score)}</span></div>`)
      .join('');
    $('rank').classList.remove('hidden');
  } catch {
    // lỗi mạng thì giữ bảng cũ
  }
}

// ---------- Bạn bè cùng hồ ----------

const remotes = new Map(); // id -> { angler, line, bobber, tag, data }
let feedSeq = 0;
let feedInit = false;

async function pollPresence() {
  if (!me || !world.theme) return;
  const act = G.mode;
  const inWater = ['wait', 'bite', 'fight', 'landing'].includes(act);
  try {
    const d = await api('POST', 'presence', {
      lake: world.lakeId,
      act,
      cast: inWater ? [G.bob.x, G.bob.z] : null,
      pos: act === 'walk' ? [walker.pos.x, walker.pos.z, viewYaw()] : null,
      tension: G.mode === 'fight' ? G.f.T : 0,
      since: feedSeq,
    });
    if (d.spot !== world.mySpot && !['flying', 'wait', 'bite', 'fight', 'landing', 'show', 'walk'].includes(G.mode)) {
      world.setMySpot(d.spot);
      spawnPlayer();
    }
    syncRemotes(d.others);
    onBoss(d.boss);
    for (const it of d.feed) {
      if (feedInit && it.id !== me.id && (it.rarity >= 1 || it.lake === world.lakeId)) showFeed(it);
    }
    feedSeq = d.feedSeq;
    feedInit = true;
    $('online').textContent = `👥 ${d.others.length + 1} người ở hồ này`;
    $('online').classList.toggle('hidden', d.others.length === 0);
  } catch {
    // mạng chập chờn thì lần sau thử lại
  }
}

function showFeed(it) {
  const info = C.fish[it.s];
  const lake = C.lakes.find((l) => l.id === it.lake);
  const el = document.createElement('div');
  el.className = 'feed-item';
  el.style.borderLeftColor = C.rarity[it.rarity].color;
  el.innerHTML = `🎣 <b>${esc(it.name)}</b> câu được <b style="color:${C.rarity[it.rarity].color}">${esc(info.name)}</b> ${kg(it.w)}${it.lake !== world.lakeId ? ` <span class="muted">· ${esc(lake.name)}</span>` : ''}`;
  $('feed').appendChild(el);
  if (it.rarity === 3) banner(`✨ ${esc(it.name)} vừa câu được<br>${esc(info.name)}! ✨`, '#ffc93c', 3500);
  setTimeout(() => (el.style.opacity = '0'), 7000);
  setTimeout(() => el.remove(), 7700);
  while ($('feed').children.length > 4) $('feed').firstChild.remove();
}

function syncRemotes(list) {
  const seen = new Set();
  for (const o of list) {
    seen.add(o.id);
    let r = remotes.get(o.id);
    const sp = world.spots[o.spot];
    if (!sp) continue;
    if (!r || r.spot !== o.spot || r.rod !== o.rod) {
      if (r) removeRemote(o.id);
      const angler = new Angler({ hat: world.theme.hat, outfit: outfitOf(o.id), rod: o.rod });
      angler.group.position.copy(sp.stand);
      angler.group.rotation.y = sp.yaw;
      const line = new FishingLine(24);
      const bobber = makeBobber();
      const tag = document.createElement('div');
      tag.className = 'name-tag';
      $('labels').appendChild(tag);
      scene.add(angler.group, angler.rod.group, line.mesh, bobber);
      r = { angler, line, bobber, tag, spot: o.spot, rod: o.rod, bob: new THREE.Vector3(), landedAt: 0 };
      remotes.set(o.id, r);
    }
    r.data = o;
    if (o.landed && o.landed.at !== r.landedAt) {
      r.landedAt = o.landed.at;
      const info = C.fish[o.landed.s];
      r.popUntil = performance.now() + 6000;
      r.pop = `${info.name} ${kg(o.landed.w)}`;
      if (o.cast) fx.splashAt(new THREE.Vector3(o.cast[0], 0, o.cast[1]), 1);
    }
    r.tag.innerHTML = `${esc(o.name)}${r.popUntil > performance.now() ? `<span class="catch-pop">🎣 ${esc(r.pop)}</span>` : ''}`;
  }
  for (const id of [...remotes.keys()]) if (!seen.has(id)) removeRemote(id);
}

function removeRemote(id) {
  const r = remotes.get(id);
  if (!r) return;
  scene.remove(r.angler.group, r.angler.rod.group, r.line.mesh, r.bobber);
  r.tag.remove();
  remotes.delete(id);
}

function updateRemotes(dt) {
  for (const r of remotes.values()) {
    const o = r.data;
    const a = r.angler;
    const inWater = o.cast && ['wait', 'bite', 'fight', 'landing'].includes(o.act);
    let pitch = 0.55;
    let pull = null;
    let bend = 0;
    if (o.act === 'charge') pitch = 2.2;
    if (inWater) {
      const tx = o.cast[0];
      const tz = o.cast[1];
      if (r.bob.lengthSq() === 0) r.bob.set(tx, 0, tz);
      r.bob.x = lerp(r.bob.x, tx, Math.min(1, dt * 2));
      r.bob.z = lerp(r.bob.z, tz, Math.min(1, dt * 2));
      r.bob.y = waterY(r.bob.x, r.bob.z) - (o.act === 'bite' ? 0.25 : 0);
      pitch = o.act === 'fight' ? 0.75 + o.tension * 0.25 : 0.42;
      if (o.act === 'fight') {
        pull = r.bob;
        bend = Math.min(1, o.tension) * 0.85;
        a.reeling = true;
        if (Math.random() < dt * 2) fx.splashAt(r.bob, 0.25);
      } else a.reeling = false;
    } else {
      r.bob.set(0, 0, 0);
      a.reeling = false;
    }
    // bạn đang đi dạo thì đặt đúng chỗ, đứng câu thì về cầu
    const sp = world.spots[r.spot];
    const walking = o.act === 'walk' && o.pos;
    const tx = walking ? o.pos[0] : sp.stand.x;
    const tz = walking ? o.pos[1] : sp.stand.z;
    const gp = a.group.position;
    const far = Math.hypot(tx - gp.x, tz - gp.z);
    if (far > 30) gp.set(tx, gp.y, tz);
    else {
      gp.x = lerp(gp.x, tx, Math.min(1, dt * 3));
      gp.z = lerp(gp.z, tz, Math.min(1, dt * 3));
    }
    gp.y = walking ? (world.groundAt(gp.x, gp.z) ?? gp.y) : sp.stand.y;
    const ty = walking ? o.pos[2] : sp.yaw;
    a.group.rotation.y += Math.atan2(Math.sin(ty - a.group.rotation.y), Math.cos(ty - a.group.rotation.y)) * Math.min(1, dt * 5);
    a.walking = far > 0.25;
    if (walking) pitch = 1.15;
    a.pitch = lerp(a.pitch, pitch, Math.min(1, dt * 4));
    a.update(dt, pull, bend);
    r.line.length = inWater ? a.rod.tip.distanceTo(r.bob) * 1.04 : 0.9;
    r.line.step(dt, a.rod.tip, inWater ? r.bob : null, waterY);
    r.bobber.position.copy(inWater ? r.bob : r.line.endPoint);
    r.bobber.userData.glow.emissiveIntensity = world.night * 3;
    // nhãn tên trên đầu
    const head = a.group.position.clone();
    head.y += 2.2;
    head.project(camera);
    const visible = head.z < 1 && Math.abs(head.x) < 1.2 && Math.abs(head.y) < 1.2;
    r.tag.style.display = visible ? '' : 'none';
    if (visible) {
      r.tag.style.left = `${((head.x + 1) / 2) * innerWidth}px`;
      r.tag.style.top = `${((1 - head.y) / 2) * innerHeight}px`;
    }
  }
}

// ---------- Đi dạo dọc bờ ----------

const walker = { pos: new THREE.Vector3(), base: 0, keys: new Set(), joy: { x: 0, y: 0 }, moving: false, run: false };
const WALK_KEYS = { KeyW: [0, 1], ArrowUp: [0, 1], KeyS: [0, -1], ArrowDown: [0, -1], KeyA: [-1, 0], ArrowLeft: [-1, 0], KeyD: [1, 0], ArrowRight: [1, 0] };
const viewYaw = () => walker.base - cam.yaw;

function startWalk() {
  if (G.mode !== 'idle' || !player.angler) return;
  const sp = world.spots[world.mySpot];
  walker.pos.copy(sp.stand);
  walker.base = sp.yaw;
  setMode('walk');
}

// về lại chỗ câu trên cầu của mình
function returnToSpot() {
  closeTalk();
  walker.keys.clear();
  setMode('idle');
  spawnPlayer();
  cam.yaw = 0;
  cam.inited = false;
}

function updateWalk(dt) {
  const a = player.angler;
  let ix = walker.joy.x;
  let iy = walker.joy.y;
  for (const k of walker.keys) {
    ix += WALK_KEYS[k][0];
    iy += WALK_KEYS[k][1];
  }
  const len = Math.hypot(ix, iy);
  walker.moving = len > 0.15;
  const v = viewYaw();
  if (walker.moving) {
    ix /= Math.max(1, len);
    iy /= Math.max(1, len);
    const speed = walker.run ? 7 : 4.2;
    const fx = -Math.sin(v);
    const fz = -Math.cos(v);
    const dx = (fx * iy + Math.cos(v) * ix) * speed * dt;
    const dz = (fz * iy - Math.sin(v) * ix) * speed * dt;
    const home = world.spots[0].shore;
    const ok = (x, z) => world.groundAt(x, z) !== null && Math.hypot(x - home.x, z - home.z) < 95;
    // chạm nước thì trượt theo mép bờ
    if (ok(walker.pos.x + dx, walker.pos.z + dz)) {
      walker.pos.x += dx;
      walker.pos.z += dz;
    } else if (ok(walker.pos.x + dx, walker.pos.z)) walker.pos.x += dx;
    else if (ok(walker.pos.x, walker.pos.z + dz)) walker.pos.z += dz;
  }
  const ground = world.groundAt(walker.pos.x, walker.pos.z) ?? walker.pos.y;
  walker.pos.y = lerp(walker.pos.y, ground, Math.min(1, dt * 12));
  a.group.position.copy(walker.pos);
  a.group.rotation.y = v;
  a.walking = walker.moving;
  // đi gần tới chỗ đứng của mình thì tự về chỗ câu
  const sp = world.spots[world.mySpot];
  if (G.t > 1.5 && walker.moving && iy < 0 && walker.pos.distanceTo(sp.stand) < 0.8) returnToSpot();
  pickJars();
  const near = nearNpc();
  hint(
    near
      ? `${mobile ? 'Bấm nút' : 'Bấm Space hoặc E'} để nói chuyện với Lão Ngư`
      : mobile
        ? 'Kéo vòng tròn để đi · kéo màn hình để nhìn quanh'
        : 'W A S D để đi, giữ Shift để chạy · kéo chuột để nhìn quanh',
  );
  const label = near ? '💬 Nói chuyện' : '🎣 Về chỗ câu';
  if ($('actionText').textContent !== label) $('actionText').textContent = label;
  $('action').classList.toggle('speak', !!near);
}

function walkAction() {
  if (nearNpc()) openTalk();
  else returnToSpot();
}

addEventListener('keydown', (e) => {
  if (document.activeElement?.tagName === 'INPUT') return;
  if (e.key === 'Shift') walker.run = true;
  if (WALK_KEYS[e.code]) {
    if (G.mode === 'idle' && $('sheet').classList.contains('hidden')) startWalk();
    if (G.mode === 'walk') {
      walker.keys.add(e.code);
      e.preventDefault();
    }
  }
  if (e.code === 'KeyE' && G.mode === 'walk' && nearNpc()) openTalk();
  if (e.code === 'Escape') closeTalk();
});
addEventListener('keyup', (e) => {
  if (e.key === 'Shift') walker.run = false;
  walker.keys.delete(e.code);
});
addEventListener('blur', () => walker.keys.clear());

// cần điều khiển trên điện thoại
const joy = $('joy');
let joyId = null;
const joyMove = (e) => {
  const r = joy.getBoundingClientRect();
  let x = (e.clientX - (r.left + r.width / 2)) / (r.width / 2);
  let y = -(e.clientY - (r.top + r.height / 2)) / (r.height / 2);
  const l = Math.hypot(x, y);
  if (l > 1) {
    x /= l;
    y /= l;
  }
  walker.joy.x = x;
  walker.joy.y = y;
  $('joyKnob').style.transform = `translate(${x * 34}px, ${-y * 34}px)`;
};
joy.addEventListener('pointerdown', (e) => {
  joyId = e.pointerId;
  joy.setPointerCapture(e.pointerId);
  joyMove(e);
});
joy.addEventListener('pointermove', (e) => e.pointerId === joyId && joyMove(e));
const joyEnd = () => {
  joyId = null;
  walker.joy.x = walker.joy.y = 0;
  $('joyKnob').style.transform = '';
};
joy.addEventListener('pointerup', joyEnd);
joy.addEventListener('pointercancel', joyEnd);
$('walkBtn').addEventListener('click', () => {
  sound.start();
  startWalk();
});

// ---------- Lão Ngư, nhiệm vụ và thủy quái ----------

const npc = { angler: null, boat: null, home: new THREE.Vector3(), yaw: 0, tag: null, jars: [], say: '', state: 'home' };
const B = { data: null, at: 0, spot: new THREE.Vector3(), monster: null, hp: 0, seenDead: 0, seenEsc: 0, cineFx: {}, lurkT: 0, riseT: 0, showT: 0 };
const debris = new Debris(scene);
const UP_V = new THREE.Vector3(0, 1, 0);
const JAR_OFFS = [
  [-44, 6],
  [-31, 11],
  [-3, 15],
  [25, 7],
  [52, 5],
];
const bossInfo = () => C.fish[`quai_${world.lakeId}`];

// dựng xuồng, Lão Ngư, hũ thính và thủy quái cho hồ vừa tới
function buildQuestScene() {
  const g = world.lakeGroup;
  const { shore, face } = world.shorePoint(36);
  let d = 3.5;
  while (d < 16 && world.heightAt(shore.x + face.x * d, shore.z + face.z * d) > -0.45) d += 0.5;
  npc.home.copy(shore).addScaledVector(face, d);
  npc.talkR = d + 5;
  npc.yaw = Math.atan2(-face.x, -face.z);
  npc.boat = makeBoat();
  npc.boat.position.copy(npc.home);
  npc.boat.rotation.y = npc.yaw;
  g.add(npc.boat);
  npc.angler = new Angler({ hat: 'nonla', outfit: 3, rod: 'tre' });
  npc.angler.group.position.set(0, 0.04, 0.55);
  npc.angler.pitch = 1.2;
  npc.boat.add(npc.angler.group);
  g.add(npc.angler.rod.group);
  if (!npc.tag) {
    npc.tag = document.createElement('div');
    npc.tag.className = 'name-tag npc-tag';
    $('labels').appendChild(npc.tag);
  }
  npc.jars = JAR_OFFS.map(([off, inland]) => {
    const p = world.shorePoint(off);
    const at = p.shore.clone().addScaledVector(p.face, -inland);
    at.y = world.heightAt(at.x, at.z);
    const jar = makeJar();
    jar.position.copy(at);
    jar.visible = false;
    g.add(jar);
    return jar;
  });
  const sp = world.spots[0];
  B.spot.copy(sp.stand).addScaledVector(sp.face, 30).setY(0);
  B.monster = new Monster(bossInfo().look);
  B.monster.dive(B.spot);
  B.monster.group.visible = false;
  g.add(B.monster.group);
  B.data = null;
  B.at = 0;
  setNpcVisible(true);
}

function setNpcVisible(on) {
  npc.boat.visible = on;
  npc.angler.rod.group.visible = on;
  if (on) {
    npc.boat.position.copy(npc.home);
    npc.boat.rotation.set(0, npc.yaw, 0);
    npc.angler.group.visible = true;
  }
}

function nearNpc() {
  if (G.mode !== 'walk' || npc.state !== 'home' || !npc.boat) return false;
  return Math.hypot(walker.pos.x - npc.home.x, walker.pos.z - npc.home.z) < npc.talkR;
}

const questHere = () => me?.quest && me.quest.lake === world.lakeId;

// ---- hội thoại ----
function openTalk() {
  const q = me.quest;
  const N = C.quest;
  let text;
  let btns;
  if (!q) {
    text = `Hà... cậu cũng câu ở hồ này à? Mấy đêm nay có thứ gì khổng lồ dưới đáy hồ, nó cắn nát lưới của lão, nuốt luôn cả xuồng của lão Tư. Lão muốn dụ nó lên, mà lại đánh rơi mấy hũ thính quanh bờ. Cậu nhặt giúp lão <b>${N.items} hũ thính</b>, câu thêm <b>${N.fish} con cá</b> làm mồi nhử, xong quay lại đây gặp lão.`;
    btns = [['📜 Nhận nhiệm vụ', 'primary', acceptQuest], ['Để sau', '', closeTalk]];
  } else if (q.lake !== world.lakeId) {
    const l = C.lakes.find((x) => x.id === q.lake);
    text = `Cậu đang giúp lão ở ${esc(l.name)} mà? Muốn làm ở hồ này thì phải làm lại từ đầu đấy.`;
    btns = [['Làm ở hồ này', 'primary', acceptQuest], ['Thôi', '', closeTalk]];
  } else if (q.items.length >= N.items && q.fish >= N.fish) {
    text = 'Giỏi lắm! Đủ thính, đủ mồi rồi. Lão ra giữa hồ dụ nó lên đây. Nó mà trồi lên thì cả hồ cùng quăng câu vào nó nhé, <b>nó khỏe lắm</b>, phải ghì cho chắc!';
    btns = [['⚓ Lão ra khơi đi!', 'gold', finishQuest], ['Chờ chút', '', closeTalk]];
  } else {
    text = `Được <b>${q.items.length}/${N.items}</b> hũ thính, <b>${Math.min(q.fish, N.fish)}/${N.fish}</b> con cá rồi. Hũ thính có cột sáng vàng, rơi rải rác quanh bờ đấy. Cố lên cậu!`;
    btns = [['Đi tiếp', 'primary', closeTalk]];
  }
  $('talkText').innerHTML = text;
  $('talkBtns').innerHTML = '';
  for (const [label, cls, fn] of btns) {
    const b = document.createElement('button');
    b.className = `btn ${cls}`;
    b.textContent = label;
    b.addEventListener('click', fn);
    $('talkBtns').appendChild(b);
  }
  $('talk').classList.remove('hidden');
}

function closeTalk() {
  $('talk').classList.add('hidden');
}

async function acceptQuest() {
  try {
    await api('POST', 'quest/accept', { lake: world.lakeId });
    closeTalk();
    banner('📜 Nhận nhiệm vụ<small>Nhặt hũ thính có cột sáng vàng quanh bờ và câu đủ cá</small>', '#ffd66a', 2600);
    sound.coin();
  } catch (e) {
    toast(e.message);
  }
}

async function finishQuest() {
  try {
    const d = await api('POST', 'quest/finish', {});
    closeTalk();
    onBoss(d.boss);
  } catch (e) {
    toast(e.message);
  }
}

// ---- hũ thính ----
const jarPending = new Set();
function pickJars() {
  if (!questHere()) return;
  npc.jars.forEach((jar, i) => {
    if (!jar.visible || jarPending.has(i)) return;
    if (Math.hypot(jar.position.x - walker.pos.x, jar.position.z - walker.pos.z) > 1.6) return;
    jarPending.add(i);
    jar.visible = false;
    fx.burst(jar.position.clone().setY(jar.position.y + 0.4), '#ffd66a', 60, 1);
    sound.coin();
    api('POST', 'quest/item', { i })
      .then(() => {
        const n = me.quest ? me.quest.items.length : 0;
        banner(`🏺 Hũ thính ${n}/${C.quest.items}`, '#ffd66a', 1300);
      })
      .catch((e) => toast(e.message))
      .finally(() => jarPending.delete(i));
  });
}

function renderQuest() {
  const el = $('quest');
  if (!el || !me || !C) return;
  const q = me.quest;
  const N = C.quest;
  if (q) {
    const l = C.lakes.find((x) => x.id === q.lake);
    const done = q.items.length >= N.items && q.fish >= N.fish;
    el.innerHTML =
      `<div class="q-title">📜 Nhiệm vụ Lão Ngư${q.lake !== world.lakeId ? ` · ${esc(l.name)}` : ''}</div>` +
      `<div class="${q.items.length >= N.items ? 'ok' : ''}">🏺 Nhặt hũ thính ${q.items.length}/${N.items}</div>` +
      `<div class="${q.fish >= N.fish ? 'ok' : ''}">🐟 Câu cá ở hồ này ${Math.min(q.fish, N.fish)}/${N.fish}</div>` +
      (done ? '<div class="ok">✅ Quay lại gặp Lão Ngư</div>' : '');
  } else if (npc.state === 'home') {
    el.innerHTML = `<div class="q-title">❗ Lão Ngư đang chờ ở góc bờ</div><div class="muted">Bấm 🚶 để đi bộ tới nói chuyện</div>`;
  } else el.innerHTML = '';
  el.classList.toggle('hidden', !el.innerHTML);
}

// ---- thủy quái: trạng thái chung của cả hồ từ máy chủ ----
function onBoss(b) {
  if (!b) {
    if (B.data) bossGone();
    return;
  }
  const fresh = B.at !== b.at;
  B.data = b;
  if (fresh) {
    B.at = b.at;
    B.seenDead = 0;
    B.seenEsc = 0;
    B.cineFx = {};
    B.monster.group.visible = true;
    B.monster.dive(B.spot);
    B.monster.snap = true;
    // tới hồ muộn thì không xem lại cảnh xuồng bị cắn
    if (serverNow() - b.at > 14000) B.cineFx.done = true;
  }
  B.hp = b.hp - (G.f?.boss ? G.f.dmg : 0);
  if (b.dead && !B.seenDead) {
    B.seenDead = 1;
    bossDefeated(b);
  }
  if (b.escaped && !B.seenEsc && !b.dead) {
    B.seenEsc = 1;
    if (G.f?.boss) abandon();
    banner('Thủy quái đã lặn mất tăm...<small>Lão Ngư sẽ sớm quay lại</small>', '#9ab0c0', 3000);
  }
  renderQuest();
}

function bossGone() {
  B.data = null;
  npc.say = '';
  sound.motor(false);
  B.monster.dive(B.spot);
  B.monster.group.visible = false;
  setNpcVisible(true);
  $('bossBar').classList.add('hidden');
  document.body.classList.remove('boss-on');
  renderQuest();
}

const bossActive = () => B.data && !B.data.dead && !B.data.escaped && B.cineFx.done;

// Cảnh Lão Ngư lái xuồng ra giữa hồ rồi bị thủy quái cắn nát, mọi người cùng hồ thấy cùng lúc
function updateCine(ct, dt) {
  const fxs = B.cineFx;
  const m = B.monster;
  const boat = npc.boat;
  const once = (k, fn) => {
    if (!fxs[k]) {
      fxs[k] = true;
      fn();
    }
  };
  const toSpot = B.spot.clone().sub(npc.home).setY(0).normalize();
  if (ct < 9.9) {
    const k = smoothstep(0.6, 7, ct);
    boat.visible = true;
    boat.position.lerpVectors(npc.home, B.spot.clone().addScaledVector(toSpot, -2.5), k);
    const yaw = Math.atan2(-toSpot.x, -toSpot.z);
    boat.rotation.y = lerp(npc.yaw, yaw, smoothstep(0.6, 2, ct));
    if (ct > 0.6 && ct < 7) {
      once('motor', () => sound.motor(true));
      boat.userData.prop.rotation.z += dt * 40;
      if (Math.random() < dt * 12) fx.splashAt(boat.position.clone().addScaledVector(toSpot, -1.9), 0.25);
      if (Math.random() < dt * 4) world.addRipple(boat.position.x, boat.position.z, 0.6);
    }
    if (ct > 7) once('motorOff', () => sound.motor(false));
    npc.say = ct < 3.5 ? 'Lão đi đây! Chờ lão dụ nó lên!' : ct > 7.2 ? 'Hử...? Có gì dưới nước...' : '';
    if (ct > 7) {
      once('rumble', () => sound.rumble(2.8));
      camShake = Math.max(camShake, (ct - 7) * 0.08);
      if (Math.random() < dt * 10) world.addRipple(B.spot.x + (Math.random() - 0.5) * 8, B.spot.z + (Math.random() - 0.5) * 8, 0.8);
      if (Math.random() < dt * 6) fx.splashAt(B.spot.clone().add(new THREE.Vector3((Math.random() - 0.5) * 6, 0, (Math.random() - 0.5) * 6)), 0.3);
    }
  }
  const s = m.scale;
  if (ct >= 9 && ct < 9.7) {
    // phóng vọt lên cạnh xuồng, há hàm
    once('burst', () => {
      fx.splashAt(B.spot, 3);
      fx.splashAt(B.spot.clone().add(new THREE.Vector3(1, 0, 1)), 2.5);
      world.addRipple(B.spot.x, B.spot.z, 3);
      sound.splash(3);
      camShake = 0.7;
      npc.say = 'ÁÁÁÁ!!!';
    });
    const k = smoothstep(9, 9.6, ct);
    const head = B.spot.clone().addScaledVector(toSpot, 1.5).setY(-3 + 9 * k * s);
    m.rise(B.spot.clone().addScaledVector(toSpot, 3), head, new THREE.Vector3(-toSpot.x * 0.4, 1, -toSpot.z * 0.4), 1);
  } else if (ct >= 9.7 && ct < 10.4) {
    // đớp xuống xuồng
    const k = smoothstep(9.7, 10.15, ct);
    const head = B.spot.clone().addScaledVector(toSpot, -1.5).setY(lerp(6 * s, 1.2, k));
    m.rise(B.spot.clone().addScaledVector(toSpot, 3), head, new THREE.Vector3(-toSpot.x, lerp(0.3, -1.4, k), -toSpot.z), ct < 10.05 ? 1 : 0);
    if (ct > 10.05)
      once('crunch', () => {
        sound.crunch();
        debris.burst(boat.position, 18);
        fx.splashAt(boat.position, 3);
        world.addRipple(boat.position.x, boat.position.z, 3);
        boat.visible = false;
        npc.angler.rod.group.visible = false;
        npc.say = '';
        camShake = 0.9;
        navigator.vibrate?.([120, 60, 200]);
      });
  } else if (ct >= 10.4 && ct < 12.8) {
    // ngóc cao gầm về phía bờ
    const k = smoothstep(10.4, 11.2, ct);
    const toShore = stand().clone().sub(B.spot).setY(0).normalize();
    const head = B.spot.clone().addScaledVector(toShore, 2).setY(lerp(1.2, 8.5 * s, k));
    m.rise(B.spot.clone().addScaledVector(toShore, -3), head, toShore.clone().setY(-0.25), ct > 10.9 ? 1 : 0.2);
    once('roar', () => setTimeout(() => sound.roar(2.6), 500));
    if (ct > 10.9 && ct < 12.5) camShake = Math.max(camShake, 0.35);
  } else if (ct >= 12.8) {
    m.swim(B.spot, toSpot, 1.2);
    once('dive', () => {
      fx.splashAt(B.spot, 2.5);
      sound.splash(2.5);
    });
    if (ct > 13.2)
      once('banner', () => {
        banner(`🐉 ${esc(bossInfo().name).toUpperCase()}!<small>Quăng câu vào vòng xoáy giữa hồ, cả hồ cùng ghì nó!</small>`, '#ff5a3a', 4200);
      });
  }
  // máy quay bám sau xuồng lúc ra khơi, rồi lùi ra xa quay toàn cảnh lúc quái trồi lên
  const side = new THREE.Vector3(-toSpot.z, 0, toSpot.x);
  if (ct < 9.6) {
    cine.pos = boat.position.clone().addScaledVector(toSpot, -8).addScaledVector(side, 3.5).setY(2.6);
    cine.look = boat.position.clone().addScaledVector(toSpot, 5).setY(0.6);
    cine.zoom = 1;
  } else {
    cine.pos = B.spot.clone().addScaledVector(toSpot, -17).addScaledVector(side, 7).setY(4);
    cine.look = m.headPos.clone();
    cine.zoom = 0.85;
  }
  cine.on = true;
  if (ct >= 14) {
    fxs.done = true;
    cine.on = false;
    cine.pos = null;
    npc.say = '';
  }
}

const cine = { on: false, zoom: 1, look: new THREE.Vector3(), pos: null, cam: new THREE.Vector3(), lookCur: new THREE.Vector3(), active: false };

// Ngoài giờ đánh nhau: con quái bơi lượn quanh vòng xoáy, thỉnh thoảng ngóc lên gầm
function updateLurk(dt) {
  const m = B.monster;
  B.lurkT += dt;
  const a = B.lurkT * 0.35;
  const head = B.spot.clone().add(new THREE.Vector3(Math.cos(a) * 6, 0, Math.sin(a) * 6));
  const dir = new THREE.Vector3(-Math.sin(a), 0, Math.cos(a));
  B.riseT -= dt;
  if (B.riseT < -2.5) B.riseT = 12 + Math.random() * 8;
  if (B.riseT < 0) {
    const toShore = stand().clone().sub(head).setY(0).normalize();
    m.rise(head.clone().addScaledVector(toShore, -3), head.clone().setY(6 * m.scale), toShore.setY(-0.2), 0.9);
    if (B.riseT > -dt * 1.5) {
      fx.splashAt(head, 2);
      sound.roar(1.6);
    }
  } else m.swim(head, dir, 0.5);
  // vòng xoáy cho biết chỗ quăng câu
  if (Math.random() < dt * 5) {
    const r = 3 + Math.random() * 7;
    const t = Math.random() * 6.28;
    world.addRipple(B.spot.x + Math.cos(t) * r, B.spot.z + Math.sin(t) * r, 0.7);
  }
}

function updateBoss(dt) {
  if (!B.monster) return;
  debris.update(dt, waterY);
  cine.on = false;
  cine.pos = null;
  npc.state = !B.data ? 'home' : B.cineFx.done ? 'gone' : 'cine';
  if (B.data) {
    const ct = B.freeze ?? (serverNow() - B.data.at) / 1000;
    if (!B.cineFx.done) updateCine(ct, dt);
    else if (!(G.f?.boss && G.mode === 'fight') && !(G.show?.boss)) updateLurk(dt);
    if (B.cineFx.done) setNpcVisible(false);
    renderBossBar();
  }
  B.monster.update(dt, G.f?.boss ? 6 : 3);
  // xuồng dập dềnh, Lão Ngư ngó về phía người chơi đứng gần
  if (npc.boat?.visible) {
    const bp = npc.boat.position;
    bp.y = waterY(bp.x, bp.z) + Math.sin(time.value * 1.3) * 0.03 - 0.05;
    npc.boat.rotation.z = Math.sin(time.value * 1.1) * 0.04;
    npc.boat.rotation.x = Math.sin(time.value * 0.8) * 0.02;
    const na = npc.angler;
    na.aimYaw = 0;
    na.pitch = lerp(na.pitch, 1.2, Math.min(1, dt * 2));
    if (npc.state === 'home' && G.mode === 'walk') {
      const rel = walker.pos.clone().sub(bp);
      const want = Math.atan2(-rel.x, -rel.z) - npc.boat.rotation.y;
      na.group.rotation.y = lerp(na.group.rotation.y, rel.length() < 14 ? want : 0, Math.min(1, dt * 3));
    }
    na.update(dt, null, 0);
  }
  // hũ thính chỉ hiện khi đang làm nhiệm vụ ở hồ này
  npc.jars.forEach((jar, i) => {
    const show = questHere() && !me.quest.items.includes(i) && !jarPending.has(i);
    jar.visible = show;
    if (show) {
      jar.rotation.y += dt * 0.8;
      jar.userData.glow.material.opacity = 0.2 + Math.sin(time.value * 3 + i) * 0.08;
    }
  });
  // nhãn trên đầu Lão Ngư
  if (npc.tag) {
    const visible = npc.boat?.visible && npc.angler.group.visible;
    const head = npc.boat ? npc.boat.localToWorld(new THREE.Vector3(0, 2.4, 0.55)) : null;
    let show = false;
    if (visible) {
      head.project(camera);
      show = head.z < 1 && Math.abs(head.x) < 1.2 && Math.abs(head.y) < 1.2;
    }
    npc.tag.style.display = show ? '' : 'none';
    if (show) {
      npc.tag.style.left = `${((head.x + 1) / 2) * innerWidth}px`;
      npc.tag.style.top = `${((1 - head.y) / 2) * innerHeight}px`;
      const q = me?.quest;
      const mark = !q || q.lake !== world.lakeId ? '❗' : q.items.length >= C.quest.items && q.fish >= C.quest.fish ? '✅' : '❓';
      const html = npc.say ? `<span class="say">${esc(npc.say)}</span>` : `<span class="qmark">${mark}</span> 👴 Lão Ngư`;
      if (npc.tag.innerHTML !== html) npc.tag.innerHTML = html;
    }
  }
}

function renderBossBar() {
  const b = B.data;
  const el = $('bossBar');
  const on = !!b && B.cineFx.done && !b.dead && !b.escaped;
  el.classList.toggle('hidden', !on);
  document.body.classList.toggle('boss-on', on);
  if (!on) return;
  const hp = Math.max(0, B.hp);
  const left = Math.max(0, b.until - serverNow());
  $('bossName').textContent = `🐉 ${bossInfo().name}`;
  $('bossFill').style.width = `${(hp / b.max) * 100}%`;
  $('bossInfo').textContent = `${Math.ceil(hp)}/${Math.round(b.max)} · ⚔️ ${Math.max(b.fighters, G.f?.boss ? 1 : 0)} người đang ghì · ⏳ ${Math.floor(left / 60000)}:${String(Math.floor(left / 1000) % 60).padStart(2, '0')}`;
}

// ---- trận ghì thủy quái ----
const ATTACKS = {
  jerk: { name: 'GIẬT MẠNH!', dur: 1.6, phase: 1 },
  dive: { name: 'LẶN SÂU!', dur: 3, phase: 1 },
  thrash: { name: 'QUẪY ĐIÊN CUỒNG!', dur: 3.4, phase: 1 },
  roar: { name: 'GẦM THÉT!', dur: 3.2, phase: 2 },
  drag: { name: 'KÉO XIẾT!', dur: 2.6, phase: 3 },
};

function startBossFight() {
  const rod = ROD_STATS();
  G.f = {
    boss: true,
    D: 1.1,
    size: clamp(0.25 + (rod.strength - 1) * 0.03 + (rod.bar || 0), 0.22, 0.4),
    calm: 1 - (rod.calm || 0),
    y: 0.35,
    vy: 0,
    m: 0.5,
    mv: 0,
    goal: 0.5,
    goalT: 0.6,
    inside: true,
    T: 0.7,
    P: 1, // độ bền dây: về 0 là đứt
    surging: false,
    angle: 0,
    dist: G.bob.distanceTo(stand()),
    splashT: 0,
    atk: null,
    atkT: 3,
    warn: 0,
    hitN: 0,
    dmg: 0,
    sendT: 1,
    t: 0,
  };
  G.fishPos.copy(G.bob);
  $('fight').classList.add('boss');
  $('fight').style.setProperty('--rar', '#ff5a3a');
  banner('THỦY QUÁI CẮN CÂU!<small>Giữ que cá trong thanh trắng, đừng để đứt dây!</small>', '#ff5a3a', 2200);
  sound.roar(1.8);
  fx.splashAt(G.bob, 2.5);
  camShake = 0.6;
  navigator.vibrate?.(300);
  setMode('fight');
}

function bossFight(dt) {
  const f = G.f;
  f.t += dt;
  const frac = clamp(B.hp / (B.data?.max || 1), 0, 1);
  const phase = frac > 0.66 ? 1 : frac > 0.33 ? 2 : 3;
  const D = 1.05 + phase * 0.15;
  const atk = f.atk && f.warn <= 0 ? f.atk : null;

  // thanh trắng
  f.vy += (G.held ? 2.8 : -2.4) * dt;
  f.vy = clamp(f.vy, -1.8, 1.5);
  f.y += f.vy * dt;
  const size = f.size * (atk === 'roar' ? 0.62 : 1);
  if (f.y < 0) {
    f.y = 0;
    f.vy = -f.vy * 0.35;
  }
  if (f.y > 1 - size) {
    f.y = 1 - size;
    f.vy = Math.min(0, f.vy);
  }

  // chọn đòn kế tiếp, báo trước một chút cho người chơi kịp phản ứng
  if (!f.atk) {
    f.atkT -= dt;
    if (f.atkT <= 0) {
      const pool = Object.keys(ATTACKS).filter((k) => ATTACKS[k].phase <= phase);
      f.atk = pool[Math.floor(Math.random() * pool.length)];
      f.warn = phase === 3 ? 0.55 : 0.8;
      f.atkLeft = ATTACKS[f.atk].dur;
      f.hitN = 0;
      $('bossWarn').textContent = `⚠️ ${ATTACKS[f.atk].name} ⚠️`;
      $('bossWarn').classList.remove('hidden');
      sound.bite();
    }
  } else if (f.warn > 0) {
    f.warn -= dt;
    if (f.warn <= 0) {
      if (f.atk === 'roar') {
        sound.roar(2.4);
        $('vignette').classList.add('rage');
      }
      if (f.atk === 'dive') sound.splash(2);
    }
  } else {
    f.atkLeft -= dt;
    const el = ATTACKS[f.atk].dur - f.atkLeft;
    if (f.atk === 'jerk') {
      // hai ba cú giật liên tiếp, giai đoạn sau giật nhiều hơn
      const n = phase;
      if (f.hitN < n && el >= f.hitN * 0.55) {
        f.hitN++;
        f.m = clamp(f.m + (f.m > 0.5 ? -1 : 1) * (0.32 + Math.random() * 0.18) * f.calm, 0.03, 0.97);
        f.mv = 0;
        f.goal = f.m;
        f.vy -= 1.3 * f.calm;
        f.P -= 0.035 * f.calm;
        f.T = 1.2;
        camShake = 0.8 * f.calm;
        sound.slam();
        navigator.vibrate?.(180);
        flash();
        fx.splashAt(G.fishPos, 2.2);
      }
    }
    if (f.atk === 'thrash') {
      const c = 0.5 + Math.sin(f.t * 0.7) * 0.15;
      f.m = clamp(c + (Math.sin(f.t * 7.5) * 0.27 + Math.sin(f.t * 15) * 0.07) * f.calm, 0.02, 0.98);
      camShake = Math.max(camShake, 0.2);
      if (Math.random() < dt * 8) fx.splashAt(G.fishPos.clone().add(new THREE.Vector3((Math.random() - 0.5) * 4, 0, (Math.random() - 0.5) * 4)), 1.2);
    }
    if (f.atk === 'roar') camShake = Math.max(camShake, 0.3);
    if (f.atkLeft <= 0) {
      f.atk = null;
      $('bossWarn').classList.add('hidden');
      $('vignette').classList.remove('rage');
      f.atkT = phase === 1 ? 4.5 + Math.random() * 3.5 : phase === 2 ? 3.2 + Math.random() * 2.8 : 2.2 + Math.random() * 2.2;
    }
  }

  // que cá: bơi như cá khủng, lúc lặn sâu thì kéo xuống đáy, lúc kéo xiết thì vọt lên đỉnh
  if (atk !== 'thrash') {
    f.goalT -= dt;
    if (atk === 'dive') f.goal = 0.04;
    else if (atk === 'drag') f.goal = 0.96;
    else if (f.goalT <= 0) {
      const dart = Math.random() < 0.3 + phase * 0.1;
      f.surging = dart;
      f.goal = clamp(f.m + (Math.random() * 2 - 1) * (dart ? 0.75 : 0.45), 0.03, 0.97);
      f.goalT = (dart ? 0.45 : 0.5 + Math.random()) / (0.7 + D * 0.5);
    }
    const pull = (atk === 'dive' || atk === 'drag' ? 22 : f.surging ? 17 : 9) * (0.6 + D * 0.5) * (atk || f.surging ? f.calm : 1);
    f.mv += ((f.goal - f.m) * pull - f.mv * 5) * dt;
    f.m = clamp(f.m + f.mv * dt + Math.sin(time.value * 11) * 0.006 * D, 0.01, 0.99);
  }

  // trong thanh thì gây sát thương và dây đỡ căng, ra ngoài thì dây mòn dần
  f.inside = f.m >= f.y && f.m <= f.y + size;
  if (f.inside) {
    f.dmg += dt;
    B.hp -= dt;
    f.P = Math.min(1, f.P + 0.03 * dt);
  } else f.P -= (0.075 + phase * 0.02 + (atk === 'drag' ? 0.09 : 0)) * dt;
  f.T += ((f.inside ? 0.6 + 0.1 * Math.sin(time.value * 5) : 1.05) + (atk ? 0.15 : 0) - f.T) * Math.min(1, dt * 4);

  // gửi sức kéo lên máy chủ mỗi giây
  f.sendT -= dt;
  if (f.sendT <= 0 && f.dmg > 0) {
    f.sendT = 1;
    const dmg = f.dmg;
    f.dmg = 0;
    api('POST', 'boss/hit', { lake: world.lakeId, dmg })
      .then((d) => onBoss(d.boss))
      .catch(() => {
        f.dmg += dmg;
      });
  }

  // con quái dưới nước: càng yếu càng bị lôi lại gần bờ
  f.angle += ((f.m - 0.5) * 1.6 - f.angle) * Math.min(1, dt * 2.5);
  const d = lerp(f.dist, 11, 1 - frac);
  const fc = face();
  const dir = new THREE.Vector3(fc.x * Math.cos(f.angle) - fc.z * Math.sin(f.angle), 0, fc.x * Math.sin(f.angle) + fc.z * Math.cos(f.angle));
  const at = stand().clone().addScaledVector(dir, d);
  at.y = 0;
  const m = B.monster;
  const lunge = atk === 'jerk' || atk === 'roar' || (f.warn > 0 && f.atk === 'roar');
  if (lunge) {
    const toShore = dir.clone().multiplyScalar(-1);
    m.rise(at.clone().addScaledVector(dir, 4), at.clone().setY((atk === 'roar' ? 7 : 4.5) * m.scale), toShore.setY(atk === 'roar' ? -0.15 : -0.4), atk === 'roar' ? 1 : 0.7);
  } else if (atk === 'dive') m.swim(at, dir, 2.5);
  else m.swim(at, dir.clone().applyAxisAngle(UP_V, Math.sin(f.t * 1.3) * 0.6), 0.45);
  m.mouth(G.fishPos);
  G.fishPos.y = Math.max(G.fishPos.y, -0.2);
  f.splashT -= dt;
  if (f.splashT <= 0) {
    f.splashT = f.surging || atk ? 0.12 : 0.35;
    fx.splashAt(G.fishPos, f.surging || atk ? 1.1 : 0.5);
    world.addRipple(G.fishPos.x, G.fishPos.z, 1.2);
    if (Math.random() < 0.25) sound.splash(1.5);
  }

  // giao diện
  $('zone').style.bottom = `${f.y * 100}%`;
  $('zone').style.height = `${size * 100}%`;
  $('zone').classList.toggle('in', f.inside);
  $('mark').style.bottom = `${f.m * 100}%`;
  $('progress').style.height = `${clamp(f.P, 0, 1) * 100}%`;
  $('progress').classList.toggle('low', f.P < 0.3);
  $('fight').classList.toggle('danger', !f.inside && f.P < 0.3);
  hint(f.P < 0.3 ? '⚠️ Dây sắp đứt! Đưa que cá vào thanh trắng ngay!' : f.inside ? `Ghì chặt! Thủy quái còn ${Math.ceil(Math.max(0, B.hp))} máu` : 'Que cá ra ngoài rồi, dây đang mòn!');
  camShake = Math.max(camShake, f.surging ? 0.08 : 0.03);
  if (f.P <= 0) {
    sound.setFight(null);
    sound.snap();
    navigator.vibrate?.([80, 40, 80]);
    endBossFight();
    abandon(['ĐỨT DÂY!', 'Thủy quái vẫn còn đó, quăng câu lại ngay!']);
  }
}

function endBossFight() {
  $('fight').classList.remove('boss');
  $('bossWarn').classList.add('hidden');
  $('vignette').classList.remove('rage');
  if (G.f?.boss && G.f.dmg > 0) api('POST', 'boss/hit', { lake: world.lakeId, dmg: G.f.dmg }).then((d) => onBoss(d.boss)).catch(() => {});
  if (G.f) G.f.dmg = 0;
}

function flash() {
  const el = $('flash');
  el.classList.remove('on');
  void el.offsetWidth;
  el.classList.add('on');
}

// thủy quái gục: ai góp sức đều được một con, còn lại thì xem thông báo
function bossDefeated(b) {
  const info = bossInfo();
  const fighting = G.f?.boss && G.mode === 'fight';
  if (fighting) {
    endBossFight();
    sound.setFight(null);
  }
  if (b.dead.me) api('GET', 'me').catch(() => {});
  if (b.dead.me && (fighting || ['idle', 'walk', 'wait', 'reelin'].includes(G.mode))) {
    if (G.mode === 'wait' && G.cast && !G.cast.boss) api('POST', 'land', { castId: G.cast.id, ok: false }).catch(() => {});
    G.cast = null;
    G.f = null;
    if (G.mode === 'walk') returnToSpot();
    bossShow(b, info);
    return;
  }
  if (fighting) {
    // vừa móc vào thì quái đã gục, chưa kịp góp sức
    G.cast = null;
    G.reelFrom = G.fishPos.clone();
    G.f = null;
    setMode('reelin');
  }
  banner(`🎉 ${esc(b.dead.names.join(', '))}<small>đã hạ ${esc(info.name)}!</small>`, '#ffc93c', 3500);
  B.monster.dive(B.spot);
}

function bossShow(b, info) {
  const w = b.dead.w;
  const v = Math.round(info.price[0] + info.price[1] * w);
  G.show = { boss: true, info, t: 0, rarity: C.rarity[3], len: info.look.len, d: { fish: { s: `quai_${world.lakeId}`, w: w, v } } };
  setMode('show');
  sound.roar(3);
  camShake = 1;
  banner('ĐÃ HẠ THỦY QUÁI!', '#ffc93c', 3000);
  setTimeout(() => {
    if (G.mode !== 'show' || !G.show?.boss) return;
    sound.fanfare(3);
    $('catchRarity').textContent = '🐉 Boss · Huyền thoại';
    $('catchRarity').style.color = '#ff7a3a';
    $('catchName').textContent = info.name;
    $('catchWeight').textContent = kg(w);
    $('catchLen').textContent = `${(info.look.len + w / 600).toFixed(1)} m`;
    $('catchValue').textContent = `${fmt(v)} xu`;
    const others = b.dead.names.length > 1 ? `Cùng hạ với: ${b.dead.names.join(', ')}` : 'Một mình hạ thủy quái!';
    $('catchRecord').textContent = `🏆 ${others}`;
    $('catchRecord').classList.remove('hidden');
    $('catch').classList.remove('hidden');
    $('vignette').classList.add('on');
  }, 2600);
}

// thủy quái gục: trồi lên lần cuối, gầm rồi đổ ập xuống nước
function updateBossShow(dt) {
  const s = G.show;
  s.t += dt;
  const m = B.monster;
  const toShore = stand().clone().sub(B.spot).setY(0).normalize();
  const at = stand().clone().addScaledVector(toShore, -16).setY(0);
  if (s.t < 2.2) m.rise(at.clone().addScaledVector(toShore, -4), at.clone().setY(8 * m.scale), toShore.clone().setY(0.4), 1);
  else if (s.t < 3.4) m.rise(at.clone().addScaledVector(toShore, -4), at.clone().addScaledVector(toShore, 3).setY(0.5), toShore.clone().setY(-1), 0.6);
  else m.swim(at, toShore, 0.1);
  if (s.t > 3.2 && !s.fell) {
    s.fell = true;
    fx.splashAt(at, 3);
    fx.splashAt(at.clone().addScaledVector(toShore, 3), 3);
    world.addRipple(at.x, at.z, 3);
    sound.splash(3);
    camShake = 1;
  }
  if (Math.random() < dt * 6) fx.burst(m.headPos, '#ffc93c', 4, 1.5);
  cine.on = true;
  cine.zoom = 0.9;
  cine.look = m.headPos.clone();
}

// ---------- Giao diện ----------

function renderHud() {
  if (!me || !C) return;
  $('money').textContent = me.rich ? '∞' : fmt(me.money);
  const lake = C.lakes.find((l) => l.id === (world.lakeId || me.lake));
  $('lakeName').textContent = `📍 ${lake.name}`;
  $('coolerCount').textContent = me.fish.length;
  $('coolerCount').classList.toggle('full', me.fish.length >= me.coolerSize);
  renderBait();
  renderQuest();
  if (!$('sheet').classList.contains('hidden') && openPanelName) openPanel(openPanelName, true);
}

function renderClock() {
  if (!C) return;
  const h = ((serverNow() % C.gameDayMs) / C.gameDayMs) * 24;
  const ph = phaseOf(h);
  const hh = String(Math.floor(h)).padStart(2, '0');
  const mm = String(Math.floor((h % 1) * 60)).padStart(2, '0');
  $('clock').textContent = `${C.phases[ph].icon} ${hh}:${mm} · ${C.phases[ph].name}`;
  return h;
}

// Thời tiết chung cho mọi người: chia theo khung 5 phút thật, khoảng 4 phần 10 số khung có mưa
const RAIN_MS = 5 * 60 * 1000;
let rainOverride = null;
function rainNow() {
  if (rainOverride !== null) return rainOverride;
  const t = serverNow();
  const k = Math.floor(t / RAIN_MS);
  const hash = (k2) => {
    const x = Math.sin(k2 * 12.9898 + 4.1) * 43758.5453;
    return x - Math.floor(x);
  };
  if (hash(k) > 0.4) return 0;
  const u = (t % RAIN_MS) / RAIN_MS;
  const strength = 0.55 + hash(k + 999) * 0.45;
  return strength * smoothstep(0, 0.1, u) * (1 - smoothstep(0.9, 1, u));
}

function phaseOf(h) {
  if (h >= 5 && h < 7) return 'dawn';
  if (h >= 7 && h < 17) return 'day';
  if (h >= 17 && h < 19) return 'dusk';
  return 'night';
}

function renderBait() {
  if (!me || !C) return;
  if (G.bait !== 'giun' && !(me.baits[G.bait] > 0)) G.bait = 'giun';
  const b = C.baits.find((x) => x.id === G.bait);
  $('baitBtn').textContent = `🪱 ${b.name}${b.id === 'giun' ? '' : ` ×${me.baits[b.id] || 0}`}`;
  $('baitMenu').innerHTML = C.baits
    .map((x) => {
      const n = x.id === 'giun' ? '∞' : me.baits[x.id] || 0;
      return `<button data-bait="${x.id}" class="${x.id === G.bait ? 'active' : ''}" ${n === 0 ? 'disabled' : ''}><span>${esc(x.name)}<br><small class="muted">${esc(x.desc)}</small></span><b>${n}</b></button>`;
    })
    .join('') + '<button data-bait="shop"><span>🛒 Mua thêm mồi</span></button>';
}

$('baitBtn').addEventListener('click', () => {
  if (G.mode !== 'idle') return toast('Thu cần về rồi mới đổi mồi được.');
  $('baitMenu').classList.toggle('hidden');
});
$('baitMenu').addEventListener('click', (e) => {
  const b = e.target.closest('button');
  if (!b || b.disabled) return;
  if (b.dataset.bait === 'shop') openPanel('shop');
  else {
    G.bait = b.dataset.bait;
    localStorage.setItem('fish.bait', G.bait);
  }
  $('baitMenu').classList.add('hidden');
  renderBait();
});

function updateControls() {
  const btn = $('action');
  const text = $('actionText');
  btn.className = 'action';
  $('power').classList.toggle('hidden', G.mode !== 'charge');
  $('fight').classList.toggle('hidden', G.mode !== 'fight');
  $('baitBtn').classList.toggle('hidden', G.mode !== 'idle' && G.mode !== 'charge');
  const labels = {
    idle: 'Giữ để quăng',
    charge: 'Thả để quăng',
    flying: '...',
    wait: 'Thu cần',
    bite: 'GIẬT!',
    fight: 'Giữ để kéo',
    landing: '...',
    show: 'Cất cá',
    reelin: '...',
    walk: '🎣 Về chỗ câu',
  };
  text.textContent = labels[G.mode];
  if (G.mode === 'bite') btn.classList.add('alert');
  if (G.mode === 'fight') btn.classList.add('reel');
  if (G.mode === 'wait' || G.mode === 'flying' || G.mode === 'reelin' || G.mode === 'landing') btn.classList.add('wait');
  if (G.mode !== 'fight') $('fight').classList.remove('danger');
  $('walkBtn').classList.toggle('hidden', G.mode !== 'idle');
  $('joy').classList.toggle('hidden', G.mode !== 'walk' || !mobile);
  document.body.classList.toggle('walking', G.mode === 'walk');
  if (G.mode !== 'walk') hint('');
}

const actionBtn = $('action');
actionBtn.addEventListener('pointerdown', (e) => {
  e.preventDefault();
  actionBtn.setPointerCapture(e.pointerId);
  press();
});
actionBtn.addEventListener('pointerup', release);
actionBtn.addEventListener('pointercancel', release);
addEventListener('keydown', (e) => {
  if (e.code !== 'Space' || e.repeat || document.activeElement?.tagName === 'INPUT') return;
  e.preventDefault();
  press();
});
addEventListener('keyup', (e) => {
  if (e.code !== 'Space' || document.activeElement?.tagName === 'INPUT') return;
  release();
});
$('keepBtn').addEventListener('click', collect);
$('viewBtn').addEventListener('click', () => setView(view === 'fp' ? 'tp' : 'fp'));
$('viewBtn').textContent = view === 'fp' ? '🎥' : '👁️';

// ---------- Bảng chức năng ----------

let openPanelName = null;
const PANELS = {
  cooler: ['🧺 Thùng cá', renderCooler],
  shop: ['🛒 Cửa hàng', renderShop],
  map: ['🗺️ Các hồ câu', renderMap],
  book: ['📖 Sổ tay cá', renderBook],
  board: ['🏆 Bảng xếp hạng', renderBoard],
  settings: ['⚙️ Cài đặt', renderSettings],
};

function openPanel(name, refresh) {
  openPanelName = name;
  const [title, fn] = PANELS[name];
  $('sheetTitle').textContent = title;
  if (!refresh) $('sheetBody').scrollTop = 0;
  $('sheet').classList.remove('hidden');
  fn($('sheetBody'));
}

function closePanel() {
  $('sheet').classList.add('hidden');
  openPanelName = null;
}

document.querySelectorAll('[data-panel]').forEach((b) => b.addEventListener('click', () => openPanel(b.dataset.panel)));
$('sheetClose').addEventListener('click', closePanel);
$('sheet').addEventListener('click', (e) => {
  if (e.target === $('sheet')) closePanel();
});

function rarityDot(r) {
  return `<span class="dot" style="background:${C.rarity[r].color};box-shadow:0 0 8px ${C.rarity[r].color}"></span>`;
}

function renderCooler(el) {
  const total = me.fish.reduce((s, f) => s + f.v, 0);
  const rows = me.fish
    .map((f, i) => ({ f, i, info: C.fish[f.s] }))
    .reverse()
    .map(({ f, i, info }) => `<div class="row">${rarityDot(info.rarity)}<div class="grow"><div class="title">${esc(info.name)}</div><div class="desc">${kg(f.w)} · ${C.rarity[info.rarity].name}</div></div><button class="btn small" data-sell="${i}">Bán ${fmt(f.v)}</button></div>`)
    .join('');
  el.innerHTML = `<p class="muted">Đang chứa ${me.fish.length}/${me.coolerSize} con (${esc(C.coolers[me.cooler].name)}).</p>
    ${me.fish.length ? `<button class="btn gold" data-sell="all" style="width:100%;margin-bottom:10px">💰 Bán tất cả: +${fmt(total)} xu</button>` : '<p>Thùng đang trống. Ra hồ câu thôi!</p>'}
    ${rows}`;
  el.querySelectorAll('[data-sell]').forEach((b) =>
    b.addEventListener('click', async () => {
      try {
        const d = await api('POST', 'sell', { index: b.dataset.sell === 'all' ? 'all' : Number(b.dataset.sell) });
        sound.coin();
        toast(`Bán ${d.sold} con, được ${fmt(d.total)} xu`);
      } catch (e) {
        toast(e.message);
      }
    }),
  );
}

function renderShop(el) {
  const rods = C.rods
    .map((r) => {
      const owned = me.rods.includes(r.id);
      const using = me.rod === r.id;
      const btn = using ? '<button class="btn small" disabled>Đang dùng</button>' : owned ? `<button class="btn small" data-buy="rod" data-id="${r.id}">Dùng</button>` : `<button class="btn small primary" data-buy="rod" data-id="${r.id}" ${!me.rich && me.money < r.price ? 'disabled' : ''}>${fmt(r.price)} xu</button>`;
      return `<div class="row ${using ? 'current' : ''}"><div class="grow"><div class="title">🎣 ${esc(r.name)}</div><div class="desc">${esc(r.desc)}<br>Sức chịu ×${r.strength} · Tốc độ kéo ×${r.reel}${r.luck ? ` · May mắn +${Math.round(r.luck * 100)}%` : ''}${r.bar ? ` · Thanh trắng +${Math.round(r.bar * 100)}% · Cá giật −${Math.round(r.calm * 100)}%` : ''}</div></div>${btn}</div>`;
    })
    .join('');
  const baits = C.baits
    .filter((b) => b.pack)
    .map((b) => `<div class="row"><div class="grow"><div class="title">🪱 ${esc(b.name)} <span class="muted">(còn ${me.baits[b.id] || 0})</span></div><div class="desc">${esc(b.desc)}</div></div><button class="btn small primary" data-buy="bait" data-id="${b.id}" ${!me.rich && me.money < b.price ? 'disabled' : ''}>${b.pack} cái · ${fmt(b.price)} xu</button></div>`)
    .join('');
  const next = C.coolers[me.cooler + 1];
  const cooler = next
    ? `<div class="row"><div class="grow"><div class="title">🧊 ${esc(next.name)}</div><div class="desc">Chứa ${next.size} con (hiện tại ${me.coolerSize})</div></div><button class="btn small primary" data-buy="cooler" ${!me.rich && me.money < next.price ? 'disabled' : ''}>${fmt(next.price)} xu</button></div>`
    : '<p class="muted">Thùng đá đã to nhất.</p>';
  el.innerHTML = `<p class="muted">Bạn có <b style="color:var(--gold)">${me.rich ? '∞' : fmt(me.money)} xu</b>.</p>
    <div class="sec">Cần câu</div>${rods}
    <div class="sec">Mồi câu</div>${baits}
    <div class="sec">Thùng đá</div>${cooler}`;
  bindBuy(el);
}

function bindBuy(el) {
  el.querySelectorAll('[data-buy]').forEach((b) =>
    b.addEventListener('click', async () => {
      try {
        const kind = b.dataset.buy;
        const prevLake = world.lakeId;
        await api('POST', 'buy', { kind, id: b.dataset.id });
        sound.coin();
        if (kind === 'rod') player.angler.setRod(me.rod, scene);
        if (kind === 'lake' && me.lake !== prevLake) travel(me.lake);
      } catch (e) {
        toast(e.message);
      }
    }),
  );
}

function renderMap(el) {
  el.innerHTML = C.lakes
    .map((l) => {
      const open = me.lakes.includes(l.id);
      const here = world.lakeId === l.id;
      const fish = Object.values(C.fish).filter((f) => f.lake === l.id);
      const btn = here ? '<button class="btn small" disabled>Đang ở đây</button>' : open ? `<button class="btn small primary" data-buy="lake" data-id="${l.id}">Đi tới</button>` : `<button class="btn small gold" data-buy="lake" data-id="${l.id}" ${!me.rich && me.money < l.price ? 'disabled' : ''}>Mở khóa ${fmt(l.price)} xu</button>`;
      return `<div class="row ${here ? 'current' : ''}"><div class="grow"><div class="title">${open ? '📍' : '🔒'} ${esc(l.name)}</div><div class="desc">${esc(l.desc)}<br>${fish.length} loài cá · ${fish.filter((f) => me.best[Object.keys(C.fish).find((k) => C.fish[k] === f)]).length} đã câu được</div></div>${btn}</div>`;
    })
    .join('');
  bindBuy(el);
}

function renderBook(el) {
  const ph = phaseOf(((serverNow() % C.gameDayMs) / C.gameDayMs) * 24);
  el.innerHTML =
    `<p class="muted">Viền xanh: loài đang có thể cắn câu lúc này (${C.phases[ph].icon} ${C.phases[ph].name}).</p>` +
    C.lakes
      .map((l) => {
        const cards = Object.entries(C.fish)
          .filter(([, f]) => f.lake === l.id)
          .sort((a, b) => a[1].rarity - b[1].rarity)
          .map(([id, f]) => {
            const best = me.best[id];
            const times = f.times.map((t) => C.phases[t].icon).join('');
            const now = f.times.includes(ph);
            return `<div class="card ${best ? '' : 'unknown'} ${now ? 'now' : ''}"><div style="color:${C.rarity[f.rarity].color};font-size:11px;font-weight:700">${C.rarity[f.rarity].name}</div><div class="title">${best ? esc(f.name) : '???'}</div><div class="muted">${times}</div>${best ? `<div>Kỷ lục: ${kg(best)}</div>` : `<div class="muted">${kg(f.w[0])} – ${kg(f.w[1])}</div>`}</div>`;
          })
          .join('');
        return `<div class="sec">${esc(l.name)}</div><div class="grid">${cards}</div>`;
      })
      .join('');
}

async function renderBoard(el, tab = 'biggest') {
  el.innerHTML = '<p class="muted">Đang tải...</p>';
  try {
    const d = await api('GET', 'board');
    const draw = (t) => {
      const list = d[t];
      const rows = list
        .map((r, i) => {
          const val = t === 'biggest' ? `${esc(C.fish[r.biggest.s].name)} · <b>${kg(r.biggest.w)}</b>` : `<b>${r.caught} con</b>`;
          return `<tr class="${r.me ? 'me' : ''}"><td>${['🥇', '🥈', '🥉'][i] || i + 1}</td><td>${esc(r.name)}${r.legend ? ` <span title="Cá huyền thoại">✨${r.legend}</span>` : ''}</td><td style="text-align:right">${val}</td></tr>`;
        })
        .join('');
      const recs = Object.entries(d.records)
        .sort((a, b) => C.fish[b[0]].rarity - C.fish[a[0]].rarity)
        .map(([s, r]) => `<tr><td>${rarityDot(C.fish[s].rarity)}</td><td>${esc(C.fish[s].name)}</td><td style="text-align:right"><b>${kg(r.w)}</b> · ${esc(r.name)}</td></tr>`)
        .join('');
      el.innerHTML = `<div class="tabs"><button class="tab ${t === 'biggest' ? 'active' : ''}" data-t="biggest">🐋 Cá to nhất</button><button class="tab ${t === 'most' ? 'active' : ''}" data-t="most">🎣 Câu nhiều nhất</button><button class="tab ${t === 'records' ? 'active' : ''}" data-t="records">📜 Kỷ lục loài</button></div>
        <table class="board">${t === 'records' ? recs || '<tr><td>Chưa có ai câu được gì.</td></tr>' : rows || '<tr><td>Chưa có ai trên bảng. Hãy là người đầu tiên!</td></tr>'}</table>`;
      el.querySelectorAll('[data-t]').forEach((b) => b.addEventListener('click', () => draw(b.dataset.t)));
    };
    draw(tab);
  } catch (e) {
    el.innerHTML = `<p class="err">${esc(e.message)}</p>`;
  }
}

function renderSettings(el) {
  el.innerHTML = `<div class="sec">Chất lượng hình ảnh</div>
    <div class="seg">${Object.entries(QUALITY).map(([k, q]) => `<button class="btn ${k === quality ? 'primary' : ''}" data-q="${k}">${q.name}</button>`).join('')}</div>
    <p class="muted">Máy yếu hoặc điện thoại nóng thì chọn Thấp. Cao có phản chiếu nét, bóng đổ, cỏ lay và ánh sáng loá.</p>
    <div class="sec">Góc nhìn</div>
    <div class="seg"><button class="btn ${view === 'fp' ? 'primary' : ''}" data-view="fp">🎥 Thứ nhất (cầm cần)</button><button class="btn ${view === 'tp' ? 'primary' : ''}" data-view="tp">👁️ Thứ ba (thấy cả người)</button></div>
    <div class="sec">Âm thanh</div>
    <button class="btn" id="muteBtn">${sound.muted ? '🔇 Đang tắt tiếng' : '🔊 Đang bật tiếng'}</button>
    <div class="sec">Tài khoản</div>
    <p>Đang chơi với tên <b>${esc(me.name)}</b> · đã câu ${me.caught} con.</p>
    <button class="btn" id="logoutBtn">Đăng xuất</button>
    <div class="sec">Cách chơi</div>
    <p class="muted">Giữ nút để lấy đà rồi thả để quăng. Kéo màn hình sang trái phải để chọn hướng. Chờ phao chìm hẳn thì bấm giật cần. Khi kéo cá: giữ Space, giữ chuột hoặc giữ nút để nâng thanh trắng, thả ra thì thanh rơi xuống. Giữ cho que cá màu xám luôn nằm trong thanh trắng thì thanh tiến trình bên cạnh đầy dần, que ra ngoài thì tiến trình tụt, tụt hết là cá sổng. Cá càng to, càng hiếm thì que chạy càng nhanh và thanh trắng càng ngắn. Mỗi hồ, mỗi giờ trong ngày có loài cá riêng, xem Sổ tay cá. Một ngày trong game dài 24 phút, thỉnh thoảng trời đổ mưa. Nút 🎥 trên cùng đổi góc nhìn thứ nhất/thứ ba. Bảng hạng góc trái tính điểm bằng tổng giá trị cá đã câu.</p>`;
  el.querySelectorAll('[data-q]').forEach((b) =>
    b.addEventListener('click', () => {
      localStorage.setItem('fish.quality', b.dataset.q);
      location.reload();
    }),
  );
  el.querySelectorAll('[data-view]').forEach((b) =>
    b.addEventListener('click', () => {
      setView(b.dataset.view);
      renderSettings(el);
    }),
  );
  $('muteBtn').addEventListener('click', () => {
    sound.setMuted(!sound.muted);
    renderSettings(el);
  });
  $('logoutBtn').addEventListener('click', () => {
    localStorage.removeItem('fish.token');
    location.reload();
  });
}

// ---------- Đổi hồ ----------

function travel(lakeId) {
  closePanel();
  if (G.mode !== 'idle') {
    if (G.f?.boss) endBossFight();
    if (G.cast && !G.cast.boss) api('POST', 'land', { castId: G.cast.id, ok: false }).catch(() => {});
    G.cast = null;
    closeTalk();
    collect();
    setMode('idle');
  }
  for (const id of [...remotes.keys()]) removeRemote(id);
  $('loading').classList.remove('fade');
  $('loadingText').textContent = `Đang tới ${C.lakes.find((l) => l.id === lakeId).name}...`;
  setTimeout(() => {
    buildLake(lakeId);
    $('loading').classList.add('fade');
    pollPresence();
  }, 60);
}

function buildLake(lakeId) {
  world.setLake(lakeId, me.spot || 0);
  buildQuestScene();
  spawnPlayer();
  cam.inited = false;
  cam.yaw = 0;
  sound.lake = lakeId;
  renderHud();
  world.setRain(rainNow());
  world.setHour(renderClock());
}

// ---------- Đăng nhập ----------

let loginMode = 'login';
document.querySelectorAll('.tab[data-mode]').forEach((t) =>
  t.addEventListener('click', () => {
    loginMode = t.dataset.mode;
    document.querySelectorAll('.tab[data-mode]').forEach((x) => x.classList.toggle('active', x === t));
    $('loginBtn').textContent = loginMode === 'login' ? 'Vào hồ' : 'Tạo tài khoản và vào hồ';
  }),
);
async function doLogin() {
  $('loginErr').textContent = '';
  try {
    const d = await api('POST', loginMode, { name: $('nameInput').value, password: $('passInput').value });
    token = d.token;
    localStorage.setItem('fish.token', token);
    $('login').classList.add('hidden');
    sound.start();
    enterGame();
  } catch (e) {
    $('loginErr').textContent = e.message;
  }
}
$('loginBtn').addEventListener('click', doLogin);
$('passInput').addEventListener('keydown', (e) => e.key === 'Enter' && doLogin());

// ---------- Vòng lặp ----------

let last = performance.now();
let hourTimer = 0;
let presenceTimer = 0;
let running = false;

function frame(now) {
  requestAnimationFrame(frame);
  const dt = Math.min(0.05, (now - last) / 1000);
  last = now;
  time.value += dt;
  // đồng hồ và danh sách bạn bè theo thời gian thật, không theo số khung hình
  if (now - hourTimer > 500) {
    hourTimer = now;
    const rain = rainNow();
    world.setRain(rain);
    sound.setRain(world.rain);
    world.setHour(renderClock());
    if (world.rain > 0.05) $('clock').textContent += ' · 🌧️ Mưa';
    sound.night = world.night;
  }
  if (now - presenceTimer > 2000) {
    presenceTimer = now;
    pollPresence();
  }
  if (me && now - rankTimer > 15000) {
    rankTimer = now;
    pollRank();
  }
  updateBoss(dt);
  updateGame(dt);
  updateRemotes(dt);
  updateCamera(dt);
  world.update(dt, camera);
  fx.update(dt);
  showLight.intensity = G.mode === 'show' ? 4 : 0;
  if (bloom) bloom.strength = 0.35 + world.night * 0.35 + (G.mode === 'show' && G.show?.info.rarity >= 2 ? 0.4 : 0);
  if (composer) composer.render();
  else renderer.render(scene, camera);
}

function enterGame() {
  $('loading').classList.remove('fade');
  $('loadingText').textContent = 'Đang dựng hồ câu...';
  setTimeout(() => {
    buildLake(me.lake);
    $('hud').classList.remove('hidden');
    $('controls').classList.remove('hidden');
    updateControls();
    $('loading').classList.add('fade');
    if (!running) {
      running = true;
      requestAnimationFrame(frame);
    }
    window.fishReady = true;
  }, 60);
}

async function boot() {
  try {
    C = await api('GET', 'catalog');
  } catch {
    $('loadingText').textContent = 'Không kết nối được máy chủ, thử tải lại trang.';
    return;
  }
  if (token) {
    try {
      await api('GET', 'me');
      enterGame();
      return;
    } catch {
      // token hết hạn thì đăng nhập lại
    }
  }
  // cảnh nền phía sau màn đăng nhập
  world.setLake('sen');
  world.setHour(17.6);
  const sp = world.spots[0];
  camera.position.copy(sp.stand).addScaledVector(sp.face, -3);
  camera.position.y = 2.4;
  camera.lookAt(sp.stand.clone().addScaledVector(sp.face, 30));
  const spin = (t) => {
    if (me) return;
    time.value = t / 1000;
    world.update(0.016, camera);
    if (composer) composer.render();
    else renderer.render(scene, camera);
    requestAnimationFrame(spin);
  };
  requestAnimationFrame(spin);
  $('loading').classList.add('fade');
  $('login').classList.remove('hidden');
  window.fishReady = true;
}

// để thử nghiệm từ console trình duyệt
window.fishDebug = { G, B, npc, walker, world, camera, remotes, api, onBoss, startWalk, serverNow, skew: (ms) => (clockSkew += ms), lake: (id) => buildLake(id), rain: (r) => (rainOverride = r), view: (v) => setView(v) };

boot();

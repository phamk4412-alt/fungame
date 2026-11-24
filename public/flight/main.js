// Sải Cánh — mô phỏng bay máy bay cánh quạt hạng nhẹ, góc nhìn buồng lái chân thực.
import * as THREE from 'three';
import { World, QUALITY, TIMES, LAYER_NEAR } from './world.js';
import { buildAirport } from './airport.js';
import { makeAircraft } from './plane.js';
import { makeCockpit, EYE } from './cockpit.js';
import { Aircraft, makeControls, SPEC } from './physics.js';
import { surfaceAt, normalAt, heightAt, WORLD, fbm, onRunway } from './terrain.js';
import { Sound } from './audio.js';

const $ = (id) => document.getElementById(id);
const store = {
  get(k, d) { try { return localStorage.getItem('flight.' + k) || d; } catch { return d; } },
  set(k, v) { try { localStorage.setItem('flight.' + k, v); } catch { /* bỏ qua */ } },
};
const touch = matchMedia('(pointer: coarse)').matches;
const params = new URLSearchParams(location.search);
const prefs = {
  quality: params.get('q') || store.get('quality', touch ? 'low' : 'mid'),
  time: params.get('t') || store.get('time', 'morning'),
  start: params.get('start') || store.get('start', 'runway'),
  view: store.get('view', 'cockpit'),
};

// ---------- Kết xuất ----------
const renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: 'high-performance' });
const Q = QUALITY[prefs.quality] || QUALITY.mid;
renderer.setPixelRatio(Math.min(window.devicePixelRatio, Q.ratio));
renderer.setSize(innerWidth, innerHeight);
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
renderer.shadowMap.autoUpdate = false;
document.body.prepend(renderer.domElement);

const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(66, innerWidth / innerHeight, 1, 90000);
const T = TIMES[prefs.time] || TIMES.morning;
renderer.toneMappingExposure = T.exposure;

let world, airport, plane, cockpit, sim, ctl;
const sound = new Sound();
sound.setOn(store.get('sound', '1') === '1');
const actor = new THREE.Group();
scene.add(actor);

const state = {
  view: prefs.view, // cockpit | chase | orbit
  look: { yaw: 0, pitch: 0, tyaw: 0, tpitch: 0 },
  fov: 66,
  orbit: { yaw: 0.5, pitch: 0.18, dist: 16 },
  paused: true,
  started: false,
  hud: true,
  t: 0,
  fuel: [24, 24],
  hours: 1873.4,
  lastHdg: 0,
  turnRate: 0,
  message: '',
  msgT: 0,
  crashedShown: false,
  chase: new THREE.Vector3(),
  chaseQ: new THREE.Quaternion(),
  shake: 0,
};

function setLayer(obj, layer) {
  obj.traverse((o) => o.layers.set(layer));
}

function applyView() {
  const inside = state.view === 'cockpit';
  plane.cabin.visible = !inside;
  plane.group.userData.inside = inside;
  cockpit.group.visible = inside;
  setLayer(plane.group, inside ? LAYER_NEAR : 0);
  document.body.classList.toggle('inside', inside);
  $('viewName').textContent = { cockpit: 'Buồng lái', chase: 'Bám đuôi', orbit: 'Ngắm tự do' }[state.view];
  store.set('view', state.view);
}

function cycleView() {
  const order = ['cockpit', 'chase', 'orbit'];
  state.view = order[(order.indexOf(state.view) + 1) % order.length];
  applyView();
}

// ---------- Môi trường cho mô hình bay ----------
const env = {
  surface: surfaceAt,
  normal: (x, z) => normalAt(x, z, 1.5),
  gust(t, p) {
    const agl = p[1] - Math.max(0, heightAt(p[0], p[2]));
    const k = 0.25 + 0.9 * Math.max(0, 1 - agl / 1800) * Math.min(1, agl / 60);
    return [
      2.2 + fbm(t * 0.21, 3.7, 3) * 2.4 * k,
      fbm(t * 0.35 + p[0] / 900, p[2] / 900, 3) * 1.6 * k,
      0.9 + fbm(7.1, t * 0.19, 3) * 2.4 * k,
    ];
  },
};

const STARTS = {
  runway() { sim.reset([WORLD.runway.x, WORLD.airport.elev + 1.16, WORLD.runway.z + WORLD.runway.length / 2 - 40], 0, 0, true); ctl.throttle = 0; ctl.flaps = 0; ctl.brake = 0; ctl.trim = 0.15; },
  approach() {
    const d = 5200, gs = Math.tan(3 * Math.PI / 180) * d;
    sim.reset([WORLD.runway.x + 3, WORLD.airport.elev + gs, WORLD.runway.z + WORLD.runway.length / 2 - 300 + d], 0, 38);
    ctl.throttle = 0.42; ctl.flaps = 1; ctl.trim = 0.45; sim.flapPos = 10;
  },
  scenic() { sim.reset([-2500, 1150, -2800], 330, 54); ctl.throttle = 0.75; ctl.flaps = 0; ctl.trim = 0.12; },
};

function respawn(kind = prefs.start) {
  (STARTS[kind] || STARTS.runway)();
  state.crashedShown = false;
  state.look.tyaw = state.look.tpitch = 0;
  $('crash').classList.remove('show');
  state.chase.set(...sim.pos);
  syncActor(0);
}

// ---------- Điều khiển ----------
const keys = new Set();
const axis = { pitch: 0, roll: 0, yaw: 0 };
const touchIn = { active: false, x: 0, y: 0 };
let pad = null;

addEventListener('keydown', (e) => {
  if (e.target.tagName === 'INPUT') return;
  const k = e.code;
  if (['Space', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'PageUp', 'PageDown'].includes(k)) e.preventDefault();
  if (e.repeat) { keys.add(k); return; }
  keys.add(k);
  if (!state.started) return;
  if (k === 'KeyV') cycleView();
  else if (k === 'KeyC') { ctl.flaps = Math.min(3, ctl.flaps + 1); flash(`Cánh tà ${SPEC.flapDeg[ctl.flaps]}°`); }
  else if (k === 'KeyX') { ctl.flaps = Math.max(0, ctl.flaps - 1); flash(`Cánh tà ${SPEC.flapDeg[ctl.flaps]}°`); }
  else if (k === 'KeyH') { state.hud = !state.hud; $('hud').classList.toggle('hide', !state.hud); $('help').classList.add('hide'); }
  else if (k === 'KeyM') toggleSound();
  else if (k === 'KeyB') { state.look.tyaw = state.look.tpitch = 0; }
  else if (k === 'Enter' && sim.crashed) respawn();
  else if (k === 'KeyP' || k === 'Escape') setPaused(!state.paused);
});
addEventListener('keyup', (e) => keys.delete(e.code));
addEventListener('blur', () => keys.clear());

// chuột phải / trái kéo để nhìn quanh, lăn chuột để thu phóng
let drag = null;
renderer.domElement.addEventListener('contextmenu', (e) => e.preventDefault());
renderer.domElement.addEventListener('pointerdown', (e) => {
  if (e.pointerType === 'touch') return;
  drag = { x: e.clientX, y: e.clientY };
  renderer.domElement.setPointerCapture(e.pointerId);
});
renderer.domElement.addEventListener('pointermove', (e) => {
  if (!drag) return;
  const dx = e.clientX - drag.x, dy = e.clientY - drag.y;
  drag = { x: e.clientX, y: e.clientY };
  if (state.view === 'cockpit') {
    state.look.tyaw = THREE.MathUtils.clamp(state.look.tyaw - dx * 0.005, -2.6, 2.6);
    state.look.tpitch = THREE.MathUtils.clamp(state.look.tpitch - dy * 0.004, -1.1, 0.9);
  } else {
    state.orbit.yaw -= dx * 0.006;
    state.orbit.pitch = THREE.MathUtils.clamp(state.orbit.pitch + dy * 0.004, -0.4, 1.3);
  }
});
renderer.domElement.addEventListener('pointerup', () => { drag = null; });
renderer.domElement.addEventListener('dblclick', () => { state.look.tyaw = state.look.tpitch = 0; });
renderer.domElement.addEventListener('wheel', (e) => {
  e.preventDefault();
  if (state.view === 'cockpit') state.fov = THREE.MathUtils.clamp(state.fov + Math.sign(e.deltaY) * 4, 30, 80);
  else state.orbit.dist = THREE.MathUtils.clamp(state.orbit.dist * (1 + Math.sign(e.deltaY) * 0.1), 7, 120);
}, { passive: false });

// cần điều khiển cảm ứng
function setupTouch() {
  const stick = $('stick'), knob = $('knob');
  const center = () => { const r = stick.getBoundingClientRect(); return [r.left + r.width / 2, r.top + r.height / 2, r.width / 2]; };
  const move = (e) => {
    const [cx, cy, R] = center();
    let dx = (e.clientX - cx) / R, dy = (e.clientY - cy) / R;
    const l = Math.hypot(dx, dy);
    if (l > 1) { dx /= l; dy /= l; }
    touchIn.x = dx; touchIn.y = dy;
    knob.style.transform = `translate(${dx * R * 0.6}px, ${dy * R * 0.6}px)`;
  };
  stick.addEventListener('pointerdown', (e) => { touchIn.active = true; stick.setPointerCapture(e.pointerId); move(e); });
  stick.addEventListener('pointermove', (e) => { if (touchIn.active) move(e); });
  const end = () => { touchIn.active = false; touchIn.x = touchIn.y = 0; knob.style.transform = ''; };
  stick.addEventListener('pointerup', end); stick.addEventListener('pointercancel', end);
  const thr = $('thr');
  const setThr = (e) => { const r = thr.getBoundingClientRect(); ctl.throttle = THREE.MathUtils.clamp(1 - (e.clientY - r.top) / r.height, 0, 1); };
  thr.addEventListener('pointerdown', (e) => { thr.setPointerCapture(e.pointerId); setThr(e); });
  thr.addEventListener('pointermove', (e) => { if (e.buttons || e.pressure) setThr(e); });
  const tap = (id, fn) => $(id).addEventListener('pointerdown', (e) => { e.preventDefault(); fn(); });
  tap('tView', cycleView);
  tap('tFlap', () => { ctl.flaps = (ctl.flaps + 1) % 4; flash(`Cánh tà ${SPEC.flapDeg[ctl.flaps]}°`); });
  const br = $('tBrake');
  br.addEventListener('pointerdown', () => keys.add('Space'));
  br.addEventListener('pointerup', () => keys.delete('Space'));
  tap('tPause', () => setPaused(true));
  // kéo màn hình để nhìn quanh
  let last = null;
  renderer.domElement.addEventListener('touchstart', (e) => { const t = e.touches[0]; last = [t.clientX, t.clientY]; }, { passive: true });
  renderer.domElement.addEventListener('touchmove', (e) => {
    const t = e.touches[0]; if (!last) return;
    const dx = t.clientX - last[0], dy = t.clientY - last[1]; last = [t.clientX, t.clientY];
    if (state.view === 'cockpit') { state.look.tyaw = THREE.MathUtils.clamp(state.look.tyaw - dx * 0.006, -2.6, 2.6); state.look.tpitch = THREE.MathUtils.clamp(state.look.tpitch - dy * 0.005, -1.1, 0.9); }
    else { state.orbit.yaw -= dx * 0.008; state.orbit.pitch = THREE.MathUtils.clamp(state.orbit.pitch + dy * 0.005, -0.4, 1.3); }
  }, { passive: true });
}

const approach = (v, target, rate, dt) => v + THREE.MathUtils.clamp(target - v, -rate * dt, rate * dt);

function readControls(dt) {
  const k = (c) => keys.has(c);
  const tp = (k('KeyS') || k('ArrowDown') ? 1 : 0) - (k('KeyW') || k('ArrowUp') ? 1 : 0);
  const tr = (k('KeyD') || k('ArrowRight') ? 1 : 0) - (k('KeyA') || k('ArrowLeft') ? 1 : 0);
  const ty = (k('KeyE') ? 1 : 0) - (k('KeyQ') ? 1 : 0);
  axis.pitch = approach(axis.pitch, tp, tp ? 1.6 : 3, dt);
  axis.roll = approach(axis.roll, tr, tr ? 2.4 : 4, dt);
  axis.yaw = approach(axis.yaw, ty, ty ? 2.5 : 4, dt);
  let pitch = axis.pitch, roll = axis.roll, yaw = axis.yaw;
  if (touchIn.active) { pitch = touchIn.y; roll = touchIn.x; }
  // tay cầm chơi game
  const gp = navigator.getGamepads ? [...navigator.getGamepads()].find((g) => g) : null;
  pad = gp;
  if (gp) {
    const dz = (v) => (Math.abs(v) < 0.08 ? 0 : v);
    if (dz(gp.axes[1]) || dz(gp.axes[0])) { pitch = dz(gp.axes[1]); roll = dz(gp.axes[0]); }
    if (gp.axes.length > 2 && dz(gp.axes[2])) yaw = dz(gp.axes[2]);
    if (gp.buttons[7]) ctl.throttle = approach(ctl.throttle, gp.buttons[7].value > 0.05 ? gp.buttons[7].value : ctl.throttle, 1, dt);
  }
  // đường cong nhạy: nhẹ ở giữa, mạnh ở biên
  const curve = (v) => Math.sign(v) * (0.35 * Math.abs(v) + 0.65 * v * v);
  ctl.elevator = curve(pitch);
  ctl.aileron = curve(roll);
  ctl.rudder = yaw;
  if (k('KeyR') || k('PageUp') || k('ShiftLeft')) ctl.throttle = Math.min(1, ctl.throttle + dt * 0.45);
  if (k('KeyF') || k('PageDown')) ctl.throttle = Math.max(0, ctl.throttle - dt * 0.45);
  if (k('BracketRight')) ctl.trim = Math.min(1, ctl.trim + dt * 0.25);
  if (k('BracketLeft')) ctl.trim = Math.max(-1, ctl.trim - dt * 0.25);
  ctl.brake = k('Space') || (gp && gp.buttons[6] && gp.buttons[6].value > 0.3) ? 1 : 0;
}

// ---------- Vòng lặp ----------
const tmpQ = new THREE.Quaternion(), tmpV = new THREE.Vector3(), tmpE = new THREE.Euler();

function syncActor() {
  actor.position.set(...sim.pos);
  actor.quaternion.set(...sim.q);
  actor.updateMatrixWorld(true);
}

function flash(msg, sec = 1.8) {
  const el = $('msg');
  el.textContent = msg;
  el.classList.add('show');
  state.msgT = sec;
}

function updateCamera(dt) {
  if (state.view === 'cockpit') {
    const L = state.look;
    L.yaw += (L.tyaw - L.yaw) * Math.min(1, dt * 8);
    L.pitch += (L.tpitch - L.pitch) * Math.min(1, dt * 8);
    camera.fov += (state.fov - camera.fov) * Math.min(1, dt * 6);
    // rung máy + rung theo gia tốc
    const rpmShake = sim.rpm > 300 ? 0.0006 + (sim.onGround ? sim.out.wheelSpeed * 0.00012 : 0) : 0;
    const t = state.t;
    const g = sim.out.gload - 1;
    const eye = EYE.clone();
    eye.x += Math.sin(t * 61) * rpmShake + (state.look.yaw > 0.9 ? 0.12 : state.look.yaw < -0.9 ? -0.08 : 0);
    eye.y += Math.sin(t * 53) * rpmShake - THREE.MathUtils.clamp(g, -1, 3) * 0.012 + state.shake * Math.sin(t * 40) * 0.02;
    camera.position.copy(eye).applyMatrix4(actor.matrixWorld);
    tmpE.set(-0.21 + L.pitch, L.yaw, 0, 'YXZ');
    tmpQ.setFromEuler(tmpE);
    camera.quaternion.copy(actor.quaternion).multiply(tmpQ);
    state.shake = Math.max(0, state.shake - dt * 2);
  } else {
    camera.fov += (60 - camera.fov) * Math.min(1, dt * 6);
    const p = actor.position;
    if (state.view === 'chase') {
      // camera bám sau đuôi, xoay chậm theo hướng bay
      state.chaseQ.slerp(actor.quaternion, Math.min(1, dt * 3));
      const o = state.orbit;
      tmpE.set(-o.pitch * 0.6 - 0.08, o.yaw * 0.25, 0, 'YXZ');
      tmpQ.setFromEuler(tmpE);
      tmpV.set(0, 0, o.dist).applyQuaternion(tmpQ).applyQuaternion(state.chaseQ);
      tmpV.y += 1.2;
      camera.position.copy(p).add(tmpV);
    } else {
      const o = state.orbit;
      tmpV.set(Math.sin(o.yaw) * Math.cos(o.pitch), Math.sin(o.pitch), Math.cos(o.yaw) * Math.cos(o.pitch)).multiplyScalar(o.dist);
      camera.position.copy(p).add(tmpV);
    }
    const ground = Math.max(0, heightAt(camera.position.x, camera.position.z)) + 1.5;
    if (camera.position.y < ground) camera.position.y = ground;
    camera.up.set(0, 1, 0);
    camera.lookAt(p.x, p.y + 0.6, p.z);
  }
  camera.updateProjectionMatrix();
}

function panelState() {
  const a = sim.attitude();
  const hdg = a.heading;
  let dh = hdg - state.lastHdg;
  if (dh > 180) dh -= 360; if (dh < -180) dh += 360;
  state.lastHdg = hdg;
  state.turnRate += (dh / Math.max(1e-3, state.dt) - state.turnRate) * 0.08;
  const gsMs = Math.hypot(sim.vel[0], sim.vel[2]);
  return {
    kt: sim.out.ias * 1.94384,
    ft: sim.pos[1] * 3.28084 + (sim.onGround ? 0 : 0),
    fpm: sim.vel[1] * 196.85,
    pitch: a.pitch * 180 / Math.PI,
    roll: a.roll * 180 / Math.PI,
    hdg,
    turnRate: state.turnRate,
    slip: THREE.MathUtils.clamp(-sim.out.beta * 9, -1, 1),
    rpm: sim.rpm,
    flaps: sim.flapPos,
    g: sim.out.gload,
    fuelL: state.fuel[0], fuelR: state.fuel[1],
    oilT: 120 + Math.min(1, state.t / 120) * 60 + sim.rpm * 0.012,
    oilP: sim.rpm > 300 ? 55 + sim.rpm / 100 : 0,
    egt: 2 + ctl.throttle * 6,
    x: sim.pos[0], z: sim.pos[2],
    gs: gsMs * 1.94384,
    dist: Math.hypot(sim.pos[0] - WORLD.runway.x, sim.pos[2] - WORLD.runway.z) / 1000,
    time: Date.now(),
    hours: state.hours + state.t / 3600,
  };
}

function updateHud(st) {
  const agl = sim.pos[1] - Math.max(0, heightAt(sim.pos[0], sim.pos[2])) - 1.16;
  $('hIas').textContent = Math.round(st.kt);
  $('hAlt').textContent = Math.round(st.ft).toLocaleString('vi-VN');
  $('hAgl').textContent = Math.max(0, Math.round(agl * 3.28084)).toLocaleString('vi-VN');
  $('hVs').textContent = (st.fpm >= 0 ? '+' : '') + Math.round(st.fpm / 10) * 10;
  $('hHdg').textContent = String(Math.round(st.hdg) % 360).padStart(3, '0') + '°';
  $('hThr').textContent = Math.round(ctl.throttle * 100) + '%';
  $('hThrBar').style.height = ctl.throttle * 100 + '%';
  $('hFlap').textContent = SPEC.flapDeg[ctl.flaps] + '°';
  $('hTrim').textContent = (ctl.trim >= 0 ? '+' : '') + Math.round(ctl.trim * 100);
  $('hBrake').classList.toggle('on', ctl.brake > 0);
  $('stall').classList.toggle('show', sim.out.stall > 0.05 || (sim.out.alpha > 0.22 && !sim.onGround && sim.out.ias > 5));
  $('overspeed').classList.toggle('show', sim.out.ias > SPEC.vne);
}

let last = performance.now();
let frames = 0, fpsT = 0, slow = 0;
function frame(now) {
  requestAnimationFrame(frame);
  if (window.__flightManual) { last = now; return; }
  const dt = Math.min(0.05, (now - last) / 1000);
  last = now;
  state.dt = dt;
  if (!state.paused) step(dt);
  render(dt);
  frames++; fpsT += dt;
  if (fpsT > 2) { $('fps').textContent = Math.round(frames / fpsT) + ' fps'; if (frames / fpsT < 22) slow++; frames = 0; fpsT = 0; }
}

function step(dt) {
  state.t += dt;
  readControls(dt);
  const wasCrashed = sim.crashed;
  sim.step(dt, ctl);
  if (sim.crashed && !wasCrashed) {
    sound.crash();
    state.shake = 1.5;
    $('crashWhy').textContent = sim.crashed;
    $('crash').classList.add('show');
  }
  if (sim.out.touchdown > 0.6 && !sim.crashed) {
    sound.chirp(sim.out.touchdown);
    const fpm = Math.round(sim.out.touchdown * 196.85);
    const grade = fpm < 120 ? 'Êm như bơ!' : fpm < 300 ? 'Hạ cánh tốt' : fpm < 550 ? 'Hơi mạnh' : 'Hạ cánh rất mạnh';
    flash(`Chạm đất ${fpm} ft/phút — ${grade}`, 3.5);
    state.shake = Math.min(1, sim.out.touchdown / 4);
  }
  // nhiên liệu ~ 9 gallon/giờ ở toàn ga
  const burn = (0.3 + ctl.throttle * 0.7) * 9 / 3600 * dt / 2;
  state.fuel[0] = Math.max(0, state.fuel[0] - burn); state.fuel[1] = Math.max(0, state.fuel[1] - burn);
  syncActor();
  plane.animate(dt, ctl, sim.rpm, sim.flapPos, state.t);
  const st = panelState();
  if (state.view === 'cockpit') cockpit.update(dt, ctl, st);
  updateHud(st);
  airport.update(state.t, env.gust(state.t, sim.pos), sim.pos);
  sound.update({
    rpm: sim.crashed ? 0 : sim.rpm, throttle: ctl.throttle, speed: Math.hypot(...sim.vel),
    stallWarn: !sim.onGround && (sim.out.alpha > 0.21 || sim.out.stall > 0.05) && !sim.crashed,
    ground: sim.onGround && onRunway(sim.pos[0], sim.pos[2]) ? true : sim.onGround, inside: state.view === 'cockpit',
  });
  if (state.msgT > 0) { state.msgT -= dt; if (state.msgT <= 0) $('msg').classList.remove('show'); }
}

function render(dt, settle = false) {
  if (!sim) return;
  updateCamera(dt);
  if (settle) { world.prime(camera.position); }
  world.update(dt, camera, actor.position);
  renderer.shadowMap.needsUpdate = true;
  renderer.autoClear = true;
  if (state.view === 'cockpit') {
    // lượt 1: thế giới xa (mặt phẳng gần 1 m) — lượt 2: buồng lái, máy bay (mặt phẳng gần 5 cm)
    camera.layers.set(0);
    camera.near = 1; camera.far = 90000; camera.updateProjectionMatrix();
    renderer.render(scene, camera);
    renderer.autoClear = false;
    renderer.clearDepth();
    camera.layers.set(LAYER_NEAR);
    camera.near = 0.04; camera.far = 60; camera.updateProjectionMatrix();
    renderer.render(scene, camera);
    camera.layers.set(0);
  } else {
    camera.layers.set(0);
    camera.near = 0.5; camera.far = 90000; camera.updateProjectionMatrix();
    renderer.render(scene, camera);
  }
}

// ---------- Menu ----------
function setPaused(p) {
  if (!state.started) return;
  state.paused = p;
  $('menu').classList.toggle('show', p);
  $('resume').style.display = 'inline-flex';
  if (!p) sound.start();
}

function toggleSound() {
  sound.setOn(!sound.on);
  store.set('sound', sound.on ? '1' : '0');
  $('snd').textContent = sound.on ? '🔊' : '🔇';
}

function chips(id, options, current, onPick) {
  const el = $(id);
  el.innerHTML = '';
  for (const [key, label] of options) {
    const b = document.createElement('button');
    b.className = 'chip' + (key === current ? ' sel' : '');
    b.textContent = label;
    b.onclick = () => { for (const c of el.children) c.classList.remove('sel'); b.classList.add('sel'); onPick(key); };
    el.appendChild(b);
  }
}

function setupMenu() {
  chips('startPick', [['runway', 'Trên đường băng'], ['approach', 'Đang hạ cánh'], ['scenic', 'Bay ngắm núi']], prefs.start, (k) => { prefs.start = k; store.set('start', k); });
  chips('timePick', Object.entries(TIMES).map(([k, v]) => [k, v.label]), prefs.time, (k) => { prefs.time = k; store.set('time', k); });
  chips('qualPick', Object.entries(QUALITY).map(([k, v]) => [k, v.label]), prefs.quality, (k) => { prefs.quality = k; store.set('quality', k); });
  $('fly').onclick = () => {
    const needReload = world && (prefs.time !== world.timeKey || prefs.quality !== world.qualityKey);
    if (needReload) { location.search = ''; location.reload(); return; }
    sound.start();
    respawn(prefs.start);
    state.started = true;
    setPaused(false);
    $('help').classList.remove('hide');
    setTimeout(() => $('help').classList.add('hide'), 14000);
  };
  $('resume').onclick = () => setPaused(false);
  $('snd').onclick = toggleSound;
  $('snd').textContent = sound.on ? '🔊' : '🔇';
  $('again').onclick = () => respawn();
}

function resize() {
  renderer.setSize(innerWidth, innerHeight);
  camera.aspect = innerWidth / innerHeight;
  camera.updateProjectionMatrix();
}
addEventListener('resize', resize);

async function boot() {
  if (touch) document.body.classList.add('touch');
  setupMenu();
  const status = $('status');
  status.textContent = 'Đang dựng bầu trời…';
  await new Promise((r) => setTimeout(r, 30));
  world = new World(renderer, scene, prefs.quality, prefs.time);
  world.timeKey = prefs.time; world.qualityKey = prefs.quality;
  status.textContent = 'Đang dựng máy bay…';
  await new Promise((r) => setTimeout(r, 10));
  const model = makeAircraft();
  plane = model;
  actor.add(plane.group);
  cockpit = makeCockpit();
  plane.group.add(cockpit.group);
  airport = buildAirport(scene, (lv, reg) => { const p = makeAircraft({ main: lv[0], accent: lv[1], reg }); return p.group; });
  ctl = makeControls();
  sim = new Aircraft(env);
  respawn(prefs.start);
  applyView();
  status.textContent = 'Đang dựng địa hình…';
  await new Promise((r) => setTimeout(r, 10));
  updateCamera(0.016);
  world.prime(camera.position);
  setupTouch();
  status.textContent = '';
  $('fly').disabled = false;
  $('fly').textContent = 'Bắt đầu bay';
  requestAnimationFrame(frame);
  window.__flight = { sim, ctl, state, world, camera, renderer, respawn, cycleView, setPaused, step, render, applyView, keys };
}

boot().catch((e) => { $('status').textContent = 'Lỗi: ' + e.message; console.error(e); });

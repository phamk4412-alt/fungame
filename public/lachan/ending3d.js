// Lớp học 3D cho cảnh kết thúc (Three.js, chạy offline từ vendor/).
// Góc nhìn: từ bàn của Hoàng Nam (người chơi) nhìn ngang lớp về phía dãy cửa sổ.
//  - good: nắng vàng, Minh Anh ngồi cạnh cửa sổ, quay sang cười nói với các bạn.
//  - bad : trời âm u, mọi người nhìn lên bảng, chỗ ngồi của Minh Anh bỏ trống.
// Lớp học ở tầng trệt của một trường ven biển: ngoài cửa sổ là sân, đường ray, bãi cát và biển. Cửa sổ luôn đóng.
import * as THREE from './vendor/three.module.min.js';
import { EffectComposer } from './vendor/three-addons/EffectComposer.js';
import { RenderPass } from './vendor/three-addons/RenderPass.js';
import { ShaderPass } from './vendor/three-addons/ShaderPass.js';
import { UnrealBloomPass } from './vendor/three-addons/UnrealBloomPass.js';
import { OutputPass } from './vendor/three-addons/OutputPass.js';
import { RoomEnvironment } from './vendor/three-addons/RoomEnvironment.js';

/** Chỉnh màu cuối: ấm (có hậu) hoặc lạnh (buồn), tăng bão hòa nhẹ, viền tối quanh khung hình. */
const GradeShader = {
  uniforms: { tDiffuse: { value: null }, tint: { value: new THREE.Vector3(1, 1, 1) }, sat: { value: 1.1 }, vig: { value: 0.35 } },
  vertexShader: 'varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }',
  fragmentShader: `uniform sampler2D tDiffuse; uniform vec3 tint; uniform float sat; uniform float vig; varying vec2 vUv;
    void main(){
      vec4 c = texture2D(tDiffuse, vUv);
      float l = dot(c.rgb, vec3(0.299, 0.587, 0.114));
      vec3 col = mix(vec3(l), c.rgb, sat) * tint;
      col = (col - 0.5) * 1.1 + 0.5;
      vec2 d = vUv - 0.5;
      col *= 1.0 - vig * smoothstep(0.25, 0.85, length(d * vec2(1.25, 1.0)));
      gl_FragColor = vec4(col, c.a);
    }`,
};

const V = (x, y, z) => new THREE.Vector3(x, y, z);

/** Mặt (mesh) bóng đổ và nhận bóng. */
function mesh(geo, mat, cast = true, receive = true) {
  const m = new THREE.Mesh(geo, mat);
  m.castShadow = cast;
  m.receiveShadow = receive;
  return m;
}

function box(w, h, d, mat, x, y, z) {
  const m = mesh(new THREE.BoxGeometry(w, h, d), mat);
  m.position.set(x, y, z);
  return m;
}

/** Khối tròn dài nối hai điểm (tay, chân). */
function limb(a, b, r, mat) {
  const len = a.distanceTo(b);
  const m = mesh(new THREE.CapsuleGeometry(r, Math.max(0.001, len), 6, 12), mat);
  m.position.copy(a).add(b).multiplyScalar(0.5);
  m.quaternion.setFromUnitVectors(V(0, 1, 0), b.clone().sub(a).normalize());
  return m;
}

function canvasTex(w, h, draw) {
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  draw(c.getContext('2d'), w, h);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 4;
  return t;
}

// ---------- Vật liệu dùng chung ----------
function materials(good) {
  const wood = canvasTex(256, 256, (g, w, h) => {
    g.fillStyle = '#9a6a3f';
    g.fillRect(0, 0, w, h);
    for (let i = 0; i < 70; i++) {
      g.strokeStyle = `rgba(${60 + Math.random() * 40},${35 + Math.random() * 20},15,${0.15 + Math.random() * 0.2})`;
      g.lineWidth = 1 + Math.random() * 2;
      g.beginPath();
      const y = Math.random() * h;
      g.moveTo(0, y);
      g.bezierCurveTo(w * 0.3, y + Math.random() * 10 - 5, w * 0.7, y + Math.random() * 10 - 5, w, y);
      g.stroke();
    }
  });
  // Sàn gỗ ván dài màu mật ong (lớp học kiểu Nhật)
  const floor = canvasTex(512, 512, (g, w, h) => {
    const n = 8;
    for (let i = 0; i < n; i++) {
      const off = Math.random() * h;
      for (let j = -1; j < 2; j++) {
        const v = Math.random() * 18;
        g.fillStyle = `rgb(${200 + v},${158 + v},${108 + v})`;
        g.fillRect((i * w) / n, off + j * h * 0.75, w / n, h * 0.75);
        g.fillStyle = 'rgba(110,70,30,0.35)';
        g.fillRect((i * w) / n, off + j * h * 0.75, w / n, 2);
      }
      g.fillStyle = 'rgba(110,70,30,0.4)';
      g.fillRect((i * w) / n, 0, 2, h);
      for (let k = 0; k < 6; k++) {
        g.fillStyle = 'rgba(150,100,50,0.12)';
        g.fillRect((i * w) / n + 6 + Math.random() * (w / n - 12), 0, 1, h);
      }
    }
  });
  floor.wrapS = floor.wrapT = THREE.RepeatWrapping;
  floor.repeat.set(3, 4);
  return {
    wall: new THREE.MeshStandardMaterial({ color: good ? '#f7f1e3' : '#c9c6bd', roughness: 0.95 }),
    curtain: new THREE.MeshStandardMaterial({ color: good ? '#fffaf0' : '#d6d6d0', roughness: 0.9, side: THREE.DoubleSide }),
    wallLow: new THREE.MeshStandardMaterial({ color: good ? '#cfe3d4' : '#8a9a90', roughness: 0.8 }),
    floor: new THREE.MeshStandardMaterial({ map: floor, roughness: 0.4 }),
    ceiling: new THREE.MeshStandardMaterial({ color: '#f4f2ec', roughness: 1 }),
    desk: new THREE.MeshStandardMaterial({ map: wood, roughness: 0.45, color: '#c08a58' }),
    metal: new THREE.MeshStandardMaterial({ color: '#4a4f57', roughness: 0.4, metalness: 0.7 }),
    frame: new THREE.MeshStandardMaterial({ color: '#f5f5f2', roughness: 0.35, metalness: 0.2 }),
    glass: new THREE.MeshPhysicalMaterial({ color: '#dff1ff', roughness: 0.05, transmission: 0.9, transparent: true, opacity: 0.18, depthWrite: false }),
    paper: new THREE.MeshStandardMaterial({ color: '#fbfbf6', roughness: 0.9 }),
    shirt: new THREE.MeshStandardMaterial({ color: '#f7f8fb', roughness: 0.8 }),
    pants: new THREE.MeshStandardMaterial({ color: '#1f2a44', roughness: 0.85 }),
    shoe: new THREE.MeshStandardMaterial({ color: '#151515', roughness: 0.5 }),
    eyeW: new THREE.MeshStandardMaterial({ color: '#fbfbfb', roughness: 0.2 }),
    iris: new THREE.MeshStandardMaterial({ color: '#2a1a12', roughness: 0.15 }),
    dark: new THREE.MeshStandardMaterial({ color: '#2b1a1a', roughness: 0.6 }),
    teeth: new THREE.MeshStandardMaterial({ color: '#f4f1ea', roughness: 0.4 }),
    lips: new THREE.MeshStandardMaterial({ color: '#c46a6a', roughness: 0.5 }),
  };
}

// ---------- Người ----------
/**
 * Một học sinh ngồi trên ghế, mặt quay về +z của nhóm.
 * @param {object} o { skin, hair, style: 'short'|'long'|'bun'|'cap', girl, mood: 'happy'|'laugh'|'neutral', M }
 */
const SKINS = ['#eec7a6', '#e6b995', '#ddb08a', '#f3d2b6', '#d6a27c'];
const HAIRS = ['#141012', '#1c1411', '#120f10', '#2a1c15', '#1a1513'];
function hashName(n) {
  let h = 2166136261;
  for (let i = 0; i < n.length; i++) h = Math.imul(h ^ n.charCodeAt(i), 16777619);
  return h >>> 0;
}

function makePerson(o) {
  const M = o.M;
  const g = new THREE.Group();
  const skin = new THREE.MeshPhysicalMaterial({ color: o.skin, roughness: 0.55, sheen: 0.4, sheenColor: new THREE.Color('#ff9f8a'), sheenRoughness: 0.6 });
  const hairM = new THREE.MeshStandardMaterial({ color: o.hair, roughness: 0.55 });
  const lower = o.girl ? new THREE.MeshStandardMaterial({ color: '#23305a', roughness: 0.85 }) : M.pants;

  // Thân
  const torso = mesh(new THREE.CapsuleGeometry(0.14, 0.3, 10, 20), M.shirt);
  torso.scale.set(o.girl ? 1.0 : 1.12, 1, 0.68);
  torso.position.set(0, 0.74, -0.02);
  g.add(torso);
  const hips = mesh(new THREE.SphereGeometry(0.17, 16, 12), lower);
  hips.scale.set(1.05, 0.55, 0.9);
  hips.position.set(0, 0.5, 0);
  g.add(hips);
  // Cổ áo
  const collar = mesh(new THREE.TorusGeometry(0.06, 0.018, 8, 20), M.shirt);
  collar.rotation.x = Math.PI / 2;
  collar.position.set(0, 0.97, 0);
  g.add(collar);
  if (o.girl) {
    // Nơ đỏ trên cổ áo
    const bowM = new THREE.MeshStandardMaterial({ color: '#d8344f', roughness: 0.5 });
    [-1, 1].forEach((sd) => {
      const wing = mesh(new THREE.ConeGeometry(0.03, 0.06, 4), bowM, false, false);
      wing.rotation.z = sd * Math.PI / 2;
      wing.position.set(sd * 0.03, 0.935, 0.085);
      g.add(wing);
    });
    g.add(box(0.02, 0.02, 0.02, bowM, 0, 0.935, 0.09));
  }
  if (!o.girl) {
    const badge = box(0.04, 0.05, 0.01, new THREE.MeshStandardMaterial({ color: '#2c5bd6' }), -0.08, 0.85, 0.1);
    g.add(badge);
  }
  g.add(limb(V(0, 0.95, 0), V(0, 1.04, 0.01), 0.045, skin));

  // Tay: đặt lên bàn
  const sw = o.girl ? 0.165 : 0.18;
  const shL = V(sw, 0.92, -0.02);
  const shR = V(-sw, 0.92, -0.02);
  const elL = V(sw + 0.03, 0.73, 0.1);
  const elR = V(-sw - 0.03, 0.73, 0.1);
  const haL = V(0.09, 0.775, 0.33);
  const haR = V(-0.09, 0.775, 0.33);
  // tay áo ngắn + cánh tay
  const midL = shL.clone().lerp(elL, 0.55);
  const midR = shR.clone().lerp(elR, 0.55);
  g.add(limb(shL, midL, 0.05, M.shirt), limb(shR, midR, 0.05, M.shirt));
  g.add(limb(midL, elL, 0.036, skin), limb(midR, elR, 0.036, skin));
  g.add(limb(elL, haL, 0.03, skin), limb(elR, haR, 0.03, skin));
  [haL, haR].forEach((h) => {
    const hand = mesh(new THREE.SphereGeometry(0.036, 12, 10), skin);
    hand.scale.set(0.9, 0.5, 1.35);
    hand.position.copy(h);
    g.add(hand);
  });

  // Chân
  [0.09, -0.09].forEach((x) => {
    const hip = V(x, 0.5, 0.02);
    const knee = V(x, 0.52, 0.42);
    const ankle = V(x * 1.05, 0.08, 0.46);
    g.add(limb(hip, knee, 0.068, lower));
    g.add(limb(knee, ankle, o.girl ? 0.045 : 0.06, o.girl ? skin : lower));
    const shoe = box(0.09, 0.07, 0.22, M.shoe, x * 1.05, 0.035, 0.52);
    g.add(shoe);
  });

  // Đầu
  const head = new THREE.Group();
  head.position.set(0, 1.17, 0.01);
  head.scale.setScalar(1.22); // đầu to hơn một chút: trông dễ thương
  g.add(head);
  const skull = mesh(new THREE.SphereGeometry(0.1, 32, 24), skin);
  skull.scale.set(0.96, 1.05, 1.0);
  head.add(skull);
  const jaw = mesh(new THREE.SphereGeometry(0.07, 24, 16), skin);
  jaw.scale.set(1.05, 0.85, 0.95);
  jaw.position.set(0, -0.035, 0.018);
  head.add(jaw);
  const nose = mesh(new THREE.SphereGeometry(0.009, 10, 8), skin);
  nose.position.set(0, -0.012, 0.099);
  head.add(nose);
  [0.09, -0.09].forEach((x) => {
    const ear = mesh(new THREE.SphereGeometry(0.022, 10, 8), skin);
    ear.scale.set(0.5, 1, 0.8);
    ear.position.set(x, 0.0, 0.0);
    head.add(ear);
  });

  const laughing = o.mood === 'laugh';
  const happy = laughing || o.mood === 'happy';
  // Mắt to kiểu hoạt hình: dẹt sát mặt, có đốm sáng, không lồi ra ngoài
  [0.036, -0.036].forEach((x) => {
    const tilt = x > 0 ? 0.36 : -0.36;
    if (laughing) {
      // mắt cười híp: vòng cung ^ ^
      const arc = mesh(new THREE.TorusGeometry(0.016, 0.004, 6, 14, Math.PI), M.dark, false, false);
      arc.position.set(x, 0.012, 0.093);
      arc.rotation.y = tilt;
      head.add(arc);
    } else {
      const ir = mesh(new THREE.SphereGeometry(0.019, 18, 14), M.iris, false, false);
      ir.scale.set(0.82, 1.08, 0.28);
      ir.position.set(x, 0.008, 0.0905);
      ir.rotation.y = tilt;
      head.add(ir);
      const hi = mesh(new THREE.SphereGeometry(0.0055, 10, 8), M.eyeW, false, false);
      hi.scale.set(1, 1, 0.4);
      hi.position.set(x + 0.005, 0.016, 0.0955);
      head.add(hi);
      const hi2 = mesh(new THREE.SphereGeometry(0.0028, 8, 6), M.eyeW, false, false);
      hi2.position.set(x - 0.004, -0.001, 0.0955);
      head.add(hi2);
      if (o.girl) {
        const lash = mesh(new THREE.TorusGeometry(0.017, 0.0026, 6, 12, Math.PI * 0.8), M.dark, false, false);
        lash.position.set(x, 0.011, 0.0925);
        lash.rotation.set(0, tilt, Math.PI * 0.1);
        head.add(lash);
      }
    }
    const brow = mesh(new THREE.CapsuleGeometry(0.003, 0.022, 4, 8), hairM, false, false);
    brow.rotation.z = Math.PI / 2 + (x > 0 ? (happy ? -0.18 : -0.06) : (happy ? 0.18 : 0.06));
    brow.position.set(x, 0.05 + (happy ? 0.004 : 0), 0.084);
    head.add(brow);
    // má hồng (lúc nào cũng có, vui thì đậm hơn)
    const blush = mesh(new THREE.SphereGeometry(0.016, 12, 8), new THREE.MeshStandardMaterial({ color: '#ff7f8f', transparent: true, opacity: happy ? 0.55 : 0.3, depthWrite: false }), false, false);
    blush.scale.set(1.3, 0.75, 0.25);
    blush.position.set(x * 1.5, -0.022, 0.082);
    blush.rotation.y = tilt * 1.6;
    head.add(blush);
  });
  // Miệng nhỏ
  if (laughing) {
    const m = mesh(new THREE.CircleGeometry(0.017, 20, Math.PI, Math.PI), new THREE.MeshStandardMaterial({ color: '#7a2433', roughness: 0.6 }), false, false);
    m.scale.set(1.15, 1, 1);
    m.position.set(0, -0.034, 0.0952);
    head.add(m);
  } else {
    const smile = mesh(new THREE.TorusGeometry(happy ? 0.014 : 0.01, 0.0032, 6, 14, happy ? Math.PI : 0.9), M.lips, false, false);
    smile.rotation.z = happy ? Math.PI : Math.PI + (Math.PI - 0.9) / 2;
    smile.position.set(0, happy ? -0.03 : -0.038, 0.096);
    head.add(smile);
  }

  // Tóc
  const cap = mesh(new THREE.SphereGeometry(0.108, 32, 20, 0, Math.PI * 2, 0, Math.PI * 0.43), hairM);
  cap.scale.set(0.96, 1.12, 1.06);
  cap.position.set(0, 0.014, -0.012);
  cap.rotation.x = -0.32; // trước cao, sau thấp: lộ trán và mắt
  head.add(cap);
  const back = mesh(new THREE.SphereGeometry(0.104, 24, 16), hairM);
  back.scale.set(0.95, 1.0, 0.72);
  back.position.set(0, 0.0, -0.038);
  head.add(back);
  const fringe = mesh(new THREE.SphereGeometry(0.1, 24, 12, -Math.PI * 0.32, Math.PI * 0.64, Math.PI * 0.16, Math.PI * 0.16), hairM);
  fringe.scale.set(0.98, 1.08, 1.1);
  fringe.position.set(0, 0.02, 0.004);
  head.add(fringe);
  if (o.style === 'long') {
    const fall = mesh(new THREE.CapsuleGeometry(0.07, 0.2, 8, 16), hairM);
    fall.scale.set(1.25, 1, 0.45);
    fall.position.set(0, -0.13, -0.075);
    head.add(fall);
  } else if (o.style === 'bun') {
    const bun = mesh(new THREE.SphereGeometry(0.045, 16, 12), hairM);
    bun.position.set(0, 0.1, -0.07);
    head.add(bun);
  } else if (o.style === 'cap') {
    const sides = mesh(new THREE.SphereGeometry(0.104, 24, 16, 0, Math.PI * 2, Math.PI * 0.35, Math.PI * 0.25), hairM);
    head.add(sides);
  }
  if (o.clip) {
    const clip = box(0.035, 0.012, 0.012, new THREE.MeshStandardMaterial({ color: '#ff6fa3', roughness: 0.3 }), 0.05, 0.085, 0.07);
    clip.rotation.z = -0.4;
    head.add(clip);
  }

  g.userData = { head, torso, phase: Math.random() * 6.28, laughing };
  return g;
}

// ---------- Bàn ghế ----------
function makeDesk(M, withBook, plain) {
  const g = new THREE.Group();
  g.add(box(1.2, 0.04, 0.5, M.desk, 0, 0.74, 0));
  g.add(box(1.16, 0.3, 0.02, M.desk, 0, 0.58, -0.24)); // tấm chắn phía bảng, chân để dưới gầm
  [[-0.56, -0.22], [0.56, -0.22], [-0.56, 0.22], [0.56, 0.22]].forEach(([x, z]) => g.add(box(0.035, 0.72, 0.035, M.metal, x, 0.36, z)));
  const pick = (a) => a[Math.floor(Math.random() * a.length)];
  if (!plain && Math.random() < 0.6) {
    // hộp bút
    const pc = mesh(new THREE.CapsuleGeometry(0.03, 0.14, 4, 10), new THREE.MeshStandardMaterial({ color: pick(['#ff9eb5', '#7ec8ff', '#ffd36e', '#9be3a7', '#c7a6ff']), roughness: 0.6 }));
    pc.rotation.set(0, Math.random() - 0.5, Math.PI / 2);
    pc.position.set(Math.random() < 0.5 ? -0.05 : 0.45, 0.79, -0.15);
    g.add(pc);
  }
  if (!plain && Math.random() < 0.35) {
    // chai nước
    const bt = mesh(new THREE.CylinderGeometry(0.028, 0.03, 0.18, 14), new THREE.MeshPhysicalMaterial({ color: pick(['#bfe8ff', '#ffe0ef', '#e2ffe0']), roughness: 0.1, transmission: 0.6, transparent: true, opacity: 0.85 }));
    bt.position.set(Math.random() < 0.5 ? -0.5 : 0.52, 0.85, -0.18);
    g.add(bt);
  }
  if (withBook) {
    const book = box(0.22, 0.015, 0.3, M.paper, -0.25, 0.768, -0.02);
    book.rotation.y = 0.15;
    g.add(book);
    const cover = box(0.22, 0.012, 0.3, new THREE.MeshStandardMaterial({ color: pick(['#3c7be0', '#e5566b', '#2fae8a', '#f0a83a', '#8a63d2']), roughness: 0.5 }), 0.27, 0.766, 0.0);
    cover.rotation.y = -0.1;
    g.add(cover);
  }
  return g;
}

function makeChair(M) {
  const g = new THREE.Group();
  g.add(box(0.42, 0.035, 0.4, M.desk, 0, 0.45, 0));
  g.add(box(0.42, 0.28, 0.025, M.desk, 0, 0.72, -0.2));
  [[-0.18, -0.17], [0.18, -0.17], [-0.18, 0.17], [0.18, 0.17]].forEach(([x, z]) => g.add(box(0.03, 0.45, 0.03, M.metal, x, 0.225, z)));
  g.add(box(0.03, 0.3, 0.03, M.metal, -0.18, 0.6, -0.2), box(0.03, 0.3, 0.03, M.metal, 0.18, 0.6, -0.2));
  return g;
}

// ---------- Phòng học ----------
const ROOM = { x0: -4, x1: 4, z0: -5, z1: 5, h: 3.2 };

function buildRoom(scene, M, good, board) {
  const { x0, x1, z0, z1, h } = ROOM;
  const floor = mesh(new THREE.PlaneGeometry(x1 - x0, z1 - z0), M.floor, false, true);
  floor.rotation.x = -Math.PI / 2;
  scene.add(floor);
  const ceil = mesh(new THREE.PlaneGeometry(x1 - x0, z1 - z0), M.ceiling, false, false);
  ceil.rotation.x = Math.PI / 2;
  ceil.position.y = h;
  scene.add(ceil);
  // Tường sau, trước, phải
  scene.add(box(x1 - x0, h, 0.1, M.wall, 0, h / 2, z1));
  scene.add(box(x1 - x0, h, 0.1, M.wall, 0, h / 2, z0));
  scene.add(box(0.1, h, z1 - z0, M.wall, x1, h / 2, 0));
  scene.add(box(0.12, 1.0, z1 - z0, M.wallLow, x1 - 0.06, 0.5, 0));
  // Đèn trần
  for (const z of [-2.5, 0.5, 3.2]) {
    for (const x of [-1.6, 1.6]) {
      const lamp = box(1.2, 0.04, 0.2, new THREE.MeshStandardMaterial({ color: '#fff', emissive: good ? '#fff7e0' : '#e8f0ff', emissiveIntensity: good ? 0.9 : 0.6 }), x, h - 0.03, z);
      lamp.castShadow = false;
      scene.add(lamp);
    }
  }
  // Bảng đen ở tường trước, có dòng sĩ số
  const boardTex = canvasTex(1024, 384, (g2, w, hh) => {
    g2.fillStyle = '#1f3d2f';
    g2.fillRect(0, 0, w, hh);
    g2.fillStyle = 'rgba(255,255,255,0.05)';
    for (let i = 0; i < 40; i++) g2.fillRect(Math.random() * w, Math.random() * hh, 120, 2);
    g2.fillStyle = '#f1f6ef';
    g2.font = '600 70px "Segoe UI", sans-serif';
    g2.textAlign = 'center';
    g2.fillText('Thứ Hai', w / 2, 140);
    g2.font = '400 56px "Segoe UI", sans-serif';
    g2.fillText(board, w / 2, 250);
  });
  const boardM = mesh(new THREE.PlaneGeometry(3.2, 1.2), new THREE.MeshStandardMaterial({ map: boardTex, roughness: 0.9 }), false, true);
  boardM.position.set(0.4, 1.75, z0 + 0.06);
  scene.add(boardM);
  scene.add(box(3.4, 0.08, 0.1, M.desk, 0.4, 1.1, z0 + 0.08));
  // Tranh, thời khóa biểu trên tường sau
  const poster = canvasTex(256, 340, (g2, w, hh) => {
    g2.fillStyle = good ? '#ffe7a8' : '#d9d5c8';
    g2.fillRect(0, 0, w, hh);
    g2.fillStyle = '#c0392b';
    g2.font = '700 30px sans-serif';
    g2.textAlign = 'center';
    g2.fillText('NỘI QUY', w / 2, 50);
    g2.fillStyle = '#555';
    for (let i = 0; i < 8; i++) g2.fillRect(30, 80 + i * 30, w - 60 - (i % 3) * 30, 8);
  });
  const p = mesh(new THREE.PlaneGeometry(0.7, 0.95), new THREE.MeshStandardMaterial({ map: poster }), false, true);
  p.position.set(x1 - 0.06, 1.8, -1.5);
  p.rotation.y = -Math.PI / 2;
  scene.add(p);

  // Tường cửa sổ (x = x0): 3 cửa sổ lớn, luôn đóng
  const wins = [-2.6, 0.2, 3.0];
  const ww = 1.9;
  const wy0 = 0.72;
  const wy1 = 2.55;
  scene.add(box(0.15, wy0, z1 - z0, M.wall, x0, wy0 / 2, 0));
  scene.add(box(0.15, h - wy1, z1 - z0, M.wall, x0, (wy1 + h) / 2, 0));
  scene.add(box(0.16, 0.68, z1 - z0, M.wallLow, x0 + 0.01, 0.34, 0));
  let zPrev = z0;
  wins.forEach((zc) => {
    const a = zc - ww / 2;
    scene.add(box(0.15, wy1 - wy0, a - zPrev, M.wall, x0, (wy0 + wy1) / 2, (a + zPrev) / 2));
    zPrev = zc + ww / 2;
    // Khung nhôm + kính
    const fz = [a, a + ww / 3, a + (2 * ww) / 3, a + ww];
    fz.forEach((z) => scene.add(box(0.08, wy1 - wy0, 0.05, M.frame, x0, (wy0 + wy1) / 2, z)));
    [wy0, (wy0 + wy1) / 2 + 0.2, wy1].forEach((y) => scene.add(box(0.08, 0.05, ww, M.frame, x0, y, zc)));
    const glass = new THREE.Mesh(new THREE.PlaneGeometry(ww, wy1 - wy0), M.glass);
    glass.rotation.y = Math.PI / 2;
    glass.position.set(x0, (wy0 + wy1) / 2, zc);
    scene.add(glass);
    // Bậu cửa
    scene.add(box(0.3, 0.04, ww + 0.1, M.frame, x0 + 0.1, wy0 - 0.01, zc));
    // Rèm trắng buộc gọn hai bên cửa sổ
    [a + 0.14, a + ww - 0.14].forEach((cz) => {
      for (let f = 0; f < 4; f++) {
        const fold = mesh(new THREE.CylinderGeometry(0.045, 0.06 + (f % 2) * 0.015, wy1 - wy0 + 0.5, 10, 1, true), M.curtain, true, true);
        fold.position.set(x0 + 0.14 + (f % 2) * 0.03, (wy0 + wy1) / 2 + 0.1, cz + (f - 1.5) * 0.06);
        fold.userData.sway = Math.random() * 6.28;
        scene.add(fold);
      }
      const tie = mesh(new THREE.TorusGeometry(0.12, 0.015, 6, 16), new THREE.MeshStandardMaterial({ color: good ? '#e9b8b8' : '#999' }));
      tie.rotation.x = Math.PI / 2;
      tie.position.set(x0 + 0.15, 1.45, cz);
      scene.add(tie);
    });
  });
  // Cảnh buồn: rèm kéo kín, lớp tối và lặng, không nhìn ra ngoài
  if (!good) {
    const closed = new THREE.MeshStandardMaterial({ color: '#c9cbc6', roughness: 1, transparent: true, opacity: 0.94, side: THREE.DoubleSide });
    wins.forEach((zc) => {
      for (let f = 0; f < 10; f++) {
        const fold = mesh(new THREE.CylinderGeometry(0.11, 0.11, wy1 - wy0 + 0.5, 12, 1, true, Math.PI, Math.PI), closed, false, true);
        fold.position.set(x0 + 0.22, (wy0 + wy1) / 2 + 0.1, zc - ww / 2 + 0.1 + f * (ww - 0.2) / 9);
        fold.scale.set(0.35, 1, 1);
        scene.add(fold);
      }
    });
  }
  // Thanh treo rèm
  scene.add(box(0.04, 0.04, z1 - z0, M.frame, x0 + 0.16, wy1 + 0.25, 0));
  scene.add(box(0.15, wy1 - wy0, z1 - zPrev, M.wall, x0, (wy0 + wy1) / 2, (z1 + zPrev) / 2));
  // Quạt trần
  const fanM = new THREE.MeshStandardMaterial({ color: '#f2f2ee', roughness: 0.4, metalness: 0.2 });
  [[-1.6, -1.0], [1.6, -1.0], [-1.6, 2.2], [1.6, 2.2]].forEach(([fx, fz]) => {
    scene.add(box(0.03, 0.4, 0.03, M.metal, fx, h - 0.2, fz));
    const hub = new THREE.Group();
    hub.position.set(fx, h - 0.42, fz);
    hub.add(mesh(new THREE.CylinderGeometry(0.09, 0.11, 0.1, 16), fanM));
    for (let b = 0; b < 3; b++) {
      const blade = box(0.62, 0.012, 0.11, fanM, 0.36, 0, 0);
      const arm = new THREE.Group();
      arm.rotation.y = (b * Math.PI * 2) / 3;
      arm.add(blade);
      hub.add(arm);
    }
    hub.userData.spin = good ? 6 : 2.5;
    scene.add(hub);
  });
  // Đồng hồ treo tường giữa hai cửa sổ
  const clockTex = canvasTex(256, 256, (g2, w) => {
    g2.fillStyle = '#fff'; g2.beginPath(); g2.arc(w / 2, w / 2, w / 2 - 6, 0, Math.PI * 2); g2.fill();
    g2.lineWidth = 10; g2.strokeStyle = '#3a3a3a'; g2.stroke();
    g2.fillStyle = '#333';
    for (let i = 0; i < 12; i++) { const a = (i / 12) * Math.PI * 2; g2.fillRect(w / 2 + Math.sin(a) * 100 - 4, w / 2 - Math.cos(a) * 100 - 4, 8, 8); }
    g2.lineCap = 'round'; g2.lineWidth = 9;
    g2.beginPath(); g2.moveTo(w / 2, w / 2); g2.lineTo(w / 2 + 40, w / 2 - 40); g2.stroke();
    g2.lineWidth = 6; g2.beginPath(); g2.moveTo(w / 2, w / 2); g2.lineTo(w / 2, w / 2 - 85); g2.stroke();
  });
  const clk = mesh(new THREE.CircleGeometry(0.2, 32), new THREE.MeshStandardMaterial({ map: clockTex, roughness: 0.4 }), false, false);
  clk.rotation.y = Math.PI / 2;
  clk.position.set(x0 + 0.09, 2.15, -1.2);
  scene.add(clk);
  // Chậu cây trên bậu cửa sổ
  const potM = new THREE.MeshStandardMaterial({ color: '#c8734a', roughness: 0.8 });
  const leafPot = new THREE.MeshStandardMaterial({ color: good ? '#4fae5a' : '#4a6b50', roughness: 0.7 });
  [wins[0] + 0.55, wins[1] - 0.6, wins[2] + 0.4].forEach((pz) => {
    const pot = mesh(new THREE.CylinderGeometry(0.08, 0.06, 0.13, 14), potM);
    pot.position.set(x0 + 0.13, wy0 + 0.075, pz);
    scene.add(pot);
    for (let i = 0; i < 7; i++) {
      const leaf = mesh(new THREE.SphereGeometry(0.05, 8, 6), leafPot);
      leaf.scale.set(0.5, 1.4, 0.3);
      const a = (i / 7) * Math.PI * 2;
      leaf.position.set(x0 + 0.13 + Math.cos(a) * 0.05, wy0 + 0.2 + Math.random() * 0.05, pz + Math.sin(a) * 0.05);
      leaf.rotation.set(Math.sin(a) * 0.6, 0, -Math.cos(a) * 0.6);
      scene.add(leaf);
    }
  });
  return wins;
}

/** Bên ngoài cửa sổ: trường ven biển kiểu Shichirigahama. Sân, đường ray tàu nhỏ, bãi cát, biển, đảo, núi xa. */
function buildOutside(scene, good) {
  // Trời: dải màu + mây tích vẽ tay kiểu anime
  const sky = canvasTex(1024, 512, (g, w, h) => {
    const gr = g.createLinearGradient(0, 0, 0, h);
    if (good) { gr.addColorStop(0, '#2f86f0'); gr.addColorStop(0.55, '#8cc8ff'); gr.addColorStop(0.82, '#d9efff'); gr.addColorStop(1, '#fff6e2'); }
    else { gr.addColorStop(0, '#6f7a88'); gr.addColorStop(0.7, '#a3abb5'); gr.addColorStop(1, '#c1c6cb'); }
    g.fillStyle = gr;
    g.fillRect(0, 0, w, h);
    const cloud = (cx, cy, sz, n) => {
      for (let i = 0; i < n; i++) {
        const x = cx + (Math.random() - 0.5) * sz * 2.4;
        const y = cy - Math.random() * sz * 0.9;
        const r = sz * (0.35 + Math.random() * 0.45);
        // bóng mây phía dưới
        g.fillStyle = good ? 'rgba(196,214,240,0.9)' : 'rgba(140,148,160,0.8)';
        g.beginPath(); g.arc(x, y + r * 0.25, r, 0, Math.PI * 2); g.fill();
      }
      for (let i = 0; i < n; i++) {
        const x = cx + (Math.random() - 0.5) * sz * 2.2;
        const y = cy - Math.random() * sz * 1.0 - sz * 0.1;
        const r = sz * (0.3 + Math.random() * 0.4);
        g.fillStyle = good ? 'rgba(255,255,255,0.96)' : 'rgba(176,182,190,0.9)';
        g.beginPath(); g.arc(x, y, r, 0, Math.PI * 2); g.fill();
      }
    };
    if (good) {
      cloud(160, 452, 34, 10);
      cloud(560, 448, 44, 12);
      cloud(880, 455, 28, 8);
      g.fillStyle = 'rgba(255,255,255,0.55)';
      for (let i = 0; i < 6; i++) { g.beginPath(); g.ellipse(Math.random() * w, 80 + Math.random() * 150, 60 + Math.random() * 60, 6, 0, 0, Math.PI * 2); g.fill(); }
    } else {
      for (let i = 0; i < 10; i++) cloud(Math.random() * w, 120 + Math.random() * 300, 90, 12);
    }
  });
  sky.wrapS = THREE.RepeatWrapping;
  const skyM = new THREE.Mesh(new THREE.PlaneGeometry(420, 120), new THREE.MeshBasicMaterial({ map: sky, fog: false }));
  skyM.position.set(-150, 38, -20);
  skyM.rotation.y = Math.PI / 2;
  scene.add(skyM);

  // Biển: xa xanh thẫm, gần xanh ngọc, có vệt sóng lấp lánh
  const seaTex = canvasTex(1024, 512, (g, w, h) => {
    const gr = g.createLinearGradient(0, 0, w, 0);
    if (good) { gr.addColorStop(0, '#2c6fb8'); gr.addColorStop(0.7, '#2f9fc7'); gr.addColorStop(1, '#5fd0cf'); }
    else { gr.addColorStop(0, '#4b5c6c'); gr.addColorStop(1, '#6d8088'); }
    g.fillStyle = gr;
    g.fillRect(0, 0, w, h);
    for (let i = 0; i < 900; i++) {
      const x = Math.random() * w;
      g.fillStyle = good ? `rgba(255,255,255,${0.25 + Math.random() * 0.5})` : 'rgba(220,225,230,0.25)';
      g.fillRect(x, Math.random() * h, 1, 2 + (x / w) * 12);
    }
  });
  seaTex.wrapS = seaTex.wrapT = THREE.RepeatWrapping;
  const sea = mesh(new THREE.PlaneGeometry(260, 400), new THREE.MeshStandardMaterial({ map: seaTex, roughness: 0.25, metalness: 0.1 }), false, false);
  sea.rotation.set(-Math.PI / 2, 0, -Math.PI / 2);
  sea.position.set(-145, -0.6, -20);
  scene.add(sea);
  // Bãi cát và sóng vỗ bờ
  const sand = mesh(new THREE.PlaneGeometry(6, 400), new THREE.MeshStandardMaterial({ color: good ? '#e8d3a6' : '#a9a08e', roughness: 1 }), false, true);
  sand.rotation.x = -Math.PI / 2;
  sand.position.set(-15, -0.4, -20);
  scene.add(sand);
  const foam = mesh(new THREE.PlaneGeometry(0.6, 400), new THREE.MeshBasicMaterial({ color: good ? '#ffffff' : '#c9cdd0', transparent: true, opacity: 0.8 }), false, false);
  foam.rotation.x = -Math.PI / 2;
  foam.position.set(-18.1, -0.55, -20);
  scene.add(foam);

  // Sân trường ngay dưới cửa sổ, đường ven biển và đường ray tàu nhỏ
  const yard = mesh(new THREE.PlaneGeometry(4, 400), new THREE.MeshStandardMaterial({ color: good ? '#9ccc72' : '#70885f', roughness: 1 }), false, true);
  yard.rotation.x = -Math.PI / 2;
  yard.position.set(-6, -0.01, -20);
  scene.add(yard);
  const road = mesh(new THREE.PlaneGeometry(5, 400), new THREE.MeshStandardMaterial({ color: good ? '#8c9097' : '#6c7075', roughness: 0.9 }), false, true);
  road.rotation.x = -Math.PI / 2;
  road.position.set(-10.5, -0.2, -20);
  scene.add(road);
  const railM = new THREE.MeshStandardMaterial({ color: '#6b6f75', roughness: 0.4, metalness: 0.6 });
  const sleeperM = new THREE.MeshStandardMaterial({ color: '#5a4a3a', roughness: 1 });
  for (const rx of [-8.9, -9.9]) scene.add(box(0.06, 0.06, 200, railM, rx, -0.14, -20));
  for (let z = -60; z < 30; z += 0.7) scene.add(box(1.5, 0.05, 0.18, sleeperM, -9.4, -0.18, z));
  // Lan can trắng dọc bờ biển
  const railW = new THREE.MeshStandardMaterial({ color: '#f4f4f0', roughness: 0.5 });
  scene.add(box(0.06, 0.06, 200, railW, -12.9, 0.55, -20));
  for (let z = -60; z < 30; z += 1.6) scene.add(box(0.06, 0.8, 0.06, railW, -12.9, 0.18, z));
  // Biển báo chắn tàu
  const post = box(0.08, 2.4, 0.08, railW, -8.3, 1.0, -6.5);
  scene.add(post);
  const sign = canvasTex(128, 128, (g, w, h) => {
    g.fillStyle = '#f5c400'; g.fillRect(0, 0, w, h);
    g.fillStyle = '#111';
    for (let i = -4; i < 8; i++) { g.beginPath(); g.moveTo(i * 24, 0); g.lineTo(i * 24 + 12, 0); g.lineTo(i * 24 + 12 + h, h); g.lineTo(i * 24 + h, h); g.fill(); }
  });
  const x1 = mesh(new THREE.PlaneGeometry(1.1, 0.18), new THREE.MeshStandardMaterial({ map: sign, side: THREE.DoubleSide }), false, false);
  x1.position.set(-8.25, 1.9, -6.5); x1.rotation.set(0, Math.PI / 2, 0.6);
  const x2 = x1.clone(); x2.rotation.z = -0.6;
  scene.add(x1, x2);
  const lampM = new THREE.MeshStandardMaterial({ color: '#d33', emissive: good ? '#300' : '#000' });
  [-0.22, 0.22].forEach((dz) => { const l = mesh(new THREE.SphereGeometry(0.09, 12, 8), lampM); l.position.set(-8.24, 1.5, -6.5 + dz); scene.add(l); });

  // Bồn cây thấp dưới cửa sổ
  const bushM = new THREE.MeshStandardMaterial({ color: good ? '#5aa64f' : '#47684a', roughness: 0.9 });
  for (let z = -5; z <= 5; z += 0.7) {
    const bsh = mesh(new THREE.IcosahedronGeometry(0.4, 1), bushM);
    bsh.position.set(-4.6, 0.3, z + Math.random() * 0.2);
    scene.add(bsh);
  }
  // Hai cây ở hai bên khung cảnh, không che biển
  const trunkM = new THREE.MeshStandardMaterial({ color: '#6b4a2f', roughness: 1 });
  const leafM = [good ? '#5fae4f' : '#4d7350', good ? '#82c862' : '#5b7f5b'].map((c) => new THREE.MeshStandardMaterial({ color: c, roughness: 0.95 }));
  [[-6.5, -7.5], [-6.8, 8.5]].forEach(([x, z], i) => {
    const t = mesh(new THREE.CylinderGeometry(0.16, 0.26, 3.6, 10), trunkM);
    t.position.set(x, 1.8, z);
    scene.add(t);
    for (let k2 = 0; k2 < 6; k2++) {
      const l = mesh(new THREE.IcosahedronGeometry(1 + Math.random() * 0.5, 1), leafM[(i + k2) % 2]);
      l.position.set(x + Math.random() * 2 - 1, 3.8 + Math.random() * 1.2, z + Math.random() * 2 - 1);
      scene.add(l);
    }
  });

  // Hòn đảo xanh ngoài khơi, có ngọn tháp nhỏ
  const isleM = new THREE.MeshStandardMaterial({ color: good ? '#4f8f5a' : '#56675c', roughness: 1 });
  const isle = mesh(new THREE.SphereGeometry(9, 24, 12, 0, Math.PI * 2, 0, Math.PI / 2), isleM, false, false);
  isle.scale.set(1, 0.42, 1.5);
  isle.position.set(-80, -0.6, -24);
  scene.add(isle);
  const tower = mesh(new THREE.CylinderGeometry(0.35, 0.6, 4.2, 10), new THREE.MeshStandardMaterial({ color: '#e9ece8', roughness: 0.6 }), false, false);
  tower.position.set(-80, 5.3, -23);
  scene.add(tower);
  // Núi xa (có tuyết trên đỉnh khi trời trong)
  if (good) {
    const fujiM = new THREE.MeshBasicMaterial({ color: '#8fa9d0', fog: false });
    const fuji = new THREE.Mesh(new THREE.ConeGeometry(30, 15, 40, 1, true), fujiM);
    fuji.position.set(-200, 6.5, -45);
    scene.add(fuji);
    const snow = new THREE.Mesh(new THREE.ConeGeometry(9.2, 4.6, 40), new THREE.MeshBasicMaterial({ color: '#f4f8ff', fog: false }));
    snow.position.set(-200, 11.7, -45);
    scene.add(snow);
  }
  // Mũi đất xa bên phải
  const cape = mesh(new THREE.SphereGeometry(20, 20, 10, 0, Math.PI * 2, 0, Math.PI / 2), new THREE.MeshStandardMaterial({ color: good ? '#5d8f6a' : '#5b6860', roughness: 1 }), false, false);
  cape.scale.set(1.2, 0.3, 2.2);
  cape.position.set(-70, -0.6, 80);
  scene.add(cape);
  return { sky, seaTex };
}

/**
 * Dựng lớp học 3D trong `container`.
 * @param {HTMLElement} container
 * @param {{good: boolean, D: object, avatarFor: (name:string)=>object, board: string}} o
 * @returns {{track: Function, focus: Function, dispose: Function}|null} null nếu máy không có WebGL
 */
function mount(container, o) {
  let renderer;
  try {
    renderer = new THREE.WebGLRenderer({ antialias: true });
  } catch (e) {
    return null;
  }
  const good = !!o.good;
  const D = o.D;
  const victim = D.characters.victim;
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.5));
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = good ? 1.05 : 0.8;
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  container.appendChild(renderer.domElement);
  renderer.domElement.className = 'lce-3d';

  const scene = new THREE.Scene();
  scene.background = new THREE.Color(good ? '#cfe6ff' : '#9aa3ab');
  scene.fog = new THREE.Fog(good ? '#d9efff' : '#b0b7bd', 30, 260);
  const M = materials(good);
  const wins = buildRoom(scene, M, good, o.board);
  const outside = buildOutside(scene, good);

  // Ánh sáng
  // Ánh sáng môi trường mềm cho phản chiếu trên bàn gỗ, sàn, chai nước
  const pmrem = new THREE.PMREMGenerator(renderer);
  const envTex = pmrem.fromScene(new RoomEnvironment(renderer), 0.04).texture;
  scene.environment = envTex;
  scene.add(new THREE.HemisphereLight(good ? '#fff4dc' : '#dfe6ee', good ? '#8a6a4a' : '#4c4f55', good ? 0.9 : 0.7));
  scene.add(new THREE.AmbientLight(good ? '#fff3e0' : '#d5dbe3', good ? 0.35 : 0.3));
  // Ánh sáng dịu từ cửa sổ rọi vào chỗ ngồi của Minh Anh
  const winLight = new THREE.SpotLight(good ? '#ffe4b0' : '#dfe7f0', good ? 14 : 8, 8, 0.5, 0.8, 1.2);
  winLight.position.set(-3.8, 2.4, -0.2);
  winLight.target.position.set(-2.7, 0.6, -0.2);
  scene.add(winLight, winLight.target);
  const sun = new THREE.DirectionalLight(good ? '#ffd9a0' : '#cfd8e2', good ? 3.2 : 0.9);
  sun.position.set(-14, 9, 4);
  sun.target.position.set(-1, 0, 0);
  sun.castShadow = true;
  sun.shadow.mapSize.set(1024, 1024);
  sun.shadow.camera.left = -7; sun.shadow.camera.right = 7; sun.shadow.camera.top = 7; sun.shadow.camera.bottom = -7;
  sun.shadow.camera.near = 1; sun.shadow.camera.far = 40;
  sun.shadow.bias = -0.0005;
  sun.shadow.normalBias = 0.02;
  scene.add(sun, sun.target);
  const fill = new THREE.PointLight(good ? '#fff1d6' : '#e6ecf5', good ? 6 : 4, 12, 1.6);
  fill.position.set(1.5, 2.9, 1.5);
  scene.add(fill);
  // Vệt nắng xuyên cửa sổ (cảnh có hậu)
  if (good) {
    const beamM = new THREE.MeshBasicMaterial({ color: '#fff0c8', transparent: true, opacity: 0.08, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide });
    wins.forEach((zc) => {
      const beam = new THREE.Mesh(new THREE.BoxGeometry(3.2, 1.5, 1.8), beamM);
      beam.position.set(-2.3, 1.2, zc + 0.3);
      beam.rotation.z = -0.55;
      scene.add(beam);
    });
  }

  // Bàn ghế: 3 dãy bàn đôi × 5 hàng, học sinh nhìn lên bảng (−z)
  const COLS = [-2.6, -0.5, 1.6];
  const ROWS = [-3.0, -1.6, -0.2, 1.2, 2.6];
  const HER = { col: 0, row: 2, side: -1 }; // sát cửa sổ
  const ME = { col: 2, row: 3, side: 1 }; // chỗ của Hoàng Nam (camera)
  const people = {};
  const fillers = ['Đức Huy', 'Kim Ngân', 'Tuấn Kiệt', 'Thu Hà', 'Lan Phương', 'Hải Đăng', 'Gia Khánh', 'Minh Tú', 'Văn Toàn', 'Khoa Nguyễn', 'Bé Na', 'Trang', 'Phương Linh', 'Đăng Khoa', 'Bảo Ngọc', 'Hữu Phước', 'Thanh Tâm', 'Ngọc Hân', 'Quang Vinh', 'Mai Anh', 'Thảo Vy', 'Gia Bảo', 'Nhật Minh', 'Khánh Linh', 'Hà My', 'Tiến Đạt'];
  const named = { 'Trà My': { col: 0, row: 1, side: 1 }, 'Quốc Bảo': { col: 1, row: 2, side: -1 }, 'Kim Ngân': { col: 0, row: 3, side: -1 } };
  const target = V(COLS[HER.col] + HER.side * 0.3, 1.1, ROWS[HER.row]);
  let k = 0;
  ROWS.forEach((z, ri) => {
    COLS.forEach((x, ci) => {
      const deskBook = Math.random() < 0.7;
      const desk = makeDesk(M, deskBook, ci === ME.col && ri === ME.row);
      desk.position.set(x, 0, z - 0.45);
      scene.add(desk);
      [-1, 1].forEach((side) => {
        const sx = x + side * 0.3;
        const isHer = ci === HER.col && ri === HER.row && side === HER.side;
        const isMe = ci === ME.col && ri === ME.row && side === ME.side;
        const chair = makeChair(M);
        // Ghế quay lưng về phía sau lớp (+z), mặt ghế hướng lên bảng như người ngồi
        chair.rotation.y = Math.PI;
        const herMate = ci === HER.col && ri === HER.row && !isHer;
        // Ghế trống (của Minh Anh khi vắng, của bạn cùng bàn khi Minh Anh quay sang) được đẩy sát vào bàn
        chair.position.set(sx, 0, z + ((isHer && !good) || (herMate && good) ? -0.14 : 0.02));
        if (herMate && good) return; // Minh Anh quay sang chỗ này nói chuyện: bỏ ghế để không vướng chân
        scene.add(chair);
        if (isMe) return;
        if (isHer && !good) return; // chỗ ngồi bỏ trống
        // Bạn ngồi cùng bàn với mình và với Minh Anh hôm nay ngồi chỗ khác, để nhìn rõ chỗ của Minh Anh
        if ((ci === ME.col && ri === ME.row) || (ci === HER.col && ri === HER.row && !isHer)) return;
        // Lớp 16 người: chừa trống vài ghế cuối cho thoáng
        if (!isHer && ri === 4 && ci !== ME.col) return;
        let name = isHer ? victim.name : null;
        if (!name) name = Object.keys(named).find((n) => named[n].col === ci && named[n].row === ri && named[n].side === side) || fillers[k++ % fillers.length];
        const av = isHer ? victim.avatar : o.avatarFor(name);
        const girl = av.style === 'long' || av.style === 'bun';
        let mood = 'neutral';
        if (good) mood = isHer || name === 'Quốc Bảo' || name === 'Trà My' ? 'laugh' : 'happy';
        const hh = hashName(name);
        const p = makePerson({ M, skin: isHer ? '#f1cdb0' : SKINS[hh % SKINS.length], hair: isHer ? '#16100e' : HAIRS[(hh >>> 4) % HAIRS.length], style: av.style === 'page' || av.style === 'anon' ? 'short' : av.style, girl, mood, clip: isHer });
        p.position.set(sx, 0, z);
        p.rotation.y = Math.PI; // nhìn lên bảng (−z)
        scene.add(p);
        people[name] = p;
        p.userData.chair = chair;
        if (good) {
          const pos = p.position;
          const near = pos.distanceTo(V(target.x, 0, target.z)) < 2.6;
          if (isHer) {
            // Minh Anh xoay người về phía các bạn (và về phía camera)
            p.rotation.y = Math.PI * 0.42;
          } else if (near) {
            const dx = target.x - pos.x;
            const dz = target.z - pos.z;
            const yaw = Math.atan2(dx, dz);
            p.rotation.y = Math.PI + (yaw - Math.PI) * 0.45;
            p.userData.head.rotation.y = (yaw - p.rotation.y + Math.PI * 3) % (Math.PI * 2) - Math.PI;
            p.userData.head.rotation.y = Math.max(-1.1, Math.min(1.1, p.userData.head.rotation.y));
          }
        } else {
          p.userData.head.rotation.x = 0.12;
        }
        chair.rotation.y = p.rotation.y; // ghế xoay theo người ngồi
      });
    });
  });

  // Đồ dùng trên bàn của mình (tiền cảnh)
  const myDeskX = COLS[ME.col];
  const myZ = ROWS[ME.row];
  const pen = box(0.14, 0.012, 0.012, new THREE.MeshStandardMaterial({ color: '#2f6fe0' }), myDeskX + 0.2, 0.775, myZ - 0.35);
  pen.rotation.y = 0.6;
  scene.add(pen);

  // Camera: ngồi ở bàn của Hoàng Nam, nhìn ngang lớp ra phía dãy cửa sổ
  const fov0 = 48;
  const camera = new THREE.PerspectiveCamera(fov0, 16 / 9, 0.05, 500);
  const eye = V(myDeskX + ME.side * 0.3, 1.18, myZ + 0.05);
  const look0 = V(-4, 1.08, myZ - 1.4);
  const look1 = target.clone().add(V(-0.4, 0.15, 0));
  camera.position.copy(eye);
  camera.lookAt(look0);

  const tracked = [];
  const tmp = new THREE.Vector3();
  // Bụi lấp lánh trôi trong vệt nắng (cảnh có hậu)
  let dust = null;
  if (good) {
    const n = 260;
    const pos = new Float32Array(n * 3);
    for (let i = 0; i < n; i++) {
      pos[i * 3] = -3.8 + Math.random() * 2.6;
      pos[i * 3 + 1] = 0.6 + Math.random() * 2.0;
      pos[i * 3 + 2] = -3.6 + Math.random() * 7.4;
    }
    const dg = new THREE.BufferGeometry();
    dg.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    const dotTex = canvasTex(32, 32, (g2, w) => {
      const gr = g2.createRadialGradient(w / 2, w / 2, 0, w / 2, w / 2, w / 2);
      gr.addColorStop(0, 'rgba(255,250,230,1)');
      gr.addColorStop(1, 'rgba(255,250,230,0)');
      g2.fillStyle = gr;
      g2.fillRect(0, 0, w, w);
    });
    dust = new THREE.Points(dg, new THREE.PointsMaterial({ size: 0.025, map: dotTex, transparent: true, opacity: 0.75, depthWrite: false, blending: THREE.AdditiveBlending }));
    scene.add(dust);
  }
  // Vật chuyển động: quạt trần, rèm
  const spinners = [];
  const swayers = [];
  scene.traverse((m) => {
    // phản chiếu môi trường nhẹ thôi để không cháy sáng
    if (m.material && m.material.envMapIntensity != null) m.material.envMapIntensity = 0.3;
    if (m.userData.spin) spinners.push(m);
    if (m.userData.sway != null) swayers.push(m);
  });

  // Hậu kỳ: lóa sáng nhẹ + chỉnh màu + viền tối
  let composer = null;
  let grade = null;
  try {
    composer = new EffectComposer(renderer);
    composer.addPass(new RenderPass(scene, camera));
    composer.addPass(new UnrealBloomPass(new THREE.Vector2(960, 540), good ? 0.14 : 0.05, 0.4, 0.92));
    composer.addPass(new OutputPass());
    grade = new ShaderPass(GradeShader);
    grade.uniforms.tint.value.set(...(good ? [1.04, 1.0, 0.94] : [0.93, 0.97, 1.04]));
    grade.uniforms.sat.value = good ? 1.12 : 0.72;
    grade.uniforms.vig.value = good ? 0.28 : 0.5;
    composer.addPass(grade);
  } catch (e) {
    composer = null;
  }

  function size() {
    const w = container.clientWidth || 960;
    const h = container.clientHeight || 540;
    renderer.setSize(w, h, false);
    if (composer) {
      composer.setPixelRatio(renderer.getPixelRatio());
      composer.setSize(w, h);
    }
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
  }
  size();
  window.addEventListener('resize', size);

  const clock = new THREE.Clock();
  let raf = 0;
  let alive = true;
  const look = new THREE.Vector3();
  // Máy yếu (laptop trường học): nếu khung hình quá chậm thì giảm độ phân giải
  let slow = 0;
  let lastT = 0;
  let lowered = 0;
  const forceHigh = window.__lc3dQuality === 'high'; // cho ảnh chụp kiểm thử
  function frame() {
    if (!alive) return;
    const t = clock.getElapsedTime();
    const dt = lastT ? Math.min(0.1, t - lastT) : 0.016;
    // Máy yếu: bước 1 tắt hậu kỳ, bước 2 giảm độ phân giải
    if (!forceHigh && lowered < 2 && lastT && t - lastT > 0.07 && ++slow > 12) {
      lowered++;
      slow = 0;
      if (lowered === 1 && composer) {
        composer = null;
        renderer.toneMappingExposure *= 1.05;
      } else {
        lowered = 2;
        renderer.setPixelRatio(0.75);
        renderer.shadowMap.autoUpdate = false;
      }
      size();
    }
    lastT = t;
    // Biển lấp lánh, mây trôi, quạt quay, rèm lay nhẹ, bụi bay
    outside.seaTex.offset.y = (outside.seaTex.offset.y + dt * 0.004) % 1;
    outside.seaTex.offset.x = Math.sin(t * 0.4) * 0.002;
    outside.sky.offset.x = (outside.sky.offset.x + dt * 0.0015) % 1;
    spinners.forEach((m) => { m.rotation.y += dt * m.userData.spin; });
    swayers.forEach((m) => { m.rotation.x = Math.sin(t * 0.9 + m.userData.sway) * 0.025; });
    if (dust) {
      const a = dust.geometry.attributes.position;
      for (let i = 0; i < a.count; i++) {
        let y = a.getY(i) + dt * 0.03 * (0.5 + ((i * 7) % 5) / 5);
        if (y > 2.7) y = 0.6;
        a.setY(i, y);
        a.setX(i, a.getX(i) + Math.sin(t * 0.7 + i) * dt * 0.02);
      }
      a.needsUpdate = true;
    }
    // Máy quay chậm rãi tiến lại gần, hướng dần về chỗ của Minh Anh
    const k2 = Math.min(1, t / 9);
    const e = k2 * k2 * (3 - 2 * k2);
    camera.position.copy(eye).add(V(-0.6 * e, -0.02 * e, -0.35 * e));
    camera.fov = fov0 - 9 * e;
    camera.updateProjectionMatrix();
    look.copy(look0).lerp(look1, e);
    camera.lookAt(look);
    Object.values(people).forEach((p) => {
      const u = p.userData;
      u.torso.scale.y = 1 + Math.sin(t * 1.6 + u.phase) * 0.012;
      if (u.laughing) {
        u.head.position.y = 1.17 + Math.abs(Math.sin(t * 5 + u.phase)) * 0.008;
        u.head.rotation.z = Math.sin(t * 2 + u.phase) * 0.05;
      }
    });
    tracked.forEach((tr) => {
      if (tr.fixed) return;
      tmp.copy(tr.obj.position).add(V(0, 1.42, 0)).project(camera);
      tr.el.style.left = Math.min(88, Math.max(12, ((tmp.x + 1) / 2) * 100)) + '%';
      tr.el.style.top = Math.min(80, Math.max(10, ((1 - tmp.y) / 2) * 100)) + '%';
      tr.el.style.visibility = tmp.z < 1 ? 'visible' : 'hidden';
    });
    if (composer) composer.render(dt);
    else renderer.render(scene, camera);
    window.__lc3dFrames = (window.__lc3dFrames || 0) + 1;
    raf = requestAnimationFrame(frame);
  }
  frame();

  return {
    /** Gắn bong bóng lời thoại `el` lên đầu người tên `name` (Hoàng Nam = camera: đặt ở dưới giữa). */
    track(name, el) {
      if (name === D.characters.witness.name || !people[name]) {
        el.style.left = '50%';
        el.style.top = '88%';
        el.classList.add('me');
        tracked.push({ el, fixed: true });
        return;
      }
      tracked.push({ el, obj: people[name] });
    },
    dispose() {
      alive = false;
      cancelAnimationFrame(raf);
      if (composer) composer.dispose();
      envTex.dispose();
      pmrem.dispose();
      window.removeEventListener('resize', size);
      scene.traverse((m) => {
        if (m.geometry) m.geometry.dispose();
        if (m.material) [].concat(m.material).forEach((x) => { if (x.map) x.map.dispose(); x.dispose(); });
      });
      renderer.dispose();
      renderer.domElement.remove();
    },
  };
}

window.LCClass3D = { mount };

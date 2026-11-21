// Lớp học 3D cho cảnh kết thúc (Three.js, chạy offline từ vendor/).
// Góc nhìn: từ bàn của Hoàng Nam (người chơi) nhìn ngang lớp về phía dãy cửa sổ.
//  - good: nắng vàng, Minh Anh ngồi cạnh cửa sổ, quay sang cười nói với các bạn.
//  - bad : trời âm u, mọi người nhìn lên bảng, chỗ ngồi của Minh Anh bỏ trống.
// Lớp học ở tầng trệt: ngoài cửa sổ là sân trường, cây xanh ngang tầm mắt. Cửa sổ luôn đóng.
import * as THREE from './vendor/three.module.min.js';

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
  const floor = canvasTex(512, 512, (g, w, h) => {
    const n = 8;
    for (let i = 0; i < n; i++) {
      for (let j = 0; j < n; j++) {
        const v = 205 + ((i + j) % 2) * 18 + Math.random() * 8;
        g.fillStyle = `rgb(${v},${v - 6},${v - 16})`;
        g.fillRect((i * w) / n, (j * h) / n, w / n, h / n);
      }
    }
    g.strokeStyle = 'rgba(120,110,95,0.5)';
    for (let i = 0; i <= n; i++) {
      g.beginPath(); g.moveTo((i * w) / n, 0); g.lineTo((i * w) / n, h); g.stroke();
      g.beginPath(); g.moveTo(0, (i * h) / n); g.lineTo(w, (i * h) / n); g.stroke();
    }
  });
  floor.wrapS = floor.wrapT = THREE.RepeatWrapping;
  floor.repeat.set(4, 5);
  return {
    wall: new THREE.MeshStandardMaterial({ color: good ? '#f1e6cf' : '#c9c6bd', roughness: 0.95 }),
    wallLow: new THREE.MeshStandardMaterial({ color: good ? '#6f9b7c' : '#5d7266', roughness: 0.8 }),
    floor: new THREE.MeshStandardMaterial({ map: floor, roughness: 0.55 }),
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
    [0.08, -0.08].forEach((x) => {
      const side = mesh(new THREE.CapsuleGeometry(0.022, 0.12, 6, 10), hairM);
      side.position.set(x * 1.02, -0.06, 0.0);
      head.add(side);
    });
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
function makeDesk(M, withBook) {
  const g = new THREE.Group();
  g.add(box(1.2, 0.04, 0.5, M.desk, 0, 0.74, 0));
  g.add(box(1.16, 0.3, 0.02, M.desk, 0, 0.58, -0.24)); // tấm chắn phía bảng, chân để dưới gầm
  [[-0.56, -0.22], [0.56, -0.22], [-0.56, 0.22], [0.56, 0.22]].forEach(([x, z]) => g.add(box(0.035, 0.72, 0.035, M.metal, x, 0.36, z)));
  if (withBook) {
    const book = box(0.22, 0.015, 0.3, M.paper, -0.25, 0.768, -0.02);
    book.rotation.y = 0.15;
    g.add(book);
    const cover = box(0.22, 0.012, 0.3, new THREE.MeshStandardMaterial({ color: '#3c7be0' }), 0.27, 0.766, 0.0);
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
  const wy0 = 0.95;
  const wy1 = 2.55;
  scene.add(box(0.15, wy0, z1 - z0, M.wall, x0, wy0 / 2, 0));
  scene.add(box(0.15, h - wy1, z1 - z0, M.wall, x0, (wy1 + h) / 2, 0));
  scene.add(box(0.16, 0.9, z1 - z0, M.wallLow, x0 + 0.01, 0.45, 0));
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
  });
  scene.add(box(0.15, wy1 - wy0, z1 - zPrev, M.wall, x0, (wy0 + wy1) / 2, (z1 + zPrev) / 2));
  return wins;
}

/** Bên ngoài cửa sổ: sân trường tầng trệt, cây xanh, trời. */
function buildOutside(scene, good) {
  const sky = canvasTex(16, 256, (g, w, h) => {
    const gr = g.createLinearGradient(0, 0, 0, h);
    if (good) { gr.addColorStop(0, '#5aa9ff'); gr.addColorStop(0.6, '#bfe3ff'); gr.addColorStop(1, '#fff2d6'); }
    else { gr.addColorStop(0, '#7d8794'); gr.addColorStop(0.7, '#aab2bb'); gr.addColorStop(1, '#c4c9cc'); }
    g.fillStyle = gr;
    g.fillRect(0, 0, w, h);
  });
  const skyM = new THREE.Mesh(new THREE.PlaneGeometry(80, 30), new THREE.MeshBasicMaterial({ map: sky, fog: false }));
  skyM.position.set(-30, 12, 0);
  skyM.rotation.y = Math.PI / 2;
  scene.add(skyM);
  const yard = mesh(new THREE.PlaneGeometry(40, 60), new THREE.MeshStandardMaterial({ color: good ? '#8fbf6a' : '#6f8a62', roughness: 1 }), false, true);
  yard.rotation.x = -Math.PI / 2;
  yard.position.set(-24, -0.01, 0);
  scene.add(yard);
  const path = mesh(new THREE.PlaneGeometry(3, 60), new THREE.MeshStandardMaterial({ color: '#c9b79c', roughness: 1 }), false, true);
  path.rotation.x = -Math.PI / 2;
  path.position.set(-6, 0, 0);
  scene.add(path);
  // Hàng rào bồn hoa ngay dưới cửa sổ
  const bushM = new THREE.MeshStandardMaterial({ color: good ? '#4f9a4a' : '#47684a', roughness: 0.9 });
  for (let z = -5; z <= 5; z += 0.6) {
    const b = mesh(new THREE.IcosahedronGeometry(0.45, 1), bushM);
    b.position.set(-4.7, 0.45, z + Math.random() * 0.2);
    scene.add(b);
  }
  // Cây
  const trunkM = new THREE.MeshStandardMaterial({ color: '#6b4a2f', roughness: 1 });
  const leafM = [good ? '#5fae4f' : '#4d7350', good ? '#78c25e' : '#5b7f5b', good ? '#3f8f3f' : '#3e5e42'].map((c) => new THREE.MeshStandardMaterial({ color: c, roughness: 0.95 }));
  [[-9, -3], [-11, 2.5], [-8.5, 6], [-14, -7], [-15, 8], [-12, -0.5]].forEach(([x, z], i) => {
    const t = mesh(new THREE.CylinderGeometry(0.18, 0.28, 3.4, 10), trunkM);
    t.position.set(x, 1.7, z);
    scene.add(t);
    for (let k = 0; k < 6; k++) {
      const l = mesh(new THREE.IcosahedronGeometry(1 + Math.random() * 0.6, 1), leafM[(i + k) % 3]);
      l.position.set(x + Math.random() * 2 - 1, 3.6 + Math.random() * 1.4, z + Math.random() * 2 - 1);
      scene.add(l);
    }
  });
  // Dãy nhà phía xa
  const bld = mesh(new THREE.BoxGeometry(4, 6, 40), new THREE.MeshStandardMaterial({ color: good ? '#f3d27a' : '#b9ad8a', roughness: 0.9 }), false, true);
  bld.position.set(-22, 3, 0);
  scene.add(bld);
  for (let z = -18; z < 18; z += 2.4) {
    for (const y of [1.6, 4.2]) scene.add(box(0.05, 1.1, 1.2, new THREE.MeshStandardMaterial({ color: '#6d8fb3', roughness: 0.3 }), -19.97, y, z));
  }
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
  scene.fog = new THREE.Fog(good ? '#e9f3ff' : '#a7adb2', 14, 40);
  const M = materials(good);
  const wins = buildRoom(scene, M, good, o.board);
  buildOutside(scene, good);

  // Ánh sáng
  scene.add(new THREE.HemisphereLight(good ? '#fff4dc' : '#dfe6ee', good ? '#8a6a4a' : '#4c4f55', good ? 1.3 : 1.0));
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
      const desk = makeDesk(M, deskBook);
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
  const camera = new THREE.PerspectiveCamera(fov0, 16 / 9, 0.05, 120);
  const eye = V(myDeskX + ME.side * 0.3, 1.18, myZ + 0.05);
  const look0 = V(-4, 1.25, myZ - 1.4);
  const look1 = target.clone().add(V(-0.4, 0.15, 0));
  camera.position.copy(eye);
  camera.lookAt(look0);

  const tracked = [];
  const tmp = new THREE.Vector3();
  function size() {
    const w = container.clientWidth || 960;
    const h = container.clientHeight || 540;
    renderer.setSize(w, h, false);
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
  let lowered = false;
  function frame() {
    if (!alive) return;
    const t = clock.getElapsedTime();
    if (!lowered && lastT && t - lastT > 0.08 && ++slow > 12) {
      lowered = true;
      renderer.setPixelRatio(0.75);
      size();
    }
    lastT = t;
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
        u.head.position.y = 1.15 + Math.abs(Math.sin(t * 5 + u.phase)) * 0.008;
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
    renderer.render(scene, camera);
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

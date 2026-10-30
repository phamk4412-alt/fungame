// Lão Ngư, chiếc xuồng máy, hũ thính và thủy quái
import * as THREE from 'three';

const UP = new THREE.Vector3(0, 1, 0);
const tmp = new THREE.Vector3();
const _m = new THREE.Matrix4();

function canvasTex(w, h, draw) {
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  draw(c.getContext('2d'), w, h);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  return t;
}

// ván gỗ có thớ
function woodTexture(base) {
  return canvasTex(256, 64, (g, w, h) => {
    g.fillStyle = base;
    g.fillRect(0, 0, w, h);
    for (let i = 0; i < 70; i++) {
      g.strokeStyle = `rgba(${Math.random() < 0.5 ? '40,24,12' : '255,230,190'},${0.05 + Math.random() * 0.1})`;
      g.lineWidth = 0.5 + Math.random() * 1.5;
      g.beginPath();
      const y = Math.random() * h;
      g.moveTo(0, y);
      for (let x = 0; x <= w; x += 16) g.lineTo(x, y + Math.sin(x * 0.03 + i) * 2);
      g.stroke();
    }
    for (let y = 0; y < h; y += 16) {
      g.fillStyle = 'rgba(20,10,4,0.45)';
      g.fillRect(0, y, w, 1);
    }
  });
}

// vảy lớp lớp, sẫm ở mép
function scaleTexture(back, glow) {
  return canvasTex(256, 256, (g, w, h) => {
    g.fillStyle = back;
    g.fillRect(0, 0, w, h);
    const R = 16;
    for (let row = -1; row < h / (R * 0.8) + 1; row++) {
      for (let col = -1; col < w / R + 1; col++) {
        const x = col * R + (row % 2 ? R / 2 : 0);
        const y = row * R * 0.8;
        const gr = g.createRadialGradient(x, y - R * 0.3, 1, x, y, R * 0.75);
        gr.addColorStop(0, 'rgba(255,255,255,0.16)');
        gr.addColorStop(0.7, 'rgba(0,0,0,0)');
        gr.addColorStop(1, 'rgba(0,0,0,0.45)');
        g.fillStyle = gr;
        g.beginPath();
        g.arc(x, y, R * 0.72, 0, Math.PI);
        g.fill();
      }
    }
    // vệt phát sáng chạy dọc thân
    g.strokeStyle = glow;
    g.globalAlpha = 0.35;
    g.lineWidth = 3;
    g.beginPath();
    g.moveTo(0, h * 0.5);
    for (let x = 0; x <= w; x += 8) g.lineTo(x, h * 0.5 + Math.sin(x * 0.05) * 10);
    g.stroke();
    g.globalAlpha = 1;
  });
}

// ---------- Xuồng máy nhỏ của Lão Ngư ----------
export function makeBoat() {
  const group = new THREE.Group();
  const hullMat = new THREE.MeshStandardMaterial({ map: woodTexture('#6a4428'), roughness: 0.8 });
  const paint = new THREE.MeshStandardMaterial({ color: '#2f6f8a', roughness: 0.6 });
  const inner = new THREE.MeshStandardMaterial({ map: woodTexture('#8a6440'), roughness: 0.85, side: THREE.DoubleSide });
  const metal = new THREE.MeshStandardMaterial({ color: '#2a2e33', metalness: 0.7, roughness: 0.35 });
  const pieces = [];
  // vỏ xuồng: tiết diện chữ U, hai đầu nhọn dần, mũi cong lên
  const L = 3.6;
  const N = 24;
  const M = 10;
  const pos = [];
  const uv = [];
  const idx = [];
  for (let i = 0; i <= N; i++) {
    const t = i / N;
    const z = (t - 0.5) * L;
    const end = Math.abs(t - 0.5) * 2;
    const half = 0.62 * Math.pow(1 - Math.pow(end, 2.2), 0.6) + 0.02;
    const depth = 0.42 * (1 - Math.pow(end, 3) * 0.6);
    const rise = Math.pow(Math.max(0, t - 0.55) / 0.45, 2) * 0.25;
    for (let j = 0; j <= M; j++) {
      const a = (j / M) * Math.PI;
      pos.push(Math.cos(a) * half, -Math.sin(a) * depth + rise + 0.35, z);
      uv.push(t * 3, j / M);
    }
  }
  for (let i = 0; i < N; i++) {
    for (let j = 0; j < M; j++) {
      const a = i * (M + 1) + j;
      const b = a + M + 1;
      idx.push(a, b, a + 1, b, b + 1, a + 1);
    }
  }
  const hullGeo = new THREE.BufferGeometry();
  hullGeo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  hullGeo.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
  hullGeo.setIndex(idx);
  hullGeo.computeVertexNormals();
  const hull = new THREE.Mesh(hullGeo, new THREE.MeshStandardMaterial({ map: hullMat.map, roughness: 0.8, side: THREE.DoubleSide }));
  hull.castShadow = true;
  group.add(hull);
  pieces.push(hull);
  // sọc sơn ngoài mạn và mép mạn
  for (const s of [-1, 1]) {
    const rail = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.07, L * 0.86), paint);
    rail.position.set(s * 0.6, 0.37, 0);
    group.add(rail);
    pieces.push(rail);
  }
  // sàn, băng ngồi
  const floor = new THREE.Mesh(new THREE.PlaneGeometry(0.8, L * 0.7), inner);
  floor.rotation.x = -Math.PI / 2;
  floor.position.y = 0.02;
  group.add(floor);
  for (const z of [-0.9, 0.35, 1.05]) {
    const seat = new THREE.Mesh(new THREE.BoxGeometry(1.08, 0.05, 0.28), inner);
    seat.position.set(0, 0.26, z);
    seat.castShadow = true;
    group.add(seat);
    pieces.push(seat);
  }
  // máy đuôi tôm ở đuôi xuồng
  const motor = new THREE.Group();
  const cowl = new THREE.Mesh(new THREE.BoxGeometry(0.3, 0.32, 0.4), new THREE.MeshStandardMaterial({ color: '#b8301e', roughness: 0.45, metalness: 0.2 }));
  cowl.position.y = 0.55;
  const shaft = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.04, 0.9, 8), metal);
  shaft.position.set(0, 0.05, 0.12);
  const prop = new THREE.Mesh(new THREE.TorusGeometry(0.1, 0.025, 4, 3), metal);
  prop.position.set(0, -0.38, 0.12);
  const tiller = new THREE.Mesh(new THREE.CylinderGeometry(0.02, 0.02, 0.6, 6), metal);
  tiller.rotation.x = Math.PI / 2;
  tiller.position.set(0, 0.6, -0.4);
  motor.add(cowl, shaft, prop, tiller);
  motor.position.set(0, 0, L / 2 - 0.15);
  group.add(motor);
  pieces.push(cowl);
  // dây neo, can dầu, lưới
  const can = new THREE.Mesh(new THREE.BoxGeometry(0.22, 0.28, 0.14), new THREE.MeshStandardMaterial({ color: '#c8a020', roughness: 0.5 }));
  can.position.set(0.3, 0.16, 1.35);
  const net = new THREE.Mesh(new THREE.SphereGeometry(0.28, 10, 6), new THREE.MeshStandardMaterial({ color: '#7a8a5a', roughness: 1, wireframe: true }));
  net.scale.set(1, 0.4, 1.3);
  net.position.set(-0.25, 0.12, -1.25);
  group.add(can, net);
  pieces.push(can);
  group.userData = { motor, prop, pieces };
  return group;
}

// ---------- Hũ thính Lão Ngư đánh rơi ----------
export function makeJar() {
  const group = new THREE.Group();
  const pts = [];
  for (let i = 0; i <= 12; i++) {
    const t = i / 12;
    const r = 0.06 + Math.sin(t * Math.PI) * 0.1 - (t > 0.82 ? (t - 0.82) * 0.25 : 0);
    pts.push(new THREE.Vector2(r, t * 0.32));
  }
  const clay = new THREE.MeshPhysicalMaterial({ color: '#9a5a32', roughness: 0.5, clearcoat: 0.6, clearcoatRoughness: 0.3 });
  const jar = new THREE.Mesh(new THREE.LatheGeometry(pts, 20), clay);
  jar.castShadow = true;
  const cloth = new THREE.Mesh(new THREE.SphereGeometry(0.085, 14, 8, 0, Math.PI * 2, 0, Math.PI / 2), new THREE.MeshStandardMaterial({ color: '#c8302a', roughness: 0.9 }));
  cloth.position.y = 0.31;
  cloth.scale.set(1, 0.6, 1);
  const tie = new THREE.Mesh(new THREE.TorusGeometry(0.07, 0.008, 5, 18), new THREE.MeshStandardMaterial({ color: '#e8c86a' }));
  tie.rotation.x = Math.PI / 2;
  tie.position.y = 0.3;
  // cột sáng cho dễ thấy từ xa
  const beam = new THREE.Mesh(
    new THREE.CylinderGeometry(0.12, 0.3, 6, 12, 1, true),
    new THREE.MeshBasicMaterial({ color: '#ffd66a', transparent: true, opacity: 0.22, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide }),
  );
  beam.position.y = 3;
  const glow = new THREE.Mesh(
    new THREE.SphereGeometry(0.32, 12, 8),
    new THREE.MeshBasicMaterial({ color: '#ffcf4a', transparent: true, opacity: 0.25, blending: THREE.AdditiveBlending, depthWrite: false }),
  );
  glow.position.y = 0.18;
  group.add(jar, cloth, tie, beam, glow);
  group.userData = { beam, glow };
  return group;
}

// ---------- Mảnh xuồng vỡ bay tứ tung ----------
export class Debris {
  constructor(scene) {
    this.scene = scene;
    this.list = [];
  }

  burst(at, n = 16) {
    const mat = new THREE.MeshStandardMaterial({ map: woodTexture('#6a4428'), roughness: 0.8 });
    const paint = new THREE.MeshStandardMaterial({ color: '#2f6f8a', roughness: 0.6 });
    for (let i = 0; i < n; i++) {
      const m = new THREE.Mesh(new THREE.BoxGeometry(0.1 + Math.random() * 0.3, 0.04, 0.4 + Math.random() * 1.2), Math.random() < 0.25 ? paint : mat);
      m.position.copy(at).add(new THREE.Vector3((Math.random() - 0.5) * 1.5, 0.5 + Math.random(), (Math.random() - 0.5) * 2.5));
      m.castShadow = true;
      const v = new THREE.Vector3((Math.random() - 0.5) * 12, 5 + Math.random() * 9, (Math.random() - 0.5) * 12);
      const w = new THREE.Vector3(Math.random() * 10, Math.random() * 10, Math.random() * 10);
      this.scene.add(m);
      this.list.push({ m, v, w, life: 9 + Math.random() * 4 });
    }
  }

  update(dt, waterY) {
    for (let i = this.list.length - 1; i >= 0; i--) {
      const d = this.list[i];
      d.life -= dt;
      const y = waterY(d.m.position.x, d.m.position.z);
      if (d.m.position.y > y) {
        d.v.y -= 9.8 * dt;
        d.m.rotation.x += d.w.x * dt;
        d.m.rotation.y += d.w.y * dt;
      } else {
        // trôi lềnh bềnh rồi chìm dần
        d.v.multiplyScalar(Math.pow(0.05, dt));
        d.v.y = (y - 0.02 - d.m.position.y) * 3 - (d.life < 3 ? 0.3 : 0);
        d.m.rotation.x *= Math.pow(0.2, dt);
      }
      d.m.position.addScaledVector(d.v, dt);
      if (d.life <= 0) {
        this.scene.remove(d.m);
        d.m.geometry.dispose();
        this.list.splice(i, 1);
      }
    }
  }
}

// ---------- Thủy quái: đầu rồng có hàm răng, cổ dài nhiều đốt, vây lưng gai ----------
export class Monster {
  constructor(look) {
    this.group = new THREE.Group();
    const skinMat = new THREE.MeshPhysicalMaterial({
      map: scaleTexture(look.back, look.glow),
      roughness: 0.42,
      clearcoat: 0.8,
      clearcoatRoughness: 0.25,
      sheen: 0.4,
      sheenColor: new THREE.Color(look.glow),
    });
    skinMat.map.repeat.set(2, 1);
    const bellyMat = new THREE.MeshPhysicalMaterial({ color: look.belly, roughness: 0.5, clearcoat: 0.5 });
    const finMat = new THREE.MeshPhysicalMaterial({ color: look.fin, roughness: 0.4, transmission: 0.2, transparent: true, opacity: 0.9, side: THREE.DoubleSide });
    const tooth = new THREE.MeshPhysicalMaterial({ color: '#f2ead2', roughness: 0.25, clearcoat: 1 });
    const mouthMat = new THREE.MeshStandardMaterial({ color: '#5a0e12', roughness: 0.6 });
    const eyeMat = new THREE.MeshStandardMaterial({ color: look.glow, emissive: look.glow, emissiveIntensity: 2.5, roughness: 0.1 });
    this.eyeMat = eyeMat;

    // các đốt cổ, to dần về phía đuôi
    this.N = 22;
    this.segs = [];
    this.pts = [];
    for (let i = 0; i < this.N; i++) {
      const r = 0.7 + (i / this.N) * 0.6;
      const seg = new THREE.Group();
      const ball = new THREE.Mesh(new THREE.SphereGeometry(r, 22, 16), skinMat);
      ball.scale.set(1, 0.92, 1.25);
      ball.castShadow = true;
      const belly = new THREE.Mesh(new THREE.SphereGeometry(r * 0.86, 16, 10), bellyMat);
      belly.scale.set(0.9, 0.7, 1.2);
      belly.position.y = -r * 0.32;
      seg.add(ball, belly);
      // gai lưng
      if (i % 1 === 0) {
        const spike = new THREE.Mesh(new THREE.ConeGeometry(r * 0.28, r * (1.1 - i / this.N * 0.3), 6), finMat);
        spike.position.y = r * 0.95;
        spike.rotation.x = -0.5;
        seg.add(spike);
      }
      this.group.add(seg);
      this.segs.push({ g: seg, r });
      this.pts.push(new THREE.Vector3(0, -20, 0));
    }

    // đầu
    this.head = new THREE.Group();
    const skull = new THREE.Mesh(new THREE.SphereGeometry(1, 28, 20), skinMat);
    skull.scale.set(0.95, 0.72, 1.25);
    skull.castShadow = true;
    const snout = new THREE.Mesh(new THREE.SphereGeometry(0.62, 24, 16), skinMat);
    snout.scale.set(0.95, 0.55, 1.9);
    snout.position.set(0, -0.05, 1.35);
    const brow = new THREE.Mesh(new THREE.SphereGeometry(0.5, 16, 10), skinMat);
    brow.scale.set(1.8, 0.45, 0.9);
    brow.position.set(0, 0.5, 0.55);
    this.head.add(skull, snout, brow);
    // hàm trên: răng nanh nhọn quay xuống
    for (let i = 0; i < 14; i++) {
      const t = i / 13;
      const side = i % 2 ? 1 : -1;
      const z = 2.3 - t * 1.9;
      const x = side * (0.25 + Math.sin(t * Math.PI * 0.5) * 0.45);
      const len = i < 2 ? 0.55 : 0.22 + Math.random() * 0.18;
      const tt = new THREE.Mesh(new THREE.ConeGeometry(0.07 + len * 0.12, len, 6), tooth);
      tt.rotation.x = Math.PI;
      tt.position.set(x, -0.3 - len / 2 + 0.05, z);
      this.head.add(tt);
    }
    // vòm miệng đỏ thẫm
    const palate = new THREE.Mesh(new THREE.SphereGeometry(0.6, 16, 10, 0, Math.PI * 2, Math.PI / 2, Math.PI / 2), mouthMat);
    palate.scale.set(0.9, 0.4, 2.2);
    palate.position.set(0, -0.22, 1.1);
    palate.rotation.x = Math.PI;
    this.head.add(palate);
    // mắt phát sáng có đồng tử dọc, mí mắt gồ
    for (const s of [-1, 1]) {
      const eye = new THREE.Mesh(new THREE.SphereGeometry(0.2, 16, 12), eyeMat);
      eye.position.set(s * 0.68, 0.32, 0.75);
      const pupil = new THREE.Mesh(new THREE.BoxGeometry(0.04, 0.24, 0.05), new THREE.MeshBasicMaterial({ color: '#000' }));
      pupil.position.set(s * 0.86, 0.32, 0.8);
      pupil.rotation.y = s * 1.2;
      const lid = new THREE.Mesh(new THREE.SphereGeometry(0.26, 12, 8, 0, Math.PI * 2, 0, Math.PI / 2), skinMat);
      lid.position.set(s * 0.66, 0.38, 0.75);
      lid.rotation.z = s * -0.5;
      // sừng cong ra sau
      const horn = new THREE.Mesh(new THREE.ConeGeometry(0.18, 1.6, 8), tooth);
      horn.position.set(s * 0.55, 0.85, -0.5);
      horn.rotation.set(-1.0, 0, s * -0.35);
      const horn2 = new THREE.Mesh(new THREE.ConeGeometry(0.1, 0.8, 6), tooth);
      horn2.position.set(s * 0.8, 0.55, -0.2);
      horn2.rotation.set(-1.2, 0, s * -0.9);
      // mang vây hai bên như quạt
      const frill = new THREE.Mesh(new THREE.CircleGeometry(0.9, 10, -0.9, 1.8), finMat);
      frill.position.set(s * 0.8, 0.1, -0.5);
      frill.rotation.set(0, s * 1.2, 0);
      frill.scale.set(1, 1.3, 1);
      this.head.add(eye, pupil, lid, horn, horn2, frill);
    }
    for (const s of [-1, 1]) {
      const nostril = new THREE.Mesh(new THREE.SphereGeometry(0.06, 8, 6), mouthMat);
      nostril.position.set(s * 0.2, 0.22, 2.4);
      this.head.add(nostril);
    }
    // râu dài hai bên mép
    this.whiskers = [];
    for (const s of [-1, 1]) {
      const pts = [];
      for (let i = 0; i <= 8; i++) pts.push(new THREE.Vector3(s * (0.4 + i * 0.25), -0.2 - i * 0.12, 2 - i * 0.3));
      const w = new THREE.Mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts), 16, 0.035, 5), finMat);
      this.head.add(w);
    }
    // hàm dưới xoay quanh khớp sau đầu
    this.jaw = new THREE.Group();
    this.jaw.position.set(0, -0.3, -0.2);
    const jawM = new THREE.Mesh(new THREE.SphereGeometry(0.6, 22, 14), skinMat);
    jawM.scale.set(1.15, 0.35, 2.3);
    jawM.position.set(0, -0.12, 1.2);
    const jawBelly = new THREE.Mesh(new THREE.SphereGeometry(0.55, 18, 10), bellyMat);
    jawBelly.scale.set(1.05, 0.3, 2.2);
    jawBelly.position.set(0, -0.2, 1.15);
    const tongue = new THREE.Mesh(new THREE.SphereGeometry(0.3, 12, 8), new THREE.MeshStandardMaterial({ color: '#a8303a', roughness: 0.4 }));
    tongue.scale.set(1, 0.3, 2.5);
    tongue.position.set(0, 0.05, 1.1);
    this.jaw.add(jawM, jawBelly, tongue);
    for (let i = 0; i < 12; i++) {
      const t = i / 11;
      const side = i % 2 ? 1 : -1;
      const len = i < 2 ? 0.45 : 0.18 + Math.random() * 0.14;
      const tt = new THREE.Mesh(new THREE.ConeGeometry(0.06 + len * 0.12, len, 6), tooth);
      tt.position.set(side * (0.2 + Math.sin(t * Math.PI * 0.5) * 0.45), 0.12 + len / 2, 2.3 - t * 1.8);
      this.jaw.add(tt);
    }
    this.head.add(this.jaw);
    this.head.traverse((m) => m.isMesh && (m.castShadow = true));
    this.group.add(this.head);
    this.scale = look.len / 4.6;
    this.group.scale.setScalar(this.scale);

    this.headPos = new THREE.Vector3(0, -20, 0);
    this.headDir = new THREE.Vector3(0, 0, 1);
    this.open = 0;
    this.openTarget = 0;
    this.t = 0;
    this.targets = this.pts.map((p) => p.clone());
    this.headTarget = this.headPos.clone();
    this.dirTarget = this.headDir.clone();
    this.snap = true;
  }

  // Ngóc đầu khỏi mặt nước: thân trồi lên từ "base" uốn cong tới đầu ở "head", mõm hướng "dir"
  rise(base, head, dir, open) {
    this.headTarget.copy(head);
    this.dirTarget.copy(dir).normalize();
    this.openTarget = open;
    const back = this.dirTarget.clone().multiplyScalar(-1);
    const s = this.scale;
    const c1 = head.clone().addScaledVector(back, 3 * s);
    c1.y -= 1.5 * s;
    const c0 = base.clone();
    c0.y += (head.y - base.y) * 0.5;
    for (let i = 0; i < this.N; i++) {
      const t = (i + 1) / (this.N + 1);
      // bezier bậc ba từ đầu xuống gốc
      const a = (1 - t) ** 3;
      const b = 3 * (1 - t) ** 2 * t;
      const c = 3 * (1 - t) * t * t;
      const d = t ** 3;
      const p = this.targets[i];
      p.set(0, 0, 0)
        .addScaledVector(head.clone().addScaledVector(back, 1.2 * s), a)
        .addScaledVector(c1, b)
        .addScaledVector(c0, c)
        .addScaledVector(base.clone().setY(base.y - 4 * s), d);
      p.x += Math.sin(this.t * 2 + i * 0.5) * 0.15 * s * t;
    }
  }

  // Bơi sát mặt nước: lưng nhô lên từng khúc, mắt sáng lừ ngay dưới mặt nước
  swim(head, dir, depth = 0.4) {
    this.headTarget.copy(head);
    this.headTarget.y = -depth * this.scale + 0.2;
    this.dirTarget.copy(dir).setY(0).normalize();
    this.openTarget = 0.08;
    const back = this.dirTarget.clone().multiplyScalar(-1);
    const side = new THREE.Vector3(-back.z, 0, back.x);
    const s = this.scale;
    for (let i = 0; i < this.N; i++) {
      const p = this.targets[i];
      const k = (i + 1) * 1.05 * s;
      p.copy(head).addScaledVector(back, k + 0.8 * s).addScaledVector(side, Math.sin(this.t * 1.6 - i * 0.45) * 0.9 * s);
      p.y = (Math.sin(this.t * 1.3 - i * 0.55) * 0.9 - 0.75 - i * 0.02) * s;
    }
  }

  // Lặn hẳn xuống đáy
  dive(at) {
    this.headTarget.copy(at).setY(-12);
    for (const p of this.targets) p.copy(at).setY(-14);
    this.openTarget = 0;
  }

  update(dt, rate = 4) {
    this.t += dt;
    const k = this.snap ? 1 : Math.min(1, dt * rate);
    this.snap = false;
    this.headPos.lerp(this.headTarget, k);
    this.headDir.lerp(this.dirTarget, k).normalize();
    this.open += (this.openTarget - this.open) * Math.min(1, dt * 10);
    for (let i = 0; i < this.N; i++) this.pts[i].lerp(this.targets[i], Math.min(1, k * (1 - i / (this.N * 2.2))));
    // nhóm chỉ thu phóng, không xoay, nên hướng trong nhóm cũng là hướng thật
    this.head.position.copy(this.headPos).divideScalar(this.scale);
    tmp.copy(this.headPos).add(this.headDir);
    this.head.quaternion.setFromRotationMatrix(_m.lookAt(tmp, this.headPos, UP));
    this.jaw.rotation.x = this.open * 0.9;
    let prev = this.headPos;
    for (let i = 0; i < this.N; i++) {
      const g = this.segs[i].g;
      g.position.copy(this.pts[i]).divideScalar(this.scale);
      // mỗi đốt nhìn về đốt trước, gai lưng luôn hướng lên
      if (prev.distanceToSquared(this.pts[i]) > 1e-6) g.quaternion.setFromRotationMatrix(_m.lookAt(prev, this.pts[i], UP));
      prev = this.pts[i];
    }
    this.eyeMat.emissiveIntensity = 2 + Math.sin(this.t * 3) * 0.6;
  }

  // mõm trên thế giới, để mắc dây câu vào
  mouth(out = new THREE.Vector3()) {
    return out.copy(this.headPos).addScaledVector(this.headDir, 1.8 * this.scale);
  }
}

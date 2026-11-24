// Mô hình 3D bên ngoài của máy bay SC-4: thân dựng theo mặt cắt, cánh có biên dạng, cánh lái chuyển động.
import * as THREE from 'three';

/** Mặt cắt thân cabin + đuôi: [z, rộng, cao, tâm y, mũ siêu elip]. */
export const BODY = [
  [-1.62, 1.1, 1.0, 0.04, 3.0], [-1.3, 1.14, 1.5, 0.27, 3.2], [-0.95, 1.18, 1.86, 0.35, 3.4],
  [0.0, 1.18, 1.9, 0.35, 3.4], [0.8, 1.12, 1.78, 0.37, 3.2], [1.55, 0.94, 1.36, 0.45, 3.0],
  [2.5, 0.66, 0.92, 0.5, 2.8], [3.6, 0.44, 0.6, 0.55, 2.6], [4.7, 0.26, 0.4, 0.6, 2.4], [5.65, 0.08, 0.16, 0.62, 2.2],
];

/** Nội suy mặt cắt thân tại z. */
export function bodyAt(z) {
  const B = BODY;
  if (z <= B[0][0]) return B[0].slice();
  for (let i = 1; i < B.length; i++) {
    if (z <= B[i][0]) {
      const a = B[i - 1], b = B[i], t = (z - a[0]) / (b[0] - a[0]);
      return a.map((v, k) => v + (b[k] - v) * t);
    }
  }
  return B[B.length - 1].slice();
}

/** Dựng thân theo dãy mặt cắt siêu elip dọc trục z. Mỗi mặt cắt: [z, rộng, cao, tâm y, mũ]. */
export function loft(sections, seg = 28) {
  const pos = [], uv = [], idx = [];
  const z0 = sections[0][0], z1 = sections[sections.length - 1][0];
  sections.forEach(([z, w, h, yc, e = 2.5], j) => {
    for (let i = 0; i <= seg; i++) {
      const a = (i / seg) * Math.PI * 2; // 0 = nóc, chạy theo chiều kim đồng hồ nhìn từ trước
      const s = Math.sin(a), c = Math.cos(a);
      const x = Math.sign(s) * Math.pow(Math.abs(s), 2 / e) * w / 2;
      const y = Math.sign(c) * Math.pow(Math.abs(c), 2 / e) * h / 2;
      pos.push(x, yc + y, z);
      uv.push(i / seg, (z - z0) / (z1 - z0));
    }
    if (j > 0) {
      for (let i = 0; i < seg; i++) {
        const a = (j - 1) * (seg + 1) + i, b = a + 1, cc = a + seg + 1, d = cc + 1;
        idx.push(a, b, cc, b, d, cc);
      }
    }
  });
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
  g.setIndex(idx);
  g.computeVertexNormals();
  return g;
}

/** Cánh có biên dạng NACA 4 chữ số, dựng dọc trục x từ x0 đến x1. Gốc dây cung ở mép trước. */
export function wingGeo(x0, x1, chord0, chord1, thick = 0.12, camber = 0.02, sweep = 0, dihedral = 0, seg = 18) {
  const up = [], lo = [];
  for (let i = 0; i <= seg; i++) {
    const xc = 0.5 - 0.5 * Math.cos(Math.PI * (i / seg));
    const yt = 5 * thick * (0.2969 * Math.sqrt(xc) - 0.126 * xc - 0.3516 * xc * xc + 0.2843 * xc ** 3 - 0.1036 * xc ** 4);
    const yc = camber ? (xc < 0.4 ? camber / 0.16 * (0.8 * xc - xc * xc) : camber / 0.36 * (0.2 + 0.8 * xc - xc * xc)) : 0;
    up.push([xc, yc + yt]);
    lo.push([xc, yc - yt]);
  }
  // vòng biên dạng: mặt trên từ mép sau → mép trước, rồi mặt dưới về mép sau
  const ring = [];
  for (let i = seg; i >= 0; i--) ring.push(up[i]);
  for (let i = 1; i <= seg; i++) ring.push(lo[i]);
  const N = ring.length;
  const pos = [], idx = [];
  const spans = 6;
  for (let j = 0; j <= spans; j++) {
    const s = j / spans;
    const x = x0 + (x1 - x0) * s;
    const ch = chord0 + (chord1 - chord0) * s;
    const dz = sweep * Math.abs(x - x0);
    const dy = Math.tan(dihedral) * Math.abs(x - x0);
    for (const [u, v] of ring) pos.push(x, dy + v * ch, dz + u * ch);
  }
  for (let j = 0; j < spans; j++) {
    for (let i = 0; i < N - 1; i++) {
      const a = j * N + i, b = a + 1, c = a + N, d = c + 1;
      if (x1 > x0) idx.push(a, c, b, b, c, d); else idx.push(a, b, c, b, d, c);
    }
  }
  // nắp hai đầu cánh
  for (const j of [0, spans]) {
    const base = j * N;
    for (let i = 1; i < N - 2; i++) {
      if ((j === 0) === (x1 > x0)) idx.push(base, base + i + 1, base + i); else idx.push(base, base + i, base + i + 1);
    }
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setIndex(idx);
  g.computeVertexNormals();
  return g;
}

function liveryTexture(main, accent, reg) {
  const c = document.createElement('canvas');
  c.width = 1024; c.height = 1024;
  const g = c.getContext('2d');
  g.fillStyle = '#f4f4f1'; g.fillRect(0, 0, 1024, 1024);
  // u: quanh thân (0 nóc → 0.25 phải → 0.5 bụng → 0.75 trái), v: dọc thân từ mũi (0) về đuôi (1)
  // sọc hai bên hông
  const stripe = (u0, u1, col) => { g.fillStyle = col; g.fillRect(u0 * 1024, 0, (u1 - u0) * 1024, 1024); };
  stripe(0.3, 0.335, main); stripe(0.665, 0.7, main);
  stripe(0.345, 0.36, accent); stripe(0.64, 0.655, accent);
  // bụng đậm màu
  stripe(0.42, 0.58, main);
  return { c, g, tex: () => { const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 8; return t; } };
}

/**
 * Tạo máy bay. Trả về { group, parts } với parts để hoạt hoạ cánh lái/cánh quạt
 * và nhóm `cabin` (ẩn khi ngồi trong buồng lái).
 */
export function makeAircraft(opts = {}) {
  const main = opts.main || '#b3202a', accent = opts.accent || '#1b2a44', reg = opts.reg || 'VN-S4C';
  const root = new THREE.Group();
  const cabin = new THREE.Group(); // phần che tầm nhìn trong buồng lái
  const always = new THREE.Group();
  root.add(cabin, always);

  const L = liveryTexture(main, accent, reg);
  const paint = new THREE.MeshPhysicalMaterial({ map: L.tex(), roughness: 0.32, metalness: 0.05, clearcoat: 0.7, clearcoatRoughness: 0.12 });
  const white = new THREE.MeshPhysicalMaterial({ color: 0xf2f2ee, roughness: 0.32, clearcoat: 0.6, clearcoatRoughness: 0.15 });
  const trim = new THREE.MeshPhysicalMaterial({ color: new THREE.Color(main), roughness: 0.32, clearcoat: 0.6 });
  const glass = new THREE.MeshPhysicalMaterial({ color: 0x0d1a22, roughness: 0.04, metalness: 0.2, transparent: true, opacity: 0.78, clearcoat: 1 });
  const dark = new THREE.MeshStandardMaterial({ color: 0x1c1d1f, roughness: 0.6 });
  const metal = new THREE.MeshStandardMaterial({ color: 0x9aa0a6, roughness: 0.35, metalness: 0.85 });
  const tire = new THREE.MeshStandardMaterial({ color: 0x151515, roughness: 0.9 });

  const mesh = (geo, mat, parent = always) => {
    const m = new THREE.Mesh(geo, mat);
    m.castShadow = true; m.receiveShadow = true;
    parent.add(m);
    return m;
  };

  // nắp động cơ (nhìn thấy cả từ buồng lái)
  mesh(loft([
    [-2.98, 0.5, 0.46, -0.07, 2.2], [-2.85, 0.8, 0.72, -0.06, 2.4], [-2.55, 0.96, 0.88, -0.03, 2.6],
    [-2.1, 1.05, 0.96, 0.0, 2.8], [-1.62, 1.1, 1.0, 0.04, 3.0],
  ]), white);
  // thân cabin + đuôi
  const body = mesh(loft(BODY, 32), paint, cabin);
  // kính chắn gió và cửa sổ (các tấm kính hơi nổi ra ngoài vỏ)
  const ws = new THREE.Mesh(loft([
    [-1.5, 1.08, 1.4, 0.29, 3.2], [-1.3, 1.16, 1.53, 0.27, 3.2], [-0.96, 1.2, 1.88, 0.35, 3.4],
  ], 32), glass);
  // chỉ giữ phần trên của tấm kính
  {
    const p = ws.geometry.attributes.position;
    const keep = [];
    const ix = ws.geometry.index.array;
    for (let i = 0; i < ix.length; i += 3) {
      let ok = true;
      for (let k = 0; k < 3; k++) { const v = ix[i + k]; if (p.getY(v) < 0.62 + (p.getZ(v) + 1.5) * 0.9) ok = false; }
      if (ok) keep.push(ix[i], ix[i + 1], ix[i + 2]);
    }
    ws.geometry.setIndex(keep);
  }
  cabin.add(ws);
  for (const s of [-1, 1]) {
    // cửa sổ hông: tấm kính phẳng uốn theo thân
    const shape = new THREE.Shape();
    shape.moveTo(-0.92, 0.0); shape.lineTo(0.15, 0.0); shape.quadraticCurveTo(0.2, 0.48, 0.1, 0.5); shape.lineTo(-0.85, 0.5); shape.quadraticCurveTo(-1.0, 0.25, -0.92, 0);
    const win = new THREE.Mesh(new THREE.ShapeGeometry(shape), glass);
    win.rotation.y = s * Math.PI / 2;
    win.position.set(s * 0.594, 0.62, 0);
    win.scale.x = -s;
    cabin.add(win);
    const rear = new THREE.Shape();
    rear.moveTo(0.3, 0.02); rear.lineTo(1.05, 0.1); rear.quadraticCurveTo(1.1, 0.3, 0.95, 0.38); rear.lineTo(0.3, 0.46); rear.lineTo(0.3, 0.02);
    const rw = new THREE.Mesh(new THREE.ShapeGeometry(rear), glass);
    rw.rotation.y = s * Math.PI / 2; rw.scale.x = -s;
    rw.position.set(s * 0.568, 0.64, 0);
    cabin.add(rw);
  }

  // cánh trên (cánh cao), có góc nhị diện nhẹ
  const wingY = 1.22, wingLE = -0.95;
  const wingMat = white;
  for (const s of [-1, 1]) {
    mesh(wingGeo(s * 0.5, s * 2.6, 1.6, 1.6, 0.13, 0.02, 0, 0.026), wingMat).position.set(0, wingY, wingLE);
    const outer = mesh(wingGeo(s * 2.6, s * 5.45, 1.6, 1.12, 0.12, 0.02, 0.04, 0.026), wingMat);
    outer.position.set(0, wingY + Math.tan(0.026) * 2.1, wingLE);
    // đèn đầu cánh: trái đỏ, phải xanh
    const navMat = new THREE.MeshBasicMaterial({ color: s < 0 ? 0xff2a1a : 0x1aff5a });
    const nav = new THREE.Mesh(new THREE.SphereGeometry(0.05, 8, 6), navMat);
    nav.position.set(s * 5.48, wingY + 0.18, wingLE + 0.15);
    always.add(nav);
    // thanh chống cánh
    const a = new THREE.Vector3(s * 0.56, -0.42, -0.25), b = new THREE.Vector3(s * 2.65, wingY + 0.08, -0.4);
    const len = a.distanceTo(b);
    const strut = mesh(new THREE.CylinderGeometry(0.035, 0.035, len, 8).scale(2.2, 1, 1), white);
    strut.position.copy(a).add(b).multiplyScalar(0.5);
    strut.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), b.clone().sub(a).normalize());
  }
  // đoạn cánh nối trên nóc
  mesh(wingGeo(-0.5, 0.5, 1.6, 1.6, 0.13, 0.02), wingMat).position.set(0, wingY, wingLE);

  // cánh lái: tà liệng (aileron) và cánh tà (flap) có bản lề
  const surfMat = white;
  const hinge = (x0, x1, chord, z, y, parent = always) => {
    const pivot = new THREE.Group();
    pivot.position.set(0, y, z);
    const m = new THREE.Mesh(wingGeo(x0, x1, chord, chord, 0.08, 0), surfMat);
    m.castShadow = true;
    m.position.z = 0;
    pivot.add(m);
    parent.add(pivot);
    return pivot;
  };
  const ailL = hinge(-5.3, -3.2, 0.34, wingLE + 1.12, wingY + 0.12);
  const ailR = hinge(3.2, 5.3, 0.34, wingLE + 1.12, wingY + 0.12);
  const flapL = hinge(-3.1, -0.6, 0.38, wingLE + 1.22, wingY + 0.06);
  const flapR = hinge(0.6, 3.1, 0.38, wingLE + 1.22, wingY + 0.06);

  // đuôi ngang + cánh lái độ cao
  for (const s of [-1, 1]) mesh(wingGeo(s * 0.1, s * 1.75, 0.95, 0.7, 0.1, 0, 0.12), white).position.set(0, 0.6, 4.55);
  const elev = new THREE.Group();
  elev.position.set(0, 0.6, 5.42);
  for (const s of [-1, 1]) { const e = new THREE.Mesh(wingGeo(s * 0.1, s * 1.7, 0.42, 0.34, 0.08, 0), trim); e.castShadow = true; e.position.x = 0; elev.add(e); }
  always.add(elev);
  // đuôi đứng + bánh lái hướng
  const fin = new THREE.Shape();
  fin.moveTo(0, 0); fin.lineTo(1.55, 0); fin.lineTo(1.5, 1.15); fin.lineTo(1.05, 1.15); fin.lineTo(-0.6, 0.05); fin.lineTo(0, 0);
  const finGeo = new THREE.ExtrudeGeometry(fin, { depth: 0.08, bevelEnabled: true, bevelThickness: 0.02, bevelSize: 0.02, bevelSegments: 2 });
  finGeo.translate(0, 0, -0.04).rotateY(-Math.PI / 2);
  const finM = mesh(finGeo, trim);
  finM.position.set(0, 0.62, 3.95);
  const rud = new THREE.Group();
  rud.position.set(0, 0.62, 5.5);
  const rs = new THREE.Shape();
  rs.moveTo(0, 0); rs.lineTo(0.42, 0.05); rs.lineTo(0.36, 1.12); rs.lineTo(0, 1.15);
  const rg = new THREE.ExtrudeGeometry(rs, { depth: 0.06, bevelEnabled: false }).translate(0, 0, -0.03).rotateY(-Math.PI / 2);
  const rm = new THREE.Mesh(rg, white); rm.castShadow = true; rud.add(rm);
  always.add(rud);
  // số đăng ký trên đuôi
  for (const s of [-1, 1]) {
    const c = document.createElement('canvas'); c.width = 512; c.height = 128;
    const g = c.getContext('2d');
    g.fillStyle = accent; g.font = 'bold 92px Arial, sans-serif'; g.textAlign = 'center'; g.textBaseline = 'middle';
    g.fillText(reg, 256, 66);
    const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace;
    const lbl = new THREE.Mesh(new THREE.PlaneGeometry(1.9, 0.48), new THREE.MeshStandardMaterial({ map: t, transparent: true, roughness: 0.4, polygonOffset: true, polygonOffsetFactor: -2 }));
    lbl.position.set(s * 0.25, 0.62, 2.7);
    lbl.rotation.y = s * Math.PI / 2;
    cabin.add(lbl);
  }

  // càng đáp
  const wheel = (x, y, z, r, w) => {
    const t = mesh(new THREE.TorusGeometry(r * 0.72, r * 0.3, 10, 20).rotateY(Math.PI / 2).scale(w / (r * 0.6), 1, 1), tire);
    t.position.set(x, y, z);
    const hub = mesh(new THREE.CylinderGeometry(r * 0.45, r * 0.45, w * 0.9, 12).rotateZ(Math.PI / 2), metal);
    hub.position.set(x, y, z);
    return t;
  };
  for (const s of [-1, 1]) {
    wheel(s * 1.25, -0.95, 0.35, 0.25, 0.16);
    const leg = mesh(new THREE.BoxGeometry(0.08, 0.04, 1).scale(1, 1, 1), metal);
    const a = new THREE.Vector3(s * 0.45, -0.55, 0.3), b = new THREE.Vector3(s * 1.2, -0.92, 0.35);
    leg.position.copy(a).add(b).multiplyScalar(0.5);
    leg.scale.z = 1;
    leg.geometry = new THREE.BoxGeometry(a.distanceTo(b), 0.05, 0.12);
    leg.rotation.z = Math.atan2(b.y - a.y, b.x - a.x);
    // ốp bánh
    const pant = mesh(loft([[-0.38, 0.05, 0.08, -0.95], [-0.28, 0.2, 0.34, -0.93], [0.0, 0.24, 0.42, -0.9], [0.3, 0.2, 0.32, -0.9], [0.55, 0.04, 0.08, -0.88]], 14), trim);
    pant.position.set(s * 1.25, 0, 0.35);
  }
  const noseGear = new THREE.Group();
  noseGear.position.set(0, -0.45, -1.75);
  always.add(noseGear);
  const nstrut = new THREE.Mesh(new THREE.CylinderGeometry(0.045, 0.045, 0.55, 8), metal);
  nstrut.position.y = -0.25; nstrut.castShadow = true; noseGear.add(nstrut);
  const nw = new THREE.Mesh(new THREE.TorusGeometry(0.16, 0.07, 10, 18).rotateY(Math.PI / 2), tire);
  nw.position.y = -0.52; nw.castShadow = true; noseGear.add(nw);
  const npant = new THREE.Mesh(loft([[-0.32, 0.04, 0.06, -0.52], [-0.2, 0.16, 0.28, -0.5], [0.05, 0.18, 0.34, -0.48], [0.3, 0.03, 0.06, -0.46]], 12), trim);
  npant.castShadow = true; noseGear.add(npant);

  // cánh quạt + chóp
  const prop = new THREE.Group();
  prop.position.set(0, -0.06, -3.02);
  always.add(prop);
  const spinner = new THREE.Mesh(new THREE.ConeGeometry(0.2, 0.42, 20).rotateX(-Math.PI / 2), trim);
  spinner.position.z = -0.12; spinner.castShadow = true; prop.add(spinner);
  const blades = new THREE.Group();
  prop.add(blades);
  const bladeShape = new THREE.Shape();
  bladeShape.moveTo(-0.05, 0.08); bladeShape.quadraticCurveTo(-0.09, 0.5, -0.06, 0.92); bladeShape.lineTo(0.04, 0.95); bladeShape.quadraticCurveTo(0.08, 0.5, 0.05, 0.08);
  const bladeGeo = new THREE.ExtrudeGeometry(bladeShape, { depth: 0.015, bevelEnabled: false });
  const bladeMat = new THREE.MeshStandardMaterial({ color: 0x202224, roughness: 0.5, metalness: 0.4 });
  for (let i = 0; i < 2; i++) {
    const b = new THREE.Mesh(bladeGeo, bladeMat);
    b.rotation.z = i * Math.PI; b.rotation.y = 0.25 * (i ? -1 : 1);
    b.castShadow = true;
    blades.add(b);
  }
  // đĩa mờ khi quay nhanh
  const discMat = new THREE.MeshBasicMaterial({ color: 0x222222, transparent: true, opacity: 0, depthWrite: false, side: THREE.DoubleSide });
  const disc = new THREE.Mesh(new THREE.RingGeometry(0.12, 0.95, 40), discMat);
  prop.add(disc);

  // đèn nháy chống va (đỏ trên đuôi)
  const beacon = new THREE.Mesh(new THREE.SphereGeometry(0.06, 8, 6), new THREE.MeshBasicMaterial({ color: 0xff2020 }));
  beacon.position.set(0, 1.8, 5.05);
  always.add(beacon);

  let propAngle = 0;
  return {
    group: root,
    cabin,
    always,
    /** Hoạt hoạ theo trạng thái điều khiển. */
    animate(dt, ctl, rpm, flapDeg, t) {
      ailL.rotation.x = -ctl.aileron * 0.35; ailR.rotation.x = ctl.aileron * 0.35;
      flapL.rotation.x = flapR.rotation.x = -flapDeg * Math.PI / 180;
      elev.rotation.x = ctl.elevator * 0.35 + ctl.trim * 0.05;
      rud.rotation.y = -ctl.rudder * 0.4;
      noseGear.rotation.y = -ctl.rudder * 0.3;
      propAngle += (rpm / 60) * Math.PI * 2 * dt;
      blades.rotation.z = propAngle;
      const fast = Math.min(1, Math.max(0, (rpm - 500) / 900));
      blades.visible = fast < 0.95;
      bladeMat.transparent = fast > 0.2; bladeMat.opacity = 1 - fast * 0.85;
      discMat.opacity = fast * (root.userData.inside ? 0.07 : 0.2);
      beacon.visible = Math.floor(t * 1.2) % 2 === 0 && (t * 1.2) % 1 < 0.15;
    },
  };
}

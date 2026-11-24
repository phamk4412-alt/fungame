// Buồng lái 3D: vỏ trong có ô kính, bảng đồng hồ, mái che nắng, cần lái kép, cần ga, ghế, la bàn từ.
import * as THREE from 'three';
import { bodyAt } from './plane.js';
import { Panel, PANEL_M, makeOverviewMap } from './gauges.js';
import { heightAt, forestAt } from './terrain.js';

/** Điểm nhìn của phi công (toạ độ thân máy bay). */
export const EYE = new THREE.Vector3(-0.32, 0.76, -0.45);

// các ô kính (toạ độ thân): kính chắn gió ôm hai bên, cửa sổ cửa, cửa sổ sau, kính hậu
const SILL = 0.5;
function isWindow(x, y, z) {
  const ax = Math.abs(x);
  if (z < -0.92 && y > SILL) return true;
  if (ax > 0.3 && z >= -0.92 && z < 0.1 && y > SILL && y < 1.13) return true;
  if (ax > 0.3 && z > 0.3 && z < 1.05 && y > SILL + 0.06 && y < 1.08) return true;
  if (z > 1.15 && z < 1.75 && y > 0.95 && ax < 0.42) return true;
  return false;
}

/** Điểm trên vỏ trong tại (z, góc a). */
function shellPoint(z, a) {
  const [, w, h, yc, e] = bodyAt(z);
  const s = Math.sin(a), c = Math.cos(a);
  return new THREE.Vector3(Math.sign(s) * Math.pow(Math.abs(s), 2 / e) * w * 0.48, yc + Math.sign(c) * Math.pow(Math.abs(c), 2 / e) * h * 0.48, z);
}

/** Điểm trên vỏ ở độ cao y cho trước (phía bên s = ±1). */
function shellAtY(z, y, s) {
  let lo = 0, hi = Math.PI;
  for (let i = 0; i < 30; i++) { const m = (lo + hi) / 2; if (shellPoint(z, m).y > y) lo = m; else hi = m; }
  const p = shellPoint(z, (lo + hi) / 2);
  p.x *= s;
  return p;
}

/** Khung viền ô kính: ống chạy theo chuỗi điểm. */
function frameTube(pts, r, mat, parent) {
  const curve = new THREE.CatmullRomCurve3(pts, false, 'centripetal');
  const m = new THREE.Mesh(new THREE.TubeGeometry(curve, Math.max(8, pts.length * 6), r, 8, false), mat);
  m.castShadow = true; m.receiveShadow = true;
  parent.add(m);
  return m;
}

function shellGeometry() {
  const seg = 128, rows = 190, z0 = -1.6, z1 = 2.3;
  const pos = [], idx = [];
  for (let j = 0; j <= rows; j++) {
    const z = z0 + (z1 - z0) * (j / rows);
    const [, w, h, yc, e] = bodyAt(z);
    for (let i = 0; i <= seg; i++) {
      const a = (i / seg) * Math.PI * 2;
      const s = Math.sin(a), c = Math.cos(a);
      const x = Math.sign(s) * Math.pow(Math.abs(s), 2 / e) * w * 0.485;
      const y = Math.sign(c) * Math.pow(Math.abs(c), 2 / e) * h * 0.485;
      pos.push(x, yc + y, z);
    }
  }
  const P = (k) => [pos[k * 3], pos[k * 3 + 1], pos[k * 3 + 2]];
  for (let j = 0; j < rows; j++) {
    for (let i = 0; i < seg; i++) {
      const a = j * (seg + 1) + i, b = a + 1, c = a + seg + 1, d = c + 1;
      const pa = P(a), pd = P(d);
      const cx = (pa[0] + pd[0]) / 2, cy = (pa[1] + pd[1]) / 2, cz = (pa[2] + pd[2]) / 2;
      if (isWindow(cx, cy, cz)) continue;
      idx.push(a, cc(c), b, b, cc(c), d);
    }
  }
  function cc(v) { return v; }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setIndex(idx);
  g.computeVertexNormals();
  return g;
}

function fabricTexture(base) {
  const c = document.createElement('canvas'); c.width = c.height = 128;
  const g = c.getContext('2d');
  g.fillStyle = base; g.fillRect(0, 0, 128, 128);
  for (let y = 0; y < 128; y += 2) { g.fillStyle = `rgba(255,255,255,${0.02 + (y % 8 === 0 ? 0.04 : 0)})`; g.fillRect(0, y, 128, 1); }
  for (let i = 0; i < 1200; i++) { g.fillStyle = `rgba(0,0,0,${Math.random() * 0.12})`; g.fillRect(Math.random() * 128, Math.random() * 128, 1, 1); }
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.wrapS = t.wrapT = THREE.RepeatWrapping; t.repeat.set(3, 3);
  return t;
}

export function makeCockpit() {
  const root = new THREE.Group();
  const add = (geo, mat, x = 0, y = 0, z = 0, parent = root) => {
    const m = new THREE.Mesh(geo, mat);
    m.position.set(x, y, z);
    m.castShadow = true; m.receiveShadow = true;
    parent.add(m);
    return m;
  };
  const trimMat = new THREE.MeshStandardMaterial({ color: 0xb9b4a8, roughness: 0.82, side: THREE.DoubleSide });
  const plastic = new THREE.MeshStandardMaterial({ color: 0x8f8a80, roughness: 0.8 });
  const black = new THREE.MeshStandardMaterial({ color: 0x18191b, roughness: 0.75 });
  const leather = new THREE.MeshStandardMaterial({ color: 0x2c2d30, roughness: 0.95 });
  const chrome = new THREE.MeshStandardMaterial({ color: 0xcfd3d6, roughness: 0.2, metalness: 1 });
  const seatMat = new THREE.MeshStandardMaterial({ map: fabricTexture('#2a3448'), roughness: 0.95 });

  // vỏ trong (nhìn từ bên trong)
  const shell = add(shellGeometry(), trimMat);
  shell.castShadow = true;
  // trụ giữa kính chắn gió
  const post = add(new THREE.BoxGeometry(0.03, 0.82, 0.03), trimMat, 0, 0.92, -1.24);
  post.rotation.x = 0.73;
  const frameMat = new THREE.MeshStandardMaterial({ color: 0x9d988e, roughness: 0.75 });
  for (const sd of [-1, 1]) {
    // trụ A: từ chân kính chắn gió lên mép mái
    const pa = [];
    for (let i = 0; i <= 6; i++) { const t = i / 6; pa.push(shellAtY(-1.5 + t * 0.58, SILL + t * 0.7, sd).multiplyScalar(0.985)); }
    frameTube(pa, 0.028, frameMat, root);
    // bậu cửa sổ + mép trên
    const sill = [], top = [];
    for (let z = -1.56; z <= 1.06; z += 0.08) { sill.push(shellAtY(z, SILL + (z > 0.3 ? 0.06 : 0), sd).multiplyScalar(0.99)); top.push(shellAtY(z, z > 0.3 ? 1.08 : 1.13, sd).multiplyScalar(0.99)); }
    frameTube(sill, 0.034, frameMat, root);
    frameTube(top.filter((p) => p.z >= -0.94), 0.03, frameMat, root);
    // trụ B giữa hai cửa sổ + mép trước cửa
    for (const z of [0.2, 1.05]) {
      const pb = [];
      for (let y = SILL; y <= 1.13; y += 0.1) pb.push(shellAtY(z, y, sd).multiplyScalar(0.985));
      frameTube(pb, z === 0.2 ? 0.07 : 0.03, frameMat, root);
    }
    // mép dưới kính chắn gió
    const ws = [];
    for (let k = 0; k <= 6; k++) ws.push(shellAtY(-1.58 + k * 0.01, 0.6, sd).multiplyScalar(0.97));
  }
  // mép trên kính chắn gió (chạy ngang mái)
  const wtop = [];
  for (let k = 0; k <= 12; k++) { const a = -0.9 + k * 0.15; const p = shellPoint(-0.92, a).multiplyScalar(0.985); p.z = -0.92; wtop.push(p); }
  frameTube(wtop, 0.03, frameMat, root);
  // sàn
  add(new THREE.BoxGeometry(1.12, 0.03, 3.2), new THREE.MeshStandardMaterial({ color: 0x2b2a28, roughness: 1 }), 0, -0.52, 0.35);

  // bảng đồng hồ
  const overview = makeOverviewMap(heightAt, forestAt);
  const panel = new Panel(overview);
  const tex = new THREE.CanvasTexture(panel.canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 8;
  tex.generateMipmaps = true;
  const panelMat = new THREE.MeshStandardMaterial({ map: tex, roughness: 0.6, emissive: 0xffffff, emissiveMap: tex, emissiveIntensity: 0.32 });
  const pm = add(new THREE.PlaneGeometry(PANEL_M.w, PANEL_M.h), panelMat, 0, 0.08 + PANEL_M.h / 2, -1.22);
  pm.rotation.x = -0.08;
  pm.castShadow = false;
  add(new THREE.BoxGeometry(PANEL_M.w + 0.02, PANEL_M.h + 0.02, 0.06), black, 0, 0.08 + PANEL_M.h / 2, -1.255).rotation.x = -0.08;
  // phần dưới panel (khoang chân) + cụm cần ga
  add(new THREE.BoxGeometry(1.12, 0.2, 0.08), black, 0, -0.03, -1.2).rotation.x = 0.2;
  add(new THREE.BoxGeometry(0.2, 0.32, 0.5), black, 0, -0.32, -1.05);
  // mái che nắng trên panel
  const glare = add(new THREE.BoxGeometry(1.1, 0.04, 0.3), leather, 0, 0.5, -1.36);
  glare.rotation.x = 0.1;
  const lip = add(new THREE.CylinderGeometry(0.025, 0.025, 1.1, 10).rotateZ(Math.PI / 2), leather, 0, 0.49, -1.21);
  lip.scale.set(1, 1, 1);

  // cần ga đen + cần hỗn hợp đỏ + cần sấy chế hoà khí
  const knob = (col) => {
    const g = new THREE.Group();
    const m = new THREE.MeshStandardMaterial({ color: col, roughness: 0.4 });
    add(new THREE.CylinderGeometry(0.006, 0.006, 0.14, 8).rotateX(Math.PI / 2), chrome, 0, 0, 0.0, g);
    add(new THREE.CylinderGeometry(0.022, 0.022, 0.03, 16).rotateX(Math.PI / 2), m, 0, 0, 0.07, g);
    root.add(g);
    return g;
  };
  const throttle = knob(0x111111); throttle.position.set(-0.02, 0.01, -1.24);
  const mixture = knob(0xb01010); mixture.position.set(0.07, 0.01, -1.24);
  const carb = knob(0x777777); carb.position.set(-0.11, 0.01, -1.24);
  // bánh xe chỉnh trim
  const trimWheel = add(new THREE.CylinderGeometry(0.07, 0.07, 0.025, 24).rotateZ(Math.PI / 2), black, 0.0, -0.3, -0.85);
  for (let i = 0; i < 12; i++) add(new THREE.BoxGeometry(0.03, 0.006, 0.006), plastic, 0, Math.cos(i / 12 * 6.28) * 0.07, Math.sin(i / 12 * 6.28) * 0.07, trimWheel);

  // cần lái kép (sừng cừu)
  const yokeGroups = [];
  for (const x of [-0.32, 0.3]) {
    const col = new THREE.Group();
    col.position.set(x, 0.18, -1.22);
    root.add(col);
    add(new THREE.CylinderGeometry(0.016, 0.016, 0.3, 10).rotateX(Math.PI / 2), chrome, 0, 0, 0.1, col);
    const wheel = new THREE.Group();
    wheel.position.set(0, 0, 0.2);
    col.add(wheel);
    const curve = new THREE.CatmullRomCurve3([
      new THREE.Vector3(-0.15, 0.06, 0), new THREE.Vector3(-0.14, -0.02, 0), new THREE.Vector3(-0.08, -0.06, 0),
      new THREE.Vector3(0.08, -0.06, 0), new THREE.Vector3(0.14, -0.02, 0), new THREE.Vector3(0.15, 0.06, 0),
    ]);
    add(new THREE.TubeGeometry(curve, 40, 0.017, 10), black, 0, 0, 0, wheel);
    for (const s of [-1, 1]) add(new THREE.CapsuleGeometry(0.02, 0.07, 4, 10), black, s * 0.152, 0.09, 0, wheel);
    const hub = add(new THREE.BoxGeometry(0.11, 0.06, 0.04), black, 0, -0.03, 0.0, wheel);
    hub.scale.set(1, 1, 1);
    const badge = add(new THREE.CircleGeometry(0.018, 20), chrome, 0, -0.03, 0.021, wheel);
    badge.castShadow = false;
    yokeGroups.push({ col, wheel });
  }

  // ghế
  for (const x of [-0.32, 0.3]) {
    add(new THREE.BoxGeometry(0.46, 0.12, 0.5), seatMat, x, -0.24, -0.15);
    const back = add(new THREE.BoxGeometry(0.46, 0.7, 0.12), seatMat, x, 0.14, 0.15);
    back.rotation.x = -0.18;
    add(new THREE.BoxGeometry(0.26, 0.16, 0.08), seatMat, x, 0.6, 0.24).rotation.x = -0.18;
  }
  add(new THREE.BoxGeometry(1.0, 0.14, 0.5), seatMat, 0, -0.24, 0.95);
  add(new THREE.BoxGeometry(1.0, 0.6, 0.12), seatMat, 0, 0.12, 1.22).rotation.x = -0.15;
  // tay vịn cửa + tay nắm
  for (const s of [-1, 1]) {
    add(new THREE.BoxGeometry(0.06, 0.05, 0.55), new THREE.MeshStandardMaterial({ color: 0x77726a, roughness: 0.85 }), s * 0.53, 0.26, -0.35);
  }
  // vách sau
  add(new THREE.CircleGeometry(0.55, 24), trimMat, 0, 0.45, 1.7).scale.set(1, 1.35, 1);

  // la bàn từ trên đỉnh kính
  const cmpC = document.createElement('canvas'); cmpC.width = 256; cmpC.height = 64;
  const cmpTex = new THREE.CanvasTexture(cmpC); cmpTex.colorSpace = THREE.SRGBColorSpace;
  const compass = new THREE.Group(); compass.position.set(0, 1.06, -0.98); root.add(compass);
  add(new THREE.BoxGeometry(0.09, 0.07, 0.07), black, 0, 0, 0, compass);
  const cmpFace = add(new THREE.PlaneGeometry(0.07, 0.035), new THREE.MeshBasicMaterial({ map: cmpTex }), 0, -0.004, 0.0355, compass);
  cmpFace.castShadow = false;
  add(new THREE.CylinderGeometry(0.006, 0.006, 0.08), black, 0, 0.07, -0.02, compass);
  const drawCompass = (hdg) => {
    const g = cmpC.getContext('2d');
    g.fillStyle = '#0c0c0c'; g.fillRect(0, 0, 256, 64);
    g.fillStyle = '#eee'; g.font = 'bold 26px Arial'; g.textAlign = 'center'; g.textBaseline = 'middle';
    for (let d = -40; d <= 40; d += 5) {
      const v = (Math.round(hdg / 5) * 5 + d + 360) % 360;
      const x = 128 + (v - hdg + (v - hdg > 180 ? -360 : v - hdg < -180 ? 360 : 0)) * 3.4;
      g.fillRect(x - 1, 46, 2, v % 10 === 0 ? 14 : 8);
      if (v % 30 === 0) g.fillText({ 0: 'N', 90: 'E', 180: 'S', 270: 'W' }[v] || String(v / 10), x, 24);
    }
    g.fillStyle = '#ff8a1a'; g.fillRect(127, 0, 3, 64);
    cmpTex.needsUpdate = true;
  };

  let acc = 0;
  return {
    group: root,
    panel,
    /** Cập nhật đồng hồ (~30 Hz) và các bộ phận chuyển động. */
    update(dt, ctl, st) {
      for (const y of yokeGroups) {
        y.col.position.z = -1.22 + 0.06 - ctl.elevator * 0.07;
        y.wheel.rotation.z = -ctl.aileron * 0.6;
      }
      throttle.position.z = -1.24 + (1 - ctl.throttle) * 0.07;
      mixture.position.z = -1.24 + (st.rpm < 100 ? 0.07 : 0);
      trimWheel.rotation.x = ctl.trim * 4;
      compass.rotation.z = Math.max(-0.3, Math.min(0.3, -st.roll * Math.PI / 180 * 0.2));
      acc += dt;
      if (acc > 1 / 30) {
        acc = 0;
        panel.draw(st);
        tex.needsUpdate = true;
        drawCompass(st.hdg + Math.sin(st.time / 900) * 1.5);
      }
    },
  };
}

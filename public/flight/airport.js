// Sân bay: đường băng có vạch sơn, đường lăn, sân đỗ, nhà chứa, đài kiểm soát, ống gió, đèn lề.
import * as THREE from 'three';
import { WORLD } from './terrain.js';

function canvasTex(w, h, draw, repeat) {
  const c = document.createElement('canvas');
  c.width = w; c.height = h;
  draw(c.getContext('2d'), w, h);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 8;
  if (repeat) { t.wrapS = t.wrapT = THREE.RepeatWrapping; t.repeat.set(repeat[0], repeat[1]); }
  return t;
}

function asphalt(g, w, h, base) {
  g.fillStyle = base; g.fillRect(0, 0, w, h);
  let s = 3;
  const r = () => ((s = (Math.imul(s, 1103515245) + 12345) >>> 0) / 4294967296);
  for (let i = 0; i < w * h * 0.18; i++) {
    const v = Math.floor(r() * 60) - 30;
    g.fillStyle = `rgba(${v > 0 ? 255 : 0},${v > 0 ? 255 : 0},${v > 0 ? 255 : 0},${Math.abs(v) / 400})`;
    g.fillRect(r() * w, r() * h, 1 + r() * 2, 1 + r() * 2);
  }
  // vệt cao su và vết vá
  for (let i = 0; i < 14; i++) {
    g.fillStyle = `rgba(20,20,20,${0.05 + r() * 0.08})`;
    g.fillRect(r() * w, r() * h, 10 + r() * 60, 10 + r() * 90);
  }
}

/** Dựng sân bay và thêm vào scene. Trả về các đối tượng động (ống gió, đèn). */
export function buildAirport(scene, makePlane) {
  const A = WORLD.airport, R = WORLD.runway;
  const y = A.elev + 0.04;
  const group = new THREE.Group();
  scene.add(group);

  // đường băng chính
  const rwTex = canvasTex(512, 512, (g, w, h) => asphalt(g, w, h, '#626361'), [2, 60]);
  const rwMat = new THREE.MeshStandardMaterial({ map: rwTex, roughness: 0.88, polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2 });
  const rw = new THREE.Mesh(new THREE.PlaneGeometry(R.width + 6, R.length + 60).rotateX(-Math.PI / 2), rwMat);
  rw.position.set(R.x, y, R.z);
  rw.receiveShadow = true;
  group.add(rw);

  // vạch sơn: tim đường, vạch thềm, số hiệu, vạch chạm bánh, vạch lề
  const paint = new THREE.MeshStandardMaterial({ color: 0xeeeeea, roughness: 0.7, polygonOffset: true, polygonOffsetFactor: -4, polygonOffsetUnits: -4 });
  const marks = [];
  const add = (x, z, w, l) => marks.push([x, z, w, l]);
  const half = R.length / 2;
  for (let z = -half + 120; z < half - 120; z += 50) add(0, z + 15, 0.9, 30);
  for (const s of [-1, 1]) {
    const zt = s * (half - 12);
    for (let i = 0; i < 6; i++) { add(-2.3 - i * 2.4, zt, 1.6, 30); add(2.3 + i * 2.4, zt, 1.6, 30); }
    const za = s * (half - 300);
    add(-7, za, 4, 45); add(7, za, 4, 45);
    for (const k of [450, 600]) { add(-6, s * (half - k), 1.8, 22); add(6, s * (half - k), 1.8, 22); }
  }
  add(-R.width / 2 + 0.5, 0, 0.9, R.length); add(R.width / 2 - 0.5, 0, 0.9, R.length);
  const mg = new THREE.PlaneGeometry(1, 1).rotateX(-Math.PI / 2);
  const im = new THREE.InstancedMesh(mg, paint, marks.length);
  const m = new THREE.Matrix4();
  marks.forEach(([x, z, w, l], i) => { m.makeScale(w, 1, l); m.setPosition(R.x + x, y + 0.02, R.z + z); im.setMatrixAt(i, m); });
  im.receiveShadow = true;
  group.add(im);

  // số hiệu đường băng
  for (const [num, s] of [['36', 1], ['18', -1]]) {
    const t = canvasTex(256, 512, (g, w, h) => {
      g.clearRect(0, 0, w, h);
      g.fillStyle = '#f0f0ec';
      g.font = 'bold 300px Arial, Helvetica, sans-serif';
      g.textAlign = 'center'; g.textBaseline = 'middle';
      g.save(); g.translate(w / 2, h / 2); g.scale(0.5, 1.5); g.fillText(num, 0, 0); g.restore();
    });
    const mesh = new THREE.Mesh(new THREE.PlaneGeometry(12, 24).rotateX(-Math.PI / 2),
      new THREE.MeshStandardMaterial({ map: t, transparent: true, roughness: 0.7, polygonOffset: true, polygonOffsetFactor: -4, polygonOffsetUnits: -4 }));
    mesh.position.set(R.x, y + 0.02, R.z + s * (half - 48));
    if (s < 0) mesh.rotation.y = Math.PI;
    group.add(mesh);
  }

  // đường lăn và sân đỗ
  const twTex = canvasTex(256, 256, (g, w, h) => asphalt(g, w, h, '#454643'), [1, 40]);
  const twMat = new THREE.MeshStandardMaterial({ map: twTex, roughness: 0.9, polygonOffset: true, polygonOffsetFactor: -1, polygonOffsetUnits: -1 });
  const slab = (x, z, w, l, mat = twMat) => {
    const s = new THREE.Mesh(new THREE.PlaneGeometry(w, l).rotateX(-Math.PI / 2), mat);
    s.position.set(x, y - 0.01, z); s.receiveShadow = true; group.add(s);
    return s;
  };
  const twX = R.x + 130;
  slab(twX, 0, 16, R.length - 40);
  for (const z of [-half + 40, 0, half - 40]) slab((R.x + twX) / 2, z, 115, 16);
  const apTex = canvasTex(512, 512, (g, w, h) => {
    asphalt(g, w, h, '#585955');
    g.strokeStyle = 'rgba(230,200,40,0.85)'; g.lineWidth = 3;
    for (let i = 0; i < 5; i++) { g.beginPath(); g.moveTo(60 + i * 90, 40); g.lineTo(60 + i * 90, 300); g.stroke(); }
    g.beginPath(); g.moveTo(0, 470); g.lineTo(w, 470); g.stroke();
  });
  const apMat = new THREE.MeshStandardMaterial({ map: apTex, roughness: 0.9, polygonOffset: true, polygonOffsetFactor: -1, polygonOffsetUnits: -1 });
  const apron = slab(twX + 110, 120, 190, 260, apMat);
  apron.rotation.y = -Math.PI / 2;
  // vạch vàng tim đường lăn
  const yel = new THREE.MeshBasicMaterial({ color: 0xd8b632, polygonOffset: true, polygonOffsetFactor: -3, polygonOffsetUnits: -3 });
  const yl = new THREE.Mesh(new THREE.PlaneGeometry(0.4, R.length - 40).rotateX(-Math.PI / 2), yel);
  yl.position.set(twX, y + 0.01, 0); group.add(yl);

  // nhà chứa máy bay mái vòm
  const hangarMat = new THREE.MeshStandardMaterial({ color: 0xb9bec2, roughness: 0.45, metalness: 0.6 });
  const doorMat = new THREE.MeshStandardMaterial({ color: 0x6d7378, roughness: 0.6, metalness: 0.5 });
  for (let i = 0; i < 3; i++) {
    const hz = -60 + i * 55;
    const shell = new THREE.Mesh(new THREE.CylinderGeometry(14, 14, 40, 24, 1, false, 0, Math.PI).rotateZ(Math.PI / 2).rotateY(Math.PI / 2), hangarMat);
    shell.position.set(twX + 245, y, hz);
    shell.rotation.y = Math.PI / 2;
    shell.castShadow = shell.receiveShadow = true;
    group.add(shell);
    const door = new THREE.Mesh(new THREE.CircleGeometry(13.8, 24, 0, Math.PI), doorMat);
    door.position.set(twX + 225, y, hz); door.rotation.y = -Math.PI / 2;
    group.add(door);
  }
  // nhà ga + đài kiểm soát
  const bld = new THREE.MeshStandardMaterial({ color: 0xe9e4d8, roughness: 0.8 });
  const glass = new THREE.MeshStandardMaterial({ color: 0x1d2a33, roughness: 0.08, metalness: 0.9 });
  const term = new THREE.Mesh(new THREE.BoxGeometry(24, 8, 70), bld);
  term.position.set(twX + 235, y + 4, 230); term.castShadow = term.receiveShadow = true; group.add(term);
  const strip = new THREE.Mesh(new THREE.BoxGeometry(24.2, 2.2, 66), glass);
  strip.position.set(twX + 235, y + 4.6, 230); group.add(strip);
  const tw = new THREE.Mesh(new THREE.CylinderGeometry(2.8, 3.4, 22, 12), bld);
  tw.position.set(twX + 230, y + 11, 290); tw.castShadow = true; group.add(tw);
  const cab = new THREE.Mesh(new THREE.CylinderGeometry(5.2, 4.2, 4, 8), glass);
  cab.position.set(twX + 230, y + 24, 290); group.add(cab);
  const capm = new THREE.Mesh(new THREE.CylinderGeometry(5.8, 5.8, 0.8, 8), bld);
  capm.position.set(twX + 230, y + 26.4, 290); group.add(capm);
  // đèn hiệu xoay trên đài
  const beacon = new THREE.Mesh(new THREE.SphereGeometry(0.6, 8, 6), new THREE.MeshBasicMaterial({ color: 0x66ff88 }));
  beacon.position.set(twX + 230, y + 27.5, 290); group.add(beacon);

  // ống gió
  const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.1, 6, 6), new THREE.MeshStandardMaterial({ color: 0xdddddd }));
  pole.position.set(R.x - 40, y + 3, R.z + half - 260); group.add(pole);
  const sockTex = canvasTex(64, 16, (g) => { for (let i = 0; i < 5; i++) { g.fillStyle = i % 2 ? '#f2f2f2' : '#ff5a1f'; g.fillRect(i * 13, 0, 13, 16); } });
  const sock = new THREE.Mesh(new THREE.CylinderGeometry(0.25, 0.45, 3.2, 10, 1, true).rotateZ(Math.PI / 2).translate(1.6, 0, 0),
    new THREE.MeshStandardMaterial({ map: sockTex, side: THREE.DoubleSide, roughness: 0.8 }));
  sock.position.set(R.x - 40, y + 5.8, R.z + half - 260);
  sock.rotation.y = -0.6;
  sock.castShadow = true;
  group.add(sock);

  // đèn lề đường băng + đèn thềm xanh/đỏ (luôn sáng nhẹ)
  const lightGeo = new THREE.SphereGeometry(0.22, 6, 4);
  const white = new THREE.MeshBasicMaterial({ color: 0xfff3c8 });
  const pos = [];
  for (let z = -half; z <= half; z += 60) { pos.push([R.x - R.width / 2 - 2, z]); pos.push([R.x + R.width / 2 + 2, z]); }
  const li = new THREE.InstancedMesh(lightGeo, white, pos.length);
  pos.forEach(([x, z], i) => { m.makeTranslation(x, y + 0.35, R.z + z); li.setMatrixAt(i, m); });
  group.add(li);
  const greens = [];
  for (let x = -R.width / 2; x <= R.width / 2; x += 3) { greens.push([x, -half - 3]); greens.push([x, half + 3]); }
  const gi = new THREE.InstancedMesh(lightGeo, new THREE.MeshBasicMaterial({ color: 0x46ff7a }), greens.length);
  greens.forEach(([x, z], i) => { m.makeTranslation(R.x + x, y + 0.35, R.z + z); gi.setMatrixAt(i, m); });
  group.add(gi);
  // đèn PAPI bên trái thềm 36
  const papi = [];
  for (let i = 0; i < 4; i++) {
    const b = new THREE.Mesh(new THREE.BoxGeometry(1.2, 0.8, 0.6), new THREE.MeshBasicMaterial({ color: 0xffffff }));
    b.position.set(R.x - R.width / 2 - 14 - i * 9, y + 0.5, R.z + half - 300);
    group.add(b);
    papi.push(b);
  }

  // máy bay đỗ trên sân
  if (makePlane) {
    const liveries = [['#c0392b', '#2c3e50'], ['#1f5fa8', '#f1c40f'], ['#2e7d32', '#e8e8e8']];
    liveries.forEach((lv, i) => {
      const p = makePlane(lv, 'VN-' + ['B3K', 'C7M', 'D2H'][i]);
      p.position.set(twX + 150, y + 1.2, 40 + i * 28);
      p.rotation.y = Math.PI / 2;
      group.add(p);
    });
  }

  return {
    sock, beacon, papi,
    update(t, wind, planePos) {
      sock.rotation.y = Math.atan2(wind[2], -wind[0]) + Math.sin(t * 1.3) * 0.08;
      beacon.material.color.setHex(Math.sin(t * 3) > 0 ? 0x66ff88 : 0xffffff);
      // PAPI: trắng nếu trên đường trượt 3°, đỏ nếu thấp
      if (planePos) {
        const dz = planePos[2] - (R.z + half - 300);
        const ang = Math.atan2(planePos[1] - A.elev, Math.max(1, dz)) * 180 / Math.PI;
        const lim = [3.5, 3.17, 2.83, 2.5];
        papi.forEach((b, i) => b.material.color.setHex(dz > 0 && ang > lim[i] ? 0xffffff : 0xff2a1a));
      }
    },
  };
}

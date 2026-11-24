// Bảng đồng hồ buồng lái vẽ bằng Canvas 2D: sáu đồng hồ bay cơ bản, vòng tua, nhiên liệu,
// màn hình bản đồ GPS, radio, công tắc. Vẽ lại ~30 lần/giây làm texture cho tấm panel 3D.

export const PANEL_W = 2048, PANEL_H = 720;
export const PANEL_M = { w: 1.12, h: 1.12 * PANEL_H / PANEL_W }; // kích thước thật (m)
const PX = PANEL_W / PANEL_M.w;
/** Toạ độ canvas của điểm x (m) trên panel. */
const X = (m) => (m + PANEL_M.w / 2) * PX;

const R6 = 86; // bán kính đồng hồ chính
const PILOT = X(-0.32);
export const LAYOUT = {
  asi: [PILOT - 196, 200], ai: [PILOT, 200], alt: [PILOT + 196, 200],
  tc: [PILOT - 196, 420], hi: [PILOT, 420], vsi: [PILOT + 196, 420],
  clock: [70, 150], amp: [70, 330], tach: [PILOT + 400, 305], vac: [PILOT + 400, 120],
  gps: [928, 60, 300, 300], radio: [928, 378, 300, 120],
  fuelL: [1310, 150], fuelR: [1470, 150], oilT: [1630, 150], oilP: [1790, 150], egt: [1950, 150],
  flaps: [1320, 330], gmeter: [1470, 410],
};

const FONT = '"Arial Narrow", Arial, Helvetica, sans-serif';
const rad = (d) => (d * Math.PI) / 180;

function screw(g, x, y) {
  const gr = g.createRadialGradient(x - 2, y - 2, 1, x, y, 7);
  gr.addColorStop(0, '#b9bcc0'); gr.addColorStop(1, '#3a3c40');
  g.fillStyle = gr; g.beginPath(); g.arc(x, y, 6, 0, Math.PI * 2); g.fill();
  g.strokeStyle = '#222'; g.lineWidth = 1.5; g.beginPath(); g.moveTo(x - 4, y - 1); g.lineTo(x + 4, y + 1); g.stroke();
}

/** Vành đồng hồ tròn có bóng đổ, ốc vít, mặt đen. */
function bezel(g, x, y, r, screws = true) {
  g.save();
  g.shadowColor = 'rgba(0,0,0,0.7)'; g.shadowBlur = 18; g.shadowOffsetY = 6;
  g.fillStyle = '#1a1b1d'; g.fillRect(x - r - 14, y - r - 14, 2 * r + 28, 2 * r + 28);
  g.restore();
  const gr = g.createLinearGradient(x - r, y - r, x + r, y + r);
  gr.addColorStop(0, '#4a4d52'); gr.addColorStop(0.5, '#222427'); gr.addColorStop(1, '#0c0d0e');
  g.fillStyle = gr; g.beginPath(); g.arc(x, y, r + 9, 0, Math.PI * 2); g.fill();
  g.fillStyle = '#060607'; g.beginPath(); g.arc(x, y, r, 0, Math.PI * 2); g.fill();
  if (screws) { const d = r + 3; screw(g, x - d, y - d); screw(g, x + d, y - d); screw(g, x - d, y + d); screw(g, x + d, y + d); }
}

function glass(g, x, y, r) {
  const gr = g.createLinearGradient(x - r, y - r, x + r * 0.2, y + r * 0.4);
  gr.addColorStop(0, 'rgba(255,255,255,0.13)'); gr.addColorStop(0.45, 'rgba(255,255,255,0.03)'); gr.addColorStop(1, 'rgba(255,255,255,0)');
  g.fillStyle = gr; g.beginPath(); g.arc(x, y, r, 0, Math.PI * 2); g.fill();
}

/** Vạch chia + số trên mặt đồng hồ; góc tính theo độ từ 12 giờ, theo chiều kim đồng hồ. */
function scale(g, x, y, r, a0, a1, v0, v1, major, minor, label, fmt = (v) => v) {
  g.strokeStyle = '#f2f2f2'; g.fillStyle = '#f2f2f2';
  for (let v = v0; v <= v1 + 1e-6; v += minor) {
    const a = rad(a0 + ((v - v0) / (v1 - v0)) * (a1 - a0));
    const isMaj = Math.abs(v / major - Math.round(v / major)) < 1e-6;
    const l = isMaj ? 14 : 7;
    g.lineWidth = isMaj ? 3 : 1.6;
    g.beginPath();
    g.moveTo(x + Math.sin(a) * r * 0.97, y - Math.cos(a) * r * 0.97);
    g.lineTo(x + Math.sin(a) * (r * 0.97 - l), y - Math.cos(a) * (r * 0.97 - l));
    g.stroke();
    if (isMaj && label) {
      g.font = `bold ${Math.round(r * 0.2)}px ${FONT}`; g.textAlign = 'center'; g.textBaseline = 'middle';
      g.fillText(fmt(v), x + Math.sin(a) * r * 0.7, y - Math.cos(a) * r * 0.7);
    }
  }
}

function arcBand(g, x, y, r, a0, a1, col, w = 7) {
  g.strokeStyle = col; g.lineWidth = w;
  g.beginPath(); g.arc(x, y, r, rad(a0 - 90), rad(a1 - 90)); g.stroke();
}

function needle(g, x, y, ang, len, w = 5, col = '#f6f6f2', tail = 0.18) {
  g.save();
  g.translate(x, y); g.rotate(rad(ang));
  g.shadowColor = 'rgba(0,0,0,0.6)'; g.shadowBlur = 6; g.shadowOffsetX = 3; g.shadowOffsetY = 4;
  g.fillStyle = col;
  g.beginPath();
  g.moveTo(-w / 2, len * tail); g.lineTo(-w / 2, -len * 0.82); g.lineTo(0, -len); g.lineTo(w / 2, -len * 0.82); g.lineTo(w / 2, len * tail);
  g.closePath(); g.fill();
  g.restore();
  g.fillStyle = '#2a2a2a'; g.beginPath(); g.arc(x, y, w + 3, 0, Math.PI * 2); g.fill();
}

function text(g, s, x, y, size, col = '#e8e8e8', align = 'center', weight = 'bold') {
  g.font = `${weight} ${size}px ${FONT}`; g.fillStyle = col; g.textAlign = align; g.textBaseline = 'middle';
  g.fillText(s, x, y);
}

function rect(g, x, y, w, h, r) {
  g.beginPath();
  g.moveTo(x + r, y); g.arcTo(x + w, y, x + w, y + h, r); g.arcTo(x + w, y + h, x, y + h, r);
  g.arcTo(x, y + h, x, y, r); g.arcTo(x, y, x + w, y, r); g.closePath();
}

// ---------- lớp tĩnh ----------
function drawStatic(g) {
  // nền panel: sơn xám nhám
  const gr = g.createLinearGradient(0, 0, 0, PANEL_H);
  gr.addColorStop(0, '#3b3e42'); gr.addColorStop(1, '#2b2d30');
  g.fillStyle = gr; g.fillRect(0, 0, PANEL_W, PANEL_H);
  let s = 11;
  const rnd = () => ((s = (Math.imul(s, 1103515245) + 12345) >>> 0) / 4294967296);
  for (let i = 0; i < 26000; i++) { g.fillStyle = `rgba(${rnd() > 0.5 ? 255 : 0},${rnd() > 0.5 ? 255 : 0},255,0.025)`; g.fillRect(rnd() * PANEL_W, rnd() * PANEL_H, 2, 2); }
  // mép trên tối do mái che nắng
  const sh = g.createLinearGradient(0, 0, 0, 60);
  sh.addColorStop(0, 'rgba(0,0,0,0.55)'); sh.addColorStop(1, 'rgba(0,0,0,0)');
  g.fillStyle = sh; g.fillRect(0, 0, PANEL_W, 60);
  // khung đen cụm sáu đồng hồ
  g.fillStyle = 'rgba(0,0,0,0.25)'; rect(g, PILOT - 310, 90, 620, 440, 18); g.fill();

  for (const k of ['asi', 'ai', 'alt', 'tc', 'hi', 'vsi']) bezel(g, ...LAYOUT[k], R6);
  for (const k of ['clock', 'amp']) bezel(g, ...LAYOUT[k], 50);
  bezel(g, ...LAYOUT.tach, 80); bezel(g, ...LAYOUT.vac, 52);
  for (const k of ['fuelL', 'fuelR', 'oilT', 'oilP', 'egt']) bezel(g, ...LAYOUT[k], 58);
  bezel(g, ...LAYOUT.gmeter, 64);

  // nhãn
  text(g, 'SẢI CÁNH  SC-4', 1640, 300, 30, '#c9c9c4');
  text(g, 'TỐC ĐỘ CẤM VƯỢT 163 KT', 1640, 340, 20, '#a8a8a2', 'center', 'normal');
  text(g, 'BAY NGOẠN MỤC BỊ CẤM', 1640, 366, 20, '#a8a8a2', 'center', 'normal');
  // hộc đựng đồ bên phải
  g.strokeStyle = 'rgba(0,0,0,0.5)'; g.lineWidth = 4; rect(g, 1590, 430, 420, 200, 14); g.stroke();
  g.fillStyle = '#1b1c1e'; rect(g, 1960, 515, 28, 40, 6); g.fill();

  // hàng công tắc
  const sw = ['MASTER', 'BEACON', 'LAND', 'TAXI', 'NAV', 'STROBE', 'PITOT'];
  sw.forEach((n, i) => {
    const x = 120 + i * 84, y = 620;
    g.fillStyle = '#121314'; rect(g, x - 22, y - 34, 44, 68, 6); g.fill();
    g.fillStyle = i === 6 ? '#555' : '#e6e6e0'; rect(g, x - 13, y - 30, 26, 32, 4); g.fill();
    g.fillStyle = '#333'; rect(g, x - 13, y + 2, 26, 26, 4); g.fill();
    text(g, n, x, y + 54, 16, '#d6d6d0');
  });
  // khoá điện
  g.fillStyle = '#0d0d0e'; g.beginPath(); g.arc(80, 500, 30, 0, Math.PI * 2); g.fill();
  g.fillStyle = '#9da0a4'; g.fillRect(74, 478, 12, 44);
  text(g, 'OFF  R  L  BOTH  START', 80, 548, 13, '#cfcfca');
  // nút cầu dao
  for (let i = 0; i < 9; i++) { g.fillStyle = '#0b0b0c'; g.beginPath(); g.arc(1300 + i * 46, 680, 12, 0, Math.PI * 2); g.fill(); }
  text(g, 'CẦU DAO', 1500, 650, 16, '#bdbdb8');

  // nhãn đồng hồ nhỏ
  text(g, 'CÁNH TÀ', LAYOUT.flaps[0], 270, 18);
}

// ---------- từng đồng hồ ----------
function asi(g, kt) {
  const [x, y] = LAYOUT.asi, r = R6;
  const A = (v) => 15 + Math.min(200, Math.max(0, v)) * 1.62;
  arcBand(g, x, y, r * 0.93, A(33), A(85), '#f4f4f4', 6);
  arcBand(g, x, y, r * 0.86, A(48), A(129), '#28a745', 7);
  arcBand(g, x, y, r * 0.86, A(129), A(163), '#f2c230', 7);
  g.save(); g.translate(x, y); g.rotate(rad(A(163))); g.fillStyle = '#e02020'; g.fillRect(-2, -r, 4, 18); g.restore();
  scale(g, x, y, r, A(0), A(200), 0, 200, 20, 5, true, (v) => (v >= 40 ? v : ''));
  text(g, 'KNOTS', x, y + 30, 15); text(g, 'TỐC ĐỘ', x, y - 30, 15);
  needle(g, x, y, A(kt), r * 0.86);
}

function alt(g, ft) {
  const [x, y] = LAYOUT.alt, r = R6;
  scale(g, x, y, r, 0, 360, 0, 10, 1, 0.2, false);
  for (let i = 0; i < 10; i++) { const a = rad(i * 36); text(g, String(i), x + Math.sin(a) * r * 0.68, y - Math.cos(a) * r * 0.68, 22); }
  // ô áp suất
  g.fillStyle = '#000'; g.fillRect(x + 22, y - 12, 50, 24); text(g, '29.92', x + 47, y, 15, '#fff');
  text(g, 'ALT', x, y - 28, 15); text(g, 'FEET', x, y + 34, 13);
  const f = Math.max(-1000, ft);
  needle(g, x, y, (f / 100000) * 360, r * 0.9, 2, '#d8d8d0', 0); // kim 10 000 ft
  needle(g, x, y, (f / 10000) * 360, r * 0.52, 9);
  needle(g, x, y, (f / 1000) * 360, r * 0.86, 5);
}

function vsi(g, fpm) {
  const [x, y] = LAYOUT.vsi, r = R6;
  const A = (v) => -90 + (Math.max(-2000, Math.min(2000, v)) / 2000) * 170;
  scale(g, x, y, r, A(-2000), A(2000), -2000, 2000, 500, 100, false);
  for (const v of [0, 5, 10, 15, 20]) {
    for (const s of v ? [-1, 1] : [1]) {
      const a = rad(A(s * v * 100));
      text(g, String(v), x + Math.sin(a) * r * 0.68, y - Math.cos(a) * r * 0.68, 22);
    }
  }
  text(g, 'LÊN', x + 6, y - 32, 14); text(g, 'XUỐNG', x + 6, y + 32, 14); text(g, '100 FT/PH', x + 18, y, 12, '#bbb');
  needle(g, x, y, A(fpm), r * 0.86);
}

function ai(g, pitchDeg, rollDeg) {
  const [x, y] = LAYOUT.ai, r = R6;
  g.save();
  g.beginPath(); g.arc(x, y, r, 0, Math.PI * 2); g.clip();
  g.translate(x, y); g.rotate(rad(-rollDeg));
  const ppd = 3.2; // điểm ảnh mỗi độ
  const off = Math.max(-80, Math.min(80, pitchDeg)) * ppd;
  const sky = g.createLinearGradient(0, -r * 2 + off, 0, off);
  sky.addColorStop(0, '#0f4f9a'); sky.addColorStop(1, '#3d8fe0');
  g.fillStyle = sky; g.fillRect(-r * 2, -r * 3 + off, r * 4, r * 3);
  const gnd = g.createLinearGradient(0, off, 0, off + r * 2);
  gnd.addColorStop(0, '#8a5a2b'); gnd.addColorStop(1, '#4a2e14');
  g.fillStyle = gnd; g.fillRect(-r * 2, off, r * 4, r * 3);
  g.strokeStyle = '#fff'; g.lineWidth = 3;
  g.beginPath(); g.moveTo(-r * 2, off); g.lineTo(r * 2, off); g.stroke();
  g.lineWidth = 2;
  for (let p = -30; p <= 30; p += 5) {
    if (!p) continue;
    const w = p % 10 === 0 ? 32 : 16;
    const yy = off - p * ppd;
    g.beginPath(); g.moveTo(-w, yy); g.lineTo(w, yy); g.stroke();
    if (p % 10 === 0) { text(g, String(Math.abs(p)), -w - 14, yy, 13, '#fff'); text(g, String(Math.abs(p)), w + 14, yy, 13, '#fff'); }
  }
  // vòng chia góc nghiêng quay theo
  g.strokeStyle = '#fff'; g.lineWidth = 3;
  for (const b of [-60, -45, -30, -20, -10, 0, 10, 20, 30, 45, 60]) {
    const a = rad(b);
    const l = b % 30 === 0 ? 16 : 9;
    g.beginPath(); g.moveTo(Math.sin(a) * (r - 4), -Math.cos(a) * (r - 4)); g.lineTo(Math.sin(a) * (r - 4 - l), -Math.cos(a) * (r - 4 - l)); g.stroke();
  }
  g.fillStyle = '#fff'; g.beginPath(); g.moveTo(0, -r + 20); g.lineTo(-7, -r + 6); g.lineTo(7, -r + 6); g.fill();
  g.restore();
  // ký hiệu máy bay cố định
  g.save(); g.translate(x, y);
  g.shadowColor = 'rgba(0,0,0,0.6)'; g.shadowBlur = 5; g.shadowOffsetY = 3;
  g.strokeStyle = '#ff9d1a'; g.lineWidth = 6; g.lineCap = 'round';
  g.beginPath(); g.moveTo(-52, 0); g.lineTo(-18, 0); g.lineTo(-9, 10); g.stroke();
  g.beginPath(); g.moveTo(52, 0); g.lineTo(18, 0); g.lineTo(9, 10); g.stroke();
  g.fillStyle = '#ff9d1a'; g.beginPath(); g.arc(0, 0, 4, 0, Math.PI * 2); g.fill();
  g.fillStyle = '#ff9d1a'; g.beginPath(); g.moveTo(0, -r + 22); g.lineTo(-8, -r + 36); g.lineTo(8, -r + 36); g.fill();
  g.restore();
}

function hi(g, hdg) {
  const [x, y] = LAYOUT.hi, r = R6;
  g.save(); g.translate(x, y); g.rotate(rad(-hdg));
  for (let d = 0; d < 360; d += 5) {
    const a = rad(d);
    const l = d % 30 === 0 ? 14 : d % 10 === 0 ? 10 : 6;
    g.strokeStyle = '#f2f2f2'; g.lineWidth = d % 10 === 0 ? 2.6 : 1.4;
    g.beginPath(); g.moveTo(Math.sin(a) * (r - 3), -Math.cos(a) * (r - 3)); g.lineTo(Math.sin(a) * (r - 3 - l), -Math.cos(a) * (r - 3 - l)); g.stroke();
    if (d % 30 === 0) {
      const lbl = { 0: 'N', 90: 'E', 180: 'S', 270: 'W' }[d] || String(d / 10);
      g.save(); g.rotate(a); text(g, lbl, 0, -r + 30, lbl.length === 1 && isNaN(lbl) ? 22 : 18, '#fff'); g.restore();
    }
  }
  g.restore();
  // vạch chỉ hướng + máy bay
  g.fillStyle = '#ff9d1a';
  g.beginPath(); g.moveTo(x, y - r + 2); g.lineTo(x - 6, y - r + 14); g.lineTo(x + 6, y - r + 14); g.fill();
  g.strokeStyle = '#ff9d1a'; g.lineWidth = 4; g.lineCap = 'round';
  g.beginPath(); g.moveTo(x, y - 26); g.lineTo(x, y + 26); g.moveTo(x - 24, y - 2); g.lineTo(x + 24, y - 2); g.moveTo(x - 10, y + 22); g.lineTo(x + 10, y + 22); g.stroke();
}

function tc(g, rate, slip) {
  const [x, y] = LAYOUT.tc, r = R6;
  text(g, 'L', x - r * 0.72, y + 26, 18); text(g, 'R', x + r * 0.72, y + 26, 18);
  text(g, '2 MIN', x, y + 52, 13, '#ddd'); text(g, 'D.C. ELEC', x, y - 40, 11, '#aaa');
  g.strokeStyle = '#fff'; g.lineWidth = 4;
  for (const a of [-110, -70, 70, 110]) { const t = rad(a); g.beginPath(); g.moveTo(x + Math.sin(t) * (r - 5), y - Math.cos(t) * (r - 5)); g.lineTo(x + Math.sin(t) * (r - 20), y - Math.cos(t) * (r - 20)); g.stroke(); }
  // ống thăng bằng
  g.fillStyle = '#d8d0a8'; rect(g, x - 46, y + 18, 92, 20, 10); g.fill();
  g.strokeStyle = '#111'; g.lineWidth = 2; g.beginPath(); g.moveTo(x - 11, y + 18); g.lineTo(x - 11, y + 38); g.moveTo(x + 11, y + 18); g.lineTo(x + 11, y + 38); g.stroke();
  const bx = x + Math.max(-36, Math.min(36, slip * 36));
  g.fillStyle = '#0a0a0a'; g.beginPath(); g.arc(bx, y + 28, 9, 0, Math.PI * 2); g.fill();
  // máy bay nhỏ nghiêng theo tốc độ quay
  const tilt = Math.max(-30, Math.min(30, (rate / 3) * 20));
  g.save(); g.translate(x, y - 4); g.rotate(rad(tilt));
  g.shadowColor = 'rgba(0,0,0,0.6)'; g.shadowBlur = 5; g.shadowOffsetY = 3;
  g.fillStyle = '#f2f2f2';
  g.fillRect(-r * 0.74, -3, r * 1.48, 6); g.beginPath(); g.arc(0, 0, 10, 0, Math.PI * 2); g.fill(); g.fillRect(-2, -22, 4, 16);
  g.restore();
}

function tach(g, rpm, hours) {
  const [x, y] = LAYOUT.tach, r = 80;
  const A = (v) => -135 + (v / 35) * 270;
  arcBand(g, x, y, r * 0.86, A(21), A(27), '#28a745', 7);
  g.save(); g.translate(x, y); g.rotate(rad(A(27))); g.fillStyle = '#e02020'; g.fillRect(-2, -r, 4, 18); g.restore();
  scale(g, x, y, r, A(0), A(35), 0, 35, 5, 1, true);
  text(g, 'RPM', x, y - 30, 14); text(g, 'x100', x, y + 26, 12);
  g.fillStyle = '#000'; g.fillRect(x - 32, y + 38, 64, 20);
  text(g, hours.toFixed(1).padStart(6, '0'), x, y + 48, 14, '#fff', 'center', 'normal');
  needle(g, x, y, A(rpm / 100), r * 0.84);
}

function small(g, key, v, v0, v1, label, bands, lo = '', hi = '') {
  const [x, y] = LAYOUT[key], r = 58;
  const A = (t) => -60 + ((t - v0) / (v1 - v0)) * 120;
  for (const [a, b, c] of bands) arcBand(g, x, y + 12, r * 0.8, A(a), A(b), c, 6);
  g.strokeStyle = '#eee'; g.lineWidth = 2;
  for (let i = 0; i <= 4; i++) { const a = rad(A(v0 + (i / 4) * (v1 - v0))); g.beginPath(); g.moveTo(x + Math.sin(a) * r * 0.9, y + 12 - Math.cos(a) * r * 0.9); g.lineTo(x + Math.sin(a) * r * 0.7, y + 12 - Math.cos(a) * r * 0.7); g.stroke(); }
  text(g, label, x, y + 26, 13); text(g, lo, x - 36, y + 2, 12, '#ccc'); text(g, hi, x + 36, y + 2, 12, '#ccc');
  needle(g, x, y + 12, A(Math.max(v0, Math.min(v1, v))), r * 0.78, 4);
}

function clock(g, t) {
  const [x, y] = LAYOUT.clock, r = 50;
  scale(g, x, y, r, 0, 360, 0, 60, 5, 1, false);
  const d = new Date(t);
  needle(g, x, y, (d.getHours() % 12 + d.getMinutes() / 60) * 30, r * 0.5, 4);
  needle(g, x, y, d.getMinutes() * 6, r * 0.8, 3);
  needle(g, x, y, d.getSeconds() * 6, r * 0.85, 1.5, '#ff6a3a');
}

function amp(g, v) {
  const [x, y] = LAYOUT.amp, r = 50;
  scale(g, x, y + 10, r, -60, 60, -60, 60, 30, 10, false);
  text(g, 'AMP', x, y + 26, 12); text(g, '-', x - 30, y - 4, 16); text(g, '+', x + 30, y - 4, 16);
  needle(g, x, y + 10, v, r * 0.8, 3);
}

function vac(g, v) {
  const [x, y] = LAYOUT.vac, r = 52;
  arcBand(g, x, y, r * 0.8, -40, 40, '#28a745', 6);
  scale(g, x, y, r, -70, 70, 3, 7, 1, 0.5, false);
  text(g, 'CHÂN KHÔNG', x, y + 24, 11); text(g, 'IN Hg', x, y + 38, 10, '#aaa');
  needle(g, x, y, -70 + ((v - 3) / 4) * 140, r * 0.8, 3);
}

function gmeter(g, gl) {
  const [x, y] = LAYOUT.gmeter, r = 64;
  const A = (v) => -150 + ((v + 2) / 8) * 300;
  arcBand(g, x, y, r * 0.84, A(-1.5), A(3.8), '#28a745', 5);
  scale(g, x, y, r, A(-2), A(6), -2, 6, 1, 0.5, true);
  text(g, 'G', x, y + 28, 16);
  needle(g, x, y, A(Math.max(-2, Math.min(6, gl))), r * 0.84, 3.5);
}

function flapInd(g, deg) {
  const [x, y] = LAYOUT.flaps;
  g.fillStyle = '#0b0b0c'; rect(g, x - 34, y - 40, 68, 200, 8); g.fill();
  for (const d of [0, 10, 20, 30]) {
    const yy = y - 22 + d * 5.2;
    g.strokeStyle = '#eee'; g.lineWidth = 2; g.beginPath(); g.moveTo(x - 24, yy); g.lineTo(x - 8, yy); g.stroke();
    text(g, String(d) + '°', x + 12, yy, 15);
  }
  const yy = y - 22 + deg * 5.2;
  g.fillStyle = '#ff9d1a'; g.beginPath(); g.moveTo(x - 6, yy); g.lineTo(x - 26, yy - 8); g.lineTo(x - 26, yy + 8); g.fill();
}

function radio(g, st) {
  const [x, y, w, h] = LAYOUT.radio;
  g.fillStyle = '#111214'; rect(g, x, y, w, h, 8); g.fill();
  g.fillStyle = '#050505'; g.fillRect(x + 14, y + 14, w - 28, 40); g.fillRect(x + 14, y + 66, w - 28, 40);
  g.font = `28px "Courier New", monospace`; g.fillStyle = '#ffb020'; g.textAlign = 'left'; g.textBaseline = 'middle';
  g.fillText('COM 122.800', x + 22, y + 35);
  g.fillStyle = '#3cff6a';
  g.fillText('XPDR ' + st.squawk + (st.blink ? ' ALT' : '    '), x + 22, y + 87);
}

function gps(g, st, map) {
  const [x, y, w, h] = LAYOUT.gps;
  g.fillStyle = '#0f1012'; rect(g, x - 12, y - 12, w + 24, h + 24, 12); g.fill();
  g.save();
  rect(g, x, y, w, h, 4); g.clip();
  g.fillStyle = '#0a1a24'; g.fillRect(x, y, w, h);
  if (map) {
    // bản đồ bắc ở trên, tâm là máy bay, phạm vi ±6 km
    const range = 6000;
    const s = map.size / map.span; // px bản đồ mỗi mét
    const sx = (st.x + map.span / 2) * s - range * s, sz = (st.z + map.span / 2) * s - range * s;
    g.imageSmoothingEnabled = true;
    g.drawImage(map.canvas, sx, sz, range * 2 * s, range * 2 * s, x, y, w, h);
    const k = w / (range * 2);
    // đường băng
    g.strokeStyle = '#fff'; g.lineWidth = 4;
    g.beginPath(); g.moveTo(x + w / 2 + (0 - st.x) * k, y + h / 2 + (-900 - st.z) * k); g.lineTo(x + w / 2 + (0 - st.x) * k, y + h / 2 + (900 - st.z) * k); g.stroke();
    // vòng phạm vi
    g.strokeStyle = 'rgba(255,255,255,0.35)'; g.lineWidth = 1.5;
    g.beginPath(); g.arc(x + w / 2, y + h / 2, 3000 * k, 0, Math.PI * 2); g.stroke();
  }
  // biểu tượng máy bay
  g.save(); g.translate(x + w / 2, y + h / 2); g.rotate(rad(st.hdg));
  g.fillStyle = '#fff'; g.strokeStyle = '#000'; g.lineWidth = 2;
  g.beginPath(); g.moveTo(0, -14); g.lineTo(4, -2); g.lineTo(14, 4); g.lineTo(3, 4); g.lineTo(2, 10); g.lineTo(6, 14); g.lineTo(-6, 14); g.lineTo(-2, 10); g.lineTo(-3, 4); g.lineTo(-14, 4); g.lineTo(-4, -2); g.closePath();
  g.fill(); g.stroke();
  g.restore();
  // dải số liệu
  g.fillStyle = 'rgba(0,0,0,0.72)'; g.fillRect(x, y, w, 30); g.fillRect(x, y + h - 30, w, 30);
  g.font = `bold 17px ${FONT}`; g.textBaseline = 'middle'; g.textAlign = 'left';
  g.fillStyle = '#ff40ff'; g.fillText('GS', x + 8, y + 15); g.fillStyle = '#fff'; g.fillText(Math.round(st.gs) + 'kt', x + 34, y + 15);
  g.fillStyle = '#ff40ff'; g.fillText('TRK', x + 110, y + 15); g.fillStyle = '#fff'; g.fillText(String(Math.round(st.hdg) % 360).padStart(3, '0') + '°', x + 148, y + 15);
  g.fillStyle = '#ff40ff'; g.fillText('SB', x + 210, y + 15); g.fillStyle = '#fff'; g.fillText(st.dist.toFixed(1) + 'km', x + 236, y + 15);
  g.fillStyle = '#7fd4ff'; g.fillText('BẢN ĐỒ  N↑  6 KM', x + 8, y + h - 15);
  g.textAlign = 'right'; g.fillStyle = '#fff'; g.fillText(Math.round(st.ft) + ' FT', x + w - 8, y + h - 15);
  g.restore();
  // nút hai bên màn hình
  for (let i = 0; i < 4; i++) { g.fillStyle = '#26282b'; rect(g, x + w + 16, y + 20 + i * 70, 24, 40, 5); g.fill(); rect(g, x - 40, y + 20 + i * 70, 24, 40, 5); g.fill(); }
}

/** Tạo bản đồ toàn cảnh tô màu theo độ cao (cho màn hình GPS). */
export function makeOverviewMap(heightAt, forestAt, span = 48000, size = 360) {
  const c = document.createElement('canvas');
  c.width = c.height = size;
  const g = c.getContext('2d');
  const img = g.createImageData(size, size);
  for (let j = 0; j < size; j++) {
    for (let i = 0; i < size; i++) {
      const x = (i / size - 0.5) * span, z = (j / size - 0.5) * span;
      const h = heightAt(x, z);
      let r, gg, b;
      if (h < 0) { const d = Math.min(1, -h / 40); r = 20 - 10 * d; gg = 70 - 30 * d; b = 120 - 30 * d; }
      else {
        const f = forestAt(x, z, h);
        const t = Math.min(1, h / 1800);
        r = 70 + 120 * t; gg = 110 + 60 * t - f * 40; b = 50 + 110 * t;
        if (h > 1500) { r = gg = b = 225; }
        r -= f * 30; b -= f * 10;
      }
      const k = (j * size + i) * 4;
      img.data[k] = r; img.data[k + 1] = gg; img.data[k + 2] = b; img.data[k + 3] = 255;
    }
  }
  g.putImageData(img, 0, 0);
  return { canvas: c, span, size };
}

/** Bảng đồng hồ: giữ canvas, vẽ lại theo trạng thái máy bay. */
export class Panel {
  constructor(map) {
    this.canvas = document.createElement('canvas');
    this.canvas.width = PANEL_W; this.canvas.height = PANEL_H;
    this.g = this.canvas.getContext('2d');
    this.bg = document.createElement('canvas');
    this.bg.width = PANEL_W; this.bg.height = PANEL_H;
    drawStatic(this.bg.getContext('2d'));
    this.map = map;
  }

  /** st: { kt, ft, fpm, pitch, roll, hdg, turnRate, slip, rpm, flaps, g, fuelL, fuelR, oilT, oilP, egt, x, z, gs, dist, time, hours } */
  draw(st) {
    const g = this.g;
    g.drawImage(this.bg, 0, 0);
    asi(g, st.kt); ai(g, st.pitch, st.roll); alt(g, st.ft);
    tc(g, st.turnRate, st.slip); hi(g, st.hdg); vsi(g, st.fpm);
    clock(g, st.time); amp(g, st.rpm > 1000 ? 6 : -4); vac(g, st.rpm > 900 ? 5.1 : 3.5);
    tach(g, st.rpm, st.hours);
    small(g, 'fuelL', st.fuelL, 0, 26, 'NHIÊN LIỆU T', [[0, 3, '#e02020']], '0', '26');
    small(g, 'fuelR', st.fuelR, 0, 26, 'NHIÊN LIỆU P', [[0, 3, '#e02020']], '0', '26');
    small(g, 'oilT', st.oilT, 75, 245, 'NHIỆT DẦU', [[100, 245, '#28a745']], '', '°F');
    small(g, 'oilP', st.oilP, 0, 115, 'ÁP DẦU', [[0, 20, '#e02020'], [50, 90, '#28a745']], '', 'PSI');
    small(g, 'egt', st.egt, 0, 10, 'EGT', [], '', '');
    gmeter(g, st.g);
    flapInd(g, st.flaps);
    gps(g, st, this.map);
    radio(g, { squawk: '1200', blink: (st.time / 1000) % 2 < 1.6 });
    for (const k of ['asi', 'ai', 'alt', 'tc', 'hi', 'vsi']) glass(g, ...LAYOUT[k], R6);
    glass(g, ...LAYOUT.tach, 80);
  }
}

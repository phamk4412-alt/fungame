// Giao diện Căn cứ tận thế: gọi API /api/raid/ và tự đếm vật tư tăng dần giữa các lần tải
const $ = (id) => document.getElementById(id);

const RES = [
  ['scrap', '🔩', 'Sắt vụn'],
  ['fuel', '🛢️', 'Nhiên liệu'],
  ['food', '🥫', 'Lương thực'],
];

let token = localStorage.getItem('raid.token');
let mode = 'login';
let state = null;
let stateAt = 0; // giờ máy khách khi nhận state
let clockSkew = 0; // giờ server trừ giờ máy khách
let targets = [];

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
  const sec = s % 60;
  if (d) return `${d} ngày ${h} giờ`;
  if (h) return `${h} giờ ${m} phút`;
  if (m) return `${m} phút ${sec} giây`;
  return `${sec} giây`;
}

function clock(ts) {
  // Luôn hiện giờ Việt Nam cho cả nhóm thống nhất
  return new Date(ts).toLocaleString('vi-VN', { timeZone: 'Asia/Ho_Chi_Minh', weekday: 'short', hour: '2-digit', minute: '2-digit', day: '2-digit', month: '2-digit' });
}

let toastTimer;
function toast(text) {
  const t = $('toast');
  t.textContent = text;
  t.classList.remove('hidden');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => t.classList.add('hidden'), 4000);
}

async function api(method, path, body) {
  const res = await fetch('/api/raid/' + path, {
    method,
    headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: 'Bearer ' + token } : {}) },
    body: body ? JSON.stringify(body) : undefined,
  });
  const data = await res.json().catch(() => ({ error: 'Không kết nối được máy chủ.' }));
  if (res.status === 401 && path !== 'login') logout();
  if (!res.ok) throw new Error(data.error || 'Có lỗi xảy ra.');
  if (data.token) {
    token = data.token;
    localStorage.setItem('raid.token', token);
  }
  if (data.state) setState(data.state);
  return data;
}

function setState(s) {
  state = s;
  stateAt = Date.now();
  clockSkew = s.now - stateAt;
  render();
}

// Vật tư hiện tại = vật tư lúc nhận + tốc độ × thời gian trôi qua
function currentRes(r) {
  const base = state.resources[r];
  if (base >= state.capacity) return base;
  const hours = (Date.now() - stateAt) / 3600000;
  return Math.min(state.capacity, base + state.rates[r] * hours);
}

// ---------- Đăng nhập ----------

for (const tab of document.querySelectorAll('.tab')) {
  tab.onclick = () => {
    mode = tab.dataset.mode;
    for (const t of document.querySelectorAll('.tab')) t.classList.toggle('active', t === tab);
    $('authBtn').textContent = mode === 'login' ? 'Vào căn cứ' : 'Dựng căn cứ';
    $('passInput').autocomplete = mode === 'login' ? 'current-password' : 'new-password';
  };
}

$('authForm').onsubmit = async (e) => {
  e.preventDefault();
  try {
    await api('POST', mode, { name: $('nameInput').value, password: $('passInput').value });
    $('passInput').value = '';
    showBase();
  } catch (err) {
    toast(err.message);
  }
};

function logout() {
  token = null;
  state = null;
  localStorage.removeItem('raid.token');
  $('base').classList.add('hidden');
  $('auth').classList.remove('hidden');
}
$('logoutBtn').onclick = logout;

function showBase() {
  $('auth').classList.add('hidden');
  $('base').classList.remove('hidden');
  loadTargets();
}

// ---------- Vẽ ----------

function costHtml(cost) {
  return RES.filter(([r]) => cost[r])
    .map(([r, icon]) => `<span class="${currentRes(r) < cost[r] ? 'short' : ''}">${icon} ${fmt(cost[r])}</span>`)
    .join('');
}

function canPay(cost) {
  return RES.every(([r]) => currentRes(r) >= (cost[r] || 0));
}

function render() {
  if (!state) return;
  $('meName').textContent = state.name;
  $('troops').textContent = `${state.troops} / ${state.maxTroops}`;
  $('attack').textContent = fmt(state.attack);
  $('defense').textContent = fmt(state.defense);

  const busy = !!state.build;
  $('buildings').innerHTML = Object.entries(state.buildings)
    .map(([key, b]) => {
      let action;
      if (b.maxed) action = '<span class="hint">Đã đạt cấp tối đa</span>';
      else if (b.locked) action = '<span class="hint">Nâng Trụ sở để mở cấp tiếp</span>';
      else {
        action = `<div class="cost">${costHtml(b.cost)}<span>⏱ ${duration(b.timeMs)}</span></div>
          <button class="btn small primary" data-up="${key}" ${busy || !canPay(b.cost) ? 'disabled' : ''}>
            ${b.level ? 'Nâng lên cấp ' + (b.level + 1) : 'Xây'}</button>`;
      }
      return `<div class="bld">
        <div class="bld-head"><b>${b.icon} ${esc(b.name)}</b><span class="lvl">CẤP ${b.level}</span></div>
        <p>${esc(b.desc)}</p>${action}</div>`;
    })
    .join('');
  for (const btn of document.querySelectorAll('[data-up]')) {
    btn.onclick = () => act('upgrade', { key: btn.dataset.up });
  }

  const c = state.troopCost;
  $('trainHint').textContent = state.maxTroops
    ? `Mỗi chiến binh tốn ${c.food} lương thực và ${c.fuel} nhiên liệu. Chiến binh ở nhà cũng giúp phòng thủ.`
    : 'Xây Doanh trại để huấn luyện chiến binh.';
  $('trainBtn').disabled = $('trainMaxBtn').disabled = state.troops >= state.maxTroops;

  $('log').innerHTML = state.log.length
    ? state.log.map((l) => `<div><time>${clock(l.at)}</time>${esc(l.text)}</div>`).join('')
    : '<p class="empty">Chưa có gì xảy ra. Hãy bắt đầu nâng cấp công trình.</p>';

  renderTargets();
  tick();
}

function renderTargets() {
  if (!state) return;
  const open = state.raid.open;
  const can = open && state.raid.left > 0 && state.troops > 0;
  const now = serverNow();
  $('targets').innerHTML = targets.length
    ? targets
        .map((t, i) => {
          const loot = RES.map(([r, icon]) => `${icon}${fmt(t.loot[r])}`).join(' ');
          const shielded = t.shieldUntil > now;
          let right = '';
          if (t.me) right = '<span class="meta">Bạn</span>';
          else if (shielded) right = `<span class="shield">🛡️ Khiên ${duration(t.shieldUntil - now)}</span>`;
          else right = `<button class="btn small danger" data-atk="${t.id}" ${can ? '' : 'disabled'}>Cướp</button>`;
          return `<div class="target ${t.me ? 'me' : ''}">
            <div><b>#${i + 1} ${esc(t.name)}</b>
              <div class="meta">Trụ sở ${t.hq} · ⚔️ ${fmt(t.attack)} · 🛡️ ${fmt(t.defense)}</div>
              ${t.me ? '' : `<div class="meta">Có thể cướp: ${loot}</div>`}</div>
            ${right}</div>`;
        })
        .join('')
    : '<p class="empty">Chưa có căn cứ nào khác. Rủ bạn bè vào chơi!</p>';
  for (const btn of document.querySelectorAll('[data-atk]')) {
    btn.onclick = async () => {
      const t = targets.find((x) => x.id === btn.dataset.atk);
      if (!confirm(`Đưa ${state.troops} chiến binh đi cướp ${t.name}?`)) return;
      try {
        const { result } = await api('POST', 'attack', { targetId: t.id });
        toast(result.won ? `Thắng! Công ${result.atk} / thủ ${result.def}. Mất ${result.lost} chiến binh.` : `Thua. Công ${result.atk} / thủ ${result.def}. Mất ${result.lost} chiến binh.`);
        loadTargets();
      } catch (err) {
        toast(err.message);
      }
    };
  }
}

// Cập nhật mỗi giây: vật tư, đồng hồ xây, đếm ngược giờ cướp
let lastShort = '';
function tick() {
  if (!state) return;
  const now = serverNow();
  $('resBar').innerHTML = RES.map(([r, icon, name]) => {
    const v = currentRes(r);
    const full = v >= state.capacity;
    return `<div class="res ${full ? 'full' : ''}">${icon} <b>${fmt(v)}</b> / ${fmt(state.capacity)}
      <small>${name} · +${fmt(state.rates[r])}/giờ${full ? ' · kho đầy' : ''}</small></div>`;
  }).join('');

  const q = $('buildQueue');
  if (state.build) {
    const b = state.buildings[state.build.key];
    const left = state.build.finishAt - now;
    q.className = 'queue busy';
    q.innerHTML = `🔨 Đang nâng ${esc(b.name)} lên cấp ${b.level + 1}, còn ${duration(left)}`;
    if (left <= 0) refresh();
  } else {
    q.className = 'queue';
    q.textContent = 'Thợ xây đang rảnh. Chọn một công trình để nâng cấp (mỗi lúc chỉ xây được một cái).';
  }

  const r = state.raid;
  let html;
  if (r.open) {
    html = `🔥 <b>ĐANG MỞ CƯỚP</b> tới hết Chủ nhật (còn ${duration(r.closesAt - now)}). Bạn còn <b>${r.left}/${r.perWeekend}</b> lượt cướp.`;
    if (now >= r.closesAt) refresh();
  } else {
    html = `🕊️ Đang trong tuần, chưa ai cướp được ai. Mở cướp sau <b>${duration(r.opensAt - now)}</b> (19:00 thứ Bảy).`;
    if (now >= r.opensAt) refresh();
  }
  if (state.shieldUntil > now) html += ` <span class="shield">🛡️ Bạn có khiên bảo vệ thêm ${duration(state.shieldUntil - now)}.</span>`;
  $('banner').className = 'banner' + (r.open ? ' open' : '');
  $('banner').innerHTML = html;

  // Nút nâng cấp sáng lên khi vật tư đã đủ
  const short = Object.values(state.buildings).map((b) => canPay(b.cost)).join();
  if (short !== lastShort) {
    lastShort = short;
    render();
  }
}

let refreshing = false;
async function refresh() {
  if (refreshing || !token) return;
  refreshing = true;
  try {
    await api('GET', 'me');
  } catch {
    // giữ nguyên, lần sau thử lại
  }
  setTimeout(() => (refreshing = false), 2000);
}

async function loadTargets() {
  try {
    ({ targets } = await api('GET', 'targets'));
    renderTargets();
  } catch {
    // bỏ qua
  }
}

async function act(path, body) {
  try {
    await api('POST', path, body);
  } catch (err) {
    toast(err.message);
  }
}

$('trainBtn').onclick = () => act('train', { count: Number($('trainInput').value) });
$('trainMaxBtn').onclick = () => {
  const c = state.troopCost;
  const room = state.maxTroops - state.troops;
  const afford = Math.min(Math.floor(currentRes('food') / c.food), Math.floor(currentRes('fuel') / c.fuel));
  const n = Math.max(0, Math.min(room, afford));
  if (!n) return toast('Không đủ vật tư để huấn luyện.');
  act('train', { count: n });
};

setInterval(tick, 1000);
setInterval(() => {
  refresh();
  loadTargets();
}, 30000);

if (token) {
  api('GET', 'me')
    .then(showBase)
    .catch(() => {});
}

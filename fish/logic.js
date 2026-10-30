// Luật game Câu cá 3D: hồ, loài cá, giờ trong ngày, cần câu, mồi, thùng đá.
// Máy chủ quyết định cá nào cắn câu, trình duyệt chỉ lo phần kéo dây.

// Một ngày trong game dài 24 phút thật: mỗi phút thật là một giờ trong game, mọi người thấy cùng một giờ.
const GAME_DAY_MS = 24 * 60 * 1000;

const PHASES = {
  dawn: { name: 'Bình minh', icon: '🌅' },
  day: { name: 'Ban ngày', icon: '☀️' },
  dusk: { name: 'Hoàng hôn', icon: '🌇' },
  night: { name: 'Ban đêm', icon: '🌙' },
};

function gameHour(now) {
  return ((now % GAME_DAY_MS) / GAME_DAY_MS) * 24;
}

function phaseOf(hour) {
  if (hour >= 5 && hour < 7) return 'dawn';
  if (hour >= 7 && hour < 17) return 'day';
  if (hour >= 17 && hour < 19) return 'dusk';
  return 'night';
}

const RARITY = [
  { name: 'Thường', color: '#d8e2ea', weight: 60 },
  { name: 'Hiếm', color: '#4fb3ff', weight: 27 },
  { name: 'Sử thi', color: '#c27bff', weight: 10 },
  { name: 'Huyền thoại', color: '#ffc93c', weight: 3 },
];

const LAKES = {
  sen: { name: 'Hồ Sen Làng Quê', price: 0, desc: 'Hồ sen yên bình giữa lũy tre, đồng lúa.' },
  thong: { name: 'Hồ Rừng Thông', price: 1200, desc: 'Hồ núi giữa rừng thông, sáng sớm sương mù dày đặc.' },
  vinh: { name: 'Vịnh Đá Vôi', price: 5000, desc: 'Vịnh biển xanh ngọc giữa những cột đá vôi khổng lồ.' },
  bang: { name: 'Hồ Băng Cực Quang', price: 15000, desc: 'Hồ băng phương Bắc, đêm xuống có cực quang.' },
};
const LAKE_ORDER = ['sen', 'thong', 'vinh', 'bang'];

const ALL = ['dawn', 'day', 'dusk', 'night'];

// look: thông số để trình duyệt dựng mô hình 3D của con cá
// w: [nhẹ nhất, nặng nhất] kg; price: giá gốc + giá mỗi kg; power: sức kéo
const FISH = {
  // Hồ Sen
  ro_phi: { name: 'Cá rô phi', lake: 'sen', rarity: 0, w: [0.2, 1.4], price: [4, 10], power: 0.3, times: ALL,
    look: { len: 0.32, h: 0.42, back: '#5d6b5a', belly: '#c9cfb8', fin: '#8a6a5a', pattern: 'stripes' } },
  diec: { name: 'Cá diếc', lake: 'sen', rarity: 0, w: [0.1, 0.7], price: [3, 8], power: 0.22, times: ['dawn', 'day', 'dusk'],
    look: { len: 0.22, h: 0.45, back: '#7b8c6a', belly: '#e8e4c8', fin: '#a89870', pattern: 'scales' } },
  chep: { name: 'Cá chép', lake: 'sen', rarity: 0, w: [1, 7], price: [8, 6], power: 0.5, times: ['dawn', 'day'],
    look: { len: 0.55, h: 0.34, back: '#6b5a33', belly: '#d9c27a', fin: '#a0602e', pattern: 'scales', barbel: true } },
  tre: { name: 'Cá trê', lake: 'sen', rarity: 0, w: [0.5, 3], price: [6, 9], power: 0.45, times: ['dusk', 'night'],
    look: { len: 0.45, h: 0.18, back: '#3a3a35', belly: '#8d8a7a', fin: '#2e2c28', pattern: 'plain', barbel: true, eel: 0.4 } },
  loc: { name: 'Cá lóc', lake: 'sen', rarity: 1, w: [1, 5.5], price: [20, 14], power: 0.65, times: ['dusk', 'night'],
    look: { len: 0.65, h: 0.2, back: '#3b4332', belly: '#c8c2a8', fin: '#4a4a3a', pattern: 'blotch', eel: 0.25 } },
  koi: { name: 'Cá Koi', lake: 'sen', rarity: 2, w: [2, 9], price: [60, 25], power: 0.7, times: ['day'],
    look: { len: 0.6, h: 0.3, back: '#f4f1ea', belly: '#ffffff', fin: '#ffffff', pattern: 'koi', spot: '#e8461e', barbel: true } },
  chep_rong: { name: 'Cá Chép Hóa Rồng', lake: 'sen', rarity: 3, w: [8, 22], price: [400, 60], power: 1.1, times: ['dawn'],
    look: { len: 0.9, h: 0.3, back: '#ffb300', belly: '#fff2a8', fin: '#ff5a1f', pattern: 'scales', barbel: true, glow: '#ffae00' } },

  // Hồ Rừng Thông
  suoi: { name: 'Cá suối', lake: 'thong', rarity: 0, w: [0.1, 0.6], price: [5, 12], power: 0.25, times: ALL,
    look: { len: 0.2, h: 0.25, back: '#5b6e70', belly: '#e3e7e0', fin: '#9fa89a', pattern: 'dots', spot: '#2c3a3c' } },
  tram: { name: 'Cá trắm cỏ', lake: 'thong', rarity: 0, w: [2, 14], price: [10, 6], power: 0.6, times: ['dawn', 'day'],
    look: { len: 0.75, h: 0.24, back: '#55603c', belly: '#d8d3b0', fin: '#6f6a48', pattern: 'scales' } },
  bong: { name: 'Cá bống đá', lake: 'thong', rarity: 0, w: [0.1, 0.5], price: [6, 14], power: 0.2, times: ['dusk', 'night'],
    look: { len: 0.18, h: 0.22, back: '#6e5f4a', belly: '#cbbd9e', fin: '#7a6a52', pattern: 'blotch' } },
  hoi_van: { name: 'Cá hồi vân', lake: 'thong', rarity: 1, w: [1, 6], price: [30, 22], power: 0.6, times: ['dawn', 'day'],
    look: { len: 0.6, h: 0.26, back: '#556b4c', belly: '#f1e9e2', fin: '#7c8a6a', pattern: 'trout', spot: '#1e221a', band: '#e4707a' } },
  lang: { name: 'Cá lăng', lake: 'thong', rarity: 1, w: [2, 11], price: [26, 16], power: 0.75, times: ['dusk', 'night'],
    look: { len: 0.8, h: 0.2, back: '#6a6e72', belly: '#e0e0dc', fin: '#8a5a48', pattern: 'plain', barbel: true, eel: 0.15 } },
  chien: { name: 'Cá chiên', lake: 'thong', rarity: 2, w: [5, 28], price: [90, 22], power: 1.0, times: ['night'],
    look: { len: 0.9, h: 0.22, back: '#4a4232', belly: '#b8a888', fin: '#3a3226', pattern: 'blotch', barbel: true } },
  hoi_trang: { name: 'Cá Hồi Ánh Trăng', lake: 'thong', rarity: 3, w: [10, 32], price: [600, 70], power: 1.25, times: ['night'],
    look: { len: 0.95, h: 0.27, back: '#9fd8ff', belly: '#ffffff', fin: '#c8ecff', pattern: 'trout', spot: '#ffffff', band: '#b48cff', glow: '#7fd0ff' } },

  // Vịnh Đá Vôi
  trich: { name: 'Cá trích', lake: 'vinh', rarity: 0, w: [0.1, 0.5], price: [5, 14], power: 0.22, times: ALL,
    look: { len: 0.22, h: 0.22, back: '#3d6e8c', belly: '#eef4f6', fin: '#a8c0cc', pattern: 'plain', fork: true } },
  thu: { name: 'Cá thu', lake: 'vinh', rarity: 0, w: [2, 9], price: [14, 10], power: 0.7, times: ['dawn', 'day'],
    look: { len: 0.9, h: 0.17, back: '#2f5d7a', belly: '#e9eef0', fin: '#5a7a8a', pattern: 'mackerel', spot: '#1b3446', fork: true } },
  hong: { name: 'Cá hồng', lake: 'vinh', rarity: 1, w: [1, 7], price: [34, 18], power: 0.6, times: ['day', 'dusk'],
    look: { len: 0.55, h: 0.34, back: '#d8403a', belly: '#ffc4b4', fin: '#e8605a', pattern: 'scales' } },
  mu: { name: 'Cá mú', lake: 'vinh', rarity: 1, w: [2, 16], price: [30, 16], power: 0.8, times: ['dusk', 'night'],
    look: { len: 0.7, h: 0.32, back: '#7a5236', belly: '#d8b894', fin: '#6a4a30', pattern: 'dots', spot: '#3a2414' } },
  ngu: { name: 'Cá ngừ đại dương', lake: 'vinh', rarity: 2, w: [20, 130], price: [200, 9], power: 1.35, times: ['day'],
    look: { len: 1.2, h: 0.28, back: '#1d3554', belly: '#dfe6ea', fin: '#e8c23a', pattern: 'plain', fork: true } },
  duoi: { name: 'Cá đuối ó', lake: 'vinh', rarity: 2, w: [10, 70], price: [160, 10], power: 1.15, times: ['night'],
    look: { len: 0.9, h: 0.1, back: '#2a2c34', belly: '#f0f0f0', fin: '#2a2c34', pattern: 'dots', spot: '#e8e8f0', ray: true } },
  rong_bien: { name: 'Rồng Biển Hạ Long', lake: 'vinh', rarity: 3, w: [60, 320], price: [1500, 25], power: 1.5, times: ['dusk', 'night'],
    look: { len: 1.6, h: 0.16, back: '#14806a', belly: '#b8ffe0', fin: '#2ce8b0', pattern: 'scales', eel: 0.6, barbel: true, glow: '#3dffc0' } },

  // Hồ Băng Cực Quang
  ca_bang: { name: 'Cá băng', lake: 'bang', rarity: 0, w: [0.3, 1.6], price: [10, 16], power: 0.3, times: ALL,
    look: { len: 0.3, h: 0.18, back: '#b8cdd8', belly: '#f4fbff', fin: '#d8eef8', pattern: 'plain' } },
  tuyet: { name: 'Cá tuyết', lake: 'bang', rarity: 0, w: [1, 9], price: [16, 9], power: 0.6, times: ['dawn', 'day', 'dusk'],
    look: { len: 0.7, h: 0.24, back: '#7a7058', belly: '#ece6d8', fin: '#8a8068', pattern: 'dots', spot: '#5a5040', barbel: true } },
  hoi_bac: { name: 'Cá hồi Bắc Cực', lake: 'bang', rarity: 1, w: [2, 12], price: [46, 20], power: 0.75, times: ['dawn', 'day'],
    look: { len: 0.7, h: 0.25, back: '#46606a', belly: '#ffd6c4', fin: '#e07a5a', pattern: 'trout', spot: '#f0f0f0', band: '#f08a68' } },
  cho: { name: 'Cá chó phương Bắc', lake: 'bang', rarity: 1, w: [3, 18], price: [40, 15], power: 0.9, times: ['dusk', 'night'],
    look: { len: 0.95, h: 0.17, back: '#4e6038', belly: '#e8e4c0', fin: '#a0703a', pattern: 'pike', spot: '#d8dca0', eel: 0.2 } },
  bon: { name: 'Cá bơn khổng lồ', lake: 'bang', rarity: 2, w: [10, 90], price: [180, 12], power: 1.2, times: ['day'],
    look: { len: 1.0, h: 0.5, back: '#5a4e3e', belly: '#f4f2ea', fin: '#5a4e3e', pattern: 'dots', spot: '#3a3226', flat: true } },
  tam: { name: 'Cá tầm trắng', lake: 'bang', rarity: 2, w: [30, 220], price: [260, 8], power: 1.4, times: ['night'],
    look: { len: 1.5, h: 0.16, back: '#5f6a72', belly: '#e4e8ea', fin: '#5f6a72', pattern: 'plates', barbel: true } },
  cuc_quang: { name: 'Cá Cực Quang', lake: 'bang', rarity: 3, w: [20, 70], price: [1200, 80], power: 1.4, times: ['night'],
    look: { len: 0.9, h: 0.3, back: '#3cffb4', belly: '#e6c8ff', fin: '#a070ff', pattern: 'aurora', spot: '#ff70d0', glow: '#7affd8' } },

  // Thủy quái: chỉ trồi lên khi làm xong nhiệm vụ của Lão Ngư, không bao giờ cắn câu thường (times rỗng)
  quai_sen: { name: 'Thủy Quái Đầm Sen', lake: 'sen', rarity: 3, boss: true, w: [600, 1100], price: [8000, 6], power: 3, times: [],
    look: { len: 7, h: 0.3, back: '#2e4a26', belly: '#a8b878', fin: '#7a3a1a', pattern: 'scales', glow: '#9aff5a' } },
  quai_thong: { name: 'Thủy Quái Rừng Thông', lake: 'thong', rarity: 3, boss: true, w: [700, 1300], price: [9000, 6], power: 3, times: [],
    look: { len: 7, h: 0.3, back: '#26343e', belly: '#8a9aa0', fin: '#3a5a6a', pattern: 'scales', glow: '#5ad8ff' } },
  quai_vinh: { name: 'Thủy Quái Vịnh Rồng', lake: 'vinh', rarity: 3, boss: true, w: [900, 1600], price: [11000, 6], power: 3, times: [],
    look: { len: 8, h: 0.3, back: '#0e3e4a', belly: '#6ac8b0', fin: '#c83a2a', pattern: 'scales', glow: '#ff6a3a' } },
  quai_bang: { name: 'Thủy Quái Băng Giá', lake: 'bang', rarity: 3, boss: true, w: [800, 1500], price: [12000, 6], power: 3, times: [],
    look: { len: 7, h: 0.3, back: '#5a7088', belly: '#e8f4ff', fin: '#9ac8ff', pattern: 'scales', glow: '#b8f0ff' } },
};
const BOSSES = { sen: 'quai_sen', thong: 'quai_thong', vinh: 'quai_vinh', bang: 'quai_bang' };

const RODS = {
  tre: { name: 'Cần tre', price: 0, strength: 1, reel: 1, luck: 0, desc: 'Cần tre ông nội để lại, dẻo nhưng yếu.' },
  carbon: { name: 'Cần carbon', price: 600, strength: 1.3, reel: 1.25, luck: 0.1, desc: 'Nhẹ, chắc, kéo nhanh hơn.' },
  titan: { name: 'Cần titan', price: 3000, strength: 1.7, reel: 1.5, luck: 0.25, desc: 'Chịu được cá ngừ, cá tầm.' },
  long: { name: 'Cần Long Vương', price: 12000, strength: 2.3, reel: 1.9, luck: 0.5, desc: 'Cần của Long Vương, cá huyền thoại cũng phải nể.' },
};
const ROD_ORDER = ['tre', 'carbon', 'titan', 'long'];

// boost: nhân tỉ lệ ra cá theo từng độ hiếm; bite: cá cắn nhanh hơn
const BAITS = {
  giun: { name: 'Giun đất', price: 0, pack: 0, boost: [1, 1, 1, 1], bite: 1, desc: 'Miễn phí, không giới hạn.' },
  tom: { name: 'Tôm tươi', price: 40, pack: 10, boost: [1, 1.8, 1.3, 1.2], bite: 0.85, desc: 'Dễ ra cá hiếm hơn.' },
  moi_gia: { name: 'Mồi giả lấp lánh', price: 220, pack: 10, boost: [0.7, 1.5, 2.6, 1.6], bite: 0.8, desc: 'Cá sử thi rất thích.' },
  moi_vang: { name: 'Mồi vàng huyền thoại', price: 1200, pack: 5, boost: [0.5, 1.2, 2.5, 5], bite: 0.7, desc: 'Gấp 5 lần cơ hội gặp cá huyền thoại.' },
};
const BAIT_ORDER = ['giun', 'tom', 'moi_gia', 'moi_vang'];

const COOLERS = [
  { name: 'Xô nhựa', size: 12, price: 0 },
  { name: 'Thùng xốp', size: 25, price: 400 },
  { name: 'Thùng đá inox', size: 50, price: 2000 },
  { name: 'Hầm lạnh di động', size: 100, price: 8000 },
];

const START_MONEY = 50;
const MIN_FIGHT_MS = 1500;
const CAST_TTL_MS = 4 * 60 * 1000;

function newPlayer(id, name, now) {
  return {
    id,
    name,
    created: now,
    money: START_MONEY,
    earned: 0,
    rod: 'tre',
    rods: ['tre'],
    baits: { tom: 5 },
    cooler: 0,
    fish: [],
    lakes: ['sen'],
    lake: 'sen',
    best: {},
    caught: 0,
    score: 0,
    legend: 0,
    biggest: null,
    cast: null,
  };
}

function available(lake, phase) {
  return Object.entries(FISH).filter(([, f]) => f.lake === lake && f.times.includes(phase));
}

// Bốc thăm con cá sẽ cắn câu
function rollFish(lake, phase, bait, rod, rnd = Math.random) {
  const pool = available(lake, phase);
  const b = BAITS[bait] || BAITS.giun;
  const r = RODS[rod] || RODS.tre;
  const tiers = RARITY.map((t, i) => {
    const species = pool.filter(([, f]) => f.rarity === i);
    const luck = i >= 2 ? 1 + r.luck : 1;
    return { species, w: species.length ? t.weight * b.boost[i] * luck : 0 };
  });
  const total = tiers.reduce((s, t) => s + t.w, 0);
  let x = rnd() * total;
  let tier = tiers.find((t) => (x -= t.w) < 0) || tiers.find((t) => t.w > 0);
  const [id, f] = tier.species[Math.floor(rnd() * tier.species.length)];
  // Cá nhỏ nhiều, cá khủng hiếm
  const weight = Math.round((f.w[0] + (f.w[1] - f.w[0]) * Math.pow(rnd(), 2.2)) * 100) / 100;
  return { id, weight };
}

function fishValue(id, weight) {
  const f = FISH[id];
  return Math.round(f.price[0] + f.price[1] * weight);
}

// Sức kéo của con cá, đã tính độ to so với loài của nó
function fishPower(id, weight) {
  const f = FISH[id];
  const norm = (weight - f.w[0]) / Math.max(0.01, f.w[1] - f.w[0]);
  return f.power * (0.75 + 0.5 * norm);
}

function coolerSize(p) {
  return COOLERS[p.cooler].size;
}

function startCast(p, lake, bait, now, rnd = Math.random) {
  if (!LAKES[lake]) return { error: 'Không có hồ này.' };
  if (!p.lakes.includes(lake)) return { error: 'Bạn chưa mở khóa hồ này.' };
  if (!BAITS[bait]) bait = 'giun';
  if (bait !== 'giun' && !(p.baits[bait] > 0)) return { error: `Bạn đã hết ${BAITS[bait].name}.` };
  if (p.fish.length >= coolerSize(p)) return { error: 'Thùng đá đầy rồi, bán bớt cá đi đã.' };
  if (bait !== 'giun') p.baits[bait] -= 1;
  p.lake = lake;
  const phase = phaseOf(gameHour(now));
  const { id, weight } = rollFish(lake, phase, bait, p.rod, rnd);
  const f = FISH[id];
  const biteIn = Math.round((3500 + rnd() * 9000) * BAITS[bait].bite);
  p.cast = { id: Math.floor(rnd() * 1e9).toString(36), fish: id, weight, at: now, biteIn };
  return {
    cast: {
      id: p.cast.id,
      biteIn,
      // trình duyệt cần biết sức kéo để dựng màn kéo dây, tên cá chỉ lộ khi kéo lên
      power: fishPower(id, weight),
      rarity: f.rarity,
      size: f.look.len * Math.cbrt(weight / f.w[1]),
    },
  };
}

function land(p, castId, ok, now) {
  const c = p.cast;
  if (!c || c.id !== castId) return { error: 'Lần quăng này không còn nữa.' };
  p.cast = null;
  if (!ok) return { lost: true };
  if (now < c.at + c.biteIn + MIN_FIGHT_MS) return { error: 'Kéo nhanh quá, cá chưa kịp cắn.' };
  if (now > c.at + CAST_TTL_MS) return { error: 'Cá đã sổng mất.' };
  if (p.fish.length >= coolerSize(p)) return { error: 'Thùng đá đầy rồi.' };
  const f = FISH[c.fish];
  const fish = { s: c.fish, w: c.weight, v: fishValue(c.fish, c.weight), at: now };
  p.fish.push(fish);
  p.caught += 1;
  p.score = scoreOf(p) + fish.v;
  if (f.rarity === 3) p.legend += 1;
  const record = !(p.best[c.fish] >= c.weight);
  if (record) p.best[c.fish] = c.weight;
  const biggest = !p.biggest || c.weight > p.biggest.w;
  if (biggest) p.biggest = { s: c.fish, w: c.weight };
  if (p.quest && p.quest.lake === f.lake) p.quest.fish = Math.min(QUEST.fish, p.quest.fish + 1);
  return { fish, record, biggest };
}

// ---------- Nhiệm vụ của Lão Ngư và thủy quái ----------

// Nhặt đủ hũ thính rơi quanh bờ và câu đủ cá ở hồ đó thì Lão Ngư chèo ra giữa hồ dụ thủy quái lên
const QUEST = { items: 5, fish: 5 };

function acceptQuest(p, lake) {
  if (!LAKES[lake] || !p.lakes.includes(lake)) return 'Bạn chưa mở khóa hồ này.';
  if (!p.quest || p.quest.lake !== lake) p.quest = { lake, items: [], fish: 0 };
  return null;
}

function questItem(p, i) {
  const q = p.quest;
  if (!q) return 'Bạn chưa nhận nhiệm vụ.';
  if (!Number.isInteger(i) || i < 0 || i >= QUEST.items) return 'Không có vật phẩm này.';
  if (!q.items.includes(i)) q.items.push(i);
  return null;
}

function questDone(q) {
  return !!q && q.items.length >= QUEST.items && q.fish >= QUEST.fish;
}

// Một người đánh mất khoảng 4 tới 5 phút; thêm người thì thủy quái trâu thêm nửa phần mỗi người
const BOSS_HP = 240;
const BOSS_TTL_MS = 15 * 60 * 1000;
const BOSS_DPS = 1.3; // sát thương tối đa mỗi giây một người được tính

function newBoss(lake, by, now, rnd = Math.random) {
  const s = BOSSES[lake];
  const f = FISH[s];
  const w = Math.round((f.w[0] + (f.w[1] - f.w[0]) * rnd()) * 10) / 10;
  return { lake, s, w, hp: BOSS_HP, max: BOSS_HP, at: now, until: now + BOSS_TTL_MS, by, fighters: {}, dead: null };
}

// Trả về true nếu cú này hạ được thủy quái
function hitBoss(b, id, dmg, now) {
  if (b.dead || now > b.until) return false;
  const f = b.fighters[id];
  if (!f && Object.keys(b.fighters).length > 0) {
    b.max += BOSS_HP * 0.5;
    b.hp += BOSS_HP * 0.5;
  }
  const last = f ? f.at : now - 1000;
  const cap = Math.min(6, ((now - last) / 1000) * BOSS_DPS + 0.2);
  const d = Math.min(cap, Math.max(0, Number(dmg) || 0));
  b.fighters[id] = { at: now, dmg: (f ? f.dmg : 0) + d };
  b.hp = Math.max(0, b.hp - d);
  return b.hp <= 0;
}

// Ai góp đủ sức kéo đều được một con thủy quái, không tính chỗ trong thùng đá
function bossWinners(b) {
  return Object.entries(b.fighters).filter(([, f]) => f.dmg >= 3).map(([id]) => id);
}

function bossReward(p, b, now) {
  const fish = { s: b.s, w: b.w, v: fishValue(b.s, b.w), at: now };
  p.fish.push(fish);
  p.caught += 1;
  p.score = scoreOf(p) + fish.v;
  p.legend += 1;
  const record = !(p.best[b.s] >= b.w);
  if (record) p.best[b.s] = b.w;
  const biggest = !p.biggest || b.w > p.biggest.w;
  if (biggest) p.biggest = { s: b.s, w: b.w };
  return { fish, record, biggest };
}

// Điểm xếp hạng: tổng giá trị cá đã câu (người chơi cũ chưa có thì lấy số tiền đã bán)
function scoreOf(p) {
  return p.score ?? p.earned ?? 0;
}

function sell(p, index) {
  let list;
  if (index === 'all') {
    list = p.fish;
    p.fish = [];
  } else {
    const i = Number(index);
    if (!Number.isInteger(i) || !p.fish[i]) return { error: 'Không có con cá này.' };
    list = p.fish.splice(i, 1);
  }
  const total = list.reduce((s, f) => s + f.v, 0);
  p.money += total;
  p.earned += total;
  return { sold: list.length, total };
}

function pay(p, price, free) {
  if (free) return null;
  if (p.money < price) return `Bạn cần ${price.toLocaleString('vi-VN')} xu.`;
  p.money -= price;
  return null;
}

// free: tài khoản vô hạn tiền, mua không bị trừ
function buy(p, kind, id, free = false) {
  if (kind === 'rod') {
    const r = RODS[id];
    if (!r) return 'Không có cần này.';
    if (!p.rods.includes(id)) {
      const err = pay(p, r.price, free);
      if (err) return err;
      p.rods.push(id);
    }
    p.rod = id;
    return null;
  }
  if (kind === 'bait') {
    const b = BAITS[id];
    if (!b || !b.pack) return 'Không bán mồi này.';
    const err = pay(p, b.price, free);
    if (err) return err;
    p.baits[id] = (p.baits[id] || 0) + b.pack;
    return null;
  }
  if (kind === 'cooler') {
    const next = COOLERS[p.cooler + 1];
    if (!next) return 'Thùng đá đã to nhất rồi.';
    const err = pay(p, next.price, free);
    if (err) return err;
    p.cooler += 1;
    return null;
  }
  if (kind === 'lake') {
    const l = LAKES[id];
    if (!l) return 'Không có hồ này.';
    if (!p.lakes.includes(id)) {
      const err = pay(p, l.price, free);
      if (err) return err;
      p.lakes.push(id);
    }
    p.lake = id;
    return null;
  }
  return 'Không rõ món hàng.';
}

module.exports = {
  QUEST,
  BOSSES,
  BOSS_HP,
  BOSS_TTL_MS,
  acceptQuest,
  questItem,
  questDone,
  newBoss,
  hitBoss,
  bossWinners,
  bossReward,
  scoreOf,
  GAME_DAY_MS,
  PHASES,
  RARITY,
  LAKES,
  LAKE_ORDER,
  FISH,
  RODS,
  ROD_ORDER,
  BAITS,
  BAIT_ORDER,
  COOLERS,
  MIN_FIGHT_MS,
  gameHour,
  phaseOf,
  available,
  rollFish,
  fishValue,
  fishPower,
  coolerSize,
  newPlayer,
  startCast,
  land,
  sell,
  buy,
};

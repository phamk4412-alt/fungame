// Luật game Căn cứ tận thế: farm vật tư trong tuần, cuối tuần mở cướp
// Toàn bộ là hàm thuần trên object người chơi, không đụng tới cơ sở dữ liệu.

const RESOURCES = ['scrap', 'fuel', 'food'];
const RESOURCE_NAMES = { scrap: 'Sắt vụn', fuel: 'Nhiên liệu', food: 'Lương thực' };

// base: chi phí nâng lên cấp 1, mỗi cấp sau nhân COST_GROWTH
const BUILDINGS = {
  hq: { name: 'Trụ sở', icon: '🏚️', desc: 'Công trình khác chỉ được cao hơn Trụ sở 1 cấp', base: { scrap: 300, fuel: 150, food: 150 }, max: 10 },
  scrap: { name: 'Bãi phế liệu', icon: '🔩', desc: 'Nhặt sắt vụn mỗi giờ', base: { scrap: 60, fuel: 30, food: 40 }, produces: 'scrap', rate: 60 },
  fuel: { name: 'Trạm lọc dầu', icon: '🛢️', desc: 'Lọc nhiên liệu mỗi giờ', base: { scrap: 90, fuel: 20, food: 40 }, produces: 'fuel', rate: 40 },
  food: { name: 'Vườn thủy canh', icon: '🥫', desc: 'Trồng lương thực mỗi giờ', base: { scrap: 80, fuel: 30, food: 20 }, produces: 'food', rate: 50 },
  storage: { name: 'Nhà kho', icon: '📦', desc: 'Tăng sức chứa và giấu một phần vật tư khỏi bị cướp', base: { scrap: 120, fuel: 40, food: 60 } },
  wall: { name: 'Tường rào', icon: '🧱', desc: 'Tăng phòng thủ', base: { scrap: 150, fuel: 20, food: 30 } },
  turret: { name: 'Tháp súng', icon: '🔫', desc: 'Tăng phòng thủ mạnh, tốn nhiên liệu', base: { scrap: 200, fuel: 120, food: 40 } },
  barracks: { name: 'Doanh trại', icon: '⛺', desc: 'Chứa thêm chiến binh và tăng sức đánh của mỗi người', base: { scrap: 150, fuel: 60, food: 120 } },
};

const COST_GROWTH = 1.6;
const MAX_LEVEL = 10;
const START_LEVELS = { hq: 1, scrap: 1, fuel: 1, food: 1, storage: 1, wall: 0, turret: 0, barracks: 0 };
const START_RESOURCES = { scrap: 600, fuel: 400, food: 500 };

const TROOP_COST = { food: 30, fuel: 10 };
const TROOPS_PER_BARRACKS = 10;
const WALL_DEF = 60;
const TURRET_DEF = 100;
const HQ_DEF = 40;
const TROOP_DEF = 4; // chiến binh ở nhà cũng góp phòng thủ

const STEAL_RATE = 0.25; // thắng cướp được 25% phần vật tư không được giấu
const PROTECT_PER_STORAGE = 150; // mỗi cấp nhà kho giấu được 150 mỗi loại
const SHIELD_MS = 12 * 3600 * 1000; // bị cướp thì được khiên 12 giờ
const RAIDS_PER_WEEKEND = 3;

// Giờ Việt Nam (UTC+7): mở cướp từ 19:00 thứ Bảy tới 23:59 Chủ nhật
const VN_OFFSET_MS = 7 * 3600 * 1000;
const RAID_OPEN_DAY = 6; // thứ Bảy
const RAID_OPEN_HOUR = 19;

function upgradeCost(key, level) {
  // chi phí để lên cấp level+1
  const b = BUILDINGS[key];
  const mult = Math.pow(COST_GROWTH, level);
  const cost = {};
  for (const r of RESOURCES) cost[r] = Math.round(b.base[r] * mult);
  return cost;
}

function upgradeTimeMs(level) {
  // lên cấp n mất n² phút: cấp 2 là 4 phút, cấp 5 là 25 phút, cấp 10 là 100 phút
  const next = level + 1;
  return next * next * 60 * 1000;
}

function capacity(p) {
  return 1000 + 1500 * p.buildings.storage;
}

function ratesPerHour(p) {
  const rates = {};
  for (const r of RESOURCES) rates[r] = 0;
  for (const [key, b] of Object.entries(BUILDINGS)) {
    if (b.produces) rates[b.produces] += b.rate * p.buildings[key];
  }
  return rates;
}

function maxTroops(p) {
  return TROOPS_PER_BARRACKS * p.buildings.barracks;
}

function attackPower(p) {
  return p.troops * (12 + 3 * p.buildings.barracks);
}

function defensePower(p) {
  const b = p.buildings;
  return HQ_DEF * b.hq + WALL_DEF * b.wall + TURRET_DEF * b.turret + TROOP_DEF * p.troops;
}

function newPlayer(id, name, now) {
  return {
    id,
    name,
    createdAt: now,
    updatedAt: now,
    resources: { ...START_RESOURCES },
    buildings: { ...START_LEVELS },
    build: null, // { key, finishAt }
    troops: 0,
    shieldUntil: 0,
    raidsUsed: 0,
    raidWeek: null,
    log: [],
  };
}

// Cộng vật tư theo thời gian thực từ lần cập nhật trước, kể cả khi offline
function produce(p, until) {
  const dt = Math.max(0, until - p.updatedAt) / 3600000;
  if (dt > 0) {
    const rates = ratesPerHour(p);
    const cap = capacity(p);
    for (const r of RESOURCES) {
      // vượt sức chứa do cướp được thì giữ nguyên, chỉ ngừng sản xuất
      if (p.resources[r] < cap) p.resources[r] = Math.min(cap, p.resources[r] + rates[r] * dt);
    }
  }
  p.updatedAt = Math.max(p.updatedAt, until);
}

function settle(p, now) {
  if (p.build && p.build.finishAt <= now) {
    produce(p, p.build.finishAt);
    p.buildings[p.build.key] += 1;
    addLog(p, p.build.finishAt, `${BUILDINGS[p.build.key].name} đã lên cấp ${p.buildings[p.build.key]}.`);
    p.build = null;
  }
  produce(p, now);
}

function addLog(p, at, text) {
  p.log.unshift({ at, text });
  if (p.log.length > 30) p.log.length = 30;
}

function canAfford(p, cost) {
  return RESOURCES.every((r) => p.resources[r] >= (cost[r] || 0));
}

function pay(p, cost) {
  for (const r of RESOURCES) p.resources[r] -= cost[r] || 0;
}

function startUpgrade(p, key, now) {
  const b = BUILDINGS[key];
  if (!b) return 'Công trình không tồn tại.';
  if (p.build) return 'Đang có công trình xây dở, chờ xong đã.';
  const level = p.buildings[key];
  const max = key === 'hq' ? b.max : Math.min(MAX_LEVEL, p.buildings.hq + 1);
  if (level >= max) {
    return key === 'hq' || level >= MAX_LEVEL ? 'Đã đạt cấp tối đa.' : 'Nâng Trụ sở trước để mở cấp cao hơn.';
  }
  const cost = upgradeCost(key, level);
  if (!canAfford(p, cost)) return 'Không đủ vật tư.';
  pay(p, cost);
  p.build = { key, finishAt: now + upgradeTimeMs(level) };
  return null;
}

function trainTroops(p, count) {
  count = Math.floor(Number(count));
  if (!(count > 0)) return 'Số chiến binh không hợp lệ.';
  if (p.buildings.barracks < 1) return 'Cần xây Doanh trại trước.';
  if (p.troops + count > maxTroops(p)) return `Doanh trại chỉ chứa được ${maxTroops(p)} chiến binh.`;
  const cost = {};
  for (const r of RESOURCES) cost[r] = (TROOP_COST[r] || 0) * count;
  if (!canAfford(p, cost)) return 'Không đủ vật tư.';
  pay(p, cost);
  p.troops += count;
  return null;
}

// ---------- Lịch cuối tuần ----------

// Trả về { open, opensAt, closesAt, week } theo giờ Việt Nam
function raidWindow(now, alwaysOpen = false) {
  const vn = new Date(now + VN_OFFSET_MS); // đọc bằng getUTC* là ra giờ Việt Nam
  const day = vn.getUTCDay();
  const midnightVn = Date.UTC(vn.getUTCFullYear(), vn.getUTCMonth(), vn.getUTCDate()) - VN_OFFSET_MS;
  // tìm thứ Bảy của tuần này (tuần tính từ thứ Hai)
  const daysSinceMon = (day + 6) % 7;
  const satMidnight = midnightVn + (5 - daysSinceMon) * 86400000;
  const opensAt = satMidnight + RAID_OPEN_HOUR * 3600000;
  const closesAt = satMidnight + 2 * 86400000; // hết Chủ nhật
  const week = new Date(satMidnight + VN_OFFSET_MS).toISOString().slice(0, 10);
  const open = alwaysOpen || (now >= opensAt && now < closesAt);
  let nextOpen = opensAt;
  if (now >= closesAt) nextOpen = opensAt + 7 * 86400000;
  return { open, opensAt: nextOpen, closesAt, week };
}

function raidsLeft(p, week) {
  return p.raidWeek === week ? Math.max(0, RAIDS_PER_WEEKEND - p.raidsUsed) : RAIDS_PER_WEEKEND;
}

function stealable(p) {
  const protect = PROTECT_PER_STORAGE * p.buildings.storage;
  const out = {};
  for (const r of RESOURCES) out[r] = Math.floor(Math.max(0, p.resources[r] - protect) * STEAL_RATE);
  return out;
}

// Trận đánh tự động. Cả hai bên đã settle tới now. rand() trả về [0, 1).
function raid(attacker, defender, now, win, rand = Math.random) {
  if (!win.open) return { error: 'Chưa tới giờ cướp. Cướp mở từ 19:00 thứ Bảy tới hết Chủ nhật.' };
  if (attacker.id === defender.id) return { error: 'Không thể tự cướp mình.' };
  if (raidsLeft(attacker, win.week) <= 0) return { error: `Bạn đã dùng hết ${RAIDS_PER_WEEKEND} lượt cướp cuối tuần này.` };
  if (attacker.troops < 1) return { error: 'Cần ít nhất 1 chiến binh để đi cướp.' };
  if (defender.shieldUntil > now) return { error: 'Căn cứ này đang có khiên bảo vệ.' };

  const atk = Math.round(attackPower(attacker) * (0.85 + rand() * 0.3));
  const def = Math.round(defensePower(defender) * (0.85 + rand() * 0.3));
  const won = atk > def;

  // Thắng sát nút thì mất nhiều quân hơn, thua thì mất một nửa
  const lossRate = won ? Math.min(0.5, 0.1 + 0.4 * (def / atk)) : 0.5;
  const lost = Math.min(attacker.troops, Math.max(1, Math.round(attacker.troops * lossRate)));
  attacker.troops -= lost;
  const defLost = won ? Math.round(defender.troops * 0.3) : Math.round(defender.troops * 0.1);
  defender.troops -= defLost;

  const loot = { scrap: 0, fuel: 0, food: 0 };
  if (won) {
    const take = stealable(defender);
    for (const r of RESOURCES) {
      loot[r] = take[r];
      defender.resources[r] -= take[r];
      attacker.resources[r] += take[r];
    }
    defender.shieldUntil = now + SHIELD_MS;
  }

  if (attacker.raidWeek !== win.week) {
    attacker.raidWeek = win.week;
    attacker.raidsUsed = 0;
  }
  attacker.raidsUsed += 1;
  attacker.shieldUntil = 0; // đi cướp thì mất khiên của mình

  const lootText = RESOURCES.map((r) => `${loot[r]} ${RESOURCE_NAMES[r].toLowerCase()}`).join(', ');
  if (won) {
    addLog(attacker, now, `⚔️ Cướp thành công căn cứ ${defender.name} (công ${atk} / thủ ${def}). Lấy được ${lootText}. Mất ${lost} chiến binh.`);
    addLog(defender, now, `🔥 Bị ${attacker.name} cướp (công ${atk} / thủ ${def}). Mất ${lootText}. Được khiên bảo vệ 12 giờ.`);
  } else {
    addLog(attacker, now, `💀 Đánh ${defender.name} thất bại (công ${atk} / thủ ${def}). Mất ${lost} chiến binh.`);
    addLog(defender, now, `🛡️ Đã đẩy lui ${attacker.name} (công ${atk} / thủ ${def}).`);
  }
  return { won, atk, def, loot, lost, defLost };
}

module.exports = {
  RESOURCES,
  RESOURCE_NAMES,
  BUILDINGS,
  MAX_LEVEL,
  TROOP_COST,
  RAIDS_PER_WEEKEND,
  SHIELD_MS,
  newPlayer,
  settle,
  upgradeCost,
  upgradeTimeMs,
  capacity,
  ratesPerHour,
  maxTroops,
  attackPower,
  defensePower,
  startUpgrade,
  trainTroops,
  raidWindow,
  raidsLeft,
  stealable,
  raid,
};

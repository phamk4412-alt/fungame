// API JSON cho game Căn cứ tận thế, gắn vào server HTTP ở đường dẫn /api/raid/
const crypto = require('crypto');
const L = require('./logic');
const { createStore } = require('./store');

const ALWAYS_OPEN = process.env.RAID_ALWAYS_OPEN === '1'; // bật để thử cướp ngoài cuối tuần

const store = createStore();
const players = new Map(); // id -> người chơi
let ready = null;

function init() {
  if (!ready) {
    ready = store.load().then((list) => {
      for (const p of list) players.set(p.id, p);
      console.log(`☢️  Căn cứ tận thế: ${players.size} người chơi, lưu bằng ${store.kind}`);
      if (!process.env.DATABASE_URL) {
        console.log('   Chưa có DATABASE_URL: dữ liệu chỉ nằm trong file, server trên Render khởi động lại là mất.');
      }
    }).catch((e) => {
      ready = null; // lần sau thử kết nối lại
      throw e;
    });
  }
  return ready;
}

function persist(p) {
  store.save(p).catch((e) => console.error('Lưu người chơi lỗi:', e.message));
}

function hashPassword(password, salt) {
  return crypto.scryptSync(password, salt, 32).toString('hex');
}

function hashToken(token) {
  return crypto.createHash('sha256').update(token).digest('hex');
}

function issueToken(p) {
  const token = crypto.randomBytes(24).toString('hex');
  p.auth.tokens = [hashToken(token), ...p.auth.tokens].slice(0, 5);
  return token;
}

function findByName(name) {
  const key = name.toLowerCase();
  for (const p of players.values()) if (p.auth.login === key) return p;
  return null;
}

function authed(req) {
  const m = /^Bearer (\w+)$/.exec(req.headers.authorization || '');
  if (!m) return null;
  const h = hashToken(m[1]);
  for (const p of players.values()) if (p.auth.tokens.includes(h)) return p;
  return null;
}

function cleanName(name) {
  return String(name || '').replace(/[<>&"']/g, '').trim().slice(0, 16);
}

// Trạng thái gửi cho chính chủ
function view(p, now) {
  const win = L.raidWindow(now, ALWAYS_OPEN);
  const buildings = {};
  for (const [key, b] of Object.entries(L.BUILDINGS)) {
    const level = p.buildings[key];
    const max = key === 'hq' ? b.max : Math.min(L.MAX_LEVEL, p.buildings.hq + 1);
    buildings[key] = {
      name: b.name,
      icon: b.icon,
      desc: b.desc,
      level,
      maxed: level >= (key === 'hq' ? b.max : L.MAX_LEVEL),
      locked: level >= max && !(level >= (key === 'hq' ? b.max : L.MAX_LEVEL)),
      cost: L.upgradeCost(key, level),
      timeMs: L.upgradeTimeMs(level),
    };
  }
  return {
    now,
    id: p.id,
    name: p.name,
    resources: p.resources,
    rates: L.ratesPerHour(p),
    capacity: L.capacity(p),
    buildings,
    build: p.build,
    troops: p.troops,
    maxTroops: L.maxTroops(p),
    troopCost: L.TROOP_COST,
    attack: L.attackPower(p),
    defense: L.defensePower(p),
    shieldUntil: p.shieldUntil,
    raid: { ...win, left: L.raidsLeft(p, win.week), perWeekend: L.RAIDS_PER_WEEKEND },
    scavengeReadyAt: L.scavengeReadyAt(p),
    log: p.log,
  };
}

// Danh sách căn cứ khác: dùng làm bảng xếp hạng và chọn mục tiêu
function targets(me, now) {
  return [...players.values()]
    .map((p) => {
      L.settle(p, now);
      return {
        id: p.id,
        name: p.name,
        me: p.id === me.id,
        hq: p.buildings.hq,
        defense: L.defensePower(p),
        attack: L.attackPower(p),
        shielded: p.shieldUntil > now,
        shieldUntil: p.shieldUntil,
        loot: L.stealable(p),
        total: Math.floor(L.RESOURCES.reduce((s, r) => s + p.resources[r], 0)),
      };
    })
    .sort((a, b) => b.defense + b.attack - (a.defense + a.attack));
}

const routes = {
  'POST register': (body, now) => {
    const name = cleanName(body.name);
    const password = String(body.password || '');
    if (name.length < 2) return [400, { error: 'Tên phải có ít nhất 2 ký tự.' }];
    if (password.length < 4) return [400, { error: 'Mật khẩu phải có ít nhất 4 ký tự.' }];
    if (findByName(name)) return [400, { error: 'Tên này đã có người dùng.' }];
    const p = L.newPlayer(crypto.randomUUID(), name, now);
    const salt = crypto.randomBytes(16).toString('hex');
    p.auth = { login: name.toLowerCase(), salt, hash: hashPassword(password, salt), tokens: [] };
    const token = issueToken(p);
    players.set(p.id, p);
    persist(p);
    return [200, { token, state: view(p, now) }];
  },

  'POST login': (body, now) => {
    const p = findByName(cleanName(body.name));
    const password = String(body.password || '');
    if (!p || hashPassword(password, p.auth.salt) !== p.auth.hash) {
      return [401, { error: 'Sai tên hoặc mật khẩu.' }];
    }
    L.settle(p, now);
    const token = issueToken(p);
    persist(p);
    return [200, { token, state: view(p, now) }];
  },

  'GET me': (body, now, p) => [200, { state: view(p, now) }],

  'POST upgrade': (body, now, p) => {
    const err = L.startUpgrade(p, String(body.key || ''), now);
    if (err) return [400, { error: err }];
    persist(p);
    return [200, { state: view(p, now) }];
  },

  'POST train': (body, now, p) => {
    const err = L.trainTroops(p, body.count);
    if (err) return [400, { error: err }];
    persist(p);
    return [200, { state: view(p, now) }];
  },

  'POST scavenge': (body, now, p) => {
    const result = L.scavenge(p, body.spot, now);
    if (result.error) return [400, { error: result.error }];
    persist(p);
    return [200, { result, state: view(p, now) }];
  },

  'GET targets': (body, now, p) => [200, { targets: targets(p, now) }],

  'POST attack': (body, now, p) => {
    const target = players.get(String(body.targetId || ''));
    if (!target) return [404, { error: 'Không tìm thấy căn cứ này.' }];
    L.settle(target, now);
    const result = L.raid(p, target, now, L.raidWindow(now, ALWAYS_OPEN));
    if (result.error) return [400, { error: result.error }];
    persist(p);
    persist(target);
    return [200, { result, state: view(p, now) }];
  },
};

function readBody(req) {
  return new Promise((resolve) => {
    let data = '';
    req.on('data', (c) => {
      data += c;
      if (data.length > 10000) req.destroy();
    });
    req.on('end', () => {
      try {
        resolve(JSON.parse(data || '{}'));
      } catch {
        resolve({});
      }
    });
  });
}

// Trả về true nếu đã xử lý request
function handle(req, res) {
  const url = new URL(req.url, 'http://x');
  if (!url.pathname.startsWith('/api/raid/')) return false;
  const reply = (status, obj) => {
    res.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' });
    res.end(JSON.stringify(obj));
  };
  const route = routes[`${req.method} ${url.pathname.slice('/api/raid/'.length)}`];
  if (!route) {
    reply(404, { error: 'Không có API này.' });
    return true;
  }
  Promise.all([init(), req.method === 'POST' ? readBody(req) : {}])
    .then(([, body]) => {
      const now = Date.now();
      let p = null;
      if (!/^POST (register|login)$/.test(`${req.method} ${url.pathname.slice(10)}`)) {
        p = authed(req);
        if (!p) return reply(401, { error: 'Phiên đăng nhập đã hết, hãy đăng nhập lại.' });
        L.settle(p, now);
      }
      const [status, obj] = route(body, now, p);
      reply(status, obj);
    })
    .catch((e) => {
      console.error(e);
      reply(500, { error: 'Lỗi máy chủ, thử lại sau.' });
    });
  return true;
}

module.exports = { handle, init };

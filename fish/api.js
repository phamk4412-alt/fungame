// API JSON cho game Câu cá 3D, gắn vào server HTTP ở đường dẫn /api/fish/
const crypto = require('crypto');
const path = require('path');
const L = require('./logic');
const { createStore } = require('../raid/store');

const store = createStore('fish_players', process.env.FISH_DATA_FILE || path.join(__dirname, '..', 'data', 'fish.json'));
const players = new Map(); // id -> người chơi
const presence = new Map(); // id -> đang đứng ở hồ nào, làm gì (chỉ giữ trong bộ nhớ)
const feed = []; // các mẻ cá mới nhất của mọi người
let feedSeq = 0;
let ready = null;

const PRESENCE_TTL = 8000;
const SPOTS = 6; // số chỗ đứng quanh mỗi hồ

function init() {
  if (!ready) {
    ready = store.load().then((list) => {
      for (const p of list) players.set(p.id, p);
      console.log(`🎣 Câu cá 3D: ${players.size} người chơi, lưu bằng ${store.kind}`);
    }).catch((e) => {
      ready = null;
      throw e;
    });
  }
  return ready;
}

function persist(p) {
  store.save(p).catch((e) => console.error('Lưu người câu lỗi:', e.message));
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

function view(p, now) {
  return {
    now,
    id: p.id,
    name: p.name,
    money: p.money,
    earned: p.earned,
    rod: p.rod,
    rods: p.rods,
    baits: p.baits,
    cooler: p.cooler,
    coolerSize: L.coolerSize(p),
    fish: p.fish,
    lakes: p.lakes,
    lake: p.lake,
    best: p.best,
    caught: p.caught,
    legend: p.legend,
    biggest: p.biggest,
    spot: spotOf(p),
  };
}

// Mỗi người một chỗ đứng cố định quanh hồ để bạn bè thấy nhau
function spotOf(p) {
  const taken = new Set();
  const now = Date.now();
  for (const [id, pr] of presence) {
    if (id !== p.id && pr.lake === p.lake && now - pr.at < PRESENCE_TTL) taken.add(pr.spot);
  }
  const mine = presence.get(p.id);
  if (mine && mine.lake === p.lake && !taken.has(mine.spot)) return mine.spot;
  for (let i = 0; i < SPOTS; i++) if (!taken.has(i)) return i;
  return SPOTS - 1;
}

const CATALOG = {
  gameDayMs: L.GAME_DAY_MS,
  phases: L.PHASES,
  rarity: L.RARITY,
  lakes: L.LAKE_ORDER.map((id) => ({ id, ...L.LAKES[id] })),
  fish: Object.fromEntries(Object.entries(L.FISH).map(([id, f]) => [id, { ...f }])),
  rods: L.ROD_ORDER.map((id) => ({ id, ...L.RODS[id] })),
  baits: L.BAIT_ORDER.map((id) => ({ id, ...L.BAITS[id] })),
  coolers: L.COOLERS,
  spots: SPOTS,
};

function cleanCast(c) {
  if (!Array.isArray(c) || c.length !== 2) return null;
  const [x, z] = c.map(Number);
  if (!Number.isFinite(x) || !Number.isFinite(z)) return null;
  return [Math.round(x * 10) / 10, Math.round(z * 10) / 10];
}

const routes = {
  'GET catalog': () => [200, CATALOG],

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
    const token = issueToken(p);
    persist(p);
    return [200, { token, state: view(p, now) }];
  },

  'GET me': (body, now, p) => [200, { state: view(p, now) }],

  'POST cast': (body, now, p) => {
    const result = L.startCast(p, String(body.lake || p.lake), String(body.bait || 'giun'), now);
    if (result.error) return [400, { error: result.error }];
    persist(p);
    return [200, { cast: result.cast, state: view(p, now) }];
  },

  'POST land': (body, now, p) => {
    const result = L.land(p, String(body.castId || ''), !!body.ok, now);
    if (result.error) return [400, { error: result.error }];
    if (result.fish) {
      const f = L.FISH[result.fish.s];
      feed.push({ seq: ++feedSeq, name: p.name, id: p.id, s: result.fish.s, w: result.fish.w, rarity: f.rarity, lake: f.lake, at: now });
      if (feed.length > 40) feed.shift();
      const pr = presence.get(p.id);
      if (pr) pr.landed = { s: result.fish.s, w: result.fish.w, at: now };
    }
    persist(p);
    return [200, { ...result, state: view(p, now) }];
  },

  'POST sell': (body, now, p) => {
    const result = L.sell(p, body.index === 'all' ? 'all' : body.index);
    if (result.error) return [400, { error: result.error }];
    persist(p);
    return [200, { ...result, state: view(p, now) }];
  },

  'POST buy': (body, now, p) => {
    const err = L.buy(p, String(body.kind || ''), String(body.id || ''));
    if (err) return [400, { error: err }];
    persist(p);
    return [200, { state: view(p, now) }];
  },

  // Gửi mình đang làm gì, nhận lại những người đang câu cùng hồ
  'POST presence': (body, now, p) => {
    const lake = p.lakes.includes(body.lake) ? body.lake : p.lake;
    p.lake = lake;
    const prev = presence.get(p.id);
    const spot = spotOf(p);
    presence.set(p.id, {
      name: p.name,
      lake,
      spot,
      rod: p.rod,
      act: String(body.act || 'idle').slice(0, 10),
      cast: cleanCast(body.cast),
      tension: Math.max(0, Math.min(1.5, Number(body.tension) || 0)),
      landed: prev && prev.landed && now - prev.landed.at < 6000 ? prev.landed : null,
      at: now,
    });
    for (const [id, pr] of presence) if (now - pr.at > 60000) presence.delete(id);
    const others = [];
    for (const [id, pr] of presence) {
      if (id !== p.id && pr.lake === lake && now - pr.at < PRESENCE_TTL) others.push({ id, ...pr });
    }
    const since = Number(body.since) || 0;
    return [200, { now, spot, others, feed: feed.filter((f) => f.seq > since), feedSeq }];
  },

  'GET board': (body, now, p) => {
    const list = [...players.values()];
    const row = (q) => ({ name: q.name, me: q.id === p.id, biggest: q.biggest, earned: q.earned, caught: q.caught, legend: q.legend });
    const biggest = list.filter((q) => q.biggest).sort((a, b) => b.biggest.w - a.biggest.w).slice(0, 15).map(row);
    const rich = list.filter((q) => q.earned > 0).sort((a, b) => b.earned - a.earned).slice(0, 15).map(row);
    // kỷ lục từng loài trên toàn server
    const records = {};
    for (const q of list) {
      for (const [s, w] of Object.entries(q.best)) {
        if (!records[s] || w > records[s].w) records[s] = { w, name: q.name };
      }
    }
    return [200, { biggest, rich, records, online: [...presence.values()].filter((pr) => now - pr.at < PRESENCE_TTL).length }];
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

const PUBLIC = /^(POST register|POST login|GET catalog)$/;

// Trả về true nếu đã xử lý request
function handle(req, res) {
  const url = new URL(req.url, 'http://x');
  if (!url.pathname.startsWith('/api/fish/')) return false;
  const reply = (status, obj) => {
    res.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' });
    res.end(JSON.stringify(obj));
  };
  const key = `${req.method} ${url.pathname.slice('/api/fish/'.length)}`;
  const route = routes[key];
  if (!route) {
    reply(404, { error: 'Không có API này.' });
    return true;
  }
  Promise.all([init(), req.method === 'POST' ? readBody(req) : {}])
    .then(([, body]) => {
      const now = Date.now();
      let p = null;
      if (!PUBLIC.test(key)) {
        p = authed(req);
        if (!p) return reply(401, { error: 'Phiên đăng nhập đã hết, hãy đăng nhập lại.' });
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

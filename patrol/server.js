// Mạng cho Patrol (không chiến nhiều người): tin nhắn WebSocket có type bắt đầu bằng "pt:".
//   Client gửi: pt:join {room, name, plane, id}; pt:s {p, f, u, v, ab} (vị trí ~12 lần/giây)
//               pt:fire {mid, p, v, tgt, gp}; pt:hit {victim, mid}; pt:crash {p}; pt:respawn {p, f, u}
//   Server gửi: pt:welcome {id, room, players}; pt:join {pl}; pt:gone {id}; pt:s {id, ...}
//               pt:fire {id, ...}; pt:kill {victim, killer, p, how}; pt:respawn {id, hp}; pt:hp {id, hp}; pt:error {message}
// Server giữ máu và điểm; client bắn trúng thì báo pt:hit (đồ chơi giữa bạn bè nên tin client).
const crypto = require('crypto');

const PLANES = {
  kestrel: { hp: 100 },
  heron: { hp: 90 },
  wasp: { hp: 80 },
  bison: { hp: 150 },
};
const MISSILE_DMG = 55;
const MAX_PLAYERS = 12;
const rooms = new Map(); // code -> { code, players: Map<id, player> }

function send(ws, msg) {
  if (ws.readyState === ws.OPEN) ws.send(JSON.stringify(msg));
}
function cast(room, msg, except) {
  const s = JSON.stringify(msg);
  for (const p of room.players.values()) if (p.ws !== except && p.ws.readyState === p.ws.OPEN) p.ws.send(s);
}
function cleanCode(s) {
  return String(s || '').toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 8) || 'SKY';
}
function cleanName(s) {
  return String(s || '').replace(/[^\p{L}\p{N} _.-]/gu, '').replace(/\s+/g, ' ').trim().slice(0, 14) || 'PILOT';
}
const num = (v) => (typeof v === 'number' && Number.isFinite(v) ? v : 0);
const vec = (a) => (Array.isArray(a) && a.length === 3 ? a.map(num) : [0, 0, 0]);
function pub(p) {
  return { id: p.id, name: p.name, plane: p.plane, hp: p.hp, alive: p.alive, kills: p.kills, deaths: p.deaths, s: p.s };
}

function handle(ws, msg) {
  if (msg.type === 'pt:join') {
    leave(ws);
    const code = cleanCode(msg.room);
    let room = rooms.get(code);
    if (!room) { room = { code, players: new Map() }; rooms.set(code, room); }
    if (room.players.size >= MAX_PLAYERS) { send(ws, { type: 'pt:error', message: 'Room is full' }); return; }
    const plane = PLANES[msg.plane] ? msg.plane : 'kestrel';
    let id = String(msg.id || '').replace(/[^a-zA-Z0-9-]/g, '').slice(0, 40) || crypto.randomUUID();
    if (room.players.has(id)) id = crypto.randomUUID();
    const p = { id, ws, name: cleanName(msg.name), plane, hp: PLANES[plane].hp, alive: true, kills: 0, deaths: 0, s: null };
    room.players.set(id, p);
    ws.pt = { room, p };
    send(ws, { type: 'pt:welcome', id, room: code, players: [...room.players.values()].filter((q) => q !== p).map(pub) });
    cast(room, { type: 'pt:join', pl: pub(p) }, ws);
    return;
  }
  const ctx = ws.pt;
  if (!ctx) return;
  const { room, p } = ctx;
  switch (msg.type) {
    case 'pt:s': {
      if (!p.alive) return;
      p.s = { p: vec(msg.p), f: vec(msg.f), u: vec(msg.u), v: num(msg.v), ab: num(msg.ab) };
      cast(room, { type: 'pt:s', id: p.id, ...p.s }, ws);
      break;
    }
    case 'pt:fire':
      if (!p.alive) return;
      cast(room, { type: 'pt:fire', id: p.id, mid: String(msg.mid || '').slice(0, 40), p: vec(msg.p), v: vec(msg.v),
        tgt: typeof msg.tgt === 'string' ? msg.tgt.slice(0, 40) : null, gp: vec(msg.gp) }, ws);
      break;
    case 'pt:hit': {
      const victim = room.players.get(String(msg.victim || ''));
      if (!victim || !victim.alive || victim === p) return;
      victim.hp = Math.max(0, victim.hp - MISSILE_DMG);
      if (victim.hp <= 0) {
        victim.alive = false; victim.deaths++; p.kills++;
        cast(room, { type: 'pt:kill', victim: victim.id, killer: p.id, how: 'missile', p: victim.s ? victim.s.p : null, score: score(room) });
      } else cast(room, { type: 'pt:hp', id: victim.id, hp: victim.hp, by: p.id });
      break;
    }
    case 'pt:crash':
      if (!p.alive) return;
      p.alive = false; p.deaths++;
      cast(room, { type: 'pt:kill', victim: p.id, killer: null, how: 'crash', p: vec(msg.p), score: score(room) });
      break;
    case 'pt:respawn':
      if (p.alive) return;
      p.alive = true; p.hp = PLANES[p.plane].hp;
      p.s = { p: vec(msg.p), f: vec(msg.f), u: vec(msg.u), v: 200, ab: 0 };
      cast(room, { type: 'pt:respawn', id: p.id, hp: p.hp, s: p.s });
      break;
    default:
  }
}
function score(room) {
  return [...room.players.values()].map((q) => ({ id: q.id, kills: q.kills, deaths: q.deaths }));
}
function leave(ws) {
  const ctx = ws.pt;
  if (!ctx) return;
  ws.pt = null;
  ctx.room.players.delete(ctx.p.id);
  cast(ctx.room, { type: 'pt:gone', id: ctx.p.id });
  if (!ctx.room.players.size) rooms.delete(ctx.room.code);
}

module.exports = { handle, close: leave, rooms, MISSILE_DMG, PLANES };

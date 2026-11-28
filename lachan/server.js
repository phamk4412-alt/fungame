// Mạng cho Đấu Trường Lá Chắn Ngôn Từ: tin nhắn WebSocket có type bắt đầu bằng "lc:".
//   Máy chiếu: lc:host {room?, key?}  → lc:hosted {code, key}; lc:cmd {cmd, id?}
//   Điện thoại: lc:join {room, name, playerId, team?}; lc:team {team}; lc:answer {q, choice}
//   Server gửi: lc:state {state} (riêng cho từng kết nối), lc:error {message}
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { Arena } = require('./arena');

const DATA_FILE = path.join(__dirname, '..', 'public', 'lachan', 'data.json');
const CODE_CHARS = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789'; // bỏ I, L, O, 0, 1 cho dễ đọc trên máy chiếu
const IDLE_MS = 45 * 60000; // xóa phòng không còn ai sau 45 phút

const arenas = new Map(); // code -> { arena, key, clients: Set<ws>, emptySince }
let data = null;
let ticker = null;

function loadData() {
  if (!data) data = JSON.parse(fs.readFileSync(DATA_FILE, 'utf8'));
  return data;
}

function send(ws, msg) {
  if (ws.readyState === ws.OPEN) ws.send(JSON.stringify(msg));
}

function newCode() {
  for (;;) {
    let c = '';
    for (let i = 0; i < 4; i++) c += CODE_CHARS[crypto.randomInt(CODE_CHARS.length)];
    if (!arenas.has(c)) return c;
  }
}

function cleanCode(s) {
  return String(s || '').toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 6);
}

function cleanName(s) {
  return String(s || '').replace(/[<>&"'`]/g, '').replace(/\s+/g, ' ').trim().slice(0, 16);
}

function broadcast(room) {
  for (const ws of room.clients) {
    const state = ws.lcRole === 'host' ? room.arena.stateForHost() : room.arena.stateForPlayer(ws.lcPlayer);
    send(ws, { type: 'lc:state', state });
  }
}

function ensureTicker() {
  if (ticker) return;
  ticker = setInterval(() => {
    const now = Date.now();
    for (const [code, room] of arenas) {
      if (room.arena.tick()) broadcast(room);
      if (room.clients.size === 0 && now - room.emptySince > IDLE_MS) arenas.delete(code);
    }
    if (!arenas.size) { clearInterval(ticker); ticker = null; }
  }, 250);
  if (ticker.unref) ticker.unref();
}

function attach(ws, room) {
  ws.lcRoom = room;
  room.clients.add(ws);
  room.emptySince = 0;
}

/** Xử lý một tin nhắn "lc:*". */
function handle(ws, msg) {
  const room = ws.lcRoom;
  switch (msg.type) {
    case 'lc:host': {
      const code = cleanCode(msg.room);
      let r = arenas.get(code);
      if (!r || !msg.key || msg.key !== r.key) {
        const c = newCode();
        r = { arena: new Arena(c, loadData()), key: crypto.randomBytes(12).toString('hex'), clients: new Set(), emptySince: 0 };
        arenas.set(c, r);
      }
      ws.lcRole = 'host';
      attach(ws, r);
      ensureTicker();
      send(ws, { type: 'lc:hosted', code: r.arena.code, key: r.key });
      broadcast(r);
      return;
    }
    case 'lc:join': {
      const r = arenas.get(cleanCode(msg.room));
      if (!r) { send(ws, { type: 'lc:error', message: 'Không tìm thấy phòng. Kiểm tra lại mã trên màn hình.', fatal: true }); return; }
      const id = String(msg.playerId || '').slice(0, 64) || crypto.randomUUID();
      const team = msg.team == null || msg.team === '' ? null : Number(msg.team);
      const err = r.arena.join(id, cleanName(msg.name), team);
      if (err) { send(ws, { type: 'lc:error', message: err, fatal: true }); return; }
      if (ws.lcRoom && ws.lcPlayer) ws.lcRoom.arena.setConnected(ws.lcPlayer, -1);
      ws.lcRole = 'player';
      ws.lcPlayer = id;
      r.arena.setConnected(id, +1);
      attach(ws, r);
      send(ws, { type: 'lc:joined', code: r.arena.code, playerId: id });
      broadcast(r);
      return;
    }
    default:
      break;
  }
  if (!room) return;
  const a = room.arena;
  if (msg.type === 'lc:cmd' && ws.lcRole === 'host') {
    if (msg.cmd === 'start') a.start();
    else if (msg.cmd === 'next') {
      // Bấm tiếp hai lần cùng lúc (video vừa hết + MC bấm Space) chỉ được tính một lần
      if ((msg.from && msg.from !== a.phase) || (msg.q != null && Number(msg.q) !== a.qIndex)) return;
      a.next();
    }
    else if (msg.cmd === 'reset') a.reset();
    else if (msg.cmd === 'kick') {
      const id = String(msg.id || '');
      a.kick(id);
      for (const c of room.clients) {
        if (c.lcPlayer === id) { send(c, { type: 'lc:error', message: 'MC đã mời bạn ra khỏi phòng.', fatal: true }); c.lcRoom = null; c.lcPlayer = null; room.clients.delete(c); }
      }
    } else return;
    broadcast(room);
    return;
  }
  if (ws.lcRole !== 'player' || !a.players.has(ws.lcPlayer)) return;
  if (msg.type === 'lc:team') {
    a.setTeam(ws.lcPlayer, Number(msg.team));
    broadcast(room);
  } else if (msg.type === 'lc:answer') {
    if (a.answer(ws.lcPlayer, Number(msg.q), Number(msg.choice))) broadcast(room);
  }
}

/** Gọi khi một kết nối đóng. */
function close(ws) {
  const room = ws.lcRoom;
  if (!room) return;
  room.clients.delete(ws);
  if (ws.lcPlayer) room.arena.setConnected(ws.lcPlayer, -1);
  if (room.clients.size === 0) room.emptySince = Date.now();
  broadcast(room);
}

module.exports = { handle, close, _arenas: arenas };

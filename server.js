// Server HTTP (phục vụ giao diện) + WebSocket (chơi realtime)
const http = require('http');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { WebSocketServer } = require('ws');
const { Table } = require('./game');

const PORT = process.env.PORT || 3000;
const PUBLIC_DIR = path.join(__dirname, 'public');
const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.ico': 'image/x-icon',
};

const server = http.createServer((req, res) => {
  const urlPath = decodeURIComponent(new URL(req.url, 'http://x').pathname);
  let file = path.normalize(path.join(PUBLIC_DIR, urlPath === '/' ? 'index.html' : urlPath));
  if (!file.startsWith(PUBLIC_DIR)) {
    res.writeHead(403).end();
    return;
  }
  fs.readFile(file, (err, data) => {
    if (err) {
      // Mọi đường dẫn khác trả về trang chính
      fs.readFile(path.join(PUBLIC_DIR, 'index.html'), (e, html) => {
        res.writeHead(e ? 404 : 200, { 'Content-Type': MIME['.html'] });
        res.end(e ? 'Not found' : html);
      });
      return;
    }
    res.writeHead(200, { 'Content-Type': MIME[path.extname(file)] || 'application/octet-stream' });
    res.end(data);
  });
});

const wss = new WebSocketServer({ server });
const tables = new Map(); // mã phòng -> { table, clients: Set<ws> }

function getRoom(code) {
  let room = tables.get(code);
  if (!room) {
    room = { clients: new Set(), chat: [] };
    room.table = new Table(code, () => broadcast(room));
    tables.set(code, room);
  }
  return room;
}

function send(ws, msg) {
  if (ws.readyState === ws.OPEN) ws.send(JSON.stringify(msg));
}

function broadcast(room) {
  for (const ws of room.clients) {
    send(ws, { type: 'state', state: room.table.stateFor(ws.playerId), chat: room.chat });
  }
}

function cleanCode(code) {
  return String(code || '').toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 8);
}

function cleanName(name) {
  return String(name || '').replace(/[<>]/g, '').trim().slice(0, 16);
}

wss.on('connection', (ws) => {
  ws.room = null;
  ws.playerId = null;

  ws.on('message', (raw) => {
    let msg;
    try {
      msg = JSON.parse(raw);
    } catch {
      return;
    }

    if (msg.type === 'join') {
      const code = cleanCode(msg.room) || crypto.randomBytes(3).toString('hex').toUpperCase();
      const room = getRoom(code);
      ws.playerId = String(msg.playerId || crypto.randomUUID()).slice(0, 64);
      const seat = room.table.addPlayer(ws.playerId, cleanName(msg.name));
      ws.room = room;
      room.clients.add(ws);
      if (seat < 0) send(ws, { type: 'error', message: 'Bàn đã đủ 6 người. Bạn đang xem với tư cách khán giả.' });
      clearTimeout(room.cleanupTimer);
      room.table.maybeAutoStart();
      broadcast(room);
      return;
    }

    const room = ws.room;
    if (!room) return;
    const table = room.table;

    switch (msg.type) {
      case 'start':
        if (table.handNo === 0) table.startHand();
        break;
      case 'action': {
        const err = table.act(ws.playerId, msg.action || {});
        if (err) send(ws, { type: 'error', message: err });
        break;
      }
      case 'rebuy': {
        const err = table.rebuy(ws.playerId);
        if (err) send(ws, { type: 'error', message: err });
        break;
      }
      case 'chat': {
        const seat = table.seatOf(ws.playerId);
        const text = String(msg.text || '').slice(0, 200).trim();
        if (!text) return;
        const name = seat >= 0 ? table.seats[seat].name : 'Khán giả';
        room.chat.push({ name, text });
        if (room.chat.length > 50) room.chat.shift();
        break;
      }
      case 'leave':
        table.removePlayer(ws.playerId);
        break;
      default:
        return;
    }
    broadcast(room);
  });

  ws.on('close', () => {
    const room = ws.room;
    if (!room) return;
    room.clients.delete(ws);
    const id = ws.playerId;
    // Nếu người này không còn kết nối nào khác thì đánh dấu mất kết nối
    const stillHere = [...room.clients].some((c) => c.playerId === id);
    if (!stillHere) {
      room.table.setConnected(id, false);
      // Cho 60 giây để vào lại (ví dụ khi tải lại trang)
      setTimeout(() => {
        const back = [...room.clients].some((c) => c.playerId === id);
        if (!back) {
          room.table.removePlayer(id);
          broadcast(room);
        }
      }, 60000);
    }
    broadcast(room);
    if (room.clients.size === 0) {
      // Xóa phòng trống sau 10 phút
      room.cleanupTimer = setTimeout(() => {
        if (room.clients.size === 0) {
          clearTimeout(room.table.turnTimer);
          clearTimeout(room.table.nextHandTimer);
          tables.delete(room.table.code);
        }
      }, 10 * 60000);
    }
  });
});

server.listen(PORT, () => {
  console.log(`♠ Poker server đang chạy tại http://localhost:${PORT}`);
});

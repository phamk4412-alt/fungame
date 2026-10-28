// Lưu người chơi Căn cứ tận thế lâu dài.
// Có DATABASE_URL thì dùng Postgres, không có thì ghi file data/raid.json (chỉ hợp khi chạy trên máy mình).
const fs = require('fs');
const path = require('path');

class PgStore {
  constructor(url) {
    const { Pool } = require('pg');
    const local = /localhost|127\.0\.0\.1/.test(url);
    this.pool = new Pool({ connectionString: url, ssl: local ? false : { rejectUnauthorized: false }, max: 3 });
    this.kind = 'Postgres';
  }

  async load() {
    await this.pool.query('CREATE TABLE IF NOT EXISTS raid_players (id TEXT PRIMARY KEY, data JSONB NOT NULL)');
    const { rows } = await this.pool.query('SELECT data FROM raid_players');
    return rows.map((r) => r.data);
  }

  async save(p) {
    await this.pool.query(
      'INSERT INTO raid_players (id, data) VALUES ($1, $2) ON CONFLICT (id) DO UPDATE SET data = EXCLUDED.data',
      [p.id, JSON.stringify(p)],
    );
  }
}

class FileStore {
  constructor(file) {
    this.file = file;
    this.kind = 'file ' + file;
    this.all = new Map();
    this.timer = null;
  }

  async load() {
    try {
      const list = JSON.parse(fs.readFileSync(this.file, 'utf8'));
      for (const p of list) this.all.set(p.id, p);
    } catch {
      // chưa có file thì bắt đầu trống
    }
    return [...this.all.values()];
  }

  async save(p) {
    this.all.set(p.id, p);
    clearTimeout(this.timer);
    this.timer = setTimeout(() => {
      fs.mkdirSync(path.dirname(this.file), { recursive: true });
      fs.writeFileSync(this.file, JSON.stringify([...this.all.values()]));
    }, 200);
  }
}

function createStore() {
  if (process.env.DATABASE_URL) return new PgStore(process.env.DATABASE_URL);
  return new FileStore(process.env.RAID_DATA_FILE || path.join(__dirname, '..', 'data', 'raid.json'));
}

module.exports = { createStore };

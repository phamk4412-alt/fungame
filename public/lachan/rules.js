// Luật chơi thuần (không đụng DOM) — dùng chung cho trình duyệt và bài kiểm thử Node.
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.LCRules = factory();
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  /** Giữ HP trong khoảng 0..100. */
  function clampHp(v) {
    return Math.max(0, Math.min(100, Math.round(v)));
  }

  /** Mức màu của thanh Tinh thần: 'good' (xanh), 'warn' (vàng), 'danger' (đỏ nhấp nháy). */
  function hpLevel(hp, low, mid) {
    if (hp <= low) return 'danger';
    if (hp <= mid) return 'warn';
    return 'good';
  }

  function lerp(a, b, t) {
    return a + (b - a) * Math.max(0, Math.min(1, t));
  }

  /** Khoảng cách (giây) giữa hai bình luận ở Màn 2 khi đã chơi được tỉ lệ t (0..1). */
  function spawnInterval(cfg, t) {
    return lerp(cfg.spawnStart, cfg.spawnEnd, t);
  }

  /** Thời gian (giây) để một bình luận trôi từ đáy lên đỉnh khi đã chơi được tỉ lệ t. */
  function riseDuration(cfg, t) {
    return lerp(cfg.riseStart, cfg.riseEnd, t);
  }

  /** Điểm cho một lần xử lý đúng ở Màn 2, với chuỗi combo hiện tại (tính cả lần này). */
  function stormScore(cfg, combo) {
    return cfg.correctScore + cfg.comboBonus * Math.min(Math.max(combo - 1, 0), cfg.comboCap);
  }

  /** Điểm Màn 1: đúng thì điểm gốc + thưởng tốc độ theo số giây còn lại. */
  function classifyScore(cfg, correct, secondsLeft) {
    if (!correct) return 0;
    return cfg.correctScore + Math.max(0, Math.floor(secondsLeft)) * cfg.speedBonusPerSecond;
  }

  /** Điểm Màn 3: chỉ lựa chọn làm tăng HP mới được điểm. */
  function empathyScore(cfg, hpDelta) {
    return Math.max(0, hpDelta) * cfg.scorePerHp;
  }

  /** Kết cục cuối game. */
  function outcome(hp, winHp) {
    if (hp <= 0) return 'fail';
    return hp > winHp ? 'win' : 'lose';
  }

  /** Bộ sinh số ngẫu nhiên có hạt giống (mulberry32) để thứ tự bình luận lặp lại được. */
  function rng(seed) {
    let a = seed >>> 0;
    return function () {
      a = (a + 0x6d2b79f5) >>> 0;
      let t = a;
      t = Math.imul(t ^ (t >>> 15), t | 1);
      t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }

  /** Trộn mảng (bản sao) bằng hàm ngẫu nhiên cho trước. */
  function shuffle(arr, rand) {
    const a = arr.slice();
    for (let i = a.length - 1; i > 0; i--) {
      const j = Math.floor(rand() * (i + 1));
      [a[i], a[j]] = [a[j], a[i]];
    }
    return a;
  }

  /** Trộn nhưng tránh hai bình luận liền nhau cần cùng một kỹ năng (khi có thể). */
  function stormOrder(comments, rand) {
    const pool = shuffle(comments, rand);
    const out = [];
    while (pool.length) {
      const last = out[out.length - 1];
      let idx = pool.findIndex((c) => !last || c.skill !== last.skill);
      if (idx < 0) idx = 0;
      out.push(pool.splice(idx, 1)[0]);
    }
    return out;
  }

  return { clampHp, hpLevel, lerp, spawnInterval, riseDuration, stormScore, classifyScore, empathyScore, outcome, rng, shuffle, stormOrder };
});

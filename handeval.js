// Đánh giá tay bài Texas Hold'em: chọn 5 lá tốt nhất trong 7 lá.
// Lá bài dạng chuỗi "As", "Td", "9c"... (rank + suit)

const RANKS = '23456789TJQKA';
const HAND_NAMES = [
  'Mậu thầu', 'Một đôi', 'Thú (hai đôi)', 'Sám cô', 'Sảnh',
  'Thùng', 'Cù lũ', 'Tứ quý', 'Thùng phá sảnh',
];

function rankOf(card) {
  return RANKS.indexOf(card[0]) + 2;
}

// Trả về mảng điểm [hạng, ...kicker] để so sánh theo thứ tự từ điển
function score5(cards) {
  const ranks = cards.map(rankOf).sort((a, b) => b - a);
  const suits = cards.map((c) => c[1]);
  const flush = suits.every((s) => s === suits[0]);

  const uniq = [...new Set(ranks)];
  let straightHigh = 0;
  if (uniq.length === 5) {
    if (ranks[0] - ranks[4] === 4) straightHigh = ranks[0];
    else if (ranks[0] === 14 && ranks[1] === 5) straightHigh = 5; // A-2-3-4-5
  }

  const counts = {};
  for (const r of ranks) counts[r] = (counts[r] || 0) + 1;
  const groups = Object.entries(counts)
    .map(([r, c]) => [c, Number(r)])
    .sort((a, b) => b[0] - a[0] || b[1] - a[1]);
  const byGroup = groups.map((g) => g[1]);

  if (straightHigh && flush) return [8, straightHigh];
  if (groups[0][0] === 4) return [7, ...byGroup];
  if (groups[0][0] === 3 && groups[1][0] === 2) return [6, ...byGroup];
  if (flush) return [5, ...ranks];
  if (straightHigh) return [4, straightHigh];
  if (groups[0][0] === 3) return [3, ...byGroup];
  if (groups[0][0] === 2 && groups[1][0] === 2) return [2, ...byGroup];
  if (groups[0][0] === 2) return [1, ...byGroup];
  return [0, ...ranks];
}

function compareScores(a, b) {
  for (let i = 0; i < Math.max(a.length, b.length); i++) {
    const d = (a[i] || 0) - (b[i] || 0);
    if (d !== 0) return d;
  }
  return 0;
}

function bestHand(cards) {
  let best = null;
  let bestCards = null;
  const n = cards.length;
  for (let a = 0; a < n; a++)
    for (let b = a + 1; b < n; b++)
      for (let c = b + 1; c < n; c++)
        for (let d = c + 1; d < n; d++)
          for (let e = d + 1; e < n; e++) {
            const five = [cards[a], cards[b], cards[c], cards[d], cards[e]];
            const s = score5(five);
            if (!best || compareScores(s, best) > 0) {
              best = s;
              bestCards = five;
            }
          }
  return { score: best, cards: bestCards, name: HAND_NAMES[best[0]] };
}

module.exports = { bestHand, compareScores, score5, HAND_NAMES };

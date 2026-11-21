// Avatar nhân vật ảo vẽ bằng SVG (không cần ảnh, chạy offline).
(function () {
  'use strict';
  let uid = 0;

  const SKINS = ['#f5cdb0', '#e8b994', '#d9a37f', '#f2c9a5', '#c98f6b', '#f7d3b8'];
  const HAIRS = ['#1b1b1f', '#2b1a14', '#5a3825', '#8a4b2a', '#3a2a22', '#a8572f'];
  const STYLES = ['short', 'long', 'bun', 'cap', 'short', 'long'];
  const BGS = [['#ff8a8a', '#d63b5c'], ['#ffd36e', '#ff9a3c'], ['#7ef0c8', '#2bb3a3'], ['#c9a7ff', '#7b5cff'], ['#47c6ff', '#3a6bff'], ['#8bd36b', '#3d9b5b'], ['#ff9ad5', '#c2418f']];

  function hash(s) {
    let h = 2166136261;
    for (let i = 0; i < s.length; i++) h = Math.imul(h ^ s.charCodeAt(i), 16777619);
    return h >>> 0;
  }

  /** Avatar ngẫu nhiên nhưng cố định theo tên. */
  function fromName(name) {
    const h = hash(name || '?');
    return { skin: SKINS[h % SKINS.length], hair: HAIRS[(h >>> 3) % HAIRS.length], style: STYLES[(h >>> 6) % STYLES.length], bg: BGS[(h >>> 9) % BGS.length], accessory: (h >>> 12) % 5 === 0 ? 'glasses' : null };
  }

  function eyes(mood) {
    if (mood === 'happy') {
      return '<path d="M36 52 q5 -6 10 0" class="ln"/><path d="M54 52 q5 -6 10 0" class="ln"/>' +
        '<path d="M40 66 q10 9 20 0" class="ln" />' +
        '<ellipse cx="34" cy="61" rx="4" ry="2.4" fill="#ff7b9c" opacity=".45"/><ellipse cx="66" cy="61" rx="4" ry="2.4" fill="#ff7b9c" opacity=".45"/>';
    }
    if (mood === 'sad' || mood === 'cry') {
      let s = '<path d="M35 45 l10 3" class="ln"/><path d="M65 45 l-10 3" class="ln"/>' +
        '<ellipse cx="41" cy="54" rx="3" ry="3.6" fill="#22202a"/><ellipse cx="59" cy="54" rx="3" ry="3.6" fill="#22202a"/>' +
        '<path d="M42 70 q8 -7 16 0" class="ln"/>';
      if (mood === 'cry') s += '<path d="M40 58 q-2 6 0 10 q3 -4 0 -10" fill="#7fd3ff"/><path d="M60 58 q-2 7 0 12 q3 -5 0 -12" fill="#7fd3ff"/>';
      return s;
    }
    if (mood === 'worried') {
      return '<path d="M36 45 l9 -2" class="ln"/><path d="M64 45 l-9 -2" class="ln"/>' +
        '<ellipse cx="41" cy="54" rx="3" ry="3.6" fill="#22202a"/><ellipse cx="59" cy="54" rx="3" ry="3.6" fill="#22202a"/>' +
        '<path d="M43 68 h14" class="ln"/>';
    }
    if (mood === 'smirk') {
      return '<path d="M36 50 l9 2" class="ln"/><path d="M64 50 l-9 2" class="ln"/>' +
        '<ellipse cx="41" cy="55" rx="3" ry="2.6" fill="#22202a"/><ellipse cx="59" cy="55" rx="3" ry="2.6" fill="#22202a"/>' +
        '<path d="M42 67 q10 4 17 -3" class="ln"/>';
    }
    return '<ellipse cx="41" cy="53" rx="3" ry="3.6" fill="#22202a"/><ellipse cx="59" cy="53" rx="3" ry="3.6" fill="#22202a"/>' +
      '<circle cx="42" cy="51.8" r="1" fill="#fff"/><circle cx="60" cy="51.8" r="1" fill="#fff"/>' +
      '<path d="M42 66 q8 5 16 0" class="ln"/>';
  }

  /**
   * Trả về chuỗi SVG của avatar.
   * @param {object} a  {skin, hair, style, bg:[c1,c2], accessory}
   * @param {string} mood happy | neutral | worried | sad | cry | smirk
   */
  function svg(a, mood) {
    const id = 'av' + (++uid);
    const bg = (a && a.bg) || ['#555', '#222'];
    let body = '';
    const style = (a && a.style) || 'short';
    if (style === 'anon') {
      body = '<path d="M20 100 q0 -34 30 -36 q30 2 30 36z" fill="#11131c"/>' +
        '<path d="M26 60 q0 -38 24 -38 q24 0 24 38 q-6 10 -24 12 q-18 -2 -24 -12z" fill="#11131c"/>' +
        '<ellipse cx="50" cy="56" rx="15" ry="17" fill="#05060a"/>' +
        '<text x="50" y="64" text-anchor="middle" font-size="22" font-weight="900" fill="#ff4d6d" font-family="Arial">?</text>';
    } else if (style === 'page') {
      body = '<g transform="translate(50 52)"><path d="M-22 -8 h12 l22 -14 v44 l-22 -14 h-12z" fill="#fff"/><rect x="-18" y="6" width="9" height="16" rx="3" fill="#fff"/>' +
        '<path d="M18 -10 q8 10 0 20" stroke="#fff" stroke-width="4" fill="none" stroke-linecap="round"/><path d="M24 -16 q14 16 0 32" stroke="#fff" stroke-width="4" fill="none" stroke-linecap="round" opacity=".7"/></g>';
    } else {
      const skin = a.skin || '#f0c8a8';
      const hair = a.hair || '#222';
      const shirt = bg[1];
      let back = '';
      let front = '';
      if (style === 'long') {
        back = `<path d="M24 52 q-2 -32 26 -33 q28 1 26 33 v34 q-26 8 -52 0z" fill="${hair}"/>`;
        front = `<path d="M29 46 q4 -22 21 -22 q19 0 22 22 q-12 -10 -24 -10 q-8 4 -19 10z" fill="${hair}"/>`;
      } else if (style === 'bun') {
        back = `<circle cx="50" cy="18" r="10" fill="${hair}"/>`;
        front = `<path d="M28 48 q2 -26 22 -26 q20 0 22 26 q-6 -12 -22 -14 q-16 2 -22 14z" fill="${hair}"/>`;
      } else if (style === 'cap') {
        front = `<path d="M27 44 q2 -22 23 -22 q21 0 23 22z" fill="${bg[1]}"/><path d="M50 40 h32 q-2 6 -10 6 h-22z" fill="${bg[1]}" opacity=".85"/><circle cx="50" cy="23" r="2.5" fill="#fff" opacity=".7"/>`;
      } else {
        front = `<path d="M28 48 q-1 -27 22 -27 q24 0 22 27 q-4 -9 -10 -12 q-8 6 -24 4 q-7 2 -10 8z" fill="${hair}"/>`;
      }
      body = back +
        `<path d="M18 100 q2 -26 32 -28 q30 2 32 28z" fill="${shirt}"/><path d="M42 72 h16 v8 q-8 6 -16 0z" fill="${skin}"/>` +
        `<ellipse cx="50" cy="52" rx="22" ry="25" fill="${skin}"/>` +
        `<ellipse cx="28" cy="55" rx="3.5" ry="5" fill="${skin}"/><ellipse cx="72" cy="55" rx="3.5" ry="5" fill="${skin}"/>` +
        front + eyes(mood || 'neutral');
      if (a.accessory === 'glasses') body += '<g fill="none" stroke="#1d1d24" stroke-width="2.2"><circle cx="41" cy="53" r="7"/><circle cx="59" cy="53" r="7"/><path d="M48 53 h4"/></g>';
      if (a.accessory === 'clip') body += '<path d="M62 30 l10 -4 l2 5 l-10 4z" fill="#ffd166"/><circle cx="67" cy="30" r="2" fill="#ff6b9a"/>';
    }
    return `<svg viewBox="0 0 100 100" xmlns="http://www.w3.org/2000/svg"><defs><linearGradient id="${id}" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="${bg[0]}"/><stop offset="1" stop-color="${bg[1]}"/></linearGradient>` +
      `<clipPath id="${id}c"><circle cx="50" cy="50" r="50"/></clipPath><style>.ln{fill:none;stroke:#22202a;stroke-width:2.4;stroke-linecap:round}</style></defs>` +
      `<g clip-path="url(#${id}c)"><rect width="100" height="100" fill="url(#${id})"/>${body}</g></svg>`;
  }

  window.Avatar = { svg, fromName };
})();

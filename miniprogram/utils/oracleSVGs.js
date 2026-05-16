/**
 * Oracle Bone Script SVG glyphs.
 *
 * Each value is a self-contained SVG string rendered as a background-image
 * on the 甲骨文 stage card. Using the minimal-encoding data URI approach
 * (quote substitution + %-encoding of reserved chars) which works in
 * WeChat miniprogram's inline style attribute without Base64 overhead.
 *
 * To add a new glyph, draw it in a 100×100 viewBox using the #D4AF37
 * (gold) stroke colour against a transparent background.
 */

const _svgs = {
  '人': '<svg viewBox="0 0 100 100" xmlns="http://www.w3.org/2000/svg"><g fill="none" stroke="#d4af37" stroke-width="4" stroke-linecap="round" stroke-linejoin="round"><path d="M52 14 L45 34 L37 54 L27 80"/><path d="M45 35 L60 55 L76 82"/><path d="M48 22 L59 16"/></g></svg>',
  '水': '<svg viewBox="0 0 100 100" xmlns="http://www.w3.org/2000/svg"><g fill="none" stroke="#d4af37" stroke-width="3.6" stroke-linecap="round" stroke-linejoin="round"><path d="M51 10 L47 26 L54 42 L48 60 L53 88"/><path d="M38 25 L24 39 L33 51 L19 68"/><path d="M64 24 L77 38 L68 51 L82 69"/><path d="M43 45 L32 60"/><path d="M58 46 L69 61"/></g></svg>',
  '山': '<svg viewBox="0 0 100 100" xmlns="http://www.w3.org/2000/svg"><g fill="none" stroke="#d4af37" stroke-width="4" stroke-linecap="round" stroke-linejoin="round"><path d="M16 78 L16 50 L31 37 L31 78"/><path d="M31 78 L31 28 L50 14 L50 78"/><path d="M50 78 L50 42 L70 29 L70 78"/><path d="M12 78 L86 78"/></g></svg>',
  '日': '<svg viewBox="0 0 100 100" xmlns="http://www.w3.org/2000/svg"><g fill="none" stroke="#d4af37" stroke-width="3.8" stroke-linecap="round" stroke-linejoin="round"><path d="M29 18 L69 16 L78 31 L75 70 L61 84 L25 78 L17 59 L21 29 Z"/><path d="M34 48 L64 47"/><path d="M47 35 L54 60"/></g></svg>',
  '月': '<svg viewBox="0 0 100 100" xmlns="http://www.w3.org/2000/svg"><g fill="none" stroke="#d4af37" stroke-width="3.8" stroke-linecap="round" stroke-linejoin="round"><path d="M61 11 L40 20 L28 39 L27 61 L39 80 L61 90"/><path d="M61 11 L52 31 L50 51 L54 72 L61 90"/><path d="M39 42 L56 38"/><path d="M38 62 L56 66"/></g></svg>',
  '火': '<svg viewBox="0 0 100 100" xmlns="http://www.w3.org/2000/svg"><g fill="none" stroke="#d4af37" stroke-width="3.8" stroke-linecap="round" stroke-linejoin="round"><path d="M50 14 L43 33 L48 52 L38 82"/><path d="M50 15 L60 35 L55 54 L67 83"/><path d="M34 31 L22 49 L31 64"/><path d="M67 29 L80 48 L70 65"/><path d="M43 54 L29 86"/><path d="M56 54 L72 87"/></g></svg>',
  '木': '<svg viewBox="0 0 100 100" xmlns="http://www.w3.org/2000/svg"><g fill="none" stroke="#d4af37" stroke-width="4" stroke-linecap="round" stroke-linejoin="round"><path d="M50 11 L50 89"/><path d="M50 30 L29 48"/><path d="M50 31 L72 47"/><path d="M50 57 L31 82"/><path d="M50 57 L70 83"/><path d="M38 66 L62 66"/></g></svg>',
  '文': '<svg viewBox="0 0 100 100" xmlns="http://www.w3.org/2000/svg"><g fill="none" stroke="#d4af37" stroke-width="3.8" stroke-linecap="round" stroke-linejoin="round"><path d="M50 12 L50 28"/><path d="M31 31 L69 31"/><path d="M38 28 L51 52 L64 28"/><path d="M28 81 L51 52 L75 82"/><path d="M35 45 L66 61"/></g></svg>',
  '字': '<svg viewBox="0 0 100 100" xmlns="http://www.w3.org/2000/svg"><g fill="none" stroke="#d4af37" stroke-width="3.8" stroke-linecap="round" stroke-linejoin="round"><path d="M23 36 L35 20 L64 20 L78 36"/><path d="M29 36 L29 51"/><path d="M72 36 L72 51"/><path d="M40 55 L58 55"/><path d="M49 43 L49 78"/><path d="M36 78 L62 78"/><path d="M40 66 L49 56 L60 66"/></g></svg>',
  '说': '<svg viewBox="0 0 100 100" xmlns="http://www.w3.org/2000/svg"><g fill="none" stroke="#d4af37" stroke-width="3.5" stroke-linecap="round" stroke-linejoin="round"><path d="M17 18 L31 25 L19 33"/><path d="M17 46 L33 46"/><path d="M18 63 L31 58 L27 79"/><path d="M48 18 L70 18 L78 32 L70 44 L49 44 L42 31 Z"/><path d="M58 44 L53 66 L43 84"/><path d="M66 44 L72 65 L84 83"/><path d="M52 30 L68 30"/></g></svg>',
  '大': '<svg viewBox="0 0 100 100" xmlns="http://www.w3.org/2000/svg"><g fill="none" stroke="#d4af37" stroke-width="4" stroke-linecap="round" stroke-linejoin="round"><path d="M50 15 L50 88"/><path d="M26 45 L50 38 L76 45"/><path d="M50 70 L28 90"/><path d="M50 70 L73 91"/></g></svg>',
  '女': '<svg viewBox="0 0 100 100" xmlns="http://www.w3.org/2000/svg"><g fill="none" stroke="#d4af37" stroke-width="3.8" stroke-linecap="round" stroke-linejoin="round"><path d="M50 24 L35 48 L63 58 L26 72"/><path d="M50 24 L66 44 L38 58 L74 72"/><path d="M37 36 L64 36"/><path d="M50 24 L50 14 C50 14 57 10 57 16"/></g></svg>',
  '子': '<svg viewBox="0 0 100 100" xmlns="http://www.w3.org/2000/svg"><g fill="none" stroke="#d4af37" stroke-width="3.8" stroke-linecap="round" stroke-linejoin="round"><path d="M50 14 C40 14 32 20 32 30 C32 42 42 48 50 48 C58 48 68 42 68 30 C68 20 60 14 50 14 Z"/><path d="M50 14 L50 10"/><path d="M50 48 L50 80"/><path d="M30 72 L72 66"/></g></svg>',
  '口': '<svg viewBox="0 0 100 100" xmlns="http://www.w3.org/2000/svg"><g fill="none" stroke="#d4af37" stroke-width="4" stroke-linecap="round" stroke-linejoin="round"><ellipse cx="50" cy="50" rx="26" ry="30"/><path d="M35 50 L65 50"/></g></svg>',
  '手': '<svg viewBox="0 0 100 100" xmlns="http://www.w3.org/2000/svg"><g fill="none" stroke="#d4af37" stroke-width="3.8" stroke-linecap="round" stroke-linejoin="round"><path d="M28 30 L38 30 L38 62"/><path d="M38 30 L48 25 L48 60"/><path d="M48 27 L58 23 L58 58"/><path d="M58 25 L68 30 L68 56"/><path d="M28 62 L72 62"/><path d="M38 62 L30 82"/><path d="M52 62 L52 84"/><path d="M66 62 L74 82"/></g></svg>',
  '心': '<svg viewBox="0 0 100 100" xmlns="http://www.w3.org/2000/svg"><g fill="none" stroke="#d4af37" stroke-width="3.8" stroke-linecap="round" stroke-linejoin="round"><path d="M50 75 C35 58 18 50 22 34 C26 20 40 18 50 30 C60 18 74 20 78 34 C82 50 65 58 50 75 Z"/><circle cx="38" cy="46" r="3" fill="#d4af37" stroke="none"/><circle cx="50" cy="44" r="3" fill="#d4af37" stroke="none"/><circle cx="62" cy="46" r="3" fill="#d4af37" stroke="none"/></g></svg>',
  '目': '<svg viewBox="0 0 100 100" xmlns="http://www.w3.org/2000/svg"><g fill="none" stroke="#d4af37" stroke-width="3.8" stroke-linecap="round" stroke-linejoin="round"><ellipse cx="50" cy="50" rx="28" ry="20"/><ellipse cx="50" cy="50" rx="10" ry="10" fill="#d4af37" fill-opacity="0.3"/><path d="M50 30 L50 70"/></g></svg>',
  '王': '<svg viewBox="0 0 100 100" xmlns="http://www.w3.org/2000/svg"><g fill="none" stroke="#d4af37" stroke-width="4" stroke-linecap="round" stroke-linejoin="round"><path d="M25 22 L75 22"/><path d="M22 50 L78 50"/><path d="M18 78 L82 78"/><path d="M50 22 L50 78"/></g></svg>',
  '土': '<svg viewBox="0 0 100 100" xmlns="http://www.w3.org/2000/svg"><g fill="none" stroke="#d4af37" stroke-width="4" stroke-linecap="round" stroke-linejoin="round"><path d="M28 36 L72 36"/><path d="M50 36 L50 80"/><path d="M18 80 L82 80"/></g></svg>',
  '天': '<svg viewBox="0 0 100 100" xmlns="http://www.w3.org/2000/svg"><g fill="none" stroke="#d4af37" stroke-width="4" stroke-linecap="round" stroke-linejoin="round"><path d="M22 22 L78 22"/><path d="M50 22 L50 88"/><path d="M26 46 L50 40 L74 46"/><path d="M50 70 L28 90"/><path d="M50 70 L73 91"/></g></svg>',
  '力': '<svg viewBox="0 0 100 100" xmlns="http://www.w3.org/2000/svg"><g fill="none" stroke="#d4af37" stroke-width="4" stroke-linecap="round" stroke-linejoin="round"><path d="M28 20 L46 52 L34 82"/><path d="M46 52 L72 52 L62 80"/><path d="M62 30 L72 16"/></g></svg>'
};

// Convert SVG string to a CSS-safe data URI (no Base64 needed)
function _toDataUri(svg) {
  return 'data:image/svg+xml,' + svg
    .replace(/\n/g, ' ')
    .replace(/\s{2,}/g, ' ')
    .replace(/"/g, "'")
    .replace(/#/g, '%23')
    .replace(/</g, '%3C')
    .replace(/>/g, '%3E');
}

function getOracleSrc(char) {
  const svg = _svgs[char];
  return svg ? _toDataUri(svg) : null;
}

function hasOracleSvg(char) {
  return Boolean(_svgs[char]);
}

module.exports = { getOracleSrc, hasOracleSvg };

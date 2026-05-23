/**
 * Historical font loader.
 *
 * Calls wx.loadFontFace once per process to register fonts for each of the
 * five evolutionary eras. Fonts are loaded lazily and failures are silent:
 * if the font cannot load, the modern character still renders with the
 * system fallback, so the page never breaks.
 *
 * Production setup
 * ────────────────
 * 1. Host font files (.woff2 / .ttf) on an HTTPS endpoint.
 * 2. Whitelist the domain in 小程序管理后台 →「开发管理 → 服务器域名」
 *    (downloadFile 域名).
 * 3. Replace the URLs below.
 *
 * Recommended open-source fonts
 * ─────────────────────────────
 *   oracle    Noto Sans Oracle Bone (SIL OFL)
 *   bronze    汉鼎金文 / I.Ming (各家收录差异，建议自检)
 *   seal      I.Ming Seal (SIL OFL) / 方正小篆体
 *   clerical  Noto Sans HK Clerical / 方正隶书
 *   regular   系统字体即可
 *
 * Until you wire up real URLs, the loader is a no-op — that's fine for
 * development, the per-era CSS classes will still apply letter-spacing
 * and weight tweaks so each stage visually differs.
 */

const FONT_SOURCES = {
  // shuowen-oracle:   'https://your.cdn/NotoSansOracleBone-Regular.woff2',
  // shuowen-bronze:   'https://your.cdn/JinwenBody.woff2',
  // shuowen-seal:     'https://your.cdn/IMingSeal.woff2',
  'shuowen-clerical': 'assets/fonts/moe-li.ttf'
};

let loaded = false;

function resolveFontSource(source, apiBaseUrl) {
  if (/^https?:\/\//i.test(source)) return source;
  const base = String(apiBaseUrl || '').replace(/\/$/, '');
  if (!base) return '';
  return `${base}/assets/${source.replace(/^assets\//, '')}`;
}

function loadHistoricalFonts(apiBaseUrl) {
  if (loaded) return;
  loaded = true;

  Object.keys(FONT_SOURCES).forEach((family) => {
    const url = resolveFontSource(FONT_SOURCES[family], apiBaseUrl);
    if (!url) return;
    wx.loadFontFace({
      global: true,
      family,
      source: `url("${url}")`,
      complete() { /* silent */ }
    });
  });
}

module.exports = { loadHistoricalFonts };

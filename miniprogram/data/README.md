# 字形演变素材层

## 当前交付

[`glyphs.js`](./glyphs.js) 内置 232 个常用汉字的基础演变数据，并在后端可用时由 `/api/characters/:char` 合并更完整的释义、来源和字形资产信息。

每条记录包含：
- 现代字、拼音、部首、笔画数、释义
- 5 个演变阶段的 `era` 标签、文字字形（默认现代字）、历史描述（依据《说文解字》）

## 字形显示的工作原理

5 个阶段使用 5 套 `era-*` CSS 类（[evolution.wxss](../pages/evolution/evolution.wxss)）。每个 `era` 对应一个 `font-family`：

| era | font-family | 推荐字体 | 许可证 |
|------|-------------|---------|--------|
| oracle | `shuowen-oracle` | Noto Sans Oracle Bone | SIL OFL |
| bronze | `shuowen-bronze` | I.Ming / 汉鼎金文 | 视具体字体 |
| seal | `shuowen-seal` | I.Ming Seal | SIL OFL |
| clerical | `shuowen-clerical` | 方正隶书 / Noto HK Clerical | 视具体字体 |
| regular | （系统） | PingFang / Microsoft YaHei | 系统 |

**当历史字体未加载时**，所有阶段都会用系统楷体/宋体回退渲染，页面不会破坏；只是 5 个阶段的视觉差异减弱。

## 启用真实历史字体（生产环境）

1. **下载字体文件**（推荐 woff2，体积小、移动端友好）
2. **上传到 HTTPS 静态资源服务**（自建 CDN 或微信云存储）
3. **加白名单**：小程序管理后台 →「开发管理 → 服务器域名 → downloadFile 合法域名」
4. **填入 URL**：编辑 [`utils/historicalFonts.js`](../utils/historicalFonts.js)，取消注释 `FONT_SOURCES` 并填入真实 URL

完成后重启小程序，5 个阶段就会自动以历代字体渲染同一个汉字。

## 升级到 Unicode 古文字码点

Unicode 13.0 (2020) 新增了**甲骨文区段** `U+1B100`–`U+1B12F`（实为 Khitan）以及 `U+15C00`–`U+15FFF`（甲骨文，1071 字）。要让"人"的甲骨文阶段渲染**真实甲骨字形**而非同一字符，需要：

1. 在 [`glyphs.js`](./glyphs.js) 中给 oracle 阶段填入对应的 Unicode 码点，例如：
   ```js
   { era: 'oracle', label: '甲骨文', glyph: '𘠀', desc: '...' }
   ```
2. Noto Sans Oracle Bone 字体加载后会渲染出真实甲骨字形

完整码点对照表可参考：
- [Unicode Oracle Bone chart](https://www.unicode.org/charts/PDF/U15C00.pdf)
- [Academia Sinica CDP](https://cdp.sinica.edu.tw/)

## 扩充到 100–500 字的路径

按工作量从小到大：

1. **手工补录**：在 `glyphs.js` 末尾按相同结构追加条目
2. **从《说文解字》数字化版本批量导入**：可解析 [说文解字电子版](https://github.com/skishore/makemeahanzi) 等数据集，转写为本地数据
3. **后端接管**：当 `/api/characters/:char` 返回数据时会自动覆盖本地条目，正式发布时由后端持有完整字库

## 历史字形数据源（合规推荐）

| 数据源 | 字量 | 形式 | 授权 |
|--------|------|------|------|
| 漢典 zdic.net | 5000+ | 字形图 | 仅供学习参考 |
| 國學大師 guoxuedashi.com | 6000+ | 字形图 | 同上 |
| 小学堂字形演变 (中研院) | 6800+ | 高清扫描 | 学术使用 |
| **GlyphWiki** | 60000+ CJK | SVG outline | CC-BY-SA-3.0 ✓ 商用可 |
| **makemeahanzi** | 9000+ | SVG 笔画数据 | LGPL ✓ |
| **CDP 字料库** | 数万 | 矢量字形 | 学术许可 |

商用场景推荐 **GlyphWiki** + **makemeahanzi** 组合，其他来源建议联系授权方。

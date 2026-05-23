# Shuowen

Shuowen 现在重构为微信小程序实现，后端使用 Node.js + Express 提供 REST API。项目采用四类数据基础设施：MongoDB 存储汉字、著作与字形资料，MySQL 存储用户、进度和活动数据，Redis 存储排行榜缓存，OSS 存储甲骨文字形、拓片、字体、音频等资产；未配置数据库时会自动回退到内存数据，方便本地开发。

## 项目结构

```text
Shuowen/
├── miniprogram/        # 微信小程序原生实现
├── backend/            # Express API 与真实数据层
├── project.config.json # 微信开发者工具项目配置
├── package.json        # 根目录脚本
└── scripts/
```

后端目录已按真实接入拆分：

```text
backend/
├── config/       # 环境变量与运行配置
├── db/           # MongoDB / MySQL / Redis / OSS 连接
├── data/         # 未配置数据库时使用的种子数据
├── repositories/ # 数据读写封装
├── services/     # 业务逻辑：进度、排行榜、资产签名
├── routes/       # REST API 路由
├── schema.mysql.sql
├── schema.mongo.js
└── server.js     # 只负责装配中间件和路由
```

## 后端接口

- `GET /api/characters`
- `GET /api/characters/:char`
- `GET /api/radicals`
- `GET /api/works`
- `GET /api/ai/story/:char`
- `GET /api/ai/daily`
- `GET /api/ai/learning-path`
- `POST /api/ai/quiz/explain`
- `POST /api/ai/ask`
- `GET /api/progress`
- `POST /api/progress/unlock`
- `GET /api/leaderboard`
- `POST /api/auth/wechat`
- `GET /api/me`
- `GET /api/oss/signature`
- `POST /api/oss/signatures`

## 数据库、缓存与 OSS

复制环境变量示例：

```bash
cp backend/.env.example backend/.env
```

### 用 Docker 启动本地数据库

本项目不要求你在电脑里分别安装 MongoDB、MySQL、Redis。推荐本地开发只安装 Docker Desktop，然后用项目根目录的 `docker-compose.yml` 一次性启动三类服务。

启动数据库：

```bash
npm run db:up
```

这会启动：

- MongoDB：`localhost:27017`
- MySQL：`localhost:3306`，数据库 `shuowen`，root 密码 `shuowen_dev`
- Redis：`localhost:6379`

第一次启动后，初始化表结构和种子数据：

```bash
npm run db:init
```

验证 MySQL / Redis 读写：

```bash
npm run db:smoke
```

查看数据库容器日志：

```bash
npm run db:logs
```

停止数据库容器：

```bash
npm run db:down
```

数据会保存在 Docker volume 里，`db:down` 不会删除数据。需要彻底清空时再手动执行 `docker compose down -v`。

MySQL 建表：

```bash
npm --prefix backend run mysql:init
```

MySQL / Redis 冒烟测试：

```bash
npm --prefix backend run mysql:smoke
```

这个测试会依次验证：

- 写入/读取 `users`
- 初始化并更新 `user_progress`
- 写入/读取 `activities`
- 同步并读取 Redis 解字排行榜

MongoDB 索引：

```bash
mongosh shuowen backend/schema.mongo.js
```

导入内置知识库种子数据到 MongoDB：

```bash
npm --prefix backend run mongo:import
```

导入脚本会 upsert 三类集合：

- `characters`：汉字释义、拼音、部首、笔画、五阶段演变说明
- `works`：《说文解字》《说文解字注》等著作资料
- `radicals`：部首、拼音、笔画、含义、示例字

导入后，以下接口会优先读取 MongoDB；没有配置或没有数据时才回退到 `backend/data/seedData.js`：

- `GET /api/characters`
- `GET /api/characters/:char`
- `GET /api/works`
- `GET /api/radicals`

配置项：

- `MONGO_URI` / `MONGO_DB_NAME`：汉字、著作、字形资料
- `MYSQL_URI`：用户、活动、解锁进度
- `REDIS_URL`：解字排行榜缓存
- `OSS_REGION` / `OSS_BUCKET` / `OSS_ACCESS_KEY_ID` / `OSS_ACCESS_KEY_SECRET`：字形图、拓片、音频资产签名 URL
- `DEEPSEEK_API_KEY` / `DEEPSEEK_MODEL` / `DEEPSEEK_BASE_URL`：AI 故事官、AI 每日一字、猜字讲解；未配置 key 时会返回本地兜底文案，便于比赛现场稳定演示

如果这些变量为空，后端仍可启动，自动使用内存 fallback。

### AI 功能

比赛版保留五类轻量 AI 能力，形成“推荐 - 学习 - 测验 - 诊断 - 问答”的闭环：

- 汉字故事官：在字形详情页点击“AI讲故事”，结合该字的释义和五段字形数据生成约 150 字起源故事。
- AI 个性化学习路径：根据用户已解锁字、最近学习记录和核心字库覆盖情况，推荐下一组适合学习的汉字。
- AI 猜字讲解与错因分析：学习页的字形测验答题后，AI 根据正确答案、用户选择和字形资料分析可能混淆点。
- AI 每日一字：学习页顶部根据日期、季节和用户学习历史推荐一个今日汉字。
- 小字灵问答：围绕当前字和用户提到的其他汉字，回答字源、字形演变、部首、读音和含义问题。
- AI 学习看板：前端记录 AI 讲解、问答、测验讲解次数和猜字正确率，便于演示学习成效数据。

### 无障碍与体验细节

- 支持小 / 中 / 大三档字号，设置后在字形、部首、学习和我的页面统一生效。
- 支持深色模式，自动同步页面、导航栏和底部 TabBar 的浅深色展示。
- 猜字测验答错后自动进入本地错题本，可在学习页和我的页面回顾、跳转复习或清空记录。

AI 接口优先使用 DeepSeek Chat Completions API；没有配置 `DEEPSEEK_API_KEY` 时自动使用本地模板兜底，不影响主流程演示。

启用真实 AI：

```bash
# backend/.env
DEEPSEEK_API_KEY=你的 DeepSeek Key
DEEPSEEK_MODEL=deepseek-v4-flash
DEEPSEEK_BASE_URL=https://api.deepseek.com
```

汉字故事官的语音播报建议使用微信“同声传译”插件。发布或真机测试前，需要先在微信公众平台的小程序后台添加该插件，再在 `miniprogram/app.json` 中加入 provider `wx069ba97219f66d99`；未添加插件时先不要声明，否则开发者工具可能编译失败。

### OSS 资产

OSS 用来放不适合直接塞进数据库的大文件，例如甲骨文 SVG、高清拓片、字体和音频资产。数据库中建议只保存 `assetKey`，接口按需返回短期签名 URL。

单个资产签名：

```bash
curl "http://localhost:3001/api/oss/signature?key=oracle/%E8%AF%B4.svg"
```

批量资产签名：

```bash
curl -X POST "http://localhost:3001/api/oss/signatures" \
  -H "Content-Type: application/json" \
  -d '{"keys":["oracle/说.svg","oracle/人.svg"],"expires":3600}'
```

导出并上传小程序内置甲骨文 SVG：

```bash
npm run oss:upload
```

脚本会先把 `miniprogram/utils/oracleSVGs.js` 中的 SVG 生成到 `backend/assets/public/oracle/`，并生成 `backend/assets/public/manifest.json`。如果未配置 OSS，只生成本地文件；如果已配置 `OSS_*` 环境变量，会同时上传到 OSS，key 形如 `oracle/说.svg`。

本地开发时，即使没有 OSS，签名接口也会返回 `http://localhost:3001/assets/...` 形式的本地资产 URL。真机或线上使用 OSS/CDN 时，需要在微信小程序后台把图片、字体、音频所在域名加入 `downloadFile` 合法域名。

### Wikimedia Commons 古文字 SVG

可以从 Wikimedia Commons 的 Ancient Chinese characters project 导入授权清楚的 SVG 字形：

```bash
npm run commons:import
```

导入脚本会：

- 按核心字和阶段查找 Commons 文件，如 `木-oracle.svg`、`木-bronze.svg`、`木-seal.svg`
- 只下载 Commons 元数据中标明为 CC0、Public Domain、CC-BY 或 CC-BY-SA 的 SVG
- 保存到 `backend/assets/public/glyphs/{字}/{era}.svg`
- 生成 `backend/assets/public/commons-glyph-manifest.json`
- 将 `assetStatus`、`license`、`sourceUrl`、`attribution` 写回 MongoDB

没有找到明确授权文件的阶段会继续保留本地 draft 资产，不会误标为正式字形。

当前项目已建立“百字核心字库”作为第一阶段资料范围。每个核心字都会生成五阶段本地资产位：

```text
backend/assets/public/glyphs/{字}/oracle.svg
backend/assets/public/glyphs/{字}/bronze.svg
backend/assets/public/glyphs/{字}/seal.svg
backend/assets/public/glyphs/{字}/clerical.svg
backend/assets/public/glyphs/{字}/regular.svg
```

其中 Commons 已校验授权的阶段会在 MongoDB 中标记为 `assetStatus: "verified"`，暂未找到可靠来源的阶段保留 `draft`。重新生成本地资产并导入 MongoDB：

```bash
npm run oss:upload
npm --prefix backend run mongo:import
```

## 一键启动本地 API

```bash
npm run install:all
npm run dev
```

后端运行在 `http://localhost:3001`。

## 运行小程序

1. 打开微信开发者工具。
2. 导入本项目根目录。
3. AppID 可选择测试号，或使用微信开发者工具的测试能力。
4. 本地开发时开启“不校验合法域名、web-view（业务域名）、TLS 版本以及 HTTPS 证书”。
5. 确保后端已通过 `npm run dev` 启动。

小程序接口地址在 `miniprogram/app.js` 中配置：

```js
apiBaseUrl: 'http://localhost:3001'
```

如果需要真机预览，请改成电脑局域网 IP，例如 `http://192.168.1.20:3001`，并保证手机和电脑在同一网络。

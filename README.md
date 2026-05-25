# Shuowen

Shuowen 现在重构为微信小程序实现，后端使用 Node.js + Express 提供 REST API。项目采用两类数据基础设施：MongoDB 存储汉字、著作与字形资料，MySQL 存储用户、进度和活动数据；AI 结果使用进程内 TTL 缓存，未配置数据库时会自动回退到内存数据，方便本地开发。

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
├── db/           # MongoDB / MySQL 连接
├── data/         # 未配置数据库时使用的种子数据
├── repositories/ # 数据读写封装
├── services/     # 业务逻辑：进度、AI、本地资产 URL
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
- `POST /api/ai/tts`
- `POST /api/ai/asr`
- `GET /api/progress`
- `POST /api/progress/unlock`
- `POST /api/auth/wechat`
- `GET /api/me`

## 数据库、缓存与资产

复制环境变量示例：

```bash
cp backend/.env.example backend/.env
```

### 用 Docker 启动本地数据库

本项目不要求你在电脑里分别安装 MongoDB、MySQL。推荐本地开发只安装 Docker Desktop，然后用项目根目录的 `docker-compose.yml` 一次性启动两类服务。

启动数据库：

```bash
npm run db:up
```

这会启动：

- MongoDB：`localhost:27017`
- MySQL：`localhost:3306`，数据库 `shuowen`，root 密码 `shuowen_dev`

第一次启动后，初始化表结构和种子数据：

```bash
npm run db:init
```

验证 MySQL 读写：

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

MySQL 冒烟测试：

```bash
npm --prefix backend run mysql:smoke
```

这个测试会依次验证：

- 写入/读取 `users`
- 初始化并更新 `user_progress`
- 写入/读取 `activities`

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
- `PUBLIC_BASE_URL`：后端公开 HTTPS 地址；填写后字形 SVG 和字体资源 URL 会统一使用该域名
- `DEEPSEEK_API_KEY` / `DEEPSEEK_MODEL` / `DEEPSEEK_BASE_URL`：AI 故事官、AI 每日一字、猜字讲解；未配置 key 时会返回本地兜底文案，便于比赛现场稳定演示
- `XFYUN_TTS_APP_ID` / `XFYUN_TTS_API_KEY` / `XFYUN_TTS_API_SECRET` / `XFYUN_TTS_VOICE`：讯飞在线语音合成，用于“小字灵”把回答朗读出来；未配置时文字问答仍可正常使用
- `XFYUN_ASR_APP_ID` / `XFYUN_ASR_API_KEY` / `XFYUN_ASR_API_SECRET`：讯飞语音听写，用于“按住说话问小字灵”；留空时会复用 TTS 的讯飞 WebAPI 鉴权信息

如果这些变量为空，后端仍可启动，自动使用内存 fallback。

### AI 功能

比赛版保留五类轻量 AI 能力，形成“推荐 - 学习 - 测验 - 诊断 - 问答”的闭环：

- 汉字故事官：在字形详情页点击“AI讲故事”，结合该字的释义和五段字形数据生成约 150 字起源故事。
- AI 个性化学习路径：根据用户已解锁字、最近学习记录和核心字库覆盖情况，推荐下一组适合学习的汉字。
- AI 猜字讲解与错因分析：学习页的字形测验答题后，AI 根据正确答案、用户选择和字形资料分析可能混淆点。
- 讯飞语音听写提问：字形页问答面板支持按住说话，小程序录制 16k 单声道 PCM 后上传后端，由讯飞 ASR 转成文字并自动提问。
- 讯飞语音合成朗读：小字灵回答后可点击“朗读”，由后端代理调用讯飞 TTS，前端播放本地临时音频文件，避免密钥进入小程序包。
- AI 每日一字：学习页顶部根据日期、季节和用户学习历史推荐一个今日汉字。
- 小字灵问答：围绕当前字和用户提到的其他汉字，回答字源、字形演变、部首、读音和含义问题。
- 小字灵朗读回答：字形页问答面板支持把 AI 回答合成为语音播放，降低低龄儿童阅读长解释的理解门槛。
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

小字灵朗读和语音提问都走后端代理的讯飞 WebAPI，不需要在微信公众平台添加插件。TTS 负责把回答读出来，ASR 负责把孩子的录音识别成文字，密钥只保存在后端 `.env`。

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
npm run glyph:generate
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

小程序接口地址在 `miniprogram/config.js` 中配置：

```js
apiBaseCandidates: [
  'http://localhost:3001'
]
```

本地真机调试可临时改成电脑局域网 IP，例如 `http://192.168.1.20:3001`，并保证手机和电脑在同一网络。
正式预览、体验版或发布版必须改为已经在微信公众平台配置过的 HTTPS 合法域名；后端 `.env` 中的 `PUBLIC_BASE_URL` 建议填写同一个 HTTPS API 域名。

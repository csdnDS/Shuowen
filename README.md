# Shuowen

Shuowen 现在重构为微信小程序实现，后端使用 Node.js + Express 提供 REST API。项目已预留真实数据层：MongoDB 存储汉字、著作与字形资料，MySQL 存储用户、进度和活动数据，OSS 存储甲骨文字形、拓片、音频等资产；未配置数据库时会自动回退到内存数据，方便本地开发。

## 项目结构

```text
Shuowen/
├── miniprogram/        # 微信小程序原生实现
├── backend/            # Express 本地 API
├── project.config.json # 微信开发者工具项目配置
├── package.json        # 根目录脚本
└── scripts/
```

## 后端接口

- `GET /api/characters`
- `GET /api/characters/:char`
- `GET /api/radicals`
- `GET /api/works`
- `GET /api/heatmap`
- `GET /api/progress`
- `POST /api/progress/unlock`
- `POST /api/auth/wechat`
- `GET /api/me`
- `GET /api/oss/signature`

## 数据库与 OSS

复制环境变量示例：

```bash
cp backend/.env.example backend/.env
```

MySQL 建表：

```bash
mysql -u root -p shuowen < backend/schema.mysql.sql
```

MongoDB 索引：

```bash
mongosh shuowen backend/schema.mongo.js
```

配置项：

- `MONGO_URI` / `MONGO_DB_NAME`：汉字、著作、字形资料
- `MYSQL_URI`：用户、活动、解锁进度
- `OSS_REGION` / `OSS_BUCKET` / `OSS_ACCESS_KEY_ID` / `OSS_ACCESS_KEY_SECRET`：字形图、拓片、音频资产签名 URL

如果这些变量为空，后端仍可启动，自动使用内存 fallback。

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

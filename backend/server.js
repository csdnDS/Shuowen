import 'dotenv/config';
import express from 'express';
import cors from 'cors';

const app = express();
const port = 3001;

app.use(cors());
app.use(express.json());

const presetCharacters = [
  '说', '文', '字', '人', '水', '山', '日', '月', '火', '木',
  '口', '手', '心', '目', '足', '天', '地', '王', '玉', '金',
  '土', '田', '禾', '竹', '草', '虫', '鸟', '鱼', '马', '牛',
  '羊', '犬', '女', '子', '父', '母', '兄', '臣', '民', '士',
  '大', '小', '中', '上', '下', '左', '右', '东', '西', '南',
  '北', '生', '死', '老', '少', '长', '高', '白', '黑', '赤',
  '青', '黄', '明', '光', '雨', '云', '风', '雷', '电', '川',
  '泉', '江', '河', '海', '林', '森', '本', '末', '朱', '休',
  '信', '仁', '义', '礼', '智', '勇', '学', '书', '史', '典',
  '诗', '语', '话', '读', '安', '家', '室', '宫', '门', '户'
];

const TOTAL_SHUOWEN_COUNT = 9353;

const runtimeConfig = {
  mongoUri: process.env.MONGO_URI || '',
  mongoDbName: process.env.MONGO_DB_NAME || 'shuowen',
  mysqlUri: process.env.MYSQL_URI || '',
  ossRegion: process.env.OSS_REGION || '',
  ossBucket: process.env.OSS_BUCKET || '',
  ossAccessKeyId: process.env.OSS_ACCESS_KEY_ID || '',
  ossAccessKeySecret: process.env.OSS_ACCESS_KEY_SECRET || '',
  wxAppId: process.env.WX_APPID || '',
  wxSecret: process.env.WX_SECRET || ''
};

const characterCatalog = presetCharacters.map((char, index) => ({
  char,
  title: `${char}字条`,
  source: index < 10 ? '精校字源' : '扩展索引',
  hasDetail: index < 10,
  assetKey: `oracle/${encodeURIComponent(char)}.svg`
}));

const works = [
  {
    id: 'shuowen',
    title: '说文解字',
    author: '许慎',
    dynasty: '东汉',
    summary: '中国第一部系统分析汉字字形和考究字源的字书，按部首编排，共收小篆字头九千余。'
  },
  {
    id: 'shuowen-zhu',
    title: '说文解字注',
    author: '段玉裁',
    dynasty: '清',
    summary: '清代小学名著，对《说文解字》逐条训释、校勘并阐明音义关系。'
  }
];

const memoryUsers = new Map();
const memoryActivities = new Map();
const userProgress = new Map();

let mongoClientPromise = null;
let mysqlPoolPromise = null;
let ossClientPromise = null;

async function getMongoDb() {
  if (!runtimeConfig.mongoUri) return null;

  try {
    if (!mongoClientPromise) {
      mongoClientPromise = import('mongodb').then(({ MongoClient }) =>
        new MongoClient(runtimeConfig.mongoUri).connect()
      );
    }
    const client = await mongoClientPromise;
    return client.db(runtimeConfig.mongoDbName);
  } catch (error) {
    console.warn(`MongoDB unavailable, using memory fallback: ${error.message}`);
    mongoClientPromise = null;
    return null;
  }
}

async function getMysqlPool() {
  if (!runtimeConfig.mysqlUri) return null;

  try {
    if (!mysqlPoolPromise) {
      mysqlPoolPromise = import('mysql2/promise').then((mysql) =>
        mysql.createPool(runtimeConfig.mysqlUri)
      );
    }
    return await mysqlPoolPromise;
  } catch (error) {
    console.warn(`MySQL unavailable, using memory fallback: ${error.message}`);
    mysqlPoolPromise = null;
    return null;
  }
}

async function getOssClient() {
  if (
    !runtimeConfig.ossRegion ||
    !runtimeConfig.ossBucket ||
    !runtimeConfig.ossAccessKeyId ||
    !runtimeConfig.ossAccessKeySecret
  ) {
    return null;
  }

  try {
    if (!ossClientPromise) {
      ossClientPromise = import('ali-oss').then(({ default: OSS }) =>
        new OSS({
          region: runtimeConfig.ossRegion,
          bucket: runtimeConfig.ossBucket,
          accessKeyId: runtimeConfig.ossAccessKeyId,
          accessKeySecret: runtimeConfig.ossAccessKeySecret
        })
      );
    }
    return await ossClientPromise;
  } catch (error) {
    console.warn(`OSS unavailable, using local asset fallback: ${error.message}`);
    ossClientPromise = null;
    return null;
  }
}

function getOpenId(req) {
  return req.headers['x-openid'] || req.query.openid || 'dev-openid';
}

function createBaseCharacter(char) {
  return {
    char,
    meaning:
      `“${char}”已收录在扩展字库索引中，当前为基础条目。后续可从 MongoDB 的 characters 集合补充《说文》释义、古文字字形与考释来源。`,
    stages: ['甲骨文', '金文', '篆书', '隶书', '楷书'].map((name) => ({
      name,
      glyph: char,
      description:
        `扩展字库暂未录入“${char}”在${name}阶段的精校字形说明。接入 MongoDB 后，可为该阶段保存 glyph、description、source 与 imageKey 等字段。`
    }))
  };
}

async function findCharacter(char) {
  const mongoDb = await getMongoDb();
  if (mongoDb) {
    const doc = await mongoDb.collection('characters').findOne({ char });
    if (doc) {
      const { _id, ...rest } = doc;
      return rest;
    }
  }

  if (characterData[char]) return characterData[char];
  if (presetCharacters.includes(char)) return createBaseCharacter(char);
  return null;
}

async function listCharacters(query = '', limit = 80) {
  const mongoDb = await getMongoDb();
  if (mongoDb) {
    const filter = query ? { char: { $regex: query } } : {};
    const docs = await mongoDb
      .collection('characters')
      .find(filter, { projection: { _id: 0, char: 1, title: 1, radical: 1, hasDetail: 1 } })
      .limit(limit)
      .toArray();

    if (docs.length) return docs;
  }

  const normalized = query.trim();
  return characterCatalog
    .filter((item) => !normalized || item.char.includes(normalized) || item.title.includes(normalized))
    .slice(0, limit);
}

async function listWorks() {
  const mongoDb = await getMongoDb();
  if (mongoDb) {
    const docs = await mongoDb
      .collection('works')
      .find({}, { projection: { _id: 0 } })
      .limit(50)
      .toArray();
    if (docs.length) return docs;
  }

  return works;
}

async function saveUser(profile) {
  const mysqlPool = await getMysqlPool();
  if (mysqlPool) {
    await mysqlPool.execute(
      `INSERT INTO users (openid, nickname, avatar_url, updated_at)
       VALUES (?, ?, ?, NOW())
       ON DUPLICATE KEY UPDATE nickname = VALUES(nickname), avatar_url = VALUES(avatar_url), updated_at = NOW()`,
      [profile.openid, profile.nickname, profile.avatarUrl]
    );
    return profile;
  }

  memoryUsers.set(profile.openid, {
    ...(memoryUsers.get(profile.openid) || {}),
    ...profile,
    updatedAt: Date.now()
  });
  return memoryUsers.get(profile.openid);
}

async function findUser(openid) {
  const mysqlPool = await getMysqlPool();
  if (mysqlPool) {
    const [rows] = await mysqlPool.execute(
      'SELECT openid, nickname, avatar_url AS avatarUrl, created_at AS createdAt FROM users WHERE openid = ? LIMIT 1',
      [openid]
    );
    return rows[0] || null;
  }

  return memoryUsers.get(openid) || null;
}

async function recordActivity(openid, type, payload = {}) {
  const activity = {
    id: `${openid}-${type}-${Date.now()}`,
    openid,
    type,
    payload,
    createdAt: Date.now()
  };
  const mysqlPool = await getMysqlPool();
  if (mysqlPool) {
    await mysqlPool.execute(
      'INSERT INTO activities (openid, type, payload_json, created_at) VALUES (?, ?, ?, NOW())',
      [openid, type, JSON.stringify(payload)]
    );
    return activity;
  }

  const list = memoryActivities.get(openid) || [];
  memoryActivities.set(openid, [activity, ...list].slice(0, 50));
  return activity;
}

async function listActivities(openid) {
  const mysqlPool = await getMysqlPool();
  if (mysqlPool) {
    const [rows] = await mysqlPool.execute(
      'SELECT id, type, payload_json AS payload, created_at AS createdAt FROM activities WHERE openid = ? ORDER BY created_at DESC LIMIT 20',
      [openid]
    );
    return rows;
  }

  return memoryActivities.get(openid) || [];
}

async function getUserUnlocked(openid) {
  const mysqlPool = await getMysqlPool();
  if (mysqlPool) {
    const [rows] = await mysqlPool.execute(
      'SELECT char_value AS charValue FROM user_progress WHERE openid = ? ORDER BY unlocked_at ASC',
      [openid]
    );
    if (rows.length) return rows.map((row) => row.charValue);

    await Promise.all(
      ['说', '文', '人'].map((char) =>
        mysqlPool.execute(
          'INSERT IGNORE INTO user_progress (openid, char_value, unlocked_at) VALUES (?, ?, NOW())',
          [openid, char]
        )
      )
    );
    return ['说', '文', '人'];
  }

  if (!userProgress.has(openid)) {
    userProgress.set(openid, ['说', '文', '人']);
  }
  return userProgress.get(openid);
}

async function addUserUnlocked(openid, char) {
  const mysqlPool = await getMysqlPool();
  if (mysqlPool) {
    await mysqlPool.execute(
      'INSERT IGNORE INTO user_progress (openid, char_value, unlocked_at) VALUES (?, ?, NOW())',
      [openid, char]
    );
    return getUserUnlocked(openid);
  }

  const unlocked = await getUserUnlocked(openid);
  if (!unlocked.includes(char)) {
    userProgress.set(openid, [...unlocked, char]);
  }
  return getUserUnlocked(openid);
}

const characterData = {
  说: {
    char: '说',
    meaning:
      '《说文解字》释“说”为“释也”，从言、兑声，本义偏向解释、陈说，使意义得以开解。这个字不是单纯象形字，而是形声兼会意：言旁标明与语言有关，兑旁兼表读音，并含有舒解、悦怿的语义联想。',
    stages: [
      {
        name: '甲骨文',
        glyph: '說',
        description:
          '甲骨文中尚未见到成熟稳定的“說”字形，早期表达言说多借“言”“曰”等构件，刻画方式以短直线和口形符号为主。此处以传统字“說”代示，需注意其“言 + 兑”的完整结构属于后起形声系统，并非商代甲骨中的定型字。'
      },
      {
        name: '金文',
        glyph: '說',
        description:
          '金文阶段与言语有关的字多见“言”形构件，线条较甲骨圆厚，口、舌、声气的象征逐渐转化为可组合的偏旁。用于表示“说”的结构趋向“言”旁加声符“兑”，但不同器铭书写仍有繁简和位置差异。'
      },
      {
        name: '篆书',
        glyph: '說',
        description:
          '秦系篆书将“說”规范为左“言”右“兑”，笔画圆转匀称，左右结构清楚。言旁呈纵向排列，兑旁上部与下部比例拉长，体现小篆形体修长、曲线连续的特点。'
      },
      {
        name: '隶书',
        glyph: '說',
        description:
          '汉代隶书把篆书圆转线条改为横向舒展的笔画，言旁点画分化，右侧“兑”也趋于扁平。这个阶段“說”的形体从古文字系统转入今文字系统，波磔和横势明显增强。'
      },
      {
        name: '楷书',
        glyph: '说',
        description:
          '楷书阶段结构方正，繁体“說”在现代简化字中写作“说”，右旁由“兑”简化为“兑”的今形。楷书强调笔画秩序和部件边界，左言旁简化为“讠”后更适合快速书写。'
      }
    ]
  },
  文: {
    char: '文',
    meaning:
      '《说文解字》释“文”为“错画也，象交文”，本义指交错的纹理、纹饰。它最初并非专指文章，而是由身体、器物或自然表面的交错纹样引申为文采、文字和文化制度。',
    stages: [
      {
        name: '甲骨文',
        glyph: '文',
        description:
          '甲骨文“文”多像正面人形胸前有交错纹饰，中心交叉笔画表现“错画”的纹理。由于刻写在甲骨上，线条尖直简省，人体轮廓和胸前纹样往往高度概括。'
      },
      {
        name: '金文',
        glyph: '文',
        description:
          '金文“文”的线条较圆厚，交叉纹样更醒目，整体比甲骨文更宽博稳定。青铜铸铭使笔画带有圆润感，人的形象逐渐弱化，纹饰符号的意义更加突出。'
      },
      {
        name: '篆书',
        glyph: '文',
        description:
          '篆书“文”将交错线条规范成对称而修长的字形，上部收束，下部左右分张。小篆减少具体人体感，保留“交文”的抽象结构，成为可识别的标准字形。'
      },
      {
        name: '隶书',
        glyph: '文',
        description:
          '隶书“文”由篆书的曲线转为平直笔画，撇捺舒展，重心下移。这个阶段字形更强调书写效率，交错纹理被固定为点、横、撇、捺的今文字构造。'
      },
      {
        name: '楷书',
        glyph: '文',
        description:
          '楷书“文”结构简明，上点居中，横画承上启下，撇捺形成稳定支撑。其古代纹饰本义已内化为字形传统，现代多用于文字、文章、文明等抽象意义。'
      }
    ]
  },
  字: {
    char: '字',
    meaning:
      '《说文解字》释“字”为“乳也，从子在宀下”，本义与生育、养育有关，像孩子在屋宇之下。后来“字”由孳乳、繁衍引申为文字单位，表示由基础文形孳生出的书写符号。',
    stages: [
      {
        name: '甲骨文',
        glyph: '字',
        description:
          '甲骨文中“字”的成熟形体并不如后世稳定，相关构意可由“宀”形屋盖与“子”形幼儿组合来理解。此处以今字代示，视觉上应想象为屋顶下有幼子，线条以尖直刻痕表现。'
      },
      {
        name: '金文',
        glyph: '字',
        description:
          '金文阶段“宀”与“子”的组合更容易形成上下结构，屋盖较宽，子形较圆厚。青铜铭文的铸造特征使笔画浑厚，表现出“子在屋下”的会意关系。'
      },
      {
        name: '篆书',
        glyph: '字',
        description:
          '篆书“字”上部“宀”圆转覆盖，下部“子”居中，整体呈纵向修长的上下结构。小篆使屋盖和子形比例规范化，清楚保留“从子在宀下”的造字理据。'
      },
      {
        name: '隶书',
        glyph: '字',
        description:
          '隶书“字”将篆书弧线改为平直横画，宝盖头展开为横势，下方“子”的弯曲处趋于折笔。字形由圆转变方折，书写速度和辨识度明显提高。'
      },
      {
        name: '楷书',
        glyph: '字',
        description:
          '楷书“字”定型为上“宀”下“子”，横画、钩画和点画分明。现代字形已主要表示书写符号，但仍保存着“屋下有子”的古代构形痕迹。'
      }
    ]
  },
  人: {
    char: '人',
    meaning:
      '《说文解字》称“人，天地之性最贵者也”，并说“象臂胫之形”，说明其本义为侧身站立的人形。古文字中的“人”不是正面肖像，而是以躯干、手臂和腿部的侧面轮廓来概括人的形体。',
    stages: [
      {
        name: '甲骨文',
        glyph: '人',
        description:
          '甲骨文“人”像一个侧身而立的人，常以一撇一捺或弯折线表示躯体与腿足。线条因刻写而瘦硬，人物形象高度概括，但“象臂胫之形”的特征仍清楚。'
      },
      {
        name: '金文',
        glyph: '人',
        description:
          '金文“人”较甲骨文圆润，躯干与腿部的连接更舒展，姿态仍保持侧立。青铜铭文使线条变厚，人的动态感减弱，符号化程度提高。'
      },
      {
        name: '篆书',
        glyph: '人',
        description:
          '篆书“人”笔画圆转修长，两笔相接处自然过渡，整体更加均衡。小篆不再强调具体身体细节，而把侧身人形抽象为稳定的二笔结构。'
      },
      {
        name: '隶书',
        glyph: '人',
        description:
          '隶书“人”撇捺开张，横向取势增强，笔画末端出现隶书特有的顿挫。这个阶段字形从圆转线条转为方折笔势，为楷书的人字奠定基础。'
      },
      {
        name: '楷书',
        glyph: '人',
        description:
          '楷书“人”以撇、捺两笔定型，重心稳定，左右舒展。现代字形虽然已不直观如图画，但仍保留侧身人体轮廓的抽象结构。'
      }
    ]
  },
  水: {
    char: '水',
    meaning:
      '《说文解字》释“水”为“准也”，又说它是“北方之行”，字形“象众水并流，中有微阳之气”。本义为水流，古文字以中间主流和两侧支流表现水势流动。',
    stages: [
      {
        name: '甲骨文',
        glyph: '水',
        description:
          '甲骨文“水”常以一条弯曲主线配合两侧短线表示流水，像河流分支并行。刻写线条细瘦而有波动感，能够看出“众水并流”的象形来源。'
      },
      {
        name: '金文',
        glyph: '水',
        description:
          '金文“水”的主流线条更圆厚，两旁水滴或支流形态较饱满。与甲骨文相比，金文弱化了急促刻痕，增强了水流连续、回环的视觉效果。'
      },
      {
        name: '篆书',
        glyph: '水',
        description:
          '篆书“水”把中线和左右水势规范为修长曲线，整体对称而富有流动感。小篆保留象形意味，但笔画位置和长度已趋于制度化。'
      },
      {
        name: '隶书',
        glyph: '水',
        description:
          '隶书“水”将弯曲水势拆解为竖钩、横撇和左右点画，横向展开明显。这个阶段象形感减弱，偏旁化的“氵”和独体“水”开始在书写系统中分工清晰。'
      },
      {
        name: '楷书',
        glyph: '水',
        description:
          '楷书“水”以竖钩为中轴，左右撇捺和点画分布均衡。现代字形已高度笔画化，但中线主流与两侧支流的古象仍可从结构中追溯。'
      }
    ]
  },
  山: {
    char: '山',
    meaning:
      '《说文解字》释“山”为“宣也”，并说明山能宣散地气、生育万物，且“有石而高”。其字形为象形，古文字以几个并立的峰峦表现高起的山体。',
    stages: [
      {
        name: '甲骨文',
        glyph: '山',
        description:
          '甲骨文“山”像三座相连的山峰，中峰常较高，两侧峰较低。刻线简洁直硬，突出“有石而高”的轮廓，而不描绘山体细节。'
      },
      {
        name: '金文',
        glyph: '山',
        description:
          '金文“山”的峰形更厚重，三个竖起的峰峦常以圆润线条连接。与甲骨文相比，金文山形更稳定宽博，适合青铜器铭文的铸造风格。'
      },
      {
        name: '篆书',
        glyph: '山',
        description:
          '篆书“山”将三峰规范为中竖高、左右竖低的对称结构，下部连成一体。小篆的线条圆转匀称，使山峰象形转化为标准化符号。'
      },
      {
        name: '隶书',
        glyph: '山',
        description:
          '隶书“山”三竖趋于方折，底部横势增强，整体由高耸形转为扁方形。这个阶段的山字更注重书写速度和横向平衡，象形意味进一步减弱。'
      },
      {
        name: '楷书',
        glyph: '山',
        description:
          '楷书“山”以三竖和底部折画定型，中竖高起，左右竖分列。现代字形仍能直观看出三峰并峙，是象形字保存较明显的例子。'
      }
    ]
  },
  日: {
    char: '日',
    meaning:
      '《说文解字》释“日”为“实也，太阳之精不亏”，从圆形轮廓与中间一画来象太阳。古文字最初多近圆形或方圆形，中间一点或一横表示太阳充实有光。',
    stages: [
      {
        name: '甲骨文',
        glyph: '𡆠',
        description:
          '甲骨文“日”多作圆形或近方圆形，中间有一点或短画，表示太阳实体与光明核心。由于甲骨刻写不便成圆，外轮廓常呈方折或椭圆化。'
      },
      {
        name: '金文',
        glyph: '日',
        description:
          '金文“日”外框较圆厚，中间点画或横画更稳定，太阳轮廓清晰。青铜铸铭使线条厚重，字形从自然圆形逐渐向规整方框过渡。'
      },
      {
        name: '篆书',
        glyph: '日',
        description:
          '篆书“日”呈纵长圆方形，中间一横居中，体现“从囗一”的构形解释。小篆使太阳图像高度规范化，外框圆转而内画平稳。'
      },
      {
        name: '隶书',
        glyph: '日',
        description:
          '隶书“日”由圆转外框变为方折框形，中横平直，整体趋扁。这个阶段太阳象形基本转为笔画结构，横画和折笔成为主要视觉特征。'
      },
      {
        name: '楷书',
        glyph: '日',
        description:
          '楷书“日”以竖长方框和中横定型，笔画边界清楚。虽然不再像圆日图像，但外框与中画仍保存太阳轮廓和内部光实的古意。'
      }
    ]
  },
  月: {
    char: '月',
    meaning:
      '《说文解字》释“月”为“阙也，太阴之精”，以月亮有盈亏缺损来说明其名义。古文字多像弯月或半月，内部短画表示月中阴影或月体分界。',
    stages: [
      {
        name: '甲骨文',
        glyph: '月',
        description:
          '甲骨文“月”多作弯曲的半月形，外侧弧线明显，内部有短画表示月体。刻写时弧线常被折线化，但仍能看出“阙”的缺月形象。'
      },
      {
        name: '金文',
        glyph: '月',
        description:
          '金文“月”线条圆厚，半月轮廓较甲骨文更饱满，内部短画也更稳定。这个阶段字形既保留弯月象形，又开始向固定竖向结构靠拢。'
      },
      {
        name: '篆书',
        glyph: '月',
        description:
          '篆书“月”外形修长，弧线圆转，内部两短画上下排列。小篆将弯月图像规范为纵向构件，为后世“月”旁和“肉”旁的形近现象埋下基础。'
      },
      {
        name: '隶书',
        glyph: '月',
        description:
          '隶书“月”外框趋于方折，内部短横平直，弯月感明显减弱。由于隶变影响，月形构件逐渐成为可快速书写的偏旁结构。'
      },
      {
        name: '楷书',
        glyph: '月',
        description:
          '楷书“月”定型为竖撇、横折钩和两短横，结构清晰。现代字形虽已笔画化，但狭长外框仍可追溯到弯月或半月的象形传统。'
      }
    ]
  },
  火: {
    char: '火',
    meaning:
      '《说文解字》释“火”为“毁也”，又称其为“南方之行，炎而上，象形”。本义为火焰燃烧，古文字以中间火苗和两侧上扬的焰舌表现火势向上。',
    stages: [
      {
        name: '甲骨文',
        glyph: '火',
        description:
          '甲骨文“火”像几束向上跳动的火苗，中间主焰较高，两旁有分叉火舌。刻线短促尖锐，表现火焰上腾和摇曳的动态。'
      },
      {
        name: '金文',
        glyph: '火',
        description:
          '金文“火”的火苗线条更圆厚，左右火舌较舒展，整体形态比甲骨文饱满。铸铭使尖锐火焰转为圆润曲线，但“炎而上”的方向感仍明显。'
      },
      {
        name: '篆书',
        glyph: '火',
        description:
          '篆书“火”把多束火焰整理为中轴与左右对称的曲线，字形修长。小篆保留火苗上扬的象形意味，同时使笔画布局趋于标准。'
      },
      {
        name: '隶书',
        glyph: '火',
        description:
          '隶书“火”将火苗曲线转为点、撇、捺等笔画，横向开张增强。这个阶段火焰图像被拆解为今文字笔法，书写节奏更加明确。'
      },
      {
        name: '楷书',
        glyph: '火',
        description:
          '楷书“火”以点、短撇、长撇和捺组成，左右展开而中部稳固。现代字形仍能从上部点画和下部撇捺看出火苗分散上扬的来源。'
      }
    ]
  },
  木: {
    char: '木',
    meaning:
      '《说文解字》释“木”为“冒也，冒地而生”，并说它属东方之行，下部像根。古文字以树干、枝条和根部构成，表现树木从土地中向上生长。',
    stages: [
      {
        name: '甲骨文',
        glyph: '木',
        description:
          '甲骨文“木”像一棵树，上部有枝，下部有根，中间竖线表示树干。刻写线条简洁，树冠和根系都被概括为分叉笔画，直观体现“冒地而生”。'
      },
      {
        name: '金文',
        glyph: '木',
        description:
          '金文“木”的树干较粗，枝根分叉更圆润，整体比甲骨文厚重。青铜铭文中的木形更稳定，枝与根的上下对应关系清楚。'
      },
      {
        name: '篆书',
        glyph: '木',
        description:
          '篆书“木”将树干、枝、根规范为纵轴和左右分展的线条，形体修长对称。小篆仍保留上枝下根的象形结构，但笔画已高度制度化。'
      },
      {
        name: '隶书',
        glyph: '木',
        description:
          '隶书“木”横画展开，竖画居中，撇捺分明，树形图像转化为书写笔画。这个阶段下部根形不再作为图像出现，而融入撇捺的结构平衡。'
      },
      {
        name: '楷书',
        glyph: '木',
        description:
          '楷书“木”以横、竖、撇、捺四笔定型，结构简洁稳定。现代字形虽抽象，但仍保留树干贯通上下、枝根左右分展的基本构意。'
      }
    ]
  }
};

const radicals = [
  { radical: '言', meaning: '言语', examples: ['说', '语', '诗', '话', '论', '读'] },
  { radical: '文', meaning: '纹饰', examples: ['文', '斋', '斌', '斐', '斑', '斓'] },
  { radical: '宀', meaning: '屋宇', examples: ['字', '家', '安', '室', '宅', '宫'] },
  { radical: '人', meaning: '人物', examples: ['人', '仁', '休', '信', '仕', '仰'] },
  { radical: '水', meaning: '水流', examples: ['水', '江', '河', '清', '泉', '海'] },
  { radical: '山', meaning: '山岳', examples: ['山', '峰', '岭', '岩', '岳', '峡'] },
  { radical: '日', meaning: '日光', examples: ['日', '明', '晴', '晖', '晓', '时'] },
  { radical: '月', meaning: '月体', examples: ['月', '朗', '朔', '望', '朝', '期'] },
  { radical: '火', meaning: '火光', examples: ['火', '炎', '灯', '炽', '烟', '烛'] },
  { radical: '木', meaning: '树木', examples: ['木', '林', '森', '枝', '根', '桥'] },
  { radical: '口', meaning: '口舌', examples: ['口', '古', '名', '君', '品', '唱'] },
  { radical: '手', meaning: '执持', examples: ['手', '打', '持', '扶', '择', '推'] },
  { radical: '心', meaning: '心意', examples: ['心', '志', '思', '念', '恭', '愿'] },
  { radical: '目', meaning: '眼目', examples: ['目', '看', '相', '省', '眉', '睡'] },
  { radical: '足', meaning: '行走', examples: ['足', '跑', '跟', '路', '跃', '距'] }
];

const heatmap = [
  { id: 'zisheng', name: '字圣殿', heat: 92 },
  { id: 'dadao', name: '汉字大道', heat: 76 },
  { id: 'shuzhong', name: '叔重堂', heat: 64 },
  { id: 'liushu', name: '六书广场', heat: 83 },
  { id: 'xushenmu', name: '许慎墓', heat: 48 }
];

app.get('/api/characters', async (req, res) => {
  try {
    const data = await listCharacters(req.query.q || '', Number(req.query.limit) || 80);
    res.json({
      total: TOTAL_SHUOWEN_COUNT,
      returned: data.length,
      items: data
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

app.get('/api/characters/:char', async (req, res) => {
  const char = [...req.params.char][0];
  const data = await findCharacter(char);

  if (!data) {
    return res.status(404).json({
      message: '未找到该汉字的演变数据',
      supportedCharacters: presetCharacters
    });
  }

  return res.json(data);
});

app.get('/api/radicals', (_req, res) => {
  res.json(radicals);
});

app.get('/api/works', async (_req, res) => {
  try {
    const data = await listWorks();
    res.json(data);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

app.get('/api/heatmap', (_req, res) => {
  res.json(heatmap);
});

app.get('/api/progress', async (req, res) => {
  const openid = getOpenId(req);
  const unlockedCharacters = await getUserUnlocked(openid);

  res.json({
    total: TOTAL_SHUOWEN_COUNT,
    unlocked: unlockedCharacters,
    unlockedCount: unlockedCharacters.length
  });
});

app.post('/api/progress/unlock', async (req, res) => {
  const openid = getOpenId(req);
  const unlockedCharacters = await getUserUnlocked(openid);
  const candidates = presetCharacters.filter((char) => !unlockedCharacters.includes(char));
  const unlockedChar =
    candidates.length > 0
      ? candidates[Math.floor(Math.random() * candidates.length)]
      : presetCharacters[Math.floor(Math.random() * presetCharacters.length)];

  if (!unlockedCharacters.includes(unlockedChar)) {
    await addUserUnlocked(openid, unlockedChar);
  }

  const nextUnlocked = await getUserUnlocked(openid);
  await recordActivity(openid, 'unlock_character', { char: unlockedChar, isNew: candidates.length > 0 });

  res.json({
    unlockedChar,
    isNew: candidates.length > 0,
    total: TOTAL_SHUOWEN_COUNT,
    unlocked: nextUnlocked,
    unlockedCount: nextUnlocked.length
  });
});

app.post('/api/auth/wechat', async (req, res) => {
  const openid = req.body.openid || `dev-${req.body.code || 'openid'}`;
  const profile = await saveUser({
    openid,
    nickname: req.body.nickname || '说文访客',
    avatarUrl: req.body.avatarUrl || ''
  });
  await recordActivity(openid, 'login', { source: 'miniprogram' });

  res.json({
    token: openid,
    user: profile
  });
});

app.get('/api/me', async (req, res) => {
  const openid = getOpenId(req);
  const user = (await findUser(openid)) || {
    openid,
    nickname: '说文访客',
    avatarUrl: ''
  };
  const unlocked = await getUserUnlocked(openid);
  const activities = await listActivities(openid);

  res.json({
    user,
    stats: {
      total: TOTAL_SHUOWEN_COUNT,
      unlockedCount: unlocked.length,
      activityCount: activities.length
    },
    activities
  });
});

app.get('/api/oss/signature', async (req, res) => {
  const key = req.query.key || '';
  const ossClient = await getOssClient();

  if (!ossClient || !key) {
    return res.json({
      enabled: false,
      url: key ? `/assets/${key}` : '',
      message: 'OSS 未配置，当前返回本地占位路径'
    });
  }

  const url = ossClient.signatureUrl(key, { expires: 3600 });
  return res.json({ enabled: true, key, url });
});

app.listen(port, () => {
  console.log(`Shuowen backend listening at http://localhost:${port}`);
});

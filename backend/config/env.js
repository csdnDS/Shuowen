import 'dotenv/config';

export const env = {
  port: Number(process.env.PORT) || 3001,
  mongoUri: process.env.MONGO_URI || '',
  mongoDbName: process.env.MONGO_DB_NAME || 'shuowen',
  mysqlUri: process.env.MYSQL_URI || '',
  redisUrl: process.env.REDIS_URL || '',
  ossRegion: process.env.OSS_REGION || '',
  ossBucket: process.env.OSS_BUCKET || '',
  ossAccessKeyId: process.env.OSS_ACCESS_KEY_ID || '',
  ossAccessKeySecret: process.env.OSS_ACCESS_KEY_SECRET || '',
  wxAppId: process.env.WX_APPID || '',
  wxSecret: process.env.WX_SECRET || ''
};

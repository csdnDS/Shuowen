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
  wxSecret: process.env.WX_SECRET || '',
  deepseekApiKey: process.env.DEEPSEEK_API_KEY || process.env.OPENAI_API_KEY || '',
  deepseekModel: process.env.DEEPSEEK_MODEL || process.env.OPENAI_MODEL || 'deepseek-v4-flash',
  deepseekBaseUrl: process.env.DEEPSEEK_BASE_URL || process.env.OPENAI_BASE_URL || 'https://api.deepseek.com',
  xfyunTtsAppId: process.env.XFYUN_TTS_APP_ID || '',
  xfyunTtsApiKey: process.env.XFYUN_TTS_API_KEY || '',
  xfyunTtsApiSecret: process.env.XFYUN_TTS_API_SECRET || '',
  xfyunTtsVoice: process.env.XFYUN_TTS_VOICE || 'aisbabyxu',
  xfyunAsrAppId: process.env.XFYUN_ASR_APP_ID || process.env.XFYUN_TTS_APP_ID || '',
  xfyunAsrApiKey: process.env.XFYUN_ASR_API_KEY || process.env.XFYUN_TTS_API_KEY || '',
  xfyunAsrApiSecret: process.env.XFYUN_ASR_API_SECRET || process.env.XFYUN_TTS_API_SECRET || ''
};

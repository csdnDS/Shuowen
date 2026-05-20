import OSS from 'ali-oss';
import { env } from '../config/env.js';

let clientPromise = null;

function isPlaceholder(value) {
  return !value ||
    value.startsWith('your-') ||
    value === 'shuowen-assets';
}

export async function getOssClient() {
  if (
    isPlaceholder(env.ossRegion) ||
    isPlaceholder(env.ossBucket) ||
    isPlaceholder(env.ossAccessKeyId) ||
    isPlaceholder(env.ossAccessKeySecret)
  ) {
    return null;
  }

  try {
    if (!clientPromise) {
      clientPromise = Promise.resolve(
        new OSS({
          region: env.ossRegion,
          bucket: env.ossBucket,
          accessKeyId: env.ossAccessKeyId,
          accessKeySecret: env.ossAccessKeySecret
        })
      );
    }
    return await clientPromise;
  } catch (error) {
    console.warn(`OSS unavailable, using local asset fallback: ${error.message}`);
    clientPromise = null;
    return null;
  }
}

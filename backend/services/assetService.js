import path from 'path';
import { fileURLToPath } from 'url';
import { getOssClient } from '../db/oss.js';

const DEFAULT_EXPIRES = 3600;
const MAX_EXPIRES = 24 * 3600;
const MAX_BATCH_SIZE = 100;
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export const localAssetRoot = path.resolve(__dirname, '../assets/public');

export function normalizeAssetKey(key) {
  const raw = String(key || '').trim();
  let decoded = raw;

  try {
    decoded = decodeURIComponent(raw);
  } catch (_error) {
    decoded = raw;
  }

  const normalized = decoded
    .trim()
    .replace(/^\/+/, '')
    .replace(/\\/g, '/');

  if (!normalized || normalized.includes('..') || normalized.startsWith('assets/')) {
    return '';
  }

  return normalized;
}

export function normalizeExpires(expires) {
  const value = Number(expires) || DEFAULT_EXPIRES;
  return Math.max(60, Math.min(value, MAX_EXPIRES));
}

function buildLocalUrl(req, key) {
  const forwardedProto = String(req.get('x-forwarded-proto') || '').split(',')[0].trim();
  const protocol = forwardedProto || req.protocol || 'http';
  const host = req.get('host');
  return `${protocol}://${host}/assets/${encodeURI(key)}`;
}

export async function signAsset(req, key, expires) {
  const normalizedKey = normalizeAssetKey(key);
  const safeExpires = normalizeExpires(expires);

  if (!normalizedKey) {
    return {
      enabled: false,
      key: '',
      url: '',
      message: '资产 key 不能为空或包含非法路径'
    };
  }

  const ossClient = await getOssClient();
  if (!ossClient) {
    return {
      enabled: false,
      provider: 'local',
      key: normalizedKey,
      url: buildLocalUrl(req, normalizedKey),
      expires: safeExpires,
      message: 'OSS 未配置，当前返回本地资产路径'
    };
  }

  return {
    enabled: true,
    provider: 'oss',
    key: normalizedKey,
    url: ossClient.signatureUrl(normalizedKey, { expires: safeExpires }),
    expires: safeExpires
  };
}

export async function signAssets(req, keys, expires) {
  const uniqueKeys = [...new Set((Array.isArray(keys) ? keys : [])
    .map(normalizeAssetKey)
    .filter(Boolean))]
    .slice(0, MAX_BATCH_SIZE);

  const assets = await Promise.all(uniqueKeys.map((key) => signAsset(req, key, expires)));
  return {
    count: assets.length,
    maxBatchSize: MAX_BATCH_SIZE,
    assets
  };
}

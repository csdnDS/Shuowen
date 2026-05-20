import { cacheDel, cacheGet, cacheSet } from '../db/redis.js';
import { heatmap } from '../data/seedData.js';
import { insertCheckin, listRecentCheckinCounts } from '../repositories/checkinRepository.js';
import { recordActivity } from '../repositories/userRepository.js';

export async function saveCheckin(openid, checkin) {
  const payload = await insertCheckin(openid, checkin);
  await cacheDel('heatmap:current');
  await recordActivity(openid, 'checkin', { areaId: payload.areaId, areaName: payload.areaName });
  return payload;
}

export async function buildHeatmap() {
  const cached = await cacheGet('heatmap:current');
  if (cached) return cached;

  const counts = await listRecentCheckinCounts();
  if (!counts.length) {
    await cacheSet('heatmap:current', heatmap, 60);
    return heatmap;
  }

  const maxCount = Math.max(...counts.map((item) => Number(item.count) || 0), 1);
  const countMap = new Map(counts.map((item) => [item.areaId, item]));
  const result = heatmap.map((area) => {
    const row = countMap.get(area.id);
    if (!row) return { ...area, checkins: 0 };
    const heat = Math.min(100, Math.max(20, Math.round((Number(row.count) / maxCount) * 100)));
    return {
      ...area,
      name: row.areaName || area.name,
      heat,
      checkins: Number(row.count)
    };
  });

  await cacheSet('heatmap:current', result, 60);
  return result;
}

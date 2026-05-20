import { getMysqlPool } from '../db/mysql.js';

const memoryCheckins = [];

export async function insertCheckin(openid, checkin) {
  const mysqlPool = await getMysqlPool();
  const payload = {
    openid,
    areaId: checkin.areaId,
    areaName: checkin.areaName || '',
    lat: Number(checkin.lat) || null,
    lng: Number(checkin.lng) || null,
    createdAt: Date.now()
  };

  if (mysqlPool) {
    await mysqlPool.execute(
      'INSERT INTO checkins (openid, area_id, area_name, lat, lng, created_at) VALUES (?, ?, ?, ?, ?, NOW())',
      [openid, payload.areaId, payload.areaName, payload.lat, payload.lng]
    );
  } else {
    memoryCheckins.unshift(payload);
    memoryCheckins.splice(5000);
  }

  return payload;
}

export async function listRecentCheckinCounts() {
  const mysqlPool = await getMysqlPool();
  if (mysqlPool) {
    const [rows] = await mysqlPool.execute(
      `SELECT area_id AS areaId, area_name AS areaName, COUNT(*) AS count
       FROM checkins
       WHERE created_at >= DATE_SUB(NOW(), INTERVAL 24 HOUR)
       GROUP BY area_id, area_name`
    );
    return rows.map((row) => ({
      ...row,
      count: Number(row.count) || 0
    }));
  }

  const since = Date.now() - 24 * 60 * 60 * 1000;
  const grouped = new Map();
  memoryCheckins
    .filter((item) => item.createdAt >= since)
    .forEach((item) => {
      const current = grouped.get(item.areaId) || {
        areaId: item.areaId,
        areaName: item.areaName,
        count: 0
      };
      current.count += 1;
      grouped.set(item.areaId, current);
    });
  return [...grouped.values()];
}

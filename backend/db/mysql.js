import mysql from 'mysql2/promise';
import { env } from '../config/env.js';

let poolPromise = null;

export async function getMysqlPool() {
  if (!env.mysqlUri) return null;

  try {
    if (!poolPromise) {
      poolPromise = mysql.createPool(env.mysqlUri);
    }
    return await poolPromise;
  } catch (error) {
    console.warn(`MySQL unavailable, using memory fallback: ${error.message}`);
    poolPromise = null;
    return null;
  }
}

export async function closeMysqlPool() {
  if (!poolPromise) return;

  try {
    const pool = await poolPromise;
    await pool.end();
  } finally {
    poolPromise = null;
  }
}

import fs from 'node:fs/promises';
import mysql from 'mysql2/promise';
import { env } from '../config/env.js';

function splitSql(sql) {
  return sql
    .split(/;\s*(?:\r?\n|$)/)
    .map((statement) => statement.trim())
    .filter(Boolean);
}

async function main() {
  if (!env.mysqlUri) {
    throw new Error('MYSQL_URI 未配置，请先在 backend/.env 中设置 MySQL 连接');
  }

  const sql = await fs.readFile(new URL('../schema.mysql.sql', import.meta.url), 'utf8');
  const statements = splitSql(sql);
  const connection = await mysql.createConnection(env.mysqlUri);

  try {
    for (const statement of statements) {
      await connection.query(statement);
    }
    console.log(JSON.stringify({
      ok: true,
      statements: statements.length,
      message: 'MySQL tables initialized'
    }, null, 2));
  } finally {
    await connection.end();
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});

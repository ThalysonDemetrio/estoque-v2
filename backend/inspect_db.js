
const path = require('path');
const fs = require('fs');
require('dotenv').config({ path: path.resolve(__dirname, './.env') });
const { Pool } = require('pg');

const pool = new Pool({
  connectionString: process.env.DATABASE_URL
});

async function inspect() {
  try {
    const res = await pool.query(`
      SELECT
          conname AS constraint_name,
          pg_get_constraintdef(c.oid) AS constraint_definition
      FROM
          pg_constraint c
      JOIN
          pg_namespace n ON n.oid = c.connamespace
      WHERE
          contype = 'c'
          AND n.nspname = 'public';
    `);
    fs.writeFileSync('constraints.json', JSON.stringify(res.rows, null, 2), 'utf8');
    process.exit(0);
  } catch (err) {
    console.error(err);
    process.exit(1);
  }
}

inspect();

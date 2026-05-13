require('dotenv').config();
const { pool } = require('../src/db.js');

const sql = `
CREATE TABLE IF NOT EXISTS push_subscriptions (
  id SERIAL PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES users(user_id) ON DELETE CASCADE,
  endpoint TEXT UNIQUE NOT NULL,
  expiration_time TEXT,
  p256dh TEXT NOT NULL,
  auth TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_push_subs_user ON push_subscriptions(user_id);
`;

pool.query(sql)
  .then(() => console.log('TABLE push_subscriptions CREATED SUCCESSFULLY.'))
  .catch((e) => console.error('Error creating table:', e))
  .finally(() => process.exit(0));

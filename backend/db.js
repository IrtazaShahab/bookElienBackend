const { Pool } = require('pg');

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false },
  connectionTimeoutMillis: 10000,
});

pool.connect((err, client, release) => {
  if (err) {
    console.error('❌ Error connecting to Supabase:', err.message);
  } else {
    console.log('✅ Connected to Supabase DB');
    release();
  }
});

module.exports = {
  query: (text, params) => pool.query(text, params),
};
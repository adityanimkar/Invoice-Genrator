const { Client } = require('pg');
require('dotenv').config();

if (!process.env.DATABASE_URL) {
  console.error('DATABASE_URL environment variable is missing!');
  process.exit(1);
}

const clientConfig = {
  connectionString: process.env.DATABASE_URL,
  ssl: {
    rejectUnauthorized: false
  },
  connectionTimeoutMillis: 10000
};

async function query(text, params) {
  const client = new Client(clientConfig);
  await client.connect();
  try {
    const res = await client.query(text, params);
    return res;
  } finally {
    await client.end().catch(err => console.error('Error closing database client:', err));
  }
}

const poolMock = {
  connect: async () => {
    const client = new Client(clientConfig);
    await client.connect();
    client.release = () => {
      client.end().catch(err => console.error('Error closing transaction database client:', err));
    };
    return client;
  },
  query: query,
  end: async () => {
    // No-op for mock pool
  }
};

module.exports = {
  query,
  pool: poolMock
};

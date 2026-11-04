const { Client } = require('pg');
require('dotenv').config();

function getClientConfig() {
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) {
    throw new Error('DATABASE_URL environment variable is missing.');
  }
  return {
    connectionString,
    ssl: {
      rejectUnauthorized: false
    },
    connectionTimeoutMillis: 10000
  };
}

async function query(text, params) {
  const client = new Client(getClientConfig());
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
    const client = new Client(getClientConfig());
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

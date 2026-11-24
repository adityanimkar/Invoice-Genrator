const { Pool } = require('pg');
require('dotenv').config();

function getPoolConfig() {
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) {
    throw new Error('DATABASE_URL environment variable is missing.');
  }
  return {
    connectionString,
    ssl: {
      rejectUnauthorized: false
    },
    max: 10,
    idleTimeoutMillis: 30000,
    connectionTimeoutMillis: 10000
  };
}

let poolInstance = null;

function getPool() {
  if (!poolInstance) {
    poolInstance = new Pool(getPoolConfig());
    poolInstance.on('error', (err) => {
      console.error('Unexpected pool error on idle client:', err.message);
      try { poolInstance.end().catch(() => {}); } catch (e) {}
      poolInstance = null;
    });
  }
  return poolInstance;
}

async function query(text, params) {
  try {
    const p = getPool();
    return await p.query(text, params);
  } catch (err) {
    const isConnErr = err.message && (
      err.message.includes('closed') || 
      err.message.includes('ECONNRESET') || 
      err.message.includes('Connection terminated') ||
      err.message.includes('Client has encountered a connection error')
    );
    if (isConnErr) {
      console.warn('Database connection lost. Resetting pool and retrying query once...');
      try { poolInstance?.end().catch(() => {}); } catch (e) {}
      poolInstance = null;
      const p = getPool();
      return await p.query(text, params);
    }
    throw err;
  }
}

const poolWrapper = {
  connect: async () => {
    const p = getPool();
    return await p.connect();
  },
  query: query,
  end: async () => {
    if (poolInstance) {
      await poolInstance.end().catch(() => {});
      poolInstance = null;
    }
  }
};

module.exports = {
  query,
  pool: poolWrapper
};

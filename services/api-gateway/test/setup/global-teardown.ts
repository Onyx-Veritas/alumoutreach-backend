/**
 * Jest Global Teardown
 *
 * Drops the test database after all tests complete.
 */
import { Client } from 'pg';

const TEST_DB_NAME = 'alumoutreach_test';

module.exports = async function globalTeardown() {
  const client = new Client({
    host: process.env.TEST_DB_HOST || 'localhost',
    port: parseInt(process.env.TEST_DB_PORT || '5432', 10),
    user: process.env.TEST_DB_USERNAME || 'postgres',
    password: process.env.TEST_DB_PASSWORD || 'postgres',
    database: 'postgres',
  });

  try {
    await client.connect();
    // Terminate connections to the test database before dropping
    await client.query(`
      SELECT pg_terminate_backend(pid)
      FROM pg_stat_activity
      WHERE datname = '${TEST_DB_NAME}' AND pid <> pg_backend_pid()
    `);
    await client.query(`DROP DATABASE IF EXISTS ${TEST_DB_NAME}`);
    console.log(`[test-teardown] Dropped database: ${TEST_DB_NAME}`);
  } finally {
    await client.end();
  }
};

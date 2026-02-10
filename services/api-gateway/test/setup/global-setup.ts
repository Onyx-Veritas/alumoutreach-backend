/**
 * Jest Global Setup
 *
 * Creates the test database and runs all migrations.
 * Runs once before the entire test suite.
 */
import { Client } from 'pg';
import * as fs from 'fs';
import * as path from 'path';

const TEST_DB_NAME = 'alumoutreach_test';

module.exports = async function globalSetup() {
  const host = process.env.DB_HOST || 'localhost';
  const port = parseInt(process.env.DB_PORT || '5432', 10);
  const user = process.env.DB_USERNAME || 'postgres';
  const password = process.env.DB_PASSWORD || 'postgres';

  // Connect to default 'postgres' database to create the test database
  const adminClient = new Client({
    host,
    port,
    user,
    password,
    database: 'postgres',
  });

  try {
    await adminClient.connect();

    // Drop and recreate test database for a clean slate
    await adminClient.query(`DROP DATABASE IF EXISTS ${TEST_DB_NAME}`);
    await adminClient.query(`CREATE DATABASE ${TEST_DB_NAME}`);
    console.log(`[test-setup] Created database: ${TEST_DB_NAME}`);
  } finally {
    await adminClient.end();
  }

  // Connect to the test database and run migrations
  const testClient = new Client({
    host,
    port,
    user,
    password,
    database: TEST_DB_NAME,
  });

  try {
    await testClient.connect();

    // Run migrations in order
    const migrationsDir = path.resolve(__dirname, '../../../../migrations');
    const migrationFiles = fs.readdirSync(migrationsDir)
      .filter((f: string) => f.endsWith('.sql'))
      .sort();

    for (const file of migrationFiles) {
      const sql = fs.readFileSync(path.join(migrationsDir, file), 'utf-8');
      await testClient.query(sql);
      console.log(`[test-setup] Applied migration: ${file}`);
    }
  } finally {
    await testClient.end();
  }

  // Store DB config for test files
  process.env.TEST_DB_NAME = TEST_DB_NAME;
  process.env.TEST_DB_HOST = host;
  process.env.TEST_DB_PORT = String(port);
  process.env.TEST_DB_USERNAME = user;
  process.env.TEST_DB_PASSWORD = password;
};

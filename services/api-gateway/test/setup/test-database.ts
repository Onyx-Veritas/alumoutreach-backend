/**
 * Test Database Setup
 *
 * Provides a shared TypeORM DataSource for integration tests,
 * along with cleanup utilities.
 */
import { DataSource } from 'typeorm';
import { PipelineJob } from '../../src/modules/pipeline/entities/pipeline-job.entity';
import { PipelineFailure } from '../../src/modules/pipeline/entities/pipeline-failure.entity';
import { CampaignRun } from '../../src/modules/campaigns/entities/campaign-run.entity';
import { Campaign } from '../../src/modules/campaigns/entities/campaign.entity';

const TEST_DB_NAME = 'alumoutreach_test';

let dataSource: DataSource | null = null;

/**
 * Get or create the shared test DataSource.
 * Uses the test database created by global-setup.
 */
export async function getTestDataSource(): Promise<DataSource> {
  if (dataSource && dataSource.isInitialized) {
    return dataSource;
  }

  dataSource = new DataSource({
    type: 'postgres',
    host: process.env.TEST_DB_HOST || 'localhost',
    port: parseInt(process.env.TEST_DB_PORT || '5432', 10),
    username: process.env.TEST_DB_USERNAME || 'postgres',
    password: process.env.TEST_DB_PASSWORD || 'postgres',
    database: TEST_DB_NAME,
    // We use migrations for schema, not entity sync
    synchronize: false,
    logging: false,
    entities: [PipelineJob, PipelineFailure, CampaignRun, Campaign],
  });

  await dataSource.initialize();
  return dataSource;
}

/**
 * Close the shared test DataSource.
 * Call in afterAll() of each integration test suite.
 */
export async function closeTestDataSource(): Promise<void> {
  if (dataSource && dataSource.isInitialized) {
    await dataSource.destroy();
    dataSource = null;
  }
}

/**
 * Truncate all pipeline-related tables for test isolation.
 * Order respects foreign key constraints.
 */
export async function cleanDatabase(ds: DataSource): Promise<void> {
  await ds.query('DELETE FROM pipeline_failures');
  await ds.query('DELETE FROM pipeline_jobs');
  await ds.query('DELETE FROM campaign_runs');
  await ds.query('DELETE FROM campaigns');
}

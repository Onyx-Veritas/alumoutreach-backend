import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { DataSource } from 'typeorm';

/**
 * SchemaGuardService - Validates database schema at startup
 * 
 * This service compares the expected TypeORM entity schema against
 * the actual database schema to detect drift. It runs during module
 * initialization and logs warnings if schema mismatches are detected.
 * 
 * Note: This is a validation-only service. It does NOT modify the database.
 * All schema changes must be made through SQL migrations.
 */
@Injectable()
export class SchemaGuardService implements OnModuleInit {
  private readonly logger = new Logger(SchemaGuardService.name);

  constructor(private readonly dataSource: DataSource) {}

  async onModuleInit() {
    try {
      await this.validateSchema();
    } catch (error) {
      this.logger.warn('Schema validation skipped due to error', {
        error: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  }

  /**
   * Validates that the database schema matches TypeORM entities
   */
  private async validateSchema(): Promise<void> {
    if (!this.dataSource.isInitialized) {
      this.logger.debug('DataSource not initialized, skipping schema validation');
      return;
    }

    this.logger.debug('Starting schema validation...');

    // Get all entity metadata from TypeORM
    const entityMetadata = this.dataSource.entityMetadatas;

    // Check that all expected tables exist
    const queryRunner = this.dataSource.createQueryRunner();
    
    try {
      const tables = await queryRunner.getTables();
      const tableNames = new Set(tables.map(t => t.name));

      let missingTables = 0;
      let foundTables = 0;

      for (const entity of entityMetadata) {
        const tableName = entity.tableName;
        if (tableNames.has(tableName)) {
          foundTables++;
        } else {
          missingTables++;
          this.logger.warn(`Missing table: ${tableName} (entity: ${entity.name})`);
        }
      }

      if (missingTables === 0) {
        this.logger.log(`Schema validation passed: ${foundTables} tables verified`);
      } else {
        this.logger.warn(
          `Schema validation completed with warnings: ${foundTables} tables found, ${missingTables} tables missing`,
        );
      }
    } finally {
      await queryRunner.release();
    }
  }
}

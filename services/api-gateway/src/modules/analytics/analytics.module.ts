import { Module } from '@nestjs/common';

// Entities - none for ClickHouse (not using TypeORM)

// Repositories
import { AnalyticsRepository } from './repositories/analytics.repository';

// Services
import { AnalyticsService } from './services/analytics.service';
import { AnalyticsQueryService } from './services/analytics-query.service';
import { AnalyticsSyncService } from './services/analytics-sync.service';

// Controllers
import { AnalyticsController } from './controllers/analytics.controller';

// Mappers & Validators
import { AnalyticsMapper } from './mappers/analytics.mapper';
import { AnalyticsValidators } from './validators/analytics.validators';

// Common
import { AppLoggerService } from '../../common/logger/app-logger.service';
import { EventBusService } from '../../common/services/event-bus.service';

@Module({
  imports: [],
  controllers: [AnalyticsController],
  providers: [
    // Repository
    AnalyticsRepository,

    // Services
    AnalyticsService,
    AnalyticsQueryService,
    AnalyticsSyncService,

    // Mappers & Validators
    AnalyticsMapper,
    AnalyticsValidators,

    // Common
    AppLoggerService,
    EventBusService,
  ],
  exports: [
    AnalyticsService,
    AnalyticsQueryService,
    AnalyticsSyncService,
    AnalyticsRepository,
  ],
})
export class AnalyticsModule {}

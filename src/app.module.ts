import { Module, MiddlewareConsumer, NestModule } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { ThrottlerModule } from '@nestjs/throttler';
import { TypeOrmModule } from '@nestjs/typeorm';
import { APP_FILTER } from '@nestjs/core';

// Modules
import { ContactsModule } from './modules/contacts/contacts.module';
import { TemplatesModule } from './modules/templates/templates.module';
import { SegmentsModule } from './modules/segments/segments.module';
import { CampaignsModule } from './modules/campaigns/campaigns.module';
import { WorkflowsModule } from './modules/workflows/workflows.module';
import { SequencesModule } from './modules/sequences/sequences.module';
import { InboxModule } from './modules/inbox/inbox.module';
import { AnalyticsModule } from './modules/analytics/analytics.module';
import { HealthModule } from './modules/health/health.module';

// Logging
import { LoggerModule } from './common/logger/logger.module';
import { RequestLoggingMiddleware } from './common/middleware/request-logging.middleware';
import { GlobalExceptionFilter } from './common/filters/global-exception.filter';

// Entities
import { Contact } from './modules/contacts/entities/contact.entity';
import { ChannelIdentifier } from './modules/contacts/entities/channel-identifier.entity';
import { ContactAttribute } from './modules/contacts/entities/contact-attribute.entity';
import { ContactConsent } from './modules/contacts/entities/contact-consent.entity';
import { ContactTag } from './modules/contacts/entities/contact-tag.entity';
import { ContactTagMapping } from './modules/contacts/entities/contact-tag-mapping.entity';
import { ContactTimelineEvent } from './modules/contacts/entities/contact-timeline-event.entity';

@Module({
  imports: [
    // Configuration
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: ['.env.local', '.env'],
    }),

    // Rate limiting
    ThrottlerModule.forRoot([{
      ttl: 60000,
      limit: 100,
    }]),

    // Database (PostgreSQL)
    TypeOrmModule.forRootAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (configService: ConfigService) => ({
        type: 'postgres',
        host: configService.get('DB_HOST', 'localhost'),
        port: configService.get<number>('DB_PORT', 5432),
        username: configService.get('DB_USERNAME', 'postgres'),
        password: configService.get('DB_PASSWORD', 'postgres'),
        database: configService.get('DB_DATABASE', 'alumoutreach'),
        entities: [
          Contact,
          ChannelIdentifier,
          ContactAttribute,
          ContactConsent,
          ContactTag,
          ContactTagMapping,
          ContactTimelineEvent,
        ],
        synchronize: configService.get('NODE_ENV') !== 'production',
        logging: configService.get('DB_LOGGING', 'false') === 'true',
        ssl: configService.get('DB_SSL', 'false') === 'true'
          ? { rejectUnauthorized: false }
          : false,
        poolSize: configService.get<number>('DB_POOL_SIZE', 10),
        extra: {
          max: configService.get<number>('DB_POOL_SIZE', 10),
          idleTimeoutMillis: 30000,
          connectionTimeoutMillis: 10000,
        },
      }),
    }),

    // Logging
    LoggerModule,

    // Feature Modules
    HealthModule,
    ContactsModule,
    TemplatesModule,
    SegmentsModule,
    CampaignsModule,
    WorkflowsModule,
    SequencesModule,
    InboxModule,
    AnalyticsModule,
  ],
  providers: [
    // Global exception filter
    {
      provide: APP_FILTER,
      useClass: GlobalExceptionFilter,
    },
  ],
})
export class AppModule implements NestModule {
  configure(consumer: MiddlewareConsumer) {
    // Apply request logging middleware to all routes
    consumer.apply(RequestLoggingMiddleware).forRoutes('*');
  }
}

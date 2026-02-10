import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ElasticsearchModule } from '@nestjs/elasticsearch';
import { ConfigModule, ConfigService } from '@nestjs/config';

// Controllers
import { ContactsController } from './contacts.controller';

// Services
import { ContactsService } from './contacts.service';
import { ContactSearchService } from './services/contact-search.service';
import { EventBusService } from '../../common/services/event-bus.service';

// Repositories
import { ContactRepository } from './repositories/contact.repository';

// Entities
import { Contact } from './entities/contact.entity';
import { ChannelIdentifier } from './entities/channel-identifier.entity';
import { ContactAttribute } from './entities/contact-attribute.entity';
import { ContactConsent } from './entities/contact-consent.entity';
import { ContactTag } from './entities/contact-tag.entity';
import { ContactTagMapping } from './entities/contact-tag-mapping.entity';
import { ContactTimelineEvent } from './entities/contact-timeline-event.entity';

// Logger
import { LoggerModule } from '../../common/logger/logger.module';
import { AppLoggerService } from '../../common/logger/app-logger.service';

@Module({ 
  imports: [
    // Register all contact-related entities
    TypeOrmModule.forFeature([
      Contact,
      ChannelIdentifier,
      ContactAttribute,
      ContactConsent,
      ContactTag,
      ContactTagMapping,
      ContactTimelineEvent,
    ]),
    // Elasticsearch configuration
    ElasticsearchModule.registerAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (configService: ConfigService) => ({
        node: configService.get('ELASTICSEARCH_NODE', 'http://localhost:9200'),
        auth: {
          username: configService.get('ELASTICSEARCH_USERNAME', ''),
          password: configService.get('ELASTICSEARCH_PASSWORD', ''),
        },
        maxRetries: 10,
        requestTimeout: 60000,
        sniffOnStart: false,
      }),
    }),
    LoggerModule,
  ],
  controllers: [ContactsController],
  providers: [
    // Main service
    ContactsService,
    // Search service
    ContactSearchService,
    // Event bus
    EventBusService,
    // Repository
    ContactRepository,
    // Logger
    AppLoggerService,
  ],
  exports: [ContactsService, ContactSearchService, ContactRepository],
})
export class ContactsModule {}

import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ClientsModule, Transport } from '@nestjs/microservices';
import { ConfigModule, ConfigService } from '@nestjs/config';

// Entities
import { Segment } from './entities/segment.entity';
import { SegmentMember } from './entities/segment-member.entity';

// Controllers
import { SegmentsController } from './controllers/segments.controller';

// Services
import { SegmentsService } from './services/segments.service';
import { SegmentRuleEngineService } from './services/segment-rule-engine';
import { SegmentRefreshJobService } from './services/segment-refresh.job';

// Repositories
import { SegmentRepository } from './repositories/segment.repository';

// Validators
import { SegmentValidatorService } from './validators/segment-validators';

@Module({
  imports: [
    TypeOrmModule.forFeature([Segment, SegmentMember]),
    ClientsModule.registerAsync([
      {
        name: 'NATS_CLIENT',
        imports: [ConfigModule],
        useFactory: (configService: ConfigService) => ({
          transport: Transport.NATS,
          options: {
            servers: [configService.get<string>('NATS_URL', 'nats://localhost:4222')],
          },
        }),
        inject: [ConfigService],
      },
    ]),
  ],
  controllers: [SegmentsController],
  providers: [
    // Core Services
    SegmentsService,
    SegmentRuleEngineService,
    SegmentRefreshJobService,
    
    // Repository
    SegmentRepository,
    
    // Validators
    SegmentValidatorService,
  ],
  exports: [
    SegmentsService,
    SegmentRepository,
    SegmentRuleEngineService,
    SegmentRefreshJobService,
  ],
})
export class SegmentsModule {}

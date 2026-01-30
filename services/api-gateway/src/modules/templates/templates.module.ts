import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ClientsModule, Transport } from '@nestjs/microservices';
import { ConfigModule, ConfigService } from '@nestjs/config';

// Entities
import { Template } from './entities/template.entity';
import { TemplateVersion } from './entities/template-version.entity';
import { TemplateUsageStats } from './entities/template-usage-stats.entity';

// Repository
import { TemplateRepository } from './repositories/template.repository';

// Services
import { TemplatesService } from './services/templates.service';
import { PipelineTemplateService } from './services/pipeline-template.service';

// Controller
import { TemplatesController } from './controllers/templates.controller';

// Mapper
import { TemplateMapper } from './mappers/template.mapper';

// Validators
import {
  TemplateValidatorFactory,
  EmailTemplateValidator,
  SmsTemplateValidator,
  WhatsAppTemplateValidator,
  PushTemplateValidator,
  RcsTemplateValidator,
} from './validators/template-validators';

// Renderer
import { TemplateRendererService } from './render/template-renderer.service';

@Module({
  imports: [
    TypeOrmModule.forFeature([Template, TemplateVersion, TemplateUsageStats]),
    ClientsModule.registerAsync([
      {
        name: 'NATS_SERVICE',
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
  controllers: [TemplatesController],
  providers: [
    TemplatesService,
    PipelineTemplateService,
    TemplateRepository,
    TemplateMapper,
    EmailTemplateValidator,
    SmsTemplateValidator,
    WhatsAppTemplateValidator,
    PushTemplateValidator,
    RcsTemplateValidator,
    TemplateValidatorFactory,
    TemplateRendererService,
  ],
  exports: [
    TemplatesService,
    PipelineTemplateService,
    TemplateRepository,
    TemplateValidatorFactory,
    TemplateRendererService,
  ],
})
export class TemplatesModule {}

import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';

// Entities
import { Workflow } from './entities/workflow.entity';
import { WorkflowRun } from './entities/workflow-run.entity';
import { WorkflowNodeRun } from './entities/workflow-node-run.entity';

// Repositories
import { WorkflowRepository } from './repositories/workflow.repository';
import { WorkflowRunRepository } from './repositories/workflow-run.repository';
import { WorkflowNodeRunRepository } from './repositories/workflow-node-run.repository';

// Validators
import { WorkflowGraphValidator } from './validators/workflow-graph.validator';
import { WorkflowConditionValidator } from './validators/workflow-condition.validator';

// Services
import { WorkflowsService } from './services/workflows.service';
import { WorkflowTriggerService } from './services/workflow-trigger.service';
import { WorkflowRunnerService } from './services/workflow-runner.service';
import { WorkflowNodeExecutorService } from './services/workflow-node-executor.service';
import { WorkflowSchedulerService } from './services/workflow-scheduler.service';

// Controllers
import { WorkflowsController } from './controllers/workflows.controller';

// Shared
import { LoggerModule } from '../../common/logger/logger.module';
import { EventBusService } from '../../common/services/event-bus.service';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      Workflow,
      WorkflowRun,
      WorkflowNodeRun,
    ]),
    LoggerModule,
  ],
  controllers: [WorkflowsController],
  providers: [
    // Repositories
    WorkflowRepository,
    WorkflowRunRepository,
    WorkflowNodeRunRepository,
    
    // Validators
    WorkflowGraphValidator,
    WorkflowConditionValidator,
    
    // Services
    WorkflowsService,
    WorkflowTriggerService,
    WorkflowRunnerService,
    WorkflowNodeExecutorService,
    WorkflowSchedulerService,
    
    // Shared
    EventBusService,
  ],
  exports: [
    WorkflowsService,
    WorkflowTriggerService,
    WorkflowRunnerService,
    WorkflowRepository,
    WorkflowRunRepository,
  ],
})
export class WorkflowsModule {}

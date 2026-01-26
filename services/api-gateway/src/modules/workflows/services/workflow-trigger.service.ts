import { Injectable } from '@nestjs/common';
import { AppLoggerService } from '../../../common/logger/app-logger.service';
import { EventBusService } from '../../../common/services/event-bus.service';
import { WorkflowRepository } from '../repositories/workflow.repository';
import { WorkflowRunRepository } from '../repositories/workflow-run.repository';
import { WorkflowConditionValidator, ConditionDefinition } from '../validators/workflow-condition.validator';
import { Workflow, TriggerConfig } from '../entities/workflow.entity';
import { WorkflowTriggerType, TriggerEventType, MessageChannel } from '../entities/workflow.enums';
import { WorkflowRun, WorkflowRunContext, WorkflowRunStatus } from '../entities/workflow-run.entity';
import { WORKFLOW_SUBJECTS, WorkflowEventFactory } from '../events/workflow.events';

export interface TriggerPayload {
  tenantId: string;
  eventType: string;
  contactId?: string;
  channel?: string;
  messageContent?: string;
  eventPayload?: Record<string, unknown>;
  correlationId?: string;
}

export interface TriggerResult {
  triggered: boolean;
  workflowId?: string;
  runId?: string;
  reason?: string;
}

@Injectable()
export class WorkflowTriggerService {
  constructor(
    private readonly workflowRepo: WorkflowRepository,
    private readonly runRepo: WorkflowRunRepository,
    private readonly conditionValidator: WorkflowConditionValidator,
    private readonly eventBus: EventBusService,
    private readonly logger: AppLoggerService,
  ) {
    this.logger.setContext('WorkflowTriggerService');
  }

  /**
   * Handle an incoming message trigger
   */
  async handleIncomingMessage(
    tenantId: string,
    contactId: string,
    channel: MessageChannel,
    messageContent: string,
    metadata?: Record<string, unknown>,
    correlationId?: string,
  ): Promise<TriggerResult[]> {
    const startTime = this.logger.logOperationStart('handleIncomingMessage', {
      tenantId,
      contactId,
      channel,
    });

    try {
      const workflows = await this.workflowRepo.findByTriggerType(
        tenantId,
        WorkflowTriggerType.INCOMING_MESSAGE,
      );

      const results: TriggerResult[] = [];

      for (const workflow of workflows) {
        const matched = this.matchIncomingMessageTrigger(
          workflow.triggerConfig,
          channel,
          messageContent,
        );

        if (matched) {
          const run = await this.createWorkflowRun(workflow, {
            tenantId,
            contactId,
            context: {
              triggerEvent: {
                type: TriggerEventType.MESSAGE_RECEIVED,
                payload: { channel, content: messageContent, ...metadata },
                timestamp: new Date().toISOString(),
              },
              message: {
                id: crypto.randomUUID(),
                channel,
                content: messageContent,
                metadata,
              },
            },
            correlationId,
          });

          results.push({
            triggered: true,
            workflowId: workflow.id,
            runId: run.id,
          });

          await this.publishTriggerMatchedEvent(workflow, run, correlationId);
        }
      }

      this.logger.logOperationEnd('handleIncomingMessage', startTime, {
        matchedWorkflows: results.length,
      });

      return results;
    } catch (error) {
      this.logger.logOperationError('handleIncomingMessage', error as Error, { tenantId, contactId });
      throw error;
    }
  }

  /**
   * Handle an event-based trigger
   */
  async handleEvent(payload: TriggerPayload): Promise<TriggerResult[]> {
    const startTime = this.logger.logOperationStart('handleEvent', {
      tenantId: payload.tenantId,
      eventType: payload.eventType,
    });

    try {
      const workflows = await this.workflowRepo.findByTriggerType(
        payload.tenantId,
        WorkflowTriggerType.EVENT_BASED,
      );

      const results: TriggerResult[] = [];

      for (const workflow of workflows) {
        const matched = this.matchEventBasedTrigger(
          workflow.triggerConfig,
          payload.eventType,
          payload.eventPayload || {},
        );

        if (matched) {
          const run = await this.createWorkflowRun(workflow, {
            tenantId: payload.tenantId,
            contactId: payload.contactId,
            context: {
              triggerEvent: {
                type: payload.eventType,
                payload: payload.eventPayload || {},
                timestamp: new Date().toISOString(),
              },
            },
            correlationId: payload.correlationId,
          });

          results.push({
            triggered: true,
            workflowId: workflow.id,
            runId: run.id,
          });

          await this.publishTriggerMatchedEvent(workflow, run, payload.correlationId);
        }
      }

      this.logger.logOperationEnd('handleEvent', startTime, {
        matchedWorkflows: results.length,
      });

      return results;
    } catch (error) {
      this.logger.logOperationError('handleEvent', error as Error, { 
        tenantId: payload.tenantId, 
        eventType: payload.eventType 
      });
      throw error;
    }
  }

  /**
   * Manually trigger a workflow for a contact
   */
  async triggerManually(
    workflowId: string,
    contactId: string,
    tenantId: string,
    context?: Record<string, unknown>,
    correlationId?: string,
  ): Promise<TriggerResult> {
    const startTime = this.logger.logOperationStart('triggerManually', {
      workflowId,
      contactId,
      tenantId,
    });

    try {
      const workflow = await this.workflowRepo.findById(workflowId, tenantId);
      
      if (!workflow) {
        return { triggered: false, reason: 'Workflow not found' };
      }

      if (!workflow.isPublished) {
        return { triggered: false, reason: 'Workflow is not published' };
      }

      // Check for duplicate active runs
      const activeRuns = await this.runRepo.findActiveRuns(workflowId, contactId, tenantId);
      if (activeRuns.length > 0) {
        return { 
          triggered: false, 
          reason: 'Contact already has an active run for this workflow',
          runId: activeRuns[0].id,
        };
      }

      const run = await this.createWorkflowRun(workflow, {
        tenantId,
        contactId,
        context: {
          triggerEvent: {
            type: 'manual',
            payload: context || {},
            timestamp: new Date().toISOString(),
          },
          variables: context,
        },
        correlationId,
      });

      await this.publishTriggerMatchedEvent(workflow, run, correlationId);

      this.logger.logOperationEnd('triggerManually', startTime, { runId: run.id });

      return {
        triggered: true,
        workflowId: workflow.id,
        runId: run.id,
      };
    } catch (error) {
      this.logger.logOperationError('triggerManually', error as Error, { workflowId, contactId });
      throw error;
    }
  }

  /**
   * Match incoming message against trigger config
   */
  private matchIncomingMessageTrigger(
    config: TriggerConfig | undefined,
    channel: string,
    content: string,
  ): boolean {
    if (!config) return true; // No config means match all

    // Check channel filter
    if (config.channels && config.channels.length > 0) {
      if (!config.channels.includes(channel)) {
        return false;
      }
    }

    // Check keyword filter
    if (config.keywords && config.keywords.length > 0) {
      const normalizedContent = content.toLowerCase();
      const matchType = config.matchType || 'any';

      if (matchType === 'exact') {
        return config.keywords.some(kw => normalizedContent === kw.toLowerCase());
      } else if (matchType === 'all') {
        return config.keywords.every(kw => normalizedContent.includes(kw.toLowerCase()));
      } else {
        // 'any' match type
        return config.keywords.some(kw => normalizedContent.includes(kw.toLowerCase()));
      }
    }

    return true;
  }

  /**
   * Match event against trigger config
   */
  private matchEventBasedTrigger(
    config: TriggerConfig | undefined,
    eventType: string,
    eventPayload: Record<string, unknown>,
  ): boolean {
    if (!config) return false;

    // Check event type filter
    if (config.eventTypes && config.eventTypes.length > 0) {
      if (!config.eventTypes.includes(eventType)) {
        return false;
      }
    }

    // Check conditions
    if (config.conditions && config.conditions.length > 0) {
      const context: WorkflowRunContext = {
        triggerEvent: {
          type: eventType,
          payload: eventPayload,
          timestamp: new Date().toISOString(),
        },
      };

      const conditions = config.conditions.map(c => ({
        field: `triggerEvent.payload.${c.field}`,
        operator: c.operator,
        value: c.value,
      })) as ConditionDefinition[];

      const result = this.conditionValidator.evaluateConditions(conditions, context, 'all');
      return result.matched;
    }

    return true;
  }

  /**
   * Create a new workflow run
   */
  private async createWorkflowRun(
    workflow: Workflow,
    data: {
      tenantId: string;
      contactId?: string;
      context: WorkflowRunContext;
      correlationId?: string;
    },
  ): Promise<WorkflowRun> {
    // Find the START node
    const startNode = workflow.graph.nodes.find(n => n.type === 'start');

    const run = await this.runRepo.create({
      tenantId: data.tenantId,
      workflowId: workflow.id,
      contactId: data.contactId,
      status: WorkflowRunStatus.PENDING,
      currentNodeId: startNode?.id,
      context: data.context,
      correlationId: data.correlationId,
    });

    // Increment workflow stats
    await this.workflowRepo.incrementStats(workflow.id, 'totalRuns');

    return run;
  }

  /**
   * Publish trigger matched event
   */
  private async publishTriggerMatchedEvent(
    workflow: Workflow,
    run: WorkflowRun,
    correlationId?: string,
  ): Promise<void> {
    try {
      const event = WorkflowEventFactory.createTriggerMatchedEvent({
        tenantId: workflow.tenantId,
        workflowId: workflow.id,
        triggerType: workflow.triggerType,
        triggerPayload: run.context?.triggerEvent?.payload || {},
        contactId: run.contactId,
        correlationId,
      });

      await this.eventBus.publish(WORKFLOW_SUBJECTS.WORKFLOW_TRIGGER_MATCHED, event as any, {
        correlationId,
      });

      this.logger.logEventPublish(WORKFLOW_SUBJECTS.WORKFLOW_TRIGGER_MATCHED, correlationId || 'unknown');
    } catch (error) {
      this.logger.warn('Failed to publish trigger matched event', {
        error: (error as Error).message,
      });
    }
  }
}

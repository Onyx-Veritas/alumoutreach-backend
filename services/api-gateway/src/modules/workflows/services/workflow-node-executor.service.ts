import { Injectable } from '@nestjs/common';
import { AppLoggerService } from '../../../common/logger/app-logger.service';
import { EventBusService } from '../../../common/services/event-bus.service';
import { WorkflowRun, WorkflowRunContext } from '../entities/workflow-run.entity';
import { WorkflowNode, WorkflowGraph, WorkflowEdge } from '../entities/workflow.entity';
import { WorkflowNodeType, DelayUnit, ConditionOperator } from '../entities/workflow.enums';
import { NodeRunResult } from '../entities/workflow-node-run.entity';
import { WorkflowConditionValidator, ConditionDefinition } from '../validators/workflow-condition.validator';
import { WORKFLOW_SUBJECTS, WorkflowEventFactory } from '../events/workflow.events';

@Injectable()
export class WorkflowNodeExecutorService {
  constructor(
    private readonly conditionValidator: WorkflowConditionValidator,
    private readonly eventBus: EventBusService,
    private readonly logger: AppLoggerService,
  ) {
    this.logger.setContext('WorkflowNodeExecutorService');
  }

  /**
   * Execute a workflow node
   */
  async execute(
    nodeType: WorkflowNodeType,
    node: WorkflowNode,
    run: WorkflowRun,
    graph: WorkflowGraph,
  ): Promise<NodeRunResult> {
    this.logger.debug('Executing node', { nodeId: node.id, nodeType, runId: run.id });

    switch (nodeType) {
      case WorkflowNodeType.START:
        return this.executeStartNode(node, graph);
      
      case WorkflowNodeType.SEND_MESSAGE:
        return this.executeSendMessageNode(node, run);
      
      case WorkflowNodeType.CONDITION:
        return this.executeConditionNode(node, run, graph);
      
      case WorkflowNodeType.DELAY:
        return this.executeDelayNode(node);
      
      case WorkflowNodeType.UPDATE_ATTRIBUTE:
        return this.executeUpdateAttributeNode(node, run);
      
      case WorkflowNodeType.ASSIGN_AGENT:
        return this.executeAssignAgentNode(node, run);
      
      case WorkflowNodeType.END:
        return this.executeEndNode();
      
      default:
        return {
          success: false,
          error: `Unknown node type: ${nodeType}`,
        };
    }
  }

  /**
   * Execute START node
   */
  private async executeStartNode(node: WorkflowNode, graph: WorkflowGraph): Promise<NodeRunResult> {
    // Find the first connected node
    const edge = graph.edges.find(e => e.source === node.id);
    
    return {
      success: true,
      output: { started: true },
      nextNodeId: edge?.target,
    };
  }

  /**
   * Execute SEND_MESSAGE node
   */
  private async executeSendMessageNode(node: WorkflowNode, run: WorkflowRun): Promise<NodeRunResult> {
    const data = node.data as {
      channel: string;
      templateId: string;
      variables?: Record<string, string>;
    };

    if (!data.channel || !data.templateId) {
      return {
        success: false,
        error: 'SendMessage node missing required channel or templateId',
      };
    }

    if (!run.contactId) {
      return {
        success: false,
        error: 'No contact ID available for sending message',
      };
    }

    try {
      // Emit send message event for async processing
      const event = WorkflowEventFactory.createSendMessageEvent({
        tenantId: run.tenantId,
        workflowId: run.workflowId,
        runId: run.id,
        contactId: run.contactId,
        channel: data.channel,
        templateId: data.templateId,
        variables: data.variables,
        correlationId: run.correlationId,
      });

      await this.eventBus.publish(WORKFLOW_SUBJECTS.WORKFLOW_SEND_MESSAGE, event as any, {
        correlationId: run.correlationId,
      });

      this.logger.info('SendMessage event published', {
        runId: run.id,
        channel: data.channel,
        templateId: data.templateId,
      });

      return {
        success: true,
        output: {
          channel: data.channel,
          templateId: data.templateId,
          contactId: run.contactId,
          status: 'queued',
        },
      };
    } catch (error) {
      return {
        success: false,
        error: `Failed to send message: ${(error as Error).message}`,
      };
    }
  }

  /**
   * Execute CONDITION node
   */
  private async executeConditionNode(
    node: WorkflowNode,
    run: WorkflowRun,
    graph: WorkflowGraph,
  ): Promise<NodeRunResult> {
    const data = node.data as {
      conditions: Array<{
        field: string;
        operator: ConditionOperator;
        value?: unknown;
        nextNodeId: string;
      }>;
      defaultNextNodeId?: string;
      matchType?: 'any' | 'all';
    };

    if (!data.conditions || data.conditions.length === 0) {
      return {
        success: false,
        error: 'Condition node has no conditions defined',
      };
    }

    const context = run.context || {};

    // Evaluate each condition
    for (const condition of data.conditions) {
      const conditionDef: ConditionDefinition = {
        field: condition.field,
        operator: condition.operator,
        value: condition.value,
      };

      const result = this.conditionValidator.evaluateCondition(conditionDef, context);
      
      if (result.matched) {
        this.logger.debug('Condition matched', {
          field: condition.field,
          operator: condition.operator,
          nextNodeId: condition.nextNodeId,
        });

        return {
          success: true,
          output: {
            matchedCondition: condition,
            evaluatedValue: result.evaluatedValue,
          },
          nextNodeId: condition.nextNodeId,
        };
      }
    }

    // No condition matched, use default
    if (data.defaultNextNodeId) {
      return {
        success: true,
        output: { matchedCondition: null, usedDefault: true },
        nextNodeId: data.defaultNextNodeId,
      };
    }

    // Find default edge (edge without specific handle)
    const defaultEdge = graph.edges.find(e => e.source === node.id && !e.sourceHandle);
    
    return {
      success: true,
      output: { matchedCondition: null, usedDefault: true },
      nextNodeId: defaultEdge?.target,
    };
  }

  /**
   * Execute DELAY node
   */
  private async executeDelayNode(node: WorkflowNode): Promise<NodeRunResult> {
    const data = node.data as {
      duration: number;
      unit: DelayUnit;
    };

    if (!data.duration || !data.unit) {
      return {
        success: false,
        error: 'Delay node missing duration or unit',
      };
    }

    // Calculate wait time
    let waitMs: number;
    switch (data.unit) {
      case DelayUnit.MINUTES:
        waitMs = data.duration * 60 * 1000;
        break;
      case DelayUnit.HOURS:
        waitMs = data.duration * 60 * 60 * 1000;
        break;
      case DelayUnit.DAYS:
        waitMs = data.duration * 24 * 60 * 60 * 1000;
        break;
      default:
        return {
          success: false,
          error: `Invalid delay unit: ${data.unit}`,
        };
    }

    const waitUntil = new Date(Date.now() + waitMs);

    this.logger.info('Delay node scheduling wait', {
      duration: data.duration,
      unit: data.unit,
      waitUntil: waitUntil.toISOString(),
    });

    return {
      success: true,
      output: {
        duration: data.duration,
        unit: data.unit,
        waitUntil: waitUntil.toISOString(),
      },
      metadata: {
        waitUntil: waitUntil.toISOString(),
      },
    };
  }

  /**
   * Execute UPDATE_ATTRIBUTE node
   */
  private async executeUpdateAttributeNode(node: WorkflowNode, run: WorkflowRun): Promise<NodeRunResult> {
    const data = node.data as {
      attributeName: string;
      attributeValue: unknown;
      operation?: 'set' | 'append' | 'remove' | 'increment';
    };

    if (!data.attributeName) {
      return {
        success: false,
        error: 'UpdateAttribute node missing attributeName',
      };
    }

    if (!run.contactId) {
      return {
        success: false,
        error: 'No contact ID available for updating attribute',
      };
    }

    // TODO: Integrate with ContactsService to actually update the attribute
    // For now, we'll log the intent and return success

    this.logger.info('UpdateAttribute node executed', {
      contactId: run.contactId,
      attributeName: data.attributeName,
      operation: data.operation || 'set',
    });

    return {
      success: true,
      output: {
        contactId: run.contactId,
        attributeName: data.attributeName,
        attributeValue: data.attributeValue,
        operation: data.operation || 'set',
        status: 'pending',
      },
    };
  }

  /**
   * Execute ASSIGN_AGENT node
   */
  private async executeAssignAgentNode(node: WorkflowNode, run: WorkflowRun): Promise<NodeRunResult> {
    const data = node.data as {
      agentId?: string;
      teamId?: string;
      assignmentStrategy?: 'round_robin' | 'least_busy' | 'random';
    };

    if (!run.contactId) {
      return {
        success: false,
        error: 'No contact ID available for agent assignment',
      };
    }

    try {
      // Emit assign agent event for async processing
      const event = WorkflowEventFactory.createAssignAgentEvent({
        tenantId: run.tenantId,
        workflowId: run.workflowId,
        runId: run.id,
        contactId: run.contactId,
        agentId: data.agentId,
        teamId: data.teamId,
        assignmentStrategy: data.assignmentStrategy,
        correlationId: run.correlationId,
      });

      await this.eventBus.publish(WORKFLOW_SUBJECTS.WORKFLOW_ASSIGN_AGENT, event as any, {
        correlationId: run.correlationId,
      });

      this.logger.info('AssignAgent event published', {
        runId: run.id,
        contactId: run.contactId,
        agentId: data.agentId,
        teamId: data.teamId,
      });

      return {
        success: true,
        output: {
          contactId: run.contactId,
          agentId: data.agentId,
          teamId: data.teamId,
          assignmentStrategy: data.assignmentStrategy,
          status: 'queued',
        },
      };
    } catch (error) {
      return {
        success: false,
        error: `Failed to assign agent: ${(error as Error).message}`,
      };
    }
  }

  /**
   * Execute END node
   */
  private async executeEndNode(): Promise<NodeRunResult> {
    return {
      success: true,
      output: { ended: true },
    };
  }
}

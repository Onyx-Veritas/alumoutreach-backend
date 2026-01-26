import { Injectable } from '@nestjs/common';
import { AppLoggerService } from '../../../common/logger/app-logger.service';
import { EventBusService } from '../../../common/services/event-bus.service';
import { WorkflowRepository } from '../repositories/workflow.repository';
import { WorkflowRunRepository } from '../repositories/workflow-run.repository';
import { WorkflowNodeRunRepository } from '../repositories/workflow-node-run.repository';
import { WorkflowRun, WorkflowRunStatus, WorkflowRunContext } from '../entities/workflow-run.entity';
import { WorkflowNode, WorkflowEdge, WorkflowGraph } from '../entities/workflow.entity';
import { WorkflowNodeType } from '../entities/workflow.enums';
import { NodeRunResult } from '../entities/workflow-node-run.entity';
import { WORKFLOW_SUBJECTS, WorkflowEventFactory } from '../events/workflow.events';
import { WorkflowNodeExecutorService } from './workflow-node-executor.service';

export interface RunResult {
  runId: string;
  status: WorkflowRunStatus;
  completedNodes: number;
  failedNodes: number;
  error?: string;
}

@Injectable()
export class WorkflowRunnerService {
  constructor(
    private readonly workflowRepo: WorkflowRepository,
    private readonly runRepo: WorkflowRunRepository,
    private readonly nodeRunRepo: WorkflowNodeRunRepository,
    private readonly nodeExecutor: WorkflowNodeExecutorService,
    private readonly eventBus: EventBusService,
    private readonly logger: AppLoggerService,
  ) {
    this.logger.setContext('WorkflowRunnerService');
  }

  /**
   * Execute a workflow run
   */
  async executeRun(runId: string, tenantId: string): Promise<RunResult> {
    const startTime = this.logger.logOperationStart('executeRun', { runId, tenantId });

    try {
      const run = await this.runRepo.findById(runId, tenantId);
      if (!run) {
        throw new Error(`Run not found: ${runId}`);
      }

      // Get workflow
      const workflow = await this.workflowRepo.findById(run.workflowId, tenantId);
      if (!workflow) {
        throw new Error(`Workflow not found: ${run.workflowId}`);
      }

      // Update run status to RUNNING
      await this.runRepo.updateStatus(runId, tenantId, WorkflowRunStatus.RUNNING, {
        startedAt: run.startedAt || new Date(),
      });

      // Publish run started event
      await this.publishRunStartedEvent(run, workflow.name);

      // Execute nodes
      const result = await this.executeGraph(run, workflow.graph);

      this.logger.logOperationEnd('executeRun', startTime, {
        runId,
        status: result.status,
      });

      return result;
    } catch (error) {
      this.logger.logOperationError('executeRun', error as Error, { runId, tenantId });
      
      await this.runRepo.markFailed(runId, tenantId, (error as Error).message);
      
      return {
        runId,
        status: WorkflowRunStatus.FAILED,
        completedNodes: 0,
        failedNodes: 1,
        error: (error as Error).message,
      };
    }
  }

  /**
   * Resume a waiting workflow run
   */
  async resumeRun(runId: string, tenantId: string): Promise<RunResult> {
    const startTime = this.logger.logOperationStart('resumeRun', { runId, tenantId });

    try {
      const run = await this.runRepo.findById(runId, tenantId);
      if (!run) {
        throw new Error(`Run not found: ${runId}`);
      }

      if (run.status !== WorkflowRunStatus.WAITING) {
        throw new Error(`Run is not in WAITING status: ${run.status}`);
      }

      const workflow = await this.workflowRepo.findById(run.workflowId, tenantId);
      if (!workflow) {
        throw new Error(`Workflow not found: ${run.workflowId}`);
      }

      // Update status to RUNNING
      await this.runRepo.updateStatus(runId, tenantId, WorkflowRunStatus.RUNNING);

      // Continue from current node
      const result = await this.executeGraph(run, workflow.graph, run.currentNodeId);

      this.logger.logOperationEnd('resumeRun', startTime, {
        runId,
        status: result.status,
      });

      return result;
    } catch (error) {
      this.logger.logOperationError('resumeRun', error as Error, { runId, tenantId });
      
      await this.runRepo.markFailed(runId, tenantId, (error as Error).message);
      
      return {
        runId,
        status: WorkflowRunStatus.FAILED,
        completedNodes: 0,
        failedNodes: 1,
        error: (error as Error).message,
      };
    }
  }

  /**
   * Execute the workflow graph
   */
  private async executeGraph(
    run: WorkflowRun,
    graph: WorkflowGraph,
    startNodeId?: string,
  ): Promise<RunResult> {
    let completedNodes = 0;
    let failedNodes = 0;
    let currentNodeId = startNodeId || this.findStartNodeId(graph);

    if (!currentNodeId) {
      throw new Error('No start node found in workflow graph');
    }

    // Build adjacency map for finding next nodes
    const adjacencyMap = this.buildAdjacencyMap(graph);

    while (currentNodeId) {
      const node = graph.nodes.find(n => n.id === currentNodeId);
      if (!node) {
        throw new Error(`Node not found: ${currentNodeId}`);
      }

      // Skip START node - just move to next
      if (node.type === WorkflowNodeType.START) {
        currentNodeId = this.getNextNodeId(currentNodeId, adjacencyMap);
        continue;
      }

      // Execute the node
      const nodeType = node.type as WorkflowNodeType;
      const nodeStartTime = Date.now();

      const nodeRun = await this.nodeRunRepo.startExecution(
        run.id,
        node.id,
        nodeType,
        run.tenantId,
        node.data,
      );

      try {
        const result = await this.nodeExecutor.execute(
          nodeType,
          node,
          run,
          graph,
        );

        const durationMs = Date.now() - nodeStartTime;
        await this.nodeRunRepo.completeExecution(nodeRun.id, run.tenantId, result, durationMs);

        // Update run context with node result
        await this.updateRunContext(run, node.id, result);

        // Publish node completed event
        await this.publishNodeCompletedEvent(run, node, result, durationMs);

        if (result.success) {
          completedNodes++;

          // Check if we need to wait (delay node)
          if (nodeType === WorkflowNodeType.DELAY && result.metadata?.waitUntil) {
            await this.runRepo.setWaiting(
              run.id,
              run.tenantId,
              new Date(result.metadata.waitUntil as string),
              result.nextNodeId || this.getNextNodeId(currentNodeId, adjacencyMap),
            );

            return {
              runId: run.id,
              status: WorkflowRunStatus.WAITING,
              completedNodes,
              failedNodes,
            };
          }

          // Get next node
          if (result.nextNodeId) {
            currentNodeId = result.nextNodeId;
          } else if (nodeType === WorkflowNodeType.END) {
            // Workflow completed
            await this.runRepo.markCompleted(run.id, run.tenantId);
            await this.workflowRepo.incrementStats(run.workflowId, 'successfulRuns');

            // Publish run completed event
            await this.publishRunCompletedEvent(run);

            return {
              runId: run.id,
              status: WorkflowRunStatus.COMPLETED,
              completedNodes,
              failedNodes,
            };
          } else {
            currentNodeId = this.getNextNodeId(currentNodeId, adjacencyMap);
          }
        } else {
          failedNodes++;
          
          // Node failed - stop execution
          await this.runRepo.markFailed(run.id, run.tenantId, result.error || 'Node execution failed');
          await this.workflowRepo.incrementStats(run.workflowId, 'failedRuns');

          // Publish run failed event
          await this.publishRunFailedEvent(run, result.error || 'Node execution failed');

          return {
            runId: run.id,
            status: WorkflowRunStatus.FAILED,
            completedNodes,
            failedNodes,
            error: result.error,
          };
        }
      } catch (error) {
        failedNodes++;
        const durationMs = Date.now() - nodeStartTime;
        
        await this.nodeRunRepo.completeExecution(
          nodeRun.id,
          run.tenantId,
          { success: false, error: (error as Error).message },
          durationMs,
        );

        await this.runRepo.markFailed(run.id, run.tenantId, (error as Error).message);
        await this.workflowRepo.incrementStats(run.workflowId, 'failedRuns');

        await this.publishNodeFailedEvent(run, node, (error as Error).message, durationMs);
        await this.publishRunFailedEvent(run, (error as Error).message);

        return {
          runId: run.id,
          status: WorkflowRunStatus.FAILED,
          completedNodes,
          failedNodes,
          error: (error as Error).message,
        };
      }
    }

    // No more nodes to execute
    await this.runRepo.markCompleted(run.id, run.tenantId);
    await this.workflowRepo.incrementStats(run.workflowId, 'successfulRuns');

    return {
      runId: run.id,
      status: WorkflowRunStatus.COMPLETED,
      completedNodes,
      failedNodes,
    };
  }

  private findStartNodeId(graph: WorkflowGraph): string | undefined {
    const startNode = graph.nodes.find(n => n.type === WorkflowNodeType.START);
    return startNode?.id;
  }

  private buildAdjacencyMap(graph: WorkflowGraph): Map<string, string[]> {
    const map = new Map<string, string[]>();
    
    for (const edge of graph.edges) {
      const targets = map.get(edge.source) || [];
      targets.push(edge.target);
      map.set(edge.source, targets);
    }

    return map;
  }

  private getNextNodeId(currentNodeId: string, adjacencyMap: Map<string, string[]>): string | undefined {
    const targets = adjacencyMap.get(currentNodeId);
    return targets?.[0]; // Return first target (for non-branching nodes)
  }

  private async updateRunContext(run: WorkflowRun, nodeId: string, result: NodeRunResult): Promise<void> {
    const context = run.context || {};
    context.lastNodeId = nodeId;
    context.lastNodeResult = result.output;

    await this.runRepo.update(run.id, run.tenantId, { context });
  }

  // Event publishing methods
  private async publishRunStartedEvent(run: WorkflowRun, workflowName: string): Promise<void> {
    try {
      const event = WorkflowEventFactory.createRunEvent({
        tenantId: run.tenantId,
        workflowId: run.workflowId,
        workflowName,
        runId: run.id,
        contactId: run.contactId,
        status: WorkflowRunStatus.RUNNING,
        correlationId: run.correlationId,
      });

      await this.eventBus.publish(WORKFLOW_SUBJECTS.WORKFLOW_RUN_STARTED, event as any, {
        correlationId: run.correlationId,
      });
    } catch (error) {
      this.logger.warn('Failed to publish run started event', { error: (error as Error).message });
    }
  }

  private async publishRunCompletedEvent(run: WorkflowRun): Promise<void> {
    try {
      const workflow = await this.workflowRepo.findById(run.workflowId, run.tenantId);
      const event = WorkflowEventFactory.createRunEvent({
        tenantId: run.tenantId,
        workflowId: run.workflowId,
        workflowName: workflow?.name || 'Unknown',
        runId: run.id,
        contactId: run.contactId,
        status: WorkflowRunStatus.COMPLETED,
        correlationId: run.correlationId,
      });

      await this.eventBus.publish(WORKFLOW_SUBJECTS.WORKFLOW_RUN_COMPLETED, event as any, {
        correlationId: run.correlationId,
      });
    } catch (error) {
      this.logger.warn('Failed to publish run completed event', { error: (error as Error).message });
    }
  }

  private async publishRunFailedEvent(run: WorkflowRun, errorMessage: string): Promise<void> {
    try {
      const workflow = await this.workflowRepo.findById(run.workflowId, run.tenantId);
      const event = WorkflowEventFactory.createRunEvent({
        tenantId: run.tenantId,
        workflowId: run.workflowId,
        workflowName: workflow?.name || 'Unknown',
        runId: run.id,
        contactId: run.contactId,
        status: WorkflowRunStatus.FAILED,
        errorMessage,
        correlationId: run.correlationId,
      });

      await this.eventBus.publish(WORKFLOW_SUBJECTS.WORKFLOW_RUN_FAILED, event as any, {
        correlationId: run.correlationId,
      });
    } catch (error) {
      this.logger.warn('Failed to publish run failed event', { error: (error as Error).message });
    }
  }

  private async publishNodeCompletedEvent(
    run: WorkflowRun,
    node: WorkflowNode,
    result: NodeRunResult,
    durationMs: number,
  ): Promise<void> {
    try {
      const event = WorkflowEventFactory.createNodeEvent({
        tenantId: run.tenantId,
        workflowId: run.workflowId,
        runId: run.id,
        nodeId: node.id,
        nodeType: node.type,
        status: 'completed',
        output: result.output as Record<string, unknown>,
        durationMs,
        correlationId: run.correlationId,
      });

      await this.eventBus.publish(WORKFLOW_SUBJECTS.WORKFLOW_NODE_COMPLETED, event as any, {
        correlationId: run.correlationId,
      });
    } catch (error) {
      this.logger.warn('Failed to publish node completed event', { error: (error as Error).message });
    }
  }

  private async publishNodeFailedEvent(
    run: WorkflowRun,
    node: WorkflowNode,
    errorMessage: string,
    durationMs: number,
  ): Promise<void> {
    try {
      const event = WorkflowEventFactory.createNodeEvent({
        tenantId: run.tenantId,
        workflowId: run.workflowId,
        runId: run.id,
        nodeId: node.id,
        nodeType: node.type,
        status: 'failed',
        errorMessage,
        durationMs,
        correlationId: run.correlationId,
      });

      await this.eventBus.publish(WORKFLOW_SUBJECTS.WORKFLOW_NODE_FAILED, event as any, {
        correlationId: run.correlationId,
      });
    } catch (error) {
      this.logger.warn('Failed to publish node failed event', { error: (error as Error).message });
    }
  }
}

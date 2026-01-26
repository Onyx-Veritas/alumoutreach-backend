import { Workflow } from '../entities/workflow.entity';
import { WorkflowRun } from '../entities/workflow-run.entity';
import { WorkflowNodeRun } from '../entities/workflow-node-run.entity';
import {
  WorkflowResponseDto,
  WorkflowSummaryResponseDto,
  WorkflowRunResponseDto,
  WorkflowRunDetailResponseDto,
  WorkflowNodeRunResponseDto,
  TriggerConfigDto,
  WorkflowGraphDto,
} from '../dto/workflow.dto';

export class WorkflowMapper {
  static toSummaryResponse(workflow: Workflow): WorkflowSummaryResponseDto {
    return {
      id: workflow.id,
      name: workflow.name,
      description: workflow.description,
      triggerType: workflow.triggerType,
      isPublished: workflow.isPublished,
      publishedAt: workflow.publishedAt,
      totalRuns: workflow.totalRuns,
      successfulRuns: workflow.successfulRuns,
      failedRuns: workflow.failedRuns,
      createdAt: workflow.createdAt,
      updatedAt: workflow.updatedAt,
    };
  }

  static toResponse(workflow: Workflow): WorkflowResponseDto {
    return {
      ...this.toSummaryResponse(workflow),
      triggerConfig: workflow.triggerConfig as unknown as TriggerConfigDto,
      graph: workflow.graph as unknown as WorkflowGraphDto,
      createdBy: workflow.createdBy,
      publishedBy: workflow.publishedBy,
    };
  }

  static toRunResponse(run: WorkflowRun): WorkflowRunResponseDto {
    return {
      id: run.id,
      workflowId: run.workflowId,
      contactId: run.contactId,
      status: run.status,
      currentNodeId: run.currentNodeId,
      context: run.context as unknown as Record<string, unknown>,
      startedAt: run.startedAt,
      completedAt: run.completedAt,
      errorMessage: run.errorMessage,
      createdAt: run.createdAt,
      updatedAt: run.updatedAt,
    };
  }

  static toNodeRunResponse(nodeRun: WorkflowNodeRun): WorkflowNodeRunResponseDto {
    return {
      id: nodeRun.id,
      nodeId: nodeRun.nodeId,
      nodeType: nodeRun.nodeType,
      status: nodeRun.status,
      input: nodeRun.input,
      result: nodeRun.result as unknown as Record<string, unknown>,
      errorMessage: nodeRun.errorMessage,
      durationMs: nodeRun.durationMs,
      executedAt: nodeRun.executedAt,
      createdAt: nodeRun.createdAt,
    };
  }

  static toRunDetailResponse(run: WorkflowRun): WorkflowRunDetailResponseDto {
    return {
      ...this.toRunResponse(run),
      nodeRuns: (run.nodeRuns || []).map(nr => this.toNodeRunResponse(nr)),
    };
  }
}

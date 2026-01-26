// ============ NATS Subjects ============

export const WORKFLOW_SUBJECTS = {
  // Lifecycle events
  WORKFLOW_CREATED: 'workflow.created',
  WORKFLOW_UPDATED: 'workflow.updated',
  WORKFLOW_DELETED: 'workflow.deleted',
  WORKFLOW_PUBLISHED: 'workflow.published',
  WORKFLOW_UNPUBLISHED: 'workflow.unpublished',
  
  // Run events
  WORKFLOW_RUN_STARTED: 'workflow.run.started',
  WORKFLOW_RUN_COMPLETED: 'workflow.run.completed',
  WORKFLOW_RUN_FAILED: 'workflow.run.failed',
  WORKFLOW_RUN_WAITING: 'workflow.run.waiting',
  WORKFLOW_RUN_CANCELLED: 'workflow.run.cancelled',
  
  // Node events
  WORKFLOW_NODE_STARTED: 'workflow.node.started',
  WORKFLOW_NODE_COMPLETED: 'workflow.node.completed',
  WORKFLOW_NODE_FAILED: 'workflow.node.failed',
  
  // Trigger events
  WORKFLOW_TRIGGER_MATCHED: 'workflow.trigger.matched',
  
  // Action events (for integrations)
  WORKFLOW_ASSIGN_AGENT: 'workflow.assign_agent',
  WORKFLOW_SEND_MESSAGE: 'workflow.send_message',
} as const;

// ============ Event Interfaces ============

export interface BaseWorkflowEvent {
  eventId: string;
  timestamp: string;
  tenantId: string;
  correlationId?: string;
  [key: string]: unknown;
}

export interface WorkflowLifecycleEvent extends BaseWorkflowEvent {
  workflowId: string;
  workflowName: string;
  triggerType: string;
  userId?: string;
}

export interface WorkflowRunEvent extends BaseWorkflowEvent {
  workflowId: string;
  workflowName: string;
  runId: string;
  contactId?: string;
  status: string;
  errorMessage?: string;
  duration?: number;
}

export interface WorkflowNodeEvent extends BaseWorkflowEvent {
  workflowId: string;
  runId: string;
  nodeId: string;
  nodeType: string;
  status: string;
  input?: Record<string, unknown>;
  output?: Record<string, unknown>;
  errorMessage?: string;
  durationMs?: number;
}

export interface WorkflowTriggerMatchedEvent extends BaseWorkflowEvent {
  workflowId: string;
  triggerType: string;
  triggerPayload: Record<string, unknown>;
  contactId?: string;
}

export interface WorkflowAssignAgentEvent extends BaseWorkflowEvent {
  workflowId: string;
  runId: string;
  contactId: string;
  agentId?: string;
  teamId?: string;
  assignmentStrategy?: string;
}

export interface WorkflowSendMessageEvent extends BaseWorkflowEvent {
  workflowId: string;
  runId: string;
  contactId: string;
  channel: string;
  templateId: string;
  variables?: Record<string, string>;
}

// ============ Event Factory ============

export class WorkflowEventFactory {
  static createLifecycleEvent(
    data: Omit<WorkflowLifecycleEvent, 'eventId' | 'timestamp'>,
  ): WorkflowLifecycleEvent {
    return {
      eventId: crypto.randomUUID(),
      timestamp: new Date().toISOString(),
      ...data,
    } as WorkflowLifecycleEvent;
  }

  static createRunEvent(
    data: Omit<WorkflowRunEvent, 'eventId' | 'timestamp'>,
  ): WorkflowRunEvent {
    return {
      eventId: crypto.randomUUID(),
      timestamp: new Date().toISOString(),
      ...data,
    } as WorkflowRunEvent;
  }

  static createNodeEvent(
    data: Omit<WorkflowNodeEvent, 'eventId' | 'timestamp'>,
  ): WorkflowNodeEvent {
    return {
      eventId: crypto.randomUUID(),
      timestamp: new Date().toISOString(),
      ...data,
    } as WorkflowNodeEvent;
  }

  static createTriggerMatchedEvent(
    data: Omit<WorkflowTriggerMatchedEvent, 'eventId' | 'timestamp'>,
  ): WorkflowTriggerMatchedEvent {
    return {
      eventId: crypto.randomUUID(),
      timestamp: new Date().toISOString(),
      ...data,
    } as WorkflowTriggerMatchedEvent;
  }

  static createAssignAgentEvent(
    data: Omit<WorkflowAssignAgentEvent, 'eventId' | 'timestamp'>,
  ): WorkflowAssignAgentEvent {
    return {
      eventId: crypto.randomUUID(),
      timestamp: new Date().toISOString(),
      ...data,
    } as WorkflowAssignAgentEvent;
  }

  static createSendMessageEvent(
    data: Omit<WorkflowSendMessageEvent, 'eventId' | 'timestamp'>,
  ): WorkflowSendMessageEvent {
    return {
      eventId: crypto.randomUUID(),
      timestamp: new Date().toISOString(),
      ...data,
    } as WorkflowSendMessageEvent;
  }
}

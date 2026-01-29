import { Injectable, Logger } from '@nestjs/common';
import { v4 as uuidv4 } from 'uuid';
import { ContactGenerator } from '../generators/contact.generator';
import { ContactsService } from '../../modules/contacts/contacts.service';
import { WorkflowsService } from '../../modules/workflows/services/workflows.service';
import { WorkflowTriggerType, WorkflowNodeType } from '../../modules/workflows/entities/workflow.enums';
import { SYSTEM_USER_ID } from '../../common/constants/system';

export interface WorkflowTriggerResult {
  scenario: string;
  success: boolean;
  duration: number;
  summary: {
    contactsCreated: number;
    workflowId: string;
    workflowName: string;
    triggerType: string;
    description: string;
  };
  errors?: string[];
}

@Injectable()
export class WorkflowTriggerScenario {
  private readonly logger = new Logger(WorkflowTriggerScenario.name);

  constructor(
    private readonly contactGenerator: ContactGenerator,
    private readonly contactsService: ContactsService,
    private readonly workflowsService: WorkflowsService,
  ) {}

  /**
   * Run the workflow trigger scenario:
   * 1. Create a workflow with a trigger condition
   * 2. Create contacts that would match the trigger
   * 
   * Note: Workflow activation happens via events when contacts are created.
   */
  async run(tenantId: string, options: {
    contactCount?: number;
    triggerType?: 'contact_created' | 'tag_added' | 'segment_joined';
    correlationId?: string;
  } = {}): Promise<WorkflowTriggerResult> {
    const startTime = Date.now();
    const correlationId = options.correlationId || `scenario-${Date.now()}`;
    const contactCount = options.contactCount || 10;
    const triggerType = options.triggerType || 'contact_created';
    const errors: string[] = [];

    this.logger.log(`Starting workflow-trigger scenario`, { tenantId, contactCount, triggerType, correlationId });

    let contactsCreated = 0;
    let workflowId = '';
    let workflowName = '';

    try {
      // Step 1: Create a workflow
      this.logger.debug('Step 1: Creating workflow...');
      const workflow = await this.createWorkflow(tenantId, triggerType, correlationId);
      workflowId = workflow.id;
      workflowName = workflow.name;

      this.logger.debug(`Created workflow: ${workflowId}`);

      // Step 2: Create contacts that should trigger the workflow
      this.logger.debug('Step 2: Creating contacts to trigger workflow...');
      const generatedContacts = this.contactGenerator.generate({
        count: contactCount,
        tenantId,
        withAcademic: true,
      });

      for (const contactData of generatedContacts) {
        try {
          await this.contactsService.create(
            tenantId,
            contactData as any,
            SYSTEM_USER_ID,
            correlationId,
          );
          contactsCreated++;
        } catch (error) {
          errors.push(`Failed to create contact ${contactData.email}: ${(error as Error).message}`);
        }
      }

      this.logger.debug(`Created ${contactsCreated} contacts for workflow trigger testing`);

    } catch (error) {
      this.logger.error('Scenario failed', error);
      errors.push(`Scenario error: ${(error as Error).message}`);
    }

    const duration = Date.now() - startTime;

    return {
      scenario: 'workflow-trigger',
      success: errors.length === 0,
      duration,
      summary: {
        contactsCreated,
        workflowId,
        workflowName,
        triggerType,
        description: `Created workflow "${workflowName}" and ${contactsCreated} contacts. Workflow will trigger on ${triggerType} events.`,
      },
      errors: errors.length > 0 ? errors : undefined,
    };
  }

  /**
   * Create a workflow with the specified trigger type
   */
  private async createWorkflow(
    tenantId: string,
    triggerType: string,
    correlationId: string,
  ): Promise<{ id: string; name: string }> {
    const workflowName = `Dev Test Workflow - ${triggerType} - ${Date.now()}`;
    
    // Map trigger type to enum
    const triggerTypeEnum = this.mapTriggerType(triggerType);
    
    const workflow = await this.workflowsService.create(
      tenantId,
      {
        name: workflowName,
        description: `Auto-generated workflow for ${triggerType} trigger testing`,
        triggerType: triggerTypeEnum,
        triggerConfig: this.buildTriggerConfig(triggerType),
        graph: {
          nodes: this.buildWorkflowNodes(triggerType),
          edges: this.buildWorkflowEdges(),
        },
      },
      SYSTEM_USER_ID,
      correlationId,
    );

    return { id: workflow.id, name: workflow.name };
  }

  /**
   * Map string trigger type to enum
   */
  private mapTriggerType(triggerType: string): WorkflowTriggerType {
    switch (triggerType) {
      case 'contact_created':
        return WorkflowTriggerType.EVENT_BASED;
      case 'tag_added':
        return WorkflowTriggerType.EVENT_BASED;
      case 'segment_joined':
        return WorkflowTriggerType.EVENT_BASED;
      default:
        return WorkflowTriggerType.EVENT_BASED;
    }
  }

  /**
   * Build workflow nodes
   */
  private buildWorkflowNodes(triggerType: string): any[] {
    return [
      {
        id: 'node-trigger',
        type: WorkflowNodeType.START,
        label: `Trigger: ${triggerType}`,
        position: { x: 250, y: 50 },
        config: {},
      },
      {
        id: 'node-delay',
        type: WorkflowNodeType.DELAY,
        label: 'Wait 1 minute',
        position: { x: 250, y: 150 },
        config: {
          duration: 1,
          unit: 'minutes',
        },
      },
      {
        id: 'node-update',
        type: WorkflowNodeType.UPDATE_ATTRIBUTE,
        label: 'Mark as processed',
        position: { x: 250, y: 250 },
        config: {
          updates: [
            { field: 'tags', operation: 'add', value: 'workflow-processed' },
          ],
        },
      },
    ];
  }

  /**
   * Build workflow edges to connect nodes
   */
  private buildWorkflowEdges(): any[] {
    return [
      {
        id: 'edge-1',
        source: 'node-trigger',
        target: 'node-delay',
      },
      {
        id: 'edge-2',
        source: 'node-delay',
        target: 'node-update',
      },
    ];
  }

  /**
   * Build trigger configuration
   */
  private buildTriggerConfig(triggerType: string): any {
    switch (triggerType) {
      case 'contact_created':
        return {
          eventTypes: ['contact.created'],
        };
      case 'tag_added':
        return {
          eventTypes: ['contact.tag.added'],
        };
      case 'segment_joined':
        return {
          eventTypes: ['contact.segment.joined'],
        };
      default:
        return {};
    }
  }
}

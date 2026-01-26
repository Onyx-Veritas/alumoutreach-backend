import { Injectable, NotFoundException } from '@nestjs/common';

interface WorkflowNode {
  id: string;
  type: string;
  label: string;
  position: { x: number; y: number };
  config?: Record<string, any>;
}

interface WorkflowEdge {
  id: string;
  source: string;
  target: string;
  label?: string;
}

interface Workflow {
  id: string;
  name: string;
  description?: string;
  trigger: { type: string; config?: Record<string, any> };
  nodes: WorkflowNode[];
  edges: WorkflowEdge[];
  status: 'draft' | 'active' | 'paused' | 'archived';
  version: number;
  stats: {
    totalExecutions: number;
    activeExecutions: number;
    completedExecutions: number;
    failedExecutions: number;
  };
  tags: string[];
  folder?: string;
  createdBy: string;
  lastExecutedAt?: Date;
  createdAt: Date;
  updatedAt: Date;
}

@Injectable()
export class WorkflowsService {
  private workflows: Map<string, Workflow> = new Map();

  constructor() {
    this.seedSampleData();
  }

  private seedSampleData() {
    const samples: Workflow[] = [
      {
        id: 'wfl_1',
        name: 'New Donation Thank You',
        description: 'Automated thank you flow when a donation is received',
        trigger: { type: 'new_donation', config: { minAmount: 100 } },
        nodes: [
          { id: 'n1', type: 'trigger', label: 'New Donation', position: { x: 250, y: 50 } },
          { id: 'n2', type: 'condition', label: 'Amount > 10000?', position: { x: 250, y: 150 }, config: { field: 'amount', operator: 'greater_than', value: 10000 } },
          { id: 'n3', type: 'send_email', label: 'Send VIP Thank You', position: { x: 100, y: 250 }, config: { templateId: 'tpl_3' } },
          { id: 'n4', type: 'send_email', label: 'Send Standard Thank You', position: { x: 400, y: 250 }, config: { templateId: 'tpl_3' } },
          { id: 'n5', type: 'send_whatsapp', label: 'Send WhatsApp Thank You', position: { x: 250, y: 350 }, config: { templateId: 'tpl_2' } },
          { id: 'n6', type: 'add_tag', label: 'Tag as Donor', position: { x: 250, y: 450 }, config: { tag: 'active-donor' } },
          { id: 'n7', type: 'end', label: 'End', position: { x: 250, y: 550 } },
        ],
        edges: [
          { id: 'e1', source: 'n1', target: 'n2' },
          { id: 'e2', source: 'n2', target: 'n3', label: 'Yes' },
          { id: 'e3', source: 'n2', target: 'n4', label: 'No' },
          { id: 'e4', source: 'n3', target: 'n5' },
          { id: 'e5', source: 'n4', target: 'n5' },
          { id: 'e6', source: 'n5', target: 'n6' },
          { id: 'e7', source: 'n6', target: 'n7' },
        ],
        status: 'active',
        version: 2,
        stats: { totalExecutions: 425, activeExecutions: 3, completedExecutions: 418, failedExecutions: 4 },
        tags: ['donation', 'thank-you', 'automated'],
        folder: 'Fundraising',
        createdBy: 'admin',
        lastExecutedAt: new Date('2024-01-14'),
        createdAt: new Date('2023-06-01'),
        updatedAt: new Date('2023-12-15'),
      },
      {
        id: 'wfl_2',
        name: 'WhatsApp Auto-Reply',
        description: 'Automatic response to incoming WhatsApp messages',
        trigger: { type: 'incoming_whatsapp' },
        nodes: [
          { id: 'n1', type: 'trigger', label: 'WhatsApp Received', position: { x: 250, y: 50 } },
          { id: 'n2', type: 'ai_intent', label: 'Detect Intent', position: { x: 250, y: 150 }, config: { model: 'gpt-4' } },
          { id: 'n3', type: 'condition', label: 'Is FAQ?', position: { x: 250, y: 250 } },
          { id: 'n4', type: 'send_whatsapp', label: 'Send FAQ Response', position: { x: 100, y: 350 } },
          { id: 'n5', type: 'assign_agent', label: 'Assign to Agent', position: { x: 400, y: 350 } },
          { id: 'n6', type: 'end', label: 'End', position: { x: 250, y: 450 } },
        ],
        edges: [
          { id: 'e1', source: 'n1', target: 'n2' },
          { id: 'e2', source: 'n2', target: 'n3' },
          { id: 'e3', source: 'n3', target: 'n4', label: 'Yes' },
          { id: 'e4', source: 'n3', target: 'n5', label: 'No' },
          { id: 'e5', source: 'n4', target: 'n6' },
          { id: 'e6', source: 'n5', target: 'n6' },
        ],
        status: 'active',
        version: 3,
        stats: { totalExecutions: 1250, activeExecutions: 8, completedExecutions: 1238, failedExecutions: 4 },
        tags: ['whatsapp', 'auto-reply', 'ai'],
        folder: 'Inbox Automation',
        createdBy: 'admin',
        lastExecutedAt: new Date(),
        createdAt: new Date('2023-08-15'),
        updatedAt: new Date('2024-01-10'),
      },
      {
        id: 'wfl_3',
        name: 'Event RSVP Follow-up',
        description: 'Follow up with attendees after event RSVP',
        trigger: { type: 'event_rsvp', config: { status: 'confirmed' } },
        nodes: [
          { id: 'n1', type: 'trigger', label: 'Event RSVP', position: { x: 250, y: 50 } },
          { id: 'n2', type: 'delay', label: 'Wait 1 day', position: { x: 250, y: 150 }, config: { value: 1, unit: 'days' } },
          { id: 'n3', type: 'send_whatsapp', label: 'Send Reminder', position: { x: 250, y: 250 } },
          { id: 'n4', type: 'delay', label: 'Wait until event day', position: { x: 250, y: 350 } },
          { id: 'n5', type: 'send_whatsapp', label: 'Send Day-of Reminder', position: { x: 250, y: 450 } },
          { id: 'n6', type: 'end', label: 'End', position: { x: 250, y: 550 } },
        ],
        edges: [
          { id: 'e1', source: 'n1', target: 'n2' },
          { id: 'e2', source: 'n2', target: 'n3' },
          { id: 'e3', source: 'n3', target: 'n4' },
          { id: 'e4', source: 'n4', target: 'n5' },
          { id: 'e5', source: 'n5', target: 'n6' },
        ],
        status: 'active',
        version: 1,
        stats: { totalExecutions: 320, activeExecutions: 45, completedExecutions: 270, failedExecutions: 5 },
        tags: ['event', 'rsvp', 'reminder'],
        folder: 'Events',
        createdBy: 'admin',
        lastExecutedAt: new Date('2024-01-12'),
        createdAt: new Date('2023-10-01'),
        updatedAt: new Date('2023-10-01'),
      },
    ];

    samples.forEach(w => this.workflows.set(w.id, w));
  }

  async findAll(query: Record<string, any>) {
    const { page = 1, limit = 20, status, search } = query;
    let results = Array.from(this.workflows.values());

    if (status) results = results.filter(w => w.status === status);
    if (search) {
      const searchLower = search.toLowerCase();
      results = results.filter(w =>
        w.name.toLowerCase().includes(searchLower) ||
        w.description?.toLowerCase().includes(searchLower)
      );
    }

    const total = results.length;
    const startIndex = (page - 1) * limit;
    const paginatedResults = results.slice(startIndex, startIndex + limit);

    return {
      success: true,
      data: paginatedResults,
      meta: { page: Number(page), limit: Number(limit), total, totalPages: Math.ceil(total / limit) },
    };
  }

  async findOne(id: string) {
    const workflow = this.workflows.get(id);
    if (!workflow) throw new NotFoundException(`Workflow ${id} not found`);
    return { success: true, data: workflow };
  }

  async getExecutions(id: string, query: Record<string, any>) {
    const workflow = this.workflows.get(id);
    if (!workflow) throw new NotFoundException(`Workflow ${id} not found`);

    const executions = [
      { id: 'exe_1', contactId: 'con_1', contactName: 'Rahul Sharma', status: 'completed', startedAt: new Date('2024-01-14T10:00:00'), completedAt: new Date('2024-01-14T10:02:00') },
      { id: 'exe_2', contactId: 'con_2', contactName: 'Priya Patel', status: 'completed', startedAt: new Date('2024-01-14T09:30:00'), completedAt: new Date('2024-01-14T09:32:00') },
      { id: 'exe_3', contactId: 'con_3', contactName: 'Arjun Krishnan', status: 'running', startedAt: new Date('2024-01-14T11:00:00'), currentNode: 'n3' },
    ];

    return { success: true, data: executions, meta: { page: 1, limit: 20, total: 3 } };
  }

  async create(dto: any) {
    const id = `wfl_${Date.now()}`;
    const workflow: Workflow = {
      id,
      name: dto.name,
      description: dto.description,
      trigger: dto.trigger,
      nodes: dto.nodes || [],
      edges: dto.edges || [],
      status: 'draft',
      version: 1,
      stats: { totalExecutions: 0, activeExecutions: 0, completedExecutions: 0, failedExecutions: 0 },
      tags: dto.tags || [],
      folder: dto.folder,
      createdBy: 'admin',
      createdAt: new Date(),
      updatedAt: new Date(),
    };
    this.workflows.set(id, workflow);
    return { success: true, data: workflow };
  }

  async update(id: string, dto: any) {
    const existing = this.workflows.get(id);
    if (!existing) throw new NotFoundException(`Workflow ${id} not found`);

    const updated = { ...existing, ...dto, version: existing.version + 1, updatedAt: new Date() };
    this.workflows.set(id, updated);
    return { success: true, data: updated };
  }

  async remove(id: string) {
    if (!this.workflows.has(id)) throw new NotFoundException(`Workflow ${id} not found`);
    this.workflows.delete(id);
    return { success: true };
  }

  async activate(id: string) {
    const workflow = this.workflows.get(id);
    if (!workflow) throw new NotFoundException(`Workflow ${id} not found`);

    workflow.status = 'active';
    workflow.updatedAt = new Date();
    return { success: true, data: workflow };
  }

  async deactivate(id: string) {
    const workflow = this.workflows.get(id);
    if (!workflow) throw new NotFoundException(`Workflow ${id} not found`);

    workflow.status = 'paused';
    workflow.updatedAt = new Date();
    return { success: true, data: workflow };
  }

  async test(id: string, dto: any) {
    const workflow = this.workflows.get(id);
    if (!workflow) throw new NotFoundException(`Workflow ${id} not found`);

    return {
      success: true,
      data: {
        executionId: `test_${Date.now()}`,
        status: 'completed',
        nodesExecuted: workflow.nodes.length,
        logs: workflow.nodes.map((n, i) => ({
          nodeId: n.id,
          nodeType: n.type,
          status: 'success',
          timestamp: new Date(Date.now() + i * 1000),
        })),
      },
    };
  }
}

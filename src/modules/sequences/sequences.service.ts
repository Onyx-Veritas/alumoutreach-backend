import { Injectable, NotFoundException } from '@nestjs/common';

interface SequenceStep {
  id: string;
  type: string;
  label: string;
  order: number;
  config?: Record<string, any>;
}

interface Sequence {
  id: string;
  name: string;
  description?: string;
  steps: SequenceStep[];
  entryRules?: { segmentId?: string; trigger?: any };
  exitRules?: { exitOnEvents?: string[] };
  status: 'draft' | 'active' | 'paused' | 'archived';
  stats: {
    activeContacts: number;
    completedContacts: number;
    exitedContacts: number;
    conversionRate: number;
  };
  tags: string[];
  folder?: string;
  createdBy: string;
  createdAt: Date;
  updatedAt: Date;
}

@Injectable()
export class SequencesService {
  private sequences: Map<string, Sequence> = new Map();

  constructor() {
    this.seedSampleData();
  }

  private seedSampleData() {
    const samples: Sequence[] = [
      {
        id: 'seq_1',
        name: 'New Graduate Onboarding',
        description: 'Welcome sequence for newly graduated students joining alumni network',
        steps: [
          { id: 's1', type: 'send_email', label: 'Welcome Email', order: 1, config: { templateId: 'tpl_5' } },
          { id: 's2', type: 'delay', label: 'Wait 3 days', order: 2, config: { value: 3, unit: 'days' } },
          { id: 's3', type: 'send_whatsapp', label: 'Profile Completion Reminder', order: 3, config: { templateId: 'tpl_2' } },
          { id: 's4', type: 'delay', label: 'Wait 7 days', order: 4, config: { value: 7, unit: 'days' } },
          { id: 's5', type: 'send_email', label: 'Feature Highlights', order: 5, config: { templateId: 'tpl_1' } },
          { id: 's6', type: 'delay', label: 'Wait 14 days', order: 6, config: { value: 14, unit: 'days' } },
          { id: 's7', type: 'send_email', label: 'Mentorship Invitation', order: 7, config: { templateId: 'tpl_1' } },
        ],
        entryRules: { segmentId: 'seg_5' },
        exitRules: { exitOnEvents: ['profile_completed', 'unsubscribed'] },
        status: 'active',
        stats: { activeContacts: 180, completedContacts: 520, exitedContacts: 45, conversionRate: 72.5 },
        tags: ['onboarding', 'new-graduates'],
        folder: 'Lifecycle',
        createdBy: 'admin',
        createdAt: new Date('2023-05-15'),
        updatedAt: new Date('2023-11-20'),
      },
      {
        id: 'seq_2',
        name: 'Donor Cultivation',
        description: 'Nurture sequence to engage potential donors',
        steps: [
          { id: 's1', type: 'send_email', label: 'Impact Stories', order: 1, config: { templateId: 'tpl_1' } },
          { id: 's2', type: 'delay', label: 'Wait 5 days', order: 2, config: { value: 5, unit: 'days' } },
          { id: 's3', type: 'condition', label: 'Email Opened?', order: 3, config: { field: 'lastEmailOpened', operator: 'is_true' } },
          { id: 's4', type: 'send_whatsapp', label: 'Personal Invitation', order: 4, config: { templateId: 'tpl_2' } },
          { id: 's5', type: 'delay', label: 'Wait 3 days', order: 5, config: { value: 3, unit: 'days' } },
          { id: 's6', type: 'send_email', label: 'Giving Opportunities', order: 6, config: { templateId: 'tpl_3' } },
        ],
        entryRules: { segmentId: 'seg_6' },
        exitRules: { exitOnEvents: ['donation_made', 'unsubscribed'] },
        status: 'active',
        stats: { activeContacts: 320, completedContacts: 180, exitedContacts: 25, conversionRate: 18.2 },
        tags: ['fundraising', 'cultivation'],
        folder: 'Fundraising',
        createdBy: 'admin',
        createdAt: new Date('2023-09-01'),
        updatedAt: new Date('2024-01-05'),
      },
      {
        id: 'seq_3',
        name: 'Mentor Recruitment',
        description: 'Sequence to recruit active alumni as mentors',
        steps: [
          { id: 's1', type: 'send_email', label: 'Mentorship Program Intro', order: 1, config: { templateId: 'tpl_1' } },
          { id: 's2', type: 'delay', label: 'Wait 4 days', order: 2, config: { value: 4, unit: 'days' } },
          { id: 's3', type: 'send_whatsapp', label: 'Success Stories', order: 3, config: { templateId: 'tpl_2' } },
          { id: 's4', type: 'delay', label: 'Wait 7 days', order: 4, config: { value: 7, unit: 'days' } },
          { id: 's5', type: 'send_email', label: 'Easy Signup CTA', order: 5, config: { templateId: 'tpl_1' } },
        ],
        entryRules: { segmentId: 'seg_6' },
        exitRules: { exitOnEvents: ['mentor_signup', 'unsubscribed'] },
        status: 'active',
        stats: { activeContacts: 95, completedContacts: 210, exitedContacts: 18, conversionRate: 28.5 },
        tags: ['mentorship', 'recruitment'],
        folder: 'Programs',
        createdBy: 'admin',
        createdAt: new Date('2023-07-20'),
        updatedAt: new Date('2023-12-10'),
      },
    ];

    samples.forEach(s => this.sequences.set(s.id, s));
  }

  async findAll(query: Record<string, any>) {
    const { page = 1, limit = 20, status, search } = query;
    let results = Array.from(this.sequences.values());

    if (status) results = results.filter(s => s.status === status);
    if (search) {
      const searchLower = search.toLowerCase();
      results = results.filter(s =>
        s.name.toLowerCase().includes(searchLower) ||
        s.description?.toLowerCase().includes(searchLower)
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
    const sequence = this.sequences.get(id);
    if (!sequence) throw new NotFoundException(`Sequence ${id} not found`);
    return { success: true, data: sequence };
  }

  async getEnrollments(id: string, query: Record<string, any>) {
    const sequence = this.sequences.get(id);
    if (!sequence) throw new NotFoundException(`Sequence ${id} not found`);

    const enrollments = [
      { id: 'enr_1', contactId: 'con_1', contactName: 'Rahul Sharma', status: 'active', currentStep: 's3', enrolledAt: new Date('2024-01-10') },
      { id: 'enr_2', contactId: 'con_2', contactName: 'Priya Patel', status: 'completed', completedAt: new Date('2024-01-12'), enrolledAt: new Date('2023-12-01') },
      { id: 'enr_3', contactId: 'con_4', contactName: 'Sneha Gupta', status: 'active', currentStep: 's1', enrolledAt: new Date('2024-01-14') },
    ];

    return { success: true, data: enrollments, meta: { page: 1, limit: 20, total: 3 } };
  }

  async create(dto: any) {
    const id = `seq_${Date.now()}`;
    const sequence: Sequence = {
      id,
      name: dto.name,
      description: dto.description,
      steps: dto.steps || [],
      entryRules: dto.entryRules,
      exitRules: dto.exitRules,
      status: 'draft',
      stats: { activeContacts: 0, completedContacts: 0, exitedContacts: 0, conversionRate: 0 },
      tags: dto.tags || [],
      folder: dto.folder,
      createdBy: 'admin',
      createdAt: new Date(),
      updatedAt: new Date(),
    };
    this.sequences.set(id, sequence);
    return { success: true, data: sequence };
  }

  async update(id: string, dto: any) {
    const existing = this.sequences.get(id);
    if (!existing) throw new NotFoundException(`Sequence ${id} not found`);

    const updated = { ...existing, ...dto, updatedAt: new Date() };
    this.sequences.set(id, updated);
    return { success: true, data: updated };
  }

  async remove(id: string) {
    if (!this.sequences.has(id)) throw new NotFoundException(`Sequence ${id} not found`);
    this.sequences.delete(id);
    return { success: true };
  }

  async activate(id: string) {
    const sequence = this.sequences.get(id);
    if (!sequence) throw new NotFoundException(`Sequence ${id} not found`);

    sequence.status = 'active';
    sequence.updatedAt = new Date();
    return { success: true, data: sequence };
  }

  async pause(id: string) {
    const sequence = this.sequences.get(id);
    if (!sequence) throw new NotFoundException(`Sequence ${id} not found`);

    sequence.status = 'paused';
    sequence.updatedAt = new Date();
    return { success: true, data: sequence };
  }

  async enroll(id: string, contactIds: string[]) {
    const sequence = this.sequences.get(id);
    if (!sequence) throw new NotFoundException(`Sequence ${id} not found`);

    return {
      success: true,
      data: {
        enrolled: contactIds.length,
        sequenceId: id,
      },
    };
  }

  async unenroll(id: string, contactIds: string[]) {
    const sequence = this.sequences.get(id);
    if (!sequence) throw new NotFoundException(`Sequence ${id} not found`);

    return {
      success: true,
      data: {
        unenrolled: contactIds.length,
        sequenceId: id,
      },
    };
  }
}

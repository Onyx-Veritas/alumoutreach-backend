import { Injectable, NotFoundException } from '@nestjs/common';

interface Segment {
  id: string;
  name: string;
  description?: string;
  type: 'static' | 'dynamic';
  rules?: any;
  contactCount: number;
  lastComputedAt?: Date;
  tags: string[];
  folder?: string;
  createdBy: string;
  createdAt: Date;
  updatedAt: Date;
}

@Injectable()
export class SegmentsService {
  private segments: Map<string, Segment> = new Map();

  constructor() {
    this.seedSampleData();
  }

  private seedSampleData() {
    const samples: Segment[] = [
      {
        id: 'seg_1',
        name: 'Active Donors',
        description: 'Alumni who have donated in the last 12 months',
        type: 'dynamic',
        rules: {
          logic: 'and',
          filters: [
            { field: 'roles', operator: 'contains', value: 'donor' },
            { field: 'lastDonationDate', operator: 'within_last', value: { amount: 12, unit: 'months' } },
          ],
        },
        contactCount: 1250,
        lastComputedAt: new Date(),
        tags: ['donors', 'active'],
        folder: 'Fundraising',
        createdBy: 'admin',
        createdAt: new Date('2023-01-15'),
        updatedAt: new Date(),
      },
      {
        id: 'seg_2',
        name: 'Tech Alumni - Batch 2015-2020',
        description: 'Engineering and CS graduates from recent batches',
        type: 'dynamic',
        rules: {
          logic: 'and',
          filters: [
            { field: 'academic.department', operator: 'in', value: ['Engineering', 'Computer Science'] },
            { field: 'academic.batchYear', operator: 'between', value: [2015, 2020] },
          ],
        },
        contactCount: 3420,
        lastComputedAt: new Date(),
        tags: ['tech', 'engineering'],
        folder: 'Alumni Groups',
        createdBy: 'admin',
        createdAt: new Date('2023-02-20'),
        updatedAt: new Date(),
      },
      {
        id: 'seg_3',
        name: 'International Alumni',
        description: 'Alumni currently living outside India',
        type: 'dynamic',
        rules: {
          logic: 'and',
          filters: [
            { field: 'country', operator: 'not_equals', value: 'India' },
            { field: 'status', operator: 'equals', value: 'active' },
          ],
        },
        contactCount: 890,
        lastComputedAt: new Date(),
        tags: ['international', 'global'],
        folder: 'Geographic',
        createdBy: 'admin',
        createdAt: new Date('2023-03-10'),
        updatedAt: new Date(),
      },
      {
        id: 'seg_4',
        name: 'Mentors',
        description: 'Alumni who have signed up as mentors',
        type: 'dynamic',
        rules: {
          logic: 'and',
          filters: [
            { field: 'roles', operator: 'contains', value: 'mentor' },
            { field: 'status', operator: 'equals', value: 'active' },
          ],
        },
        contactCount: 425,
        lastComputedAt: new Date(),
        tags: ['mentorship', 'engagement'],
        folder: 'Programs',
        createdBy: 'admin',
        createdAt: new Date('2023-04-05'),
        updatedAt: new Date(),
      },
      {
        id: 'seg_5',
        name: 'Placement Drive 2025',
        description: 'Final year students eligible for placements',
        type: 'dynamic',
        rules: {
          logic: 'and',
          filters: [
            { field: 'roles', operator: 'contains', value: 'student' },
            { field: 'academic.graduationYear', operator: 'equals', value: 2025 },
          ],
        },
        contactCount: 580,
        lastComputedAt: new Date(),
        tags: ['placement', 'students', '2025'],
        folder: 'Career Services',
        createdBy: 'admin',
        createdAt: new Date('2023-08-01'),
        updatedAt: new Date(),
      },
      {
        id: 'seg_6',
        name: 'High Engagement Alumni',
        description: 'Alumni with engagement score above 80',
        type: 'dynamic',
        rules: {
          logic: 'and',
          filters: [
            { field: 'engagementScore', operator: 'greater_than', value: 80 },
            { field: 'roles', operator: 'contains', value: 'alumnus' },
          ],
        },
        contactCount: 1120,
        lastComputedAt: new Date(),
        tags: ['engaged', 'active'],
        folder: 'Engagement',
        createdBy: 'admin',
        createdAt: new Date('2023-05-15'),
        updatedAt: new Date(),
      },
    ];

    samples.forEach(s => this.segments.set(s.id, s));
  }

  async findAll(query: Record<string, any>) {
    const { page = 1, limit = 20, type, search } = query;
    let results = Array.from(this.segments.values());

    if (type) results = results.filter(s => s.type === type);
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
    const segment = this.segments.get(id);
    if (!segment) throw new NotFoundException(`Segment ${id} not found`);
    return { success: true, data: segment };
  }

  async getContacts(id: string, query: Record<string, any>) {
    const segment = this.segments.get(id);
    if (!segment) throw new NotFoundException(`Segment ${id} not found`);

    // Sample contacts for the segment
    const sampleContacts = [
      { id: 'con_1', fullName: 'Rahul Sharma', email: 'rahul@gmail.com', phone: '+91 98765 43210' },
      { id: 'con_2', fullName: 'Priya Patel', email: 'priya@outlook.com', phone: '+91 87654 32109' },
      { id: 'con_3', fullName: 'Arjun Krishnan', email: 'arjun@yahoo.com', phone: '+1 555 123 4567' },
    ];

    return {
      success: true,
      data: sampleContacts,
      meta: { page: 1, limit: 20, total: segment.contactCount, totalPages: Math.ceil(segment.contactCount / 20) },
    };
  }

  async create(dto: any) {
    const id = `seg_${Date.now()}`;
    const segment: Segment = {
      id,
      name: dto.name,
      description: dto.description,
      type: dto.type || 'dynamic',
      rules: dto.rules,
      contactCount: 0,
      tags: dto.tags || [],
      folder: dto.folder,
      createdBy: 'admin',
      createdAt: new Date(),
      updatedAt: new Date(),
    };
    this.segments.set(id, segment);
    return { success: true, data: segment };
  }

  async preview(dto: any) {
    // Simulate preview calculation
    return {
      success: true,
      data: {
        totalCount: Math.floor(Math.random() * 5000) + 100,
        sampleContacts: [
          { id: 'con_1', fullName: 'Sample Contact 1', email: 'sample1@example.com' },
          { id: 'con_2', fullName: 'Sample Contact 2', email: 'sample2@example.com' },
          { id: 'con_3', fullName: 'Sample Contact 3', email: 'sample3@example.com' },
        ],
        channelBreakdown: {
          email: Math.floor(Math.random() * 4000) + 100,
          whatsapp: Math.floor(Math.random() * 3000) + 100,
          sms: Math.floor(Math.random() * 2000) + 100,
        },
      },
    };
  }

  async update(id: string, dto: any) {
    const existing = this.segments.get(id);
    if (!existing) throw new NotFoundException(`Segment ${id} not found`);

    const updated = { ...existing, ...dto, updatedAt: new Date() };
    this.segments.set(id, updated);
    return { success: true, data: updated };
  }

  async remove(id: string) {
    if (!this.segments.has(id)) throw new NotFoundException(`Segment ${id} not found`);
    this.segments.delete(id);
    return { success: true };
  }

  async refresh(id: string) {
    const segment = this.segments.get(id);
    if (!segment) throw new NotFoundException(`Segment ${id} not found`);

    segment.lastComputedAt = new Date();
    segment.contactCount = Math.floor(Math.random() * 5000) + 100;
    return { success: true, data: segment };
  }
}

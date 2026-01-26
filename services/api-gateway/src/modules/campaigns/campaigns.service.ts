import { Injectable, NotFoundException } from '@nestjs/common';

interface Campaign {
  id: string;
  name: string;
  description?: string;
  type: 'one_time' | 'recurring' | 'triggered';
  status: 'draft' | 'scheduled' | 'running' | 'paused' | 'completed' | 'cancelled';
  channels: Array<{ channel: string; templateId: string }>;
  segmentId: string;
  segmentName?: string;
  audienceCount: number;
  schedule?: { sendAt?: string; timezone?: string };
  stats: {
    sent: number;
    delivered: number;
    opened: number;
    clicked: number;
    failed: number;
    unsubscribed: number;
  };
  tags: string[];
  department?: string;
  createdBy: string;
  startedAt?: Date;
  completedAt?: Date;
  createdAt: Date;
  updatedAt: Date;
}

@Injectable()
export class CampaignsService {
  private campaigns: Map<string, Campaign> = new Map();

  constructor() {
    this.seedSampleData();
  }

  private seedSampleData() {
    const samples: Campaign[] = [
      {
        id: 'cmp_1',
        name: 'Annual Alumni Newsletter - January 2024',
        description: 'Monthly newsletter for all active alumni',
        type: 'one_time',
        status: 'completed',
        channels: [{ channel: 'email', templateId: 'tpl_1' }],
        segmentId: 'seg_1',
        segmentName: 'Active Donors',
        audienceCount: 12500,
        schedule: { sendAt: '2024-01-15T10:00:00Z', timezone: 'Asia/Kolkata' },
        stats: { sent: 12500, delivered: 12250, opened: 6125, clicked: 1838, failed: 250, unsubscribed: 12 },
        tags: ['newsletter', 'monthly'],
        department: 'Alumni Relations',
        createdBy: 'admin',
        startedAt: new Date('2024-01-15T10:00:00'),
        completedAt: new Date('2024-01-15T10:45:00'),
        createdAt: new Date('2024-01-10'),
        updatedAt: new Date('2024-01-15'),
      },
      {
        id: 'cmp_2',
        name: 'Reunion 2024 - Save the Date',
        description: 'WhatsApp campaign for alumni reunion announcement',
        type: 'one_time',
        status: 'running',
        channels: [
          { channel: 'whatsapp', templateId: 'tpl_2' },
          { channel: 'email', templateId: 'tpl_1' },
        ],
        segmentId: 'seg_2',
        segmentName: 'Tech Alumni - Batch 2015-2020',
        audienceCount: 3420,
        schedule: { sendAt: '2024-01-20T11:00:00Z', timezone: 'Asia/Kolkata' },
        stats: { sent: 2100, delivered: 2050, opened: 1640, clicked: 820, failed: 50, unsubscribed: 3 },
        tags: ['reunion', 'event'],
        department: 'Alumni Relations',
        createdBy: 'admin',
        startedAt: new Date('2024-01-20T11:00:00'),
        createdAt: new Date('2024-01-18'),
        updatedAt: new Date('2024-01-20'),
      },
      {
        id: 'cmp_3',
        name: 'Placement Drive - Tech Companies',
        description: 'SMS alerts for upcoming placement opportunities',
        type: 'triggered',
        status: 'running',
        channels: [{ channel: 'sms', templateId: 'tpl_4' }],
        segmentId: 'seg_5',
        segmentName: 'Placement Drive 2025',
        audienceCount: 580,
        stats: { sent: 580, delivered: 572, opened: 0, clicked: 145, failed: 8, unsubscribed: 0 },
        tags: ['placement', 'sms'],
        department: 'Career Services',
        createdBy: 'admin',
        startedAt: new Date('2024-01-10'),
        createdAt: new Date('2024-01-08'),
        updatedAt: new Date('2024-01-20'),
      },
      {
        id: 'cmp_4',
        name: 'Year-End Fundraising Appeal',
        description: 'Multi-channel fundraising campaign',
        type: 'one_time',
        status: 'completed',
        channels: [
          { channel: 'email', templateId: 'tpl_3' },
          { channel: 'whatsapp', templateId: 'tpl_2' },
        ],
        segmentId: 'seg_1',
        segmentName: 'Active Donors',
        audienceCount: 1250,
        stats: { sent: 1250, delivered: 1225, opened: 857, clicked: 428, failed: 25, unsubscribed: 5 },
        tags: ['fundraising', 'year-end'],
        department: 'Development Office',
        createdBy: 'admin',
        startedAt: new Date('2023-12-01'),
        completedAt: new Date('2023-12-31'),
        createdAt: new Date('2023-11-25'),
        updatedAt: new Date('2023-12-31'),
      },
      {
        id: 'cmp_5',
        name: 'Welcome New Graduates - Batch 2024',
        description: 'Onboarding campaign for newly graduated students',
        type: 'one_time',
        status: 'scheduled',
        channels: [{ channel: 'email', templateId: 'tpl_5' }],
        segmentId: 'seg_5',
        segmentName: 'New Graduates 2024',
        audienceCount: 850,
        schedule: { sendAt: '2024-06-15T10:00:00Z', timezone: 'Asia/Kolkata' },
        stats: { sent: 0, delivered: 0, opened: 0, clicked: 0, failed: 0, unsubscribed: 0 },
        tags: ['onboarding', 'welcome'],
        department: 'Alumni Relations',
        createdBy: 'admin',
        createdAt: new Date('2024-01-15'),
        updatedAt: new Date('2024-01-15'),
      },
    ];

    samples.forEach(c => this.campaigns.set(c.id, c));
  }

  async findAll(query: Record<string, any>) {
    const { page = 1, limit = 20, status, type, search } = query;
    let results = Array.from(this.campaigns.values());

    if (status) results = results.filter(c => c.status === status);
    if (type) results = results.filter(c => c.type === type);
    if (search) {
      const searchLower = search.toLowerCase();
      results = results.filter(c =>
        c.name.toLowerCase().includes(searchLower) ||
        c.description?.toLowerCase().includes(searchLower)
      );
    }

    results.sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());

    const total = results.length;
    const startIndex = (page - 1) * limit;
    const paginatedResults = results.slice(startIndex, startIndex + limit);

    return {
      success: true,
      data: paginatedResults,
      meta: { page: Number(page), limit: Number(limit), total, totalPages: Math.ceil(total / limit) },
    };
  }

  async getStats() {
    const campaigns = Array.from(this.campaigns.values());
    const totalStats = campaigns.reduce(
      (acc, c) => ({
        sent: acc.sent + c.stats.sent,
        delivered: acc.delivered + c.stats.delivered,
        opened: acc.opened + c.stats.opened,
        clicked: acc.clicked + c.stats.clicked,
        failed: acc.failed + c.stats.failed,
      }),
      { sent: 0, delivered: 0, opened: 0, clicked: 0, failed: 0 }
    );

    return {
      success: true,
      data: {
        totalCampaigns: campaigns.length,
        byStatus: {
          draft: campaigns.filter(c => c.status === 'draft').length,
          scheduled: campaigns.filter(c => c.status === 'scheduled').length,
          running: campaigns.filter(c => c.status === 'running').length,
          completed: campaigns.filter(c => c.status === 'completed').length,
        },
        overallStats: {
          ...totalStats,
          deliveryRate: totalStats.sent > 0 ? ((totalStats.delivered / totalStats.sent) * 100).toFixed(1) : 0,
          openRate: totalStats.delivered > 0 ? ((totalStats.opened / totalStats.delivered) * 100).toFixed(1) : 0,
          clickRate: totalStats.opened > 0 ? ((totalStats.clicked / totalStats.opened) * 100).toFixed(1) : 0,
        },
      },
    };
  }

  async findOne(id: string) {
    const campaign = this.campaigns.get(id);
    if (!campaign) throw new NotFoundException(`Campaign ${id} not found`);
    return { success: true, data: campaign };
  }

  async getAnalytics(id: string) {
    const campaign = this.campaigns.get(id);
    if (!campaign) throw new NotFoundException(`Campaign ${id} not found`);

    return {
      success: true,
      data: {
        campaignId: id,
        metrics: {
          ...campaign.stats,
          deliveryRate: campaign.stats.sent > 0 ? ((campaign.stats.delivered / campaign.stats.sent) * 100).toFixed(1) : 0,
          openRate: campaign.stats.delivered > 0 ? ((campaign.stats.opened / campaign.stats.delivered) * 100).toFixed(1) : 0,
          clickRate: campaign.stats.opened > 0 ? ((campaign.stats.clicked / campaign.stats.opened) * 100).toFixed(1) : 0,
        },
        timeline: [
          { timestamp: '2024-01-15T10:00:00Z', sent: 2500, delivered: 2450, opened: 500, clicked: 100 },
          { timestamp: '2024-01-15T10:15:00Z', sent: 5000, delivered: 4900, opened: 1500, clicked: 400 },
          { timestamp: '2024-01-15T10:30:00Z', sent: 7500, delivered: 7350, opened: 3200, clicked: 900 },
          { timestamp: '2024-01-15T10:45:00Z', sent: 10000, delivered: 9800, opened: 4800, clicked: 1400 },
        ],
        topLinks: [
          { url: 'https://alumni.edu/events/reunion', clicks: 520, uniqueClicks: 480 },
          { url: 'https://alumni.edu/donate', clicks: 310, uniqueClicks: 290 },
          { url: 'https://alumni.edu/profile', clicks: 180, uniqueClicks: 165 },
        ],
        deviceBreakdown: { desktop: 45, mobile: 48, tablet: 7 },
        geographicBreakdown: [
          { country: 'India', count: 8500 },
          { country: 'USA', count: 2100 },
          { country: 'UK', count: 850 },
          { country: 'UAE', count: 520 },
        ],
      },
    };
  }

  async create(dto: any) {
    const id = `cmp_${Date.now()}`;
    const campaign: Campaign = {
      id,
      name: dto.name,
      description: dto.description,
      type: dto.type || 'one_time',
      status: 'draft',
      channels: dto.channels || [],
      segmentId: dto.segmentId,
      segmentName: dto.segmentName,
      audienceCount: dto.audienceCount || 0,
      schedule: dto.schedule,
      stats: { sent: 0, delivered: 0, opened: 0, clicked: 0, failed: 0, unsubscribed: 0 },
      tags: dto.tags || [],
      department: dto.department,
      createdBy: 'admin',
      createdAt: new Date(),
      updatedAt: new Date(),
    };
    this.campaigns.set(id, campaign);
    return { success: true, data: campaign };
  }

  async update(id: string, dto: any) {
    const existing = this.campaigns.get(id);
    if (!existing) throw new NotFoundException(`Campaign ${id} not found`);

    const updated = { ...existing, ...dto, updatedAt: new Date() };
    this.campaigns.set(id, updated);
    return { success: true, data: updated };
  }

  async remove(id: string) {
    if (!this.campaigns.has(id)) throw new NotFoundException(`Campaign ${id} not found`);
    this.campaigns.delete(id);
    return { success: true };
  }

  async start(id: string) {
    const campaign = this.campaigns.get(id);
    if (!campaign) throw new NotFoundException(`Campaign ${id} not found`);

    campaign.status = 'running';
    campaign.startedAt = new Date();
    campaign.updatedAt = new Date();
    return { success: true, data: campaign };
  }

  async pause(id: string) {
    const campaign = this.campaigns.get(id);
    if (!campaign) throw new NotFoundException(`Campaign ${id} not found`);

    campaign.status = 'paused';
    campaign.updatedAt = new Date();
    return { success: true, data: campaign };
  }

  async resume(id: string) {
    const campaign = this.campaigns.get(id);
    if (!campaign) throw new NotFoundException(`Campaign ${id} not found`);

    campaign.status = 'running';
    campaign.updatedAt = new Date();
    return { success: true, data: campaign };
  }

  async duplicate(id: string) {
    const campaign = this.campaigns.get(id);
    if (!campaign) throw new NotFoundException(`Campaign ${id} not found`);

    const newId = `cmp_${Date.now()}`;
    const duplicate: Campaign = {
      ...campaign,
      id: newId,
      name: `${campaign.name} (Copy)`,
      status: 'draft',
      stats: { sent: 0, delivered: 0, opened: 0, clicked: 0, failed: 0, unsubscribed: 0 },
      startedAt: undefined,
      completedAt: undefined,
      createdAt: new Date(),
      updatedAt: new Date(),
    };
    this.campaigns.set(newId, duplicate);
    return { success: true, data: duplicate };
  }
}

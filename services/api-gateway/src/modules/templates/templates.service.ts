import { Injectable, NotFoundException } from '@nestjs/common';

interface Template {
  id: string;
  name: string;
  description?: string;
  channel: string;
  category: string;
  content: any;
  variables: Array<{ name: string; type: string; required: boolean; defaultValue?: string }>;
  status: string;
  version: number;
  tags: string[];
  folder?: string;
  usageCount: number;
  lastUsedAt?: Date;
  createdBy: string;
  createdAt: Date;
  updatedAt: Date;
}

@Injectable()
export class TemplatesService {
  private templates: Map<string, Template> = new Map();

  constructor() {
    this.seedSampleData();
  }

  private seedSampleData() {
    const samples: Template[] = [
      {
        id: 'tpl_1',
        name: 'Alumni Newsletter - Monthly',
        description: 'Monthly newsletter template for alumni updates',
        channel: 'email',
        category: 'lifecycle',
        content: {
          subject: 'Your Monthly Alumni Update - {{month}} {{year}}',
          htmlBody: `
            <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
              <h1 style="color: #1a365d;">Hello {{firstName}}!</h1>
              <p>Welcome to your monthly alumni newsletter. Here's what's happening in your alumni community.</p>
              <h2 style="color: #2563eb;">Upcoming Events</h2>
              <p>{{upcomingEvents}}</p>
              <h2 style="color: #2563eb;">Featured Alumni</h2>
              <p>{{featuredAlumni}}</p>
              <p style="margin-top: 30px;">Best regards,<br>Alumni Relations Office</p>
            </div>
          `,
          preheader: 'Your monthly dose of alumni news and updates',
        },
        variables: [
          { name: 'firstName', type: 'text', required: true },
          { name: 'month', type: 'text', required: true },
          { name: 'year', type: 'text', required: true },
          { name: 'upcomingEvents', type: 'dynamic', required: false },
          { name: 'featuredAlumni', type: 'dynamic', required: false },
        ],
        status: 'approved',
        version: 3,
        tags: ['newsletter', 'monthly', 'alumni'],
        folder: 'Newsletters',
        usageCount: 1250,
        lastUsedAt: new Date('2024-01-15'),
        createdBy: 'admin',
        createdAt: new Date('2023-01-01'),
        updatedAt: new Date('2024-01-10'),
      },
      {
        id: 'tpl_2',
        name: 'Event Invitation - WhatsApp',
        description: 'WhatsApp template for event invitations',
        channel: 'whatsapp',
        category: 'event',
        content: {
          body: '🎉 Hello {{name}}!\n\nYou\'re invited to *{{eventName}}*\n\n📅 Date: {{eventDate}}\n📍 Venue: {{venue}}\n\nWe\'d love to see you there!\n\nRSVP now: {{rsvpLink}}',
          buttons: [
            { type: 'url', text: 'RSVP Now', value: '{{rsvpLink}}' },
            { type: 'quick_reply', text: "I'll be there!" },
            { type: 'quick_reply', text: "Can't make it" },
          ],
        },
        variables: [
          { name: 'name', type: 'text', required: true },
          { name: 'eventName', type: 'text', required: true },
          { name: 'eventDate', type: 'date', required: true },
          { name: 'venue', type: 'text', required: true },
          { name: 'rsvpLink', type: 'url', required: true },
        ],
        status: 'approved',
        version: 2,
        tags: ['event', 'invitation', 'rsvp'],
        folder: 'Events',
        usageCount: 850,
        lastUsedAt: new Date('2024-01-12'),
        createdBy: 'admin',
        createdAt: new Date('2023-03-15'),
        updatedAt: new Date('2023-12-01'),
      },
      {
        id: 'tpl_3',
        name: 'Donation Thank You',
        description: 'Thank you message for donors',
        channel: 'email',
        category: 'donor',
        content: {
          subject: 'Thank You for Your Generous Contribution, {{firstName}}!',
          htmlBody: `
            <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
              <h1 style="color: #059669;">Thank You, {{firstName}}! 🙏</h1>
              <p>Your generous donation of <strong>₹{{amount}}</strong> has been received.</p>
              <p>Your contribution will help us {{impactStatement}}.</p>
              <div style="background: #f0fdf4; padding: 20px; border-radius: 8px; margin: 20px 0;">
                <p><strong>Receipt Number:</strong> {{receiptNumber}}</p>
                <p><strong>Date:</strong> {{donationDate}}</p>
                <p><strong>Amount:</strong> ₹{{amount}}</p>
              </div>
              <p>With gratitude,<br>Development Office</p>
            </div>
          `,
        },
        variables: [
          { name: 'firstName', type: 'text', required: true },
          { name: 'amount', type: 'number', required: true },
          { name: 'receiptNumber', type: 'text', required: true },
          { name: 'donationDate', type: 'date', required: true },
          { name: 'impactStatement', type: 'text', required: false, defaultValue: 'support student scholarships and campus development' },
        ],
        status: 'approved',
        version: 1,
        tags: ['donation', 'thank-you', 'receipt'],
        folder: 'Fundraising',
        usageCount: 425,
        lastUsedAt: new Date('2024-01-14'),
        createdBy: 'admin',
        createdAt: new Date('2023-06-01'),
        updatedAt: new Date('2023-11-15'),
      },
      {
        id: 'tpl_4',
        name: 'Placement Drive Alert - SMS',
        description: 'SMS notification for placement opportunities',
        channel: 'sms',
        category: 'placement',
        content: {
          body: 'Hi {{name}}, {{company}} is hiring! Role: {{role}}. Apply by {{deadline}}. Link: {{applyLink}} -Alumni Cell',
          dltTemplateId: 'DLT12345678',
          senderId: 'ALUMNI',
        },
        variables: [
          { name: 'name', type: 'text', required: true },
          { name: 'company', type: 'text', required: true },
          { name: 'role', type: 'text', required: true },
          { name: 'deadline', type: 'date', required: true },
          { name: 'applyLink', type: 'url', required: true },
        ],
        status: 'approved',
        version: 1,
        tags: ['placement', 'job', 'sms'],
        folder: 'Career Services',
        usageCount: 320,
        lastUsedAt: new Date('2024-01-10'),
        createdBy: 'admin',
        createdAt: new Date('2023-08-01'),
        updatedAt: new Date('2023-08-01'),
      },
      {
        id: 'tpl_5',
        name: 'Welcome New Graduate',
        description: 'Welcome email for newly graduated students joining alumni network',
        channel: 'email',
        category: 'lifecycle',
        content: {
          subject: 'Welcome to the Alumni Family, {{firstName}}! 🎓',
          htmlBody: `
            <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
              <h1 style="color: #7c3aed;">Congratulations, {{firstName}}! 🎓</h1>
              <p>Welcome to our alumni network! As a graduate of {{program}} (Batch {{batchYear}}), you're now part of a community of {{totalAlumni}}+ successful professionals worldwide.</p>
              <h2>Get Started</h2>
              <ul>
                <li>Update your profile: {{profileLink}}</li>
                <li>Connect with batchmates: {{networkLink}}</li>
                <li>Explore mentorship opportunities</li>
              </ul>
              <p>We're excited to have you!</p>
            </div>
          `,
        },
        variables: [
          { name: 'firstName', type: 'text', required: true },
          { name: 'program', type: 'text', required: true },
          { name: 'batchYear', type: 'number', required: true },
          { name: 'totalAlumni', type: 'number', required: true, defaultValue: '50000' },
          { name: 'profileLink', type: 'url', required: true },
          { name: 'networkLink', type: 'url', required: true },
        ],
        status: 'approved',
        version: 2,
        tags: ['onboarding', 'welcome', 'graduate'],
        folder: 'Lifecycle',
        usageCount: 180,
        lastUsedAt: new Date('2024-01-05'),
        createdBy: 'admin',
        createdAt: new Date('2023-05-01'),
        updatedAt: new Date('2023-12-20'),
      },
    ];

    samples.forEach(t => this.templates.set(t.id, t));
  }

  async findAll(query: Record<string, any>) {
    const { channel, category, status, search, page = 1, limit = 20 } = query;
    let results = Array.from(this.templates.values());

    if (channel) results = results.filter(t => t.channel === channel);
    if (category) results = results.filter(t => t.category === category);
    if (status) results = results.filter(t => t.status === status);
    if (search) {
      const searchLower = search.toLowerCase();
      results = results.filter(t => 
        t.name.toLowerCase().includes(searchLower) ||
        t.description?.toLowerCase().includes(searchLower)
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

  async getStats() {
    const templates = Array.from(this.templates.values());
    return {
      success: true,
      data: {
        total: templates.length,
        byChannel: {
          email: templates.filter(t => t.channel === 'email').length,
          whatsapp: templates.filter(t => t.channel === 'whatsapp').length,
          sms: templates.filter(t => t.channel === 'sms').length,
        },
        byStatus: {
          approved: templates.filter(t => t.status === 'approved').length,
          draft: templates.filter(t => t.status === 'draft').length,
          pending_approval: templates.filter(t => t.status === 'pending_approval').length,
        },
        totalUsage: templates.reduce((sum, t) => sum + t.usageCount, 0),
      },
    };
  }

  async findOne(id: string) {
    const template = this.templates.get(id);
    if (!template) throw new NotFoundException(`Template ${id} not found`);
    return { success: true, data: template };
  }

  async create(dto: any) {
    const id = `tpl_${Date.now()}`;
    const template: Template = {
      id,
      ...dto,
      status: 'draft',
      version: 1,
      usageCount: 0,
      createdBy: 'admin',
      createdAt: new Date(),
      updatedAt: new Date(),
    };
    this.templates.set(id, template);
    return { success: true, data: template };
  }

  async update(id: string, dto: any) {
    const existing = this.templates.get(id);
    if (!existing) throw new NotFoundException(`Template ${id} not found`);
    
    const updated = { ...existing, ...dto, updatedAt: new Date(), version: existing.version + 1 };
    this.templates.set(id, updated);
    return { success: true, data: updated };
  }

  async remove(id: string) {
    if (!this.templates.has(id)) throw new NotFoundException(`Template ${id} not found`);
    this.templates.delete(id);
    return { success: true };
  }

  async duplicate(id: string) {
    const template = this.templates.get(id);
    if (!template) throw new NotFoundException(`Template ${id} not found`);

    const newId = `tpl_${Date.now()}`;
    const duplicate: Template = {
      ...template,
      id: newId,
      name: `${template.name} (Copy)`,
      status: 'draft',
      version: 1,
      usageCount: 0,
      createdAt: new Date(),
      updatedAt: new Date(),
    };
    this.templates.set(newId, duplicate);
    return { success: true, data: duplicate };
  }

  async render(templateId: string, variables: Record<string, any>) {
    const template = this.templates.get(templateId);
    if (!template) throw new NotFoundException(`Template ${templateId} not found`);

    let rendered = JSON.stringify(template.content);
    for (const [key, value] of Object.entries(variables)) {
      rendered = rendered.replace(new RegExp(`{{${key}}}`, 'g'), value);
    }

    return { success: true, data: { templateId, rendered: JSON.parse(rendered) } };
  }
}

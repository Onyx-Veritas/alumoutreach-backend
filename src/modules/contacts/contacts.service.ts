import { Injectable, NotFoundException } from '@nestjs/common';
import { CreateContactDto, UpdateContactDto } from './dto/contact.dto';

interface Contact {
  id: string;
  fullName: string;
  preferredName?: string;
  channels: {
    email?: string;
    emailSecondary?: string;
    phone?: string;
    whatsapp?: string;
  };
  consent: {
    emailOptIn?: boolean;
    smsOptIn?: boolean;
    whatsappOptIn?: boolean;
    preferredChannel?: string;
  };
  academic: {
    program?: string;
    specialization?: string;
    batchYear?: number;
    graduationYear?: number;
    department?: string;
    rollNumber?: string;
  };
  professional: {
    currentCompany?: string;
    designation?: string;
    industry?: string;
    linkedinUrl?: string;
    yearsOfExperience?: number;
    skills?: string[];
  };
  roles: string[];
  tags: string[];
  status: string;
  engagementScore: number;
  profileImageUrl?: string;
  city?: string;
  country?: string;
  lastActivityAt?: Date;
  createdAt: Date;
  updatedAt: Date;
}

@Injectable()
export class ContactsService {
  private contacts: Map<string, Contact> = new Map();

  constructor() {
    // Initialize with sample data
    this.seedSampleData();
  }

  private seedSampleData() {
    const sampleContacts: Contact[] = [
      {
        id: 'con_1',
        fullName: 'Rahul Sharma',
        preferredName: 'Rahul',
        channels: {
          email: 'rahul.sharma@gmail.com',
          phone: '+91 98765 43210',
          whatsapp: '+91 98765 43210',
        },
        consent: { emailOptIn: true, smsOptIn: true, whatsappOptIn: true, preferredChannel: 'whatsapp' },
        academic: {
          program: 'B.Tech',
          specialization: 'Computer Science',
          batchYear: 2018,
          graduationYear: 2022,
          department: 'Engineering',
        },
        professional: {
          currentCompany: 'Google',
          designation: 'Software Engineer',
          industry: 'Technology',
          linkedinUrl: 'https://linkedin.com/in/rahulsharma',
          yearsOfExperience: 2,
          skills: ['Python', 'JavaScript', 'Machine Learning'],
        },
        roles: ['alumnus'],
        tags: ['active-donor', 'mentor', 'tech'],
        status: 'active',
        engagementScore: 85,
        profileImageUrl: 'https://api.dicebear.com/7.x/avataaars/svg?seed=Rahul',
        city: 'Bangalore',
        country: 'India',
        lastActivityAt: new Date(),
        createdAt: new Date('2023-01-15'),
        updatedAt: new Date(),
      },
      {
        id: 'con_2',
        fullName: 'Priya Patel',
        preferredName: 'Priya',
        channels: {
          email: 'priya.patel@outlook.com',
          phone: '+91 87654 32109',
          whatsapp: '+91 87654 32109',
        },
        consent: { emailOptIn: true, smsOptIn: false, whatsappOptIn: true, preferredChannel: 'email' },
        academic: {
          program: 'MBA',
          specialization: 'Marketing',
          batchYear: 2019,
          graduationYear: 2021,
          department: 'Business',
        },
        professional: {
          currentCompany: 'McKinsey & Company',
          designation: 'Associate',
          industry: 'Consulting',
          linkedinUrl: 'https://linkedin.com/in/priyapatel',
          yearsOfExperience: 3,
          skills: ['Strategy', 'Market Research', 'Business Analytics'],
        },
        roles: ['alumnus', 'donor'],
        tags: ['gold-donor', 'speaker'],
        status: 'active',
        engagementScore: 92,
        profileImageUrl: 'https://api.dicebear.com/7.x/avataaars/svg?seed=Priya',
        city: 'Mumbai',
        country: 'India',
        lastActivityAt: new Date(),
        createdAt: new Date('2023-02-20'),
        updatedAt: new Date(),
      },
      {
        id: 'con_3',
        fullName: 'Arjun Krishnan',
        channels: {
          email: 'arjun.k@yahoo.com',
          phone: '+1 555 123 4567',
        },
        consent: { emailOptIn: true, smsOptIn: true, whatsappOptIn: false, preferredChannel: 'email' },
        academic: {
          program: 'MS',
          specialization: 'Data Science',
          batchYear: 2017,
          graduationYear: 2019,
          department: 'Engineering',
        },
        professional: {
          currentCompany: 'Meta',
          designation: 'Senior Data Scientist',
          industry: 'Technology',
          linkedinUrl: 'https://linkedin.com/in/arjunkrish',
          yearsOfExperience: 5,
          skills: ['Machine Learning', 'Deep Learning', 'Python', 'SQL'],
        },
        roles: ['alumnus', 'mentor'],
        tags: ['international', 'mentor', 'ai-ml'],
        status: 'active',
        engagementScore: 78,
        profileImageUrl: 'https://api.dicebear.com/7.x/avataaars/svg?seed=Arjun',
        city: 'San Francisco',
        country: 'USA',
        lastActivityAt: new Date('2024-01-10'),
        createdAt: new Date('2022-11-10'),
        updatedAt: new Date(),
      },
      {
        id: 'con_4',
        fullName: 'Sneha Gupta',
        channels: {
          email: 'sneha.gupta@iitb.ac.in',
          phone: '+91 76543 21098',
          whatsapp: '+91 76543 21098',
        },
        consent: { emailOptIn: true, smsOptIn: true, whatsappOptIn: true, preferredChannel: 'whatsapp' },
        academic: {
          program: 'B.Tech',
          specialization: 'Mechanical Engineering',
          batchYear: 2021,
          graduationYear: 2025,
          department: 'Engineering',
        },
        professional: {},
        roles: ['student'],
        tags: ['current-student', 'placement-2025'],
        status: 'active',
        engagementScore: 65,
        profileImageUrl: 'https://api.dicebear.com/7.x/avataaars/svg?seed=Sneha',
        city: 'Mumbai',
        country: 'India',
        lastActivityAt: new Date(),
        createdAt: new Date('2023-08-01'),
        updatedAt: new Date(),
      },
      {
        id: 'con_5',
        fullName: 'Vikram Malhotra',
        preferredName: 'Vik',
        channels: {
          email: 'vikram.malhotra@startupx.io',
          phone: '+91 99887 76655',
          whatsapp: '+91 99887 76655',
        },
        consent: { emailOptIn: true, smsOptIn: false, whatsappOptIn: true, preferredChannel: 'whatsapp' },
        academic: {
          program: 'B.Tech',
          specialization: 'Electronics',
          batchYear: 2010,
          graduationYear: 2014,
          department: 'Engineering',
        },
        professional: {
          currentCompany: 'StartupX',
          designation: 'Founder & CEO',
          industry: 'Technology',
          linkedinUrl: 'https://linkedin.com/in/vikmalhotra',
          yearsOfExperience: 10,
          skills: ['Entrepreneurship', 'Product Management', 'Leadership'],
        },
        roles: ['alumnus', 'donor', 'recruiter'],
        tags: ['platinum-donor', 'entrepreneur', 'hiring'],
        status: 'active',
        engagementScore: 95,
        profileImageUrl: 'https://api.dicebear.com/7.x/avataaars/svg?seed=Vikram',
        city: 'Gurgaon',
        country: 'India',
        lastActivityAt: new Date(),
        createdAt: new Date('2022-05-15'),
        updatedAt: new Date(),
      },
    ];

    sampleContacts.forEach(contact => {
      this.contacts.set(contact.id, contact);
    });
  }

  async findAll(query: Record<string, any>) {
    const { page = 1, limit = 20, search, role, status, tag, batchYear, sortBy, sortOrder } = query;
    
    let results = Array.from(this.contacts.values());

    // Apply filters
    if (search) {
      const searchLower = search.toLowerCase();
      results = results.filter(c => 
        c.fullName.toLowerCase().includes(searchLower) ||
        c.channels.email?.toLowerCase().includes(searchLower) ||
        c.professional.currentCompany?.toLowerCase().includes(searchLower)
      );
    }

    if (role) {
      results = results.filter(c => c.roles.includes(role));
    }

    if (status) {
      results = results.filter(c => c.status === status);
    }

    if (tag) {
      results = results.filter(c => c.tags.includes(tag));
    }

    if (batchYear) {
      results = results.filter(c => c.academic.batchYear === Number(batchYear));
    }

    // Sort
    if (sortBy) {
      results.sort((a, b) => {
        const aVal = (a as any)[sortBy];
        const bVal = (b as any)[sortBy];
        const order = sortOrder === 'ASC' ? 1 : -1;
        return aVal > bVal ? order : -order;
      });
    }

    const total = results.length;
    const startIndex = (page - 1) * limit;
    const paginatedResults = results.slice(startIndex, startIndex + limit);

    return {
      success: true,
      data: paginatedResults,
      meta: {
        page: Number(page),
        limit: Number(limit),
        total,
        totalPages: Math.ceil(total / limit),
        hasNext: startIndex + limit < total,
        hasPrev: page > 1,
      },
    };
  }

  async findOne(id: string) {
    const contact = this.contacts.get(id);
    if (!contact) {
      throw new NotFoundException(`Contact with ID ${id} not found`);
    }
    return { success: true, data: contact };
  }

  async getTimeline(id: string) {
    const contact = this.contacts.get(id);
    if (!contact) {
      throw new NotFoundException(`Contact with ID ${id} not found`);
    }

    // Generate sample timeline
    const timeline = [
      {
        id: 'evt_1',
        type: 'email_sent',
        title: 'Alumni Newsletter - January 2024',
        description: 'Monthly newsletter sent via email',
        channel: 'email',
        status: 'delivered',
        timestamp: new Date('2024-01-15T10:30:00'),
      },
      {
        id: 'evt_2',
        type: 'email_opened',
        title: 'Opened: Alumni Newsletter',
        channel: 'email',
        timestamp: new Date('2024-01-15T14:22:00'),
      },
      {
        id: 'evt_3',
        type: 'whatsapp_received',
        title: 'Replied to fundraising message',
        description: 'Interested in contributing to the annual fund',
        channel: 'whatsapp',
        timestamp: new Date('2024-01-12T09:15:00'),
      },
      {
        id: 'evt_4',
        type: 'event_attended',
        title: 'Attended: Annual Alumni Meet 2023',
        description: 'Checked in at the venue',
        timestamp: new Date('2023-12-20T18:00:00'),
      },
      {
        id: 'evt_5',
        type: 'donation',
        title: 'Donated ₹25,000',
        description: 'Annual Fund contribution',
        timestamp: new Date('2023-12-15T11:00:00'),
      },
    ];

    return { success: true, data: timeline };
  }

  async getStats() {
    const contacts = Array.from(this.contacts.values());
    
    const stats = {
      total: contacts.length,
      byStatus: {
        active: contacts.filter(c => c.status === 'active').length,
        inactive: contacts.filter(c => c.status === 'inactive').length,
      },
      byRole: {
        alumnus: contacts.filter(c => c.roles.includes('alumnus')).length,
        student: contacts.filter(c => c.roles.includes('student')).length,
        donor: contacts.filter(c => c.roles.includes('donor')).length,
        mentor: contacts.filter(c => c.roles.includes('mentor')).length,
      },
      channelReachability: {
        email: contacts.filter(c => c.channels.email && c.consent.emailOptIn).length,
        whatsapp: contacts.filter(c => c.channels.whatsapp && c.consent.whatsappOptIn).length,
        sms: contacts.filter(c => c.channels.phone && c.consent.smsOptIn).length,
      },
      avgEngagementScore: Math.round(
        contacts.reduce((sum, c) => sum + c.engagementScore, 0) / contacts.length
      ),
    };

    return { success: true, data: stats };
  }

  async create(dto: CreateContactDto) {
    const id = `con_${Date.now()}`;
    const contact: Contact = {
      id,
      fullName: dto.fullName,
      preferredName: dto.preferredName,
      channels: dto.channels || {},
      consent: dto.consent || { emailOptIn: false, smsOptIn: false, whatsappOptIn: false },
      academic: dto.academic || {},
      professional: dto.professional || {},
      roles: dto.roles || ['alumnus'],
      tags: dto.tags || [],
      status: 'active',
      engagementScore: 50,
      profileImageUrl: dto.profileImageUrl || `https://api.dicebear.com/7.x/avataaars/svg?seed=${dto.fullName}`,
      city: dto.city,
      country: dto.country,
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    this.contacts.set(id, contact);
    return { success: true, data: contact };
  }

  async update(id: string, dto: UpdateContactDto) {
    const existing = this.contacts.get(id);
    if (!existing) {
      throw new NotFoundException(`Contact with ID ${id} not found`);
    }

    const updated: Contact = {
      ...existing,
      ...dto,
      channels: { ...existing.channels, ...dto.channels },
      consent: { ...existing.consent, ...dto.consent },
      academic: { ...existing.academic, ...dto.academic },
      professional: { ...existing.professional, ...dto.professional },
      updatedAt: new Date(),
    };

    this.contacts.set(id, updated);
    return { success: true, data: updated };
  }

  async remove(id: string) {
    if (!this.contacts.has(id)) {
      throw new NotFoundException(`Contact with ID ${id} not found`);
    }
    this.contacts.delete(id);
    return { success: true };
  }

  async addTags(id: string, tags: string[]) {
    const contact = this.contacts.get(id);
    if (!contact) {
      throw new NotFoundException(`Contact with ID ${id} not found`);
    }

    const uniqueTags = [...new Set([...contact.tags, ...tags])];
    contact.tags = uniqueTags;
    contact.updatedAt = new Date();

    return { success: true, data: contact };
  }

  async removeTags(id: string, tags: string[]) {
    const contact = this.contacts.get(id);
    if (!contact) {
      throw new NotFoundException(`Contact with ID ${id} not found`);
    }

    contact.tags = contact.tags.filter(t => !tags.includes(t));
    contact.updatedAt = new Date();

    return { success: true, data: contact };
  }

  async bulkImport(contacts: CreateContactDto[]) {
    const results = await Promise.all(contacts.map(c => this.create(c)));
    return {
      success: true,
      data: {
        imported: results.length,
        failed: 0,
      },
    };
  }

  async bulkExport(filters?: Record<string, any>, format?: string) {
    return {
      success: true,
      data: {
        jobId: `export_${Date.now()}`,
        status: 'processing',
        format: format || 'csv',
      },
    };
  }
}

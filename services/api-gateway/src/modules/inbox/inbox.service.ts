import { Injectable, NotFoundException } from '@nestjs/common';

interface Message {
  id: string;
  conversationId: string;
  direction: 'inbound' | 'outbound';
  content: { type: string; text?: string; mediaUrl?: string };
  status: 'sent' | 'delivered' | 'read' | 'failed';
  sentAt: Date;
  deliveredAt?: Date;
  readAt?: Date;
  sentBy?: string;
}

interface Conversation {
  id: string;
  contactId: string;
  contact: { id: string; fullName: string; email?: string; phone?: string; profileImageUrl?: string };
  channel: 'whatsapp' | 'email' | 'sms' | 'web_chat';
  status: 'open' | 'pending' | 'resolved' | 'snoozed';
  assignedTo?: string;
  assignedToName?: string;
  department?: string;
  lastMessageAt: Date;
  lastMessagePreview?: string;
  unreadCount: number;
  tags: string[];
  priority: 'low' | 'medium' | 'high' | 'urgent';
  createdAt: Date;
  updatedAt: Date;
}

@Injectable()
export class InboxService {
  private conversations: Map<string, Conversation> = new Map();
  private messages: Map<string, Message[]> = new Map();

  constructor() {
    this.seedSampleData();
  }

  private seedSampleData() {
    const sampleConversations: Conversation[] = [
      {
        id: 'cnv_1',
        contactId: 'con_1',
        contact: { id: 'con_1', fullName: 'Rahul Sharma', email: 'rahul@gmail.com', phone: '+91 98765 43210', profileImageUrl: 'https://api.dicebear.com/7.x/avataaars/svg?seed=Rahul' },
        channel: 'whatsapp',
        status: 'open',
        assignedTo: 'agent_1',
        assignedToName: 'Aisha Khan',
        department: 'Alumni Relations',
        lastMessageAt: new Date(),
        lastMessagePreview: 'Hi, I wanted to inquire about the upcoming reunion event.',
        unreadCount: 2,
        tags: ['reunion', 'inquiry'],
        priority: 'medium',
        createdAt: new Date('2024-01-14T08:00:00'),
        updatedAt: new Date(),
      },
      {
        id: 'cnv_2',
        contactId: 'con_2',
        contact: { id: 'con_2', fullName: 'Priya Patel', email: 'priya@outlook.com', phone: '+91 87654 32109', profileImageUrl: 'https://api.dicebear.com/7.x/avataaars/svg?seed=Priya' },
        channel: 'email',
        status: 'pending',
        department: 'Development Office',
        lastMessageAt: new Date('2024-01-14T09:30:00'),
        lastMessagePreview: 'I would like to make a donation to the scholarship fund.',
        unreadCount: 1,
        tags: ['donation', 'scholarship'],
        priority: 'high',
        createdAt: new Date('2024-01-14T09:00:00'),
        updatedAt: new Date('2024-01-14T09:30:00'),
      },
      {
        id: 'cnv_3',
        contactId: 'con_5',
        contact: { id: 'con_5', fullName: 'Vikram Malhotra', email: 'vikram@startupx.io', phone: '+91 99887 76655', profileImageUrl: 'https://api.dicebear.com/7.x/avataaars/svg?seed=Vikram' },
        channel: 'whatsapp',
        status: 'open',
        assignedTo: 'agent_2',
        assignedToName: 'Raj Menon',
        department: 'Career Services',
        lastMessageAt: new Date('2024-01-14T10:15:00'),
        lastMessagePreview: 'We are looking to hire 5 engineers from the upcoming batch.',
        unreadCount: 0,
        tags: ['placement', 'hiring'],
        priority: 'urgent',
        createdAt: new Date('2024-01-14T10:00:00'),
        updatedAt: new Date('2024-01-14T10:15:00'),
      },
      {
        id: 'cnv_4',
        contactId: 'con_4',
        contact: { id: 'con_4', fullName: 'Sneha Gupta', email: 'sneha@iitb.ac.in', phone: '+91 76543 21098', profileImageUrl: 'https://api.dicebear.com/7.x/avataaars/svg?seed=Sneha' },
        channel: 'whatsapp',
        status: 'resolved',
        assignedTo: 'agent_1',
        assignedToName: 'Aisha Khan',
        department: 'Career Services',
        lastMessageAt: new Date('2024-01-13T16:00:00'),
        lastMessagePreview: 'Thank you for the placement assistance!',
        unreadCount: 0,
        tags: ['placement', 'thank-you'],
        priority: 'low',
        createdAt: new Date('2024-01-13T14:00:00'),
        updatedAt: new Date('2024-01-13T16:00:00'),
      },
    ];

    sampleConversations.forEach(c => this.conversations.set(c.id, c));

    // Sample messages for conversation 1
    this.messages.set('cnv_1', [
      { id: 'msg_1', conversationId: 'cnv_1', direction: 'inbound', content: { type: 'text', text: 'Hi, I wanted to inquire about the upcoming reunion event.' }, status: 'read', sentAt: new Date('2024-01-14T08:00:00'), readAt: new Date('2024-01-14T08:05:00') },
      { id: 'msg_2', conversationId: 'cnv_1', direction: 'outbound', content: { type: 'text', text: 'Hello Rahul! Thanks for reaching out. The reunion is scheduled for March 15th, 2024 at the main campus.' }, status: 'delivered', sentAt: new Date('2024-01-14T08:10:00'), deliveredAt: new Date('2024-01-14T08:10:05'), sentBy: 'agent_1' },
      { id: 'msg_3', conversationId: 'cnv_1', direction: 'inbound', content: { type: 'text', text: 'Great! How do I register?' }, status: 'delivered', sentAt: new Date('2024-01-14T08:15:00') },
      { id: 'msg_4', conversationId: 'cnv_1', direction: 'inbound', content: { type: 'text', text: 'Also, can I bring my family?' }, status: 'delivered', sentAt: new Date('2024-01-14T08:16:00') },
    ]);

    this.messages.set('cnv_2', [
      { id: 'msg_5', conversationId: 'cnv_2', direction: 'inbound', content: { type: 'text', text: 'I would like to make a donation to the scholarship fund. What is the process?' }, status: 'read', sentAt: new Date('2024-01-14T09:00:00'), readAt: new Date('2024-01-14T09:05:00') },
      { id: 'msg_6', conversationId: 'cnv_2', direction: 'inbound', content: { type: 'text', text: 'I want to specifically support students from underprivileged backgrounds.' }, status: 'delivered', sentAt: new Date('2024-01-14T09:30:00') },
    ]);

    this.messages.set('cnv_3', [
      { id: 'msg_7', conversationId: 'cnv_3', direction: 'inbound', content: { type: 'text', text: 'Hello, this is Vikram from StartupX. We are looking to hire 5 engineers from the upcoming batch.' }, status: 'read', sentAt: new Date('2024-01-14T10:00:00'), readAt: new Date('2024-01-14T10:02:00') },
      { id: 'msg_8', conversationId: 'cnv_3', direction: 'outbound', content: { type: 'text', text: 'Hi Vikram! Great to hear from you. I will connect you with our placement cell. Could you share the JD?' }, status: 'read', sentAt: new Date('2024-01-14T10:05:00'), readAt: new Date('2024-01-14T10:06:00'), sentBy: 'agent_2' },
      { id: 'msg_9', conversationId: 'cnv_3', direction: 'inbound', content: { type: 'text', text: 'Sure, sending it now.' }, status: 'read', sentAt: new Date('2024-01-14T10:10:00'), readAt: new Date('2024-01-14T10:11:00') },
      { id: 'msg_10', conversationId: 'cnv_3', direction: 'inbound', content: { type: 'document', mediaUrl: 'https://example.com/jd.pdf' }, status: 'delivered', sentAt: new Date('2024-01-14T10:15:00') },
    ]);
  }

  async findAllConversations(query: Record<string, any>) {
    const { page = 1, limit = 20, status, channel, assignedTo, search } = query;
    let results = Array.from(this.conversations.values());

    if (status) results = results.filter(c => c.status === status);
    if (channel) results = results.filter(c => c.channel === channel);
    if (assignedTo) results = results.filter(c => c.assignedTo === assignedTo);
    if (search) {
      const searchLower = search.toLowerCase();
      results = results.filter(c =>
        c.contact.fullName.toLowerCase().includes(searchLower) ||
        c.lastMessagePreview?.toLowerCase().includes(searchLower)
      );
    }

    results.sort((a, b) => b.lastMessageAt.getTime() - a.lastMessageAt.getTime());

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
    const conversations = Array.from(this.conversations.values());
    return {
      success: true,
      data: {
        total: conversations.length,
        byStatus: {
          open: conversations.filter(c => c.status === 'open').length,
          pending: conversations.filter(c => c.status === 'pending').length,
          resolved: conversations.filter(c => c.status === 'resolved').length,
          snoozed: conversations.filter(c => c.status === 'snoozed').length,
        },
        byChannel: {
          whatsapp: conversations.filter(c => c.channel === 'whatsapp').length,
          email: conversations.filter(c => c.channel === 'email').length,
          sms: conversations.filter(c => c.channel === 'sms').length,
        },
        unread: conversations.reduce((sum, c) => sum + c.unreadCount, 0),
        avgResponseTime: '12m 30s',
      },
    };
  }

  async findOneConversation(id: string) {
    const conversation = this.conversations.get(id);
    if (!conversation) throw new NotFoundException(`Conversation ${id} not found`);
    return { success: true, data: conversation };
  }

  async getMessages(id: string, query: Record<string, any>) {
    const conversation = this.conversations.get(id);
    if (!conversation) throw new NotFoundException(`Conversation ${id} not found`);

    const messages = this.messages.get(id) || [];
    return {
      success: true,
      data: messages.sort((a, b) => a.sentAt.getTime() - b.sentAt.getTime()),
      meta: { total: messages.length },
    };
  }

  async sendMessage(id: string, dto: any) {
    const conversation = this.conversations.get(id);
    if (!conversation) throw new NotFoundException(`Conversation ${id} not found`);

    const message: Message = {
      id: `msg_${Date.now()}`,
      conversationId: id,
      direction: 'outbound',
      content: dto.content,
      status: 'sent',
      sentAt: new Date(),
      sentBy: 'current_user',
    };

    const messages = this.messages.get(id) || [];
    messages.push(message);
    this.messages.set(id, messages);

    conversation.lastMessageAt = new Date();
    conversation.lastMessagePreview = dto.content.text || '[Media]';
    conversation.updatedAt = new Date();

    return { success: true, data: message };
  }

  async updateConversation(id: string, dto: any) {
    const conversation = this.conversations.get(id);
    if (!conversation) throw new NotFoundException(`Conversation ${id} not found`);

    Object.assign(conversation, dto, { updatedAt: new Date() });
    return { success: true, data: conversation };
  }

  async assign(id: string, agentId: string) {
    const conversation = this.conversations.get(id);
    if (!conversation) throw new NotFoundException(`Conversation ${id} not found`);

    conversation.assignedTo = agentId;
    conversation.assignedToName = 'Agent Name';
    conversation.updatedAt = new Date();
    return { success: true, data: conversation };
  }

  async resolve(id: string) {
    const conversation = this.conversations.get(id);
    if (!conversation) throw new NotFoundException(`Conversation ${id} not found`);

    conversation.status = 'resolved';
    conversation.updatedAt = new Date();
    return { success: true, data: conversation };
  }

  async snooze(id: string, until: string) {
    const conversation = this.conversations.get(id);
    if (!conversation) throw new NotFoundException(`Conversation ${id} not found`);

    conversation.status = 'snoozed';
    conversation.updatedAt = new Date();
    return { success: true, data: conversation };
  }

  async getCannedResponses() {
    return {
      success: true,
      data: [
        { id: 'cr_1', title: 'Greeting', content: 'Hello! Thank you for reaching out. How can I assist you today?' },
        { id: 'cr_2', title: 'Reunion Info', content: 'The annual alumni reunion is scheduled for March 15th at the main campus. You can register at alumni.edu/reunion.' },
        { id: 'cr_3', title: 'Donation Info', content: 'Thank you for your interest in supporting us! You can make a donation at alumni.edu/donate or contact our Development Office.' },
        { id: 'cr_4', title: 'Placement Help', content: 'Our Career Services team will be happy to assist you. I\'m connecting you with them now.' },
        { id: 'cr_5', title: 'Thank You', content: 'Thank you for your message. Is there anything else I can help you with?' },
      ],
    };
  }
}

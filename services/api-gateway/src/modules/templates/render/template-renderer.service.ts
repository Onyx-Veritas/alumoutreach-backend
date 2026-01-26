import { Injectable, BadRequestException } from '@nestjs/common';
import { AppLoggerService } from '../../../common/logger/app-logger.service';
import { TemplateChannel } from '../entities/template.entity';
import {
  TemplateContent,
  EmailContent,
  SmsContent,
  WhatsAppContent,
  PushContent,
  RcsContent,
} from '../entities/template-version.entity';

export interface RenderResult {
  renderedContent: TemplateContent;
  variablesUsed: string[];
  missingVariables: string[];
  renderTime: number;
}

export interface RenderOptions {
  strictMode?: boolean; // Throw error on missing variables
  defaultValue?: string; // Default value for missing variables
  preserveMissing?: boolean; // Keep {{var}} syntax for missing variables
}

@Injectable()
export class TemplateRendererService {
  private readonly logger: AppLoggerService;

  constructor() {
    this.logger = new AppLoggerService();
    this.logger.setContext('TemplateRendererService');
  }

  render(
    channel: TemplateChannel,
    content: TemplateContent,
    variables: Record<string, string>,
    options: RenderOptions = {},
  ): RenderResult {
    const startTime = this.logger.logOperationStart('render template', { channel });

    try {
      const {
        strictMode = false,
        defaultValue = '',
        preserveMissing = false,
      } = options;

      const usedVariables: string[] = [];
      const missingVariables: string[] = [];

      // Clone content to avoid mutating original
      const clonedContent = JSON.parse(JSON.stringify(content));

      // Render based on channel
      let renderedContent: TemplateContent;
      switch (channel) {
        case TemplateChannel.EMAIL:
          renderedContent = this.renderEmail(clonedContent as EmailContent, variables, usedVariables, missingVariables, { strictMode, defaultValue, preserveMissing });
          break;
        case TemplateChannel.SMS:
          renderedContent = this.renderSms(clonedContent as SmsContent, variables, usedVariables, missingVariables, { strictMode, defaultValue, preserveMissing });
          break;
        case TemplateChannel.WHATSAPP:
          renderedContent = this.renderWhatsApp(clonedContent as WhatsAppContent, variables, usedVariables, missingVariables, { strictMode, defaultValue, preserveMissing });
          break;
        case TemplateChannel.PUSH:
          renderedContent = this.renderPush(clonedContent as PushContent, variables, usedVariables, missingVariables, { strictMode, defaultValue, preserveMissing });
          break;
        case TemplateChannel.RCS:
          renderedContent = this.renderRcs(clonedContent as RcsContent, variables, usedVariables, missingVariables, { strictMode, defaultValue, preserveMissing });
          break;
        default:
          throw new BadRequestException(`Unsupported channel: ${channel}`);
      }

      // Log missing variables as warnings
      if (missingVariables.length > 0) {
        this.logger.warn('Missing variables during render', {
          channel,
          missingVariables,
          provided: Object.keys(variables),
        });
      }

      const elapsed = Date.now() - startTime;
      this.logger.logOperationEnd('render template', startTime, {
        variablesUsed: usedVariables.length,
        missingVariables: missingVariables.length,
      });

      return {
        renderedContent,
        variablesUsed: [...new Set(usedVariables)],
        missingVariables: [...new Set(missingVariables)],
        renderTime: elapsed,
      };
    } catch (error) {
      this.logger.logOperationError('render template', error as Error, { channel });
      throw error;
    }
  }

  // ============ Email Renderer ============

  private renderEmail(
    content: EmailContent,
    variables: Record<string, string>,
    usedVars: string[],
    missingVars: string[],
    options: RenderOptions,
  ): EmailContent {
    return {
      subject: this.interpolate(content.subject, variables, usedVars, missingVars, options),
      htmlBody: this.interpolate(content.htmlBody, variables, usedVars, missingVars, options),
      textBody: content.textBody ? this.interpolate(content.textBody, variables, usedVars, missingVars, options) : undefined,
      preheader: content.preheader ? this.interpolate(content.preheader, variables, usedVars, missingVars, options) : undefined,
      replyTo: content.replyTo,
      fromName: content.fromName ? this.interpolate(content.fromName, variables, usedVars, missingVars, options) : undefined,
    };
  }

  // ============ SMS Renderer ============

  private renderSms(
    content: SmsContent,
    variables: Record<string, string>,
    usedVars: string[],
    missingVars: string[],
    options: RenderOptions,
  ): SmsContent {
    return {
      body: this.interpolate(content.body, variables, usedVars, missingVars, options),
      senderId: content.senderId,
    };
  }

  // ============ WhatsApp Renderer ============

  private renderWhatsApp(
    content: WhatsAppContent,
    variables: Record<string, string>,
    usedVars: string[],
    missingVars: string[],
    options: RenderOptions,
  ): WhatsAppContent {
    const rendered: WhatsAppContent = {
      templateName: content.templateName,
      language: content.language,
      body: this.interpolateWhatsApp(content.body, variables, usedVars, missingVars, options),
    };

    if (content.header) {
      rendered.header = { ...content.header };
      if (content.header.type === 'text' && content.header.text) {
        rendered.header.text = this.interpolateWhatsApp(content.header.text, variables, usedVars, missingVars, options);
      }
    }

    if (content.footer) {
      rendered.footer = content.footer;
    }

    if (content.buttons) {
      rendered.buttons = content.buttons.map(btn => ({
        ...btn,
        url: btn.url ? this.interpolate(btn.url, variables, usedVars, missingVars, options) : undefined,
      }));
    }

    return rendered;
  }

  // ============ Push Renderer ============

  private renderPush(
    content: PushContent,
    variables: Record<string, string>,
    usedVars: string[],
    missingVars: string[],
    options: RenderOptions,
  ): PushContent {
    return {
      title: this.interpolate(content.title, variables, usedVars, missingVars, options),
      body: this.interpolate(content.body, variables, usedVars, missingVars, options),
      icon: content.icon,
      image: content.image,
      badge: content.badge,
      clickAction: content.clickAction ? this.interpolate(content.clickAction, variables, usedVars, missingVars, options) : undefined,
      data: content.data,
    };
  }

  // ============ RCS Renderer ============

  private renderRcs(
    content: RcsContent,
    variables: Record<string, string>,
    usedVars: string[],
    missingVars: string[],
    options: RenderOptions,
  ): RcsContent {
    const rendered: RcsContent = {
      type: content.type,
    };

    if (content.text) {
      rendered.text = this.interpolate(content.text, variables, usedVars, missingVars, options);
    }

    if (content.cards) {
      rendered.cards = content.cards.map(card => ({
        ...card,
        title: this.interpolate(card.title, variables, usedVars, missingVars, options),
        description: card.description ? this.interpolate(card.description, variables, usedVars, missingVars, options) : undefined,
      }));
    }

    if (content.suggestions) {
      rendered.suggestions = content.suggestions;
    }

    return rendered;
  }

  // ============ Interpolation Helpers ============

  private interpolate(
    text: string,
    variables: Record<string, string>,
    usedVars: string[],
    missingVars: string[],
    options: RenderOptions,
  ): string {
    if (!text) return text;

    const { strictMode, defaultValue, preserveMissing } = options;

    return text.replace(/\{\{([^}]+)\}\}/g, (match, varName) => {
      const trimmedVar = varName.trim();
      
      if (variables.hasOwnProperty(trimmedVar)) {
        usedVars.push(trimmedVar);
        return this.escapeHtml(String(variables[trimmedVar]));
      }

      missingVars.push(trimmedVar);

      if (strictMode) {
        throw new BadRequestException(`Missing required variable: ${trimmedVar}`);
      }

      if (preserveMissing) {
        return match;
      }

      return defaultValue || '';
    });
  }

  private interpolateWhatsApp(
    text: string,
    variables: Record<string, string>,
    usedVars: string[],
    missingVars: string[],
    options: RenderOptions,
  ): string {
    if (!text) return text;

    const { strictMode, defaultValue, preserveMissing } = options;

    // WhatsApp uses numbered variables: {{1}}, {{2}}, etc.
    return text.replace(/\{\{(\d+)\}\}/g, (match, varNum) => {
      const varKey = varNum;
      
      if (variables.hasOwnProperty(varKey)) {
        usedVars.push(varKey);
        return String(variables[varKey]);
      }

      missingVars.push(varKey);

      if (strictMode) {
        throw new BadRequestException(`Missing required variable: {{${varNum}}}`);
      }

      if (preserveMissing) {
        return match;
      }

      return defaultValue || '';
    });
  }

  private escapeHtml(text: string): string {
    const htmlEntities: Record<string, string> = {
      '&': '&amp;',
      '<': '&lt;',
      '>': '&gt;',
      '"': '&quot;',
      "'": '&#39;',
    };
    return text.replace(/[&<>"']/g, char => htmlEntities[char]);
  }

  // ============ Variable Extraction ============

  extractVariables(channel: TemplateChannel, content: TemplateContent): string[] {
    const variables: string[] = [];

    const extractFromText = (text: string | undefined, isWhatsApp = false): void => {
      if (!text) return;
      const regex = isWhatsApp ? /\{\{(\d+)\}\}/g : /\{\{([^}]+)\}\}/g;
      let match;
      while ((match = regex.exec(text)) !== null) {
        const varName = match[1].trim();
        if (!variables.includes(varName)) {
          variables.push(varName);
        }
      }
    };

    switch (channel) {
      case TemplateChannel.EMAIL: {
        const email = content as EmailContent;
        extractFromText(email.subject);
        extractFromText(email.htmlBody);
        extractFromText(email.textBody);
        extractFromText(email.preheader);
        extractFromText(email.fromName);
        break;
      }
      case TemplateChannel.SMS: {
        const sms = content as SmsContent;
        extractFromText(sms.body);
        break;
      }
      case TemplateChannel.WHATSAPP: {
        const wa = content as WhatsAppContent;
        extractFromText(wa.body, true);
        if (wa.header?.type === 'text') {
          extractFromText(wa.header.text, true);
        }
        break;
      }
      case TemplateChannel.PUSH: {
        const push = content as PushContent;
        extractFromText(push.title);
        extractFromText(push.body);
        extractFromText(push.clickAction);
        break;
      }
      case TemplateChannel.RCS: {
        const rcs = content as RcsContent;
        extractFromText(rcs.text);
        if (rcs.cards) {
          rcs.cards.forEach(card => {
            extractFromText(card.title);
            extractFromText(card.description);
          });
        }
        break;
      }
    }

    return variables;
  }

  // ============ Preview Generation ============

  generatePreview(
    channel: TemplateChannel,
    content: TemplateContent,
    sampleData?: Record<string, string>,
  ): RenderResult {
    // Generate sample data if not provided
    const variables = this.extractVariables(channel, content);
    const previewData: Record<string, string> = sampleData || {};

    // Fill in missing variables with sample values
    for (const variable of variables) {
      if (!previewData[variable]) {
        previewData[variable] = this.getSampleValue(variable);
      }
    }

    return this.render(channel, content, previewData, { preserveMissing: false });
  }

  private getSampleValue(variable: string): string {
    // WhatsApp numbered variables
    if (/^\d+$/.test(variable)) {
      return `[Value ${variable}]`;
    }

    // Common variable names with sample values
    const sampleValues: Record<string, string> = {
      firstName: 'Rahul',
      lastName: 'Sharma',
      fullName: 'Rahul Sharma',
      name: 'Rahul',
      email: 'rahul@example.com',
      phone: '+91 98765 43210',
      company: 'Acme Corp',
      designation: 'Software Engineer',
      program: 'B.Tech Computer Science',
      batchYear: '2020',
      graduationYear: '2024',
      department: 'Engineering',
      date: new Date().toLocaleDateString(),
      time: new Date().toLocaleTimeString(),
      amount: '₹10,000',
      link: 'https://example.com',
      eventName: 'Annual Alumni Meet',
      month: 'January',
      year: String(new Date().getFullYear()),
    };

    const lowerVar = variable.toLowerCase();
    for (const [key, value] of Object.entries(sampleValues)) {
      if (lowerVar.includes(key.toLowerCase())) {
        return value;
      }
    }

    // Default sample value
    return `[${variable}]`;
  }
}

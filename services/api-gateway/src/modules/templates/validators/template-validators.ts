import { Injectable } from '@nestjs/common';
import { AppLoggerService } from '../../../common/logger/app-logger.service';
import { TemplateChannel } from '../entities/template.entity';
import {
  EmailContent,
  SmsContent,
  WhatsAppContent,
  PushContent,
  RcsContent,
  TemplateContent,
} from '../entities/template-version.entity';

export interface ValidationResult {
  isValid: boolean;
  errors: Array<{ field: string; message: string }>;
  warnings: Array<{ field: string; message: string }>;
  variables: string[];
}

// ============ Base Validator ============

export abstract class BaseTemplateValidator {
  protected logger: AppLoggerService;

  constructor() {
    this.logger = new AppLoggerService();
  }

  abstract validate(content: TemplateContent): ValidationResult;

  protected extractVariables(text: string): string[] {
    if (!text) return [];
    const regex = /\{\{([^}]+)\}\}/g;
    const variables: string[] = [];
    let match;
    while ((match = regex.exec(text)) !== null) {
      const varName = match[1].trim();
      if (!variables.includes(varName)) {
        variables.push(varName);
      }
    }
    return variables;
  }

  protected containsHtml(text: string): boolean {
    if (!text) return false;
    return /<[a-z][\s\S]*>/i.test(text);
  }

  protected hasInvalidUnicode(text: string): boolean {
    if (!text) return false;
    // Check for surrogates and other problematic characters
    return /[\uD800-\uDFFF]/.test(text) && !/[\uD800-\uDBFF][\uDC00-\uDFFF]/.test(text);
  }
}

// ============ Email Validator ============

@Injectable()
export class EmailTemplateValidator extends BaseTemplateValidator {
  constructor() {
    super();
    this.logger.setContext('EmailTemplateValidator');
  }

  validate(content: TemplateContent): ValidationResult {
    const emailContent = content as EmailContent;
    const errors: Array<{ field: string; message: string }> = [];
    const warnings: Array<{ field: string; message: string }> = [];
    const allVariables: string[] = [];

    // Subject validation
    if (!emailContent.subject || emailContent.subject.trim().length === 0) {
      errors.push({ field: 'subject', message: 'Subject is required' });
    } else {
      if (emailContent.subject.length > 998) {
        errors.push({ field: 'subject', message: 'Subject exceeds maximum length of 998 characters' });
      }
      allVariables.push(...this.extractVariables(emailContent.subject));
    }

    // HTML body validation
    if (!emailContent.htmlBody || emailContent.htmlBody.trim().length === 0) {
      errors.push({ field: 'htmlBody', message: 'HTML body is required' });
    } else {
      allVariables.push(...this.extractVariables(emailContent.htmlBody));

      // Check for common issues
      if (!emailContent.htmlBody.includes('</')) {
        warnings.push({ field: 'htmlBody', message: 'HTML body appears to have no closing tags' });
      }

      // Check for script tags (XSS)
      if (/<script/i.test(emailContent.htmlBody)) {
        errors.push({ field: 'htmlBody', message: 'Script tags are not allowed in email templates' });
      }

      // Check for on* event handlers (XSS)
      if (/\son\w+\s*=/i.test(emailContent.htmlBody)) {
        errors.push({ field: 'htmlBody', message: 'Event handlers (onclick, etc.) are not allowed' });
      }
    }

    // Text body (optional but recommended)
    if (emailContent.textBody) {
      allVariables.push(...this.extractVariables(emailContent.textBody));
    } else {
      warnings.push({ field: 'textBody', message: 'Plain text version recommended for accessibility' });
    }

    // Preheader validation
    if (emailContent.preheader) {
      if (emailContent.preheader.length > 250) {
        errors.push({ field: 'preheader', message: 'Preheader exceeds maximum length of 250 characters' });
      }
      allVariables.push(...this.extractVariables(emailContent.preheader));
    }

    // Unique variables
    const uniqueVars = [...new Set(allVariables)];

    this.logger.debug('Email template validated', {
      isValid: errors.length === 0,
      errorCount: errors.length,
      warningCount: warnings.length,
      variableCount: uniqueVars.length,
    });

    return {
      isValid: errors.length === 0,
      errors,
      warnings,
      variables: uniqueVars,
    };
  }
}

// ============ SMS Validator ============

@Injectable()
export class SmsTemplateValidator extends BaseTemplateValidator {
  private readonly GSM_7_CHARS = '@£$¥èéùìòÇ\nØø\rÅåΔ_ΦΓΛΩΠΨΣΘΞ !"#¤%&\'()*+,-./0123456789:;<=>?¡ABCDEFGHIJKLMNOPQRSTUVWXYZÄÖÑÜ§¿abcdefghijklmnopqrstuvwxyzäöñüà';
  private readonly MAX_GSM_LENGTH = 160;
  private readonly MAX_UNICODE_LENGTH = 70;
  private readonly MAX_CONCATENATED_LENGTH = 1600;

  constructor() {
    super();
    this.logger.setContext('SmsTemplateValidator');
  }

  validate(content: TemplateContent): ValidationResult {
    const smsContent = content as SmsContent;
    const errors: Array<{ field: string; message: string }> = [];
    const warnings: Array<{ field: string; message: string }> = [];
    const allVariables: string[] = [];

    // Body validation
    if (!smsContent.body || smsContent.body.trim().length === 0) {
      errors.push({ field: 'body', message: 'SMS body is required' });
    } else {
      // Check for HTML
      if (this.containsHtml(smsContent.body)) {
        errors.push({ field: 'body', message: 'HTML is not allowed in SMS templates' });
      }

      // Check length
      if (smsContent.body.length > this.MAX_CONCATENATED_LENGTH) {
        errors.push({ field: 'body', message: `SMS body exceeds maximum length of ${this.MAX_CONCATENATED_LENGTH} characters` });
      }

      // Check for invalid unicode
      if (this.hasInvalidUnicode(smsContent.body)) {
        errors.push({ field: 'body', message: 'SMS body contains invalid Unicode characters' });
      }

      // Check if GSM-7 or Unicode
      const isGsm7 = this.isGsm7Compatible(smsContent.body);
      if (!isGsm7) {
        warnings.push({ field: 'body', message: 'SMS contains non-GSM characters, will be sent as Unicode (shorter segment length)' });
      }

      // Segment count warning
      const segments = this.calculateSegments(smsContent.body);
      if (segments > 1) {
        warnings.push({ field: 'body', message: `SMS will be sent as ${segments} segments` });
      }

      allVariables.push(...this.extractVariables(smsContent.body));
    }

    // Sender ID validation
    if (smsContent.senderId) {
      if (smsContent.senderId.length > 11) {
        errors.push({ field: 'senderId', message: 'Sender ID must not exceed 11 characters' });
      }
      if (!/^[a-zA-Z0-9]+$/.test(smsContent.senderId)) {
        errors.push({ field: 'senderId', message: 'Sender ID must be alphanumeric' });
      }
    }

    const uniqueVars = [...new Set(allVariables)];

    this.logger.debug('SMS template validated', {
      isValid: errors.length === 0,
      errorCount: errors.length,
      warningCount: warnings.length,
      variableCount: uniqueVars.length,
    });

    return {
      isValid: errors.length === 0,
      errors,
      warnings,
      variables: uniqueVars,
    };
  }

  private isGsm7Compatible(text: string): boolean {
    for (const char of text) {
      if (!this.GSM_7_CHARS.includes(char) && char !== '\r\n') {
        return false;
      }
    }
    return true;
  }

  private calculateSegments(text: string): number {
    const isGsm7 = this.isGsm7Compatible(text);
    const maxSingle = isGsm7 ? this.MAX_GSM_LENGTH : this.MAX_UNICODE_LENGTH;
    const maxConcat = isGsm7 ? 153 : 67;

    if (text.length <= maxSingle) return 1;
    return Math.ceil(text.length / maxConcat);
  }
}

// ============ WhatsApp Validator ============

@Injectable()
export class WhatsAppTemplateValidator extends BaseTemplateValidator {
  private readonly MAX_BODY_LENGTH = 1024;
  private readonly MAX_FOOTER_LENGTH = 60;
  private readonly MAX_BUTTON_TEXT_LENGTH = 25;
  private readonly MAX_BUTTONS = 3;

  constructor() {
    super();
    this.logger.setContext('WhatsAppTemplateValidator');
  }

  validate(content: TemplateContent): ValidationResult {
    const waContent = content as WhatsAppContent;
    const errors: Array<{ field: string; message: string }> = [];
    const warnings: Array<{ field: string; message: string }> = [];
    const allVariables: string[] = [];

    // Template name validation
    if (!waContent.templateName || waContent.templateName.trim().length === 0) {
      errors.push({ field: 'templateName', message: 'WhatsApp template name is required' });
    } else {
      // WhatsApp template names must be lowercase with underscores
      if (!/^[a-z][a-z0-9_]*$/.test(waContent.templateName)) {
        errors.push({ field: 'templateName', message: 'Template name must be lowercase, start with a letter, and contain only letters, numbers, and underscores' });
      }
    }

    // Language validation
    if (!waContent.language) {
      errors.push({ field: 'language', message: 'Language code is required' });
    }

    // Body validation
    if (!waContent.body || waContent.body.trim().length === 0) {
      errors.push({ field: 'body', message: 'Body is required' });
    } else {
      if (waContent.body.length > this.MAX_BODY_LENGTH) {
        errors.push({ field: 'body', message: `Body exceeds maximum length of ${this.MAX_BODY_LENGTH} characters` });
      }

      // WhatsApp variables must be numbered: {{1}}, {{2}}, etc.
      const waVars = this.extractWhatsAppVariables(waContent.body);
      allVariables.push(...waVars);

      // Validate variable numbering
      const varNumbers = waVars.map(v => parseInt(v, 10)).filter(n => !isNaN(n)).sort((a, b) => a - b);
      for (let i = 0; i < varNumbers.length; i++) {
        if (varNumbers[i] !== i + 1) {
          errors.push({ field: 'body', message: 'WhatsApp variables must be consecutively numbered starting from 1' });
          break;
        }
      }
    }

    // Header validation
    if (waContent.header) {
      if (!['text', 'image', 'document', 'video'].includes(waContent.header.type)) {
        errors.push({ field: 'header.type', message: 'Invalid header type' });
      }

      if (waContent.header.type === 'text') {
        if (!waContent.header.text) {
          errors.push({ field: 'header.text', message: 'Header text is required for text type' });
        } else {
          allVariables.push(...this.extractWhatsAppVariables(waContent.header.text));
        }
      } else if (!waContent.header.mediaUrl) {
        warnings.push({ field: 'header.mediaUrl', message: 'Media URL should be provided for media headers' });
      }
    }

    // Footer validation
    if (waContent.footer) {
      if (waContent.footer.length > this.MAX_FOOTER_LENGTH) {
        errors.push({ field: 'footer', message: `Footer exceeds maximum length of ${this.MAX_FOOTER_LENGTH} characters` });
      }
    }

    // Buttons validation
    if (waContent.buttons && waContent.buttons.length > 0) {
      if (waContent.buttons.length > this.MAX_BUTTONS) {
        errors.push({ field: 'buttons', message: `Maximum ${this.MAX_BUTTONS} buttons allowed` });
      }

      waContent.buttons.forEach((button, idx) => {
        if (button.text.length > this.MAX_BUTTON_TEXT_LENGTH) {
          errors.push({ field: `buttons[${idx}].text`, message: `Button text exceeds ${this.MAX_BUTTON_TEXT_LENGTH} characters` });
        }

        if (button.type === 'url' && !button.url) {
          errors.push({ field: `buttons[${idx}].url`, message: 'URL is required for URL button type' });
        }

        if (button.type === 'phone_number' && !button.phoneNumber) {
          errors.push({ field: `buttons[${idx}].phoneNumber`, message: 'Phone number is required for phone button type' });
        }
      });
    }

    const uniqueVars = [...new Set(allVariables)];

    this.logger.debug('WhatsApp template validated', {
      isValid: errors.length === 0,
      errorCount: errors.length,
      warningCount: warnings.length,
      variableCount: uniqueVars.length,
    });

    return {
      isValid: errors.length === 0,
      errors,
      warnings,
      variables: uniqueVars,
    };
  }

  private extractWhatsAppVariables(text: string): string[] {
    if (!text) return [];
    const regex = /\{\{(\d+)\}\}/g;
    const variables: string[] = [];
    let match;
    while ((match = regex.exec(text)) !== null) {
      if (!variables.includes(match[1])) {
        variables.push(match[1]);
      }
    }
    return variables;
  }
}

// ============ Push Notification Validator ============

@Injectable()
export class PushTemplateValidator extends BaseTemplateValidator {
  private readonly MAX_TITLE_LENGTH = 65;
  private readonly MAX_BODY_LENGTH = 240;

  constructor() {
    super();
    this.logger.setContext('PushTemplateValidator');
  }

  validate(content: TemplateContent): ValidationResult {
    const pushContent = content as PushContent;
    const errors: Array<{ field: string; message: string }> = [];
    const warnings: Array<{ field: string; message: string }> = [];
    const allVariables: string[] = [];

    // Title validation
    if (!pushContent.title || pushContent.title.trim().length === 0) {
      errors.push({ field: 'title', message: 'Title is required' });
    } else {
      if (pushContent.title.length > this.MAX_TITLE_LENGTH) {
        errors.push({ field: 'title', message: `Title exceeds maximum length of ${this.MAX_TITLE_LENGTH} characters` });
      }
      allVariables.push(...this.extractVariables(pushContent.title));
    }

    // Body validation
    if (!pushContent.body || pushContent.body.trim().length === 0) {
      errors.push({ field: 'body', message: 'Body is required' });
    } else {
      if (pushContent.body.length > this.MAX_BODY_LENGTH) {
        errors.push({ field: 'body', message: `Body exceeds maximum length of ${this.MAX_BODY_LENGTH} characters` });
      }
      allVariables.push(...this.extractVariables(pushContent.body));
    }

    // URL validations
    if (pushContent.icon && !this.isValidUrl(pushContent.icon)) {
      warnings.push({ field: 'icon', message: 'Icon should be a valid URL' });
    }

    if (pushContent.image && !this.isValidUrl(pushContent.image)) {
      warnings.push({ field: 'image', message: 'Image should be a valid URL' });
    }

    if (pushContent.clickAction && !this.isValidUrl(pushContent.clickAction)) {
      warnings.push({ field: 'clickAction', message: 'Click action should be a valid URL' });
    }

    const uniqueVars = [...new Set(allVariables)];

    this.logger.debug('Push template validated', {
      isValid: errors.length === 0,
      errorCount: errors.length,
      warningCount: warnings.length,
      variableCount: uniqueVars.length,
    });

    return {
      isValid: errors.length === 0,
      errors,
      warnings,
      variables: uniqueVars,
    };
  }

  private isValidUrl(url: string): boolean {
    try {
      new URL(url);
      return true;
    } catch {
      return false;
    }
  }
}

// ============ RCS Validator ============

@Injectable()
export class RcsTemplateValidator extends BaseTemplateValidator {
  private readonly MAX_TEXT_LENGTH = 2000;
  private readonly MAX_CARD_TITLE_LENGTH = 200;
  private readonly MAX_CARD_DESCRIPTION_LENGTH = 2000;
  private readonly MAX_SUGGESTION_TEXT_LENGTH = 25;
  private readonly MAX_CARDS_IN_CAROUSEL = 10;

  constructor() {
    super();
    this.logger.setContext('RcsTemplateValidator');
  }

  validate(content: TemplateContent): ValidationResult {
    const rcsContent = content as RcsContent;
    const errors: Array<{ field: string; message: string }> = [];
    const warnings: Array<{ field: string; message: string }> = [];
    const allVariables: string[] = [];

    // Type validation
    if (!rcsContent.type) {
      errors.push({ field: 'type', message: 'RCS message type is required' });
      return { isValid: false, errors, warnings, variables: [] };
    }

    if (!['text', 'card', 'carousel'].includes(rcsContent.type)) {
      errors.push({ field: 'type', message: 'Invalid RCS type. Must be text, card, or carousel' });
    }

    // Text type validation
    if (rcsContent.type === 'text') {
      if (!rcsContent.text || rcsContent.text.trim().length === 0) {
        errors.push({ field: 'text', message: 'Text is required for text type messages' });
      } else {
        if (rcsContent.text.length > this.MAX_TEXT_LENGTH) {
          errors.push({ field: 'text', message: `Text exceeds maximum length of ${this.MAX_TEXT_LENGTH} characters` });
        }
        allVariables.push(...this.extractVariables(rcsContent.text));
      }
    }

    // Card/Carousel validation
    if (rcsContent.type === 'card' || rcsContent.type === 'carousel') {
      if (!rcsContent.cards || rcsContent.cards.length === 0) {
        errors.push({ field: 'cards', message: 'At least one card is required' });
      } else {
        if (rcsContent.type === 'card' && rcsContent.cards.length > 1) {
          errors.push({ field: 'cards', message: 'Single card type should have exactly one card' });
        }

        if (rcsContent.type === 'carousel' && rcsContent.cards.length > this.MAX_CARDS_IN_CAROUSEL) {
          errors.push({ field: 'cards', message: `Carousel cannot have more than ${this.MAX_CARDS_IN_CAROUSEL} cards` });
        }

        rcsContent.cards.forEach((card, idx) => {
          if (!card.title || card.title.trim().length === 0) {
            errors.push({ field: `cards[${idx}].title`, message: 'Card title is required' });
          } else {
            if (card.title.length > this.MAX_CARD_TITLE_LENGTH) {
              errors.push({ field: `cards[${idx}].title`, message: `Card title exceeds ${this.MAX_CARD_TITLE_LENGTH} characters` });
            }
            allVariables.push(...this.extractVariables(card.title));
          }

          if (card.description) {
            if (card.description.length > this.MAX_CARD_DESCRIPTION_LENGTH) {
              errors.push({ field: `cards[${idx}].description`, message: `Card description exceeds ${this.MAX_CARD_DESCRIPTION_LENGTH} characters` });
            }
            allVariables.push(...this.extractVariables(card.description));
          }

          // Validate card suggestions
          if (card.suggestions) {
            this.validateSuggestions(card.suggestions, `cards[${idx}].suggestions`, errors);
          }
        });
      }
    }

    // Top-level suggestions validation
    if (rcsContent.suggestions) {
      this.validateSuggestions(rcsContent.suggestions, 'suggestions', errors);
    }

    const uniqueVars = [...new Set(allVariables)];

    this.logger.debug('RCS template validated', {
      isValid: errors.length === 0,
      errorCount: errors.length,
      warningCount: warnings.length,
      variableCount: uniqueVars.length,
    });

    return {
      isValid: errors.length === 0,
      errors,
      warnings,
      variables: uniqueVars,
    };
  }

  private validateSuggestions(
    suggestions: Array<{ type: string; text: string }>,
    path: string,
    errors: Array<{ field: string; message: string }>,
  ): void {
    suggestions.forEach((suggestion, idx) => {
      if (!suggestion.text || suggestion.text.trim().length === 0) {
        errors.push({ field: `${path}[${idx}].text`, message: 'Suggestion text is required' });
      } else if (suggestion.text.length > this.MAX_SUGGESTION_TEXT_LENGTH) {
        errors.push({ field: `${path}[${idx}].text`, message: `Suggestion text exceeds ${this.MAX_SUGGESTION_TEXT_LENGTH} characters` });
      }

      if (!['reply', 'action'].includes(suggestion.type)) {
        errors.push({ field: `${path}[${idx}].type`, message: 'Invalid suggestion type' });
      }
    });
  }
}

// ============ Validator Factory ============

@Injectable()
export class TemplateValidatorFactory {
  constructor(
    private readonly emailValidator: EmailTemplateValidator,
    private readonly smsValidator: SmsTemplateValidator,
    private readonly whatsappValidator: WhatsAppTemplateValidator,
    private readonly pushValidator: PushTemplateValidator,
    private readonly rcsValidator: RcsTemplateValidator,
  ) {}

  getValidator(channel: TemplateChannel): BaseTemplateValidator {
    switch (channel) {
      case TemplateChannel.EMAIL:
        return this.emailValidator;
      case TemplateChannel.SMS:
        return this.smsValidator;
      case TemplateChannel.WHATSAPP:
        return this.whatsappValidator;
      case TemplateChannel.PUSH:
        return this.pushValidator;
      case TemplateChannel.RCS:
        return this.rcsValidator;
      default:
        throw new Error(`No validator found for channel: ${channel}`);
    }
  }

  validate(channel: TemplateChannel, content: TemplateContent): ValidationResult {
    const validator = this.getValidator(channel);
    return validator.validate(content);
  }
}

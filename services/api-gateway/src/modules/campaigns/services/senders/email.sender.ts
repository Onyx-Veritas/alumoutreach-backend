import { Injectable, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { v4 as uuidv4 } from 'uuid';
import * as nodemailer from 'nodemailer';
import { Transporter } from 'nodemailer';
import sgMail from '@sendgrid/mail';
import { MailDataRequired } from '@sendgrid/helpers/classes/mail';
import { AppLoggerService } from '../../../../common/logger/app-logger.service';
import { CampaignChannel } from '../../entities/campaign.enums';

/**
 * Email sending modes:
 * - mock: Simulates sending (95% success rate, no actual email)
 * - console: Logs email content to console (100% success)
 * - mailhog: Sends to Mailhog SMTP for testing (real SMTP)
 * - smtp: Production SMTP (future: SES, etc.)
 * - sendgrid: Production email via SendGrid API
 */
export type EmailMode = 'mock' | 'console' | 'mailhog' | 'smtp' | 'sendgrid';

/**
 * Error codes for granular error classification
 * Used to determine retry behavior and skip reasons
 */
export enum EmailErrorCode {
  // Permanent errors (no retry)
  INVALID_EMAIL = 'INVALID_EMAIL',
  UNSUBSCRIBED = 'UNSUBSCRIBED',
  HARD_BOUNCE = 'HARD_BOUNCE',
  SPAM_COMPLAINT = 'SPAM_COMPLAINT',
  BLOCKED_ADDRESS = 'BLOCKED_ADDRESS',
  
  // Temporary errors (retry)
  SMTP_TIMEOUT = 'SMTP_TIMEOUT',
  SMTP_CONNECTION_ERROR = 'SMTP_CONNECTION_ERROR',
  RATE_LIMITED = 'RATE_LIMITED',
  SOFT_BOUNCE = 'SOFT_BOUNCE',
  SERVER_ERROR = 'SERVER_ERROR',
  
  // Unknown
  UNKNOWN = 'UNKNOWN',
}

/**
 * Check if an email error code is retryable
 */
export function isRetryableEmailError(code: EmailErrorCode): boolean {
  const retryableCodes = [
    EmailErrorCode.SMTP_TIMEOUT,
    EmailErrorCode.SMTP_CONNECTION_ERROR,
    EmailErrorCode.RATE_LIMITED,
    EmailErrorCode.SOFT_BOUNCE,
    EmailErrorCode.SERVER_ERROR,
  ];
  return retryableCodes.includes(code);
}

export interface SendResult {
  success: boolean;
  providerMessageId?: string;
  error?: string;
  errorCode?: EmailErrorCode; // Granular error classification
  retryable?: boolean;        // Whether the error is retryable
  metadata?: Record<string, unknown>;
}

export interface SendRequest {
  contactId: string;
  to: string; // email address
  subject: string;
  htmlBody: string;
  textBody?: string;
  fromName?: string;
  fromEmail?: string;
  replyTo?: string;
  headers?: Record<string, string>;
  metadata?: Record<string, unknown>;
}

@Injectable()
export class EmailSenderService implements OnModuleInit {
  private readonly logger: AppLoggerService;
  private transporter: Transporter | null = null;
  private mode: EmailMode = 'mock';
  private sendgridConfigured = false;
  private fromEmail: string = 'noreply@alumoutreach.com';
  readonly channel = CampaignChannel.EMAIL;

  constructor(private readonly configService: ConfigService) {
    this.logger = new AppLoggerService();
    this.logger.setContext('EmailSenderService');
  }

  async onModuleInit() {
    // Read mode from environment: EMAIL_MODE=mock|console|mailhog|smtp|sendgrid
    this.mode = (this.configService.get<string>('EMAIL_MODE', 'mock') as EmailMode);
    this.fromEmail = this.configService.get<string>('EMAIL_FROM', 'noreply@alumoutreach.com');

    this.logger.info(`Email sender initialized in ${this.mode.toUpperCase()} mode`);

    if (this.mode === 'mailhog') {
      await this.initMailhogTransporter();
    } else if (this.mode === 'smtp') {
      await this.initSmtpTransporter();
    } else if (this.mode === 'sendgrid') {
      this.initSendGrid();
    }
  }

  private initSendGrid() {
    const apiKey = this.configService.get<string>('SENDGRID_API_KEY');
    if (!apiKey || apiKey === 'your-sendgrid-api-key') {
      this.logger.warn('SENDGRID_API_KEY not configured, falling back to console mode');
      this.mode = 'console';
      return;
    }

    sgMail.setApiKey(apiKey);
    this.sendgridConfigured = true;
    this.logger.info('SendGrid API client initialized');
  }

  private async initMailhogTransporter() {
    const host = this.configService.get<string>('MAILHOG_HOST', 'localhost');
    const port = this.configService.get<number>('MAILHOG_PORT', 1025);

    this.transporter = nodemailer.createTransport({
      host,
      port,
      secure: false, // Mailhog doesn't use TLS
      ignoreTLS: true,
    });

    try {
      await this.transporter.verify();
      this.logger.info(`Mailhog SMTP connected at ${host}:${port}`);
    } catch (error) {
      this.logger.warn(`Mailhog not available at ${host}:${port}, falling back to console mode`, {
        error: (error as Error).message,
      });
      this.mode = 'console';
      this.transporter = null;
    }
  }

  private async initSmtpTransporter() {
    // Future: Configure production SMTP (SES, etc.)
    this.logger.warn('SMTP mode not yet implemented, falling back to console mode');
    this.mode = 'console';
  }

  /**
   * Send email via SendGrid API
   */
  private async sendViaSendGrid(request: SendRequest, correlationId: string): Promise<SendResult> {
    if (!this.sendgridConfigured) {
      return this.sendViaConsole(request, correlationId);
    }

    const fromEmail = request.fromEmail || this.fromEmail;
    const fromName = request.fromName || 'AlumOutreach';

    const msg: MailDataRequired = {
      to: request.to,
      from: { email: fromEmail, name: fromName },
      subject: request.subject,
      html: request.htmlBody,
      text: request.textBody || this.stripHtml(request.htmlBody),
      headers: {
        'X-Correlation-ID': correlationId,
        'X-Contact-ID': request.contactId,
        ...(request.metadata?.campaignId && { 'X-Campaign-ID': String(request.metadata.campaignId) }),
        ...(request.metadata?.jobId && { 'X-Job-ID': String(request.metadata.jobId) }),
        ...request.headers,
      },
      customArgs: {
        correlationId,
        contactId: request.contactId,
        campaignId: request.metadata?.campaignId ? String(request.metadata.campaignId) : undefined,
        jobId: request.metadata?.jobId ? String(request.metadata.jobId) : undefined,
        tenantId: request.metadata?.tenantId ? String(request.metadata.tenantId) : undefined,
      },
      trackingSettings: {
        clickTracking: { enable: true, enableText: false },
        openTracking: { enable: true },
      },
    };

    if (request.replyTo) {
      msg.replyTo = request.replyTo;
    }

    try {
      const [response] = await sgMail.send(msg);

      // SendGrid returns x-message-id in response headers
      const providerMessageId = response.headers?.['x-message-id'] as string | undefined;

      this.logger.info('Email sent via SendGrid', {
        to: request.to,
        subject: request.subject,
        providerMessageId,
        statusCode: response.statusCode,
        correlationId,
      });

      return {
        success: true,
        providerMessageId,
        metadata: {
          provider: 'sendgrid',
          sentAt: new Date().toISOString(),
          statusCode: response.statusCode,
        },
      };
    } catch (error: unknown) {
      const sgError = error as { code?: number; response?: { body?: { errors?: Array<{ message: string; field?: string }> } }; message?: string };
      const statusCode = sgError.code || sgError.response?.body?.errors?.[0] ? 400 : 500;
      const errorMessage = sgError.response?.body?.errors?.[0]?.message || sgError.message || 'SendGrid send failed';

      this.logger.error(`SendGrid send failed: ${errorMessage}`, undefined, {
        to: request.to,
        statusCode,
        correlationId,
      });

      const errorInfo = this.classifySendGridError(statusCode, errorMessage);

      return {
        success: false,
        error: errorMessage,
        errorCode: errorInfo.code,
        retryable: errorInfo.retryable,
        metadata: {
          provider: 'sendgrid',
          statusCode,
        },
      };
    }
  }

  /**
   * Classify SendGrid API errors into error codes
   */
  private classifySendGridError(statusCode: number, message: string): { code: EmailErrorCode; retryable: boolean } {
    const msgLower = message.toLowerCase();

    // 401 Unauthorized — API key issue, not retryable
    if (statusCode === 401) {
      return { code: EmailErrorCode.BLOCKED_ADDRESS, retryable: false };
    }

    // 403 Forbidden — sender not verified, not retryable
    if (statusCode === 403) {
      return { code: EmailErrorCode.BLOCKED_ADDRESS, retryable: false };
    }

    // 429 Rate limited — retryable
    if (statusCode === 429) {
      return { code: EmailErrorCode.RATE_LIMITED, retryable: true };
    }

    // 5xx Server errors — retryable
    if (statusCode >= 500) {
      return { code: EmailErrorCode.SERVER_ERROR, retryable: true };
    }

    // Content-based classification for 400-level errors
    if (msgLower.includes('bounce') || msgLower.includes('does not exist')) {
      return { code: EmailErrorCode.HARD_BOUNCE, retryable: false };
    }
    if (msgLower.includes('unsubscribe') || msgLower.includes('suppression')) {
      return { code: EmailErrorCode.UNSUBSCRIBED, retryable: false };
    }
    if (msgLower.includes('spam') || msgLower.includes('complaint')) {
      return { code: EmailErrorCode.SPAM_COMPLAINT, retryable: false };
    }
    if (msgLower.includes('invalid') && (msgLower.includes('email') || msgLower.includes('address'))) {
      return { code: EmailErrorCode.INVALID_EMAIL, retryable: false };
    }

    // 400-level defaults to non-retryable
    if (statusCode >= 400 && statusCode < 500) {
      return { code: EmailErrorCode.UNKNOWN, retryable: false };
    }

    return { code: EmailErrorCode.UNKNOWN, retryable: true };
  }

  async send(request: SendRequest, correlationId: string): Promise<SendResult> {
    const startTime = this.logger.logOperationStart('send email', {
      contactId: request.contactId,
      to: request.to,
      mode: this.mode,
      correlationId,
    });

    try {
      let result: SendResult;

      switch (this.mode) {
        case 'sendgrid':
          result = await this.sendViaSendGrid(request, correlationId);
          break;
        case 'mailhog':
          result = await this.sendViaMailhog(request, correlationId);
          break;
        case 'console':
          result = await this.sendViaConsole(request, correlationId);
          break;
        case 'mock':
        default:
          result = await this.sendViaMock(request, correlationId);
          break;
      }

      this.logger.logOperationEnd('send email', startTime, {
        success: result.success,
        mode: this.mode,
        providerMessageId: result.providerMessageId,
        errorCode: result.errorCode,
      });

      return result;
    } catch (error) {
      this.logger.logOperationError('send email', error as Error, { correlationId });

      // Classify the error
      const errorInfo = this.classifyError(error as Error);

      return {
        success: false,
        error: (error as Error).message,
        errorCode: errorInfo.code,
        retryable: errorInfo.retryable,
      };
    }
  }

  /**
   * Classify an error to determine if it's retryable and provide an error code
   */
  private classifyError(error: Error): { code: EmailErrorCode; retryable: boolean } {
    const message = error.message.toLowerCase();

    // Connection/timeout errors - retryable
    if (message.includes('timeout') || message.includes('timed out')) {
      return { code: EmailErrorCode.SMTP_TIMEOUT, retryable: true };
    }
    if (message.includes('econnrefused') || message.includes('connection refused')) {
      return { code: EmailErrorCode.SMTP_CONNECTION_ERROR, retryable: true };
    }
    if (message.includes('rate limit') || message.includes('too many')) {
      return { code: EmailErrorCode.RATE_LIMITED, retryable: true };
    }
    if (message.includes('5xx') || message.includes('server error') || message.includes('internal')) {
      return { code: EmailErrorCode.SERVER_ERROR, retryable: true };
    }

    // Hard bounce/permanent errors - not retryable
    if (message.includes('invalid') && message.includes('email')) {
      return { code: EmailErrorCode.INVALID_EMAIL, retryable: false };
    }
    if (message.includes('unsubscribed')) {
      return { code: EmailErrorCode.UNSUBSCRIBED, retryable: false };
    }
    if (message.includes('bounce') && message.includes('hard')) {
      return { code: EmailErrorCode.HARD_BOUNCE, retryable: false };
    }
    if (message.includes('spam')) {
      return { code: EmailErrorCode.SPAM_COMPLAINT, retryable: false };
    }
    if (message.includes('blocked')) {
      return { code: EmailErrorCode.BLOCKED_ADDRESS, retryable: false };
    }

    // Default: unknown, assume retryable
    return { code: EmailErrorCode.UNKNOWN, retryable: true };
  }

  /**
   * Validate email address format
   */
  validateEmail(email: string): { valid: boolean; error?: string; errorCode?: EmailErrorCode } {
    if (!email) {
      return { valid: false, error: 'Email address is required', errorCode: EmailErrorCode.INVALID_EMAIL };
    }

    // Basic email regex validation
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      return { valid: false, error: `Invalid email format: ${email}`, errorCode: EmailErrorCode.INVALID_EMAIL };
    }

    return { valid: true };
  }

  /**
   * Send email via Mailhog SMTP (for development/testing)
   */
  private async sendViaMailhog(request: SendRequest, correlationId: string): Promise<SendResult> {
    if (!this.transporter) {
      return this.sendViaConsole(request, correlationId);
    }

    const fromEmail = request.fromEmail || 'noreply@alumoutreach.dev';
    const fromName = request.fromName || 'AlumOutreach';

    const info = await this.transporter.sendMail({
      from: `"${fromName}" <${fromEmail}>`,
      to: request.to,
      replyTo: request.replyTo,
      subject: request.subject,
      text: request.textBody || this.stripHtml(request.htmlBody),
      html: request.htmlBody,
      headers: {
        'X-Correlation-ID': correlationId,
        'X-Contact-ID': request.contactId,
        ...(request.metadata?.campaignId && { 'X-Campaign-ID': String(request.metadata.campaignId) }),
        ...(request.metadata?.jobId && { 'X-Job-ID': String(request.metadata.jobId) }),
        ...request.headers,
      },
    });

    this.logger.info('Email sent via Mailhog', {
      to: request.to,
      subject: request.subject,
      messageId: info.messageId,
      correlationId,
    });

    return {
      success: true,
      providerMessageId: info.messageId,
      metadata: {
        provider: 'mailhog',
        sentAt: new Date().toISOString(),
        accepted: info.accepted,
      },
    };
  }

  /**
   * Log email to console (for local development without Mailhog)
   */
  private async sendViaConsole(request: SendRequest, correlationId: string): Promise<SendResult> {
    const providerMessageId = `console_${uuidv4()}`;

    console.log('\n' + '='.repeat(60));
    console.log('📧 EMAIL SENT (Console Mode)');
    console.log('='.repeat(60));
    console.log(`To:      ${request.to}`);
    console.log(`From:    ${request.fromName || 'AlumOutreach'} <${request.fromEmail || 'noreply@alumoutreach.dev'}>`);
    console.log(`Subject: ${request.subject}`);
    console.log(`Contact: ${request.contactId}`);
    console.log(`Correlation: ${correlationId}`);
    console.log('-'.repeat(60));
    console.log('BODY (Text):');
    console.log(request.textBody || this.stripHtml(request.htmlBody));
    console.log('='.repeat(60) + '\n');

    this.logger.info('Email logged to console', {
      to: request.to,
      subject: request.subject,
      providerMessageId,
      correlationId,
    });

    return {
      success: true,
      providerMessageId,
      metadata: {
        provider: 'console',
        sentAt: new Date().toISOString(),
      },
    };
  }

  /**
   * Mock email sending (original behavior - 95% success rate)
   */
  private async sendViaMock(request: SendRequest, correlationId: string): Promise<SendResult> {
    // Simulate network delay
    await this.simulateDelay(50, 200);

    // Simulate various failure scenarios for testing
    const random = Math.random();
    
    // 95% success rate
    if (random > 0.05) {
      const providerMessageId = `mock_${uuidv4()}`;

      this.logger.info('Email sent successfully (MOCK)', {
        to: request.to,
        providerMessageId,
        correlationId,
      });

      return {
        success: true,
        providerMessageId,
        metadata: {
          provider: 'mock',
          sentAt: new Date().toISOString(),
        },
      };
    } else {
      // Simulate different failure types for testing
      const failureScenario = Math.random();
      let error: string;
      let errorCode: EmailErrorCode;
      let retryable: boolean;

      if (failureScenario < 0.3) {
        // Retryable: Server error
        error = 'Simulated server error (5xx)';
        errorCode = EmailErrorCode.SERVER_ERROR;
        retryable = true;
      } else if (failureScenario < 0.5) {
        // Retryable: Timeout
        error = 'Simulated SMTP timeout';
        errorCode = EmailErrorCode.SMTP_TIMEOUT;
        retryable = true;
      } else if (failureScenario < 0.7) {
        // Retryable: Rate limited
        error = 'Simulated rate limit exceeded';
        errorCode = EmailErrorCode.RATE_LIMITED;
        retryable = true;
      } else {
        // Non-retryable: Hard bounce
        error = 'Simulated hard bounce - mailbox does not exist';
        errorCode = EmailErrorCode.HARD_BOUNCE;
        retryable = false;
      }

      this.logger.warn('Email send failed (MOCK)', {
        to: request.to,
        error,
        errorCode,
        retryable,
        correlationId,
      });

      return {
        success: false,
        error,
        errorCode,
        retryable,
      };
    }
  }

  async sendBatch(requests: SendRequest[], correlationId: string): Promise<Map<string, SendResult>> {
    const results = new Map<string, SendResult>();

    for (const request of requests) {
      const result = await this.send(request, correlationId);
      results.set(request.contactId, result);
    }

    return results;
  }

  private async simulateDelay(minMs: number, maxMs: number): Promise<void> {
    const delay = Math.floor(Math.random() * (maxMs - minMs + 1)) + minMs;
    await new Promise((resolve) => setTimeout(resolve, delay));
  }

  /**
   * Strip HTML tags for plain text fallback
   */
  private stripHtml(html: string): string {
    return html
      .replace(/<[^>]*>/g, '')
      .replace(/&nbsp;/g, ' ')
      .replace(/&amp;/g, '&')
      .replace(/&lt;/g, '<')
      .replace(/&gt;/g, '>')
      .replace(/\s+/g, ' ')
      .trim();
  }

  /**
   * Get current email mode
   */
  getMode(): EmailMode {
    return this.mode;
  }
}

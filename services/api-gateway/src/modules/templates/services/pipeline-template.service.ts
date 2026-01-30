import { Injectable } from '@nestjs/common';
import { AppLoggerService } from '../../../common/logger/app-logger.service';
import { TemplateRepository } from '../repositories/template.repository';
import { TemplateRendererService, RenderResult, RenderOptions } from '../render/template-renderer.service';
import { TemplateVersion, TemplateContent, EmailContent, SmsContent, WhatsAppContent, PushContent } from '../entities/template-version.entity';
import { TemplateChannel } from '../entities/template.entity';
import { RenderedContent } from '../../channels/interfaces';

/**
 * Contact data for template rendering
 */
export interface ContactRenderContext {
  id: string;
  firstName?: string;
  lastName?: string;
  email?: string;
  phone?: string;
  attributes?: Record<string, unknown>;
}

/**
 * Campaign data for template rendering
 */
export interface CampaignRenderContext {
  id: string;
  name: string;
}

/**
 * Full render context for pipeline processing
 */
export interface PipelineRenderContext {
  contact: ContactRenderContext;
  campaign: CampaignRenderContext;
  tenant: {
    id: string;
    name?: string;
  };
  custom?: Record<string, unknown>;
}

/**
 * Result of pipeline template rendering
 */
export interface PipelineRenderResult {
  content: RenderedContent;
  renderResult: RenderResult;
  channel: TemplateChannel;
}

/**
 * Service for rendering templates in the context of pipeline processing
 * 
 * Responsibilities:
 * - Load template version from database
 * - Build flat variables map from context
 * - Render using TemplateRendererService
 * - Transform output to RenderedContent format
 */
@Injectable()
export class PipelineTemplateService {
  private readonly logger: AppLoggerService;

  constructor(
    private readonly templateRepository: TemplateRepository,
    private readonly templateRenderer: TemplateRendererService,
  ) {
    this.logger = new AppLoggerService();
    this.logger.setContext('PipelineTemplateService');
  }

  /**
   * Render a template for pipeline processing
   * 
   * @param tenantId - Tenant ID
   * @param templateVersionId - Template version ID
   * @param context - Render context with contact, campaign, etc.
   * @param correlationId - Correlation ID for tracing
   * @returns Rendered content ready for channel adapters
   */
  async renderForPipeline(
    tenantId: string,
    templateVersionId: string,
    context: PipelineRenderContext,
    correlationId: string,
  ): Promise<PipelineRenderResult> {
    const startTime = this.logger.logOperationStart('render for pipeline', {
      tenantId,
      templateVersionId,
      contactId: context.contact.id,
      correlationId,
    });

    try {
      // 1. Load template version
      const templateVersion = await this.templateRepository.findVersionById(
        tenantId,
        templateVersionId,
      );

      if (!templateVersion) {
        throw new Error(`Template version not found: ${templateVersionId}`);
      }

      // 2. Build variables map
      const variables = this.buildVariablesMap(context);

      // 3. Render template
      const renderOptions: RenderOptions = {
        strictMode: false,
        preserveMissing: false,
        defaultValue: '',
      };

      const renderResult = this.templateRenderer.render(
        templateVersion.channel,
        templateVersion.content,
        variables,
        renderOptions,
      );

      // 4. Transform to RenderedContent
      const content = this.transformToRenderedContent(
        templateVersion.channel,
        renderResult.renderedContent,
      );

      this.logger.logOperationEnd('render for pipeline', startTime, {
        channel: templateVersion.channel,
        variablesUsed: renderResult.variablesUsed.length,
        missingVariables: renderResult.missingVariables.length,
      });

      return {
        content,
        renderResult,
        channel: templateVersion.channel,
      };
    } catch (error) {
      this.logger.logOperationError('render for pipeline', error as Error, {
        templateVersionId,
        correlationId,
      });
      throw error;
    }
  }

  /**
   * Build flat variables map from nested context
   * Supports both flat (firstName) and nested (contact.firstName) syntax
   */
  private buildVariablesMap(context: PipelineRenderContext): Record<string, string> {
    const variables: Record<string, string> = {};
    const { contact, campaign, tenant, custom } = context;

    // Contact fields - flat access
    if (contact.firstName) variables['firstName'] = contact.firstName;
    if (contact.lastName) variables['lastName'] = contact.lastName;
    if (contact.email) variables['email'] = contact.email;
    if (contact.phone) variables['phone'] = contact.phone;

    // Full name computed
    const fullName = [contact.firstName, contact.lastName]
      .filter(Boolean)
      .join(' ')
      .trim() || 'Friend';
    variables['fullName'] = fullName;
    variables['name'] = fullName;

    // Contact nested access
    variables['contact.id'] = contact.id;
    if (contact.firstName) variables['contact.firstName'] = contact.firstName;
    if (contact.lastName) variables['contact.lastName'] = contact.lastName;
    if (contact.email) variables['contact.email'] = contact.email;
    if (contact.phone) variables['contact.phone'] = contact.phone;
    variables['contact.fullName'] = fullName;

    // Contact attributes (flattened)
    if (contact.attributes) {
      for (const [key, value] of Object.entries(contact.attributes)) {
        if (value != null) {
          variables[`contact.${key}`] = String(value);
          // Also add without prefix for convenience
          variables[key] = String(value);
        }
      }
    }

    // Campaign fields
    variables['campaign.id'] = campaign.id;
    variables['campaign.name'] = campaign.name;
    variables['campaignName'] = campaign.name;

    // Tenant fields
    variables['tenant.id'] = tenant.id;
    if (tenant.name) variables['tenant.name'] = tenant.name;

    // Custom variables
    if (custom) {
      for (const [key, value] of Object.entries(custom)) {
        if (value != null) {
          variables[key] = String(value);
        }
      }
    }

    return variables;
  }

  /**
   * Transform rendered template content to channel-agnostic RenderedContent
   */
  private transformToRenderedContent(
    channel: TemplateChannel,
    content: TemplateContent,
  ): RenderedContent {
    switch (channel) {
      case TemplateChannel.EMAIL: {
        const email = content as EmailContent;
        return {
          subject: email.subject,
          htmlBody: email.htmlBody,
          textBody: email.textBody,
          preheader: email.preheader,
          fromName: email.fromName,
          replyTo: email.replyTo,
        };
      }

      case TemplateChannel.SMS: {
        const sms = content as SmsContent;
        return {
          textBody: sms.body,
        };
      }

      case TemplateChannel.WHATSAPP: {
        const wa = content as WhatsAppContent;
        return {
          templateName: wa.templateName,
          languageCode: wa.language,
          textBody: wa.body,
          // Note: WhatsApp components need special handling for the adapter
          components: wa.buttons?.map(btn => ({
            type: 'button' as const,
            parameters: [{ type: 'text' as const, value: btn.text }],
          })),
        };
      }

      case TemplateChannel.PUSH: {
        const push = content as PushContent;
        return {
          title: push.title,
          textBody: push.body,
          imageUrl: push.image,
          deepLink: push.clickAction,
          data: push.data,
        };
      }

      default:
        // Fallback for RCS or unknown channels
        return {
          textBody: JSON.stringify(content),
        };
    }
  }
}

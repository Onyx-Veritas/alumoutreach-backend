import { Injectable, Logger } from '@nestjs/common';
import { DataSource } from 'typeorm';

export interface ResetResult {
  success: boolean;
  module: string;
  deletedCount: number;
  duration: number;
  errors?: string[];
}

export interface FullResetResult {
  success: boolean;
  duration: number;
  modules: ResetResult[];
  totalDeleted: number;
}

@Injectable()
export class ResetService {
  private readonly logger = new Logger(ResetService.name);

  constructor(private readonly dataSource: DataSource) {}

  /**
   * Reset all dev-generated data
   * WARNING: This deletes data! Only for development use.
   */
  async resetAll(tenantId: string): Promise<FullResetResult> {
    const startTime = Date.now();
    const modules: ResetResult[] = [];
    
    this.logger.warn(`Resetting all data for tenant: ${tenantId}`);

    // Reset in correct order (respect foreign keys)
    const resetOperations = [
      { name: 'inbox', fn: () => this.resetInbox(tenantId) },
      { name: 'campaigns', fn: () => this.resetCampaigns(tenantId) },
      { name: 'sequences', fn: () => this.resetSequences(tenantId) },
      { name: 'workflows', fn: () => this.resetWorkflows(tenantId) },
      { name: 'segments', fn: () => this.resetSegments(tenantId) },
      { name: 'contacts', fn: () => this.resetContacts(tenantId) },
    ];

    for (const op of resetOperations) {
      try {
        const result = await op.fn();
        modules.push(result);
      } catch (error) {
        modules.push({
          success: false,
          module: op.name,
          deletedCount: 0,
          duration: 0,
          errors: [error.message],
        });
      }
    }

    const totalDeleted = modules.reduce((sum, m) => sum + m.deletedCount, 0);
    const success = modules.every(m => m.success);

    return {
      success,
      duration: Date.now() - startTime,
      modules,
      totalDeleted,
    };
  }

  /**
   * Reset contacts for a tenant
   */
  async resetContacts(tenantId: string): Promise<ResetResult> {
    const startTime = Date.now();
    const errors: string[] = [];

    try {
      // Delete in order: timeline events, attributes, consents, tag mappings, contacts
      const timelineResult = await this.dataSource.query(
        `DELETE FROM contact_timeline_events WHERE tenant_id = $1`,
        [tenantId]
      );

      const attributesResult = await this.dataSource.query(
        `DELETE FROM contact_attributes WHERE tenant_id = $1`,
        [tenantId]
      );

      const consentsResult = await this.dataSource.query(
        `DELETE FROM contact_consents WHERE tenant_id = $1`,
        [tenantId]
      );

      const tagMappingsResult = await this.dataSource.query(
        `DELETE FROM contact_tag_mappings WHERE tenant_id = $1`,
        [tenantId]
      );

      const contactsResult = await this.dataSource.query(
        `DELETE FROM contacts WHERE tenant_id = $1`,
        [tenantId]
      );

      const deletedCount = 
        (timelineResult?.[1] || 0) +
        (attributesResult?.[1] || 0) +
        (consentsResult?.[1] || 0) +
        (tagMappingsResult?.[1] || 0) +
        (contactsResult?.[1] || 0);

      this.logger.debug(`Deleted ${deletedCount} contact-related records`);

      return {
        success: true,
        module: 'contacts',
        deletedCount,
        duration: Date.now() - startTime,
      };
    } catch (error) {
      errors.push(error.message);
      return {
        success: false,
        module: 'contacts',
        deletedCount: 0,
        duration: Date.now() - startTime,
        errors,
      };
    }
  }

  /**
   * Reset segments for a tenant
   */
  async resetSegments(tenantId: string): Promise<ResetResult> {
    const startTime = Date.now();
    const errors: string[] = [];

    try {
      // Delete segment members first, then segments
      const membersResult = await this.dataSource.query(
        `DELETE FROM segment_members WHERE tenant_id = $1`,
        [tenantId]
      );

      const segmentsResult = await this.dataSource.query(
        `DELETE FROM segments WHERE tenant_id = $1`,
        [tenantId]
      );

      const deletedCount = (membersResult?.[1] || 0) + (segmentsResult?.[1] || 0);

      this.logger.debug(`Deleted ${deletedCount} segment-related records`);

      return {
        success: true,
        module: 'segments',
        deletedCount,
        duration: Date.now() - startTime,
      };
    } catch (error) {
      errors.push(error.message);
      return {
        success: false,
        module: 'segments',
        deletedCount: 0,
        duration: Date.now() - startTime,
        errors,
      };
    }
  }

  /**
   * Reset campaigns for a tenant
   */
  async resetCampaigns(tenantId: string): Promise<ResetResult> {
    const startTime = Date.now();
    const errors: string[] = [];

    try {
      // Delete campaign messages first, then campaigns
      const messagesResult = await this.dataSource.query(
        `DELETE FROM campaign_messages WHERE tenant_id = $1`,
        [tenantId]
      );

      const campaignsResult = await this.dataSource.query(
        `DELETE FROM campaigns WHERE tenant_id = $1`,
        [tenantId]
      );

      const deletedCount = (messagesResult?.[1] || 0) + (campaignsResult?.[1] || 0);

      this.logger.debug(`Deleted ${deletedCount} campaign-related records`);

      return {
        success: true,
        module: 'campaigns',
        deletedCount,
        duration: Date.now() - startTime,
      };
    } catch (error) {
      errors.push(error.message);
      return {
        success: false,
        module: 'campaigns',
        deletedCount: 0,
        duration: Date.now() - startTime,
        errors,
      };
    }
  }

  /**
   * Reset inbox for a tenant
   */
  async resetInbox(tenantId: string): Promise<ResetResult> {
    const startTime = Date.now();
    const errors: string[] = [];

    try {
      // Delete activities, messages, then threads
      const activitiesResult = await this.dataSource.query(
        `DELETE FROM inbox_activities WHERE tenant_id = $1`,
        [tenantId]
      );

      const messagesResult = await this.dataSource.query(
        `DELETE FROM inbox_messages WHERE tenant_id = $1`,
        [tenantId]
      );

      const threadsResult = await this.dataSource.query(
        `DELETE FROM inbox_threads WHERE tenant_id = $1`,
        [tenantId]
      );

      const deletedCount = 
        (activitiesResult?.[1] || 0) +
        (messagesResult?.[1] || 0) +
        (threadsResult?.[1] || 0);

      this.logger.debug(`Deleted ${deletedCount} inbox-related records`);

      return {
        success: true,
        module: 'inbox',
        deletedCount,
        duration: Date.now() - startTime,
      };
    } catch (error) {
      errors.push(error.message);
      return {
        success: false,
        module: 'inbox',
        deletedCount: 0,
        duration: Date.now() - startTime,
        errors,
      };
    }
  }

  /**
   * Reset workflows for a tenant
   */
  async resetWorkflows(tenantId: string): Promise<ResetResult> {
    const startTime = Date.now();
    const errors: string[] = [];

    try {
      // Delete executions first, then workflows
      const executionsResult = await this.dataSource.query(
        `DELETE FROM workflow_executions WHERE tenant_id = $1`,
        [tenantId]
      );

      const workflowsResult = await this.dataSource.query(
        `DELETE FROM workflows WHERE tenant_id = $1`,
        [tenantId]
      );

      const deletedCount = (executionsResult?.[1] || 0) + (workflowsResult?.[1] || 0);

      this.logger.debug(`Deleted ${deletedCount} workflow-related records`);

      return {
        success: true,
        module: 'workflows',
        deletedCount,
        duration: Date.now() - startTime,
      };
    } catch (error) {
      errors.push(error.message);
      return {
        success: false,
        module: 'workflows',
        deletedCount: 0,
        duration: Date.now() - startTime,
        errors,
      };
    }
  }

  /**
   * Reset sequences for a tenant
   */
  async resetSequences(tenantId: string): Promise<ResetResult> {
    const startTime = Date.now();
    const errors: string[] = [];

    try {
      // Delete enrollments first, then steps, then sequences
      const enrollmentsResult = await this.dataSource.query(
        `DELETE FROM sequence_enrollments WHERE tenant_id = $1`,
        [tenantId]
      );

      const stepsResult = await this.dataSource.query(
        `DELETE FROM sequence_steps WHERE sequence_id IN (
          SELECT id FROM sequences WHERE tenant_id = $1
        )`,
        [tenantId]
      );

      const sequencesResult = await this.dataSource.query(
        `DELETE FROM sequences WHERE tenant_id = $1`,
        [tenantId]
      );

      const deletedCount = 
        (enrollmentsResult?.[1] || 0) +
        (stepsResult?.[1] || 0) +
        (sequencesResult?.[1] || 0);

      this.logger.debug(`Deleted ${deletedCount} sequence-related records`);

      return {
        success: true,
        module: 'sequences',
        deletedCount,
        duration: Date.now() - startTime,
      };
    } catch (error) {
      errors.push(error.message);
      return {
        success: false,
        module: 'sequences',
        deletedCount: 0,
        duration: Date.now() - startTime,
        errors,
      };
    }
  }

  /**
   * Reset templates for a tenant
   */
  async resetTemplates(tenantId: string): Promise<ResetResult> {
    const startTime = Date.now();
    const errors: string[] = [];

    try {
      // Delete template versions first, then templates
      const versionsResult = await this.dataSource.query(
        `DELETE FROM template_versions WHERE template_id IN (
          SELECT id FROM templates WHERE tenant_id = $1
        )`,
        [tenantId]
      );

      const templatesResult = await this.dataSource.query(
        `DELETE FROM templates WHERE tenant_id = $1`,
        [tenantId]
      );

      const deletedCount = (versionsResult?.[1] || 0) + (templatesResult?.[1] || 0);

      this.logger.debug(`Deleted ${deletedCount} template-related records`);

      return {
        success: true,
        module: 'templates',
        deletedCount,
        duration: Date.now() - startTime,
      };
    } catch (error) {
      errors.push(error.message);
      return {
        success: false,
        module: 'templates',
        deletedCount: 0,
        duration: Date.now() - startTime,
        errors,
      };
    }
  }

  /**
   * Get counts for all entities (for dashboard)
   */
  async getCounts(tenantId: string): Promise<Record<string, number>> {
    const counts: Record<string, number> = {};

    const tables = [
      { name: 'contacts', table: 'contacts' },
      { name: 'segments', table: 'segments' },
      { name: 'campaigns', table: 'campaigns' },
      { name: 'inboxThreads', table: 'inbox_threads' },
      { name: 'inboxMessages', table: 'inbox_messages' },
      { name: 'workflows', table: 'workflows' },
      { name: 'sequences', table: 'sequences' },
      { name: 'templates', table: 'templates' },
    ];

    for (const { name, table } of tables) {
      try {
        const result = await this.dataSource.query(
          `SELECT COUNT(*) as count FROM ${table} WHERE tenant_id = $1`,
          [tenantId]
        );
        counts[name] = parseInt(result[0]?.count || '0', 10);
      } catch (error) {
        counts[name] = 0;
      }
    }

    return counts;
  }
}

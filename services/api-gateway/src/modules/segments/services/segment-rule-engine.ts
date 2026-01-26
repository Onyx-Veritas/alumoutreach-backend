import { Injectable, BadRequestException } from '@nestjs/common';
import { AppLoggerService } from '../../../common/logger/app-logger.service';
import {
  SegmentRules,
  SegmentRule,
  SegmentRuleGroup,
  RuleOperator,
} from '../entities/segment.entity';

export interface CompiledQuery {
  sql: string;
  params: Record<string, unknown>;
  joins: string[];
}

interface QueryContext {
  paramIndex: number;
  params: Record<string, unknown>;
  joins: Set<string>;
  tenantId: string;
}

@Injectable()
export class SegmentRuleEngineService {
  private readonly logger: AppLoggerService;

  constructor() {
    this.logger = new AppLoggerService();
    this.logger.setContext('SegmentRuleEngineService');
  }

  /**
   * Compile segment rules into a SQL WHERE clause
   */
  compile(rules: SegmentRules, tenantId: string): CompiledQuery {
    const startTime = this.logger.logOperationStart('compile rules', { tenantId });

    try {
      const context: QueryContext = {
        paramIndex: 0,
        params: { tenantId },
        joins: new Set<string>(),
        tenantId,
      };

      const whereClause = this.compileGroup(rules, context);

      const result: CompiledQuery = {
        sql: whereClause,
        params: context.params,
        joins: Array.from(context.joins),
      };

      this.logger.logOperationEnd('compile rules', startTime, {
        joinCount: result.joins.length,
        paramCount: Object.keys(result.params).length,
      });

      return result;
    } catch (error) {
      this.logger.logOperationError('compile rules', error as Error);
      throw error;
    }
  }

  /**
   * Generate a full SELECT query for segment membership
   */
  generateMembershipQuery(rules: SegmentRules, tenantId: string, limit?: number): CompiledQuery {
    const startTime = this.logger.logOperationStart('generate membership query', { tenantId });

    try {
      const compiled = this.compile(rules, tenantId);

      // Build the full query
      let sql = `
        SELECT DISTINCT c.id, c.email, c.first_name, c.last_name
        FROM contacts c
      `;

      // Add joins
      for (const join of compiled.joins) {
        sql += `\n${join}`;
      }

      // Add WHERE clause
      sql += `
        WHERE c.tenant_id = :tenantId
        AND c.deleted_at IS NULL
        AND (${compiled.sql})
      `;

      if (limit) {
        sql += `\nLIMIT ${limit}`;
      }

      this.logger.logOperationEnd('generate membership query', startTime);

      return {
        sql: sql.trim(),
        params: compiled.params,
        joins: compiled.joins,
      };
    } catch (error) {
      this.logger.logOperationError('generate membership query', error as Error);
      throw error;
    }
  }

  /**
   * Generate a COUNT query for segment
   */
  generateCountQuery(rules: SegmentRules, tenantId: string): CompiledQuery {
    const compiled = this.compile(rules, tenantId);

    let sql = `
      SELECT COUNT(DISTINCT c.id) as count
      FROM contacts c
    `;

    for (const join of compiled.joins) {
      sql += `\n${join}`;
    }

    sql += `
      WHERE c.tenant_id = :tenantId
      AND c.deleted_at IS NULL
      AND (${compiled.sql})
    `;

    return {
      sql: sql.trim(),
      params: compiled.params,
      joins: compiled.joins,
    };
  }

  /**
   * Validate rules structure
   */
  validateRules(rules: SegmentRules): { valid: boolean; errors: string[] } {
    const errors: string[] = [];

    if (!rules.logic || !['AND', 'OR'].includes(rules.logic)) {
      errors.push('Top-level logic must be AND or OR');
    }

    if (!rules.groups || !Array.isArray(rules.groups) || rules.groups.length === 0) {
      errors.push('Rules must have at least one group');
    }

    // Recursively validate groups
    if (rules.groups) {
      for (let i = 0; i < rules.groups.length; i++) {
        const group = rules.groups[i];
        const groupErrors = this.validateRuleOrGroup(group, `groups[${i}]`);
        errors.push(...groupErrors);
      }
    }

    return { valid: errors.length === 0, errors };
  }

  // ============ Private Methods ============

  private compileGroup(group: SegmentRules | SegmentRuleGroup, context: QueryContext): string {
    const parts: string[] = [];

    const rules = 'groups' in group ? group.groups : group.rules;

    for (const item of rules) {
      if (this.isRuleGroup(item)) {
        // Nested group
        const nested = this.compileGroup(item, context);
        parts.push(`(${nested})`);
      } else {
        // Single rule
        const ruleSql = this.compileRule(item, context);
        parts.push(ruleSql);
      }
    }

    const connector = group.logic === 'AND' ? ' AND ' : ' OR ';
    return parts.join(connector);
  }

  private compileRule(rule: SegmentRule, context: QueryContext): string {
    const { field, operator, value } = rule;

    // Handle different field types
    if (field.startsWith('attributes.')) {
      return this.compileAttributeRule(field, operator, value, context);
    }

    if (field.startsWith('timeline.') || field.startsWith('events.')) {
      return this.compileTimelineRule(field, operator, value, context);
    }

    if (field === 'tags' || operator.startsWith('has_tag') || operator.startsWith('has_any_tag') || operator.startsWith('has_all_tags')) {
      return this.compileTagRule(operator, value, context);
    }

    if (field.startsWith('channel.')) {
      return this.compileChannelRule(field, operator, value, context);
    }

    // Standard contact field
    return this.compileContactFieldRule(field, operator, value, context);
  }

  private compileContactFieldRule(
    field: string,
    operator: RuleOperator,
    value: unknown,
    context: QueryContext,
  ): string {
    const columnName = this.getContactColumnName(field);
    const paramName = this.getNextParamName(context);

    switch (operator) {
      case 'equals':
        context.params[paramName] = value;
        return `c.${columnName} = :${paramName}`;

      case 'not_equals':
        context.params[paramName] = value;
        return `c.${columnName} != :${paramName}`;

      case 'contains':
        context.params[paramName] = `%${value}%`;
        return `c.${columnName} ILIKE :${paramName}`;

      case 'not_contains':
        context.params[paramName] = `%${value}%`;
        return `c.${columnName} NOT ILIKE :${paramName}`;

      case 'starts_with':
        context.params[paramName] = `${value}%`;
        return `c.${columnName} ILIKE :${paramName}`;

      case 'ends_with':
        context.params[paramName] = `%${value}`;
        return `c.${columnName} ILIKE :${paramName}`;

      case 'in':
        context.params[paramName] = Array.isArray(value) ? value : [value];
        return `c.${columnName} = ANY(:${paramName})`;

      case 'not_in':
        context.params[paramName] = Array.isArray(value) ? value : [value];
        return `c.${columnName} != ALL(:${paramName})`;

      case 'gt':
        context.params[paramName] = value;
        return `c.${columnName} > :${paramName}`;

      case 'gte':
        context.params[paramName] = value;
        return `c.${columnName} >= :${paramName}`;

      case 'lt':
        context.params[paramName] = value;
        return `c.${columnName} < :${paramName}`;

      case 'lte':
        context.params[paramName] = value;
        return `c.${columnName} <= :${paramName}`;

      case 'between':
        if (!Array.isArray(value) || value.length !== 2) {
          throw new BadRequestException('Between operator requires an array of two values');
        }
        const paramMin = this.getNextParamName(context);
        const paramMax = this.getNextParamName(context);
        context.params[paramMin] = value[0];
        context.params[paramMax] = value[1];
        return `c.${columnName} BETWEEN :${paramMin} AND :${paramMax}`;

      case 'is_null':
        return `c.${columnName} IS NULL`;

      case 'is_not_null':
        return `c.${columnName} IS NOT NULL`;

      default:
        throw new BadRequestException(`Unsupported operator: ${operator}`);
    }
  }

  private compileTagRule(operator: RuleOperator, value: unknown, context: QueryContext): string {
    // Add tag join if not already present
    const tagJoin = `LEFT JOIN contact_tag_mappings ctm ON ctm.contact_id = c.id AND ctm.tenant_id = c.tenant_id
                     LEFT JOIN contact_tags ct ON ct.id = ctm.tag_id`;
    context.joins.add(tagJoin);

    const paramName = this.getNextParamName(context);

    switch (operator) {
      case 'has_tag':
        context.params[paramName] = value;
        return `ct.name = :${paramName}`;

      case 'has_any_tag':
        context.params[paramName] = Array.isArray(value) ? value : [value];
        return `ct.name = ANY(:${paramName})`;

      case 'has_all_tags':
        if (!Array.isArray(value)) {
          throw new BadRequestException('has_all_tags requires an array of tag names');
        }
        const tagParams: string[] = [];
        for (const tag of value) {
          const p = this.getNextParamName(context);
          context.params[p] = tag;
          tagParams.push(`:${p}`);
        }
        // Use a subquery to ensure contact has ALL tags
        return `c.id IN (
          SELECT ctm2.contact_id
          FROM contact_tag_mappings ctm2
          JOIN contact_tags ct2 ON ct2.id = ctm2.tag_id
          WHERE ctm2.tenant_id = :tenantId
          AND ct2.name IN (${tagParams.join(', ')})
          GROUP BY ctm2.contact_id
          HAVING COUNT(DISTINCT ct2.name) = ${value.length}
        )`;

      case 'equals':
      case 'in':
        // Treat as has_any_tag
        context.params[paramName] = Array.isArray(value) ? value : [value];
        return `ct.name = ANY(:${paramName})`;

      default:
        throw new BadRequestException(`Unsupported tag operator: ${operator}`);
    }
  }

  private compileAttributeRule(
    field: string,
    operator: RuleOperator,
    value: unknown,
    context: QueryContext,
  ): string {
    // Extract attribute key from field (e.g., "attributes.company" -> "company")
    const attrKey = field.replace('attributes.', '');
    
    // Add attribute join if not already present
    const attrJoin = `LEFT JOIN contact_attributes ca ON ca.contact_id = c.id AND ca.tenant_id = c.tenant_id`;
    context.joins.add(attrJoin);

    const keyParam = this.getNextParamName(context);
    context.params[keyParam] = attrKey;

    const valueParam = this.getNextParamName(context);

    switch (operator) {
      case 'equals':
        context.params[valueParam] = value;
        return `(ca.key = :${keyParam} AND ca.value = :${valueParam})`;

      case 'not_equals':
        context.params[valueParam] = value;
        return `(ca.key = :${keyParam} AND ca.value != :${valueParam})`;

      case 'contains':
        context.params[valueParam] = `%${value}%`;
        return `(ca.key = :${keyParam} AND ca.value ILIKE :${valueParam})`;

      case 'starts_with':
        context.params[valueParam] = `${value}%`;
        return `(ca.key = :${keyParam} AND ca.value ILIKE :${valueParam})`;

      case 'ends_with':
        context.params[valueParam] = `%${value}`;
        return `(ca.key = :${keyParam} AND ca.value ILIKE :${valueParam})`;

      case 'is_null':
      case 'has_attribute':
        return operator === 'has_attribute'
          ? `ca.key = :${keyParam}`
          : `NOT EXISTS (SELECT 1 FROM contact_attributes ca2 WHERE ca2.contact_id = c.id AND ca2.key = :${keyParam})`;

      case 'is_not_null':
        return `EXISTS (SELECT 1 FROM contact_attributes ca2 WHERE ca2.contact_id = c.id AND ca2.key = :${keyParam})`;

      case 'gt':
      case 'gte':
      case 'lt':
      case 'lte':
        context.params[valueParam] = value;
        const numOp = operator === 'gt' ? '>' : operator === 'gte' ? '>=' : operator === 'lt' ? '<' : '<=';
        return `(ca.key = :${keyParam} AND CAST(ca.value AS NUMERIC) ${numOp} :${valueParam})`;

      default:
        throw new BadRequestException(`Unsupported attribute operator: ${operator}`);
    }
  }

  private compileTimelineRule(
    field: string,
    operator: RuleOperator,
    value: unknown,
    context: QueryContext,
  ): string {
    // Extract event type from field (e.g., "timeline.email_opened" -> "email_opened")
    const eventType = field.replace('timeline.', '').replace('events.', '');

    // Add timeline join if not already present
    const timelineJoin = `LEFT JOIN contact_timeline_events cte ON cte.contact_id = c.id AND cte.tenant_id = c.tenant_id`;
    context.joins.add(timelineJoin);

    const eventParam = this.getNextParamName(context);
    context.params[eventParam] = eventType;

    switch (operator) {
      case 'has_event':
        return `cte.event_type = :${eventParam}`;

      case 'event_count_gte': {
        const countParam = this.getNextParamName(context);
        context.params[countParam] = value;
        return `c.id IN (
          SELECT cte2.contact_id
          FROM contact_timeline_events cte2
          WHERE cte2.tenant_id = :tenantId AND cte2.event_type = :${eventParam}
          GROUP BY cte2.contact_id
          HAVING COUNT(*) >= :${countParam}
        )`;
      }

      case 'event_count_lte': {
        const countParam = this.getNextParamName(context);
        context.params[countParam] = value;
        return `c.id IN (
          SELECT cte2.contact_id
          FROM contact_timeline_events cte2
          WHERE cte2.tenant_id = :tenantId AND cte2.event_type = :${eventParam}
          GROUP BY cte2.contact_id
          HAVING COUNT(*) <= :${countParam}
        )`;
      }

      case 'equals':
        // Match event type
        return `cte.event_type = :${eventParam}`;

      default:
        throw new BadRequestException(`Unsupported timeline operator: ${operator}`);
    }
  }

  private compileChannelRule(
    field: string,
    operator: RuleOperator,
    value: unknown,
    context: QueryContext,
  ): string {
    // Extract channel type from field (e.g., "channel.email" -> "email")
    const channelType = field.replace('channel.', '');

    // Add channel identifier join
    const channelJoin = `LEFT JOIN channel_identifiers ci ON ci.contact_id = c.id AND ci.tenant_id = c.tenant_id`;
    context.joins.add(channelJoin);

    const channelParam = this.getNextParamName(context);
    context.params[channelParam] = channelType;

    const valueParam = this.getNextParamName(context);

    switch (operator) {
      case 'equals':
        context.params[valueParam] = value;
        return `(ci.channel = :${channelParam} AND ci.identifier = :${valueParam})`;

      case 'contains':
        context.params[valueParam] = `%${value}%`;
        return `(ci.channel = :${channelParam} AND ci.identifier ILIKE :${valueParam})`;

      case 'is_not_null':
        return `(ci.channel = :${channelParam} AND ci.identifier IS NOT NULL)`;

      case 'is_null':
        return `NOT EXISTS (
          SELECT 1 FROM channel_identifiers ci2 
          WHERE ci2.contact_id = c.id AND ci2.channel = :${channelParam}
        )`;

      default:
        throw new BadRequestException(`Unsupported channel operator: ${operator}`);
    }
  }

  private getContactColumnName(field: string): string {
    const mapping: Record<string, string> = {
      email: 'email',
      primaryEmail: 'email',
      phone: 'phone',
      firstName: 'first_name',
      lastName: 'last_name',
      fullName: 'full_name',
      status: 'status',
      source: 'source',
      createdAt: 'created_at',
      updatedAt: 'updated_at',
      lastActivityAt: 'last_activity_at',
    };

    return mapping[field] || field.replace(/([A-Z])/g, '_$1').toLowerCase();
  }

  private getNextParamName(context: QueryContext): string {
    return `p${context.paramIndex++}`;
  }

  private isRuleGroup(item: SegmentRule | SegmentRuleGroup): item is SegmentRuleGroup {
    return 'logic' in item && 'rules' in item;
  }

  private validateRuleOrGroup(item: SegmentRule | SegmentRuleGroup, path: string): string[] {
    const errors: string[] = [];

    if (this.isRuleGroup(item)) {
      if (!['AND', 'OR'].includes(item.logic)) {
        errors.push(`${path}: Invalid logic operator`);
      }
      if (!item.rules || item.rules.length === 0) {
        errors.push(`${path}: Group must have at least one rule`);
      }
      for (let i = 0; i < (item.rules || []).length; i++) {
        errors.push(...this.validateRuleOrGroup(item.rules[i], `${path}.rules[${i}]`));
      }
    } else {
      if (!item.field) {
        errors.push(`${path}: Rule must have a field`);
      }
      if (!item.operator) {
        errors.push(`${path}: Rule must have an operator`);
      }
    }

    return errors;
  }
}

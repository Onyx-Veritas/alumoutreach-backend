import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, EntityManager, In } from 'typeorm';
import { AppLoggerService } from '../../../common/logger/app-logger.service';
import { Segment, SegmentType, SegmentStatus, SegmentRules } from '../entities/segment.entity';
import { SegmentMember, MemberSource } from '../entities/segment-member.entity';
import { SegmentSearchDto, MemberSearchDto } from '../dto/segment.dto';
import { SegmentRuleEngineService, CompiledQuery } from '../services/segment-rule-engine';

export interface PaginatedResult<T> {
  data: T[];
  total: number;
  page: number;
  limit: number;
}

export interface RecomputeResult {
  previousCount: number;
  newCount: number;
  addedCount: number;
  removedCount: number;
  durationMs: number;
  batchId: string;
}

@Injectable()
export class SegmentRepository {
  private readonly logger: AppLoggerService;

  constructor(
    @InjectRepository(Segment)
    private readonly segmentRepo: Repository<Segment>,
    @InjectRepository(SegmentMember)
    private readonly memberRepo: Repository<SegmentMember>,
    private readonly ruleEngine: SegmentRuleEngineService,
  ) {
    this.logger = new AppLoggerService();
    this.logger.setContext('SegmentRepository');
  }

  // ============ Segment CRUD ============

  async create(segment: Segment): Promise<Segment> {
    const startTime = this.logger.logOperationStart('create segment');

    try {
      const saved = await this.segmentRepo.save(segment);
      this.logger.logDbQuery('INSERT segments', 1, { segmentId: saved.id, duration: Date.now() - startTime });
      this.logger.logOperationEnd('create segment', startTime, { segmentId: saved.id });
      return saved;
    } catch (error) {
      this.logger.logOperationError('create segment', error as Error);
      throw error;
    }
  }

  async findById(tenantId: string, id: string): Promise<Segment | null> {
    const startTime = this.logger.logOperationStart('find segment by id', { tenantId, segmentId: id });

    try {
      const segment = await this.segmentRepo.findOne({
        where: { id, tenantId, deletedAt: undefined },
      });

      this.logger.logDbQuery('SELECT segments', segment ? 1 : 0, { found: !!segment, duration: Date.now() - startTime });
      this.logger.logOperationEnd('find segment by id', startTime);
      return segment;
    } catch (error) {
      this.logger.logOperationError('find segment by id', error as Error);
      throw error;
    }
  }

  async findByName(tenantId: string, name: string): Promise<Segment | null> {
    const startTime = this.logger.logOperationStart('find segment by name', { tenantId, name });

    try {
      const segment = await this.segmentRepo.findOne({
        where: { tenantId, name, deletedAt: undefined },
      });

      this.logger.logDbQuery('SELECT segments', segment ? 1 : 0, { found: !!segment, duration: Date.now() - startTime });
      this.logger.logOperationEnd('find segment by name', startTime);
      return segment;
    } catch (error) {
      this.logger.logOperationError('find segment by name', error as Error);
      throw error;
    }
  }

  async findAll(tenantId: string, query: SegmentSearchDto): Promise<PaginatedResult<Segment>> {
    const startTime = this.logger.logOperationStart('find all segments', { tenantId });

    try {
      const {
        q,
        type,
        status,
        folder,
        tags,
        minMembers,
        maxMembers,
        page = 1,
        limit = 20,
        sortBy = 'createdAt',
        sortOrder = 'desc',
      } = query;

      const queryBuilder = this.segmentRepo.createQueryBuilder('segment')
        .where('segment.tenant_id = :tenantId', { tenantId })
        .andWhere('segment.deleted_at IS NULL');

      // Search by name/description
      if (q) {
        queryBuilder.andWhere(
          '(segment.name ILIKE :search OR segment.description ILIKE :search)',
          { search: `%${q}%` },
        );
      }

      if (type) {
        queryBuilder.andWhere('segment.type = :type', { type });
      }

      if (status) {
        queryBuilder.andWhere('segment.status = :status', { status });
      }

      if (folder) {
        queryBuilder.andWhere('segment.folder = :folder', { folder });
      }

      if (tags && tags.length > 0) {
        queryBuilder.andWhere('segment.tags && :tags', { tags });
      }

      if (minMembers !== undefined) {
        queryBuilder.andWhere('segment.member_count >= :minMembers', { minMembers });
      }

      if (maxMembers !== undefined) {
        queryBuilder.andWhere('segment.member_count <= :maxMembers', { maxMembers });
      }

      // Sorting
      const sortColumn = this.toSnakeCase(sortBy);
      const order = sortOrder.toUpperCase() as 'ASC' | 'DESC';
      queryBuilder.orderBy(`segment.${sortColumn}`, order);

      // Pagination
      queryBuilder.skip((page - 1) * limit).take(limit);

      const [data, total] = await queryBuilder.getManyAndCount();

      this.logger.logDbQuery('SELECT segments', data.length, { total, duration: Date.now() - startTime });
      this.logger.logOperationEnd('find all segments', startTime, { total });

      return { data, total, page, limit };
    } catch (error) {
      this.logger.logOperationError('find all segments', error as Error);
      throw error;
    }
  }

  async update(tenantId: string, id: string, updates: Partial<Segment>): Promise<Segment> {
    const startTime = this.logger.logOperationStart('update segment', { tenantId, segmentId: id });

    try {
      await this.segmentRepo.update({ id, tenantId }, updates);
      const updated = await this.findById(tenantId, id);

      this.logger.logDbQuery('UPDATE segments', 1, { segmentId: id, duration: Date.now() - startTime });
      this.logger.logOperationEnd('update segment', startTime);

      return updated!;
    } catch (error) {
      this.logger.logOperationError('update segment', error as Error);
      throw error;
    }
  }

  async softDelete(tenantId: string, id: string, deletedBy: string): Promise<void> {
    const startTime = this.logger.logOperationStart('soft delete segment', { tenantId, segmentId: id });

    try {
      await this.segmentRepo.update(
        { id, tenantId },
        { deletedAt: new Date(), updatedBy: deletedBy },
      );

      this.logger.logDbQuery('UPDATE soft delete segments', 1, { duration: Date.now() - startTime });
      this.logger.logOperationEnd('soft delete segment', startTime);
    } catch (error) {
      this.logger.logOperationError('soft delete segment', error as Error);
      throw error;
    }
  }

  // ============ Member Management ============

  async getMembers(tenantId: string, segmentId: string, query: MemberSearchDto): Promise<PaginatedResult<SegmentMember>> {
    const startTime = this.logger.logOperationStart('get segment members', { tenantId, segmentId });

    try {
      const {
        page = 1,
        limit = 20,
        sortBy = 'addedAt',
        sortOrder = 'desc',
      } = query;

      const queryBuilder = this.memberRepo.createQueryBuilder('member')
        .where('member.tenant_id = :tenantId', { tenantId })
        .andWhere('member.segment_id = :segmentId', { segmentId });

      // Sorting
      const sortColumn = this.toSnakeCase(sortBy);
      const order = sortOrder.toUpperCase() as 'ASC' | 'DESC';
      queryBuilder.orderBy(`member.${sortColumn}`, order);

      // Pagination
      queryBuilder.skip((page - 1) * limit).take(limit);

      const [data, total] = await queryBuilder.getManyAndCount();

      this.logger.logDbQuery('SELECT segment_members', data.length, { total, duration: Date.now() - startTime });
      this.logger.logOperationEnd('get segment members', startTime, { total });

      return { data, total, page, limit };
    } catch (error) {
      this.logger.logOperationError('get segment members', error as Error);
      throw error;
    }
  }

  async addMembers(
    tenantId: string,
    segmentId: string,
    contactIds: string[],
    source: MemberSource,
    addedBy?: string,
  ): Promise<number> {
    const startTime = this.logger.logOperationStart('add segment members', { tenantId, segmentId, count: contactIds.length });

    try {
      // Use upsert to handle existing members
      const members = contactIds.map((contactId) => ({
        tenantId,
        segmentId,
        contactId,
        source,
        addedBy,
        addedAt: new Date(),
      }));

      const result = await this.memberRepo
        .createQueryBuilder()
        .insert()
        .into(SegmentMember)
        .values(members)
        .orIgnore() // Skip duplicates
        .execute();

      const addedCount = result.identifiers.length;

      // Update member count
      await this.updateMemberCount(tenantId, segmentId);

      this.logger.logDbQuery('INSERT segment_members', addedCount, { duration: Date.now() - startTime });
      this.logger.logOperationEnd('add segment members', startTime, { addedCount });

      return addedCount;
    } catch (error) {
      this.logger.logOperationError('add segment members', error as Error);
      throw error;
    }
  }

  async removeMembers(tenantId: string, segmentId: string, contactIds: string[]): Promise<number> {
    const startTime = this.logger.logOperationStart('remove segment members', { tenantId, segmentId, count: contactIds.length });

    try {
      const result = await this.memberRepo.delete({
        tenantId,
        segmentId,
        contactId: In(contactIds),
      });

      const removedCount = result.affected || 0;

      // Update member count
      await this.updateMemberCount(tenantId, segmentId);

      this.logger.logDbQuery('DELETE segment_members', removedCount, { duration: Date.now() - startTime });
      this.logger.logOperationEnd('remove segment members', startTime, { removedCount });

      return removedCount;
    } catch (error) {
      this.logger.logOperationError('remove segment members', error as Error);
      throw error;
    }
  }

  async isMember(tenantId: string, segmentId: string, contactId: string): Promise<boolean> {
    const count = await this.memberRepo.count({
      where: { tenantId, segmentId, contactId },
    });
    return count > 0;
  }

  // ============ Dynamic Segment Recomputation ============

  async recomputeMembers(
    tenantId: string,
    segmentId: string,
    rules: SegmentRules,
    batchId: string,
  ): Promise<RecomputeResult> {
    const startTime = this.logger.logOperationStart('recompute segment members', { tenantId, segmentId, batchId });

    try {
      // Get current member count
      const previousCount = await this.memberRepo.count({
        where: { tenantId, segmentId },
      });

      // Generate membership query
      const compiled = this.ruleEngine.generateMembershipQuery(rules, tenantId);

      // Use raw query to get matching contact IDs
      const rawQuery = `
        SELECT c.id as contact_id
        FROM contacts c
        ${compiled.joins.join('\n')}
        WHERE c.tenant_id = $1
        AND c.deleted_at IS NULL
        AND (${compiled.sql.replace(/:tenantId/g, '$1')})
      `;

      // Replace named params with positional params for PostgreSQL
      const params = [tenantId];
      let paramIndex = 2;
      let processedQuery = rawQuery;
      
      for (const [key, value] of Object.entries(compiled.params)) {
        if (key === 'tenantId') continue;
        processedQuery = processedQuery.replace(new RegExp(`:${key}`, 'g'), `$${paramIndex}`);
        params.push(value as string);
        paramIndex++;
      }

      // Execute query to get matching contacts
      const matchingContacts: Array<{ contact_id: string }> = await this.segmentRepo.query(processedQuery, params);
      const newContactIds = new Set(matchingContacts.map((r) => r.contact_id));

      // Get current members
      const currentMembers = await this.memberRepo.find({
        where: { tenantId, segmentId },
        select: ['contactId'],
      });
      const currentContactIds = new Set(currentMembers.map((m) => m.contactId));

      // Calculate diffs
      const toAdd = [...newContactIds].filter((id) => !currentContactIds.has(id));
      const toRemove = [...currentContactIds].filter((id) => !newContactIds.has(id));

      // Perform updates in transaction
      await this.segmentRepo.manager.transaction(async (manager) => {
        // Remove old members
        if (toRemove.length > 0) {
          await manager.delete(SegmentMember, {
            tenantId,
            segmentId,
            contactId: In(toRemove),
          });
        }

        // Add new members
        if (toAdd.length > 0) {
          const newMembers = toAdd.map((contactId) => ({
            tenantId,
            segmentId,
            contactId,
            source: MemberSource.DYNAMIC,
            computedAt: new Date(),
            computationBatchId: batchId,
          }));

          await manager
            .createQueryBuilder()
            .insert()
            .into(SegmentMember)
            .values(newMembers)
            .orIgnore()
            .execute();
        }

        // Update existing dynamic members' computedAt
        await manager.update(
          SegmentMember,
          {
            tenantId,
            segmentId,
            source: MemberSource.DYNAMIC,
          },
          {
            computedAt: new Date(),
            computationBatchId: batchId,
          },
        );

        // Update segment metadata
        const durationMs = Date.now() - startTime;
        await manager.update(Segment, { id: segmentId, tenantId }, {
          memberCount: newContactIds.size,
          lastComputedAt: new Date(),
          computationDurationMs: durationMs,
        });
      });

      const result: RecomputeResult = {
        previousCount,
        newCount: newContactIds.size,
        addedCount: toAdd.length,
        removedCount: toRemove.length,
        durationMs: Date.now() - startTime,
        batchId,
      };

      this.logger.logDbQuery('RECOMPUTE segment_members', newContactIds.size, {
        added: toAdd.length,
        removed: toRemove.length,
        duration: result.durationMs,
      });
      this.logger.logOperationEnd('recompute segment members', startTime, {
        previousCount: result.previousCount,
        newCount: result.newCount,
        addedCount: result.addedCount,
        removedCount: result.removedCount,
      });

      return result;
    } catch (error) {
      this.logger.logOperationError('recompute segment members', error as Error);
      throw error;
    }
  }

  // ============ Preview ============

  async previewRules(
    tenantId: string,
    rules: SegmentRules,
    limit: number = 100,
  ): Promise<{ sample: Array<{ id: string; email?: string; firstName?: string; lastName?: string }>; count: number; durationMs: number }> {
    const startTime = this.logger.logOperationStart('preview segment rules', { tenantId });

    try {
      // Get count
      const countQuery = this.ruleEngine.generateCountQuery(rules, tenantId);
      const countResult = await this.executeRawQuery(countQuery, tenantId);
      const count = parseInt(countResult[0]?.count || '0', 10);

      // Get sample contacts
      const memberQuery = this.ruleEngine.generateMembershipQuery(rules, tenantId, limit);
      const contacts = await this.executeRawQuery(memberQuery, tenantId);

      const durationMs = Date.now() - startTime;

      this.logger.logDbQuery('PREVIEW segment rules', contacts.length, { count, duration: durationMs });
      this.logger.logOperationEnd('preview segment rules', startTime, { count });

      return {
        sample: contacts.map((c: any) => ({
          id: c.id,
          email: c.email,
          firstName: c.first_name,
          lastName: c.last_name,
        })),
        count,
        durationMs,
      };
    } catch (error) {
      this.logger.logOperationError('preview segment rules', error as Error);
      throw error;
    }
  }

  // ============ Scheduled Refresh ============

  async findSegmentsNeedingRefresh(): Promise<Segment[]> {
    const startTime = this.logger.logOperationStart('find segments needing refresh');

    try {
      const segments = await this.segmentRepo
        .createQueryBuilder('segment')
        .where('segment.type = :type', { type: SegmentType.DYNAMIC })
        .andWhere('segment.status = :status', { status: SegmentStatus.ACTIVE })
        .andWhere('segment.deleted_at IS NULL')
        .andWhere('segment.refresh_interval_minutes IS NOT NULL')
        .andWhere('(segment.next_refresh_at IS NULL OR segment.next_refresh_at <= NOW())')
        .orderBy('segment.next_refresh_at', 'ASC', 'NULLS FIRST')
        .take(100)
        .getMany();

      this.logger.logDbQuery('SELECT segments for refresh', segments.length, { duration: Date.now() - startTime });
      this.logger.logOperationEnd('find segments needing refresh', startTime, { count: segments.length });

      return segments;
    } catch (error) {
      this.logger.logOperationError('find segments needing refresh', error as Error);
      throw error;
    }
  }

  async updateNextRefreshTime(tenantId: string, segmentId: string, intervalMinutes: number): Promise<void> {
    const nextRefresh = new Date(Date.now() + intervalMinutes * 60 * 1000);
    await this.segmentRepo.update(
      { id: segmentId, tenantId },
      { nextRefreshAt: nextRefresh },
    );
  }

  // ============ Contact Segments ============

  async findByContactId(tenantId: string, contactId: string): Promise<Segment[]> {
    const startTime = this.logger.logOperationStart('find segments by contact', { tenantId, contactId });

    try {
      const segments = await this.segmentRepo
        .createQueryBuilder('segment')
        .innerJoin('segment_members', 'sm', 'sm.segment_id = segment.id AND sm.tenant_id = segment.tenant_id')
        .where('segment.tenant_id = :tenantId', { tenantId })
        .andWhere('sm.contact_id = :contactId', { contactId })
        .andWhere('segment.deleted_at IS NULL')
        .orderBy('segment.name', 'ASC')
        .getMany();

      this.logger.logDbQuery('SELECT segments for contact', segments.length, { duration: Date.now() - startTime });
      this.logger.logOperationEnd('find segments by contact', startTime, { count: segments.length });

      return segments;
    } catch (error) {
      this.logger.logOperationError('find segments by contact', error as Error);
      throw error;
    }
  }

  // ============ Helpers ============

  private async updateMemberCount(tenantId: string, segmentId: string): Promise<void> {
    const count = await this.memberRepo.count({
      where: { tenantId, segmentId },
    });
    await this.segmentRepo.update({ id: segmentId, tenantId }, { memberCount: count });
  }

  private async executeRawQuery(compiled: CompiledQuery, tenantId: string): Promise<any[]> {
    // Convert named params to positional params
    let sql = compiled.sql;
    const params: unknown[] = [tenantId];
    let paramIndex = 2;

    // Replace :tenantId first
    sql = sql.replace(/:tenantId/g, '$1');

    // Replace other params
    for (const [key, value] of Object.entries(compiled.params)) {
      if (key === 'tenantId') continue;
      sql = sql.replace(new RegExp(`:${key}`, 'g'), `$${paramIndex}`);
      params.push(value);
      paramIndex++;
    }

    return this.segmentRepo.query(sql, params);
  }

  private toSnakeCase(str: string): string {
    return str.replace(/[A-Z]/g, (letter) => `_${letter.toLowerCase()}`);
  }
}

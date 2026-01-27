import { Injectable } from '@nestjs/common';
import { InboxThreadRepository } from '../repositories/inbox-thread.repository';
import { InboxActivityRepository } from '../repositories/inbox-activity.repository';
import { InboxThread } from '../entities/inbox-thread.entity';
import { DistributionStrategy } from '../entities/inbox.enums';
import {
  DistributeThreadsDto,
  DistributionResultDto,
} from '../dto/inbox.dto';
import { InboxEventFactory, INBOX_EVENTS } from '../events/inbox.events';
import { EventBusService } from '../../../common/services/event-bus.service';
import { AppLoggerService } from '../../../common/logger/app-logger.service';

export interface AgentWorkload {
  agentId: string;
  assignedCount: number;
}

@Injectable()
export class InboxDistributionService {
  constructor(
    private readonly threadRepo: InboxThreadRepository,
    private readonly activityRepo: InboxActivityRepository,
    private readonly eventBus: EventBusService,
    private readonly logger: AppLoggerService,
  ) {
    this.logger.setContext('InboxDistributionService');
  }

  /**
   * Distribute unassigned threads to agents
   */
  async distributeThreads(
    tenantId: string,
    dto: DistributeThreadsDto,
    userId?: string,
    correlationId?: string,
  ): Promise<DistributionResultDto> {
    const startTime = this.logger.logOperationStart('distribute threads', {
      strategy: dto.strategy,
      agentCount: dto.agentIds.length,
    });

    // Get unassigned threads
    const unassignedThreads = await this.threadRepo.findUnassigned(tenantId, 100);

    if (unassignedThreads.length === 0) {
      this.logger.logOperationEnd('distribute threads', startTime, { distributed: 0 });
      return {
        distributed: 0,
        assignments: {},
      };
    }

    // Get current workload for each agent
    const workloads: AgentWorkload[] = await Promise.all(
      dto.agentIds.map(async (agentId) => ({
        agentId,
        assignedCount: await this.threadRepo.countAssignedTo(tenantId, agentId),
      })),
    );

    // Distribute based on strategy
    const assignments: Record<string, string[]> = {};
    dto.agentIds.forEach((id) => (assignments[id] = []));

    switch (dto.strategy) {
      case DistributionStrategy.ROUND_ROBIN:
        await this.distributeRoundRobin(tenantId, unassignedThreads, dto.agentIds, assignments, userId);
        break;

      case DistributionStrategy.LEAST_BUSY:
        await this.distributeLeastBusy(tenantId, unassignedThreads, workloads, assignments, userId);
        break;

      case DistributionStrategy.RANDOM:
        await this.distributeRandom(tenantId, unassignedThreads, dto.agentIds, assignments, userId);
        break;

      default:
        this.logger.warn(`Unknown distribution strategy: ${dto.strategy}, using round-robin`);
        await this.distributeRoundRobin(tenantId, unassignedThreads, dto.agentIds, assignments, userId);
    }

    // Count distributed
    const distributed = Object.values(assignments).reduce((sum, arr) => sum + arr.length, 0);

    // Publish distribution event
    const event = InboxEventFactory.createThreadsDistributedEvent(
      tenantId,
      distributed,
      dto.agentIds.length,
      dto.strategy || DistributionStrategy.ROUND_ROBIN,
      assignments,
      correlationId,
    );
    await this.eventBus.publish(INBOX_EVENTS.THREADS_DISTRIBUTED, event);

    this.logger.logOperationEnd('distribute threads', startTime, { distributed });

    return {
      distributed,
      assignments,
    };
  }

  /**
   * Round-robin distribution
   */
  private async distributeRoundRobin(
    tenantId: string,
    threads: InboxThread[],
    agentIds: string[],
    assignments: Record<string, string[]>,
    userId?: string,
  ): Promise<void> {
    let agentIndex = 0;

    for (const thread of threads) {
      const agentId = agentIds[agentIndex % agentIds.length];
      await this.assignThreadToAgent(tenantId, thread, agentId, userId);
      assignments[agentId].push(thread.id);
      agentIndex++;
    }
  }

  /**
   * Least-busy distribution
   */
  private async distributeLeastBusy(
    tenantId: string,
    threads: InboxThread[],
    workloads: AgentWorkload[],
    assignments: Record<string, string[]>,
    userId?: string,
  ): Promise<void> {
    // Create a mutable copy of workloads
    const mutableWorkloads = workloads.map((w) => ({ ...w }));

    for (const thread of threads) {
      // Sort by assigned count (ascending)
      mutableWorkloads.sort((a, b) => a.assignedCount - b.assignedCount);

      const agent = mutableWorkloads[0];
      await this.assignThreadToAgent(tenantId, thread, agent.agentId, userId);
      assignments[agent.agentId].push(thread.id);
      agent.assignedCount++;
    }
  }

  /**
   * Random distribution
   */
  private async distributeRandom(
    tenantId: string,
    threads: InboxThread[],
    agentIds: string[],
    assignments: Record<string, string[]>,
    userId?: string,
  ): Promise<void> {
    for (const thread of threads) {
      const randomIndex = Math.floor(Math.random() * agentIds.length);
      const agentId = agentIds[randomIndex];
      await this.assignThreadToAgent(tenantId, thread, agentId, userId);
      assignments[agentId].push(thread.id);
    }
  }

  /**
   * Assign single thread to agent
   */
  private async assignThreadToAgent(
    tenantId: string,
    thread: InboxThread,
    agentId: string,
    userId?: string,
  ): Promise<void> {
    const oldAssignedTo = thread.assignedTo;
    await this.threadRepo.assignTo(tenantId, thread.id, agentId);
    await this.activityRepo.recordAssignment(tenantId, thread.id, oldAssignedTo, agentId, userId);
  }

  /**
   * Auto-distribute single thread to best available agent
   */
  async autoAssignThread(
    tenantId: string,
    threadId: string,
    agentIds: string[],
    strategy: DistributionStrategy = DistributionStrategy.LEAST_BUSY,
    userId?: string,
    correlationId?: string,
  ): Promise<string | null> {
    const startTime = this.logger.logOperationStart('auto assign thread', { threadId, strategy });

    if (agentIds.length === 0) {
      this.logger.warn('No agents available for auto-assignment');
      return null;
    }

    const thread = await this.threadRepo.findById(tenantId, threadId);
    if (!thread || thread.assignedTo) {
      this.logger.logOperationEnd('auto assign thread', startTime, { skipped: true });
      return thread?.assignedTo || null;
    }

    let selectedAgent: string;

    switch (strategy) {
      case DistributionStrategy.LEAST_BUSY:
        const workloads = await Promise.all(
          agentIds.map(async (agentId) => ({
            agentId,
            assignedCount: await this.threadRepo.countAssignedTo(tenantId, agentId),
          })),
        );
        workloads.sort((a, b) => a.assignedCount - b.assignedCount);
        selectedAgent = workloads[0].agentId;
        break;

      case DistributionStrategy.RANDOM:
        selectedAgent = agentIds[Math.floor(Math.random() * agentIds.length)];
        break;

      case DistributionStrategy.ROUND_ROBIN:
      default:
        selectedAgent = agentIds[0];
    }

    await this.assignThreadToAgent(tenantId, thread, selectedAgent, userId);

    // Publish event
    const event = InboxEventFactory.createThreadAssignedEvent(
      tenantId,
      threadId,
      thread.contactId,
      thread.channel,
      selectedAgent,
      correlationId,
    );
    await this.eventBus.publish(INBOX_EVENTS.THREAD_ASSIGNED, event);

    this.logger.logOperationEnd('auto assign thread', startTime, { assignedTo: selectedAgent });

    return selectedAgent;
  }
}

import { Injectable } from '@nestjs/common';
import { InboxThreadRepository } from '../repositories/inbox-thread.repository';
import { AppLoggerService } from '../../../common/logger/app-logger.service';

export interface AgentStats {
  agentId: string;
  assignedThreads: number;
  openThreads: number;
  isOnline: boolean;
  lastActivityAt?: Date;
}

@Injectable()
export class InboxAgentService {
  // In-memory store for agent status (would typically use Redis in production)
  private agentStatus: Map<string, { isOnline: boolean; lastActivityAt: Date }> = new Map();

  constructor(
    private readonly threadRepo: InboxThreadRepository,
    private readonly logger: AppLoggerService,
  ) {
    this.logger.setContext('InboxAgentService');
  }

  /**
   * Set agent online status
   */
  async setAgentOnline(tenantId: string, agentId: string, isOnline: boolean): Promise<void> {
    const key = `${tenantId}:${agentId}`;
    this.agentStatus.set(key, {
      isOnline,
      lastActivityAt: new Date(),
    });
    this.logger.debug(`Agent ${agentId} is now ${isOnline ? 'online' : 'offline'}`);
  }

  /**
   * Check if agent is online
   */
  isAgentOnline(tenantId: string, agentId: string): boolean {
    const key = `${tenantId}:${agentId}`;
    const status = this.agentStatus.get(key);
    return status?.isOnline || false;
  }

  /**
   * Get online agents
   */
  getOnlineAgents(tenantId: string, agentIds: string[]): string[] {
    return agentIds.filter((id) => this.isAgentOnline(tenantId, id));
  }

  /**
   * Update agent last activity
   */
  async updateAgentActivity(tenantId: string, agentId: string): Promise<void> {
    const key = `${tenantId}:${agentId}`;
    const current = this.agentStatus.get(key);
    this.agentStatus.set(key, {
      isOnline: current?.isOnline || true,
      lastActivityAt: new Date(),
    });
  }

  /**
   * Get agent stats
   */
  async getAgentStats(tenantId: string, agentId: string): Promise<AgentStats> {
    const startTime = this.logger.logOperationStart('get agent stats', { agentId });

    const assignedThreads = await this.threadRepo.countAssignedTo(tenantId, agentId);
    const key = `${tenantId}:${agentId}`;
    const status = this.agentStatus.get(key);

    this.logger.logOperationEnd('get agent stats', startTime);

    return {
      agentId,
      assignedThreads,
      openThreads: assignedThreads, // Simplified - same as assigned for now
      isOnline: status?.isOnline || false,
      lastActivityAt: status?.lastActivityAt,
    };
  }

  /**
   * Get multiple agents stats
   */
  async getAgentsStats(tenantId: string, agentIds: string[]): Promise<AgentStats[]> {
    const startTime = this.logger.logOperationStart('get agents stats', { count: agentIds.length });

    const stats = await Promise.all(
      agentIds.map((id) => this.getAgentStats(tenantId, id)),
    );

    this.logger.logOperationEnd('get agents stats', startTime);

    return stats;
  }

  /**
   * Get agents sorted by workload (least busy first)
   */
  async getAgentsByWorkload(tenantId: string, agentIds: string[]): Promise<AgentStats[]> {
    const stats = await this.getAgentsStats(tenantId, agentIds);
    return stats.sort((a, b) => a.assignedThreads - b.assignedThreads);
  }

  /**
   * Get available agents (online and under capacity)
   */
  async getAvailableAgents(
    tenantId: string,
    agentIds: string[],
    maxCapacity?: number,
  ): Promise<string[]> {
    const startTime = this.logger.logOperationStart('get available agents');

    const stats = await this.getAgentsStats(tenantId, agentIds);

    const available = stats
      .filter((s) => {
        if (!s.isOnline) return false;
        if (maxCapacity && s.assignedThreads >= maxCapacity) return false;
        return true;
      })
      .map((s) => s.agentId);

    this.logger.logOperationEnd('get available agents', startTime, { count: available.length });

    return available;
  }

  /**
   * Find best agent for assignment
   */
  async findBestAgent(
    tenantId: string,
    agentIds: string[],
    preferOnline = true,
    maxCapacity?: number,
  ): Promise<string | null> {
    const startTime = this.logger.logOperationStart('find best agent');

    let candidates = agentIds;

    // Filter to online agents if preferred
    if (preferOnline) {
      const onlineAgents = this.getOnlineAgents(tenantId, agentIds);
      if (onlineAgents.length > 0) {
        candidates = onlineAgents;
      }
    }

    // Get stats for candidates
    const stats = await this.getAgentsStats(tenantId, candidates);

    // Filter by capacity and sort by workload
    const available = stats
      .filter((s) => !maxCapacity || s.assignedThreads < maxCapacity)
      .sort((a, b) => a.assignedThreads - b.assignedThreads);

    const bestAgent = available[0]?.agentId || null;

    this.logger.logOperationEnd('find best agent', startTime, { bestAgent });

    return bestAgent;
  }

  /**
   * Get threads assigned to agent
   */
  async getAgentThreads(
    tenantId: string,
    agentId: string,
    page = 1,
    limit = 20,
  ) {
    return this.threadRepo.findMany(tenantId, {
      assignedTo: agentId,
      page,
      limit,
    });
  }

  /**
   * Cleanup stale agent sessions (called periodically)
   */
  cleanupStaleSessions(tenantId: string, maxIdleMinutes = 30): void {
    const now = new Date();
    const maxIdleMs = maxIdleMinutes * 60 * 1000;

    for (const [key, status] of this.agentStatus.entries()) {
      if (!key.startsWith(`${tenantId}:`)) continue;

      const idleTime = now.getTime() - status.lastActivityAt.getTime();
      if (idleTime > maxIdleMs) {
        this.agentStatus.set(key, {
          ...status,
          isOnline: false,
        });
        this.logger.debug(`Agent ${key} marked offline due to inactivity`);
      }
    }
  }
}

import { Injectable, OnModuleInit } from '@nestjs/common';

export type LogLevel = 'debug' | 'info' | 'warn' | 'error';

export interface DevLogEntry {
  id: string;
  timestamp: string;
  level: LogLevel;
  module: string;
  message: string;
  context?: Record<string, unknown>;
}

export interface LogsQueryOptions {
  limit?: number;
  level?: LogLevel;
  module?: string;
  since?: string; // ISO timestamp
}

export interface LogsResponse {
  logs: DevLogEntry[];
  total: number;
  hasMore: boolean;
}

/**
 * Service for storing and retrieving dev playground activity logs
 * Uses an in-memory ring buffer to store recent logs
 */
@Injectable()
export class DevLogsService implements OnModuleInit {
  private readonly MAX_LOGS = 1000;
  private logs: DevLogEntry[] = [];
  private logIdCounter = 0;

  onModuleInit() {
    this.info('DevLogsService', 'Dev Logs service initialized');
  }

  /**
   * Add a log entry
   */
  private addLog(level: LogLevel, module: string, message: string, context?: Record<string, unknown>): void {
    const entry: DevLogEntry = {
      id: `log_${++this.logIdCounter}`,
      timestamp: new Date().toISOString(),
      level,
      module,
      message,
      context,
    };

    this.logs.push(entry);

    // Keep only the most recent logs
    if (this.logs.length > this.MAX_LOGS) {
      this.logs = this.logs.slice(-this.MAX_LOGS);
    }
  }

  /**
   * Log debug message
   */
  debug(module: string, message: string, context?: Record<string, unknown>): void {
    this.addLog('debug', module, message, context);
  }

  /**
   * Log info message
   */
  info(module: string, message: string, context?: Record<string, unknown>): void {
    this.addLog('info', module, message, context);
  }

  /**
   * Log warning message
   */
  warn(module: string, message: string, context?: Record<string, unknown>): void {
    this.addLog('warn', module, message, context);
  }

  /**
   * Log error message
   */
  error(module: string, message: string, context?: Record<string, unknown>): void {
    this.addLog('error', module, message, context);
  }

  /**
   * Get logs with optional filtering
   */
  getLogs(options: LogsQueryOptions = {}): LogsResponse {
    const { limit = 50, level, module, since } = options;

    let filtered = [...this.logs];

    // Filter by level
    if (level) {
      filtered = filtered.filter((log) => log.level === level);
    }

    // Filter by module
    if (module) {
      filtered = filtered.filter((log) => 
        log.module.toLowerCase().includes(module.toLowerCase())
      );
    }

    // Filter by timestamp
    if (since) {
      const sinceDate = new Date(since);
      filtered = filtered.filter((log) => new Date(log.timestamp) > sinceDate);
    }

    // Sort by timestamp descending (most recent first)
    filtered.sort((a, b) => 
      new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
    );

    const total = filtered.length;
    const hasMore = total > limit;
    const logs = filtered.slice(0, limit);

    return {
      logs,
      total,
      hasMore,
    };
  }

  /**
   * Get logs newer than a specific log ID
   * Useful for polling for new logs
   */
  getNewLogs(afterLogId: string, limit: number = 50): LogsResponse {
    const afterIndex = this.logs.findIndex((log) => log.id === afterLogId);
    
    if (afterIndex === -1) {
      // Log not found, return recent logs
      return this.getLogs({ limit });
    }

    const newLogs = this.logs.slice(afterIndex + 1);
    const sorted = newLogs
      .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())
      .slice(0, limit);

    return {
      logs: sorted,
      total: newLogs.length,
      hasMore: newLogs.length > limit,
    };
  }

  /**
   * Clear all logs
   */
  clearLogs(): void {
    this.logs = [];
    this.info('DevLogsService', 'Logs cleared');
  }

  /**
   * Get log stats
   */
  getStats(): { total: number; byLevel: Record<LogLevel, number> } {
    const byLevel: Record<LogLevel, number> = {
      debug: 0,
      info: 0,
      warn: 0,
      error: 0,
    };

    for (const log of this.logs) {
      byLevel[log.level]++;
    }

    return {
      total: this.logs.length,
      byLevel,
    };
  }
}

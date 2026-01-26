import { Injectable, LoggerService, Scope } from '@nestjs/common';
import pino, { Logger } from 'pino';

export interface LogContext {
  tenantId?: string;
  userId?: string;
  correlationId?: string;
  operation?: string;
  module?: string;
  duration?: number;
  [key: string]: unknown;
}

@Injectable({ scope: Scope.TRANSIENT })
export class AppLoggerService implements LoggerService {
  private logger: Logger;
  private context: string = 'Application';
  private defaultMeta: LogContext = {};

  constructor() {
    this.logger = pino({
      level: process.env.LOG_LEVEL || 'info',
      formatters: {
        level: (label) => ({ level: label }),
        bindings: () => ({}),
      },
      timestamp: () => `,"timestamp":"${new Date().toISOString()}"`,
      transport:
        process.env.NODE_ENV !== 'production'
          ? {
              target: 'pino-pretty',
              options: {
                colorize: true,
                translateTime: 'SYS:standard',
                ignore: 'pid,hostname',
              },
            }
          : undefined,
    });
  }

  setContext(context: string): void {
    this.context = context;
  }

  setMeta(meta: LogContext): void {
    this.defaultMeta = { ...this.defaultMeta, ...meta };
  }

  private formatMessage(message: string, context?: LogContext): object {
    return {
      module: this.context,
      ...this.defaultMeta,
      ...context,
      message,
    };
  }

  log(message: string, context?: LogContext | string): void {
    if (typeof context === 'string') {
      this.logger.info(this.formatMessage(message, { module: context }));
    } else {
      this.logger.info(this.formatMessage(message, context));
    }
  }

  info(message: string, context?: LogContext): void {
    this.logger.info(this.formatMessage(message, context));
  }

  error(message: string, trace?: string, context?: LogContext | string): void {
    const ctx = typeof context === 'string' ? { module: context } : context;
    this.logger.error({
      ...this.formatMessage(message, ctx),
      stack: trace,
    });
  }

  warn(message: string, context?: LogContext | string): void {
    if (typeof context === 'string') {
      this.logger.warn(this.formatMessage(message, { module: context }));
    } else {
      this.logger.warn(this.formatMessage(message, context));
    }
  }

  debug(message: string, context?: LogContext): void {
    this.logger.debug(this.formatMessage(message, context));
  }

  verbose(message: string, context?: LogContext): void {
    this.logger.trace(this.formatMessage(message, context));
  }

  // Operation logging helpers
  logOperationStart(operation: string, context?: LogContext): number {
    const startTime = Date.now();
    this.info(`[START] ${operation}`, { operation, ...context });
    return startTime;
  }

  logOperationEnd(operation: string, startTime: number, context?: LogContext): void {
    const duration = Date.now() - startTime;
    this.info(`[END] ${operation}`, { operation, duration, ...context });
  }

  logOperationError(operation: string, error: Error, context?: LogContext): void {
    this.error(`[ERROR] ${operation}: ${error.message}`, error.stack, {
      operation,
      errorName: error.name,
      ...context,
    });
  }

  logDbQuery(intent: string, rowsAffected?: number, context?: LogContext): void {
    this.debug(`[DB] ${intent}`, { rowsAffected, ...context });
  }

  logEventPublish(eventName: string, correlationId: string, context?: LogContext): void {
    this.info(`[EVENT] Published: ${eventName}`, {
      eventName,
      correlationId,
      ...context,
    });
  }

  logExternalCall(service: string, method: string, context?: LogContext): void {
    this.info(`[EXTERNAL] ${service}.${method}`, { service, method, ...context });
  }
}

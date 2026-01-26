import { Injectable, NestMiddleware } from '@nestjs/common';
import { Request, Response, NextFunction } from 'express';
import { AppLoggerService } from '../logger/app-logger.service';
import { v4 as uuidv4 } from 'uuid';

// Extend Express Request to include our custom properties
declare global {
  namespace Express {
    interface Request {
      correlationId?: string;
      startTime?: number;
      tenantId?: string;
      userId?: string;
    }
  }
}

const SENSITIVE_KEYS = [
  'password',
  'token',
  'secret',
  'apiKey',
  'api_key',
  'authorization',
  'credit_card',
  'creditCard',
  'cvv',
  'ssn',
];

@Injectable()
export class RequestLoggingMiddleware implements NestMiddleware {
  private readonly logger: AppLoggerService;

  constructor() {
    this.logger = new AppLoggerService();
    this.logger.setContext('RequestLogging');
  }

  use(req: Request, res: Response, next: NextFunction): void {
    const correlationId = (req.headers['x-correlation-id'] as string) || uuidv4();
    const startTime = Date.now();

    // Attach to request for use in handlers
    req.correlationId = correlationId;
    req.startTime = startTime;
    req.tenantId = req.headers['x-tenant-id'] as string;
    req.userId = req.headers['x-user-id'] as string;

    // Set correlation ID in response
    res.setHeader('x-correlation-id', correlationId);

    // Log request
    this.logger.info(`[REQUEST] ${req.method} ${req.path}`, {
      correlationId,
      tenantId: req.tenantId,
      userId: req.userId,
      method: req.method,
      path: req.path,
      query: req.query,
      body: this.maskSensitiveData(req.body),
      userAgent: req.headers['user-agent'],
      ip: req.ip,
    });

    // Capture response
    const originalSend = res.send;
    res.send = (body: unknown): Response => {
      const duration = Date.now() - startTime;

      this.logger.info(`[RESPONSE] ${req.method} ${req.path}`, {
        correlationId,
        tenantId: req.tenantId,
        userId: req.userId,
        method: req.method,
        path: req.path,
        statusCode: res.statusCode,
        duration,
        contentLength: res.get('content-length'),
      });

      return originalSend.call(res, body);
    };

    next();
  }

  private maskSensitiveData(data: unknown): unknown {
    if (!data || typeof data !== 'object') {
      return data;
    }

    if (Array.isArray(data)) {
      return data.map((item) => this.maskSensitiveData(item));
    }

    const masked: Record<string, unknown> = {};
    for (const [key, value] of Object.entries(data)) {
      if (SENSITIVE_KEYS.some((k) => key.toLowerCase().includes(k.toLowerCase()))) {
        masked[key] = '[REDACTED]';
      } else if (typeof value === 'object' && value !== null) {
        masked[key] = this.maskSensitiveData(value);
      } else {
        masked[key] = value;
      }
    }
    return masked;
  }
}

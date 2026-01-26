import { createParamDecorator, ExecutionContext } from '@nestjs/common';
import { Request } from 'express';
import { v4 as uuidv4 } from 'uuid';

export const CorrelationId = createParamDecorator(
  (data: unknown, ctx: ExecutionContext): string => {
    const request = ctx.switchToHttp().getRequest<Request>();
    return request.correlationId || (request.headers['x-correlation-id'] as string) || uuidv4();
  },
);

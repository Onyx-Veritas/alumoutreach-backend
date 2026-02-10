import { createParamDecorator, ExecutionContext } from '@nestjs/common';
import { Request } from 'express';

export interface TenantContext {
  tenantId: string;
}

export const Tenant = createParamDecorator(
  (data: unknown, ctx: ExecutionContext): TenantContext => {
    const request = ctx.switchToHttp().getRequest<Request>();

    // Prefer JWT-authenticated tenantId, fall back to header
    const tenantId = (request as any).user?.tenantId
      || request.headers['x-tenant-id'] as string;

    if (!tenantId) {
      throw new Error('Tenant ID is required. Authenticate or provide X-Tenant-ID header.');
    }

    return { tenantId };
  },
);

export const TenantId = createParamDecorator(
  (data: unknown, ctx: ExecutionContext): string => {
    const request = ctx.switchToHttp().getRequest<Request>();

    // Prefer JWT-authenticated tenantId, fall back to header
    const tenantId = (request as any).user?.tenantId
      || request.headers['x-tenant-id'] as string;

    if (!tenantId) {
      throw new Error('Tenant ID is required. Authenticate or provide X-Tenant-ID header.');
    }

    return tenantId;
  },
);

import { Injectable, CanActivate, ExecutionContext } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { IS_PUBLIC_KEY } from '../decorators/public.decorator';

/**
 * Ensures that the authenticated user's tenantId (from JWT) is used for all operations.
 * Overrides any x-tenant-id header with the JWT's tenantId to prevent cross-tenant access.
 *
 * For public routes or API key routes, this guard passes through.
 */
@Injectable()
export class TenantGuard implements CanActivate {
  constructor(private reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);

    if (isPublic) {
      return true;
    }

    const request = context.switchToHttp().getRequest();

    // If user was authenticated (JWT or API key), enforce their tenantId
    if (request.user?.tenantId) {
      // Override any header-provided tenantId with the authenticated one
      request.headers['x-tenant-id'] = request.user.tenantId;
      request.tenantId = request.user.tenantId;
    }

    return true;
  }
}

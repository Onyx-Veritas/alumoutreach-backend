import { createParamDecorator, ExecutionContext } from '@nestjs/common';
import { Request } from 'express';
import { SYSTEM_USER_ID } from '../constants/system';

export interface CurrentUserContext {
  userId: string;
  tenantId?: string;
  email?: string;
  role?: string;
  roles?: string[];
}

export const CurrentUser = createParamDecorator(
  (data: keyof CurrentUserContext | undefined, ctx: ExecutionContext) => {
    const request = ctx.switchToHttp().getRequest<Request>();

    // Prefer JWT-authenticated user, fall back to headers
    const jwtUser = (request as any).user;

    const user: CurrentUserContext = {
      userId: jwtUser?.userId || request.headers['x-user-id'] as string || SYSTEM_USER_ID,
      tenantId: jwtUser?.tenantId || request.headers['x-tenant-id'] as string,
      email: jwtUser?.email || request.headers['x-user-email'] as string,
      role: jwtUser?.role,
      roles: jwtUser?.role
        ? [jwtUser.role]
        : request.headers['x-user-roles']
          ? (request.headers['x-user-roles'] as string).split(',')
          : [],
    };

    return data ? user[data] : user;
  },
);

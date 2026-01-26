import { createParamDecorator, ExecutionContext } from '@nestjs/common';
import { Request } from 'express';

export interface CurrentUserContext {
  userId: string;
  email?: string;
  roles?: string[];
}

export const CurrentUser = createParamDecorator(
  (data: keyof CurrentUserContext | undefined, ctx: ExecutionContext) => {
    const request = ctx.switchToHttp().getRequest<Request>();

    const user: CurrentUserContext = {
      userId: request.headers['x-user-id'] as string || 'anonymous',
      email: request.headers['x-user-email'] as string,
      roles: request.headers['x-user-roles']
        ? (request.headers['x-user-roles'] as string).split(',')
        : [],
    };

    return data ? user[data] : user;
  },
);

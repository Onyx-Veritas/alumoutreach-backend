import { Injectable, CanActivate, ExecutionContext, ForbiddenException } from '@nestjs/common';

/**
 * DevOnlyGuard - Prevents dev endpoints from running in production
 * 
 * This guard MUST be applied to all /api/dev/* routes.
 * It performs a hard check against NODE_ENV and fails fast if misconfigured.
 */
@Injectable()
export class DevOnlyGuard implements CanActivate {
  private readonly isDevEnvironment: boolean;

  constructor() {
    // Cache the environment check at startup
    this.isDevEnvironment = process.env.NODE_ENV !== 'production';
    
    if (!this.isDevEnvironment) {
      console.error('⚠️  DevOnlyGuard: Dev Playground is DISABLED in production environment');
    }
  }

  canActivate(context: ExecutionContext): boolean {
    // Hard block in production - no exceptions
    if (process.env.NODE_ENV === 'production') {
      throw new ForbiddenException({
        error: 'DEV_PLAYGROUND_DISABLED',
        message: 'Dev Playground is disabled in production environment',
        hint: 'This endpoint is only available in development mode',
      });
    }

    // Additional safety: require explicit dev mode flag
    const devModeEnabled = process.env.DEV_PLAYGROUND_ENABLED === 'true';
    if (!devModeEnabled && process.env.NODE_ENV !== 'development') {
      throw new ForbiddenException({
        error: 'DEV_PLAYGROUND_NOT_ENABLED',
        message: 'Dev Playground requires DEV_PLAYGROUND_ENABLED=true',
        hint: 'Set DEV_PLAYGROUND_ENABLED=true in your environment',
      });
    }

    return true;
  }
}

# Common Module

## 1. Overview

The Common Module provides shared infrastructure, utilities, decorators, guards, interceptors, and base classes used across all other modules in the AlumOutreach API Gateway. It establishes conventions for logging, error handling, multi-tenancy, event bus communication, and database operations.

**Key Responsibilities:**
- Multi-tenancy infrastructure (decorators, guards)
- Logging service with structured context
- Event bus abstraction for NATS JetStream
- Base entities and repositories
- Common DTOs and response formats
- Exception filters and error handling
- Interceptors (logging, timing, transformation)
- Utility functions and helpers

## 2. Architecture

### Components

| Component                | File                                         | Purpose                              |
|--------------------------|----------------------------------------------|--------------------------------------|
| **Logger Service**       | `services/app-logger.service.ts`             | Structured logging                   |
| **Event Bus Service**    | `services/event-bus.service.ts`              | NATS JetStream abstraction           |
| **Decorators**           | `decorators/*.decorator.ts`                  | @TenantId, @CurrentUser, @CorrelationId |
| **Guards**               | `guards/*.guard.ts`                          | TenantGuard, AuthGuard               |
| **Interceptors**         | `interceptors/*.interceptor.ts`              | Logging, timing, transformation      |
| **Filters**              | `filters/*.filter.ts`                        | Exception handling                   |
| **Base Classes**         | `base/*.ts`                                  | BaseEntity, BaseRepository           |
| **DTOs**                 | `dto/*.dto.ts`                               | Pagination, response wrappers        |

### Module Structure

```
CommonModule
├── Services
│   ├── AppLoggerService
│   └── EventBusService
├── Decorators
│   ├── @TenantId()
│   ├── @CurrentUser()
│   ├── @CorrelationId()
│   └── @Public()
├── Guards
│   ├── TenantGuard
│   └── JwtAuthGuard
├── Interceptors
│   ├── LoggingInterceptor
│   ├── TimingInterceptor
│   └── TransformInterceptor
├── Filters
│   └── AllExceptionsFilter
├── Base
│   ├── BaseEntity
│   └── BaseRepository
└── DTOs
    ├── PaginationDto
    ├── ApiResponse
    └── ErrorResponse
```

## 3. Logger Service

### AppLoggerService

```typescript
@Injectable({ scope: Scope.TRANSIENT })
export class AppLoggerService implements LoggerService {
  private context: string = 'Application';

  setContext(context: string): void {
    this.context = context;
  }

  log(message: string, context?: LogContext): void {
    console.log(JSON.stringify({
      level: 'info',
      timestamp: new Date().toISOString(),
      context: this.context,
      message,
      ...context,
    }));
  }

  error(message: string, trace?: string, context?: LogContext): void {
    console.error(JSON.stringify({
      level: 'error',
      timestamp: new Date().toISOString(),
      context: this.context,
      message,
      trace,
      ...context,
    }));
  }

  warn(message: string, context?: LogContext): void {
    console.warn(JSON.stringify({
      level: 'warn',
      timestamp: new Date().toISOString(),
      context: this.context,
      message,
      ...context,
    }));
  }

  debug(message: string, context?: LogContext): void {
    if (process.env.LOG_LEVEL === 'debug') {
      console.debug(JSON.stringify({
        level: 'debug',
        timestamp: new Date().toISOString(),
        context: this.context,
        message,
        ...context,
      }));
    }
  }
}
```

### LogContext Interface

```typescript
interface LogContext {
  tenantId?: string;
  correlationId?: string;
  userId?: string;
  operation?: string;
  duration?: number;
  [key: string]: unknown;
}
```

### Usage Pattern

```typescript
@Injectable()
export class MyService {
  constructor(private logger: AppLoggerService) {
    this.logger.setContext(MyService.name);
  }

  async doSomething(tenantId: string, correlationId: string) {
    const startTime = Date.now();
    
    this.logger.log('[START] doSomething', {
      tenantId,
      correlationId,
      operation: 'doSomething',
    });

    // ... business logic ...

    this.logger.log('[END] doSomething', {
      tenantId,
      correlationId,
      operation: 'doSomething',
      duration: Date.now() - startTime,
    });
  }
}
```

## 4. Event Bus Service

### EventBusService

```typescript
@Injectable()
export class EventBusService {
  private jetstream: JetStream;

  constructor(private natsConnection: NatsConnection) {
    this.jetstream = this.natsConnection.jetstream();
  }

  async publish<T extends BaseEvent>(subject: string, event: T): Promise<void> {
    const payload = JSON.stringify(event);
    await this.jetstream.publish(subject, payload);
  }

  async subscribe<T extends BaseEvent>(
    subject: string,
    handler: (event: T) => Promise<void>,
    options?: SubscribeOptions,
  ): Promise<void> {
    const consumer = await this.jetstream.consumers.get(
      options?.stream || 'EVENTS',
      options?.consumer,
    );
    
    const messages = await consumer.consume();
    for await (const msg of messages) {
      const event = JSON.parse(msg.data.toString()) as T;
      try {
        await handler(event);
        msg.ack();
      } catch (error) {
        msg.nak();
      }
    }
  }
}
```

### BaseEvent Interface

```typescript
interface BaseEvent {
  version: string;
  source: string;
  tenantId: string;
  correlationId: string;
  timestamp: string;
  data: Record<string, unknown>;
}
```

### Usage Pattern

```typescript
// Publishing
await this.eventBus.publish('contact.created', {
  version: '1.0',
  source: 'contacts-service',
  tenantId,
  correlationId,
  timestamp: new Date().toISOString(),
  data: { contactId, email },
});

// Subscribing
await this.eventBus.subscribe('contact.created', async (event) => {
  await this.handleContactCreated(event);
});
```

## 5. Decorators

### @TenantId()

Extracts tenant ID from request header.

```typescript
export const TenantId = createParamDecorator(
  (data: unknown, ctx: ExecutionContext): string => {
    const request = ctx.switchToHttp().getRequest();
    const tenantId = request.headers['x-tenant-id'];
    if (!tenantId) {
      throw new BadRequestException('X-Tenant-ID header is required');
    }
    return tenantId;
  },
);

// Usage
@Get()
async getContacts(@TenantId() tenantId: string) {
  return this.contactsService.findAll(tenantId);
}
```

### @CurrentUser()

Extracts user information from JWT token.

```typescript
export const CurrentUser = createParamDecorator(
  (data: keyof UserPayload | undefined, ctx: ExecutionContext) => {
    const request = ctx.switchToHttp().getRequest();
    const user = request.user;
    return data ? user?.[data] : user;
  },
);

// Usage
@Get('me')
async getProfile(@CurrentUser() user: UserPayload) {
  return user;
}

@Post()
async create(
  @CurrentUser('userId') userId: string,
  @Body() dto: CreateDto,
) {
  return this.service.create(userId, dto);
}
```

### @CorrelationId()

Extracts or generates correlation ID for request tracing.

```typescript
export const CorrelationId = createParamDecorator(
  (data: unknown, ctx: ExecutionContext): string => {
    const request = ctx.switchToHttp().getRequest();
    let correlationId = request.headers['x-correlation-id'];
    if (!correlationId) {
      correlationId = uuidv4();
      request.headers['x-correlation-id'] = correlationId;
    }
    return correlationId;
  },
);
```

### @Public()

Marks endpoint as public (skips authentication).

```typescript
export const IS_PUBLIC_KEY = 'isPublic';
export const Public = () => SetMetadata(IS_PUBLIC_KEY, true);

// Usage
@Public()
@Get('health')
healthCheck() {
  return { status: 'ok' };
}
```

## 6. Guards

### TenantGuard

```typescript
@Injectable()
export class TenantGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest();
    const tenantId = request.headers['x-tenant-id'];
    
    if (!tenantId) {
      throw new ForbiddenException('Tenant ID is required');
    }
    
    // Optionally validate tenant exists and is active
    return true;
  }
}
```

### JwtAuthGuard

```typescript
@Injectable()
export class JwtAuthGuard extends AuthGuard('jwt') {
  constructor(private reflector: Reflector) {
    super();
  }

  canActivate(context: ExecutionContext): boolean | Promise<boolean> {
    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    
    if (isPublic) {
      return true;
    }
    
    return super.canActivate(context);
  }
}
```

## 7. Interceptors

### LoggingInterceptor

```typescript
@Injectable()
export class LoggingInterceptor implements NestInterceptor {
  constructor(private logger: AppLoggerService) {
    this.logger.setContext('HTTP');
  }

  intercept(context: ExecutionContext, next: CallHandler): Observable<any> {
    const request = context.switchToHttp().getRequest();
    const { method, url, headers } = request;
    const tenantId = headers['x-tenant-id'];
    const correlationId = headers['x-correlation-id'] || uuidv4();
    const startTime = Date.now();

    this.logger.log(`[REQUEST] ${method} ${url}`, {
      tenantId,
      correlationId,
      method,
      url,
    });

    return next.handle().pipe(
      tap(() => {
        const response = context.switchToHttp().getResponse();
        this.logger.log(`[RESPONSE] ${method} ${url}`, {
          tenantId,
          correlationId,
          method,
          url,
          statusCode: response.statusCode,
          duration: Date.now() - startTime,
        });
      }),
    );
  }
}
```

### TransformInterceptor

Wraps all responses in standard API response format.

```typescript
@Injectable()
export class TransformInterceptor<T> implements NestInterceptor<T, ApiResponse<T>> {
  intercept(context: ExecutionContext, next: CallHandler): Observable<ApiResponse<T>> {
    return next.handle().pipe(
      map(data => ({
        success: true,
        data,
        meta: data?.meta,
      })),
    );
  }
}
```

## 8. Exception Filters

### AllExceptionsFilter

```typescript
@Catch()
export class AllExceptionsFilter implements ExceptionFilter {
  constructor(private logger: AppLoggerService) {
    this.logger.setContext('ExceptionFilter');
  }

  catch(exception: unknown, host: ArgumentsHost): void {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();
    const request = ctx.getRequest<Request>();

    const status = exception instanceof HttpException
      ? exception.getStatus()
      : HttpStatus.INTERNAL_SERVER_ERROR;

    const message = exception instanceof HttpException
      ? exception.message
      : 'Internal server error';

    const errorResponse: ErrorResponse = {
      success: false,
      error: {
        code: this.getErrorCode(exception),
        message,
        timestamp: new Date().toISOString(),
        path: request.url,
      },
    };

    this.logger.error(`[ERROR] ${request.method} ${request.url}`, {
      tenantId: request.headers['x-tenant-id'],
      correlationId: request.headers['x-correlation-id'],
      statusCode: status,
      error: message,
      stack: exception instanceof Error ? exception.stack : undefined,
    });

    response.status(status).json(errorResponse);
  }

  private getErrorCode(exception: unknown): string {
    if (exception instanceof HttpException) {
      return `HTTP_${exception.getStatus()}`;
    }
    return 'INTERNAL_ERROR';
  }
}
```

## 9. Base Classes

### BaseEntity

```typescript
export abstract class BaseEntity {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  @Index()
  tenantId: string;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;

  @DeleteDateColumn()
  deletedAt?: Date;
}
```

### BaseRepository

```typescript
export abstract class BaseRepository<T extends BaseEntity> {
  constructor(
    protected repository: Repository<T>,
  ) {}

  async findById(tenantId: string, id: string): Promise<T | null> {
    return this.repository.findOne({
      where: { tenantId, id } as FindOptionsWhere<T>,
    });
  }

  async findAll(
    tenantId: string,
    options?: FindManyOptions<T>,
  ): Promise<T[]> {
    return this.repository.find({
      ...options,
      where: { tenantId, ...options?.where } as FindOptionsWhere<T>,
    });
  }

  async create(entity: DeepPartial<T>): Promise<T> {
    const created = this.repository.create(entity);
    return this.repository.save(created);
  }

  async update(
    tenantId: string,
    id: string,
    updates: DeepPartial<T>,
  ): Promise<T | null> {
    await this.repository.update(
      { tenantId, id } as FindOptionsWhere<T>,
      updates as QueryDeepPartialEntity<T>,
    );
    return this.findById(tenantId, id);
  }

  async softDelete(tenantId: string, id: string): Promise<void> {
    await this.repository.softDelete({ tenantId, id } as FindOptionsWhere<T>);
  }
}
```

## 10. Common DTOs

### PaginationDto

```typescript
export class PaginationDto {
  @IsOptional()
  @IsInt()
  @Min(1)
  @Transform(({ value }) => parseInt(value, 10))
  page?: number = 1;

  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(100)
  @Transform(({ value }) => parseInt(value, 10))
  pageSize?: number = 20;

  @IsOptional()
  @IsString()
  sortBy?: string = 'createdAt';

  @IsOptional()
  @IsIn(['ASC', 'DESC'])
  sortOrder?: 'ASC' | 'DESC' = 'DESC';
}
```

### ApiResponse

```typescript
export interface ApiResponse<T> {
  success: boolean;
  data: T;
  meta?: PaginationMeta;
}

export interface PaginationMeta {
  page: number;
  pageSize: number;
  total: number;
  totalPages: number;
}

export interface ErrorResponse {
  success: false;
  error: {
    code: string;
    message: string;
    timestamp: string;
    path: string;
    details?: Record<string, unknown>;
  };
}
```

## 11. Utilities

### Date Utilities

```typescript
export function parseTimeRange(range: string): { start: Date; end: Date } {
  const now = new Date();
  const match = range.match(/^(\d+)([dhwmy])$/);
  
  if (!match) {
    throw new BadRequestException(`Invalid time range: ${range}`);
  }
  
  const [, amount, unit] = match;
  const value = parseInt(amount, 10);
  
  const start = new Date(now);
  switch (unit) {
    case 'd': start.setDate(start.getDate() - value); break;
    case 'h': start.setHours(start.getHours() - value); break;
    case 'w': start.setDate(start.getDate() - value * 7); break;
    case 'm': start.setMonth(start.getMonth() - value); break;
    case 'y': start.setFullYear(start.getFullYear() - value); break;
  }
  
  return { start, end: now };
}
```

### String Utilities

```typescript
export function slugify(text: string): string {
  return text
    .toLowerCase()
    .trim()
    .replace(/[^\w\s-]/g, '')
    .replace(/[\s_-]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

export function truncate(text: string, length: number): string {
  if (text.length <= length) return text;
  return text.slice(0, length - 3) + '...';
}
```

## 12. Module Export

```typescript
@Global()
@Module({
  imports: [
    NatsModule,
  ],
  providers: [
    AppLoggerService,
    EventBusService,
    {
      provide: APP_FILTER,
      useClass: AllExceptionsFilter,
    },
    {
      provide: APP_INTERCEPTOR,
      useClass: LoggingInterceptor,
    },
    {
      provide: APP_INTERCEPTOR,
      useClass: TransformInterceptor,
    },
    {
      provide: APP_GUARD,
      useClass: JwtAuthGuard,
    },
    {
      provide: APP_GUARD,
      useClass: TenantGuard,
    },
  ],
  exports: [
    AppLoggerService,
    EventBusService,
  ],
})
export class CommonModule {}
```

## 13. Known Limitations

1. **Logger Output**: JSON logging to stdout only; no file rotation.
2. **Event Bus**: No dead letter queue handling in base service.
3. **Guard Order**: Auth guard runs before tenant guard.
4. **No Rate Limiting**: Rate limiting not included in common module.

## 14. Future Extensions

- [ ] Structured logging to external services (Datadog, Loki)
- [ ] Dead letter queue handling in EventBusService
- [ ] Rate limiting guard
- [ ] Request validation pipe with custom error messages
- [ ] Caching interceptor
- [ ] Audit logging service
- [ ] Feature flags service
- [ ] Configuration service with runtime updates

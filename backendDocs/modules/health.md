# Health Module

## 1. Overview

The Health Module provides health check endpoints for infrastructure monitoring, load balancer health probes, and dependency status verification. It exposes Kubernetes-compatible liveness and readiness probes, along with detailed dependency health information.

**Key Responsibilities:**
- Liveness probe for container orchestration
- Readiness probe for traffic routing
- Dependency health checks (PostgreSQL, Redis, NATS, ClickHouse, Elasticsearch)
- Aggregate health status
- Version and uptime information

## 2. Architecture

### Components

| Component                | File                                    | Purpose                              |
|--------------------------|-----------------------------------------|--------------------------------------|
| **Controller**           | `health.controller.ts`                  | REST API endpoints                   |
| **Service**              | `health.service.ts`                     | Health check orchestration           |
| **Checkers**             | `checkers/*.checker.ts`                 | Dependency-specific health checks    |

### Module Dependencies

```
HealthModule
├── TypeOrmModule (PostgreSQL check)
├── RedisModule (Redis check)
├── NatsModule (NATS check)
├── ClickHouseModule (ClickHouse check)
├── ElasticsearchModule (ES check)
├── TerminusModule (NestJS health)
└── Exports: HealthService
```

### Integration Points

| Integration        | Direction | Purpose                                      |
|--------------------|-----------|----------------------------------------------|
| Kubernetes         | Inbound   | Liveness and readiness probes                |
| Load Balancer      | Inbound   | Health check endpoint                        |
| Monitoring         | Inbound   | Detailed health status                       |

## 3. API Endpoints

### Liveness Probe

```
GET /health/live
```

**Purpose:** Indicates whether the application is running. Returns 200 if the process is alive.

**Response (Healthy):**
```json
{
  "status": "ok"
}
```

**Response (Unhealthy):**
```json
{
  "status": "error",
  "error": "Application crashed"
}
```

**HTTP Status Codes:**
- `200 OK` - Application is alive
- `503 Service Unavailable` - Application is not responding

### Readiness Probe

```
GET /health/ready
```

**Purpose:** Indicates whether the application is ready to receive traffic. Checks all critical dependencies.

**Response (Healthy):**
```json
{
  "status": "ok",
  "info": {
    "database": {"status": "up"},
    "redis": {"status": "up"},
    "nats": {"status": "up"}
  },
  "error": {},
  "details": {
    "database": {"status": "up"},
    "redis": {"status": "up"},
    "nats": {"status": "up"}
  }
}
```

**Response (Unhealthy):**
```json
{
  "status": "error",
  "info": {
    "database": {"status": "up"},
    "redis": {"status": "up"}
  },
  "error": {
    "nats": {
      "status": "down",
      "message": "Connection refused"
    }
  },
  "details": {
    "database": {"status": "up"},
    "redis": {"status": "up"},
    "nats": {"status": "down", "message": "Connection refused"}
  }
}
```

**HTTP Status Codes:**
- `200 OK` - All critical dependencies are healthy
- `503 Service Unavailable` - One or more critical dependencies are unhealthy

### Detailed Health Check

```
GET /health
```

**Purpose:** Returns comprehensive health information including all dependencies and metadata.

**Response:**
```json
{
  "status": "ok",
  "version": "1.0.0",
  "uptime": 86400,
  "timestamp": "2026-01-27T10:00:00Z",
  "environment": "production",
  "dependencies": {
    "postgresql": {
      "status": "up",
      "latency": 5,
      "version": "15.2"
    },
    "redis": {
      "status": "up",
      "latency": 2,
      "version": "7.0.0"
    },
    "nats": {
      "status": "up",
      "latency": 3,
      "connected": true,
      "servers": ["nats://localhost:4222"]
    },
    "clickhouse": {
      "status": "up",
      "latency": 8,
      "version": "23.8"
    },
    "elasticsearch": {
      "status": "up",
      "latency": 12,
      "cluster": "alum-cluster",
      "version": "8.10.0"
    }
  },
  "memory": {
    "heapUsed": 125000000,
    "heapTotal": 200000000,
    "rss": 250000000
  },
  "cpu": {
    "usage": 0.25
  }
}
```

### Ping

```
GET /health/ping
```

**Purpose:** Simple ping endpoint for basic connectivity check.

**Response:**
```
pong
```

## 4. Dependency Checkers

### PostgreSQL Checker

```typescript
@Injectable()
export class PostgresHealthChecker extends HealthIndicator {
  constructor(private connection: Connection) {
    super();
  }

  async isHealthy(key: string): Promise<HealthIndicatorResult> {
    const startTime = Date.now();
    try {
      await this.connection.query('SELECT 1');
      const latency = Date.now() - startTime;
      return this.getStatus(key, true, { latency });
    } catch (error) {
      throw new HealthCheckError(
        'PostgreSQL check failed',
        this.getStatus(key, false, { message: error.message }),
      );
    }
  }
}
```

### Redis Checker

```typescript
@Injectable()
export class RedisHealthChecker extends HealthIndicator {
  constructor(private redis: Redis) {
    super();
  }

  async isHealthy(key: string): Promise<HealthIndicatorResult> {
    const startTime = Date.now();
    try {
      const pong = await this.redis.ping();
      const latency = Date.now() - startTime;
      return this.getStatus(key, pong === 'PONG', { latency });
    } catch (error) {
      throw new HealthCheckError(
        'Redis check failed',
        this.getStatus(key, false, { message: error.message }),
      );
    }
  }
}
```

### NATS Checker

```typescript
@Injectable()
export class NatsHealthChecker extends HealthIndicator {
  constructor(private natsClient: NatsConnection) {
    super();
  }

  async isHealthy(key: string): Promise<HealthIndicatorResult> {
    try {
      const connected = !this.natsClient.isClosed();
      const servers = this.natsClient.getServer();
      return this.getStatus(key, connected, { connected, servers });
    } catch (error) {
      throw new HealthCheckError(
        'NATS check failed',
        this.getStatus(key, false, { message: error.message }),
      );
    }
  }
}
```

### ClickHouse Checker

```typescript
@Injectable()
export class ClickHouseHealthChecker extends HealthIndicator {
  constructor(private clickhouse: ClickHouseClient) {
    super();
  }

  async isHealthy(key: string): Promise<HealthIndicatorResult> {
    const startTime = Date.now();
    try {
      const result = await this.clickhouse.query({ query: 'SELECT 1' });
      const latency = Date.now() - startTime;
      return this.getStatus(key, true, { latency });
    } catch (error) {
      throw new HealthCheckError(
        'ClickHouse check failed',
        this.getStatus(key, false, { message: error.message }),
      );
    }
  }
}
```

### Elasticsearch Checker

```typescript
@Injectable()
export class ElasticsearchHealthChecker extends HealthIndicator {
  constructor(private elasticsearch: ElasticsearchService) {
    super();
  }

  async isHealthy(key: string): Promise<HealthIndicatorResult> {
    const startTime = Date.now();
    try {
      const health = await this.elasticsearch.cluster.health();
      const latency = Date.now() - startTime;
      return this.getStatus(key, health.status !== 'red', {
        latency,
        cluster: health.cluster_name,
        status: health.status,
      });
    } catch (error) {
      throw new HealthCheckError(
        'Elasticsearch check failed',
        this.getStatus(key, false, { message: error.message }),
      );
    }
  }
}
```

## 5. Health Service

```typescript
@Injectable()
export class HealthService {
  constructor(
    private health: HealthCheckService,
    private postgresChecker: PostgresHealthChecker,
    private redisChecker: RedisHealthChecker,
    private natsChecker: NatsHealthChecker,
    private clickhouseChecker: ClickHouseHealthChecker,
    private elasticsearchChecker: ElasticsearchHealthChecker,
  ) {}

  async checkLiveness(): Promise<HealthCheckResult> {
    return { status: 'ok' };
  }

  async checkReadiness(): Promise<HealthCheckResult> {
    return this.health.check([
      () => this.postgresChecker.isHealthy('database'),
      () => this.redisChecker.isHealthy('redis'),
      () => this.natsChecker.isHealthy('nats'),
    ]);
  }

  async checkAll(): Promise<DetailedHealthStatus> {
    const checks = await this.health.check([
      () => this.postgresChecker.isHealthy('postgresql'),
      () => this.redisChecker.isHealthy('redis'),
      () => this.natsChecker.isHealthy('nats'),
      () => this.clickhouseChecker.isHealthy('clickhouse'),
      () => this.elasticsearchChecker.isHealthy('elasticsearch'),
    ]);

    return {
      status: checks.status,
      version: process.env.APP_VERSION || '1.0.0',
      uptime: process.uptime(),
      timestamp: new Date().toISOString(),
      environment: process.env.NODE_ENV || 'development',
      dependencies: checks.details,
      memory: process.memoryUsage(),
      cpu: process.cpuUsage(),
    };
  }
}
```

## 6. Controller

```typescript
@Controller('health')
export class HealthController {
  constructor(private healthService: HealthService) {}

  @Get('ping')
  ping(): string {
    return 'pong';
  }

  @Get('live')
  @HealthCheck()
  async liveness() {
    return this.healthService.checkLiveness();
  }

  @Get('ready')
  @HealthCheck()
  async readiness() {
    return this.healthService.checkReadiness();
  }

  @Get()
  async detailed() {
    return this.healthService.checkAll();
  }
}
```

## 7. Kubernetes Configuration

### Deployment Example

```yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: alum-api-gateway
spec:
  template:
    spec:
      containers:
        - name: api-gateway
          image: alum/api-gateway:latest
          ports:
            - containerPort: 3000
          livenessProbe:
            httpGet:
              path: /health/live
              port: 3000
            initialDelaySeconds: 10
            periodSeconds: 10
            timeoutSeconds: 5
            failureThreshold: 3
          readinessProbe:
            httpGet:
              path: /health/ready
              port: 3000
            initialDelaySeconds: 5
            periodSeconds: 5
            timeoutSeconds: 3
            failureThreshold: 3
          resources:
            requests:
              cpu: 100m
              memory: 256Mi
            limits:
              cpu: 500m
              memory: 512Mi
```

## 8. Load Balancer Configuration

### AWS ALB Target Group

```json
{
  "HealthCheckPath": "/health/ready",
  "HealthCheckPort": "traffic-port",
  "HealthCheckProtocol": "HTTP",
  "HealthCheckIntervalSeconds": 30,
  "HealthCheckTimeoutSeconds": 5,
  "HealthyThresholdCount": 2,
  "UnhealthyThresholdCount": 3,
  "Matcher": {
    "HttpCode": "200"
  }
}
```

## 9. Logging

```typescript
// Health check failure
this.logger.log('[HEALTH] dependency check failed', {
  dependency: 'postgresql',
  error: error.message,
  latency: Date.now() - startTime,
});

// Readiness status change
this.logger.log('[HEALTH] readiness status changed', {
  previousStatus: 'ready',
  currentStatus: 'not_ready',
  failedDependencies: ['nats'],
});
```

## 10. Known Limitations

1. **No Circuit Breaker**: Health checks do not use circuit breaker for failed dependencies.
2. **Synchronous Checks**: All dependency checks run sequentially.
3. **No Historical Data**: Health status is point-in-time; no historical tracking.
4. **No Custom Thresholds**: Latency thresholds are not configurable.

## 11. Future Extensions

- [ ] Asynchronous parallel health checks
- [ ] Circuit breaker for flapping dependencies
- [ ] Health status history with time-series storage
- [ ] Custom latency thresholds with alerts
- [ ] Dependency degradation modes (partial functionality)
- [ ] Health dashboard UI
- [ ] Integration with Prometheus /metrics endpoint
- [ ] Custom health check extensions via plugins

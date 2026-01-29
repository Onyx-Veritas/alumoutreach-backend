# Development Setup Guide

## Prerequisites

Ensure you have the following installed:

| Tool         | Version  | Purpose                    |
|--------------|----------|----------------------------|
| Node.js      | 20.x LTS | Runtime                    |
| npm          | 10.x     | Package manager            |
| Docker       | 24.x     | Container runtime          |
| Docker Compose| 2.x     | Multi-container orchestration |
| Git          | 2.x      | Version control            |

## Quick Start

### 1. Clone Repository

```bash
git clone https://github.com/your-org/alum-outreach.git
cd alum-outreach
```

### 2. Install Dependencies

```bash
npm install
```

### 3. Start Infrastructure

```bash
# Start all required services
docker-compose up -d

# Verify services are running
docker-compose ps
```

### 4. Configure Environment

```bash
# Copy example environment file
cp .env.example .env

# Edit with your local settings
vim .env
```

### 5. Run Migrations

```bash
# Run database migrations
npm run typeorm migration:run

# Seed development data (optional)
npm run seed:dev
```

### 6. Start Development Server

```bash
# Start with hot reload
npm run start:dev

# Or start in debug mode
npm run start:debug
```

### 7. Verify Installation

```bash
# Health check
curl http://localhost:3000/health

# API documentation
open http://localhost:3000/api/docs
```

## Infrastructure Services

### Docker Compose Services

```yaml
# docker-compose.yml
version: '3.8'

services:
  postgres:
    image: postgres:15
    ports:
      - "5432:5432"
    environment:
      POSTGRES_USER: alum
      POSTGRES_PASSWORD: alum_password
      POSTGRES_DB: alumoutreach
    volumes:
      - postgres_data:/var/lib/postgresql/data

  redis:
    image: redis:7-alpine
    ports:
      - "6379:6379"
    volumes:
      - redis_data:/data

  nats:
    image: nats:2.10
    ports:
      - "4222:4222"
      - "8222:8222"
    command: ["--jetstream", "--store_dir=/data"]
    volumes:
      - nats_data:/data

  clickhouse:
    image: clickhouse/clickhouse-server:23.8
    ports:
      - "8123:8123"
      - "9000:9000"
    volumes:
      - clickhouse_data:/var/lib/clickhouse

  elasticsearch:
    image: elasticsearch:8.10.0
    ports:
      - "9200:9200"
    environment:
      - discovery.type=single-node
      - xpack.security.enabled=false
    volumes:
      - elasticsearch_data:/usr/share/elasticsearch/data

volumes:
  postgres_data:
  redis_data:
  nats_data:
  clickhouse_data:
  elasticsearch_data:
```

### Starting Individual Services

```bash
# Start only PostgreSQL
docker-compose up -d postgres

# Start only Redis
docker-compose up -d redis

# View logs
docker-compose logs -f postgres
```

## Environment Configuration

### Required Environment Variables

```bash
# .env

# Application
NODE_ENV=development
PORT=3000
APP_VERSION=1.0.0

# PostgreSQL
DATABASE_HOST=localhost
DATABASE_PORT=5432
DATABASE_USER=alum
DATABASE_PASSWORD=alum_password
DATABASE_NAME=alumoutreach

# Redis
REDIS_HOST=localhost
REDIS_PORT=6379
REDIS_PASSWORD=

# NATS
NATS_URL=nats://localhost:4222

# ClickHouse
CLICKHOUSE_HOST=localhost
CLICKHOUSE_PORT=8123
CLICKHOUSE_USER=default
CLICKHOUSE_PASSWORD=
CLICKHOUSE_DATABASE=default

# Elasticsearch
ELASTICSEARCH_NODE=http://localhost:9200

# JWT
JWT_SECRET=your-super-secret-key-change-in-production
JWT_EXPIRATION=24h

# Logging
LOG_LEVEL=debug

# Email Provider (SendGrid example)
SENDGRID_API_KEY=your-sendgrid-api-key

# SMS Provider (Twilio example)
TWILIO_ACCOUNT_SID=your-twilio-sid
TWILIO_AUTH_TOKEN=your-twilio-token
TWILIO_PHONE_NUMBER=+15551234567

# WhatsApp (Twilio)
WHATSAPP_PHONE_NUMBER=+15559876543
```

### Environment-Specific Configs

```bash
# Development
cp .env.example .env.development

# Testing
cp .env.example .env.test

# Production (use secrets management)
# See production deployment guide
```

## Database Setup

### PostgreSQL Initialization

```bash
# Create database
createdb alumoutreach

# Or via Docker
docker-compose exec postgres psql -U alum -c "CREATE DATABASE alumoutreach;"

# Enable extensions
docker-compose exec postgres psql -U alum -d alumoutreach -c "
  CREATE EXTENSION IF NOT EXISTS \"uuid-ossp\";
  CREATE EXTENSION IF NOT EXISTS \"pg_trgm\";
"
```

### Running Migrations

```bash
# Generate a new migration
npm run typeorm migration:generate -- -n CreateUsersTable

# Run all pending migrations
npm run typeorm migration:run

# Revert last migration
npm run typeorm migration:revert

# Show migration status
npm run typeorm migration:show
```

### ClickHouse Initialization

```bash
# Connect to ClickHouse
docker-compose exec clickhouse clickhouse-client

# Create analytics table
cat src/modules/analytics/entities/analytics.schema.sql | \
  docker-compose exec -T clickhouse clickhouse-client
```

### Elasticsearch Index Setup

```bash
# Create contacts index
curl -X PUT "localhost:9200/contacts" -H "Content-Type: application/json" -d @es-mappings/contacts.json

# Verify index
curl "localhost:9200/_cat/indices?v"
```

## Running the Application

### Development Mode

```bash
# Start with hot reload
npm run start:dev

# Watch mode with debugging
npm run start:debug
```

### Production Mode

```bash
# Build application
npm run build

# Start production server
npm run start:prod
```

### Background Jobs

```bash
# Run with job processing enabled
npm run start:dev -- --enable-jobs

# Run only job processor (separate process)
npm run jobs:dev
```

## Testing

### Unit Tests

```bash
# Run all unit tests
npm run test

# Run with coverage
npm run test:cov

# Run specific test file
npm run test -- contacts.service.spec.ts

# Watch mode
npm run test:watch
```

### Integration Tests

```bash
# Ensure test database is running
docker-compose -f docker-compose.test.yml up -d

# Run integration tests
npm run test:e2e

# Run specific test suite
npm run test:e2e -- --grep "Contacts"
```

### Test Database

```bash
# Create test database
docker-compose exec postgres psql -U alum -c "CREATE DATABASE alumoutreach_test;"

# Run migrations on test database
NODE_ENV=test npm run typeorm migration:run
```

## Code Quality

### Linting

```bash
# Run ESLint
npm run lint

# Fix auto-fixable issues
npm run lint:fix
```

### Formatting

```bash
# Check formatting
npm run format:check

# Format all files
npm run format
```

### Type Checking

```bash
# Run TypeScript compiler
npm run type-check
```

## Debugging

### VS Code Configuration

```json
// .vscode/launch.json
{
  "version": "0.2.0",
  "configurations": [
    {
      "type": "node",
      "request": "attach",
      "name": "Attach to NestJS",
      "port": 9229,
      "restart": true,
      "skipFiles": ["<node_internals>/**"]
    },
    {
      "type": "node",
      "request": "launch",
      "name": "Debug NestJS",
      "runtimeExecutable": "npm",
      "runtimeArgs": ["run", "start:debug"],
      "console": "integratedTerminal"
    }
  ]
}
```

### Debugging Tips

```bash
# Start with inspector
node --inspect-brk dist/main.js

# Enable verbose logging
LOG_LEVEL=debug npm run start:dev

# Debug specific module
DEBUG=contacts:* npm run start:dev
```

## API Documentation

### Swagger UI

Access Swagger documentation at:
```
http://localhost:3000/api/docs
```

### OpenAPI JSON

```bash
# Export OpenAPI spec
curl http://localhost:3000/api/docs-json > openapi.json
```

## Useful Commands

### Database

```bash
# Connect to PostgreSQL
docker-compose exec postgres psql -U alum -d alumoutreach

# Backup database
docker-compose exec postgres pg_dump -U alum alumoutreach > backup.sql

# Restore database
docker-compose exec -T postgres psql -U alum alumoutreach < backup.sql
```

### Redis

```bash
# Connect to Redis CLI
docker-compose exec redis redis-cli

# Flush all data (development only!)
docker-compose exec redis redis-cli FLUSHALL
```

### NATS

```bash
# View NATS streams
curl http://localhost:8222/jsz

# View consumers
curl http://localhost:8222/jsz?consumers=true
```

### Logs

```bash
# View all logs
docker-compose logs -f

# View specific service logs
docker-compose logs -f postgres

# Application logs
tail -f logs/application.log
```

## Troubleshooting

### Common Issues

#### Port Already in Use

```bash
# Find process using port
lsof -i :3000

# Kill process
kill -9 <PID>
```

#### Database Connection Failed

```bash
# Check if PostgreSQL is running
docker-compose ps postgres

# Check PostgreSQL logs
docker-compose logs postgres

# Verify connection
docker-compose exec postgres pg_isready
```

#### NATS Connection Issues

```bash
# Check NATS health
curl http://localhost:8222/healthz

# Restart NATS
docker-compose restart nats
```

#### Elasticsearch Cluster Red

```bash
# Check cluster health
curl http://localhost:9200/_cluster/health

# Check indices
curl http://localhost:9200/_cat/indices?v

# Delete problematic index (development only!)
curl -X DELETE http://localhost:9200/contacts
```

### Reset Development Environment

```bash
# Stop all services
docker-compose down

# Remove all volumes (WARNING: deletes all data)
docker-compose down -v

# Start fresh
docker-compose up -d
npm run typeorm migration:run
npm run seed:dev
```

## IDE Setup

### VS Code Extensions

Recommended extensions for development:

```json
// .vscode/extensions.json
{
  "recommendations": [
    "dbaeumer.vscode-eslint",
    "esbenp.prettier-vscode",
    "prisma.prisma",
    "ms-azuretools.vscode-docker",
    "humao.rest-client",
    "streetsidesoftware.code-spell-checker"
  ]
}
```

### VS Code Settings

```json
// .vscode/settings.json
{
  "editor.formatOnSave": true,
  "editor.defaultFormatter": "esbenp.prettier-vscode",
  "editor.codeActionsOnSave": {
    "source.fixAll.eslint": true
  },
  "typescript.preferences.importModuleSpecifier": "relative"
}
```

## Next Steps

1. Review the [API Documentation](api/index.md)
2. Explore [Module Documentation](modules/)
3. Understand [Event Flow](architecture/event-flow.md)
4. Check [Database Schema](architecture/db-schema.md)

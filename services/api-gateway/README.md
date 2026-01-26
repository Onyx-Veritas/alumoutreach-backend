# AlumOutreach Backend - API Gateway

Enterprise-grade NestJS API Gateway for AlumOutreach Communication OS.

## 🚀 Quick Start

### Prerequisites
- Node.js 18+
- Docker & Docker Compose (for infrastructure)

### Installation

```bash
# Install dependencies
npm install

# Copy environment file
cp .env.example .env
```

### Running the Application

```bash
# Development mode
npm run start:dev

# Production mode
npm run build
npm run start:prod
```

The API will be available at:
- **API**: http://localhost:3000/api/v1
- **Swagger Docs**: http://localhost:3000/api/docs

## 📁 Project Structure

```
src/
├── modules/
│   ├── analytics/       # Analytics & reporting
│   ├── campaigns/       # Campaign orchestration
│   ├── contacts/        # Contact 360°
│   ├── health/          # Health checks
│   ├── inbox/           # Unified inbox
│   ├── segments/        # Audience segmentation
│   ├── sequences/       # Drip sequences
│   ├── templates/       # Multi-channel templates
│   └── workflows/       # Workflow automation
├── app.module.ts
└── main.ts
```

## 🛠️ Tech Stack

- **Framework**: NestJS (TypeScript)
- **Database**: PostgreSQL + TypeORM
- **Cache**: Redis
- **Queue**: Bull (Redis-backed)
- **Event Bus**: NATS JetStream / Kafka
- **Documentation**: Swagger/OpenAPI

## 📡 API Endpoints

| Module | Base Path | Description |
|--------|-----------|-------------|
| Health | `/api/v1/health` | Health checks |
| Contacts | `/api/v1/contacts` | Contact management |
| Templates | `/api/v1/templates` | Template CRUD |
| Segments | `/api/v1/segments` | Segmentation engine |
| Campaigns | `/api/v1/campaigns` | Campaign management |
| Workflows | `/api/v1/workflows` | Workflow builder |
| Sequences | `/api/v1/sequences` | Sequence automation |
| Inbox | `/api/v1/inbox` | Conversation management |
| Analytics | `/api/v1/analytics` | Analytics & metrics |

## 🔧 Development

```bash
# Run tests
npm test

# Lint
npm run lint

# Format code
npm run format

# Type check
npx tsc --noEmit
```

## 📝 Environment Variables

```env
NODE_ENV=development
PORT=3000
DATABASE_HOST=localhost
DATABASE_PORT=5432
REDIS_HOST=localhost
REDIS_PORT=6379
```

See `.env.example` for complete configuration.

## 🐳 Infrastructure

Start required services using Docker Compose (from root directory):

```bash
docker-compose up -d
```

This starts:
- PostgreSQL (port 5432)
- Redis (port 6379)
- Elasticsearch (port 9200)
- ClickHouse (port 8123)
- MinIO (port 9000)
- NATS (port 4222)

## 📚 Documentation

Visit http://localhost:3000/api/docs after starting the server to explore the interactive API documentation.

## 🔐 Security

- JWT authentication (ready for integration)
- Rate limiting with @nestjs/throttler
- Input validation with class-validator
- CORS configuration

## 📄 License

MIT

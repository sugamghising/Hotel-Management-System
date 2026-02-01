# Node.js + Express + TypeScript Boilerplate

A production-ready, modular backend boilerplate using Node.js, Express, and TypeScript with a feature-based architecture.

## 🏗️ Architecture Overview

This boilerplate follows a **modular/feature-based architecture** where each domain is isolated, testable, and easy to scale.

```
src/
├── app.ts                 # Express app setup
├── server.ts              # Server entry point
├── routes.ts              # Central route registry
├── config/                # Configuration management
│   ├── env.ts             # Environment validation (Zod)
│   └── index.ts           # Typed config export
├── core/                  # Shared infrastructure
│   ├── errors/            # Error classes
│   ├── logger/            # Winston logger
│   ├── middleware/        # Global middleware
│   └── utils/             # Shared utilities
├── api/                   # Feature modules
│   ├── health/            # Health check module
│   └── user/              # User CRUD module
├── types/                 # Shared TypeScript types
└── tests/                 # Test files
```

### Key Principles

1. **Module Isolation**: Each module owns its routes, controllers, services, validation, and types
2. **No Cross-Module Imports**: Modules communicate only through public interfaces
3. **Clear Separation**: Application setup, domain logic, and infrastructure are clearly separated
4. **Express Abstraction**: `req`/`res` objects never leak outside controllers

## 🚀 Quick Start

### Prerequisites

- Node.js 20+ (LTS)
- npm or pnpm

### Installation

```bash
# Clone the repository
git clone <your-repo-url>
cd node-express-typescript-boilerplate

# Install dependencies
npm install

# Copy environment file
cp .env.example .env

# Start development server
npm run dev
```

The server will start at `http://localhost:3000`

### API Documentation

Once the server is running, access the Swagger UI documentation at:

- **Swagger UI**: http://localhost:3000/api-docs
- **OpenAPI JSON**: http://localhost:3000/api-docs.json

### Verify Installation

```bash
# Health check
curl http://localhost:3000/health

# Create a user
curl -X POST http://localhost:3000/api/v1/users \
  -H "Content-Type: application/json" \
  -d '{"email": "test@example.com", "name": "Test User"}'

# Get all users
curl http://localhost:3000/api/v1/users
```

## 📁 Module Structure

Each module follows this structure:

```
api/
└── [module-name]/
    ├── [module].routes.ts      # Express router
    ├── [module].controller.ts  # HTTP handlers
    ├── [module].service.ts     # Business logic
    ├── [module].validation.ts  # Zod schemas
    ├── [module].types.ts       # TypeScript types
    └── index.ts                # Public exports
```

## 🆕 Creating a New Module

### Step 1: Create the module folder

```bash
mkdir src/api/product
```

### Step 2: Define types (`product.types.ts`)

```typescript
export interface Product {
  id: string;
  name: string;
  price: number;
  createdAt: Date;
}

export interface CreateProductDTO {
  name: string;
  price: number;
}
```

### Step 3: Create validation schemas (`product.validation.ts`)

```typescript
import { z } from 'zod';

export const createProductSchema = z.object({
  name: z.string().min(1).max(200),
  price: z.number().positive(),
});

export type CreateProductInput = z.infer<typeof createProductSchema>;
```

### Step 4: Implement service (`product.service.ts`)

```typescript
import type { Product, CreateProductDTO } from './product.types.js';

export const productService = {
  async create(dto: CreateProductDTO): Promise<Product> {
    // Business logic here
  },

  async findById(id: string): Promise<Product> {
    // Business logic here
  },
};
```

### Step 5: Create controller (`product.controller.ts`)

```typescript
import type { Request, Response } from 'express';
import { StatusCodes } from 'http-status-codes';
import { productService } from './product.service.js';

export const productController = {
  async create(req: Request, res: Response): Promise<void> {
    const product = await productService.create(req.body);
    res.status(StatusCodes.CREATED).json({ success: true, data: product });
  },
};
```

### Step 6: Define routes (`product.routes.ts`)

```typescript
import { Router } from 'express';
import { productController } from './product.controller.js';
import { validate, asyncHandler } from '../../core/index.js';
import { createProductSchema } from './product.validation.js';

const router = Router();

router.post('/', validate({ body: createProductSchema }), asyncHandler(productController.create));

export { router as productRoutes };
```

### Step 7: Export from module (`index.ts`)

```typescript
export { productRoutes } from './product.routes.js';
export { productService } from './product.service.js';
export type { Product, CreateProductDTO } from './product.types.js';
```

### Step 8: Register in route registry (`src/routes.ts`)

```typescript
import { productRoutes } from './api/product/index.js';

// In v1Router:
v1Router.use('/products', productRoutes);
```

## 🛠️ Scripts

| Script                  | Description                              |
| ----------------------- | ---------------------------------------- |
| `npm run dev`           | Start development server with hot reload |
| `npm run build`         | Build for production                     |
| `npm start`             | Run production build                     |
| `npm run lint`          | Run Biome linter                         |
| `npm run lint:fix`      | Fix linting issues                       |
| `npm run format`        | Format code with Biome                   |
| `npm run check`         | Run Biome lint + format check            |
| `npm run check:fix`     | Fix all Biome issues                     |
| `npm run typecheck`     | Run TypeScript type checking             |
| `npm test`              | Run tests                                |
| `npm run test:watch`    | Run tests in watch mode                  |
| `npm run test:coverage` | Run tests with coverage                  |

## 🐳 Docker

### Build and Run Production Container

```bash
# Build the image
docker build -t node-api .

# Run the container
docker run -p 3000:3000 --env-file .env node-api
```

### Using Docker Compose

```bash
# Production
docker compose up -d

# Development with hot reload
docker compose --profile dev up api-dev

# Stop containers
docker compose down
```

## ⚙️ Environment Variables

| Variable                  | Description             | Default       |
| ------------------------- | ----------------------- | ------------- |
| `NODE_ENV`                | Environment mode        | `development` |
| `PORT`                    | Server port             | `3000`        |
| `HOST`                    | Server host             | `localhost`   |
| `API_PREFIX`              | API prefix              | `/api`        |
| `API_VERSION`             | API version             | `v1`          |
| `RATE_LIMIT_WINDOW_MS`    | Rate limit window (ms)  | `900000`      |
| `RATE_LIMIT_MAX_REQUESTS` | Max requests per window | `100`         |
| `LOG_LEVEL`               | Log level               | `info`        |
| `CORS_ORIGIN`             | CORS origin             | `*`           |

## 🏛️ Core Components

### Error Handling

Custom error classes in `src/core/errors/`:

```typescript
import { NotFoundError, BadRequestError } from '../../core/errors/index.js';

// Throw operational errors
throw new NotFoundError('User not found');
throw new BadRequestError('Invalid input', { field: 'email' });
```

Available error classes:

- `AppError` - Base error class
- `BadRequestError` (400)
- `UnauthorizedError` (401)
- `ForbiddenError` (403)
- `NotFoundError` (404)
- `ConflictError` (409)
- `UnprocessableEntityError` (422)
- `TooManyRequestsError` (429)
- `InternalServerError` (500)

### Logging

Winston logger in `src/core/logger/`:

```typescript
import { logger } from '../../core/logger/index.js';

logger.info('User created', { userId: user.id });
logger.error('Failed to create user', { error });
logger.debug('Processing request', { body: req.body });
```

### Validation

Zod-based validation middleware:

```typescript
import { validate } from '../../core/middleware/index.js';

router.post(
  '/',
  validate({
    body: createUserSchema,
    query: paginationSchema,
    params: idParamSchema,
  }),
  asyncHandler(controller.create)
);
```

### Async Handler

Wraps async controllers to catch errors:

```typescript
import { asyncHandler } from '../../core/utils/index.js';

router.get(
  '/',
  asyncHandler(async (req, res) => {
    const data = await someAsyncOperation();
    res.json({ success: true, data });
  })
);
```

## 🧪 Testing

Tests are organized to mirror the source structure:

```
tests/
├── setup.ts                           # Test setup
├── unit/
│   └── user/
│       └── user.service.test.ts       # Service unit tests
└── integration/
    ├── health/
    │   └── health.routes.test.ts      # Health route tests
    └── user/
        └── user.routes.test.ts        # User route tests
```

### Running Tests

```bash
# Run all tests
npm test

# Run in watch mode
npm run test:watch

# With coverage
npm run test:coverage

# Run specific test file
npm test -- user.service
```

### Writing Tests

**Unit Test Example:**

```typescript
import { describe, it, expect } from 'vitest';
import { userService } from '../../../src/api/user/user.service.js';

describe('UserService', () => {
  it('should create a user', async () => {
    const user = await userService.create({
      email: 'test@example.com',
      name: 'Test',
    });
    expect(user.id).toBeDefined();
  });
});
```

**Integration Test Example:**

```typescript
import request from 'supertest';
import { createApp } from '../../../src/app.js';

describe('GET /api/v1/users', () => {
  it('should return users', async () => {
    const app = createApp();
    const response = await request(app).get('/api/v1/users').expect(200);

    expect(response.body.success).toBe(true);
  });
});
```

## 🔒 Security

Built-in security middleware:

- **Helmet**: Security headers
- **CORS**: Cross-origin resource sharing
- **Rate Limiting**: Request throttling
- **Body Parsing**: Size limits (10MB)

## 📝 API Design

### Response Format

**Success:**

```json
{
  "success": true,
  "data": { ... }
}
```

**Paginated:**

```json
{
  "success": true,
  "data": [...],
  "meta": {
    "total": 100,
    "page": 1,
    "limit": 10
  }
}
```

**Error:**

```json
{
  "success": false,
  "error": {
    "message": "User not found",
    "code": "NOT_FOUND",
    "statusCode": 404
  }
}
```

### Versioned Routes

All API routes are versioned:

- Health: `GET /health`
- Users: `GET /api/v1/users`

## 🔧 Git Hooks

Pre-configured with Husky:

- **pre-commit**: Runs lint-staged (Biome check)
- **pre-push**: Runs type checking

## 📦 Tech Stack

- **Runtime**: Node.js 20+
- **Framework**: Express 4
- **Language**: TypeScript 5
- **Validation**: Zod
- **Logging**: Winston
- **API Docs**: Swagger (OpenAPI 3.0)
- **Testing**: Vitest + Supertest
- **Linting & Formatting**: Biome
- **Git Hooks**: Husky + lint-staged

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch
3. Commit your changes
4. Push to the branch
5. Open a Pull Request

## 📄 License

MIT

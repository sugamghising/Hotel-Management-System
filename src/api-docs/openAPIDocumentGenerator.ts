import { authRegistry } from '@/api/auth/auth.registry';
import { healthRegistry } from '@/api/health/health.registry';
import { hotelRegistry } from '@/api/hotel/hotel.registry';
import { organizationRegistry } from '@/api/organizations/organization.registry';
import { ratePlansRegistry } from '@/api/ratePlans/ratePlans.registry';
import { roomTypesRegistry } from '@/api/roomTypes/roomTypes.registry';
import { roomsRegistry } from '@/api/rooms/rooms.registry';
import { userRegistry } from '@/api/user/user.registry';
import { config } from '@/config/index';
import { OpenAPIRegistry, OpenApiGeneratorV3 } from '@asteasolutions/zod-to-openapi';

export type OpenAPIDocument = ReturnType<OpenApiGeneratorV3['generateDocument']>;

export function generateOpenAPIDocument(): OpenAPIDocument {
  const registry = new OpenAPIRegistry([
    healthRegistry,
    userRegistry,
    authRegistry,
    organizationRegistry,
    hotelRegistry,
    roomTypesRegistry,
    roomsRegistry,
    ratePlansRegistry,
  ]);
  const generator = new OpenApiGeneratorV3(registry.definitions);

  return generator.generateDocument({
    openapi: '3.0.0',
    info: {
      version: '1.0.0',
      title: 'Hotel Management System API',
      description: 'A production-ready REST API built with Node.js, Express, and TypeScript',
      license: {
        name: 'MIT',
        url: 'https://opensource.org/licenses/MIT',
      },
      contact: {
        name: 'API Support',
      },
    },
    servers: [
      {
        url: `http://localhost:${config.server.port}`,
        description: 'Development server',
      },
    ],
    externalDocs: {
      description: 'View the raw OpenAPI Specification in JSON format',
      url: '/swagger.json',
    },
  });
}

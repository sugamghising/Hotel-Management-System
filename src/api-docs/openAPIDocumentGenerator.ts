import { authRegistry } from '@/api/auth/auth.registry';
import { checkinCheckoutRegistry } from '@/api/checkinCheckout/checkinCheckout.registry';
import { folioRegistry } from '@/api/folio/folio.registry';
import { guestsRegistry } from '@/api/guests/guests.registry';
import { healthRegistry } from '@/api/health/health.registry';
import { hotelRegistry } from '@/api/hotel/hotel.registry';
import { housekeepingRegistry } from '@/api/housekeeping/housekeeping.registry';
import { maintenanceRegistry } from '@/api/maintenance/maintenance.registry';
import { nightAuditRegistry } from '@/api/nightAudit/nightAudit.registry';
import { organizationRegistry } from '@/api/organizations/organization.registry';
import { posRegistry } from '@/api/pos/pos.registry';
import { ratePlansRegistry } from '@/api/ratePlans/ratePlans.registry';
import { reservationsRegistry } from '@/api/reservations/reservations.registry';
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
    reservationsRegistry,
    guestsRegistry,
    folioRegistry,
    checkinCheckoutRegistry,
    housekeepingRegistry,
    maintenanceRegistry,
    nightAuditRegistry,
    posRegistry,
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

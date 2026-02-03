import { extendZodWithOpenApi } from '@asteasolutions/zod-to-openapi';
import { z } from 'zod';

// Extend Zod with OpenAPI methods (.openapi())
extendZodWithOpenApi(z);

export { z };

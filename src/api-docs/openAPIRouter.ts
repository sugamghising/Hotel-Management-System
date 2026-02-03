import express, { type Request, type Response, type Router } from 'express';
import swaggerUi from 'swagger-ui-express';
import { generateOpenAPIDocument } from './openAPIDocumentGenerator';

export const openAPIRouter: Router = express.Router();
const openAPIDocument = generateOpenAPIDocument();

// Serve raw OpenAPI JSON
openAPIRouter.get('/swagger.json', (_req: Request, res: Response) => {
  res.setHeader('Content-Type', 'application/json');
  res.send(openAPIDocument);
});

// Serve Swagger UI
openAPIRouter.use('/', swaggerUi.serve, swaggerUi.setup(openAPIDocument));

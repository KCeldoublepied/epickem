import { INestApplication } from '@nestjs/common';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { APP_NAME } from '@epickem/shared';

/**
 * Chemin de la documentation interactive de l'API (ADR-0003) ;
 * la spécification OpenAPI en JSON est sur `/api/docs-json`.
 */
export const DOCS_PATH = 'api/docs';

/**
 * Documentation OpenAPI générée à partir des routes. Les corps et paramètres validés par un
 * schéma Zod (`@Body({ schema })`) y apparaissent sans rien écrire de plus.
 */
export function setupSwagger(app: INestApplication): void {
  const config = new DocumentBuilder()
    .setTitle(`API ${APP_NAME}`)
    .setDescription('Tournois, résultats en direct et pronostics.')
    .setVersion('0.1')
    .addCookieAuth('epickem_session')
    .addBearerAuth()
    .build();
  SwaggerModule.setup(DOCS_PATH, app, () => SwaggerModule.createDocument(app, config));
}

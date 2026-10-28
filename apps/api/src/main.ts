import 'reflect-metadata';
import path from 'node:path';
import { config as loadEnv } from 'dotenv';
import { Logger } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import type { NestExpressApplication } from '@nestjs/platform-express';
import { AppModule } from './app.module';
import { validateEnv } from './config/env';
import { DOCS_PATH, setupSwagger } from './swagger';

// En local, charge le .env à la racine du monorepo. Dans Docker, il n'existe pas :
// les variables viennent de docker-compose.yml, et dotenv n'écrase jamais une variable déjà définie.
loadEnv({ path: path.resolve(__dirname, '../../../.env'), quiet: true });

async function bootstrap(): Promise<void> {
  // Avant Nest : si la configuration est invalide, rien ne démarre.
  const env = validateEnv(process.env);

  const app = await NestFactory.create<NestExpressApplication>(AppModule.forRoot(env));
  // Derrière le proxy de l'hébergeur : l'adresse IP du client (limite de tentatives de
  // connexion) est lue dans X-Forwarded-For, sinon toutes les requêtes auraient celle du proxy.
  app.set('trust proxy', 1);
  // credentials : le navigateur envoie le cookie de session au site autorisé.
  app.enableCors({ origin: env.WEB_ORIGIN, credentials: true });
  setupSwagger(app);

  await app.listen(env.PORT);
  Logger.log(`API démarrée sur http://localhost:${env.PORT}`, 'Bootstrap');
  Logger.log(`Documentation sur http://localhost:${env.PORT}/${DOCS_PATH}`, 'Bootstrap');
}

void bootstrap();

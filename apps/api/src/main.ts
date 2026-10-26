import 'reflect-metadata';
import path from 'node:path';
import { config as loadEnv } from 'dotenv';
import { Logger } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { validateEnv } from './config/env';

// En local, charge le .env à la racine du monorepo. Dans Docker, il n'existe pas :
// les variables viennent de docker-compose.yml, et dotenv n'écrase jamais une variable déjà définie.
loadEnv({ path: path.resolve(__dirname, '../../../.env'), quiet: true });

async function bootstrap(): Promise<void> {
  // Avant Nest : si la configuration est invalide, rien ne démarre.
  const env = validateEnv(process.env);

  const app = await NestFactory.create(AppModule.forRoot(env));
  app.enableCors({ origin: env.WEB_ORIGIN });

  await app.listen(env.PORT);
  Logger.log(`API démarrée sur http://localhost:${env.PORT}`, 'Bootstrap');
}

void bootstrap();

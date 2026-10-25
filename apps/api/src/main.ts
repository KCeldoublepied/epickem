import 'reflect-metadata';
import path from 'node:path';
import { config as loadEnv } from 'dotenv';
import { Logger } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';

// En local, charge le .env à la racine du monorepo. Dans Docker, il n'existe pas :
// les variables viennent de docker-compose.yml, et dotenv n'écrase jamais une variable déjà définie.
loadEnv({ path: path.resolve(__dirname, '../../../.env'), quiet: true });

async function bootstrap(): Promise<void> {
  const app = await NestFactory.create(AppModule);
  app.enableCors({ origin: process.env.WEB_ORIGIN ?? 'http://localhost:3000' });

  const port = Number(process.env.PORT ?? 4000);
  await app.listen(port);
  Logger.log(`API démarrée sur http://localhost:${port}`, 'Bootstrap');
}

void bootstrap();

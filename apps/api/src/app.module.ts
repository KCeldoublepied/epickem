import { DynamicModule, Module, StandardSchemaValidationPipe } from '@nestjs/common';
import { APP_PIPE } from '@nestjs/core';
import { z } from 'zod';
import { ConfigModule } from './config/config.module';
import { Env } from './config/env';
import { HealthController } from './health/health.controller';
import { PrismaModule } from './prisma/prisma.module';

z.config(z.locales.fr());

@Module({
  imports: [PrismaModule],
  controllers: [HealthController],
  providers: [
    // Valide chaque paramètre de route qui déclare un schéma Zod, par exemple
    // `@Body({ schema: createTournamentSchema })`, et renvoie une erreur 400 sinon.
    { provide: APP_PIPE, useClass: StandardSchemaValidationPipe },
  ],
})
export class AppModule {
  /** La configuration est passée en paramètre : les tests peuvent fournir la leur. */
  static forRoot(env: Env): DynamicModule {
    return {
      module: AppModule,
      imports: [ConfigModule.forRoot(env)],
    };
  }
}

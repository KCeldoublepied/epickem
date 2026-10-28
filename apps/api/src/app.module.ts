import { DynamicModule, type MiddlewareConsumer, Module, type NestModule } from '@nestjs/common';
import { APP_FILTER, APP_PIPE } from '@nestjs/core';
import cookieParser from 'cookie-parser';
import { z } from 'zod';
import { AuthModule } from './auth/auth.module';
import { AllExceptionsFilter } from './common/all-exceptions.filter';
import { createValidationPipe } from './common/validation.pipe';
import { ConfigModule } from './config/config.module';
import { Env } from './config/env';
import { HealthController } from './health/health.controller';
import { PrismaModule } from './prisma/prisma.module';
import { UsersModule } from './users/users.module';

z.config(z.locales.fr());

@Module({
  imports: [PrismaModule, AuthModule, UsersModule],
  controllers: [HealthController],
  providers: [
    { provide: APP_PIPE, useValue: createValidationPipe() },
    { provide: APP_FILTER, useClass: AllExceptionsFilter },
  ],
})
export class AppModule implements NestModule {
  /** Ici plutôt que dans main.ts : les tests, qui démarrent l'API sans main.ts, en profitent aussi. */
  configure(consumer: MiddlewareConsumer): void {
    consumer.apply(cookieParser()).forRoutes('*path');
  }

  /** La configuration est passée en paramètre : les tests peuvent fournir la leur. */
  static forRoot(env: Env): DynamicModule {
    return {
      module: AppModule,
      imports: [ConfigModule.forRoot(env)],
    };
  }
}

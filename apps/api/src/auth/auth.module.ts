import { Module } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import { ThrottlerModule } from '@nestjs/throttler';
import { ENV, type Env } from '../config/env';
import { AuthController } from './auth.controller';
import { AuthGuard } from './auth.guard';
import { AuthService } from './auth.service';
import { SessionsService } from './sessions.service';

@Module({
  imports: [
    // Limite les tentatives d'inscription et de connexion (force brute), par adresse IP.
    ThrottlerModule.forRootAsync({
      inject: [ENV],
      useFactory: (env: Env) => [{ ttl: 60_000, limit: env.AUTH_RATE_LIMIT }],
    }),
  ],
  controllers: [AuthController],
  providers: [AuthService, SessionsService, { provide: APP_GUARD, useClass: AuthGuard }],
  exports: [AuthService, SessionsService],
})
export class AuthModule {}

import { DynamicModule, Module } from '@nestjs/common';
import { ConfigModule } from './config/config.module';
import { Env } from './config/env';
import { HealthController } from './health/health.controller';
import { PrismaModule } from './prisma/prisma.module';

@Module({
  imports: [PrismaModule],
  controllers: [HealthController],
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

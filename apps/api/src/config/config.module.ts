import { DynamicModule, Global, Module } from '@nestjs/common';
import { ENV, Env } from './env';

/** Rend la configuration validée injectable dans tous les modules de l'API. */
@Global()
@Module({})
export class ConfigModule {
  static forRoot(env: Env): DynamicModule {
    return {
      module: ConfigModule,
      providers: [{ provide: ENV, useValue: env }],
      exports: [ENV],
    };
  }
}

import { Inject, Injectable, OnModuleDestroy } from '@nestjs/common';
import { PrismaPg } from '@prisma/adapter-pg';
import { ENV, Env } from '../config/env';
import { PrismaClient } from '../generated/prisma/client';

/**
 * Client Prisma partagé par toute l'API (une seule instance, donc un seul pool de connexions).
 * La connexion à PostgreSQL est ouverte à la première requête.
 */
@Injectable()
export class PrismaService extends PrismaClient implements OnModuleDestroy {
  constructor(@Inject(ENV) env: Env) {
    super({ adapter: new PrismaPg({ connectionString: env.DATABASE_URL }) });
  }

  async onModuleDestroy(): Promise<void> {
    await this.$disconnect();
  }
}

import { Global, Module } from '@nestjs/common';
import { PrismaService } from './prisma.service';

/** Rend PrismaService injectable dans tous les modules de l'API. */
@Global()
@Module({
  providers: [PrismaService],
  exports: [PrismaService],
})
export class PrismaModule {}

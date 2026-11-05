import { Controller, Get } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import type { GameSummary } from '@epickem/shared';
import { Public } from '../auth/auth.decorators';
import { PrismaService } from '../prisma/prisma.service';

@ApiTags('games')
@Public()
@Controller('games')
export class GamesController {
  constructor(private readonly prisma: PrismaService) {}

  /** Jeux proposés à la création d'un tournoi, par ordre alphabétique. */
  @Get()
  list(): Promise<GameSummary[]> {
    return this.prisma.game.findMany({
      select: { id: true, slug: true, name: true },
      orderBy: { name: 'asc' },
    });
  }
}

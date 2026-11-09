import { Body, ConflictException, Controller, Get, Post } from '@nestjs/common';
import { ApiBearerAuth, ApiCookieAuth, ApiTags } from '@nestjs/swagger';
import { type CreateGameInput, createGameSchema, type GameSummary } from '@epickem/shared';
import { isUniqueViolation } from '../auth/auth.service';
import { Public } from '../auth/auth.decorators';
import { PrismaService } from '../prisma/prisma.service';
import { slugify } from '../tournaments/tournaments.service';

const GAME_SELECT = { id: true, slug: true, name: true } as const;

@ApiTags('games')
@ApiCookieAuth()
@ApiBearerAuth()
@Controller('games')
export class GamesController {
  constructor(private readonly prisma: PrismaService) {}

  /** Jeux proposés dans le dashboard d'un tournoi, par ordre alphabétique. */
  @Public()
  @Get()
  list(): Promise<GameSummary[]> {
    return this.prisma.game.findMany({ select: GAME_SELECT, orderBy: { name: 'asc' } });
  }

  /**
   * Déclare un jeu et ses statistiques. Comme pour les tournois, tout compte connecté peut le
   * faire : il n'y a pas de rôle global (docs/technique/modele-donnees.md).
   */
  @Post()
  async create(@Body({ schema: createGameSchema }) body: CreateGameInput): Promise<GameSummary> {
    try {
      return await this.prisma.game.create({
        data: {
          name: body.name,
          slug: slugify(body.name),
          stats: { create: body.stats.map((stat) => ({ ...stat, key: slugify(stat.label) })) },
        },
        select: GAME_SELECT,
      });
    } catch (error) {
      if (isUniqueViolation(error)) throw new ConflictException('Ce jeu existe déjà');
      throw error;
    }
  }
}

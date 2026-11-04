import { Controller, Get, Param, ParseUUIDPipe, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiCookieAuth, ApiTags } from '@nestjs/swagger';
import {
  type ListQuery,
  listQuerySchema,
  type Page,
  type TournamentDetail,
  type TournamentSummary,
} from '@epickem/shared';
import type { AuthUser } from '../auth/auth-user';
import { CurrentUser } from '../auth/auth.decorators';
import { TournamentsService } from './tournaments.service';

/**
 * Sous /me plutôt que /tournaments/mine : un tournoi nommé « Mine » aurait le slug « mine »
 * et la route de sa page (/tournaments/:slug) entrerait en conflit.
 */
@ApiTags('me')
@ApiCookieAuth()
@ApiBearerAuth()
@Controller('me/tournaments')
export class MyTournamentsController {
  constructor(private readonly tournaments: TournamentsService) {}

  /** Tournois organisés par le compte connecté, brouillons compris. */
  @Get()
  list(
    @CurrentUser() user: AuthUser,
    @Query({ schema: listQuerySchema }) query: ListQuery,
  ): Promise<Page<TournamentSummary>> {
    return this.tournaments.listOrganizedBy(user.id, query);
  }

  /** Tournoi complet, brouillon compris, pour son dashboard. */
  @Get(':id')
  get(
    @CurrentUser() user: AuthUser,
    @Param('id', ParseUUIDPipe) id: string,
  ): Promise<TournamentDetail> {
    return this.tournaments.findOrganizedBy(user.id, id);
  }
}

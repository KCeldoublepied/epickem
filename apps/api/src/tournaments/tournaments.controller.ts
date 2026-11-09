import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseUUIDPipe,
  Post,
  Put,
  Query,
} from '@nestjs/common';
import { ApiBearerAuth, ApiCookieAuth, ApiTags } from '@nestjs/swagger';
import {
  type CreateTournamentInput,
  createTournamentSchema,
  type ListQuery,
  listQuerySchema,
  type Page,
  type TournamentDetail,
  type TournamentSettingsInput,
  tournamentSettingsSchema,
  type TournamentSummary,
} from '@epickem/shared';
import type { AuthUser } from '../auth/auth-user';
import { CurrentUser, Public } from '../auth/auth.decorators';
import { TournamentsService } from './tournaments.service';

@ApiTags('tournaments')
@ApiCookieAuth()
@ApiBearerAuth()
@Controller('tournaments')
export class TournamentsController {
  constructor(private readonly tournaments: TournamentsService) {}

  @Public()
  @Get()
  list(@Query({ schema: listQuerySchema }) query: ListQuery): Promise<Page<TournamentSummary>> {
    return this.tournaments.listPublic(query);
  }

  /** Tournoi publié accessible par son lien, répertorié ou non. */
  @Public()
  @Get(':slug')
  findBySlug(@Param('slug') slug: string): Promise<TournamentSummary> {
    return this.tournaments.findBySlug(slug);
  }

  /** Création rapide : nom, début et fin. Le reste se règle ensuite avec PUT /tournaments/:id. */
  @Post()
  create(
    @CurrentUser() user: AuthUser,
    @Body({ schema: createTournamentSchema }) body: CreateTournamentInput,
  ): Promise<TournamentDetail> {
    return this.tournaments.create(user.id, body);
  }

  /** Enregistre tous les réglages du tournoi d'un bloc, phases comprises. */
  @Put(':id')
  update(
    @CurrentUser() user: AuthUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Body({ schema: tournamentSettingsSchema }) body: TournamentSettingsInput,
  ): Promise<TournamentDetail> {
    return this.tournaments.update(user.id, id, body);
  }

  @Post(':id/duplicate')
  duplicate(
    @CurrentUser() user: AuthUser,
    @Param('id', ParseUUIDPipe) id: string,
  ): Promise<TournamentDetail> {
    return this.tournaments.duplicate(user.id, id);
  }

  @Post(':id/publish')
  @HttpCode(HttpStatus.OK)
  publish(
    @CurrentUser() user: AuthUser,
    @Param('id', ParseUUIDPipe) id: string,
  ): Promise<TournamentDetail> {
    return this.tournaments.publish(user.id, id);
  }
}

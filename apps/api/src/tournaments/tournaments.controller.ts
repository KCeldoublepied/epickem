import { Body, Controller, Post } from '@nestjs/common';
import { ApiBearerAuth, ApiCookieAuth, ApiTags } from '@nestjs/swagger';
import {
  type CreateTournamentInput,
  createTournamentSchema,
  type TournamentDetail,
} from '@epickem/shared';
import type { AuthUser } from '../auth/auth-user';
import { CurrentUser } from '../auth/auth.decorators';
import { TournamentsService } from './tournaments.service';

@ApiTags('tournaments')
@ApiCookieAuth()
@ApiBearerAuth()
@Controller('tournaments')
export class TournamentsController {
  constructor(private readonly tournaments: TournamentsService) {}

  @Post()
  create(
    @CurrentUser() user: AuthUser,
    @Body({ schema: createTournamentSchema }) body: CreateTournamentInput,
  ): Promise<TournamentDetail> {
    return this.tournaments.create(user.id, body);
  }
}

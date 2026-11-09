import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Put,
} from '@nestjs/common';
import { ApiBearerAuth, ApiCookieAuth, ApiTags } from '@nestjs/swagger';
import {
  type MyRegistration,
  type TournamentEntryInput,
  tournamentEntrySchema,
  type ReviewRegistrationInput,
  reviewRegistrationSchema,
  type SeedsInput,
  seedsSchema,
  type TournamentRegistration,
} from '@epickem/shared';
import type { AuthUser } from '../auth/auth-user';
import { CurrentUser } from '../auth/auth.decorators';
import { RegistrationsService } from './registrations.service';

@ApiTags('registrations')
@ApiCookieAuth()
@ApiBearerAuth()
@Controller()
export class RegistrationsController {
  constructor(private readonly registrations: RegistrationsService) {}

  @Get('me/registrations')
  listMine(@CurrentUser() user: AuthUser): Promise<MyRegistration[]> {
    return this.registrations.listMine(user.id);
  }

  /** Inscriptions d'un tournoi, pour son organisateur. */
  @Get('me/tournaments/:id/registrations')
  listForOrganizer(
    @CurrentUser() user: AuthUser,
    @Param('id', ParseUUIDPipe) id: string,
  ): Promise<TournamentRegistration[]> {
    return this.registrations.listForOrganizer(user.id, id);
  }

  @Post('tournaments/:id/registrations')
  register(
    @CurrentUser() user: AuthUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Body({ schema: tournamentEntrySchema }) body: TournamentEntryInput,
  ): Promise<MyRegistration> {
    return this.registrations.register(user, id, body);
  }

  @Delete('tournaments/:id/registrations/:registrationId')
  @HttpCode(HttpStatus.NO_CONTENT)
  cancel(
    @CurrentUser() user: AuthUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Param('registrationId', ParseUUIDPipe) registrationId: string,
  ): Promise<void> {
    return this.registrations.cancel(user.id, id, registrationId);
  }

  @Post('tournaments/:id/registrations/:registrationId/check-in')
  @HttpCode(HttpStatus.NO_CONTENT)
  checkIn(
    @CurrentUser() user: AuthUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Param('registrationId', ParseUUIDPipe) registrationId: string,
  ): Promise<void> {
    return this.registrations.checkIn(user.id, id, registrationId);
  }

  /** Clôt le check-in : les absents sont remplacés par la liste d'attente. */
  @Post('tournaments/:id/check-in/close')
  @HttpCode(HttpStatus.NO_CONTENT)
  closeCheckIn(
    @CurrentUser() user: AuthUser,
    @Param('id', ParseUUIDPipe) id: string,
  ): Promise<void> {
    return this.registrations.closeCheckIn(user.id, id);
  }

  @Put('tournaments/:id/seeds')
  @HttpCode(HttpStatus.NO_CONTENT)
  setSeeds(
    @CurrentUser() user: AuthUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Body({ schema: seedsSchema }) body: SeedsInput,
  ): Promise<void> {
    return this.registrations.setSeeds(user.id, id, body);
  }

  /** Accepte ou refuse une inscription en attente. */
  @Patch('tournaments/:id/registrations/:registrationId')
  @HttpCode(HttpStatus.NO_CONTENT)
  review(
    @CurrentUser() user: AuthUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Param('registrationId', ParseUUIDPipe) registrationId: string,
    @Body({ schema: reviewRegistrationSchema }) body: ReviewRegistrationInput,
  ): Promise<void> {
    return this.registrations.review(user.id, id, registrationId, body);
  }
}

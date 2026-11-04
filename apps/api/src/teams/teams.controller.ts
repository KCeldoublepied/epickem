import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseUUIDPipe,
  Post,
} from '@nestjs/common';
import { ApiBearerAuth, ApiCookieAuth, ApiTags } from '@nestjs/swagger';
import {
  type CreateTeamInput,
  createTeamSchema,
  type TeamDetail,
  type TeamInvitation,
} from '@epickem/shared';
import type { AuthUser } from '../auth/auth-user';
import { CurrentUser, Public } from '../auth/auth.decorators';
import { TeamsService } from './teams.service';

@ApiTags('teams')
@ApiCookieAuth()
@ApiBearerAuth()
@Controller()
export class TeamsController {
  constructor(private readonly teams: TeamsService) {}

  /** Équipes dont le compte connecté est membre. */
  @Get('me/teams')
  list(@CurrentUser() user: AuthUser): Promise<TeamDetail[]> {
    return this.teams.listFor(user.id);
  }

  @Post('teams')
  create(
    @CurrentUser() user: AuthUser,
    @Body({ schema: createTeamSchema }) body: CreateTeamInput,
  ): Promise<TeamDetail> {
    return this.teams.create(user.id, body);
  }

  /** Publique : la personne invitée voit l'équipe avant de se connecter. */
  @Public()
  @Get('teams/invitations/:code')
  invitation(@Param('code') code: string): Promise<TeamInvitation> {
    return this.teams.findInvitation(code);
  }

  @Post('teams/invitations/:code')
  join(@CurrentUser() user: AuthUser, @Param('code') code: string): Promise<TeamDetail> {
    return this.teams.join(user.id, code);
  }

  @Post('teams/:id/invite-code')
  @HttpCode(HttpStatus.OK)
  renewInvite(
    @CurrentUser() user: AuthUser,
    @Param('id', ParseUUIDPipe) id: string,
  ): Promise<TeamDetail> {
    return this.teams.renewInvite(user.id, id);
  }

  @Delete('teams/:id/members/:userId')
  @HttpCode(HttpStatus.NO_CONTENT)
  removeMember(
    @CurrentUser() user: AuthUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Param('userId', ParseUUIDPipe) userId: string,
  ): Promise<void> {
    return this.teams.removeMember(user.id, id, userId);
  }
}

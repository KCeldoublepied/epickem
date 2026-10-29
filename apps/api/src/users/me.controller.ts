import { Body, Controller, Get, HttpCode, HttpStatus, Patch } from '@nestjs/common';
import { ApiBearerAuth, ApiCookieAuth, ApiTags } from '@nestjs/swagger';
import {
  type ChangePasswordInput,
  changePasswordSchema,
  type UpdateProfileInput,
  updateProfileSchema,
  type UserProfile,
} from '@epickem/shared';
import { toUserProfile } from '../auth/auth-user';
import { CurrentSession } from '../auth/auth.decorators';
import type { ActiveSession } from '../auth/sessions.service';
import { UsersService } from './users.service';

/** Profil du compte connecté. */
@ApiTags('me')
@ApiCookieAuth()
@ApiBearerAuth()
@Controller('me')
export class MeController {
  constructor(private readonly users: UsersService) {}

  @Get()
  get(@CurrentSession() session: ActiveSession): UserProfile {
    return toUserProfile(session.user);
  }

  @Patch()
  async update(
    @CurrentSession() session: ActiveSession,
    @Body({ schema: updateProfileSchema }) body: UpdateProfileInput,
  ): Promise<UserProfile> {
    return toUserProfile(await this.users.updateProfile(session.user.id, body));
  }

  /** Les autres appareils sont déconnectés ; la session en cours reste ouverte. */
  @Patch('password')
  @HttpCode(HttpStatus.NO_CONTENT)
  async changePassword(
    @CurrentSession() session: ActiveSession,
    @Body({ schema: changePasswordSchema }) body: ChangePasswordInput,
  ): Promise<void> {
    await this.users.changePassword(session, body);
  }
}

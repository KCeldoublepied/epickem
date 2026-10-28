import {
  Body,
  Controller,
  Headers,
  HttpCode,
  HttpStatus,
  Inject,
  Post,
  Res,
  UseGuards,
} from '@nestjs/common';
import { ApiHeader, ApiTags } from '@nestjs/swagger';
import { ThrottlerGuard } from '@nestjs/throttler';
import type { Response } from 'express';
import {
  type AuthResponse,
  type LoginInput,
  loginSchema,
  type RegisterInput,
  registerSchema,
} from '@epickem/shared';
import { ENV, type Env } from '../config/env';
import { type AuthUser, toUserProfile } from './auth-user';
import { CurrentSession, Public } from './auth.decorators';
import { AuthService } from './auth.service';
import { SESSION_COOKIE, sessionCookieOptions } from './session-cookie';
import { type ActiveSession, SessionsService } from './sessions.service';

/** Le mobile demande le jeton dans la réponse ; le web le reçoit en cookie httpOnly. */
const TRANSPORT_HEADER = 'x-session-transport';

@ApiTags('auth')
@ApiHeader({
  name: TRANSPORT_HEADER,
  required: false,
  description: '« bearer » pour recevoir le jeton dans la réponse (application mobile).',
})
@Controller('auth')
export class AuthController {
  constructor(
    @Inject(ENV) private readonly env: Env,
    private readonly auth: AuthService,
    private readonly sessions: SessionsService,
  ) {}

  @Public()
  @UseGuards(ThrottlerGuard)
  @Post('register')
  async register(
    @Body({ schema: registerSchema }) body: RegisterInput,
    @Headers() headers: Record<string, string | undefined>,
    @Res({ passthrough: true }) res: Response,
  ): Promise<AuthResponse> {
    const user = await this.auth.register(body);
    return this.startSession(user, headers, res);
  }

  @Public()
  @UseGuards(ThrottlerGuard)
  @Post('login')
  @HttpCode(HttpStatus.OK)
  async login(
    @Body({ schema: loginSchema }) body: LoginInput,
    @Headers() headers: Record<string, string | undefined>,
    @Res({ passthrough: true }) res: Response,
  ): Promise<AuthResponse> {
    const user = await this.auth.login(body);
    return this.startSession(user, headers, res);
  }

  @Post('logout')
  @HttpCode(HttpStatus.NO_CONTENT)
  async logout(
    @CurrentSession() session: ActiveSession,
    @Res({ passthrough: true }) res: Response,
  ): Promise<void> {
    await this.sessions.revoke(session.sessionId);
    const { maxAge: _, ...options } = sessionCookieOptions(this.env);
    res.clearCookie(SESSION_COOKIE, options);
  }

  private async startSession(
    user: AuthUser,
    headers: Record<string, string | undefined>,
    res: Response,
  ): Promise<AuthResponse> {
    const token = await this.sessions.create(user.id, headers['user-agent']);
    if (headers[TRANSPORT_HEADER]?.toLowerCase() === 'bearer') {
      return { user: toUserProfile(user), token };
    }
    res.cookie(SESSION_COOKIE, token, sessionCookieOptions(this.env));
    return { user: toUserProfile(user) };
  }
}

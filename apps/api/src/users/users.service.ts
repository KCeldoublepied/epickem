import { ConflictException, ForbiddenException, Injectable } from '@nestjs/common';
import type { ChangePasswordInput, UpdateProfileInput } from '@epickem/shared';
import { AUTH_USER_SELECT, type AuthUser } from '../auth/auth-user';
import { AuthService, isUniqueViolation } from '../auth/auth.service';
import { hashPassword, verifyPassword } from '../auth/password';
import { type ActiveSession, SessionsService } from '../auth/sessions.service';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class UsersService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly auth: AuthService,
    private readonly sessions: SessionsService,
  ) {}

  async updateProfile(userId: string, input: UpdateProfileInput): Promise<AuthUser> {
    await this.auth.assertAvailable({ username: input.username }, userId);
    try {
      return await this.prisma.user.update({
        where: { id: userId },
        data: input,
        select: AUTH_USER_SELECT,
      });
    } catch (error) {
      if (isUniqueViolation(error)) throw new ConflictException('Ce pseudo est déjà pris');
      throw error;
    }
  }

  async changePassword(session: ActiveSession, input: ChangePasswordInput): Promise<void> {
    const { passwordHash } = await this.prisma.user.findUniqueOrThrow({
      where: { id: session.user.id },
      select: { passwordHash: true },
    });
    if (!(await verifyPassword(input.currentPassword, passwordHash))) {
      throw new ForbiddenException({
        message: 'Mot de passe actuel incorrect',
        issues: [{ path: 'currentPassword', message: 'Mot de passe actuel incorrect' }],
      });
    }
    await this.prisma.user.update({
      where: { id: session.user.id },
      data: { passwordHash: await hashPassword(input.newPassword) },
    });
    await this.sessions.revokeOthers(session.user.id, session.sessionId);
  }
}

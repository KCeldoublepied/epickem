import { ConflictException, Injectable, UnauthorizedException } from '@nestjs/common';
import type { ApiErrorIssue, LoginInput, RegisterInput } from '@epickem/shared';
import { Prisma } from '../generated/prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { AUTH_USER_SELECT, type AuthUser } from './auth-user';
import { getDummyHash, hashPassword, verifyPassword } from './password';

@Injectable()
export class AuthService {
  constructor(private readonly prisma: PrismaService) {}

  async register(input: RegisterInput): Promise<AuthUser> {
    await this.assertAvailable({ email: input.email, username: input.username });
    try {
      return await this.prisma.user.create({
        data: {
          email: input.email,
          username: input.username,
          displayName: input.displayName ?? input.username,
          passwordHash: await hashPassword(input.password),
        },
        select: AUTH_USER_SELECT,
      });
    } catch (error) {
      // Deux inscriptions simultanées avec le même e-mail ou pseudo.
      if (isUniqueViolation(error)) throw new ConflictException('Ce compte existe déjà');
      throw error;
    }
  }

  /** Même erreur, et même durée, que le compte existe ou non. */
  async login({ identifier, password }: LoginInput): Promise<AuthUser> {
    const user = await this.prisma.user.findUnique({
      where: identifier.includes('@') ? { email: identifier } : { username: identifier },
      select: { ...AUTH_USER_SELECT, passwordHash: true },
    });
    const valid = await verifyPassword(password, user?.passwordHash ?? (await getDummyHash()));
    if (!user || !valid) throw new UnauthorizedException('Identifiants invalides');
    const { passwordHash: _, ...authUser } = user;
    return authUser;
  }

  /** Erreur 409 qui désigne les champs déjà pris, pour les afficher sous le formulaire. */
  async assertAvailable(
    fields: { email?: string; username?: string },
    exceptUserId?: string,
  ): Promise<void> {
    const conditions = Object.entries(fields)
      .filter(([, value]) => value !== undefined)
      .map(([key, value]) => ({ [key]: value }));
    if (conditions.length === 0) return;

    const taken = await this.prisma.user.findMany({
      where: { OR: conditions, ...(exceptUserId && { id: { not: exceptUserId } }) },
      select: { email: true, username: true },
    });
    const issues: ApiErrorIssue[] = [];
    if (fields.email && taken.some((user) => user.email === fields.email)) {
      issues.push({ path: 'email', message: 'Cette adresse e-mail est déjà utilisée' });
    }
    if (fields.username && taken.some((user) => user.username === fields.username)) {
      issues.push({ path: 'username', message: 'Ce pseudo est déjà pris' });
    }
    if (issues.length > 0) {
      throw new ConflictException({ message: 'Données déjà utilisées', issues });
    }
  }
}

export function isUniqueViolation(error: unknown): boolean {
  return error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002';
}

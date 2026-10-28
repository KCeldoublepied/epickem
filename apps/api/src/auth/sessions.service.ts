import { createHash, randomBytes } from 'node:crypto';
import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { AUTH_USER_SELECT, type AuthUser } from './auth-user';

/** Durée de vie d'une session sans activité. */
export const SESSION_TTL_MS = 30 * 24 * 60 * 60 * 1000;
/** Prolongation au plus une fois par jour, pour ne pas écrire en base à chaque requête. */
const REFRESH_AFTER_MS = 24 * 60 * 60 * 1000;

export interface ActiveSession {
  sessionId: string;
  user: AuthUser;
}

/** Seule l'empreinte du jeton est stockée : une fuite de la base ne donne accès à aucune session. */
function hashToken(token: string): string {
  return createHash('sha256').update(token).digest('hex');
}

@Injectable()
export class SessionsService {
  constructor(private readonly prisma: PrismaService) {}

  /** Crée une session et renvoie son jeton, qui n'est jamais stocké en clair. */
  async create(userId: string, userAgent?: string): Promise<string> {
    const token = randomBytes(32).toString('base64url');
    await this.prisma.session.create({
      data: {
        userId,
        tokenHash: hashToken(token),
        userAgent: userAgent?.slice(0, 255),
        expiresAt: new Date(Date.now() + SESSION_TTL_MS),
      },
    });
    return token;
  }

  /** Session valide correspondant au jeton, prolongée si besoin ; sinon null. */
  async validate(token: string): Promise<ActiveSession | null> {
    const session = await this.prisma.session.findUnique({
      where: { tokenHash: hashToken(token) },
      select: { id: true, expiresAt: true, lastUsedAt: true, user: { select: AUTH_USER_SELECT } },
    });
    const now = Date.now();
    if (!session) return null;
    if (session.expiresAt.getTime() <= now) {
      await this.prisma.session.deleteMany({ where: { id: session.id } });
      return null;
    }
    if (now - session.lastUsedAt.getTime() > REFRESH_AFTER_MS) {
      await this.prisma.session.update({
        where: { id: session.id },
        data: { lastUsedAt: new Date(now), expiresAt: new Date(now + SESSION_TTL_MS) },
      });
    }
    return { sessionId: session.id, user: session.user };
  }

  async revoke(sessionId: string): Promise<void> {
    await this.prisma.session.deleteMany({ where: { id: sessionId } });
  }

  /** Déconnecte les autres appareils, par exemple après un changement de mot de passe. */
  async revokeOthers(userId: string, keepSessionId: string): Promise<void> {
    await this.prisma.session.deleteMany({ where: { userId, id: { not: keepSessionId } } });
  }
}

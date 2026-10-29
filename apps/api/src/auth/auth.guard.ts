import {
  type CanActivate,
  type ExecutionContext,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { type AuthenticatedRequest, IS_PUBLIC } from './auth.decorators';
import { SESSION_COOKIE } from './session-cookie';
import { SessionsService } from './sessions.service';

/**
 * Garde globale : identifie le compte à partir du jeton de session (en-tête
 * `Authorization: Bearer` pour le mobile, cookie pour le web) et refuse par défaut
 * les routes qui ne sont pas marquées @Public().
 */
@Injectable()
export class AuthGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly sessions: SessionsService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<AuthenticatedRequest>();
    const token = extractToken(request);
    // Même sur une route publique, le compte est identifié s'il est connecté
    // (ex. : un tournoi privé reste visible par son organisateur).
    const session = token ? await this.sessions.validate(token) : null;
    if (session) request.auth = session;

    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (!isPublic && !session) throw new UnauthorizedException('Connexion requise');
    return true;
  }
}

function extractToken(request: AuthenticatedRequest): string | undefined {
  const [scheme, value] = request.headers.authorization?.split(' ') ?? [];
  if (scheme?.toLowerCase() === 'bearer' && value) return value;
  const cookie: unknown = request.cookies?.[SESSION_COOKIE];
  return typeof cookie === 'string' && cookie ? cookie : undefined;
}

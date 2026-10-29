import { createParamDecorator, type ExecutionContext, SetMetadata } from '@nestjs/common';
import type { Request } from 'express';
import type { AuthUser } from './auth-user';
import type { ActiveSession } from './sessions.service';

export interface AuthenticatedRequest extends Request {
  /** Renseigné par AuthGuard quand la requête porte une session valide. */
  auth?: ActiveSession;
}

export const IS_PUBLIC = 'isPublic';

/**
 * Route accessible sans être connecté. Toutes les autres routes exigent une session :
 * oublier ce décorateur bloque la route au lieu de l'ouvrir.
 */
export const Public = () => SetMetadata(IS_PUBLIC, true);

/** Session de la requête ; undefined sur une route publique appelée sans être connecté. */
export const CurrentSession = createParamDecorator(
  (_data: unknown, ctx: ExecutionContext): ActiveSession | undefined =>
    ctx.switchToHttp().getRequest<AuthenticatedRequest>().auth,
);

/** Compte connecté ; undefined sur une route publique appelée sans être connecté. */
export const CurrentUser = createParamDecorator(
  (_data: unknown, ctx: ExecutionContext): AuthUser | undefined =>
    ctx.switchToHttp().getRequest<AuthenticatedRequest>().auth?.user,
);

import type { CookieOptions } from 'express';
import type { Env } from '../config/env';
import { SESSION_TTL_MS } from './sessions.service';

export const SESSION_COOKIE = 'epickem_session';

/**
 * httpOnly : illisible par le JavaScript de la page (protège le jeton en cas de XSS).
 * SameSite=Lax : non envoyé par les requêtes POST venant d'autres sites (protège du CSRF).
 */
export function sessionCookieOptions(env: Env): CookieOptions {
  return {
    httpOnly: true,
    secure: env.COOKIE_SECURE,
    sameSite: 'lax',
    path: '/',
    maxAge: SESSION_TTL_MS,
  };
}

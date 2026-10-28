import type { UserProfile } from '@epickem/shared';
import type { Prisma } from '../generated/prisma/client';

/** Champs du compte connecté chargés à chaque requête : jamais le hachage du mot de passe. */
export const AUTH_USER_SELECT = {
  id: true,
  email: true,
  username: true,
  displayName: true,
  createdAt: true,
} satisfies Prisma.UserSelect;

export type AuthUser = Prisma.UserGetPayload<{ select: typeof AUTH_USER_SELECT }>;

export function toUserProfile(user: AuthUser): UserProfile {
  return { ...user, createdAt: user.createdAt.toISOString() };
}

import { z } from 'zod';

/** Adresse e-mail, sans espaces autour et en minuscules. */
export const emailSchema = z.string().trim().toLowerCase().check(z.email());

/** Pseudo unique : stocké en minuscules */
export const usernameSchema = z
  .string()
  .trim()
  .toLowerCase()
  .min(3)
  .max(20)
  .regex(/^[a-z0-9_-]+$/, 'Lettres, chiffres, « _ » et « - » uniquement');

export const displayNameSchema = z.string().trim().min(1).max(50);

/**
 * Mot de passe : la longueur compte plus que la complexité (recommandations OWASP et NIST).
 * La limite haute évite qu'un mot de passe énorme ralentisse volontairement le hachage.
 */
export const passwordSchema = z.string().min(12).max(128);

export const registerSchema = z.object({
  email: emailSchema,
  username: usernameSchema,
  displayName: displayNameSchema.optional(),
  password: passwordSchema,
});
export type RegisterInput = z.infer<typeof registerSchema>;

export const loginSchema = z.object({
  identifier: z.string().trim().toLowerCase().min(1).max(254),
  password: z.string().min(1).max(128),
});
export type LoginInput = z.infer<typeof loginSchema>;

export const updateProfileSchema = z.object({
  username: usernameSchema.optional(),
  displayName: displayNameSchema.optional(),
});
export type UpdateProfileInput = z.infer<typeof updateProfileSchema>;

export const changePasswordSchema = z.object({
  currentPassword: z.string().min(1).max(128),
  newPassword: passwordSchema,
});
export type ChangePasswordInput = z.infer<typeof changePasswordSchema>;

/** Compte connecté, tel que l'API le renvoie (jamais de mot de passe ni de jeton). */
export interface UserProfile {
  id: string;
  email: string;
  username: string;
  displayName: string;
  createdAt: string;
}

/** Réponse de l'inscription et de la connexion. */
export interface AuthResponse {
  user: UserProfile;
  token?: string;
}

export type TournamentRole = 'ADMIN' | 'PLAYER' | 'SPECTATOR';

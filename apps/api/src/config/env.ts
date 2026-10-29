import { z } from 'zod';

/**
 * Variables d'environnement lues par l'API. Elles sont validées une seule fois au démarrage :
 * une variable manquante ou mal formée arrête l'API tout de suite, avec un message clair.
 * Valeurs locales : .env.example ; dans Docker : docker-compose.yml.
 */
export const envSchema = z.object({
  PORT: z.coerce.number().int().min(1).max(65535).default(4000),
  DATABASE_URL: z.url({ protocol: /^postgres(ql)?$/ }),
  /** Origine autorisée par CORS (le site web). */
  WEB_ORIGIN: z.url().default('http://localhost:3000'),
  /**
   * Cookie de session envoyé uniquement en HTTPS. Les navigateurs l'acceptent aussi sur
   * http://localhost ; ne le désactiver que pour un autre hôte en HTTP.
   */
  COOKIE_SECURE: z.stringbool().default(true),
  /** Tentatives d'inscription ou de connexion autorisées par minute et par adresse IP. */
  AUTH_RATE_LIMIT: z.coerce.number().int().positive().default(10),
});

export type Env = z.infer<typeof envSchema>;

/** Jeton d'injection de la configuration validée : `@Inject(ENV) private readonly env: Env`. */
export const ENV = Symbol('ENV');

export function validateEnv(raw: NodeJS.ProcessEnv): Env {
  const result = envSchema.safeParse(raw);
  if (!result.success) {
    throw new Error(
      `Configuration invalide (voir .env.example) :\n${z.prettifyError(result.error)}`,
    );
  }
  return result.data;
}

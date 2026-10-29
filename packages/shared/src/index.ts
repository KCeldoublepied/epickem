/**
 * @epickem/shared — code partagé entre le web, l'API, le mobile et le simulateur.
 *
 * Contiendra les types du domaine, les schémas de validation (Zod) et le client API.
 * Voir docs/adr/0001-monorepo-typescript-turborepo-pnpm.md.
 */

/**
 * Nom du produit, tel qu'il s'écrit dans un texte. Le logo l'affiche en capitales (EPICKEM) ;
 * dans le texte, on garde « Epickem » pour que les lecteurs d'écran le lisent comme un mot.
 */
export const APP_NAME = 'Epickem';

/** Accroche, à utiliser sous le logo ou dans les métadonnées. */
export const APP_TAGLINE = 'Pronostics. Tournois. Communauté.';

export * from './auth';
export * from './brand';
export * from './theme';

/** Réponse de la route de santé de l'API (`GET /health`). */
export interface HealthStatus {
  status: 'ok';
  service: string;
  /** Heure du serveur, au format ISO 8601 (UTC). */
  time: string;
}

/** Erreur renvoyée par l'API. Toutes les erreurs ont ce format, quelle que soit leur cause. */
export interface ApiError {
  /** Code HTTP : 400, 404, 500… */
  statusCode: number;
  /** Nom du code HTTP, stable, à utiliser dans le code : "BAD_REQUEST", "NOT_FOUND"… */
  error: string;
  /** Message lisible par une personne. */
  message: string;
  /** Champs invalides, pour une erreur de validation. */
  issues?: ApiErrorIssue[];
}

/** Champ invalide d'une requête. */
export interface ApiErrorIssue {
  /** Chemin du champ, par exemple "name" ou "players.0.email" ; vide pour la donnée entière. */
  path: string;
  message: string;
}

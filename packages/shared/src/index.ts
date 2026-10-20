/**
 * @epickem/shared — code partagé entre le web, l'API, le mobile et le simulateur.
 *
 * Contiendra les types du domaine, les schémas de validation (Zod) et le client API.
 * Voir docs/adr/0001-monorepo-typescript-turborepo-pnpm.md.
 */

/** Nom provisoire du produit, en attendant l'identité visuelle (#10). */
export const APP_NAME = "EPIck'em";

/** Réponse de la route de santé de l'API (`GET /health`). */
export interface HealthStatus {
  status: 'ok';
  service: string;
  /** Heure du serveur, au format ISO 8601 (UTC). */
  time: string;
}

/** Profils de la plateforme (sujet, bloc 02-B). */
export type Role = 'admin' | 'player' | 'spectator';

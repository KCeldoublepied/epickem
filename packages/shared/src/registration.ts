import { z } from 'zod';

// Valeurs de l'énumération RegistrationStatus du modèle de données.
export const REGISTRATION_STATUSES = [
  'PENDING',
  'ACCEPTED',
  'WAITLISTED',
  'REJECTED',
  'CANCELLED',
] as const;
export type RegistrationStatus = (typeof REGISTRATION_STATUSES)[number];

export const REGISTRATION_STATUS_LABELS: Record<RegistrationStatus, string> = {
  PENDING: 'En attente de validation',
  ACCEPTED: 'Inscription confirmée',
  WAITLISTED: "Liste d'attente",
  REJECTED: 'Inscription refusée',
  CANCELLED: 'Inscription annulée',
};

export const tournamentEntrySchema = z.object({
  /** Équipe à inscrire ; obligatoire pour un tournoi par équipes, interdite en solo. */
  teamId: z.uuid('Choisissez une équipe.').optional(),
});
export type TournamentEntryInput = z.infer<typeof tournamentEntrySchema>;

/** Décision de l'organisateur sur une inscription en attente. */
export const reviewRegistrationSchema = z.object({ status: z.enum(['ACCEPTED', 'REJECTED']) });
export type ReviewRegistrationInput = z.infer<typeof reviewRegistrationSchema>;

/** Inscription du compte connecté, ou de l'une de ses équipes. */
export interface MyRegistration {
  id: string;
  tournamentId: string;
  status: RegistrationStatus;
  team: { id: string; name: string } | null;
  /** Vrai pour le joueur inscrit ou le chef de l'équipe inscrite, sauf après un refus. */
  canCancel: boolean;
}

/** Inscription telle que l'organisateur la voit. */
export interface TournamentRegistration {
  id: string;
  status: RegistrationStatus;
  /** Nom de l'équipe ou du joueur. */
  name: string;
  /** Membres de l'équipe ; null pour un joueur seul. */
  memberCount: number | null;
}

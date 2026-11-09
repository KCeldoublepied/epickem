import { z } from 'zod';

import type { StructureIssue } from './stages';
import type { CustomField } from './tournament';

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
  /** Réponses aux champs personnalisés du tournoi, par libellé. */
  customFieldValues: z.record(z.string(), z.string().trim().max(200)).default({}),
});
export type TournamentEntryInput = z.infer<typeof tournamentEntrySchema>;

/** Décision de l'organisateur sur une inscription en attente. */
export const reviewRegistrationSchema = z.object({ status: z.enum(['ACCEPTED', 'REJECTED']) });
export type ReviewRegistrationInput = z.infer<typeof reviewRegistrationSchema>;

/** Ordre de seeding : les participants du tournoi, du premier au dernier. */
export const seedsSchema = z.object({ participantIds: z.array(z.uuid()).max(4096) });
export type SeedsInput = z.infer<typeof seedsSchema>;

/** Réponses obligatoires manquantes ou hors de la liste proposée. */
export function customFieldIssues(
  fields: readonly CustomField[],
  values: Record<string, string>,
): StructureIssue[] {
  return fields.flatMap(({ label, required, options }) => {
    const value = values[label]?.trim();
    const path = ['customFieldValues', label];
    if (!value) return required ? [{ path, message: `« ${label} » est obligatoire.` }] : [];
    return options.length > 0 && !options.includes(value)
      ? [{ path, message: `Choisissez une réponse de la liste pour « ${label} ».` }]
      : [];
  });
}

/** Inscription du compte connecté, ou de l'une de ses équipes. */
export interface MyRegistration {
  id: string;
  tournamentId: string;
  status: RegistrationStatus;
  team: { id: string; name: string } | null;
  /** Position dans la liste d'attente ; null ailleurs. */
  waitlistPosition: number | null;
  /** Vrai une fois le check-in fait. */
  checkedIn: boolean;
  /** Vrai pour le joueur inscrit ou le chef de l'équipe inscrite, tant que l'inscription vit. */
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
  /** Participant engagé dans le tournoi ; null tant que l'inscription n'est pas confirmée. */
  participantId: string | null;
  seed: number | null;
  waitlistPosition: number | null;
  checkedIn: boolean;
  customFieldValues: Record<string, string>;
}

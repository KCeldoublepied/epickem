import { z } from 'zod';

import type { GameSettings } from './game-catalog';
import {
  dateTimeSchema,
  MAX_STAGES,
  type StageDetail,
  stageInputSchema,
  stageStructureIssues,
} from './stages';

// Valeurs des énumérations du modèle de données (apps/api/prisma/schema.prisma).
export const TOURNAMENT_STATUSES = [
  'DRAFT',
  'REGISTRATION',
  'IN_PROGRESS',
  'COMPLETED',
  'CANCELLED',
] as const;
export type TournamentStatus = (typeof TOURNAMENT_STATUSES)[number];

export const VISIBILITIES = ['PUBLIC', 'UNLISTED', 'PRIVATE'] as const;
export type Visibility = (typeof VISIBILITIES)[number];

/** Lieu du tournoi : en ligne, sur place (LAN, salle…) ou les deux. */
export const LOCATION_TYPES = ['ONLINE', 'ONSITE', 'HYBRID'] as const;
export type LocationType = (typeof LOCATION_TYPES)[number];

export const PARTICIPANT_TYPES = ['SOLO', 'TEAM'] as const;
export type ParticipantType = (typeof PARTICIPANT_TYPES)[number];

export const REGISTRATION_MODES = ['OPEN', 'APPROVAL'] as const;
export type RegistrationMode = (typeof REGISTRATION_MODES)[number];

const isBefore = (a?: string, b?: string) =>
  a !== undefined && b !== undefined && Date.parse(a) < Date.parse(b);
const isNotAfter = (a?: string, b?: string) =>
  a !== undefined && b !== undefined && Date.parse(a) <= Date.parse(b);

const NAME_ERROR = 'De 3 à 100 caractères.';
const nameSchema = z.string(NAME_ERROR).trim().min(3, NAME_ERROR).max(100, NAME_ERROR);

const optionalText = (max: number) => {
  const message = `Au plus ${max.toLocaleString('fr-FR')} caractères.`;
  return z.string().trim().min(1, message).max(max, message).optional();
};

const END_BEFORE_START = 'Doit être après le début du tournoi';

/** Création rapide : le reste se règle ensuite dans le dashboard du tournoi. */
export const createTournamentSchema = z
  .object({
    name: nameSchema,
    startsAt: z.iso.datetime({ offset: true, error: 'Indiquez la date et l’heure de début.' }),
    endsAt: z.iso.datetime({ offset: true, error: 'Indiquez la date et l’heure de fin.' }),
  })
  .superRefine((input, ctx) => {
    if (isNotAfter(input.endsAt, input.startsAt)) {
      ctx.addIssue({ code: 'custom', path: ['endsAt'], message: END_BEFORE_START });
    }
  });
export type CreateTournamentInput = z.infer<typeof createTournamentSchema>;

const TEAM_SIZE_ERROR = 'Nombre entier de 1 à 100.';
const teamSize = z.int(TEAM_SIZE_ERROR).min(1, TEAM_SIZE_ERROR).max(100, TEAM_SIZE_ERROR);
const SEATS_ERROR = 'Nombre entier de 2 à 4 096.';

/** Tous les réglages d'un tournoi, enregistrés d'un bloc depuis le dashboard. */
export const tournamentSettingsSchema = z
  .object({
    /** Facultatif tant que le tournoi est un brouillon. */
    gameId: z.uuid('Choisissez un jeu.').optional(),
    /** Réglages du jeu, validés par l'API avec le catalogue (normalizeGameSettings). */
    gameSettings: z.record(z.string(), z.unknown()).default({}),
    name: nameSchema,
    description: optionalText(5000),
    rules: optionalText(10000),
    visibility: z.enum(VISIBILITIES).default('PUBLIC'),
    startsAt: dateTimeSchema.optional(),
    endsAt: dateTimeSchema.optional(),
    locationType: z.enum(LOCATION_TYPES).default('ONLINE'),
    /** Adresse ou nom du lieu ; obligatoire pour un tournoi sur place ou hybride. */
    location: optionalText(200),
    participantType: z.enum(PARTICIPANT_TYPES).default('SOLO'),
    /** Taille des équipes ; obligatoire pour un tournoi par équipes, interdite en solo. */
    teamSizeMin: teamSize.optional(),
    teamSizeMax: teamSize.optional(),
    /** Nombre d'inscrits en solo, nombre d'équipes sinon. */
    maxParticipants: z.int(SEATS_ERROR).min(2, SEATS_ERROR).max(4096, SEATS_ERROR).optional(),
    registrationMode: z.enum(REGISTRATION_MODES).default('OPEN'),
    registrationOpensAt: dateTimeSchema.optional(),
    registrationClosesAt: dateTimeSchema.optional(),
    checkInOpensAt: dateTimeSchema.optional(),
    /** Phases de la compétition, dans l'ordre ; chacune a son propre format. */
    stages: z.array(stageInputSchema).max(MAX_STAGES, `Au plus ${MAX_STAGES} phases.`).default([]),
  })
  .superRefine((input, ctx) => {
    const issue = (path: string, message: string) =>
      ctx.addIssue({ code: 'custom', path: [path], message });

    if (input.locationType !== 'ONLINE' && !input.location) {
      issue('location', 'Le lieu est obligatoire pour un tournoi sur place ou hybride');
    }

    if (input.participantType === 'TEAM') {
      if (input.teamSizeMin === undefined) issue('teamSizeMin', 'Obligatoire pour des équipes');
      if (input.teamSizeMax === undefined) issue('teamSizeMax', 'Obligatoire pour des équipes');
      if ((input.teamSizeMin ?? 0) > (input.teamSizeMax ?? Infinity)) {
        issue('teamSizeMax', 'Doit être supérieur ou égal à la taille minimale');
      }
    } else {
      if (input.teamSizeMin !== undefined) issue('teamSizeMin', 'Réservé aux tournois par équipes');
      if (input.teamSizeMax !== undefined) issue('teamSizeMax', 'Réservé aux tournois par équipes');
    }

    if (isNotAfter(input.endsAt, input.startsAt)) issue('endsAt', END_BEFORE_START);
    if (isNotAfter(input.registrationClosesAt, input.registrationOpensAt)) {
      issue('registrationClosesAt', "Doit être après l'ouverture des inscriptions");
    }
    if (isBefore(input.startsAt, input.registrationClosesAt)) {
      issue('registrationClosesAt', 'Doit être avant le début du tournoi');
    }
    if (isBefore(input.startsAt, input.checkInOpensAt)) {
      issue('checkInOpensAt', 'Doit être avant le début du tournoi');
    }

    for (const { path, message } of stageStructureIssues(input.stages, input)) {
      ctx.addIssue({ code: 'custom', path, message });
    }
  });
export type TournamentSettingsInput = z.infer<typeof tournamentSettingsSchema>;
/** Réglages tels qu'un formulaire les saisit : les valeurs par défaut peuvent manquer. */
export type TournamentSettingsFormInput = z.input<typeof tournamentSettingsSchema>;

/** Ce qui manque à un tournoi pour être publié ; vide s'il est prêt. */
export function publicationIssues(tournament: {
  gameId?: string | null;
  startsAt?: string | null;
  stages: readonly unknown[];
}): { path: string; message: string }[] {
  const issues: { path: string; message: string }[] = [];
  if (!tournament.gameId) issues.push({ path: 'gameId', message: 'Choisir le jeu' });
  if (!tournament.startsAt) issues.push({ path: 'startsAt', message: 'Fixer la date de début' });
  if (tournament.stages.length === 0) {
    issues.push({ path: 'stages', message: 'Ajouter au moins une phase' });
  }
  return issues;
}

/** Jeu tel que l'API le renvoie dans les listes (`GET /games`). */
export interface GameSummary {
  id: string;
  slug: string;
  name: string;
}

/** Tournoi tel que l'API le renvoie. Les dates sont au format ISO 8601 (UTC). */
export interface TournamentDetail {
  id: string;
  slug: string;
  name: string;
  description: string | null;
  rules: string | null;
  status: TournamentStatus;
  visibility: Visibility;
  startsAt: string | null;
  endsAt: string | null;
  locationType: LocationType;
  location: string | null;
  participantType: ParticipantType;
  teamSizeMin: number | null;
  teamSizeMax: number | null;
  maxParticipants: number | null;
  registrationMode: RegistrationMode;
  registrationOpensAt: string | null;
  registrationClosesAt: string | null;
  checkInOpensAt: string | null;
  /** null tant que l'organisateur n'a pas choisi le jeu. */
  game: GameSummary | null;
  /** Réglages propres au jeu, décrits par GAME_CATALOG. */
  gameSettings: GameSettings;
  /** Phases de la compétition, dans l'ordre. */
  stages: StageDetail[];
  organizer: { id: string; username: string; displayName: string } | null;
  createdAt: string;
  updatedAt: string;
}

/** Tournoi tel qu'il apparaît dans une liste : de quoi afficher une carte. */
export type TournamentSummary = Pick<
  TournamentDetail,
  | 'id'
  | 'slug'
  | 'name'
  | 'status'
  | 'visibility'
  | 'startsAt'
  | 'locationType'
  | 'location'
  | 'participantType'
  | 'maxParticipants'
  | 'registrationMode'
  | 'registrationClosesAt'
  | 'game'
  | 'organizer'
> & {
  /** Joueurs ou équipes engagés dans le tournoi. */
  participantCount: number;
};

/** Pagination par curseur : passer `nextCursor` en `cursor` pour la page suivante. */
export const listQuerySchema = z.object({
  cursor: z.uuid().optional(),
  limit: z.coerce.number().int().min(1).max(50).default(20),
});
export type ListQuery = z.infer<typeof listQuerySchema>;

export interface Page<T> {
  items: T[];
  /** null quand il n'y a plus rien à charger. */
  nextCursor: string | null;
}

import { z } from 'zod';

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

/** Date et heure ISO 8601 avec fuseau, par exemple "2026-12-01T18:00:00Z". */
const dateTimeSchema = z.iso.datetime({ offset: true });

const optionalText = (max: number) => z.string().trim().min(1).max(max).optional();

export const createTournamentSchema = z
  .object({
    gameId: z.uuid(),
    name: z.string().trim().min(3).max(100),
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
    teamSizeMin: z.int().min(1).max(100).optional(),
    teamSizeMax: z.int().min(1).max(100).optional(),
    maxParticipants: z.int().min(2).max(4096).optional(),
    registrationMode: z.enum(REGISTRATION_MODES).default('OPEN'),
    registrationOpensAt: dateTimeSchema.optional(),
    registrationClosesAt: dateTimeSchema.optional(),
    checkInOpensAt: dateTimeSchema.optional(),
  })
  .superRefine((input, ctx) => {
    const issue = (path: string, message: string) =>
      ctx.addIssue({ code: 'custom', path: [path], message });
    const before = (a?: string, b?: string) =>
      a !== undefined && b !== undefined && Date.parse(a) < Date.parse(b);
    const notAfter = (a?: string, b?: string) =>
      a !== undefined && b !== undefined && Date.parse(a) <= Date.parse(b);

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

    if (notAfter(input.endsAt, input.startsAt)) {
      issue('endsAt', 'Doit être après le début du tournoi');
    }
    if (notAfter(input.registrationClosesAt, input.registrationOpensAt)) {
      issue('registrationClosesAt', "Doit être après l'ouverture des inscriptions");
    }
    if (before(input.startsAt, input.registrationClosesAt)) {
      issue('registrationClosesAt', 'Doit être avant le début du tournoi');
    }
    if (before(input.startsAt, input.checkInOpensAt)) {
      issue('checkInOpensAt', 'Doit être avant le début du tournoi');
    }
  });
export type CreateTournamentInput = z.infer<typeof createTournamentSchema>;

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
  game: GameSummary;
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

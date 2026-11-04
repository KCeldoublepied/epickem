import {
  type GameSettings,
  gameStructureIssues,
  type GameSummary,
  normalizeGameSettings,
  type StageFormInput,
  type TournamentDetail,
  type TournamentSettingsFormInput,
  type TournamentSettingsInput,
  tournamentSettingsSchema,
} from '@epickem/shared';

import { isoToLocal, localToIso } from '../../tournois/dates';
import { type FieldErrors, firstErrors } from '../../tournois/form-fields';

/** Phase en cours d'édition ; `key` la suit dans la liste quand elle change de position. */
export type StageDraft = StageFormInput & { key: string };

/** Réglages en cours d'édition. Les dates sont au format des champs datetime-local. */
export type Draft = Omit<TournamentSettingsFormInput, 'stages' | 'gameSettings'> & {
  gameSettings: GameSettings;
  stages: StageDraft[];
};

export interface SectionProps {
  draft: Draft;
  update: (patch: Partial<Draft>) => void;
  errors: FieldErrors;
  /** null si la liste des jeux n'a pas pu être chargée. */
  games: GameSummary[] | null;
}

export const SECTIONS = [
  ['overview', "Vue d'ensemble"],
  ['general', 'Général'],
  ['game', 'Jeu et lieu'],
  ['participants', 'Participants'],
  ['structure', 'Structure'],
] as const;
export type SectionId = (typeof SECTIONS)[number][0];

const GAME_FIELDS = ['gameId', 'gameSettings', 'locationType', 'location'];
const PARTICIPANT_FIELDS = [
  'participantType',
  'teamSizeMin',
  'teamSizeMax',
  'maxParticipants',
  'registrationMode',
  'registrationOpensAt',
  'registrationClosesAt',
  'checkInOpensAt',
];

/** Section du dashboard où se trouve un champ. */
export function sectionOf(path: string): SectionId {
  const field = path.split('.')[0] ?? '';
  if (field === 'stages') return 'structure';
  if (GAME_FIELDS.includes(field)) return 'game';
  if (PARTICIPANT_FIELDS.includes(field)) return 'participants';
  return 'general';
}

export const gameSlug = (draft: Draft, games: GameSummary[] | null) =>
  games?.find((game) => game.id === draft.gameId)?.slug;

const optionalDate = (iso: string | null) => (iso ? isoToLocal(iso) : undefined);

export function toDraft(tournament: TournamentDetail): Draft {
  return {
    name: tournament.name,
    description: tournament.description ?? undefined,
    rules: tournament.rules ?? undefined,
    visibility: tournament.visibility,
    startsAt: optionalDate(tournament.startsAt),
    endsAt: optionalDate(tournament.endsAt),
    gameId: tournament.game?.id,
    gameSettings: normalizeGameSettings(
      tournament.game?.slug,
      tournament.gameSettings,
      tournament.locationType,
    ).settings,
    locationType: tournament.locationType,
    location: tournament.location ?? undefined,
    participantType: tournament.participantType,
    teamSizeMin: tournament.teamSizeMin ?? undefined,
    teamSizeMax: tournament.teamSizeMax ?? undefined,
    maxParticipants: tournament.maxParticipants ?? undefined,
    registrationMode: tournament.registrationMode,
    registrationOpensAt: optionalDate(tournament.registrationOpensAt),
    registrationClosesAt: optionalDate(tournament.registrationClosesAt),
    checkInOpensAt: optionalDate(tournament.checkInOpensAt),
    stages: tournament.stages.map(
      ({ id, name, format, settings, startsAt }) =>
        ({ key: id, name, format, settings, startsAt: optionalDate(startsAt) }) as StageDraft,
    ),
  };
}

const text = (value: string | undefined) => (value?.trim() ? value : undefined);

/** Corps de la requête : dates en ISO, champs vides retirés. */
export function toPayload(draft: Draft): unknown {
  return {
    ...draft,
    description: text(draft.description),
    rules: text(draft.rules),
    location: text(draft.location),
    startsAt: localToIso(draft.startsAt),
    endsAt: localToIso(draft.endsAt),
    registrationOpensAt: localToIso(draft.registrationOpensAt),
    registrationClosesAt: localToIso(draft.registrationClosesAt),
    checkInOpensAt: localToIso(draft.checkInOpensAt),
    stages: draft.stages.map(({ key: _key, startsAt, ...stage }, index) => ({
      ...stage,
      startsAt: localToIso(startsAt),
      // Le champ n'est pas affiché sur la dernière phase : elle ne qualifie personne.
      settings:
        index === draft.stages.length - 1
          ? { ...stage.settings, qualifiers: undefined }
          : stage.settings,
    })),
  };
}

export type Validation =
  { data: TournamentSettingsInput; errors: null } | { data: null; errors: FieldErrors };

/** Mêmes règles que l'API : le schéma, puis le catalogue du jeu choisi. */
export function validate(draft: Draft, games: GameSummary[] | null): Validation {
  const parsed = tournamentSettingsSchema.safeParse(toPayload(draft));
  const slug = gameSlug(draft, games);
  const issues = [
    ...(parsed.error?.issues ?? []),
    ...normalizeGameSettings(slug, draft.gameSettings, draft.locationType ?? 'ONLINE').issues,
    ...gameStructureIssues(slug, draft.stages),
  ];

  if (parsed.success && issues.length === 0) return { data: parsed.data, errors: null };
  return { data: null, errors: firstErrors(issues) };
}

import { z } from 'zod';

/** Date et heure ISO 8601 avec fuseau, par exemple "2026-12-01T18:00:00Z". */
export const dateTimeSchema = z.iso.datetime({ offset: true, error: 'Date invalide.' });

// Valeurs de l'énumération StageFormat du modèle de données (apps/api/prisma/schema.prisma).
export const STAGE_FORMATS = [
  'SINGLE_ELIMINATION',
  'DOUBLE_ELIMINATION',
  'ROUND_ROBIN',
  'SWISS',
  'FREE_FOR_ALL',
] as const;
export type StageFormat = (typeof STAGE_FORMATS)[number];

/** Formats où deux participants s'affrontent, par opposition au FFA (battle royale…). */
export const DUEL_FORMATS = [
  'SINGLE_ELIMINATION',
  'DOUBLE_ELIMINATION',
  'ROUND_ROBIN',
  'SWISS',
] as const satisfies readonly StageFormat[];

export const STAGE_FORMAT_LABELS: Record<StageFormat, string> = {
  SINGLE_ELIMINATION: 'Élimination simple',
  DOUBLE_ELIMINATION: 'Élimination double',
  ROUND_ROBIN: 'Round robin (poules)',
  SWISS: 'Ronde suisse',
  FREE_FOR_ALL: 'Free for all (lobbies)',
};

export const STAGE_STATUSES = ['PENDING', 'IN_PROGRESS', 'COMPLETED'] as const;
export type StageStatus = (typeof STAGE_STATUSES)[number];

/** Façon de placer les participants au début d'une phase. */
export const SEEDINGS = ['RANDOM', 'MANUAL', 'PREVIOUS_STANDINGS', 'CROSS_GROUPS'] as const;
export type Seeding = (typeof SEEDINGS)[number];

export const SEEDING_LABELS: Record<Seeding, string> = {
  RANDOM: 'Tirage au sort',
  MANUAL: "Choix de l'organisateur",
  PREVIOUS_STANDINGS: 'Classement de la phase précédente',
  CROSS_GROUPS: 'Croisé entre poules (1er de A contre 2e de B)',
};

export const TIE_BREAKERS = ['HEAD_TO_HEAD', 'SCORE_DIFFERENCE', 'BUCHHOLZ'] as const;
export type TieBreaker = (typeof TIE_BREAKERS)[number];

/** Sans Buchholz : dans une poule, tout le monde a les mêmes adversaires, il ne départage rien. */
export const ROUND_ROBIN_TIE_BREAKERS = [
  'HEAD_TO_HEAD',
  'SCORE_DIFFERENCE',
] as const satisfies readonly TieBreaker[];

export const TIE_BREAKER_LABELS: Record<TieBreaker, string> = {
  HEAD_TO_HEAD: 'Confrontation directe',
  SCORE_DIFFERENCE: 'Différence de score',
  BUCHHOLZ: 'Buchholz (force des adversaires)',
};

export const BEST_OF_VALUES = [1, 3, 5, 7] as const;

/** Format des matchs d'une phase tant que l'organisateur ne le change pas. */
export const DEFAULT_BEST_OF = 5;

/**
 * Tours d'un arbre à élimination, désignés par leur nombre de matchs, comme dans leur nom :
 * 1 pour la finale, 2 pour les demi-finales, 4 pour les quarts, 8 pour les 8es de finale…
 * jusqu'au premier tour d'un arbre de 4096 places. Compter depuis la finale garde le même
 * sens à chaque tour, quelle que soit la taille de l'arbre.
 */
export const ELIMINATION_ROUNDS = Array.from({ length: 12 }, (_, i) => 2 ** i);

/** Nom d'un tour d'arbre à élimination, d'après son nombre de matchs. */
export function eliminationRoundName(matchCount: number): string {
  const names: Record<number, string> = {
    1: 'Finale',
    2: 'Demi-finales',
    4: 'Quarts de finale',
    8: 'Huitièmes de finale',
  };
  return names[matchCount] ?? `${matchCount}es de finale`;
}

/** Nombre maximum de phases d'un tournoi. */
export const MAX_STAGES = 8;

const NUMBER_ERROR = 'Nombre entier attendu.';
const count = (min: number, max: number) => {
  const message = `Nombre entier de ${min} à ${max}.`;
  return z.int(NUMBER_ERROR).min(min, message).max(max, message);
};
const bestOf = z.literal(BEST_OF_VALUES, 'Choisissez 1, 3, 5 ou 7 manches.');
const eliminationRound = z.enum(ELIMINATION_ROUNDS.map(String) as [string, ...string[]], {
  error: 'Tour inconnu.',
});

const commonSettings = {
  /** Participants qualifiés pour la phase suivante ; absent sur la dernière phase. */
  qualifiers: count(2, 4096).optional(),
  seeding: z.enum(SEEDINGS).default('RANDOM'),
};

const duelSettings = { ...commonSettings, bestOf: bestOf.default(DEFAULT_BEST_OF) };

const stageBase = {
  name: z.string().trim().min(1, 'De 1 à 60 caractères.').max(60, 'De 1 à 60 caractères.'),
  startsAt: dateTimeSchema.optional(),
};

/** Phase d'un tournoi : ses réglages dépendent de son format. */
export const stageInputSchema = z.discriminatedUnion('format', [
  z.object({
    ...stageBase,
    format: z.literal('SINGLE_ELIMINATION'),
    settings: z.object({
      ...duelSettings,
      /**
       * Formats propres à certains tours, par nombre de matchs du tour (voir
       * ELIMINATION_ROUNDS) : { "1": 7, "8": 3 } pour une finale en BO7 et des 8es en BO3.
       * Les tours absents suivent `bestOf`.
       */
      roundBestOf: z.partialRecord(eliminationRound, bestOf).default({}),
      thirdPlaceMatch: z.boolean().default(false),
    }),
  }),
  z.object({
    ...stageBase,
    format: z.literal('DOUBLE_ELIMINATION'),
    settings: z.object({
      ...duelSettings,
      finalBestOf: bestOf.optional(),
      /** Second match de grande finale si le finaliste du tableau perdant gagne le premier. */
      grandFinalReset: z.boolean().default(true),
    }),
  }),
  z.object({
    ...stageBase,
    format: z.literal('ROUND_ROBIN'),
    settings: z.object({
      ...duelSettings,
      groupCount: count(1, 64).default(1),
      /** Nombre de fois où chaque paire se rencontre : 1 pour un aller, 2 pour un aller-retour. */
      legs: count(1, 4).default(1),
      pointsWin: count(0, 100).default(3),
      pointsDraw: count(0, 100).default(1),
      pointsLoss: count(0, 100).default(0),
      tieBreaker: z.enum(ROUND_ROBIN_TIE_BREAKERS).default('HEAD_TO_HEAD'),
    }),
  }),
  z.object({
    ...stageBase,
    format: z.literal('SWISS'),
    settings: z.object({
      ...duelSettings,
      rounds: count(1, 20).default(5),
      tieBreaker: z.enum(TIE_BREAKERS).default('BUCHHOLZ'),
    }),
  }),
  z.object({
    ...stageBase,
    format: z.literal('FREE_FOR_ALL'),
    settings: z.object({
      ...commonSettings,
      /** Participants par lobby. */
      lobbySize: count(2, 200).default(100),
      /** Parties jouées par chaque lobby. */
      rounds: count(1, 50).default(3),
      pointsPerKill: count(0, 100).default(1),
      /** Points selon la place : le premier nombre pour le 1er, le deuxième pour le 2e… */
      placementPoints: z
        .array(count(0, 1000), 'Liste de points attendue.')
        .min(1, 'Indiquez les points du 1er au moins.')
        .max(200, 'Au plus 200 places.')
        .default([10, 7, 5, 3, 1]),
    }),
  }),
]);

export type StageInput = z.infer<typeof stageInputSchema>;
/** Phase telle qu'un formulaire la saisit : les réglages par défaut peuvent manquer. */
export type StageFormInput = z.input<typeof stageInputSchema>;

type WithoutStartsAt<T> = T extends unknown ? Omit<T, 'startsAt'> : never;

/** Phase telle que l'API la renvoie. */
export type StageDetail = WithoutStartsAt<StageInput> & {
  id: string;
  /** Position dans le tournoi, à partir de 1. */
  order: number;
  status: StageStatus;
  startsAt: string | null;
};

/** Phase neuve, avec les réglages par défaut de son format. */
export function defaultStage(format: StageFormat, name = STAGE_FORMAT_LABELS[format]): StageInput {
  return stageInputSchema.parse({ name, format, settings: {} });
}

/**
 * Participants qui entrent dans chaque phase : les inscrits pour la première, les qualifiés de
 * la précédente ensuite. `undefined` tant que le nombre n'est pas connu (inscriptions illimitées).
 */
export function stageEntrants(
  stages: readonly StageFormInput[],
  maxParticipants?: number,
): (number | undefined)[] {
  let entrants = maxParticipants;
  return stages.map((stage) => {
    const current = entrants;
    entrants = stage.settings.qualifiers;
    return current;
  });
}

export interface StructureIssue {
  path: (string | number)[];
  message: string;
}

/** Règles entre les phases : enchaînement des qualifiés, tailles et dates. */
export function stageStructureIssues(
  stages: readonly StageFormInput[],
  tournament: { maxParticipants?: number; startsAt?: string; endsAt?: string },
): StructureIssue[] {
  const issues: StructureIssue[] = [];
  const entrants = stageEntrants(stages, tournament.maxParticipants);
  let previousStart = tournament.startsAt;

  stages.forEach((stage, index) => {
    const add = (field: string, message: string, inSettings = true) =>
      issues.push({
        path: ['stages', index, ...(inSettings ? ['settings'] : []), field],
        message,
      });
    const { settings } = stage;
    const total = entrants[index];
    const isLast = index === stages.length - 1;

    if (isLast && settings.qualifiers !== undefined) {
      add('qualifiers', 'La dernière phase ne qualifie personne : elle donne le classement final.');
    }
    if (!isLast && settings.qualifiers === undefined) {
      add('qualifiers', 'Indiquez combien de participants passent à la phase suivante.');
    }
    if (total !== undefined && settings.qualifiers !== undefined && settings.qualifiers >= total) {
      add('qualifiers', `Doit être inférieur aux ${total} participants de la phase.`);
    }
    if (index === 0 && settings.seeding === 'PREVIOUS_STANDINGS') {
      add('seeding', "La première phase n'a pas de phase précédente.");
    }
    if (settings.seeding === 'CROSS_GROUPS') {
      const previous = stages[index - 1];
      if (previous?.format !== 'ROUND_ROBIN' || (previous.settings.groupCount ?? 1) < 2) {
        add('seeding', 'La phase précédente doit compter au moins deux poules.');
      }
    }

    if (stage.format === 'ROUND_ROBIN') {
      const groups = stage.settings.groupCount ?? 1;
      if (total !== undefined && groups * 2 > total) {
        add('groupCount', `Au plus ${Math.floor(total / 2)} poule(s) pour ${total} participants.`);
      }
      if (settings.qualifiers !== undefined && settings.qualifiers % groups !== 0) {
        add('qualifiers', 'Chaque poule doit qualifier le même nombre de participants.');
      }
    }
    if (stage.format === 'SWISS') {
      const rounds = stage.settings.rounds ?? 5;
      if (total !== undefined && rounds > total - 1) {
        add('rounds', `Au plus ${total - 1} rondes pour ${total} participants.`);
      }
    }
    if (stage.format === 'FREE_FOR_ALL') {
      const { lobbySize = 100, placementPoints = [] } = stage.settings;
      if (placementPoints.length > lobbySize) {
        add('placementPoints', `Au plus ${lobbySize} places dans un lobby.`);
      }
    }

    if (stage.startsAt !== undefined) {
      const start = Date.parse(stage.startsAt);
      if (previousStart !== undefined && start < Date.parse(previousStart)) {
        add(
          'startsAt',
          index === 0 || previousStart === tournament.startsAt
            ? 'Doit être après le début du tournoi.'
            : 'Doit être après le début de la phase précédente.',
          false,
        );
      }
      if (tournament.endsAt !== undefined && start > Date.parse(tournament.endsAt)) {
        add('startsAt', 'Doit être avant la fin du tournoi.', false);
      }
      previousStart = stage.startsAt;
    }
  });

  return issues;
}

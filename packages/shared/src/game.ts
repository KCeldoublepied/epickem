import { z } from 'zod';

// Valeurs des énumérations StatType et StatScope du modèle de données.
export const STAT_TYPES = ['NUMBER', 'BOOLEAN', 'CHOICE', 'TEXT'] as const;
export type StatType = (typeof STAT_TYPES)[number];

export const STAT_TYPE_LABELS: Record<StatType, string> = {
  NUMBER: 'Nombre',
  BOOLEAN: 'Oui ou non',
  CHOICE: 'Choix dans une liste',
  TEXT: 'Texte',
};

export const STAT_SCOPES = ['MATCH_GAME', 'PARTICIPANT'] as const;
export type StatScope = (typeof STAT_SCOPES)[number];

export const STAT_SCOPE_LABELS: Record<StatScope, string> = {
  MATCH_GAME: 'Une valeur par manche',
  PARTICIPANT: 'Une valeur par participant',
};

const NAME_ERROR = 'De 2 à 60 caractères.';
const LABEL_ERROR = 'De 1 à 50 caractères.';
const label = z.string(LABEL_ERROR).trim().min(1, LABEL_ERROR).max(50, LABEL_ERROR);

export const gameStatSchema = z.object({
  label,
  type: z.enum(STAT_TYPES),
  scope: z.enum(STAT_SCOPES).default('PARTICIPANT'),
  /** Valeurs possibles d'une statistique à choix : personnages, cartes… */
  options: z.array(label).max(200, 'Au plus 200 valeurs.').default([]),
});

/** Déclaration d'un jeu et des statistiques relevées à chaque manche. */
export const createGameSchema = z
  .object({
    name: z.string(NAME_ERROR).trim().min(2, NAME_ERROR).max(60, NAME_ERROR),
    stats: z.array(gameStatSchema).max(30, 'Au plus 30 statistiques.').default([]),
  })
  .superRefine(({ stats }, ctx) => {
    stats.forEach((stat, index) => {
      if (stat.type === 'CHOICE' && stat.options.length === 0) {
        ctx.addIssue({
          code: 'custom',
          path: ['stats', index, 'options'],
          message: 'Indiquez au moins une valeur.',
        });
      }
      if (stats.findIndex(({ label: other }) => other === stat.label) !== index) {
        ctx.addIssue({
          code: 'custom',
          path: ['stats', index, 'label'],
          message: 'Cette statistique existe déjà.',
        });
      }
    });
  });
export type CreateGameInput = z.infer<typeof createGameSchema>;
/** Déclaration telle qu'un formulaire la saisit. */
export type CreateGameFormInput = z.input<typeof createGameSchema>;

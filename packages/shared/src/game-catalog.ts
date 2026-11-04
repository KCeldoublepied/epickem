import {
  DUEL_FORMATS,
  STAGE_FORMAT_LABELS,
  STAGE_FORMATS,
  type StageFormat,
  type StageFormInput,
  type StructureIssue,
} from './stages';

/**
 * Catalogue des jeux pris en charge : leurs réglages de tournoi, leurs formats de compétition et
 * leurs compositions d'équipe. Il décrit les champs une seule fois : le dashboard s'en sert pour
 * afficher le formulaire, l'API pour valider `Tournament.gameSettings`. Pour ajouter un jeu :
 * une entrée ici (clé = `Game.slug`), une migration qui l'insère et ses statistiques dans le seed.
 */

export interface GameSettingOption {
  value: string;
  label: string;
}

interface SettingFieldBase {
  key: string;
  label: string;
  hint?: string;
  /** Réglage sans objet sur place (région des serveurs…). */
  onlineOnly?: boolean;
}

export type GameSettingField = SettingFieldBase &
  (
    | { kind: 'select'; options: GameSettingOption[]; default: string }
    | { kind: 'multiselect'; options: GameSettingOption[]; default: string[] }
    | { kind: 'number'; min: number; max: number; default: number; unit?: string }
    | { kind: 'boolean'; default: boolean }
  );

/** Composition d'équipe courante pour un jeu (5v5, duo…), proposée en un clic. */
export interface TeamPreset {
  label: string;
  /** Joueurs par camp ; 1 pour un tournoi en solo. */
  teamSize: number;
}

export interface GameDefinition {
  /** Formats de phase jouables : pas d'arbre en duel pour un battle royale, par exemple. */
  formats: readonly StageFormat[];
  /** La première composition est appliquée au choix du jeu. */
  teamPresets: TeamPreset[];
  fields: GameSettingField[];
}

export type GameSettings = Record<string, string | string[] | number | boolean>;

const options = (labels: Record<string, string>): GameSettingOption[] =>
  Object.entries(labels).map(([value, label]) => ({ value, label }));

/** Options dont la valeur est aussi le libellé (noms de cartes…). */
const names = (...labels: string[]): GameSettingOption[] =>
  labels.map((label) => ({ value: label, label }));

const region = (labels: Record<string, string>, defaultValue: string): GameSettingField => ({
  key: 'region',
  label: 'Région des serveurs',
  kind: 'select',
  onlineOnly: true,
  options: options(labels),
  default: defaultValue,
});

const SMASH_STAGES = names(
  'Battlefield',
  'Small Battlefield',
  'Final Destination',
  'Pokémon Stadium 2',
  'Smashville',
  'Town and City',
  'Hollow Bastion',
  'Kalos Pokémon League',
  'Yoshi’s Story',
  'Lylat Cruise',
  'Northern Cave',
);

const CS2_MAPS = names(
  'Ancient',
  'Anubis',
  'Dust II',
  'Inferno',
  'Mirage',
  'Nuke',
  'Overpass',
  'Train',
  'Vertigo',
);

const ROCKET_LEAGUE_ARENAS = names(
  'DFH Stadium',
  'Mannfield',
  'Champions Field',
  'Urban Central',
  'Beckwith Park',
  'Neo Tokyo',
  'Utopia Coliseum',
  'Aquadome',
  'Wasteland',
  'Forbidden Temple',
);

export const GAME_CATALOG: Record<string, GameDefinition> = {
  'league-of-legends': {
    formats: DUEL_FORMATS,
    teamPresets: [
      { label: '5v5', teamSize: 5 },
      { label: '2v2', teamSize: 2 },
      { label: '1v1', teamSize: 1 },
    ],
    fields: [
      region(
        {
          EUW: 'Europe de l’Ouest (EUW)',
          EUNE: 'Europe du Nord et de l’Est (EUNE)',
          NA: 'Amérique du Nord (NA)',
          KR: 'Corée (KR)',
          BR: 'Brésil (BR)',
          LAN: 'Amérique latine Nord (LAN)',
          LAS: 'Amérique latine Sud (LAS)',
          OCE: 'Océanie (OCE)',
          JP: 'Japon (JP)',
          TR: 'Turquie (TR)',
        },
        'EUW',
      ),
      {
        key: 'map',
        label: 'Carte',
        kind: 'select',
        options: options({
          SUMMONERS_RIFT: 'Faille de l’invocateur',
          HOWLING_ABYSS: 'Abîme hurlant (ARAM)',
        }),
        default: 'SUMMONERS_RIFT',
      },
      {
        key: 'pickType',
        label: 'Type de sélection',
        kind: 'select',
        options: options({
          TOURNAMENT_DRAFT: 'Draft de tournoi',
          FEARLESS_DRAFT: 'Fearless draft',
          DRAFT: 'Mode draft',
          BLIND_PICK: 'Sélection à l’aveugle',
          ALL_RANDOM: 'Aléatoire',
        }),
        default: 'TOURNAMENT_DRAFT',
      },
      {
        key: 'sideSelection',
        label: 'Choix du côté',
        kind: 'select',
        options: options({
          HIGHER_SEED: 'Meilleure tête de série',
          COIN_FLIP: 'Tirage au sort',
          LOSER_PICKS: 'Le perdant de la manche précédente',
        }),
        default: 'HIGHER_SEED',
      },
      {
        key: 'spectators',
        label: 'Spectateurs en jeu',
        kind: 'select',
        options: options({ NONE: 'Aucun', LOBBY: 'Salon uniquement', ALL: 'Tout le monde' }),
        default: 'LOBBY',
      },
    ],
  },

  'counter-strike-2': {
    formats: DUEL_FORMATS,
    teamPresets: [
      { label: '5v5', teamSize: 5 },
      { label: '2v2 (Wingman)', teamSize: 2 },
      { label: '1v1', teamSize: 1 },
    ],
    fields: [
      region(
        {
          EU_WEST: 'Europe de l’Ouest',
          EU_EAST: 'Europe de l’Est',
          NA: 'Amérique du Nord',
          SA: 'Amérique du Sud',
          ASIA: 'Asie',
          OCEANIA: 'Océanie',
        },
        'EU_WEST',
      ),
      {
        key: 'server',
        label: 'Serveurs',
        kind: 'select',
        onlineOnly: true,
        options: options({
          DEDICATED: 'Serveur dédié de l’organisateur',
          THIRD_PARTY: 'Plateforme tierce',
          LOBBY: 'Salon privé',
        }),
        default: 'DEDICATED',
      },
      {
        key: 'mapPool',
        label: 'Cartes en jeu',
        kind: 'multiselect',
        options: CS2_MAPS,
        default: ['Ancient', 'Anubis', 'Dust II', 'Inferno', 'Mirage', 'Nuke', 'Train'],
      },
      {
        key: 'mapSelection',
        label: 'Choix des cartes',
        kind: 'select',
        options: options({
          VETO: 'Veto (bannir et choisir)',
          RANDOM: 'Tirage au sort',
          ORGANIZER: 'Imposé par l’organisateur',
        }),
        default: 'VETO',
      },
      {
        key: 'matchLength',
        label: 'Rounds par mi-temps',
        kind: 'select',
        options: options({ MR12: 'MR12 (premier à 13)', MR15: 'MR15 (premier à 16)' }),
        default: 'MR12',
      },
      { key: 'overtime', label: 'Prolongations', kind: 'boolean', default: true },
      { key: 'knifeRound', label: 'Round au couteau pour le côté', kind: 'boolean', default: true },
    ],
  },

  'super-smash-bros-ultimate': {
    formats: DUEL_FORMATS,
    teamPresets: [
      { label: '1v1', teamSize: 1 },
      { label: '2v2', teamSize: 2 },
    ],
    fields: [
      region(
        {
          EU: 'Europe',
          NA: 'Amérique du Nord',
          SA: 'Amérique du Sud',
          ASIA: 'Asie',
          OCE: 'Océanie',
        },
        'EU',
      ),
      { key: 'stocks', label: 'Vies', kind: 'number', min: 1, max: 99, default: 3 },
      {
        key: 'timeLimit',
        label: 'Temps limite',
        kind: 'number',
        min: 1,
        max: 99,
        default: 7,
        unit: 'minutes',
      },
      {
        key: 'starterStages',
        label: 'Stages de départ',
        hint: 'Stages de la première manche.',
        kind: 'multiselect',
        options: SMASH_STAGES,
        default: [
          'Battlefield',
          'Small Battlefield',
          'Final Destination',
          'Pokémon Stadium 2',
          'Smashville',
        ],
      },
      {
        key: 'counterpickStages',
        label: 'Stages de contre-sélection',
        hint: 'Stages choisis par le perdant pour les manches suivantes.',
        kind: 'multiselect',
        options: SMASH_STAGES,
        default: ['Town and City', 'Hollow Bastion', 'Kalos Pokémon League'],
      },
      {
        key: 'stageBans',
        label: 'Bannissements du vainqueur',
        hint: 'Stages que le vainqueur retire avant la manche suivante.',
        kind: 'number',
        min: 0,
        max: 5,
        default: 3,
      },
      { key: 'items', label: 'Objets activés', kind: 'boolean', default: false },
      { key: 'hazards', label: 'Pièges de stage activés', kind: 'boolean', default: false },
    ],
  },

  'rocket-league': {
    formats: DUEL_FORMATS,
    teamPresets: [
      { label: '3v3', teamSize: 3 },
      { label: '2v2', teamSize: 2 },
      { label: '1v1', teamSize: 1 },
    ],
    fields: [
      region(
        {
          EU: 'Europe',
          USE: 'États-Unis Est',
          USW: 'États-Unis Ouest',
          SAM: 'Amérique du Sud',
          ME: 'Moyen-Orient',
          OCE: 'Océanie',
          ASC: 'Asie du Sud-Est',
          JPN: 'Japon',
        },
        'EU',
      ),
      {
        key: 'arenas',
        label: 'Arènes',
        kind: 'multiselect',
        options: ROCKET_LEAGUE_ARENAS,
        default: ['DFH Stadium', 'Mannfield', 'Champions Field'],
      },
      {
        key: 'matchLength',
        label: 'Durée d’une partie',
        kind: 'number',
        min: 1,
        max: 20,
        default: 5,
        unit: 'minutes',
      },
      {
        key: 'boost',
        label: 'Boost',
        kind: 'select',
        options: options({ DEFAULT: 'Normal', UNLIMITED: 'Illimité', NONE: 'Sans boost' }),
        default: 'DEFAULT',
      },
    ],
  },

  fortnite: {
    formats: ['FREE_FOR_ALL'],
    teamPresets: [
      { label: 'Solo', teamSize: 1 },
      { label: 'Duo', teamSize: 2 },
      { label: 'Trio', teamSize: 3 },
      { label: 'Escouade', teamSize: 4 },
    ],
    fields: [
      region(
        {
          EU: 'Europe',
          NAC: 'Amérique du Nord Centre',
          NAW: 'Amérique du Nord Ouest',
          BR: 'Brésil',
          ASIA: 'Asie',
          ME: 'Moyen-Orient',
          OCE: 'Océanie',
        },
        'EU',
      ),
      {
        key: 'gameMode',
        label: 'Mode de jeu',
        kind: 'select',
        options: options({
          BATTLE_ROYALE: 'Battle Royale',
          ZERO_BUILD: 'Zéro construction',
          RELOAD: 'Reload',
        }),
        default: 'BATTLE_ROYALE',
      },
      {
        key: 'inputRestriction',
        label: 'Périphériques',
        kind: 'select',
        options: options({
          ALL: 'Tous',
          KEYBOARD_MOUSE: 'Clavier et souris',
          CONTROLLER: 'Manette',
        }),
        default: 'ALL',
      },
    ],
  },
};

/** Formats jouables pour un jeu ; tous si le jeu n'est pas au catalogue ou pas encore choisi. */
export function gameFormats(slug: string | undefined): readonly StageFormat[] {
  return (slug && GAME_CATALOG[slug]?.formats) || STAGE_FORMATS;
}

/** Vrai si le réglage s'applique au lieu du tournoi. */
export function isFieldActive(field: GameSettingField, locationType: string): boolean {
  return !(field.onlineOnly && locationType === 'ONSITE');
}

export interface GameSettingsResult {
  settings: GameSettings;
  issues: StructureIssue[];
}

function invalidValue(field: GameSettingField, value: unknown): string | null {
  switch (field.kind) {
    case 'select':
      return field.options.some((option) => option.value === value)
        ? null
        : 'Choisissez une valeur de la liste.';
    case 'multiselect':
      if (!Array.isArray(value) || value.length === 0) return 'Choisissez au moins une valeur.';
      return value.every((item) => field.options.some((option) => option.value === item))
        ? null
        : 'Choisissez des valeurs de la liste.';
    case 'number':
      return Number.isInteger(value) &&
        (value as number) >= field.min &&
        (value as number) <= field.max
        ? null
        : `Nombre entier de ${field.min} à ${field.max}.`;
    case 'boolean':
      return typeof value === 'boolean' ? null : 'Valeur invalide.';
  }
}

/**
 * Réglages complets d'un jeu : les valeurs absentes prennent leur valeur par défaut, les clés
 * inconnues et les réglages sans objet pour ce lieu sont retirés. Pour un jeu hors catalogue,
 * il n'y a aucun réglage.
 */
export function normalizeGameSettings(
  slug: string | undefined,
  raw: Record<string, unknown>,
  locationType: string,
): GameSettingsResult {
  const settings: GameSettings = {};
  const issues: StructureIssue[] = [];
  const fields = (slug && GAME_CATALOG[slug]?.fields) || [];

  for (const field of fields) {
    if (!isFieldActive(field, locationType)) continue;
    const value = raw[field.key] ?? field.default;
    const problem = invalidValue(field, value);
    if (problem) issues.push({ path: ['gameSettings', field.key], message: problem });
    else settings[field.key] = value as GameSettings[string];
  }
  return { settings, issues };
}

/** Phases dont le format n'existe pas pour ce jeu. */
export function gameStructureIssues(
  slug: string | undefined,
  stages: readonly StageFormInput[],
): StructureIssue[] {
  const allowed = gameFormats(slug);
  return stages.flatMap((stage, index) =>
    allowed.includes(stage.format)
      ? []
      : [
          {
            path: ['stages', index, 'format'],
            message: `Ce jeu ne se joue pas en « ${STAGE_FORMAT_LABELS[stage.format]} ».`,
          },
        ],
  );
}

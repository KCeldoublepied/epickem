/**
 * Identité visuelle d'Epickem : couleurs, typographies et formes, communes au web et au mobile.
 *
 * C'est la seule source des valeurs : le web les transforme en variables CSS (`themeCss`),
 * le mobile les lit directement (`themes.dark`, `themes.light`). La charte qui les explique :
 * docs/identite/charte-graphique.md. Les contrastes sont vérifiés par `pnpm test`.
 */

/** Couleurs de marque, avec le nom utilisé dans la charte. */
export const palette = {
  /** Bleu Arène : boutons principaux, éléments interactifs. */
  bleuArene: '#0B6BFF',
  /** Or Trophée : logo, accents, mise en avant (classement, victoire). */
  orTrophee: '#F6C85F',
  /** Nuit : fond sombre, texte sur les badges. */
  nuit: '#0A0F1A',
  /** Givre : fond clair. */
  givre: '#F8FAFC',
} as const;

export type ThemeName = 'dark' | 'light';

/** Couleurs « à rôle » : un composant utilise toujours un rôle, jamais une valeur brute. */
export interface ThemeColors {
  /** Fond de page. */
  background: string;
  /** Cartes, panneaux. */
  surface: string;
  /** Éléments posés sur une carte (menu, survol de ligne). */
  surfaceRaised: string;
  /** Bordure des champs de formulaire et des contrôles (3:1 minimum). */
  border: string;
  /** Séparateurs décoratifs (pas d'exigence de contraste). */
  divider: string;
  /** Texte principal. */
  text: string;
  /** Texte secondaire : descriptions, métadonnées, placeholders. */
  textMuted: string;
  /** Liens et texte interactif. */
  link: string;
  /** Texte d'accent (doré) : rang, victoire, mise en avant. */
  accent: string;
  /** Anneau de focus clavier. */
  focus: string;
  /** Fond du bouton principal. */
  primary: string;
  /** Fond du bouton principal au survol. */
  primaryHover: string;
  /** Texte sur le bouton principal. */
  onPrimary: string;
  /** Texte d'état « succès » (pronostic juste, match gagné). */
  success: string;
  /** Texte d'état « erreur » (pronostic faux, échec). */
  error: string;
  /** Texte d'état « en direct ». */
  live: string;
  /** Fonds pleins des badges ; leur texte est toujours `onBadge`. */
  badgeSuccess: string;
  badgeError: string;
  badgeLive: string;
  badgeAccent: string;
  /** Texte sur les badges. */
  onBadge: string;
}

const badges = {
  badgeSuccess: '#22C55E',
  badgeError: '#EF4444',
  badgeLive: '#F59E0B',
  badgeAccent: palette.orTrophee,
  onBadge: palette.nuit,
} as const;

const primary = {
  primary: palette.bleuArene,
  primaryHover: '#0A5FE0',
  onPrimary: '#FFFFFF',
} as const;

/** Thèmes sombre (par défaut) et clair. */
export const themes: Record<ThemeName, ThemeColors> = {
  dark: {
    background: palette.nuit,
    surface: '#131B2E',
    surfaceRaised: '#1C2640',
    border: '#64748B',
    divider: '#24304A',
    text: '#E4E7EB',
    textMuted: '#94A3B8',
    link: '#5B97FF',
    accent: palette.orTrophee,
    focus: '#5B97FF',
    ...primary,
    success: '#22C55E',
    // #EF4444 (la couleur du badge) ne fait que 4:1 sur les cartes : le texte prend une teinte plus claire.
    error: '#F87171',
    live: '#F59E0B',
    ...badges,
  },
  light: {
    background: palette.givre,
    surface: '#FFFFFF',
    surfaceRaised: '#FFFFFF',
    border: '#64748B',
    divider: '#E2E8F0',
    text: '#0F172A',
    textMuted: '#475569',
    link: '#0756D1',
    accent: '#8A6200',
    focus: '#0756D1',
    ...primary,
    success: '#15803D',
    error: '#DC2626',
    live: '#B45309',
    ...badges,
  },
};

/** Polices : Cinzel pour les titres, Inter pour tout le reste (scores compris). */
export const fonts = {
  /** Titres H1-H2, noms de tournoi en vitrine. Capitales uniquement : jamais pour du texte courant. */
  display: "'Cinzel', Georgia, 'Times New Roman', serif",
  /** Interface, texte courant, données, scores (chiffres tabulaires). */
  body: "'Inter', system-ui, -apple-system, 'Segoe UI', Roboto, sans-serif",
} as const;

/** Échelle typographique en rem (1 rem = 16 px par défaut). */
export const fontSizes = {
  xs: 0.75,
  sm: 0.875,
  base: 1,
  lg: 1.125,
  xl: 1.25,
  '2xl': 1.5,
  '3xl': 1.875,
  '4xl': 2.25,
} as const;

/** Rayons des coins, en px. */
export const radii = { sm: 6, md: 8, lg: 12, full: 9999 } as const;

/** Espacements, en px (grille de 4). */
export const spacing = { 1: 4, 2: 8, 3: 12, 4: 16, 6: 24, 8: 32, 12: 48 } as const;

// ---------------------------------------------------------------------------------------
// Contrastes (WCAG 2.2)
// ---------------------------------------------------------------------------------------

function channel(value: number): number {
  const c = value / 255;
  return c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
}

/** Luminance relative d'une couleur `#RRGGBB`. */
export function relativeLuminance(hex: string): number {
  const match = /^#([0-9a-f]{2})([0-9a-f]{2})([0-9a-f]{2})$/i.exec(hex);
  if (!match) throw new TypeError(`Couleur invalide : ${hex} (format attendu : #RRGGBB)`);
  const [r, g, b] = match.slice(1).map((part) => channel(parseInt(part, 16))) as [
    number,
    number,
    number,
  ];
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

/** Rapport de contraste entre deux couleurs, de 1 (identiques) à 21 (noir sur blanc). */
export function contrastRatio(a: string, b: string): number {
  const [light, dark] = [relativeLuminance(a), relativeLuminance(b)].sort((x, y) => y - x) as [
    number,
    number,
  ];
  return (light + 0.05) / (dark + 0.05);
}

/** Seuils AA : 4,5:1 pour le texte, 3:1 pour les contrôles et le texte ≥ 24 px. */
export const WCAG_AA = { text: 4.5, ui: 3 } as const;

export interface ContrastRule {
  foreground: keyof ThemeColors;
  background: keyof ThemeColors;
  min: number;
}

const textRoles = ['text', 'textMuted', 'link', 'accent', 'success', 'error', 'live'] as const;
const surfaces = ['background', 'surface', 'surfaceRaised'] as const;

/** Toutes les combinaisons que les composants ont le droit d'utiliser, avec leur seuil. */
export const contrastRules: readonly ContrastRule[] = [
  ...textRoles.flatMap((foreground) =>
    surfaces.map((background) => ({ foreground, background, min: WCAG_AA.text })),
  ),
  ...surfaces.flatMap((background) => [
    { foreground: 'border' as const, background, min: WCAG_AA.ui },
    { foreground: 'focus' as const, background, min: WCAG_AA.ui },
    { foreground: 'primary' as const, background, min: WCAG_AA.ui },
  ]),
  { foreground: 'onPrimary', background: 'primary', min: WCAG_AA.text },
  { foreground: 'onPrimary', background: 'primaryHover', min: WCAG_AA.text },
  ...(['badgeSuccess', 'badgeError', 'badgeLive', 'badgeAccent'] as const).map((background) => ({
    foreground: 'onBadge' as const,
    background,
    min: WCAG_AA.text,
  })),
];

// ---------------------------------------------------------------------------------------
// Web : variables CSS
// ---------------------------------------------------------------------------------------

/** Identifiant du dégradé doré, déclaré une fois dans la page par le composant Logo. */
export const LOGO_GRADIENT_ID = 'epk-logo-or';

/** `surfaceRaised` → `--epk-surface-raised`. */
export function cssVariableName(role: keyof ThemeColors): string {
  return `--epk-${role.replace(/[A-Z]/g, (letter) => `-${letter.toLowerCase()}`)}`;
}

function declarations(colors: ThemeColors): string {
  return (Object.keys(colors) as (keyof ThemeColors)[])
    .map((role) => `${cssVariableName(role)}:${colors[role]};`)
    .join('');
}

/**
 * Feuille de style des thèmes : sombre par défaut, clair si le système le demande,
 * et forçage possible avec `data-theme="light"` ou `data-theme="dark"` sur `<html>`.
 */
export function themeCss(): string {
  // --epk-logo : remplissage du logo, doré sur fond sombre, couleur du texte sur fond clair.
  const dark = `${declarations(themes.dark)}--epk-logo:url(#${LOGO_GRADIENT_ID});`;
  const light = `${declarations(themes.light)}--epk-logo:${themes.light.text};`;
  return [
    `:root{color-scheme:dark;${dark}}`,
    `@media (prefers-color-scheme: light){:root:not([data-theme="dark"]){color-scheme:light;${light}}}`,
    `:root[data-theme="light"]{color-scheme:light;${light}}`,
    `:root[data-theme="dark"]{color-scheme:dark;${dark}}`,
  ].join('\n');
}

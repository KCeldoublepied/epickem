/**
 * Placement des têtes de série dans un arbre à élimination, et répartition des exempts.
 *
 * Placement standard (celui des tournois de tennis, de start.gg ou de Challonge) : au premier
 * tour, la tête de série s affronte la n° (taille + 1 - s), donc la 1 joue la dernière, la 2
 * l'avant-dernière… Et les meilleures ne peuvent se croiser que le plus tard possible : la 1 et
 * la 2 seulement en finale, les 4 premières seulement en demi-finales, etc.
 */

import type { Entrant } from './types';

/**
 * Taille de l'arbre d'élimination : plus petite puissance de 2
 * supérieure ou égale au nombre de participants.
 */
export function bracketSize(participants: number): number {
  if (!Number.isInteger(participants) || participants < 2) {
    throw new RangeError('Un arbre nécessite au moins 2 participants.');
  }
  return 2 ** Math.ceil(Math.log2(participants));
}

/** Nombre d'exempts (byes) au premier tour d'un arbre d'élimination. */
export function byeCount(participants: number): number {
  return bracketSize(participants) - participants;
}

/**
 * Numéros de tête de série, place par place, de haut en bas de l'arbre. Les places 1 et 2
 * forment le premier match, 3 et 4 le deuxième, etc.
 *
 * Construction en doublant l'arbre : on part de [1] ; à chaque étape, chaque tête de série s
 * est remplacée par la paire (s, nouvelle taille + 1 - s), qui sera un match du premier tour.
 *
 *   taille 1 : 1
 *   taille 2 : 1 2
 *   taille 4 : 1 4 | 2 3
 *   taille 8 : 1 8 | 4 5 | 2 7 | 3 6
 *
 * Chaque paire reprend la place de la tête de série dont elle est issue : la 1 et la 2, séparées
 * dès la taille 2, restent dans des moitiés opposées ; les 4 premières, dans des quarts
 * différents ; et ainsi de suite.
 */
export function seedPositions(size: number): number[] {
  if (!Number.isInteger(size) || size < 2 || !Number.isInteger(Math.log2(size))) {
    throw new RangeError(`La taille d'un arbre est une puissance de 2 d'au moins 2 : ${size}.`);
  }
  let positions = [1];
  for (let current = 2; current <= size; current *= 2) {
    positions = positions.flatMap((seed) => [seed, current + 1 - seed]);
  }
  return positions;
}

/**
 * Place les participants, déjà rangés par tête de série (voir `orderEntrants`), dans l'arbre.
 * Renvoie une place par emplacement du premier tour ; null marque un exempt.
 *
 * Les exempts prennent les numéros au-delà du nombre de participants : ce sont donc les
 * adversaires des meilleures têtes de série, qui passent directement au deuxième tour. Comme
 * il y a toujours moins d'exempts que de matchs au premier tour, deux exempts ne se
 * rencontrent jamais.
 */
export function placeEntrants(ordered: readonly Entrant[]): (Entrant | null)[] {
  return seedPositions(bracketSize(ordered.length)).map((seed) => ordered[seed - 1] ?? null);
}

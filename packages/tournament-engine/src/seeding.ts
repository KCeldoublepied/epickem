/**
 * Ordre des têtes de série d'une phase : le premier de la liste est la tête de série n° 1.
 * Le placement dans l'arbre (1 contre 8, 4 contre 5…) se fait ensuite, à partir de cet ordre.
 */

import type { Seeding } from '@epickem/shared';

import type { Entrant } from './types';

/**
 * Modes gérés par le moteur pour l'instant. Le classement de la phase précédente et le
 * placement croisé entre poules arriveront avec les qualifications entre phases (#31).
 */
export type SeedingMode = Extract<Seeding, 'MANUAL' | 'RANDOM'>;

/** Générateur de nombres dans [0, 1), comme `Math.random`. */
export type RandomSource = () => number;

/**
 * Générateur pseudo-aléatoire à graine : la même graine redonne toujours la même suite de
 * nombres, ce que `Math.random` ne permet pas. Sert aux tests et au simulateur, pour rejouer un
 * tirage au sort ; en production, `Math.random` suffit.
 *
 * Algorithme : mulberry32 (Tommy Ettinger, domaine public), un générateur 32 bits court et
 * rapide, largement utilisé en JavaScript. Il n'est pas cryptographique, ce qui n'est pas le
 * besoin ici. Référence : https://gist.github.com/tommyettinger/46a874533244883189143505d203312c
 *
 * Clefs de lecture :
 * - JavaScript calcule en flottants ; `x >>> 0` ramène un nombre à un entier non signé de
 *   32 bits, et `Math.imul(a, b)` multiplie deux entiers 32 bits sans perte de précision.
 * - Chaque appel avance l'état d'une constante fixe (0x6d2b79f5, impaire, donc l'état parcourt
 *   les 2^32 valeurs avant de revenir au départ).
 * - Les décalages (`>>>`), ou exclusifs (`^`) et multiplications mélangent ensuite les bits de
 *   l'état, pour que deux états voisins donnent des nombres sans rapport apparent.
 * - Le résultat, un entier de 0 à 2^32 - 1, est divisé par 2^32 pour tomber dans [0, 1).
 */
export function seededRandom(seed: number): RandomSource {
  let state = seed >>> 0;
  return () => {
    state = (state + 0x6d2b79f5) >>> 0;
    let t = state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 2 ** 32;
  };
}

/**
 * Mélange de Fisher-Yates, sur une copie : de la fin vers le début, chaque élément est échangé
 * avec un élément tiré au hasard parmi ceux qui le précèdent ou lui-même. Chaque ordre possible
 * a la même probabilité.
 */
function shuffle<T>(items: readonly T[], random: RandomSource): T[] {
  const result = [...items];
  for (let i = result.length - 1; i > 0; i--) {
    const j = Math.floor(random() * (i + 1));
    [result[i], result[j]] = [result[j]!, result[i]!];
  }
  return result;
}

function checkEntrants(entrants: readonly Entrant[]): void {
  const ids = new Set<string>();
  const seeds = new Set<number>();
  for (const { id, seed } of entrants) {
    if (ids.has(id)) throw new RangeError(`Participant en double : ${id}.`);
    ids.add(id);
    if (seed === null) continue;
    if (!Number.isInteger(seed) || seed < 1) {
      throw new RangeError(`Tête de série invalide pour ${id} : ${seed}.`);
    }
    if (seeds.has(seed)) throw new RangeError(`Tête de série n° ${seed} attribuée deux fois.`);
    seeds.add(seed);
  }
}

/**
 * Range les participants du premier au dernier tête de série.
 *
 * - `MANUAL` : par tête de série croissante ; les participants sans tête de série suivent,
 *   dans l'ordre reçu (l'ordre d'inscription, côté API).
 * - `RANDOM` : tirage au sort, sans tenir compte des têtes de série.
 */
export function orderEntrants(
  entrants: readonly Entrant[],
  mode: SeedingMode,
  random: RandomSource = Math.random,
): Entrant[] {
  checkEntrants(entrants);

  if (mode === 'RANDOM') return shuffle(entrants, random);

  // Tri stable : à tête de série absente égale, l'ordre reçu est conservé.
  return [...entrants].sort(
    (a, b) => (a.seed ?? Number.POSITIVE_INFINITY) - (b.seed ?? Number.POSITIVE_INFINITY),
  );
}

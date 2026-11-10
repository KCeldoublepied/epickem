/**
 * Génération d'un arbre à élimination simple : tous les matchs de la phase, du premier tour à
 * la finale, reliés entre eux. Seul le premier tour connaît ses participants ; les tours
 * suivants se remplissent au fil des résultats (et dès la génération face à un exempt).
 */

import { placeEntrants } from './placement';
import { orderEntrants, type RandomSource } from './seeding';
import type {
  BracketMatch,
  BracketSlot,
  Entrant,
  MatchRef,
  SingleEliminationSettings,
  SingleEliminationState,
} from './types';

/**
 * Nombre de manches (BO) des matchs d'un tour, désigné par son nombre de matchs : 1 pour la
 * finale, 2 pour les demi-finales, 16 pour les 16es de finale… Le format propre au tour s'il
 * y en a un, sinon celui de la phase (BO5 par défaut).
 */
export function bestOfForRound(
  settings: Pick<SingleEliminationSettings, 'bestOf' | 'roundBestOf'>,
  matchCount: number,
): number {
  return settings.roundBestOf[String(matchCount)] ?? settings.bestOf;
}

function findMatch(matches: readonly BracketMatch[], { round, position }: MatchRef): BracketMatch {
  const match = matches.find((m) => m.round === round && m.position === position);
  if (!match) throw new RangeError(`Match introuvable : tour ${round}, position ${position}.`);
  return match;
}

/** Inscrit le vainqueur d'un match et le place dans le match suivant. */
function declareWinner(
  matches: readonly BracketMatch[],
  match: BracketMatch,
  winnerId: string,
): void {
  match.winnerId = winnerId;
  if (match.winnerNext) {
    const { slots } = findMatch(matches, match.winnerNext);
    slots[match.winnerNext.slot === 1 ? 0 : 1].entrantId = winnerId;
  }
}

const emptySlot = (): BracketSlot => ({ entrantId: null, isBye: false });
const slotOf = (entrant: Entrant | null): BracketSlot =>
  entrant ? { entrantId: entrant.id, isBye: false } : { entrantId: null, isBye: true };

/**
 * Génère l'arbre d'une phase à élimination simple, quel que soit le nombre de participants.
 *
 * - Les participants sont rangés selon `settings.seeding`, puis placés selon le placement
 *   standard (voir `placeEntrants`).
 * - Le match p du tour r envoie son vainqueur au match ⌈p / 2⌉ du tour r + 1 : en place 1 si p
 *   est impair, en place 2 sinon.
 * - Face à un exempt, le participant est déclaré vainqueur d'office et placé au tour 2 : aucun
 *   score n'est à saisir pour ce match.
 * - Avec `thirdPlaceMatch` et au moins 4 participants, la petite finale se joue au tour de la
 *   finale, en position 2, entre les perdants des demi-finales.
 *
 * `random` ne sert qu'au tirage au sort (`seeding: 'RANDOM'`).
 */
export function generateSingleElimination(
  entrants: readonly Entrant[],
  settings: SingleEliminationSettings,
  random: RandomSource = Math.random,
): SingleEliminationState {
  if (settings.qualifiers !== undefined) {
    throw new RangeError(
      'Une phase à élimination simple avec des qualifiés pour la phase suivante ' +
        "n'est pas encore gérée (#31).",
    );
  }
  const { seeding } = settings;
  if (seeding !== 'MANUAL' && seeding !== 'RANDOM') {
    throw new RangeError(`Le placement « ${seeding} » n'est pas encore géré (#31).`);
  }

  const places = placeEntrants(orderEntrants(entrants, seeding, random));
  const size = places.length;
  const rounds = Math.log2(size);

  // Tous les matchs, vides, reliés au match où va leur vainqueur.
  const matches: BracketMatch[] = [];
  for (let round = 1; round <= rounds; round++) {
    const matchCount = size / 2 ** round;
    for (let position = 1; position <= matchCount; position++) {
      matches.push({
        round,
        position,
        bestOf: bestOfForRound(settings, matchCount),
        slots: [emptySlot(), emptySlot()],
        winnerId: null,
        winnerNext:
          round < rounds
            ? { round: round + 1, position: Math.ceil(position / 2), slot: position % 2 ? 1 : 2 }
            : null,
        loserNext: null,
      });
    }
  }

  // Premier tour : les places 1 et 2 forment le match 1, 3 et 4 le match 2, etc.
  for (let position = 1; position <= size / 2; position++) {
    const match = findMatch(matches, { round: 1, position });
    const a = places[2 * position - 2] ?? null;
    const b = places[2 * position - 1] ?? null;
    match.slots = [slotOf(a), slotOf(b)];
    // placeEntrants garantit qu'au moins un des deux est un participant.
    const qualified = a === null ? b : b === null ? a : null;
    if (qualified) declareWinner(matches, match, qualified.id);
  }

  if (settings.thirdPlaceMatch && entrants.length >= 4) {
    matches.push({
      round: rounds,
      position: 2,
      bestOf: settings.bestOf,
      slots: [emptySlot(), emptySlot()],
      winnerId: null,
      winnerNext: null,
      loserNext: null,
    });
    for (const position of [1, 2] as const) {
      findMatch(matches, { round: rounds - 1, position }).loserNext = {
        round: rounds,
        position: 2,
        slot: position,
      };
    }
  }

  return { size, rounds, matches };
}

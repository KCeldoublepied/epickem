/**
 * Types du moteur de tournois : des données simples et sérialisables, que l'API charge depuis
 * la base, passe au moteur, puis persiste (ADR-0008). Aucun identifiant de match ici : les
 * matchs se désignent par leur tour et leur position, et l'API les traduit en `Match.id`.
 */

import type { StageInput } from '@epickem/shared';

/** Réglages d'une phase à élimination simple, tels que validés par `stageInputSchema`. */
export type SingleEliminationSettings = Extract<
  StageInput,
  { format: 'SINGLE_ELIMINATION' }
>['settings'];

/**
 * Engagé d'une phase, réduit à ce dont le moteur a besoin.
 * L'API le construit à partir d'un `Participant` en base.
 */
export interface Entrant {
  id: string;
  /** Tête de série choisie par l'organisateur (1 = la meilleure) ; null si aucune. */
  seed: number | null;
}

/** Un match d'une phase, désigné par son tour et sa position (`Match.round`, `Match.position`). */
export interface MatchRef {
  /** Tour, à partir de 1. */
  round: number;
  /** Position dans le tour, à partir de 1. */
  position: number;
}

/** Une place précise dans un match : où envoyer un vainqueur ou un perdant. */
export interface SlotRef extends MatchRef {
  slot: 1 | 2;
}

/** Une place d'un match en duel (`MatchParticipant`). */
export interface BracketSlot {
  /** Vide tant que le qualifié du tour précédent n'est pas connu, et pour un exempt. */
  entrantId: string | null;
  /** Place laissée vide au premier tour, faute de participant : l'adversaire passe d'office. */
  isBye: boolean;
}

/**
 * Match d'un arbre à élimination. La petite finale, quand il y en a une, se joue au tour de la
 * finale, en position 2.
 */
export interface BracketMatch extends MatchRef {
  bestOf: number;
  slots: [BracketSlot, BracketSlot];
  /** Vainqueur connu : qualifié d'office face à un exempt, ou résultat saisi. */
  winnerId: string | null;
  /** Place où va le vainqueur ; null pour la finale et la petite finale. */
  winnerNext: SlotRef | null;
  /** Place où va le perdant (demi-finales vers la petite finale) ; null sinon. */
  loserNext: SlotRef | null;
}

/** État complet d'une phase à élimination simple. */
export interface SingleEliminationState {
  /** Taille de l'arbre : puissance de 2 supérieure ou égale au nombre de participants. */
  size: number;
  /** Nombre de tours de l'arbre principal (finale comprise). */
  rounds: number;
  /** Matchs triés par tour puis par position. */
  matches: BracketMatch[];
}

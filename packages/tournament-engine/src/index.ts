/**
 * @epickem/tournament-engine — logique pure des formats de tournoi.
 *
 * Aucune dépendance au framework ni à la base de données : chaque format
 * (élimination simple/double, poules, suisse, FFA) sera une stratégie testable
 * isolément. Voir docs/adr/0008-moteur-de-tournois-strategy.md.
 */

import { eliminationRoundName, type StageInput } from '@epickem/shared';

import { bracketSize, byeCount } from './placement';
import { bestOfForRound } from './single-elimination';

export * from './placement';
export * from './seeding';
export * from './single-elimination';
export type * from './types';

/** Une étape d'une phase : un tour d'arbre, un groupe de poules, l'ensemble des rondes… */
export interface PreviewStep {
  label: string;
  /** Matchs (ou parties en FFA) de l'étape. */
  matches: number;
  bestOf?: number;
  detail?: string;
}

export interface StagePreview {
  steps: PreviewStep[];
  minMatches: number;
  /** Plus grand que minMatches quand le déroulement en décide (grande finale rejouée…). */
  maxMatches: number;
}

const plural = (count: number, word: string) => `${count} ${word}${count > 1 ? 's' : ''}`;

function eliminationRounds(
  entrants: number,
  qualifiers: number,
  /** Format d'un tour, selon son nombre de matchs dans l'arbre complet. */
  bestOfFor: (matchCount: number) => number,
): PreviewStep[] {
  const steps: PreviewStep[] = [];
  const byes = byeCount(entrants);
  let remaining = entrants;
  let slots = bracketSize(entrants) / 2;

  for (let round = 1; remaining > qualifiers; round++, slots /= 2) {
    // Au premier tour, les exempts ne jouent pas ; le dernier tour s'arrête aux qualifiés.
    const matches = Math.min(remaining - slots, remaining - qualifiers);
    steps.push({
      label: eliminationRoundName(slots),
      matches,
      bestOf: bestOfFor(slots),
      ...(round === 1 && byes > 0 && { detail: plural(byes, 'exempt') }),
    });
    remaining -= matches;
  }
  return steps;
}

function roundRobinGroups(entrants: number, groupCount: number, legs: number): PreviewStep[] {
  const smallest = Math.floor(entrants / groupCount);
  const larger = entrants % groupCount;
  return [
    { size: smallest + 1, count: larger },
    { size: smallest, count: groupCount - larger },
  ]
    .filter(({ size, count }) => count > 0 && size >= 2)
    .map(({ size, count }) => ({
      label: `${plural(count, 'poule')} de ${size}`,
      matches: (count * legs * size * (size - 1)) / 2,
      detail: plural((size % 2 === 0 ? size - 1 : size) * legs, 'tour'),
    }));
}

/**
 * Déroulement prévu d'une phase, sans joueurs ni tirage, à partir de ses réglages validés.
 * `qualifiers` vaut 1 pour une phase jouée jusqu'au vainqueur. Renvoie null si les nombres de
 * participants ne permettent pas de jouer la phase.
 */
export function stagePreview(
  stage: StageInput,
  entrants: number,
  qualifiers = 1,
): StagePreview | null {
  if (!Number.isInteger(entrants) || entrants < 2 || qualifiers >= entrants) return null;

  const fixed = (steps: PreviewStep[]): StagePreview => {
    const total = steps.reduce((sum, step) => sum + step.matches, 0);
    return { steps, minMatches: total, maxMatches: total };
  };

  switch (stage.format) {
    case 'SINGLE_ELIMINATION': {
      const { settings } = stage;
      const steps = eliminationRounds(entrants, qualifiers, (matchCount) =>
        bestOfForRound(settings, matchCount),
      );
      if (settings.thirdPlaceMatch && qualifiers === 1 && entrants >= 4) {
        steps.push({ label: 'Petite finale', matches: 1, bestOf: settings.bestOf });
      }
      return fixed(steps);
    }

    case 'DOUBLE_ELIMINATION': {
      const { bestOf, finalBestOf, grandFinalReset } = stage.settings;
      // Chaque éliminé perd deux fois, et chaque match fait un seul perdant.
      const minMatches = 2 * (entrants - qualifiers);
      if (qualifiers > 1) {
        return {
          steps: [{ label: 'Tableaux gagnant et perdant', matches: minMatches, bestOf }],
          minMatches,
          maxMatches: minMatches + qualifiers,
        };
      }
      const steps: PreviewStep[] = [{ label: 'Tableau gagnant', matches: entrants - 1, bestOf }];
      if (entrants > 2) steps.push({ label: 'Tableau perdant', matches: entrants - 2, bestOf });
      steps.push({
        label: 'Grande finale',
        matches: 1,
        bestOf: finalBestOf ?? bestOf,
        ...(grandFinalReset && { detail: '1 de plus si remise à zéro' }),
      });
      return { steps, minMatches, maxMatches: minMatches + (grandFinalReset ? 1 : 0) };
    }

    case 'ROUND_ROBIN': {
      const { bestOf, groupCount, legs } = stage.settings;
      return fixed(
        roundRobinGroups(entrants, groupCount, legs).map((step) => ({ ...step, bestOf })),
      );
    }

    case 'SWISS': {
      const { bestOf, rounds } = stage.settings;
      const perRound = Math.floor(entrants / 2);
      return fixed([
        {
          label: plural(rounds, 'ronde'),
          matches: rounds * perRound,
          bestOf,
          detail:
            `${plural(perRound, 'match')} par ronde` +
            (entrants % 2 === 1 ? ', 1 exempt par ronde' : ''),
        },
      ]);
    }

    case 'FREE_FOR_ALL': {
      const { lobbySize, rounds } = stage.settings;
      const lobbies = Math.ceil(entrants / lobbySize);
      return fixed([
        {
          label: lobbies > 1 ? `${lobbies} lobbies` : '1 lobby',
          matches: lobbies * rounds,
          detail: `${plural(rounds, 'partie')} par lobby`,
        },
      ]);
    }
  }
}

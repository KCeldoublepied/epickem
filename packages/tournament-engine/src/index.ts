/**
 * @epickem/tournament-engine — logique pure des formats de tournoi.
 *
 * Aucune dépendance au framework ni à la base de données : chaque format
 * (élimination simple/double, poules, suisse, FFA) sera une stratégie testable
 * isolément. Voir docs/adr/0008-moteur-de-tournois-strategy.md.
 */

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

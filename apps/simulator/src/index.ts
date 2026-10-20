import { APP_NAME } from '@epickem/shared';
import { bracketSize, byeCount } from '@epickem/tournament-engine';

/**
 * Point d'entrée du simulateur. Pour l'instant, il vérifie seulement que les
 * packages partagés sont accessibles. Les modes `seed`, `play` et `crowd`
 * arriveront avec #52 (voir docs/adr/0015-simulateur-et-tests-de-charge.md).
 */
const participants = 13;

console.log(`[${APP_NAME}] simulateur prêt`);
console.log(
  `Exemple : ${participants} participants → arbre de ${bracketSize(participants)}, ${byeCount(participants)} exempts`,
);

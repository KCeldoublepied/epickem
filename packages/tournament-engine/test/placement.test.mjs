// Placement des têtes de série dans l'arbre et répartition des exempts.
import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { byeCount, placeEntrants, seedPositions } from '../dist/index.js';

/** Participants déjà rangés : p1 est la tête de série n° 1. */
const ordered = (count) =>
  Array.from({ length: count }, (_, i) => ({ id: `p${i + 1}`, seed: i + 1 }));
/** Découpe une liste de places en matchs du premier tour. */
const pairs = (list) => list.flatMap((_, i) => (i % 2 === 0 ? [list.slice(i, i + 2)] : []));
/** Indice du bloc (moitié, quart…) de `block` places qui contient la tête de série. */
const blockOf = (positions, seed, block) => Math.floor(positions.indexOf(seed) / block);

/** Tailles d'arbre testées : toutes les puissances de 2, de 2 à 1024. */
const sizes = [];
for (let size = 2; size <= 1024; size *= 2) sizes.push(size);

describe('seedPositions', () => {
  it('suit le placement standard', () => {
    assert.deepEqual(seedPositions(2), [1, 2]);
    assert.deepEqual(seedPositions(4), [1, 4, 2, 3]);
    assert.deepEqual(seedPositions(8), [1, 8, 4, 5, 2, 7, 3, 6]);
    assert.deepEqual(seedPositions(16), [1, 16, 8, 9, 4, 13, 5, 12, 2, 15, 7, 10, 3, 14, 6, 11]);
  });

  for (const size of sizes) {
    it(`place chaque tête de série une fois, face à la n° taille + 1 - s (taille ${size})`, () => {
      const positions = seedPositions(size);
      assert.deepEqual(
        [...positions].sort((a, b) => a - b),
        Array.from({ length: size }, (_, i) => i + 1),
      );
      for (const [a, b] of pairs(positions)) assert.equal(a + b, size + 1);
    });

    it(`sépare les meilleures têtes de série le plus longtemps possible (taille ${size})`, () => {
      const positions = seedPositions(size);
      // Les k meilleures (k = 2, 4, 8…) sont chacune dans un bloc différent de taille / k places.
      for (let k = 2; k <= size; k *= 2) {
        const blocks = Array.from({ length: k }, (_, i) => blockOf(positions, i + 1, size / k));
        assert.equal(new Set(blocks).size, k, `les ${k} premières se croisent trop tôt`);
      }
    });
  }

  it("refuse une taille qui n'est pas une puissance de 2", () => {
    for (const size of [0, 1, 3, 6, 12.5]) assert.throws(() => seedPositions(size), RangeError);
  });
});

describe('placeEntrants', () => {
  it('place 6 participants dans un arbre de 8, avec 2 exempts pour les 2 premiers', () => {
    const places = placeEntrants(ordered(6)).map((entrant) => entrant?.id ?? null);
    assert.deepEqual(places, ['p1', null, 'p4', 'p5', 'p2', null, 'p3', 'p6']);
  });

  // De 2 à 64 participants (critère de l'issue #16), puis autour de 128.
  const counts = [...Array.from({ length: 63 }, (_, i) => i + 2), 127, 128, 129, 200];
  for (const count of counts) {
    it(`répartit ${count} participants`, () => {
      const places = placeEntrants(ordered(count));
      const byes = byeCount(count);

      // Chacun une fois, et le bon nombre d'exempts.
      const ids = places.filter(Boolean).map((entrant) => entrant.id);
      assert.equal(new Set(ids).size, count);
      assert.equal(places.filter((place) => place === null).length, byes);

      for (const [a, b] of pairs(places)) {
        // Jamais deux exempts dans un match.
        assert.ok(a !== null || b !== null, 'match entre deux exempts');
        // Un exempt fait passer une des meilleures têtes de série.
        if (a === null || b === null) {
          const opponent = a ?? b;
          assert.ok(opponent.seed <= byes, `${opponent.id} exempté`);
        }
      }
    });
  }
});

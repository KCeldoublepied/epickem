// Ordre des têtes de série : choix de l'organisateur ou tirage au sort reproductible.
import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { orderEntrants, seededRandom } from '../dist/index.js';

const entrants = (...seeds) => seeds.map((seed, i) => ({ id: `p${i + 1}`, seed }));
const ids = (list) => list.map((entrant) => entrant.id);

describe('orderEntrants', () => {
  describe('MANUAL', () => {
    it('range par tête de série croissante', () => {
      assert.deepEqual(ids(orderEntrants(entrants(3, 1, 4, 2), 'MANUAL')), [
        'p2',
        'p4',
        'p1',
        'p3',
      ]);
    });

    it("place les participants sans tête de série à la fin, dans l'ordre reçu", () => {
      const list = entrants(null, 2, null, 1, null);
      assert.deepEqual(ids(orderEntrants(list, 'MANUAL')), ['p4', 'p2', 'p1', 'p3', 'p5']);
    });

    it('accepte des têtes de série non consécutives', () => {
      assert.deepEqual(ids(orderEntrants(entrants(10, 5), 'MANUAL')), ['p2', 'p1']);
    });

    it('ne modifie pas la liste reçue', () => {
      const list = entrants(2, 1);
      orderEntrants(list, 'MANUAL');
      assert.deepEqual(ids(list), ['p1', 'p2']);
    });
  });

  describe('RANDOM', () => {
    const list = entrants(...Array.from({ length: 16 }, () => null));

    it('garde chaque participant exactement une fois', () => {
      const order = ids(orderEntrants(list, 'RANDOM', seededRandom(1)));
      assert.deepEqual([...order].sort(), [...ids(list)].sort());
    });

    it('redonne le même tirage avec la même graine', () => {
      assert.deepEqual(
        ids(orderEntrants(list, 'RANDOM', seededRandom(42))),
        ids(orderEntrants(list, 'RANDOM', seededRandom(42))),
      );
    });

    it('change de tirage avec une autre graine', () => {
      assert.notDeepEqual(
        ids(orderEntrants(list, 'RANDOM', seededRandom(1))),
        ids(orderEntrants(list, 'RANDOM', seededRandom(2))),
      );
    });

    it('ignore les têtes de série', () => {
      const seeded = entrants(...Array.from({ length: 16 }, (_, i) => i + 1));
      assert.notDeepEqual(ids(orderEntrants(seeded, 'RANDOM', seededRandom(7))), ids(seeded));
    });
  });

  describe('seededRandom', () => {
    it('donne des nombres dans [0, 1)', () => {
      const random = seededRandom(123);
      for (let i = 0; i < 1000; i++) {
        const value = random();
        assert.ok(value >= 0 && value < 1, `${value} hors de [0, 1)`);
      }
    });
  });

  describe('validation', () => {
    it('refuse un participant en double', () => {
      assert.throws(
        () =>
          orderEntrants(
            [
              { id: 'a', seed: null },
              { id: 'a', seed: null },
            ],
            'MANUAL',
          ),
        RangeError,
      );
    });

    it('refuse une tête de série attribuée deux fois', () => {
      assert.throws(() => orderEntrants(entrants(1, 1), 'MANUAL'), RangeError);
    });

    it('refuse une tête de série nulle, négative ou décimale', () => {
      for (const seed of [0, -1, 1.5]) {
        assert.throws(() => orderEntrants(entrants(seed), 'MANUAL'), RangeError);
      }
    });
  });
});

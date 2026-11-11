// Génération d'un arbre à élimination simple : matchs, liens entre tours, exempts et formats.
import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { defaultStage } from '@epickem/shared';

import { byeCount, generateSingleElimination, seededRandom, stagePreview } from '../dist/index.js';

const stage = (settings = {}) => {
  const base = defaultStage('SINGLE_ELIMINATION');
  return { ...base, settings: { ...base.settings, seeding: 'MANUAL', ...settings } };
};
/** Participants avec leur tête de série : p1 est la n° 1. */
const entrants = (count) =>
  Array.from({ length: count }, (_, i) => ({ id: `p${i + 1}`, seed: i + 1 }));
const generate = (count, settings) =>
  generateSingleElimination(entrants(count), stage(settings).settings);

const key = ({ round, position }) => `${round}-${position}`;
const ids = (match) => match.slots.map((slot) => slot.entrantId);
const hasBye = (match) => match.slots.some((slot) => slot.isBye);
const inRound = (state, round) => state.matches.filter((m) => m.round === round);

describe('generateSingleElimination', () => {
  it('génère un arbre de 8 selon les têtes de série', () => {
    const state = generate(8);
    assert.equal(state.size, 8);
    assert.equal(state.rounds, 3);
    assert.deepEqual(inRound(state, 1).map(ids), [
      ['p1', 'p8'],
      ['p4', 'p5'],
      ['p2', 'p7'],
      ['p3', 'p6'],
    ]);
    assert.deepEqual(
      state.matches.map((m) => [
        key(m),
        m.winnerNext && `${key(m.winnerNext)}/${m.winnerNext.slot}`,
      ]),
      [
        ['1-1', '2-1/1'],
        ['1-2', '2-1/2'],
        ['1-3', '2-2/1'],
        ['1-4', '2-2/2'],
        ['2-1', '3-1/1'],
        ['2-2', '3-1/2'],
        ['3-1', null],
      ],
    );
  });

  it("qualifie d'office face à un exempt", () => {
    const state = generate(6);
    const [first, , third] = inRound(state, 1);
    assert.deepEqual(first.slots, [
      { entrantId: 'p1', isBye: false },
      { entrantId: null, isBye: true },
    ]);
    assert.equal(first.winnerId, 'p1');
    assert.equal(third.winnerId, 'p2');
    // Les deux exemptés sont déjà placés au tour 2 ; leurs adversaires restent à connaître.
    assert.deepEqual(inRound(state, 2).map(ids), [
      ['p1', null],
      ['p2', null],
    ]);
  });

  it('joue un arbre de 2 en une seule finale', () => {
    const state = generate(2);
    assert.equal(state.matches.length, 1);
    assert.deepEqual(ids(state.matches[0]), ['p1', 'p2']);
    assert.equal(state.matches[0].winnerNext, null);
  });

  describe('format des matchs', () => {
    it('joue tous les matchs en BO5 par défaut', () => {
      const state = generate(16, { thirdPlaceMatch: true });
      assert.ok(state.matches.every((m) => m.bestOf === 5));
    });

    it('applique le format propre à chaque tour, du premier à la finale', () => {
      const state = generate(128, {
        bestOf: 1,
        roundBestOf: { 1: 7, 2: 5, 4: 3, 64: 3 },
      });
      assert.deepEqual(
        Array.from({ length: 7 }, (_, i) => inRound(state, i + 1)[0].bestOf),
        [3, 1, 1, 1, 3, 5, 7],
      );
    });

    it('garde le format de la phase pour les tours sans format propre', () => {
      const state = generate(8, { bestOf: 3 });
      assert.ok(state.matches.every((m) => m.bestOf === 3));
    });
  });

  describe('petite finale', () => {
    it('oppose les perdants des demi-finales, au tour de la finale', () => {
      const state = generate(8, { thirdPlaceMatch: true, bestOf: 3, roundBestOf: { 1: 5 } });
      const [semi1, semi2] = inRound(state, 2);
      assert.deepEqual(semi1.loserNext, { round: 3, position: 2, slot: 1 });
      assert.deepEqual(semi2.loserNext, { round: 3, position: 2, slot: 2 });
      const [final, thirdPlace] = inRound(state, 3);
      assert.equal(final.bestOf, 5);
      assert.equal(thirdPlace.bestOf, 3);
      assert.equal(thirdPlace.winnerNext, null);
    });

    it("n'existe pas à moins de 4 participants", () => {
      const state = generate(3, { thirdPlaceMatch: true });
      assert.equal(state.matches.length, 3);
      assert.ok(state.matches.every((m) => m.loserNext === null));
    });
  });

  it('tire au sort de façon reproductible', () => {
    const settings = stage({ seeding: 'RANDOM' }).settings;
    const draw = (seed) =>
      generateSingleElimination(entrants(16), settings, seededRandom(seed)).matches.map(ids);
    assert.deepEqual(draw(3), draw(3));
    assert.notDeepEqual(draw(3), draw(4));
  });

  describe('refuse ce qui relève des qualifications entre phases (#31)', () => {
    it('une phase avec des qualifiés', () => {
      assert.throws(() => generate(8, { qualifiers: 4 }), RangeError);
    });

    it('un placement autre que manuel ou aléatoire', () => {
      for (const seeding of ['PREVIOUS_STANDINGS', 'CROSS_GROUPS']) {
        assert.throws(() => generate(8, { seeding }), RangeError);
      }
    });
  });

  // De 2 à 64 participants (critère de l'issue #16), puis de grands arbres.
  const counts = [...Array.from({ length: 63 }, (_, i) => i + 2), 127, 128, 129, 200, 1024, 4096];
  for (const count of counts) {
    for (const thirdPlaceMatch of [false, true]) {
      const label = `relie correctement ${count} participants${thirdPlaceMatch ? ', avec petite finale' : ''}`;
      it(label, () => {
        const state = generate(count, { thirdPlaceMatch });
        const withThirdPlace = thirdPlaceMatch && count >= 4;
        const byKey = new Map(state.matches.map((m) => [key(m), m]));

        // Autant de matchs que de places moins une, plus la petite finale.
        assert.equal(state.matches.length, state.size - 1 + (withThirdPlace ? 1 : 0));
        assert.equal(byKey.size, state.matches.length, 'deux matchs à la même place');

        // Chaque participant joue une fois au premier tour ; les exempts y sont tous.
        const first = inRound(state, 1);
        assert.equal(new Set(first.flatMap(ids).filter(Boolean)).size, count);
        const byes = first.flatMap((m) => m.slots).filter((slot) => slot.isBye);
        assert.equal(byes.length, byeCount(count));

        // Un exempt fait gagner son adversaire, placé aussitôt au tour suivant.
        for (const match of state.matches) {
          if (!hasBye(match)) {
            assert.equal(match.winnerId, null);
            continue;
          }
          assert.equal(match.round, 1);
          assert.equal(match.winnerId, match.slots.find((slot) => !slot.isBye).entrantId);
          const next = byKey.get(key(match.winnerNext));
          assert.equal(next.slots[match.winnerNext.slot - 1].entrantId, match.winnerId);
        }

        // Chaque place d'un match après le premier tour est alimentée par un seul match.
        const incoming = new Set();
        for (const match of state.matches) {
          for (const next of [match.winnerNext, match.loserNext].filter(Boolean)) {
            assert.ok(byKey.has(key(next)), `${key(match)} pointe vers un match absent`);
            const target = `${key(next)}/${next.slot}`;
            assert.ok(!incoming.has(target), `place ${target} alimentée deux fois`);
            incoming.add(target);
          }
        }
        for (const match of state.matches.filter((m) => m.round > 1)) {
          assert.ok(incoming.has(`${key(match)}/1`) && incoming.has(`${key(match)}/2`));
        }

        // Une finale (et la petite finale) sans suite ; autant de matchs joués que l'aperçu.
        assert.equal(state.matches.filter((m) => !m.winnerNext).length, withThirdPlace ? 2 : 1);
        const played = state.matches.filter((m) => !hasBye(m)).length;
        assert.equal(played, stagePreview(stage({ thirdPlaceMatch }), count).minMatches);
      });
    }
  }
});

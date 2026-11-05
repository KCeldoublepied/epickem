// Aperçu des phases affiché dans le dashboard : nombre de tours, de matchs et d'exempts.
import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { defaultStage } from '@epickem/shared';

import { stagePreview } from '../dist/index.js';

const stage = (format, settings = {}) => {
  const base = defaultStage(format);
  return { ...base, settings: { ...base.settings, ...settings } };
};
const labels = (preview) => preview.steps.map((step) => step.label);
const matches = (preview) => preview.steps.map((step) => step.matches);

describe('élimination simple', () => {
  it('nomme les tours d’un arbre complet', () => {
    const preview = stagePreview(stage('SINGLE_ELIMINATION'), 16);
    assert.deepEqual(labels(preview), [
      'Huitièmes de finale',
      'Quarts de finale',
      'Demi-finales',
      'Finale',
    ]);
    assert.deepEqual(matches(preview), [8, 4, 2, 1]);
    assert.equal(preview.minMatches, 15);
  });

  it('compte les exempts du premier tour', () => {
    const preview = stagePreview(stage('SINGLE_ELIMINATION'), 12);
    assert.deepEqual(matches(preview), [4, 4, 2, 1]);
    assert.equal(preview.steps[0].detail, '4 exempts');
  });

  it('numérote les tours d’un grand arbre', () => {
    assert.equal(labels(stagePreview(stage('SINGLE_ELIMINATION'), 32))[0], 'Tour 1');
  });

  it('s’arrête aux qualifiés, même en plein tour', () => {
    assert.deepEqual(matches(stagePreview(stage('SINGLE_ELIMINATION'), 16, 4)), [8, 4]);
    assert.deepEqual(matches(stagePreview(stage('SINGLE_ELIMINATION'), 8, 3)), [4, 1]);
  });

  it('applique le format de la finale et la petite finale', () => {
    const preview = stagePreview(
      stage('SINGLE_ELIMINATION', { bestOf: 3, finalBestOf: 5, thirdPlaceMatch: true }),
      4,
    );
    assert.deepEqual(
      preview.steps.map(({ label, bestOf }) => [label, bestOf]),
      [
        ['Demi-finales', 3],
        ['Finale', 5],
        ['Petite finale', 3],
      ],
    );
    assert.equal(preview.minMatches, 4);
  });
});

describe('élimination double', () => {
  it('compte les deux tableaux et la grande finale rejouable', () => {
    const preview = stagePreview(stage('DOUBLE_ELIMINATION'), 8);
    assert.deepEqual(matches(preview), [7, 6, 1]);
    assert.equal(preview.minMatches, 14);
    assert.equal(preview.maxMatches, 15);
  });

  it('n’a pas de tableau perdant à 2 participants', () => {
    const preview = stagePreview(stage('DOUBLE_ELIMINATION', { grandFinalReset: false }), 2);
    assert.deepEqual(labels(preview), ['Tableau gagnant', 'Grande finale']);
    assert.equal(preview.maxMatches, 2);
  });

  it('donne une fourchette quand la phase qualifie plusieurs participants', () => {
    const preview = stagePreview(stage('DOUBLE_ELIMINATION'), 8, 4);
    assert.equal(preview.minMatches, 8);
    assert.equal(preview.maxMatches, 12);
  });
});

describe('round robin', () => {
  it('répartit les participants et compte les matchs par poule', () => {
    const preview = stagePreview(stage('ROUND_ROBIN', { groupCount: 3 }), 10);
    assert.deepEqual(labels(preview), ['1 poule de 4', '2 poules de 3']);
    assert.deepEqual(matches(preview), [6, 6]);
  });

  it('double les matchs en aller-retour', () => {
    const preview = stagePreview(stage('ROUND_ROBIN', { legs: 2 }), 4);
    assert.equal(preview.minMatches, 12);
    assert.equal(preview.steps[0].detail, '6 tours');
  });
});

describe('ronde suisse et free for all', () => {
  it('signale l’exempt d’un nombre impair', () => {
    const preview = stagePreview(stage('SWISS', { rounds: 3 }), 9);
    assert.equal(preview.minMatches, 12);
    assert.match(preview.steps[0].detail, /1 exempt/);
  });

  it('compte les lobbies et leurs parties', () => {
    const preview = stagePreview(stage('FREE_FOR_ALL', { lobbySize: 50, rounds: 3 }), 120);
    assert.equal(preview.steps[0].label, '3 lobbies');
    assert.equal(preview.minMatches, 9);
  });
});

describe('participants impossibles', () => {
  it('ne donne pas d’aperçu', () => {
    assert.equal(stagePreview(stage('SWISS'), 1), null);
    assert.equal(stagePreview(stage('SWISS'), 2.5), null);
    assert.equal(stagePreview(stage('SINGLE_ELIMINATION'), 8, 8), null);
  });
});

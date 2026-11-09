// Règles de structure d'un tournoi et catalogue des jeux, partagés entre l'API et le web.
import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import {
  createGameSchema,
  createTournamentSchema,
  customFieldIssues,
  defaultStage,
  GAME_CATALOG,
  gameStructureIssues,
  normalizeGameSettings,
  publicationIssues,
  stageEntrants,
  tournamentSettingsSchema,
} from '../dist/index.js';

const settings = (input) => tournamentSettingsSchema.safeParse({ name: 'Coupe', ...input });
const issuePaths = (result) => result.error.issues.map((issue) => issue.path.join('.'));

const groups = (qualifiers, groupCount = 2) => {
  const stage = defaultStage('ROUND_ROBIN', 'Poules');
  return { ...stage, settings: { ...stage.settings, qualifiers, groupCount } };
};
const bracket = defaultStage('SINGLE_ELIMINATION', 'Arbre');

describe('création rapide', () => {
  it('demande le nom, le début et la fin, et rien d’autre', () => {
    const parsed = createTournamentSchema.parse({
      name: 'Coupe',
      startsAt: '2026-12-01T18:00:00Z',
      endsAt: '2026-12-01T23:00:00Z',
    });
    assert.deepEqual(Object.keys(parsed).sort(), ['endsAt', 'name', 'startsAt']);
    assert.equal(createTournamentSchema.safeParse({ name: 'Coupe' }).success, false);
  });

  it('refuse une fin avant le début', () => {
    const result = createTournamentSchema.safeParse({
      name: 'Coupe',
      startsAt: '2026-12-02T00:00:00Z',
      endsAt: '2026-12-01T00:00:00Z',
    });
    assert.deepEqual(issuePaths(result), ['endsAt']);
  });
});

describe('phases', () => {
  it('donne à chaque format ses réglages par défaut', () => {
    assert.equal(defaultStage('SWISS').settings.rounds, 5);
    assert.equal(defaultStage('ROUND_ROBIN').settings.pointsWin, 3);
    assert.equal(defaultStage('DOUBLE_ELIMINATION').settings.grandFinalReset, true);
    assert.deepEqual(defaultStage('FREE_FOR_ALL').settings.placementPoints, [10, 7, 5, 3, 1]);
  });

  it('accepte des poules suivies d’un arbre', () => {
    const result = settings({ maxParticipants: 16, stages: [groups(8), bracket] });
    assert.equal(result.success, true);
  });

  it('calcule les participants de chaque phase', () => {
    assert.deepEqual(stageEntrants([groups(8), bracket], 16), [16, 8]);
    assert.deepEqual(stageEntrants([groups(8), bracket]), [undefined, 8]);
  });

  it('exige les qualifiés sauf sur la dernière phase', () => {
    const missing = settings({ stages: [groups(undefined), bracket] });
    assert.deepEqual(issuePaths(missing), ['stages.0.settings.qualifiers']);
    const extra = settings({ stages: [groups(8)] });
    assert.deepEqual(issuePaths(extra), ['stages.0.settings.qualifiers']);
  });

  it('refuse plus de qualifiés que de participants', () => {
    const result = settings({ maxParticipants: 8, stages: [groups(8), bracket] });
    assert.deepEqual(issuePaths(result), ['stages.0.settings.qualifiers']);
  });

  it('limite les poules et les rondes au nombre de participants', () => {
    const tooManyGroups = settings({ maxParticipants: 6, stages: [groups(4, 4), bracket] });
    assert.ok(issuePaths(tooManyGroups).includes('stages.0.settings.groupCount'));

    const swiss = defaultStage('SWISS');
    const tooManyRounds = settings({ maxParticipants: 4, stages: [swiss] });
    assert.deepEqual(issuePaths(tooManyRounds), ['stages.0.settings.rounds']);
  });

  it('refuse des réglages d’un autre format', () => {
    const result = settings({
      stages: [{ name: 'Suisse', format: 'SWISS', settings: { bestOf: 2 } }],
    });
    assert.deepEqual(issuePaths(result), ['stages.0.settings.bestOf']);
  });

  it('qualifie le même nombre de participants dans chaque poule', () => {
    const result = settings({ maxParticipants: 16, stages: [groups(5), bracket] });
    assert.deepEqual(issuePaths(result), ['stages.0.settings.qualifiers']);
  });

  it('réserve le placement croisé à la suite de plusieurs poules', () => {
    const crossed = { ...bracket, settings: { ...bracket.settings, seeding: 'CROSS_GROUPS' } };
    assert.equal(settings({ stages: [groups(4), crossed] }).success, true);
    assert.deepEqual(issuePaths(settings({ stages: [groups(4, 1), crossed] })), [
      'stages.1.settings.seeding',
    ]);
    assert.deepEqual(issuePaths(settings({ stages: [crossed] })), ['stages.0.settings.seeding']);
  });

  it('réserve le Buchholz à la ronde suisse', () => {
    const tieBreaker = (format) => ({
      name: 'Phase',
      format,
      settings: { tieBreaker: 'BUCHHOLZ' },
    });
    assert.deepEqual(issuePaths(settings({ stages: [tieBreaker('ROUND_ROBIN')] })), [
      'stages.0.settings.tieBreaker',
    ]);
    assert.equal(settings({ stages: [tieBreaker('SWISS')] }).success, true);
  });

  it('garde les phases dans les dates du tournoi et dans l’ordre', () => {
    const at = (stage, startsAt) => ({ ...stage, startsAt });
    const result = settings({
      startsAt: '2026-12-01T10:00:00Z',
      endsAt: '2026-12-03T10:00:00Z',
      stages: [at(groups(8), '2026-12-02T10:00:00Z'), at(bracket, '2026-12-01T12:00:00Z')],
    });
    assert.deepEqual(issuePaths(result), ['stages.1.startsAt']);

    const late = settings({
      endsAt: '2026-12-03T10:00:00Z',
      stages: [at(bracket, '2026-12-04T10:00:00Z')],
    });
    assert.deepEqual(issuePaths(late), ['stages.0.startsAt']);
  });

  it('refuse le classement précédent sur la première phase', () => {
    const stage = { ...bracket, settings: { ...bracket.settings, seeding: 'PREVIOUS_STANDINGS' } };
    assert.deepEqual(issuePaths(settings({ stages: [stage] })), ['stages.0.settings.seeding']);
  });
});

describe('champs personnalisés', () => {
  const pseudo = { label: 'Pseudo', required: true, options: [] };
  const rank = { label: 'Rang', required: false, options: ['Or', 'Argent'] };
  const paths = (values) =>
    customFieldIssues([pseudo, rank], values).map((issue) => issue.path.join('.'));

  it('exige les réponses obligatoires', () => {
    assert.deepEqual(paths({ Pseudo: '   ' }), ['customFieldValues.Pseudo']);
    assert.deepEqual(paths({ Pseudo: 'Faker' }), []);
  });

  it('limite une réponse à la liste proposée', () => {
    assert.deepEqual(paths({ Pseudo: 'Faker', Rang: 'Bronze' }), ['customFieldValues.Rang']);
    assert.deepEqual(paths({ Pseudo: 'Faker', Rang: 'Or' }), []);
  });

  it('refuse deux champs de même nom', () => {
    assert.deepEqual(issuePaths(settings({ customFields: [pseudo, pseudo] })), [
      'customFields.1.label',
    ]);
  });
});

describe('déclaration d’un jeu', () => {
  const issues = (input) => issuePaths(createGameSchema.safeParse(input));

  it('accepte un jeu et ses statistiques', () => {
    const parsed = createGameSchema.parse({
      name: 'Babyfoot',
      stats: [{ label: 'Buts', type: 'NUMBER' }],
    });
    assert.equal(parsed.stats[0].scope, 'PARTICIPANT');
  });

  it('exige des valeurs pour une statistique à choix et refuse les doublons', () => {
    assert.deepEqual(issues({ name: 'Échecs', stats: [{ label: 'Ouverture', type: 'CHOICE' }] }), [
      'stats.0.options',
    ]);
    assert.deepEqual(
      issues({
        name: 'Échecs',
        stats: [
          { label: 'Coups', type: 'NUMBER' },
          { label: 'Coups', type: 'NUMBER' },
        ],
      }),
      ['stats.1.label'],
    );
  });
});

describe('catalogue des jeux', () => {
  it('couvre les cinq jeux', () => {
    assert.deepEqual(Object.keys(GAME_CATALOG).sort(), [
      'counter-strike-2',
      'fortnite',
      'league-of-legends',
      'rocket-league',
      'super-smash-bros-ultimate',
    ]);
  });

  it('a des valeurs par défaut valides pour tous les jeux', () => {
    for (const slug of Object.keys(GAME_CATALOG)) {
      assert.deepEqual(normalizeGameSettings(slug, {}, 'ONLINE').issues, [], slug);
    }
  });

  it('complète les réglages manquants et retire les inconnus', () => {
    const { settings: result } = normalizeGameSettings(
      'league-of-legends',
      { pickType: 'FEARLESS_DRAFT', inconnu: true },
      'ONLINE',
    );
    assert.equal(result.pickType, 'FEARLESS_DRAFT');
    assert.equal(result.region, 'EUW');
    assert.equal('inconnu' in result, false);
  });

  it('retire la région d’un tournoi sur place', () => {
    const { settings: onsite } = normalizeGameSettings('rocket-league', {}, 'ONSITE');
    assert.equal('region' in onsite, false);
    const { settings: hybrid } = normalizeGameSettings('rocket-league', {}, 'HYBRID');
    assert.equal(hybrid.region, 'EU');
  });

  it('refuse une valeur hors liste, une liste vide et un nombre hors limites', () => {
    const paths = (slug, raw) =>
      normalizeGameSettings(slug, raw, 'ONLINE').issues.map((issue) => issue.path.join('.'));
    assert.deepEqual(paths('league-of-legends', { region: 'MARS' }), ['gameSettings.region']);
    assert.deepEqual(paths('counter-strike-2', { mapPool: [] }), ['gameSettings.mapPool']);
    assert.deepEqual(paths('super-smash-bros-ultimate', { stocks: 0 }), ['gameSettings.stocks']);
  });

  it('n’a aucun réglage pour un jeu hors catalogue', () => {
    assert.deepEqual(normalizeGameSettings('autre', { region: 'EU' }, 'ONLINE'), {
      settings: {},
      issues: [],
    });
  });

  it('limite les formats au jeu', () => {
    const issues = gameStructureIssues('fortnite', [bracket, defaultStage('FREE_FOR_ALL')]);
    assert.deepEqual(
      issues.map((issue) => issue.path.join('.')),
      ['stages.0.format'],
    );
    assert.deepEqual(gameStructureIssues('rocket-league', [bracket]), []);
    assert.deepEqual(gameStructureIssues(undefined, [bracket]), []);
  });
});

describe('publication', () => {
  it('liste ce qui manque', () => {
    assert.deepEqual(
      publicationIssues({ gameId: null, startsAt: null, stages: [] }).map((issue) => issue.path),
      ['gameId', 'startsAt', 'stages'],
    );
    assert.deepEqual(
      publicationIssues({ gameId: 'id', startsAt: '2026-12-01T18:00:00Z', stages: [bracket] }),
      [],
    );
  });
});

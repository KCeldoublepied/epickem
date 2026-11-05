import type { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import {
  type ApiError,
  defaultStage,
  GAME_CATALOG,
  type GameSummary,
  type Page,
  type TournamentDetail,
  type TournamentSummary,
} from '@epickem/shared';
import { AppModule } from '../src/app.module';
import { validateEnv } from '../src/config/env';
import { PrismaService } from '../src/prisma/prisma.service';

// Tests sur une vraie base PostgreSQL. Le jeu, les comptes et les tournois créés ici
// sont propres à l'exécution et supprimés à la fin.
const DOMAIN = 'tournaments.e2e.test';
const run = Date.now().toString(36);

describe('tournois', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let gameId: string;
  /** Jeu du catalogue, créé par les migrations : il n'est pas supprimé à la fin. */
  let lolId: string;
  let token: string;
  let otherToken: string;
  const http = () => request(app.getHttpServer());
  const bearer = (value: string) => ({ Authorization: `Bearer ${value}` });
  const create = (body: object) =>
    http()
      .post('/tournaments')
      .set(bearer(token))
      .send({ startsAt: '2026-12-01T18:00:00Z', endsAt: '2026-12-01T23:00:00Z', ...body });
  const update = (id: string, body: object, as = token) =>
    http().put(`/tournaments/${id}`).set(bearer(as)).send(body);
  const publish = (id: string, as = token) =>
    http().post(`/tournaments/${id}/publish`).set(bearer(as));

  /** Brouillon complet, prêt à être publié. */
  async function ready(name: string, settings: object = {}): Promise<TournamentDetail> {
    const { id } = (await create({ name }).expect(201)).body as TournamentDetail;
    const res = await update(id, {
      name,
      gameId,
      startsAt: '2026-12-01T18:00:00Z',
      stages: [defaultStage('SINGLE_ELIMINATION')],
      ...settings,
    }).expect(200);
    return res.body as TournamentDetail;
  }

  async function register(name: string): Promise<string> {
    const res = await http()
      .post('/auth/register')
      .set('x-session-transport', 'bearer')
      .send({
        email: `${name}-${run}@${DOMAIN}`,
        username: `${name}_${run}`,
        password: 'mot de passe solide',
      })
      .expect(201);
    return (res.body as { token: string }).token;
  }

  /** Parcourt toutes les pages d'une liste : la base peut contenir d'autres tournois. */
  async function listAll(path: string, as?: string): Promise<TournamentSummary[]> {
    const items: TournamentSummary[] = [];
    let cursor: string | null = null;
    do {
      const req = http()
        .get(path)
        .query({ limit: 50, ...(cursor && { cursor }) });
      const res = await (as ? req.set(bearer(as)) : req).expect(200);
      const page = res.body as Page<TournamentSummary>;
      items.push(...page.items);
      cursor = page.nextCursor;
    } while (cursor);
    return items;
  }
  const ids = (items: TournamentSummary[]) => items.map((item) => item.id);

  beforeAll(async () => {
    const env = validateEnv({
      DATABASE_URL:
        process.env['DATABASE_URL'] ?? 'postgresql://epickem:epickem@localhost:5432/epickem',
      AUTH_RATE_LIMIT: '1000',
    });
    const moduleRef = await Test.createTestingModule({
      imports: [AppModule.forRoot(env)],
    }).compile();
    app = moduleRef.createNestApplication({ logger: false });
    await app.init();
    prisma = app.get(PrismaService);

    ({ id: gameId } = await prisma.game.create({
      data: { name: 'Jeu de test', slug: `jeu-test-${run}` },
    }));
    ({ id: lolId } = await prisma.game.findUniqueOrThrow({
      where: { slug: 'league-of-legends' },
    }));
    token = await register('orga');
    otherToken = await register('autre');
  });

  afterAll(async () => {
    await prisma.tournament.deleteMany({
      where: { organizer: { email: { endsWith: `@${DOMAIN}` } } },
    });
    await prisma.game.delete({ where: { id: gameId } });
    await prisma.user.deleteMany({ where: { email: { endsWith: `@${DOMAIN}` } } });
    await app.close();
  });

  it('a tous les jeux du catalogue dès les migrations, sans seed', async () => {
    const res = await http().get('/games').expect(200);
    const slugs = (res.body as GameSummary[]).map((game) => game.slug);
    expect(slugs).toEqual(expect.arrayContaining(Object.keys(GAME_CATALOG)));
  });

  it('liste les jeux sans connexion, pour le dashboard d’un tournoi', async () => {
    const res = await http().get('/games').expect(200);
    expect(res.body).toContainEqual({ id: gameId, slug: `jeu-test-${run}`, name: 'Jeu de test' });
  });

  describe('création', () => {
    it('crée un brouillon avec le nom et les dates, sans jeu ni phase', async () => {
      const res = await create({
        name: `  Coupe d'Été ${run}  `,
        startsAt: '2026-12-01T18:00:00Z',
        endsAt: '2026-12-01T23:00:00+01:00',
      }).expect(201);

      const tournament = res.body as TournamentDetail;
      expect(tournament).toMatchObject({
        name: `Coupe d'Été ${run}`,
        slug: `coupe-d-ete-${run}`,
        status: 'DRAFT',
        visibility: 'PUBLIC',
        locationType: 'ONLINE',
        participantType: 'SOLO',
        registrationMode: 'OPEN',
        startsAt: '2026-12-01T18:00:00.000Z',
        endsAt: '2026-12-01T22:00:00.000Z',
        game: null,
        gameSettings: {},
        stages: [],
        organizer: { username: `orga_${run}` },
      });

      const row = await prisma.tournament.findUniqueOrThrow({ where: { id: tournament.id } });
      expect(row.organizerId).toBe(tournament.organizer?.id);
    });

    it('donne une adresse différente à deux tournois du même nom', async () => {
      const name = `Même nom ${run}`;
      const first = (await create({ name }).expect(201)).body as TournamentDetail;
      const second = (await create({ name }).expect(201)).body as TournamentDetail;
      expect(first.slug).toBe(`meme-nom-${run}`);
      expect(second.slug).toMatch(new RegExp(`^meme-nom-${run}-[0-9a-f]{6}$`));
    });

    it('exige une connexion', async () => {
      await http().post('/tournaments').send({ name: 'Anonyme' }).expect(401);
    });

    it.each([
      ['un nom trop court', { name: 'ab' }, 'name'],
      ['une date manquante', { endsAt: undefined }, 'endsAt'],
      [
        'une fin avant le début',
        { startsAt: '2026-12-02T00:00:00Z', endsAt: '2026-12-01T00:00:00Z' },
        'endsAt',
      ],
      ['une date sans fuseau', { startsAt: '2026-12-01 18:00' }, 'startsAt'],
    ])('refuse %s', async (_label, overrides, path) => {
      const res = await create({ name: `Invalide ${run}`, ...overrides }).expect(400);
      expect((res.body as ApiError).issues?.map((issue) => issue.path)).toContain(path);
    });
  });

  describe('réglages', () => {
    const draft = async (name: string) =>
      (await create({ name }).expect(201)).body as TournamentDetail;

    it('rend le tournoi complet à son organisateur seulement', async () => {
      const { id } = await draft(`Lecture ${run}`);
      const res = await http().get(`/me/tournaments/${id}`).set(bearer(token)).expect(200);
      expect(res.body).toMatchObject({ id, status: 'DRAFT', stages: [] });
      await http().get(`/me/tournaments/${id}`).set(bearer(otherToken)).expect(403);
      await http().get(`/me/tournaments/${id}`).expect(401);
    });

    it('remplace les informations, efface les champs absents et garde le slug', async () => {
      const created = await draft(`Avant ${run}`);
      await update(created.id, {
        name: `Avant ${run}`,
        gameId,
        description: 'Ancienne description',
        maxParticipants: 8,
      }).expect(200);

      const res = await update(created.id, {
        gameId,
        name: `Après ${run}`,
        participantType: 'TEAM',
        teamSizeMin: 2,
        teamSizeMax: 2,
      }).expect(200);
      expect(res.body).toMatchObject({
        name: `Après ${run}`,
        slug: created.slug,
        status: 'DRAFT',
        description: null,
        maxParticipants: null,
        startsAt: null,
        participantType: 'TEAM',
        teamSizeMin: 2,
      });
    });

    it('accepte un tournoi par équipes sur place', async () => {
      const { id } = await draft(`LAN ${run}`);
      const res = await update(id, {
        gameId,
        name: `LAN ${run}`,
        participantType: 'TEAM',
        teamSizeMin: 5,
        teamSizeMax: 7,
        locationType: 'ONSITE',
        location: 'Salle des fêtes, Lyon',
      }).expect(200);
      expect(res.body).toMatchObject({
        teamSizeMin: 5,
        teamSizeMax: 7,
        location: 'Salle des fêtes, Lyon',
      });
    });

    it('refuse un jeu inexistant', async () => {
      const { id } = await draft(`Sans jeu ${run}`);
      const res = await update(id, {
        gameId: '00000000-0000-4000-8000-000000000000',
        name: `Sans jeu ${run}`,
      }).expect(400);
      expect((res.body as ApiError).issues).toEqual([
        { path: 'gameId', message: 'Jeu introuvable' },
      ]);
    });

    it.each([
      ['un nom trop court', { name: 'ab' }, 'name'],
      ['un lieu manquant pour un tournoi sur place', { locationType: 'ONSITE' }, 'location'],
      ['des équipes sans taille', { participantType: 'TEAM' }, 'teamSizeMin'],
      ['une taille d’équipe en solo', { teamSizeMin: 2 }, 'teamSizeMin'],
      [
        'une taille minimale supérieure à la maximale',
        { participantType: 'TEAM', teamSizeMin: 5, teamSizeMax: 3 },
        'teamSizeMax',
      ],
      [
        'une fin avant le début',
        { startsAt: '2026-12-02T00:00:00Z', endsAt: '2026-12-01T00:00:00Z' },
        'endsAt',
      ],
      [
        'des inscriptions fermées après le début',
        { startsAt: '2026-12-01T00:00:00Z', registrationClosesAt: '2026-12-02T00:00:00Z' },
        'registrationClosesAt',
      ],
    ])('refuse %s', async (_label, overrides, path) => {
      const { id } = await draft(`Invalide ${run}`);
      const res = await update(id, { name: `Invalide ${run}`, ...overrides }).expect(400);
      expect((res.body as ApiError).issues?.map((issue) => issue.path)).toContain(path);
    });

    it('complète les réglages du jeu et les valide avec le catalogue', async () => {
      const name = `LoL ${run}`;
      const { id } = await draft(name);

      const res = await update(id, {
        name,
        gameId: lolId,
        gameSettings: { pickType: 'FEARLESS_DRAFT' },
      }).expect(200);
      expect((res.body as TournamentDetail).gameSettings).toMatchObject({
        pickType: 'FEARLESS_DRAFT',
        region: 'EUW',
        map: 'SUMMONERS_RIFT',
      });

      const invalid = await update(id, {
        name,
        gameId: lolId,
        gameSettings: { pickType: 'INCONNU' },
      }).expect(400);
      expect((invalid.body as ApiError).issues?.map((issue) => issue.path)).toEqual([
        'gameSettings.pickType',
      ]);
    });

    it('retire la région d’un tournoi sur place', async () => {
      const name = `LoL LAN ${run}`;
      const { id } = await draft(name);
      const res = await update(id, {
        name,
        gameId: lolId,
        locationType: 'ONSITE',
        location: 'Paris',
        gameSettings: { region: 'KR' },
      }).expect(200);
      expect((res.body as TournamentDetail).gameSettings).not.toHaveProperty('region');
    });

    it('enregistre plusieurs phases de formats différents, dans l’ordre', async () => {
      const name = `Phases ${run}`;
      const { id } = await draft(name);
      const groups = defaultStage('ROUND_ROBIN', 'Poules');
      const res = await update(id, {
        name,
        maxParticipants: 16,
        stages: [
          { ...groups, settings: { ...groups.settings, groupCount: 4, qualifiers: 8 } },
          defaultStage('DOUBLE_ELIMINATION', 'Arbre final'),
        ],
      }).expect(200);

      const { stages } = res.body as TournamentDetail;
      expect(stages).toMatchObject([
        {
          order: 1,
          name: 'Poules',
          format: 'ROUND_ROBIN',
          status: 'PENDING',
          settings: { groupCount: 4, qualifiers: 8, pointsWin: 3 },
        },
        { order: 2, name: 'Arbre final', format: 'DOUBLE_ELIMINATION' },
      ]);
    });

    it('garde l’identifiant des phases et retire celles en trop', async () => {
      const name = `Structure ${run}`;
      const { id } = await draft(name);
      const swiss = defaultStage('SWISS', 'Suisse');
      const first = await update(id, {
        name,
        stages: [
          { ...swiss, settings: { ...swiss.settings, qualifiers: 8 } },
          defaultStage('SINGLE_ELIMINATION', 'Arbre'),
        ],
      }).expect(200);
      const before = (first.body as TournamentDetail).stages;

      const second = await update(id, {
        name,
        stages: [defaultStage('ROUND_ROBIN', 'Poule unique')],
      }).expect(200);
      const after = (second.body as TournamentDetail).stages;
      expect(after).toHaveLength(1);
      expect(after[0]).toMatchObject({ id: before[0]?.id, format: 'ROUND_ROBIN' });
      expect(await prisma.stage.count({ where: { tournamentId: id } })).toBe(1);
    });

    it('refuse une structure incohérente sans rien enregistrer', async () => {
      const name = `Incohérent ${run}`;
      const { id } = await draft(name);
      const swiss = defaultStage('SWISS');
      const res = await update(id, {
        name,
        maxParticipants: 8,
        stages: [
          { ...swiss, settings: { ...swiss.settings, qualifiers: 8 } },
          defaultStage('SINGLE_ELIMINATION'),
        ],
      }).expect(400);
      expect((res.body as ApiError).issues?.map((issue) => issue.path)).toEqual([
        'stages.0.settings.qualifiers',
      ]);
      expect(await prisma.stage.count({ where: { tournamentId: id } })).toBe(0);
    });

    it('refuse un format que le jeu ne permet pas', async () => {
      const name = `Format ${run}`;
      const { id } = await draft(name);
      const res = await update(id, {
        name,
        gameId: lolId,
        stages: [defaultStage('FREE_FOR_ALL')],
      }).expect(400);
      expect((res.body as ApiError).issues?.map((issue) => issue.path)).toEqual([
        'stages.0.format',
      ]);
    });

    it('reste possible après publication, plus une fois le tournoi commencé', async () => {
      const name = `Statut ${run}`;
      const { id } = await ready(name);
      const settings = {
        gameId,
        name,
        startsAt: '2026-12-01T18:00:00Z',
        stages: [defaultStage('SINGLE_ELIMINATION')],
      };
      await update(id, settings, otherToken).expect(403);

      await publish(id).expect(200);
      const res = await update(id, { ...settings, name: `Statut publié ${run}` }).expect(200);
      expect((res.body as TournamentDetail).status).toBe('REGISTRATION');

      await prisma.tournament.update({ where: { id }, data: { status: 'IN_PROGRESS' } });
      await update(id, settings).expect(409);
    });

    it('ne retire ni le jeu ni les phases d’un tournoi publié', async () => {
      const name = `Publié complet ${run}`;
      const { id } = await ready(name);
      await publish(id).expect(200);

      const res = await update(id, { name }).expect(400);
      expect((res.body as ApiError).issues?.map((issue) => issue.path)).toEqual([
        'gameId',
        'startsAt',
        'stages',
      ]);
    });
  });

  describe('publication et listes', () => {
    it('refuse de publier un tournoi incomplet et dit ce qui manque', async () => {
      const { id } = (await create({ name: `Incomplet ${run}` }).expect(201))
        .body as TournamentDetail;
      const res = await publish(id).expect(409);
      expect((res.body as ApiError).issues?.map((issue) => issue.path)).toEqual([
        'gameId',
        'stages',
      ]);
    });

    it('un brouillon n’est visible que par son organisateur, jusqu’à sa publication', async () => {
      const draft = await ready(`Brouillon ${run}`);

      expect(ids(await listAll('/tournaments'))).not.toContain(draft.id);
      const mine = await listAll('/me/tournaments', token);
      expect(mine.find((item) => item.id === draft.id)).toMatchObject({
        status: 'DRAFT',
        participantCount: 0,
        game: { id: gameId },
      });
      expect(ids(await listAll('/me/tournaments', otherToken))).not.toContain(draft.id);

      const res = await publish(draft.id).expect(200);
      expect((res.body as TournamentDetail).status).toBe('REGISTRATION');
      expect(ids(await listAll('/tournaments'))).toContain(draft.id);
    });

    it('ne liste jamais un tournoi non répertorié, même publié', async () => {
      const unlisted = await ready(`Caché ${run}`, { visibility: 'UNLISTED' });
      await publish(unlisted.id).expect(200);
      expect(ids(await listAll('/tournaments'))).not.toContain(unlisted.id);
    });

    it('réserve la publication à l’organisateur, une seule fois', async () => {
      const { id } = await ready(`Publication ${run}`);
      await publish(id, otherToken).expect(403);
      await http().post(`/tournaments/${id}/publish`).expect(401);
      await publish(id).expect(200);
      await publish(id).expect(409);
    });

    it('répond 404 pour un tournoi inconnu et 400 pour un identifiant mal formé', async () => {
      await publish('00000000-0000-4000-8000-000000000000').expect(404);
      await publish('pas-un-uuid').expect(400);
    });

    it('exige une connexion pour la liste de ses tournois', async () => {
      await http().get('/me/tournaments').expect(401);
    });

    it('pagine sans doublon ni oubli', async () => {
      const first = await http().get('/me/tournaments').query({ limit: 2 }).set(bearer(token));
      const page1 = first.body as Page<TournamentSummary>;
      expect(page1.items).toHaveLength(2);
      expect(page1.nextCursor).toBe(page1.items[1]?.id);

      const second = await http()
        .get('/me/tournaments')
        .query({ limit: 2, cursor: page1.nextCursor })
        .set(bearer(token));
      const page2 = second.body as Page<TournamentSummary>;
      expect(ids(page2.items)).not.toContain(page1.items[0]?.id);
      expect(ids(page2.items)).not.toContain(page1.items[1]?.id);

      const all = ids(await listAll('/me/tournaments', token));
      expect(all.slice(0, 4)).toEqual([...ids(page1.items), ...ids(page2.items)]);
    });

    it('refuse une taille de page hors limites', async () => {
      await http().get('/tournaments').query({ limit: 0 }).expect(400);
      await http().get('/tournaments').query({ limit: 51 }).expect(400);
    });
  });
});

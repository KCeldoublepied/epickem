import type { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type { ApiError, Page, TournamentDetail, TournamentSummary } from '@epickem/shared';
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
  let token: string;
  let otherToken: string;
  const http = () => request(app.getHttpServer());
  const bearer = (value: string) => ({ Authorization: `Bearer ${value}` });
  const create = (body: object) => http().post('/tournaments').set(bearer(token)).send(body);
  const publish = (id: string, as = token) =>
    http().post(`/tournaments/${id}/publish`).set(bearer(as));

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
    token = await register('orga');
    otherToken = await register('autre');
  });

  afterAll(async () => {
    await prisma.tournament.deleteMany({ where: { gameId } });
    await prisma.game.delete({ where: { id: gameId } });
    await prisma.user.deleteMany({ where: { email: { endsWith: `@${DOMAIN}` } } });
    await app.close();
  });

  it('liste les jeux sans connexion, pour le formulaire de création', async () => {
    const res = await http().get('/games').expect(200);
    expect(res.body).toContainEqual({ id: gameId, slug: `jeu-test-${run}`, name: 'Jeu de test' });
  });

  describe('création', () => {
    it('crée un brouillon dont le compte connecté est l’organisateur', async () => {
      const res = await create({
        gameId,
        name: `  Coupe d'Été ${run}  `,
        startsAt: '2026-12-01T18:00:00Z',
        endsAt: '2026-12-01T23:00:00+01:00',
        maxParticipants: 16,
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
        maxParticipants: 16,
        startsAt: '2026-12-01T18:00:00.000Z',
        endsAt: '2026-12-01T22:00:00.000Z',
        game: { id: gameId, slug: `jeu-test-${run}` },
        organizer: { username: `orga_${run}` },
      });

      const row = await prisma.tournament.findUniqueOrThrow({ where: { id: tournament.id } });
      expect(row.organizerId).toBe(tournament.organizer?.id);
    });

    it('donne une adresse différente à deux tournois du même nom', async () => {
      const name = `Même nom ${run}`;
      const first = (await create({ gameId, name }).expect(201)).body as TournamentDetail;
      const second = (await create({ gameId, name }).expect(201)).body as TournamentDetail;
      expect(first.slug).toBe(`meme-nom-${run}`);
      expect(second.slug).toMatch(new RegExp(`^meme-nom-${run}-[0-9a-f]{6}$`));
    });

    it('accepte un tournoi par équipes sur place', async () => {
      const res = await create({
        gameId,
        name: `LAN ${run}`,
        participantType: 'TEAM',
        teamSizeMin: 5,
        teamSizeMax: 7,
        locationType: 'ONSITE',
        location: 'Salle des fêtes, Lyon',
      }).expect(201);
      expect(res.body).toMatchObject({
        teamSizeMin: 5,
        teamSizeMax: 7,
        location: 'Salle des fêtes, Lyon',
      });
    });

    it('exige une connexion', async () => {
      await http().post('/tournaments').send({ gameId, name: 'Anonyme' }).expect(401);
    });

    it('refuse un jeu inexistant', async () => {
      const res = await create({
        gameId: '00000000-0000-4000-8000-000000000000',
        name: 'Sans jeu',
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
      ['une date sans fuseau', { startsAt: '2026-12-01 18:00' }, 'startsAt'],
    ])('refuse %s', async (_label, overrides, path) => {
      const res = await create({ gameId, name: `Invalide ${run}`, ...overrides }).expect(400);
      expect((res.body as ApiError).issues?.map((issue) => issue.path)).toContain(path);
    });
  });

  describe('modification', () => {
    const update = (id: string, body: object, as = token) =>
      http().put(`/tournaments/${id}`).set(bearer(as)).send(body);

    it('rend le tournoi complet à son organisateur seulement', async () => {
      const { id } = (await create({ gameId, name: `Lecture ${run}` }).expect(201))
        .body as TournamentDetail;
      const res = await http().get(`/me/tournaments/${id}`).set(bearer(token)).expect(200);
      expect(res.body).toMatchObject({ id, status: 'DRAFT', game: { id: gameId } });
      await http().get(`/me/tournaments/${id}`).set(bearer(otherToken)).expect(403);
      await http().get(`/me/tournaments/${id}`).expect(401);
    });

    it('remplace les informations, efface les champs absents et garde le slug', async () => {
      const created = (
        await create({
          gameId,
          name: `Avant ${run}`,
          description: 'Ancienne description',
          maxParticipants: 8,
          startsAt: '2026-12-01T18:00:00Z',
        }).expect(201)
      ).body as TournamentDetail;

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

    it('applique les mêmes règles qu’à la création', async () => {
      const { id } = (await create({ gameId, name: `Règles ${run}` }).expect(201))
        .body as TournamentDetail;
      const res = await update(id, { gameId, name: `Règles ${run}`, locationType: 'ONSITE' });
      expect(res.status).toBe(400);
      expect((res.body as ApiError).issues?.map((issue) => issue.path)).toContain('location');
    });

    it('reste possible après publication, plus une fois le tournoi commencé', async () => {
      const { id } = (await create({ gameId, name: `Statut ${run}` }).expect(201))
        .body as TournamentDetail;
      await update(id, { gameId, name: `Statut ${run}` }, otherToken).expect(403);

      await publish(id).expect(200);
      const res = await update(id, { gameId, name: `Statut publié ${run}` }).expect(200);
      expect((res.body as TournamentDetail).status).toBe('REGISTRATION');

      await prisma.tournament.update({ where: { id }, data: { status: 'IN_PROGRESS' } });
      await update(id, { gameId, name: `Statut ${run}` }).expect(409);
    });
  });

  describe('publication et listes', () => {
    it('un brouillon n’est visible que par son organisateur, jusqu’à sa publication', async () => {
      const draft = (await create({ gameId, name: `Brouillon ${run}` }).expect(201))
        .body as TournamentDetail;

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
      const unlisted = (
        await create({ gameId, name: `Caché ${run}`, visibility: 'UNLISTED' }).expect(201)
      ).body as TournamentDetail;
      await publish(unlisted.id).expect(200);
      expect(ids(await listAll('/tournaments'))).not.toContain(unlisted.id);
    });

    it('réserve la publication à l’organisateur, une seule fois', async () => {
      const { id } = (await create({ gameId, name: `Publication ${run}` }).expect(201))
        .body as TournamentDetail;
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

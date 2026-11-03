import type { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type { ApiError, TournamentDetail } from '@epickem/shared';
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
  const http = () => request(app.getHttpServer());
  const create = (body: object) =>
    http().post('/tournaments').set('Authorization', `Bearer ${token}`).send(body);

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
    const res = await http()
      .post('/auth/register')
      .set('x-session-transport', 'bearer')
      .send({
        email: `orga-${run}@${DOMAIN}`,
        username: `orga_${run}`,
        password: 'mot de passe solide',
      })
      .expect(201);
    token = (res.body as { token: string }).token;
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
});

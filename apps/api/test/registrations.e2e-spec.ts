import type { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import {
  type ApiError,
  defaultStage,
  type MyRegistration,
  type TeamDetail,
  type TournamentDetail,
  type TournamentRegistration,
} from '@epickem/shared';
import { AppModule } from '../src/app.module';
import { validateEnv } from '../src/config/env';
import { PrismaService } from '../src/prisma/prisma.service';

// Tests sur une vraie base PostgreSQL : les données créées ici sont supprimées à la fin.
const DOMAIN = 'registrations.e2e.test';
const run = Date.now().toString(36);

interface Account {
  id: string;
  token: string;
}

describe('inscriptions', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let gameId: string;
  let organizer: Account;
  let captain: Account;
  let otherCaptain: Account;
  let player: Account;
  let tournamentCount = 0;
  const http = () => request(app.getHttpServer());
  const bearer = ({ token }: Account) => ({ Authorization: `Bearer ${token}` });

  async function register(name: string): Promise<Account> {
    const res = await http()
      .post('/auth/register')
      .set('x-session-transport', 'bearer')
      .send({
        email: `${name}-${run}@${DOMAIN}`,
        username: `${name}_${run}`,
        password: 'mot de passe solide',
      })
      .expect(201);
    const { token, user } = res.body as { token: string; user: { id: string } };
    return { id: user.id, token };
  }

  /** Tournoi publié ; `publish: false` le laisse en brouillon. */
  async function tournament(settings: object = {}, publish = true): Promise<string> {
    const name = `Tournoi ${run} ${++tournamentCount}`;
    const dates = { startsAt: '2030-12-01T18:00:00Z', endsAt: '2030-12-02T18:00:00Z' };
    const created = await http()
      .post('/tournaments')
      .set(bearer(organizer))
      .send({ name, ...dates })
      .expect(201);
    const { id } = created.body as TournamentDetail;
    await http()
      .put(`/tournaments/${id}`)
      .set(bearer(organizer))
      .send({ name, gameId, ...dates, stages: [defaultStage('SINGLE_ELIMINATION')], ...settings })
      .expect(200);
    if (publish) await http().post(`/tournaments/${id}/publish`).set(bearer(organizer)).expect(200);
    return id;
  }
  const teamTournament = (settings: object = {}) =>
    tournament({ participantType: 'TEAM', teamSizeMin: 2, teamSizeMax: 3, ...settings });

  /** Équipe de `owner`, avec les membres donnés en plus du chef. */
  async function team(owner: Account, ...members: Account[]): Promise<TeamDetail> {
    const res = await http()
      .post('/teams')
      .set(bearer(owner))
      .send({ name: `Équipe ${run}` })
      .expect(201);
    const created = res.body as TeamDetail;
    for (const member of members) {
      await http().post(`/teams/invitations/${created.inviteCode}`).set(bearer(member)).expect(201);
    }
    return created;
  }

  const enter = (id: string, as: Account, body: object = {}) =>
    http().post(`/tournaments/${id}/registrations`).set(bearer(as)).send(body);
  const cancel = (id: string, registrationId: string, as: Account) =>
    http().delete(`/tournaments/${id}/registrations/${registrationId}`).set(bearer(as));
  const review = (id: string, registrationId: string, status: string, as = organizer) =>
    http()
      .patch(`/tournaments/${id}/registrations/${registrationId}`)
      .set(bearer(as))
      .send({ status });
  const participants = (tournamentId: string) =>
    prisma.participant.count({ where: { tournamentId } });
  const message = (res: { body: unknown }) => (res.body as ApiError).message;

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
      data: { name: 'Jeu de test', slug: `jeu-inscriptions-${run}` },
    }));
    organizer = await register('orga');
    captain = await register('chef');
    otherCaptain = await register('chef2');
    player = await register('joueur');
  });

  afterAll(async () => {
    const owned = { email: { endsWith: `@${DOMAIN}` } };
    await prisma.tournament.deleteMany({ where: { organizer: owned } });
    await prisma.team.deleteMany({ where: { captain: owned } });
    await prisma.game.delete({ where: { id: gameId } });
    await prisma.user.deleteMany({ where: owned });
    await app.close();
  });

  describe('joueurs seuls', () => {
    it('inscrit un joueur une seule fois, et l’annule', async () => {
      const id = await tournament();
      const res = await enter(id, player).expect(201);
      const registration = res.body as MyRegistration;
      expect(registration).toMatchObject({ status: 'ACCEPTED', team: null, canCancel: true });
      expect(await participants(id)).toBe(1);

      await enter(id, player).expect(409);
      await cancel(id, registration.id, captain).expect(403);
      await cancel(id, registration.id, player).expect(204);
      expect(await participants(id)).toBe(0);
      await enter(id, player).expect(201);
    });

    it('refuse une équipe et exige une connexion', async () => {
      const id = await tournament();
      const { id: teamId } = await team(captain);
      const res = await enter(id, captain, { teamId }).expect(400);
      expect((res.body as ApiError).issues?.map((issue) => issue.path)).toEqual(['teamId']);
      await http().post(`/tournaments/${id}/registrations`).send({}).expect(401);
    });
  });

  describe('ouverture', () => {
    it('refuse un brouillon, un tournoi privé et des dates dépassées', async () => {
      await enter(await tournament({}, false), player).expect(409);
      await enter(await tournament({ visibility: 'PRIVATE' }), player).expect(403);
      await enter(await tournament({ registrationOpensAt: '2030-11-30T00:00:00Z' }), player).expect(
        409,
      );
      const closed = await tournament({
        registrationOpensAt: '2020-01-01T00:00:00Z',
        registrationClosesAt: '2020-01-02T00:00:00Z',
      });
      expect(message(await enter(closed, player).expect(409))).toMatch(/closes/);
    });

    it('n’accepte plus personne une fois le tournoi commencé', async () => {
      const id = await tournament();
      const { body } = await enter(id, player).expect(201);
      await prisma.tournament.update({ where: { id }, data: { status: 'IN_PROGRESS' } });
      await enter(id, captain).expect(409);
      await cancel(id, (body as MyRegistration).id, player).expect(409);
    });
  });

  describe('équipes', () => {
    it('inscrit une équipe par son chef et la montre à ses membres', async () => {
      const id = await teamTournament();
      const { id: teamId, name } = await team(captain, player);

      const res = await enter(id, captain, { teamId }).expect(201);
      expect(res.body).toMatchObject({ status: 'ACCEPTED', team: { id: teamId, name } });

      const participant = await prisma.participant.findFirstOrThrow({
        where: { tournamentId: id },
      });
      expect(participant).toMatchObject({ teamId, displayName: name, userId: null });

      const mine = await http().get('/me/registrations').set(bearer(player)).expect(200);
      const seen = (mine.body as MyRegistration[]).find((item) => item.tournamentId === id);
      expect(seen).toMatchObject({ canCancel: false, team: { id: teamId } });
    });

    it('exige une équipe, et que le compte en soit le chef', async () => {
      const id = await teamTournament();
      const { id: teamId } = await team(captain, player);
      const missing = await enter(id, captain).expect(400);
      expect((missing.body as ApiError).issues?.map((issue) => issue.path)).toEqual(['teamId']);
      await enter(id, player, { teamId }).expect(403);
      await enter(id, otherCaptain, { teamId }).expect(403);
      await enter(id, captain, { teamId: '00000000-0000-4000-8000-000000000000' }).expect(404);
    });

    it('respecte la taille d’équipe du tournoi', async () => {
      const id = await teamTournament();
      const { id: teamId } = await team(captain);
      const res = await enter(id, captain, { teamId }).expect(409);
      expect(message(res)).toBe(
        'Ce tournoi demande de 2 à 3 joueurs par équipe : la vôtre en compte 1',
      );
    });

    it('n’accepte pas un joueur dans deux équipes du même tournoi', async () => {
      const id = await teamTournament();
      const first = await team(captain, player);
      const second = await team(otherCaptain, player);
      await enter(id, captain, { teamId: first.id }).expect(201);
      const res = await enter(id, otherCaptain, { teamId: second.id }).expect(409);
      expect(message(res)).toMatch(/déjà inscrit avec une autre équipe/);
    });

    it('réserve l’annulation au chef d’équipe', async () => {
      const id = await teamTournament();
      const { id: teamId } = await team(captain, player);
      const { body } = await enter(id, captain, { teamId }).expect(201);
      await cancel(id, (body as MyRegistration).id, player).expect(403);
      await cancel(id, (body as MyRegistration).id, captain).expect(204);
      expect(await participants(id)).toBe(0);
    });

    it('ne donne pas deux fois la dernière place', async () => {
      const id = await teamTournament({ maxParticipants: 2 });
      await enter(id, captain, { teamId: (await team(captain, organizer)).id }).expect(201);
      const first = await team(otherCaptain, player);
      const second = await team(player, otherCaptain);

      const results = await Promise.all([
        enter(id, otherCaptain, { teamId: first.id }),
        enter(id, player, { teamId: second.id }),
      ]);
      expect(results.map(({ status }) => status).sort()).toEqual([201, 409]);
      expect(await participants(id)).toBe(2);
    });
  });

  describe('validation par l’organisateur', () => {
    it('met en attente, puis engage le participant accepté', async () => {
      const id = await tournament({ registrationMode: 'APPROVAL' });
      const res = await enter(id, player).expect(201);
      const registration = res.body as MyRegistration;
      expect(registration.status).toBe('PENDING');
      expect(await participants(id)).toBe(0);

      const list = await http()
        .get(`/me/tournaments/${id}/registrations`)
        .set(bearer(organizer))
        .expect(200);
      expect(list.body as TournamentRegistration[]).toEqual([
        { id: registration.id, status: 'PENDING', name: `joueur_${run}`, memberCount: null },
      ]);

      await review(id, registration.id, 'ACCEPTED').expect(204);
      expect(await participants(id)).toBe(1);
      await review(id, registration.id, 'REJECTED').expect(409);
    });

    it('garde un refus définitif', async () => {
      const id = await tournament({ registrationMode: 'APPROVAL' });
      const { body } = await enter(id, player).expect(201);
      const { id: registrationId } = body as MyRegistration;

      await review(id, registrationId, 'REJECTED').expect(204);
      expect(await participants(id)).toBe(0);
      await cancel(id, registrationId, player).expect(409);
      await enter(id, player).expect(409);
    });

    it('réserve la validation à l’organisateur et refuse un tournoi complet', async () => {
      const id = await tournament({ registrationMode: 'APPROVAL', maxParticipants: 2 });
      const entries = await Promise.all(
        [player, captain, otherCaptain].map(async (account) => {
          const { body } = await enter(id, account).expect(201);
          return (body as MyRegistration).id;
        }),
      );
      await review(id, entries[0] ?? '', 'ACCEPTED', player).expect(403);
      await http().get(`/me/tournaments/${id}/registrations`).set(bearer(player)).expect(403);

      await review(id, entries[0] ?? '', 'ACCEPTED').expect(204);
      await review(id, entries[1] ?? '', 'ACCEPTED').expect(204);
      expect(message(await review(id, entries[2] ?? '', 'ACCEPTED').expect(409))).toMatch(
        /complet/,
      );
    });
  });
});

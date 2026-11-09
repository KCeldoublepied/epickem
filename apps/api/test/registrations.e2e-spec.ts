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
// Le préfixe évite les pseudos identiques avec les autres fichiers de tests, lancés en parallèle.
const run = `r${Date.now().toString(36)}`;

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
        'Ce tournoi demande au moins 2 titulaires : votre équipe en compte 1',
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
      expect(list.body as TournamentRegistration[]).toMatchObject([
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

    it('réserve la validation à l’organisateur et met en attente quand c’est complet', async () => {
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
      await review(id, entries[2] ?? '', 'ACCEPTED').expect(204);
      const mine = await http().get('/me/registrations').set(bearer(otherCaptain)).expect(200);
      const seen = (mine.body as MyRegistration[]).find((item) => item.tournamentId === id);
      expect(seen).toMatchObject({ status: 'WAITLISTED', waitlistPosition: 1 });
      expect(await participants(id)).toBe(2);
    });
  });

  describe('liste d’attente', () => {
    it('ne donne jamais une place ni un rang deux fois, même en simultané', async () => {
      const id = await tournament({ maxParticipants: 3 });
      const accounts = await Promise.all(
        Array.from({ length: 8 }, (_, index) => register(`course${index}`)),
      );

      const results = await Promise.all(accounts.map((account) => enter(id, account)));
      const registrations = results.map(({ body }) => body as MyRegistration);
      expect(registrations.filter(({ status }) => status === 'ACCEPTED')).toHaveLength(3);
      expect(await participants(id)).toBe(3);
      expect(
        registrations.flatMap(({ waitlistPosition: rank }) => rank ?? []).sort((a, b) => a - b),
      ).toEqual([1, 2, 3, 4, 5]);
    });

    const position = async (id: string, as: Account) => {
      const res = await http().get('/me/registrations').set(bearer(as)).expect(200);
      return (res.body as MyRegistration[]).find((item) => item.tournamentId === id);
    };

    it('numérote les suivants et donne une place libérée au premier', async () => {
      const id = await tournament({ maxParticipants: 2 });
      const first = (await enter(id, organizer).expect(201)).body as MyRegistration;
      await enter(id, captain).expect(201);
      const waiting = (await enter(id, otherCaptain).expect(201)).body as MyRegistration;
      expect(waiting).toMatchObject({ status: 'WAITLISTED', waitlistPosition: 1 });
      await enter(id, player).expect(201);
      expect(await position(id, player)).toMatchObject({ waitlistPosition: 2 });

      await cancel(id, first.id, organizer).expect(204);
      expect(await position(id, otherCaptain)).toMatchObject({
        status: 'ACCEPTED',
        waitlistPosition: null,
      });
      expect(await position(id, player)).toMatchObject({ status: 'WAITLISTED' });
      expect(await participants(id)).toBe(2);
    });

    it('ne promeut personne quand quelqu’un quitte la liste d’attente', async () => {
      const id = await tournament({ maxParticipants: 2 });
      await enter(id, organizer).expect(201);
      await enter(id, captain).expect(201);
      const waiting = (await enter(id, otherCaptain).expect(201)).body as MyRegistration;
      await enter(id, player).expect(201);

      await cancel(id, waiting.id, otherCaptain).expect(204);
      expect(await position(id, player)).toMatchObject({ status: 'WAITLISTED' });
      expect(await participants(id)).toBe(2);
    });
  });

  describe('check-in', () => {
    const open = { checkInOpensAt: '2020-01-01T00:00:00Z' };
    const checkIn = (id: string, registrationId: string, as: Account) =>
      http().post(`/tournaments/${id}/registrations/${registrationId}/check-in`).set(bearer(as));
    const close = (id: string, as = organizer) =>
      http().post(`/tournaments/${id}/check-in/close`).set(bearer(as));

    it('n’est possible que pendant la plage horaire et pour son inscription', async () => {
      const notYet = await tournament({ checkInOpensAt: '2030-11-30T00:00:00Z' });
      const early = (await enter(notYet, player).expect(201)).body as MyRegistration;
      await checkIn(notYet, early.id, player).expect(409);

      const id = await tournament(open);
      const { id: registrationId } = (await enter(id, player).expect(201)).body as MyRegistration;
      await checkIn(id, registrationId, captain).expect(403);
      await checkIn(id, registrationId, player).expect(204);
      const res = await http().get('/me/registrations').set(bearer(player)).expect(200);
      const mine = (res.body as MyRegistration[]).find((item) => item.tournamentId === id);
      expect(mine?.checkedIn).toBe(true);
    });

    it('remplace les absents par les présents de la liste d’attente', async () => {
      const id = await tournament({ ...open, maxParticipants: 2 });
      const present = (await enter(id, organizer).expect(201)).body as MyRegistration;
      await enter(id, captain).expect(201);
      await enter(id, otherCaptain).expect(201);
      const replacement = (await enter(id, player).expect(201)).body as MyRegistration;
      await checkIn(id, present.id, organizer).expect(204);
      await checkIn(id, replacement.id, player).expect(204);

      await close(id, player).expect(403);
      await close(id).expect(204);

      const list = await http()
        .get(`/me/tournaments/${id}/registrations`)
        .set(bearer(organizer))
        .expect(200);
      const statuses = Object.fromEntries(
        (list.body as TournamentRegistration[]).map(({ name, status }) => [name, status]),
      );
      expect(statuses).toEqual({
        [`orga_${run}`]: 'ACCEPTED',
        [`chef_${run}`]: 'CANCELLED',
        [`chef2_${run}`]: 'WAITLISTED',
        [`joueur_${run}`]: 'ACCEPTED',
      });
      expect(await participants(id)).toBe(2);
      await enter(id, captain).expect(409);
    });

    it('ne se clôt pas sans plage ouverte', async () => {
      await close(await tournament()).expect(409);
      await close(await tournament({ checkInOpensAt: '2030-11-30T00:00:00Z' })).expect(409);
    });
  });

  describe('champs personnalisés', () => {
    const customFields = [
      { label: 'Pseudo en jeu', required: true },
      { label: 'Rang', options: ['Or', 'Argent'] },
    ];

    it('exige les réponses et les montre à l’organisateur', async () => {
      const id = await tournament({ customFields });
      const missing = await enter(id, player).expect(400);
      expect((missing.body as ApiError).issues?.map((issue) => issue.path)).toEqual([
        'customFieldValues.Pseudo en jeu',
      ]);
      await enter(id, player, {
        customFieldValues: { 'Pseudo en jeu': 'Faker', Rang: 'Bronze' },
      }).expect(400);

      await enter(id, player, {
        customFieldValues: { 'Pseudo en jeu': 'Faker', Rang: 'Or', Inconnu: 'x' },
      }).expect(201);
      const list = await http()
        .get(`/me/tournaments/${id}/registrations`)
        .set(bearer(organizer))
        .expect(200);
      expect((list.body as TournamentRegistration[])[0]?.customFieldValues).toEqual({
        'Pseudo en jeu': 'Faker',
        Rang: 'Or',
      });
    });
  });

  describe('seeding manuel', () => {
    it('enregistre l’ordre choisi, pour l’organisateur seulement', async () => {
      const id = await tournament();
      await enter(id, player).expect(201);
      await enter(id, captain).expect(201);
      const list = async () =>
        (await http().get(`/me/tournaments/${id}/registrations`).set(bearer(organizer)).expect(200))
          .body as TournamentRegistration[];
      const [first, second] = await list();
      const participantIds = [second?.participantId, first?.participantId];

      const seed = (as: Account, ids: unknown[]) =>
        http().put(`/tournaments/${id}/seeds`).set(bearer(as)).send({ participantIds: ids });
      await seed(player, participantIds).expect(403);
      await seed(organizer, ['00000000-0000-4000-8000-000000000000']).expect(404);
      await seed(organizer, participantIds).expect(204);

      const [reloadedFirst, reloadedSecond] = await list();
      expect(reloadedFirst?.seed).toBe(2);
      expect(reloadedSecond?.seed).toBe(1);
    });
  });

  describe('titulaires et remplaçants', () => {
    it('compte les titulaires pour le minimum et tout l’effectif pour le maximum', async () => {
      const { id: teamId, ...created } = await team(captain, player, otherCaptain);
      const role = (memberId: string, value: string, as = captain) =>
        http().patch(`/teams/${teamId}/members/${memberId}`).set(bearer(as)).send({ role: value });
      await role(otherCaptain.id, 'SUBSTITUTE', player).expect(403);
      await role(organizer.id, 'SUBSTITUTE').expect(404);
      await role(otherCaptain.id, 'SUBSTITUTE').expect(204);
      await role(player.id, 'SUBSTITUTE').expect(204);

      const id = await teamTournament({ teamSizeMin: 2, teamSizeMax: 3 });
      expect(message(await enter(id, captain, { teamId }).expect(409))).toMatch(/2 titulaires/);

      await role(player.id, 'STARTER').expect(204);
      await enter(id, captain, { teamId }).expect(201);
      const tooSmall = await teamTournament({ teamSizeMin: 2, teamSizeMax: 2 });
      expect(message(await enter(tooSmall, captain, { teamId }).expect(409))).toMatch(/limite/);
      expect(created.name).toContain(run);
    });
  });

  describe('accès par le lien', () => {
    const bySlug = (slug: string) => http().get(`/tournaments/${slug}`);
    const slugOf = async (id: string) =>
      (await prisma.tournament.findUniqueOrThrow({ where: { id } })).slug;

    it('ouvre un tournoi sur invitation, et son inscription', async () => {
      const id = await tournament({ visibility: 'UNLISTED' });
      const res = await bySlug(await slugOf(id)).expect(200);
      expect((res.body as TournamentDetail).id).toBe(id);
      await enter(id, player).expect(201);
    });

    it('cache les brouillons et les tournois privés', async () => {
      await bySlug(await slugOf(await tournament({}, false))).expect(404);
      await bySlug(await slugOf(await tournament({ visibility: 'PRIVATE' }))).expect(404);
    });
  });
});

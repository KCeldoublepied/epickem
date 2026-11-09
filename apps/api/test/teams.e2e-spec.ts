import type { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type { ApiError, TeamDetail, TeamInvitation } from '@epickem/shared';
import { AppModule } from '../src/app.module';
import { validateEnv } from '../src/config/env';
import { PrismaService } from '../src/prisma/prisma.service';

// Tests sur une vraie base PostgreSQL : les comptes et équipes créés ici sont supprimés à la fin.
const DOMAIN = 'teams.e2e.test';
// Le préfixe évite les pseudos identiques avec les autres fichiers de tests, lancés en parallèle.
const run = `t${Date.now().toString(36)}`;

interface Account {
  id: string;
  token: string;
}

describe('équipes', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let captain: Account;
  let player: Account;
  let outsider: Account;
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

  async function createTeam(name = `Équipe ${run}`): Promise<TeamDetail> {
    const res = await http().post('/teams').set(bearer(captain)).send({ name }).expect(201);
    return res.body as TeamDetail;
  }
  const join = (code: string | null, as: Account) =>
    http().post(`/teams/invitations/${code}`).set(bearer(as));
  const remove = (teamId: string, memberId: string, as: Account) =>
    http().delete(`/teams/${teamId}/members/${memberId}`).set(bearer(as));
  const myTeams = async (as: Account) =>
    (await http().get('/me/teams').set(bearer(as)).expect(200)).body as TeamDetail[];

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

    captain = await register('chef');
    player = await register('joueur');
    outsider = await register('autre');
  });

  afterAll(async () => {
    await prisma.team.deleteMany({ where: { captain: { email: { endsWith: `@${DOMAIN}` } } } });
    await prisma.user.deleteMany({ where: { email: { endsWith: `@${DOMAIN}` } } });
    await app.close();
  });

  it('fait du créateur le chef et le premier membre', async () => {
    const res = await http()
      .post('/teams')
      .set(bearer(captain))
      .send({ name: `  Les Aigles ${run}  `, tag: 'AIG' })
      .expect(201);
    const team = res.body as TeamDetail;
    expect(team).toMatchObject({
      name: `Les Aigles ${run}`,
      tag: 'AIG',
      captainId: captain.id,
      inviteCode: expect.any(String) as string,
    });
    expect(team.members.map((member) => member.id)).toEqual([captain.id]);
  });

  it('refuse un nom invalide et exige une connexion', async () => {
    const res = await http().post('/teams').set(bearer(captain)).send({ name: 'A' }).expect(400);
    expect((res.body as ApiError).issues?.map((issue) => issue.path)).toEqual(['name']);
    await http().post('/teams').send({ name: 'Anonyme' }).expect(401);
  });

  it('montre l’invitation sans connexion, sans révéler les membres', async () => {
    const team = await createTeam();
    const res = await http().get(`/teams/invitations/${team.inviteCode}`).expect(200);
    expect(res.body as TeamInvitation).toEqual({
      name: team.name,
      tag: null,
      captainName: `chef_${run}`,
      memberCount: 1,
    });
    await http().get('/teams/invitations/inconnu').expect(404);
  });

  it('fait rejoindre l’équipe par le lien, une seule fois', async () => {
    const team = await createTeam();
    await http().post(`/teams/invitations/${team.inviteCode}`).expect(401);

    const res = await join(team.inviteCode, player).expect(201);
    expect((res.body as TeamDetail).members.map((member) => member.id)).toEqual([
      captain.id,
      player.id,
    ]);
    await join(team.inviteCode, player).expect(409);
    await join('inconnu', player).expect(404);
    expect((await myTeams(player)).map(({ id }) => id)).toContain(team.id);
    expect((await myTeams(outsider)).map(({ id }) => id)).not.toContain(team.id);
  });

  it('réserve le lien d’invitation au chef d’équipe', async () => {
    const team = await createTeam();
    await join(team.inviteCode, player).expect(201);

    const mine = await myTeams(captain);
    expect(mine.find(({ id }) => id === team.id)?.inviteCode).toBe(team.inviteCode);
    const theirs = await myTeams(player);
    expect(theirs.find(({ id }) => id === team.id)?.inviteCode).toBeNull();
    await http().post(`/teams/${team.id}/invite-code`).set(bearer(player)).expect(403);
  });

  it('invalide l’ancien lien quand il est renouvelé', async () => {
    const team = await createTeam();
    const res = await http().post(`/teams/${team.id}/invite-code`).set(bearer(captain)).expect(200);
    const { inviteCode } = res.body as TeamDetail;
    expect(inviteCode).not.toBe(team.inviteCode);
    await join(team.inviteCode, player).expect(404);
    await join(inviteCode, player).expect(201);
  });

  it('empêche un membre retiré de revenir avec l’ancien lien', async () => {
    const team = await createTeam();
    await join(team.inviteCode, player).expect(201);

    await remove(team.id, player.id, captain).expect(204);
    expect((await myTeams(player)).map(({ id }) => id)).not.toContain(team.id);
    await join(team.inviteCode, player).expect(404);
  });

  it('laisse un membre partir, sans changer le lien', async () => {
    const team = await createTeam();
    await join(team.inviteCode, player).expect(201);
    await remove(team.id, player.id, player).expect(204);
    await join(team.inviteCode, player).expect(201);
  });

  it('protège les membres et le chef d’équipe', async () => {
    const team = await createTeam();
    await join(team.inviteCode, player).expect(201);

    await remove(team.id, player.id, outsider).expect(403);
    await remove(team.id, captain.id, player).expect(403);
    const res = await remove(team.id, captain.id, captain).expect(409);
    expect((res.body as ApiError).message).toMatch(/ne peut pas quitter/);
    await remove(team.id, outsider.id, captain).expect(404);
    await remove('00000000-0000-4000-8000-000000000000', player.id, captain).expect(404);
  });
});

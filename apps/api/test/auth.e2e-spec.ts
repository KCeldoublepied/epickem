import type { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type { ApiError, AuthResponse, UserProfile } from '@epickem/shared';
import { AppModule } from '../src/app.module';
import { SESSION_COOKIE } from '../src/auth/session-cookie';
import { validateEnv } from '../src/config/env';
import { PrismaService } from '../src/prisma/prisma.service';

// Tests sur une vraie base PostgreSQL (docker compose en local, service postgres en CI).
// Les comptes créés utilisent un domaine réservé aux tests et sont supprimés à la fin.
const DOMAIN = 'auth.e2e.test';
const run = Date.now().toString(36);
const PASSWORD = 'mot de passe solide';

async function createApp(overrides: Record<string, string> = {}): Promise<INestApplication> {
  const env = validateEnv({
    DATABASE_URL:
      process.env['DATABASE_URL'] ?? 'postgresql://epickem:epickem@localhost:5432/epickem',
    // Supertest parle HTTP : un cookie « Secure » ne serait pas renvoyé.
    COOKIE_SECURE: 'false',
    AUTH_RATE_LIMIT: '1000',
    ...overrides,
  });
  const moduleRef = await Test.createTestingModule({
    imports: [AppModule.forRoot(env)],
  }).compile();
  const app = moduleRef.createNestApplication({ logger: false });
  await app.init();
  return app;
}

function account(name: string) {
  return { email: `${name}-${run}@${DOMAIN}`, username: `${name}_${run}`, password: PASSWORD };
}

function sessionCookie(res: request.Response): string {
  const cookies = ([] as string[]).concat(res.headers['set-cookie'] ?? []);
  const cookie = cookies.find((value) => value.startsWith(`${SESSION_COOKIE}=`));
  if (!cookie) throw new Error('Pas de cookie de session dans la réponse');
  return cookie.split(';')[0]!;
}

describe('authentification', () => {
  let app: INestApplication;
  const http = () => request(app.getHttpServer());

  beforeAll(async () => {
    app = await createApp();
  });

  afterAll(async () => {
    await app.get(PrismaService).user.deleteMany({ where: { email: { endsWith: `@${DOMAIN}` } } });
    await app.close();
  });

  describe('inscription', () => {
    it('crée le compte, ouvre une session en cookie httpOnly et ne renvoie aucun secret', async () => {
      const alice = account('alice');
      const res = await http()
        .post('/auth/register')
        .send({
          ...alice,
          email: `  ${alice.email.toUpperCase()} `,
          username: alice.username.toUpperCase(),
        })
        .expect(201);

      const body = res.body as AuthResponse;
      expect(body.user).toMatchObject({
        email: alice.email,
        username: alice.username,
        displayName: alice.username,
      });
      expect(body.token).toBeUndefined();
      expect(JSON.stringify(body)).not.toMatch(/password|hash/i);

      const cookie = ([] as string[]).concat(res.headers['set-cookie'] ?? []).join(';');
      expect(cookie).toMatch(/HttpOnly/i);
      expect(cookie).toMatch(/SameSite=Lax/i);

      const me = await http().get('/me').set('Cookie', sessionCookie(res)).expect(200);
      expect((me.body as UserProfile).id).toBe(body.user.id);
    });

    it('refuse un e-mail ou un pseudo déjà pris, en désignant les champs', async () => {
      const bob = account('bob');
      await http().post('/auth/register').send(bob).expect(201);
      const res = await http().post('/auth/register').send(bob).expect(409);
      expect((res.body as ApiError).issues?.map((issue) => issue.path)).toEqual([
        'email',
        'username',
      ]);
    });

    it('refuse des données invalides', async () => {
      const res = await http()
        .post('/auth/register')
        .send({ email: 'pas-un-email', username: 'a b', password: 'court' })
        .expect(400);
      expect((res.body as ApiError).issues?.map((issue) => issue.path)).toEqual([
        'email',
        'username',
        'password',
      ]);
    });
  });

  describe('connexion', () => {
    const carol = account('carol');

    beforeAll(async () => {
      await http().post('/auth/register').send(carol).expect(201);
    });

    it('accepte le pseudo ou l’e-mail, sans tenir compte de la casse', async () => {
      for (const identifier of [carol.username.toUpperCase(), carol.email]) {
        const res = await http()
          .post('/auth/login')
          .send({ identifier, password: PASSWORD })
          .expect(200);
        expect((res.body as AuthResponse).user.username).toBe(carol.username);
      }
    });

    it('même erreur pour un mauvais mot de passe et un compte inconnu', async () => {
      const wrongPassword = await http()
        .post('/auth/login')
        .send({ identifier: carol.username, password: 'mauvais mot de passe' })
        .expect(401);
      const unknown = await http()
        .post('/auth/login')
        .send({ identifier: `inconnu_${run}`, password: PASSWORD })
        .expect(401);
      expect(wrongPassword.body).toEqual(unknown.body);
      expect((unknown.body as ApiError).message).toBe('Identifiants invalides');
    });

    it('mobile : renvoie le jeton dans la réponse, utilisable en Bearer', async () => {
      const res = await http()
        .post('/auth/login')
        .set('X-Session-Transport', 'bearer')
        .send({ identifier: carol.username, password: PASSWORD })
        .expect(200);
      const { token } = res.body as AuthResponse;
      expect(token).toEqual(expect.any(String));
      expect(res.headers['set-cookie']).toBeUndefined();

      await http().get('/me').set('Authorization', `Bearer ${token}`).expect(200);
    });
  });

  describe('accès aux routes', () => {
    it('refuse les routes protégées sans session, ou avec un jeton inconnu', async () => {
      await http().get('/me').expect(401);
      await http().get('/me').set('Authorization', 'Bearer jeton-invente').expect(401);
      await http().get('/me').set('Cookie', `${SESSION_COOKIE}=jeton-invente`).expect(401);
    });

    it('laisse les routes publiques ouvertes', async () => {
      await http().get('/health').expect(200);
    });

    it('la déconnexion invalide la session', async () => {
      const res = await http().post('/auth/register').send(account('dave')).expect(201);
      const cookie = sessionCookie(res);
      await http().post('/auth/logout').set('Cookie', cookie).expect(204);
      await http().get('/me').set('Cookie', cookie).expect(401);
    });
  });

  describe('profil', () => {
    it('modifie le pseudo et le nom affiché, mais refuse un pseudo déjà pris', async () => {
      const erin = account('erin');
      const frank = account('frank');
      const res = await http().post('/auth/register').send(erin).expect(201);
      await http().post('/auth/register').send(frank).expect(201);
      const cookie = sessionCookie(res);

      const updated = await http()
        .patch('/me')
        .set('Cookie', cookie)
        .send({ username: `Erin2_${run}`, displayName: 'Erin la Grande' })
        .expect(200);
      expect(updated.body).toMatchObject({
        username: `erin2_${run}`,
        displayName: 'Erin la Grande',
      });

      await http()
        .patch('/me')
        .set('Cookie', cookie)
        .send({ username: frank.username })
        .expect(409);
    });

    it('change le mot de passe et déconnecte les autres appareils', async () => {
      const gina = account('gina');
      const first = await http().post('/auth/register').send(gina).expect(201);
      const second = await http()
        .post('/auth/login')
        .send({ identifier: gina.username, password: PASSWORD })
        .expect(200);
      const current = sessionCookie(first);
      const other = sessionCookie(second);
      const newPassword = 'nouveau mot de passe solide';

      await http()
        .patch('/me/password')
        .set('Cookie', current)
        .send({ currentPassword: 'mauvais mot de passe', newPassword })
        .expect(403);
      await http()
        .patch('/me/password')
        .set('Cookie', current)
        .send({ currentPassword: PASSWORD, newPassword })
        .expect(204);

      await http().get('/me').set('Cookie', current).expect(200);
      await http().get('/me').set('Cookie', other).expect(401);
      await http()
        .post('/auth/login')
        .send({ identifier: gina.username, password: newPassword })
        .expect(200);
    });
  });
});

describe('limite de tentatives de connexion', () => {
  let app: INestApplication;

  beforeAll(async () => {
    app = await createApp({ AUTH_RATE_LIMIT: '2' });
  });

  afterAll(async () => {
    await app.close();
  });

  it('bloque au-delà de la limite par minute', async () => {
    const attempt = () =>
      request(app.getHttpServer())
        .post('/auth/login')
        .send({ identifier: `inconnu_${run}`, password: PASSWORD });
    await attempt().expect(401);
    await attempt().expect(401);
    const res = await attempt().expect(429);
    expect(res.body).toMatchObject({ statusCode: 429, error: 'TOO_MANY_REQUESTS' });
  });
});

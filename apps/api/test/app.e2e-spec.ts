import {
  Body,
  Controller,
  Get,
  type INestApplication,
  NotFoundException,
  Post,
} from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { z } from 'zod';
import type { ApiError } from '@epickem/shared';
import { AppModule } from '../src/app.module';
import { Public } from '../src/auth/auth.decorators';
import { validateEnv } from '../src/config/env';
import { setupSwagger } from '../src/swagger';

const createSchema = z.object({
  name: z.string().min(3),
  maxParticipants: z.number().int().positive().optional(),
});

/** Routes propres aux tests, pour vérifier la validation et le format des erreurs. */
@Public()
@Controller('test')
class TestController {
  @Post('validation')
  create(@Body({ schema: createSchema }) body: z.infer<typeof createSchema>) {
    return body;
  }

  @Get('not-found')
  notFound(): never {
    throw new NotFoundException('Tournoi introuvable');
  }

  @Get('bug')
  bug(): never {
    throw new Error('détail interne : mot de passe secret123');
  }
}

describe('API', () => {
  let app: INestApplication;

  beforeAll(async () => {
    // La base n'est pas sollicitée par ces tests : Prisma ne se connecte qu'à la première requête.
    const env = validateEnv({
      DATABASE_URL: 'postgresql://epickem:epickem@localhost:5432/epickem',
    });
    const moduleRef = await Test.createTestingModule({
      imports: [AppModule.forRoot(env)],
      controllers: [TestController],
    }).compile();
    app = moduleRef.createNestApplication({ logger: false });
    setupSwagger(app);
    await app.init();
  });

  afterAll(async () => {
    await app.close();
  });

  it('GET /health répond', async () => {
    const res = await request(app.getHttpServer()).get('/health').expect(200);
    expect(res.body).toMatchObject({ status: 'ok', service: 'api' });
  });

  describe('validation des requêtes', () => {
    it('accepte des données valides', async () => {
      const body = { name: 'Coupe EPSI', maxParticipants: 16 };
      const res = await request(app.getHttpServer())
        .post('/test/validation')
        .send(body)
        .expect(201);
      expect(res.body).toEqual(body);
    });

    it('refuse des données invalides avec la liste des champs', async () => {
      const res = await request(app.getHttpServer())
        .post('/test/validation')
        .send({ name: 'ab', maxParticipants: -3 })
        .expect(400);
      const error = res.body as ApiError;
      expect(error).toMatchObject({
        statusCode: 400,
        error: 'BAD_REQUEST',
        message: 'Données invalides',
      });
      expect(error.issues?.map((issue) => issue.path)).toEqual(['name', 'maxParticipants']);
    });

    it('supprime les champs que le schéma ne prévoit pas', async () => {
      const res = await request(app.getHttpServer())
        .post('/test/validation')
        .send({ name: 'Coupe EPSI', role: 'ADMIN' })
        .expect(201);
      expect(res.body).toEqual({ name: 'Coupe EPSI' });
    });
  });

  describe('format des erreurs', () => {
    it('JSON mal formé : 400', async () => {
      const res = await request(app.getHttpServer())
        .post('/test/validation')
        .set('Content-Type', 'application/json')
        .send('{ "name": ')
        .expect(400);
      expect(res.body).toMatchObject({ statusCode: 400, error: 'BAD_REQUEST' });
    });

    it('route inexistante : 404', async () => {
      const res = await request(app.getHttpServer()).get('/nexiste-pas').expect(404);
      expect(res.body).toMatchObject({ statusCode: 404, error: 'NOT_FOUND' });
    });

    it('erreur volontaire : garde son message', async () => {
      const res = await request(app.getHttpServer()).get('/test/not-found').expect(404);
      expect(res.body).toEqual({
        statusCode: 404,
        error: 'NOT_FOUND',
        message: 'Tournoi introuvable',
      });
    });

    it('bug : 500 sans aucun détail interne', async () => {
      const res = await request(app.getHttpServer()).get('/test/bug').expect(500);
      expect(res.body).toEqual({
        statusCode: 500,
        error: 'INTERNAL_SERVER_ERROR',
        message: 'Erreur interne du serveur',
      });
      expect(JSON.stringify(res.body)).not.toContain('secret123');
    });
  });

  it('la documentation reprend les schémas Zod des routes', async () => {
    const res = await request(app.getHttpServer()).get('/api/docs-json').expect(200);
    const schema =
      res.body.paths['/test/validation'].post.requestBody.content['application/json'].schema;
    expect(schema).toMatchObject({
      type: 'object',
      properties: { name: { type: 'string', minLength: 3 } },
      required: ['name'],
    });
  });
});

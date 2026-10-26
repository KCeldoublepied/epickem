import path from 'node:path';
import { config as loadEnv } from 'dotenv';
import { defineConfig } from 'prisma/config';

// En local, DATABASE_URL vient du fichier .env à la racine du monorepo (copie de .env.example).
// Dans Docker et en CI, elle est fournie par l'environnement.
loadEnv({ path: path.resolve(__dirname, '../../.env'), quiet: true });

export default defineConfig({
  schema: 'prisma/schema.prisma',
  migrations: {
    path: 'prisma/migrations',
    seed: 'tsx prisma/seed.ts',
  },
  datasource: {
    // process.env plutôt que env() : `prisma generate` doit fonctionner sans base (build Docker, CI).
    url: process.env['DATABASE_URL'],
  },
});

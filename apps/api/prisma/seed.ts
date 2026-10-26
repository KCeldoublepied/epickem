// Données de départ pour développer : les jeux et leurs statistiques suivies.
// Lancer : pnpm --filter @epickem/api db:seed — le script peut être relancé sans créer de doublons.
// Les données de démonstration (joueurs, tournois…) relèvent du simulateur (#54).

import path from 'node:path';
import { config as loadEnv } from 'dotenv';
import { PrismaPg } from '@prisma/adapter-pg';
import { validateEnv } from '../src/config/env';
import { type Prisma, PrismaClient, StatScope, StatType } from '../src/generated/prisma/client';

loadEnv({ path: path.resolve(__dirname, '../../../.env'), quiet: true });

type GameSeed = Prisma.GameCreateInput & {
  stats: Omit<Prisma.GameStatCreateManyInput, 'gameId'>[];
};

const GAMES: GameSeed[] = [
  {
    slug: 'valorant',
    name: 'Valorant',
    stats: [
      {
        key: 'map',
        label: 'Carte',
        type: StatType.CHOICE,
        scope: StatScope.MATCH_GAME,
        options: ['Ascent', 'Bind', 'Haven', 'Lotus', 'Split'],
      },
      {
        key: 'rounds',
        label: 'Rounds gagnés',
        type: StatType.NUMBER,
        scope: StatScope.PARTICIPANT,
      },
    ],
  },
  {
    slug: 'street-fighter-6',
    name: 'Street Fighter 6',
    stats: [
      {
        key: 'character',
        label: 'Personnage',
        type: StatType.CHOICE,
        scope: StatScope.PARTICIPANT,
        options: ['Ryu', 'Ken', 'Chun-Li', 'Luke', 'Juri'],
      },
      { key: 'perfect', label: 'Perfect', type: StatType.BOOLEAN, scope: StatScope.PARTICIPANT },
    ],
  },
];

async function main(): Promise<void> {
  const env = validateEnv(process.env);
  const prisma = new PrismaClient({
    adapter: new PrismaPg({ connectionString: env.DATABASE_URL }),
  });

  try {
    for (const { stats, ...game } of GAMES) {
      // upsert : crée la ligne si elle n'existe pas, la met à jour sinon.
      const { id: gameId } = await prisma.game.upsert({
        where: { slug: game.slug },
        update: { name: game.name },
        create: game,
      });
      for (const stat of stats) {
        await prisma.gameStat.upsert({
          where: { gameId_key: { gameId, key: stat.key } },
          update: stat,
          create: { ...stat, gameId },
        });
      }
      console.warn(`Jeu « ${game.name} » : ${stats.length} statistique(s)`);
    }
  } finally {
    await prisma.$disconnect();
  }
}

void main();

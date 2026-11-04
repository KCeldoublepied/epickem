// Données de départ pour développer : les jeux et leurs statistiques suivies.
// Lancer : pnpm --filter @epickem/api db:seed — le script peut être relancé sans créer de doublons.
// Les données de démonstration (joueurs, tournois…) relèvent du simulateur (#54).

import path from 'node:path';
import { config as loadEnv } from 'dotenv';
import { PrismaPg } from '@prisma/adapter-pg';
import { GAME_CATALOG } from '@epickem/shared';
import { validateEnv } from '../src/config/env';
import { type Prisma, PrismaClient, StatScope, StatType } from '../src/generated/prisma/client';

loadEnv({ path: path.resolve(__dirname, '../../../.env'), quiet: true });

type GameSeed = Prisma.GameCreateInput & {
  stats: Omit<Prisma.GameStatCreateManyInput, 'gameId'>[];
};

/** Noms proposés par le catalogue des réglages, pour que les statistiques suivent les mêmes listes. */
function catalogOptions(slug: string, key: string): string[] {
  const field = GAME_CATALOG[slug]?.fields.find((candidate) => candidate.key === key);
  if (field?.kind !== 'multiselect') throw new Error(`Réglage ${slug}.${key} introuvable`);
  return field.options.map((option) => option.label);
}

const kills = { key: 'kills', label: 'Éliminations', type: StatType.NUMBER };

const GAMES: GameSeed[] = [
  {
    slug: 'league-of-legends',
    name: 'League of Legends',
    stats: [
      { key: 'champion', label: 'Champion', type: StatType.TEXT, scope: StatScope.PARTICIPANT },
      { ...kills, scope: StatScope.PARTICIPANT },
      { key: 'deaths', label: 'Morts', type: StatType.NUMBER, scope: StatScope.PARTICIPANT },
      { key: 'assists', label: 'Assistances', type: StatType.NUMBER, scope: StatScope.PARTICIPANT },
    ],
  },
  {
    slug: 'counter-strike-2',
    name: 'Counter-Strike 2',
    stats: [
      {
        key: 'map',
        label: 'Carte',
        type: StatType.CHOICE,
        scope: StatScope.MATCH_GAME,
        options: catalogOptions('counter-strike-2', 'mapPool'),
      },
      {
        key: 'rounds',
        label: 'Rounds gagnés',
        type: StatType.NUMBER,
        scope: StatScope.PARTICIPANT,
      },
      { ...kills, scope: StatScope.PARTICIPANT },
    ],
  },
  {
    slug: 'super-smash-bros-ultimate',
    name: 'Super Smash Bros. Ultimate',
    stats: [
      {
        key: 'stage',
        label: 'Stage',
        type: StatType.CHOICE,
        scope: StatScope.MATCH_GAME,
        options: catalogOptions('super-smash-bros-ultimate', 'starterStages'),
      },
      { key: 'character', label: 'Personnage', type: StatType.TEXT, scope: StatScope.PARTICIPANT },
      {
        key: 'stocks',
        label: 'Vies restantes',
        type: StatType.NUMBER,
        scope: StatScope.PARTICIPANT,
      },
    ],
  },
  {
    slug: 'rocket-league',
    name: 'Rocket League',
    stats: [
      {
        key: 'arena',
        label: 'Arène',
        type: StatType.CHOICE,
        scope: StatScope.MATCH_GAME,
        options: catalogOptions('rocket-league', 'arenas'),
      },
      { key: 'goals', label: 'Buts', type: StatType.NUMBER, scope: StatScope.PARTICIPANT },
      { key: 'saves', label: 'Arrêts', type: StatType.NUMBER, scope: StatScope.PARTICIPANT },
    ],
  },
  {
    slug: 'fortnite',
    name: 'Fortnite',
    stats: [
      { key: 'placement', label: 'Place', type: StatType.NUMBER, scope: StatScope.PARTICIPANT },
      { ...kills, scope: StatScope.PARTICIPANT },
    ],
  },
];

/** Jeux des premières versions du seed, retirés s'ils n'ont servi à aucun tournoi. */
const RETIRED_GAMES = ['valorant', 'street-fighter-6'];

async function main(): Promise<void> {
  const env = validateEnv(process.env);
  const prisma = new PrismaClient({
    adapter: new PrismaPg({ connectionString: env.DATABASE_URL }),
  });

  try {
    await prisma.game.deleteMany({
      where: { slug: { in: RETIRED_GAMES }, tournaments: { none: {} } },
    });
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

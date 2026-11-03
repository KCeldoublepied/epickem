import { randomBytes } from 'node:crypto';
import { BadRequestException, Injectable } from '@nestjs/common';
import type { CreateTournamentInput, TournamentDetail } from '@epickem/shared';
import { isUniqueViolation } from '../auth/auth.service';
import type { Prisma } from '../generated/prisma/client';
import { PrismaService } from '../prisma/prisma.service';

const TOURNAMENT_SELECT = {
  id: true,
  slug: true,
  name: true,
  description: true,
  rules: true,
  status: true,
  visibility: true,
  startsAt: true,
  endsAt: true,
  locationType: true,
  location: true,
  participantType: true,
  teamSizeMin: true,
  teamSizeMax: true,
  maxParticipants: true,
  registrationMode: true,
  registrationOpensAt: true,
  registrationClosesAt: true,
  checkInOpensAt: true,
  createdAt: true,
  updatedAt: true,
  game: { select: { id: true, slug: true, name: true } },
  organizer: { select: { id: true, username: true, displayName: true } },
} satisfies Prisma.TournamentSelect;

type TournamentRow = Prisma.TournamentGetPayload<{ select: typeof TOURNAMENT_SELECT }>;

const SLUG_ATTEMPTS = 5;

@Injectable()
export class TournamentsService {
  constructor(private readonly prisma: PrismaService) {}

  async create(organizerId: string, input: CreateTournamentInput): Promise<TournamentDetail> {
    const game = await this.prisma.game.findUnique({
      where: { id: input.gameId },
      select: { id: true },
    });
    if (!game) {
      throw new BadRequestException({
        message: 'Données invalides',
        issues: [{ path: 'gameId', message: 'Jeu introuvable' }],
      });
    }

    const data = {
      ...input,
      organizerId,
      startsAt: toDate(input.startsAt),
      endsAt: toDate(input.endsAt),
      registrationOpensAt: toDate(input.registrationOpensAt),
      registrationClosesAt: toDate(input.registrationClosesAt),
      checkInOpensAt: toDate(input.checkInOpensAt),
    } satisfies Omit<Prisma.TournamentUncheckedCreateInput, 'slug'>;

    const base = slugify(input.name);
    for (let attempt = 0; ; attempt++) {
      const slug = attempt === 0 ? base : `${base}-${randomBytes(3).toString('hex')}`;
      try {
        const row = await this.prisma.tournament.create({
          data: { ...data, slug },
          select: TOURNAMENT_SELECT,
        });
        return toTournamentDetail(row);
      } catch (error) {
        if (isUniqueViolation(error) && attempt < SLUG_ATTEMPTS) continue;
        throw error;
      }
    }
  }
}

/** "Coupe d'Été 2026 !" → "coupe-d-ete-2026" */
export function slugify(name: string): string {
  const slug = name
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .slice(0, 60)
    .replace(/^-+|-+$/g, '');
  return slug || 'tournoi';
}

function toDate(value: string | undefined): Date | undefined {
  return value === undefined ? undefined : new Date(value);
}

const iso = (date: Date | null) => date?.toISOString() ?? null;

function toTournamentDetail(row: TournamentRow): TournamentDetail {
  return {
    ...row,
    startsAt: iso(row.startsAt),
    endsAt: iso(row.endsAt),
    registrationOpensAt: iso(row.registrationOpensAt),
    registrationClosesAt: iso(row.registrationClosesAt),
    checkInOpensAt: iso(row.checkInOpensAt),
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}

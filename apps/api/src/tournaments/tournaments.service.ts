import { randomBytes } from 'node:crypto';
import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import type {
  CreateTournamentInput,
  ListQuery,
  Page,
  TournamentDetail,
  TournamentStatus,
  TournamentSummary,
} from '@epickem/shared';
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

const SUMMARY_SELECT = {
  id: true,
  slug: true,
  name: true,
  status: true,
  visibility: true,
  startsAt: true,
  locationType: true,
  location: true,
  participantType: true,
  maxParticipants: true,
  registrationMode: true,
  registrationClosesAt: true,
  game: { select: { id: true, slug: true, name: true } },
  organizer: { select: { id: true, username: true, displayName: true } },
  _count: { select: { participants: true } },
} satisfies Prisma.TournamentSelect;

type SummaryRow = Prisma.TournamentGetPayload<{ select: typeof SUMMARY_SELECT }>;

/**
 * Tournois de la liste publique : publics et publiés. Les brouillons ne sont visibles que
 * par leur organisateur ; les tournois non répertoriés ou privés ne sont jamais listés.
 */
const PUBLIC_LISTING = {
  visibility: 'PUBLIC',
  status: { in: ['REGISTRATION', 'IN_PROGRESS', 'COMPLETED'] },
} satisfies Prisma.TournamentWhereInput;

/** Statuts dans lesquels l'organisateur peut encore modifier le tournoi. */
const EDITABLE_STATUSES: TournamentStatus[] = ['DRAFT', 'REGISTRATION'];

const SLUG_ATTEMPTS = 5;

@Injectable()
export class TournamentsService {
  constructor(private readonly prisma: PrismaService) {}

  async create(organizerId: string, input: CreateTournamentInput): Promise<TournamentDetail> {
    await this.assertGameExists(input.gameId);
    const data = { ...toTournamentData(input), organizerId };

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

  listPublic(query: ListQuery): Promise<Page<TournamentSummary>> {
    return this.page(query, PUBLIC_LISTING, [
      { startsAt: { sort: 'asc', nulls: 'last' } },
      { createdAt: 'desc' },
      { id: 'asc' },
    ]);
  }

  listOrganizedBy(organizerId: string, query: ListQuery): Promise<Page<TournamentSummary>> {
    return this.page(query, { organizerId }, [{ createdAt: 'desc' }, { id: 'asc' }]);
  }

  /** Tournoi complet pour son organisateur, quel que soit son statut (formulaire d'édition). */
  async findOrganizedBy(userId: string, tournamentId: string): Promise<TournamentDetail> {
    await this.assertOrganizer(userId, tournamentId);
    const row = await this.prisma.tournament.findUniqueOrThrow({
      where: { id: tournamentId },
      select: TOURNAMENT_SELECT,
    });
    return toTournamentDetail(row);
  }

  async update(
    userId: string,
    tournamentId: string,
    input: CreateTournamentInput,
  ): Promise<TournamentDetail> {
    const status = await this.assertOrganizer(userId, tournamentId);
    if (!EDITABLE_STATUSES.includes(status)) {
      throw new ConflictException('Un tournoi commencé, terminé ou annulé ne se modifie plus');
    }
    await this.assertGameExists(input.gameId);
    const row = await this.prisma.tournament.update({
      where: { id: tournamentId },
      data: toTournamentData(input),
      select: TOURNAMENT_SELECT,
    });
    return toTournamentDetail(row);
  }

  async publish(userId: string, tournamentId: string): Promise<TournamentDetail> {
    const status = await this.assertOrganizer(userId, tournamentId);
    if (status !== 'DRAFT') throw new ConflictException('Ce tournoi est déjà publié');
    const row = await this.prisma.tournament.update({
      where: { id: tournamentId },
      data: { status: 'REGISTRATION' },
      select: TOURNAMENT_SELECT,
    });
    return toTournamentDetail(row);
  }

  /** 404 si le tournoi n'existe pas, 403 si le compte ne l'organise pas ; renvoie son statut. */
  private async assertOrganizer(userId: string, tournamentId: string) {
    const tournament = await this.prisma.tournament.findUnique({
      where: { id: tournamentId },
      select: { organizerId: true, status: true },
    });
    if (!tournament) throw new NotFoundException('Tournoi introuvable');
    if (tournament.organizerId !== userId) {
      throw new ForbiddenException("Seul l'organisateur peut gérer ce tournoi");
    }
    return tournament.status;
  }

  private async assertGameExists(gameId: string): Promise<void> {
    const game = await this.prisma.game.findUnique({ where: { id: gameId }, select: { id: true } });
    if (!game) {
      throw new BadRequestException({
        message: 'Données invalides',
        issues: [{ path: 'gameId', message: 'Jeu introuvable' }],
      });
    }
  }

  private async page(
    { cursor, limit }: ListQuery,
    where: Prisma.TournamentWhereInput,
    orderBy: Prisma.TournamentOrderByWithRelationInput[],
  ): Promise<Page<TournamentSummary>> {
    const rows = await this.prisma.tournament.findMany({
      where,
      orderBy,
      take: limit + 1,
      ...(cursor && { cursor: { id: cursor }, skip: 1 }),
      select: SUMMARY_SELECT,
    });
    const items = rows.slice(0, limit).map(toTournamentSummary);
    return { items, nextCursor: rows.length > limit ? (items.at(-1)?.id ?? null) : null };
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

const toDate = (value: string | undefined) => (value === undefined ? null : new Date(value));

/** Colonnes à écrire : les champs facultatifs absents valent null (effacés à la modification). */
function toTournamentData(input: CreateTournamentInput) {
  return {
    ...input,
    description: input.description ?? null,
    rules: input.rules ?? null,
    location: input.location ?? null,
    teamSizeMin: input.teamSizeMin ?? null,
    teamSizeMax: input.teamSizeMax ?? null,
    maxParticipants: input.maxParticipants ?? null,
    startsAt: toDate(input.startsAt),
    endsAt: toDate(input.endsAt),
    registrationOpensAt: toDate(input.registrationOpensAt),
    registrationClosesAt: toDate(input.registrationClosesAt),
    checkInOpensAt: toDate(input.checkInOpensAt),
  } satisfies Omit<Prisma.TournamentUncheckedUpdateInput, 'slug'>;
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

function toTournamentSummary({ _count, ...row }: SummaryRow): TournamentSummary {
  return {
    ...row,
    startsAt: iso(row.startsAt),
    registrationClosesAt: iso(row.registrationClosesAt),
    participantCount: _count.participants,
  };
}

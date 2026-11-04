import { randomBytes } from 'node:crypto';
import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import {
  type ApiErrorIssue,
  type CreateTournamentInput,
  type GameSettings,
  gameStructureIssues,
  type ListQuery,
  normalizeGameSettings,
  type Page,
  publicationIssues,
  type StageDetail,
  type TournamentDetail,
  type TournamentSettingsInput,
  type TournamentStatus,
  type TournamentSummary,
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
  gameSettings: true,
  createdAt: true,
  updatedAt: true,
  game: { select: { id: true, slug: true, name: true } },
  organizer: { select: { id: true, username: true, displayName: true } },
  stages: {
    select: {
      id: true,
      order: true,
      name: true,
      format: true,
      status: true,
      settings: true,
      startsAt: true,
    },
    orderBy: { order: 'asc' },
  },
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
    const data = {
      name: input.name,
      startsAt: new Date(input.startsAt),
      endsAt: new Date(input.endsAt),
      organizerId,
    };

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
    input: TournamentSettingsInput,
  ): Promise<TournamentDetail> {
    const status = await this.assertOrganizer(userId, tournamentId);
    if (!EDITABLE_STATUSES.includes(status)) {
      throw new ConflictException('Un tournoi commencé, terminé ou annulé ne se modifie plus');
    }
    const slug = input.gameId === undefined ? undefined : await this.gameSlug(input.gameId);
    const { settings: gameSettings, issues } = normalizeGameSettings(
      slug,
      input.gameSettings,
      input.locationType,
    );
    // Un tournoi publié doit rester publiable : on ne lui retire ni son jeu ni ses phases.
    const published =
      status === 'DRAFT'
        ? []
        : publicationIssues(input).map(({ path, message }) => ({ path: [path], message }));
    const problems = [...issues, ...gameStructureIssues(slug, input.stages), ...published];
    if (problems.length > 0) throw invalidData(problems);

    const row = await this.prisma.$transaction(async (tx) => {
      // Les phases gardent leur identifiant d'un enregistrement à l'autre, position par position.
      for (const [index, stage] of input.stages.entries()) {
        const order = index + 1;
        const data = {
          name: stage.name,
          format: stage.format,
          settings: stage.settings,
          startsAt: toDate(stage.startsAt),
        };
        await tx.stage.upsert({
          where: { tournamentId_order: { tournamentId, order } },
          update: data,
          create: { ...data, tournamentId, order },
        });
      }
      await tx.stage.deleteMany({ where: { tournamentId, order: { gt: input.stages.length } } });
      return tx.tournament.update({
        where: { id: tournamentId },
        data: { ...toTournamentData(input), gameSettings },
        select: TOURNAMENT_SELECT,
      });
    });
    return toTournamentDetail(row);
  }

  async publish(userId: string, tournamentId: string): Promise<TournamentDetail> {
    const status = await this.assertOrganizer(userId, tournamentId);
    if (status !== 'DRAFT') throw new ConflictException('Ce tournoi est déjà publié');
    const current = await this.prisma.tournament.findUniqueOrThrow({
      where: { id: tournamentId },
      select: TOURNAMENT_SELECT,
    });
    const issues = publicationIssues({ ...toTournamentDetail(current), gameId: current.game?.id });
    if (issues.length > 0) {
      throw new ConflictException({ message: 'Ce tournoi n’est pas prêt à être publié', issues });
    }
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

  private async gameSlug(gameId: string): Promise<string> {
    const game = await this.prisma.game.findUnique({
      where: { id: gameId },
      select: { slug: true },
    });
    if (!game) throw invalidData([{ path: ['gameId'], message: 'Jeu introuvable' }]);
    return game.slug;
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

/** Même erreur que la validation du corps de la requête, avec les mêmes chemins de champs. */
function invalidData(issues: { path: (string | number)[]; message: string }[]) {
  const details: ApiErrorIssue[] = issues.map(({ path, message }) => ({
    path: path.join('.'),
    message,
  }));
  return new BadRequestException({ message: 'Données invalides', issues: details });
}

/** Colonnes à écrire : les champs facultatifs absents valent null (effacés à la modification). */
function toTournamentData({
  stages: _stages,
  gameSettings: _settings,
  ...input
}: TournamentSettingsInput) {
  return {
    ...input,
    gameId: input.gameId ?? null,
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
    gameSettings: row.gameSettings as GameSettings,
    // Écrits après validation par stageInputSchema : la forme du JSON est garantie.
    stages: row.stages.map((stage) => ({ ...stage, startsAt: iso(stage.startsAt) }) as StageDetail),
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

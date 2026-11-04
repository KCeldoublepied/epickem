import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import type {
  MyRegistration,
  TournamentEntryInput,
  ReviewRegistrationInput,
  TournamentRegistration,
} from '@epickem/shared';
import type { AuthUser } from '../auth/auth-user';
import { isUniqueViolation } from '../auth/auth.service';
import type { Prisma } from '../generated/prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { TournamentsService } from './tournaments.service';

const ACTIVE_STATUSES = ['PENDING', 'ACCEPTED'] as const;

const MY_REGISTRATION_SELECT = {
  id: true,
  tournamentId: true,
  status: true,
  team: { select: { id: true, name: true, captainId: true } },
} satisfies Prisma.RegistrationSelect;

type MyRegistrationRow = Prisma.RegistrationGetPayload<{ select: typeof MY_REGISTRATION_SELECT }>;

/** Joueur ou équipe à engager dans le tournoi. */
interface Entrant {
  userId?: string;
  teamId?: string;
  displayName: string;
}

/**
 * Verrouille le tournoi jusqu'à la fin de la transaction : les inscriptions passent une par une,
 * sinon deux équipes pourraient prendre la dernière place en même temps.
 */
async function lockTournament(tx: Prisma.TransactionClient, tournamentId: string) {
  await tx.$queryRaw`SELECT 1 FROM "tournaments" WHERE "id" = ${tournamentId}::uuid FOR UPDATE`;
  const tournament = await tx.tournament.findUnique({
    where: { id: tournamentId },
    select: {
      id: true,
      status: true,
      visibility: true,
      startsAt: true,
      participantType: true,
      teamSizeMin: true,
      teamSizeMax: true,
      maxParticipants: true,
      registrationMode: true,
      registrationOpensAt: true,
      registrationClosesAt: true,
    },
  });
  if (!tournament) throw new NotFoundException('Tournoi introuvable');
  return tournament;
}

type LockedTournament = Awaited<ReturnType<typeof lockTournament>>;

function assertOpen(tournament: LockedTournament): void {
  if (tournament.status !== 'REGISTRATION') {
    throw new ConflictException('Les inscriptions à ce tournoi ne sont pas ouvertes');
  }
  if (tournament.visibility === 'PRIVATE') {
    throw new ForbiddenException('Ce tournoi est privé');
  }
  const now = new Date();
  const { registrationOpensAt: opensAt, registrationClosesAt, startsAt } = tournament;
  if (opensAt && opensAt > now) {
    throw new ConflictException('Les inscriptions à ce tournoi ne sont pas encore ouvertes');
  }
  const closesAt = registrationClosesAt ?? startsAt;
  if (closesAt && closesAt <= now) {
    throw new ConflictException('Les inscriptions à ce tournoi sont closes');
  }
}

/** Engage le joueur ou l'équipe, s'il reste de la place. */
async function addParticipant(
  tx: Prisma.TransactionClient,
  { id: tournamentId, maxParticipants }: LockedTournament,
  entrant: Entrant,
): Promise<string> {
  if (maxParticipants !== null) {
    const count = await tx.participant.count({ where: { tournamentId } });
    if (count >= maxParticipants) throw new ConflictException('Ce tournoi est complet');
  }
  const { id } = await tx.participant.create({
    data: { ...entrant, tournamentId },
    select: { id: true },
  });
  return id;
}

/**
 * shortcut: la composition n'est vérifiée qu'à l'inscription ; un membre peut encore partir ou
 * rejoindre une autre équipe inscrite. À revérifier au lancement du tournoi quand il existera.
 */
async function teamEntrant(
  tx: Prisma.TransactionClient,
  user: AuthUser,
  tournament: LockedTournament,
  teamId: string | undefined,
): Promise<Entrant> {
  if (teamId === undefined) {
    throw new BadRequestException({
      message: 'Données invalides',
      issues: [{ path: 'teamId', message: 'Choisissez une équipe.' }],
    });
  }
  const team = await tx.team.findUnique({
    where: { id: teamId },
    select: { name: true, captainId: true, members: { select: { userId: true } } },
  });
  if (!team) throw new NotFoundException('Équipe introuvable');
  if (team.captainId !== user.id) {
    throw new ForbiddenException("Seul le chef d'équipe peut inscrire son équipe");
  }

  const size = team.members.length;
  const { teamSizeMin: min, teamSizeMax: max } = tournament;
  if ((min !== null && size < min) || (max !== null && size > max)) {
    const expected = min === max ? `${min}` : `de ${min} à ${max}`;
    throw new ConflictException(
      `Ce tournoi demande ${expected} joueurs par équipe : la vôtre en compte ${size}`,
    );
  }

  const taken = await tx.registration.findFirst({
    where: {
      tournamentId: tournament.id,
      status: { in: [...ACTIVE_STATUSES] },
      teamId: { not: teamId },
      team: { members: { some: { userId: { in: team.members.map((m) => m.userId) } } } },
    },
    select: { id: true },
  });
  if (taken) {
    throw new ConflictException('Un joueur de cette équipe est déjà inscrit avec une autre équipe');
  }
  return { teamId, displayName: team.name };
}

function toMyRegistration(
  { team, ...registration }: MyRegistrationRow,
  userId: string,
): MyRegistration {
  return {
    ...registration,
    team: team && { id: team.id, name: team.name },
    canCancel: registration.status !== 'REJECTED' && (!team || team.captainId === userId),
  };
}

@Injectable()
export class RegistrationsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly tournaments: TournamentsService,
  ) {}

  /** Inscriptions du compte et de ses équipes, chef ou simple membre. */
  async listMine(userId: string): Promise<MyRegistration[]> {
    const rows = await this.prisma.registration.findMany({
      where: { OR: [{ userId }, { team: { members: { some: { userId } } } }] },
      select: MY_REGISTRATION_SELECT,
    });
    return rows.map((row) => toMyRegistration(row, userId));
  }

  async register(
    user: AuthUser,
    tournamentId: string,
    { teamId }: TournamentEntryInput,
  ): Promise<MyRegistration> {
    try {
      return await this.prisma.$transaction(async (tx) => {
        const tournament = await lockTournament(tx, tournamentId);
        assertOpen(tournament);

        if (tournament.participantType === 'SOLO' && teamId !== undefined) {
          throw new BadRequestException({
            message: 'Données invalides',
            issues: [{ path: 'teamId', message: 'Ce tournoi se joue sans équipe.' }],
          });
        }
        const entrant: Entrant =
          tournament.participantType === 'TEAM'
            ? await teamEntrant(tx, user, tournament, teamId)
            : { userId: user.id, displayName: user.displayName };

        const isOpen = tournament.registrationMode === 'OPEN';
        const row = await tx.registration.create({
          data: {
            tournamentId,
            userId: entrant.userId,
            teamId: entrant.teamId,
            status: isOpen ? 'ACCEPTED' : 'PENDING',
            participantId: isOpen ? await addParticipant(tx, tournament, entrant) : undefined,
          },
          select: MY_REGISTRATION_SELECT,
        });
        return toMyRegistration(row, user.id);
      });
    } catch (error) {
      if (isUniqueViolation(error)) {
        throw new ConflictException('Une inscription existe déjà pour ce tournoi');
      }
      throw error;
    }
  }

  /** Annulation par le joueur ou le chef d'équipe, tant que le tournoi n'a pas commencé. */
  async cancel(userId: string, tournamentId: string, registrationId: string): Promise<void> {
    await this.prisma.$transaction(async (tx) => {
      const { status: tournamentStatus } = await lockTournament(tx, tournamentId);
      const registration = await tx.registration.findFirst({
        where: { id: registrationId, tournamentId },
        select: {
          userId: true,
          status: true,
          participantId: true,
          team: { select: { captainId: true } },
        },
      });
      if (!registration) throw new NotFoundException('Inscription introuvable');
      if ((registration.team?.captainId ?? registration.userId) !== userId) {
        throw new ForbiddenException('Cette inscription ne vous appartient pas');
      }
      if (tournamentStatus !== 'REGISTRATION') {
        throw new ConflictException('Ce tournoi a commencé : l’inscription ne s’annule plus');
      }
      // Sinon, supprimer un refus permettrait de se réinscrire.
      if (registration.status === 'REJECTED') {
        throw new ConflictException('Cette inscription a été refusée');
      }
      await tx.registration.delete({ where: { id: registrationId } });
      if (registration.participantId) {
        await tx.participant.delete({ where: { id: registration.participantId } });
      }
    });
  }

  /** shortcut: pas de pagination, limité par la taille du tournoi ; à paginer si besoin. */
  async listForOrganizer(userId: string, tournamentId: string): Promise<TournamentRegistration[]> {
    await this.tournaments.assertOrganizer(userId, tournamentId);
    const rows = await this.prisma.registration.findMany({
      where: { tournamentId },
      orderBy: { createdAt: 'asc' },
      select: {
        id: true,
        status: true,
        user: { select: { displayName: true } },
        team: { select: { name: true, _count: { select: { members: true } } } },
      },
    });
    return rows.map(({ id, status, user, team }) => ({
      id,
      status,
      name: team?.name ?? user?.displayName ?? '',
      memberCount: team?._count.members ?? null,
    }));
  }

  async review(
    userId: string,
    tournamentId: string,
    registrationId: string,
    { status }: ReviewRegistrationInput,
  ): Promise<void> {
    await this.tournaments.assertOrganizer(userId, tournamentId);
    await this.prisma.$transaction(async (tx) => {
      const tournament = await lockTournament(tx, tournamentId);
      const registration = await tx.registration.findFirst({
        where: { id: registrationId, tournamentId },
        select: {
          status: true,
          userId: true,
          teamId: true,
          user: { select: { displayName: true } },
          team: { select: { name: true } },
        },
      });
      if (!registration) throw new NotFoundException('Inscription introuvable');
      if (registration.status !== 'PENDING') {
        throw new ConflictException('Cette inscription a déjà été traitée');
      }
      if (tournament.status !== 'REGISTRATION') {
        throw new ConflictException('Ce tournoi a commencé : l’inscription ne se traite plus');
      }

      const { userId: entrantUserId, teamId, user, team } = registration;
      const participantId =
        status === 'ACCEPTED'
          ? await addParticipant(tx, tournament, {
              userId: entrantUserId ?? undefined,
              teamId: teamId ?? undefined,
              displayName: team?.name ?? user?.displayName ?? '',
            })
          : undefined;
      await tx.registration.update({
        where: { id: registrationId },
        data: { status, participantId },
      });
    });
  }
}

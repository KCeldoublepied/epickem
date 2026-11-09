import {
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import {
  type CustomField,
  customFieldIssues,
  type MyRegistration,
  type ReviewRegistrationInput,
  type SeedsInput,
  type TournamentEntryInput,
  type TournamentRegistration,
} from '@epickem/shared';
import type { AuthUser } from '../auth/auth-user';
import { isUniqueViolation } from '../auth/auth.service';
import type { Prisma } from '../generated/prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { invalidData, TournamentsService } from './tournaments.service';

const ACTIVE_STATUSES = ['PENDING', 'ACCEPTED', 'WAITLISTED'] as const;

const isActive = (status: string) => (ACTIVE_STATUSES as readonly string[]).includes(status);

const MY_REGISTRATION_SELECT = {
  id: true,
  tournamentId: true,
  status: true,
  waitlistPosition: true,
  checkedInAt: true,
  team: { select: { id: true, name: true, captainId: true } },
} satisfies Prisma.RegistrationSelect;

type MyRegistrationRow = Prisma.RegistrationGetPayload<{ select: typeof MY_REGISTRATION_SELECT }>;

/** De quoi engager une inscription dans le tournoi. */
const ENTRANT_SELECT = {
  id: true,
  userId: true,
  teamId: true,
  user: { select: { displayName: true } },
  team: { select: { name: true } },
} satisfies Prisma.RegistrationSelect;

type EntrantRow = Prisma.RegistrationGetPayload<{ select: typeof ENTRANT_SELECT }>;

/** Joueur ou équipe à engager dans le tournoi. */
interface Entrant {
  userId?: string;
  teamId?: string;
  displayName: string;
}

const toEntrant = ({ userId, teamId, user, team }: EntrantRow): Entrant => ({
  userId: userId ?? undefined,
  teamId: teamId ?? undefined,
  displayName: team?.name ?? user?.displayName ?? '',
});

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
      checkInOpensAt: true,
      customFields: true,
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

function assertNotStarted({ status }: LockedTournament): void {
  if (status !== 'REGISTRATION') {
    throw new ConflictException('Ce tournoi a commencé : les inscriptions ne changent plus');
  }
}

/** Engage le joueur ou l'équipe s'il reste de la place, sinon le met en liste d'attente. */
async function admit(
  tx: Prisma.TransactionClient,
  { id: tournamentId, maxParticipants }: LockedTournament,
  entrant: Entrant,
) {
  const count = await tx.participant.count({ where: { tournamentId } });
  if (maxParticipants !== null && count >= maxParticipants) {
    const { _max } = await tx.registration.aggregate({
      where: { tournamentId, status: 'WAITLISTED' },
      _max: { waitlistPosition: true },
    });
    return { status: 'WAITLISTED', waitlistPosition: (_max.waitlistPosition ?? 0) + 1 } as const;
  }
  const { id } = await tx.participant.create({
    data: { ...entrant, tournamentId },
    select: { id: true },
  });
  return { status: 'ACCEPTED', waitlistPosition: null, participantId: id } as const;
}

/** Donne les places libres aux premiers de la liste d'attente. */
async function fillFreeSeats(
  tx: Prisma.TransactionClient,
  { id: tournamentId, maxParticipants }: LockedTournament,
  where: Prisma.RegistrationWhereInput = {},
): Promise<void> {
  if (maxParticipants === null) return;
  const count = await tx.participant.count({ where: { tournamentId } });
  const next = await tx.registration.findMany({
    where: { ...where, tournamentId, status: 'WAITLISTED' },
    orderBy: { waitlistPosition: 'asc' },
    take: Math.max(maxParticipants - count, 0),
    select: ENTRANT_SELECT,
  });
  for (const registration of next) {
    const { id: participantId } = await tx.participant.create({
      data: { ...toEntrant(registration), tournamentId },
      select: { id: true },
    });
    await tx.registration.update({
      where: { id: registration.id },
      data: { status: 'ACCEPTED', waitlistPosition: null, participantId },
    });
  }
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
    throw invalidData([{ path: ['teamId'], message: 'Choisissez une équipe.' }]);
  }
  const team = await tx.team.findUnique({
    where: { id: teamId },
    select: { name: true, captainId: true, members: { select: { userId: true, role: true } } },
  });
  if (!team) throw new NotFoundException('Équipe introuvable');
  if (team.captainId !== user.id) {
    throw new ForbiddenException("Seul le chef d'équipe peut inscrire son équipe");
  }

  // Le minimum compte les titulaires, le maximum compte aussi les remplaçants.
  const size = team.members.length;
  const starters = team.members.filter(({ role }) => role === 'STARTER').length;
  const { teamSizeMin: min, teamSizeMax: max } = tournament;
  if (min !== null && starters < min) {
    throw new ConflictException(
      `Ce tournoi demande au moins ${min} titulaires : votre équipe en compte ${starters}`,
    );
  }
  if (max !== null && size > max) {
    throw new ConflictException(
      `Ce tournoi limite les équipes à ${max} joueurs : la vôtre en compte ${size}`,
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
  { team, checkedInAt, ...registration }: MyRegistrationRow,
  userId: string,
): MyRegistration {
  return {
    ...registration,
    team: team && { id: team.id, name: team.name },
    checkedIn: checkedInAt !== null,
    canCancel: isActive(registration.status) && (!team || team.captainId === userId),
  };
}

/** Inscription qui appartient au compte : le joueur, ou le chef de l'équipe inscrite. */
async function findOwned(
  tx: Prisma.TransactionClient,
  userId: string,
  tournamentId: string,
  registrationId: string,
) {
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
  return registration;
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
    { teamId, customFieldValues }: TournamentEntryInput,
  ): Promise<MyRegistration> {
    try {
      return await this.prisma.$transaction(async (tx) => {
        const tournament = await lockTournament(tx, tournamentId);
        assertOpen(tournament);

        if (tournament.participantType === 'SOLO' && teamId !== undefined) {
          throw invalidData([{ path: ['teamId'], message: 'Ce tournoi se joue sans équipe.' }]);
        }
        const fields = tournament.customFields as CustomField[];
        const issues = customFieldIssues(fields, customFieldValues);
        if (issues.length > 0) throw invalidData(issues);

        const entrant: Entrant =
          tournament.participantType === 'TEAM'
            ? await teamEntrant(tx, user, tournament, teamId)
            : { userId: user.id, displayName: user.displayName };

        const placement =
          tournament.registrationMode === 'OPEN'
            ? await admit(tx, tournament, entrant)
            : ({ status: 'PENDING' } as const);
        const row = await tx.registration.create({
          data: {
            ...placement,
            tournamentId,
            userId: entrant.userId,
            teamId: entrant.teamId,
            customFieldValues: Object.fromEntries(
              fields.flatMap(({ label }) => {
                const value = customFieldValues[label];
                return value ? [[label, value]] : [];
              }),
            ),
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
      const tournament = await lockTournament(tx, tournamentId);
      const registration = await findOwned(tx, userId, tournamentId, registrationId);
      assertNotStarted(tournament);
      // Sinon, supprimer un refus ou une absence permettrait de se réinscrire.
      if (!isActive(registration.status)) {
        throw new ConflictException('Cette inscription a été refusée ou annulée');
      }
      await tx.registration.delete({ where: { id: registrationId } });
      if (registration.participantId) {
        await tx.participant.delete({ where: { id: registration.participantId } });
        await fillFreeSeats(tx, tournament);
      }
    });
  }

  /** Présence confirmée par le joueur ou le chef d'équipe, jusqu'au début du tournoi. */
  async checkIn(userId: string, tournamentId: string, registrationId: string): Promise<void> {
    await this.prisma.$transaction(async (tx) => {
      const tournament = await lockTournament(tx, tournamentId);
      const { status } = await findOwned(tx, userId, tournamentId, registrationId);
      assertNotStarted(tournament);
      const now = new Date();
      const { checkInOpensAt, startsAt } = tournament;
      if (!checkInOpensAt || checkInOpensAt > now || (startsAt && startsAt <= now)) {
        throw new ConflictException("Le check-in n'est pas ouvert");
      }
      if (status !== 'ACCEPTED' && status !== 'WAITLISTED') {
        throw new ConflictException(
          'Seule une inscription confirmée ou en attente fait son check-in',
        );
      }
      await tx.registration.update({
        where: { id: registrationId },
        data: { checkedInAt: now },
      });
    });
  }

  /**
   * Clôture du check-in : les absents perdent leur place, au profit des présents de la liste
   * d'attente.
   *
   * shortcut: déclenchée par l'organisateur ; à automatiser au début du tournoi quand les files
   * de tâches (ADR-0006) existeront.
   */
  async closeCheckIn(userId: string, tournamentId: string): Promise<void> {
    await this.tournaments.assertOrganizer(userId, tournamentId);
    await this.prisma.$transaction(async (tx) => {
      const tournament = await lockTournament(tx, tournamentId);
      assertNotStarted(tournament);
      if (!tournament.checkInOpensAt || tournament.checkInOpensAt > new Date()) {
        throw new ConflictException("Le check-in n'est pas ouvert");
      }
      const absents = await tx.registration.findMany({
        where: { tournamentId, status: 'ACCEPTED', checkedInAt: null },
        select: { id: true, participantId: true },
      });
      await tx.registration.updateMany({
        where: { id: { in: absents.map(({ id }) => id) } },
        data: { status: 'CANCELLED', participantId: null },
      });
      await tx.participant.deleteMany({
        where: { id: { in: absents.flatMap(({ participantId: id }) => id ?? []) } },
      });
      await fillFreeSeats(tx, tournament, { checkedInAt: { not: null } });
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
        waitlistPosition: true,
        checkedInAt: true,
        customFieldValues: true,
        user: { select: { displayName: true } },
        team: { select: { name: true, _count: { select: { members: true } } } },
        participant: { select: { id: true, seed: true } },
      },
    });
    return rows.map(({ user, team, participant, checkedInAt, customFieldValues, ...row }) => ({
      ...row,
      name: team?.name ?? user?.displayName ?? '',
      memberCount: team?._count.members ?? null,
      participantId: participant?.id ?? null,
      seed: participant?.seed ?? null,
      checkedIn: checkedInAt !== null,
      customFieldValues: customFieldValues as Record<string, string>,
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
        select: { ...ENTRANT_SELECT, status: true },
      });
      if (!registration) throw new NotFoundException('Inscription introuvable');
      if (registration.status !== 'PENDING') {
        throw new ConflictException('Cette inscription a déjà été traitée');
      }
      assertNotStarted(tournament);

      await tx.registration.update({
        where: { id: registrationId },
        data:
          status === 'ACCEPTED' ? await admit(tx, tournament, toEntrant(registration)) : { status },
      });
    });
  }

  /** Enregistre l'ordre de seeding choisi par l'organisateur. */
  async setSeeds(
    userId: string,
    tournamentId: string,
    { participantIds }: SeedsInput,
  ): Promise<void> {
    await this.tournaments.assertOrganizer(userId, tournamentId);
    await this.prisma.$transaction(async (tx) => {
      assertNotStarted(await lockTournament(tx, tournamentId));
      for (const [index, id] of participantIds.entries()) {
        const { count } = await tx.participant.updateMany({
          where: { id, tournamentId },
          data: { seed: index + 1 },
        });
        if (count === 0) throw new NotFoundException('Participant introuvable');
      }
    });
  }
}

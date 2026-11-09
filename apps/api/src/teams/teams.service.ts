import { randomUUID } from 'node:crypto';
import {
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import type { CreateTeamInput, TeamDetail, TeamInvitation, TeamRole } from '@epickem/shared';
import { isUniqueViolation } from '../auth/auth.service';
import type { Prisma } from '../generated/prisma/client';
import { PrismaService } from '../prisma/prisma.service';

const TEAM_SELECT = {
  id: true,
  name: true,
  tag: true,
  captainId: true,
  inviteCode: true,
  members: {
    select: { role: true, user: { select: { id: true, username: true, displayName: true } } },
    orderBy: { joinedAt: 'asc' },
  },
} satisfies Prisma.TeamSelect;

type TeamRow = Prisma.TeamGetPayload<{ select: typeof TEAM_SELECT }>;

@Injectable()
export class TeamsService {
  constructor(private readonly prisma: PrismaService) {}

  /** shortcut: pas de pagination, un compte a peu d'équipes ; à paginer si cela change. */
  async listFor(userId: string): Promise<TeamDetail[]> {
    const rows = await this.prisma.team.findMany({
      where: { members: { some: { userId } } },
      orderBy: { createdAt: 'desc' },
      select: TEAM_SELECT,
    });
    return rows.map((row) => toTeamDetail(row, userId));
  }

  /** Celui qui crée l'équipe en est le chef, et aussi le premier membre. */
  async create(userId: string, input: CreateTeamInput): Promise<TeamDetail> {
    const row = await this.prisma.team.create({
      data: {
        name: input.name,
        tag: input.tag ?? null,
        captainId: userId,
        members: { create: { userId } },
      },
      select: TEAM_SELECT,
    });
    return toTeamDetail(row, userId);
  }

  /** Remplace le lien d'invitation : l'ancien ne fonctionne plus. */
  async renewInvite(userId: string, teamId: string): Promise<TeamDetail> {
    const { captainId } = await this.findTeam(teamId);
    if (captainId !== userId) throw new ForbiddenException("Réservé au chef d'équipe");
    const row = await this.prisma.team.update({
      where: { id: teamId },
      data: { inviteCode: randomUUID() },
      select: TEAM_SELECT,
    });
    return toTeamDetail(row, userId);
  }

  async findInvitation(code: string): Promise<TeamInvitation> {
    const team = await this.prisma.team.findUnique({
      where: { inviteCode: code },
      select: {
        name: true,
        tag: true,
        captain: { select: { displayName: true } },
        _count: { select: { members: true } },
      },
    });
    if (!team) throw invitationNotFound();
    return {
      name: team.name,
      tag: team.tag,
      captainName: team.captain.displayName,
      memberCount: team._count.members,
    };
  }

  async join(userId: string, code: string): Promise<TeamDetail> {
    const team = await this.prisma.team.findUnique({
      where: { inviteCode: code },
      select: { id: true },
    });
    if (!team) throw invitationNotFound();
    try {
      await this.prisma.teamMember.create({ data: { teamId: team.id, userId } });
    } catch (error) {
      if (isUniqueViolation(error)) throw new ConflictException('Vous êtes déjà dans cette équipe');
      throw error;
    }
    const row = await this.prisma.team.findUniqueOrThrow({
      where: { id: team.id },
      select: TEAM_SELECT,
    });
    return toTeamDetail(row, userId);
  }

  /** Le chef d'équipe désigne les titulaires et les remplaçants. */
  async setRole(userId: string, teamId: string, memberId: string, role: TeamRole): Promise<void> {
    const { captainId } = await this.findTeam(teamId);
    if (captainId !== userId) throw new ForbiddenException("Réservé au chef d'équipe");
    const { count } = await this.prisma.teamMember.updateMany({
      where: { teamId, userId: memberId },
      data: { role },
    });
    if (count === 0) throw new NotFoundException('Ce compte ne fait pas partie de cette équipe');
  }

  /** Le chef d'équipe retire un membre, ou un membre quitte l'équipe. */
  async removeMember(userId: string, teamId: string, memberId: string): Promise<void> {
    const { captainId } = await this.findTeam(teamId);
    const isCaptain = captainId === userId;
    if (!isCaptain && memberId !== userId) {
      throw new ForbiddenException("Réservé au chef d'équipe");
    }
    if (memberId === captainId) {
      throw new ConflictException("Le chef d'équipe ne peut pas quitter son équipe");
    }

    await this.prisma.$transaction(async (tx) => {
      const { count } = await tx.teamMember.deleteMany({ where: { teamId, userId: memberId } });
      if (count === 0) throw new NotFoundException('Ce compte ne fait pas partie de cette équipe');
      // Sinon, un membre retiré reviendrait avec l'ancien lien.
      if (isCaptain) {
        await tx.team.update({ where: { id: teamId }, data: { inviteCode: randomUUID() } });
      }
    });
  }

  private async findTeam(teamId: string) {
    const team = await this.prisma.team.findUnique({
      where: { id: teamId },
      select: { captainId: true },
    });
    if (!team) throw new NotFoundException('Équipe introuvable');
    return team;
  }
}

const invitationNotFound = () => new NotFoundException('Cette invitation n’est plus valable');

function toTeamDetail({ members, inviteCode, ...team }: TeamRow, userId: string): TeamDetail {
  return {
    ...team,
    members: members.map(({ user, role }) => ({ ...user, role })),
    inviteCode: team.captainId === userId ? inviteCode : null,
  };
}

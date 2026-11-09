import { z } from 'zod';

const NAME_ERROR = 'De 2 à 50 caractères.';
const TAG_ERROR = 'Au plus 5 caractères.';

export const createTeamSchema = z.object({
  name: z.string(NAME_ERROR).trim().min(2, NAME_ERROR).max(50, NAME_ERROR),
  /** Abréviation affichée à côté du nom. */
  tag: z.string().trim().min(1, TAG_ERROR).max(5, TAG_ERROR).optional(),
});
export type CreateTeamInput = z.infer<typeof createTeamSchema>;

export const TEAM_ROLES = ['STARTER', 'SUBSTITUTE'] as const;
export type TeamRole = (typeof TEAM_ROLES)[number];

export const teamMemberRoleSchema = z.object({ role: z.enum(TEAM_ROLES) });
export type TeamMemberRoleInput = z.infer<typeof teamMemberRoleSchema>;

export interface TeamMemberSummary {
  id: string;
  username: string;
  displayName: string;
  role: TeamRole;
}

/** Équipe telle que l'API la renvoie à l'un de ses membres. */
export interface TeamDetail {
  id: string;
  name: string;
  tag: string | null;
  captainId: string;
  /** Membres, chef d'équipe compris, du plus ancien au plus récent. */
  members: TeamMemberSummary[];
  /** Code du lien d'invitation ; null sauf pour le chef d'équipe. */
  inviteCode: string | null;
}

/** Ce que voit la personne invitée avant de rejoindre l'équipe. */
export interface TeamInvitation {
  name: string;
  tag: string | null;
  captainName: string;
  memberCount: number;
}

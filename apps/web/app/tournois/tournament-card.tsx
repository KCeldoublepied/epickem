import type { ReactNode } from 'react';
import type { TournamentStatus, TournamentSummary, Visibility } from '@epickem/shared';

import styles from './tournois.module.css';
import type { TournamentList } from './use-tournament-list';

export const STATUS_LABELS: Record<TournamentStatus, string> = {
  DRAFT: 'Brouillon',
  REGISTRATION: 'Inscriptions ouvertes',
  IN_PROGRESS: 'En cours',
  COMPLETED: 'Terminé',
  CANCELLED: 'Annulé',
};

const VISIBILITY_LABELS: Record<Visibility, string | null> = {
  PUBLIC: null,
  UNLISTED: 'Sur invitation',
  PRIVATE: 'Privé',
};

const DATE_FORMAT = new Intl.DateTimeFormat('fr-FR', {
  weekday: 'short',
  day: 'numeric',
  month: 'short',
  year: 'numeric',
  hour: '2-digit',
  minute: '2-digit',
});

function place({ locationType, location }: TournamentSummary): string {
  if (locationType === 'ONLINE') return 'En ligne';
  const kind = locationType === 'HYBRID' ? 'Hybride' : 'Sur place';
  return location ? `${kind} · ${location}` : kind;
}

function seats({ participantCount, maxParticipants, participantType }: TournamentSummary): string {
  const unit = participantType === 'TEAM' ? 'équipe' : 'joueur';
  const count = `${participantCount} ${unit}${participantCount > 1 ? 's' : ''}`;
  return maxParticipants ? `${count} sur ${maxParticipants}` : count;
}

interface TournamentCardProps {
  tournament: TournamentSummary;
  /** Afficher l'organisateur : utile dans la liste publique, pas dans « Mes tournois ». */
  showOrganizer?: boolean;
  /** Boutons propres à la page (publier…). */
  actions?: ReactNode;
}

export function TournamentCard({ tournament, showOrganizer, actions }: TournamentCardProps) {
  const visibility = VISIBILITY_LABELS[tournament.visibility];
  const titleId = `tournoi-${tournament.id}`;

  return (
    <article aria-labelledby={titleId} className={styles.card}>
      <div className={styles.badges}>
        <span className={styles.badge} data-status={tournament.status}>
          {STATUS_LABELS[tournament.status]}
        </span>
        {visibility && <span className={styles.tag}>{visibility}</span>}
      </div>
      <h2 id={titleId} className={styles.cardTitle}>
        {tournament.name}
      </h2>
      <dl className={styles.details}>
        <dt>Jeu</dt>
        <dd>{tournament.game?.name ?? 'À définir'}</dd>
        <dt>Début</dt>
        <dd className="tabular">
          {tournament.startsAt ? DATE_FORMAT.format(new Date(tournament.startsAt)) : 'À définir'}
        </dd>
        <dt>Lieu</dt>
        <dd>{place(tournament)}</dd>
        <dt>Inscrits</dt>
        <dd className="tabular">{seats(tournament)}</dd>
        {showOrganizer && tournament.organizer && (
          <>
            <dt>Organisé par</dt>
            <dd>{tournament.organizer.displayName}</dd>
          </>
        )}
      </dl>
      {actions && <div className={styles.cardActions}>{actions}</div>}
    </article>
  );
}

interface TournamentGridProps {
  list: TournamentList;
  empty: ReactNode;
  loggedOut?: ReactNode;
  children: (tournament: TournamentSummary) => ReactNode;
}

/** Grille de cartes avec les états chargement, vide, erreur, et le bouton « Afficher plus ». */
export function TournamentGrid({ list, empty, loggedOut, children }: TournamentGridProps) {
  if (list.state === 'loading') {
    return (
      <p className={styles.status} role="status">
        Chargement des tournois…
      </p>
    );
  }
  if (list.state === 'logged-out') return <div className={styles.notice}>{loggedOut}</div>;
  if (list.state === 'error') {
    return (
      <div role="alert" className={styles.alert}>
        <p>Impossible de charger les tournois. Réessayez dans un instant.</p>
      </div>
    );
  }
  if (list.items.length === 0) return <div className={styles.notice}>{empty}</div>;

  return (
    <>
      <ul className={styles.grid}>
        {list.items.map((tournament) => (
          <li key={tournament.id}>{children(tournament)}</li>
        ))}
      </ul>
      {list.hasMore && (
        <button
          type="button"
          className={styles.more}
          disabled={list.loadingMore}
          onClick={() => void list.loadMore()}
        >
          {list.loadingMore ? 'Chargement…' : 'Afficher plus de tournois'}
        </button>
      )}
    </>
  );
}

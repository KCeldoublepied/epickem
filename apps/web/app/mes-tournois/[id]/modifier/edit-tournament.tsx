'use client';

import Link from 'next/link';
import { type ReactNode, useEffect, useState } from 'react';
import type { TournamentDetail } from '@epickem/shared';

import { ApiRequestError, apiFetch } from '../../../api-client';
import { TournamentForm } from '../../../tournois/tournament-form';
import styles from '../../../tournois/tournament-form.module.css';

type Load =
  | { state: 'loading' }
  | { state: 'ready'; tournament: TournamentDetail }
  | { state: 'error'; message: ReactNode };

function errorMessage(cause: unknown): ReactNode {
  if (!(cause instanceof ApiRequestError)) {
    return 'Impossible de joindre le serveur. Réessayez dans un instant.';
  }
  if (cause.status === 401) {
    return (
      <>
        <Link href="/connexion">Connectez-vous</Link> pour modifier vos tournois.
      </>
    );
  }
  // 400 (identifiant mal formé), 403 (pas l'organisateur) et 404 : même message.
  if (cause.status < 500) return "Ce tournoi n'existe pas ou vous n'en êtes pas l'organisateur.";
  return cause.message;
}

export function EditTournament({ id, justCreated }: { id: string; justCreated: boolean }) {
  const [load, setLoad] = useState<Load>({ state: 'loading' });

  useEffect(() => {
    apiFetch<TournamentDetail>(`/me/tournaments/${id}`).then(
      (tournament) => setLoad({ state: 'ready', tournament }),
      (cause: unknown) => setLoad({ state: 'error', message: errorMessage(cause) }),
    );
  }, [id]);

  if (load.state === 'loading') {
    return (
      <p className={styles.hint} role="status">
        Chargement du tournoi…
      </p>
    );
  }
  if (load.state === 'error') {
    return (
      <>
        <h1 className={styles.title}>Modifier un tournoi</h1>
        <div role="alert" className={styles.alert}>
          <p>{load.message}</p>
        </div>
      </>
    );
  }

  return (
    <>
      <h1 className={styles.title}>{load.tournament.name}</h1>
      <TournamentForm
        tournament={load.tournament}
        notice={
          justCreated
            ? 'Tournoi créé en brouillon : il n’est visible que par vous. Publiez-le quand il est prêt.'
            : undefined
        }
      />
    </>
  );
}

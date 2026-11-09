'use client';

import { useCallback, useEffect, useState } from 'react';
import type { TournamentSummary } from '@epickem/shared';

import { ApiRequestError, apiFetch, NETWORK_ERROR } from '../../../api-client';
import { RegistrationAction, useRegistrationContext } from '../../registration-action';
import { TournamentCard } from '../../tournament-card';
import styles from '../../tournois.module.css';

export function PublicTournament({ slug }: { slug: string }) {
  const [tournament, setTournament] = useState<TournamentSummary | null>(null);
  const [alert, setAlert] = useState<string | null>(null);
  const { context, reload } = useRegistrationContext();

  const load = useCallback(
    () =>
      apiFetch<TournamentSummary>(`/tournaments/${encodeURIComponent(slug)}`).then(setTournament),
    [slug],
  );

  useEffect(() => {
    load().catch((cause: unknown) =>
      setAlert(cause instanceof ApiRequestError ? cause.message : NETWORK_ERROR),
    );
  }, [load]);

  if (alert) {
    return (
      <div role="alert" className={styles.alert}>
        <p>{alert}</p>
      </div>
    );
  }
  if (!tournament) {
    return (
      <p className={styles.status} role="status">
        Chargement du tournoi…
      </p>
    );
  }

  return (
    <TournamentCard
      tournament={tournament}
      showOrganizer
      actions={
        <RegistrationAction
          tournament={tournament}
          context={context}
          onChange={() => Promise.all([reload(), load()])}
        />
      }
    />
  );
}

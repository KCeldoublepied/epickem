'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import type { TournamentDetail } from '@epickem/shared';

import { ApiRequestError, apiFetch, NETWORK_ERROR } from '../api-client';
import { TournamentCard, TournamentGrid } from '../tournois/tournament-card';
import styles from '../tournois/tournois.module.css';
import { useTournamentList } from '../tournois/use-tournament-list';

export function MyTournaments() {
  const router = useRouter();
  const list = useTournamentList('/me/tournaments');
  const [alert, setAlert] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  async function duplicate(id: string) {
    setPending(true);
    setAlert(null);
    try {
      const copy = await apiFetch<TournamentDetail>(`/tournaments/${id}/duplicate`, {
        method: 'POST',
      });
      router.push(`/mes-tournois/${copy.id}`);
    } catch (cause) {
      setPending(false);
      setAlert(cause instanceof ApiRequestError ? cause.message : NETWORK_ERROR);
    }
  }

  return (
    <>
      <div role="alert">
        {alert && (
          <div className={styles.alert}>
            <p>{alert}</p>
          </div>
        )}
      </div>
      <TournamentGrid
        list={list}
        loggedOut={
          <>
            <p>Connectez-vous pour voir les tournois que vous organisez.</p>
            <Link href="/connexion" className={styles.primary}>
              Se connecter
            </Link>
          </>
        }
        empty={
          <>
            <p>Vous n&apos;organisez encore aucun tournoi.</p>
            <Link href="/tournois/nouveau" className={styles.primary}>
              Créer mon premier tournoi
            </Link>
          </>
        }
      >
        {(tournament) => (
          <TournamentCard
            tournament={tournament}
            actions={
              <>
                <Link href={`/mes-tournois/${tournament.id}`} className={styles.primary}>
                  Gérer<span className={styles.srOnly}> {tournament.name}</span>
                </Link>
                <button
                  type="button"
                  className={styles.more}
                  disabled={pending}
                  onClick={() => void duplicate(tournament.id)}
                >
                  Dupliquer<span className={styles.srOnly}> {tournament.name}</span>
                </button>
              </>
            }
          />
        )}
      </TournamentGrid>
    </>
  );
}

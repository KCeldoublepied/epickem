'use client';

import Link from 'next/link';

import { TournamentCard, TournamentGrid } from '../tournois/tournament-card';
import styles from '../tournois/tournois.module.css';
import { useTournamentList } from '../tournois/use-tournament-list';

export function MyTournaments() {
  const list = useTournamentList('/me/tournaments');

  return (
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
            // Un tournoi commencé, terminé ou annulé ne se modifie plus.
            (tournament.status === 'DRAFT' || tournament.status === 'REGISTRATION') && (
              <Link href={`/mes-tournois/${tournament.id}/modifier`} className={styles.primary}>
                Modifier<span className={styles.srOnly}> {tournament.name}</span>
              </Link>
            )
          }
        />
      )}
    </TournamentGrid>
  );
}

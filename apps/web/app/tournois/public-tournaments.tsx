'use client';

import Link from 'next/link';

import { RegistrationAction, useRegistrationContext } from './registration-action';
import { TournamentCard, TournamentGrid } from './tournament-card';
import styles from './tournois.module.css';
import { useTournamentList } from './use-tournament-list';

export function PublicTournaments() {
  const list = useTournamentList('/tournaments');
  const { context, reload } = useRegistrationContext();

  return (
    <TournamentGrid
      list={list}
      empty={
        <>
          <p>Aucun tournoi n&apos;est ouvert pour le moment.</p>
          <Link href="/tournois/nouveau" className={styles.primary}>
            Organiser un tournoi
          </Link>
        </>
      }
    >
      {(tournament) => (
        <TournamentCard
          tournament={tournament}
          showOrganizer
          actions={
            <RegistrationAction
              tournament={tournament}
              context={context}
              onChange={() => Promise.all([reload(), list.reload()])}
            />
          }
        />
      )}
    </TournamentGrid>
  );
}

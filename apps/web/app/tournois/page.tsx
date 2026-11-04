import type { Metadata } from 'next';

import { SiteHeader } from '../site-header';
import { PublicTournaments } from './public-tournaments';
import styles from './tournois.module.css';

export const metadata: Metadata = { title: 'Tournois' };

/** Tous les tournois publics et publiés. */
export default function TournamentsPage() {
  return (
    <div className={styles.page}>
      <SiteHeader />
      <main className={styles.main}>
        <div>
          <h1 className={styles.title}>Tournois</h1>
          <p className={styles.intro}>
            Les tournois ouverts, en cours et terminés. Inscrivez-vous pour jouer, ou suivez-les
            pour pronostiquer.
          </p>
        </div>
        <PublicTournaments />
      </main>
    </div>
  );
}

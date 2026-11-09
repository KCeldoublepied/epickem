import type { Metadata } from 'next';

import { SiteHeader } from '../../site-header';
import styles from '../../tournois/tournament-form.module.css';
import { CreateGameForm } from './create-game-form';

export const metadata: Metadata = { title: 'Déclarer un jeu' };

/** Déclaration d'un jeu et des statistiques relevées à chaque manche. */
export default function NewGamePage() {
  return (
    <div className={styles.page}>
      <SiteHeader />
      <main className={styles.main}>
        <h1 className={styles.title}>Déclarer un jeu</h1>
        <CreateGameForm />
      </main>
    </div>
  );
}

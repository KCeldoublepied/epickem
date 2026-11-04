import type { Metadata } from 'next';
import Link from 'next/link';

import { SiteHeader } from '../../site-header';
import { TournamentForm } from '../tournament-form';
import styles from '../tournament-form.module.css';

export const metadata: Metadata = { title: 'Créer un tournoi' };

/** Création d'un tournoi. Maquette : « Admin : créer un tournoi » (M1, #13 et #14). */
export default function NewTournamentPage() {
  return (
    <div className={styles.page}>
      <SiteHeader />
      <main className={styles.main}>
        <nav aria-label="Fil d'Ariane" className={styles.breadcrumb}>
          <Link href="/mes-tournois">Mes tournois</Link> /{' '}
          <span aria-current="page">Nouveau tournoi</span>
        </nav>
        <h1 className={styles.title}>Créer un tournoi</h1>
        <TournamentForm />
      </main>
    </div>
  );
}

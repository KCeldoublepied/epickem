import type { Metadata } from 'next';
import Link from 'next/link';

import { SiteHeader } from '../../site-header';
import { CreateTournamentForm } from '../create-tournament-form';
import styles from '../tournament-form.module.css';

export const metadata: Metadata = { title: 'Créer un tournoi' };

/** Création rapide d'un tournoi ; ses réglages se font ensuite dans son dashboard (#14). */
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
        <CreateTournamentForm />
      </main>
    </div>
  );
}

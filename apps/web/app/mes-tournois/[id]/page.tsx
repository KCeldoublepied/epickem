import type { Metadata } from 'next';
import Link from 'next/link';

import { SiteHeader } from '../../site-header';
import styles from '../../tournois/tournament-form.module.css';
import { TournamentDashboard } from './tournament-dashboard';

export const metadata: Metadata = { title: 'Gérer un tournoi' };

/** Dashboard d'un tournoi : jeu, participants, structure et publication. */
export default async function TournamentDashboardPage({
  params,
  searchParams,
}: PageProps<'/mes-tournois/[id]'>) {
  const { id } = await params;
  const { cree } = await searchParams;

  return (
    <div className={styles.page}>
      <SiteHeader />
      <main className={styles.main}>
        <nav aria-label="Fil d'Ariane" className={styles.breadcrumb}>
          <Link href="/mes-tournois">Mes tournois</Link> /{' '}
          <span aria-current="page">Dashboard</span>
        </nav>
        <TournamentDashboard id={id} justCreated={cree === '1'} />
      </main>
    </div>
  );
}

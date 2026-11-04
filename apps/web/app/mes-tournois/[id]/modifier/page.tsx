import type { Metadata } from 'next';
import Link from 'next/link';

import { SiteHeader } from '../../../site-header';
import styles from '../../../tournois/tournament-form.module.css';
import { EditTournament } from './edit-tournament';

export const metadata: Metadata = { title: 'Modifier un tournoi' };

/** Modification d'un tournoi par son organisateur, puis publication s'il est en brouillon. */
export default async function EditTournamentPage({
  params,
  searchParams,
}: PageProps<'/mes-tournois/[id]/modifier'>) {
  const { id } = await params;
  const { cree } = await searchParams;

  return (
    <div className={styles.page}>
      <SiteHeader />
      <main className={styles.main}>
        <nav aria-label="Fil d'Ariane" className={styles.breadcrumb}>
          <Link href="/mes-tournois">Mes tournois</Link> / <span aria-current="page">Modifier</span>
        </nav>
        <EditTournament id={id} justCreated={cree === '1'} />
      </main>
    </div>
  );
}

import type { Metadata } from 'next';

import { SiteHeader } from '../../../site-header';
import styles from '../../tournois.module.css';
import { PublicTournament } from './public-tournament';

export const metadata: Metadata = { title: 'Tournoi' };

/** Tournoi ouvert par son lien : c'est l'accès d'un tournoi sur invitation. */
export default async function TournamentPage({ params }: PageProps<'/tournois/voir/[slug]'>) {
  const { slug } = await params;

  return (
    <div className={styles.page}>
      <SiteHeader />
      <main className={styles.main}>
        <PublicTournament slug={slug} />
      </main>
    </div>
  );
}

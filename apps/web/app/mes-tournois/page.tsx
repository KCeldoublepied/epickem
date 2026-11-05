import type { Metadata } from 'next';
import Link from 'next/link';

import { SiteHeader } from '../site-header';
import styles from '../tournois/tournois.module.css';
import { MyTournaments } from './my-tournaments';

export const metadata: Metadata = { title: 'Mes tournois' };

/** Tournois organisés par le compte connecté, brouillons compris. */
export default function MyTournamentsPage() {
  return (
    <div className={styles.page}>
      <SiteHeader />
      <main className={styles.main}>
        <div className={styles.heading}>
          <div>
            <h1 className={styles.title}>Mes tournois</h1>
            <p className={styles.intro}>
              Les tournois que vous organisez. Un brouillon n&apos;est visible que par vous :
              publiez-le pour ouvrir les inscriptions.
            </p>
          </div>
          <Link href="/tournois/nouveau" className={styles.primary}>
            Créer un tournoi
          </Link>
        </div>
        <MyTournaments />
      </main>
    </div>
  );
}

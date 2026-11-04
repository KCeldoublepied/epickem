import type { Metadata } from 'next';

import { SiteHeader } from '../../../site-header';
import styles from '../../../tournois/tournois.module.css';
import { JoinTeam } from './join-team';

export const metadata: Metadata = { title: 'Rejoindre une équipe' };

/** Page du lien d'invitation : montre l'équipe et permet de la rejoindre. */
export default async function JoinTeamPage({ params }: PageProps<'/equipes/rejoindre/[code]'>) {
  const { code } = await params;

  return (
    <div className={styles.page}>
      <SiteHeader />
      <main className={styles.main}>
        <h1 className={styles.title}>Rejoindre une équipe</h1>
        <JoinTeam code={code} />
      </main>
    </div>
  );
}

import type { Metadata } from 'next';

import { SiteHeader } from '../site-header';
import styles from '../tournois/tournois.module.css';
import { Teams } from './teams';

export const metadata: Metadata = { title: 'Mes équipes' };

/** Équipes du compte connecté : création, membres et lien d'invitation. */
export default function TeamsPage() {
  return (
    <div className={styles.page}>
      <SiteHeader />
      <main className={styles.main}>
        <div>
          <h1 className={styles.title}>Mes équipes</h1>
          <p className={styles.intro}>
            Créez une équipe pour en devenir le chef, puis partagez son lien d&apos;invitation à vos
            équipiers.
          </p>
        </div>
        <Teams />
      </main>
    </div>
  );
}

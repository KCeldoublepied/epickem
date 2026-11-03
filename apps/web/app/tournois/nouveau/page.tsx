import type { Metadata } from 'next';
import Link from 'next/link';
import { APP_NAME } from '@epickem/shared';

import { Logo } from '../../logo';
import { CreateTournamentForm } from './create-tournament-form';
import styles from './creation.module.css';

export const metadata: Metadata = { title: 'Créer un tournoi' };

/** Création d'un tournoi. Maquette : « Admin : créer un tournoi » (M1, #13 et #14). */
export default function NewTournamentPage() {
  return (
    <div className={styles.page}>
      <header className={styles.header}>
        <Link href="/" aria-label={`${APP_NAME}, retour à l'accueil`} className={styles.home}>
          <Logo height={30} />
        </Link>
      </header>
      <main className={styles.main}>
        <nav aria-label="Fil d'Ariane" className={styles.breadcrumb}>
          <Link href="/">Accueil</Link> / <span aria-current="page">Nouveau tournoi</span>
        </nav>
        <h1 className={styles.title}>Créer un tournoi</h1>
        <CreateTournamentForm />
      </main>
    </div>
  );
}

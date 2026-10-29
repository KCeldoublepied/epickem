import Link from 'next/link';
import type { ReactNode } from 'react';
import { APP_NAME, APP_TAGLINE } from '@epickem/shared';

import { Logo } from '../logo';
import { AccountTabs } from './account-tabs';
import styles from './compte.module.css';

/** Icônes de 24 × 24, décoratives : le texte à côté suffit. */
const FEATURES: { icon: ReactNode; text: string }[] = [
  {
    icon: (
      <>
        <circle cx="12" cy="12" r="8" />
        <path d="m9 12 2 2 4-4" />
      </>
    ),
    text: "Pronostiquez chaque match jusqu'au coup d'envoi.",
  },
  {
    icon: <path d="M5 20V10M12 20V4M19 20v-7" />,
    text: 'Grimpez au classement en direct, à chaque résultat.',
  },
  {
    icon: (
      <path d="M8 4h8v4a4 4 0 0 1-8 0zM6 5H3v2a3 3 0 0 0 3 3M18 5h3v2a3 3 0 0 1-3 3M12 12v4M8 20h8M9 16h6v4H9z" />
    ),
    text: 'Inscrivez votre équipe aux tournois ouverts.',
  },
];

/** Mise en page commune à /connexion et /inscription : présentation à gauche, formulaire à droite. */
export default function AccountLayout({ children }: { children: ReactNode }) {
  return (
    <div className={styles.page}>
      <section aria-label="Présentation" className={styles.aside}>
        <Link href="/" aria-label={`${APP_NAME}, retour à l'accueil`} className={styles.home}>
          <Logo height={40} />
        </Link>
        <div className={styles.pitch}>
          <p className={styles.tagline}>{APP_TAGLINE}</p>
          <p className={styles.headline}>
            Un compte pour pronostiquer, s&apos;inscrire aux tournois et suivre son classement.
          </p>
          <ul className={styles.features}>
            {FEATURES.map(({ icon, text }) => (
              <li key={text}>
                <svg
                  width="22"
                  height="22"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  aria-hidden="true"
                >
                  {icon}
                </svg>
                <span>{text}</span>
              </li>
            ))}
          </ul>
        </div>
        <p className={styles.hint}>
          Sans compte, vous pouvez tout de même <Link href="/">consulter les tournois</Link>.
        </p>
      </section>

      <main className={styles.main}>
        <div className={styles.panel}>
          <AccountTabs />
          {children}
        </div>
      </main>
    </div>
  );
}

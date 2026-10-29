'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';

import styles from './compte.module.css';

const TABS = [
  { href: '/connexion', label: 'Se connecter' },
  { href: '/inscription', label: 'Créer un compte' },
] as const;

/**
 * Bascule entre connexion et inscription. Ce sont deux pages (adresses partageables, bouton
 * retour du navigateur) : des liens avec `aria-current` plutôt que des onglets ARIA.
 */
export function AccountTabs() {
  const pathname = usePathname();

  return (
    <nav aria-label="Accès au compte" className={styles.tabs}>
      {TABS.map(({ href, label }) => (
        <Link
          key={href}
          href={href}
          className={styles.tab}
          aria-current={pathname === href ? 'page' : undefined}
        >
          {label}
        </Link>
      ))}
    </nav>
  );
}

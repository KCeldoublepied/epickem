'use client';

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import { APP_NAME, type UserProfile } from '@epickem/shared';

import { ApiRequestError, apiFetch } from './api-client';
import { Logo } from './logo';
import styles from './site-header.module.css';

const LINKS = [
  { href: '/tournois', label: 'Tournois' },
  { href: '/mes-tournois', label: 'Mes tournois' },
] as const;

/** null tant que la session n'est pas vérifiée ; false si personne n'est connecté. */
type Account = UserProfile | false | null;

/** En-tête des pages du site : logo, navigation, création de tournoi et compte. */
export function SiteHeader() {
  const pathname = usePathname();
  const router = useRouter();
  const [account, setAccount] = useState<Account>(null);
  const [loggingOut, setLoggingOut] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    apiFetch<UserProfile>('/me').then(setAccount, () => setAccount(false));
  }, []);

  async function logout() {
    setLoggingOut(true);
    setError(null);
    try {
      await apiFetch<void>('/auth/logout', { method: 'POST' });
    } catch (cause) {
      // 401 : la session avait déjà expiré, le résultat est le même.
      if (!(cause instanceof ApiRequestError && cause.status === 401)) {
        setError('Déconnexion impossible. Réessayez dans un instant.');
        setLoggingOut(false);
        return;
      }
    }
    setAccount(false);
    setLoggingOut(false);
    router.push('/connexion');
    router.refresh();
  }

  return (
    <header className={styles.header}>
      <Link href="/" aria-label={`${APP_NAME}, retour à l'accueil`} className={styles.home}>
        <Logo height={30} />
      </Link>
      <nav aria-label="Navigation principale" className={styles.nav}>
        {LINKS.map(({ href, label }) => (
          <Link
            key={href}
            href={href}
            className={styles.link}
            aria-current={pathname === href ? 'page' : undefined}
          >
            {label}
          </Link>
        ))}
        <Link
          href="/tournois/nouveau"
          className={styles.create}
          aria-current={pathname === '/tournois/nouveau' ? 'page' : undefined}
        >
          Créer un tournoi
        </Link>
      </nav>
      <div className={styles.account}>
        {account && (
          <>
            <span className={styles.user}>
              <span className={styles.srOnly}>Connecté en tant que </span>
              {account.displayName}
            </span>
            <button
              type="button"
              className={styles.logout}
              disabled={loggingOut}
              aria-describedby={error ? 'deconnexion-erreur' : undefined}
              onClick={() => void logout()}
            >
              {loggingOut ? 'Déconnexion…' : 'Se déconnecter'}
            </button>
          </>
        )}
        {account === false && (
          <Link href="/connexion" className={styles.link}>
            Se connecter
          </Link>
        )}
        <div role="alert">
          {error && (
            <p id="deconnexion-erreur" className={styles.error}>
              {error}
            </p>
          )}
        </div>
      </div>
    </header>
  );
}

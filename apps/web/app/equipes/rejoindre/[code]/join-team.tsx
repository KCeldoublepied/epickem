'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { type ReactNode, useEffect, useState } from 'react';
import type { TeamDetail, TeamInvitation } from '@epickem/shared';

import { ApiRequestError, apiFetch, NETWORK_ERROR } from '../../../api-client';
import styles from '../../../tournois/tournois.module.css';

export function JoinTeam({ code }: { code: string }) {
  const router = useRouter();
  const [invitation, setInvitation] = useState<TeamInvitation | null>(null);
  const [alert, setAlert] = useState<ReactNode>(null);
  const [pending, setPending] = useState(false);
  const path = `/teams/invitations/${encodeURIComponent(code)}`;

  useEffect(() => {
    apiFetch<TeamInvitation>(path).then(setInvitation, (cause: unknown) =>
      setAlert(cause instanceof ApiRequestError ? cause.message : NETWORK_ERROR),
    );
  }, [path]);

  async function join() {
    setPending(true);
    setAlert(null);
    try {
      await apiFetch<TeamDetail>(path, { method: 'POST' });
      router.push('/equipes');
    } catch (cause) {
      setPending(false);
      if (!(cause instanceof ApiRequestError)) setAlert(NETWORK_ERROR);
      else if (cause.status === 401) {
        setAlert(
          <>
            <Link href="/connexion">Connectez-vous</Link> ou{' '}
            <Link href="/inscription">créez un compte</Link>, puis rouvrez ce lien.
          </>,
        );
      } else setAlert(cause.message);
    }
  }

  return (
    <>
      <div role="alert">
        {alert && (
          <div className={styles.alert}>
            <p>{alert}</p>
          </div>
        )}
      </div>
      {invitation ? (
        <div className={styles.notice}>
          <p>
            <strong>{invitation.captainName}</strong> vous invite à rejoindre{' '}
            <strong>{invitation.name}</strong>
            {invitation.tag && ` [${invitation.tag}]`}.
          </p>
          <p>
            {invitation.memberCount} membre{invitation.memberCount > 1 ? 's' : ''} pour
            l&apos;instant.
          </p>
          <button
            type="button"
            className={styles.primary}
            disabled={pending}
            onClick={() => void join()}
          >
            {pending ? 'Un instant…' : "Rejoindre l'équipe"}
          </button>
        </div>
      ) : (
        !alert && (
          <p className={styles.status} role="status">
            Chargement de l&apos;invitation…
          </p>
        )
      )}
    </>
  );
}

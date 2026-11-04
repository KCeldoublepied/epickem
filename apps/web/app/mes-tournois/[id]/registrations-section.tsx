'use client';

import { useCallback, useEffect, useState } from 'react';
import {
  REGISTRATION_STATUS_LABELS,
  type ReviewRegistrationInput,
  type TournamentRegistration,
} from '@epickem/shared';

import { ApiRequestError, apiFetch, NETWORK_ERROR } from '../../api-client';
import formStyles from '../../tournois/tournament-form.module.css';
import styles from './dashboard.module.css';

interface RegistrationsSectionProps {
  tournamentId: string;
  maxParticipants?: number;
}

/** Inscrits du tournoi ; l'organisateur y traite les inscriptions en attente. */
export function RegistrationsSection({ tournamentId, maxParticipants }: RegistrationsSectionProps) {
  const [items, setItems] = useState<TournamentRegistration[] | null>(null);
  const [alert, setAlert] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  const load = useCallback(
    () =>
      apiFetch<TournamentRegistration[]>(`/me/tournaments/${tournamentId}/registrations`).then(
        setItems,
      ),
    [tournamentId],
  );

  useEffect(() => {
    load().catch(() => setAlert(NETWORK_ERROR));
  }, [load]);

  async function review(id: string, status: ReviewRegistrationInput['status']) {
    setPending(true);
    setAlert(null);
    try {
      await apiFetch<void>(`/tournaments/${tournamentId}/registrations/${id}`, {
        method: 'PATCH',
        body: JSON.stringify({ status }),
      });
      await load();
    } catch (cause) {
      setAlert(cause instanceof ApiRequestError ? cause.message : NETWORK_ERROR);
    } finally {
      setPending(false);
    }
  }

  const accepted = items?.filter((item) => item.status === 'ACCEPTED').length ?? 0;

  return (
    <section className={styles.panel} aria-labelledby="inscriptions-titre">
      <h2 id="inscriptions-titre">Inscriptions</h2>
      <div role="alert">{alert && <p className={formStyles.fieldError}>{alert}</p>}</div>
      {items === null ? (
        !alert && (
          <p className={formStyles.hint} role="status">
            Chargement des inscriptions…
          </p>
        )
      ) : items.length === 0 ? (
        <p>Personne ne s&apos;est encore inscrit.</p>
      ) : (
        <>
          <p className="tabular">
            {accepted} confirmé{accepted > 1 ? 's' : ''}
            {maxParticipants !== undefined && ` sur ${maxParticipants} places`}
          </p>
          <ul className={styles.entries}>
            {items.map((item) => (
              <li key={item.id} className={styles.entry}>
                <p>
                  <strong>{item.name}</strong>
                  <span>
                    {item.memberCount !== null &&
                      `${item.memberCount} joueur${item.memberCount > 1 ? 's' : ''} · `}
                    {REGISTRATION_STATUS_LABELS[item.status]}
                  </span>
                </p>
                {item.status === 'PENDING' && (
                  <div className={styles.stageButtons}>
                    <button
                      type="button"
                      className={styles.small}
                      disabled={pending}
                      onClick={() => void review(item.id, 'ACCEPTED')}
                    >
                      Accepter<span className={styles.srOnly}> {item.name}</span>
                    </button>
                    <button
                      type="button"
                      className={styles.small}
                      disabled={pending}
                      onClick={() => void review(item.id, 'REJECTED')}
                    >
                      Refuser<span className={styles.srOnly}> {item.name}</span>
                    </button>
                  </div>
                )}
              </li>
            ))}
          </ul>
        </>
      )}
    </section>
  );
}

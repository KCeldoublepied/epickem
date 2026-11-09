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
  /** Date d'ouverture du check-in, au format des champs datetime-local. */
  checkInOpensAt?: string;
  /** Vrai si la première phase place les participants à la main. */
  manualSeeding: boolean;
}

/** Inscrits du tournoi : validation, check-in et seeding. */
export function RegistrationsSection({
  tournamentId,
  maxParticipants,
  checkInOpensAt,
  manualSeeding,
}: RegistrationsSectionProps) {
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

  async function run(path: string, init: RequestInit) {
    setPending(true);
    setAlert(null);
    try {
      await apiFetch<void>(`/tournaments/${tournamentId}${path}`, init);
      await load();
    } catch (cause) {
      setAlert(cause instanceof ApiRequestError ? cause.message : NETWORK_ERROR);
    } finally {
      setPending(false);
    }
  }

  const review = (id: string, status: ReviewRegistrationInput['status']) =>
    run(`/registrations/${id}`, { method: 'PATCH', body: JSON.stringify({ status }) });

  const seeded = (items ?? [])
    .filter((item) => item.participantId !== null)
    .sort((a, b) => (a.seed ?? Infinity) - (b.seed ?? Infinity));

  function move(index: number, offset: -1 | 1) {
    const next = [...seeded];
    const [item] = next.splice(index, 1);
    if (item) next.splice(index + offset, 0, item);
    void run('/seeds', {
      method: 'PUT',
      body: JSON.stringify({ participantIds: next.map(({ participantId }) => participantId) }),
    });
  }

  const checkInOpen = checkInOpensAt !== undefined && new Date(checkInOpensAt) <= new Date();

  return (
    <>
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
              {seeded.length} confirmé{seeded.length > 1 ? 's' : ''}
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
                      {item.waitlistPosition !== null && ` (n° ${item.waitlistPosition})`}
                      {item.checkedIn && ' · présent'}
                    </span>
                    {Object.entries(item.customFieldValues).map(([label, value]) => (
                      <span key={label}>
                        {label} : {value}
                      </span>
                    ))}
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

      {checkInOpen && (
        <section className={styles.panel} aria-labelledby="check-in-titre">
          <h2 id="check-in-titre">Check-in</h2>
          <p>
            Clore le check-in retire les absents et donne leur place aux présents de la liste
            d&apos;attente.
          </p>
          <div>
            <button
              type="button"
              className={formStyles.secondary}
              disabled={pending}
              onClick={() => void run('/check-in/close', { method: 'POST' })}
            >
              Clore le check-in
            </button>
          </div>
        </section>
      )}

      {manualSeeding && seeded.length > 1 && (
        <section className={styles.panel} aria-labelledby="seeding-titre">
          <h2 id="seeding-titre">Seeding</h2>
          <ol className={styles.entries}>
            {seeded.map((item, index) => (
              <li key={item.id} className={styles.entry}>
                <p>
                  <strong>
                    {index + 1}. {item.name}
                  </strong>
                </p>
                <div className={styles.stageButtons}>
                  <button
                    type="button"
                    className={styles.small}
                    disabled={pending || index === 0}
                    aria-label={`Monter ${item.name}`}
                    onClick={() => move(index, -1)}
                  >
                    ↑
                  </button>
                  <button
                    type="button"
                    className={styles.small}
                    disabled={pending || index === seeded.length - 1}
                    aria-label={`Descendre ${item.name}`}
                    onClick={() => move(index, 1)}
                  >
                    ↓
                  </button>
                </div>
              </li>
            ))}
          </ol>
        </section>
      )}
    </>
  );
}

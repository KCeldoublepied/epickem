'use client';

import Link from 'next/link';
import { useCallback, useEffect, useState } from 'react';
import {
  type MyRegistration,
  REGISTRATION_STATUS_LABELS,
  type TeamDetail,
  type TournamentSummary,
} from '@epickem/shared';

import { ApiRequestError, apiFetch, NETWORK_ERROR } from '../api-client';
import formStyles from './tournament-form.module.css';
import styles from './tournois.module.css';

interface RegistrationContext {
  registrations: MyRegistration[];
  /** Équipes que le compte peut inscrire. */
  captainTeams: TeamDetail[];
}

/** undefined pendant le chargement ou après une panne ; null si personne n'est connecté. */
type Context = RegistrationContext | null | undefined;

/** Inscriptions et équipes du compte, chargées une fois pour toute la liste de tournois. */
export function useRegistrationContext() {
  const [context, setContext] = useState<Context>(undefined);

  const reload = useCallback(
    () =>
      Promise.all([
        apiFetch<MyRegistration[]>('/me/registrations'),
        apiFetch<TeamDetail[]>('/me/teams'),
      ]).then(
        ([registrations, teams]) =>
          setContext({
            registrations,
            // L'API ne donne le code d'invitation qu'au chef d'équipe.
            captainTeams: teams.filter((team) => team.inviteCode !== null),
          }),
        (cause: unknown) => {
          if (cause instanceof ApiRequestError && cause.status === 401) setContext(null);
        },
      ),
    [],
  );

  useEffect(() => {
    void reload();
  }, [reload]);

  return { context, reload };
}

interface RegistrationActionProps {
  tournament: TournamentSummary;
  context: Context;
  /** Appelé après une inscription ou une annulation. */
  onChange: () => Promise<unknown>;
}

/** Inscription à un tournoi depuis sa carte : le joueur, ou l'une des équipes qu'il dirige. */
export function RegistrationAction({ tournament, context, onChange }: RegistrationActionProps) {
  const [teamId, setTeamId] = useState<string | undefined>();
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const path = `/tournaments/${tournament.id}/registrations`;

  async function run(action: () => Promise<unknown>) {
    setPending(true);
    setError(null);
    try {
      await action();
      await onChange();
    } catch (cause) {
      setError(cause instanceof ApiRequestError ? cause.message : NETWORK_ERROR);
    } finally {
      setPending(false);
    }
  }

  const mine = context?.registrations.find((item) => item.tournamentId === tournament.id);
  const isOpen = tournament.status === 'REGISTRATION';
  const teams = context?.captainTeams ?? [];
  const selectedTeam = teamId ?? teams[0]?.id;
  const isTeam = tournament.participantType === 'TEAM';

  if (context === undefined || (!mine && !isOpen)) return null;
  if (context === null) {
    return (
      <Link href="/connexion" className={styles.secondaryLink}>
        Se connecter pour s&apos;inscrire
      </Link>
    );
  }

  return (
    <>
      {mine ? (
        <>
          <span className={styles.tag}>
            {REGISTRATION_STATUS_LABELS[mine.status]}
            {mine.team && ` · ${mine.team.name}`}
          </span>
          {mine.canCancel && isOpen && (
            <button
              type="button"
              className={styles.more}
              disabled={pending}
              onClick={() =>
                void run(() => apiFetch<void>(`${path}/${mine.id}`, { method: 'DELETE' }))
              }
            >
              Annuler<span className={styles.srOnly}> mon inscription à {tournament.name}</span>
            </button>
          )}
        </>
      ) : isTeam && teams.length === 0 ? (
        <Link href="/equipes" className={styles.secondaryLink}>
          Créer une équipe pour s&apos;inscrire
        </Link>
      ) : (
        <>
          {isTeam && (
            <select
              className={formStyles.input}
              aria-label={`Équipe à inscrire à ${tournament.name}`}
              value={selectedTeam}
              onChange={(event) => setTeamId(event.target.value)}
            >
              {teams.map((team) => (
                <option key={team.id} value={team.id}>
                  {team.name}
                </option>
              ))}
            </select>
          )}
          <button
            type="button"
            className={styles.primary}
            disabled={pending}
            onClick={() =>
              void run(() =>
                apiFetch<MyRegistration>(path, {
                  method: 'POST',
                  body: JSON.stringify(isTeam ? { teamId: selectedTeam } : {}),
                }),
              )
            }
          >
            {isTeam ? "Inscrire l'équipe" : "S'inscrire"}
            <span className={styles.srOnly}> à {tournament.name}</span>
          </button>
        </>
      )}
      {error && (
        <p className={styles.cardError} role="alert">
          {error}
        </p>
      )}
    </>
  );
}

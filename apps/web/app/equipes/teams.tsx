'use client';

import Link from 'next/link';
import { type FormEvent, useEffect, useState } from 'react';
import { createTeamSchema, type TeamDetail, type UserProfile } from '@epickem/shared';

import { ApiRequestError, apiFetch, NETWORK_ERROR } from '../api-client';
import { Field, type FieldErrors, fieldId, firstErrors, TextField } from '../tournois/form-fields';
import formStyles from '../tournois/tournament-form.module.css';
import styles from '../tournois/tournois.module.css';
import teamStyles from './equipes.module.css';

type Load =
  | { state: 'loading' }
  | { state: 'logged-out' }
  | { state: 'error' }
  | { state: 'ready'; userId: string; teams: TeamDetail[] };

const errorMessage = (cause: unknown) =>
  cause instanceof ApiRequestError ? cause.message : NETWORK_ERROR;

export function Teams() {
  const [load, setLoad] = useState<Load>({ state: 'loading' });
  const [alert, setAlert] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  useEffect(() => {
    Promise.all([apiFetch<UserProfile>('/me'), apiFetch<TeamDetail[]>('/me/teams')]).then(
      ([{ id }, teams]) => setLoad({ state: 'ready', userId: id, teams }),
      (cause: unknown) => {
        const loggedOut = cause instanceof ApiRequestError && cause.status === 401;
        setLoad(loggedOut ? { state: 'logged-out' } : { state: 'error' });
      },
    );
  }, []);

  /** Lance une action sur une équipe, puis recharge la liste. */
  async function run(action: () => Promise<unknown>): Promise<boolean> {
    setPending(true);
    setAlert(null);
    try {
      await action();
      const teams = await apiFetch<TeamDetail[]>('/me/teams');
      setLoad((current) => (current.state === 'ready' ? { ...current, teams } : current));
      return true;
    } catch (cause) {
      setAlert(errorMessage(cause));
      return false;
    } finally {
      setPending(false);
    }
  }

  if (load.state === 'loading') {
    return (
      <p className={styles.status} role="status">
        Chargement des équipes…
      </p>
    );
  }
  if (load.state === 'logged-out') {
    return (
      <div className={styles.notice}>
        <p>Connectez-vous pour créer une équipe ou voir les vôtres.</p>
        <Link href="/connexion" className={styles.primary}>
          Se connecter
        </Link>
      </div>
    );
  }
  if (load.state === 'error') {
    return (
      <div role="alert" className={styles.alert}>
        <p>Impossible de charger vos équipes. Réessayez dans un instant.</p>
      </div>
    );
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
      <CreateTeamForm pending={pending} run={run} />
      {load.teams.length === 0 ? (
        <div className={styles.notice}>
          <p>Vous n&apos;êtes dans aucune équipe pour l&apos;instant.</p>
        </div>
      ) : (
        <ul className={styles.grid}>
          {load.teams.map((team) => (
            <li key={team.id}>
              <TeamCard team={team} userId={load.userId} pending={pending} run={run} />
            </li>
          ))}
        </ul>
      )}
    </>
  );
}

interface ActionProps {
  pending: boolean;
  run: (action: () => Promise<unknown>) => Promise<boolean>;
}

function CreateTeamForm({ pending, run }: ActionProps) {
  const [name, setName] = useState<string | undefined>();
  const [tag, setTag] = useState<string | undefined>();
  const [errors, setErrors] = useState<FieldErrors>({});

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    const parsed = createTeamSchema.safeParse({ name, tag: tag?.trim() ? tag : undefined });
    if (!parsed.success) {
      const next = firstErrors(parsed.error.issues);
      setErrors(next);
      const first = Object.keys(next)[0];
      if (first) document.getElementById(fieldId(first))?.focus();
      return;
    }
    setErrors({});
    const created = await run(() =>
      apiFetch<TeamDetail>('/teams', { method: 'POST', body: JSON.stringify(parsed.data) }),
    );
    if (created) {
      setName(undefined);
      setTag(undefined);
    }
  }

  return (
    <form aria-label="Nouvelle équipe" noValidate onSubmit={(event) => void handleSubmit(event)}>
      <fieldset className={formStyles.section} disabled={pending}>
        <legend>Nouvelle équipe</legend>
        <TextField
          path="name"
          label="Nom de l'équipe"
          value={name}
          onChange={setName}
          errors={errors}
          maxLength={50}
        />
        <TextField
          path="tag"
          label="Abréviation"
          value={tag}
          onChange={setTag}
          errors={errors}
          maxLength={5}
          optional
        />
        <div>
          <button type="submit" className={styles.primary}>
            Créer l&apos;équipe
          </button>
        </div>
      </fieldset>
    </form>
  );
}

function TeamCard({
  team,
  userId,
  pending,
  run,
}: ActionProps & { team: TeamDetail; userId: string }) {
  const [copy, setCopy] = useState<{ link: string; message: string } | null>(null);
  const titleId = `equipe-${team.id}`;
  const isCaptain = team.captainId === userId;
  const link = team.inviteCode && `${window.location.origin}/equipes/rejoindre/${team.inviteCode}`;

  const removeMember = (memberId: string) =>
    run(() => apiFetch<void>(`/teams/${team.id}/members/${memberId}`, { method: 'DELETE' }));

  async function copyLink(value: string) {
    try {
      await navigator.clipboard.writeText(value);
      setCopy({ link: value, message: 'Lien copié' });
    } catch {
      // Presse-papiers refusé, ou absent hors HTTPS.
      (document.getElementById(`invitation-${team.id}`) as HTMLInputElement | null)?.select();
      setCopy({ link: value, message: 'Copie impossible : copiez le lien sélectionné.' });
    }
  }

  return (
    <article aria-labelledby={titleId} className={styles.card}>
      <div className={styles.badges}>
        {isCaptain && <span className={styles.badge}>Chef d&apos;équipe</span>}
        {team.tag && <span className={styles.tag}>{team.tag}</span>}
      </div>
      <h2 id={titleId} className={styles.cardTitle}>
        {team.name}
      </h2>

      <ul className={teamStyles.members} aria-label={`Membres de ${team.name}`}>
        {team.members.map((member) => (
          <li key={member.id} className={teamStyles.member}>
            <span>
              {member.displayName}
              {member.id === team.captainId && (
                <span className={teamStyles.muted}> · chef d&apos;équipe</span>
              )}
            </span>
            {isCaptain && member.id !== userId && (
              <button
                type="button"
                className={teamStyles.small}
                disabled={pending}
                onClick={() => void removeMember(member.id)}
              >
                Retirer<span className={styles.srOnly}> {member.displayName}</span>
              </button>
            )}
          </li>
        ))}
      </ul>

      {link && (
        <>
          <Field
            id={`invitation-${team.id}`}
            label="Lien d'invitation"
            hint="Retirer un membre ou créer un nouveau lien désactive celui-ci."
          >
            {(props) => (
              <input
                {...props}
                className={formStyles.input}
                readOnly
                value={link}
                onFocus={(event) => event.target.select()}
              />
            )}
          </Field>
          <div className={styles.cardActions}>
            <button type="button" className={styles.primary} onClick={() => void copyLink(link)}>
              Copier le lien<span className={styles.srOnly}> de {team.name}</span>
            </button>
            <button
              type="button"
              className={styles.more}
              disabled={pending}
              onClick={() =>
                void run(() =>
                  apiFetch<TeamDetail>(`/teams/${team.id}/invite-code`, { method: 'POST' }),
                )
              }
            >
              Nouveau lien<span className={styles.srOnly}> pour {team.name}</span>
            </button>
            <span role="status" className={teamStyles.muted}>
              {copy?.link === link && copy.message}
            </span>
          </div>
        </>
      )}

      {!isCaptain && (
        <div className={styles.cardActions}>
          <button
            type="button"
            className={styles.more}
            disabled={pending}
            onClick={() => void removeMember(userId)}
          >
            Quitter l&apos;équipe<span className={styles.srOnly}> {team.name}</span>
          </button>
        </div>
      )}
    </article>
  );
}

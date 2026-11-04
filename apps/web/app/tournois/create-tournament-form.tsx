'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { type FormEvent, useEffect, useState } from 'react';
import { createTournamentSchema, type TournamentDetail, type UserProfile } from '@epickem/shared';

import { ApiRequestError, apiFetch, NETWORK_ERROR } from '../api-client';
import { localToIso } from './dates';
import { Field, type FieldErrors, fieldId, firstErrors } from './form-fields';
import styles from './tournament-form.module.css';

/**
 * Création rapide d'un tournoi : un nom et des dates. Le jeu, le format et les phases se
 * règlent ensuite dans le dashboard du tournoi, où le formulaire redirige.
 */
export function CreateTournamentForm() {
  const router = useRouter();
  const [errors, setErrors] = useState<FieldErrors>({});
  const [alert, setAlert] = useState<string | null>(null);
  const [loggedOut, setLoggedOut] = useState(false);
  const [pending, setPending] = useState(false);

  useEffect(() => {
    apiFetch<UserProfile>('/me').catch((cause: unknown) => {
      if (cause instanceof ApiRequestError && cause.status === 401) setLoggedOut(true);
    });
  }, []);

  function showErrors(next: FieldErrors) {
    setErrors(next);
    const first = Object.keys(next)[0];
    if (first) document.getElementById(fieldId(first))?.focus();
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setAlert(null);
    const form = new FormData(event.currentTarget);
    const text = (name: string) => form.get(name)?.toString();
    const parsed = createTournamentSchema.safeParse({
      name: text('name'),
      startsAt: localToIso(text('startsAt')),
      endsAt: localToIso(text('endsAt')),
    });
    if (!parsed.success) {
      showErrors(firstErrors(parsed.error.issues));
      return;
    }

    setPending(true);
    setErrors({});
    try {
      const { id } = await apiFetch<TournamentDetail>('/tournaments', {
        method: 'POST',
        body: JSON.stringify(parsed.data),
      });
      router.push(`/mes-tournois/${id}?cree=1`);
    } catch (cause) {
      setPending(false);
      if (!(cause instanceof ApiRequestError)) setAlert(NETWORK_ERROR);
      else if (cause.status === 401) setLoggedOut(true);
      else if (cause.body?.issues?.length) showErrors(firstErrors(cause.body.issues));
      else setAlert(cause.message);
    }
  }

  return (
    <>
      <div role="alert">
        {loggedOut && (
          <div className={styles.alert}>
            <p>
              <Link href="/connexion">Connectez-vous</Link> pour créer un tournoi : vous en serez
              l&apos;organisateur.
            </p>
          </div>
        )}
        {alert && (
          <div className={styles.alert}>
            <p>{alert}</p>
          </div>
        )}
      </div>

      <form
        className={styles.form}
        aria-label="Nouveau tournoi"
        noValidate
        onSubmit={(event) => void handleSubmit(event)}
      >
        <fieldset className={styles.section} disabled={pending}>
          <legend>L&apos;essentiel</legend>
          <Field id={fieldId('name')} label="Nom du tournoi" error={errors.name} wide>
            {(props) => (
              <input {...props} name="name" className={styles.input} maxLength={100} required />
            )}
          </Field>
          <Field id={fieldId('startsAt')} label="Début" error={errors.startsAt}>
            {(props) => (
              <input
                {...props}
                name="startsAt"
                className={`${styles.input} tabular`}
                type="datetime-local"
                required
              />
            )}
          </Field>
          <Field id={fieldId('endsAt')} label="Fin" error={errors.endsAt}>
            {(props) => (
              <input
                {...props}
                name="endsAt"
                className={`${styles.input} tabular`}
                type="datetime-local"
                required
              />
            )}
          </Field>
          <p className={styles.hint} style={{ gridColumn: '1 / -1' }}>
            Date et heure dans votre fuseau horaire.
          </p>
        </fieldset>

        <div className={styles.actions}>
          <p className={styles.hint}>
            Le tournoi est créé en brouillon. Vous choisirez ensuite le jeu, le format et les phases
            dans son dashboard.
          </p>
          <button type="submit" className={styles.submit} disabled={pending || loggedOut}>
            {pending ? 'Création…' : 'Créer le tournoi'}
          </button>
        </div>
      </form>
    </>
  );
}

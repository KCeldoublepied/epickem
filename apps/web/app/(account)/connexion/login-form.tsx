'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { type FormEvent, useState } from 'react';
import { type AuthResponse, loginSchema } from '@epickem/shared';

import { ApiRequestError, apiFetch } from '../../api-client';
import styles from '../compte.module.css';
import { FormAlert, NETWORK_ERROR, PasswordField, TextField, TOO_MANY_ATTEMPTS } from '../fields';

export function LoginForm() {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    // Vérifié avant l'envoi : une requête invalide compterait dans la limite de tentatives.
    const parsed = loginSchema.safeParse({
      identifier: data.get('identifier'),
      password: data.get('password'),
    });
    if (!parsed.success) {
      setError('Renseignez votre e-mail ou pseudo, et votre mot de passe.');
      return;
    }

    setPending(true);
    setError(null);
    try {
      await apiFetch<AuthResponse>('/auth/login', {
        method: 'POST',
        body: JSON.stringify(parsed.data),
      });
      router.replace('/');
      router.refresh();
    } catch (cause) {
      setError(loginErrorMessage(cause));
      setPending(false);
    }
  }

  return (
    <form
      className={styles.form}
      aria-labelledby="connexion-titre"
      noValidate
      onSubmit={handleSubmit}
    >
      <h1 id="connexion-titre" className={styles.title}>
        Connexion
      </h1>
      <FormAlert message={error} />
      <TextField
        id="connexion-identifiant"
        name="identifier"
        label="E-mail ou pseudo"
        autoComplete="username"
        autoCapitalize="none"
        spellCheck={false}
        required
      />
      <PasswordField
        id="connexion-mdp"
        name="password"
        label="Mot de passe"
        autoComplete="current-password"
        required
      />
      <button type="submit" className={styles.submit} disabled={pending}>
        {pending ? 'Connexion…' : 'Se connecter'}
      </button>
      <p className={styles.switch}>
        Pas encore de compte ? <Link href="/inscription">Créer un compte</Link>
      </p>
    </form>
  );
}

function loginErrorMessage(cause: unknown): string {
  if (!(cause instanceof ApiRequestError)) return NETWORK_ERROR;
  // L'API répond pareil pour un compte inconnu et un mauvais mot de passe : on fait de même.
  if (cause.status === 401) return 'E-mail, pseudo ou mot de passe incorrect.';
  if (cause.status === 429) return TOO_MANY_ATTEMPTS;
  return cause.message;
}

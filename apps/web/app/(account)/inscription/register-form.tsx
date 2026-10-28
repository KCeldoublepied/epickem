'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { type FormEvent, useState } from 'react';
import {
  type AuthResponse,
  emailSchema,
  passwordSchema,
  type RegisterInput,
  usernameSchema,
} from '@epickem/shared';

import { ApiRequestError, apiFetch } from '../../api-client';
import styles from '../compte.module.css';
import { FormAlert, NETWORK_ERROR, PasswordField, TextField, TOO_MANY_ATTEMPTS } from '../fields';

type FieldName = 'username' | 'email' | 'password';
type FieldErrors = Partial<Record<FieldName, string>>;

const USERNAME_HINT = `Visible dans les classements. ${usernameSchema.minLength} à ${usernameSchema.maxLength} caractères : lettres, chiffres, « _ » et « - ».`;

/** Messages affichés sous les champs ; ceux de Zod sont trop techniques pour l'écran. */
const FIELD_MESSAGES: Record<FieldName, string> = {
  username: `De ${usernameSchema.minLength} à ${usernameSchema.maxLength} caractères : lettres, chiffres, « _ » et « - » uniquement.`,
  email: 'Adresse incomplète, par exemple : nom@domaine.fr',
  password: `De ${passwordSchema.minLength} à ${passwordSchema.maxLength} caractères.`,
};

/** Ordre des champs dans la page : le focus va au premier en erreur. */
const FIELD_IDS: Record<FieldName, string> = {
  username: 'inscription-pseudo',
  email: 'inscription-email',
  password: 'inscription-mdp',
};

export function RegisterForm() {
  const router = useRouter();
  const [password, setPassword] = useState('');
  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({});
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  const longEnough = password.length >= (passwordSchema.minLength ?? 0);

  function showFieldErrors(errors: FieldErrors) {
    setFieldErrors(errors);
    const first = (Object.keys(FIELD_IDS) as FieldName[]).find((name) => errors[name]);
    if (first) document.getElementById(FIELD_IDS[first])?.focus();
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    const rawUsername = String(data.get('username') ?? '');

    // Vérifié avant l'envoi : une requête invalide compterait dans la limite de tentatives.
    const username = usernameSchema.safeParse(rawUsername);
    const email = emailSchema.safeParse(data.get('email'));
    const pass = passwordSchema.safeParse(data.get('password'));
    const errors: FieldErrors = {
      ...(!username.success && { username: FIELD_MESSAGES.username }),
      ...(!email.success && { email: FIELD_MESSAGES.email }),
      ...(!pass.success && { password: FIELD_MESSAGES.password }),
    };
    setError(null);
    if (!username.success || !email.success || !pass.success) {
      showFieldErrors(errors);
      return;
    }

    const body: RegisterInput = {
      username: username.data,
      email: email.data,
      displayName: rawUsername.trim(),
      password: pass.data,
    };

    setPending(true);
    setFieldErrors({});
    try {
      await apiFetch<AuthResponse>('/auth/register', {
        method: 'POST',
        body: JSON.stringify(body),
      });
      router.replace('/');
      router.refresh();
    } catch (cause) {
      setPending(false);
      if (!(cause instanceof ApiRequestError)) return setError(NETWORK_ERROR);
      if (cause.status === 429) return setError(TOO_MANY_ATTEMPTS);

      // 409 (e-mail ou pseudo déjà pris) et 400 désignent les champs en cause.
      const fromApi: FieldErrors = {};
      for (const issue of cause.body?.issues ?? []) {
        if (issue.path in FIELD_IDS) fromApi[issue.path as FieldName] ??= issue.message;
      }
      if (Object.keys(fromApi).length > 0) showFieldErrors(fromApi);
      else setError(cause.message);
    }
  }

  return (
    <form
      className={styles.form}
      aria-labelledby="inscription-titre"
      noValidate
      onSubmit={handleSubmit}
    >
      <h1 id="inscription-titre" className={styles.title}>
        Créer un compte
      </h1>
      <FormAlert message={error} />
      <TextField
        id={FIELD_IDS.username}
        name="username"
        label="Pseudo public"
        autoComplete="username"
        autoCapitalize="none"
        spellCheck={false}
        maxLength={usernameSchema.maxLength ?? undefined}
        required
        hint={USERNAME_HINT}
        error={fieldErrors.username}
      />
      <TextField
        id={FIELD_IDS.email}
        name="email"
        type="email"
        label="Adresse e-mail"
        autoComplete="email"
        spellCheck={false}
        required
        error={fieldErrors.email}
      />
      <PasswordField
        id={FIELD_IDS.password}
        name="password"
        label="Mot de passe"
        autoComplete="new-password"
        required
        value={password}
        onChange={(event) => setPassword(event.target.value)}
        error={fieldErrors.password}
        extra={{
          id: 'inscription-mdp-regles',
          node: (
            <ul id="inscription-mdp-regles" className={styles.rules}>
              <li data-ok={longEnough}>
                <span aria-hidden="true" className={styles.ruleIcon}>
                  {longEnough ? '✓' : '✕'}
                </span>
                {passwordSchema.minLength} caractères minimum
                <span className={styles.srOnly}>
                  {longEnough ? ' : respecté' : ' : non respecté'}
                </span>
              </li>
            </ul>
          ),
        }}
      />
      <button type="submit" className={styles.submit} disabled={pending}>
        {pending ? 'Création du compte…' : 'Créer mon compte'}
      </button>
      <p className={styles.switch}>
        Déjà un compte ? <Link href="/connexion">Se connecter</Link>
      </p>
    </form>
  );
}

'use client';

import { type InputHTMLAttributes, type ReactNode, useState } from 'react';

import styles from './compte.module.css';

interface FieldProps extends Omit<InputHTMLAttributes<HTMLInputElement>, 'id' | 'className'> {
  id: string;
  label: string;
  /** Aide permanente sous le champ. */
  hint?: string;
  /** Erreur affichée sous le champ ; le marque aussi invalide pour les lecteurs d'écran. */
  error?: string;
  /** Contenu ajouté sous le champ (règles du mot de passe…), avec son propre id. */
  extra?: { id: string; node: ReactNode };
}

function describedBy(id: string, { hint, error, extra }: FieldProps): string | undefined {
  const ids = [hint && `${id}-hint`, extra?.id, error && `${id}-error`].filter(Boolean);
  return ids.length > 0 ? ids.join(' ') : undefined;
}

function FieldMessages({ id, hint, error, extra }: FieldProps) {
  return (
    <>
      {hint && (
        <p id={`${id}-hint`} className={styles.hint}>
          {hint}
        </p>
      )}
      {extra?.node}
      {error && (
        <p id={`${id}-error`} className={styles.fieldError}>
          {error}
        </p>
      )}
    </>
  );
}

export function TextField(props: FieldProps) {
  const { id, label, hint: _hint, error, extra: _extra, ...input } = props;

  return (
    <div className={styles.field}>
      <label htmlFor={id} className={styles.label}>
        {label}
      </label>
      <input
        id={id}
        className={styles.input}
        aria-invalid={error ? true : undefined}
        aria-describedby={describedBy(id, props)}
        {...input}
      />
      <FieldMessages {...props} />
    </div>
  );
}

/** Champ mot de passe avec un bouton Afficher / Masquer. */
export function PasswordField(props: Omit<FieldProps, 'type'>) {
  const { id, label, hint: _hint, error, extra: _extra, ...input } = props;
  const [visible, setVisible] = useState(false);

  return (
    <div className={styles.field}>
      <label htmlFor={id} className={styles.label}>
        {label}
      </label>
      <div className={styles.inputRow}>
        <input
          id={id}
          type={visible ? 'text' : 'password'}
          className={styles.input}
          aria-invalid={error ? true : undefined}
          aria-describedby={describedBy(id, props)}
          {...input}
        />
        <button
          type="button"
          className={styles.secondaryButton}
          aria-pressed={visible}
          aria-controls={id}
          onClick={() => setVisible(!visible)}
        >
          {visible ? 'Masquer' : 'Afficher'}
          <span className={styles.srOnly}> le mot de passe</span>
        </button>
      </div>
      <FieldMessages {...props} />
    </div>
  );
}

/** Erreur générale du formulaire, annoncée dès qu'elle apparaît. */
export function FormAlert({ message }: { message: string | null }) {
  // Le conteneur role="alert" reste dans la page : un lecteur d'écran n'annonce que ce qui change dedans.
  return (
    <div role="alert">
      {message && (
        <div className={styles.alert}>
          <svg
            width="20"
            height="20"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            aria-hidden="true"
          >
            <circle cx="12" cy="12" r="9" />
            <path d="M12 7v6M12 17h.01" />
          </svg>
          <p>{message}</p>
        </div>
      )}
    </div>
  );
}

/** Message à afficher quand l'appel à l'API a échoué sans réponse exploitable. */
export const NETWORK_ERROR = 'Impossible de joindre le serveur. Réessayez dans un instant.';
export const TOO_MANY_ATTEMPTS = 'Trop de tentatives. Patientez une minute avant de réessayer.';

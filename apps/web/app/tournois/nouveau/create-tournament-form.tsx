'use client';

import Link from 'next/link';
import { type FormEvent, type ReactNode, useEffect, useState } from 'react';
import {
  type CreateTournamentInput,
  createTournamentSchema,
  type GameSummary,
  type TournamentDetail,
  type UserProfile,
} from '@epickem/shared';

import { ApiRequestError, apiFetch } from '../../api-client';
import styles from './creation.module.css';

type FieldName = keyof CreateTournamentInput;
type FieldErrors = Partial<Record<FieldName, string>>;
type Values = Partial<Record<FieldName, string>>;

/** Libellés des champs, dans l'ordre de la page : le résumé des erreurs et le focus le suivent. */
const LABELS: Record<FieldName, string> = {
  name: 'Nom du tournoi',
  gameId: 'Jeu',
  visibility: 'Visibilité',
  description: 'Description',
  rules: 'Règlement',
  participantType: 'Participants',
  teamSizeMin: 'Joueurs par équipe (minimum)',
  teamSizeMax: 'Joueurs par équipe (maximum)',
  maxParticipants: 'Nombre maximum de participants',
  locationType: 'Lieu',
  location: 'Adresse ou nom du lieu',
  registrationMode: 'Inscriptions',
  registrationOpensAt: 'Ouverture des inscriptions',
  registrationClosesAt: 'Clôture des inscriptions',
  checkInOpensAt: 'Ouverture du check-in',
  startsAt: 'Début du tournoi',
  endsAt: 'Fin du tournoi',
};
const FIELD_ORDER = Object.keys(LABELS) as FieldName[];

/**
 * Messages des erreurs propres à un champ ; ceux de Zod sont trop techniques pour l'écran.
 * Les règles entre plusieurs champs (dates, équipes, lieu) ont déjà un message rédigé.
 */
const FIELD_MESSAGES: Partial<Record<FieldName, string>> = {
  name: 'De 3 à 100 caractères.',
  gameId: 'Choisissez un jeu.',
  description: 'Au plus 5 000 caractères.',
  rules: 'Au plus 10 000 caractères.',
  teamSizeMin: 'Nombre entier de 1 à 100.',
  teamSizeMax: 'Nombre entier de 1 à 100.',
  maxParticipants: 'Nombre entier de 2 à 4 096.',
  location: 'Au plus 200 caractères.',
};

const fieldId = (name: FieldName) => `tournoi-${name}`;

const DATE_FORMAT = new Intl.DateTimeFormat('fr-FR', {
  weekday: 'short',
  day: 'numeric',
  month: 'short',
  hour: '2-digit',
  minute: '2-digit',
});

function readForm(form: HTMLFormElement): Values {
  const values: Values = {};
  for (const [key, value] of new FormData(form)) {
    if (typeof value === 'string') values[key as FieldName] = value;
  }
  return values;
}

/** Champs vides retirés, nombres convertis, dates locales du navigateur passées en ISO (UTC). */
function toInput(values: Values): Record<string, unknown> {
  const input: Record<string, unknown> = {};
  for (const [key, raw] of Object.entries(values)) {
    const value = raw.trim();
    if (value === '') continue;
    if (['teamSizeMin', 'teamSizeMax', 'maxParticipants'].includes(key)) {
      input[key] = Number(value);
    } else if (key.endsWith('At')) {
      input[key] = new Date(value).toISOString();
    } else {
      input[key] = value;
    }
  }
  return input;
}

function firstErrors(issues: { path: string; message: string; custom?: boolean }[]): FieldErrors {
  const errors: FieldErrors = {};
  for (const { path, message, custom } of issues) {
    const name = path as FieldName;
    if (!(name in LABELS)) continue;
    errors[name] ??= custom ? message : (FIELD_MESSAGES[name] ?? message);
  }
  return errors;
}

export function CreateTournamentForm() {
  const [games, setGames] = useState<GameSummary[] | 'error' | null>(null);
  const [loggedOut, setLoggedOut] = useState(false);
  const [values, setValues] = useState<Values>({
    participantType: 'SOLO',
    locationType: 'ONLINE',
  });
  const [errors, setErrors] = useState<FieldErrors>({});
  const [alert, setAlert] = useState<ReactNode>(null);
  const [pending, setPending] = useState(false);
  const [created, setCreated] = useState<TournamentDetail | null>(null);

  useEffect(() => {
    apiFetch<GameSummary[]>('/games').then(setGames, () => setGames('error'));
    apiFetch<UserProfile>('/me').catch((cause: unknown) => {
      if (cause instanceof ApiRequestError && cause.status === 401) setLoggedOut(true);
    });
  }, []);

  function showErrors(next: FieldErrors) {
    setErrors(next);
    const fields = FIELD_ORDER.filter((name) => next[name]);
    setAlert(
      <p>
        <strong>
          {fields.length} champ{fields.length > 1 ? 's' : ''} à corriger
        </strong>{' '}
        :{' '}
        {fields.map((name, index) => (
          <span key={name}>
            {index > 0 && ', '}
            <a href={`#${fieldId(name)}`}>{LABELS[name].toLowerCase()}</a>
          </span>
        ))}
        .
      </p>,
    );
    if (fields[0]) document.getElementById(fieldId(fields[0]))?.focus();
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const parsed = createTournamentSchema.safeParse(toInput(readForm(event.currentTarget)));
    if (!parsed.success) {
      showErrors(
        firstErrors(
          parsed.error.issues.map((issue) => ({
            path: issue.path.join('.'),
            message: issue.message,
            custom: issue.code === 'custom',
          })),
        ),
      );
      return;
    }

    setPending(true);
    setErrors({});
    setAlert(null);
    try {
      setCreated(
        await apiFetch<TournamentDetail>('/tournaments', {
          method: 'POST',
          body: JSON.stringify(parsed.data),
        }),
      );
    } catch (cause) {
      if (!(cause instanceof ApiRequestError)) {
        setAlert(<p>Impossible de joindre le serveur. Réessayez dans un instant.</p>);
      } else if (cause.status === 401) {
        setLoggedOut(true);
      } else {
        // L'API renvoie déjà des messages rédigés pour l'écran.
        const fromApi = firstErrors(
          (cause.body?.issues ?? []).map((i) => ({ ...i, custom: true })),
        );
        if (Object.keys(fromApi).length > 0) showErrors(fromApi);
        else setAlert(<p>{cause.message}</p>);
      }
    } finally {
      setPending(false);
    }
  }

  if (created) return <Created tournament={created} onReset={() => setCreated(null)} />;

  const gameName = Array.isArray(games) && games.find((game) => game.id === values.gameId)?.name;
  const isTeam = values.participantType === 'TEAM';
  const field = (name: FieldName) => ({ id: fieldId(name), name, error: errors[name] });

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
        {alert && <div className={styles.alert}>{alert}</div>}
      </div>

      <div className={styles.layout}>
        <form
          className={styles.form}
          aria-label="Nouveau tournoi"
          noValidate
          onSubmit={handleSubmit}
          onChange={(event) => setValues(readForm(event.currentTarget))}
        >
          <fieldset className={styles.section}>
            <legend>Informations</legend>
            <Field {...field('name')} label={LABELS.name} wide>
              {(props) => <input {...props} className={styles.input} maxLength={100} required />}
            </Field>
            <Field
              {...field('gameId')}
              label={LABELS.gameId}
              hint={games === 'error' ? 'Impossible de charger la liste des jeux.' : undefined}
            >
              {(props) => (
                <select {...props} className={styles.input} defaultValue="" required>
                  <option value="" disabled>
                    {games === null ? 'Chargement…' : 'Choisir un jeu'}
                  </option>
                  {Array.isArray(games) &&
                    games.map((game) => (
                      <option key={game.id} value={game.id}>
                        {game.name}
                      </option>
                    ))}
                </select>
              )}
            </Field>
            <Field
              {...field('visibility')}
              label={LABELS.visibility}
              hint="Un tournoi non répertorié n'est accessible que par son lien."
            >
              {(props) => (
                <select {...props} className={styles.input} defaultValue="PUBLIC">
                  <option value="PUBLIC">Public</option>
                  <option value="UNLISTED">Non répertorié</option>
                  <option value="PRIVATE">Privé</option>
                </select>
              )}
            </Field>
            <Field {...field('description')} label={LABELS.description} wide optional>
              {(props) => <textarea {...props} className={styles.textarea} rows={3} />}
            </Field>
            <Field {...field('rules')} label={LABELS.rules} wide optional>
              {(props) => <textarea {...props} className={styles.textarea} rows={4} />}
            </Field>
          </fieldset>

          <fieldset className={styles.section}>
            <legend>Format</legend>
            <RadioGroup
              name="participantType"
              label={LABELS.participantType}
              value={values.participantType}
              options={[
                ['SOLO', 'Joueurs seuls'],
                ['TEAM', 'Équipes'],
              ]}
            />
            {isTeam && (
              <>
                <Field {...field('teamSizeMin')} label={LABELS.teamSizeMin}>
                  {(props) => (
                    <input {...props} className={styles.input} type="number" min={1} max={100} />
                  )}
                </Field>
                <Field {...field('teamSizeMax')} label={LABELS.teamSizeMax}>
                  {(props) => (
                    <input {...props} className={styles.input} type="number" min={1} max={100} />
                  )}
                </Field>
              </>
            )}
            <Field
              {...field('maxParticipants')}
              label={LABELS.maxParticipants}
              hint={`${isTeam ? 'Équipes' : 'Joueurs'} ; laissez vide pour ne pas limiter.`}
              optional
            >
              {(props) => (
                <input {...props} className={styles.input} type="number" min={2} max={4096} />
              )}
            </Field>
          </fieldset>

          <fieldset className={styles.section}>
            <legend>Lieu</legend>
            <RadioGroup
              name="locationType"
              label={LABELS.locationType}
              value={values.locationType}
              options={[
                ['ONLINE', 'En ligne'],
                ['ONSITE', 'Sur place'],
                ['HYBRID', 'Hybride'],
              ]}
            />
            {values.locationType !== 'ONLINE' && (
              <Field {...field('location')} label={LABELS.location} wide>
                {(props) => <input {...props} className={styles.input} maxLength={200} required />}
              </Field>
            )}
          </fieldset>

          <fieldset className={`${styles.section} ${styles.sectionThree}`}>
            <legend>Inscriptions et calendrier</legend>
            <Field {...field('registrationMode')} label={LABELS.registrationMode} wide>
              {(props) => (
                <select {...props} className={styles.input} defaultValue="OPEN">
                  <option value="OPEN">Ouvertes : toute inscription est acceptée</option>
                  <option value="APPROVAL">Sur validation de l&apos;organisateur</option>
                </select>
              )}
            </Field>
            {(
              [
                'registrationOpensAt',
                'registrationClosesAt',
                'checkInOpensAt',
                'startsAt',
                'endsAt',
              ] as const
            ).map((name) => (
              <Field key={name} {...field(name)} label={LABELS[name]} optional>
                {(props) => (
                  <input {...props} className={`${styles.input} tabular`} type="datetime-local" />
                )}
              </Field>
            ))}
            <p className={styles.hint} style={{ gridColumn: '1 / -1' }}>
              Heures de votre fuseau horaire. La clôture des inscriptions et l&apos;ouverture du
              check-in ne peuvent pas être après le début du tournoi.
            </p>
          </fieldset>

          <div className={styles.actions}>
            <p className={styles.hint}>
              Le tournoi est enregistré en brouillon ; le format de l&apos;arbre, le barème et les
              statistiques se règleront ensuite.
            </p>
            <button type="submit" className={styles.submit} disabled={pending || loggedOut}>
              {pending ? 'Enregistrement…' : 'Enregistrer le brouillon'}
            </button>
          </div>
        </form>

        <aside aria-labelledby="apercu-titre" className={styles.preview}>
          <h2 id="apercu-titre">Aperçu</h2>
          <span className={styles.badge}>Brouillon</span>
          <p className={styles.previewName}>{values.name?.trim() || 'Nom du tournoi'}</p>
          <dl className={styles.previewList}>
            <dt>Jeu</dt>
            <dd>{gameName || '—'}</dd>
            <dt>Participants</dt>
            <dd>
              {isTeam
                ? `Équipes${values.teamSizeMin ? ` de ${values.teamSizeMin}` : ''}${
                    values.teamSizeMax && values.teamSizeMax !== values.teamSizeMin
                      ? ` à ${values.teamSizeMax}`
                      : ''
                  }`
                : 'Joueurs seuls'}
            </dd>
            <dt>Places</dt>
            <dd className="tabular">{values.maxParticipants || 'Illimitées'}</dd>
            <dt>Lieu</dt>
            <dd>
              {values.locationType === 'ONLINE'
                ? 'En ligne'
                : values.location?.trim() ||
                  (values.locationType === 'HYBRID' ? 'Hybride' : 'Sur place')}
            </dd>
            <dt>Début</dt>
            <dd className="tabular">
              {values.startsAt ? DATE_FORMAT.format(new Date(values.startsAt)) : '—'}
            </dd>
          </dl>
        </aside>
      </div>
    </>
  );
}

interface ControlProps {
  id: string;
  name: FieldName;
  'aria-invalid'?: true;
  'aria-describedby'?: string;
}

interface FieldProps {
  id: string;
  name: FieldName;
  label: string;
  hint?: string;
  error?: string;
  optional?: boolean;
  /** Occupe toute la largeur de la section. */
  wide?: boolean;
  children: (props: ControlProps) => ReactNode;
}

/** Libellé, champ, aide et erreur reliés entre eux pour les lecteurs d'écran. */
function Field({ id, name, label, hint, error, optional, wide, children }: FieldProps) {
  const describedBy = [hint && `${id}-hint`, error && `${id}-error`].filter(Boolean).join(' ');
  return (
    <div className={styles.field} style={wide ? { gridColumn: '1 / -1' } : undefined}>
      <label htmlFor={id} className={styles.label}>
        {label}
        {optional && <span className={styles.optional}> (facultatif)</span>}
      </label>
      {children({
        id,
        name,
        ...(error && { 'aria-invalid': true as const }),
        ...(describedBy && { 'aria-describedby': describedBy }),
      })}
      {hint && (
        <p id={`${id}-hint`} className={styles.hint}>
          {hint}
        </p>
      )}
      {error && (
        <p id={`${id}-error`} className={styles.fieldError}>
          {error}
        </p>
      )}
    </div>
  );
}

function RadioGroup({
  name,
  label,
  value,
  options,
}: {
  name: FieldName;
  label: string;
  value?: string;
  options: [string, string][];
}) {
  return (
    <fieldset className={styles.radioGroup}>
      <legend className={styles.label}>{label}</legend>
      <div className={styles.radios}>
        {options.map(([optionValue, optionLabel], index) => (
          <label key={optionValue} className={styles.radio}>
            <input
              type="radio"
              name={name}
              value={optionValue}
              id={index === 0 ? fieldId(name) : undefined}
              defaultChecked={value === optionValue}
            />
            {optionLabel}
          </label>
        ))}
      </div>
    </fieldset>
  );
}

function Created({ tournament, onReset }: { tournament: TournamentDetail; onReset: () => void }) {
  return (
    <section aria-labelledby="cree-titre" className={styles.created}>
      <h2 id="cree-titre">Tournoi créé</h2>
      <p>
        <strong>{tournament.name}</strong> ({tournament.game.name}) est enregistré en brouillon.
      </p>
      <dl className={styles.previewList}>
        <dt>Adresse</dt>
        <dd>
          <code>/tournois/{tournament.slug}</code>
        </dd>
        <dt>Identifiant</dt>
        <dd>
          <code>{tournament.id}</code>
        </dd>
      </dl>
      <div className={styles.actions}>
        <button type="button" className={styles.secondary} onClick={onReset}>
          Créer un autre tournoi
        </button>
      </div>
    </section>
  );
}

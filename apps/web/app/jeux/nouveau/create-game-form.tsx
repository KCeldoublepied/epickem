'use client';

import Link from 'next/link';
import { type FormEvent, useState } from 'react';
import {
  createGameSchema,
  type GameSummary,
  STAT_SCOPE_LABELS,
  STAT_SCOPES,
  STAT_TYPE_LABELS,
  STAT_TYPES,
  type StatScope,
  type StatType,
} from '@epickem/shared';

import { ApiRequestError, apiFetch, NETWORK_ERROR } from '../../api-client';
import {
  type FieldErrors,
  fieldId,
  firstErrors,
  SelectField,
  TextField,
} from '../../tournois/form-fields';
import styles from '../../tournois/tournament-form.module.css';

interface StatRow {
  key: number;
  label?: string;
  type: StatType;
  scope: StatScope;
  /** Valeurs d'une statistique à choix, séparées par des virgules. */
  options?: string;
}

const TYPE_OPTIONS = STAT_TYPES.map((type) => [type, STAT_TYPE_LABELS[type]] as const);
const SCOPE_OPTIONS = STAT_SCOPES.map((scope) => [scope, STAT_SCOPE_LABELS[scope]] as const);

const emptyStat = (key: number): StatRow => ({ key, type: 'NUMBER', scope: 'PARTICIPANT' });

export function CreateGameForm() {
  const [name, setName] = useState<string | undefined>();
  const [stats, setStats] = useState<StatRow[]>([emptyStat(0)]);
  const [errors, setErrors] = useState<FieldErrors>({});
  const [alert, setAlert] = useState<string | null>(null);
  const [created, setCreated] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  const change = (key: number, patch: Partial<StatRow>) =>
    setStats(stats.map((stat) => (stat.key === key ? { ...stat, ...patch } : stat)));

  function showErrors(next: FieldErrors) {
    setErrors(next);
    const first = Object.keys(next)[0];
    if (first) document.getElementById(fieldId(first))?.focus();
  }

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    setAlert(null);
    setCreated(null);
    const parsed = createGameSchema.safeParse({
      name,
      stats: stats.map(({ label, type, scope, options }) => ({
        label,
        type,
        scope,
        options:
          type === 'CHOICE'
            ? (options ?? '')
                .split(',')
                .map((option) => option.trim())
                .filter(Boolean)
            : [],
      })),
    });
    if (!parsed.success) return showErrors(firstErrors(parsed.error.issues));

    setPending(true);
    setErrors({});
    try {
      const game = await apiFetch<GameSummary>('/games', {
        method: 'POST',
        body: JSON.stringify(parsed.data),
      });
      setCreated(game.name);
      setName(undefined);
      setStats([emptyStat(0)]);
    } catch (cause) {
      if (!(cause instanceof ApiRequestError)) setAlert(NETWORK_ERROR);
      else if (cause.status === 401) setAlert('Connectez-vous pour déclarer un jeu.');
      else if (cause.body?.issues?.length) showErrors(firstErrors(cause.body.issues));
      else setAlert(cause.message);
    } finally {
      setPending(false);
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
      <div role="status">
        {created && (
          <div className={styles.success}>
            « {created} » est déclaré : il est disponible dans le dashboard de vos tournois.{' '}
            <Link href="/mes-tournois">Retour à mes tournois</Link>
          </div>
        )}
      </div>

      <form
        className={styles.form}
        aria-label="Nouveau jeu"
        noValidate
        onSubmit={(event) => void handleSubmit(event)}
      >
        <fieldset className={styles.sections} disabled={pending}>
          <fieldset className={styles.section}>
            <legend>Jeu</legend>
            <TextField
              path="name"
              label="Nom du jeu"
              hint="E-sport, jeu de plateau, babyfoot, échecs…"
              value={name}
              onChange={setName}
              errors={errors}
              maxLength={60}
              wide
            />
          </fieldset>

          {stats.map((stat, index) => (
            <fieldset key={stat.key} className={styles.section}>
              <legend>Statistique {index + 1}</legend>
              <TextField
                path={`stats.${index}.label`}
                label="Nom"
                hint="Kills, buts, personnage, carte, MVP…"
                value={stat.label}
                onChange={(label) => change(stat.key, { label })}
                errors={errors}
                maxLength={50}
              />
              <SelectField
                path={`stats.${index}.type`}
                label="Type"
                value={stat.type}
                onChange={(type) => change(stat.key, { type: type as StatType })}
                errors={errors}
                options={TYPE_OPTIONS}
              />
              <SelectField
                path={`stats.${index}.scope`}
                label="Relevé"
                value={stat.scope}
                onChange={(scope) => change(stat.key, { scope: scope as StatScope })}
                errors={errors}
                options={SCOPE_OPTIONS}
              />
              {stat.type === 'CHOICE' && (
                <TextField
                  path={`stats.${index}.options`}
                  label="Valeurs possibles"
                  hint="Séparées par des virgules."
                  value={stat.options}
                  onChange={(options) => change(stat.key, { options })}
                  errors={errors}
                />
              )}
              <div style={{ gridColumn: '1 / -1' }}>
                <button
                  type="button"
                  className={styles.secondary}
                  onClick={() => setStats(stats.filter(({ key }) => key !== stat.key))}
                >
                  Retirer la statistique {index + 1}
                </button>
              </div>
            </fieldset>
          ))}

          <div>
            <button
              type="button"
              className={styles.secondary}
              onClick={() =>
                setStats([...stats, emptyStat(Math.max(0, ...stats.map(({ key }) => key)) + 1)])
              }
            >
              Ajouter une statistique
            </button>
          </div>
        </fieldset>

        <div className={styles.actions}>
          <button type="submit" className={styles.submit} disabled={pending}>
            {pending ? 'Déclaration…' : 'Déclarer le jeu'}
          </button>
        </div>
      </form>
    </>
  );
}

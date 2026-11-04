import type { ReactNode } from 'react';

import styles from './tournament-form.module.css';

/** Erreurs de validation, par chemin de champ : "name", "stages.0.settings.qualifiers"… */
export type FieldErrors = Record<string, string>;

/** Premier message de chaque champ ; le chemin vient de Zod (tableau) ou de l'API (texte). */
export function firstErrors(
  issues: readonly { path: string | readonly PropertyKey[]; message: string }[],
): FieldErrors {
  const errors: FieldErrors = {};
  for (const { path, message } of issues) {
    errors[typeof path === 'string' ? path : path.join('.')] ??= message;
  }
  return errors;
}

export const fieldId = (path: string) => `champ-${path}`;

export interface ControlProps {
  id: string;
  'aria-invalid'?: true;
  'aria-describedby'?: string;
}

interface FieldProps {
  id: string;
  label: string;
  hint?: string;
  error?: string;
  optional?: boolean;
  /** Occupe toute la largeur de la section. */
  wide?: boolean;
  children: (props: ControlProps) => ReactNode;
}

/** Libellé, champ, aide et erreur reliés entre eux pour les lecteurs d'écran. */
export function Field({ id, label, hint, error, optional, wide, children }: FieldProps) {
  const describedBy = [hint && `${id}-hint`, error && `${id}-error`].filter(Boolean).join(' ');
  return (
    <div className={styles.field} style={wide ? { gridColumn: '1 / -1' } : undefined}>
      <label htmlFor={id} className={styles.label}>
        {label}
        {optional && <span className={styles.optional}> (facultatif)</span>}
      </label>
      {children({
        id,
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

interface ControlledProps<T> {
  /** Chemin du champ dans les réglages : sert d'identifiant et retrouve son erreur. */
  path: string;
  label: string;
  value: T;
  onChange: (value: T) => void;
  errors: FieldErrors;
  hint?: string;
  optional?: boolean;
  wide?: boolean;
}

const fieldProps = <T,>({
  path,
  label,
  errors,
  hint,
  optional,
  wide,
}: ControlledProps<T>): Omit<FieldProps, 'children'> => ({
  id: fieldId(path),
  label,
  error: errors[path],
  hint,
  optional,
  wide,
});

export function TextField(
  props: ControlledProps<string | undefined> & { maxLength?: number; rows?: number },
) {
  const { value, onChange, maxLength, rows } = props;
  return (
    <Field {...fieldProps(props)}>
      {(control) =>
        rows ? (
          <textarea
            {...control}
            className={styles.textarea}
            rows={rows}
            value={value ?? ''}
            onChange={(event) => onChange(event.target.value)}
          />
        ) : (
          <input
            {...control}
            className={styles.input}
            maxLength={maxLength}
            value={value ?? ''}
            onChange={(event) => onChange(event.target.value)}
          />
        )
      }
    </Field>
  );
}

export function NumberField(
  props: ControlledProps<number | undefined> & { min?: number; max?: number },
) {
  const { value, onChange, min, max } = props;
  return (
    <Field {...fieldProps(props)}>
      {(control) => (
        <input
          {...control}
          className={`${styles.input} tabular`}
          type="number"
          min={min}
          max={max}
          value={value ?? ''}
          onChange={(event) =>
            onChange(event.target.value === '' ? undefined : Number(event.target.value))
          }
        />
      )}
    </Field>
  );
}

export function DateField(props: ControlledProps<string | undefined>) {
  const { value, onChange } = props;
  return (
    <Field {...fieldProps(props)}>
      {(control) => (
        <input
          {...control}
          className={`${styles.input} tabular`}
          type="datetime-local"
          value={value ?? ''}
          onChange={(event) => onChange(event.target.value)}
        />
      )}
    </Field>
  );
}

export function SelectField(
  props: ControlledProps<string | undefined> & {
    options: readonly (readonly [string, string])[];
    /** Libellé de l'option vide, quand le champ peut rester sans valeur. */
    emptyLabel?: string;
  },
) {
  const { value, onChange, options, emptyLabel } = props;
  return (
    <Field {...fieldProps(props)}>
      {(control) => (
        <select
          {...control}
          className={styles.input}
          value={value ?? ''}
          onChange={(event) => onChange(event.target.value || undefined)}
        >
          {emptyLabel !== undefined && <option value="">{emptyLabel}</option>}
          {options.map(([optionValue, label]) => (
            <option key={optionValue} value={optionValue}>
              {label}
            </option>
          ))}
        </select>
      )}
    </Field>
  );
}

export function CheckboxField({
  path,
  label,
  value,
  onChange,
  hint,
}: Omit<ControlledProps<boolean>, 'errors'>) {
  const id = fieldId(path);
  return (
    <div className={styles.field}>
      <label className={styles.check}>
        <input
          id={id}
          type="checkbox"
          checked={value}
          aria-describedby={hint ? `${id}-hint` : undefined}
          onChange={(event) => onChange(event.target.checked)}
        />
        {label}
      </label>
      {hint && (
        <p id={`${id}-hint`} className={styles.hint}>
          {hint}
        </p>
      )}
    </div>
  );
}

/** Liste de cases à cocher : plusieurs valeurs parmi une liste (cartes, stages…). */
export function CheckboxGroup({
  path,
  label,
  value,
  onChange,
  errors,
  options,
  hint,
}: ControlledProps<string[]> & { options: { value: string; label: string }[] }) {
  const id = fieldId(path);
  const error = errors[path];
  const toggle = (option: string, checked: boolean) =>
    onChange(checked ? [...value, option] : value.filter((item) => item !== option));
  return (
    <fieldset className={styles.radioGroup}>
      <legend className={styles.label}>{label}</legend>
      {hint && <p className={styles.hint}>{hint}</p>}
      <div className={styles.checks}>
        {options.map((option, index) => (
          <label key={option.value} className={styles.check}>
            <input
              id={index === 0 ? id : undefined}
              type="checkbox"
              checked={value.includes(option.value)}
              onChange={(event) => toggle(option.value, event.target.checked)}
            />
            {option.label}
          </label>
        ))}
      </div>
      {error && <p className={styles.fieldError}>{error}</p>}
    </fieldset>
  );
}

export function RadioGroup<T extends string>({
  path,
  label,
  value,
  onChange,
  options,
}: {
  path: string;
  label: string;
  value: T;
  onChange: (value: T) => void;
  options: readonly (readonly [T, string])[];
}) {
  return (
    <fieldset className={styles.radioGroup}>
      <legend className={styles.label}>{label}</legend>
      <div className={styles.radios}>
        {options.map(([optionValue, optionLabel], index) => (
          <label key={optionValue} className={styles.radio}>
            <input
              type="radio"
              name={path}
              value={optionValue}
              id={index === 0 ? fieldId(path) : undefined}
              checked={value === optionValue}
              onChange={() => onChange(optionValue)}
            />
            {optionLabel}
          </label>
        ))}
      </div>
    </fieldset>
  );
}

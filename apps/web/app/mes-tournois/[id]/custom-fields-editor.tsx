'use client';

import { CheckboxField, type FieldErrors, TextField } from '../../tournois/form-fields';
import formStyles from '../../tournois/tournament-form.module.css';
import styles from './dashboard.module.css';
import type { Draft } from './draft';

const MAX_FIELDS = 10;

type Fields = NonNullable<Draft['customFields']>;

interface CustomFieldsEditorProps {
  fields: Fields;
  onChange: (fields: Fields) => void;
  errors: FieldErrors;
}

/** Questions posées à l'inscription : pseudo en jeu, rang, plateforme… */
export function CustomFieldsEditor({ fields, onChange, errors }: CustomFieldsEditorProps) {
  const change = (index: number, patch: Partial<Fields[number]>) =>
    onChange(fields.map((field, i) => (i === index ? { ...field, ...patch } : field)));

  return (
    <fieldset className={formStyles.section}>
      <legend>Champs d&apos;inscription</legend>
      <p className={formStyles.hint} style={{ gridColumn: '1 / -1' }}>
        Questions posées à chaque inscription, par exemple le pseudo en jeu ou le rang.
      </p>
      {fields.map((field, index) => (
        // La longueur dans la clé recharge les réponses saisies quand un champ est retiré.
        <div key={`${fields.length}-${index}`} className={styles.customField}>
          <TextField
            path={`customFields.${index}.label`}
            label="Question"
            value={field.label}
            onChange={(label) => change(index, { label: label ?? '' })}
            errors={errors}
            maxLength={50}
          />
          <TextField
            path={`customFields.${index}.options`}
            label="Réponses possibles"
            hint="Séparées par des virgules ; vide pour une réponse libre."
            value={field.options?.join(', ')}
            onChange={(text) =>
              change(index, {
                options: (text ?? '')
                  .split(',')
                  .map((option) => option.trimStart())
                  .filter((option, i, all) => option || i === all.length - 1),
              })
            }
            errors={errors}
            optional
          />
          <CheckboxField
            path={`customFields.${index}.required`}
            label="Obligatoire"
            value={field.required === true}
            onChange={(required) => change(index, { required })}
          />
          <div>
            <button
              type="button"
              className={styles.small}
              onClick={() => onChange(fields.filter((_, i) => i !== index))}
            >
              Retirer<span className={styles.srOnly}> la question {index + 1}</span>
            </button>
          </div>
        </div>
      ))}
      <div style={{ gridColumn: '1 / -1' }}>
        <button
          type="button"
          className={formStyles.secondary}
          disabled={fields.length >= MAX_FIELDS}
          onClick={() => onChange([...fields, { label: '', required: false, options: [] }])}
        >
          Ajouter un champ
        </button>
      </div>
    </fieldset>
  );
}

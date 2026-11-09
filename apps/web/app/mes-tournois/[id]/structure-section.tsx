'use client';

import { useState } from 'react';
import {
  BEST_OF_VALUES,
  defaultStage,
  gameFormats,
  MAX_STAGES,
  ROUND_ROBIN_TIE_BREAKERS,
  SEEDING_LABELS,
  SEEDINGS,
  STAGE_FORMAT_LABELS,
  stageEntrants,
  type StageFormat,
  TIE_BREAKER_LABELS,
  TIE_BREAKERS,
} from '@epickem/shared';

import {
  CheckboxField,
  DateField,
  Field,
  type FieldErrors,
  fieldId,
  NumberField,
  SelectField,
  TextField,
} from '../../tournois/form-fields';
import formStyles from '../../tournois/tournament-form.module.css';
import styles from './dashboard.module.css';
import { type Draft, gameSlug, type SectionProps, type StageDraft } from './draft';
import { StructureFlow } from './structure-flow';

const BEST_OF_OPTIONS = BEST_OF_VALUES.map((value) => [String(value), `BO${value}`] as const);
const SEEDING_OPTIONS = SEEDINGS.map((value) => [value, SEEDING_LABELS[value]] as const);

let lastKey = 0;
const newKey = () => `nouvelle-phase-${++lastKey}`;

export const participantUnit = (draft: Draft) =>
  draft.participantType === 'TEAM' ? 'équipes' : 'joueurs';

interface StructureSectionProps extends SectionProps {
  /** Les erreurs portent sur une position : elles ne valent plus quand les phases bougent. */
  clearErrors: () => void;
}

export function StructureSection({
  draft,
  update,
  errors,
  games,
  clearErrors,
}: StructureSectionProps) {
  const { stages } = draft;
  const slug = gameSlug(draft, games);
  const formats = gameFormats(slug);
  const entrants = stageEntrants(stages, draft.maxParticipants);

  function reorganize(next: StageDraft[]) {
    update({ stages: next });
    clearErrors();
  }

  function addStage() {
    const format = formats[0] ?? 'SINGLE_ELIMINATION';
    const stage = defaultStage(format);
    const settings: Record<string, unknown> = { ...stage.settings };
    if (stages.length > 0) settings.seeding = 'PREVIOUS_STANDINGS';
    // La taille par défaut compte des joueurs, le lobby compte des équipes.
    if (stage.format === 'FREE_FOR_ALL') {
      settings.lobbySize = Math.floor(stage.settings.lobbySize / (draft.teamSizeMin ?? 1));
    }
    const added = {
      ...stage,
      key: newKey(),
      name: `Phase ${stages.length + 1}`,
      settings,
    } as StageDraft;

    // La phase qui était la dernière doit maintenant désigner ses qualifiés.
    const last = stages.at(-1);
    const lastEntrants = entrants.at(-1);
    const previous = stages.map((candidate) => {
      if (candidate !== last || lastEntrants === undefined || lastEntrants < 4) return candidate;
      const groups = candidate.format === 'ROUND_ROBIN' ? (candidate.settings.groupCount ?? 1) : 1;
      const half = Math.max(1, Math.floor(lastEntrants / 2 / groups)) * groups;
      return {
        ...candidate,
        settings: { ...candidate.settings, qualifiers: candidate.settings.qualifiers ?? half },
      } as StageDraft;
    });
    reorganize([...previous, added]);
  }

  function move(index: number, offset: -1 | 1) {
    const next = [...stages];
    const [stage] = next.splice(index, 1);
    if (stage) next.splice(index + offset, 0, stage);
    reorganize(next);
  }

  return (
    <div className={styles.stack}>
      <p className={formStyles.hint}>
        La compétition s&apos;enchaîne phase par phase : les qualifiés d&apos;une phase entrent dans
        la suivante, et la dernière donne le classement final. Chaque phase a son propre format.
      </p>
      <StructureFlow draft={draft} />

      {stages.length === 0 && (
        <p className={styles.empty}>
          Aucune phase pour l&apos;instant. Ajoutez-en au moins une pour pouvoir publier le tournoi.
        </p>
      )}
      {errors.stages && <p className={formStyles.fieldError}>{errors.stages}</p>}

      <ol className={styles.stages}>
        {stages.map((stage, index) => (
          <li key={stage.key}>
            <StageEditor
              stage={stage}
              index={index}
              count={stages.length}
              entrants={entrants[index]}
              unit={participantUnit(draft)}
              formats={formats}
              errors={errors}
              onChange={(next) =>
                update({ stages: stages.map((item, i) => (i === index ? next : item)) })
              }
              onMove={(offset) => move(index, offset)}
              onRemove={() => reorganize(stages.filter((_, i) => i !== index))}
            />
          </li>
        ))}
      </ol>

      <div>
        <button
          type="button"
          className={formStyles.secondary}
          disabled={stages.length >= MAX_STAGES}
          onClick={addStage}
        >
          Ajouter une phase
        </button>
        {stages.length >= MAX_STAGES && (
          <p className={formStyles.hint}>Un tournoi compte au plus {MAX_STAGES} phases.</p>
        )}
      </div>
    </div>
  );
}

interface StageEditorProps {
  stage: StageDraft;
  index: number;
  count: number;
  entrants: number | undefined;
  unit: string;
  formats: readonly StageFormat[];
  errors: FieldErrors;
  onChange: (stage: StageDraft) => void;
  onMove: (offset: -1 | 1) => void;
  onRemove: () => void;
}

function StageEditor({
  stage,
  index,
  count,
  entrants,
  unit,
  formats,
  errors,
  onChange,
  onMove,
  onRemove,
}: StageEditorProps) {
  const path = `stages.${index}`;
  const title = `Phase ${index + 1}`;
  const isLast = index === count - 1;
  const settings = stage.settings as Record<string, unknown>;

  const set = (key: string, value: unknown) =>
    onChange({ ...stage, settings: { ...settings, [key]: value } } as StageDraft);

  function changeFormat(format: StageFormat | undefined) {
    if (!format) return;
    const fresh = defaultStage(format);
    onChange({
      ...fresh,
      key: stage.key,
      startsAt: stage.startsAt,
      name: stage.name,
      settings: {
        ...fresh.settings,
        seeding: stage.settings.seeding ?? 'RANDOM',
        qualifiers: stage.settings.qualifiers,
      },
    } as StageDraft);
  }

  const number = (key: string, label: string, min: number, max: number, hint?: string) => (
    <NumberField
      path={`${path}.settings.${key}`}
      label={label}
      value={settings[key] as number | undefined}
      onChange={(value) => set(key, value)}
      errors={errors}
      min={min}
      max={max}
      hint={hint}
    />
  );

  const bestOf = (
    <SelectField
      path={`${path}.settings.bestOf`}
      label="Format des matchs"
      value={String(settings.bestOf ?? 1)}
      onChange={(value) => set('bestOf', Number(value))}
      errors={errors}
      options={BEST_OF_OPTIONS}
    />
  );

  const roundBestOf = (key: string, label: string) => (
    <SelectField
      path={`${path}.settings.${key}`}
      label={label}
      value={settings[key] === undefined ? undefined : String(settings[key])}
      onChange={(value) => set(key, value === undefined ? undefined : Number(value))}
      errors={errors}
      emptyLabel="Comme les autres matchs"
      options={BEST_OF_OPTIONS}
    />
  );
  const finalBestOf = roundBestOf('finalBestOf', 'Format de la finale');

  const groups = (settings.groupCount as number | undefined) ?? 1;
  const qualifiers = settings.qualifiers as number | undefined;

  const tieBreaker = (
    <SelectField
      path={`${path}.settings.tieBreaker`}
      label="Départage"
      value={settings.tieBreaker as string | undefined}
      onChange={(value) => set('tieBreaker', value)}
      errors={errors}
      options={(stage.format === 'ROUND_ROBIN' ? ROUND_ROBIN_TIE_BREAKERS : TIE_BREAKERS).map(
        (value) => [value, TIE_BREAKER_LABELS[value]],
      )}
    />
  );

  return (
    <fieldset className={formStyles.section}>
      <legend>{title}</legend>
      <div className={styles.stageActions}>
        <p className={formStyles.hint}>
          {entrants === undefined
            ? 'Participants selon les inscriptions'
            : `${entrants} ${unit} au départ`}
        </p>
        <div className={styles.stageButtons}>
          <button
            type="button"
            className={styles.small}
            disabled={index === 0}
            aria-label={`Monter la ${title.toLowerCase()}`}
            onClick={() => onMove(-1)}
          >
            ↑
          </button>
          <button
            type="button"
            className={styles.small}
            disabled={isLast}
            aria-label={`Descendre la ${title.toLowerCase()}`}
            onClick={() => onMove(1)}
          >
            ↓
          </button>
          <button
            type="button"
            className={styles.small}
            aria-label={`Supprimer la ${title.toLowerCase()}`}
            onClick={onRemove}
          >
            Supprimer
          </button>
        </div>
      </div>

      <TextField
        path={`${path}.name`}
        label="Nom de la phase"
        value={stage.name}
        onChange={(name) => onChange({ ...stage, name: name ?? '' })}
        errors={errors}
        maxLength={60}
      />
      <SelectField
        path={`${path}.format`}
        label="Système"
        value={stage.format}
        onChange={(format) => changeFormat(format as StageFormat | undefined)}
        errors={errors}
        options={(formats.includes(stage.format) ? formats : [...formats, stage.format]).map(
          (format) => [format, STAGE_FORMAT_LABELS[format]],
        )}
      />

      {stage.format === 'SINGLE_ELIMINATION' && (
        <>
          {bestOf}
          {roundBestOf('quarterFinalBestOf', 'Format des quarts de finale')}
          {roundBestOf('semiFinalBestOf', 'Format des demi-finales')}
          {finalBestOf}
          <CheckboxField
            path={`${path}.settings.thirdPlaceMatch`}
            label="Match pour la 3e place"
            value={settings.thirdPlaceMatch === true}
            onChange={(value) => set('thirdPlaceMatch', value)}
          />
        </>
      )}

      {stage.format === 'DOUBLE_ELIMINATION' && (
        <>
          {bestOf}
          {finalBestOf}
          <CheckboxField
            path={`${path}.settings.grandFinalReset`}
            label="Grande finale avec remise à zéro"
            hint="Second match si le finaliste du tableau perdant gagne le premier."
            value={settings.grandFinalReset !== false}
            onChange={(value) => set('grandFinalReset', value)}
          />
        </>
      )}

      {stage.format === 'ROUND_ROBIN' && (
        <>
          {bestOf}
          <NumberField
            path={`${path}.settings.groupCount`}
            label="Nombre de poules"
            value={settings.groupCount as number | undefined}
            onChange={(value) =>
              // Le nombre de qualifiés par poule reste le même.
              onChange({
                ...stage,
                settings: {
                  ...settings,
                  groupCount: value,
                  qualifiers:
                    value && qualifiers !== undefined ? (qualifiers / groups) * value : qualifiers,
                },
              } as StageDraft)
            }
            errors={errors}
            min={1}
            max={64}
          />
          {number('legs', 'Rencontres par paire', 1, 4, '1 pour un aller, 2 pour un aller-retour.')}
          {tieBreaker}
          {number('pointsWin', 'Points pour une victoire', 0, 100)}
          {number('pointsDraw', 'Points pour un nul', 0, 100)}
          {number('pointsLoss', 'Points pour une défaite', 0, 100)}
        </>
      )}

      {stage.format === 'SWISS' && (
        <>
          {bestOf}
          {number('rounds', 'Nombre de rondes', 1, 20)}
          {tieBreaker}
        </>
      )}

      {stage.format === 'FREE_FOR_ALL' && (
        <>
          {number(
            'lobbySize',
            unit === 'équipes' ? 'Équipes par lobby' : 'Joueurs par lobby',
            2,
            200,
          )}
          {number('rounds', 'Parties par lobby', 1, 50)}
          {number('pointsPerKill', 'Points par élimination', 0, 100)}
          <PlacementPoints
            path={`${path}.settings.placementPoints`}
            value={(settings.placementPoints as number[] | undefined) ?? []}
            onChange={(value) => set('placementPoints', value)}
            errors={errors}
          />
        </>
      )}

      <SelectField
        path={`${path}.settings.seeding`}
        label="Placement des participants"
        value={stage.settings.seeding ?? 'RANDOM'}
        onChange={(value) => set('seeding', value)}
        errors={errors}
        options={SEEDING_OPTIONS}
      />
      {!isLast && stage.format === 'ROUND_ROBIN' && (
        <NumberField
          path={`${path}.settings.qualifiers`}
          label="Qualifiés par poule"
          hint={qualifiers === undefined ? undefined : `Soit ${qualifiers} qualifiés au total.`}
          value={qualifiers === undefined ? undefined : qualifiers / groups}
          onChange={(value) => set('qualifiers', value === undefined ? undefined : value * groups)}
          errors={errors}
          min={1}
        />
      )}
      {!isLast &&
        stage.format !== 'ROUND_ROBIN' &&
        number('qualifiers', 'Qualifiés pour la phase suivante', 2, 4096)}
      <DateField
        path={`${path}.startsAt`}
        label="Début de la phase"
        value={stage.startsAt}
        onChange={(startsAt) => onChange({ ...stage, startsAt })}
        errors={errors}
        optional
      />
    </fieldset>
  );
}

/** Points de placement, saisis comme une liste : « 10, 7, 5 ». */
function PlacementPoints({
  path,
  value,
  onChange,
  errors,
}: {
  path: string;
  value: number[];
  onChange: (value: number[]) => void;
  errors: FieldErrors;
}) {
  const [text, setText] = useState(value.join(', '));

  function handleChange(next: string) {
    setText(next);
    onChange(
      next
        .split(/[\s,;]+/)
        .filter(Boolean)
        .map(Number),
    );
  }

  return (
    <Field
      id={fieldId(path)}
      label="Points par place"
      hint="De la 1re à la dernière place récompensée, séparés par des virgules."
      error={Object.entries(errors).find(([key]) => key.startsWith(path))?.[1]}
      wide
    >
      {(props) => (
        <input
          {...props}
          className={`${formStyles.input} tabular`}
          inputMode="numeric"
          value={text}
          onChange={(event) => handleChange(event.target.value)}
        />
      )}
    </Field>
  );
}

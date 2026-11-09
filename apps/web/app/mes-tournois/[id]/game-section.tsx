'use client';

import Link from 'next/link';
import {
  GAME_CATALOG,
  type GameSettingField,
  type GameSettings,
  isFieldActive,
  type LocationType,
  normalizeGameSettings,
} from '@epickem/shared';

import {
  CheckboxField,
  CheckboxGroup,
  type FieldErrors,
  NumberField,
  RadioGroup,
  SelectField,
  TextField,
} from '../../tournois/form-fields';
import styles from '../../tournois/tournament-form.module.css';
import { gameSlug, type SectionProps } from './draft';

const LOCATION_OPTIONS = [
  ['ONLINE', 'En ligne'],
  ['ONSITE', 'Sur place'],
  ['HYBRID', 'Hybride'],
] as const;

export function GameSection({ draft, update, errors, games }: SectionProps) {
  const slug = gameSlug(draft, games);
  const definition = slug ? GAME_CATALOG[slug] : undefined;
  const game = games?.find((candidate) => candidate.id === draft.gameId);
  const locationType = draft.locationType ?? 'ONLINE';
  const fields = definition?.fields.filter((field) => isFieldActive(field, locationType)) ?? [];

  /** Le choix du jeu remet ses réglages à zéro et applique sa composition la plus courante. */
  function selectGame(gameId: string | undefined) {
    const nextSlug = games?.find((candidate) => candidate.id === gameId)?.slug;
    const preset = nextSlug ? GAME_CATALOG[nextSlug]?.teamPresets[0] : undefined;
    update({
      gameId,
      gameSettings: normalizeGameSettings(nextSlug, {}, locationType).settings,
      ...(preset && teamPatch(preset.teamSize)),
    });
  }

  function selectLocation(next: LocationType) {
    update({
      locationType: next,
      // Les réglages masqués restent dans le brouillon : l'API les retire à l'enregistrement.
      gameSettings: {
        ...draft.gameSettings,
        ...normalizeGameSettings(slug, draft.gameSettings, next).settings,
      },
    });
  }

  const setSetting = (key: string, value: GameSettings[string] | undefined) => {
    const next = { ...draft.gameSettings };
    if (value === undefined) delete next[key];
    else next[key] = value;
    update({ gameSettings: next });
  };

  return (
    <>
      <fieldset className={styles.section}>
        <legend>Jeu</legend>
        <SelectField
          path="gameId"
          label="Jeu du tournoi"
          value={draft.gameId}
          onChange={selectGame}
          errors={errors}
          emptyLabel="Choisir un jeu"
          options={(games ?? []).map((candidate) => [candidate.id, candidate.name])}
          hint={games ? undefined : 'Impossible de charger la liste des jeux.'}
          wide
        />
        <p className={styles.hint} style={{ gridColumn: '1 / -1' }}>
          Votre jeu n&apos;est pas dans la liste ? <Link href="/jeux/nouveau">Déclarez-le</Link>.
        </p>
      </fieldset>

      <fieldset className={styles.section}>
        <legend>Lieu</legend>
        <RadioGroup
          path="locationType"
          label="Où se joue le tournoi ?"
          value={locationType}
          onChange={selectLocation}
          options={LOCATION_OPTIONS}
        />
        {locationType !== 'ONLINE' && (
          <TextField
            path="location"
            label="Adresse ou nom du lieu"
            value={draft.location}
            onChange={(location) => update({ location })}
            errors={errors}
            maxLength={200}
            wide
          />
        )}
      </fieldset>

      {game && fields.length > 0 && (
        <fieldset className={styles.section}>
          <legend>Réglages de {game.name}</legend>
          {fields.map((field) => (
            <GameSetting
              key={field.key}
              field={field}
              value={draft.gameSettings[field.key]}
              onChange={(value) => setSetting(field.key, value)}
              errors={errors}
            />
          ))}
        </fieldset>
      )}
    </>
  );
}

/** Champs de taille d'équipe pour une composition : 1 joueur par camp, c'est un tournoi solo. */
export function teamPatch(teamSize: number) {
  return teamSize === 1
    ? ({ participantType: 'SOLO', teamSizeMin: undefined, teamSizeMax: undefined } as const)
    : ({ participantType: 'TEAM', teamSizeMin: teamSize, teamSizeMax: teamSize } as const);
}

function GameSetting({
  field,
  value,
  onChange,
  errors,
}: {
  field: GameSettingField;
  value: GameSettings[string] | undefined;
  onChange: (value: GameSettings[string] | undefined) => void;
  errors: FieldErrors;
}) {
  const common = {
    path: `gameSettings.${field.key}`,
    label: field.label,
    hint: field.hint,
    errors,
  };

  switch (field.kind) {
    case 'select':
      return (
        <SelectField
          {...common}
          value={value as string | undefined}
          onChange={onChange}
          options={field.options.map((option) => [option.value, option.label])}
        />
      );
    case 'multiselect':
      return (
        <CheckboxGroup
          {...common}
          value={(value as string[] | undefined) ?? []}
          onChange={onChange}
          options={field.options}
        />
      );
    case 'number':
      return (
        <NumberField
          {...common}
          label={field.unit ? `${field.label} (${field.unit})` : field.label}
          value={value as number | undefined}
          onChange={onChange}
          min={field.min}
          max={field.max}
        />
      );
    case 'boolean':
      return (
        <CheckboxField
          path={common.path}
          label={field.label}
          hint={field.hint}
          value={value === true}
          onChange={onChange}
        />
      );
  }
}

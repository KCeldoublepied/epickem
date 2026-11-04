'use client';

import Link from 'next/link';
import { type ReactNode, useEffect, useMemo, useRef, useState } from 'react';
import {
  GAME_CATALOG,
  type GameSummary,
  publicationIssues,
  type TournamentDetail,
} from '@epickem/shared';

import { ApiRequestError, apiFetch, NETWORK_ERROR } from '../../api-client';
import { localToIso } from '../../tournois/dates';
import {
  DateField,
  type FieldErrors,
  fieldId,
  firstErrors,
  NumberField,
  RadioGroup,
  SelectField,
  TextField,
} from '../../tournois/form-fields';
import { STATUS_LABELS } from '../../tournois/tournament-card';
import formStyles from '../../tournois/tournament-form.module.css';
import styles from './dashboard.module.css';
import {
  type Draft,
  gameSlug,
  type SectionId,
  sectionOf,
  type SectionProps,
  SECTIONS,
  toDraft,
  toPayload,
  validate,
} from './draft';
import { GameSection, teamPatch } from './game-section';
import { RegistrationsSection } from './registrations-section';
import { StructureFlow } from './structure-flow';
import { participantUnit, StructureSection } from './structure-section';

const DATE_FORMAT = new Intl.DateTimeFormat('fr-FR', {
  weekday: 'short',
  day: 'numeric',
  month: 'short',
  year: 'numeric',
  hour: '2-digit',
  minute: '2-digit',
});

const formatDate = (local: string | undefined) => {
  const iso = localToIso(local);
  return iso && !Number.isNaN(Date.parse(iso)) ? DATE_FORMAT.format(new Date(iso)) : 'À définir';
};

const snapshot = (draft: Draft) => JSON.stringify(toPayload(draft));

type Load =
  | { state: 'loading' }
  | { state: 'ready'; tournament: TournamentDetail; games: GameSummary[] | null }
  | { state: 'error'; message: ReactNode };

function loadError(cause: unknown): ReactNode {
  if (!(cause instanceof ApiRequestError)) return NETWORK_ERROR;
  if (cause.status === 401) {
    return (
      <>
        <Link href="/connexion">Connectez-vous</Link> pour gérer vos tournois.
      </>
    );
  }
  // 400 (identifiant mal formé), 403 (pas l'organisateur) et 404 : même message.
  if (cause.status < 500) return "Ce tournoi n'existe pas ou vous n'en êtes pas l'organisateur.";
  return cause.message;
}

/** Dashboard d'un tournoi pour son organisateur : tous les réglages après la création rapide. */
export function TournamentDashboard({ id, justCreated }: { id: string; justCreated: boolean }) {
  const [load, setLoad] = useState<Load>({ state: 'loading' });

  useEffect(() => {
    Promise.all([
      apiFetch<TournamentDetail>(`/me/tournaments/${id}`),
      apiFetch<GameSummary[]>('/games').catch(() => null),
    ]).then(
      ([tournament, games]) => setLoad({ state: 'ready', tournament, games }),
      (cause: unknown) => setLoad({ state: 'error', message: loadError(cause) }),
    );
  }, [id]);

  if (load.state === 'loading') {
    return (
      <p className={formStyles.hint} role="status">
        Chargement du tournoi…
      </p>
    );
  }
  if (load.state === 'error') {
    return (
      <>
        <h1 className={formStyles.title}>Gérer un tournoi</h1>
        <div role="alert" className={formStyles.alert}>
          <p>{load.message}</p>
        </div>
      </>
    );
  }
  return <Dashboard initial={load.tournament} games={load.games} justCreated={justCreated} />;
}

interface DashboardProps {
  initial: TournamentDetail;
  games: GameSummary[] | null;
  justCreated: boolean;
}

function Dashboard({ initial, games, justCreated }: DashboardProps) {
  const [tournament, setTournament] = useState(initial);
  const [draft, setDraft] = useState(() => toDraft(initial));
  const [saved, setSaved] = useState(() => snapshot(toDraft(initial)));
  const [section, setSection] = useState<SectionId>('overview');
  const [errors, setErrors] = useState<FieldErrors>({});
  const [alert, setAlert] = useState<ReactNode>(null);
  const [notice, setNotice] = useState<string | null>(
    justCreated
      ? 'Tournoi créé en brouillon : il n’est visible que par vous. Réglez-le, puis publiez-le.'
      : null,
  );
  const [pending, setPending] = useState<'save' | 'publish' | null>(null);
  /** Champ à atteindre dès que la section est affichée et que le formulaire n'est plus bloqué. */
  const focusTarget = useRef<string | null>(null);
  const [focusRequest, setFocusRequest] = useState(0);

  const { status } = tournament;
  const editable = status === 'DRAFT' || status === 'REGISTRATION';
  const dirty = useMemo(() => snapshot(draft) !== saved, [draft, saved]);
  const missing = publicationIssues(draft);

  const errorCounts = useMemo(() => {
    const counts: Partial<Record<SectionId, number>> = {};
    for (const path of Object.keys(errors)) {
      const target = sectionOf(path);
      counts[target] = (counts[target] ?? 0) + 1;
    }
    return counts;
  }, [errors]);

  useEffect(() => {
    if (!focusTarget.current || pending !== null) return;
    document.getElementById(fieldId(focusTarget.current))?.focus();
    focusTarget.current = null;
  }, [focusRequest, pending]);

  // shortcut: ne couvre que le rechargement et la fermeture, pas les liens internes de Next ;
  // à revoir si des organisateurs perdent des réglages en naviguant.
  useEffect(() => {
    const warn = (event: BeforeUnloadEvent) => {
      if (dirty) event.preventDefault();
    };
    window.addEventListener('beforeunload', warn);
    return () => window.removeEventListener('beforeunload', warn);
  }, [dirty]);

  function goTo(target: SectionId, path?: string) {
    setSection(target);
    focusTarget.current = path ?? null;
    setFocusRequest((count) => count + 1);
  }

  function update(patch: Partial<Draft>) {
    setDraft((current) => ({ ...current, ...patch }));
    setNotice(null);
  }

  function showErrors(next: FieldErrors) {
    setErrors(next);
    const paths = Object.keys(next);
    const sections = SECTIONS.filter(([id]) => paths.some((path) => sectionOf(path) === id));
    setAlert(
      <p>
        <strong>
          {paths.length} champ{paths.length > 1 ? 's' : ''} à corriger
        </strong>{' '}
        :{' '}
        {sections.map(([id, label], index) => (
          <span key={id}>
            {index > 0 && ', '}
            <button
              type="button"
              className={styles.link}
              onClick={() =>
                goTo(
                  id,
                  paths.find((path) => sectionOf(path) === id),
                )
              }
            >
              {label.toLowerCase()}
            </button>
          </span>
        ))}
        .
      </p>,
    );
    const first = paths[0];
    if (first) goTo(sectionOf(first), first);
  }

  function showApiError(cause: unknown) {
    if (!(cause instanceof ApiRequestError)) return setAlert(<p>{NETWORK_ERROR}</p>);
    if (cause.status === 401) {
      return setAlert(
        <p>
          Votre session a expiré : <Link href="/connexion">reconnectez-vous</Link>.
        </p>,
      );
    }
    const issues = cause.body?.issues ?? [];
    if (issues.length === 0) return setAlert(<p>{cause.message}</p>);
    showErrors(firstErrors(issues));
  }

  /** Enregistre les réglages et renvoie vrai si tout s'est bien passé. */
  async function save(): Promise<boolean> {
    const { data, errors: found } = validate(draft, games);
    if (found) {
      showErrors(found);
      return false;
    }
    try {
      const result = await apiFetch<TournamentDetail>(`/tournaments/${tournament.id}`, {
        method: 'PUT',
        body: JSON.stringify(data),
      });
      const next = toDraft(result);
      setTournament(result);
      setDraft(next);
      setSaved(snapshot(next));
      setErrors({});
      setAlert(null);
      return true;
    } catch (cause) {
      showApiError(cause);
      return false;
    }
  }

  async function handleSave() {
    setNotice(null);
    setPending('save');
    if (await save()) setNotice('Modifications enregistrées.');
    setPending(null);
  }

  /** Enregistre d'abord, pour ne jamais perdre les dernières modifications. */
  async function handlePublish() {
    setNotice(null);
    setPending('publish');
    if (await save()) {
      try {
        const result = await apiFetch<TournamentDetail>(`/tournaments/${tournament.id}/publish`, {
          method: 'POST',
        });
        setTournament(result);
        setNotice('Tournoi publié : les inscriptions sont ouvertes.');
      } catch (cause) {
        showApiError(cause);
      }
    }
    setPending(null);
  }

  const props: SectionProps = { draft, update, errors, games };

  return (
    <>
      <div className={styles.header}>
        <div className={styles.titleBlock}>
          <h1 className={formStyles.title}>{tournament.name}</h1>
          <span className={formStyles.badge} data-status={status}>
            {STATUS_LABELS[status]}
          </span>
        </div>
        {status === 'DRAFT' && (
          <button
            type="button"
            className={formStyles.submit}
            disabled={pending !== null || missing.length > 0}
            onClick={() => void handlePublish()}
          >
            {pending === 'publish' ? 'Publication…' : 'Publier'}
          </button>
        )}
      </div>

      <div role="alert">
        {!editable && (
          <div className={formStyles.alert}>
            <p>Ce tournoi est {STATUS_LABELS[status].toLowerCase()} : il ne se modifie plus.</p>
          </div>
        )}
        {alert && <div className={formStyles.alert}>{alert}</div>}
      </div>
      <div role="status">{notice && <div className={formStyles.success}>{notice}</div>}</div>

      <div className={styles.layout}>
        <nav aria-label="Réglages du tournoi" className={styles.nav}>
          <ul>
            {SECTIONS.map(([id, label]) => {
              const count = errorCounts[id];
              return (
                <li key={id}>
                  <button
                    type="button"
                    className={styles.navItem}
                    aria-current={section === id ? 'true' : undefined}
                    onClick={() => goTo(id)}
                  >
                    {label}
                    {count !== undefined && (
                      <span className={styles.navCount}>
                        {count}
                        <span className={styles.srOnly}> à corriger</span>
                      </span>
                    )}
                  </button>
                </li>
              );
            })}
          </ul>
        </nav>

        <form
          className={styles.content}
          aria-label={SECTIONS.find(([id]) => id === section)?.[1]}
          noValidate
          onSubmit={(event) => {
            event.preventDefault();
            void handleSave();
          }}
        >
          <fieldset className={formStyles.sections} disabled={!editable || pending !== null}>
            {section === 'overview' && (
              <Overview
                draft={draft}
                games={games}
                missing={status === 'DRAFT' ? missing : null}
                goTo={goTo}
              />
            )}
            {section === 'general' && <GeneralSection {...props} />}
            {section === 'game' && <GameSection {...props} />}
            {section === 'participants' && <ParticipantsSection {...props} />}
            {section === 'registrations' && (
              <RegistrationsSection
                tournamentId={tournament.id}
                maxParticipants={draft.maxParticipants}
              />
            )}
            {section === 'structure' && (
              <StructureSection {...props} clearErrors={() => setErrors({})} />
            )}
          </fieldset>

          {editable && (
            <div className={styles.saveBar}>
              <p className={formStyles.hint}>
                {dirty ? 'Modifications non enregistrées.' : 'Tout est enregistré.'}
              </p>
              <button
                type="submit"
                className={formStyles.submit}
                disabled={pending !== null || !dirty}
              >
                {pending === 'save' ? 'Enregistrement…' : 'Enregistrer'}
              </button>
            </div>
          )}
        </form>
      </div>
    </>
  );
}

function Overview({
  draft,
  games,
  missing,
  goTo,
}: {
  draft: Draft;
  games: GameSummary[] | null;
  /** Ce qu'il manque pour publier ; null si le tournoi n'est plus un brouillon. */
  missing: { path: string; message: string }[] | null;
  goTo: (section: SectionId, path?: string) => void;
}) {
  const game = games?.find((candidate) => candidate.id === draft.gameId);
  const isTeam = draft.participantType === 'TEAM';
  const place =
    draft.locationType === 'ONLINE' || !draft.locationType
      ? 'En ligne'
      : draft.location?.trim() || (draft.locationType === 'HYBRID' ? 'Hybride' : 'Sur place');

  return (
    <>
      {missing && (
        <section className={styles.panel} aria-labelledby="publication-titre">
          <h2 id="publication-titre">Avant de publier</h2>
          {missing.length === 0 ? (
            <p>Le tournoi a tout ce qu&apos;il faut pour être publié.</p>
          ) : (
            <ul className={styles.checklist}>
              {missing.map(({ path, message }) => (
                <li key={path}>
                  <button
                    type="button"
                    className={styles.link}
                    onClick={() => goTo(sectionOf(path), path === 'stages' ? undefined : path)}
                  >
                    {message}
                  </button>
                </li>
              ))}
            </ul>
          )}
        </section>
      )}

      <section className={styles.panel} aria-labelledby="resume-titre">
        <h2 id="resume-titre">Résumé</h2>
        <dl className={styles.summary}>
          <dt>Jeu</dt>
          <dd>{game?.name ?? 'À définir'}</dd>
          <dt>Début</dt>
          <dd className="tabular">{formatDate(draft.startsAt)}</dd>
          <dt>Fin</dt>
          <dd className="tabular">{formatDate(draft.endsAt)}</dd>
          <dt>Lieu</dt>
          <dd>{place}</dd>
          <dt>Participants</dt>
          <dd>
            {isTeam
              ? `Équipes de ${draft.teamSizeMin ?? '?'}${
                  draft.teamSizeMax !== draft.teamSizeMin ? ` à ${draft.teamSizeMax ?? '?'}` : ''
                } joueurs`
              : 'Joueurs seuls'}
          </dd>
          <dt>Places</dt>
          <dd className="tabular">{draft.maxParticipants ?? 'Illimitées'}</dd>
        </dl>
      </section>

      {draft.stages.length > 0 && (
        <section className={styles.panel} aria-labelledby="structure-titre">
          <h2 id="structure-titre">Structure</h2>
          <StructureFlow draft={draft} />
        </section>
      )}
    </>
  );
}

function GeneralSection({ draft, update, errors }: SectionProps) {
  return (
    <>
      <fieldset className={formStyles.section}>
        <legend>Informations</legend>
        <TextField
          path="name"
          label="Nom du tournoi"
          value={draft.name}
          onChange={(name) => update({ name: name ?? '' })}
          errors={errors}
          maxLength={100}
          wide
        />
        <SelectField
          path="visibility"
          label="Visibilité"
          value={draft.visibility ?? 'PUBLIC'}
          onChange={(value) => update({ visibility: value as Draft['visibility'] })}
          errors={errors}
          hint="Un tournoi non répertorié n'est accessible que par son lien."
          options={[
            ['PUBLIC', 'Public'],
            ['UNLISTED', 'Non répertorié'],
            ['PRIVATE', 'Privé'],
          ]}
          wide
        />
        <TextField
          path="description"
          label="Description"
          value={draft.description}
          onChange={(description) => update({ description })}
          errors={errors}
          rows={3}
          optional
          wide
        />
        <TextField
          path="rules"
          label="Règlement"
          value={draft.rules}
          onChange={(rules) => update({ rules })}
          errors={errors}
          rows={5}
          optional
          wide
        />
      </fieldset>

      <fieldset className={formStyles.section}>
        <legend>Dates et horaires</legend>
        <DateField
          path="startsAt"
          label="Début du tournoi"
          value={draft.startsAt}
          onChange={(startsAt) => update({ startsAt })}
          errors={errors}
        />
        <DateField
          path="endsAt"
          label="Fin du tournoi"
          value={draft.endsAt}
          onChange={(endsAt) => update({ endsAt })}
          errors={errors}
        />
        <p className={formStyles.hint} style={{ gridColumn: '1 / -1' }}>
          Heures de votre fuseau horaire.
        </p>
      </fieldset>
    </>
  );
}

function ParticipantsSection({ draft, update, errors, games }: SectionProps) {
  const isTeam = draft.participantType === 'TEAM';
  const slug = gameSlug(draft, games);
  const presets = slug ? (GAME_CATALOG[slug]?.teamPresets ?? []) : [];
  const playerCount =
    isTeam && draft.maxParticipants && draft.teamSizeMax
      ? draft.maxParticipants * draft.teamSizeMax
      : undefined;

  return (
    <>
      <fieldset className={formStyles.section}>
        <legend>Format et places</legend>
        {presets.length > 0 && (
          <div className={styles.presets}>
            <p className={formStyles.label}>Composition</p>
            <div className={styles.presetList}>
              {presets.map((preset) => {
                const active = isTeam
                  ? draft.teamSizeMin === preset.teamSize
                  : preset.teamSize === 1;
                return (
                  <button
                    key={preset.label}
                    type="button"
                    className={styles.preset}
                    aria-pressed={active}
                    onClick={() => update(teamPatch(preset.teamSize))}
                  >
                    {preset.label}
                  </button>
                );
              })}
            </div>
          </div>
        )}
        <RadioGroup
          path="participantType"
          label="Participants"
          value={draft.participantType ?? 'SOLO'}
          onChange={(participantType) =>
            update(
              participantType === 'TEAM'
                ? { participantType }
                : { participantType, teamSizeMin: undefined, teamSizeMax: undefined },
            )
          }
          options={[
            ['SOLO', 'Joueurs seuls'],
            ['TEAM', 'Équipes'],
          ]}
        />
        {isTeam && (
          <>
            <NumberField
              path="teamSizeMin"
              label="Joueurs par équipe (minimum)"
              value={draft.teamSizeMin}
              onChange={(teamSizeMin) => update({ teamSizeMin })}
              errors={errors}
              min={1}
              max={100}
            />
            <NumberField
              path="teamSizeMax"
              label="Joueurs par équipe (maximum)"
              hint="Remplaçants compris."
              value={draft.teamSizeMax}
              onChange={(teamSizeMax) => update({ teamSizeMax })}
              errors={errors}
              min={1}
              max={100}
            />
          </>
        )}
        <NumberField
          path="maxParticipants"
          label={isTeam ? "Nombre d'équipes" : "Nombre d'inscrits"}
          hint={
            playerCount
              ? `Soit jusqu'à ${playerCount} joueurs. Laissez vide pour ne pas limiter.`
              : `Maximum de ${participantUnit(draft)} ; laissez vide pour ne pas limiter.`
          }
          value={draft.maxParticipants}
          onChange={(maxParticipants) => update({ maxParticipants })}
          errors={errors}
          min={2}
          max={4096}
          optional
          wide
        />
      </fieldset>

      <fieldset className={`${formStyles.section} ${formStyles.sectionThree}`}>
        <legend>Inscriptions</legend>
        <SelectField
          path="registrationMode"
          label="Validation"
          value={draft.registrationMode ?? 'OPEN'}
          onChange={(value) => update({ registrationMode: value as Draft['registrationMode'] })}
          errors={errors}
          options={[
            ['OPEN', 'Ouvertes : toute inscription est acceptée'],
            ['APPROVAL', "Sur validation de l'organisateur"],
          ]}
          wide
        />
        <DateField
          path="registrationOpensAt"
          label="Ouverture"
          value={draft.registrationOpensAt}
          onChange={(registrationOpensAt) => update({ registrationOpensAt })}
          errors={errors}
          optional
        />
        <DateField
          path="registrationClosesAt"
          label="Clôture"
          value={draft.registrationClosesAt}
          onChange={(registrationClosesAt) => update({ registrationClosesAt })}
          errors={errors}
          optional
        />
        <DateField
          path="checkInOpensAt"
          label="Ouverture du check-in"
          value={draft.checkInOpensAt}
          onChange={(checkInOpensAt) => update({ checkInOpensAt })}
          errors={errors}
          optional
        />
      </fieldset>
    </>
  );
}

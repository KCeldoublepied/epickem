import { STAGE_FORMAT_LABELS, stageEntrants, stageInputSchema } from '@epickem/shared';
import { stagePreview } from '@epickem/tournament-engine';

import formStyles from '../../tournois/tournament-form.module.css';
import styles from './dashboard.module.css';
import type { Draft, StageDraft } from './draft';

/** Au-delà, les barres ne disent plus rien de plus : le nombre exact est écrit à côté. */
const MAX_BARS = 8;

const count = (value: number, word: string) => `${value} ${word}${value > 1 ? 's' : ''}`;

function previewOf(stage: StageDraft, entrants: number | undefined, isLast: boolean) {
  if (entrants === undefined) return null;
  // Le nom peut être vide en cours de saisie et la date n'est pas encore en ISO : sans effet ici.
  const parsed = stageInputSchema.safeParse({ ...stage, name: 'Aperçu', startsAt: undefined });
  if (!parsed.success) return null;
  return stagePreview(parsed.data, entrants, isLast ? 1 : (parsed.data.settings.qualifiers ?? 1));
}

/** Schéma de la compétition : ce que chaque phase va jouer, d'après ses réglages en cours. */
export function StructureFlow({ draft }: { draft: Draft }) {
  const { stages, maxParticipants } = draft;
  if (stages.length === 0) return null;

  const entrants = stageEntrants(stages, maxParticipants);
  const previews = stages.map((stage, index) =>
    previewOf(stage, entrants[index], index === stages.length - 1),
  );
  const unit = stages.every((stage) => stage.format === 'FREE_FOR_ALL') ? 'partie' : 'match';
  const min = previews.reduce((sum, preview) => sum + (preview?.minMatches ?? 0), 0);
  const max = previews.reduce((sum, preview) => sum + (preview?.maxMatches ?? 0), 0);

  return (
    <div className={styles.stack}>
      <ol className={styles.flow} aria-label="Schéma de la compétition">
        <li className={styles.flowLink}>
          {maxParticipants === undefined ? (
            'Inscriptions sans limite'
          ) : (
            <>
              <strong className="tabular">{maxParticipants}</strong>{' '}
              {draft.participantType === 'TEAM' ? 'équipes inscrites' : 'joueurs inscrits'}
            </>
          )}
        </li>
        {stages.map((stage, index) => {
          const preview = previews[index];
          const total = entrants[index];
          const stageUnit = stage.format === 'FREE_FOR_ALL' ? 'partie' : 'match';
          return (
            <li key={stage.key} className={styles.flowPhase}>
              <div className={styles.flowCard}>
                <p className={styles.flowTitle}>
                  <strong>{stage.name.trim() || `Phase ${index + 1}`}</strong>
                  <span>
                    {STAGE_FORMAT_LABELS[stage.format]}
                    {total !== undefined && ` · ${total} au départ`}
                  </span>
                </p>
                {preview ? (
                  <ol className={styles.flowSteps}>
                    {preview.steps.map((step) => (
                      <li key={step.label} className={styles.flowStep}>
                        <span className={styles.bars} aria-hidden="true">
                          {Array.from({ length: Math.min(step.matches, MAX_BARS) }, (_, bar) => (
                            <span key={bar} className={styles.bar} />
                          ))}
                        </span>
                        <strong>{step.label}</strong>
                        <span className="tabular">
                          {count(step.matches, stageUnit)}
                          {step.bestOf && ` · BO${step.bestOf}`}
                        </span>
                        {step.detail && <span>{step.detail}</span>}
                      </li>
                    ))}
                  </ol>
                ) : (
                  <p className={formStyles.hint}>
                    {total === undefined
                      ? "Fixez le nombre d'inscrits pour voir le déroulement."
                      : 'Déroulement indisponible : réglages à corriger.'}
                  </p>
                )}
              </div>
              <p className={styles.flowLink}>
                {index === stages.length - 1
                  ? 'Classement final'
                  : `↓ ${stage.settings.qualifiers ?? '?'} qualifiés`}
              </p>
            </li>
          );
        })}
      </ol>
      {previews.every(Boolean) && (
        <p className="tabular">
          <strong>Total : </strong>
          {min === max ? count(min, unit) : `${min} à ${count(max, unit)}`}
        </p>
      )}
    </div>
  );
}

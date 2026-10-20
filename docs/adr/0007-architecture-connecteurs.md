# ADR-0007 — Architecture en connecteurs pour les sources externes

- **Statut** : Acceptée
- **Date** : 2026-10-20
- **Issue liée** : #1, #23

## Contexte

Le sujet impose une **architecture en connecteurs** : start.gg est le seul connecteur livré, mais une autre plateforme de tournois doit pouvoir être branchée **sans modifier le cœur du produit** (02-D). Un guide du développeur de connecteurs avec tutoriel est attendu (03-C). Un tournoi importé est en lecture seule, ses résultats viennent de la source, et le constructeur de Pick'em ne propose que les questions résolubles avec les données disponibles (02-D, 02-F). L'API start.gg est une API GraphQL publique ; elle est utilisée selon ses conditions, pour des données publiques, avec un lien vers la source (01-C).

## Options envisagées

1. **Appels start.gg directement dans les services métier** — rapide au départ, mais couplage fort et second connecteur impossible sans toucher au cœur.
2. **Interface de connecteur + adaptateurs injectés (pattern Adapter)** — le cœur ne connaît que l'interface ; chaque source fournit un adaptateur.
3. **Système de plugins chargés dynamiquement** — très flexible, mais trop complexe pour le périmètre.

## Décision

Pattern **Adapter** avec une interface `TournamentConnector` définie dans `packages/shared` et des implémentations enregistrées dans le module `connectors` de NestJS :

```ts
interface TournamentConnector {
  readonly id: string;                         // "startgg"
  readonly capabilities: ConnectorCapabilities; // personnages, cartes, manches…
  search(query: string): Promise<ExternalTournamentSummary[]>;
  resolveUrl(url: string): Promise<ExternalTournamentRef | null>;
  fetchTournament(ref: ExternalTournamentRef): Promise<NormalizedTournament>;
  fetchUpdates(ref: ExternalTournamentRef, since?: Date): Promise<NormalizedUpdate[]>;
}
```

- Chaque connecteur convertit les données de la source vers le **modèle normalisé** de la plateforme ; le cœur ne manipule jamais de structure propre à start.gg.
- `capabilities` indique quelles données sont disponibles, ce qui permet au constructeur de Pick'em de filtrer les modèles de questions.
- Le connecteur start.gg utilise `graphql-request`, le cache et le limiteur de l'ADR-0006 ; son jeton est lu dans l'environnement, jamais versionné.
- Les tests utilisent des réponses enregistrées (mocks) : aucun test ne dépend du réseau (03-B).

## Conséquences

- **Positives** : second connecteur possible sans toucher au cœur (bonus du sujet) ; le guide des connecteurs se résume à « implémenter cette interface ».
- **Négatives / risques** : la correspondance vers le modèle normalisé peut perdre des informations propres à une source ; à documenter dans le guide.
- **Actions** : connecteur v1 (#23), synchronisation et mode dégradé (#41), guide des connecteurs (#60).

## Références

- Sujet : 01-C, 02-D, 02-F, 03-B (Tests), 03-C (Guide du développeur de connecteurs).

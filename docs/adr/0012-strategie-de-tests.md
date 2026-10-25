# ADR-0012 — Stratégie de tests

- **Statut** : Acceptée
- **Date** : 2026-10-20
- **Issue liée** : #1

## Contexte

Le sujet exige des tests couvrant au minimum : génération des arbres pour chaque format (avec exempts), appariement suisse, points FFA, qualifications, seeding et départage, verrouillage des pronostics, barème, résolution des Pick'em (y compris données manquantes), recalcul en cascade et connecteur start.gg. L'application mobile a ses propres tests. Les appels start.gg sont simulés, les tests passent sans connexion et se lancent en une seule commande (03-B).

## Décision

| Niveau           | Outil                                                        | Cible                                                             |
| ---------------- | ------------------------------------------------------------ | ----------------------------------------------------------------- |
| Unitaire         | **Vitest**                                                   | `tournament-engine`, `shared` (schémas, barèmes), services NestJS |
| Intégration API  | **Vitest + Supertest**, base PostgreSQL de test (conteneur)  | Routes, guards, verrouillage, transactions de recalcul            |
| Connecteur       | **Vitest** + réponses start.gg enregistrées (fixtures) / MSW | Conversion vers le modèle normalisé, cache, mode dégradé          |
| Mobile           | **Jest + React Native Testing Library**                      | Logique et écrans, sans émulateur                                 |
| Bout en bout web | **Playwright** + `@axe-core/playwright`                      | Parcours clés et accessibilité                                    |
| Charge           | **k6** (ADR-0015)                                            | Spectateurs simultanés, délai de mise à jour                      |

- `pnpm test` à la racine lance tous les tests via Turborepo ; `pnpm --filter <app> test -- <motif>` lance un seul test (documenté dans le guide de prise en main).
- Aucun test ne dépend du réseau ; les données de test sont générées de façon déterministe (seed fixe).
- Le moteur de tournois vise une couverture élevée ; la couverture est publiée par la CI.

## Conséquences

- **Positives** : chaque exigence de test du sujet a un emplacement identifié ; tests rapides car l'essentiel de la logique est pur.
- **Négatives / risques** : Vitest côté web/API et Jest côté mobile (React Native s'appuie sur Jest) — deux configurations à maintenir.

## Références

- Sujet : 03-B (Tests).

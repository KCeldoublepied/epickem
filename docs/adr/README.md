# Journal des décisions d'architecture (ADR)

Ce dossier rassemble les décisions d'architecture du projet Epickem. Chaque ADR décrit un choix structurant : son contexte, les options étudiées, la décision retenue et ses conséquences.

## Règles

- Un fichier par décision, numéroté : `NNNN-titre-court.md`, à partir du modèle [`template.md`](template.md).
- Une ADR acceptée n'est jamais réécrite. Si une décision change, on crée une nouvelle ADR qui la **remplace** et on passe l'ancienne au statut « Remplacée par ADR-XXXX ».
- Toute nouvelle ADR passe par une pull request relue par au moins un autre membre du groupe.
- Statuts possibles : `Proposée`, `Acceptée`, `Remplacée`, `Abandonnée`.

## Index

| N°                                                 | Décision                                                      | Statut   |
| -------------------------------------------------- | ------------------------------------------------------------- | -------- |
| [0000](0000-utiliser-des-adr.md)                   | Consigner les décisions d'architecture dans des ADR           | Acceptée |
| [0001](0001-monorepo-typescript-turborepo-pnpm.md) | Monorepo TypeScript avec Turborepo et pnpm                    | Acceptée |
| [0002](0002-frontend-web-nextjs.md)                | Front web et dashboard : Next.js, Tailwind CSS, Radix UI      | Acceptée |
| [0003](0003-backend-nestjs.md)                     | Serveur : NestJS (Node.js)                                    | Acceptée |
| [0004](0004-base-de-donnees-postgresql-prisma.md)  | Base de données : PostgreSQL 16 et Prisma                     | Acceptée |
| [0005](0005-temps-reel-socketio.md)                | Temps réel : Socket.io avec adaptateur Redis                  | Acceptée |
| [0006](0006-redis-cache-files-bullmq.md)           | Redis 7 et BullMQ pour le cache, le rate-limit et les tâches  | Acceptée |
| [0007](0007-architecture-connecteurs.md)           | Architecture en connecteurs pour les sources externes         | Acceptée |
| [0008](0008-moteur-de-tournois-strategy.md)        | Moteur de tournois : un package pur, une stratégie par format | Acceptée |
| [0009](0009-recalcul-en-cascade-et-audit.md)       | Recalcul en cascade transactionnel et journal d'audit         | Acceptée |
| [0010](0010-mobile-react-native-expo-android.md)   | Application mobile : React Native (Expo), cible Android       | Acceptée |
| [0011](0011-accessibilite-outillage.md)            | Accessibilité : composants et outillage                       | Acceptée |
| [0012](0012-strategie-de-tests.md)                 | Stratégie de tests                                            | Acceptée |
| [0013](0013-ci-cd-github-actions.md)               | CI/CD avec GitHub Actions                                     | Acceptée |
| [0014](0014-hebergement-gratuit.md)                | Hébergement gratuit de la plateforme de démonstration         | Proposée |
| [0015](0015-simulateur-et-tests-de-charge.md)      | Simulateur en TypeScript et tests de charge avec k6           | Acceptée |
| [0016](0016-documentation-vitepress.md)            | Documentation : VitePress, GitHub Pages et OpenAPI            | Acceptée |

## Vue d'ensemble de la stack

```
apps/
  web/         Next.js (App Router) + Tailwind + Radix UI      → ADR-0002
  api/         NestJS + Prisma + Socket.io + BullMQ            → ADR-0003 à 0007, 0009
  mobile/      React Native (Expo, prebuild) — Android         → ADR-0010
  simulator/   CLI TypeScript (faker) + scénarios k6           → ADR-0015
packages/
  shared/              types, schémas Zod, client API          → ADR-0001
  tournament-engine/   formats, appariements, barèmes (pur)    → ADR-0008
docs/          VitePress (utilisateur, technique, connecteurs) → ADR-0016
```

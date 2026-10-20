# ADR-0013 — CI/CD avec GitHub Actions

- **Statut** : Acceptée
- **Date** : 2026-10-20
- **Issue liée** : #1, #6, #7, #25, #50

## Contexte

L'intégration et le déploiement continus sont obligatoires (03-B) :

- pipeline à chaque pull request : lint, tests du web, du serveur et du mobile, build ;
- une PR dont le pipeline échoue ne peut pas être mergée (vérifications obligatoires sur la branche principale) ;
- chaque merge sur la branche principale met à jour automatiquement la plateforme en ligne avec ses données de démonstration ;
- chaque merge produit un build mobile installable, disponible en artefact ;
- secrets stockés dans les secrets GitHub ; pipeline décrit dans la documentation, badge d'état dans le README.

## Options envisagées

1. **GitHub Actions** — intégré au dépôt, aux PR, aux protections de branche et aux artefacts.
2. **GitLab CI, CircleCI** — nécessitent un service ou un miroir supplémentaire.
3. **EAS Build (Expo) pour le mobile** — pratique, mais quota gratuit limité et artefact hors de GitHub.

## Décision

**GitHub Actions** avec deux workflows :

- `ci.yml` (sur chaque PR et sur `main`) : installation pnpm avec cache → `pnpm lint` → `pnpm test` (avec services PostgreSQL et Redis) → `pnpm build`. Turborepo ne relance que ce qui a changé.
- `cd.yml` (sur push vers `main`, après succès de la CI) :
  - API : construction de l'image Docker, publication sur GitHub Container Registry, déploiement, puis `prisma migrate deploy` et chargement des données de démo ;
  - web : déploiement via l'intégration de l'hébergeur ;
  - mobile : `npx expo prebuild --platform android` puis `./gradlew assembleDebug`, APK publié en **artefact** du workflow. Un build `assembleRelease` signé reste possible si la clé de signature est fournie via les secrets GitHub ; la clé n'est jamais versionnée.
- Protection de `main` : PR obligatoire, une approbation, vérifications `ci` obligatoires, pas de force-push.
- Documentation : déploiement de VitePress sur GitHub Pages (ADR-0016).

## Conséquences

- **Positives** : tout le cycle de vie est visible dans GitHub ; aucun secret dans le code.
- **Négatives / risques** : les règles de protection de branche ne sont appliquées sur un dépôt **privé** qu'avec GitHub Pro (gratuit via le GitHub Student Developer Pack) ou si le dépôt est public ; quota de minutes Actions sur dépôt privé à surveiller (le build Android est le plus coûteux).
- **Actions** : CI (#6), protection de `main` (#7), déploiement continu (#25), CI mobile (#50).

## Références

- Sujet : 03-B (CI/CD).

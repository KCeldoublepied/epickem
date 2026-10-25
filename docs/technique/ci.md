# Intégration continue

Le pipeline est défini dans [`.github/workflows/ci.yml`](../../.github/workflows/ci.yml) et décrit dans
l'[ADR-0013](../adr/0013-ci-cd-github-actions.md). Il se lance **à chaque pull request** et **à chaque push sur `main`**.
Une nouvelle poussée sur la même branche annule l'exécution en cours.

## Les deux jobs

### « Lint, types, tests et build »

Sur un runner Ubuntu, avec un service PostgreSQL 16 :

1. installe pnpm (version du `package.json`) et Node.js (version du `.nvmrc`), avec le cache du store pnpm ;
2. `pnpm install --frozen-lockfile` : échoue si `pnpm-lock.yaml` n'est pas à jour ;
3. applique toutes les migrations Prisma sur une base vierge (`db:deploy`) : vérifie qu'elles s'enchaînent sans erreur ;
4. `pnpm lint`, `pnpm typecheck`, `pnpm test`, `pnpm build` sur tout le monorepo, via Turborepo.

`lint` et `test` ne font encore rien : ils prendront automatiquement en compte la configuration du lint (#3)
et les premiers tests dès qu'ils seront ajoutés aux packages.

### « Images Docker »

Construit les images de l'API et du web, démarre toute la plateforme avec `docker compose up --wait`
(migrations comprises), puis vérifie que `/health` et la page d'accueil répondent. C'est le test du nouvel arrivant,
automatisé. En cas d'échec, les logs des conteneurs sont affichés dans le job.

## Règle de fusion

Les deux jobs sont des **vérifications obligatoires** sur `main` : une PR dont la CI échoue ne peut pas être fusionnée.
Elles se configurent dans *Settings → Branches → règle `main` → Require status checks to pass before merging*,
en sélectionnant « Lint, types, tests et build » et « Images Docker ».

## Lancer les mêmes vérifications en local

```bash
pnpm install --frozen-lockfile
pnpm lint && pnpm typecheck && pnpm test && pnpm build
docker compose up --build --wait
```

## Secrets

Le pipeline n'utilise aucun secret pour l'instant. Les futurs secrets (déploiement, jeton start.gg, clé de signature
Android) seront ajoutés dans *Settings → Secrets and variables → Actions*, jamais dans le dépôt.

## À venir

- Déploiement continu de la plateforme à chaque merge sur `main` (#25).
- Build de l'APK Android en artefact du pipeline (#50).

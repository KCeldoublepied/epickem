# Contribuer à Epickem

Ce guide décrit comment le groupe travaille sur le dépôt : préparation de l'environnement, branches, commits, pull requests et versions. Toute contribution suit ces règles, y compris celles de l'équipe.

## Préparer son environnement

Prérequis : Git, Node.js 22, pnpm 10 (`npm install -g pnpm@10.28.0`) et, pour lancer toute la plateforme, Docker.

```bash
git clone https://github.com/KCeldoublepied/epickem.git
cd epickem
pnpm install
pnpm dev
```

Les commandes disponibles sont décrites dans le [README](README.md) et les choix techniques dans [`docs/adr/`](docs/adr/README.md).

## Organisation du travail

- Tout travail part d'une **issue** du [projet GitHub](https://github.com/orgs/KCeldoublepied/projects/1), avec un responsable assigné.
- Quand vous commencez, passez l'issue en **In Progress** ; quand la PR est ouverte, en **In Review**. La fermeture de l'issue la passe automatiquement en **Done**.
- Une issue = une branche = une pull request. Une PR qui mélange plusieurs sujets sera redécoupée.

## Stratégie de branches

Nous utilisons un flux simple, basé sur des branches courtes :

- **`main`** est la branche principale. Elle est **protégée** : on n'y pousse jamais directement, tout passe par une pull request relue et validée. Elle doit toujours être dans un état qui fonctionne.
- Chaque issue est développée dans une **branche dédiée**, créée depuis `main` à jour :

  ```
  <type>/<numéro-issue>-<description-courte>
  ```

  | Préfixe     | Usage                                           | Exemple                           |
  | ----------- | ----------------------------------------------- | --------------------------------- |
  | `feat/`     | nouvelle fonctionnalité                         | `feat/17-verrouillage-pronostics` |
  | `fix/`      | correction de bug                               | `fix/42-arbre-exempts`            |
  | `docs/`     | documentation                                   | `docs/1-adr`                      |
  | `chore/`    | outillage, configuration, CI                    | `chore/6-ci`                      |
  | `test/`     | ajout ou correction de tests                    | `test/29-ronde-suisse`            |
  | `refactor/` | restructuration sans changement de comportement | `refactor/9-schema-prisma`        |

- Les branches vivent quelques jours au plus. Une fois la PR fusionnée, la branche est supprimée.

```bash
git switch main
git pull
git switch -c feat/17-verrouillage-pronostics
# … travail, commits …
git push -u origin feat/17-verrouillage-pronostics
```

### Rester à jour avec `main`

Si `main` a avancé pendant votre travail, récupérez ses changements avant de demander la relecture :

```bash
git fetch origin
git merge origin/main
```

En cas de conflit sur `pnpm-lock.yaml`, ne l'éditez pas à la main :

```bash
git checkout origin/main -- pnpm-lock.yaml
pnpm install
git add pnpm-lock.yaml
```

## Convention de commits

Les messages de commit suivent les [Conventional Commits](https://www.conventionalcommits.org/fr/v1.0.0/) :

```
<type>(<portée facultative>): <description à l'impératif, en minuscules>
```

- **Types** : `feat`, `fix`, `docs`, `chore`, `test`, `refactor`, `perf`, `style`, `ci`, `build`.
- **Portées** courantes : `web`, `api`, `mobile`, `shared`, `engine`, `simulator`, `infra`, `adr`.
- Description courte (72 caractères au plus), en français, sans point final.
- Un changement incompatible est signalé par `!` après le type, par exemple `feat(api)!: …`, et détaillé dans le corps du commit.
- Référencez l'issue dans le corps : `Refs #12`.

Exemples :

```
feat(engine): génère l'arbre d'élimination simple avec exempts
fix(web): annonce les résultats en direct sans couper la lecture
docs(adr): ajoute la décision sur l'hébergement
chore(infra): lance la plateforme avec Docker Compose
```

Un hook Git (`commit-msg`) refuse tout commit dont le message ne respecte pas ce format.

## Qualité du code

- **ESLint** (`eslint.config.mjs`) : règles TypeScript, React, hooks et Next.js, et **accessibilité** (`jsx-a11y`, en mode strict, ADR-0011) pour le site web.
- **Prettier** (`.prettierrc.json`) : mise en forme automatique, guillemets simples, 100 caractères par ligne.
- **Hooks Git** installés automatiquement par `pnpm install` (Husky) :
  - `pre-commit` : ESLint et Prettier corrigent les fichiers modifiés avant chaque commit (lint-staged) ;
  - `commit-msg` : vérifie le format du message (commitlint).

```bash
pnpm lint           # signale les problèmes
pnpm lint:fix       # corrige ce qui peut l'être automatiquement
pnpm format         # met en forme tout le dépôt
pnpm format:check   # vérifie la mise en forme (lancé par la CI)
```

La CI lance `pnpm lint` et `pnpm format:check` : une PR qui ne les passe pas ne peut pas être fusionnée.
Dans VS Code, installez les extensions ESLint et Prettier et activez « Format on Save ».

## Pull requests

1. Ouvrez la PR vers `main`, avec un titre au format des commits et `Closes #<numéro>` dans la description.
2. Remplissez la checklist du modèle de PR : tests, accessibilité, documentation, absence de secrets.
3. Demandez la relecture à **au moins un autre membre** du groupe. L'auteur ne fusionne pas sa propre PR sans approbation.
4. La PR ne peut être fusionnée que si la CI est verte et la branche à jour avec `main`.
5. Après fusion, supprimez la branche.

Le relecteur vérifie que le code fonctionne en local, qu'il respecte les ADR, qu'il est testé et accessible, et qu'il est compréhensible par quelqu'un d'autre que son auteur.

## Versions et tags

Le projet suit le [versionnage sémantique](https://semver.org/lang/fr/) `MAJEUR.MINEUR.CORRECTIF` :

- **0.x** pendant le développement : le produit n'est pas encore stable.
- Un tag est posé sur `main` à chaque étape clé, et le [CHANGELOG](CHANGELOG.md) est mis à jour dans la même PR :

| Tag      | Étape                                  |
| -------- | -------------------------------------- |
| `v0.1.0` | M0 — Fondations                        |
| `v0.2.0` | M1 — MVP de bout en bout (follow-up)   |
| `v0.3.0` | M2 — Formats et Pick'em                |
| `v0.4.0` | M3 — Mobile, dashboard et simulateur   |
| `v1.0.0` | M4 — Version rendue pour la soutenance |

```bash
git switch main && git pull
git tag -a v0.1.0 -m "M0 — Fondations"
git push origin v0.1.0
```

## Sécurité

- Aucun secret (mot de passe, jeton start.gg, clé de signature) n'est commité : ils vont dans `.env` en local, et dans les secrets GitHub pour la CI.
- Si un secret a été poussé par erreur, prévenez immédiatement le groupe : il doit être révoqué et remplacé, le supprimer du dépôt ne suffit pas.

## Comportement

Toute participation au projet est soumise au [code de conduite](CODE_OF_CONDUCT.md).

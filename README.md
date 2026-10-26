<h1>
  <picture>
    <source media="(prefers-color-scheme: dark)" srcset="docs/identite/logo/logo-horizontal.svg">
    <img alt="Epickem" src="docs/identite/logo/logo-horizontal-sombre.svg" height="56">
  </picture>
</h1>

[![CI](https://github.com/KCeldoublepied/epickem/actions/workflows/ci.yml/badge.svg?branch=main)](https://github.com/KCeldoublepied/epickem/actions/workflows/ci.yml)

Plateforme de tournois et de pronostics en direct - projet PGE5

## Lancer la plateforme avec Docker

Seul prérequis : [Docker](https://docs.docker.com/get-docker/) avec Docker Compose
(sous Windows et macOS : Docker Desktop).

```bash
git clone https://github.com/KCeldoublepied/epickem.git
cd epickem
docker compose up --build
```

Le premier lancement construit les images (quelques minutes), les suivants sont rapides.

| Service      | Adresse                                                          |
| ------------ | ---------------------------------------------------------------- |
| Site web     | http://localhost:3000                                            |
| API          | http://localhost:4000/health                                     |
| Doc de l'API | http://localhost:4000/api/docs (Swagger)                         |
| PostgreSQL   | `localhost:5432` (utilisateur, mot de passe et base : `epickem`) |
| Redis        | `localhost:6379`                                                 |

Aucune configuration n'est nécessaire. Pour changer les identifiants ou les ports
(par exemple si le port 5432 est déjà pris), copier `.env.example` en `.env` et l'adapter.

Commandes utiles :

```bash
docker compose up -d --build       # lancer en arrière-plan
docker compose ps                  # état des services (healthy = prêt)
docker compose logs -f api         # suivre les logs d'un service
docker compose down                # arrêter (les données sont conservées)
docker compose down -v             # arrêter et effacer les données
docker compose up -d postgres redis   # seulement la base et Redis, pour développer avec pnpm
```

## Développer sans Docker

Prérequis : Node.js 22 et pnpm 10 (`npm install -g pnpm@10.28.0`).

```bash
pnpm install
pnpm dev          # web (http://localhost:3000) et API (http://localhost:4000)
pnpm dev:mobile   # application mobile (Expo)
pnpm build        # compile tout le monorepo
pnpm typecheck    # vérifie les types
pnpm test         # lance tous les tests
pnpm lint         # vérifie le code (ESLint)
pnpm format       # met en forme le code (Prettier)
pnpm simulate     # lance le simulateur
```

Base de données (PostgreSQL lancé avec `docker compose up -d postgres redis`) :

```bash
pnpm --filter @epickem/api db:migrate   # applique les migrations
pnpm --filter @epickem/api db:seed      # ajoute les données de départ (jeux et statistiques)
```

Les décisions d'architecture sont documentées dans [`docs/adr/`](docs/adr/README.md).
L'identité visuelle (logo, couleurs, typographie) est décrite dans la [charte graphique](docs/identite/charte-graphique.md).

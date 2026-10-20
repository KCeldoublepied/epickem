# ADR-0001 — Monorepo TypeScript avec Turborepo et pnpm

- **Statut** : Acceptée
- **Date** : 2026-10-20
- **Issue liée** : #1, #2

## Contexte

Le produit comporte un site web, un serveur, une application mobile et un simulateur. Les mêmes concepts (tournoi, match, pronostic, barème) circulent entre toutes ces briques. Le sujet impose :

- des tests lancés en **une seule commande** et un pipeline CI qui teste le web, le serveur et le mobile à chaque PR (03-B) ;
- une installation en une commande et le « test du nouvel arrivant » en moins de 15 minutes (03-B) ;
- des dépendances verrouillées par un lockfile (03-B).

L'équipe compte trois personnes qui doivent toutes pouvoir intervenir sur toutes les briques.

## Options envisagées

1. **Plusieurs dépôts (un par application)** — isolation forte, mais types dupliqués, versions désynchronisées, CI et onboarding multipliés.
2. **Monorepo avec Nx** — très complet, mais configuration plus lourde et courbe d'apprentissage plus longue.
3. **Monorepo avec Turborepo et pnpm workspaces** — orchestration simple des tâches (`lint`, `test`, `build`) avec cache, workspaces natifs, lockfile unique.
4. **Langages différents par brique** (ex. Python côté serveur) — possible, mais perte du partage de types entre le serveur, le web et le mobile.

## Décision

Un monorepo **100 % TypeScript (mode strict)**, géré par **pnpm workspaces** et orchestré par **Turborepo** :

```
apps/web               apps/api               apps/mobile           apps/simulator
packages/shared        packages/tournament-engine
packages/config        (configurations ESLint, TypeScript, Prettier partagées)
```

- `packages/shared` : types du domaine, schémas **Zod** (validation des formulaires, des imports CSV/JSON et des DTO), client API et hooks TanStack Query partagés entre web et mobile.
- `packages/tournament-engine` : logique métier pure des formats de tournoi et des barèmes (ADR-0008), sans dépendance au framework.

Commandes racine : `pnpm dev`, `pnpm test`, `pnpm lint`, `pnpm build`, toutes déléguées à Turborepo.

## Conséquences

- **Positives** : un contrat d'API typé de bout en bout, une seule commande pour tester tout le projet, un seul lockfile, chacun peut contribuer partout.
- **Négatives / risques** : l'application Expo demande une configuration Metro adaptée au monorepo pnpm (résolution des liens symboliques) ; un `pnpm install` initial plus long.
- **Actions** : configurer `turbo.json`, `pnpm-workspace.yaml`, les tsconfig partagés et ESLint/Prettier (#2, #3).

## Références

- Sujet : 03-B (Bonnes pratiques, Tests, Accueil d'un nouveau contributeur).

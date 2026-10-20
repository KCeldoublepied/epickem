# ADR-0002 — Front web et dashboard : Next.js, Tailwind CSS, Radix UI

- **Statut** : Acceptée
- **Date** : 2026-10-20
- **Issue liée** : #1

## Contexte

Le site web porte l'essentiel du produit : administration des tournois, inscriptions, pronostics, Pick'em, classements, pages publiques par tournoi et dashboard projetable en salle de LAN (02-C à 02-H). Il doit atteindre le niveau **WCAG 2.2 AA / RGAA** (03-A) : navigation complète au clavier y compris la saisie d'un arbre de pronostics, vue alternative aux arbres, annonces des mises à jour en direct, zoom à 200 %, `prefers-reduced-motion`.

## Options envisagées

1. **Next.js (React, App Router)** — rendu serveur pour les pages publiques, routage intégré, déploiement gratuit simple ; partage de code avec React Native.
2. **React + Vite (SPA)** — plus léger, mais pas de rendu serveur des pages publiques et routage à assembler.
3. **Vue 3 / Nuxt 3** — bon écosystème, mais aucun partage de hooks avec une application React Native.
4. **Angular** — complet mais verbeux, pas de partage avec le mobile.
5. **SvelteKit** — performant, écosystème de composants accessibles plus restreint.

## Décision

**Next.js (App Router) avec React**, stylé avec **Tailwind CSS**, composants accessibles **Radix UI** (via shadcn/ui), données via **TanStack Query**, tableaux via **TanStack Table**, formulaires via **React Hook Form + Zod**.

- Les pages publiques de tournoi sont rendues côté serveur (accessibles et lisibles sans JavaScript lourd).
- Les écrans interactifs (pronostics, dashboard) sont des composants client alimentés par Socket.io (ADR-0005).
- L'appel à l'API se fait via le client typé de `packages/shared`.

## Conséquences

- **Positives** : primitives Radix qui gèrent focus, rôles ARIA et navigation clavier ; hooks de données partagés avec le mobile ; déploiement continu gratuit sur Vercel.
- **Négatives / risques** : distinction composants serveur / client à maîtriser ; Next.js n'héberge **pas** le temps réel, qui reste dans l'API NestJS.
- **Actions** : mettre en place le design system à partir de la charte graphique (#10) et l'outillage d'accessibilité (ADR-0011).

## Références

- Sujet : 02-C, 02-H, 03-A.

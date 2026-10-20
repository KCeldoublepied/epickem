# ADR-0008 — Moteur de tournois : un package pur, une stratégie par format

- **Statut** : Acceptée
- **Date** : 2026-10-20
- **Issue liée** : #1, #16, #27 à #31

## Contexte

Un tournoi est une suite d'étapes, chacune avec son format : élimination simple ou double avec exempts, poules (round robin), ronde suisse (appariement par score sans rematch, départage Buchholz), FFA avec points de placement (02-C). Les étapes s'enchaînent avec des règles de qualification et de placement, des réglages par tour (BO1/BO3/BO5), un barème et des règles de départage. Le sujet exige des tests couvrant la génération des arbres pour chaque format, l'appariement suisse, les points FFA, les qualifications, le seeding, le départage et le barème (03-B), et un guide pour ajouter un format (03-B, accueil d'un nouveau contributeur).

## Options envisagées

1. **Logique de format dans les services NestJS** — accès direct à la base, mais logique difficile à tester isolément et mélangée à la persistance.
2. **Package pur avec une stratégie par format (pattern Strategy)** — fonctions déterministes sans accès réseau ni base, testables unitairement et réutilisables par le simulateur.
3. **Bibliothèque de brackets existante** — gain de temps sur l'affichage, mais ne couvre ni la ronde suisse avec Buchholz, ni le FFA, ni nos règles de qualification.

## Décision

Un package **`packages/tournament-engine`**, en TypeScript pur, sans dépendance à NestJS ni à Prisma :

- une interface `StageFormat` implémentée par `SingleEliminationFormat`, `DoubleEliminationFormat`, `RoundRobinFormat`, `SwissFormat`, `FreeForAllFormat` ;
- des fonctions pures : `generate(participants, settings)`, `applyResult(state, result)`, `standings(state)`, `qualifiers(state, rules)` ;
- le barème des pronostics et le calcul des points vivent aussi dans ce package ;
- l'état d'une étape est une donnée sérialisable : l'API le charge depuis la base, appelle le moteur, puis persiste le résultat dans une transaction (ADR-0009).

## Conséquences

- **Positives** : chaque règle du sujet est testable en isolation et rapidement ; le simulateur réutilise exactement le même code ; ajouter un format revient à ajouter une classe et ses tests.
- **Négatives / risques** : une couche de conversion entre l'état du moteur et le modèle Prisma, à maintenir.
- **Actions** : élimination simple (#16), double élimination (#27), poules (#28), suisse (#29), FFA (#30), qualifications (#31) — chacun avec ses tests.

## Références

- Sujet : 02-C (Étapes et formats, Planification et déroulement), 03-B (Tests), 03-C (Formats de tournoi).

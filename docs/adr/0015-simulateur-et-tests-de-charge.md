# ADR-0015 — Simulateur en TypeScript et tests de charge avec k6

- **Statut** : Acceptée
- **Date** : 2026-10-20
- **Issue liée** : #1, #52 à #54

## Contexte

Un simulateur génère joueurs, équipes et spectateurs fictifs, joue les matchs avec des statistiques réalistes et produit des pronostics, en accéléré ou en temps réel (02-J). Il alimente la démonstration (au moins trois tournois internes dont une ronde suisse, une double élimination et une FFA, plus deux tournois importés de start.gg avec Pick'em résolus) et sert aux **tests de charge** : des milliers de spectateurs qui pronostiquent pendant un même match, avec résultats documentés (02-J, 03-B). Aucune donnée personnelle réelle ne doit figurer sur la plateforme de démonstration (01-C).

## Options envisagées

1. **Scripts SQL de seed** — rapides, mais incapables de « jouer » un tournoi en direct.
2. **CLI TypeScript qui réutilise `tournament-engine` et appelle l'API** — même logique que la production, simulation en direct possible.
3. **Outils de charge** : k6, Artillery, Locust (Python).

## Décision

- **Simulateur** : application `apps/simulator`, CLI TypeScript utilisant `@faker-js/faker` avec un **seed fixe** (données reproductibles). Modes `seed` (crée les tournois de démo), `play --speed=<x>` (joue les matchs en accéléré ou en temps réel via l'API) et `crowd` (spectateurs qui pronostiquent).
- **Tests de charge** : **k6**, scénarios écrits en JavaScript, couvrant les requêtes HTTP de pronostic et les connexions WebSocket. Mesures : nombre de spectateurs supportés, latence des pronostics, délai de mise à jour des classements.
- Les tests de charge tournent en local (Docker Compose) ou sur un runner CI, jamais sur l'hébergement gratuit (ADR-0014). Les résultats et la configuration machine sont consignés dans `docs/`.

## Conséquences

- **Positives** : la démo est reproductible ; le simulateur exerce le vrai code ; les chiffres de charge sont mesurés.
- **Négatives / risques** : simuler des milliers de connexions WebSocket depuis une seule machine peut saturer le client de test lui-même ; documenter la méthode.
- **Actions** : simulateur (#52), tests de charge (#53), données de démo (#54).

## Références

- Sujet : 01-C, 02-J, 03-B (Sécurité et robustesse).

# ADR-0003 — Serveur : NestJS (Node.js)

- **Statut** : Acceptée
- **Date** : 2026-10-20
- **Issue liée** : #1

## Contexte

Le serveur centralise toute la logique sensible :

- permissions vérifiées côté serveur, sessions sécurisées, protection OWASP Top 10 (03-B) ;
- verrouillage des pronostics sur l'horloge du serveur (02-E, 03-B) ;
- moteur de tournois, résolution des Pick'em, recalcul en cascade (02-C à 02-G) ;
- connecteurs vers des sources externes, dont start.gg (02-D) ;
- diffusion temps réel (02-G, 02-H) ;
- référence d'API au format OpenAPI dans la documentation technique (03-C).

## Options envisagées

1. **NestJS** — architecture modulaire par domaine, injection de dépendances, guards, intégration WebSocket, génération OpenAPI par décorateurs.
2. **Fastify ou Express en TypeScript** — plus léger et rapide, mais l'architecture (modules, DI, validation, OpenAPI) est à construire soi-même.
3. **FastAPI (Python)** — OpenAPI natif et agréable pour les algorithmes, mais perte du partage de types avec le front et le mobile.
4. **Go ou ASP.NET Core** — très performants, mais un langage de plus pour une équipe de trois sur 3,5 mois.

## Décision

**NestJS** sur Node.js LTS, organisé en modules de domaine : `auth`, `games`, `tournaments`, `registrations`, `matches`, `predictions`, `pickems`, `leaderboards`, `connectors`, `realtime`, `audit`.

- Permissions : `Guards` NestJS (rôles administrateur / joueur / spectateur) appliqués à chaque route.
- Verrouillage : un guard dédié compare l'heure du serveur à `lockAt` avant toute création ou modification de pronostic, et refuse sinon (HTTP 403 + entrée de journal).
- Documentation : `@nestjs/swagger` expose la spécification OpenAPI et Swagger UI sur `/api/docs`.
- Validation : DTO dérivés des schémas Zod de `packages/shared`.
- Logs lisibles en développement (exigence 03-B) via un logger structuré (pino).

## Conséquences

- **Positives** : séparation nette des responsabilités, connecteurs injectables (ADR-0007), OpenAPI générée sans effort supplémentaire.
- **Négatives / risques** : surcoût de structure (décorateurs, modules) à apprendre en début de projet.
- **Actions** : squelette de l'API et authentification (#12), journal d'audit (#26).

## Références

- Sujet : 02-B, 02-D, 02-E, 03-B (Sécurité), 03-C (API).

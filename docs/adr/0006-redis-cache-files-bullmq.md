# ADR-0006 — Redis 7 et BullMQ pour le cache, le rate-limit et les tâches

- **Statut** : Acceptée
- **Date** : 2026-10-20
- **Issue liée** : #1, #41

## Contexte

- La synchronisation start.gg doit être régulière, mise en cache, respecter les limites de requêtes de l'API, et la plateforme doit rester utilisable si start.gg ne répond pas (02-D, 03-B).
- Les notifications (match appelé, pronostics bientôt verrouillés) et la clôture automatique des pronostics et des Pick'em doivent se déclencher à heure fixe (02-C, 02-E, 02-F, 02-I).
- Le temps réel multi-instances nécessite un bus de diffusion (ADR-0005).

## Options envisagées

1. **Redis + BullMQ** — files de tâches persistantes avec tentatives, délais et tâches répétées ; Redis sert aussi de cache et de bus Socket.io.
2. **Tâches planifiées en mémoire (`@nestjs/schedule`)** — simple, mais perdues au redémarrage et non partagées entre instances.
3. **Files basées sur PostgreSQL (pg-boss)** — une brique en moins, mais pas de cache ni de bus Socket.io.

## Décision

**Redis 7** avec **BullMQ** :

- **Cache start.gg** : réponses GraphQL stockées avec une durée de vie ; en cas d'échec ou de limitation de l'API, la plateforme sert la dernière version en cache et marque les données comme « synchronisation en attente ».
- **Rate-limit** : limiteur de BullMQ (ou seau à jetons dans Redis) réglé sous la limite documentée de start.gg ; tentatives avec attente exponentielle.
- **Tâches** : synchronisation périodique des tournois importés, verrouillage et résolution programmés, envoi de notifications.
- **Bus temps réel** : adaptateur Redis de Socket.io.

**Hébergement de Redis** : en local, Redis tourne dans Docker Compose. En ligne, nous **n'utilisons pas un Redis managé facturé au nombre de commandes** : BullMQ interroge Redis en continu, même au repos, et dépasserait vite un quota quotidien. Le choix précis est porté par ADR-0014.

## Conséquences

- **Positives** : résilience face aux pannes de start.gg ; tâches persistantes et observables ; une seule brique pour cache, files et diffusion.
- **Négatives / risques** : une dépendance d'infrastructure de plus ; consommation de commandes Redis à surveiller sur l'hébergement gratuit.
- **Actions** : connecteur start.gg avec cache et mode dégradé (#41), planification des notifications (#36, #48).

## Références

- Sujet : 02-D, 02-E, 02-I, 03-B (Sécurité et robustesse).

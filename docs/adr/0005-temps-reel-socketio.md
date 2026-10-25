# ADR-0005 — Temps réel : Socket.io avec adaptateur Redis

- **Statut** : Acceptée
- **Date** : 2026-10-20
- **Issue liée** : #1, #21

## Contexte

Chaque résultat fait avancer l'arbre et met à jour pronostics, Pick'em et classements **en temps réel** (01-A, 02-G). Le dashboard projetable et l'application mobile affichent ces changements en direct (02-H, 02-I). Les tests de charge visent des milliers de spectateurs pronostiquant pendant un même match (02-J). Les mises à jour en direct doivent être annoncées aux lecteurs d'écran sans submerger l'utilisateur (03-A).

## Options envisagées

1. **Socket.io** — salles (rooms), reconnexion automatique, repli en long-polling, adaptateur Redis pour plusieurs instances, client identique sur web et React Native.
2. **WebSocket natif (`ws`)** — plus léger, mais reconnexion, salles et diffusion multi-instances à coder.
3. **Server-Sent Events** — simple pour du descendant uniquement, moins adapté à React Native.
4. **Service temps réel managé** — dépendance externe et quotas gratuits limités.

## Décision

**Socket.io** via les _gateways_ NestJS, avec l'**adaptateur Redis** (`@socket.io/redis-adapter`).

- Une salle par tournoi (`tournament:{id}`) et par match (`match:{id}`) ; le client ne reçoit que ce qu'il suit.
- Événements typés dans `packages/shared` : `match.updated`, `bracket.updated`, `leaderboard.updated`, `predictions.distribution`, `pickem.resolved`.
- Le serveur reste la source de vérité : les clients ne modifient rien via le socket, toutes les écritures passent par l'API REST.
- Côté interface, les annonces aux lecteurs d'écran passent par une région `aria-live="polite"` dont les messages sont regroupés (par exemple toutes les 10 secondes) pour ne pas noyer l'utilisateur.

## Conséquences

- **Positives** : même client sur web et mobile ; montée en charge horizontale possible grâce à Redis.
- **Négatives / risques** : les hébergements gratuits peuvent mettre le serveur en veille et couper les connexions (ADR-0014) ; prévoir la reconnexion et le rechargement de l'état à la reconnexion.
- **Actions** : gateway temps réel (#21), dashboard (#51), tests de charge (#53).

## Références

- Sujet : 01-A, 02-G, 02-H, 02-J, 03-A (Lecteurs d'écran).

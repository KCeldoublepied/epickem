# ADR-0014 — Hébergement gratuit de la plateforme de démonstration

- **Statut** : Proposée — à valider par le groupe après test des offres
- **Date** : 2026-10-20
- **Issue liée** : #1, #25

## Contexte

La plateforme doit être accessible en ligne avec ses données de démonstration et mise à jour automatiquement à chaque merge, sur une offre d'hébergement gratuite au choix (03-B). Elle comprend un front Next.js, une API NestJS avec WebSockets et tâches BullMQ, PostgreSQL et Redis. Le jour de la soutenance, le jury pronostique en direct sur mobile pendant un tournoi simulé (04-A).

Points de vigilance des offres gratuites :

- certains hébergeurs mettent le service **en veille** après une période d'inactivité (réveil de plusieurs dizaines de secondes, connexions WebSocket coupées) ;
- certains Redis managés gratuits limitent le **nombre de commandes par jour**, incompatible avec BullMQ qui interroge Redis en continu (ADR-0006) ;
- les limites des offres évoluent : elles sont à vérifier au moment de la création des comptes.

## Options envisagées

| Brique          | Option principale                                                     | Alternatives                                                                              |
| --------------- | --------------------------------------------------------------------- | ----------------------------------------------------------------------------------------- |
| Web (Next.js)   | **Vercel** (offre Hobby)                                              | Cloudflare Pages, Netlify                                                                 |
| API + WebSocket | **Render** (Web Service gratuit, image Docker)                        | Koyeb, Fly.io, Railway (crédits étudiants)                                                |
| PostgreSQL      | **Neon**                                                              | Supabase, Aiven                                                                           |
| Redis           | **Redis Cloud** (offre gratuite limitée en mémoire, pas en commandes) | Redis dans le même service que l'API ; Upstash **exclu** si quota de commandes journalier |
| Documentation   | **GitHub Pages**                                                      | —                                                                                         |

## Décision proposée

Vercel (web) + Render (API en image Docker) + Neon (PostgreSQL) + Redis Cloud (Redis), documentation sur GitHub Pages. Toutes les URL et clés passent par les secrets GitHub et les variables d'environnement des hébergeurs.

Mesures pour la démo :

- réveiller l'API avant la soutenance (et/ou une tâche planifiée qui l'interroge régulièrement le jour J) ;
- le client web et mobile se reconnecte et recharge l'état automatiquement après une coupure (ADR-0005) ;
- les tests de charge ne sont **pas** lancés contre l'environnement gratuit, mais en local ou en CI (ADR-0015).

## Conséquences

- **Positives** : coût nul ; chaque brique sur une offre adaptée ; plateforme toujours à jour depuis `main`.
- **Négatives / risques** : quatre comptes à gérer ; latence entre services de fournisseurs différents (choisir des régions européennes proches) ; mises en veille.
- **Actions** : créer les comptes, tester un déploiement complet, puis passer cette ADR au statut « Acceptée » ou la remplacer (#25).

## Références

- Sujet : 03-B (CI/CD), 04-A (Soutenance), 04-B (Environnement en ligne).

# Journal des modifications

Toutes les modifications notables du projet sont consignées dans ce fichier.

Le format s'inspire de [Keep a Changelog](https://keepachangelog.com/fr/1.1.0/) et le projet suit le [versionnage sémantique](https://semver.org/lang/fr/). Les règles de mise à jour sont décrites dans [CONTRIBUTING.md](CONTRIBUTING.md#versions-et-tags).

## [Non publié]

### Ajouté

- Journal des décisions d'architecture dans `docs/adr/` (#1).
- Monorepo TypeScript : Turborepo, pnpm, applications web, API, mobile, simulateur et packages partagés (#2).
- Protection de la branche `main` (#7).
- Lancement de toute la plateforme en une commande avec Docker Compose (#8).
- Guide de contribution, code de conduite, licence et journal des modifications (#4, #11).
- Modèle de données v1 avec Prisma 7 et PostgreSQL, documenté dans `docs/technique/modele-donnees.md` (#9).
- Intégration continue GitHub Actions : migrations, lint, types, tests, build et images Docker à chaque PR (#6).

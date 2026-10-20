# ADR-0004 — Base de données : PostgreSQL 16 et Prisma

- **Statut** : Acceptée
- **Date** : 2026-10-20
- **Issue liée** : #1, #9

## Contexte

Le modèle de données comprend au moins 14 entités fortement liées : jeu, statistique, tournoi, étape, match, manche, équipe, joueur, inscription, pronostic, question, réponse, classement, source (03-C). Une correction de score déclenche un recalcul en cascade de l'arbre, des qualifiés et des points de tous les spectateurs, avec historique (02-G). Les statistiques par manche et les champs d'inscription varient selon le jeu et sont définis par l'administrateur (02-C).

## Options envisagées

1. **PostgreSQL + Prisma** — relationnel, transactions ACID, colonnes JSONB ; Prisma fournit un schéma lisible, des migrations et un seeding simples.
2. **PostgreSQL + Drizzle** — plus proche du SQL, performant, mais migrations et outillage moins guidés.
3. **MongoDB** — souple pour les statistiques variables, mais relations et transactions multi-documents plus fragiles pour un recalcul en cascade.
4. **MySQL / MariaDB** — relationnel, mais support JSON moins riche que JSONB.

## Décision

**PostgreSQL 16** avec **Prisma** comme ORM et outil de migration.

- Les relations (tournoi → étape → match → manche → pronostic) sont protégées par des clés étrangères.
- Les statistiques de manche et les champs personnalisés sont stockés en **JSONB**, validés par des schémas Zod générés à partir de la définition du jeu.
- Toute opération multi-entités (saisie de résultat, correction, import) s'exécute dans une transaction `prisma.$transaction` (ADR-0009).
- Les classements s'appuient sur des requêtes SQL d'agrégation (fonctions de fenêtrage `RANK`) ; Redis peut servir de cache de lecture (ADR-0006).
- Toutes les dates sont stockées en UTC.

## Conséquences

- **Positives** : cohérence garantie pendant les recalculs ; `schema.prisma` sert de base au modèle de données documenté ; migrations rejouables en CI et en déploiement (`prisma migrate deploy`).
- **Négatives / risques** : les requêtes d'agrégation complexes peuvent nécessiter du SQL brut (`$queryRaw`) ; contenu JSONB à valider côté application.
- **Actions** : schéma v1, diagramme et dictionnaire des champs (#9).

## Références

- Sujet : 02-C, 02-G, 03-C (Modèle de données).

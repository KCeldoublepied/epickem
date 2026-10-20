# ADR-0000 — Consigner les décisions d'architecture dans des ADR

- **Statut** : Acceptée
- **Date** : 2026-10-20
- **Issue liée** : #1

## Contexte

Le sujet demande une documentation technique contenant un « journal des décisions d'architecture (ADR) : contexte, options, choix retenu, conséquences » (bloc 03-C), et des choix de stack « justifiés dans la documentation technique » (bloc 01-B). Le projet dure trois mois et demi à trois personnes, et un développeur extérieur doit pouvoir reprendre le projet.

## Options envisagées

1. **Une page « Architecture » unique** — simple, mais l'historique des décisions et de leurs remplacements se perd.
2. **Des ADR au format Markdown dans le dépôt** — une décision par fichier, versionnée et relue en pull request comme le code.
3. **Un wiki GitHub** — hors du dépôt, donc hors des pull requests et des relectures.

## Décision

Nous utilisons des ADR en Markdown dans `docs/adr/`, une par décision, sur le modèle `template.md`. Une décision modifiée donne lieu à une nouvelle ADR qui remplace l'ancienne, sans réécriture de l'historique.

## Conséquences

- **Positives** : chaque choix est justifié et daté, la soutenance peut s'appuyer dessus, les ADR sont publiées avec le reste de la documentation (ADR-0016).
- **Négatives** : discipline nécessaire pour écrire l'ADR au moment de la décision et non après coup.
- **Actions** : toute PR qui introduit une dépendance structurante ou change l'architecture inclut ou référence une ADR.

## Références

- Sujet : blocs 01-B, 03-C (Décisions).
- Michael Nygard, *Documenting Architecture Decisions* (2011).

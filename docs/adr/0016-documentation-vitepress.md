# ADR-0016 — Documentation : VitePress, GitHub Pages et OpenAPI

- **Statut** : Acceptée
- **Date** : 2026-10-20
- **Issue liée** : #1, #58 à #61

## Contexte

La documentation fait partie du produit et s'écrit au fil du projet. Elle est versionnée dans le dépôt (`/docs`, en Markdown) ou publiée depuis celui-ci, dans une seule langue (03-C). Elle comprend une documentation utilisateur (administrateur, joueur, spectateur), une documentation technique (architecture, ADR, modèle de données, formats, pronostics, temps réel, API, mobile, exploitation) et un guide du développeur de connecteurs.

## Options envisagées

1. **Markdown brut dans `/docs`** — zéro outillage, mais navigation et recherche limitées pour des non-techniciens.
2. **VitePress** — site statique à partir du Markdown, recherche intégrée, léger, déployable sur GitHub Pages.
3. **Docusaurus** — complet, mais plus lourd (React, versionnage dont nous n'avons pas besoin).
4. **MkDocs Material** — excellent, mais outillage Python dans un monorepo TypeScript.

## Décision

- Documentation en **français**, en Markdown dans `docs/`, publiée avec **VitePress** sur **GitHub Pages** à chaque modification de `docs/` sur `main`.
- Arborescence : `docs/utilisateur/`, `docs/technique/`, `docs/adr/` (ce dossier), `docs/connecteurs/`, `docs/exploitation/`.
- Référence d'API : spécification OpenAPI générée par NestJS (ADR-0003), consultable via Swagger UI sur `/api/docs` et exportée en fichier dans la documentation.
- Diagrammes en Mermaid, rendus par VitePress.

## Conséquences

- **Positives** : la documentation vit avec le code et passe par les mêmes relectures ; un site consultable par le jury et les utilisateurs.
- **Négatives / risques** : un site de plus à déployer (simple via GitHub Actions).
- **Actions** : documentation utilisateur (#58), technique (#59), guide des connecteurs (#60), guide de prise en main (#61).

## Références

- Sujet : 03-C.

# ADR-0011 — Accessibilité : composants et outillage

- **Statut** : Acceptée
- **Date** : 2026-10-20
- **Issue liée** : #1, #55, #56

## Contexte

Le référentiel visé est le niveau **AA des WCAG 2.2**, transposé en France par le RGAA, sur le web et le mobile (03-A). Exigences minimales : tout au clavier, vue alternative aux arbres, HTML sémantique, annonces mesurées des mises à jour, contrastes 4,5:1, information jamais portée par la seule couleur, erreurs de formulaire explicites, zoom 200 %, `prefers-reduced-motion`, compatibilité TalkBack, tailles de texte dynamiques, zones tactiles de 48 dp. Preuves : audit automatique et manuel, déclaration d'accessibilité. Ces exigences comptent autant que les fonctionnalités.

## Options envisagées

1. **Traiter l'accessibilité en fin de projet** — rattrapage coûteux, risque élevé à la soutenance.
2. **Composants accessibles par défaut + vérifications automatiques dès le départ + audits manuels réguliers.**

## Décision

Option 2 :

- **Web** : primitives Radix UI ; boutons natifs dans chaque nœud d'arbre, navigation par flèches entre les tours et anneau de focus visible ; vue « tableau par tour » via TanStack Table (`<table>` sémantique) à côté de chaque arbre graphique ; région `aria-live="polite"` avec annonces regroupées ; icône + libellé en plus de chaque couleur de statut ; formulaires React Hook Form + Zod avec `aria-invalid` et `aria-describedby` ; unités `rem` et variantes `motion-safe` de Tailwind.
- **Mobile** : propriétés d'accessibilité React Native sur tous les éléments interactifs, `allowFontScaling` conservé, cibles tactiles d'au moins 48 dp.
- **Outillage** : `eslint-plugin-jsx-a11y` dans le lint ; tests Playwright avec `@axe-core/playwright` dans la CI ; Lighthouse et WAVE pour l'audit ; parcours manuels NVDA (web) et TalkBack (mobile) à chaque milestone.
- **Livrables** : rapports d'audit dans `docs/` et page « Déclaration d'accessibilité » sur la plateforme.

## Conséquences

- **Positives** : les erreurs sont détectées dès la pull request ; l'audit final confirme plutôt qu'il ne découvre.
- **Négatives / risques** : les outils automatiques ne détectent qu'une partie des problèmes ; les tests manuels restent indispensables et doivent être planifiés.
- **Actions** : audits web et mobile (#55, #56), déclaration (#57).

## Références

- Sujet : 01-D, 03-A.

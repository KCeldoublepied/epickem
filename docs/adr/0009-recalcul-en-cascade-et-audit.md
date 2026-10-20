# ADR-0009 — Recalcul en cascade transactionnel et journal d'audit

- **Statut** : Acceptée
- **Date** : 2026-10-20
- **Issue liée** : #1, #26, #40

## Contexte

Si un score est corrigé après un litige ou une synchronisation, l'arbre, les qualifiés et les points de **tous** les spectateurs sont recalculés, et l'historique en garde la trace (02-G). Les actions sensibles (correction de score, décision de litige, création et résolution de Pick'em) doivent figurer dans un journal d'audit (03-B). Les tests doivent couvrir le recalcul en cascade (03-B).

## Options envisagées

1. **Mises à jour incrémentales au fil de l'eau** — rapides, mais une correction tardive laisse facilement des données incohérentes.
2. **Event sourcing complet** — historique parfait et rejouable, mais refonte de tout le modèle autour des événements ; disproportionné pour 3,5 mois.
3. **Recalcul déterministe dans une transaction + journal d'audit immuable** — on rejoue le moteur à partir des résultats connus de l'étape, on recalcule les points concernés, le tout de manière atomique.

## Décision

Option 3 :

- Une correction ouvre une transaction `prisma.$transaction` qui : enregistre l'ancienne et la nouvelle valeur ; rejoue l'étape avec `tournament-engine` (ADR-0008) ; met à jour les matchs suivants, les qualifiés et les étapes dépendantes ; réévalue les pronostics et Pick'em impactés ; recalcule les classements.
- Si une étape suivante est déjà en cours et que la correction change un qualifié, le recalcul est **bloqué** et l'administrateur doit confirmer explicitement.
- Une table **`AuditLog`** en ajout seul (jamais modifiée ni supprimée) enregistre l'auteur, l'action, l'entité, l'avant/après et la date.
- Une table d'historique des points conserve les valeurs successives pour chaque spectateur.
- Après validation de la transaction, les événements temps réel sont diffusés (ADR-0005).

## Conséquences

- **Positives** : cohérence garantie, traçabilité complète pour le jury, comportement testable de bout en bout.
- **Négatives / risques** : un recalcul sur un gros tournoi peut être long ; le mesurer pendant les tests de charge et, si besoin, ne recalculer que les étapes en aval.
- **Actions** : journal d'audit (#26), recalcul en cascade et ses tests (#40).

## Références

- Sujet : 02-G, 03-B (Sécurité et robustesse, Tests), 03-C (Pronostics et Pick'em).

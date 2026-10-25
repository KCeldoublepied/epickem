# ADR-0010 — Application mobile : React Native (Expo), cible Android

- **Statut** : Acceptée
- **Date** : 2026-10-20
- **Issue liée** : #1, #24

## Contexte

L'application mobile doit permettre de suivre les tournois en direct, pronostiquer, répondre aux Pick'em, consulter classements et groupes, et recevoir des notifications (02-I). Contraintes du sujet :

- **technologie libre** : natif (Swift, Kotlin) ou multiplateforme (React Native, Flutter, Kotlin Multiplatform, .NET MAUI) ;
- **interdit** : les sites web emballés dans une application (PWA, Ionic / Capacitor, Cordova, simple WebView affichant le site) ;
- **une seule plateforme cible**, iOS **ou** Android, choix justifié dans la documentation technique ;
- accessibilité : TalkBack (Android) ou VoiceOver (iOS), tailles de texte dynamiques, zones tactiles d'au moins 48 dp / 44 pt (03-A) ;
- chaque merge produit automatiquement un build installable en artefact du pipeline (03-B).

## Options envisagées

| Option                                | Respect du sujet                | Accessibilité lecteur d'écran                                                                              | Build en CI                       | Partage avec le reste                                              |
| ------------------------------------- | ------------------------------- | ---------------------------------------------------------------------------------------------------------- | --------------------------------- | ------------------------------------------------------------------ |
| **React Native (Expo)**               | Oui, rendu en composants natifs | Composants natifs de l'OS, propriétés `accessibilityLabel`, `accessibilityRole`, `accessibilityLiveRegion` | APK sur runner Linux              | Types, schémas, client API, hooks TanStack Query, client Socket.io |
| **Flutter**                           | Oui, rendu natif via son moteur | Arbre sémantique à renseigner explicitement (`Semantics`)                                                  | APK sur runner Linux              | Aucun (Dart)                                                       |
| **Kotlin natif (Compose)**            | Oui                             | Excellente                                                                                                 | APK sur runner Linux              | Aucun ; un langage de plus                                         |
| **Swift natif (SwiftUI)**             | Oui                             | Excellente                                                                                                 | Runner macOS requis, plus coûteux | Aucun ; un langage de plus                                         |
| **Ionic / Capacitor / PWA / WebView** | **Non, interdit**               | —                                                                                                          | —                                 | —                                                                  |

## Décision

**React Native avec Expo (workflow _prebuild_)**, ciblant **Android**.

**Pourquoi ce n'est pas un site emballé** : React Native n'affiche aucune page web. Le code TypeScript pilote de vrais composants Android (`android.view.View`, `TextView`…) ; il n'y a ni WebView ni HTML. L'application ne charge pas le site, elle parle à l'API comme le site le fait. Aucun composant WebView ne sera utilisé dans l'application.

**Pourquoi Android** :

- l'APK se construit sur les runners Linux gratuits de GitHub Actions, alors qu'un build iOS exige un runner macOS ;
- l'APK s'installe directement sur un téléphone Android ou un émulateur, sans compte développeur, ce qui facilite la démo où le jury pronostique sur mobile.

**Pourquoi React Native plutôt que Flutter** : les trois membres du groupe peuvent contribuer au web et au mobile dans le même langage, une grande partie de la logique client est partagée via `packages/shared`, et l'accessibilité repose sur les composants natifs d'Android.

**Mise en œuvre** :

- navigation : React Navigation ; données : TanStack Query ; temps réel : client Socket.io partagé ;
- notifications : Expo Notifications ;
- le dossier `android/` est **généré** par `npx expo prebuild` et non versionné ;
- tests : Jest + React Native Testing Library, sans émulateur en CI.

## Conséquences

- **Positives** : conformité claire à la règle « pas de site emballé » ; artefact APK automatique ; mutualisation forte avec le web.
- **Négatives / risques** : configuration Metro à adapter au monorepo pnpm ; certaines bibliothèques natives demandent le prebuild ; pas de version iOS livrée.
- **Actions** : squelette (#24), écrans (#45 à #48), accessibilité mobile (#49), build en CI (#50, ADR-0013).

## Références

- Sujet : 02-I, 03-A (Application mobile), 03-B (CI/CD).

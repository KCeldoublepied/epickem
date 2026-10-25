// Configuration ESLint unique pour tout le monorepo (format « flat config »).
// Lancer : pnpm lint — corriger automatiquement ce qui peut l'être : pnpm lint:fix

import js from '@eslint/js';
import nextPlugin from '@next/eslint-plugin-next';
import prettier from 'eslint-config-prettier';
import jsxA11y from 'eslint-plugin-jsx-a11y';
import react from 'eslint-plugin-react';
import reactHooks from 'eslint-plugin-react-hooks';
import globals from 'globals';
import tseslint from 'typescript-eslint';

export default tseslint.config(
  {
    name: 'epickem/ignores',
    ignores: [
      '**/node_modules/**',
      '**/dist/**',
      '**/.next/**',
      '**/.turbo/**',
      '**/coverage/**',
      '**/generated/**',
      '**/next-env.d.ts',
      'apps/mobile/.expo/**',
      'apps/mobile/android/**',
      'apps/mobile/ios/**',
    ],
  },

  // --- Base : JavaScript et TypeScript, partout --------------------------------
  js.configs.recommended,
  ...tseslint.configs.recommended,
  {
    name: 'epickem/base',
    languageOptions: {
      globals: { ...globals.node },
    },
    rules: {
      // Variables inutilisées : autorisées si elles commencent par « _ ».
      '@typescript-eslint/no-unused-vars': [
        'error',
        { argsIgnorePattern: '^_', varsIgnorePattern: '^_', caughtErrorsIgnorePattern: '^_' },
      ],
      '@typescript-eslint/consistent-type-imports': ['error', { fixStyle: 'inline-type-imports' }],
      eqeqeq: ['error', 'always'],
      'no-console': ['warn', { allow: ['warn', 'error'] }],
    },
  },

  // --- Site web (Next.js) : React, hooks, accessibilité ------------------------
  {
    name: 'epickem/web',
    files: ['apps/web/**/*.{ts,tsx}'],
    ...react.configs.flat.recommended,
    ...react.configs.flat['jsx-runtime'],
    languageOptions: {
      ...react.configs.flat.recommended.languageOptions,
      globals: { ...globals.browser },
    },
    settings: { react: { version: 'detect' }, next: { rootDir: 'apps/web' } },
    plugins: {
      react,
      'react-hooks': reactHooks,
      '@next/next': nextPlugin,
      'jsx-a11y': jsxA11y,
    },
    rules: {
      ...react.configs.flat.recommended.rules,
      ...react.configs.flat['jsx-runtime'].rules,
      ...reactHooks.configs.flat.recommended.rules,
      ...nextPlugin.configs['core-web-vitals'].rules,
      // Accessibilité (WCAG 2.2 AA, ADR-0011) : les règles sont des erreurs, pas des avertissements.
      ...jsxA11y.flatConfigs.strict.rules,
      'react/prop-types': 'off',
    },
  },

  // --- Application mobile (React Native) : React et hooks ----------------------
  {
    name: 'epickem/mobile',
    files: ['apps/mobile/**/*.{ts,tsx}'],
    plugins: { react, 'react-hooks': reactHooks },
    languageOptions: {
      ...react.configs.flat.recommended.languageOptions,
      globals: { ...globals.browser },
    },
    settings: { react: { version: 'detect' } },
    rules: {
      ...react.configs.flat.recommended.rules,
      ...react.configs.flat['jsx-runtime'].rules,
      ...reactHooks.configs.flat.recommended.rules,
      'react/prop-types': 'off',
      // Concerne le HTML : en React Native, le texte n'est pas interprété comme du HTML.
      'react/no-unescaped-entities': 'off',
    },
  },

  // --- API (NestJS) -------------------------------------------------------------
  {
    name: 'epickem/api',
    files: ['apps/api/**/*.ts'],
    rules: {
      // NestJS injecte les dépendances grâce aux types des constructeurs : un « import type »
      // supprimerait ces métadonnées et casserait l'injection à l'exécution.
      '@typescript-eslint/consistent-type-imports': 'off',
    },
  },

  // --- Simulateur : outil en ligne de commande, console autorisée --------------
  {
    name: 'epickem/simulator',
    files: ['apps/simulator/**/*.ts'],
    rules: { 'no-console': 'off' },
  },

  // --- Fichiers de configuration en CommonJS -----------------------------------
  {
    name: 'epickem/commonjs',
    files: ['**/*.cjs'],
    languageOptions: { sourceType: 'commonjs' },
    rules: { '@typescript-eslint/no-require-imports': 'off' },
  },

  // Doit rester en dernier : désactive les règles de mise en forme, gérées par Prettier.
  prettier,
);

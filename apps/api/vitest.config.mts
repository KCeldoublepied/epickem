import swc from 'unplugin-swc';
import { defineConfig } from 'vitest/config';

export default defineConfig({
  // SWC compile le TypeScript avec les métadonnées des décorateurs, dont l'injection de
  // dépendances de Nest a besoin (esbuild, le compilateur par défaut de Vitest, ne les produit pas).
  plugins: [swc.vite({ module: { type: 'es6' } })],
  test: {
    // Tests unitaires à côté du code (src/**/*.spec.ts), tests de l'API complète dans test/.
    include: ['src/**/*.spec.ts', 'test/**/*.e2e-spec.ts'],
  },
});

import path from 'node:path';
import { fileURLToPath } from 'node:url';

const monorepoRoot = path.join(path.dirname(fileURLToPath(import.meta.url)), '../..');

/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  // Serveur autonome pour l'image Docker (apps/web/Dockerfile).
  output: 'standalone',
  // Racine du monorepo : permet d'inclure les packages partagés (packages/*) dans le build autonome.
  outputFileTracingRoot: monorepoRoot,
};

export default nextConfig;

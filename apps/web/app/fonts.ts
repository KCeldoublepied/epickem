import localFont from 'next/font/local';

// Polices hébergées dans le dépôt (licence OFL, voir OFL-*.txt) : pas d'appel à un service
// externe au build ni chez le visiteur, et le build Docker fonctionne hors ligne.

/** Titres et logo. */
export const cinzel = localFont({
  src: [{ path: './fonts/cinzel-latin-700-normal.woff2', weight: '700', style: 'normal' }],
  variable: '--epk-font-display',
  display: 'swap',
  fallback: ['Georgia', 'Times New Roman', 'serif'],
});

/** Interface, texte courant et scores. */
export const inter = localFont({
  src: [
    { path: './fonts/inter-latin-400-normal.woff2', weight: '400', style: 'normal' },
    { path: './fonts/inter-latin-600-normal.woff2', weight: '600', style: 'normal' },
    { path: './fonts/inter-latin-700-normal.woff2', weight: '700', style: 'normal' },
  ],
  variable: '--epk-font-body',
  display: 'swap',
  fallback: ['system-ui', '-apple-system', 'Segoe UI', 'Roboto', 'sans-serif'],
});

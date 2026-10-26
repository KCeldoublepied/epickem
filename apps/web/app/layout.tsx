import type { Metadata, Viewport } from 'next';
import type { ReactNode } from 'react';
import { APP_NAME, APP_TAGLINE, themeCss, themes } from '@epickem/shared';

import { cinzel, inter } from './fonts';
import './globals.css';

export const metadata: Metadata = {
  title: { default: APP_NAME, template: `%s · ${APP_NAME}` },
  description: `${APP_TAGLINE} Organisation de tournois et pronostics en direct.`,
};

export const viewport: Viewport = {
  themeColor: [
    { media: '(prefers-color-scheme: dark)', color: themes.dark.background },
    { media: '(prefers-color-scheme: light)', color: themes.light.background },
  ],
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="fr" className={`${cinzel.variable} ${inter.variable}`}>
      <head>
        {/* Couleurs de la charte (@epickem/shared) sous forme de variables CSS --epk-*. */}
        <style>{themeCss()}</style>
      </head>
      <body>{children}</body>
    </html>
  );
}

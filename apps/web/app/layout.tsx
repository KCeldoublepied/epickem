import type { Metadata } from 'next';
import type { ReactNode } from 'react';
import { APP_NAME } from '@epickem/shared';

export const metadata: Metadata = {
  title: APP_NAME,
  description: 'Organisation de tournois et pronostics en direct',
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="fr">
      <body>{children}</body>
    </html>
  );
}

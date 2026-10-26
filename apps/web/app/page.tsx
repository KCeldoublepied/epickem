import { APP_NAME, APP_TAGLINE } from '@epickem/shared';

import { Logo } from './logo';

export default function HomePage() {
  return (
    <main style={{ maxWidth: '40rem', margin: '0 auto', padding: '4rem 1rem' }}>
      <Logo height={56} />
      <h1 style={{ fontSize: '2rem', marginTop: '2rem' }}>{APP_NAME}</h1>
      <p style={{ color: 'var(--epk-accent)', fontWeight: 600 }}>{APP_TAGLINE}</p>
      <p style={{ color: 'var(--epk-text-muted)' }}>
        Le squelette du monorepo fonctionne : ce titre, les couleurs et le logo viennent du package
        partagé.
      </p>
    </main>
  );
}

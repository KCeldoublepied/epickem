import { APP_NAME } from '@epickem/shared';

export default function HomePage() {
  return (
    <main>
      <h1>{APP_NAME}</h1>
      <p>Le squelette du monorepo fonctionne : ce titre vient du package partagé.</p>
    </main>
  );
}

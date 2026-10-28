import { describe, expect, it } from 'vitest';
import { getDummyHash, hashPassword, verifyPassword } from './password';

describe('mots de passe', () => {
  it('vérifie le bon mot de passe et refuse les autres', async () => {
    const hash = await hashPassword('correct horse battery');
    expect(await verifyPassword('correct horse battery', hash)).toBe(true);
    expect(await verifyPassword('correct horse batterie', hash)).toBe(false);
  });

  it('ne stocke jamais le mot de passe en clair et sale chaque hachage', async () => {
    const [a, b] = await Promise.all([
      hashPassword('motdepasse123'),
      hashPassword('motdepasse123'),
    ]);
    expect(a).not.toContain('motdepasse123');
    expect(a).toMatch(/^scrypt\$131072\$8\$1\$/);
    expect(a).not.toBe(b);
  });

  it('refuse un hachage mal formé', async () => {
    expect(await verifyPassword('motdepasse123', 'pas-un-hachage')).toBe(false);
  });

  it('le hachage factice ne correspond à aucun mot de passe connu', async () => {
    expect(await verifyPassword('', await getDummyHash())).toBe(false);
  });
});

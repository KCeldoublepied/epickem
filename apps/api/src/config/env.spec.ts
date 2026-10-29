import { describe, expect, it } from 'vitest';
import { validateEnv } from './env';

const DATABASE_URL = 'postgresql://epickem:epickem@localhost:5432/epickem';

describe('validateEnv', () => {
  it('applique les valeurs par défaut', () => {
    expect(validateEnv({ DATABASE_URL })).toEqual({
      PORT: 4000,
      DATABASE_URL,
      WEB_ORIGIN: 'http://localhost:3000',
      COOKIE_SECURE: true,
      AUTH_RATE_LIMIT: 10,
    });
  });

  it('lit COOKIE_SECURE comme un booléen', () => {
    expect(validateEnv({ DATABASE_URL, COOKIE_SECURE: 'false' }).COOKIE_SECURE).toBe(false);
  });

  it('convertit le port en nombre', () => {
    expect(validateEnv({ DATABASE_URL, PORT: '8080' }).PORT).toBe(8080);
  });

  it('refuse une configuration sans DATABASE_URL', () => {
    expect(() => validateEnv({})).toThrow(/DATABASE_URL/);
  });

  it('refuse une base qui n’est pas PostgreSQL', () => {
    expect(() => validateEnv({ DATABASE_URL: 'mysql://localhost/epickem' })).toThrow(
      /DATABASE_URL/,
    );
  });

  it('liste toutes les variables invalides à la fois', () => {
    expect(() => validateEnv({ PORT: 'abc', WEB_ORIGIN: 'pas-une-url' })).toThrow(
      /PORT[\s\S]*DATABASE_URL[\s\S]*WEB_ORIGIN/,
    );
  });
});

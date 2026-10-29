import { randomBytes, scrypt, type ScryptOptions, timingSafeEqual } from 'node:crypto';

/**
 * Hachage des mots de passe avec scrypt, intégré à Node : aucune dépendance native.
 * Paramètres recommandés par l'OWASP (N = 2^17, r = 8, p = 1) : environ 128 Mo et une
 * centaine de millisecondes par hachage, ce qui rend les attaques par force brute coûteuses.
 *
 * Format stocké : `scrypt$<N>$<r>$<p>$<sel>$<empreinte>` (base64). Les paramètres sont
 * enregistrés avec l'empreinte : on pourra les renforcer sans invalider les comptes existants.
 */
const PARAMS = { N: 2 ** 17, r: 8, p: 1 };
const KEY_LENGTH = 64;
const SALT_LENGTH = 16;

function derive(password: string, salt: Buffer, params: typeof PARAMS): Promise<Buffer> {
  const options: ScryptOptions = {
    ...params,
    // Mémoire nécessaire : 128 × N × r octets ; la limite par défaut de Node (32 Mo) est trop basse.
    maxmem: 256 * params.N * params.r,
  };
  return new Promise((resolve, reject) => {
    scrypt(password.normalize('NFKC'), salt, KEY_LENGTH, options, (error, key) =>
      error ? reject(error) : resolve(key),
    );
  });
}

export async function hashPassword(password: string): Promise<string> {
  const salt = randomBytes(SALT_LENGTH);
  const key = await derive(password, salt, PARAMS);
  const { N, r, p } = PARAMS;
  return ['scrypt', N, r, p, salt.toString('base64'), key.toString('base64')].join('$');
}

/** Compare en temps constant ; un hachage mal formé ne correspond à aucun mot de passe. */
export async function verifyPassword(password: string, stored: string): Promise<boolean> {
  const [algorithm, N, r, p, salt, hash] = stored.split('$');
  if (algorithm !== 'scrypt' || !salt || !hash) return false;
  const expected = Buffer.from(hash, 'base64');
  const key = await derive(password, Buffer.from(salt, 'base64'), {
    N: Number(N),
    r: Number(r),
    p: Number(p),
  });
  return key.length === expected.length && timingSafeEqual(key, expected);
}

let dummyHash: Promise<string> | undefined;

/**
 * Hachage factice, vérifié quand le compte demandé n'existe pas : la connexion prend alors
 * le même temps, et sa durée ne révèle pas quels e-mails ou pseudos sont inscrits.
 */
export function getDummyHash(): Promise<string> {
  dummyHash ??= hashPassword(randomBytes(SALT_LENGTH).toString('base64'));
  return dummyHash;
}

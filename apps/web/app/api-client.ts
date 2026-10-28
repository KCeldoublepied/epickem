import type { ApiError } from '@epickem/shared';

/** Adresse de l'API vue par le navigateur. */
const API_URL = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4000';

/** Réponse en erreur de l'API ; `body` suit le format ApiError quand l'API a pu répondre. */
export class ApiRequestError extends Error {
  constructor(
    readonly status: number,
    readonly body: ApiError | null,
  ) {
    super(body?.message ?? `Erreur ${status}`);
  }
}

/**
 * Appel JSON à l'API. `credentials: 'include'` envoie et reçoit le cookie de session httpOnly.
 * Une panne réseau rejette avec l'erreur de `fetch` (TypeError), pas avec ApiRequestError.
 */
export async function apiFetch<T>(path: string, init: RequestInit = {}): Promise<T> {
  const response = await fetch(`${API_URL}${path}`, {
    ...init,
    credentials: 'include',
    headers: { 'Content-Type': 'application/json', ...init.headers },
  });
  if (!response.ok) {
    const body = (await response.json().catch(() => null)) as ApiError | null;
    throw new ApiRequestError(response.status, body);
  }
  return (response.status === 204 ? undefined : await response.json()) as T;
}

/** Date ISO (UTC) → valeur d'un champ datetime-local, à l'heure du navigateur. */
export function isoToLocal(iso: string): string {
  const date = new Date(iso);
  return new Date(date.getTime() - date.getTimezoneOffset() * 60_000).toISOString().slice(0, 16);
}

/**
 * Valeur d'un champ datetime-local → date ISO (UTC). Un champ vide donne undefined ; une date
 * impossible reste telle quelle, pour que la validation la refuse avec son message.
 */
export function localToIso(value: string | undefined): string | undefined {
  if (!value) return undefined;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? value : date.toISOString();
}

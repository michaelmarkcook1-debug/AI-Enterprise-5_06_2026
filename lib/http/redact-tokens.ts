// Strips anything shaped like a 256-bit CSPRNG token (64 hex chars — see
// lib/member/decision-shares.ts's share tokens) from a string before it's
// persisted anywhere that isn't the hashed token store itself. Defense-in-
// depth against a token leaking into an unrelated, unhashed sink (e.g. an
// analytics/log table) via its raw path/URL — see app/api/intent/route.ts.
const TOKEN_SHAPED = /[0-9a-f]{64}/gi;

export function redactTokens(value: string | undefined): string | null {
  if (!value) return null;
  return value.replace(TOKEN_SHAPED, "[redacted]");
}

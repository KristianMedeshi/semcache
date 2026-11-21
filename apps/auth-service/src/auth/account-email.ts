/**
 * Extracts and normalizes the email address from a request body for per-account throttling.
 */
export function accountEmail(
  req: { body?: { email?: unknown }; email?: unknown } | undefined | null,
): string {
  const email = req?.body?.email ?? req?.email;
  return typeof email === 'string' ? email.trim().normalize('NFC').toLowerCase() : '';
}

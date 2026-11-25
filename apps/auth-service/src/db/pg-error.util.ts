const MAX_CAUSE_DEPTH = 5;

/**
 * Walks an error and its `cause` chain to detect PostgreSQL unique-constraint violations (`23505`).
 */
export function isPgUniqueViolation(error: unknown): boolean {
  let current: unknown = error;
  for (let depth = 0; depth < MAX_CAUSE_DEPTH && current !== null && current !== undefined; depth++) {
    if (typeof current !== 'object') {
      return false;
    }
    if ((current as { code?: unknown }).code === '23505') {
      return true;
    }
    current = (current as { cause?: unknown }).cause;
  }
  return false;
}

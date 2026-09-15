export type PostgrestLikeError = {
  code?: string;
  message?: string;
  details?: string;
};

/**
 * Raw backend error text. Supabase throws \`PostgrestError\` plain objects (not
 * \`Error\` instances), so both shapes are read here.
 */
export function getPostgrestMessage(err: unknown): string {
  const e = (err ?? {}) as PostgrestLikeError;
  return err instanceof Error ? err.message : e.message ?? "";
}

/** Full error text including \`details\`, used for duplicate/constraint detection. */
export function getPostgrestText(err: unknown): string {
  const e = (err ?? {}) as PostgrestLikeError;
  return [getPostgrestMessage(err), e.details].filter(Boolean).join(" ");
}

/**
 * True for a Postgres unique-violation. PostgREST maps 23505 to HTTP 409, the
 * response the app must translate into a clear "already exists" message.
 */
export function isUniqueViolation(err: unknown, constraint?: string): boolean {
  const e = (err ?? {}) as PostgrestLikeError;
  if (e.code === "23505") return true;
  const text = getPostgrestText(err);
  if (!text.includes("duplicate key")) return false;
  return constraint ? text.includes(constraint) : true;
}

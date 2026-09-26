/** JWT helper shared by supabase factory tests. */
export function makeJwt(claims: Record<string, unknown>): string {
  const b64url = (s: string) =>
    Buffer.from(s, "utf8")
      .toString("base64")
      .replace(/\+/g, "-")
      .replace(/\//g, "_")
      .replace(/=+$/, "");
  return [
    b64url(JSON.stringify({ alg: "HS256", typ: "JWT" })),
    b64url(JSON.stringify(claims)),
    "sig",
  ].join(".");
}

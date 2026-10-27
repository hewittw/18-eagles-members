/** An http(s) URL, or null: anything else (javascript:, data:, junk) never becomes a link. Safe on server and client. */
export function httpUrl(v: unknown): string | null {
  if (typeof v !== "string" || v.length > 500) return null;
  try {
    const u = new URL(v);
    return u.protocol === "http:" || u.protocol === "https:" ? u.toString() : null;
  } catch {
    return null;
  }
}

// fetchJson: every outside call the workers make. A real User-Agent (ESPN blocks default ones), an 8 s timeout,
// and one typed error carrying the HTTP status, so a caller can spot 429 and skip instead of retrying.

export const USER_AGENT = "18Eagles/1.0 (class project; contact via github hewittw)";
export const TIMEOUT_MS = 8000;

export type FetchErrorKind = "http" | "timeout" | "network" | "json";

/** Thrown by fetchJson. `status` is the HTTP status, or 0 when there was no response (timeout, network, bad JSON). */
export class FetchError extends Error {
  readonly status: number;
  readonly kind: FetchErrorKind;
  readonly url: string;
  constructor(kind: FetchErrorKind, status: number, url: string, message: string) {
    super(message);
    this.name = "FetchError";
    this.kind = kind;
    this.status = status;
    this.url = url;
  }
}

/** True when the source said "too many requests": record the run and skip, don't retry. */
export function isRateLimited(e: unknown): boolean {
  return e instanceof FetchError && e.status === 429;
}

/** GET (or any method via init) and parse JSON. Throws FetchError on a non-2xx status, timeout, network error or bad JSON. */
export async function fetchJson<T = unknown>(url: string, init: RequestInit = {}, timeoutMs = TIMEOUT_MS): Promise<T> {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), timeoutMs);
  const signal = init.signal ? AbortSignal.any([init.signal, ctrl.signal]) : ctrl.signal;
  const host = safeHost(url);
  try {
    let res: Response;
    try {
      res = await fetch(url, {
        ...init,
        signal,
        headers: { "user-agent": USER_AGENT, accept: "application/json", ...headersObject(init.headers) },
      });
    } catch (e) {
      if (ctrl.signal.aborted) throw new FetchError("timeout", 0, url, `${host} timed out after ${timeoutMs / 1000}s`);
      throw new FetchError("network", 0, url, `${host} unreachable: ${(e as Error)?.message ?? e}`.slice(0, 200));
    }
    if (!res.ok) {
      await res.body?.cancel();
      throw new FetchError("http", res.status, url, `${host} answered HTTP ${res.status}`);
    }
    try {
      return (await res.json()) as T;
    } catch {
      if (ctrl.signal.aborted) throw new FetchError("timeout", 0, url, `${host} timed out after ${timeoutMs / 1000}s`);
      throw new FetchError("json", res.status, url, `${host} sent something that isn't JSON`);
    }
  } finally {
    clearTimeout(timer);
  }
}

function headersObject(h: HeadersInit | undefined): Record<string, string> {
  if (!h) return {};
  const out: Record<string, string> = {};
  new Headers(h).forEach((v, k) => { out[k] = v; });
  return out;
}

function safeHost(url: string): string {
  try { return new URL(url).host; } catch { return "source"; }
}

/**
 * Client-side mutation helper.
 *
 * `fetch` only rejects on network failure — a 401 (expired session) or 500
 * resolves normally, so `.catch()` alone silently hides server errors and
 * leaves optimistic UI diverged from the database. Always go through this.
 */
export interface PostResult {
  ok: boolean;
  status: number;
  error?: string;
}

export async function requestOk(
  url: string,
  method: "POST" | "PATCH" | "DELETE",
  body?: unknown
): Promise<PostResult> {
  try {
    const res = await fetch(url, {
      method,
      ...(body === undefined
        ? {}
        : { headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) }),
    });
    if (res.ok) return { ok: true, status: res.status };
    const data = (await res.json().catch(() => null)) as { error?: string } | null;
    return {
      ok: false,
      status: res.status,
      error: data?.error ?? (res.status === 401 ? "Session expired — reload and sign in" : `HTTP ${res.status}`),
    };
  } catch (e) {
    return { ok: false, status: 0, error: e instanceof Error ? e.message : "Network error" };
  }
}

export function postOk(url: string, body?: unknown): Promise<PostResult> {
  return requestOk(url, "POST", body);
}

/** Thrown by getJson on a non-2xx response, a network failure or an unparseable body. */
export class ApiError extends Error {
  /** HTTP status, or 0 for a network failure. */
  status: number;

  constructor(message: string, status: number) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
  }
}

/** True for the error fetch throws when its AbortSignal fires. Aborts are rethrown as-is, not as ApiError. */
export function isAbortError(err: unknown): boolean {
  return (
    (err instanceof DOMException && err.name === 'AbortError') ||
    (typeof err === 'object' && err !== null && (err as { name?: unknown }).name === 'AbortError')
  );
}

export async function getJson<T>(url: string, init?: { signal?: AbortSignal }): Promise<T> {
  let res: Response;
  try {
    res = await fetch(url, {
      signal: init?.signal,
      headers: { Accept: 'application/json' },
    });
  } catch (err) {
    if (isAbortError(err)) throw err;
    throw new ApiError('Network error: could not reach the server.', 0);
  }

  if (!res.ok) {
    throw new ApiError(`Request failed with status ${res.status}.`, res.status);
  }

  try {
    return (await res.json()) as T;
  } catch (err) {
    if (isAbortError(err)) throw err;
    throw new ApiError('The server sent a response that could not be read.', res.status);
  }
}

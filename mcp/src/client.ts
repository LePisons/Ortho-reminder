/**
 * Thin REST client for the OrthoReminder API. Authenticates with an `ork_` API
 * key via the Authorization header (see api/src/auth/combined-auth.guard.ts).
 */
export class OrthoApiError extends Error {
  constructor(
    readonly status: number,
    message: string,
  ) {
    super(message);
    this.name = 'OrthoApiError';
  }
}

export interface OrthoClientOptions {
  baseUrl: string;
  apiKey: string;
}

type Query = Record<string, string | number | boolean | undefined>;

export class OrthoClient {
  private readonly baseUrl: string;
  private readonly apiKey: string;

  constructor(opts: OrthoClientOptions) {
    this.baseUrl = opts.baseUrl.replace(/\/+$/, '');
    this.apiKey = opts.apiKey;
  }

  get<T = unknown>(path: string, query?: Query) {
    return this.request<T>('GET', path, undefined, query);
  }

  post<T = unknown>(path: string, body?: unknown) {
    return this.request<T>('POST', path, body);
  }

  patch<T = unknown>(path: string, body?: unknown) {
    return this.request<T>('PATCH', path, body);
  }

  delete<T = unknown>(path: string, query?: Query) {
    return this.request<T>('DELETE', path, undefined, query);
  }

  private async request<T>(
    method: string,
    path: string,
    body?: unknown,
    query?: Query,
  ): Promise<T> {
    const url = new URL(`${this.baseUrl}${path}`);
    if (query) {
      for (const [k, v] of Object.entries(query)) {
        if (v !== undefined) url.searchParams.set(k, String(v));
      }
    }

    const res = await fetch(url, {
      method,
      headers: {
        Authorization: `Bearer ${this.apiKey}`,
        ...(body !== undefined ? { 'Content-Type': 'application/json' } : {}),
      },
      body: body !== undefined ? JSON.stringify(body) : undefined,
    });

    const text = await res.text();
    let parsed: unknown = undefined;
    if (text) {
      try {
        parsed = JSON.parse(text);
      } catch {
        parsed = text;
      }
    }

    if (!res.ok) {
      // Nest exceptions serialize as { message, statusCode, error }. message may
      // be a string or an array of validation strings — surface both so the
      // agent can self-correct.
      const p = parsed as { message?: string | string[] } | undefined;
      const msg = p?.message
        ? Array.isArray(p.message)
          ? p.message.join('; ')
          : p.message
        : `HTTP ${res.status}`;
      throw new OrthoApiError(res.status, msg);
    }

    return parsed as T;
  }
}

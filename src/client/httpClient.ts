import type { Auth } from './types';

export class HttpClient {
  private baseUrl: string;
  private auth: Auth;
  private headers: Record<string, string>;

  constructor(baseUrl: string, auth: Auth) {
    this.baseUrl = baseUrl.replace(/\/$/, '');
    this.auth = auth;
    this.headers = {
      'Content-Type': 'application/json',
    };

    if (auth.apiKey) {
      this.headers['X-API-Key'] = auth.apiKey;
    } else if (auth.token) {
      this.headers['Authorization'] = `Bearer ${auth.token}`;
    }
  }

  private buildUrl(endpoint: string, params?: Record<string, string>): string {
    let url = `${this.baseUrl}${endpoint}`;
    if (params) {
      const searchParams = new URLSearchParams(params);
      url += `?${searchParams.toString()}`;
    }
    return url;
  }

  async get<T>(endpoint: string, params?: Record<string, string>): Promise<T> {
    const response = await fetch(this.buildUrl(endpoint, params), {
      method: 'GET',
      headers: this.headers,
    });
    if (!response.ok) {
      const error = await response.json().catch(() => ({ error: 'Request failed' })) as { error: string };
      throw new Error(error.error || `HTTP ${response.status}`);
    }
    if (response.status === 204) {
      return undefined as T;
    }
    return response.json() as Promise<T>;
  }

  async post<T>(endpoint: string, body?: unknown): Promise<T> {
    const response = await fetch(this.buildUrl(endpoint), {
      method: 'POST',
      headers: this.headers,
      body: body ? JSON.stringify(body) : undefined,
    });
    if (!response.ok) {
      const error = await response.json().catch(() => ({ error: 'Request failed' })) as { error: string };
      throw new Error(error.error || `HTTP ${response.status}`);
    }
    if (response.status === 204) {
      return undefined as T;
    }
    return response.json() as Promise<T>;
  }

  async delete(endpoint: string): Promise<void> {
    const response = await fetch(this.buildUrl(endpoint), {
      method: 'DELETE',
      headers: this.headers,
    });
    if (!response.ok) {
      const error = await response.json().catch(() => ({ error: 'Request failed' })) as { error: string };
      throw new Error(error.error || `HTTP ${response.status}`);
    }
  }
}

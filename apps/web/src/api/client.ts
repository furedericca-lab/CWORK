import type { ErrorEnvelope, HealthzResponse } from '@cwork/shared';

const API_BASE = import.meta.env.VITE_API_BASE ?? '/api/v1';

export class ApiError extends Error {
  readonly statusCode: number;
  readonly payload: ErrorEnvelope | undefined;

  constructor(message: string, statusCode: number, payload?: ErrorEnvelope) {
    super(message);
    this.name = 'ApiError';
    this.statusCode = statusCode;
    this.payload = payload;
  }
}

const tryParseJson = async <T>(response: Response): Promise<T | undefined> => {
  const text = await response.text();
  if (!text) {
    return undefined;
  }

  return JSON.parse(text) as T;
};

const fetchJson = async <T>(path: string, init?: RequestInit): Promise<T> => {
  const response = await fetch(`${API_BASE}${path}`, {
    ...init,
    headers: {
      'Content-Type': 'application/json',
      ...(init?.headers ?? {})
    }
  });

  if (!response.ok) {
    const payload = await tryParseJson<ErrorEnvelope>(response);
    throw new ApiError(payload?.error.message ?? `Request failed with status ${response.status}`, response.status, payload);
  }

  const data = await tryParseJson<T>(response);
  if (data === undefined) {
    throw new ApiError('Expected response body', response.status);
  }

  return data;
};

export const apiClient = {
  getHealthz: async (): Promise<HealthzResponse> => fetchJson<HealthzResponse>('/healthz')
};

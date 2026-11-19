import axios, { AxiosError, type AxiosInstance, type InternalAxiosRequestConfig } from 'axios';

const DEFAULT_API_BASE_URL = 'http://localhost:3000';

export class ApiError extends Error {
  readonly status: number;

  constructor(status: number, message: string) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
  }

  get isUnauthorized(): boolean {
    return this.status === 401;
  }

  get isForbidden(): boolean {
    return this.status === 403;
  }
}

export function getApiBaseUrl(): string {
  const configured = import.meta.env.VITE_API_BASE_URL;
  return (configured && configured.trim().length > 0 ? configured : DEFAULT_API_BASE_URL).replace(
    /\/+$/,
    '',
  );
}

function extractAxiosErrorMessage(error: AxiosError<{ message?: string | string[] }>): string {
  const payload = error.response?.data;
  if (payload) {
    if (Array.isArray(payload.message)) {
      return payload.message.join(', ');
    }
    if (typeof payload.message === 'string' && payload.message.length > 0) {
      return payload.message;
    }
  }
  return error.response?.statusText || error.message || 'Request failed';
}

type UnauthorizedListener = () => void;
const unauthorizedListeners = new Set<UnauthorizedListener>();

export function onUnauthorizedResponse(listener: UnauthorizedListener): () => void {
  unauthorizedListeners.add(listener);
  return () => {
    unauthorizedListeners.delete(listener);
  };
}

export function createApiClient(): AxiosInstance {
  const client = axios.create({
    baseURL: getApiBaseUrl(),
    withCredentials: true,
    headers: {
      'Content-Type': 'application/json',
    },
  });

  client.interceptors.request.use((config: InternalAxiosRequestConfig) => {
    config.withCredentials = true;
    return config;
  });

  client.interceptors.response.use(
    (response) => response,
    (error: unknown) => {
      if (axios.isAxiosError<{ message?: string | string[] }>(error)) {
        const status = error.response?.status ?? 0;
        const message = extractAxiosErrorMessage(error);

        if (status === 401) {
          for (const listener of unauthorizedListeners) {
            listener();
          }
        }

        return Promise.reject(new ApiError(status, message));
      }

      return Promise.reject(error);
    },
  );

  return client;
}

export const apiClient = createApiClient();

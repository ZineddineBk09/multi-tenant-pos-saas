import type { ApiError } from "@pos/types";

const TOKEN_KEY = "pos_auth_token";

export function getApiUrl(): string {
  return process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4000";
}

export function getToken(): string | null {
  if (typeof window === "undefined") return null;
  return localStorage.getItem(TOKEN_KEY);
}

export function setToken(token: string): void {
  localStorage.setItem(TOKEN_KEY, token);
}

export function clearToken(): void {
  localStorage.removeItem(TOKEN_KEY);
}

export class ApiClientError extends Error {
  constructor(
    message: string,
    public status: number,
    public details?: unknown,
  ) {
    super(message);
    this.name = "ApiClientError";
  }
}

export async function apiFetch<T>(
  path: string,
  options: RequestInit = {},
): Promise<T> {
  const token = getToken();
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    ...(options.headers as Record<string, string>),
  };

  if (token) {
    headers.Authorization = `Bearer ${token}`;
  }

  const response = await fetch(`${getApiUrl()}${path}`, {
    ...options,
    headers,
  });

  if (!response.ok) {
    const body = (await response.json().catch(() => ({}))) as ApiError;
    throw new ApiClientError(body.error ?? "Request failed", response.status, body.details);
  }

  if (response.status === 204) return undefined as T;
  return response.json() as Promise<T>;
}

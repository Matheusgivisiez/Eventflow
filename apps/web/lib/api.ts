import { useAuthStore } from "@/stores/auth-store";
import { getApiUrl } from "./api-url";

const API_URL = getApiUrl();

type ApiOptions = RequestInit & { auth?: boolean };
type ApiErrorBody = { message?: string | string[] };

export class ApiError extends Error {
  constructor(message: string, readonly status: number) {
    super(message);
    this.name = "ApiError";
  }
}

let refreshPromise: Promise<string> | undefined;

async function refreshAccessToken(store: ReturnType<typeof useAuthStore.getState>) {
  if (!refreshPromise) {
    refreshPromise = fetch(`${API_URL}/auth/refresh`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      credentials: "include"
    })
      .then(async (res) => {
        if (!res.ok) {
          // Only a definitive auth rejection should clear the session. A
          // network failure must not log the user out while the page reloads.
          if (res.status === 401 || res.status === 403) {
            store.logout();
          }
          throw new Error("Session refresh unavailable");
        }

        const data = await res.json();
        store.setSession({ accessToken: data.accessToken, user: data.user });
        return data.accessToken as string;
      })
      .catch((error) => {
        if (error instanceof Error && error.message === "Session refresh unavailable") {
          if (typeof window !== "undefined" && !useAuthStore.getState().user) {
            window.location.href = "/login";
          }
          throw new Error("Não foi possível renovar a sessão.");
        }
        throw new Error("Não foi possível renovar a sessão. Verifique sua conexão.");
      })
      .finally(() => {
        refreshPromise = undefined;
      });
  }

  return refreshPromise;
}

export async function api<T>(path: string, options: ApiOptions = {}): Promise<T> {
  const store = useAuthStore.getState();
  let token = store.accessToken;

  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    ...(options.headers as Record<string, string>)
  };

  if (options.auth !== false && token) {
    headers["Authorization"] = `Bearer ${token}`;
  }

  let response = await fetch(`${API_URL}${path}`, {
    ...options,
    headers,
    credentials: "include"
  });

  if (response.status === 401 && options.auth !== false && path !== "/auth/refresh") {
    token = await refreshAccessToken(store);

    const retryHeaders = { ...headers, Authorization: `Bearer ${token}` };
    response = await fetch(`${API_URL}${path}`, {
      ...options,
      headers: retryHeaders,
      credentials: "include"
    });
  }

  if (!response.ok) {
    const error = await response.json().catch((): ApiErrorBody => ({ message: "Erro inesperado." })) as ApiErrorBody;
    const message = Array.isArray(error.message) ? error.message.join(", ") : error.message ?? "Erro inesperado.";
    throw new ApiError(message, response.status);
  }

  return response.json();
}

export async function uploadFile(file: File): Promise<{ url: string }> {
  const token = useAuthStore.getState().accessToken;
  const form = new FormData();
  form.append("file", file);
  const response = await fetch(`${API_URL}/upload`, {
    method: "POST",
    headers: {
      ...(token ? { Authorization: `Bearer ${token}` } : {})
    },
    body: form,
    credentials: "include"
  });
  if (!response.ok) {
    const error = await response.json().catch(() => ({ message: "Erro no upload." }));
    throw new Error(error.message ?? "Erro no upload.");
  }
  return response.json();
}

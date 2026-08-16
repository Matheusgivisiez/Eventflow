import { useAuthStore } from "@/stores/auth-store";

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:3001/api";

type ApiOptions = RequestInit & { auth?: boolean };
type ApiErrorBody = { message?: string | string[] };

export class ApiError extends Error {
  constructor(message: string, readonly status: number) {
    super(message);
    this.name = "ApiError";
  }
}

let isRefreshing = false;
let refreshSubscribers: ((token: string) => void)[] = [];

function onRefreshed(token: string) {
  refreshSubscribers.forEach((cb) => cb(token));
  refreshSubscribers = [];
}

export async function api<T>(path: string, options: ApiOptions = {}): Promise<T> {
  const store = useAuthStore.getState();
  let token = store.accessToken;

  let headers: Record<string, string> = {
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
    if (!isRefreshing) {
      isRefreshing = true;
      try {
        const res = await fetch(`${API_URL}/auth/refresh`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          credentials: "include"
        });
        
        if (!res.ok) throw new Error("Session expired");
        
        const data = await res.json();
        store.setSession({ accessToken: data.accessToken, user: data.user });
        onRefreshed(data.accessToken);
        isRefreshing = false;
      } catch (err) {
        isRefreshing = false;
        refreshSubscribers = [];
        store.logout();
        if (typeof window !== "undefined") window.location.href = "/login";
        throw new Error("Sessão expirada. Faça login novamente.");
      }
    }

    token = await new Promise<string>((resolve) => {
      refreshSubscribers.push(resolve);
    });

    headers["Authorization"] = `Bearer ${token}`;
    response = await fetch(`${API_URL}${path}`, {
      ...options,
      headers,
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

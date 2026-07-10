import { useAuthStore } from "@/stores/auth-store";

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:3001/api";

type ApiOptions = RequestInit & { auth?: boolean };

export async function api<T>(path: string, options: ApiOptions = {}): Promise<T> {
  const token = useAuthStore.getState().accessToken;
  const response = await fetch(`${API_URL}${path}`, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      ...(options.auth !== false && token ? { Authorization: `Bearer ${token}` } : {}),
      ...options.headers
    }
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({ message: "Erro inesperado." }));
    throw new Error(Array.isArray(error.message) ? error.message.join(", ") : error.message ?? "Erro inesperado.");
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
    body: form
  });
  if (!response.ok) {
    const error = await response.json().catch(() => ({ message: "Erro no upload." }));
    throw new Error(error.message ?? "Erro no upload.");
  }
  return response.json();
}

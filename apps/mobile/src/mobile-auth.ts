export const DEFAULT_API_URL = "http://localhost:3001/api";

export type MobileUser = {
  id: string;
  tenantId?: string | null;
  name: string;
  email: string;
  role: string;
};

export type LoginResult = {
  accessToken: string;
  user: MobileUser;
};

type FetchLike = typeof fetch;

export function normalizeApiUrl(value?: string | null) {
  const raw = value?.trim() || DEFAULT_API_URL;
  return raw.replace(/\/+$/, "");
}

export async function loginWithPassword(
  apiUrl: string,
  credentials: { email: string; password: string },
  fetcher: FetchLike = fetch
): Promise<LoginResult> {
  const response = await fetcher(`${normalizeApiUrl(apiUrl)}/auth/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(credentials)
  });

  const payload = await readJson(response);
  if (!response.ok) {
    throw new Error(errorMessage(payload, "Falha ao entrar."));
  }
  const userPayload = asRecord(payload.user);
  if (!payload.accessToken || !userPayload) {
    throw new Error("Resposta de login invalida.");
  }

  return {
    accessToken: String(payload.accessToken),
    user: {
      id: String(userPayload.id),
      tenantId: userPayload.tenantId ? String(userPayload.tenantId) : null,
      name: String(userPayload.name ?? ""),
      email: String(userPayload.email ?? ""),
      role: String(userPayload.role ?? "")
    }
  };
}

export async function fetchCurrentUser(apiUrl: string, token: string, fetcher: FetchLike = fetch): Promise<MobileUser> {
  const response = await fetcher(`${normalizeApiUrl(apiUrl)}/auth/me`, {
    headers: { Authorization: `Bearer ${token}` }
  });

  const payload = await readJson(response);
  if (!response.ok) {
    throw new Error(errorMessage(payload, "Sessao expirada."));
  }

  return {
    id: String(payload.id),
    tenantId: payload.tenantId ? String(payload.tenantId) : null,
    name: String(payload.name ?? ""),
    email: String(payload.email ?? ""),
    role: String(payload.role ?? "")
  };
}

export async function registerMobileDevice(
  apiUrl: string,
  token: string,
  device: { id: string; platform: string; deviceName?: string; appVersion?: string },
  fetcher: FetchLike = fetch
) {
  const response = await fetcher(`${normalizeApiUrl(apiUrl)}/enterprise/mobile/devices`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json"
    },
    body: JSON.stringify(device)
  });

  const payload = await readJson(response);
  if (!response.ok) {
    throw new Error(errorMessage(payload, "Conta sem permissao para check-in mobile."));
  }

  return payload;
}

async function readJson(response: Response): Promise<Record<string, unknown>> {
  return response.json().catch(() => ({}));
}

function asRecord(value: unknown): Record<string, unknown> | undefined {
  return value && typeof value === "object" ? value as Record<string, unknown> : undefined;
}

function errorMessage(payload: Record<string, unknown>, fallback: string) {
  return typeof payload.message === "string" ? payload.message : fallback;
}

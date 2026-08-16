import test from "node:test";
import assert from "node:assert/strict";
import { DEFAULT_API_URL, fetchCurrentUser, loginWithPassword, normalizeApiUrl, registerMobileDevice } from "./mobile-auth";

test("normalizes configured API URL and falls back to local default", () => {
  assert.equal(normalizeApiUrl("https://api.eventflow.app/api///"), "https://api.eventflow.app/api");
  assert.equal(normalizeApiUrl("   "), DEFAULT_API_URL);
});

test("login posts credentials and returns only access token plus user", async () => {
  const calls: Array<{ url: string; init?: RequestInit }> = [];
  const fetcher = async (url: string | URL | Request, init?: RequestInit) => {
    calls.push({ url: String(url), init });
    return new Response(JSON.stringify({
      accessToken: "access-token",
      refreshToken: "server-cookie-only",
      user: { id: "user-1", tenantId: "tenant-1", name: "Operador", email: "op@example.com", role: "TEAM" }
    }), { status: 201, headers: { "Content-Type": "application/json" } });
  };

  const result = await loginWithPassword("https://api.eventflow.app/api/", { email: "op@example.com", password: "12345678" }, fetcher as typeof fetch);

  assert.equal(calls[0].url, "https://api.eventflow.app/api/auth/login");
  assert.equal(result.accessToken, "access-token");
  assert.deepEqual(result.user, {
    id: "user-1",
    tenantId: "tenant-1",
    name: "Operador",
    email: "op@example.com",
    role: "TEAM"
  });
  assert.equal("refreshToken" in result, false);
});

test("login fails closed when API does not return an access token", async () => {
  const fetcher = async () => new Response(JSON.stringify({ user: { id: "user-1" } }), { status: 200 });

  await assert.rejects(
    () => loginWithPassword(DEFAULT_API_URL, { email: "op@example.com", password: "12345678" }, fetcher as typeof fetch),
    /Resposta de login invalida/
  );
});

test("fetchCurrentUser uses bearer token without exposing it in URL", async () => {
  const calls: Array<{ url: string; init?: RequestInit }> = [];
  const fetcher = async (url: string | URL | Request, init?: RequestInit) => {
    calls.push({ url: String(url), init });
    return new Response(JSON.stringify({ id: "user-1", tenantId: "tenant-1", name: "Operador", email: "op@example.com", role: "ORGANIZER" }));
  };

  const user = await fetchCurrentUser("https://api.eventflow.app/api", "secret-access-token", fetcher as typeof fetch);

  assert.equal(calls[0].url, "https://api.eventflow.app/api/auth/me");
  assert.equal(calls[0].url.includes("secret-access-token"), false);
  assert.equal((calls[0].init?.headers as Record<string, string>).Authorization, "Bearer secret-access-token");
  assert.equal(user.role, "ORGANIZER");
});

test("registerMobileDevice validates check-in permission with bearer auth", async () => {
  const calls: Array<{ url: string; init?: RequestInit }> = [];
  const fetcher = async (url: string | URL | Request, init?: RequestInit) => {
    calls.push({ url: String(url), init });
    return new Response(JSON.stringify({ id: "device-1" }), { status: 201 });
  };

  await registerMobileDevice(
    DEFAULT_API_URL,
    "access-token",
    { id: "device-1", platform: "ios", appVersion: "0.1.0" },
    fetcher as typeof fetch
  );

  assert.equal(calls[0].url, `${DEFAULT_API_URL}/enterprise/mobile/devices`);
  assert.equal((calls[0].init?.headers as Record<string, string>).Authorization, "Bearer access-token");
  assert.match(String(calls[0].init?.body), /"platform":"ios"/);
});

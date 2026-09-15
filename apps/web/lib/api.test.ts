import assert from "node:assert/strict";
import { beforeEach, describe, it } from "node:test";
import { ApiError, api } from "./api";
import { useAuthStore, type AuthUser } from "@/stores/auth-store";

const user: AuthUser = {
  id: "user-1",
  tenantId: "tenant-1",
  name: "Organizer",
  email: "organizer@example.com",
  role: "ORGANIZER"
};

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" }
  });
}

describe("api refresh handling", () => {
  beforeEach(() => {
    useAuthStore.setState({ accessToken: "old-token", user });
  });

  it("refreshes the access token and retries the original request", async () => {
    const calls: Array<{ url: string; authorization?: string }> = [];

    globalThis.fetch = async (input, init) => {
      const url = String(input);
      const headers = init?.headers as Record<string, string> | undefined;
      calls.push({ url, authorization: headers?.Authorization });

      if (url.endsWith("/auth/refresh")) {
        return jsonResponse({ accessToken: "new-token", user });
      }

      if (headers?.Authorization === "Bearer old-token") {
        return jsonResponse({ message: "expired" }, 401);
      }

      return jsonResponse({ ok: true });
    };

    const result = await api<{ ok: boolean }>("/private");

    assert.deepEqual(result, { ok: true });
    assert.equal(calls.length, 3);
    assert.equal(calls[0].authorization, "Bearer old-token");
    assert.equal(calls[1].url, "https://api.eventflowtickets.com.br/api/auth/refresh");
    assert.equal(calls[2].authorization, "Bearer new-token");
    assert.equal(useAuthStore.getState().accessToken, "new-token");
  });

  it("shares one refresh request across concurrent 401 responses", async () => {
    let refreshCount = 0;

    globalThis.fetch = async (input, init) => {
      const url = String(input);
      const headers = init?.headers as Record<string, string> | undefined;

      if (url.endsWith("/auth/refresh")) {
        refreshCount += 1;
        return jsonResponse({ accessToken: "new-token", user });
      }

      if (headers?.Authorization === "Bearer old-token") {
        return jsonResponse({ message: "expired" }, 401);
      }

      return jsonResponse({ path: new URL(url).pathname });
    };

    const [first, second] = await Promise.all([
      api<{ path: string }>("/first"),
      api<{ path: string }>("/second")
    ]);

    assert.equal(refreshCount, 1);
    assert.equal(first.path, "/api/first");
    assert.equal(second.path, "/api/second");
  });
});

describe("api error handling", () => {
  beforeEach(() => {
    useAuthStore.setState({ accessToken: undefined, user: undefined });
  });

  it("keeps a JSON error message returned by the API", async () => {
    globalThis.fetch = async () => jsonResponse({ message: "Transferência expirada." }, 400);

    await assert.rejects(
      api("/transfers/expired", { auth: false }),
      (error: unknown) => error instanceof ApiError
        && error.status === 400
        && error.message === "Transferência expirada."
    );
  });

  it("turns a non-JSON 429 into an actionable error", async () => {
    globalThis.fetch = async () => new Response("Too Many Requests", {
      status: 429,
      headers: { "Content-Type": "text/html", "Retry-After": "12", "X-Vercel-Id": "gru1::abc" }
    });

    await assert.rejects(
      api("/transfers/accept", { auth: false }),
      (error: unknown) => error instanceof ApiError
        && error.status === 429
        && error.retryAfter === 12
        && error.requestId === "gru1::abc"
        && error.message.includes("Aguarde 12 segundos")
    );
  });
});

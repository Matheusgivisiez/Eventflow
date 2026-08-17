import assert from "node:assert/strict";
import { beforeEach, describe, it } from "node:test";
import { api } from "./api";
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
    assert.equal(calls[1].url, "http://localhost:3001/api/auth/refresh");
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

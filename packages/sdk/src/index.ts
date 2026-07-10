export type EventHubClientOptions = {
  baseUrl: string;
  apiKey?: string;
  accessToken?: string;
};

export type EventHubListParams = {
  search?: string;
  category?: string;
  page?: number;
  perPage?: number;
};

export class EventHubClient {
  constructor(private readonly options: EventHubClientOptions) {}

  listEvents(params: EventHubListParams = {}) {
    return this.request(`/events/public?${this.query(params)}`);
  }

  getEvent(slug: string) {
    return this.request(`/events/public/${encodeURIComponent(slug)}`);
  }

  track(payload: Record<string, unknown>) {
    return this.request("/enterprise/analytics/track", {
      method: "POST",
      body: JSON.stringify(payload)
    });
  }

  syncOfflineCheckins(payload: Record<string, unknown>) {
    return this.request("/enterprise/mobile/checkin-sync", {
      method: "POST",
      body: JSON.stringify(payload)
    });
  }

  private async request<T = unknown>(path: string, init: RequestInit = {}): Promise<T> {
    const headers: Record<string, string> = {
      "Content-Type": "application/json",
      ...this.authHeader(),
    };
    if (init.headers) {
      const entries = init.headers instanceof Headers
        ? [...init.headers.entries()]
        : Array.isArray(init.headers)
          ? init.headers
          : Object.entries(init.headers);
      for (const [key, value] of entries) {
        headers[key] = value;
      }
    }
    const response = await fetch(`${this.options.baseUrl.replace(/\/$/, "")}${path}`, {
      ...init,
      headers,
    });
    if (!response.ok) {
      const error = await response.json().catch(() => ({ message: "EventHub API error" }));
      throw new Error(Array.isArray(error.message) ? error.message.join(", ") : error.message);
    }
    return response.json();
  }

  private authHeader(): Record<string, string> {
    const token = this.options.accessToken ?? this.options.apiKey;
    if (token) return { Authorization: `Bearer ${token}` };
    return {};
  }

  private query(params: Record<string, string | number | undefined>) {
    const search = new URLSearchParams();
    Object.entries(params).forEach(([key, value]) => {
      if (value !== undefined) search.set(key, String(value));
    });
    return search.toString();
  }
}

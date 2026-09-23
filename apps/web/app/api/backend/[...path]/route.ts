import { NextRequest, NextResponse } from "next/server";

const DEFAULT_API_URL = "https://eventflow-api-283790508777.us-east1.run.app/api";
const API_URL = normalizeApiUrl(process.env.NEXT_PUBLIC_API_URL);
const HOP_BY_HOP_HEADERS = new Set([
  "connection",
  "content-encoding",
  "content-length",
  "host",
  "keep-alive",
  "proxy-authenticate",
  "proxy-authorization",
  "te",
  "trailer",
  "transfer-encoding",
  "upgrade"
]);

type RouteContext = {
  params: Promise<{ path: string[] }>;
};

export async function GET(request: NextRequest, context: RouteContext) {
  return proxy(request, context);
}

export async function POST(request: NextRequest, context: RouteContext) {
  return proxy(request, context);
}

export async function PATCH(request: NextRequest, context: RouteContext) {
  return proxy(request, context);
}

export async function DELETE(request: NextRequest, context: RouteContext) {
  return proxy(request, context);
}

async function proxy(request: NextRequest, context: RouteContext) {
  const { path } = await context.params;
  const upstreamUrl = new URL(`${API_URL}/${path.join("/")}`);
  upstreamUrl.search = request.nextUrl.search;

  const headers = new Headers(request.headers);
  for (const header of HOP_BY_HOP_HEADERS) headers.delete(header);
  headers.set("x-forwarded-host", request.headers.get("host") ?? request.nextUrl.host);
  headers.set("x-forwarded-proto", request.nextUrl.protocol.replace(":", ""));

  // O cliente controla o que manda em x-forwarded-for / x-real-ip. Repassar
  // esses valores deixava o backend contar rate limit por um "IP" escolhido
  // pelo atacante. Aqui eles sao descartados e reescritos com o unico endereco
  // que a plataforma garante: o peer que a Vercel enxergou.
  headers.delete("x-forwarded-for");
  headers.delete("x-real-ip");

  const clientIp = resolveClientIp(request);
  if (clientIp) {
    headers.set("x-forwarded-for", clientIp);
    headers.set("x-real-ip", clientIp);
  }

  let upstream: Response;
  try {
    upstream = await fetch(upstreamUrl, {
      method: request.method,
      headers,
      body: request.method === "GET" || request.method === "HEAD" ? undefined : request.body,
      duplex: "half",
      cache: "no-store"
    } as RequestInit & { duplex: "half" });
  } catch (error) {
    console.error("Backend proxy failed", {
      upstream: upstreamUrl.origin,
      path: upstreamUrl.pathname,
      error: error instanceof Error ? error.message : String(error)
    });
    return NextResponse.json({ message: "Nao foi possivel conectar ao backend." }, { status: 502 });
  }

  const responseHeaders = new Headers(upstream.headers);
  for (const header of HOP_BY_HOP_HEADERS) responseHeaders.delete(header);

  const setCookie = upstream.headers.get("set-cookie");
  if (setCookie) {
    responseHeaders.set("set-cookie", setCookie.replace(/Path=\/api\/auth/gi, "Path=/api/backend/auth"));
  }

  return new NextResponse(upstream.body, {
    status: upstream.status,
    statusText: upstream.statusText,
    headers: responseHeaders
  });
}

/**
 * `x-vercel-forwarded-for` e escrito pela plataforma e nao pode ser forjado
 * pelo cliente. Sem ele (dev local, outro host), cai para o ULTIMO endereco da
 * cadeia x-forwarded-for: o proxy anexa o IP que realmente viu ao final, entao
 * o final e confiavel enquanto o inicio e o que o cliente digitou.
 */
function resolveClientIp(request: NextRequest): string | undefined {
  const vercelForwardedFor = request.headers.get("x-vercel-forwarded-for");
  if (vercelForwardedFor?.trim()) {
    return vercelForwardedFor.split(",").pop()?.trim() || undefined;
  }

  const forwardedFor = request.headers.get("x-forwarded-for");
  if (forwardedFor?.trim()) {
    return forwardedFor.split(",").pop()?.trim() || undefined;
  }

  return request.headers.get("x-real-ip")?.trim() || undefined;
}

function normalizeApiUrl(value: string | undefined) {
  const normalized = value?.trim().replace(/^["']|["']$/g, "");
  return (normalized || DEFAULT_API_URL).replace(/\/+$/, "");
}

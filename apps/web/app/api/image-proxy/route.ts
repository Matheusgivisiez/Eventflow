import { NextRequest, NextResponse } from "next/server";
import { getApiUrl } from "@/lib/api-url";

const ALLOWED_HOST_SUFFIXES = [
  ".r2.dev",
  ".cloudfront.net",
  ".googleusercontent.com",
  ".gstatic.com"
];

const ALLOWED_HOSTS = new Set([
  "images.unsplash.com",
  "plus.unsplash.com",
  "encrypted-tbn0.gstatic.com",
  new URL(getApiUrl()).hostname
]);

export async function GET(request: NextRequest) {
  const rawUrl = request.nextUrl.searchParams.get("url");
  if (!rawUrl) {
    return new NextResponse("Missing url", { status: 400 });
  }

  let assetUrl: URL;
  try {
    assetUrl = new URL(rawUrl);
  } catch {
    return new NextResponse("Invalid url", { status: 400 });
  }

  if (assetUrl.protocol !== "https:" && assetUrl.protocol !== "http:") {
    return new NextResponse("Unsupported protocol", { status: 400 });
  }

  const hostname = assetUrl.hostname.toLowerCase();
  const allowed = ALLOWED_HOSTS.has(hostname) || ALLOWED_HOST_SUFFIXES.some((suffix) => hostname.endsWith(suffix));
  if (!allowed) {
    return new NextResponse("Host not allowed", { status: 400 });
  }

  const upstream = await fetch(assetUrl, {
    headers: { Accept: "image/avif,image/webp,image/png,image/jpeg,image/*,*/*;q=0.8" },
    next: { revalidate: 3600 }
  });

  if (!upstream.ok) {
    return new NextResponse("Image unavailable", { status: upstream.status });
  }

  const contentType = upstream.headers.get("content-type") ?? "";
  if (!contentType.startsWith("image/")) {
    return new NextResponse("Invalid content type", { status: 415 });
  }

  return new NextResponse(upstream.body, {
    status: 200,
    headers: {
      "Content-Type": contentType,
      "Cache-Control": "public, max-age=3600, s-maxage=86400, stale-while-revalidate=604800"
    }
  });
}

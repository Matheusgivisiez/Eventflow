/** @type {import('next').NextConfig} */
const securityHeaders = [
  { key: "X-Frame-Options", value: "SAMEORIGIN" },
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  { key: "Strict-Transport-Security", value: "max-age=63072000; includeSubDomains" },
  { key: "Permissions-Policy", value: "camera=(self), microphone=(), geolocation=()" }
];

const nextConfig = {
  async headers() {
    return [
      { source: "/:path*", headers: securityHeaders },
      // A URL desta página carrega o token do pedido: não vazar em Referer.
      // (Vem depois da regra geral para sobrescrever o Referrer-Policy dela.)
      { source: "/checkout/success", headers: [{ key: "Referrer-Policy", value: "no-referrer" }] }
    ];
  },
  images: {
    remotePatterns: [
      { protocol: "http", hostname: "localhost" },
      { protocol: "https", hostname: "localhost" },
      { protocol: "https", hostname: "images.unsplash.com" },
      { protocol: "https", hostname: "plus.unsplash.com" },
      { protocol: "https", hostname: "encrypted-tbn0.gstatic.com" },
      { protocol: "https", hostname: "lh3.googleusercontent.com" },
      { protocol: "https", hostname: "*.gstatic.com" },
      { protocol: "https", hostname: "*.googleusercontent.com" },
      { protocol: "https", hostname: "*.cloudfront.net" },
      { protocol: "https", hostname: "pub-474447a5c61b4ecaa4cc55272d5c82ff.r2.dev" }
    ]
  }
};

export default nextConfig;

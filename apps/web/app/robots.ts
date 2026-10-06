import type { MetadataRoute } from "next";

const siteUrl = "https://eventflowtickets.com.br";

export default function robots(): MetadataRoute.Robots {
  return {
    sitemap: `${siteUrl}/sitemap.xml`,
    rules: {
      userAgent: "*",
      allow: "/",
      disallow: [
        "/api/",
        "/checkout/",
        "/me/",
        "/dashboard",
        "/events",
        "/check-in",
        "/finance",
        "/reports",
        "/enterprise",
        "/promoters",
        "/team",
        "/coupons",
        "/notifications",
        "/profile",
        "/admin",
        "/portal",
        "/login",
        "/register",
        "/organizador/",
        "/forgot-password",
        "/reset-password",
        "/verificar-email"
      ]
    }
  };
}

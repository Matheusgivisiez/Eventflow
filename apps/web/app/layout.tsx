import type { Metadata, Viewport } from "next";
import { Poppins } from "next/font/google";
import "./globals.css";
import { Providers } from "./providers";
import { PageAnimation } from "@/components/page-animation";

import { CookieConsent } from "@/components/cookie-consent";
import { CookieScripts } from "@/components/cookie-scripts";

const poppins = Poppins({ subsets: ["latin"], weight: ["400", "500", "600", "700", "800", "900"], variable: "--font-poppins" });

export const metadata: Metadata = {
  metadataBase: new URL("https://eventflowtickets.com.br"),
  applicationName: "Event Flow",
  title: "Event Flow - Ingressos Online",
  description: "Compre ingressos para eventos com segurança. Checkout rápido, QR Code digital e acesso fácil aos seus ingressos.",
  manifest: "/manifest.webmanifest",
  icons: {
    icon: [
      { url: "/favicon.ico", sizes: "any" },
      { url: "/favicon-16x16.png", sizes: "16x16", type: "image/png" },
      { url: "/favicon-32x32.png", sizes: "32x32", type: "image/png" },
      { url: "/favicon-48x48.png", sizes: "48x48", type: "image/png" }
    ],
    apple: [{ url: "/apple-touch-icon.png", sizes: "180x180", type: "image/png" }]
  },
  appleWebApp: {
    capable: true,
    statusBarStyle: "black-translucent",
    title: "Event Flow"
  }
};

export const viewport: Viewport = {
  themeColor: "#111827"
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="pt-BR" suppressHydrationWarning>
      <head>
        <CookieScripts />
      </head>
      <body className={poppins.className}>
        <Providers>
          <PageAnimation>{children}</PageAnimation>
          <CookieConsent />
        </Providers>
      </body>
    </html>
  );
}

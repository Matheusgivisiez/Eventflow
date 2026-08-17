import type { Metadata } from "next";
import "./globals.css";
import { Providers } from "./providers";
import { PageAnimation } from "@/components/page-animation";

import { CookieConsent } from "@/components/cookie-consent";
import { CookieScripts } from "@/components/cookie-scripts";

export const metadata: Metadata = {
  title: "Event Flow - Ingressos Online",
  description: "Compre ingressos para eventos com segurança. Checkout rápido, QR Code digital e acesso fácil aos seus ingressos."
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="pt-BR" suppressHydrationWarning>
      <head>
        <CookieScripts />
      </head>
      <body>
        <Providers>
          <PageAnimation>{children}</PageAnimation>
          <CookieConsent />
        </Providers>
      </body>
    </html>
  );
}

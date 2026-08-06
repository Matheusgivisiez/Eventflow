"use client";

import { useEffect, useState } from "react";
import Script from "next/script";
import { useCookieConsent, CookiePreferences } from "@/hooks/use-cookie-consent";

export function CookieScripts() {
  const { preferences, isLoaded } = useCookieConsent();
  const [activePreferences, setActivePreferences] = useState<CookiePreferences | null>(null);

  useEffect(() => {
    if (isLoaded) {
      setActivePreferences(preferences);
    }
  }, [isLoaded, preferences]);

  useEffect(() => {
    // Listen for custom event to update scripts immediately when preferences change
    const handleConsentUpdate = (e: Event) => {
      const customEvent = e as CustomEvent<CookiePreferences>;
      setActivePreferences(customEvent.detail);
    };

    window.addEventListener("cookie-consent-updated", handleConsentUpdate);
    return () => window.removeEventListener("cookie-consent-updated", handleConsentUpdate);
  }, []);

  if (!activePreferences) return null;

  return (
    <>
      {/* Estatísticas - Ex: Google Analytics */}
      {activePreferences.analytics && (
        <>
          <Script
            id="google-analytics"
            strategy="afterInteractive"
            src={`https://www.googletagmanager.com/gtag/js?id=G-XXXXXXXXXX`}
          />
          <Script
            id="google-analytics-config"
            strategy="afterInteractive"
            dangerouslySetInnerHTML={{
              __html: `
                window.dataLayer = window.dataLayer || [];
                function gtag(){dataLayer.push(arguments);}
                gtag('js', new Date());
                gtag('config', 'G-XXXXXXXXXX', {
                  page_path: window.location.pathname,
                });
              `,
            }}
          />
        </>
      )}

      {/* Marketing - Ex: Meta Pixel */}
      {activePreferences.marketing && (
        <Script
          id="meta-pixel"
          strategy="afterInteractive"
          dangerouslySetInnerHTML={{
            __html: `
              !function(f,b,e,v,n,t,s)
              {if(f.fbq)return;n=f.fbq=function(){n.callMethod?
              n.callMethod.apply(n,arguments):n.queue.push(arguments)};
              if(!f._fbq)f._fbq=n;n.push=n;n.loaded=!0;n.version='2.0';
              n.queue=[];t=b.createElement(e);t.async=!0;
              t.src=v;s=b.getElementsByTagName(e)[0];
              s.parentNode.insertBefore(t,s)}(window, document,'script',
              'https://connect.facebook.net/en_US/fbevents.js');
              fbq('init', 'XXXXXXXXXXXXXXXX');
              fbq('track', 'PageView');
            `,
          }}
        />
      )}
    </>
  );
}

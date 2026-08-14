"use client";

import { Button } from "@/components/ui/button";

export function CookieSettingsButton() {
  return (
    <Button onClick={() => window.dispatchEvent(new CustomEvent("open-cookie-settings"))}>
      Configurações de Cookies
    </Button>
  );
}

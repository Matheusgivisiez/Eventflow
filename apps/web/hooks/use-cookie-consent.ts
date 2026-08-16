import { useState, useEffect } from "react";

export type CookieConsentCategory = {
  necessary: boolean;
  analytics: boolean;
  marketing: boolean;
};

export type CookiePreferences = CookieConsentCategory & {
  acceptedAt: string | null;
};

const DEFAULT_PREFERENCES: CookiePreferences = {
  necessary: true,
  analytics: false,
  marketing: false,
  acceptedAt: null,
};

const STORAGE_KEY = "eventhub_cookie_preferences";

export function useCookieConsent() {
  const [preferences, setPreferences] = useState<CookiePreferences>(DEFAULT_PREFERENCES);
  const [isLoaded, setIsLoaded] = useState(false);
  const [showBanner, setShowBanner] = useState(false);
  const [showModal, setShowModal] = useState(false);

  useEffect(() => {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (stored) {
        const parsed = JSON.parse(stored);
        setPreferences(parsed);
      } else {
        setShowBanner(true);
      }
    } catch (e) {
      console.error("Failed to parse cookie preferences", e);
      setShowBanner(true);
    } finally {
      setIsLoaded(true);
    }
  }, []);

  const savePreferences = (newPreferences: Omit<CookiePreferences, "necessary" | "acceptedAt">) => {
    const dataToSave: CookiePreferences = {
      necessary: true,
      analytics: newPreferences.analytics,
      marketing: newPreferences.marketing,
      acceptedAt: new Date().toISOString(),
    };
    
    setPreferences(dataToSave);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(dataToSave));
    setShowBanner(false);
    setShowModal(false);
    
    // Dispatch custom event to notify scripts immediately without reload
    window.dispatchEvent(new CustomEvent("cookie-consent-updated", { detail: dataToSave }));
  };

  const acceptAll = () => {
    savePreferences({ analytics: true, marketing: true });
  };

  const rejectOptional = () => {
    savePreferences({ analytics: false, marketing: false });
  };

  const openSettings = () => {
    setShowModal(true);
  };

  return {
    preferences,
    isLoaded,
    showBanner,
    showModal,
    setShowModal,
    savePreferences,
    acceptAll,
    rejectOptional,
    openSettings,
  };
}

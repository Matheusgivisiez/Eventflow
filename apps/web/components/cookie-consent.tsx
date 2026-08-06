"use client";

import { useState, useEffect } from "react";
import { useCookieConsent } from "@/hooks/use-cookie-consent";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Cookie } from "lucide-react";

export function CookieConsent() {
  const {
    preferences,
    isLoaded,
    showBanner,
    showModal,
    setShowModal,
    savePreferences,
    acceptAll,
    rejectOptional,
  } = useCookieConsent();

  const [tempPreferences, setTempPreferences] = useState({
    analytics: false,
    marketing: false,
  });

  useEffect(() => {
    if (showModal) {
      setTempPreferences({
        analytics: preferences.analytics,
        marketing: preferences.marketing,
      });
    }
  }, [showModal, preferences]);

  useEffect(() => {
    const handleOpenSettings = () => setShowModal(true);
    window.addEventListener("open-cookie-settings", handleOpenSettings);
    return () => window.removeEventListener("open-cookie-settings", handleOpenSettings);
  }, [setShowModal]);

  if (!isLoaded) return null;

  return (
    <>
      {/* Banner */}
      {showBanner && (
        <div className="fixed bottom-0 left-0 right-0 z-50 p-4 bg-background border-t shadow-lg animate-in slide-in-from-bottom sm:p-6">
          <div className="max-w-6xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-4">
            <div className="flex items-start sm:items-center gap-4 flex-1">
              <div className="hidden sm:flex bg-primary/10 p-3 rounded-full text-primary shrink-0">
                <Cookie className="h-6 w-6" />
              </div>
              <div>
                <p className="text-sm font-medium">
                  Utilizamos cookies para melhorar sua experiência, analisar o uso da plataforma e oferecer conteúdos personalizados. Você pode aceitar, recusar ou personalizar suas preferências.
                </p>
                <a href="/politica-de-cookies" className="text-xs text-primary hover:underline mt-1 inline-block">
                  Ler Política de Cookies
                </a>
              </div>
            </div>
            
            <div className="flex flex-col sm:flex-row gap-2 w-full sm:w-auto shrink-0">
              <Button variant="outline" size="sm" onClick={() => setShowModal(true)}>
                Personalizar
              </Button>
              <Button variant="outline" size="sm" onClick={rejectOptional}>
                Recusar Opcionais
              </Button>
              <Button size="sm" onClick={acceptAll}>
                Aceitar Todos
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Modal / Dialog */}
      <Dialog open={showModal} onOpenChange={setShowModal}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Cookie className="h-5 w-5 text-primary" />
              Configurações de Cookies
            </DialogTitle>
            <DialogDescription>
              Gerencie suas preferências de cookies. As alterações serão salvas imediatamente após clicar em confirmar.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-6 py-4">
            <div className="flex items-center justify-between gap-4">
              <div className="space-y-0.5 flex-1">
                <Label className="text-base">Estritamente Necessários</Label>
                <p className="text-sm text-muted-foreground">
                  Essenciais para o funcionamento básico da plataforma (ex: login, segurança).
                </p>
              </div>
              <Switch checked={true} disabled />
            </div>

            <div className="flex items-center justify-between gap-4">
              <div className="space-y-0.5 flex-1">
                <Label className="text-base" htmlFor="analytics-cookies">Estatísticas e Análises</Label>
                <p className="text-sm text-muted-foreground">
                  Ajudam a entender como os visitantes interagem com o site (ex: Google Analytics).
                </p>
              </div>
              <Switch
                id="analytics-cookies"
                checked={tempPreferences.analytics}
                onCheckedChange={(c) => setTempPreferences((p) => ({ ...p, analytics: c }))}
              />
            </div>

            <div className="flex items-center justify-between gap-4">
              <div className="space-y-0.5 flex-1">
                <Label className="text-base" htmlFor="marketing-cookies">Marketing e Anúncios</Label>
                <p className="text-sm text-muted-foreground">
                  Utilizados para entregar anúncios relevantes e rastrear conversões (ex: Meta Pixel).
                </p>
              </div>
              <Switch
                id="marketing-cookies"
                checked={tempPreferences.marketing}
                onCheckedChange={(c) => setTempPreferences((p) => ({ ...p, marketing: c }))}
              />
            </div>
          </div>

          <DialogFooter className="flex-col sm:flex-row gap-2 mt-4">
            <Button variant="outline" className="w-full sm:w-auto" onClick={() => setShowModal(false)}>
              Cancelar
            </Button>
            <Button 
              className="w-full sm:w-auto" 
              onClick={() => savePreferences(tempPreferences)}
            >
              Salvar Preferências
            </Button>
            <Button 
              className="w-full sm:w-auto" 
              onClick={acceptAll}
            >
              Aceitar Todos
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}

-- Artes do topo da página pública do evento, separadas por tela.
-- Opcionais: sem elas a página continua usando o banner (bannerUrl).
ALTER TABLE "Event" ADD COLUMN "heroMobileUrl" TEXT;
ALTER TABLE "Event" ADD COLUMN "heroDesktopUrl" TEXT;

-- Mapa do evento (planta de setores/camarotes) enviado pelo produtor.
-- Opcional: sem imagem, a seção não aparece na página pública.
ALTER TABLE "Event" ADD COLUMN "venueMapUrl" TEXT;

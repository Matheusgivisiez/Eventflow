import Image from "next/image";

export function PhotoGallery({ urls, title }: { urls: string[]; title: string }) {
  if (!urls || urls.length === 0) return null;

  return (
    <div className="space-y-4">
      <h2 className="text-2xl font-semibold tracking-tight">Galeria de Fotos</h2>
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {urls.map((url, index) => (
          <div key={url} className="group relative aspect-video overflow-hidden rounded-xl bg-muted">
            <Image 
              src={url} 
              alt={`${title} - Foto ${index + 1}`} 
              fill 
              className="object-cover transition-transform duration-500 group-hover:scale-110" 
            />
            <div className="absolute inset-0 bg-black/0 transition-colors duration-500 group-hover:bg-black/10" />
          </div>
        ))}
      </div>
    </div>
  );
}

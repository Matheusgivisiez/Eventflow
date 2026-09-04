import { MicVocal } from "lucide-react";
import type { ReactNode } from "react";
import type { EventArtist } from "@/types/eventflow";

export function EventArtists({ artists = [] }: { artists?: EventArtist[] }) {
  if (!artists.length) return null;
  return (
    <section aria-labelledby="event-artists-title" className="space-y-4 animate-fade-in">
      <div className="flex items-center gap-2">
        <MicVocal className="h-5 w-5 text-primary" aria-hidden="true" />
        <h2 id="event-artists-title" className="text-xl font-bold tracking-tight">Artistas</h2>
      </div>
      <ul className="overflow-hidden rounded-xl border bg-card divide-y" aria-label="Artistas confirmados">
        {artists.map(({ artist }) => (
          <li key={artist.id} className="flex min-h-20 items-center gap-3 px-3 py-3 sm:px-4">
            {artist.imageUrl ? <img src={artist.imageUrl} alt="" className="h-12 w-12 shrink-0 rounded-full object-cover ring-1 ring-border" /> : <div aria-hidden="true" className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-muted font-semibold text-muted-foreground">{artist.stageName.slice(0, 1).toUpperCase()}</div>}
            <div className="min-w-0 flex-1">
              <p className="truncate font-medium">{artist.stageName}</p>
              {(artist.genre || artist.bio) && <p className="mt-0.5 truncate text-sm text-muted-foreground">{artist.genre || artist.bio}</p>}
            </div>
            <div className="flex shrink-0 items-center gap-1">
              {artist.instagramUrl && <SocialLink href={artist.instagramUrl} label={`Instagram de ${artist.stageName}`}><InstagramIcon /></SocialLink>}
              {artist.spotifyUrl && <SocialLink href={artist.spotifyUrl} label={`Spotify de ${artist.stageName}`}><SpotifyIcon /></SocialLink>}
            </div>
          </li>
        ))}
      </ul>
    </section>
  );
}

function SocialLink({ href, label, children }: { href: string; label: string; children: ReactNode }) {
  return <a href={href} target="_blank" rel="noopener noreferrer" aria-label={label} className="inline-flex h-11 w-11 items-center justify-center rounded-full text-foreground transition-colors hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">{children}</a>;
}

function InstagramIcon() { return <svg aria-hidden="true" viewBox="0 0 24 24" className="h-5 w-5 fill-none stroke-current" strokeWidth="2"><rect x="3" y="3" width="18" height="18" rx="5" /><circle cx="12" cy="12" r="4" /><circle cx="17.5" cy="6.5" r=".8" className="fill-current stroke-none" /></svg>; }
function SpotifyIcon() { return <svg aria-hidden="true" viewBox="0 0 24 24" className="h-5 w-5 fill-current"><path d="M12 2a10 10 0 1 0 0 20 10 10 0 0 0 0-20Zm4.58 14.48a.75.75 0 0 1-1.03.25c-2.83-1.73-6.39-2.12-10.58-1.17a.75.75 0 1 1-.33-1.46c4.58-1.05 8.52-.6 11.7 1.34.35.22.46.68.24 1.04Zm1.47-3.27a.94.94 0 0 1-1.29.3c-3.24-1.98-8.18-2.56-12-1.4a.94.94 0 1 1-.45-1.82c4.36-1.08 9.78-.44 13.43 1.79.45.28.6.86.31 1.13Zm.13-3.4C14.3 7.5 7.86 7.3 4.18 8.42a1.12 1.12 0 1 1-.65-2.14c4.27-1.3 11.37-1.05 15.85 1.6a1.12 1.12 0 0 1-1.2 1.93Z" /></svg>; }

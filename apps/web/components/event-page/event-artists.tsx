import { MicVocal } from "lucide-react";
import type { ReactNode } from "react";
import type { EventArtist } from "@/types/eventflow";

export function EventArtists({ artists = [], compact = false }: { artists?: EventArtist[]; compact?: boolean }) {
  if (!artists.length) return null;
  return (
    <section aria-labelledby="event-artists-title" className="space-y-4 animate-fade-in">
      <div className="flex items-center gap-2">
        <MicVocal className="h-5 w-5 text-primary" aria-hidden="true" />
        <h2 id="event-artists-title" className="text-xl font-bold tracking-tight">Artistas</h2>
      </div>
      <ul className="overflow-hidden rounded-2xl border bg-card divide-y" aria-label="Artistas confirmados">
        {artists.map(({ artist }) => (
          <li key={artist.id} className={`flex items-center gap-3 px-3 py-3 sm:px-4 ${compact ? "min-h-[4.5rem]" : "min-h-20"}`}>
            {artist.imageUrl ? <img src={artist.imageUrl} alt="" className="h-11 w-11 shrink-0 rounded-full object-cover ring-1 ring-border" /> : <div aria-hidden="true" className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-muted font-semibold text-muted-foreground">{artist.stageName.slice(0, 1).toUpperCase()}</div>}
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
// Logo oficial do Spotify (icone circular preto/branco), nao um desenho generico.
function SpotifyIcon() {
  return (
    <svg aria-hidden="true" role="img" viewBox="0 0 24 24" className="h-5 w-5 fill-current">
      <path d="M12 0C5.4 0 0 5.4 0 12s5.4 12 12 12 12-5.4 12-12S18.66 0 12 0zm5.521 17.34c-.24.359-.66.48-1.021.24-2.82-1.74-6.36-2.101-10.561-1.141-.418.122-.779-.179-.899-.539-.12-.421.18-.78.54-.9 4.56-1.021 8.52-.6 11.64 1.32.42.18.479.659.301 1.02zm1.44-3.3c-.301.42-.841.6-1.262.3-3.239-1.98-8.159-2.58-11.939-1.38-.479.12-1.02-.12-1.14-.6-.12-.48.12-1.021.6-1.141C9.6 9.9 15 10.561 18.72 12.84c.361.181.54.78.241 1.2zm.12-3.36C15.24 8.4 8.82 8.16 5.16 9.301c-.6.179-1.2-.181-1.38-.721-.18-.601.18-1.2.72-1.381 4.26-1.26 11.28-1.02 15.721 1.621.539.3.719 1.02.419 1.56-.299.421-1.02.599-1.559.3z" />
    </svg>
  );
}

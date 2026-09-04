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
function SpotifyIcon() { return <svg aria-hidden="true" viewBox="0 0 24 24" className="h-5 w-5 fill-none stroke-current" strokeWidth="1.9" strokeLinecap="round"><circle cx="12" cy="12" r="9" /><path d="M7 10c3.8-1.1 7.7-.6 10.2.9" /><path d="M7.8 13c3-0.8 6.1-.4 8.1.8" /><path d="M8.7 15.7c2.1-.5 4.3-.2 5.8.7" /></svg>; }

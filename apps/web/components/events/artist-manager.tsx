"use client";

import { useEffect, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Loader2, MicVocal, Plus, Trash2 } from "lucide-react";
import { api } from "@/lib/api";
import type { Artist, EventArtist } from "@/types/eventflow";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { ImageUpload } from "@/components/image-upload";

export function ArtistManager({ eventId, initialArtists = [] }: { eventId: string; initialArtists?: EventArtist[] }) {
  const queryClient = useQueryClient();
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [showCreate, setShowCreate] = useState(false);
  const [newArtist, setNewArtist] = useState({ stageName: "", imageUrl: "", instagramUrl: "", spotifyUrl: "", genre: "" });
  useEffect(() => { const timeout = setTimeout(() => setDebouncedSearch(search), 300); return () => clearTimeout(timeout); }, [search]);
  const { data: artists = [], isFetching } = useQuery<Artist[]>({ queryKey: ["artists", debouncedSearch], queryFn: () => api(`/artists?search=${encodeURIComponent(debouncedSearch)}`), enabled: open });
  const { data: linked = initialArtists, isFetching: loadingLinked } = useQuery<EventArtist[]>({ queryKey: ["event-artists", eventId], queryFn: () => api(`/events/${eventId}/artists`), initialData: initialArtists });
  const refresh = () => { void queryClient.invalidateQueries({ queryKey: ["event-artists", eventId] }); void queryClient.invalidateQueries({ queryKey: ["event", eventId] }); };
  const link = useMutation({ mutationFn: (artistId: string) => api(`/events/${eventId}/artists/${artistId}`, { method: "POST" }), onSuccess: refresh });
  const unlink = useMutation({ mutationFn: (artistId: string) => api(`/events/${eventId}/artists/${artistId}`, { method: "DELETE" }), onSuccess: refresh });
  const create = useMutation({ mutationFn: () => api<Artist>("/artists", { method: "POST", body: JSON.stringify(Object.fromEntries(Object.entries(newArtist).filter(([, value]) => value))) }), onSuccess: (artist) => { link.mutate(artist.id); setNewArtist({ stageName: "", imageUrl: "", instagramUrl: "", spotifyUrl: "", genre: "" }); setShowCreate(false); setOpen(false); } });
  const linkedIds = new Set(linked.map(({ artist }) => artist.id));

  return <Card>
    <CardHeader className="flex flex-row items-center justify-between space-y-0">
      <div><CardTitle className="flex items-center gap-2"><MicVocal className="h-4 w-4 text-primary" />Artistas confirmados</CardTitle><p className="mt-1 text-sm text-muted-foreground">Gerencie o catálogo global de artistas deste evento.</p></div>
      <Dialog open={open} onOpenChange={(value) => { setOpen(value); if (!value) setShowCreate(false); }}>
        <DialogTrigger asChild><Button type="button" variant="outline"><Plus className="h-4 w-4" />Adicionar artista</Button></DialogTrigger>
        <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-lg"><DialogHeader><DialogTitle>{showCreate ? "Cadastrar novo artista" : "Adicionar artista"}</DialogTitle></DialogHeader>
          {showCreate ? <div className="space-y-3"><Input aria-label="Nome artístico" placeholder="Nome artístico" value={newArtist.stageName} onChange={(e) => setNewArtist({ ...newArtist, stageName: e.target.value })} /><ImageUpload value={newArtist.imageUrl} onChange={(imageUrl) => setNewArtist({ ...newArtist, imageUrl: imageUrl ?? "" })} label="Foto do artista" /><Input placeholder="https://instagram.com/..." value={newArtist.instagramUrl} onChange={(e) => setNewArtist({ ...newArtist, instagramUrl: e.target.value })} /><Input placeholder="https://open.spotify.com/artist/..." value={newArtist.spotifyUrl} onChange={(e) => setNewArtist({ ...newArtist, spotifyUrl: e.target.value })} /><Input placeholder="Gênero musical (opcional)" value={newArtist.genre} onChange={(e) => setNewArtist({ ...newArtist, genre: e.target.value })} />
            <div className="flex justify-end gap-2"><Button type="button" variant="ghost" onClick={() => setShowCreate(false)}>Voltar</Button><Button type="button" disabled={!newArtist.stageName.trim() || create.isPending} onClick={() => create.mutate()}>{create.isPending && <Loader2 className="h-4 w-4 animate-spin" />}Cadastrar e vincular</Button></div>{create.error && <p className="text-sm text-destructive">{create.error.message}</p>}</div> : <div className="space-y-3"><Input autoFocus placeholder="Pesquisar por nome..." value={search} onChange={(e) => setSearch(e.target.value)} />
            <div className="max-h-64 space-y-1 overflow-y-auto">{isFetching ? <p className="p-3 text-sm text-muted-foreground">Buscando...</p> : artists.map((artist) => <div key={artist.id} className="flex items-center gap-3 rounded-md p-2 hover:bg-muted"><ArtistAvatar artist={artist} /><span className="min-w-0 flex-1 truncate text-sm font-medium">{artist.stageName}</span><Button type="button" size="sm" variant={linkedIds.has(artist.id) ? "secondary" : "outline"} disabled={linkedIds.has(artist.id) || link.isPending} onClick={() => link.mutate(artist.id)}>{linkedIds.has(artist.id) ? "Adicionado" : "Adicionar"}</Button></div>)}</div>
            <Button type="button" className="w-full" variant="outline" onClick={() => setShowCreate(true)}><Plus className="h-4 w-4" />Cadastrar novo artista</Button>{link.error && <p className="text-sm text-destructive">{link.error.message}</p>}</div>}
        </DialogContent>
      </Dialog>
    </CardHeader>
    <CardContent>{loadingLinked ? <p className="text-sm text-muted-foreground">Carregando artistas...</p> : linked.length ? <ul className="divide-y rounded-lg border">{linked.map(({ artist }) => <li key={artist.id} className="flex items-center gap-3 p-3"><ArtistAvatar artist={artist} /><span className="min-w-0 flex-1 truncate text-sm font-medium">{artist.stageName}</span><Button type="button" size="icon" variant="ghost" aria-label={`Remover ${artist.stageName}`} disabled={unlink.isPending} onClick={() => unlink.mutate(artist.id)}><Trash2 className="h-4 w-4 text-destructive" /></Button></li>)}</ul> : <p className="rounded-lg border border-dashed p-4 text-sm text-muted-foreground">Nenhum artista confirmado ainda.</p>}{unlink.error && <p className="mt-2 text-sm text-destructive">{unlink.error.message}</p>}</CardContent>
  </Card>;
}
function ArtistAvatar({ artist }: { artist: Artist }) { return artist.imageUrl ? <img src={artist.imageUrl} alt="" className="h-10 w-10 rounded-full object-cover" /> : <div aria-hidden="true" className="flex h-10 w-10 items-center justify-center rounded-full bg-muted text-sm font-semibold">{artist.stageName.slice(0, 1)}</div>; }

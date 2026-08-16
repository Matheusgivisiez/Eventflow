"use client";

import { useParams, useRouter } from "next/navigation";
import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ArrowLeft, Loader2, Save, Ticket, Trash2, Megaphone } from "lucide-react";
import Link from "next/link";
import { useEffect, memo } from "react";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import dynamic from "next/dynamic";
import { api } from "@/lib/api";

const ImageUpload = dynamic(() => import("@/components/image-upload").then(m => m.ImageUpload), { ssr: false, loading: () => <Skeleton className="h-40 w-full" /> });
import type { EventFlowEvent } from "@/types/eventflow";

const schema = z.object({
  title: z.string().min(3, "Informe o nome do evento."),
  description: z.string().min(20, "Descreva melhor o evento."),
  category: z.string().min(2, "Informe a categoria."),
  startsAt: z.string().min(1, "Informe data e horario."),
  endsAt: z.string().optional(),
  bannerUrl: z.string().optional(),
  city: z.string().optional(),
  state: z.string().optional(),
  zipCode: z.string().optional(),
  address: z.string().optional(),
  mapUrl: z.string().optional(),
  onlineUrl: z.string().optional(),
  format: z.enum(["ONLINE", "IN_PERSON"]),
  status: z.enum(["DRAFT", "PUBLISHED", "CLOSED"]),
  seoTitle: z.string().optional(),
  seoDescription: z.string().optional(),
  feeAbsorbedByOrganizer: z.boolean().optional()
});

type FormData = z.infer<typeof schema>;

const statusVariant: Record<string, "default" | "secondary" | "destructive"> = {
  DRAFT: "secondary",
  PUBLISHED: "default",
  CLOSED: "destructive"
};
const statusLabel: Record<string, string> = {
  DRAFT: "Rascunho",
  PUBLISHED: "Publicado",
  CLOSED: "Encerrado"
};

export default function EditEventPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const queryClient = useQueryClient();

  const { data: event, isLoading } = useQuery<EventFlowEvent>({
    queryKey: ["event", id],
    queryFn: () => api<EventFlowEvent>(`/events/${id}`)
  });

  const form = useForm<FormData>({
    resolver: zodResolver(schema),
    defaultValues: { format: "IN_PERSON", status: "DRAFT" }
  });

  useEffect(() => {
    if (event) {
      const toLocal = (iso?: string) =>
        iso ? new Date(iso).toISOString().slice(0, 16) : "";
      form.reset({
        title: event.title,
        description: event.description,
        category: event.category,
        startsAt: toLocal(event.startsAt),
        endsAt: toLocal(event.endsAt),
        bannerUrl: event.bannerUrl ?? "",
        city: event.city ?? "",
        state: event.state ?? "",
        zipCode: event.zipCode ?? "",
        address: event.address ?? "",
        mapUrl: event.mapUrl ?? "",
        format: event.format,
        status: event.status,
        seoTitle: event.seoTitle ?? "",
        seoDescription: event.seoDescription ?? ""
      });
    }
  }, [event, form]);

  const updateMutation = useMutation({
    mutationFn: (data: FormData) =>
      api(`/events/${id}`, {
        method: "PATCH",
        body: JSON.stringify({ ...data, bannerUrl: data.bannerUrl || undefined })
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["events"] });
      queryClient.invalidateQueries({ queryKey: ["event", id] });
      router.push("/events");
    }
  });

  const deleteMutation = useMutation({
    mutationFn: () => api(`/events/${id}`, { method: "DELETE" }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["events"] });
      router.push("/events");
    }
  });

  if (isLoading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-8 w-64" />
        <div className="grid gap-6 lg:grid-cols-[1fr_360px]">
          <Skeleton className="h-96" />
          <div className="space-y-6">
            <Skeleton className="h-48" />
            <Skeleton className="h-48" />
          </div>
        </div>
      </div>
    );
  }

  if (!event) {
    return (
      <p className="rounded-md border border-destructive/30 bg-destructive/10 p-4 text-sm text-destructive">
        Evento não encontrado.
      </p>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="icon" asChild>
            <Link href="/events">
              <ArrowLeft className="h-4 w-4" />
            </Link>
          </Button>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-2xl font-semibold tracking-normal">{event.title}</h1>
              <Badge variant={statusVariant[event.status]}>{statusLabel[event.status]}</Badge>
            </div>
            <p className="text-sm text-muted-foreground">Edite os dados do evento abaixo.</p>
          </div>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" asChild>
            <Link href={`/events/${id}/tickets`}>
              <Ticket className="h-4 w-4" />
              Lotes de ingresso
            </Link>
          </Button>
          <Button variant="outline" asChild>
            <Link href={`/events/${id}/promoters`}>
              <Megaphone className="h-4 w-4 mr-2" />
              Promoters
            </Link>
          </Button>
          <Button
            variant="destructive"
            size="icon"
            title="Excluir evento"
            disabled={deleteMutation.isPending}
            onClick={() => {
              if (confirm("Tem certeza que deseja excluir este evento? Esta ação não pode ser desfeita.")) {
                deleteMutation.mutate();
              }
            }}
          >
            {deleteMutation.isPending ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Trash2 className="h-4 w-4" />
            )}
          </Button>
        </div>
      </div>

      <form
        className="grid gap-6 lg:grid-cols-[1fr_360px]"
        onSubmit={form.handleSubmit((data) => updateMutation.mutate(data))}
      >
        <div className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Dados do evento</CardTitle>
            </CardHeader>
            <CardContent className="grid gap-4">
              <Field label="Nome" error={form.formState.errors.title?.message}>
                <Input {...form.register("title")} />
              </Field>
              <Field label="Descrição" error={form.formState.errors.description?.message}>
                <textarea
                  className="min-h-32 w-full rounded-md border bg-background px-3 py-2 text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring"
                  {...form.register("description")}
                />
              </Field>
              <div className="grid gap-4 sm:grid-cols-2">
                <Field label="Categoria" error={form.formState.errors.category?.message}>
                  <Input {...form.register("category")} />
                </Field>
                <div className="sm:col-span-2">
                  <Field label="Banner" error={form.formState.errors.bannerUrl?.message}>
                    <ImageUpload
                      value={form.watch("bannerUrl")}
                      onChange={(url) => form.setValue("bannerUrl", url)}
                    />
                  </Field>
                </div>
              </div>
              <div className="grid gap-4 sm:grid-cols-2">
                <Field label="Início" error={form.formState.errors.startsAt?.message}>
                  <Input type="datetime-local" {...form.register("startsAt")} />
                </Field>
                <Field label="Fim" error={form.formState.errors.endsAt?.message}>
                  <Input type="datetime-local" {...form.register("endsAt")} />
                </Field>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Local e online</CardTitle>
            </CardHeader>
            <CardContent className="grid gap-3 sm:grid-cols-2">
              <Input placeholder="Cidade" {...form.register("city")} />
              <Input placeholder="Estado" {...form.register("state")} />
              <Input placeholder="CEP" {...form.register("zipCode")} />
              <Input placeholder="Endereço" {...form.register("address")} />
              <Input placeholder="Google Maps (URL)" className="sm:col-span-2" {...form.register("mapUrl")} />
              <Input placeholder="Link do evento online" className="sm:col-span-2" {...form.register("onlineUrl")} />
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>SEO</CardTitle>
            </CardHeader>
            <CardContent className="grid gap-3">
              <Input placeholder="Título SEO" {...form.register("seoTitle")} />
              <Input placeholder="Descrição SEO" {...form.register("seoDescription")} />
            </CardContent>
          </Card>
        </div>

        <div className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Publicação</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <Field label="Formato">
                <select
                  className="h-10 w-full rounded-md border bg-background px-3 text-sm"
                  {...form.register("format")}
                >
                  <option value="IN_PERSON">Presencial</option>
                  <option value="ONLINE">Online</option>
                </select>
              </Field>
              <Field label="Status">
                <select
                  className="h-10 w-full rounded-md border bg-background px-3 text-sm"
                  {...form.register("status")}
                >
                  <option value="DRAFT">Rascunho</option>
                  <option value="PUBLISHED">Publicado</option>
                  <option value="CLOSED">Encerrado</option>
                </select>
              </Field>
              <Button className="w-full" disabled={updateMutation.isPending}>
                {updateMutation.isPending ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Save className="h-4 w-4" />
                )}
                Salvar alterações
              </Button>
              {updateMutation.error && (
                <p className="text-sm text-destructive">{updateMutation.error.message}</p>
              )}
              {updateMutation.isSuccess && (
                <p className="text-sm text-primary">Evento atualizado com sucesso!</p>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Estatísticas</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2 text-sm">
              <div className="flex justify-between rounded-md bg-muted px-3 py-2">
                <span className="text-muted-foreground">Lotes criados</span>
                <span className="font-medium">{event.ticketTypes.length}</span>
              </div>
              <div className="flex justify-between rounded-md bg-muted px-3 py-2">
                <span className="text-muted-foreground">Total vendido</span>
                <span className="font-medium">
                  {event.ticketTypes.reduce((s, t) => s + t.sold, 0)}
                </span>
              </div>
              <div className="flex justify-between rounded-md bg-muted px-3 py-2">
                <span className="text-muted-foreground">Disponíveis</span>
                <span className="font-medium">
                  {event.ticketTypes.reduce((s, t) => s + t.quantity - t.sold, 0)}
                </span>
              </div>
            </CardContent>
          </Card>
        </div>
      </form>
    </div>
  );
}

const Field = memo(function Field({
  label,
  error,
  children
}: {
  label: string;
  error?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="space-y-2">
      <Label>{label}</Label>
      {children}
      {error && <p className="text-sm text-destructive">{error}</p>}
    </div>
  );
});

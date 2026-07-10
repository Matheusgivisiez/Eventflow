"use client";

import { useRouter } from "next/navigation";
import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation } from "@tanstack/react-query";
import { Loader2, Save } from "lucide-react";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ImageUpload } from "@/components/image-upload";
import { api } from "@/lib/api";

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
  format: z.enum(["ONLINE", "IN_PERSON"]),
  status: z.enum(["DRAFT", "PUBLISHED", "CLOSED"]),
  seoTitle: z.string().optional(),
  seoDescription: z.string().optional()
});

type FormData = z.infer<typeof schema>;

export default function NewEventPage() {
  const router = useRouter();
  const form = useForm<FormData>({
    resolver: zodResolver(schema),
    defaultValues: { format: "IN_PERSON", status: "DRAFT" }
  });
  const mutation = useMutation({
    mutationFn: (data: FormData) =>
      api("/events", {
        method: "POST",
        body: JSON.stringify({ ...data, galleryUrls: [], bannerUrl: data.bannerUrl || undefined })
      }),
    onSuccess: () => router.push("/events")
  });

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-normal">Novo evento</h1>
        <p className="text-sm text-muted-foreground">Cadastre as informacoes principais para publicar sua pagina de venda.</p>
      </div>
      <form className="grid gap-6 lg:grid-cols-[1fr_360px]" onSubmit={form.handleSubmit((data) => mutation.mutate(data))}>
        <Card>
          <CardHeader>
            <CardTitle>Dados do evento</CardTitle>
          </CardHeader>
          <CardContent className="grid gap-4">
            <Field label="Nome" error={form.formState.errors.title?.message}>
              <Input {...form.register("title")} />
            </Field>
            <Field label="Descricao" error={form.formState.errors.description?.message}>
              <textarea className="min-h-32 w-full rounded-md border bg-background px-3 py-2 text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring" {...form.register("description")} />
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
              <Field label="Inicio" error={form.formState.errors.startsAt?.message}>
                <Input type="datetime-local" {...form.register("startsAt")} />
              </Field>
              <Field label="Fim" error={form.formState.errors.endsAt?.message}>
                <Input type="datetime-local" {...form.register("endsAt")} />
              </Field>
            </div>
          </CardContent>
        </Card>
        <div className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Publicacao</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <Field label="Formato">
                <select className="h-10 w-full rounded-md border bg-background px-3 text-sm" {...form.register("format")}>
                  <option value="IN_PERSON">Presencial</option>
                  <option value="ONLINE">Online</option>
                </select>
              </Field>
              <Field label="Status">
                <select className="h-10 w-full rounded-md border bg-background px-3 text-sm" {...form.register("status")}>
                  <option value="DRAFT">Rascunho</option>
                  <option value="PUBLISHED">Publicado</option>
                  <option value="CLOSED">Encerrado</option>
                </select>
              </Field>
              <Button className="w-full" disabled={mutation.isPending}>
                {mutation.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
                Salvar evento
              </Button>
              {mutation.error && <p className="text-sm text-destructive">{mutation.error.message}</p>}
            </CardContent>
          </Card>
          <Card>
            <CardHeader>
              <CardTitle>Local e SEO</CardTitle>
            </CardHeader>
            <CardContent className="grid gap-3">
              <Input placeholder="Cidade" {...form.register("city")} />
              <Input placeholder="Estado" {...form.register("state")} />
              <Input placeholder="CEP" {...form.register("zipCode")} />
              <Input placeholder="Endereco" {...form.register("address")} />
              <Input placeholder="Google Maps" {...form.register("mapUrl")} />
              <Input placeholder="Titulo SEO" {...form.register("seoTitle")} />
              <Input placeholder="Descricao SEO" {...form.register("seoDescription")} />
            </CardContent>
          </Card>
        </div>
      </form>
    </div>
  );
}

function Field({ label, error, children }: { label: string; error?: string; children: React.ReactNode }) {
  return (
    <div className="space-y-2">
      <Label>{label}</Label>
      {children}
      {error && <p className="text-sm text-destructive">{error}</p>}
    </div>
  );
}

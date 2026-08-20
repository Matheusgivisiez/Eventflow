"use client";

import { useRouter } from "next/navigation";
import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation } from "@tanstack/react-query";
import { Loader2, ShieldCheck, Building2, MapPin, Globe, Instagram } from "lucide-react";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { api } from "@/lib/api";
import { useAuthStore } from "@/stores/auth-store";

const UF_LIST = [
  "AC","AL","AP","AM","BA","CE","DF","ES","GO","MA","MT","MS","MG",
  "PA","PB","PR","PE","PI","RJ","RN","RS","RO","RR","SC","SP","SE","TO"
];

const schema = z.object({
  cnpj: z.string()
    .min(14, "CNPJ deve ter 14 dígitos.")
    .transform((v) => v.replace(/\D/g, ""))
    .refine((v) => v.length === 14, "CNPJ deve ter exatamente 14 dígitos."),
  companyName: z.string().min(2, "Informe o nome da empresa."),
  city: z.string().min(2, "Informe a cidade."),
  state: z.string().min(2, "Selecione o estado."),
  website: z.string().url("URL inválida.").optional().or(z.literal("")),
  instagram: z.string().optional(),
});

type FormData = z.infer<typeof schema>;

function formatCnpj(value: string) {
  const digits = value.replace(/\D/g, "").slice(0, 14);
  if (digits.length <= 2) return digits;
  if (digits.length <= 5) return `${digits.slice(0, 2)}.${digits.slice(2)}`;
  if (digits.length <= 8) return `${digits.slice(0, 2)}.${digits.slice(2, 5)}.${digits.slice(5)}`;
  if (digits.length <= 12) return `${digits.slice(0, 2)}.${digits.slice(2, 5)}.${digits.slice(5, 8)}/${digits.slice(8)}`;
  return `${digits.slice(0, 2)}.${digits.slice(2, 5)}.${digits.slice(5, 8)}/${digits.slice(8, 12)}-${digits.slice(12)}`;
}

export default function BecomeOrganizerPage() {
  const router = useRouter();
  const setSession = useAuthStore((state) => state.setSession);
  const form = useForm<FormData>({ resolver: zodResolver(schema) });

  const mutation = useMutation({
    mutationFn: (data: FormData) =>
      api<{ accessToken: string; user: any }>("/auth/become-organizer", {
        method: "POST",
        body: JSON.stringify({
          ...data,
          cnpj: data.cnpj.replace(/\D/g, ""),
          state: data.state.toUpperCase(),
        })
      }),
    onSuccess: (session) => {
      setSession(session);
      router.push("/dashboard");
    }
  });

  return (
    <div className="mx-auto max-w-lg px-5 py-12">
      <Card className="border-primary/20 shadow-md">
        <CardHeader className="text-center pb-8 border-b bg-primary/5">
          <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-primary/10 text-primary">
            <ShieldCheck className="h-6 w-6" />
          </div>
          <CardTitle className="text-2xl font-bold">Quero Organizar Eventos</CardTitle>
          <CardDescription className="max-w-xs mx-auto mt-2">
            Informe os dados cadastrais da sua empresa para ativar sua conta de organizador e publicar seus próprios eventos.
          </CardDescription>
        </CardHeader>
        <CardContent className="pt-8">
          <form className="space-y-5" onSubmit={form.handleSubmit((data) => mutation.mutate(data))}>

            {/* ─── Seção: Dados da Empresa ─── */}
            <div className="space-y-1 pb-2">
              <h2 className="text-sm font-bold text-primary uppercase tracking-wider flex items-center gap-2">
                <Building2 className="h-4 w-4" /> Dados da Empresa
              </h2>
              <div className="h-px bg-border" />
            </div>

            <Field label="CNPJ" error={form.formState.errors.cnpj?.message} icon={<Building2 className="h-4 w-4" />}>
              <Input
                placeholder="00.000.000/0000-00"
                className="pl-10 rounded-xl"
                {...form.register("cnpj")}
                onChange={(e) => {
                  const formatted = formatCnpj(e.target.value);
                  form.setValue("cnpj", formatted, { shouldValidate: false });
                }}
              />
            </Field>

            <Field label="Nome da empresa ou marca" error={form.formState.errors.companyName?.message} icon={<Building2 className="h-4 w-4" />}>
              <Input placeholder="Razão social ou nome fantasia" className="pl-10 rounded-xl" {...form.register("companyName")} />
            </Field>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <Field label="Cidade" error={form.formState.errors.city?.message} icon={<MapPin className="h-4 w-4" />}>
                <Input placeholder="Ex: Belo Horizonte" className="pl-10 rounded-xl" {...form.register("city")} />
              </Field>
              <div className="space-y-2">
                <Label className="text-sm font-semibold">Estado (UF)</Label>
                <select
                  className="flex h-10 w-full rounded-xl border border-border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary"
                  {...form.register("state")}
                  defaultValue=""
                >
                  <option value="" disabled>Selecione</option>
                  {UF_LIST.map((uf) => (
                    <option key={uf} value={uf}>{uf}</option>
                  ))}
                </select>
                {form.formState.errors.state && (
                  <p className="text-xs text-destructive">{form.formState.errors.state.message}</p>
                )}
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <Field label="Site (opcional)" error={form.formState.errors.website?.message} icon={<Globe className="h-4 w-4" />}>
                <Input placeholder="https://suaempresa.com" className="pl-10 rounded-xl" {...form.register("website")} />
              </Field>
              <Field label="Instagram (opcional)" error={form.formState.errors.instagram?.message} icon={<Instagram className="h-4 w-4" />}>
                <Input placeholder="@suaempresa" className="pl-10 rounded-xl" {...form.register("instagram")} />
              </Field>
            </div>

            {mutation.error && (
              <div className="rounded-xl bg-destructive/10 border border-destructive/20 p-3">
                <p className="text-sm text-destructive text-center">{mutation.error.message}</p>
              </div>
            )}

            <Button
              className="w-full rounded-xl bg-primary hover:bg-primary/90 text-white font-bold h-12 text-base shadow-md shadow-primary/25 mt-4"
              disabled={mutation.isPending}
            >
              {mutation.isPending && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
              Ativar Modo Organizador
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}

function Field({
  label, error, icon, children
}: {
  label: string; error?: string; icon?: React.ReactNode; children: React.ReactNode;
}) {
  return (
    <div className="space-y-2">
      <Label className="text-sm font-semibold">{label}</Label>
      <div className="relative">
        {icon && (
          <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground">{icon}</span>
        )}
        {children}
      </div>
      {error && <p className="text-xs text-destructive">{error}</p>}
    </div>
  );
}

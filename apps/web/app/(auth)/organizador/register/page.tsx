"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation } from "@tanstack/react-query";
import {
  Loader2, User, Mail, Phone, Lock, Building2, MapPin, Globe, Instagram
} from "lucide-react";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { api } from "@/lib/api";
import { useAuthStore } from "@/stores/auth-store";

const UF_LIST = [
  "AC","AL","AP","AM","BA","CE","DF","ES","GO","MA","MT","MS","MG",
  "PA","PB","PR","PE","PI","RJ","RN","RS","RO","RR","SC","SP","SE","TO"
];

const schema = z.object({
  name: z.string().min(2, "Informe seu nome completo."),
  email: z.string().email("Informe um e-mail válido."),
  phone: z.string().min(10, "Informe um telefone válido com DDD."),
  password: z.string().min(8, "A senha deve ter pelo menos 8 caracteres."),
  confirmPassword: z.string().min(8, "Confirme a senha."),
  cnpj: z.string()
    .min(14, "CNPJ deve ter 14 dígitos.")
    .transform((v) => v.replace(/\D/g, ""))
    .refine((v) => v.length === 14, "CNPJ deve ter exatamente 14 dígitos."),
  companyName: z.string().min(2, "Informe o nome da empresa."),
  city: z.string().min(2, "Informe a cidade."),
  state: z.string().min(2, "Selecione o estado."),
  website: z.string().url("URL inválida.").optional().or(z.literal("")),
  instagram: z.string().optional(),
}).refine((data) => data.password === data.confirmPassword, {
  message: "As senhas não conferem.",
  path: ["confirmPassword"],
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

export default function RegisterOrganizerPage() {
  const router = useRouter();
  const setSession = useAuthStore((state) => state.setSession);
  const form = useForm<FormData>({ resolver: zodResolver(schema) });
  const mutation = useMutation({
    mutationFn: (data: FormData) => {
      const { confirmPassword, ...payload } = data;
      return api<{ accessToken: string; refreshToken: string; user: any }>("/auth/register-organizer", {
        method: "POST",
        body: JSON.stringify({
          ...payload,
          cnpj: payload.cnpj.replace(/\D/g, ""),
          state: payload.state.toUpperCase(),
        }),
        auth: false
      });
    },
    onSuccess: (session) => {
      setSession(session);
      router.push("/dashboard");
    }
  });

  return (
    <div className="w-full max-w-lg">
      <div className="mb-8 text-center">
        <h1 className="text-3xl font-extrabold tracking-tight">Cadastro de Organizador</h1>
        <p className="mt-2 text-muted-foreground">Crie sua conta para começar a criar e gerenciar eventos</p>
      </div>

      <div className="rounded-2xl border bg-white dark:bg-card p-8 shadow-sm">
        <form className="space-y-5" onSubmit={form.handleSubmit((data) => mutation.mutate(data))}>

          {/* ─── Seção: Dados do Responsável ─── */}
          <div className="space-y-1 pb-2">
            <h2 className="text-sm font-bold text-primary uppercase tracking-wider flex items-center gap-2">
              <User className="h-4 w-4" /> Dados do Responsável
            </h2>
            <div className="h-px bg-border" />
          </div>

          <Field label="Nome completo" error={form.formState.errors.name?.message} icon={<User className="h-4 w-4" />}>
            <Input placeholder="Seu nome" className="pl-10 rounded-xl" {...form.register("name")} />
          </Field>

          <Field label="E-mail" error={form.formState.errors.email?.message} icon={<Mail className="h-4 w-4" />}>
            <Input type="email" placeholder="empresa@email.com" className="pl-10 rounded-xl" {...form.register("email")} />
          </Field>

          <Field label="Telefone" error={form.formState.errors.phone?.message} icon={<Phone className="h-4 w-4" />}>
            <Input placeholder="(31) 99999-9999" className="pl-10 rounded-xl" {...form.register("phone")} />
          </Field>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <Field label="Senha" error={form.formState.errors.password?.message} icon={<Lock className="h-4 w-4" />}>
              <Input type="password" placeholder="Mínimo 8 caracteres" className="pl-10 rounded-xl" {...form.register("password")} />
            </Field>
            <Field label="Confirmar senha" error={form.formState.errors.confirmPassword?.message} icon={<Lock className="h-4 w-4" />}>
              <Input type="password" placeholder="Repita a senha" className="pl-10 rounded-xl" {...form.register("confirmPassword")} />
            </Field>
          </div>

          {/* ─── Seção: Dados da Empresa ─── */}
          <div className="space-y-1 pt-4 pb-2">
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

          <Field label="Nome da empresa" error={form.formState.errors.companyName?.message} icon={<Building2 className="h-4 w-4" />}>
            <Input placeholder="Razão social ou nome fantasia" className="pl-10 rounded-xl" {...form.register("companyName")} />
          </Field>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <Field label="Cidade" error={form.formState.errors.city?.message} icon={<MapPin className="h-4 w-4" />}>
              <Input placeholder="Belo Horizonte" className="pl-10 rounded-xl" {...form.register("city")} />
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
            className="w-full rounded-xl bg-primary hover:bg-primary/90 text-white font-bold h-12 text-base shadow-md shadow-primary/25 mt-2"
            disabled={mutation.isPending}
          >
            {mutation.isPending && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
            Criar conta de organizador
          </Button>
        </form>
      </div>

      <p className="mt-6 text-center text-sm text-muted-foreground">
        Já tem uma conta?{" "}
        <Link href="/login" className="font-semibold text-primary hover:underline">
          Entrar
        </Link>
      </p>
      <p className="mt-2 text-center text-sm text-muted-foreground">
        Quer comprar ingressos?{" "}
        <Link href="/register" className="font-semibold text-primary hover:underline">
          Criar conta de cliente
        </Link>
      </p>
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

"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation } from "@tanstack/react-query";
import { Loader2, User, Mail, Phone, Lock } from "lucide-react";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { api } from "@/lib/api";
import { useAuthStore } from "@/stores/auth-store";

const schema = z.object({
  name: z.string().min(2, "Informe seu nome."),
  email: z.string().email("Informe um e-mail válido."),
  phone: z.string().min(10, "Informe um telefone válido com DDD."),
  cpf: z.string().min(11, "Informe um CPF válido."),
  password: z.string().min(8, "A senha deve ter pelo menos 8 caracteres.")
});

type FormData = z.infer<typeof schema>;

export default function RegisterPage() {
  const router = useRouter();
  const setSession = useAuthStore((state) => state.setSession);
  const form = useForm<FormData>({ resolver: zodResolver(schema) });
  const mutation = useMutation({
    mutationFn: (data: FormData) =>
      api<{ accessToken: string; user: any }>("/auth/register", {
        method: "POST",
        body: JSON.stringify(data),
        auth: false
      }),
    onSuccess: (session) => {
      setSession(session);
      router.push("/me/ingressos");
    }
  });

  return (
    <div className="w-full max-w-md">
      <div className="mb-8 text-center">
        <h1 className="text-3xl font-extrabold tracking-tight">Crie sua conta</h1>
        <p className="mt-2 text-muted-foreground">Comece a comprar e organizar eventos agora mesmo</p>
      </div>

      <div className="rounded-2xl border bg-white dark:bg-card p-8 shadow-sm">
        <form className="space-y-4" onSubmit={form.handleSubmit((data) => mutation.mutate(data))}>
          <Field label="Nome completo" error={form.formState.errors.name?.message} icon={<User className="h-4 w-4" />}>
            <Input
              placeholder="Seu nome"
              className="pl-10 rounded-xl border-border focus:border-primary"
              {...form.register("name")}
            />
          </Field>
          <Field label="E-mail" error={form.formState.errors.email?.message} icon={<Mail className="h-4 w-4" />}>
            <Input
              type="email"
              placeholder="seu@email.com"
              className="pl-10 rounded-xl border-border focus:border-primary"
              {...form.register("email")}
            />
          </Field>
          <Field label="Telefone" error={form.formState.errors.phone?.message} icon={<Phone className="h-4 w-4" />}>
            <Input
              placeholder="(11) 99999-9999"
              className="pl-10 rounded-xl border-border focus:border-primary"
              {...form.register("phone")}
            />
          </Field>
          <Field label="CPF" error={form.formState.errors.cpf?.message} icon={<User className="h-4 w-4" />}>
            <Input
              placeholder="000.000.000-00"
              className="pl-10 rounded-xl border-border focus:border-primary"
              {...form.register("cpf")}
            />
          </Field>
          <Field label="Senha" error={form.formState.errors.password?.message} icon={<Lock className="h-4 w-4" />}>
            <Input
              type="password"
              placeholder="Mínimo 8 caracteres"
              className="pl-10 rounded-xl border-border focus:border-primary"
              {...form.register("password")}
            />
          </Field>

          {mutation.error && (
            <div className="rounded-xl bg-destructive/10 border border-destructive/20 p-3">
              <p className="text-sm text-destructive text-center">{mutation.error.message}</p>
            </div>
          )}

          <Button
            className="w-full rounded-xl bg-primary hover:bg-primary/90 text-white font-bold h-12 text-base shadow-md shadow-primary/25 mt-2"
            disabled={mutation.isPending}
          >
            {mutation.isPending && <Loader2 className="h-4 w-4 animate-spin" />}
            Criar conta
          </Button>
        </form>
      </div>

      <p className="mt-6 text-center text-sm text-muted-foreground">
        Já tem uma conta?{" "}
        <Link href="/login" className="font-semibold text-primary hover:underline">
          Entrar
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

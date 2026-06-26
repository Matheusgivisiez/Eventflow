"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation } from "@tanstack/react-query";
import { Loader2, Eye, EyeOff, Mail, Lock } from "lucide-react";
import { useState } from "react";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { api } from "@/lib/api";
import { useAuthStore } from "@/stores/auth-store";

const schema = z.object({
  email: z.string().email("Informe um e-mail válido."),
  password: z.string().min(8, "A senha deve ter pelo menos 8 caracteres.")
});

type FormData = z.infer<typeof schema>;

export default function LoginPage() {
  const router = useRouter();
  const setSession = useAuthStore((state) => state.setSession);
  const [showPassword, setShowPassword] = useState(false);
  const form = useForm<FormData>({ resolver: zodResolver(schema), defaultValues: { email: "", password: "" } });
  const mutation = useMutation({
    mutationFn: (data: FormData) =>
      api<{ accessToken: string; refreshToken: string; user: any }>("/auth/login", {
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
      {/* Header */}
      <div className="mb-8 text-center">
        <h1 className="text-3xl font-extrabold tracking-tight">Bem-vindo de volta!</h1>
        <p className="mt-2 text-muted-foreground">Entre na sua conta para acessar seus ingressos</p>
      </div>

      <div className="rounded-2xl border bg-white dark:bg-card p-8 shadow-sm">
        <form className="space-y-5" onSubmit={form.handleSubmit((data) => mutation.mutate(data))}>
          {/* Email */}
          <div className="space-y-2">
            <Label htmlFor="email" className="text-sm font-semibold">E-mail</Label>
            <div className="relative">
              <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                id="email"
                type="email"
                placeholder="seu@email.com"
                className="pl-10 rounded-xl border-border focus:border-primary focus:ring-primary/20"
                {...form.register("email")}
              />
            </div>
            {form.formState.errors.email && (
              <p className="text-xs text-destructive">{form.formState.errors.email.message}</p>
            )}
          </div>

          {/* Senha */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label htmlFor="password" className="text-sm font-semibold">Senha</Label>
              <Link href="/forgot-password" className="text-xs text-primary hover:underline font-medium">
                Esqueci minha senha
              </Link>
            </div>
            <div className="relative">
              <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                id="password"
                type={showPassword ? "text" : "password"}
                placeholder="••••••••"
                className="pl-10 pr-10 rounded-xl border-border focus:border-primary focus:ring-primary/20"
                {...form.register("password")}
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
              >
                {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </button>
            </div>
            {form.formState.errors.password && (
              <p className="text-xs text-destructive">{form.formState.errors.password.message}</p>
            )}
          </div>

          {mutation.error && (
            <div className="rounded-xl bg-destructive/10 border border-destructive/20 p-3">
              <p className="text-sm text-destructive text-center">{mutation.error.message}</p>
            </div>
          )}

          <Button
            className="w-full rounded-xl bg-primary hover:bg-primary/90 text-white font-bold h-12 text-base shadow-md shadow-primary/25 transition-all"
            disabled={mutation.isPending}
          >
            {mutation.isPending && <Loader2 className="h-4 w-4 animate-spin" />}
            Entrar
          </Button>
        </form>
      </div>

      <p className="mt-6 text-center text-sm text-muted-foreground">
        Não tem uma conta?{" "}
        <Link href="/register" className="font-semibold text-primary hover:underline">
          Criar conta grátis
        </Link>
      </p>
    </div>
  );
}

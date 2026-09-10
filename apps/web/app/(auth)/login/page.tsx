"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation } from "@tanstack/react-query";
import {
  Mail,
  Lock,
  Eye,
  EyeOff,
  ArrowRight,
  Loader2
} from "lucide-react";
import { useState } from "react";
import { useForm } from "react-hook-form";
import { z } from "zod";
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

  const form = useForm<FormData>({
    resolver: zodResolver(schema),
    defaultValues: { email: "", password: "" }
  });

  const mutation = useMutation({
    mutationFn: (data: FormData) =>
      api<{ accessToken: string; user: any }>("/auth/login", {
        method: "POST",
        body: JSON.stringify(data),
        auth: false
      }),
    onSuccess: (session) => {
      setSession(session);
      if (session.user?.role === "PROMOTER") {
        router.push("/portal/dashboard");
      } else if (session.user?.role === "ORGANIZER" || session.user?.role === "ADMIN") {
        router.push("/dashboard");
      } else {
        router.push("/me/ingressos");
      }
    }
  });

  return (
    <div className="w-full max-w-[490px] rounded-[24px] bg-[#150F28]/75 backdrop-blur-[24px] border border-purple-400/25 p-7 sm:p-9 lg:p-11 shadow-[0_20px_60px_rgba(0,0,0,0.6),0_0_45px_rgba(120,60,255,0.14)] relative animate-card-enter">
      {/* Título e Subtítulo */}
      <div className="text-center mb-7 sm:mb-8">
        <h2 className="text-2xl sm:text-[26px] font-bold text-white tracking-tight">
          Bem-vindo de volta!
        </h2>
        <p className="mt-2 text-xs sm:text-sm text-[#A99EC0]">
          Entre na sua conta para acessar seus ingressos
        </p>
      </div>

      {/* Formulário de Login */}
      <form
        className="space-y-4 sm:space-y-5"
        onSubmit={form.handleSubmit((data) => mutation.mutate(data))}
      >
        {/* Campo E-mail */}
        <div className="space-y-1.5">
          <label
            htmlFor="email"
            className="block text-xs font-semibold text-[#D4CAE8]"
          >
            E-mail
          </label>
          <div className="relative">
            <Mail className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-[#8E82A8]" />
            <input
              id="email"
              type="email"
              autoComplete="email"
              placeholder="seu@email.com"
              className="w-full h-[50px] rounded-xl bg-[#0D081F]/70 border border-purple-400/20 pl-10 pr-4 text-sm text-white placeholder:text-[#6D6288] focus:border-[#8C62FF] focus:ring-1 focus:ring-[#8C62FF]/40 outline-none transition-all"
              {...form.register("email")}
            />
          </div>
          {form.formState.errors.email && (
            <p className="text-xs text-rose-400 mt-1">
              {form.formState.errors.email.message}
            </p>
          )}
        </div>

        {/* Campo Senha */}
        <div className="space-y-1.5">
          <div className="flex items-center justify-between">
            <label
              htmlFor="password"
              className="text-xs font-semibold text-[#D4CAE8]"
            >
              Senha
            </label>
            <Link
              href="/forgot-password"
              className="text-xs text-[#9E7BFF] hover:text-[#BFA4FF] transition-colors font-medium"
            >
              Esqueci minha senha
            </Link>
          </div>
          <div className="relative">
            <Lock className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-[#8E82A8]" />
            <input
              id="password"
              type={showPassword ? "text" : "password"}
              autoComplete="current-password"
              placeholder="••••••••"
              className="w-full h-[50px] rounded-xl bg-[#0D081F]/70 border border-purple-400/20 pl-10 pr-10 text-sm text-white placeholder:text-[#6D6288] focus:border-[#8C62FF] focus:ring-1 focus:ring-[#8C62FF]/40 outline-none transition-all"
              {...form.register("password")}
            />
            <button
              type="button"
              onClick={() => setShowPassword(!showPassword)}
              className="absolute right-3.5 top-1/2 -translate-y-1/2 text-[#8E82A8] hover:text-white transition-colors"
              aria-label={showPassword ? "Ocultar senha" : "Ver senha"}
            >
              {showPassword ? (
                <EyeOff className="w-4 h-4" />
              ) : (
                <Eye className="w-4 h-4" />
              )}
            </button>
          </div>
          {form.formState.errors.password && (
            <p className="text-xs text-rose-400 mt-1">
              {form.formState.errors.password.message}
            </p>
          )}
        </div>

        {/* Mensagem de Erro da Mutação */}
        {mutation.error && (
          <div className="rounded-xl bg-rose-500/10 border border-rose-500/30 p-3 text-center">
            <p className="text-xs text-rose-300">
              {mutation.error.message}
            </p>
          </div>
        )}

        {/* Botão Entrar */}
        <button
          type="submit"
          disabled={mutation.isPending}
          className="w-full h-[52px] rounded-xl text-white font-semibold text-sm flex items-center justify-center gap-2 shadow-[0_4px_22px_rgba(116,60,255,0.4)] hover:brightness-110 hover:-translate-y-[1px] active:translate-y-0 disabled:opacity-60 disabled:pointer-events-none transition-all mt-2"
          style={{
            background:
              "linear-gradient(90deg, #743CFF 0%, #6247FF 48%, #C084FC 100%)"
          }}
        >
          {mutation.isPending ? (
            <Loader2 className="w-4 h-4 animate-spin" />
          ) : (
            <>
              <span>Entrar</span>
              <ArrowRight className="w-4 h-4" />
            </>
          )}
        </button>
      </form>

      {/* Divisor "ou" */}
      <div className="relative my-5 sm:my-6 flex items-center justify-center">
        <div className="border-t border-purple-400/20 w-full" />
        <span className="bg-[#150F28] px-3 text-xs text-[#8E82A8] uppercase tracking-wider relative">
          ou
        </span>
      </div>

      {/* Links Inferiores */}
      <div className="space-y-2">
        <p className="text-center text-xs text-[#A99EC0]">
          Não tem uma conta?{" "}
          <Link
            href="/register"
            className="font-semibold text-[#9E7BFF] hover:text-[#BFA4FF] transition-colors hover:underline"
          >
            Criar conta grátis
          </Link>
        </p>
        <p className="text-center text-xs text-[#A99EC0]">
          É produtor de eventos?{" "}
          <Link
            href="/organizador/register"
            className="font-semibold text-[#9E7BFF] hover:text-[#BFA4FF] transition-colors hover:underline"
          >
            Criar conta de organizador
          </Link>
        </p>
      </div>
    </div>
  );
}



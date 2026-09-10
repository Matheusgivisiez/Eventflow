"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation } from "@tanstack/react-query";
import {
  User,
  Mail,
  Phone,
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
  name: z.string().min(2, "Informe seu nome."),
  email: z.string().email("Informe um e-mail válido."),
  phone: z.string().min(10, "Informe um telefone válido com DDD."),
  cpf: z.string().min(11, "Informe um CPF válido."),
  password: z.string().min(8, "A senha deve ter pelo menos 8 caracteres.")
});

type FormData = z.infer<typeof schema>;

function maskPhone(value: string) {
  const digits = value.replace(/\D/g, "").slice(0, 11);
  if (digits.length <= 2) return digits.length ? `(${digits}` : "";
  if (digits.length <= 6) return `(${digits.slice(0, 2)}) ${digits.slice(2)}`;
  if (digits.length <= 10) return `(${digits.slice(0, 2)}) ${digits.slice(2, 6)}-${digits.slice(6)}`;
  return `(${digits.slice(0, 2)}) ${digits.slice(2, 7)}-${digits.slice(7, 11)}`;
}

function maskCpf(value: string) {
  const digits = value.replace(/\D/g, "").slice(0, 11);
  if (digits.length <= 3) return digits;
  if (digits.length <= 6) return `${digits.slice(0, 3)}.${digits.slice(3)}`;
  if (digits.length <= 9) return `${digits.slice(0, 3)}.${digits.slice(3, 6)}.${digits.slice(6)}`;
  return `${digits.slice(0, 3)}.${digits.slice(3, 6)}.${digits.slice(6, 9)}-${digits.slice(9, 11)}`;
}

export default function RegisterPage() {
  const router = useRouter();
  const setSession = useAuthStore((state) => state.setSession);
  const [showPassword, setShowPassword] = useState(false);

  const form = useForm<FormData>({
    resolver: zodResolver(schema),
    defaultValues: { name: "", email: "", phone: "", cpf: "", password: "" }
  });

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
    <div className="w-full max-w-[490px] xl:max-w-[510px] rounded-[24px] bg-[#150F28]/75 backdrop-blur-[24px] border border-purple-400/25 p-6 sm:p-8 lg:p-9 shadow-[0_20px_60px_rgba(0,0,0,0.6),0_0_45px_rgba(120,60,255,0.14)] relative animate-card-enter">
      {/* Título e Subtítulo */}
      <div className="text-center mb-6 sm:mb-7">
        <h2 className="text-2xl sm:text-[26px] font-bold text-white tracking-tight">
          Crie sua conta
        </h2>
        <p className="mt-1.5 text-xs sm:text-sm text-[#A99EC0]">
          Comece a comprar e organizar eventos agora mesmo
        </p>
      </div>

      {/* Formulário de Cadastro */}
      <form
        className="space-y-3.5 sm:space-y-4"
        onSubmit={form.handleSubmit((data) => mutation.mutate(data))}
      >
        {/* Nome completo */}
        <div className="space-y-1.5">
          <label
            htmlFor="name"
            className="block text-xs font-semibold text-[#D4CAE8]"
          >
            Nome completo
          </label>
          <div className="relative">
            <User className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-[#8E82A8]" />
            <input
              id="name"
              type="text"
              autoComplete="name"
              placeholder="Seu nome"
              className="w-full h-[48px] rounded-xl bg-[#0D081F]/70 border border-purple-400/20 pl-10 pr-4 text-sm text-white placeholder:text-[#6D6288] focus:border-[#8C62FF] focus:ring-1 focus:ring-[#8C62FF]/40 outline-none transition-all"
              {...form.register("name")}
            />
          </div>
          {form.formState.errors.name && (
            <p className="text-xs text-rose-400 mt-1">
              {form.formState.errors.name.message}
            </p>
          )}
        </div>

        {/* E-mail */}
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
              className="w-full h-[48px] rounded-xl bg-[#0D081F]/70 border border-purple-400/20 pl-10 pr-4 text-sm text-white placeholder:text-[#6D6288] focus:border-[#8C62FF] focus:ring-1 focus:ring-[#8C62FF]/40 outline-none transition-all"
              {...form.register("email")}
            />
          </div>
          {form.formState.errors.email && (
            <p className="text-xs text-rose-400 mt-1">
              {form.formState.errors.email.message}
            </p>
          )}
        </div>

        {/* Telefone e CPF em linha dupla ou compacta */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-3.5">
          {/* Telefone */}
          <div className="space-y-1.5">
            <label
              htmlFor="phone"
              className="block text-xs font-semibold text-[#D4CAE8]"
            >
              Telefone
            </label>
            <div className="relative">
              <Phone className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-[#8E82A8]" />
              <input
                id="phone"
                type="tel"
                autoComplete="tel"
                placeholder="(11) 99999-9999"
                className="w-full h-[48px] rounded-xl bg-[#0D081F]/70 border border-purple-400/20 pl-10 pr-3 text-sm text-white placeholder:text-[#6D6288] focus:border-[#8C62FF] focus:ring-1 focus:ring-[#8C62FF]/40 outline-none transition-all"
                {...form.register("phone", {
                  onChange: (e) => {
                    e.target.value = maskPhone(e.target.value);
                  }
                })}
              />
            </div>
            {form.formState.errors.phone && (
              <p className="text-xs text-rose-400 mt-1">
                {form.formState.errors.phone.message}
              </p>
            )}
          </div>

          {/* CPF */}
          <div className="space-y-1.5">
            <label
              htmlFor="cpf"
              className="block text-xs font-semibold text-[#D4CAE8]"
            >
              CPF
            </label>
            <div className="relative">
              <User className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-[#8E82A8]" />
              <input
                id="cpf"
                type="text"
                inputMode="numeric"
                placeholder="000.000.000-00"
                className="w-full h-[48px] rounded-xl bg-[#0D081F]/70 border border-purple-400/20 pl-10 pr-3 text-sm text-white placeholder:text-[#6D6288] focus:border-[#8C62FF] focus:ring-1 focus:ring-[#8C62FF]/40 outline-none transition-all"
                {...form.register("cpf", {
                  onChange: (e) => {
                    e.target.value = maskCpf(e.target.value);
                  }
                })}
              />
            </div>
            {form.formState.errors.cpf && (
              <p className="text-xs text-rose-400 mt-1">
                {form.formState.errors.cpf.message}
              </p>
            )}
          </div>
        </div>

        {/* Senha */}
        <div className="space-y-1.5">
          <label
            htmlFor="password"
            className="block text-xs font-semibold text-[#D4CAE8]"
          >
            Senha
          </label>
          <div className="relative">
            <Lock className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-[#8E82A8]" />
            <input
              id="password"
              type={showPassword ? "text" : "password"}
              autoComplete="new-password"
              placeholder="Mínimo 8 caracteres"
              className="w-full h-[48px] rounded-xl bg-[#0D081F]/70 border border-purple-400/20 pl-10 pr-10 text-sm text-white placeholder:text-[#6D6288] focus:border-[#8C62FF] focus:ring-1 focus:ring-[#8C62FF]/40 outline-none transition-all"
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

        {/* Botão Criar Conta */}
        <button
          type="submit"
          disabled={mutation.isPending}
          className="w-full h-[50px] rounded-xl text-white font-semibold text-sm flex items-center justify-center gap-2 shadow-[0_4px_22px_rgba(116,60,255,0.4)] hover:brightness-110 hover:-translate-y-[1px] active:translate-y-0 disabled:opacity-60 disabled:pointer-events-none transition-all mt-2"
          style={{
            background:
              "linear-gradient(90deg, #743CFF 0%, #6247FF 48%, #C084FC 100%)"
          }}
        >
          {mutation.isPending ? (
            <Loader2 className="w-4 h-4 animate-spin" />
          ) : (
            <>
              <span>Criar conta</span>
              <ArrowRight className="w-4 h-4" />
            </>
          )}
        </button>
      </form>

      {/* Link para Login */}
      <div className="mt-6 text-center">
        <p className="text-xs text-[#A99EC0]">
          Já tem uma conta?{" "}
          <Link
            href="/login"
            className="font-semibold text-[#9E7BFF] hover:text-[#BFA4FF] transition-colors hover:underline"
          >
            Entrar
          </Link>
        </p>
      </div>
    </div>
  );
}


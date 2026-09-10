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
      return api<{ accessToken: string; user: any }>("/auth/register-organizer", {
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
    <div className="w-full max-w-[540px] rounded-[24px] bg-[#150F28]/75 backdrop-blur-[24px] border border-purple-400/25 p-6 sm:p-8 lg:p-9 shadow-[0_20px_60px_rgba(0,0,0,0.6),0_0_45px_rgba(120,60,255,0.14)] relative animate-card-enter my-6">
      <div className="mb-6 text-center">
        <h2 className="text-2xl sm:text-[26px] font-bold text-white tracking-tight">Cadastro de Organizador</h2>
        <p className="mt-1.5 text-xs sm:text-sm text-[#A99EC0]">Crie sua conta para começar a criar e gerenciar eventos</p>
      </div>

      <div>
        <form className="space-y-4" onSubmit={form.handleSubmit((data) => mutation.mutate(data))}>

          {/* ─── Seção: Dados do Responsável ─── */}
          <div className="space-y-1 pb-1">
            <h3 className="text-xs font-bold text-[#BE8BFF] uppercase tracking-wider flex items-center gap-2">
              <User className="h-3.5 w-3.5" /> Dados do Responsável
            </h3>
            <div className="h-px bg-purple-400/20" />
          </div>

          <Field label="Nome completo" error={form.formState.errors.name?.message} icon={<User className="h-4 w-4" />}>
            <input placeholder="Seu nome" className="w-full h-[46px] rounded-xl bg-[#0D081F]/70 border border-purple-400/20 pl-10 pr-4 text-sm text-white placeholder:text-[#6D6288] focus:border-[#8C62FF] focus:ring-1 focus:ring-[#8C62FF]/40 outline-none transition-all" {...form.register("name")} />
          </Field>

          <Field label="E-mail" error={form.formState.errors.email?.message} icon={<Mail className="h-4 w-4" />}>
            <input type="email" placeholder="empresa@email.com" className="w-full h-[46px] rounded-xl bg-[#0D081F]/70 border border-purple-400/20 pl-10 pr-4 text-sm text-white placeholder:text-[#6D6288] focus:border-[#8C62FF] focus:ring-1 focus:ring-[#8C62FF]/40 outline-none transition-all" {...form.register("email")} />
          </Field>

          <Field label="Telefone" error={form.formState.errors.phone?.message} icon={<Phone className="h-4 w-4" />}>
            <input placeholder="(31) 99999-9999" className="w-full h-[46px] rounded-xl bg-[#0D081F]/70 border border-purple-400/20 pl-10 pr-4 text-sm text-white placeholder:text-[#6D6288] focus:border-[#8C62FF] focus:ring-1 focus:ring-[#8C62FF]/40 outline-none transition-all" {...form.register("phone")} />
          </Field>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <Field label="Senha" error={form.formState.errors.password?.message} icon={<Lock className="h-4 w-4" />}>
              <input type="password" placeholder="Mínimo 8 caracteres" className="w-full h-[46px] rounded-xl bg-[#0D081F]/70 border border-purple-400/20 pl-10 pr-4 text-sm text-white placeholder:text-[#6D6288] focus:border-[#8C62FF] focus:ring-1 focus:ring-[#8C62FF]/40 outline-none transition-all" {...form.register("password")} />
            </Field>
            <Field label="Confirmar senha" error={form.formState.errors.confirmPassword?.message} icon={<Lock className="h-4 w-4" />}>
              <input type="password" placeholder="Repita a senha" className="w-full h-[46px] rounded-xl bg-[#0D081F]/70 border border-purple-400/20 pl-10 pr-4 text-sm text-white placeholder:text-[#6D6288] focus:border-[#8C62FF] focus:ring-1 focus:ring-[#8C62FF]/40 outline-none transition-all" {...form.register("confirmPassword")} />
            </Field>
          </div>

          {/* ─── Seção: Dados da Empresa ─── */}
          <div className="space-y-1 pt-2 pb-1">
            <h3 className="text-xs font-bold text-[#BE8BFF] uppercase tracking-wider flex items-center gap-2">
              <Building2 className="h-3.5 w-3.5" /> Dados da Empresa
            </h3>
            <div className="h-px bg-purple-400/20" />
          </div>

          <Field label="CNPJ" error={form.formState.errors.cnpj?.message} icon={<Building2 className="h-4 w-4" />}>
            <input
              placeholder="00.000.000/0000-00"
              className="w-full h-[46px] rounded-xl bg-[#0D081F]/70 border border-purple-400/20 pl-10 pr-4 text-sm text-white placeholder:text-[#6D6288] focus:border-[#8C62FF] focus:ring-1 focus:ring-[#8C62FF]/40 outline-none transition-all"
              {...form.register("cnpj")}
              onChange={(e) => {
                const formatted = formatCnpj(e.target.value);
                form.setValue("cnpj", formatted, { shouldValidate: false });
              }}
            />
          </Field>

          <Field label="Nome da empresa" error={form.formState.errors.companyName?.message} icon={<Building2 className="h-4 w-4" />}>
            <input placeholder="Razão social ou nome fantasia" className="w-full h-[46px] rounded-xl bg-[#0D081F]/70 border border-purple-400/20 pl-10 pr-4 text-sm text-white placeholder:text-[#6D6288] focus:border-[#8C62FF] focus:ring-1 focus:ring-[#8C62FF]/40 outline-none transition-all" {...form.register("companyName")} />
          </Field>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <Field label="Cidade" error={form.formState.errors.city?.message} icon={<MapPin className="h-4 w-4" />}>
              <input placeholder="Belo Horizonte" className="w-full h-[46px] rounded-xl bg-[#0D081F]/70 border border-purple-400/20 pl-10 pr-4 text-sm text-white placeholder:text-[#6D6288] focus:border-[#8C62FF] focus:ring-1 focus:ring-[#8C62FF]/40 outline-none transition-all" {...form.register("city")} />
            </Field>
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-[#D4CAE8]">Estado (UF)</label>
              <select
                className="flex h-[46px] w-full rounded-xl border border-purple-400/20 bg-[#0D081F]/70 px-3 py-2 text-sm text-white focus:outline-none focus:ring-1 focus:ring-[#8C62FF]/40 focus:border-[#8C62FF]"
                {...form.register("state")}
                defaultValue=""
              >
                <option value="" disabled className="bg-[#150F28] text-white">Selecione</option>
                {UF_LIST.map((uf) => (
                  <option key={uf} value={uf} className="bg-[#150F28] text-white">{uf}</option>
                ))}
              </select>
              {form.formState.errors.state && (
                <p className="text-xs text-rose-400 mt-1">{form.formState.errors.state.message}</p>
              )}
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <Field label="Site (opcional)" error={form.formState.errors.website?.message} icon={<Globe className="h-4 w-4" />}>
              <input placeholder="https://suaempresa.com" className="w-full h-[46px] rounded-xl bg-[#0D081F]/70 border border-purple-400/20 pl-10 pr-4 text-sm text-white placeholder:text-[#6D6288] focus:border-[#8C62FF] focus:ring-1 focus:ring-[#8C62FF]/40 outline-none transition-all" {...form.register("website")} />
            </Field>
            <Field label="Instagram (opcional)" error={form.formState.errors.instagram?.message} icon={<Instagram className="h-4 w-4" />}>
              <input placeholder="@suaempresa" className="w-full h-[46px] rounded-xl bg-[#0D081F]/70 border border-purple-400/20 pl-10 pr-4 text-sm text-white placeholder:text-[#6D6288] focus:border-[#8C62FF] focus:ring-1 focus:ring-[#8C62FF]/40 outline-none transition-all" {...form.register("instagram")} />
            </Field>
          </div>

          {mutation.error && (
            <div className="rounded-xl bg-rose-500/10 border border-rose-500/30 p-3 text-center">
              <p className="text-xs text-rose-300">{mutation.error.message}</p>
            </div>
          )}

          <button
            type="submit"
            disabled={mutation.isPending}
            className="w-full h-[50px] rounded-xl text-white font-semibold text-sm flex items-center justify-center gap-2 shadow-[0_4px_22px_rgba(116,60,255,0.4)] hover:brightness-110 hover:-translate-y-[1px] active:translate-y-0 disabled:opacity-60 disabled:pointer-events-none transition-all mt-3"
            style={{
              background: "linear-gradient(90deg, #743CFF 0%, #6247FF 48%, #C084FC 100%)"
            }}
          >
            {mutation.isPending && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
            Criar conta de organizador
          </button>
        </form>
      </div>

      <div className="mt-6 text-center space-y-1.5">
        <p className="text-xs text-[#A99EC0]">
          Já tem uma conta?{" "}
          <Link href="/login" className="font-semibold text-[#9E7BFF] hover:text-[#BFA4FF] transition-colors hover:underline">
            Entrar
          </Link>
        </p>
        <p className="text-xs text-[#A99EC0]">
          Quer comprar ingressos?{" "}
          <Link href="/register" className="font-semibold text-[#9E7BFF] hover:text-[#BFA4FF] transition-colors hover:underline">
            Criar conta de cliente
          </Link>
        </p>
      </div>
    </div>
  );
}

function Field({
  label, error, icon, children
}: {
  label: string; error?: string; icon?: React.ReactNode; children: React.ReactNode;
}) {
  return (
    <div className="space-y-1.5">
      <label className="text-xs font-semibold text-[#D4CAE8]">{label}</label>
      <div className="relative">
        {icon && (
          <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-[#8E82A8]">{icon}</span>
        )}
        {children}
      </div>
      {error && <p className="text-xs text-rose-400 mt-1">{error}</p>}
    </div>
  );
}

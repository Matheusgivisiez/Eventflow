"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation } from "@tanstack/react-query";
import {
  Loader2,
  User,
  Mail,
  Phone,
  Lock,
  Building2,
  MapPin,
  Globe,
  Instagram,
  Eye,
  EyeOff
} from "lucide-react";
import { useState } from "react";
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

function formatPhone(value: string) {
  const digits = value.replace(/\D/g, "").slice(0, 11);
  if (digits.length <= 2) return digits;
  if (digits.length <= 7) return `(${digits.slice(0, 2)}) ${digits.slice(2)}`;
  return `(${digits.slice(0, 2)}) ${digits.slice(2, 7)}-${digits.slice(7)}`;
}

export default function RegisterOrganizerPage() {
  const router = useRouter();
  const setSession = useAuthStore((state) => state.setSession);
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);

  const form = useForm<FormData>({
    resolver: zodResolver(schema),
    defaultValues: {
      name: "",
      email: "",
      phone: "",
      password: "",
      confirmPassword: "",
      cnpj: "",
      companyName: "",
      city: "",
      state: "",
      website: "",
      instagram: ""
    }
  });

  const mutation = useMutation({
    mutationFn: (data: FormData) => {
      const { confirmPassword: _confirmPassword, ...payload } = data;
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
    <div className="w-full max-w-[620px] rounded-[24px] bg-[#150F28]/75 backdrop-blur-[24px] border border-purple-400/35 hover:border-purple-400/50 p-5 sm:p-6 lg:p-7 shadow-[0_20px_60px_rgba(0,0,0,0.6),0_0_45px_rgba(120,60,255,0.20),inset_0_1px_1px_rgba(255,255,255,0.12),inset_0_0_25px_rgba(158,123,255,0.06)] relative animate-card-enter transition-all">
      {/* Título e Subtítulo */}
      <div className="mb-4 text-center">
        <h2 className="text-xl sm:text-2xl font-bold text-white tracking-tight">
          Cadastro de Organizador
        </h2>
        <p className="mt-1 text-xs text-[#A99EC0]">
          Crie sua conta para começar a criar e gerenciar eventos
        </p>
      </div>

      <form onSubmit={form.handleSubmit((data) => mutation.mutate(data))} className="space-y-3.5">
        {/* Grid de 2 colunas: Responsável (esq) / Empresa (dir) */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5 sm:gap-4">
          
          {/* ─── Coluna 1: Dados do Responsável ─── */}
          <div className="space-y-2.5">
            <div className="flex items-center gap-1.5 pb-1 border-b border-purple-400/20">
              <User className="w-3.5 h-3.5 text-[#BE8BFF]" />
              <span className="text-[10px] font-bold text-[#BE8BFF] uppercase tracking-wider">
                Dados do Responsável
              </span>
            </div>

            {/* Nome completo */}
            <div className="space-y-1">
              <label className="block text-[11px] font-medium text-[#D4CAE8]">
                Nome completo
              </label>
              <div className="relative">
                <User className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-[#8E82A8]" />
                <input
                  placeholder="Seu nome"
                  className="w-full h-[38px] rounded-xl bg-[#0D081F]/70 border border-purple-400/20 pl-8 pr-3 text-xs text-white placeholder:text-[#6D6288] focus:border-[#8C62FF] focus:ring-1 focus:ring-[#8C62FF]/40 outline-none transition-all"
                  {...form.register("name")}
                />
              </div>
              {form.formState.errors.name && (
                <p className="text-[10px] text-rose-400">{form.formState.errors.name.message}</p>
              )}
            </div>

            {/* E-mail */}
            <div className="space-y-1">
              <label className="block text-[11px] font-medium text-[#D4CAE8]">
                E-mail
              </label>
              <div className="relative">
                <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-[#8E82A8]" />
                <input
                  type="email"
                  placeholder="empresa@email.com"
                  className="w-full h-[38px] rounded-xl bg-[#0D081F]/70 border border-purple-400/20 pl-8 pr-3 text-xs text-white placeholder:text-[#6D6288] focus:border-[#8C62FF] focus:ring-1 focus:ring-[#8C62FF]/40 outline-none transition-all"
                  {...form.register("email")}
                />
              </div>
              {form.formState.errors.email && (
                <p className="text-[10px] text-rose-400">{form.formState.errors.email.message}</p>
              )}
            </div>

            {/* Telefone */}
            <div className="space-y-1">
              <label className="block text-[11px] font-medium text-[#D4CAE8]">
                Telefone
              </label>
              <div className="relative">
                <Phone className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-[#8E82A8]" />
                <input
                  placeholder="(31) 99999-9999"
                  maxLength={15}
                  className="w-full h-[38px] rounded-xl bg-[#0D081F]/70 border border-purple-400/20 pl-8 pr-3 text-xs text-white placeholder:text-[#6D6288] focus:border-[#8C62FF] focus:ring-1 focus:ring-[#8C62FF]/40 outline-none transition-all"
                  {...form.register("phone")}
                  onChange={(e) => {
                    const formatted = formatPhone(e.target.value);
                    form.setValue("phone", formatted, { shouldValidate: true });
                  }}
                />
              </div>
              {form.formState.errors.phone && (
                <p className="text-[10px] text-rose-400">{form.formState.errors.phone.message}</p>
              )}
            </div>

            {/* Senha */}
            <div className="space-y-1">
              <label className="block text-[11px] font-medium text-[#D4CAE8]">
                Senha
              </label>
              <div className="relative">
                <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-[#8E82A8]" />
                <input
                  type={showPassword ? "text" : "password"}
                  placeholder="Mínimo 8 caracteres"
                  className="w-full h-[38px] rounded-xl bg-[#0D081F]/70 border border-purple-400/20 pl-8 pr-8 text-xs text-white placeholder:text-[#6D6288] focus:border-[#8C62FF] focus:ring-1 focus:ring-[#8C62FF]/40 outline-none transition-all"
                  {...form.register("password")}
                />
                <button
                  type="button"
                  tabIndex={-1}
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 text-[#8E82A8] hover:text-[#C4B5FD] transition-colors"
                >
                  {showPassword ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                </button>
              </div>
              {form.formState.errors.password && (
                <p className="text-[10px] text-rose-400">{form.formState.errors.password.message}</p>
              )}
            </div>

            {/* Confirmar senha */}
            <div className="space-y-1">
              <label className="block text-[11px] font-medium text-[#D4CAE8]">
                Confirmar senha
              </label>
              <div className="relative">
                <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-[#8E82A8]" />
                <input
                  type={showConfirmPassword ? "text" : "password"}
                  placeholder="Repita a senha"
                  className="w-full h-[38px] rounded-xl bg-[#0D081F]/70 border border-purple-400/20 pl-8 pr-8 text-xs text-white placeholder:text-[#6D6288] focus:border-[#8C62FF] focus:ring-1 focus:ring-[#8C62FF]/40 outline-none transition-all"
                  {...form.register("confirmPassword")}
                />
                <button
                  type="button"
                  tabIndex={-1}
                  onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 text-[#8E82A8] hover:text-[#C4B5FD] transition-colors"
                >
                  {showConfirmPassword ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                </button>
              </div>
              {form.formState.errors.confirmPassword && (
                <p className="text-[10px] text-rose-400">{form.formState.errors.confirmPassword.message}</p>
              )}
            </div>
          </div>

          {/* ─── Coluna 2: Dados da Empresa ─── */}
          <div className="space-y-2.5">
            <div className="flex items-center gap-1.5 pb-1 border-b border-purple-400/20">
              <Building2 className="w-3.5 h-3.5 text-[#BE8BFF]" />
              <span className="text-[10px] font-bold text-[#BE8BFF] uppercase tracking-wider">
                Dados da Empresa
              </span>
            </div>

            {/* CNPJ */}
            <div className="space-y-1">
              <label className="block text-[11px] font-medium text-[#D4CAE8]">
                CNPJ
              </label>
              <div className="relative">
                <Building2 className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-[#8E82A8]" />
                <input
                  placeholder="00.000.000/0000-00"
                  maxLength={18}
                  className="w-full h-[38px] rounded-xl bg-[#0D081F]/70 border border-purple-400/20 pl-8 pr-3 text-xs text-white placeholder:text-[#6D6288] focus:border-[#8C62FF] focus:ring-1 focus:ring-[#8C62FF]/40 outline-none transition-all"
                  {...form.register("cnpj")}
                  onChange={(e) => {
                    const formatted = formatCnpj(e.target.value);
                    form.setValue("cnpj", formatted, { shouldValidate: true });
                  }}
                />
              </div>
              {form.formState.errors.cnpj && (
                <p className="text-[10px] text-rose-400">{form.formState.errors.cnpj.message}</p>
              )}
            </div>

            {/* Razão Social / Nome da Empresa */}
            <div className="space-y-1">
              <label className="block text-[11px] font-medium text-[#D4CAE8]">
                Nome da empresa
              </label>
              <div className="relative">
                <Building2 className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-[#8E82A8]" />
                <input
                  placeholder="Razão social ou fantasia"
                  className="w-full h-[38px] rounded-xl bg-[#0D081F]/70 border border-purple-400/20 pl-8 pr-3 text-xs text-white placeholder:text-[#6D6288] focus:border-[#8C62FF] focus:ring-1 focus:ring-[#8C62FF]/40 outline-none transition-all"
                  {...form.register("companyName")}
                />
              </div>
              {form.formState.errors.companyName && (
                <p className="text-[10px] text-rose-400">{form.formState.errors.companyName.message}</p>
              )}
            </div>

            {/* Cidade e Estado (UF) */}
            <div className="space-y-1">
              <div className="grid grid-cols-[1fr_76px] gap-2">
                <div>
                  <label className="block text-[11px] font-medium text-[#D4CAE8] mb-1">
                    Cidade
                  </label>
                  <div className="relative">
                    <MapPin className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-[#8E82A8]" />
                    <input
                      placeholder="Sua cidade"
                      className="w-full h-[38px] rounded-xl bg-[#0D081F]/70 border border-purple-400/20 pl-8 pr-2 text-xs text-white placeholder:text-[#6D6288] focus:border-[#8C62FF] focus:ring-1 focus:ring-[#8C62FF]/40 outline-none transition-all"
                      {...form.register("city")}
                    />
                  </div>
                </div>
                <div>
                  <label className="block text-[11px] font-medium text-[#D4CAE8] mb-1">
                    UF
                  </label>
                  <select
                    className="flex h-[38px] w-full rounded-xl border border-purple-400/20 bg-[#0D081F]/70 px-2 py-1 text-xs text-white focus:outline-none focus:ring-1 focus:ring-[#8C62FF]/40 focus:border-[#8C62FF]"
                    {...form.register("state")}
                    defaultValue=""
                  >
                    <option value="" disabled className="bg-[#150F28] text-white">UF</option>
                    {UF_LIST.map((uf) => (
                      <option key={uf} value={uf} className="bg-[#150F28] text-white">{uf}</option>
                    ))}
                  </select>
                </div>
              </div>
              {(form.formState.errors.city || form.formState.errors.state) && (
                <p className="text-[10px] text-rose-400">
                  {form.formState.errors.city?.message || form.formState.errors.state?.message}
                </p>
              )}
            </div>

            {/* Site */}
            <div className="space-y-1">
              <label className="block text-[11px] font-medium text-[#D4CAE8]">
                Site <span className="text-[#8E82A8] font-normal">(opcional)</span>
              </label>
              <div className="relative">
                <Globe className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-[#8E82A8]" />
                <input
                  placeholder="https://suaempresa.com"
                  className="w-full h-[38px] rounded-xl bg-[#0D081F]/70 border border-purple-400/20 pl-8 pr-3 text-xs text-white placeholder:text-[#6D6288] focus:border-[#8C62FF] focus:ring-1 focus:ring-[#8C62FF]/40 outline-none transition-all"
                  {...form.register("website")}
                />
              </div>
              {form.formState.errors.website && (
                <p className="text-[10px] text-rose-400">{form.formState.errors.website.message}</p>
              )}
            </div>

            {/* Instagram */}
            <div className="space-y-1">
              <label className="block text-[11px] font-medium text-[#D4CAE8]">
                Instagram <span className="text-[#8E82A8] font-normal">(opcional)</span>
              </label>
              <div className="relative">
                <Instagram className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-[#8E82A8]" />
                <input
                  placeholder="@suaempresa"
                  className="w-full h-[38px] rounded-xl bg-[#0D081F]/70 border border-purple-400/20 pl-8 pr-3 text-xs text-white placeholder:text-[#6D6288] focus:border-[#8C62FF] focus:ring-1 focus:ring-[#8C62FF]/40 outline-none transition-all"
                  {...form.register("instagram")}
                />
              </div>
              {form.formState.errors.instagram && (
                <p className="text-[10px] text-rose-400">{form.formState.errors.instagram.message}</p>
              )}
            </div>
          </div>
        </div>

        {mutation.error && (
          <div className="rounded-xl bg-rose-500/10 border border-rose-500/30 p-2 text-center">
            <p className="text-xs text-rose-300">{mutation.error.message}</p>
          </div>
        )}

        {/* Botão de Envio */}
        <button
          type="submit"
          disabled={mutation.isPending}
          className="w-full h-[46px] rounded-xl text-white font-semibold text-sm flex items-center justify-center gap-2 shadow-[0_4px_22px_rgba(116,60,255,0.4)] hover:brightness-110 hover:-translate-y-[1px] active:translate-y-0 disabled:opacity-60 disabled:pointer-events-none transition-all mt-2"
          style={{
            background: "linear-gradient(90deg, #743CFF 0%, #6247FF 48%, #C084FC 100%)"
          }}
        >
          {mutation.isPending && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
          Criar conta de organizador
        </button>
      </form>

      {/* Links inferiores */}
      <div className="mt-3.5 text-center space-y-1">
        <p className="text-xs text-[#A99EC0]">
          Já tem uma conta?{" "}
          <Link
            href="/login"
            className="font-semibold text-[#9E7BFF] hover:text-[#BFA4FF] transition-colors hover:underline"
          >
            Entrar
          </Link>
        </p>
        <p className="text-xs text-[#A99EC0]">
          Quer comprar ingressos?{" "}
          <Link
            href="/register"
            className="font-semibold text-[#9E7BFF] hover:text-[#BFA4FF] transition-colors hover:underline"
          >
            Criar conta de cliente
          </Link>
        </p>
      </div>
    </div>
  );
}

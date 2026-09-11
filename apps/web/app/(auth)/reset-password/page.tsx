"use client";

import { Suspense, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation } from "@tanstack/react-query";
import { ArrowRight, CheckCircle2, Eye, EyeOff, Loader2, Lock } from "lucide-react";
import { useForm, type UseFormRegisterReturn } from "react-hook-form";
import { z } from "zod";
import { api } from "@/lib/api";

const schema = z.object({
  password: z.string().min(8, "A senha deve ter pelo menos 8 caracteres."),
  confirmPassword: z.string().min(8, "Confirme sua nova senha.")
}).refine((data) => data.password === data.confirmPassword, {
  message: "As senhas nao conferem.",
  path: ["confirmPassword"]
});

type FormData = z.infer<typeof schema>;

function AuthCard({ children }: { children: React.ReactNode }) {
  return (
    <div className="w-full max-w-[490px] rounded-[24px] bg-[#150F28]/75 backdrop-blur-[24px] border border-purple-400/25 p-7 sm:p-9 lg:p-11 shadow-[0_20px_60px_rgba(0,0,0,0.6),0_0_45px_rgba(120,60,255,0.14)] relative animate-card-enter">
      {children}
    </div>
  );
}

function PrimaryAuthLink({ href, children }: { href: string; children: React.ReactNode }) {
  return (
    <Link
      href={href}
      className="w-full h-[52px] rounded-xl text-white font-semibold text-sm flex items-center justify-center gap-2 shadow-[0_4px_22px_rgba(116,60,255,0.4)] hover:brightness-110 hover:-translate-y-[1px] active:translate-y-0 transition-all"
      style={{ background: "linear-gradient(90deg, #743CFF 0%, #6247FF 48%, #C084FC 100%)" }}
    >
      <span>{children}</span>
      <ArrowRight className="w-4 h-4" />
    </Link>
  );
}

function ResetPasswordForm() {
  const searchParams = useSearchParams();
  const token = searchParams.get("token");
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmation, setShowConfirmation] = useState(false);

  const form = useForm<FormData>({
    resolver: zodResolver(schema),
    defaultValues: { password: "", confirmPassword: "" }
  });

  const mutation = useMutation({
    mutationFn: (data: FormData) =>
      api<{ message: string }>("/auth/reset-password", {
        method: "POST",
        body: JSON.stringify({ token, password: data.password }),
        auth: false
      })
  });

  if (!token) {
    return (
      <AuthCard>
        <div className="text-center mb-7 sm:mb-8">
          <h2 className="text-2xl sm:text-[26px] font-bold text-white tracking-tight">
            Link inválido
          </h2>
          <p className="mt-2 text-xs sm:text-sm text-[#A99EC0]">
            Solicite um novo link para redefinir sua senha.
          </p>
        </div>
        <PrimaryAuthLink href="/forgot-password">Solicitar novo link</PrimaryAuthLink>
      </AuthCard>
    );
  }

  if (mutation.isSuccess) {
    return (
      <AuthCard>
        <div className="text-center mb-7 sm:mb-8">
          <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-2xl border border-purple-400/30 bg-purple-500/15">
            <CheckCircle2 className="h-6 w-6 text-purple-200" />
          </div>
          <h2 className="text-2xl sm:text-[26px] font-bold text-white tracking-tight">
            Senha atualizada
          </h2>
          <p className="mt-2 text-xs sm:text-sm text-[#A99EC0]">
            Use sua nova senha para entrar na conta.
          </p>
        </div>
        <PrimaryAuthLink href="/login">Entrar</PrimaryAuthLink>
      </AuthCard>
    );
  }

  return (
    <AuthCard>
      <div className="text-center mb-7 sm:mb-8">
        <h2 className="text-2xl sm:text-[26px] font-bold text-white tracking-tight">
          Redefinir senha
        </h2>
        <p className="mt-2 text-xs sm:text-sm text-[#A99EC0]">
          Informe uma nova senha para sua conta.
        </p>
      </div>

      <form
        className="space-y-4 sm:space-y-5"
        onSubmit={form.handleSubmit((data) => mutation.mutate(data))}
      >
        <PasswordField
          id="password"
          label="Nova senha"
          placeholder="Mínimo 8 caracteres"
          visible={showPassword}
          onToggle={() => setShowPassword((value) => !value)}
          error={form.formState.errors.password?.message}
          register={form.register("password")}
        />

        <PasswordField
          id="confirmPassword"
          label="Confirmar senha"
          placeholder="Repita a nova senha"
          visible={showConfirmation}
          onToggle={() => setShowConfirmation((value) => !value)}
          error={form.formState.errors.confirmPassword?.message}
          register={form.register("confirmPassword")}
        />

        {mutation.error && (
          <div className="rounded-xl bg-rose-500/10 border border-rose-500/30 p-3 text-center">
            <p className="text-xs text-rose-300">
              {mutation.error.message}
            </p>
          </div>
        )}

        <button
          type="submit"
          disabled={mutation.isPending}
          className="w-full h-[52px] rounded-xl text-white font-semibold text-sm flex items-center justify-center gap-2 shadow-[0_4px_22px_rgba(116,60,255,0.4)] hover:brightness-110 hover:-translate-y-[1px] active:translate-y-0 disabled:opacity-60 disabled:pointer-events-none transition-all mt-2"
          style={{ background: "linear-gradient(90deg, #743CFF 0%, #6247FF 48%, #C084FC 100%)" }}
        >
          {mutation.isPending ? (
            <Loader2 className="w-4 h-4 animate-spin" />
          ) : (
            <>
              <span>Atualizar senha</span>
              <ArrowRight className="w-4 h-4" />
            </>
          )}
        </button>
      </form>
    </AuthCard>
  );
}

function PasswordField({
  id,
  label,
  placeholder,
  visible,
  onToggle,
  error,
  register
}: {
  id: string;
  label: string;
  placeholder: string;
  visible: boolean;
  onToggle: () => void;
  error?: string;
  register: UseFormRegisterReturn;
}) {
  return (
    <div className="space-y-1.5">
      <label htmlFor={id} className="block text-xs font-semibold text-[#D4CAE8]">
        {label}
      </label>
      <div className="relative">
        <Lock className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-[#8E82A8]" />
        <input
          id={id}
          type={visible ? "text" : "password"}
          autoComplete="new-password"
          placeholder={placeholder}
          className="w-full h-[50px] rounded-xl bg-[#0D081F]/70 border border-purple-400/20 pl-10 pr-10 text-sm text-white placeholder:text-[#6D6288] focus:border-[#8C62FF] focus:ring-1 focus:ring-[#8C62FF]/40 outline-none transition-all"
          {...register}
        />
        <button
          type="button"
          onClick={onToggle}
          className="absolute right-3.5 top-1/2 -translate-y-1/2 text-[#8E82A8] hover:text-white transition-colors"
          aria-label={visible ? "Ocultar senha" : "Ver senha"}
        >
          {visible ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
        </button>
      </div>
      {error && (
        <p className="text-xs text-rose-400 mt-1">
          {error}
        </p>
      )}
    </div>
  );
}

function ResetPasswordFallback() {
  return (
    <AuthCard>
      <div className="h-[320px] animate-pulse rounded-2xl bg-[#0D081F]/60 border border-purple-400/15" />
    </AuthCard>
  );
}

export default function ResetPasswordPage() {
  return (
    <Suspense fallback={<ResetPasswordFallback />}>
      <ResetPasswordForm />
    </Suspense>
  );
}

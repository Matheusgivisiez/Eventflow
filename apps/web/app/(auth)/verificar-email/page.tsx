"use client";

import { Suspense, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useMutation } from "@tanstack/react-query";
import { AlertCircle, ArrowRight, CheckCircle2, Loader2, Mail } from "lucide-react";
import { api } from "@/lib/api";
import { useAuthStore } from "@/stores/auth-store";

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

function VerifyEmailContent() {
  const searchParams = useSearchParams();
  const token = searchParams.get("token");
  const updateUser = useAuthStore((state) => state.updateUser);
  const sessionEmail = useAuthStore((state) => state.user?.email);
  const [resendEmail, setResendEmail] = useState("");
  const requested = useRef(false);

  const verify = useMutation({
    mutationFn: (value: string) =>
      api<{ message: string; email: string }>("/auth/verify-email", {
        method: "POST",
        body: JSON.stringify({ token: value }),
        auth: false
      }),
    onSuccess: () => updateUser({ emailVerified: true })
  });

  const resend = useMutation({
    mutationFn: (email: string) =>
      api<{ message: string }>("/auth/resend-verification", {
        method: "POST",
        body: JSON.stringify({ email }),
        auth: false
      })
  });

  // The link is single use: fire it exactly once, even under React strict mode.
  useEffect(() => {
    if (!token || requested.current) return;
    requested.current = true;
    verify.mutate(token);
  }, [token, verify]);

  useEffect(() => {
    if (sessionEmail) setResendEmail(sessionEmail);
  }, [sessionEmail]);

  if (verify.isSuccess) {
    return (
      <AuthCard>
        <div className="text-center mb-7 sm:mb-8">
          <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-2xl border border-purple-400/30 bg-purple-500/15">
            <CheckCircle2 className="h-6 w-6 text-purple-200" />
          </div>
          <h2 className="text-2xl sm:text-[26px] font-bold text-white tracking-tight">
            E-mail confirmado
          </h2>
          <p className="mt-2 text-xs sm:text-sm text-[#A99EC0]">
            Suas compras feitas com {verify.data.email} já aparecem em Meus Ingressos.
          </p>
        </div>
        <PrimaryAuthLink href="/me/ingressos">Ver meus ingressos</PrimaryAuthLink>
      </AuthCard>
    );
  }

  if (token && verify.isPending) {
    return (
      <AuthCard>
        <div className="flex flex-col items-center gap-4 py-10">
          <Loader2 className="h-6 w-6 animate-spin text-purple-200" />
          <p className="text-sm text-[#A99EC0]">Confirmando seu e-mail...</p>
        </div>
      </AuthCard>
    );
  }

  return (
    <AuthCard>
      <div className="text-center mb-7 sm:mb-8">
        <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-2xl border border-purple-400/30 bg-purple-500/15">
          {token ? (
            <AlertCircle className="h-6 w-6 text-rose-300" />
          ) : (
            <Mail className="h-6 w-6 text-purple-200" />
          )}
        </div>
        <h2 className="text-2xl sm:text-[26px] font-bold text-white tracking-tight">
          {token ? "Link expirado ou inválido" : "Confirme seu e-mail"}
        </h2>
        <p className="mt-2 text-xs sm:text-sm text-[#A99EC0]">
          {token
            ? "Este link já foi usado ou passou de 30 minutos. Peça um novo abaixo."
            : "Informe seu e-mail para receber um novo link de confirmação."}
        </p>
      </div>

      {resend.isSuccess ? (
        <div className="rounded-xl bg-purple-500/10 border border-purple-400/30 p-4 text-center">
          <p className="text-xs text-[#D4CAE8]">{resend.data.message}</p>
        </div>
      ) : (
        <form
          className="space-y-4"
          onSubmit={(formEvent) => {
            formEvent.preventDefault();
            if (resendEmail) resend.mutate(resendEmail);
          }}
        >
          <div className="space-y-1.5">
            <label htmlFor="email" className="block text-xs font-semibold text-[#D4CAE8]">
              E-mail da conta
            </label>
            <div className="relative">
              <Mail className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-[#8E82A8]" />
              <input
                id="email"
                type="email"
                required
                autoComplete="email"
                value={resendEmail}
                onChange={(inputEvent) => setResendEmail(inputEvent.target.value)}
                placeholder="voce@email.com"
                className="w-full h-[50px] rounded-xl bg-[#0D081F]/70 border border-purple-400/20 pl-10 pr-4 text-sm text-white placeholder:text-[#6D6288] focus:border-[#8C62FF] focus:ring-1 focus:ring-[#8C62FF]/40 outline-none transition-all"
              />
            </div>
          </div>

          {resend.error && (
            <div className="rounded-xl bg-rose-500/10 border border-rose-500/30 p-3 text-center">
              <p className="text-xs text-rose-300">{resend.error.message}</p>
            </div>
          )}

          <button
            type="submit"
            disabled={resend.isPending}
            className="w-full h-[52px] rounded-xl text-white font-semibold text-sm flex items-center justify-center gap-2 shadow-[0_4px_22px_rgba(116,60,255,0.4)] hover:brightness-110 hover:-translate-y-[1px] active:translate-y-0 disabled:opacity-60 disabled:pointer-events-none transition-all"
            style={{ background: "linear-gradient(90deg, #743CFF 0%, #6247FF 48%, #C084FC 100%)" }}
          >
            {resend.isPending ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <>
                <span>Enviar novo link</span>
                <ArrowRight className="w-4 h-4" />
              </>
            )}
          </button>
        </form>
      )}
    </AuthCard>
  );
}

function VerifyEmailFallback() {
  return (
    <AuthCard>
      <div className="h-[320px] animate-pulse rounded-2xl bg-[#0D081F]/60 border border-purple-400/15" />
    </AuthCard>
  );
}

export default function VerifyEmailPage() {
  return (
    <Suspense fallback={<VerifyEmailFallback />}>
      <VerifyEmailContent />
    </Suspense>
  );
}

"use client";

import { Suspense } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation } from "@tanstack/react-query";
import { CheckCircle2, Loader2 } from "lucide-react";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { api } from "@/lib/api";

const schema = z.object({
  password: z.string().min(8, "A senha deve ter pelo menos 8 caracteres."),
  confirmPassword: z.string().min(8, "Confirme sua nova senha.")
}).refine((data) => data.password === data.confirmPassword, {
  message: "As senhas nao conferem.",
  path: ["confirmPassword"]
});

type FormData = z.infer<typeof schema>;

function ResetPasswordForm() {
  const searchParams = useSearchParams();
  const token = searchParams.get("token");
  const form = useForm<FormData>({ resolver: zodResolver(schema), defaultValues: { password: "", confirmPassword: "" } });
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
      <Card className="w-full max-w-md">
        <CardHeader>
          <CardTitle>Link invalido</CardTitle>
          <CardDescription>Solicite um novo link para redefinir sua senha.</CardDescription>
        </CardHeader>
        <CardContent>
          <Button asChild className="w-full">
            <Link href="/forgot-password">Solicitar novo link</Link>
          </Button>
        </CardContent>
      </Card>
    );
  }

  if (mutation.isSuccess) {
    return (
      <Card className="w-full max-w-md">
        <CardHeader>
          <CheckCircle2 className="h-10 w-10 text-primary" />
          <CardTitle>Senha atualizada</CardTitle>
          <CardDescription>Use sua nova senha para entrar na conta.</CardDescription>
        </CardHeader>
        <CardContent>
          <Button asChild className="w-full">
            <Link href="/login">Entrar</Link>
          </Button>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="w-full max-w-md">
      <CardHeader>
        <CardTitle>Redefinir senha</CardTitle>
        <CardDescription>Informe uma nova senha para sua conta.</CardDescription>
      </CardHeader>
      <CardContent>
        <form className="space-y-4" onSubmit={form.handleSubmit((data) => mutation.mutate(data))}>
          <div className="space-y-2">
            <Label>Nova senha</Label>
            <Input type="password" {...form.register("password")} />
            {form.formState.errors.password && <p className="text-sm text-destructive">{form.formState.errors.password.message}</p>}
          </div>
          <div className="space-y-2">
            <Label>Confirmar senha</Label>
            <Input type="password" {...form.register("confirmPassword")} />
            {form.formState.errors.confirmPassword && <p className="text-sm text-destructive">{form.formState.errors.confirmPassword.message}</p>}
          </div>
          <Button className="w-full" disabled={mutation.isPending}>
            {mutation.isPending && <Loader2 className="h-4 w-4 animate-spin" />}
            Atualizar senha
          </Button>
          {mutation.error && (
            <p className="rounded-md bg-destructive/10 p-3 text-sm text-destructive">
              {mutation.error.message}
            </p>
          )}
        </form>
      </CardContent>
    </Card>
  );
}

export default function ResetPasswordPage() {
  return (
    <Suspense fallback={<Skeleton className="h-[360px] w-full max-w-md" />}>
      <ResetPasswordForm />
    </Suspense>
  );
}

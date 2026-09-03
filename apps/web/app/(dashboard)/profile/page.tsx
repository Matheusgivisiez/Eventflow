"use client";

import { useMutation } from "@tanstack/react-query";
import { Building2, Lock } from "lucide-react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ImageUpload } from "@/components/image-upload";
import { api } from "@/lib/api";
import { useAuthStore } from "@/stores/auth-store";

const profileSchema = z.object({ name: z.string().trim().min(2, "Informe seu nome."), email: z.string().trim().email("Informe um e-mail válido."), phone: z.string().optional(), companyName: z.string().optional(), logoUrl: z.string().optional() });
const passwordSchema = z.object({ currentPassword: z.string().min(1, "Informe sua senha atual."), newPassword: z.string().min(8, "A nova senha deve ter pelo menos 8 caracteres.") });
type ProfileForm = z.infer<typeof profileSchema>;
type PasswordForm = z.infer<typeof passwordSchema>;

export default function ProfilePage() {
  const user = useAuthStore((state) => state.user);
  const form = useForm<ProfileForm>({ resolver: zodResolver(profileSchema), defaultValues: { name: user?.name ?? "", email: user?.email ?? "", phone: "", companyName: "", logoUrl: "" } });
  const passwordForm = useForm<PasswordForm>({ resolver: zodResolver(passwordSchema), defaultValues: { currentPassword: "", newPassword: "" } });
  const mutation = useMutation({ mutationFn: (data: ProfileForm) => api("/profile", { method: "PATCH", body: JSON.stringify(data) }) });
  const passwordMutation = useMutation({ mutationFn: (data: PasswordForm) => api("/profile/password", { method: "PATCH", body: JSON.stringify(data) }), onSuccess: () => passwordForm.reset() });

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-normal">Perfil</h1>
        <p className="text-sm text-muted-foreground">Edite dados pessoais, empresa, logo e senha.</p>
      </div>
      <form className="grid gap-6 lg:grid-cols-2" onSubmit={form.handleSubmit((data) => mutation.mutate(data))}>
        <Card>
          <CardHeader>
            <CardTitle>Dados da conta</CardTitle>
          </CardHeader>
          <CardContent className="grid gap-4">
            <Field label="Nome" error={form.formState.errors.name?.message}><Input {...form.register("name")} /></Field>
            <Field label="E-mail" error={form.formState.errors.email?.message}><Input type="email" {...form.register("email")} /></Field>
            <Field label="Telefone" error={form.formState.errors.phone?.message}><Input {...form.register("phone")} /></Field>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <Building2 className="h-5 w-5 text-primary" />
            <CardTitle>Empresa</CardTitle>
          </CardHeader>
          <CardContent className="grid gap-4">
            <Field label="Nome da empresa"><Input {...form.register("companyName")} /></Field>
            <Field label="Logo">
              <ImageUpload aspect={1} value={form.watch("logoUrl")} onChange={(url) => form.setValue("logoUrl", url ?? "")} />
            </Field>
            <Button>Salvar perfil</Button>
            {mutation.error && <p className="text-sm text-destructive">{mutation.error.message}</p>}
            {mutation.isSuccess && <p className="text-sm text-primary">Perfil atualizado.</p>}
          </CardContent>
        </Card>
      </form>
      <Card>
        <CardHeader><Lock className="h-5 w-5 text-primary" /><CardTitle>Segurança</CardTitle></CardHeader>
        <CardContent>
          <form className="grid gap-4 sm:grid-cols-2" onSubmit={passwordForm.handleSubmit((data) => passwordMutation.mutate(data))}>
            <Field label="Senha atual" error={passwordForm.formState.errors.currentPassword?.message}><Input type="password" {...passwordForm.register("currentPassword")} /></Field>
            <Field label="Nova senha" error={passwordForm.formState.errors.newPassword?.message}><Input type="password" {...passwordForm.register("newPassword")} /></Field>
            <div className="sm:col-span-2"><Button type="submit" disabled={passwordMutation.isPending}>Alterar senha</Button>{passwordMutation.error && <p className="mt-2 text-sm text-destructive">{passwordMutation.error.message}</p>}{passwordMutation.isSuccess && <p className="mt-2 text-sm text-primary">Senha alterada com sucesso.</p>}</div>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}

function Field({ label, error, children }: { label: string; error?: string; children: React.ReactNode }) {
  return (
    <div className="space-y-2">
      <Label>{label}</Label>
      {children}
      {error && <p className="text-sm text-destructive">{error}</p>}
    </div>
  );
}

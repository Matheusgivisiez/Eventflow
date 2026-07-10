"use client";

import { useMutation } from "@tanstack/react-query";
import { Building2 } from "lucide-react";
import { useForm } from "react-hook-form";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ImageUpload } from "@/components/image-upload";
import { api } from "@/lib/api";
import { useAuthStore } from "@/stores/auth-store";

type ProfileForm = { name: string; email: string; phone?: string; companyName?: string; logoUrl?: string };

export default function ProfilePage() {
  const user = useAuthStore((state) => state.user);
  const form = useForm<ProfileForm>({ defaultValues: { name: user?.name, email: user?.email } });
  const mutation = useMutation({ mutationFn: (data: ProfileForm) => api("/profile", { method: "PATCH", body: JSON.stringify(data) }) });

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
            <Field label="Nome"><Input {...form.register("name")} /></Field>
            <Field label="E-mail"><Input type="email" {...form.register("email")} /></Field>
            <Field label="Telefone"><Input {...form.register("phone")} /></Field>
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
              <ImageUpload value={form.watch("logoUrl")} onChange={(url) => form.setValue("logoUrl", url ?? "")} />
            </Field>
            <Button>Salvar perfil</Button>
            {mutation.error && <p className="text-sm text-destructive">{mutation.error.message}</p>}
            {mutation.isSuccess && <p className="text-sm text-primary">Perfil atualizado.</p>}
          </CardContent>
        </Card>
      </form>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="space-y-2">
      <Label>{label}</Label>
      {children}
    </div>
  );
}

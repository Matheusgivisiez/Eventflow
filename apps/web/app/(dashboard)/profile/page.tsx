"use client";

import { useEffect } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Building2, Lock, Loader2 } from "lucide-react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ImageUpload } from "@/components/image-upload";
import { api } from "@/lib/api";
import { formatBrazilPhone, normalizeBrazilPhone } from "@/lib/br-format";
import { useAuthStore } from "@/stores/auth-store";

const profileSchema = z.object({
  name: z.string().trim().min(2, "Informe seu nome."),
  email: z.string().trim().email("Informe um e-mail válido."),
  phone: z.string().optional(),
  companyName: z.string().optional(),
  logoUrl: z.string().optional()
});

const passwordSchema = z.object({
  currentPassword: z.string().min(1, "Informe sua senha atual."),
  newPassword: z.string().min(8, "A nova senha deve ter pelo menos 8 caracteres.")
});

type ProfileForm = z.infer<typeof profileSchema>;
type PasswordForm = z.infer<typeof passwordSchema>;

type ProfileResponse = {
  id: string;
  name: string;
  email: string;
  phone?: string;
  tenantId?: string;
  companyName?: string;
  logoUrl?: string;
  tenant?: {
    id: string;
    name: string;
    logoUrl?: string | null;
  };
};

export default function ProfilePage() {
  const user = useAuthStore((state) => state.user);
  const updateUser = useAuthStore((state) => state.updateUser);
  const queryClient = useQueryClient();

  const { data: profile, isLoading } = useQuery<ProfileResponse>({
    queryKey: ["profile"],
    queryFn: () => api<ProfileResponse>("/auth/me")
  });

  const form = useForm<ProfileForm>({
    resolver: zodResolver(profileSchema),
    defaultValues: {
      name: user?.name ?? "",
      email: user?.email ?? "",
      phone: user?.phone ? formatBrazilPhone(user.phone) : "",
      companyName: "",
      logoUrl: ""
    }
  });

  const passwordForm = useForm<PasswordForm>({
    resolver: zodResolver(passwordSchema),
    defaultValues: { currentPassword: "", newPassword: "" }
  });

  useEffect(() => {
    if (!profile) return;
    form.reset({
      name: profile.name ?? "",
      email: profile.email ?? "",
      phone: profile.phone ? formatBrazilPhone(profile.phone) : "",
      companyName: profile.tenant?.name ?? profile.companyName ?? "",
      logoUrl: profile.tenant?.logoUrl ?? profile.logoUrl ?? ""
    });
  }, [profile, form]);

  const mutation = useMutation({
    mutationFn: (data: ProfileForm) =>
      api("/profile", {
        method: "PATCH",
        body: JSON.stringify({
          ...data,
          phone: data.phone ? normalizeBrazilPhone(data.phone) : data.phone
        })
      }),
    onSuccess: (updated: any) => {
      queryClient.invalidateQueries({ queryKey: ["profile"] });
      if (updated) {
        updateUser({
          name: updated.name,
          email: updated.email,
          phone: updated.phone
        });
      }
    }
  });

  const passwordMutation = useMutation({
    mutationFn: (data: PasswordForm) =>
      api("/profile/password", {
        method: "PATCH",
        body: JSON.stringify(data)
      }),
    onSuccess: () => passwordForm.reset()
  });

  const currentLogoUrl = form.watch("logoUrl");
  const currentCompanyName = form.watch("companyName");

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-normal">Perfil</h1>
        <p className="text-sm text-muted-foreground">
          Edite dados pessoais, dados da empresa organizadora, logotipo e senha de acesso.
        </p>
      </div>

      <form className="grid gap-6 lg:grid-cols-2" onSubmit={form.handleSubmit((data) => mutation.mutate(data))}>
        <Card>
          <CardHeader>
            <CardTitle>Dados da conta</CardTitle>
            <CardDescription>Informações do responsável pela conta</CardDescription>
          </CardHeader>
          <CardContent className="grid gap-4">
            <Field label="Nome" error={form.formState.errors.name?.message}>
              <Input {...form.register("name")} placeholder="Seu nome completo" />
            </Field>
            <Field label="E-mail" error={form.formState.errors.email?.message}>
              <Input type="email" {...form.register("email")} placeholder="seu@email.com" />
            </Field>
            <Field label="Telefone" error={form.formState.errors.phone?.message}>
              <Input
                inputMode="tel"
                autoComplete="tel"
                placeholder="+55 (33) 99999-9999"
                {...form.register("phone", {
                  onChange: (event) => {
                    event.target.value = formatBrazilPhone(event.target.value);
                  }
                })}
              />
            </Field>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <div className="flex items-center gap-2">
              <Building2 className="h-5 w-5 text-primary" />
              <CardTitle>Empresa Organizadora</CardTitle>
            </div>
            <CardDescription>
              Nome e logotipo exibidos na seção &ldquo;Organizado por&rdquo; em todos os seus eventos públicos.
            </CardDescription>
          </CardHeader>
          <CardContent className="grid gap-4">
            <Field label="Nome da empresa ou produtora" error={form.formState.errors.companyName?.message}>
              <Input
                {...form.register("companyName")}
                placeholder="Ex: Kosmo Produções, Xcorp Eventos..."
              />
            </Field>

            <div className="space-y-2">
              <Label>Logotipo da Empresa</Label>
              <p className="text-xs text-muted-foreground">
                Imagem quadrada recomendada (1:1). Será exibida no rodapé dos seus eventos.
              </p>
              <ImageUpload
                aspect={1}
                value={currentLogoUrl}
                onChange={(url) => form.setValue("logoUrl", url ?? "", { shouldDirty: true })}
              />
            </div>

            {/* Pré-visualização do Organizador */}
            {(currentCompanyName || currentLogoUrl) && (
              <div className="mt-2 rounded-xl border border-border/50 bg-muted/20 p-4">
                <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                  Pré-visualização no evento:
                </span>
                <div className="mt-2 flex items-center gap-3.5">
                  <div className="relative flex h-12 w-12 shrink-0 items-center justify-center overflow-hidden rounded-xl border border-border/50 bg-card">
                    {currentLogoUrl ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={currentLogoUrl}
                        alt={currentCompanyName || "Logo"}
                        className="h-full w-full object-cover"
                      />
                    ) : (
                      <Building2 className="h-6 w-6 text-primary" />
                    )}
                  </div>
                  <div className="min-w-0">
                    <p className="text-xs font-medium text-muted-foreground">Organizado por</p>
                    <p className="truncate font-semibold text-foreground">
                      {currentCompanyName || "Nome da Empresa"}
                    </p>
                  </div>
                </div>
              </div>
            )}

            <Button type="submit" disabled={mutation.isPending || isLoading}>
              {mutation.isPending ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Salvando...
                </>
              ) : (
                "Salvar perfil"
              )}
            </Button>
            {mutation.error && <p className="text-sm text-destructive">{mutation.error.message}</p>}
            {mutation.isSuccess && <p className="text-sm font-medium text-emerald-500">Perfil e logotipo atualizados com sucesso.</p>}
          </CardContent>
        </Card>
      </form>

      <Card>
        <CardHeader>
          <div className="flex items-center gap-2">
            <Lock className="h-5 w-5 text-primary" />
            <CardTitle>Segurança</CardTitle>
          </div>
          <CardDescription>Altere sua senha de acesso</CardDescription>
        </CardHeader>
        <CardContent>
          <form className="grid gap-4 sm:grid-cols-2" onSubmit={passwordForm.handleSubmit((data) => passwordMutation.mutate(data))}>
            <Field label="Senha atual" error={passwordForm.formState.errors.currentPassword?.message}>
              <Input type="password" {...passwordForm.register("currentPassword")} />
            </Field>
            <Field label="Nova senha" error={passwordForm.formState.errors.newPassword?.message}>
              <Input type="password" {...passwordForm.register("newPassword")} />
            </Field>
            <div className="sm:col-span-2">
              <Button type="submit" disabled={passwordMutation.isPending}>
                {passwordMutation.isPending ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Alterando...
                  </>
                ) : (
                  "Alterar senha"
                )}
              </Button>
              {passwordMutation.error && <p className="mt-2 text-sm text-destructive">{passwordMutation.error.message}</p>}
              {passwordMutation.isSuccess && <p className="mt-2 text-sm font-medium text-emerald-500">Senha alterada com sucesso.</p>}
            </div>
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

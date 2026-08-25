"use client";

import { useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Landmark, Instagram, MapPin, CheckCircle2, Loader2, User } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { api } from "@/lib/api";

const profileSchema = z.object({
  pixKey: z.string().optional(),
  instagram: z.string().optional(),
  city: z.string().optional(),
  state: z.string().max(2, "Use a sigla do estado (ex: SP)").optional(),
});

type ProfileForm = z.infer<typeof profileSchema>;

export default function PromoterSettingsPage() {
  const qc = useQueryClient();

  const { data: profile, isLoading } = useQuery<any>({
    queryKey: ["promoter-profile"],
    queryFn: () => api("/promoter-portal/profile")
  });

  const form = useForm<ProfileForm>({
    resolver: zodResolver(profileSchema),
    defaultValues: { pixKey: "", instagram: "", city: "", state: "" }
  });

  // Populate form when profile loads
  useEffect(() => {
    if (profile) {
      form.reset({
        pixKey: profile.pixKey ?? "",
        instagram: profile.instagram ?? "",
        city: profile.city ?? "",
        state: profile.state ?? "",
      });
    }
  }, [profile, form]);

  const mutation = useMutation({
    mutationFn: (data: ProfileForm) =>
      api("/promoter-portal/profile", { method: "PATCH", body: JSON.stringify(data) }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["promoter-profile"] });
      qc.invalidateQueries({ queryKey: ["promoter-dashboard"] });
    }
  });

  if (isLoading) return <Skeleton className="h-96 w-full rounded-xl" />;

  const saved = mutation.isSuccess;

  return (
    <div className="space-y-8 max-w-2xl">
      <div>
        <h1 className="text-3xl font-extrabold tracking-tight">Minha Conta</h1>
        <p className="text-muted-foreground mt-1">Gerencie seu perfil e chave PIX para receber seus ganhos.</p>
      </div>

      {/* Info card */}
      <Card className="border-primary/20 bg-primary/5">
        <CardContent className="p-5 flex items-center gap-4">
          <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-primary text-primary-foreground font-bold text-lg">
            {profile?.user?.name?.charAt(0)?.toUpperCase() ?? "P"}
          </div>
          <div>
            <p className="font-bold">{profile?.user?.name}</p>
            <p className="text-sm text-muted-foreground">{profile?.user?.email}</p>
            {profile?.user?.phone && <p className="text-xs text-muted-foreground">{profile.user.phone}</p>}
          </div>
        </CardContent>
      </Card>

      <form onSubmit={form.handleSubmit((data) => mutation.mutate(data))}>
        <Card className="shadow-sm">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Landmark className="h-5 w-5 text-primary" />
              Dados Financeiros
            </CardTitle>
            <CardDescription>
              Sua chave PIX é obrigatória para solicitar saques de comissões.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="pixKey">Chave PIX</Label>
              <Input
                id="pixKey"
                placeholder="CPF, e-mail, telefone ou chave aleatória"
                {...form.register("pixKey")}
              />
              <p className="text-xs text-muted-foreground">
                Os saques serão transferidos exclusivamente para esta chave.
              </p>
            </div>
          </CardContent>

          <CardHeader className="pt-0">
            <CardTitle className="flex items-center gap-2 text-base">
              <User className="h-4 w-4 text-primary" />
              Perfil Público
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="instagram" className="flex items-center gap-2">
                <Instagram className="h-4 w-4" /> Instagram
              </Label>
              <Input
                id="instagram"
                placeholder="@seuperfil"
                {...form.register("instagram")}
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="city" className="flex items-center gap-2">
                  <MapPin className="h-4 w-4" /> Cidade
                </Label>
                <Input id="city" placeholder="São Paulo" {...form.register("city")} />
              </div>
              <div className="space-y-2">
                <Label htmlFor="state">Estado</Label>
                <Input id="state" placeholder="SP" maxLength={2} {...form.register("state")} />
              </div>
            </div>
          </CardContent>

          <CardFooter className="flex items-center gap-3 border-t pt-4">
            <Button type="submit" disabled={mutation.isPending} className="gap-2">
              {mutation.isPending
                ? <><Loader2 className="h-4 w-4 animate-spin" /> Salvando...</>
                : saved
                  ? <><CheckCircle2 className="h-4 w-4" /> Salvo!</>
                  : "Salvar alterações"}
            </Button>
            {mutation.isError && (
              <p className="text-sm text-destructive">Erro ao salvar. Tente novamente.</p>
            )}
          </CardFooter>
        </Card>
      </form>
    </div>
  );
}

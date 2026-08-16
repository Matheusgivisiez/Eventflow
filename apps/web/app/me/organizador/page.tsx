"use client";

import { useRouter } from "next/navigation";
import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation } from "@tanstack/react-query";
import { Loader2, ShieldCheck, Building2 } from "lucide-react";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { api } from "@/lib/api";
import { useAuthStore } from "@/stores/auth-store";

const schema = z.object({
  companyName: z.string().min(2, "O nome da empresa deve ter pelo menos 2 caracteres.")
});

type FormData = z.infer<typeof schema>;

export default function BecomeOrganizerPage() {
  const router = useRouter();
  const setSession = useAuthStore((state) => state.setSession);
  const form = useForm<FormData>({ resolver: zodResolver(schema), defaultValues: { companyName: "" } });

  const mutation = useMutation({
    mutationFn: (data: FormData) =>
      api<{ accessToken: string; user: any }>("/auth/become-organizer", {
        method: "POST",
        body: JSON.stringify(data)
      }),
    onSuccess: (session) => {
      setSession(session);
      router.push("/dashboard");
    }
  });

  return (
    <div className="mx-auto max-w-lg px-5 py-12">
      <Card className="border-primary/20 shadow-md">
        <CardHeader className="text-center pb-8 border-b bg-primary/5">
          <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-primary/10 text-primary">
            <ShieldCheck className="h-6 w-6" />
          </div>
          <CardTitle className="text-2xl font-bold">Quero Organizar Eventos</CardTitle>
          <CardDescription className="max-w-xs mx-auto mt-2">
            Transforme sua conta de cliente em uma conta de organizador e publique seus proprios eventos.
          </CardDescription>
        </CardHeader>
        <CardContent className="pt-8">
          <form className="space-y-6" onSubmit={form.handleSubmit((data) => mutation.mutate(data))}>
            <div className="space-y-2">
              <Label htmlFor="companyName" className="flex items-center gap-2">
                <Building2 className="h-4 w-4 text-muted-foreground" />
                Nome da Empresa ou Marca
              </Label>
              <Input
                id="companyName"
                placeholder="Ex: Minha Produtora de Eventos"
                {...form.register("companyName")}
                className="mt-1"
              />
              {form.formState.errors.companyName && (
                <p className="text-sm text-destructive mt-1">{form.formState.errors.companyName.message}</p>
              )}
            </div>

            {mutation.error && (
              <div className="rounded-md bg-destructive/10 p-3 text-sm text-destructive text-center">
                {mutation.error.message}
              </div>
            )}

            <Button className="w-full h-11 text-base font-semibold" disabled={mutation.isPending}>
              {mutation.isPending && <Loader2 className="mr-2 h-5 w-5 animate-spin" />}
              Ativar Modo Organizador
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}

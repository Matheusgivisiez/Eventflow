"use client";

import { useMutation, useQuery } from "@tanstack/react-query";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { Loader2 } from "lucide-react";
import { api } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useAuthStore } from "@/stores/auth-store";

const accountSchema = z.object({
  name: z.string().min(2, "Nome deve ter no mínimo 2 caracteres"),
  email: z.string().email("Email inválido"),
  phone: z.string().optional(),
});

type AccountFormValues = z.infer<typeof accountSchema>;

export default function AccountPage() {
  const { user, updateUser } = useAuthStore();
  const token = useAuthStore(s => s.accessToken);

  const form = useForm<AccountFormValues>({
    resolver: zodResolver(accountSchema),
    defaultValues: {
      name: user?.name || "",
      email: user?.email || "",
      phone: user?.phone || "",
    },
  });

  const mutation = useMutation({
    mutationFn: (data: AccountFormValues) =>
      api<any>("/users/me", {
        method: "PATCH",
        body: JSON.stringify(data),
      }),
    onSuccess: (updatedUser) => {
      updateUser({
        name: updatedUser.name,
        email: updatedUser.email,
        phone: updatedUser.phone,
      });
    },
  });

  return (
    <div className="max-w-2xl bg-white dark:bg-card border rounded-2xl p-6 shadow-sm">
      <h2 className="text-xl font-bold mb-6">Informações Pessoais</h2>
      
      <form onSubmit={form.handleSubmit((d) => mutation.mutate(d))} className="space-y-6">
        <div className="space-y-2">
          <Label htmlFor="name">Nome completo</Label>
          <Input id="name" {...form.register("name")} />
          {form.formState.errors.name && (
            <p className="text-sm text-destructive">{form.formState.errors.name.message}</p>
          )}
        </div>

        <div className="space-y-2">
          <Label htmlFor="email">E-mail</Label>
          <Input id="email" type="email" {...form.register("email")} />
          {form.formState.errors.email && (
            <p className="text-sm text-destructive">{form.formState.errors.email.message}</p>
          )}
        </div>

        <div className="space-y-2">
          <Label htmlFor="phone">Telefone (opcional)</Label>
          <Input id="phone" {...form.register("phone")} placeholder="(00) 00000-0000" />
          {form.formState.errors.phone && (
            <p className="text-sm text-destructive">{form.formState.errors.phone.message}</p>
          )}
        </div>

        {mutation.isSuccess && (
          <div className="p-3 bg-green-50 text-green-700 dark:bg-green-500/10 dark:text-green-400 rounded-lg text-sm">
            Conta atualizada com sucesso!
          </div>
        )}

        {mutation.isError && (
          <div className="p-3 bg-red-50 text-red-700 dark:bg-red-500/10 dark:text-red-400 rounded-lg text-sm">
            Erro ao atualizar a conta. Tente novamente.
          </div>
        )}

        <Button type="submit" disabled={mutation.isPending} className="w-full sm:w-auto min-w-[150px] rounded-xl">
          {mutation.isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
          Salvar alterações
        </Button>
      </form>
    </div>
  );
}

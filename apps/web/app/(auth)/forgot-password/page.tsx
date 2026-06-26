"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation } from "@tanstack/react-query";
import { Loader2 } from "lucide-react";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { api } from "@/lib/api";

const schema = z.object({ email: z.string().email("Informe um e-mail valido.") });

export default function ForgotPasswordPage() {
  const form = useForm<z.infer<typeof schema>>({ resolver: zodResolver(schema), defaultValues: { email: "" } });
  const mutation = useMutation({
    mutationFn: (data: z.infer<typeof schema>) =>
      api<{ message: string; resetToken?: string }>("/auth/forgot-password", {
        method: "POST",
        body: JSON.stringify(data),
        auth: false
      })
  });

  return (
    <Card className="w-full max-w-md">
      <CardHeader>
        <CardTitle>Recuperar senha</CardTitle>
        <CardDescription>Enviaremos as instrucoes para seu e-mail.</CardDescription>
      </CardHeader>
      <CardContent>
        <form className="space-y-4" onSubmit={form.handleSubmit((data) => mutation.mutate(data))}>
          <div className="space-y-2">
            <Label>E-mail</Label>
            <Input type="email" {...form.register("email")} />
            {form.formState.errors.email && <p className="text-sm text-destructive">{form.formState.errors.email.message}</p>}
          </div>
          <Button className="w-full" disabled={mutation.isPending}>
            {mutation.isPending && <Loader2 className="h-4 w-4 animate-spin" />}
            Enviar instrucoes
          </Button>
          {mutation.data && (
            <p className="rounded-md bg-muted p-3 text-sm text-muted-foreground">
              {mutation.data.message}
              {mutation.data.resetToken ? ` Token local: ${mutation.data.resetToken}` : ""}
            </p>
          )}
        </form>
      </CardContent>
    </Card>
  );
}

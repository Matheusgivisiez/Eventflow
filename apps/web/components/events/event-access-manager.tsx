"use client";

import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Loader2, Shield, UserMinus, UserPlus } from "lucide-react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { api } from "@/lib/api";

type AccessRole = "GESTOR" | "EDITOR" | "OPERACAO";
type Member = { id: string; name: string; email: string };
type Assignment = { userId: string; role: AccessRole; user: Member };

const roleNames: Record<AccessRole, string> = {
  GESTOR: "Gestor",
  EDITOR: "Editor",
  OPERACAO: "Operação"
};
const roleDescriptions: Record<AccessRole, string> = {
  GESTOR: "Configura quase toda a operação; não transfere a responsabilidade, exclui o evento, acessa repasses ou altera taxas e reembolsos.",
  EDITOR: "Edita informações, programação e ingressos; não publica, cancela ou altera a privacidade, taxas e reembolsos.",
  OPERACAO: "Faz check-in e consulta a lista mínima de participantes para a portaria."
};

export function EventAccessManager({ eventId }: { eventId: string }) {
  const client = useQueryClient();
  const [userId, setUserId] = useState("");
  const [role, setRole] = useState<AccessRole>("EDITOR");
  const assignmentsQuery = useQuery<Assignment[]>({
    queryKey: ["event-access", eventId],
    queryFn: () => api(`/events/${eventId}/access`)
  });
  const teamQuery = useQuery<Array<{ user: Member }>>({
    queryKey: ["team"],
    queryFn: () => api("/team")
  });
  const assignedIds = useMemo(() => new Set((assignmentsQuery.data ?? []).map((a) => a.userId)), [assignmentsQuery.data]);
  const available = (teamQuery.data ?? []).map((item) => item.user).filter((member) => !assignedIds.has(member.id));

  const add = useMutation({
    mutationFn: () => api(`/events/${eventId}/access`, { method: "POST", body: JSON.stringify({ userId, role }) }),
    onSuccess: () => {
      setUserId("");
      client.invalidateQueries({ queryKey: ["event-access", eventId] });
    }
  });
  const remove = useMutation({
    mutationFn: (memberUserId: string) => api(`/events/${eventId}/access/${memberUserId}`, { method: "DELETE" }),
    onSuccess: () => client.invalidateQueries({ queryKey: ["event-access", eventId] })
  });
  const changeRole = useMutation({
    mutationFn: ({ memberUserId, nextRole }: { memberUserId: string; nextRole: AccessRole }) =>
      api(`/events/${eventId}/access`, { method: "POST", body: JSON.stringify({ userId: memberUserId, role: nextRole }) }),
    onSuccess: () => client.invalidateQueries({ queryKey: ["event-access", eventId] })
  });

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2"><Shield className="h-4 w-4" />Acesso ao evento</CardTitle>
        <CardDescription>Escolha o que cada pessoa pode fazer neste evento. Só você, como criador, pode conceder ou remover esses acessos.</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid gap-2 sm:grid-cols-[1fr_150px_auto]">
          <select className="h-10 rounded-md border bg-background px-3 text-sm" value={userId} onChange={(e) => setUserId(e.target.value)}>
            <option value="">Selecione alguém da equipe</option>
            {available.map((member) => <option key={member.id} value={member.id}>{member.name} · {member.email}</option>)}
          </select>
          <select className="h-10 rounded-md border bg-background px-3 text-sm" value={role} onChange={(e) => setRole(e.target.value as AccessRole)}>
            {Object.entries(roleNames).map(([key, name]) => <option key={key} value={key}>{name}</option>)}
          </select>
          <Button type="button" onClick={() => add.mutate()} disabled={!userId || add.isPending}>
            {add.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <UserPlus className="h-4 w-4" />} Adicionar
          </Button>
        </div>
        <p className="text-xs text-muted-foreground">{roleDescriptions[role]}</p>
        {!teamQuery.isLoading && available.length === 0 && <p className="text-xs text-muted-foreground">Adicione primeiro a pessoa à <Link className="underline" href="/team">equipe da organização</Link>. Ela precisa ter uma conta Event Flow.</p>}
        {add.error && <p className="text-sm text-destructive">{add.error.message}</p>}
        {assignmentsQuery.isLoading ? <p className="text-sm text-muted-foreground">Carregando acessos…</p> : (
          <ul className="divide-y rounded-md border">
            {(assignmentsQuery.data ?? []).map((assignment) => (
              <li key={assignment.userId} className="flex items-center justify-between gap-3 p-3">
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium">{assignment.user.name}</p>
                  <p className="truncate text-xs text-muted-foreground">{assignment.user.email}</p>
                </div>
                <select className="h-9 rounded-md border bg-background px-2 text-xs" aria-label={`Permissão para ${assignment.user.name}`} value={assignment.role} onChange={(e) => changeRole.mutate({ memberUserId: assignment.userId, nextRole: e.target.value as AccessRole })}>
                  {Object.entries(roleNames).map(([key, name]) => <option key={key} value={key}>{name}</option>)}
                </select>
                <Button type="button" size="icon" variant="ghost" aria-label={`Remover ${assignment.user.name}`} disabled={remove.isPending} onClick={() => remove.mutate(assignment.userId)}>
                  <UserMinus className="h-4 w-4" />
                </Button>
              </li>
            ))}
            {(assignmentsQuery.data ?? []).length === 0 && <li className="p-3 text-sm text-muted-foreground">Ninguém recebeu acesso a este evento ainda.</li>}
          </ul>
        )}
        {assignmentsQuery.error && <p className="text-sm text-destructive">Não foi possível carregar os acessos deste evento.</p>}
        {remove.error && <p className="text-sm text-destructive">{remove.error.message}</p>}
        {changeRole.error && <p className="text-sm text-destructive">{changeRole.error.message}</p>}
      </CardContent>
    </Card>
  );
}

"use client";

import { useState } from "react";
import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Loader2, Plus, Shield, Trash2, UserPlus, Users } from "lucide-react";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { api } from "@/lib/api";
import type { Paginated } from "@/types/eventflow";
import { useAuthStore } from "@/stores/auth-store";

type Permission = "CHECK_IN" | "FINANCE" | "EDIT_EVENT" | "VIEW_SALES";

type TeamMember = {
  id: string;
  permissions: Permission[];
  allEvents: boolean;
  eventIds: string[];
  scopeConfigured: boolean;
  user: {
    id: string;
    name: string;
    email: string;
    avatarUrl?: string;
  };
};
type TeamEvent = { id: string; title: string; ownerId: string };
type MemberSettings = { permissions: Permission[]; allEvents: boolean; eventIds: string[] };

const PERMISSIONS: { key: Permission; label: string; description: string }[] = [
  { key: "CHECK_IN", label: "Check-in", description: "Validar ingressos na entrada" },
  { key: "EDIT_EVENT", label: "Editar evento", description: "Editar dados e lotes do evento" }
];
const permissionNames: Record<Permission, string> = {
  CHECK_IN: "Check-in", EDIT_EVENT: "Editar evento", VIEW_SALES: "Ver vendas (acesso antigo)", FINANCE: "Financeiro (acesso antigo)"
};

const addMemberSchema = z.object({
  email: z.string().email("Informe um e-mail válido."),
  permissions: z.array(z.enum(["CHECK_IN", "FINANCE", "EDIT_EVENT", "VIEW_SALES"])),
  allEvents: z.boolean(),
  eventIds: z.array(z.string())
});

type AddMemberForm = z.infer<typeof addMemberSchema>;

export default function TeamPage() {
  const user = useAuthStore((state) => state.user);
  const queryClient = useQueryClient();
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);

  const { data: members, isLoading } = useQuery<TeamMember[]>({
    queryKey: ["team"],
    queryFn: () => api<TeamMember[]>("/team")
  });
  const { data: tenantEvents = [], error: eventsError } = useQuery<TeamEvent[]>({
    queryKey: ["team-events"],
    queryFn: async () => {
      const first = await api<Paginated<TeamEvent>>("/events?perPage=100&page=1&summary=1");
      const pages = await Promise.all(Array.from({ length: Math.max(0, first.meta.totalPages - 1) }, (_, i) =>
        api<Paginated<TeamEvent>>(`/events?perPage=100&page=${i + 2}&summary=1`)));
      return [...first.data, ...pages.flatMap((page) => page.data)];
    }
  });
  const events = tenantEvents.filter((event) => event.ownerId === user?.id);

  const invalidate = () => queryClient.invalidateQueries({ queryKey: ["team"] });

  const addMutation = useMutation({
    mutationFn: (data: AddMemberForm) =>
      api("/team", { method: "POST", body: JSON.stringify(data) }),
    onSuccess: () => {
      invalidate();
      setShowForm(false);
    }
  });

  const updatePermsMutation = useMutation({
    mutationFn: ({ id, settings }: { id: string; settings: MemberSettings }) =>
      api(`/team/${id}`, { method: "PATCH", body: JSON.stringify(settings) }),
    onSuccess: () => { setEditingId(null); invalidate(); }
  });

  const removeMutation = useMutation({
    mutationFn: (id: string) => api(`/team/${id}`, { method: "DELETE" }),
    onMutate: async (id) => {
      await queryClient.cancelQueries({ queryKey: ["team"] });
      const previous = queryClient.getQueryData<TeamMember[]>(["team"]);
      queryClient.setQueryData<TeamMember[]>(["team"], (old) => old?.filter((m) => m.id !== id));
      return { previous };
    },
    onError: (err, id, context) => queryClient.setQueryData(["team"], context?.previous),
    onSettled: invalidate
  });

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-normal">Equipe</h1>
          <p className="text-sm text-muted-foreground">
            Adicione colaboradores e configure o que cada um pode acessar.
          </p>
        </div>
        <Button onClick={() => setShowForm(true)} disabled={showForm}>
          <UserPlus className="h-4 w-4" />
          Adicionar membro
        </Button>
      </div>

      {showForm && (
        <AddMemberCard
          onSubmit={(data) => addMutation.mutate(data)}
          onCancel={() => setShowForm(false)}
          isPending={addMutation.isPending}
          error={addMutation.error?.message}
          events={events}
          eventsError={eventsError?.message}
        />
      )}

      {isLoading && (
        <div className="grid gap-4 sm:grid-cols-2">
          <Skeleton className="h-44" />
          <Skeleton className="h-44" />
        </div>
      )}

      {!isLoading && members?.length === 0 && !showForm && (
        <Card className="border-dashed">
          <CardContent className="flex flex-col items-center justify-center py-14 text-center">
            <Users className="h-10 w-10 text-muted-foreground/50 mb-3" />
            <p className="text-lg font-medium">Nenhum membro na equipe</p>
            <p className="text-sm text-muted-foreground mt-1">
              Clique em &quot;Adicionar membro&quot; para convidar colaboradores.
            </p>
          </CardContent>
        </Card>
      )}

      <div className="grid gap-4 sm:grid-cols-2">
        {members?.map((member) =>
          editingId === member.id ? (
            <EditPermissionsCard
              key={member.id}
              member={member}
              events={events}
              eventsError={eventsError?.message}
              onSave={(settings) =>
                updatePermsMutation.mutate({ id: member.id, settings })
              }
              onCancel={() => setEditingId(null)}
              isPending={updatePermsMutation.isPending}
              error={updatePermsMutation.error?.message}
            />
          ) : (
            <MemberCard
              key={member.id}
              member={member}
              events={events}
              onEdit={() => setEditingId(member.id)}
              onRemove={() => {
                if (
                  confirm(
                    `Remover ${member.user.name} da equipe? Esta ação não pode ser desfeita.`
                  )
                ) {
                  removeMutation.mutate(member.id);
                }
              }}
              isRemoving={removeMutation.isPending}
            />
          )
        )}
      </div>
    </div>
  );
}

// ─── Sub-components ──────────────────────────────────────────────

function MemberCard({
  member,
  events,
  onEdit,
  onRemove,
  isRemoving
}: {
  member: TeamMember;
  events: TeamEvent[];
  onEdit: () => void;
  onRemove: () => void;
  isRemoving: boolean;
}) {
  const initials = member.user.name
    .split(" ")
    .slice(0, 2)
    .map((w) => w[0])
    .join("")
    .toUpperCase();

  return (
    <Card>
      <CardHeader className="flex-row items-start justify-between space-y-0 gap-3 pb-3">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-primary/10 text-sm font-semibold text-primary">
            {initials}
          </div>
          <div className="min-w-0">
            <p className="font-medium leading-tight">{member.user.name}</p>
            <p className="text-xs text-muted-foreground truncate">{member.user.email}</p>
          </div>
        </div>
        <div className="flex gap-1 shrink-0">
          <Button variant="ghost" size="icon" onClick={onEdit} title="Editar permissões">
            <Shield className="h-4 w-4" />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            onClick={onRemove}
            disabled={isRemoving}
            title="Remover membro"
            className="text-destructive hover:text-destructive"
          >
            {isRemoving ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Trash2 className="h-4 w-4" />
            )}
          </Button>
        </div>
      </CardHeader>
      <CardContent>
        <p className="text-xs text-muted-foreground mb-2">Permissões</p>
        <div className="flex flex-wrap gap-1.5">
          {member.permissions.length > 0 ? (
            member.permissions.map((perm) => (
              <Badge key={perm} variant="secondary" className="text-xs">
                {permissionNames[perm] ?? perm}
              </Badge>
            ))
          ) : (
            <span className="text-xs text-muted-foreground">Nenhuma permissão</span>
          )}
        </div>
        <p className="mt-3 text-xs text-muted-foreground">
          {member.scopeConfigured
            ? member.allEvents ? "Eventos: todos, inclusive futuros" : `Eventos: ${member.eventIds.map((id) => events.find((event) => event.id === id)?.title ?? "Evento removido").join(", ") || "nenhum"}`
            : "Acesso antigo por evento: configure aqui para atualizar"}
        </p>
      </CardContent>
    </Card>
  );
}

function EditPermissionsCard({
  member,
  events,
  eventsError,
  onSave,
  onCancel,
  isPending,
  error
}: {
  member: TeamMember;
  events: TeamEvent[];
  eventsError?: string;
  onSave: (settings: MemberSettings) => void;
  onCancel: () => void;
  isPending: boolean;
  error?: string;
}) {
  const [selected, setSelected] = useState<Set<Permission>>(
    new Set(member.permissions)
  );
  const [allEvents, setAllEvents] = useState(member.scopeConfigured ? member.allEvents : false);
  const [eventIds, setEventIds] = useState<string[]>(member.scopeConfigured ? member.eventIds : []);

  const toggle = (key: Permission) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  };

  return (
    <Card className="border-primary/40">
      <CardHeader className="pb-3">
        <CardTitle className="text-base">Editar permissões</CardTitle>
        <CardDescription>{member.user.name}</CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        {PERMISSIONS.map((perm) => (
          <label
            key={perm.key}
            className="flex items-start gap-3 cursor-pointer rounded-md p-2 hover:bg-muted transition-colors"
          >
            <input
              type="checkbox"
              className="mt-0.5 h-4 w-4 accent-primary"
              checked={selected.has(perm.key)}
              onChange={() => toggle(perm.key)}
            />
            <div>
              <p className="text-sm font-medium">{perm.label}</p>
              <p className="text-xs text-muted-foreground">{perm.description}</p>
            </div>
          </label>
        ))}
        <EventScopePicker events={events} eventsError={eventsError} allEvents={allEvents} eventIds={eventIds} onAllEventsChange={setAllEvents} onEventIdsChange={setEventIds} />
        {error && <p className="text-sm text-destructive">{error}</p>}
        <div className="flex gap-2 pt-1">
          <Button
            size="sm"
            onClick={() => onSave({ permissions: Array.from(selected), allEvents, eventIds: allEvents ? [] : eventIds })}
            disabled={isPending || (!allEvents && eventIds.length === 0)}
          >
            {isPending && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
            Salvar
          </Button>
          <Button size="sm" variant="ghost" onClick={onCancel}>
            Cancelar
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

function AddMemberCard({
  onSubmit,
  onCancel,
  isPending,
  error,
  events,
  eventsError
}: {
  onSubmit: (data: AddMemberForm) => void;
  onCancel: () => void;
  isPending: boolean;
  error?: string;
  events: TeamEvent[];
  eventsError?: string;
}) {
  const form = useForm<AddMemberForm>({
    resolver: zodResolver(addMemberSchema),
    defaultValues: { email: "", permissions: [], allEvents: false, eventIds: [] }
  });

  const [selected, setSelected] = useState<Set<Permission>>(new Set());
  const [allEvents, setAllEvents] = useState(false);
  const [eventIds, setEventIds] = useState<string[]>([]);

  const toggle = (key: Permission) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      form.setValue("permissions", Array.from(next));
      return next;
    });
  };

  const handleSubmit = form.handleSubmit((data) => {
    onSubmit({ ...data, permissions: Array.from(selected), allEvents, eventIds: allEvents ? [] : eventIds });
  });

  return (
    <Card className="border-primary/40 shadow-md">
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2">
          <Plus className="h-4 w-4 text-primary" />
          Adicionar membro
        </CardTitle>
        <CardDescription>
          Informe o e-mail de uma conta Event Flow, escolha as funções e os eventos.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label>E-mail do membro</Label>
            <Input
              type="email"
              placeholder="colaborador@exemplo.com"
              {...form.register("email")}
            />
            {form.formState.errors.email && (
              <p className="text-sm text-destructive">
                {form.formState.errors.email.message}
              </p>
            )}
          </div>
          <div className="space-y-2">
            <Label>Permissões</Label>
            <div className="grid gap-2">
              {PERMISSIONS.map((perm) => (
                <label
                  key={perm.key}
                  className="flex items-start gap-3 cursor-pointer rounded-md p-2 hover:bg-muted transition-colors border"
                >
                  <input
                    type="checkbox"
                    className="mt-0.5 h-4 w-4 accent-primary"
                    checked={selected.has(perm.key)}
                    onChange={() => toggle(perm.key)}
                  />
                  <div>
                    <p className="text-sm font-medium">{perm.label}</p>
                    <p className="text-xs text-muted-foreground">{perm.description}</p>
                  </div>
                </label>
              ))}
            </div>
            {form.formState.errors.permissions && (
              <p className="text-sm text-destructive">
                {form.formState.errors.permissions.message}
              </p>
            )}
          </div>
          <EventScopePicker events={events} eventsError={eventsError} allEvents={allEvents} eventIds={eventIds} onAllEventsChange={setAllEvents} onEventIdsChange={setEventIds} />
          {error && <p className="text-sm text-destructive">{error}</p>}
          <div className="flex gap-2">
            <Button type="submit" disabled={isPending || (!allEvents && eventIds.length === 0)}>
              {isPending && <Loader2 className="h-4 w-4 animate-spin" />}
              Adicionar
            </Button>
            <Button type="button" variant="ghost" onClick={onCancel}>
              Cancelar
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  );
}

function EventScopePicker({ events, eventsError, allEvents, eventIds, onAllEventsChange, onEventIdsChange }: {
  events: TeamEvent[];
  eventsError?: string;
  allEvents: boolean;
  eventIds: string[];
  onAllEventsChange: (value: boolean) => void;
  onEventIdsChange: (value: string[]) => void;
}) {
  return <div className="space-y-2 rounded-md border p-3">
    <Label>Eventos sob responsabilidade</Label>
    <label className="flex items-center gap-2 text-sm">
      <input type="checkbox" checked={allEvents} onChange={(e) => onAllEventsChange(e.target.checked)} />
      Todos os eventos que você criou, inclusive futuros
    </label>
    {!allEvents && <div className="max-h-48 space-y-1 overflow-y-auto pl-1">
      {eventsError && <p className="text-xs text-destructive">Não foi possível carregar os eventos: {eventsError}</p>}
      {!eventsError && events.length === 0 && <p className="text-xs text-muted-foreground">Nenhum evento disponível. Crie um evento ou marque todos os eventos.</p>}
      {events.map((event) => <label key={event.id} className="flex items-center gap-2 py-1 text-sm">
        <input type="checkbox" checked={eventIds.includes(event.id)} onChange={(e) => onEventIdsChange(e.target.checked ? [...eventIds, event.id] : eventIds.filter((id) => id !== event.id))} />
        {event.title}
      </label>)}
    </div>}
    {!allEvents && eventIds.length === 0 && <p className="text-xs text-destructive">Selecione ao menos um evento.</p>}
  </div>;
}

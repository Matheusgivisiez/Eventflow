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

type Permission = "CHECK_IN" | "FINANCE" | "EDIT_EVENT" | "VIEW_SALES";

type TeamMember = {
  id: string;
  permissions: Permission[];
  user: {
    id: string;
    name: string;
    email: string;
    avatarUrl?: string;
  };
};

const PERMISSIONS: { key: Permission; label: string; description: string }[] = [
  { key: "CHECK_IN", label: "Check-in", description: "Validar ingressos na entrada" },
  { key: "VIEW_SALES", label: "Ver vendas", description: "Visualizar relatórios de vendas" },
  { key: "EDIT_EVENT", label: "Editar evento", description: "Editar dados e lotes do evento" },
  { key: "FINANCE", label: "Financeiro", description: "Acessar saldo e solicitar saques" }
];

const addMemberSchema = z.object({
  email: z.string().email("Informe um e-mail válido."),
  permissions: z.array(z.string()).min(1, "Selecione ao menos uma permissão.")
});

type AddMemberForm = z.infer<typeof addMemberSchema>;

export default function TeamPage() {
  const queryClient = useQueryClient();
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);

  const { data: members, isLoading } = useQuery<TeamMember[]>({
    queryKey: ["team"],
    queryFn: () => api<TeamMember[]>("/team")
  });

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
    mutationFn: ({ id, permissions }: { id: string; permissions: string[] }) =>
      api(`/team/${id}`, { method: "PATCH", body: JSON.stringify({ permissions }) }),
    onSuccess: () => {
      invalidate();
      setEditingId(null);
    }
  });

  const removeMutation = useMutation({
    mutationFn: (id: string) => api(`/team/${id}`, { method: "DELETE" }),
    onSuccess: invalidate
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
              Clique em "Adicionar membro" para convidar colaboradores.
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
              onSave={(permissions) =>
                updatePermsMutation.mutate({ id: member.id, permissions })
              }
              onCancel={() => setEditingId(null)}
              isPending={updatePermsMutation.isPending}
              error={updatePermsMutation.error?.message}
            />
          ) : (
            <MemberCard
              key={member.id}
              member={member}
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
  onEdit,
  onRemove,
  isRemoving
}: {
  member: TeamMember;
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
                {PERMISSIONS.find((p) => p.key === perm)?.label ?? perm}
              </Badge>
            ))
          ) : (
            <span className="text-xs text-muted-foreground">Nenhuma permissão</span>
          )}
        </div>
      </CardContent>
    </Card>
  );
}

function EditPermissionsCard({
  member,
  onSave,
  onCancel,
  isPending,
  error
}: {
  member: TeamMember;
  onSave: (permissions: string[]) => void;
  onCancel: () => void;
  isPending: boolean;
  error?: string;
}) {
  const [selected, setSelected] = useState<Set<string>>(
    new Set(member.permissions)
  );

  const toggle = (key: string) => {
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
        {error && <p className="text-sm text-destructive">{error}</p>}
        <div className="flex gap-2 pt-1">
          <Button
            size="sm"
            onClick={() => onSave(Array.from(selected))}
            disabled={isPending}
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
  error
}: {
  onSubmit: (data: AddMemberForm) => void;
  onCancel: () => void;
  isPending: boolean;
  error?: string;
}) {
  const form = useForm<AddMemberForm>({
    resolver: zodResolver(addMemberSchema),
    defaultValues: { email: "", permissions: [] }
  });

  const [selected, setSelected] = useState<Set<string>>(new Set());

  const toggle = (key: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      form.setValue("permissions", Array.from(next));
      return next;
    });
  };

  const handleSubmit = form.handleSubmit((data) => {
    onSubmit({ ...data, permissions: Array.from(selected) });
  });

  return (
    <Card className="border-primary/40 shadow-md">
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2">
          <Plus className="h-4 w-4 text-primary" />
          Adicionar membro
        </CardTitle>
        <CardDescription>
          Informe o e-mail de um usuário já cadastrado na plataforma.
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
          {error && <p className="text-sm text-destructive">{error}</p>}
          <div className="flex gap-2">
            <Button type="submit" disabled={isPending}>
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

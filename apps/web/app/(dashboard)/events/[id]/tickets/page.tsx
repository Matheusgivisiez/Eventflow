"use client";

import { useParams } from "next/navigation";
import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  ArrowLeft, Loader2, Pencil, Plus, Save, Trash2, X, GripVertical
} from "lucide-react";
import Link from "next/link";
import { useState } from "react";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { DndContext, closestCenter, KeyboardSensor, PointerSensor, useSensor, useSensors } from "@dnd-kit/core";
import { arrayMove, SortableContext, sortableKeyboardCoordinates, verticalListSortingStrategy, useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { api } from "@/lib/api";
import { dateTime, money } from "@/lib/utils";
import type { TicketType } from "@/types/eventhub";

const ticketSchema = z.object({
  name: z.string().min(2, "Informe o nome do lote."),
  description: z.string().optional(),
  quantity: z.coerce.number().int().min(1, "Quantidade mínima: 1"),
  priceCents: z.coerce.number().int().min(0, "Preço inválido").transform((v) => Math.round(v)),
  startsAt: z.string().min(1, "Informe a data de início."),
  endsAt: z.string().min(1, "Informe a data de término."),
  limitPerBuy: z.coerce.number().int().min(1, "Mínimo: 1"),
  isActive: z.boolean().optional()
});
type TicketForm = z.infer<typeof ticketSchema>;
function brlToCents(brl: number) { return Math.round(brl * 100); }

export default function TicketTypesPage() {
  const { id: eventId } = useParams<{ id: string }>();
  const queryClient = useQueryClient();
  const [editingId, setEditingId] = useState<string | null>(null);
  const [showNewForm, setShowNewForm] = useState(false);
  const [optimisticTickets, setOptimisticTickets] = useState<TicketType[] | null>(null);

  const { data: serverTickets, isLoading } = useQuery<TicketType[]>({
    queryKey: ["ticket-types", eventId],
    queryFn: () => api<TicketType[]>(`/events/${eventId}/ticket-types`)
  });

  const tickets = optimisticTickets ?? serverTickets ?? [];

  const invalidate = () => {
    queryClient.invalidateQueries({ queryKey: ["ticket-types", eventId] });
    setOptimisticTickets(null);
  };

  const createMutation = useMutation({
    mutationFn: (data: TicketForm) =>
      api(`/events/${eventId}/ticket-types`, {
        method: "POST",
        body: JSON.stringify({ ...data, priceCents: brlToCents(data.priceCents as unknown as number) })
      }),
    onSuccess: () => { invalidate(); setShowNewForm(false); }
  });

  const updateMutation = useMutation({
    mutationFn: ({ ticketId, data }: { ticketId: string; data: TicketForm }) =>
      api(`/events/${eventId}/ticket-types/${ticketId}`, {
        method: "PATCH",
        body: JSON.stringify({ ...data, priceCents: brlToCents(data.priceCents as unknown as number) })
      }),
    onSuccess: () => { invalidate(); setEditingId(null); }
  });

  const deleteMutation = useMutation({
    mutationFn: (ticketId: string) => api(`/events/${eventId}/ticket-types/${ticketId}`, { method: "DELETE" }),
    onSuccess: invalidate
  });

  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  );

  const handleDragEnd = (event: any) => {
    const { active, over } = event;
    if (active.id !== over?.id) {
      setOptimisticTickets((items) => {
        const list = items || tickets;
        const oldIndex = list.findIndex((t) => t.id === active.id);
        const newIndex = list.findIndex((t) => t.id === over.id);
        return arrayMove(list, oldIndex, newIndex);
      });
      // Optionally call a reorder API here if implemented
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="icon" asChild>
            <Link href={`/events/${eventId}`}><ArrowLeft className="h-4 w-4" /></Link>
          </Button>
          <div>
            <h1 className="text-2xl font-extrabold tracking-tight">Lotes de ingresso</h1>
            <p className="text-sm text-muted-foreground mt-1">Crie e gerencie os lotes de venda para este evento.</p>
          </div>
        </div>
        <Button onClick={() => setShowNewForm(true)} disabled={showNewForm} className="bg-primary hover:bg-primary/90 text-white shadow-sm shadow-primary/30">
          <Plus className="h-4 w-4" /> Novo lote
        </Button>
      </div>

      {showNewForm && (
        <Card className="border-primary/40 shadow-md">
          <CardHeader className="flex-row items-center justify-between space-y-0 pb-4">
            <CardTitle className="text-base">Novo lote</CardTitle>
            <Button variant="ghost" size="icon" onClick={() => setShowNewForm(false)}><X className="h-4 w-4" /></Button>
          </CardHeader>
          <CardContent>
            <TicketForm key="new" onSubmit={(data: TicketForm) => createMutation.mutate(data)}
              isPending={createMutation.isPending} error={createMutation.error?.message} submitLabel="Criar lote" />
          </CardContent>
        </Card>
      )}

      {isLoading && <Skeleton className="h-64 w-full" />}

      {tickets.length === 0 && !showNewForm && !isLoading && (
        <Card className="border-dashed">
          <CardContent className="flex flex-col items-center justify-center py-14 text-center text-muted-foreground">
            <p className="text-lg font-medium">Nenhum lote criado</p>
            <p className="text-sm mt-1">Clique em "Novo lote" para adicionar o primeiro lote de ingressos.</p>
          </CardContent>
        </Card>
      )}

      {tickets.length > 0 && (
        <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
          <SortableContext items={tickets.map(t => t.id)} strategy={verticalListSortingStrategy}>
            <div className="grid gap-4">
              {tickets.map((ticket) =>
                editingId === ticket.id ? (
                  <Card key={ticket.id} className="border-primary/30 shadow-sm">
                    <CardHeader className="flex-row items-center justify-between space-y-0 pb-4">
                      <CardTitle className="text-base">Editando: {ticket.name}</CardTitle>
                      <Button variant="ghost" size="icon" onClick={() => setEditingId(null)}><X className="h-4 w-4" /></Button>
                    </CardHeader>
                    <CardContent>
                      <TicketForm key={ticket.id}
                        defaultValues={{
                          name: ticket.name, description: ticket.description ?? "",
                          quantity: ticket.quantity, priceCents: ticket.priceCents / 100,
                          startsAt: ticket.startsAt.slice(0, 16), endsAt: ticket.endsAt.slice(0, 16),
                          limitPerBuy: ticket.limitPerBuy, isActive: ticket.isActive
                        }}
                        onSubmit={(data: TicketForm) => updateMutation.mutate({ ticketId: ticket.id, data })}
                        isPending={updateMutation.isPending} error={updateMutation.error?.message} submitLabel="Salvar alterações" />
                    </CardContent>
                  </Card>
                ) : (
                  <SortableTicketCard key={ticket.id} ticket={ticket}
                    onEdit={() => setEditingId(ticket.id)}
                    onDelete={() => { if (confirm(`Excluir o lote "${ticket.name}"?`)) deleteMutation.mutate(ticket.id); }}
                    isDeleting={deleteMutation.isPending}
                  />
                )
              )}
            </div>
          </SortableContext>
        </DndContext>
      )}
    </div>
  );
}

function SortableTicketCard({ ticket, onEdit, onDelete, isDeleting }: { ticket: TicketType; onEdit: () => void; onDelete: () => void; isDeleting: boolean; }) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: ticket.id });
  
  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    zIndex: isDragging ? 10 : 1,
  };

  const available = ticket.quantity - ticket.sold;
  const soldPct = ticket.quantity > 0 ? (ticket.sold / ticket.quantity) * 100 : 0;

  return (
    <div ref={setNodeRef} style={style} className={`transition-opacity ${isDragging ? "opacity-50" : "opacity-100"}`}>
      <Card className="group border shadow-sm hover:border-primary/20 hover:shadow-lg transition-all duration-200">
        <CardHeader className="flex-row items-start justify-between space-y-0 gap-4">
          <div className="flex items-start gap-3 flex-1 min-w-0">
            <div {...attributes} {...listeners} className="mt-1 cursor-grab active:cursor-grabbing text-muted-foreground hover:text-foreground">
              <GripVertical className="h-5 w-5" />
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <CardTitle className="text-base">{ticket.name}</CardTitle>
                <Badge variant={ticket.isActive ? "default" : "secondary"}>{ticket.isActive ? "Ativo" : "Inativo"}</Badge>
              </div>
              {ticket.description && <CardDescription className="mt-1">{ticket.description}</CardDescription>}
            </div>
          </div>
          <div className="flex gap-1 shrink-0">
            <Button variant="ghost" size="icon" onClick={onEdit} title="Editar lote"><Pencil className="h-4 w-4" /></Button>
            <Button variant="ghost" size="icon" onClick={onDelete} disabled={isDeleting} title="Excluir lote" className="text-destructive hover:text-destructive">
              {isDeleting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4" />}
            </Button>
          </div>
        </CardHeader>
        <CardContent className="pl-12">
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            <Metric label="Preço" value={money(ticket.priceCents)} />
            <Metric label="Total" value={ticket.quantity.toLocaleString("pt-BR")} />
            <Metric label="Vendidos" value={ticket.sold.toLocaleString("pt-BR")} />
            <Metric label="Disponíveis" value={available.toLocaleString("pt-BR")} highlight={available === 0} />
          </div>
          <div className="mt-4 space-y-1.5">
            <div className="flex justify-between text-xs text-muted-foreground font-medium">
              <span>{Math.round(soldPct)}% vendido</span>
              <span>Limite/compra: {ticket.limitPerBuy}</span>
            </div>
            <div className="h-2 w-full rounded-full bg-muted overflow-hidden">
              <div className={`h-full rounded-full transition-all duration-500 ${soldPct >= 90 ? "bg-rose-500" : soldPct >= 60 ? "bg-amber-500" : "bg-emerald-500"}`} style={{ width: `${soldPct}%` }} />
            </div>
            <p className="text-xs text-muted-foreground pt-1.5 flex items-center gap-1.5">
              <span>Vendas:</span> 
              <span className="font-medium text-foreground">{dateTime(ticket.startsAt)}</span> 
              <span>&rarr;</span> 
              <span className="font-medium text-foreground">{dateTime(ticket.endsAt)}</span>
            </p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

function Metric({ label, value, highlight }: { label: string; value: string; highlight?: boolean; }) {
  return (
    <div className="rounded-xl bg-muted/50 p-3">
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className={`mt-1 font-semibold ${highlight ? "text-destructive" : ""}`}>{value}</p>
    </div>
  );
}

function TicketForm({ defaultValues, onSubmit, isPending, error, submitLabel }: any) {
  const form = useForm<TicketForm>({
    resolver: zodResolver(ticketSchema),
    defaultValues: { limitPerBuy: 5, isActive: true, ...defaultValues }
  });
  return (
    <form className="grid gap-4" onSubmit={form.handleSubmit(onSubmit)}>
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Nome do lote" error={form.formState.errors.name?.message}>
          <Input {...form.register("name")} placeholder="Ex: Inteira, VIP, Meia-entrada" />
        </Field>
        <Field label="Descrição" error={form.formState.errors.description?.message}>
          <Input {...form.register("description")} placeholder="Opcional" />
        </Field>
      </div>
      <div className="grid gap-4 sm:grid-cols-3">
        <Field label="Preço (R$)" error={form.formState.errors.priceCents?.message}>
          <Input type="number" min={0} step={0.01} placeholder="0.00" {...form.register("priceCents")} />
        </Field>
        <Field label="Quantidade" error={form.formState.errors.quantity?.message}>
          <Input type="number" min={1} {...form.register("quantity")} />
        </Field>
        <Field label="Limite por compra" error={form.formState.errors.limitPerBuy?.message}>
          <Input type="number" min={1} {...form.register("limitPerBuy")} />
        </Field>
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Início das vendas" error={form.formState.errors.startsAt?.message}>
          <Input type="datetime-local" {...form.register("startsAt")} />
        </Field>
        <Field label="Fim das vendas" error={form.formState.errors.endsAt?.message}>
          <Input type="datetime-local" {...form.register("endsAt")} />
        </Field>
      </div>
      <div className="flex items-center gap-3">
        <input type="checkbox" id="isActive" className="h-4 w-4 rounded border accent-primary" {...form.register("isActive")} />
        <Label htmlFor="isActive">Lote ativo (disponível para venda)</Label>
      </div>
      {error && <p className="text-sm text-destructive">{error}</p>}
      <Button type="submit" disabled={isPending} className="w-full sm:w-auto mt-2">
        {isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
        {submitLabel}
      </Button>
    </form>
  );
}

function Field({ label, error, children }: any) {
  return (
    <div className="space-y-2">
      <Label>{label}</Label>
      {children}
      {error && <p className="text-sm text-destructive">{error}</p>}
    </div>
  );
}

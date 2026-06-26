"use client";

import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { api } from "@/lib/api";
import { money } from "@/lib/utils";

export default function AdminPage() {
  const users = useQuery({ queryKey: ["admin-users"], queryFn: () => api<any[]>("/admin/users") });
  const events = useQuery({ queryKey: ["admin-events"], queryFn: () => api<any[]>("/admin/events") });
  const payments = useQuery({ queryKey: ["admin-payments"], queryFn: () => api<any[]>("/admin/payments") });

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-normal">Administracao</h1>
        <p className="text-sm text-muted-foreground">Gerencie usuarios, eventos, pagamentos e logs da plataforma.</p>
      </div>
      <div className="grid gap-4 sm:grid-cols-3">
        <AdminCard title="Usuarios" value={users.data?.length ?? 0} />
        <AdminCard title="Eventos" value={events.data?.length ?? 0} />
        <AdminCard title="Pagamentos" value={payments.data?.length ?? 0} />
      </div>
      <Card>
        <CardHeader>
          <CardTitle>Pagamentos recentes</CardTitle>
          <CardDescription>Status operacional para suporte.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          {payments.data?.slice(0, 10).map((payment) => (
            <div key={payment.id} className="grid gap-2 rounded-md border p-3 text-sm sm:grid-cols-4">
              <span>{payment.event?.title}</span>
              <span>{payment.order?.buyerEmail}</span>
              <span>{payment.status}</span>
              <span className="font-medium">{money(payment.amountCents)}</span>
            </div>
          ))}
        </CardContent>
      </Card>
    </div>
  );
}

function AdminCard({ title, value }: { title: string; value: number }) {
  return (
    <Card>
      <CardHeader>
        <CardDescription>{title}</CardDescription>
      </CardHeader>
      <CardContent>
        <p className="text-2xl font-semibold">{value}</p>
      </CardContent>
    </Card>
  );
}

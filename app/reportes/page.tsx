import { redirect } from "next/navigation";
import { UserRole } from "@prisma/client";
import { AppShell } from "@/components/app-shell";
import { getCurrentUser } from "@/lib/auth";
import { prisma } from "@/lib/db";

export default async function ReportsPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  if (user.role !== UserRole.ADMIN) redirect("/ruleta/presencial");

  const byPrize = await prisma.raffleResult.groupBy({
    by: ["prizeName"],
    _count: { id: true },
    orderBy: { _count: { id: "desc" } }
  });

  return (
    <AppShell user={user}>
      <div className="mb-6">
        <h1 className="text-2xl font-black text-slate-950">Reportes</h1>
        <p className="text-slate-600">Vista inicial de premios entregados por articulo.</p>
      </div>
      <section className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
        <div className="space-y-3">
          {byPrize.length === 0 ? <p className="text-slate-600">Aun no hay resultados para reportar.</p> : null}
          {byPrize.map((item) => (
            <div key={item.prizeName} className="flex items-center justify-between rounded-md bg-slate-50 px-3 py-2">
              <span className="font-semibold">{item.prizeName}</span>
              <span className="rounded-md bg-emerald-100 px-3 py-1 font-black text-emerald-900">{item._count.id}</span>
            </div>
          ))}
        </div>
      </section>
    </AppShell>
  );
}

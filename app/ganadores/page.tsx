import { redirect } from "next/navigation";
import { UserRole } from "@prisma/client";
import { AppShell } from "@/components/app-shell";
import { WinnersManager } from "@/components/winners-manager";
import { getCurrentUser } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { formatWinnerPrize } from "@/lib/winner-reports";

export default async function WinnersPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  if (user.role !== UserRole.ADMIN) redirect("/dashboard");

  const reports = await prisma.winnerReport.findMany({
    include: {
      winners: {
        orderBy: [{ location: "asc" }, { ref: "asc" }]
      }
    },
    orderBy: { createdAt: "desc" }
  });

  return (
    <AppShell user={user}>
      <div className="mb-5 min-w-0 sm:mb-6">
        <h1 className="text-xl font-black text-slate-950 sm:text-2xl">Ganadores</h1>
        <p className="text-slate-600">
          Crea publicaciones independientes, carga cabecera, cierre y una plantilla Excel para generar el PDF final.
        </p>
      </div>
      <WinnersManager
        reports={reports.map((report) => ({
          id: report.id,
          name: report.name,
          reportDate: report.reportDate.toISOString(),
          headerImagePath: report.headerImagePath,
          footerImagePath: report.footerImagePath,
          winners: report.winners.map((winner, index) => ({
            id: winner.id,
            ref: index + 1,
            winnerId: winner.winnerId,
            name: winner.name,
            prize: formatWinnerPrize(winner.prize),
            location: winner.location
          }))
        }))}
      />
    </AppShell>
  );
}

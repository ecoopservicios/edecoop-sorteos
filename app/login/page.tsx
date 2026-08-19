import { redirect } from "next/navigation";
import { LoginForm } from "@/components/login-form";
import { getCurrentUser } from "@/lib/auth";

export default async function LoginPage({
  searchParams
}: {
  searchParams: Promise<{ error?: string; expired?: string }>;
}) {
  const user = await getCurrentUser();
  if (user) redirect(user.mustChangePassword ? "/cambiar-clave" : "/proyectos");
  const { error, expired } = await searchParams;

  return (
    <main className="min-h-screen bg-slate-50 px-4 py-8 sm:px-6 lg:px-10">
      <div className="mx-auto flex min-h-[calc(100vh-4rem)] w-full max-w-6xl flex-col items-center justify-center gap-8 lg:grid lg:grid-cols-[1fr_auto_440px] lg:gap-10">
        <section className="flex w-full max-w-xl flex-col items-center text-center lg:items-start lg:text-left">
          <img
            src="/edecoop-logo.png"
            alt="EDECOOP Cooperativa de Ahorros y Creditos"
            className="h-auto w-full max-w-[300px] object-contain sm:max-w-[360px] lg:max-w-[430px]"
          />
        </section>
        <div className="flex items-center justify-center lg:h-[520px]" aria-hidden="true">
          <div className="hidden h-full flex-col items-center justify-center gap-4 lg:flex">
            <span className="h-2 w-2 rounded-full bg-emerald-700" />
            <span className="h-2 w-2 rounded-full bg-amber-400" />
            <span className="h-2 w-2 rounded-full bg-slate-500" />
          </div>
          <div className="flex gap-4 lg:hidden">
            <span className="h-2 w-2 rounded-full bg-emerald-700" />
            <span className="h-2 w-2 rounded-full bg-amber-400" />
            <span className="h-2 w-2 rounded-full bg-slate-500" />
          </div>
        </div>
        <LoginForm hasError={error === "1"} sessionExpired={expired === "1"} />
      </div>
    </main>
  );
}

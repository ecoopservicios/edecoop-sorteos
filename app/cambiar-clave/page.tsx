import { redirect } from "next/navigation";
import { ChangePasswordForm } from "@/components/change-password-form";
import { getCurrentUser } from "@/lib/auth";

export default async function ChangePasswordPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");

  return (
    <main className="flex min-h-screen items-center justify-center px-4 py-8">
      <ChangePasswordForm mustChangePassword={user.mustChangePassword} email={user.email} />
    </main>
  );
}

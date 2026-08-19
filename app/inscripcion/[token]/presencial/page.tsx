import { redirect } from "next/navigation";

export default async function PublicPresentialEnrollmentPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  redirect(`/inscripcion/${token}`);
}

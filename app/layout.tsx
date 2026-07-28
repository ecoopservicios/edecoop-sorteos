import type { Metadata } from "next";
import { ToastViewport } from "@/components/toast-viewport";
import "./globals.css";

export const metadata: Metadata = {
  title: "EDECOOP Sorteos",
  description: "Sistema responsive para sorteos instantáneos de EDECOOP"
};

export default function RootLayout({
  children
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="es">
      <body>
        <ToastViewport />
        {children}
      </body>
    </html>
  );
}

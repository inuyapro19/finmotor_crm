import type { Metadata } from "next";
import type { ReactNode } from "react";

export const metadata: Metadata = {
  title: "Crear contraseña",
  robots: { index: false, follow: false },
  // La URL trae el token del enlace: que no viaje en el Referer a ningún otro sitio.
  referrer: "no-referrer",
};

export default function RestablecerClaveLayout({ children }: { children: ReactNode }) {
  return children;
}

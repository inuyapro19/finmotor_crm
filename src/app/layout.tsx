import type { Metadata, Viewport } from "next";
import { Geist_Mono, Poppins } from "next/font/google";
import { Toaster } from "sonner";
import "./globals.css";
import Link from "next/link";

// Manual de Marca (05 · Tipografía): Poppins como familia única de interfaz. Pesos usados
// en la escala: 400/500 texto, 600 H1/H2, 700 Display. Geist Mono para cifras (patentes,
// stock, montos) — mismo criterio tipográfico que ya usa frontend-backoffice.
const poppins = Poppins({
  variable: "--font-poppins",
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  ...(process.env.FINMOTOR_DEMO_MODE === "true" ? { robots: { index: false, follow: false } } : {}),
  title: "Finmotor CRM",
  description: "CRM de automotoras: solicitudes, agenda y stock por patente.",
  icons: { icon: "/favicon-finmotor.ico", apple: "/assets/img/faviconv1.png" },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 5,
  themeColor: "#071d56",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="es">
      <body className={`${poppins.variable} ${geistMono.variable} font-sans antialiased`} suppressHydrationWarning>
        {process.env.FINMOTOR_DEMO_MODE === "true" && <aside className="bg-amber-200 px-4 py-2 text-center text-sm font-semibold text-slate-900">
          DEMO PRIVADA · Solo datos ficticios · Servicios externos bloqueados · <Link href="/demo/marketplace" className="underline">Marketplace y reset</Link>
        </aside>}
        {children}
        <Toaster richColors position="top-center" />
      </body>
    </html>
  );
}

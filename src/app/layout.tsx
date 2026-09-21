import type { Metadata, Viewport } from "next";
import { Geist_Mono, Poppins } from "next/font/google";
import { Toaster } from "sonner";
import "./globals.css";

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
        {children}
        <Toaster richColors position="top-center" />
      </body>
    </html>
  );
}

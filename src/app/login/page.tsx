"use client";

import { useState } from "react";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { Eye, EyeOff, Loader2, LockKeyhole } from "lucide-react";

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      const res = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(data?.error || "No pudimos iniciar tu sesión");
        return;
      }
      const returnTo = new URLSearchParams(window.location.search).get("returnTo");
      router.push(returnTo?.startsWith("/") && !returnTo.startsWith("//") ? returnTo : "/");
      router.refresh();
    } catch {
      setError("No pudimos conectar con el servidor. Revisa tu conexión.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <main className="grid min-h-dvh lg:grid-cols-2">
      {/* Panel de marca. La foto va de fondo con un velo azul marino encima: sin ese velo el
          texto blanco se pierde contra el cielo claro del atardecer. */}
      <div className="relative hidden flex-col justify-between overflow-hidden bg-[var(--fm-navy)] p-10 lg:flex">
        <Image
          src="/assets/img/banner.png"
          alt=""
          aria-hidden
          fill
          priority
          sizes="50vw"
          // La foto es apaisada y el panel es vertical: el encuadre se corre a la derecha y
          // hacia abajo para que el vehículo quede completo en vez de recortado por el capó.
          className="object-cover object-[62%_62%]"
        />
        <div
          aria-hidden
          // Velo en gradiente, opaco abajo (donde va el titular) y casi transparente arriba
          // (donde está el cielo). Va en `style` y no en clases utilitarias para fijar las
          // paradas exactas que hacen legible el texto sobre la foto.
          className="absolute inset-0"
          style={{
            background:
              "linear-gradient(to top, #071d56 0%, rgba(7,29,86,0.72) 45%, rgba(7,29,86,0.22) 100%)",
          }}
        />

        <div className="relative flex items-center gap-2.5">
          <Image
            src="/assets/img/finmotor-logo-vector-lime.svg"
            alt="Finmotor"
            width={875}
            height={184}
            priority
            unoptimized
            className="h-6 w-auto"
          />
          <span className="rounded-md border border-white/20 px-1.5 py-0.5 text-[9px] font-semibold uppercase tracking-[0.16em] text-white/60">
            CRM
          </span>
        </div>
        <div className="relative max-w-md">
          <h2 className="text-3xl font-semibold leading-tight text-white">
            Tus solicitudes, tu equipo y tu stock en un solo lugar.
          </h2>
          <p className="mt-4 text-sm leading-relaxed text-white/70">
            Cada solicitud que entra por Finmotor llega aquí con los datos del cliente listos
            para llamar. Tu stock se ordena por patente, unidad por unidad.
          </p>
        </div>
        <p className="relative text-[11px] text-white/45">
          ¿Eres del equipo Finmotor? Tu consola es admin.finmotor.cl
        </p>
      </div>

      {/* Formulario */}
      <div className="flex items-center justify-center px-5 py-10 sm:px-10">
        <div className="w-full max-w-sm">
          {/* En móvil el fondo es claro: va la versión verde del logo. */}
          <div className="mb-8 flex items-center gap-2.5 lg:hidden">
            <Image
              src="/assets/img/finmotor-logo-vector.svg"
              alt="Finmotor"
              width={875}
              height={184}
              priority
              unoptimized
              className="h-6 w-auto"
            />
            <span className="rounded-md border border-[var(--border)] px-1.5 py-0.5 text-[9px] font-semibold uppercase tracking-[0.16em] text-[var(--muted-foreground)]">
              CRM
            </span>
          </div>

          <h1 className="text-xl font-semibold tracking-tight">Ingresa a tu panel</h1>
          <p className="mt-1 text-sm text-[var(--muted-foreground)]">
            Con la cuenta que te creó tu automotora.
          </p>

          <form onSubmit={submit} className="mt-6 space-y-4">
            <div>
              <label htmlFor="email" className="mb-1.5 block text-xs font-medium">
                Correo
              </label>
              <input
                id="email"
                type="email"
                autoComplete="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full rounded-[var(--radius-md)] border border-[var(--border)] bg-[var(--card)] px-3 py-2.5 outline-none focus:border-[var(--primary)]"
                placeholder="tu@automotora.cl"
              />
            </div>

            <div>
              <label htmlFor="password" className="mb-1.5 block text-xs font-medium">
                Contraseña
              </label>
              <div className="relative">
                <input
                  id="password"
                  type={showPassword ? "text" : "password"}
                  autoComplete="current-password"
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full rounded-[var(--radius-md)] border border-[var(--border)] bg-[var(--card)] py-2.5 pl-3 pr-11 outline-none focus:border-[var(--primary)]"
                  placeholder="••••••••"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword((visible) => !visible)}
                  aria-label={showPassword ? "Ocultar contraseña" : "Mostrar contraseña"}
                  aria-pressed={showPassword}
                  className="absolute inset-y-0 right-0 flex w-11 items-center justify-center text-[var(--muted-foreground)] transition-colors hover:text-[var(--foreground)] focus-visible:outline-2 focus-visible:outline-offset-[-3px] focus-visible:outline-[var(--primary)]"
                >
                  {showPassword ? (
                    <EyeOff className="h-4 w-4" aria-hidden="true" />
                  ) : (
                    <Eye className="h-4 w-4" aria-hidden="true" />
                  )}
                </button>
              </div>
            </div>

            {error && (
              <p
                role="alert"
                className="rounded-[var(--radius-md)] border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-700"
              >
                {error}
              </p>
            )}

            <button
              type="submit"
              disabled={loading}
              className="flex w-full items-center justify-center gap-2 rounded-[var(--radius-md)] bg-[var(--primary)] px-4 py-2.5 text-sm font-medium text-white transition-opacity disabled:opacity-60"
            >
              {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <LockKeyhole className="h-4 w-4" />}
              {loading ? "Entrando…" : "Entrar al CRM"}
            </button>
          </form>

          <p className="mt-6 text-[11px] leading-relaxed text-[var(--muted-foreground)]">
            ¿Tu automotora todavía no está en Finmotor? Escríbenos y te damos de alta: cada
            agente recibe su propia cuenta.
          </p>
        </div>
      </div>
    </main>
  );
}

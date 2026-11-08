"use client";

import { Suspense, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { CheckCircle2, Eye, EyeOff, Loader2, LockKeyhole } from "lucide-react";
import { AuthShell } from "@/components/auth/auth-shell";
import { RESET_TOKEN_STORAGE_KEY } from "@/lib/password-reset";

export default function LoginPage() {
  // `useSearchParams` exige un límite de Suspense para no forzar el render dinámico.
  return (
    <Suspense>
      <LoginForm />
    </Suspense>
  );
}

function LoginForm() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const passwordUpdated = useSearchParams().get("passwordUpdated") === "1";

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
      if (data?.passwordChangeRequired && data?.resetToken) {
        // Entró con la contraseña temporal: no hay sesión hasta que cree la definitiva. El
        // token va por sessionStorage, no por la URL.
        try {
          sessionStorage.setItem(RESET_TOKEN_STORAGE_KEY, String(data.resetToken));
        } catch {
          /* sin storage: la pantalla siguiente pedirá un enlace nuevo */
        }
        router.push("/restablecer-clave?primerIngreso=1");
        return;
      }
      if (!res.ok) {
        setError(data?.error || "No pudimos iniciar tu sesión");
        return;
      }
      const returnTo = new URLSearchParams(window.location.search).get("returnTo");
      const home = typeof data?.home === "string" && data.home.startsWith("/") ? data.home : "/";
      // Un proveedor sólo vuelve a rutas de su portal; una automotora, a cualquiera del CRM.
      const safeReturn =
        returnTo?.startsWith("/") && !returnTo.startsWith("//") &&
        (home === "/" || returnTo.startsWith(home))
          ? returnTo
          : null;
      router.push(safeReturn ?? home);
      router.refresh();
    } catch {
      setError("No pudimos conectar con el servidor. Revisa tu conexión.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <AuthShell>
      <h1 className="text-xl font-semibold tracking-tight">Ingresa a tu panel</h1>
      <p className="mt-1 text-sm text-[var(--muted-foreground)]">
        Con la cuenta que te creó tu automotora.
      </p>

      {passwordUpdated && (
        <p
          role="status"
          className="mt-5 flex items-start gap-2 rounded-[var(--radius-md)] border border-[var(--accent)] bg-[var(--accent)] px-3 py-2 text-xs text-[var(--accent-foreground)]"
        >
          <CheckCircle2 className="mt-px h-3.5 w-3.5 shrink-0" aria-hidden="true" />
          Tu contraseña quedó lista. Ingresa con ella.
        </p>
      )}

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
          <div className="mb-1.5 flex items-center justify-between gap-2">
            <label htmlFor="password" className="block text-xs font-medium">
              Contraseña
            </label>
            <Link href="/recuperar-clave" className="text-xs font-medium text-[var(--primary)] hover:underline">
              ¿Olvidaste tu contraseña?
            </Link>
          </div>
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
    </AuthShell>
  );
}

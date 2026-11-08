"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Check, Circle, Eye, EyeOff, KeyRound, Loader2 } from "lucide-react";
import { AuthShell } from "@/components/auth/auth-shell";
import { PASSWORD_RULES, RESET_TOKEN_STORAGE_KEY, isStrongPassword } from "@/lib/password-reset";

type Purpose = "reset" | "invite" | "first_login";

function storeToken(token: string | null) {
  try {
    if (token) sessionStorage.setItem(RESET_TOKEN_STORAGE_KEY, token);
    else sessionStorage.removeItem(RESET_TOKEN_STORAGE_KEY);
  } catch {
    /* sin storage: el token sigue en memoria mientras la página esté abierta */
  }
}

function readToken(): string | null {
  try {
    return sessionStorage.getItem(RESET_TOKEN_STORAGE_KEY);
  } catch {
    return null;
  }
}

/**
 * Crear contraseña con un enlace de un solo uso: invitación al equipo, primer ingreso con la
 * contraseña temporal o "olvidé mi contraseña". Al guardarla entra directo al CRM.
 */
export default function RestablecerClavePage() {
  const router = useRouter();
  const [status, setStatus] = useState<"checking" | "ready" | "invalid">("checking");
  const [token, setToken] = useState<string | null>(null);
  const [purpose, setPurpose] = useState<Purpose>("reset");
  const [maskedEmail, setMaskedEmail] = useState<string | null>(null);
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    let active = true;
    (async () => {
      // El token llega en la URL del correo o, desde el login con contraseña temporal, en
      // sessionStorage. Se saca de la URL apenas se lee para que no quede en el historial.
      const params = new URLSearchParams(window.location.search);
      const fromUrl = params.get("token");
      if (fromUrl) {
        storeToken(fromUrl);
        params.delete("token");
        const rest = params.toString();
        window.history.replaceState(null, "", `${window.location.pathname}${rest ? `?${rest}` : ""}`);
      }
      const candidate = fromUrl || readToken();
      if (!candidate) {
        if (active) setStatus("invalid");
        return;
      }
      const res = await fetch("/api/auth/password-reset/verify", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token: candidate }),
      }).catch(() => null);
      const data = (await res?.json().catch(() => ({}))) as
        | { valid?: boolean; purpose?: Purpose; email?: string }
        | undefined;
      if (!active) return;
      if (!data?.valid) {
        storeToken(null);
        setStatus("invalid");
        return;
      }
      setToken(candidate);
      setPurpose(data.purpose ?? "reset");
      setMaskedEmail(data.email ?? null);
      setStatus("ready");
    })();
    return () => {
      active = false;
    };
  }, []);

  const mismatch = confirm.length > 0 && confirm !== password;
  const canSubmit = isStrongPassword(password) && confirm === password && !saving;

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!token || !canSubmit) return;
    setError(null);
    setSaving(true);
    try {
      const res = await fetch("/api/auth/password-reset/confirm", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token, newPassword: password }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        if (data?.code === "invalid_reset_token") {
          storeToken(null);
          setStatus("invalid");
        } else {
          setError(data?.error || "No pudimos guardar tu contraseña. Inténtalo de nuevo.");
        }
        return;
      }
      storeToken(null);

      // Entra directo con la clave nueva. Si la cuenta no es de una automotora, el login lo
      // rechaza y queda en la pantalla de ingreso con el aviso de clave lista.
      const login = data?.email
        ? await fetch("/api/auth/login", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ email: data.email, password }),
          }).catch(() => null)
        : null;
      if (login?.ok) {
        router.replace("/");
        router.refresh();
      } else {
        router.replace("/login?passwordUpdated=1");
      }
    } catch {
      setError("No pudimos conectar con el servidor. Revisa tu conexión.");
    } finally {
      setSaving(false);
    }
  };

  const isFirst = purpose !== "reset";

  return (
    <AuthShell>
      {status === "checking" && (
        <p className="flex items-center gap-2 text-sm text-[var(--muted-foreground)]">
          <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
          Validando tu enlace…
        </p>
      )}

      {status === "invalid" && (
        <>
          <h1 className="text-xl font-semibold tracking-tight">El enlace no es válido</h1>
          <p className="mt-1 text-sm text-[var(--muted-foreground)]">
            Ya se usó o caducó. Por seguridad cada enlace sirve una sola vez. Pide uno nuevo con
            tu correo, o pídele a tu administrador que te invite de nuevo.
          </p>
          <Link
            href="/recuperar-clave"
            className="mt-6 flex w-full items-center justify-center gap-2 rounded-[var(--radius-md)] bg-[var(--primary)] px-4 py-2.5 text-sm font-medium text-white"
          >
            Pedir un enlace nuevo
          </Link>
          <Link href="/login" className="mt-4 inline-block text-xs font-medium text-[var(--primary)] hover:underline">
            Volver a ingresar
          </Link>
        </>
      )}

      {status === "ready" && (
        <>
          <h1 className="text-xl font-semibold tracking-tight">
            {isFirst ? "Crea tu contraseña" : "Crea una contraseña nueva"}
          </h1>
          <p className="mt-1 text-sm text-[var(--muted-foreground)]">
            {isFirst
              ? "Reemplaza la contraseña temporal por una que solo tú conozcas."
              : "Al guardarla se cerrarán tus sesiones abiertas en otros equipos."}
            {maskedEmail && (
              <>
                {" "}Cuenta: <span className="font-medium text-[var(--foreground)]">{maskedEmail}</span>
              </>
            )}
          </p>

          <form onSubmit={submit} className="mt-6 space-y-4">
            <div>
              <label htmlFor="new-password" className="mb-1.5 block text-xs font-medium">
                Contraseña nueva
              </label>
              <div className="relative">
                <input
                  id="new-password"
                  type={showPassword ? "text" : "password"}
                  autoComplete="new-password"
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full rounded-[var(--radius-md)] border border-[var(--border)] bg-[var(--card)] py-2.5 pl-3 pr-11 outline-none focus:border-[var(--primary)]"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword((visible) => !visible)}
                  aria-label={showPassword ? "Ocultar contraseña" : "Mostrar contraseña"}
                  aria-pressed={showPassword}
                  className="absolute inset-y-0 right-0 flex w-11 items-center justify-center text-[var(--muted-foreground)] hover:text-[var(--foreground)] focus-visible:outline-2 focus-visible:outline-offset-[-3px] focus-visible:outline-[var(--primary)]"
                >
                  {showPassword ? <EyeOff className="h-4 w-4" aria-hidden="true" /> : <Eye className="h-4 w-4" aria-hidden="true" />}
                </button>
              </div>
              <ul className="mt-2 space-y-1 text-xs" aria-label="Requisitos de la contraseña">
                {PASSWORD_RULES.map((rule) => {
                  const ok = rule.test(password);
                  return (
                    <li
                      key={rule.label}
                      className={`flex items-center gap-1.5 ${ok ? "text-[var(--primary)]" : "text-[var(--muted-foreground)]"}`}
                    >
                      {ok ? <Check className="h-3.5 w-3.5" aria-hidden="true" /> : <Circle className="h-3 w-3" aria-hidden="true" />}
                      {rule.label}
                    </li>
                  );
                })}
              </ul>
            </div>

            <div>
              <label htmlFor="confirm-password" className="mb-1.5 block text-xs font-medium">
                Repite la contraseña
              </label>
              <input
                id="confirm-password"
                type={showPassword ? "text" : "password"}
                autoComplete="new-password"
                required
                value={confirm}
                onChange={(e) => setConfirm(e.target.value)}
                aria-invalid={mismatch || undefined}
                className={`w-full rounded-[var(--radius-md)] border bg-[var(--card)] px-3 py-2.5 outline-none focus:border-[var(--primary)] ${
                  mismatch ? "border-red-400" : "border-[var(--border)]"
                }`}
              />
              {mismatch && <p className="mt-1 text-xs text-red-600">Las contraseñas no coinciden.</p>}
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
              disabled={!canSubmit}
              className="flex w-full items-center justify-center gap-2 rounded-[var(--radius-md)] bg-[var(--primary)] px-4 py-2.5 text-sm font-medium text-white transition-opacity disabled:opacity-60"
            >
              {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <KeyRound className="h-4 w-4" />}
              {saving ? "Guardando…" : "Guardar y entrar al CRM"}
            </button>
          </form>
        </>
      )}
    </AuthShell>
  );
}

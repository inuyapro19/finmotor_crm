"use client";

import { useState } from "react";
import Link from "next/link";
import { ArrowLeft, Loader2, MailCheck, Send } from "lucide-react";
import { AuthShell } from "@/components/auth/auth-shell";

export default function RecuperarClavePage() {
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      const res = await fetch("/api/auth/recovery", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(data?.error || "No pudimos enviar el correo. Inténtalo de nuevo.");
        return;
      }
      setSent(true);
    } catch {
      setError("No pudimos conectar con el servidor. Revisa tu conexión.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <AuthShell>
      <h1 className="text-xl font-semibold tracking-tight">Recupera tu acceso</h1>
      <p className="mt-1 text-sm text-[var(--muted-foreground)]">
        Te enviaremos un enlace para crear una contraseña nueva. Sirve una sola vez y caduca en
        30 minutos.
      </p>

      {sent ? (
        <div
          role="status"
          className="mt-6 flex items-start gap-3 rounded-[var(--radius-md)] border border-[var(--accent)] bg-[var(--accent)] px-4 py-3 text-sm text-[var(--accent-foreground)]"
        >
          <MailCheck className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
          <span>
            Si <strong>{email}</strong> tiene una cuenta, te llegará el enlace en unos minutos.
            Revisa también la carpeta de spam.
          </span>
        </div>
      ) : (
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
            {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
            {loading ? "Enviando…" : "Enviarme el enlace"}
          </button>
        </form>
      )}

      <Link
        href="/login"
        className="mt-6 inline-flex items-center gap-1.5 text-xs font-medium text-[var(--primary)] hover:underline"
      >
        <ArrowLeft className="h-3.5 w-3.5" aria-hidden="true" />
        Volver a ingresar
      </Link>
    </AuthShell>
  );
}

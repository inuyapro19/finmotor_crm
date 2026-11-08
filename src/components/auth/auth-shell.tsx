import Image from "next/image";

/**
 * Marco de las pantallas sin sesión del CRM (login, recuperar y restablecer contraseña):
 * panel de marca a la izquierda en escritorio y el formulario a la derecha.
 */
export function AuthShell({ children }: { children: React.ReactNode }) {
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
          {children}
        </div>
      </div>
    </main>
  );
}

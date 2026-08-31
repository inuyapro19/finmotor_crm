# Finmotor CRM (`frontend-crm`)

CRM de **automotoras**. Tercer frontend del proyecto, separado a propósito:

| App | Dominio | Para quién |
|---|---|---|
| `frontend-web` | finmotor.cl | Público: compradores y vendedores particulares |
| `frontend-backoffice` | admin.finmotor.cl | Consola interna de Finmotor + financiera matriz |
| **`frontend-crm`** | **crm.finmotor.cl** | **Automotoras: administrador, supervisor y agentes** |

Los tres consumen el **mismo backend FastAPI**. Este no habla con Supabase.

## Regla de acceso

Al CRM entran **sólo automotoras**. El backend (`require_backoffice_access`) también deja
pasar al superadmin de Finmotor y a la financiera matriz, así que este frontend exige
**además** una membresía activa en una organización `type = 'dealership'`:

- `src/app/api/auth/login/route.ts` — lo verifica antes de dejar cookies de sesión.
- `src/lib/auth/session.ts` — `getCrmSession()` devuelve `null` sin automotora.
- `src/app/(app)/layout.tsx` — sin sesión válida, redirige a `/login`.

**Cada agente tiene su propia cuenta.** Las cuentas las crea el administrador de la
automotora (hoy desde la consola interna: `POST /backoffice/team/members`, que envía el
correo de invitación con contraseña temporal).

## Roles

| Rol del negocio | Rol técnico (`organization_members.role`) | Alcance |
|---|---|---|
| Administrador automotora | `owner`, `admin` | Todo lo de su automotora |
| Supervisor automotora | `manager` | Su equipo: reasignar, ver toda la cartera |
| Agente de ventas | `salesperson` y operadores | **Sólo su cartera** |
| Sólo lectura | `viewer` | Lectura |

El mapeo vive en `src/lib/auth/roles.ts` y **no requiere migración**: los roles técnicos ya
existen en el backend.

**El acote por agente lo aplica el backend** (no la interfaz): `resolve_backoffice_scope`
marca `portfolio_restricted` para quien no tiene rol administrativo en ninguna de sus
automotoras, y el repositorio filtra por `commercial_leads.assigned_to`. Un agente no recibe
leads ajenos ni consultando el API directamente. `/backoffice/buyers` está acotado con la
misma regla. El flag viaja en `GET /backoffice/scope` como `portfolioRestricted`, y el
frontend lo **usa** en vez de deducirlo del rol.

`visibleLeads()` se conserva como defensa en profundidad, no como autorización.

## Modelo mental

El cliente **no entra al sistema**: deja sus datos en una publicación y el agente lo llama
por teléfono o WhatsApp. Por eso el CRM es una **bandeja de solicitudes** más el registro de
la gestión, no un flujo colaborativo. Las acciones de contacto están siempre a un toque.

El stock es **una unidad por patente**: en usados no existe "3 disponibles del mismo modelo".

## Pantallas

| Ruta | Qué es | Estado |
|---|---|---|
| `/` | **Mi día**: sin contactar, en gestión, stock | ✅ datos reales |
| `/solicitudes` | Bandeja con filtros por etapa | ✅ |
| `/solicitudes/[id]` | Ficha: contacto, vehículo, servicios, responsable | ✅ contacto y reasignación |
| `/stock` | Unidades por patente, con búsqueda y rotación | ✅ |
| `/equipo` | Personas y carga de trabajo (admin/supervisor) | ✅ lectura |

## Desarrollo

```bash
cp .env.local.example .env.local   # y completa FINMOTOR_SERVICE_KEY
npm install
npm run dev                        # http://localhost:3002
```

Requiere el backend corriendo (`cd finmotor_backend && docker compose up -d`, puerto 8098).
Si el backend está caído, el CRM redirige al login en vez de romper.

```bash
npm run typecheck   # tsc --noEmit
npm run build
```

## Sesión: refresco y guard

- **`src/proxy.ts`** (en Next.js 16 el middleware se llama así, no `middleware.ts`) renueva el
  access token antes de renderizar. Sin esto, el token de ~60 min expira y el agente es
  expulsado al login en media jornada. `POST /auth/refresh` **rota** el refresh token, así que
  sólo se refresca en navegaciones de documento — refrescos concurrentes se invalidarían entre
  sí. La request en curso ve el token nuevo porque se reescriben también las cookies de
  entrada.
- **Las páginas usan `requireCrmSession()`, nunca `getCrmSession()!`.** En el App Router el
  layout y la página se renderizan **en paralelo**: el `redirect()` del layout no impide que
  la página ejecute su código, así que una aserción no-nula revienta con la sesión expirada.
  `requireCrmSession()` redirige (lanza) y de paso estrecha el tipo.

## Notas de implementación

- **Sin `next/font/google`**: la tipografía se declara como pila de sistema en
  `globals.css` para que `npm run dev` no dependa de descargar Poppins (bloqueado en algunas
  redes locales — la razón por la que `frontend-web` se compila en el VPS). Para alinear la
  tipografía basta cambiar `--font-ui`.
- **Móvil primero**: navegación inferior en el teléfono, barra lateral en escritorio. Inputs a
  16px para que iOS no haga zoom al enfocar.
- `src/lib/api/client.ts` es idéntico al del backoffice a propósito: cuando exista el
  workspace del monorepo, ambos colapsan en `@finmotor/bff-auth`.

## Lo que falta (del plan)

Ver `docs/crm-automotoras/REVISION_Y_PLAN_CRM_AUTOMOTORAS.md`.

1. **F1 — backend**: emisores de `commercial_leads` (formulario público sin cuenta), columnas
   `contact_name/phone/email/rut`, tablas `lead_activities` / `lead_tasks` / `lead_visits`,
   y acote por agente. **Sin esto la bandeja está vacía en producción.**
2. **F0.5**: alta de automotoras (`POST /backoffice/organizations`, hoy no existe).
3. **F2**: registro de resultado de llamada, notas, tareas y kanban.
4. **F5**: iniciar informes, visitas, transferencia, contrato y cotizador desde la ficha.

## Despliegue (aún no configurado)

No está en `deploy/docker-compose.finmotor.yml` — se agrega cuando se decida publicarlo.
Bloque sugerido, siguiendo el patrón de los otros dos servicios:

```yaml
  frontend-crm:
    image: finmotor-frontend-crm:prod
    container_name: finmotor_frontend_crm
    restart: unless-stopped
    env_file:
      - ./frontend-crm.env
    environment:
      NODE_ENV: production
      NEXT_PUBLIC_APP_URL: https://crm.finmotor.cl
      NEXT_PUBLIC_API_ORIGIN: https://api.finmotor.cl
      NEXT_PUBLIC_MEDIA_ORIGIN: https://api.finmotor.cl
    depends_on:
      - api
    networks: [web, internal]
    labels:
      - traefik.enable=true
      - traefik.docker.network=web
      - traefik.http.routers.finmotor-crm.rule=Host(`crm.finmotor.cl`)
      - traefik.http.routers.finmotor-crm.entrypoints=websecure
      - traefik.http.routers.finmotor-crm.tls.certresolver=letsencrypt
      - traefik.http.services.finmotor-crm.loadbalancer.server.port=3002
```

# Finmotor CRM (`frontend-crm`)

CRM de **automotoras** en [crm.finmotor.cl](https://crm.finmotor.cl): solicitudes de clientes, stock por patente, captación, créditos, informes, transferencias y el **marketplace mayorista** de proveedores. El mismo frontend tiene un portal separado para los **proveedores mayoristas** (`/proveedor`).

| | |
|---|---|
| **Stack** | Next.js 16 (App Router) · React 19 · TypeScript · Tailwind CSS v4 |
| **Backend** | `finmotor_backend` (FastAPI). Este frontend no usa Supabase |
| **Puerto local** | `3002` |

## Cómo encaja con el resto

| Proyecto | Dominio | Para quién |
|---|---|---|
| `frontend-web` | `finmotor.cl` | Compradores y vendedores particulares |
| **frontend-crm** (este) | `crm.finmotor.cl` | Automotoras: administrador, supervisor y agentes; y proveedores mayoristas |
| `frontend-backoffice` | `admin.finmotor.cl` | Equipo interno de Finmotor |
| `finmotor_backend` | `api.finmotor.cl` | API para todos los frontends |

## Acceso y roles

Al CRM entran **solo automotoras**: además de la sesión, se exige una membresía activa en una organización de tipo `dealership`. Un proveedor mayorista usa la misma cuenta pero se le redirige a `/proveedor`.

| Rol del negocio | Rol técnico (`organization_members.role`) | Alcance |
|---|---|---|
| Administrador | `owner`, `admin` | Todo lo de su automotora |
| Supervisor | `manager` | Su equipo: reasignar y ver toda la cartera |
| Agente de ventas | `salesperson` y operadores | **Solo su cartera** |
| Solo lectura | `viewer` | Lectura |

**El backend aplica el acote por agente**, no la interfaz: un agente no recibe leads ajenos ni consultando la API directamente.

## Pantallas

| Ruta | Qué es |
|---|---|
| `/` | **Mi día**: sin contactar, en gestión y stock |
| `/solicitudes` | Bandeja de leads con etapas, ficha, documentos, parte de pago y cierre de venta |
| `/stock`, `/vehiculos`, `/historial-stock` | Unidades por patente, ingreso al inventario y rotación |
| `/captacion` | Consignación, compra y permuta con contrato y comisión |
| `/creditos`, `/informes`, `/informes-precompra`, `/transferencias` | Kit de compraventa |
| `/mayorista` | **Marketplace de proveedores**: subastas con puja en un clic, "Mis pujas" y tratos |
| `/reportes`, `/ingresos` | Reportes y facturación |
| `/equipo`, `/sucursales`, `/perfil` | Administración de la automotora |
| `/proveedor/*` | Portal del proveedor mayorista: vehículos, negociaciones, equipo y sucursales |

### Subastas del marketplace mayorista

- Cada tarjeta muestra la cuenta regresiva, el precio o la puja actual y el estado **"Vas ganando"** o **"Te superaron"**.
- **Puja en un clic** (`src/components/wholesale/quick-bid.tsx`): el botón trae el mínimo siguiente ya calculado, con atajos de +1 y +3 incrementos. Como la puja es vinculante, se envía **3 segundos después** con opción de **Cancelar**.
- La página se actualiza cada 15 segundos mientras hay subastas abiertas.
- Solo administradores y supervisores pueden pujar.

## Desarrollo local

```bash
cp .env.local.example .env.local   # completa FINMOTOR_SERVICE_KEY y FINMOTOR_BACKEND_SECRET
npm install
npm run dev                        # http://localhost:3002
```

Requiere el backend corriendo (`cd finmotor_backend && docker compose up -d`, puerto `8098`). Si el backend está caído, el CRM redirige al login en vez de romperse.

```bash
npm run typecheck   # tsc --noEmit
npm run build
npm run dev:demo    # entorno demo aislado
```

## Variables de entorno

| Variable | Para qué |
|---|---|
| `BACKEND_API_URL` | URL del backend (en el VPS: `http://api:8098`) |
| `FINMOTOR_SERVICE_KEY`, `FINMOTOR_BACKEND_SECRET` | Credenciales del BFF hacia el backend |
| `NEXT_PUBLIC_API_ORIGIN` | Origen público de la API (CSP `connect-src`) |
| `NEXT_PUBLIC_MEDIA_ORIGIN` | Origen público de las fotos (MinIO) |
| `NEXT_PUBLIC_BLOB_ORIGIN` | Origen de Azure Blob (preproducción en Azure) |
| `NEXT_PUBLIC_APP_URL`, `WEB_APP_URL` | URL del CRM y del sitio público |

Las variables `NEXT_PUBLIC_*` y la CSP se fijan **al compilar**. `next build` exige `BACKEND_API_URL` y `FINMOTOR_SERVICE_KEY`; para compilar se puede usar un valor de relleno, porque en ejecución se lee el real.

## Despliegue

Producción corre en el VPS como imagen `finmotor-frontend-crm:prod` (puerto `3002`) detrás de Traefik, en `crm.finmotor.cl`. Se compila con `Dockerfile.vpsbuild`.

## Notas importantes

- **Sesión:** `src/proxy.ts` (el middleware en Next.js 16) renueva el access token antes de renderizar, solo en navegaciones de documento, porque el refresh token rota.
- **Las páginas usan `requireCrmSession()`, nunca `getCrmSession()!`.** El layout y la página se renderizan en paralelo, así que una aserción no nula falla con la sesión expirada.
- **Subidas directas:** `src/lib/storage/direct-upload.ts` agrega `x-ms-blob-type: BlockBlob` solo para Azure Blob. El logo de la automotora no lo necesita, porque sube por el BFF.
- **Fotos del inventario:** se comprimen a JPEG antes de subir, porque Chileautos solo acepta JPG.
- **Móvil primero:** navegación inferior en el teléfono y barra lateral en escritorio.

## Registro de cambios

### 2026-11-08 — Puja en un clic y Azure Blob
- **Marketplace de proveedores:** las unidades vuelven a aparecer. El backend abre la subasta a las unidades publicadas antes de las subastas (migración `0088`).
- **Puja en un clic** en la tarjeta y en la ficha, con atajos de incremento, cuenta regresiva, "vas ganando / te superaron" y 3 segundos para cancelar. La ficha conserva "Pujar otro monto".
- Subidas y CSP compatibles con **Azure Blob**.
- Se versionó el trabajo previo sin commit: tokens prepago de informes, comisión de captación, parte de pago, carpeta de documentos del lead, recuperar clave, modo demo, compresión de fotos a JPEG y subidas del proveedor mayorista.

### 2026-09-22 — MIA en el CRM
- MIA sugiere la siguiente acción y le indica a cada agente en qué enfocarse.

### 2026-09-21 — Cierre de venta
- Cierre de venta, inteligencia de MIA y vocabulario único en todo el CRM.

### 2026-08-31 — Primera versión
- Bandeja de solicitudes, ficha del lead, stock por patente y equipo, con acote por agente.

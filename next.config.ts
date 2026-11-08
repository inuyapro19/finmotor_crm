import type { NextConfig } from "next";

/**
 * Config del CRM de automotoras (`crm.finmotor.cl`).
 *
 * A diferencia del backoffice interno, este frontend NO habla con Supabase: su única
 * fuente es el backend FastAPI a través del BFF (route handlers de `src/app/api`). Por eso
 * `connect-src` sólo necesita 'self' y el host del API en producción.
 *
 * Las fotos de vehículos vienen de MinIO (dev: localhost:9098, prod: api.finmotor.cl) o de
 * Azure Blob (preproducción en Azure, NEXT_PUBLIC_BLOB_ORIGIN), igual que en el frontend-web.
 * Si se agrega otro host de imágenes hay que sumarlo a `img-src`
 * Y a `remotePatterns`, o next/image responde 400.
 */
const isProduction = process.env.NODE_ENV === "production";

function configuredOrigin(name: string, value: string | undefined, developmentFallback: string) {
  const configured = value?.trim() || (!isProduction ? developmentFallback : "");
  if (!configured) throw new Error(`Missing required environment variable: ${name}`);
  return new URL(configured).origin;
}

const mediaOrigin = configuredOrigin(
  "NEXT_PUBLIC_MEDIA_ORIGIN",
  process.env.NEXT_PUBLIC_MEDIA_ORIGIN,
  "http://localhost:9098",
);
// Azure Blob (preproducción en Azure): con STORAGE_BACKEND=azure el backend firma las subidas
// y guarda fotos/documentos en la cuenta de Storage. Origen exacto, no *.blob.core.windows.net.
const blobOrigin = new URL(
  process.env.NEXT_PUBLIC_BLOB_ORIGIN?.trim() || "https://finmotorstv5z7viurqsaqg.blob.core.windows.net",
).origin;
const apiOrigin = configuredOrigin(
  "NEXT_PUBLIC_API_ORIGIN",
  process.env.NEXT_PUBLIC_API_ORIGIN,
  "http://localhost:8098",
);

const nextConfig: NextConfig = {
  distDir: process.env.FINMOTOR_DEMO_MODE === "true" ? ".next-demo" : ".next",
  output: "standalone",
  images: {
    // Next sirve las imágenes optimizadas con `Content-Disposition: attachment` por defecto
    // (defensa contra SVG maliciosos servidos desde el propio origen). Algunos navegadores
    // no pintan un <img> marcado como descarga: el banner del login quedaba en blanco. Como
    // `dangerouslyAllowSVG` está apagado, por el optimizador sólo pasan bitmaps y servirlos
    // inline no abre esa puerta.
    contentDispositionType: "inline",
    remotePatterns: [
      {
        protocol: mediaOrigin.startsWith("https") ? "https" : "http",
        hostname: new URL(mediaOrigin).hostname,
        port: new URL(mediaOrigin).port || undefined,
      },
      { protocol: "https", hostname: new URL(blobOrigin).hostname },
    ],
  },
  async headers() {
    return [
      {
        source: "/(.*)",
        headers: [
          ...(process.env.FINMOTOR_DEMO_MODE === "true" ? [
            { key: "X-Robots-Tag", value: "noindex, nofollow, noarchive" },
            { key: "X-Finmotor-Environment", value: "demo" },
            { key: "Cache-Control", value: "no-store" },
          ] : []),
          { key: "X-Frame-Options", value: "DENY" },
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=()" },
          {
            key: "Content-Security-Policy",
            value: [
              "default-src 'self'",
              `img-src 'self' data: blob: ${mediaOrigin} ${blobOrigin}`,
              `connect-src 'self' ${apiOrigin} ${mediaOrigin} ${blobOrigin}`,
              `script-src 'self' 'unsafe-inline'${isProduction ? "" : " 'unsafe-eval'"}`,
              "style-src 'self' 'unsafe-inline'",
              "font-src 'self' data:",
              "frame-ancestors 'none'",
            ].join("; "),
          },
        ],
      },
    ];
  },
};

export default nextConfig;

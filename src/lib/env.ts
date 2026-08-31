export function requiredServerEnv(
  name: string,
  value: string | undefined,
  developmentFallback?: string,
): string {
  const configured = value?.trim();
  if (configured) return configured;
  if (process.env.NODE_ENV !== "production" && developmentFallback) return developmentFallback;
  throw new Error(`Missing required environment variable: ${name}`);
}

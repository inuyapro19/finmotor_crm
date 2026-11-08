import "server-only";
import { notFound } from "next/navigation";

export function requireDemoFrontend() {
  if (process.env.FINMOTOR_DEMO_MODE !== "true") notFound();
}

export type DemoStatus = {
  generation: number;
  resetAt: string | null;
  canReset: boolean;
  externalActions: "blocked";
};

export function validDemoMutation(request: Request) {
  if (process.env.FINMOTOR_DEMO_MODE !== "true") return false;
  const origin = request.headers.get("origin");
  return origin === new URL(request.url).origin && request.headers.get("content-type")?.startsWith("application/json");
}

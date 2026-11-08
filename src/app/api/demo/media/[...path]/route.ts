import { NextResponse } from "next/server";
import { apiFetch } from "@/lib/api/client";

export async function GET(_request: Request, { params }: { params: Promise<{ path: string[] }> }) {
  if (process.env.FINMOTOR_DEMO_MODE !== "true") return NextResponse.json({ detail: "not_found" }, { status: 404 });
  const { path } = await params;
  const upstream = await apiFetch(`/demo/media/${path.map(encodeURIComponent).join("/")}`, { auth: true });
  return new Response(upstream.body, { status: upstream.status, headers: {
    "Content-Type": upstream.headers.get("content-type") || "application/octet-stream",
    "Cache-Control": "no-store", "X-Content-Type-Options": "nosniff",
  } });
}

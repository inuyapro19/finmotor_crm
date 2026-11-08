import { NextResponse } from "next/server";
import { apiFetch } from "@/lib/api/client";
import { validDemoMutation } from "@/lib/demo";

export async function POST(request: Request) {
  if (process.env.FINMOTOR_DEMO_MODE !== "true") return NextResponse.json({ detail: "not_found" }, { status: 404 });
  if (!validDemoMutation(request)) return NextResponse.json({ detail: "invalid_origin" }, { status: 403 });
  const upstream = await apiFetch("/demo/reset", { method: "POST", auth: true, body: await request.text() });
  return NextResponse.json(await upstream.json(), { status: upstream.status, headers: { "Cache-Control": "no-store" } });
}

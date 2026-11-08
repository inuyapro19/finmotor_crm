import { NextResponse } from "next/server";
import { forwardWholesale } from "@/lib/api/wholesale-proxy";
import { canWrite, requireCrmApiSession } from "@/lib/auth/session";

type Ctx = { params: Promise<{ path: string[] }> };

/**
 * BFF del marketplace mayorista para la automotora: `/api/crm/wholesale/*` →
 * `/wholesale/market/*`. Quién puede ofertar (owner/admin/manager) lo decide el backend.
 */
async function handle(request: Request, { params }: Ctx) {
  const auth = await requireCrmApiSession();
  if (!auth.ok) return auth.response;
  if (request.method !== "GET" && !canWrite(auth.session.role)) {
    return NextResponse.json({ error: "Tu cuenta es de solo lectura" }, { status: 403 });
  }
  const { path } = await params;
  return forwardWholesale(request, "/wholesale/market", path);
}

export { handle as GET, handle as POST };

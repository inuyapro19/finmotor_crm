import { sourcingProxy } from "@/lib/api/sourcing-proxy";
export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  return sourcingProxy(request, (await params).id);
}

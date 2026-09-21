import { sourcingProxy } from "@/lib/api/sourcing-proxy";
export async function POST(request: Request) { return sourcingProxy(request); }

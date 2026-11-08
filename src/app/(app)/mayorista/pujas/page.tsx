import Link from "next/link";

import { MarketCard } from "@/components/wholesale/market/market-card";
import { backendJson } from "@/lib/api/client";
import { canManageTeam } from "@/lib/auth/roles";
import { requireCrmSession } from "@/lib/auth/session";
import type { WholesaleListing } from "@/lib/wholesale";

export default async function MyBidsPage() {
  const session = await requireCrmSession();
  const { items } = await backendJson<{ items: WholesaleListing[] }>("/wholesale/market/bids");
  return <div className="space-y-5">
    <Link href="/mayorista" className="text-sm underline">Volver a las subastas</Link>
    <h1 className="text-2xl font-bold">Mis pujas</h1>
    <p className="text-sm">Últimas 200 subastas en las que participó tu automotora. Abre una ficha para revisar el resultado y, si ganaste, confirmar la recepción.</p>
    {!items.length && <p>Todavía no tienes pujas registradas.</p>}
    <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">{items.map((item) => <MarketCard key={item.id} item={item} canBuy={canManageTeam(session.role)} />)}</div>
  </div>;
}

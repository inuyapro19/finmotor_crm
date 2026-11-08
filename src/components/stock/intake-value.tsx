import { commissionLabel } from "@/lib/commission";
import type { InventoryHistoryItem } from "@/lib/data/crm";
import { fmtCLP } from "@/lib/format";

export function IntakeValue({ item }: { item: InventoryHistoryItem }) {
  const label = item.acquisitionKind === "trade_in" ? "Valor de recepción" : item.acquisitionKind === "consignment" ? "Mínimo autorizado" : "Precio de compra";
  const amount = item.acquisitionKind === "trade_in" ? item.tradeInValue : item.acquisitionKind === "consignment" ? item.minPrice : item.purchasePrice;
  return <>{fmtCLP(amount)}<span className="block font-sans text-[10px] font-normal text-[var(--muted-foreground)]">{label}{item.acquisitionKind === "consignment" ? ` · Comisión ${commissionLabel(item)}` : ""}</span></>;
}

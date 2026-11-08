export function tokenPurchaseError(detail: unknown): string {
  const map: Record<string, string> = {
    report_token_pack_not_available: "Ese pack ya no está disponible para tu plan. Recarga la página.",
    report_token_account_not_found: "Tu automotora aún no tiene cuenta de tokens. Escríbenos y la activamos.",
    report_token_purchase_not_found: "No encontramos esa compra.",
    report_token_payment_mismatch: "El pago no corresponde a esta compra.",
    missing_mercadopago_access_token: "MercadoPago no está disponible en este momento. Intenta en unos minutos.",
    insufficient_org_role: "Tu cuenta es de sólo lectura.",
  };
  const key = String(detail ?? "");
  if (key.startsWith("mercadopago_")) return "MercadoPago no está disponible en este momento. Intenta en unos minutos.";
  return map[key] || "No pudimos procesar la compra de tokens";
}

// Un navegador local puede abrir el CRM operativo y el demo sin mezclar sesiones.
const prefix = process.env.FINMOTOR_DEMO_MODE === "true" ? "fm-demo-crm" : "fm-crm";
export const ACCESS_COOKIE = `${prefix}-access`;
export const REFRESH_COOKIE = `${prefix}-refresh`;

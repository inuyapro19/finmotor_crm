/**
 * Restablecimiento de contraseña contra FastAPI (`/auth/password-reset/*`).
 *
 * El token es de un solo uso y caduca: 72 h en la invitación al equipo, 30 min en "olvidé mi
 * contraseña" y 15 min cuando se entra con la contraseña temporal. Nunca va a cookies ni a
 * localStorage: llega por la URL del correo (la página la limpia apenas la lee) o por
 * sessionStorage cuando viene del login con contraseña temporal.
 */
export const RESET_TOKEN_STORAGE_KEY = "fm-crm-password-reset-token";

/** Misma política que el backend: 8+ caracteres, una mayúscula y un número. */
export const PASSWORD_RULES = [
  { label: "Mínimo 8 caracteres", test: (value: string) => value.length >= 8 },
  { label: "Al menos una mayúscula", test: (value: string) => /[A-ZÁÉÍÓÚÑ]/.test(value) },
  { label: "Al menos un número", test: (value: string) => /\d/.test(value) },
] as const;

export function isStrongPassword(value: string): boolean {
  return PASSWORD_RULES.every((rule) => rule.test(value));
}

/** Mensaje para el usuario según el `detail` del backend. */
export function passwordResetErrorMessage(detail: unknown): string {
  switch (detail) {
    case "invalid_reset_token":
      return "Este enlace ya no es válido o caducó. Pide uno nuevo para continuar.";
    case "weak_password":
      return "La contraseña debe tener al menos 8 caracteres, una mayúscula y un número.";
    default:
      return "No pudimos guardar tu contraseña. Inténtalo de nuevo en unos minutos.";
  }
}

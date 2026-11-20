import { isAdminPushCategory, isPushCategory, type PushCategory } from "@/lib/notifications/categories";

/**
 * ¿Corresponde mandar push? (DR61 puntos 1 y 3). `none` nunca; las categorías `admin_*` solo a admins;
 * la preferencia del usuario decide el resto: sin fila = activado.
 */
export function shouldSendPush(input: {
  category: unknown;
  isAdmin: boolean;
  preferences: Partial<Record<PushCategory, boolean>>;
}): boolean {
  const { category, isAdmin, preferences } = input;
  if (!isPushCategory(category)) return false;
  if (isAdminPushCategory(category) && !isAdmin) return false;
  return preferences[category] !== false;
}

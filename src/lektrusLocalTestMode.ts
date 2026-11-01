/** Build-time, opt-in offline demonstration. Never enabled by device storage.
 * In a signed test update, previously connected production accounts and
 * Supabase credentials remain on disk but are not read or modified.
 * A normal production build disables this mode automatically.
 */
export const LEKTRUS_LOCAL_TEST_MODE=import.meta.env.VITE_LEKTRUS_LOCAL_TEST==="true";
export const LEKTRUS_LOCAL_TEST_USER={
 id:"00000000-0000-4000-8000-00000000a11f",
 name:"Учитель (локальный тест)",
 email:"local-test@lektrus.invalid",
 createdAt:"2026-01-01T00:00:00.000Z"
} as const;

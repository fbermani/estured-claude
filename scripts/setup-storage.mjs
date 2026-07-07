/**
 * Crea los buckets de Supabase Storage para el onboarding de residencias
 * (docs/06 §26). Idempotente: si el bucket ya existe, lo deja igual.
 *
 * Uso:
 *   node --env-file=.env.local scripts/setup-storage.mjs
 *
 * Buckets creados en este ciclo (los demás de docs/06 §26 se crean
 * cuando exista el módulo que los necesita: pagos, comprobantes, etc.):
 *   - public-residence-media: fotos de residencias. Lectura pública.
 *   - private-residence-documents: reglamentos internos. Privado —
 *     todo acceso pasa por server actions con service role, no hay
 *     policies de Storage (mismo patrón que la tabla `files`).
 */
import { createClient } from "@supabase/supabase-js";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!url || !serviceRoleKey) {
  console.error("Faltan env vars (correr con --env-file=.env.local).");
  process.exit(1);
}

const admin = createClient(url, serviceRoleKey, { auth: { persistSession: false } });

const BUCKETS = [
  {
    id: "public-residence-media",
    public: true,
    fileSizeLimit: 5 * 1024 * 1024, // 5MB, igual que el límite anunciado en la UI
    allowedMimeTypes: ["image/jpeg", "image/png", "image/webp"],
  },
  {
    id: "private-residence-documents",
    public: false,
    fileSizeLimit: 10 * 1024 * 1024,
    allowedMimeTypes: ["application/pdf"],
  },
];

for (const bucket of BUCKETS) {
  const { data: existing } = await admin.storage.getBucket(bucket.id);
  if (existing) {
    console.log(`= ${bucket.id} ya existe`);
    continue;
  }
  const { error } = await admin.storage.createBucket(bucket.id, {
    public: bucket.public,
    fileSizeLimit: bucket.fileSizeLimit,
    allowedMimeTypes: bucket.allowedMimeTypes,
  });
  if (error) {
    console.error(`✗ ${bucket.id}: ${error.message}`);
    continue;
  }
  console.log(`✓ ${bucket.id} creado (public=${bucket.public})`);
}

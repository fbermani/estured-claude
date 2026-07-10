/**
 * Seed de usuarios demo (docs/17 §Usuarios demo obligatorios).
 *
 * Uso:
 *   node --env-file=.env.local scripts/seed-demo-users.mjs
 *
 * Idempotente: si el usuario ya existe, actualiza la contraseña demo y
 * asegura roles/perfil. Todos comparten DEMO_USERS_PASSWORD.
 * Mantener sincronizado con lib/dev/demo-users.ts.
 */
import { createClient } from "@supabase/supabase-js";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const password = process.env.DEMO_USERS_PASSWORD;
if (!url || !serviceRoleKey || !password) {
  console.error(
    "Faltan env vars (NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, DEMO_USERS_PASSWORD). Correr con --env-file=.env.local",
  );
  process.exit(1);
}

const admin = createClient(url, serviceRoleKey, { auth: { persistSession: false } });

// docs/17: Lucia 19, Camila 21 (Chile), Valentina 17 (menor).
const SEEDS = [
  {
    email: "lucia.fernandez@example.com",
    role: "student",
    phone: "+54 9 341 555-0101",
    profile: {
      first_name: "Lucia",
      last_name: "Fernandez",
      birth_date: "2006-09-15",
      nationality: "Argentina",
      origin_city: "Rosario",
      career: "Medicina",
      study_institution_private: "Universidad en CABA",
      academic_objective:
        "Iniciar carrera universitaria en CABA durante el ciclo lectivo actual.",
      is_minor: false,
      visible: true,
    },
  },
  {
    email: "camila.rojas@example.com",
    role: "student",
    phone: "+56 9 5555 0102",
    profile: {
      first_name: "Camila",
      last_name: "Rojas",
      birth_date: "2005-03-10",
      nationality: "Chile",
      origin_city: "Santiago",
      origin_country: "Chile",
      career: "Diseño Gráfico",
      study_institution_private: "Institución educativa en CABA",
      academic_objective:
        "Realizar intercambio académico por un semestre en CABA.",
      is_minor: false,
      visible: true,
    },
  },
  {
    email: "valentina.sosa@example.com",
    role: "student",
    phone: "+54 9 351 555-0103",
    profile: {
      first_name: "Valentina",
      last_name: "Sosa",
      birth_date: "2009-02-20",
      nationality: "Argentina",
      origin_city: "Córdoba",
      career: "Arquitectura",
      study_institution_private: "Universidad en CABA",
      academic_objective:
        "Mudanza a CABA para inicio de estudios universitarios.",
      is_minor: true,
      visible: false,
    },
  },
  {
    email: "padre.lucia@example.com",
    role: "family_member",
    phone: "+54 9 341 555-0104",
    // docs/17 §Usuarios demo obligatorios #4: vínculo activo con Lucía, can_create_proposals=true.
    familyMemberProfile: { first_name: "Martin", last_name: "Fernandez", relationship_type: "padre" },
    linkedStudentEmail: "lucia.fernandez@example.com",
  },
  { email: "owner.residencia.norte@example.com", role: "residence_owner", phone: "+54 9 11 5555-0105" },
  { email: "staff.norte@estured.test", role: "residence_staff", phone: "+54 9 11 5555-0106" },
  { email: "admin.operaciones@estured.test", role: "admin", phone: null },
  { email: "superadmin@estured.test", role: "superadmin", phone: null },
];

function ageFrom(birthDateStr) {
  const b = new Date(`${birthDateStr}T00:00:00`);
  const t = new Date();
  let age = t.getFullYear() - b.getFullYear();
  if (
    t.getMonth() < b.getMonth() ||
    (t.getMonth() === b.getMonth() && t.getDate() < b.getDate())
  )
    age -= 1;
  return age;
}

for (const seed of SEEDS) {
  const email = seed.email.toLowerCase();

  // 1. Auth user (crear o actualizar contraseña demo).
  let userId;
  const { data: created, error: createError } =
    await admin.auth.admin.createUser({ email, password, email_confirm: true });
  if (createError) {
    if (createError.code === "email_exists") {
      const { data: existing } = await admin
        .from("users")
        .select("id")
        .eq("email", email)
        .maybeSingle();
      userId = existing?.id;
      if (userId) {
        await admin.auth.admin.updateUserById(userId, { password });
      } else {
        console.error(`✗ ${email}: existe en Auth pero no en public.users — saltando`);
        continue;
      }
    } else {
      console.error(`✗ ${email}: ${createError.message}`);
      continue;
    }
  } else {
    userId = created.user.id;
  }

  // 2. Identidad + rol.
  await admin.from("users").upsert({
    id: userId,
    email,
    phone: seed.phone,
    primary_role: seed.role,
  });
  const { error: roleError } = await admin.from("user_roles").upsert(
    { user_id: userId, role: seed.role, scope_type: "global", scope_id: null },
    { onConflict: "user_id,role,scope_type,scope_id" },
  );
  if (roleError && roleError.code !== "23505") {
    console.error(`✗ ${email} rol: ${roleError.message}`);
    continue;
  }

  // 3. Perfil de estudiante si aplica.
  if (seed.profile) {
    const p = seed.profile;
    const { data: profile, error: profileError } = await admin
      .from("student_profiles")
      .upsert(
        {
          user_id: userId,
          first_name: p.first_name,
          last_name: p.last_name,
          last_initial: p.last_name.charAt(0).toUpperCase() + ".",
          birth_date: p.birth_date,
          display_age: ageFrom(p.birth_date),
          nationality: p.nationality,
          origin_city: p.origin_city,
          origin_country: p.origin_country ?? null,
          career: p.career,
          study_institution_private: p.study_institution_private,
          academic_objective: p.academic_objective,
          is_minor: p.is_minor,
        },
        { onConflict: "user_id" },
      )
      .select("id")
      .single();
    if (profileError) {
      console.error(`✗ ${email} perfil: ${profileError.message}`);
      continue;
    }
    await admin.from("student_visibility_settings").upsert(
      {
        student_profile_id: profile.id,
        is_individual_profile_visible: p.visible,
      },
      { onConflict: "student_profile_id" },
    );
  }

  // 3bis. Perfil de familiar si aplica.
  if (seed.familyMemberProfile) {
    const fm = seed.familyMemberProfile;
    const { error: fmError } = await admin.from("family_members").upsert(
      {
        user_id: userId,
        first_name: fm.first_name,
        last_name: fm.last_name,
        relationship_type: fm.relationship_type,
        phone: seed.phone,
      },
      { onConflict: "user_id" },
    );
    if (fmError) console.error(`✗ ${email} perfil de familiar: ${fmError.message}`);
  }

  // 4. Consents demo + auditoría del seed.
  const { data: hasConsent } = await admin
    .from("consents")
    .select("id")
    .eq("user_id", userId)
    .eq("consent_type", "terms")
    .maybeSingle();
  if (!hasConsent) {
    await admin.from("consents").insert([
      { user_id: userId, consent_type: "terms", version: "v0.1-borrador", metadata: { demo: true } },
      { user_id: userId, consent_type: "privacy", version: "v0.1-borrador", metadata: { demo: true } },
    ]);
    await admin.from("audit_logs").insert({
      actor_user_id: null,
      actor_role: "system",
      action: "demo_user_seeded",
      entity_type: "users",
      entity_id: userId,
      is_system_action: true,
      source: "system",
      new_value: { email, role: seed.role },
    });
  }

  console.log(`✓ ${email} (${seed.role})`);
}

// 5. Vínculos familiares demo (docs/17 #4: Martín↔Lucía, link_status=active).
for (const seed of SEEDS) {
  if (!seed.linkedStudentEmail) continue;

  const { data: familyUser } = await admin.from("users").select("id").eq("email", seed.email).maybeSingle();
  const { data: familyMember } = await admin
    .from("family_members")
    .select("id")
    .eq("user_id", familyUser?.id)
    .maybeSingle();
  const { data: studentUser } = await admin
    .from("users")
    .select("id")
    .eq("email", seed.linkedStudentEmail)
    .maybeSingle();
  const { data: studentProfile } = await admin
    .from("student_profiles")
    .select("id")
    .eq("user_id", studentUser?.id)
    .maybeSingle();
  if (!familyMember || !studentProfile) {
    console.error(`✗ vínculo ${seed.email} → ${seed.linkedStudentEmail}: falta el familiar o el estudiante`);
    continue;
  }

  const { data: existingLink } = await admin
    .from("family_links")
    .select("id, status")
    .eq("family_member_id", familyMember.id)
    .eq("student_profile_id", studentProfile.id)
    .maybeSingle();
  if (existingLink) {
    if (existingLink.status !== "active") {
      await admin
        .from("family_links")
        .update({ status: "active", approved_at: new Date().toISOString() })
        .eq("id", existingLink.id);
    }
  } else {
    await admin.from("family_links").insert({
      student_profile_id: studentProfile.id,
      family_member_id: familyMember.id,
      status: "active",
      requested_by_user_id: familyUser.id,
      approved_at: new Date().toISOString(),
    });
  }
  console.log(`✓ vínculo activo ${seed.email} ↔ ${seed.linkedStudentEmail}`);
}

console.log("\nSeed de usuarios demo completo.");

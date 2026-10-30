import type { SupabaseClient } from "@supabase/supabase-js";

export type TestStudent = { userId: string; profileId: string; email: string };

/** Crea un estudiante descartable (auth + users + rol + perfil) para tests de integración. */
export async function createTestStudent(admin: SupabaseClient, tag: string): Promise<TestStudent> {
  const email = `test-${tag}-${Date.now()}-${Math.floor(Math.random() * 1e6)}@estured.test`;
  const { data: created, error } = await admin.auth.admin.createUser({
    email,
    password: `Tmp-${Math.random().toString(36).slice(2)}-Aa1!`,
    email_confirm: true,
  });
  if (error || !created.user) throw new Error(`fixture estudiante: ${error?.message}`);
  const userId = created.user.id;
  await admin.from("users").insert({ id: userId, email, phone: "+54 11 5555-0000", primary_role: "student" });
  await admin.from("user_roles").insert({ user_id: userId, role: "student", scope_type: "global" });
  const { data: profile, error: profileError } = await admin
    .from("student_profiles")
    .insert({
      user_id: userId,
      first_name: "Test",
      last_name: "Integración",
      last_initial: "I.",
      birth_date: "2002-01-01",
      display_age: 24,
      nationality: "AR",
      origin_city: "Córdoba",
      career: "Test",
      study_institution_private: "Test",
      academic_objective: "Objetivo académico de prueba (test de integración).",
      is_minor: false,
    })
    .select("id")
    .single();
  if (profileError || !profile) throw new Error(`fixture perfil: ${profileError?.message}`);
  return { userId, profileId: profile.id as string, email };
}

/** Borra el estudiante descartable. Las solicitudes/reservas deben haberse borrado antes. */
export async function deleteTestStudent(admin: SupabaseClient, student: TestStudent | undefined) {
  if (!student) return;
  await admin.from("student_visibility_settings").delete().eq("student_profile_id", student.profileId);
  await admin.from("student_profiles").delete().eq("id", student.profileId);
  await admin.from("user_roles").delete().eq("user_id", student.userId);
  await admin.from("users").delete().eq("id", student.userId);
  await admin.auth.admin.deleteUser(student.userId);
}

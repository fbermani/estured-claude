import type { SupabaseClient } from "@supabase/supabase-js";

/**
 * Cliente Supabase en memoria SOLO para tests unitarios (Ciclo 73). Entiende lo justo del encadenado de PostgREST que usa el código
 * del equipo de la residencia: `select / insert / update / delete`, `eq (incluido `col->>campo` de un jsonb) / gt / gte / in`, `order`, `limit`, `maybeSingle / single`,
 * `select("id", { count: "exact", head: true })`, `upsert(fila, { onConflict })` y los embeds `users(email)` / `users!user_id(email)` (en `residence_users`) y `rooms(col, col)`
 * (en `beds`, por `room_id`). Emula las restricciones únicas relevantes (23505) y los
 * errores de "tabla inexistente" (PGRST205) para probar la degradación sin la migración. NO es una base real: no valida RLS ni tipos.
 */

export type Row = Record<string, unknown>;
export type DbError = { code: string; message: string };

export type InMemoryOptions = {
  /** Tablas que "no existen" (migración sin aplicar): toda operación devuelve PGRST205. */
  missingTables?: string[];
  /** Columnas que "no existen" (migración sin aplicar) por tabla: leer o escribir una de ellas devuelve 42703. */
  missingColumns?: Record<string, string[]>;
  /** Error forzado en el próximo insert / update sobre esa tabla (una sola vez por entrada). */
  failInsert?: Record<string, DbError | { error: DbError; times: number }>;
  failUpdate?: Record<string, DbError>;
  /** Funciones SQL (`client.rpc(nombre, args)`): cada test inyecta su emulación. Sin handler → error de "función inexistente" (PGRST202). */
  rpc?: Record<string, (args: Record<string, unknown>, tables: Record<string, Row[]>) => { data: unknown; error: DbError | null }>;
};

const MISSING = (table: string): DbError => ({
  code: "PGRST205",
  message: `Could not find the table 'public.${table}' in the schema cache`,
});

/** Valor de una columna; entiende el acceso a un campo de un jsonb de PostgREST: `new_value->>residence_id`. */
function column(row: Row, col: string): unknown {
  const at = col.indexOf("->>");
  if (at === -1) return row[col];
  const json = row[col.slice(0, at)];
  if (json && typeof json === "object") {
    const value = (json as Row)[col.slice(at + 3)];
    return value === undefined || value === null ? value : String(value);
  }
  return undefined;
}

export function createInMemorySupabase(initial: Record<string, Row[]>, options: InMemoryOptions = {}) {
  const tables: Record<string, Row[]> = {};
  for (const [name, rows] of Object.entries(initial)) tables[name] = rows.map((r) => ({ ...r }));
  const failInsert = { ...(options.failInsert ?? {}) };
  const failUpdate = { ...(options.failUpdate ?? {}) };
  const log: { table: string; op: string; payload: unknown }[] = [];

  function applyDefaults(table: string, row: Row): Row {
    const out: Row = { ...row };
    if (out.id === undefined) out.id = crypto.randomUUID();
    if (out.created_at === undefined) out.created_at = new Date().toISOString();
    if (table === "residence_team_invitations") {
      out.status ??= "pending";
      out.role ??= "staff";
      out.send_count ??= 1;
      out.last_sent_at ??= new Date().toISOString();
      out.accepted_at ??= null;
      out.accepted_by_user_id ??= null;
      out.cancelled_at ??= null;
    }
    if (table === "residence_users") {
      out.is_active ??= true;
      out.invitation_status ??= "accepted";
    }
    return out;
  }

  function checkRow(table: string, row: Row, existing: Row[]): DbError | null {
    if (table === "residence_team_invitations") {
      if (row.role !== "staff") return { code: "23514", message: "violates check constraint (role = 'staff')" };
      if (typeof row.email === "string" && row.email !== row.email.toLowerCase()) {
        return { code: "23514", message: "violates check constraint (email = lower(email))" };
      }
      if (existing.some((r) => r.token_hash === row.token_hash)) return { code: "23505", message: "duplicate token_hash" };
      if (
        row.status === "pending" &&
        existing.some(
          (r) =>
            r.status === "pending" &&
            r.residence_id === row.residence_id &&
            String(r.email).toLowerCase() === String(row.email).toLowerCase(),
        )
      ) {
        return { code: "23505", message: "duplicate pending invitation" };
      }
    }
    if (table === "residence_users") {
      if (existing.some((r) => r.residence_id === row.residence_id && r.user_id === row.user_id)) {
        return { code: "23505", message: "duplicate residence_users" };
      }
    }
    return null;
  }

  class Query implements PromiseLike<unknown> {
    private op: "select" | "insert" | "update" | "delete" | "upsert" = "select";
    private filters: ((r: Row) => boolean)[] = [];
    private payload: Row | Row[] | null = null;
    private cols = "*";
    private head = false;
    private wantCount = false;
    private returning = false;
    private conflictCols: string[] | null = null;
    private orderCol: string | null = null;
    private asc = true;
    private limitN: number | null = null;
    private mode: "many" | "maybe" | "single" = "many";

    constructor(private table: string) {}

    select(cols = "*", opts?: { count?: string; head?: boolean }) {
      if (this.op === "select") this.cols = cols;
      else this.returning = true;
      if (opts?.count) this.wantCount = true;
      if (opts?.head) this.head = true;
      return this;
    }
    insert(payload: Row | Row[]) {
      this.op = "insert";
      this.payload = payload;
      return this;
    }
    upsert(payload: Row | Row[], opts?: { onConflict?: string }) {
      this.op = "upsert";
      this.payload = payload;
      this.conflictCols = opts?.onConflict ? opts.onConflict.split(",").map((c) => c.trim()) : null;
      return this;
    }
    update(payload: Row) {
      this.op = "update";
      this.payload = payload;
      return this;
    }
    delete() {
      this.op = "delete";
      return this;
    }
    eq(col: string, value: unknown) {
      this.filters.push((r) => column(r, col) === value);
      return this;
    }
    neq(col: string, value: unknown) {
      this.filters.push((r) => column(r, col) !== value);
      return this;
    }
    is(col: string, value: unknown) {
      this.filters.push((r) => (column(r, col) ?? null) === value);
      return this;
    }
    ilike(col: string, pattern: string) {
      // Solo el comodín «%» y el escape «\\» que usa el código (sin patrones parciales: se compara el texto entero, sin distinguir mayúsculas).
      const text = pattern.replace(/\\(.)/g, "$1").toLowerCase();
      this.filters.push((r) => String(column(r, col) ?? "").toLowerCase() === text);
      return this;
    }
    gt(col: string, value: unknown) {
      this.filters.push((r) => String(r[col]) > String(value));
      return this;
    }
    gte(col: string, value: unknown) {
      this.filters.push((r) => String(r[col]) >= String(value));
      return this;
    }
    in(col: string, values: unknown[]) {
      this.filters.push((r) => values.includes(r[col]));
      return this;
    }
    order(col: string, opts?: { ascending?: boolean }) {
      this.orderCol = col;
      this.asc = opts?.ascending !== false;
      return this;
    }
    limit(n: number) {
      this.limitN = n;
      return this;
    }
    maybeSingle() {
      this.mode = "maybe";
      return this;
    }
    single() {
      this.mode = "single";
      return this;
    }

    then<T1 = unknown, T2 = never>(
      onfulfilled?: ((value: unknown) => T1 | PromiseLike<T1>) | null,
      onrejected?: ((reason: unknown) => T2 | PromiseLike<T2>) | null,
    ): Promise<T1 | T2> {
      return Promise.resolve(this.exec()).then(onfulfilled, onrejected);
    }

    private project(rows: Row[]): Row[] {
      const roomsEmbed = this.table === "beds" ? /rooms\(([^)]*)\)/.exec(this.cols) : null;
      const usersEmbed = /users(!\w+)?\(/.test(this.cols);
      return rows.map((r) => {
        const out: Row = { ...r };
        if (usersEmbed) {
          const user = (tables.users ?? []).find((u) => u.id === r.user_id);
          out.users = user ? { email: user.email } : null;
        }
        if (roomsEmbed) {
          const room = (tables.rooms ?? []).find((x) => x.id === r.room_id);
          const picked: Row = {};
          if (room) for (const c of roomsEmbed[1].split(",").map((c) => c.trim()).filter(Boolean)) picked[c] = room[c];
          out.rooms = room ? picked : null;
        }
        return out;
      });
    }

    private exec(): { data: unknown; error: DbError | null; count: number | null } {
      const table = this.table;
      if (options.missingTables?.includes(table)) return { data: null, error: MISSING(table), count: null };
      const missing = options.missingColumns?.[table];
      if (missing) {
        const touched =
          this.op === "select" || this.op === "delete"
            ? this.cols.split(",").map((c) => c.trim())
            : Object.keys(Array.isArray(this.payload) ? (this.payload[0] ?? {}) : (this.payload ?? {}));
        const bad = missing.find((c) => touched.includes(c));
        if (bad) return { data: null, error: { code: "42703", message: `column ${table}.${bad} does not exist` }, count: null };
      }
      const rows = (tables[table] ??= []);
      const matches = () => rows.filter((r) => this.filters.every((f) => f(r)));

      const shape = (list: Row[], count: number | null) => {
        if (this.head) return { data: null, error: null, count };
        if (this.mode === "many") return { data: list, error: null, count };
        if (list.length > 1) return { data: null, error: { code: "PGRST116", message: "multiple rows" }, count };
        if (list.length === 0) {
          return this.mode === "single"
            ? { data: null, error: { code: "PGRST116", message: "no rows" }, count }
            : { data: null, error: null, count };
        }
        return { data: list[0], error: null, count };
      };

      if (this.op === "select") {
        let list = matches();
        if (this.orderCol) {
          const col = this.orderCol;
          list = [...list].sort((a, b) => (String(a[col]) < String(b[col]) ? -1 : String(a[col]) > String(b[col]) ? 1 : 0) * (this.asc ? 1 : -1));
        }
        const total = list.length;
        if (this.limitN !== null) list = list.slice(0, this.limitN);
        return shape(this.project(list), this.wantCount ? total : null);
      }

      if (this.op === "insert") {
        const forced = failInsert[table];
        if (forced) {
          const withTimes = "error" in forced ? forced : { error: forced, times: 1 };
          if (withTimes.times <= 1) delete failInsert[table];
          else failInsert[table] = { error: withTimes.error, times: withTimes.times - 1 };
          return { data: null, error: withTimes.error, count: null };
        }
        const inserted: Row[] = [];
        for (const raw of Array.isArray(this.payload) ? this.payload : [this.payload as Row]) {
          const row = applyDefaults(table, raw);
          const error = checkRow(table, row, rows);
          if (error) return { data: null, error, count: null };
          rows.push(row);
          inserted.push(row);
          log.push({ table, op: "insert", payload: row });
        }
        return this.returning ? shape(inserted.map((r) => ({ ...r })), null) : { data: null, error: null, count: null };
      }

      if (this.op === "upsert") {
        const out: Row[] = [];
        for (const raw of Array.isArray(this.payload) ? this.payload : [this.payload as Row]) {
          const cols = this.conflictCols ?? ["id"];
          const existing = rows.find((r) => cols.every((c) => r[c] !== undefined && r[c] === raw[c]));
          if (existing) {
            Object.assign(existing, raw);
            out.push(existing);
            log.push({ table, op: "update", payload: raw });
          } else {
            const row = applyDefaults(table, raw);
            rows.push(row);
            out.push(row);
            log.push({ table, op: "insert", payload: row });
          }
        }
        return this.returning ? shape(out.map((r) => ({ ...r })), null) : { data: null, error: null, count: null };
      }

      if (this.op === "update") {
        const forced = failUpdate[table];
        if (forced) {
          delete failUpdate[table];
          return { data: null, error: forced, count: null };
        }
        const hit = matches();
        for (const r of hit) Object.assign(r, this.payload as Row);
        if (hit.length > 0) log.push({ table, op: "update", payload: this.payload });
        return this.returning ? shape(hit.map((r) => ({ ...r })), null) : { data: null, error: null, count: null };
      }

      const hit = matches();
      tables[table] = rows.filter((r) => !hit.includes(r));
      log.push({ table, op: "delete", payload: null });
      return { data: null, error: null, count: null };
    }
  }

  const client = {
    from: (table: string) => new Query(table),
    rpc: async (name: string, args: Record<string, unknown> = {}) => {
      const handler = options.rpc?.[name];
      if (!handler) return { data: null, error: { code: "PGRST202", message: `Could not find the function public.${name} in the schema cache` } };
      return handler(args, tables);
    },
  } as unknown as SupabaseClient;
  return { client, tables, log };
}

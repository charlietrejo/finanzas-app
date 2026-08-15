// scripts/check-ratelimit-rlss.mjs
// Verifica si la tabla rate_limits es accesible directamente desde el cliente
// autenticado (sin pasar por la RPC). Si devuelve filas de OTROS usuarios,
// hay fuga de información (MEDIUM). Si deniega o está vacío, es seguro.
import { createClient } from "@supabase/supabase-js";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const env = {};
for (const lineRaw of readFileSync(join(process.cwd(), ".env.local"), "utf8").split(/\r?\n/)) {
  const line = lineRaw.trim();
  if (!line || line.startsWith("#")) continue;
  const eq = line.indexOf("=");
  if (eq === -1) continue;
  const k = line.slice(0, eq).trim();
  let v = line.slice(eq + 1).trim();
  if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) v = v.slice(1, -1);
  env[k] = v;
}
const A = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY, { auth: { persistSession: false } });
const r = await A.auth.signInWithPassword({ email: "aislamiento.a.verificacion@gmail.com", password: process.env.PENTEST_PASSWORD });
if (r.error) { console.log("LOGIN FAIL", r.error.message); process.exit(1); }

// Intento 1: leer la tabla directamente (no via RPC).
const sel = await A.from("rate_limits").select("*");
console.log("SELECT rate_limits directo:", JSON.stringify(sel));

// Intento 2: insertar directamente.
const ins = await A.from("rate_limits").insert({ user_id: r.data.user.id, bucket: "test", hits: 1 });
console.log("INSERT rate_limits directo:", JSON.stringify(ins));

await A.auth.signOut();

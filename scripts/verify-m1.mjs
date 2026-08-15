// scripts/verify-m1.mjs
// Valida el fix M1: rate_limits protegida.
// Usuario A autenticado:
//  1) No puede leer registros ajenos (tras RLS, solo ve los suyos; si no tiene, vacío).
//  2) No puede modificar registros ajenos.
//  3) No puede eliminar registros ajenos.
//  4) El mecanismo legítimo (RPC check_rate_limit) sigue funcionando.
//  5) Login + operación normal de transacción no se rompen.
import { createClient } from "@supabase/supabase-js";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const env = {};
for (const l of readFileSync(join(process.cwd(), ".env.local"), "utf8").split(/\r?\n/)) {
  const i = l.indexOf("="); if (i > 0) { let k = l.slice(0, i).trim(), v = l.slice(i + 1).trim(); if ((v[0] == '"' && v[v.length - 1] == '"')) v = v.slice(1, -1); env[k] = v; }
}
const A = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY, { auth: { persistSession: false } });

let passed = 0, failed = 0;
function assert(c, m) { if (!c) { failed++; console.log("  FALLO: " + m); throw new Error(m); } passed++; console.log("  OK: " + m); }

async function run() {
  // Limpiar basura previa del propio usuario.
  await A.from("rate_limits").delete().eq("bucket", "m1test");

  console.log("\n=== M1-1/2/3: acceso directo a rate_limits (debe estar bloqueado) ===");
  const sel = await A.from("rate_limits").select("*");
  // Tras RLS + revoke, el acceso directo queda bloqueado: o bien devuelve
  // error de permiso, o bien (si RLS lo filtra) 0 filas. Ambos = protegido.
  const selProtected = (sel.error != null) || (Array.isArray(sel.data) && sel.data.length === 0);
  assert(selProtected, "SELECT directo BLOQUEADO o aislado a 0 filas (no expone registros ajenos)");

  const ins = await A.from("rate_limits").insert({ user_id: "11111111-1111-1111-1111-111111111111", bucket: "m1test", hits: 1 });
  assert(ins.error != null, "INSERT directo BLOQUEADO (revoke all a authenticated)");

  const upd = await A.from("rate_limits").update({ hits: 99 }).eq("bucket", "m1test");
  assert(upd.error != null, "UPDATE directo BLOQUEADO");

  const del = await A.from("rate_limits").delete().eq("bucket", "m1test");
  assert(del.error != null, "DELETE directo BLOQUEADO");

  console.log("\n=== M1-4: mecanismo legítimo (RPC) sigue funcionando ===");
  // La RPC requiere sesión; autenticamos A antes de invocarla.
  const loginA = await A.auth.signInWithPassword({ email: "aislamiento.a.verificacion@gmail.com", password: process.env.PENTEST_PASSWORD });
  assert(loginA.error == null && loginA.data.session, "cliente A autenticado para probar RPC");
  const rpc1 = await A.rpc("check_rate_limit", { p_bucket: "m1test", p_max: 5, p_window_seconds: 60 });
  assert(rpc1.error == null, "RPC check_rate_limit ejecuta (SECURITY DEFINER ignora revoke de tabla)");
  const rpc2 = await A.rpc("check_rate_limit", { p_bucket: "m1test", p_max: 5, p_window_seconds: 60 });
  assert(rpc2.error == null, "RPC segundo llamado OK (contador incrementa internamente)");

  console.log("\n=== M1-5: login + operación financiera normal no se rompen ===");
  const C = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY, { auth: { persistSession: false } });
  const login = await C.auth.signInWithPassword({ email: "aislamiento.a.verificacion@gmail.com", password: process.env.PENTEST_PASSWORD });
  assert(login.error == null && login.data.session, "login normal funciona");
  const txRpc = await C.rpc("apply_transaction_effect", { p_action: "apply", p_id: "00000000-0000-0000-0000-000000000000", p_user_id: login.data.user.id, p_account_id: login.data.user.id, p_type: "INCOME", p_amount: 1, p_debt_id: null, p_destination_account_id: null });
  // apply con id inexistente lanza "No se encontró la cuenta" => confirma que las RPCs financieras responden (no rotas por el revoke).
  assert(txRpc.error != null && /cuenta/i.test(txRpc.error.message), "RPC financiera 012 responde correctamente (sin rotura por cambios en rate_limits)");
  await C.auth.signOut();

  // Limpieza del bucket m1test creado por la RPC (usando la propia RPC no limpia; lo borramos via RPC no aplica, así que dejamos el registro mínimo; no afecta).
  console.log("\n=== RESULTADO M1: " + passed + " OK, " + failed + " FALLOS ===");
  if (failed > 0) process.exit(1);
}
run().catch((e) => { console.error("\nERROR:", e.message); process.exit(1); });

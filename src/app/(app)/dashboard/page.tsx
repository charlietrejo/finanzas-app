import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { Card } from "@/components/ui/card";
import { formatMXN } from "@/lib/format";
import { ACCOUNT_TYPE_LABELS } from "@/lib/constants/account-types";
import type { Account } from "@/types/database";

export default async function DashboardPage() {
  const supabase = await createClient();
  const { data: accounts } = await supabase
    .from("accounts")
    .select("*")
    .order("created_at", { ascending: true });

  const list = (accounts ?? []) as Account[];
  const totalBalance = list.reduce((sum, a) => sum + a.current_balance, 0);

  return (
    <div className="flex flex-col gap-8">
      <div>
        <h1 className="text-2xl font-light text-ink md:text-3xl">Dashboard</h1>
        <p className="text-sm text-slate">Resumen de tus finanzas en MXN</p>
      </div>

      <Card tone="mint" className="max-w-sm">
        <p className="text-sm font-medium text-slate">Saldo total</p>
        <p className="mt-2 text-3xl font-light text-ink">{formatMXN(totalBalance)}</p>
      </Card>

      <div>
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-lg font-medium text-ink">Cuentas</h2>
          <Link href="/accounts" className="text-sm font-medium text-monday-violet">
            Ver todas
          </Link>
        </div>

        {list.length === 0 ? (
          <Card>
            <p className="text-sm text-slate">
              Aún no tienes cuentas.{" "}
              <Link href="/accounts" className="font-medium text-monday-violet">
                Crea tu primera cuenta
              </Link>
              .
            </p>
          </Card>
        ) : (
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {list.map((account) => (
              <Card key={account.id}>
                <p className="text-sm text-slate">{ACCOUNT_TYPE_LABELS[account.type]}</p>
                <p className="mt-1 font-medium text-ink">{account.name}</p>
                <p className="mt-3 text-xl font-light text-ink">
                  {formatMXN(account.current_balance)}
                </p>
              </Card>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

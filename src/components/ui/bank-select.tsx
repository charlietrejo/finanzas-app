"use client";

import { useState } from "react";
import { Label, Select } from "@/components/ui/input";
import { BankLogo } from "@/components/ui/bank-logo";
import { MEXICAN_BANKS } from "@/lib/constants/banks";
import { findBankByName } from "@/lib/logo-dev";

/**
 * Select de banco + preview del logo real (sección 3.8). Un <option> nativo
 * no puede mostrar imágenes, así que el logo de la selección actual se
 * muestra aparte, al lado del select, y se actualiza al cambiar.
 */
export function BankSelect({
  id,
  label,
  defaultValue = "",
  emptyLabel = "Sin banco",
}: {
  id: string;
  label: string;
  defaultValue?: string;
  emptyLabel?: string;
}) {
  const [value, setValue] = useState(defaultValue);
  const bank = findBankByName(value);

  return (
    <div>
      <Label htmlFor={id}>{label}</Label>
      <div className="flex items-center gap-2">
        <Select id={id} name="bank_name" value={value} onChange={(e) => setValue(e.target.value)}>
          <option value="">{emptyLabel}</option>
          {MEXICAN_BANKS.map((b) => (
            <option key={b.name} value={b.name}>
              {b.name}
            </option>
          ))}
        </Select>
        <BankLogo bank={bank} size={28} />
      </div>
    </div>
  );
}

import type { Bank } from "@/lib/constants/banks";
import { getBankLogoUrl } from "@/lib/logo-dev";
import { LogoImage } from "@/components/ui/logo-image";

export function BankLogo({ bank, size = 20, className }: { bank?: Bank; size?: number; className?: string }) {
  if (!bank) return null;
  return <LogoImage src={getBankLogoUrl(bank.domain, size * 2)} alt={`Logo de ${bank.name}`} size={size} className={className} />;
}

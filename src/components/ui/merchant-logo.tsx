import { getMerchantLogoUrl } from "@/lib/logo-dev";
import { LogoImage } from "@/components/ui/logo-image";

export function MerchantLogo({ name, size = 20, className }: { name?: string | null; size?: number; className?: string }) {
  if (!name) return null;
  return <LogoImage src={getMerchantLogoUrl(name, size * 2)} alt={`Logo de ${name}`} size={size} className={className} />;
}

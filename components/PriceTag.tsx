import { priceText, unitLabel } from "@/lib/catalog-view";
import type { PriceUnit } from "@/lib/catalog";
import type { Locale, Messages } from "@/lib/i18n";

export function PriceTag({ locale, t, amount, unit, from = true }: { locale: Locale; t: Messages; amount: number; unit: PriceUnit; from?: boolean }) {
  return (
    <span className="price">
      {from && <span className="from">{t.common.from}</span>}
      {priceText(locale, amount)} <small>{unitLabel(t, unit)}</small>
    </span>
  );
}

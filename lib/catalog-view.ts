import { kindOrder, type PriceUnit, type PublicSpace, type SpaceKind } from "@/lib/catalog";
import { formatEgp, type Locale, type Messages } from "@/lib/i18n";

export function unitLabel(t: Messages, unit: PriceUnit): string {
  return unit === "hour" ? t.common.perHour : unit === "day" ? t.common.perDay : t.common.perMonth;
}

export function priceText(locale: Locale, amount: number): string {
  return formatEgp(locale, amount);
}

export interface KindGroup {
  kind: SpaceKind;
  spaces: PublicSpace[];
  /** Lowest price across the group, used for the "from" price tag. */
  from: PublicSpace["fromPrice"];
}

export function groupByKind(spaces: PublicSpace[]): KindGroup[] {
  return kindOrder
    .map((kind) => {
      const group = spaces.filter((s) => s.kind === kind);
      if (!group.length) return null;
      const from = group.map((s) => s.fromPrice).sort((a, b) => a.amount - b.amount)[0];
      return { kind, spaces: group, from };
    })
    .filter((g): g is KindGroup => g !== null);
}

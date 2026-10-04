import { NextResponse } from "next/server";
import type { Envelope } from "@/lib/catalog";

/** Cacheable read responses for the PublicCatalog contract. */
export function cacheable<T>(data: T, seconds = 300) {
  return NextResponse.json({ data } satisfies Envelope<T>, {
    headers: { "Cache-Control": `public, s-maxage=${seconds}, stale-while-revalidate=${seconds * 4}` },
  });
}

export function problem(status: number, code: string) {
  return NextResponse.json({ error: { code } }, { status });
}

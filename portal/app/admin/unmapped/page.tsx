import Link from "next/link";
import { ChevronLeft, ChevronRight, Search, X } from "lucide-react";
import { requireAdmin } from "@/lib/auth";
import { isSupabaseConfigured } from "@/lib/env";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import type { MappingProduct, UnmappedItem } from "@/lib/admin/mapping";
import { Shell } from "@/components/Shell";
import { TallyMappingForm } from "@/components/TallyMappingForm";

const pageSize = 50;

export default async function UnmappedPage({ searchParams }: { searchParams: Promise<{ q?: string; page?: string; item?: string }> }) {
  const viewer = await requireAdmin();
  const params = await searchParams;
  const q = typeof params.q === "string" ? params.q.trim().slice(0, 200) : "";
  const requestedPage = Number(params.page ?? "1");
  let page = Number.isSafeInteger(requestedPage) && requestedPage > 0 ? Math.min(requestedPage, 1000000) : 1;
  let items: UnmappedItem[] = [];
  let products: MappingProduct[] = [];
  let selected: UnmappedItem | null = null;
  let count = 0;
  let errorMessage = "";
  const configured = isSupabaseConfigured();

  if (configured) {
    const supabase = await createSupabaseServerClient();
    const term = q.replace(/[\\%_]/g, "\\$&");
    const baseQuery = () => {
      const query = supabase.from("unmapped_tally_items").select("tally_item_name, last_quantity, unit, last_tally_company, last_seen_at", { count: "exact" });
      return q ? query.ilike("tally_item_name", `%${term}%`) : query;
    };
    let result = await baseQuery().order("tally_item_name").range((page - 1) * pageSize, page * pageSize - 1);
    count = result.count ?? 0;
    const lastPage = Math.max(1, Math.ceil(count / pageSize));
    if (!result.error && page > lastPage) {
      page = lastPage;
      result = await baseQuery().order("tally_item_name").range((page - 1) * pageSize, page * pageSize - 1);
    }
    if (result.error) errorMessage = "Unmapped items could not be loaded. Refresh and try again.";
    else items = result.data ?? [];

    if (typeof params.item === "string" && params.item.length <= 240) {
      const selection = await supabase.from("unmapped_tally_items").select("tally_item_name, last_quantity, unit, last_tally_company, last_seen_at").eq("tally_item_name", params.item).maybeSingle();
      if (selection.error) errorMessage = "The selected item could not be loaded.";
      else selected = selection.data;
      if (selected) {
        // Supabase caps a single response; page through the complete catalogue.
        for (let from = 0; ; from += 500) {
          const result = await supabase.from("products").select("id, brand, product_family, thickness, size, grade, tally_item_name, active").order("id").range(from, from + 499);
          if (result.error) { errorMessage = "Catalogue products could not be loaded. Refresh before mapping."; selected = null; break; }
          const batch = (result.data ?? []) as MappingProduct[];
          products.push(...batch);
          if (batch.length < 500) break;
        }
      }
    }
  }

  const href = (targetPage: number, item?: string) => {
    const search = new URLSearchParams({ page: String(targetPage) });
    if (q) search.set("q", q);
    if (item) search.set("item", item);
    return { pathname: "/admin/unmapped", query: Object.fromEntries(search) };
  };

  return <Shell viewer={viewer}>
    <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
      <div><p className="text-xs font-black tracking-widest text-amber-800">ADMIN</p><h2 className="text-2xl font-black text-imply-ink">Unmapped Tally items</h2><p className="mt-1 text-sm text-zinc-600">{count} {q ? "matching" : "unmapped"} items</p></div>
      <Link href="/admin" className="flex min-h-11 items-center gap-1 text-sm font-bold text-imply-green"><ChevronLeft size={18} />Products</Link>
    </div>
    {!configured ? <p role="status" className="mb-4 border-l-4 border-amber-500 bg-amber-50 p-4 text-sm">Supabase is not configured. Live items and mapping are unavailable.</p> : null}
    {errorMessage ? <p role="alert" className="mb-4 border-l-4 border-red-600 bg-red-50 p-4 text-sm">{errorMessage}</p> : null}
    <form method="get" className="mb-5 flex max-w-xl gap-2">
      <label className="sr-only" htmlFor="unmapped-search">Search Tally item name</label>
      <input id="unmapped-search" name="q" type="search" defaultValue={q} maxLength={200} placeholder="Search Tally item name" className="h-11 min-w-0 flex-1 rounded border border-stone-300 bg-white px-3 text-sm" />
      <button aria-label="Search" title="Search" className="flex h-11 w-11 shrink-0 items-center justify-center rounded bg-imply-green text-white"><Search size={18} /></button>
      {q ? <Link href="/admin/unmapped" aria-label="Clear search" title="Clear search" className="flex h-11 w-11 shrink-0 items-center justify-center rounded border border-stone-300"><X size={18} /></Link> : null}
    </form>
    <div className={`grid min-w-0 gap-6 ${selected ? "xl:grid-cols-[minmax(0,1fr)_minmax(320px,400px)]" : ""}`}>
      <section className="min-w-0" aria-label="Unmapped items">
        <div className="overflow-x-auto border-y border-stone-200 bg-white">
          <table className="w-full text-left text-sm">
            <thead className="bg-stone-50 text-xs text-zinc-600"><tr><th className="p-3">Tally stock item</th><th className="p-3 text-right">Quantity</th><th className="p-3">Company / Last seen</th><th className="p-3"><span className="sr-only">Action</span></th></tr></thead>
            <tbody className="divide-y divide-stone-200">{items.map((item) => <tr key={item.tally_item_name} className={selected?.tally_item_name === item.tally_item_name ? "bg-emerald-50" : ""}>
              <td className="min-w-44 max-w-sm break-words p-3 font-bold">{item.tally_item_name}</td>
              <td className="whitespace-nowrap p-3 text-right tabular-nums">{item.last_quantity ?? "-"} {item.unit}</td>
              <td className="min-w-36 max-w-xs break-words p-3 text-zinc-600">{item.last_tally_company ?? "-"}<time className="block text-xs" dateTime={item.last_seen_at}>{new Date(item.last_seen_at).toISOString().replace("T", " ").slice(0, 16)} UTC</time></td>
              <td className="p-3"><Link href={href(page, item.tally_item_name)} className="inline-flex min-h-11 items-center gap-1 whitespace-nowrap font-bold text-imply-green">Map<ChevronRight size={16} /></Link></td>
            </tr>)}</tbody>
          </table>
          {items.length === 0 && configured && !errorMessage ? <p className="p-8 text-center text-sm text-zinc-600">{q ? "No matching items." : "No unmapped items."}</p> : null}
        </div>
        <nav aria-label="Pagination" className="mt-4 flex items-center justify-between gap-3 text-sm">
          <span>{count ? `${(page - 1) * pageSize + 1}-${Math.min(page * pageSize, count)} of ${count}` : "0 items"}</span>
          <div className="flex items-center gap-2">
            {page > 1 ? <Link href={href(page - 1)} aria-label="Previous page" title="Previous page" className="flex h-11 w-11 items-center justify-center rounded border border-stone-300"><ChevronLeft size={18} /></Link> : null}
            <span>Page {page} of {Math.max(1, Math.ceil(count / pageSize))}</span>
            {page * pageSize < count ? <Link href={href(page + 1)} aria-label="Next page" title="Next page" className="flex h-11 w-11 items-center justify-center rounded border border-stone-300"><ChevronRight size={18} /></Link> : null}
          </div>
        </nav>
      </section>
      {selected ? <aside className="order-first min-w-0 border-t border-stone-200 pt-4 xl:order-none xl:border-l xl:border-t-0 xl:pl-5 xl:pt-0">
        <div className="mb-4 flex items-start justify-between gap-2"><h3 className="min-w-0 break-words text-lg font-bold">{selected.tally_item_name}</h3><Link href={href(page)} aria-label="Close mapping" title="Close mapping" className="flex h-10 w-10 shrink-0 items-center justify-center"><X size={18} /></Link></div>
        <TallyMappingForm key={selected.tally_item_name} item={selected} products={products} />
      </aside> : null}
    </div>
  </Shell>;
}

import { requireAdmin } from "@/lib/auth";
import { Shell } from "@/components/Shell";
import { formatKolkataDateTime } from "@/lib/freshness";

export default async function SyncPage() {
  const viewer = await requireAdmin();
  return (
    <Shell viewer={viewer}>
      <section className="rounded-lg border border-stone-200 bg-white p-5 shadow-soft">
        <p className="text-xs font-black tracking-widest text-amber-800">ADMIN</p>
        <h2 className="mt-1 text-2xl font-black text-imply-ink">Sync status</h2>
        <div className="mt-5 rounded-lg bg-imply-paper p-4">
          <p className="text-sm font-bold text-zinc-700">Current environment</p>
          <p className="mt-1 text-sm text-zinc-600">Supabase-backed sync runs and heartbeats appear here after deployment. Development mode uses sample data only.</p>
          <p className="mt-3 text-xs text-zinc-500">Rendered at {formatKolkataDateTime(new Date().toISOString())}</p>
        </div>
      </section>
    </Shell>
  );
}

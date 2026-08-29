import { requireAdmin } from "@/lib/auth";
import { Shell } from "@/components/Shell";

export default async function UnmappedPage() {
  const viewer = await requireAdmin();
  return (
    <Shell viewer={viewer}>
      <section className="rounded-lg border border-stone-200 bg-white p-5 shadow-soft">
        <p className="text-xs font-black tracking-widest text-amber-800">ADMIN</p>
        <h2 className="mt-1 text-2xl font-black text-imply-ink">Unmapped Tally items</h2>
        <div className="mt-5 rounded-lg border border-dashed border-stone-300 bg-stone-50 p-6 text-center text-sm text-zinc-600">
          Unknown Tally stock items imported by the connector will be held here for explicit admin mapping before they can appear to sales users.
        </div>
      </section>
    </Shell>
  );
}

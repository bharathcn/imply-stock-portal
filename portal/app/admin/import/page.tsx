import { requireAdmin } from "@/lib/auth";
import { Shell } from "@/components/Shell";

export default async function ImportPage() {
  const viewer = await requireAdmin();
  return (
    <Shell viewer={viewer}>
      <section className="max-w-2xl rounded-lg border border-stone-200 bg-white p-5 shadow-soft">
        <p className="text-xs font-black tracking-widest text-amber-800">ADMIN</p>
        <h2 className="mt-1 text-2xl font-black text-imply-ink">CSV price import</h2>
        <p className="mt-2 text-sm leading-6 text-zinc-600">Upload CSV rows with brand, product_family, thickness, size, grade, custom_selling_price, low_stock_threshold, active, and optional reason. Validate first, then commit after the rows are clean.</p>
        <div className="mt-5 flex flex-wrap gap-2">
          <a className="rounded-lg border border-stone-300 bg-imply-paper px-4 py-3 text-sm font-black text-imply-green" href="/api/admin/price-template">Download template</a>
        </div>
        <form className="mt-5 grid gap-4" action="/api/admin/import-prices" method="post" encType="multipart/form-data">
          <label className="grid gap-2 text-sm font-bold text-zinc-700">
            Price CSV
            <input className="rounded-lg border border-stone-300 bg-stone-50 p-3" name="file" type="file" accept=".csv,text/csv" required />
          </label>
          <div className="grid gap-2 sm:grid-cols-2">
            <button className="h-12 rounded-lg border border-stone-300 bg-imply-paper px-4 font-black text-imply-green" name="commit" value="false">
              Validate CSV
            </button>
            <button className="h-12 rounded-lg bg-imply-green px-4 font-black text-white" name="commit" value="true">
              Commit import
            </button>
          </div>
        </form>
      </section>
    </Shell>
  );
}

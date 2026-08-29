import Link from "next/link";
import { requireAdmin } from "@/lib/auth";
import { getAdminProducts } from "@/lib/data";
import { getAvailability } from "@/lib/availability";
import { formatMoney } from "@/lib/money";
import { Shell } from "@/components/Shell";
import { AvailabilityBadge } from "@/components/StatusBadge";

export default async function AdminPage() {
  const viewer = await requireAdmin();
  const products = await getAdminProducts();
  return (
    <Shell viewer={viewer}>
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="text-xs font-black tracking-widest text-amber-800">ADMIN</p>
          <h2 className="text-2xl font-black text-imply-ink">Products and prices</h2>
        </div>
        <div className="flex gap-2">
          <Link className="rounded-lg border border-stone-300 bg-white px-4 py-3 text-sm font-black text-imply-green" href="/admin/import">CSV import</Link>
          <Link className="rounded-lg border border-stone-300 bg-white px-4 py-3 text-sm font-black text-imply-green" href="/admin/sync">Sync status</Link>
          <Link className="rounded-lg border border-stone-300 bg-white px-4 py-3 text-sm font-black text-imply-green" href="/admin/unmapped">Unmapped</Link>
        </div>
      </div>
      <div className="overflow-hidden rounded-lg border border-stone-200 bg-white shadow-soft">
        <div className="grid grid-cols-[1.4fr_0.9fr_0.8fr_0.8fr] gap-3 border-b border-stone-200 bg-imply-paper px-4 py-3 text-xs font-black uppercase tracking-wide text-zinc-600 max-md:hidden">
          <span>Product</span>
          <span>Price</span>
          <span>Stock</span>
          <span>Action</span>
        </div>
        <div className="divide-y divide-stone-200">
          {products.map((product) => {
            const quantity = product.inventory_current ? Number(product.inventory_current.total_quantity) : null;
            return (
              <article className="grid gap-3 px-4 py-4 md:grid-cols-[1.4fr_0.9fr_0.8fr_0.8fr] md:items-center" key={product.id}>
                <div>
                  <h3 className="font-black text-imply-ink">
                    {product.brand} {product.product_family}
                  </h3>
                  <p className="text-sm text-zinc-600">
                    {product.thickness} / {product.size} / {product.grade}
                  </p>
                  {!product.active ? <p className="mt-1 text-xs font-black text-red-700">Inactive</p> : null}
                </div>
                <strong>{formatMoney(product.custom_selling_price)}</strong>
                <div className="flex items-center gap-2">
                  <AvailabilityBadge value={getAvailability(quantity, product.low_stock_threshold)} />
                  <span className="text-sm text-zinc-600">{quantity ?? "-"} {product.unit}</span>
                </div>
                <Link className="rounded-lg bg-imply-green px-4 py-3 text-center text-sm font-black text-white" href={`/admin/products/${product.id}`}>Edit</Link>
              </article>
            );
          })}
        </div>
      </div>
    </Shell>
  );
}

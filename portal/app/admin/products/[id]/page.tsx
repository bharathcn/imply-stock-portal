import { notFound } from "next/navigation";
import { requireAdmin } from "@/lib/auth";
import { getAdminProducts } from "@/lib/data";
import { Shell } from "@/components/Shell";
import { AdminProductForm } from "@/components/AdminProductForm";

export default async function AdminProductPage({ params }: { params: Promise<{ id: string }> }) {
  const viewer = await requireAdmin();
  const { id } = await params;
  const product = (await getAdminProducts()).find((item) => item.id === id);
  if (!product) notFound();
  return (
    <Shell viewer={viewer}>
      <div className="max-w-2xl">
        <AdminProductForm product={product} />
      </div>
    </Shell>
  );
}

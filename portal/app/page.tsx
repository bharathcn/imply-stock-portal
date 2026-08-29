import { requireViewer } from "@/lib/auth";
import { getActiveProducts } from "@/lib/data";
import { getFreshnessThresholdMinutes } from "@/lib/env";
import { Shell } from "@/components/Shell";
import { StockLookup } from "@/components/StockLookup";

export default async function HomePage() {
  const viewer = await requireViewer();
  const products = await getActiveProducts();
  return (
    <Shell viewer={viewer}>
      <StockLookup products={products} role={viewer.role} freshnessThresholdMinutes={getFreshnessThresholdMinutes()} />
    </Shell>
  );
}

import { requireAdmin } from "@/lib/auth";

export async function GET() {
  await requireAdmin();
  return new Response("brand,product_family,thickness,size,grade,custom_selling_price,low_stock_threshold,active,reason\nIMPLY,Royal,18 mm,8 x 4 ft,BWP,2850.00,10,true,Initial upload\n", {
    headers: {
      "content-type": "text/csv; charset=utf-8",
      "content-disposition": "attachment; filename=imply-price-template.csv"
    }
  });
}

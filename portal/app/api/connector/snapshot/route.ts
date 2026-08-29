import { NextResponse } from "next/server";
import { verifyConnectorSecret } from "@/lib/connector/auth";
import { inventorySnapshotSchema } from "@/lib/connector/schema";
import { isSupabaseConfigured } from "@/lib/env";
import { createSupabaseAdminClient } from "@/lib/supabase/server";

export async function POST(request: Request) {
  const maxBytes = Number(process.env.CONNECTOR_MAX_PAYLOAD_BYTES ?? "262144");
  const raw = await request.text();
  if (raw.length > maxBytes) return NextResponse.json({ error: "Payload too large" }, { status: 413 });

  const secret = request.headers.get("x-connector-secret");
  if (!verifyConnectorSecret(secret, process.env.CONNECTOR_SECRET_HASH)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let body: unknown;
  try {
    body = JSON.parse(raw);
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const parsed = inventorySnapshotSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid payload", details: parsed.error.flatten() }, { status: 400 });
  }

  if (!isSupabaseConfigured()) {
    return NextResponse.json({ accepted: true, developmentMode: true, mappedItemCount: 0, unmappedItemCount: parsed.data.items.length });
  }

  const supabase = createSupabaseAdminClient();
  const { data, error } = await supabase.rpc("ingest_inventory_snapshot", { payload: parsed.data });
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data);
}

import { NextResponse } from "next/server";
import { verifyConnectorSecret } from "@/lib/connector/auth";
import { heartbeatSchema } from "@/lib/connector/schema";
import { isSupabaseConfigured } from "@/lib/env";
import { createSupabaseAdminClient } from "@/lib/supabase/server";

export async function POST(request: Request) {
  const secret = request.headers.get("x-connector-secret");
  if (!verifyConnectorSecret(secret, process.env.CONNECTOR_SECRET_HASH)) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const body = await request.json();
  const parsed = heartbeatSchema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: "Invalid payload", details: parsed.error.flatten() }, { status: 400 });
  if (!isSupabaseConfigured()) return NextResponse.json({ accepted: true, developmentMode: true });

  const supabase = createSupabaseAdminClient();
  const { error } = await supabase.from("connector_heartbeats").upsert({
    connector_id: parsed.data.connectorId,
    connector_version: parsed.data.connectorVersion,
    tally_company: parsed.data.tallyCompany,
    tally_release: parsed.data.tallyRelease ?? null,
    status: parsed.data.status,
    last_seen_at: new Date().toISOString(),
    last_successful_sync_at: parsed.data.lastSuccessfulSyncAt ?? null
  });
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ accepted: true });
}

"use server";

import { revalidatePath } from "next/cache";
import { requireAdmin } from "@/lib/auth";
import { isSupabaseConfigured } from "@/lib/env";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { mappingRpcArgs, parseMappingForm, type MappingState } from "@/lib/admin/mapping";

export async function mapTallyItemAction(_state: MappingState, form: FormData): Promise<MappingState> {
  await requireAdmin();
  const parsed = parseMappingForm(form);
  if (!parsed.success) return { ok: false, message: parsed.error.issues[0]?.message ?? "Check the mapping fields." };
  if (!isSupabaseConfigured()) return { ok: false, message: "Supabase is not configured. No changes were saved." };

  const supabase = await createSupabaseServerClient();
  const { error } = await supabase.rpc("map_unmapped_tally_item", mappingRpcArgs(parsed.data));
  if (error) {
    const message = error.code === "23505"
      ? "That product combination or Tally item is already mapped. Refresh and choose another product."
      : error.code === "P0002"
        ? "The item or product is no longer available. Refresh the list."
        : error.code === "PGRST202"
          ? "The mapping database migration has not been applied. No changes were saved."
          : "Mapping could not be saved. No changes were made. Refresh and try again.";
    return { ok: false, message };
  }
  revalidatePath("/admin/unmapped");
  revalidatePath("/admin");
  revalidatePath("/");
  return { ok: true, message: "Mapping saved. Stock and godown balances will refresh on the next connector sync." };
}

import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({ requireAdmin: vi.fn(), configured: vi.fn(), rpc: vi.fn(), client: vi.fn(), revalidate: vi.fn() }));
vi.mock("@/lib/auth", () => ({ requireAdmin: mocks.requireAdmin }));
vi.mock("@/lib/env", () => ({ isSupabaseConfigured: mocks.configured }));
vi.mock("@/lib/supabase/server", () => ({ createSupabaseServerClient: mocks.client }));
vi.mock("next/cache", () => ({ revalidatePath: mocks.revalidate }));

import { mapTallyItemAction } from "./actions";

function existingForm() {
  const form = new FormData();
  form.set("mode", "existing");
  form.set("tally_item_name", "Demo stock item");
  form.set("product_id", "11111111-1111-4111-8111-111111111111");
  return form;
}

describe("admin mapping action", () => {
  beforeEach(() => {
    vi.resetAllMocks();
    mocks.requireAdmin.mockResolvedValue({ id: "admin" });
    mocks.configured.mockReturnValue(true);
    mocks.client.mockResolvedValue({ rpc: mocks.rpc });
    mocks.rpc.mockResolvedValue({ data: "product-id", error: null });
  });

  it("does not access the database without admin authorization", async () => {
    mocks.requireAdmin.mockRejectedValue(new Error("Forbidden"));
    await expect(mapTallyItemAction({ ok: false, message: "" }, existingForm())).rejects.toThrow("Forbidden");
    expect(mocks.client).not.toHaveBeenCalled();
  });

  it("does not write an invalid form", async () => {
    const result = await mapTallyItemAction({ ok: false, message: "" }, new FormData());
    expect(result.ok).toBe(false);
    expect(mocks.rpc).not.toHaveBeenCalled();
  });

  it("does not pretend to save without Supabase", async () => {
    mocks.configured.mockReturnValue(false);
    const result = await mapTallyItemAction({ ok: false, message: "" }, existingForm());
    expect(result.ok).toBe(false);
    expect(mocks.client).not.toHaveBeenCalled();
  });

  it("uses one atomic RPC and refreshes catalogue and mapping pages", async () => {
    const result = await mapTallyItemAction({ ok: false, message: "" }, existingForm());
    expect(result.ok).toBe(true);
    expect(mocks.rpc).toHaveBeenCalledTimes(1);
    expect(mocks.rpc).toHaveBeenCalledWith("map_unmapped_tally_item", {
      item_name: "Demo stock item", target_product_id: "11111111-1111-4111-8111-111111111111", new_product: null
    });
    expect(mocks.revalidate.mock.calls.flat()).toEqual(["/admin/unmapped", "/admin", "/"]);
  });

  it.each(["23505", "P0002", "PGRST202", "42501"])("keeps failures visible and does not revalidate on %s", async (code) => {
    mocks.rpc.mockResolvedValue({ error: { code, message: "private database detail" } });
    const result = await mapTallyItemAction({ ok: false, message: "" }, existingForm());
    expect(result.ok).toBe(false);
    expect(result.message).not.toContain("private database detail");
    expect(mocks.revalidate).not.toHaveBeenCalled();
  });
});

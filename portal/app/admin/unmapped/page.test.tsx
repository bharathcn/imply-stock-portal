import { cleanup, render, screen } from "@testing-library/react";
import type { ReactNode } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({ requireAdmin: vi.fn(), configured: vi.fn(), client: vi.fn(), from: vi.fn(), ilike: vi.fn(), range: vi.fn() }));
vi.mock("@/lib/auth", () => ({ requireAdmin: mocks.requireAdmin }));
vi.mock("@/lib/env", () => ({ isSupabaseConfigured: mocks.configured }));
vi.mock("@/lib/supabase/server", () => ({ createSupabaseServerClient: mocks.client }));
vi.mock("@/components/Shell", () => ({ Shell: ({ children }: { children: ReactNode }) => <main>{children}</main> }));
vi.mock("@/components/TallyMappingForm", () => ({ TallyMappingForm: () => null }));

import UnmappedPage from "./page";

describe("unmapped item list", () => {
  beforeEach(() => {
    vi.resetAllMocks();
    mocks.requireAdmin.mockResolvedValue({ id: "admin", role: "admin" });
    mocks.configured.mockReturnValue(true);
    const query = { select: vi.fn().mockReturnThis(), ilike: mocks.ilike.mockReturnThis(), order: vi.fn().mockReturnThis(), range: mocks.range };
    mocks.from.mockReturnValue(query);
    mocks.client.mockResolvedValue({ from: mocks.from });
    mocks.range.mockResolvedValue({ count: 914, error: null, data: Array.from({ length: 50 }, (_, index) => ({
      tally_item_name: `Item ${index + 1}`, last_quantity: "42.125", unit: "sheets",
      last_tally_company: "Test Company", last_seen_at: "2026-10-15T09:00:00Z"
    })) });
  });
  afterEach(cleanup);

  it("shows database items and paginates a 914-item queue", async () => {
    render(await UnmappedPage({ searchParams: Promise.resolve({}) }));
    expect(screen.getByText("914 unmapped items")).toBeInTheDocument();
    expect(screen.getByText("Item 1")).toBeInTheDocument();
    expect(screen.getByText("1-50 of 914")).toBeInTheDocument();
    expect(screen.getByText("Page 1 of 19")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Next page" })).toHaveAttribute("href", "/admin/unmapped?page=2");
    expect(mocks.range).toHaveBeenCalledWith(0, 49);
  });

  it("uses literal search and preserves it in pagination", async () => {
    render(await UnmappedPage({ searchParams: Promise.resolve({ q: "PLY_10%", page: "2" }) }));
    expect(mocks.ilike).toHaveBeenCalledWith("tally_item_name", "%PLY\\_10\\%%");
    expect(mocks.range).toHaveBeenCalledWith(50, 99);
    expect(screen.getByRole("link", { name: "Previous page" }).getAttribute("href")).toContain("q=PLY_10%25");
  });

  it("does not replace missing database configuration with fixture inventory", async () => {
    mocks.configured.mockReturnValue(false);
    render(await UnmappedPage({ searchParams: Promise.resolve({}) }));
    expect(screen.getByRole("status")).toHaveTextContent("Supabase is not configured");
    expect(mocks.client).not.toHaveBeenCalled();
    expect(screen.queryByText("Item 1")).not.toBeInTheDocument();
  });

  it("denies the page before reading any inventory", async () => {
    mocks.requireAdmin.mockRejectedValue(new Error("Forbidden"));
    await expect(UnmappedPage({ searchParams: Promise.resolve({}) })).rejects.toThrow("Forbidden");
    expect(mocks.client).not.toHaveBeenCalled();
  });
});

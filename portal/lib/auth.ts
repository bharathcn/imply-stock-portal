import { redirect } from "next/navigation";
import { isSupabaseConfigured } from "./env";
import { createSupabaseServerClient } from "./supabase/server";
import type { Role } from "./types";

export type Viewer = {
  id: string;
  email: string | undefined;
  fullName: string | null;
  role: Role;
};

export async function getViewer(): Promise<Viewer | null> {
  if (!isSupabaseConfigured()) {
    return { id: "dev-admin", email: "dev@imply.local", fullName: "Development Admin", role: "admin" };
  }
  const supabase = await createSupabaseServerClient();
  const { data: authData } = await supabase.auth.getUser();
  if (!authData.user) return null;
  const { data: profile } = await supabase
    .from("profiles")
    .select("full_name, role, active")
    .eq("id", authData.user.id)
    .single();
  if (!profile?.active) return null;
  return {
    id: authData.user.id,
    email: authData.user.email,
    fullName: profile.full_name,
    role: profile.role as Role
  };
}

export async function requireViewer() {
  const viewer = await getViewer();
  if (!viewer) redirect("/login");
  return viewer;
}

export async function requireAdmin() {
  const viewer = await requireViewer();
  if (viewer.role !== "admin") redirect("/");
  return viewer;
}

import { NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export async function POST(request: Request) {
  const formData = await request.formData();
  const email = String(formData.get("email") ?? "");
  const password = String(formData.get("password") ?? "");
  const supabase = await createSupabaseServerClient();
  const { error } = await supabase.auth.signInWithPassword({ email, password });
  if (error) {
    console.error("Supabase sign-in failed", {
      status: error.status,
      code: error.code,
      message: error.message,
      email
    });
    return NextResponse.redirect(new URL(`/login?error=${encodeURIComponent(error.code ?? "invalid_credentials")}`, request.url), 303);
  }
  return NextResponse.redirect(new URL("/", request.url), 303);
}

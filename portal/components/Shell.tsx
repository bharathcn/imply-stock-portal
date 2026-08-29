import { LogOut, ShieldCheck } from "lucide-react";
import type { Viewer } from "@/lib/auth";

export function Shell({ viewer, children }: { viewer: Viewer; children: React.ReactNode }) {
  return (
    <div className="min-h-screen">
      <header className="sticky top-0 z-10 border-b border-white/10 bg-imply-green text-white shadow-soft">
        <div className="mx-auto flex max-w-6xl items-center gap-3 px-4 py-3">
          <div className="grid h-11 w-11 place-items-center rounded-lg border border-imply-gold text-xs font-black tracking-widest text-imply-gold">
            IMPLY
          </div>
          <div>
            <h1 className="text-base font-black leading-tight">Stock & Price</h1>
            <p className="text-xs text-white/70">Sales portal</p>
          </div>
          <div className="ml-auto flex items-center gap-2">
            {viewer.role === "admin" ? (
              <a className="grid h-10 w-10 place-items-center rounded-full bg-white/10 text-imply-gold" href="/admin" title="Admin">
                <ShieldCheck className="h-5 w-5" aria-hidden="true" />
              </a>
            ) : null}
            <form action="/auth/sign-out" method="post">
              <button className="grid h-10 w-10 place-items-center rounded-full bg-imply-gold text-imply-green" title="Sign out" aria-label="Sign out">
                <LogOut className="h-5 w-5" aria-hidden="true" />
              </button>
            </form>
          </div>
        </div>
      </header>
      <main className="mx-auto max-w-6xl px-3 py-4 sm:px-4 sm:py-6">{children}</main>
    </div>
  );
}

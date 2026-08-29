import { isSupabaseConfigured } from "@/lib/env";

export default async function LoginPage({ searchParams }: { searchParams: Promise<{ error?: string }> }) {
  const { error } = await searchParams;
  return (
    <main className="grid min-h-screen place-items-center px-4 py-8">
      <section className="w-full max-w-sm rounded-lg border border-stone-200 bg-white p-5 shadow-soft">
        <div className="mb-6">
          <div className="mb-4 grid h-12 w-12 place-items-center rounded-lg border border-imply-gold text-xs font-black tracking-widest text-imply-green">IMPLY</div>
          <h1 className="text-2xl font-black text-imply-ink">Sign in</h1>
          <p className="mt-2 text-sm leading-6 text-zinc-600">Use your approved IMPLY sales or admin account.</p>
        </div>
        {!isSupabaseConfigured() ? (
          <div className="rounded-lg bg-amber-50 p-3 text-sm leading-6 text-amber-950">
            Development mode is active because Supabase environment variables are not configured. Open the stock portal from the home route.
          </div>
        ) : (
          <form action="/auth/sign-in" method="post" className="grid gap-4">
            {error ? (
              <div className="rounded-lg bg-red-50 p-3 text-sm font-bold leading-6 text-red-800">
                {error === "invalid_credentials"
                  ? "Supabase rejected the email or password. Check the Auth user exists, is confirmed, and the password matches this Supabase project."
                  : `Sign-in failed: ${error}`}
              </div>
            ) : null}
            <label className="grid gap-2 text-sm font-bold text-zinc-700">
              Email
              <input className="h-12 rounded-lg border border-stone-300 px-3" name="email" type="email" required autoComplete="email" />
            </label>
            <label className="grid gap-2 text-sm font-bold text-zinc-700">
              Password
              <input className="h-12 rounded-lg border border-stone-300 px-3" name="password" type="password" required autoComplete="current-password" />
            </label>
            <button className="h-12 rounded-lg bg-imply-green px-4 font-black text-white">Sign in</button>
          </form>
        )}
      </section>
    </main>
  );
}

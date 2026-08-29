export function getFreshnessThresholdMinutes(): number {
  const value = Number(process.env.DATA_FRESHNESS_MINUTES ?? "10");
  return Number.isFinite(value) && value > 0 ? value : 10;
}

export function isSupabaseConfigured(): boolean {
  return Boolean(process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY);
}

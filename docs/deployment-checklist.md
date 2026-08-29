# Deployment Checklist

## Portal

- [ ] Run `npm install`.
- [ ] Run `npm run lint`.
- [ ] Run `npm run typecheck`.
- [ ] Run `npm run test`.
- [ ] Run `npm run build`.
- [ ] Confirm no `.env` files or real credentials are committed.
- [ ] Set all Vercel environment variables.
- [ ] Deploy Vercel project with root `portal`.
- [ ] Attach `stock.imply.co.in`.
- [ ] Verify mobile layout at 360 px width.

## Supabase

- [ ] Run `supabase/migrations/001_initial_schema.sql`.
- [ ] Create Auth users.
- [ ] Bootstrap the first admin profile by UUID.
- [ ] Confirm RLS is enabled on all public tables.
- [ ] Confirm sales users cannot access admin-only data.
- [ ] Import production product mappings explicitly.

## Connector

- [ ] Install .NET 8 runtime on the office PC.
- [ ] Enable TallyPrime local HTTP integration.
- [ ] Set `IMPLY_CONNECTOR_SECRET` as a machine-level environment variable.
- [ ] Configure `appsettings.json`.
- [ ] Run `diagnostic` without upload.
- [ ] Review sample stock item names and company configuration.
- [ ] Run `diagnostic --upload` after API credentials are ready.
- [ ] Install as a Windows service.
- [ ] Confirm heartbeat appears in the admin sync screen or Supabase table.

## Operations

- [ ] Document connector secret rotation owner.
- [ ] Enable Supabase backups.
- [ ] Keep Tally port `9000` private.
- [ ] Train admins to reconcile unmapped items before sales visibility.
- [ ] Confirm stale data is labeled `Last known data` after freshness threshold expires.

# Unmapped-item mapping

`002_unmapped_mapping.sql` adds the `map_unmapped_tally_item` transaction. Apply it through the normal migration process before publishing the updated portal. No existing records are automatically mapped or repriced.

The function requires an active authenticated admin, locks the pending item and target product, and either creates a priced product or replaces an existing product's Tally mapping. The existing product's price and active status are preserved. Balances from the previous mapping are cleared; the next successful connector snapshot supplies current stock and godown balances. A constraint or validation failure rolls back the entire operation, including removal from the pending queue.

The portal displays the actual pending queue at `/admin/unmapped` with 50 items per page, literal name search, and explicit mapping actions. Without Supabase configuration it displays an unavailable state and refuses writes. No service-role key is used by this workflow.

## Database verification

Run `unmapped_mapping.sql` only on a disposable local Supabase database after applying migrations. It creates temporary test fixtures inside a transaction and finishes with `ROLLBACK`. It checks product creation, duplicate-combination rollback, existing-product mapping, preservation of price, removal of stale balances, and rejection of sales users and inactive admins.

Example, with a local database connection configured privately:

```powershell
psql "$env:LOCAL_TEST_DATABASE_URL" -v ON_ERROR_STOP=1 -f supabase/tests/unmapped_mapping.sql
```

Never point this test at a production database. Do not commit connection strings.

## Release verification

After the migration and portal deployment have been separately approved and completed, map one pending item as an admin. Wait for the next normal connector snapshot. Verify that the mapped count increases, the pending count decreases, and the product displays the current stock and godown balances. Sales users must not be able to open the mapping page or execute the mapping function.

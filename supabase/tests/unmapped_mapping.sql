-- Run only against a disposable local Supabase database with migrations applied.
-- Every fixture is rolled back. This file is not a migration.
begin;

insert into auth.users (id) values ('00000000-0000-4000-8000-000000000002');
insert into public.profiles (id, role, active) values ('00000000-0000-4000-8000-000000000002', 'admin', true);
select set_config('request.jwt.claim.sub', '00000000-0000-4000-8000-000000000002', true);

do $$
declare
  target_id uuid;
  created_id uuid;
  saved_price numeric;
  spec jsonb := '{"brand":"TEST","product_family":"Mapping test","thickness":"18 mm","size":"8 x 4","grade":"BWP","custom_selling_price":"2850.00","low_stock_threshold":10,"active":true}';
begin
  insert into public.unmapped_tally_items (tally_item_name, unit, last_quantity)
    values ('__mapping_test_new', 'sheets', 42), ('__mapping_test_conflict', 'sheets', 7), ('__mapping_test_existing', 'sheets', 12);
  created_id := public.map_unmapped_tally_item('__mapping_test_new', null, spec);
  if not exists (select 1 from public.products where id = created_id and custom_selling_price = 2850 and tally_item_name = '__mapping_test_new')
    or exists (select 1 from public.unmapped_tally_items where tally_item_name = '__mapping_test_new') then
    raise exception 'New product mapping failed';
  end if;
  begin
    perform public.map_unmapped_tally_item('__mapping_test_conflict', null, spec);
    raise exception 'Expected duplicate combination rejection';
  exception when unique_violation then null;
  end;
  if not exists (select 1 from public.unmapped_tally_items where tally_item_name = '__mapping_test_conflict') then
    raise exception 'Rejected mapping removed the pending item';
  end if;

  insert into public.products (brand, product_family, thickness, size, grade, tally_item_name, custom_selling_price)
    values ('TEST', 'Existing mapping test', '18 mm', '8 x 4', 'BWP', '__mapping_test_old', 100) returning id into target_id;
  insert into public.inventory_current (product_id, total_quantity, last_successful_sync_at) values (target_id, 99, now());
  insert into public.inventory_by_godown (product_id, godown_name, quantity, last_successful_sync_at) values (target_id, 'Test', 99, now());
  perform public.map_unmapped_tally_item('__mapping_test_existing', target_id, null);
  select custom_selling_price into saved_price from public.products where id = target_id;
  if saved_price <> 100 or exists (select 1 from public.inventory_current i where i.product_id = target_id)
    or exists (select 1 from public.inventory_by_godown i where i.product_id = target_id) then
    raise exception 'Existing mapping changed price or retained stale balances';
  end if;

  update public.profiles set role = 'sales' where id = auth.uid();
  begin
    perform public.map_unmapped_tally_item('__mapping_test_conflict', null, spec);
    raise exception 'Sales user was allowed to map';
  exception when insufficient_privilege then null;
  end;
  update public.profiles set role = 'admin', active = false where id = auth.uid();
  begin
    perform public.map_unmapped_tally_item('__mapping_test_conflict', null, spec);
    raise exception 'Inactive admin was allowed to map';
  exception when insufficient_privilege then null;
  end;
end;
$$;

rollback;

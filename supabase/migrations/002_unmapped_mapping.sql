-- Mapping is one transaction, authenticated with the administrator's session.
create or replace function public.map_unmapped_tally_item(
  item_name text,
  target_product_id uuid default null,
  new_product jsonb default null
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  source_item public.unmapped_tally_items%rowtype;
  mapped_id uuid;
  field_name text;
begin
  if auth.uid() is null or not public.is_admin() then
    raise exception 'Administrator access required' using errcode = '42501';
  end if;
  if item_name is null or length(btrim(item_name)) not between 1 and 240 then
    raise exception 'Invalid Tally item name' using errcode = '22023';
  end if;
  if (target_product_id is null) = (new_product is null) then
    raise exception 'Choose an existing product or a new product' using errcode = '22023';
  end if;

  select * into source_item from public.unmapped_tally_items
  where tally_item_name_normalized = lower(btrim(item_name))
  order by tally_item_name limit 1 for update;
  if not found then
    raise exception 'Unmapped item no longer exists' using errcode = 'P0002';
  end if;
  if exists (select 1 from public.products where tally_item_name_normalized = source_item.tally_item_name_normalized) then
    raise exception 'Tally item is already mapped' using errcode = '23505';
  end if;

  if target_product_id is not null then
    select id into mapped_id from public.products where id = target_product_id for update;
    if not found then
      raise exception 'Product no longer exists' using errcode = 'P0002';
    end if;
    update public.products set tally_item_name = source_item.tally_item_name,
      unit = coalesce(nullif(source_item.unit, ''), unit) where id = mapped_id;
    -- Balances for the previous Tally item must not be displayed for the new mapping.
    delete from public.inventory_by_godown where product_id = mapped_id;
    delete from public.inventory_current where product_id = mapped_id;
  else
    if jsonb_typeof(new_product) is distinct from 'object' then
      raise exception 'Invalid product' using errcode = '22023';
    end if;
    foreach field_name in array array['brand', 'product_family', 'thickness', 'size', 'grade'] loop
      if jsonb_typeof(new_product->field_name) is distinct from 'string'
        or length(btrim(new_product->>field_name)) not between 1 and 160 then
        raise exception 'Invalid product attribute' using errcode = '22023';
      end if;
    end loop;
    if coalesce(new_product->>'custom_selling_price', '') !~ '^\d{1,10}(\.\d{1,2})?$'
      or coalesce(new_product->>'low_stock_threshold', '') !~ '^\d+$'
      or jsonb_typeof(new_product->'active') is distinct from 'boolean' then
      raise exception 'Invalid price, threshold or active status' using errcode = '22023';
    end if;
    insert into public.products (brand, product_family, thickness, size, grade,
      tally_item_name, unit, custom_selling_price, low_stock_threshold, active)
    values (btrim(new_product->>'brand'), btrim(new_product->>'product_family'),
      btrim(new_product->>'thickness'), btrim(new_product->>'size'), btrim(new_product->>'grade'),
      source_item.tally_item_name, coalesce(nullif(source_item.unit, ''), 'units'),
      (new_product->>'custom_selling_price')::numeric, (new_product->>'low_stock_threshold')::integer,
      (new_product->>'active')::boolean)
    returning id into mapped_id;
  end if;

  delete from public.unmapped_tally_items where tally_item_name_normalized = source_item.tally_item_name_normalized;
  return mapped_id;
end;
$$;

revoke all on function public.map_unmapped_tally_item(text, uuid, jsonb) from public, anon;
grant execute on function public.map_unmapped_tally_item(text, uuid, jsonb) to authenticated;

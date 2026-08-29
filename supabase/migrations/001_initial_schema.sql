create extension if not exists pgcrypto;

create type public.user_role as enum ('sales', 'admin');
create type public.sync_status as enum ('running', 'success', 'failed', 'rejected');
create type public.heartbeat_status as enum ('healthy', 'tally_unavailable', 'company_not_loaded', 'sync_failed');

create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  full_name text,
  role public.user_role not null default 'sales',
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.products (
  id uuid primary key default gen_random_uuid(),
  brand text not null,
  product_family text not null,
  thickness text not null,
  size text not null,
  grade text not null,
  tally_item_name text not null,
  tally_item_name_normalized text generated always as (lower(trim(tally_item_name))) stored,
  unit text not null default 'sheets',
  custom_selling_price numeric(12,2) not null check (custom_selling_price >= 0),
  low_stock_threshold integer not null default 10 check (low_stock_threshold >= 0),
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint products_unique_attributes unique (brand, product_family, thickness, size, grade),
  constraint products_unique_active_tally_item unique (tally_item_name_normalized)
);

create table public.inventory_current (
  product_id uuid primary key references public.products(id) on delete cascade,
  total_quantity numeric(14,3) not null,
  tally_quantity_raw text,
  last_successful_sync_at timestamptz not null,
  updated_at timestamptz not null default now()
);

create table public.inventory_by_godown (
  product_id uuid not null references public.products(id) on delete cascade,
  godown_name text not null,
  quantity numeric(14,3) not null,
  last_successful_sync_at timestamptz not null,
  primary key (product_id, godown_name)
);

create table public.sync_runs (
  id uuid primary key default gen_random_uuid(),
  connector_id text not null,
  request_id uuid not null unique,
  started_at timestamptz not null,
  completed_at timestamptz,
  status public.sync_status not null,
  received_item_count integer not null default 0,
  mapped_item_count integer not null default 0,
  unmapped_item_count integer not null default 0,
  error_summary text,
  created_at timestamptz not null default now()
);

create table public.connector_heartbeats (
  connector_id text primary key,
  connector_version text not null,
  tally_company text not null,
  tally_release text,
  last_seen_at timestamptz not null default now(),
  last_successful_sync_at timestamptz,
  status public.heartbeat_status not null
);

create table public.price_history (
  id uuid primary key default gen_random_uuid(),
  product_id uuid not null references public.products(id) on delete cascade,
  old_price numeric(12,2) not null,
  new_price numeric(12,2) not null,
  changed_by uuid references auth.users(id),
  changed_at timestamptz not null default now(),
  reason text
);

create table public.unmapped_tally_items (
  tally_item_name text primary key,
  tally_item_name_normalized text generated always as (lower(trim(tally_item_name))) stored,
  first_seen_at timestamptz not null default now(),
  last_seen_at timestamptz not null default now(),
  last_connector_id text,
  last_tally_company text,
  last_quantity numeric(14,3),
  unit text
);

create index products_lookup_idx on public.products (active, brand, product_family, thickness, size, grade);
create index inventory_current_sync_idx on public.inventory_current (last_successful_sync_at desc);
create index inventory_by_godown_product_idx on public.inventory_by_godown (product_id);
create index sync_runs_connector_created_idx on public.sync_runs (connector_id, created_at desc);
create index price_history_product_changed_idx on public.price_history (product_id, changed_at desc);

create or replace function public.touch_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger profiles_touch_updated_at before update on public.profiles for each row execute function public.touch_updated_at();
create trigger products_touch_updated_at before update on public.products for each row execute function public.touch_updated_at();

create or replace function public.current_profile_role()
returns public.user_role language sql stable security definer set search_path = public as $$
  select role from public.profiles where id = auth.uid() and active = true;
$$;

create or replace function public.is_admin()
returns boolean language sql stable security definer set search_path = public as $$
  select coalesce(public.current_profile_role() = 'admin', false);
$$;

alter table public.profiles enable row level security;
alter table public.products enable row level security;
alter table public.inventory_current enable row level security;
alter table public.inventory_by_godown enable row level security;
alter table public.sync_runs enable row level security;
alter table public.connector_heartbeats enable row level security;
alter table public.price_history enable row level security;
alter table public.unmapped_tally_items enable row level security;

create policy "users can read own active profile" on public.profiles for select using (id = auth.uid() and active = true);
create policy "admins can read profiles" on public.profiles for select using (public.is_admin());
create policy "admins can update profiles" on public.profiles for update using (public.is_admin()) with check (public.is_admin());

create policy "active products visible to authenticated users" on public.products for select using (active = true and auth.uid() is not null);
create policy "admins can manage products" on public.products for all using (public.is_admin()) with check (public.is_admin());

create policy "inventory visible for active products" on public.inventory_current for select using (exists (select 1 from public.products p where p.id = product_id and p.active = true) and auth.uid() is not null);
create policy "admins can manage inventory current" on public.inventory_current for all using (public.is_admin()) with check (public.is_admin());

create policy "godown inventory visible for active products" on public.inventory_by_godown for select using (exists (select 1 from public.products p where p.id = product_id and p.active = true) and auth.uid() is not null);
create policy "admins can manage godown inventory" on public.inventory_by_godown for all using (public.is_admin()) with check (public.is_admin());

create policy "admins can read sync runs" on public.sync_runs for select using (public.is_admin());
create policy "admins can read heartbeats" on public.connector_heartbeats for select using (public.is_admin());
create policy "admins can read price history" on public.price_history for select using (public.is_admin());
create policy "admins can insert price history" on public.price_history for insert with check (public.is_admin());
create policy "admins can read unmapped tally items" on public.unmapped_tally_items for select using (public.is_admin());

create or replace function public.ingest_inventory_snapshot(payload jsonb)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  item jsonb;
  godown jsonb;
  mapped_product_id uuid;
  mapped_count integer := 0;
  unmapped_count integer := 0;
  request_uuid uuid := (payload->>'requestId')::uuid;
begin
  if exists (select 1 from public.sync_runs where request_id = request_uuid and status = 'success') then
    return jsonb_build_object('accepted', true, 'idempotent', true);
  end if;

  insert into public.sync_runs (
    connector_id,
    request_id,
    started_at,
    completed_at,
    status,
    received_item_count
  )
  values (
    payload->>'connectorId',
    request_uuid,
    (payload->>'syncStartedAt')::timestamptz,
    (payload->>'syncCompletedAt')::timestamptz,
    'running',
    jsonb_array_length(payload->'items')
  )
  on conflict (request_id) do nothing;

  for item in select * from jsonb_array_elements(payload->'items')
  loop
    select id into mapped_product_id
    from public.products
    where tally_item_name_normalized = lower(trim(item->>'tallyItemName'))
    limit 1;

    if mapped_product_id is null then
      unmapped_count := unmapped_count + 1;
      insert into public.unmapped_tally_items (
        tally_item_name,
        last_connector_id,
        last_tally_company,
        last_quantity,
        unit
      )
      values (
        item->>'tallyItemName',
        payload->>'connectorId',
        payload->>'tallyCompany',
        (item->>'totalQuantity')::numeric,
        item->>'unit'
      )
      on conflict (tally_item_name) do update set
        last_seen_at = now(),
        last_connector_id = excluded.last_connector_id,
        last_tally_company = excluded.last_tally_company,
        last_quantity = excluded.last_quantity,
        unit = excluded.unit;
    else
      mapped_count := mapped_count + 1;
      update public.products set unit = item->>'unit' where id = mapped_product_id;
      insert into public.inventory_current (
        product_id,
        total_quantity,
        tally_quantity_raw,
        last_successful_sync_at,
        updated_at
      )
      values (
        mapped_product_id,
        (item->>'totalQuantity')::numeric,
        item->>'totalQuantity',
        (payload->>'syncCompletedAt')::timestamptz,
        now()
      )
      on conflict (product_id) do update set
        total_quantity = excluded.total_quantity,
        tally_quantity_raw = excluded.tally_quantity_raw,
        last_successful_sync_at = excluded.last_successful_sync_at,
        updated_at = now();

      delete from public.inventory_by_godown where product_id = mapped_product_id;
      for godown in select * from jsonb_array_elements(item->'godowns')
      loop
        insert into public.inventory_by_godown (
          product_id,
          godown_name,
          quantity,
          last_successful_sync_at
        )
        values (
          mapped_product_id,
          godown->>'godownName',
          (godown->>'quantity')::numeric,
          (payload->>'syncCompletedAt')::timestamptz
        );
      end loop;
    end if;
  end loop;

  update public.sync_runs
  set status = 'success',
      mapped_item_count = mapped_count,
      unmapped_item_count = unmapped_count,
      completed_at = (payload->>'syncCompletedAt')::timestamptz
  where request_id = request_uuid;

  insert into public.connector_heartbeats (
    connector_id,
    connector_version,
    tally_company,
    tally_release,
    last_seen_at,
    last_successful_sync_at,
    status
  )
  values (
    payload->>'connectorId',
    payload->>'connectorVersion',
    payload->>'tallyCompany',
    payload->>'tallyRelease',
    now(),
    (payload->>'syncCompletedAt')::timestamptz,
    'healthy'
  )
  on conflict (connector_id) do update set
    connector_version = excluded.connector_version,
    tally_company = excluded.tally_company,
    tally_release = excluded.tally_release,
    last_seen_at = excluded.last_seen_at,
    last_successful_sync_at = excluded.last_successful_sync_at,
    status = excluded.status;

  return jsonb_build_object('accepted', true, 'mappedItemCount', mapped_count, 'unmappedItemCount', unmapped_count);
exception when others then
  update public.sync_runs
  set status = 'failed',
      error_summary = left(sqlerrm, 500),
      completed_at = now()
  where request_id = request_uuid;
  raise;
end;
$$;

revoke all on function public.ingest_inventory_snapshot(jsonb) from anon, authenticated;

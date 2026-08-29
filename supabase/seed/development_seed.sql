insert into public.products (id, brand, product_family, thickness, size, grade, tally_item_name, unit, custom_selling_price, low_stock_threshold, active)
values
('11111111-1111-4111-8111-111111111111', 'IMPLY', 'Royal', '18 mm', '8 x 4 ft', 'BWP', 'IMPLY ROYAL 18MM 8X4 BWP', 'sheets', 2850.00, 10, true),
('22222222-2222-4222-8222-222222222222', 'IMPLY', 'Royal', '12 mm', '8 x 4 ft', 'BWP', 'IMPLY ROYAL 12MM 8X4 BWP', 'sheets', 2380.00, 10, true),
('33333333-3333-4333-8333-333333333333', 'IMPLY', 'Plus', '18 mm', '8 x 4 ft', 'BWR', 'IMPLY PLUS 18MM 8X4 BWR', 'sheets', 2490.00, 10, true),
('44444444-4444-4444-8444-444444444444', 'IMPLY', 'OG', '16 mm', '8 x 4 ft', 'BWP', 'IMPLY OG 16MM 8X4 BWP', 'sheets', 2680.00, 10, true),
('55555555-5555-4555-8555-555555555555', 'IMPLY', 'Calibrated', '18 mm', '8 x 4 ft', 'BWR', 'IMPLY CALIBRATED 18MM 8X4 BWR', 'sheets', 3120.00, 10, true),
('66666666-6666-4666-8666-666666666666', 'IMPLY', 'Bliss', '12 mm', '7 x 4 ft', 'MR', 'IMPLY BLISS 12MM 7X4 MR', 'sheets', 1790.00, 10, true)
on conflict (id) do nothing;

insert into public.inventory_current (product_id, total_quantity, tally_quantity_raw, last_successful_sync_at)
values
('11111111-1111-4111-8111-111111111111', 42, '42', now()),
('22222222-2222-4222-8222-222222222222', 0, '0', now()),
('33333333-3333-4333-8333-333333333333', 8, '8', now()),
('44444444-4444-4444-8444-444444444444', 21, '21', now()),
('55555555-5555-4555-8555-555555555555', 0, '0', now()),
('66666666-6666-4666-8666-666666666666', 57, '57', now())
on conflict (product_id) do update set total_quantity = excluded.total_quantity, last_successful_sync_at = excluded.last_successful_sync_at;

insert into public.inventory_by_godown (product_id, godown_name, quantity, last_successful_sync_at)
values
('11111111-1111-4111-8111-111111111111', 'RR Nagar', 30, now()),
('11111111-1111-4111-8111-111111111111', 'Main', 12, now()),
('22222222-2222-4222-8222-222222222222', 'RR Nagar', 0, now()),
('22222222-2222-4222-8222-222222222222', 'Main', 0, now()),
('33333333-3333-4333-8333-333333333333', 'RR Nagar', 5, now()),
('33333333-3333-4333-8333-333333333333', 'Main', 3, now()),
('44444444-4444-4444-8444-444444444444', 'RR Nagar', 15, now()),
('44444444-4444-4444-8444-444444444444', 'Main', 6, now()),
('55555555-5555-4555-8555-555555555555', 'RR Nagar', 0, now()),
('55555555-5555-4555-8555-555555555555', 'Main', 0, now()),
('66666666-6666-4666-8666-666666666666', 'RR Nagar', 37, now()),
('66666666-6666-4666-8666-666666666666', 'Main', 20, now())
on conflict (product_id, godown_name) do update set quantity = excluded.quantity, last_successful_sync_at = excluded.last_successful_sync_at;

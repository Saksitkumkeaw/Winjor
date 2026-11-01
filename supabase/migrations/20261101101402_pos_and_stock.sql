-- ขายหน้าร้าน สแกนตั๋ว และสต็อก: ยอดสต็อกเปลี่ยนได้ผ่านฟังก์ชันเท่านั้น

create type public.stock_reason as enum ('purchase', 'sale', 'adjustment');

create table public.ingredients (
  id uuid primary key default gen_random_uuid(),
  name text not null unique check (length(trim(name)) > 0),
  unit text not null check (length(trim(unit)) > 0),
  quantity_on_hand numeric(12, 2) not null default 0,
  reorder_level numeric(12, 2) not null default 0 check (reorder_level >= 0),
  created_at timestamptz not null default now()
);

create table public.product_recipes (
  product_id uuid not null references public.products (id) on delete cascade,
  ingredient_id uuid not null references public.ingredients (id) on delete restrict,
  quantity numeric(12, 2) not null check (quantity > 0),
  primary key (product_id, ingredient_id)
);

create index product_recipes_ingredient_id_idx on public.product_recipes (ingredient_id);

create table public.stock_movements (
  id uuid primary key default gen_random_uuid(),
  ingredient_id uuid not null references public.ingredients (id) on delete restrict,
  order_id uuid references public.orders (id) on delete set null,
  change_qty numeric(12, 2) not null check (change_qty <> 0),
  reason public.stock_reason not null,
  created_by uuid references public.profiles (id) on delete set null,
  created_at timestamptz not null default now()
);

create index stock_movements_ingredient_id_idx on public.stock_movements (ingredient_id);
create index stock_movements_order_id_idx on public.stock_movements (order_id);
create index stock_movements_created_by_idx on public.stock_movements (created_by);

alter table public.ingredients enable row level security;
alter table public.product_recipes enable row level security;
alter table public.stock_movements enable row level security;

revoke all on public.ingredients, public.product_recipes, public.stock_movements
  from anon, authenticated;

grant select on public.ingredients, public.product_recipes, public.stock_movements to authenticated;
grant insert (name, unit, reorder_level) on public.ingredients to authenticated;
grant update (name, unit, reorder_level) on public.ingredients to authenticated;
grant insert, update, delete on public.product_recipes to authenticated;

create policy "Staff can read" on public.ingredients
  for select to authenticated
  using ((select private.current_app_role()) in ('staff', 'admin', 'executive'));
create policy "Admins can insert" on public.ingredients
  for insert to authenticated
  with check ((select private.current_app_role()) = 'admin');
create policy "Admins can update" on public.ingredients
  for update to authenticated
  using ((select private.current_app_role()) = 'admin')
  with check ((select private.current_app_role()) = 'admin');

create policy "Staff can read" on public.product_recipes
  for select to authenticated
  using ((select private.current_app_role()) in ('staff', 'admin', 'executive'));
create policy "Admins can insert" on public.product_recipes
  for insert to authenticated
  with check ((select private.current_app_role()) = 'admin');
create policy "Admins can update" on public.product_recipes
  for update to authenticated
  using ((select private.current_app_role()) = 'admin')
  with check ((select private.current_app_role()) = 'admin');
create policy "Admins can delete" on public.product_recipes
  for delete to authenticated
  using ((select private.current_app_role()) = 'admin');

create policy "Managers can read" on public.stock_movements
  for select to authenticated
  using ((select private.current_app_role()) in ('admin', 'executive'));

-- ให้ทั้งการจองออนไลน์และหน้าร้านใช้กติกาเดียวกัน
create function private.create_order(
  p_customer_id uuid,
  p_sold_by uuid,
  p_channel public.order_channel,
  p_showtime_id uuid,
  p_seat_ids uuid[],
  p_items jsonb
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  new_order_id uuid;
  seat_count integer := coalesce(array_length(p_seat_ids, 1), 0);
  ticket_total numeric := 0;
  item_total numeric := 0;
  valid_seat_count integer;
  showtime_base_price numeric;
  showtime_theater_id uuid;
begin
  if seat_count > 6
    or (seat_count = 0 and (p_channel = 'online' or jsonb_array_length(p_items) = 0))
  then
    raise exception 'เลือกได้ 1-6 ที่นั่ง' using errcode = 'WJ001';
  end if;

  if (select count(distinct seat_id) from unnest(p_seat_ids) as seat_id) <> seat_count then
    raise exception 'เลือกที่นั่งซ้ำ' using errcode = 'WJ001';
  end if;

  if seat_count > 0 then
    select base_price, theater_id into showtime_base_price, showtime_theater_id
    from public.showtimes
    where id = p_showtime_id
      and status = 'scheduled'
      and starts_at > now();

    if not found then
      raise exception 'รอบฉายนี้ปิดการขายแล้ว' using errcode = 'WJ002';
    end if;

    select count(*), coalesce(sum(showtime_base_price + seat_type.surcharge), 0)
    into valid_seat_count, ticket_total
    from public.seats as seat
    join public.seat_types as seat_type on seat_type.id = seat.seat_type_id
    where seat.id = any (p_seat_ids)
      and seat.theater_id = showtime_theater_id
      and seat.is_active;

    if valid_seat_count <> seat_count then
      raise exception 'มีที่นั่งที่จองไม่ได้' using errcode = 'WJ003';
    end if;
  end if;

  perform private.expire_orders();

  -- การเลือกที่นั่งใหม่แทนที่รายการที่ยังไม่จ่ายของลูกค้าคนเดิมในรอบนี้
  if p_customer_id is not null then
    with replaced as (
      update public.orders as ord
      set status = 'cancelled'
      where ord.customer_id = p_customer_id
        and ord.status = 'pending'
        and exists (
          select 1 from public.tickets as ticket
          where ticket.order_id = ord.id
            and ticket.showtime_id = p_showtime_id
        )
      returning ord.id
    )
    update public.tickets
    set status = 'released'
    where order_id in (select id from replaced)
      and status = 'held';
  end if;

  if (
    select count(*)
    from jsonb_array_elements(p_items) as item
    join public.products as product
      on product.id = (item ->> 'product_id')::uuid
      and product.is_active
    where (item ->> 'quantity')::integer between 1 and 10
  ) <> jsonb_array_length(p_items) then
    raise exception 'รายการสินค้าไม่ถูกต้อง' using errcode = 'WJ004';
  end if;

  select coalesce(sum(product.price * (item ->> 'quantity')::integer), 0)
  into item_total
  from jsonb_array_elements(p_items) as item
  join public.products as product on product.id = (item ->> 'product_id')::uuid;

  insert into public.orders (customer_id, sold_by, channel, subtotal, total, expires_at)
  values (
    p_customer_id,
    p_sold_by,
    p_channel,
    ticket_total + item_total,
    ticket_total + item_total,
    now() + interval '10 minutes'
  )
  returning id into new_order_id;

  if seat_count > 0 then
    begin
      insert into public.tickets (order_id, showtime_id, seat_id, price)
      select new_order_id, p_showtime_id, seat.id, showtime_base_price + seat_type.surcharge
      from public.seats as seat
      join public.seat_types as seat_type on seat_type.id = seat.seat_type_id
      where seat.id = any (p_seat_ids)
      order by seat.id;
    exception when unique_violation then
      raise exception 'มีคนจองที่นั่งนี้ไปแล้ว' using errcode = 'WJ005';
    end;
  end if;

  insert into public.order_items (order_id, product_id, quantity, unit_price)
  select new_order_id, product.id, (item ->> 'quantity')::integer, product.price
  from jsonb_array_elements(p_items) as item
  join public.products as product on product.id = (item ->> 'product_id')::uuid;

  return new_order_id;
end;
$$;

revoke all on function private.create_order(uuid, uuid, public.order_channel, uuid, uuid[], jsonb) from public;

create or replace function public.hold_seats(
  p_showtime_id uuid,
  p_seat_ids uuid[],
  p_items jsonb default '[]'::jsonb
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
begin
  if auth.uid() is null then
    raise exception 'ต้องเข้าสู่ระบบก่อนจอง' using errcode = '42501';
  end if;

  return private.create_order(auth.uid(), null, 'online', p_showtime_id, p_seat_ids, p_items);
end;
$$;

create function public.pos_create_order(
  p_showtime_id uuid default null,
  p_seat_ids uuid[] default '{}'::uuid[],
  p_items jsonb default '[]'::jsonb
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
begin
  if private.current_app_role() is null
    or private.current_app_role() not in ('staff', 'admin')
  then
    raise exception 'ไม่มีสิทธิ์ขายหน้าร้าน' using errcode = '42501';
  end if;

  return private.create_order(null, auth.uid(), 'pos', p_showtime_id, p_seat_ids, p_items);
end;
$$;

revoke all on function public.pos_create_order(uuid, uuid[], jsonb) from public, anon;
grant execute on function public.pos_create_order(uuid, uuid[], jsonb) to authenticated;

create function private.deduct_stock(p_order_id uuid)
returns void
language sql
security definer
set search_path = ''
as $$
  with usage as (
    select recipe.ingredient_id, sum(recipe.quantity * item.quantity) as used
    from public.order_items as item
    join public.product_recipes as recipe on recipe.product_id = item.product_id
    where item.order_id = p_order_id
    group by recipe.ingredient_id
  ),
  logged as (
    insert into public.stock_movements (ingredient_id, order_id, change_qty, reason)
    select ingredient_id, p_order_id, -used, 'sale'
    from usage
  )
  update public.ingredients as ingredient
  set quantity_on_hand = ingredient.quantity_on_hand - usage.used
  from usage
  where ingredient.id = usage.ingredient_id;
$$;

revoke all on function private.deduct_stock(uuid) from public;

create or replace function public.finalize_order(p_order_id uuid)
returns text
language plpgsql
security definer
set search_path = ''
as $$
declare
  order_status public.order_status;
  order_expires_at timestamptz;
begin
  select status, expires_at into order_status, order_expires_at
  from public.orders
  where id = p_order_id
  for update;

  if not found then
    return 'not_found';
  end if;
  if order_status = 'paid' then
    return 'already_paid';
  end if;
  if order_status <> 'pending' or order_expires_at <= now() - interval '1 minute' then
    return 'too_late';
  end if;

  update public.orders set status = 'paid' where id = p_order_id;

  update public.tickets
  set status = 'paid',
      qr_token = encode(extensions.gen_random_bytes(24), 'hex')
  where order_id = p_order_id
    and status = 'held';

  perform private.deduct_stock(p_order_id);

  return 'paid';
end;
$$;

create function public.pos_confirm_cash(p_order_id uuid)
returns text
language plpgsql
security definer
set search_path = ''
as $$
declare
  order_total numeric;
  outcome text;
begin
  if private.current_app_role() is null
    or private.current_app_role() not in ('staff', 'admin')
  then
    raise exception 'ไม่มีสิทธิ์รับเงิน' using errcode = '42501';
  end if;

  select total into order_total
  from public.orders
  where id = p_order_id
    and channel = 'pos';

  if not found then
    return 'not_found';
  end if;

  outcome := public.finalize_order(p_order_id);

  if outcome = 'paid' then
    insert into public.payments (order_id, method, amount, status, paid_at, received_by)
    values (p_order_id, 'cash', order_total, 'succeeded', now(), auth.uid());
  end if;

  return outcome;
end;
$$;

revoke all on function public.pos_confirm_cash(uuid) from public, anon;
grant execute on function public.pos_confirm_cash(uuid) to authenticated;

create function public.pos_cancel_order(p_order_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if private.current_app_role() is null
    or private.current_app_role() not in ('staff', 'admin')
  then
    raise exception 'ไม่มีสิทธิ์ยกเลิก' using errcode = '42501';
  end if;

  update public.orders
  set status = 'cancelled'
  where id = p_order_id
    and channel = 'pos'
    and status = 'pending';

  if found then
    update public.tickets
    set status = 'released'
    where order_id = p_order_id
      and status = 'held';
  end if;
end;
$$;

revoke all on function public.pos_cancel_order(uuid) from public, anon;
grant execute on function public.pos_cancel_order(uuid) to authenticated;

create function public.check_in_ticket(p_qr_token text)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  found_ticket record;
  details jsonb;
begin
  if private.current_app_role() is null
    or private.current_app_role() not in ('staff', 'admin')
  then
    raise exception 'ไม่มีสิทธิ์ตรวจตั๋ว' using errcode = '42501';
  end if;

  select
    ticket.id,
    ticket.status,
    ticket.checked_in_at,
    showtime.starts_at,
    showtime.status as showtime_status,
    movie.title,
    theater.name as theater_name,
    seat.row_label || seat.seat_number as seat_label
  into found_ticket
  from public.tickets as ticket
  join public.showtimes as showtime on showtime.id = ticket.showtime_id
  join public.movies as movie on movie.id = showtime.movie_id
  join public.theaters as theater on theater.id = showtime.theater_id
  join public.seats as seat on seat.id = ticket.seat_id
  where ticket.qr_token = p_qr_token
  for update of ticket;

  if not found then
    return jsonb_build_object('result', 'not_found');
  end if;

  details := jsonb_build_object(
    'title', found_ticket.title,
    'theater', found_ticket.theater_name,
    'seat', found_ticket.seat_label,
    'starts_at', found_ticket.starts_at,
    'checked_in_at', found_ticket.checked_in_at
  );

  if found_ticket.status = 'used' then
    return details || jsonb_build_object('result', 'used');
  end if;
  if found_ticket.status <> 'paid' or found_ticket.showtime_status <> 'scheduled' then
    return details || jsonb_build_object('result', 'invalid');
  end if;
  if now() < found_ticket.starts_at - interval '1 hour' then
    return details || jsonb_build_object('result', 'too_early');
  end if;
  if now() > found_ticket.starts_at + interval '30 minutes' then
    return details || jsonb_build_object('result', 'too_late');
  end if;

  update public.tickets
  set status = 'used',
      checked_in_at = now(),
      checked_in_by = auth.uid()
  where id = found_ticket.id;

  return details || jsonb_build_object('result', 'ok', 'checked_in_at', now());
end;
$$;

revoke all on function public.check_in_ticket(text) from public, anon;
grant execute on function public.check_in_ticket(text) to authenticated;

create function public.pickup_order_items(p_order_no text)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  found_order record;
  items jsonb;
begin
  if private.current_app_role() is null
    or private.current_app_role() not in ('staff', 'admin')
  then
    raise exception 'ไม่มีสิทธิ์ส่งมอบสินค้า' using errcode = '42501';
  end if;

  select id, status, items_picked_up_at into found_order
  from public.orders
  where order_no = upper(trim(p_order_no))
  for update;

  if not found then
    return jsonb_build_object('result', 'not_found');
  end if;

  select coalesce(jsonb_agg(jsonb_build_object('name', product.name, 'quantity', item.quantity)), '[]'::jsonb)
  into items
  from public.order_items as item
  join public.products as product on product.id = item.product_id
  where item.order_id = found_order.id;

  if jsonb_array_length(items) = 0 then
    return jsonb_build_object('result', 'no_items');
  end if;
  if found_order.status <> 'paid' then
    return jsonb_build_object('result', 'unpaid', 'items', items);
  end if;
  if found_order.items_picked_up_at is not null then
    return jsonb_build_object(
      'result', 'picked_up',
      'items', items,
      'picked_up_at', found_order.items_picked_up_at
    );
  end if;

  update public.orders
  set items_picked_up_at = now()
  where id = found_order.id;

  return jsonb_build_object('result', 'ok', 'items', items);
end;
$$;

revoke all on function public.pickup_order_items(text) from public, anon;
grant execute on function public.pickup_order_items(text) to authenticated;

create function public.adjust_stock(
  p_ingredient_id uuid,
  p_change numeric,
  p_reason public.stock_reason
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if private.current_app_role() is distinct from 'admin' then
    raise exception 'ไม่มีสิทธิ์ปรับสต็อก' using errcode = '42501';
  end if;
  if p_reason = 'sale' or p_change = 0 or (p_reason = 'purchase' and p_change < 0) then
    raise exception 'ข้อมูลการปรับสต็อกไม่ถูกต้อง' using errcode = '22023';
  end if;

  update public.ingredients
  set quantity_on_hand = quantity_on_hand + p_change
  where id = p_ingredient_id;

  if not found then
    raise exception 'ไม่พบวัตถุดิบ' using errcode = '22023';
  end if;

  insert into public.stock_movements (ingredient_id, change_qty, reason, created_by)
  values (p_ingredient_id, p_change, p_reason, auth.uid());
end;
$$;

revoke all on function public.adjust_stock(uuid, numeric, public.stock_reason) from public, anon;
grant execute on function public.adjust_stock(uuid, numeric, public.stock_reason) to authenticated;

insert into public.ingredients (name, unit, quantity_on_hand, reorder_level) values
  ('ข้าวโพดคั่ว', 'กรัม', 20000, 3000),
  ('เนย', 'กรัม', 5000, 800),
  ('กล่องป๊อปคอร์น S', 'ใบ', 300, 50),
  ('กล่องป๊อปคอร์น L', 'ใบ', 300, 50),
  ('น้ำอัดลม', 'มล.', 40000, 6000),
  ('แก้วน้ำ', 'ใบ', 500, 80);

insert into public.product_recipes (product_id, ingredient_id, quantity)
select product.id, ingredient.id, recipe.quantity
from (
  values
    ('ป๊อปคอร์น S', 'ข้าวโพดคั่ว', 80),
    ('ป๊อปคอร์น S', 'เนย', 10),
    ('ป๊อปคอร์น S', 'กล่องป๊อปคอร์น S', 1),
    ('ป๊อปคอร์น L', 'ข้าวโพดคั่ว', 150),
    ('ป๊อปคอร์น L', 'เนย', 20),
    ('ป๊อปคอร์น L', 'กล่องป๊อปคอร์น L', 1),
    ('น้ำอัดลม', 'น้ำอัดลม', 400),
    ('น้ำอัดลม', 'แก้วน้ำ', 1),
    ('ชุดคู่ ป๊อปคอร์น L + น้ำ 2 แก้ว', 'ข้าวโพดคั่ว', 150),
    ('ชุดคู่ ป๊อปคอร์น L + น้ำ 2 แก้ว', 'เนย', 20),
    ('ชุดคู่ ป๊อปคอร์น L + น้ำ 2 แก้ว', 'กล่องป๊อปคอร์น L', 1),
    ('ชุดคู่ ป๊อปคอร์น L + น้ำ 2 แก้ว', 'น้ำอัดลม', 800),
    ('ชุดคู่ ป๊อปคอร์น L + น้ำ 2 แก้ว', 'แก้วน้ำ', 2)
) as recipe (product_name, ingredient_name, quantity)
join public.products as product on product.name = recipe.product_name
join public.ingredients as ingredient on ingredient.name = recipe.ingredient_name;

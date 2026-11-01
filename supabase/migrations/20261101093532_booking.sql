-- การจอง: ผู้ใช้อ่านได้เฉพาะของตัวเอง และเขียนได้ผ่านฟังก์ชันเท่านั้น

create extension if not exists pg_cron with schema pg_catalog;

create type public.order_status as enum ('pending', 'paid', 'expired', 'cancelled', 'refunded');
create type public.order_channel as enum ('online', 'pos');
create type public.ticket_status as enum ('held', 'paid', 'used', 'released', 'refunded');
create type public.payment_method as enum ('card', 'promptpay', 'cash');
create type public.payment_status as enum ('pending', 'succeeded', 'failed', 'refunded');

create sequence private.order_no_seq;

create table public.products (
  id uuid primary key default gen_random_uuid(),
  name text not null check (length(trim(name)) > 0),
  price numeric(10, 2) not null check (price >= 0),
  image_url text,
  is_active boolean not null default true,
  created_at timestamptz not null default now()
);

create table public.orders (
  id uuid primary key default gen_random_uuid(),
  order_no text not null unique default 'WJ-' || lpad(nextval('private.order_no_seq')::text, 6, '0'),
  customer_id uuid references public.profiles (id) on delete set null,
  sold_by uuid references public.profiles (id) on delete set null,
  channel public.order_channel not null default 'online',
  status public.order_status not null default 'pending',
  subtotal numeric(10, 2) not null check (subtotal >= 0),
  discount numeric(10, 2) not null default 0 check (discount >= 0),
  total numeric(10, 2) not null check (total >= 0),
  expires_at timestamptz not null,
  items_picked_up_at timestamptz,
  created_at timestamptz not null default now()
);

create index orders_customer_id_idx on public.orders (customer_id);
create index orders_sold_by_idx on public.orders (sold_by);
create index orders_pending_expiry_idx on public.orders (expires_at) where status = 'pending';

create table public.tickets (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references public.orders (id) on delete cascade,
  showtime_id uuid not null references public.showtimes (id) on delete restrict,
  seat_id uuid not null references public.seats (id) on delete restrict,
  price numeric(10, 2) not null check (price >= 0),
  status public.ticket_status not null default 'held',
  qr_token text unique,
  checked_in_at timestamptz,
  checked_in_by uuid references public.profiles (id) on delete set null,
  created_at timestamptz not null default now()
);

create unique index tickets_one_active_seat
  on public.tickets (showtime_id, seat_id)
  where status in ('held', 'paid', 'used');
create index tickets_order_id_idx on public.tickets (order_id);
create index tickets_seat_id_idx on public.tickets (seat_id);
create index tickets_checked_in_by_idx on public.tickets (checked_in_by);

create table public.order_items (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references public.orders (id) on delete cascade,
  product_id uuid not null references public.products (id) on delete restrict,
  quantity integer not null check (quantity > 0),
  unit_price numeric(10, 2) not null check (unit_price >= 0),
  created_at timestamptz not null default now()
);

create index order_items_order_id_idx on public.order_items (order_id);
create index order_items_product_id_idx on public.order_items (product_id);

create table public.payments (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references public.orders (id) on delete cascade,
  method public.payment_method not null,
  provider text,
  provider_charge_id text unique,
  amount numeric(10, 2) not null check (amount >= 0),
  status public.payment_status not null default 'pending',
  paid_at timestamptz,
  received_by uuid references public.profiles (id) on delete set null,
  refunded_at timestamptz,
  refunded_by uuid references public.profiles (id) on delete set null,
  refund_reason text,
  created_at timestamptz not null default now()
);

create index payments_order_id_idx on public.payments (order_id);
create index payments_received_by_idx on public.payments (received_by);
create index payments_refunded_by_idx on public.payments (refunded_by);

create table public.webhook_events (
  provider_event_id text primary key,
  payload jsonb not null,
  processed_at timestamptz,
  created_at timestamptz not null default now()
);

alter table public.products enable row level security;
alter table public.orders enable row level security;
alter table public.tickets enable row level security;
alter table public.order_items enable row level security;
alter table public.payments enable row level security;
alter table public.webhook_events enable row level security;

revoke all on public.products, public.orders, public.tickets, public.order_items,
  public.payments, public.webhook_events from anon, authenticated;

grant select on public.products to anon, authenticated;
grant insert, update, delete on public.products to authenticated;
grant select on public.orders, public.tickets, public.order_items, public.payments to authenticated;

create policy "Anyone can read" on public.products
  for select to anon, authenticated using (true);
create policy "Admins can insert" on public.products
  for insert to authenticated
  with check ((select private.current_app_role()) = 'admin');
create policy "Admins can update" on public.products
  for update to authenticated
  using ((select private.current_app_role()) = 'admin')
  with check ((select private.current_app_role()) = 'admin');
create policy "Admins can delete" on public.products
  for delete to authenticated
  using ((select private.current_app_role()) = 'admin');

create policy "Read own orders or as staff" on public.orders
  for select to authenticated
  using (
    customer_id = (select auth.uid())
    or (select private.current_app_role()) in ('staff', 'admin', 'executive')
  );

create policy "Read own tickets or as staff" on public.tickets
  for select to authenticated
  using (
    order_id in (select id from public.orders where customer_id = (select auth.uid()))
    or (select private.current_app_role()) in ('staff', 'admin', 'executive')
  );

create policy "Read own items or as staff" on public.order_items
  for select to authenticated
  using (
    order_id in (select id from public.orders where customer_id = (select auth.uid()))
    or (select private.current_app_role()) in ('staff', 'admin', 'executive')
  );

create policy "Read own payments or as staff" on public.payments
  for select to authenticated
  using (
    order_id in (select id from public.orders where customer_id = (select auth.uid()))
    or (select private.current_app_role()) in ('staff', 'admin', 'executive')
  );

-- เผื่อเวลา 1 นาทีหลังหมดอายุ สำหรับการจ่ายเงินที่สำเร็จก่อนหมดเวลาแต่ผลมาถึงช้า
create function private.expire_orders()
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  with expired as (
    update public.orders
    set status = 'expired'
    where status = 'pending'
      and expires_at <= now() - interval '1 minute'
    returning id
  )
  update public.tickets
  set status = 'released'
  where order_id in (select id from expired)
    and status = 'held';
end;
$$;

revoke all on function private.expire_orders() from public;

select cron.schedule('expire-orders', '* * * * *', 'select private.expire_orders()');

-- ส่งสัญญาณให้หน้าเว็บโหลดผังใหม่ โดยไม่ส่งข้อมูลของผู้จอง
create function private.broadcast_seat_change()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  perform realtime.send(
    '{}'::jsonb,
    'seats_changed',
    'showtime:' || new.showtime_id,
    false
  );
  return null;
end;
$$;

revoke all on function private.broadcast_seat_change() from public;

create trigger tickets_broadcast_seat_change
  after insert or update of status on public.tickets
  for each row execute function private.broadcast_seat_change();

create function public.get_showtime_seats(p_showtime_id uuid)
returns table (
  seat_id uuid,
  row_label text,
  seat_number integer,
  seat_type text,
  price numeric,
  is_active boolean,
  is_taken boolean
)
language sql
stable
security definer
set search_path = ''
as $$
  select
    seat.id,
    seat.row_label,
    seat.seat_number,
    seat_type.name,
    showtime.base_price + seat_type.surcharge,
    seat.is_active,
    exists (
      select 1
      from public.tickets as ticket
      join public.orders as ord on ord.id = ticket.order_id
      where ticket.showtime_id = showtime.id
        and ticket.seat_id = seat.id
        and (
          ticket.status in ('paid', 'used')
          or (ticket.status = 'held' and ord.expires_at > now() - interval '1 minute')
        )
    )
  from public.showtimes as showtime
  join public.seats as seat on seat.theater_id = showtime.theater_id
  join public.seat_types as seat_type on seat_type.id = seat.seat_type_id
  where showtime.id = p_showtime_id
  order by seat.row_label, seat.seat_number;
$$;

revoke all on function public.get_showtime_seats(uuid) from public;
grant execute on function public.get_showtime_seats(uuid) to anon, authenticated;

create function public.hold_seats(
  p_showtime_id uuid,
  p_seat_ids uuid[],
  p_items jsonb default '[]'::jsonb
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  current_user_id uuid := auth.uid();
  new_order_id uuid;
  seat_count integer := coalesce(array_length(p_seat_ids, 1), 0);
  ticket_total numeric;
  item_total numeric := 0;
  valid_seat_count integer;
  showtime_base_price numeric;
  showtime_theater_id uuid;
begin
  if current_user_id is null then
    raise exception 'ต้องเข้าสู่ระบบก่อนจอง' using errcode = '42501';
  end if;

  if seat_count not between 1 and 6 then
    raise exception 'เลือกได้ 1-6 ที่นั่ง' using errcode = 'WJ001';
  end if;

  if (select count(distinct seat_id) from unnest(p_seat_ids) as seat_id) <> seat_count then
    raise exception 'เลือกที่นั่งซ้ำ' using errcode = 'WJ001';
  end if;

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

  perform private.expire_orders();

  -- การเลือกที่นั่งใหม่แทนที่รายการที่ยังไม่จ่ายของผู้ใช้คนเดิมในรอบนี้
  with replaced as (
    update public.orders as ord
    set status = 'cancelled'
    where ord.customer_id = current_user_id
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

  select coalesce(sum(product.price * (item ->> 'quantity')::integer), 0)
  into item_total
  from jsonb_array_elements(p_items) as item
  join public.products as product
    on product.id = (item ->> 'product_id')::uuid
    and product.is_active;

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

  insert into public.orders (customer_id, subtotal, total, expires_at)
  values (
    current_user_id,
    ticket_total + item_total,
    ticket_total + item_total,
    now() + interval '10 minutes'
  )
  returning id into new_order_id;

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

  insert into public.order_items (order_id, product_id, quantity, unit_price)
  select new_order_id, product.id, (item ->> 'quantity')::integer, product.price
  from jsonb_array_elements(p_items) as item
  join public.products as product on product.id = (item ->> 'product_id')::uuid;

  return new_order_id;
end;
$$;

revoke all on function public.hold_seats(uuid, uuid[], jsonb) from public, anon;
grant execute on function public.hold_seats(uuid, uuid[], jsonb) to authenticated;

create function public.cancel_order(p_order_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  update public.orders
  set status = 'cancelled'
  where id = p_order_id
    and customer_id = auth.uid()
    and status = 'pending';

  if found then
    update public.tickets
    set status = 'released'
    where order_id = p_order_id
      and status = 'held';
  end if;
end;
$$;

revoke all on function public.cancel_order(uuid) from public, anon;
grant execute on function public.cancel_order(uuid) to authenticated;

-- เรียกได้จาก Server หลังยืนยันกับ Omise แล้วเท่านั้น
create function public.finalize_order(p_order_id uuid)
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

  return 'paid';
end;
$$;

revoke all on function public.finalize_order(uuid) from public, anon, authenticated;
grant execute on function public.finalize_order(uuid) to service_role;

insert into public.products (name, price) values
  ('ป๊อปคอร์น S', 60),
  ('ป๊อปคอร์น L', 90),
  ('น้ำอัดลม', 40),
  ('ชุดคู่ ป๊อปคอร์น L + น้ำ 2 แก้ว', 150);

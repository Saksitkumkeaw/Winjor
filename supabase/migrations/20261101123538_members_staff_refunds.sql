-- สมาชิก คะแนน กะงาน และการคืนเงิน: คะแนนเปลี่ยนตามสถานะคำสั่งซื้อผ่าน trigger จุดเดียว

create type public.point_type as enum ('earn', 'redeem', 'reverse');

alter table public.orders
  add column points_redeemed integer not null default 0 check (points_redeemed >= 0);

create unique index profiles_phone_unique
  on public.profiles (phone)
  where phone is not null and phone <> '';

create table public.point_transactions (
  id uuid primary key default gen_random_uuid(),
  profile_id uuid not null references public.profiles (id) on delete cascade,
  order_id uuid references public.orders (id) on delete set null,
  points integer not null check (points <> 0),
  type public.point_type not null,
  created_at timestamptz not null default now()
);

create index point_transactions_profile_id_idx on public.point_transactions (profile_id);
create index point_transactions_order_id_idx on public.point_transactions (order_id);

create table public.shifts (
  id uuid primary key default gen_random_uuid(),
  staff_id uuid not null references public.profiles (id) on delete cascade,
  starts_at timestamptz not null,
  ends_at timestamptz not null,
  created_by uuid references public.profiles (id) on delete set null,
  created_at timestamptz not null default now(),
  constraint shifts_valid_range check (ends_at > starts_at),
  constraint shifts_no_overlap exclude using gist (
    staff_id with =,
    tstzrange(starts_at, ends_at) with &&
  )
);

create index shifts_starts_at_idx on public.shifts (starts_at);
create index shifts_created_by_idx on public.shifts (created_by);

create table public.attendance (
  id uuid primary key default gen_random_uuid(),
  staff_id uuid not null references public.profiles (id) on delete cascade,
  shift_id uuid references public.shifts (id) on delete set null,
  clock_in timestamptz not null default now(),
  clock_out timestamptz,
  constraint attendance_valid_range check (clock_out is null or clock_out >= clock_in)
);

create unique index attendance_one_open on public.attendance (staff_id) where clock_out is null;
create index attendance_staff_id_idx on public.attendance (staff_id);
create index attendance_shift_id_idx on public.attendance (shift_id);
create index attendance_clock_in_idx on public.attendance (clock_in);

alter table public.point_transactions enable row level security;
alter table public.shifts enable row level security;
alter table public.attendance enable row level security;

revoke all on public.point_transactions, public.shifts, public.attendance from anon, authenticated;
grant select on public.point_transactions, public.shifts, public.attendance to authenticated;
grant insert, update, delete on public.shifts to authenticated;

create policy "Read own points or as staff" on public.point_transactions
  for select to authenticated
  using (
    profile_id = (select auth.uid())
    or (select private.current_app_role()) in ('staff', 'admin')
  );

create policy "Read own shifts or as manager" on public.shifts
  for select to authenticated
  using (
    staff_id = (select auth.uid())
    or (select private.current_app_role()) in ('admin', 'executive')
  );
create policy "Admins can insert" on public.shifts
  for insert to authenticated
  with check ((select private.current_app_role()) = 'admin');
create policy "Admins can update" on public.shifts
  for update to authenticated
  using ((select private.current_app_role()) = 'admin')
  with check ((select private.current_app_role()) = 'admin');
create policy "Admins can delete" on public.shifts
  for delete to authenticated
  using ((select private.current_app_role()) = 'admin');

create policy "Read own attendance or as manager" on public.attendance
  for select to authenticated
  using (
    staff_id = (select auth.uid())
    or (select private.current_app_role()) in ('admin', 'executive')
  );

-- เบอร์ซ้ำต้องไม่ทำให้การสมัครล้มเหลว จึงไม่บันทึกเบอร์ที่มีคนใช้แล้ว
create or replace function private.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  new_phone text := nullif(trim(new.raw_user_meta_data ->> 'phone'), '');
begin
  if exists (select 1 from public.profiles where phone = new_phone) then
    new_phone := null;
  end if;

  insert into public.profiles (id, full_name, phone)
  values (new.id, coalesce(new.raw_user_meta_data ->> 'full_name', ''), new_phone);
  return new;
end;
$$;

create function private.apply_order_points()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  earned integer;
  change integer;
begin
  if new.customer_id is null then
    return null;
  end if;

  if old.status = 'pending' and new.status = 'paid' then
    earned := floor(new.total / 10)::integer;
    if earned > 0 then
      insert into public.point_transactions (profile_id, order_id, points, type)
      values (new.customer_id, new.id, earned, 'earn');

      update public.profiles
      set points_balance = points_balance + earned
      where id = new.customer_id;
    end if;
  elsif old.status = 'pending'
    and new.status in ('expired', 'cancelled')
    and new.points_redeemed > 0
  then
    insert into public.point_transactions (profile_id, order_id, points, type)
    values (new.customer_id, new.id, new.points_redeemed, 'reverse');

    update public.profiles
    set points_balance = points_balance + new.points_redeemed
    where id = new.customer_id;
  elsif old.status = 'paid' and new.status = 'refunded' then
    select coalesce(sum(points), 0) into earned
    from public.point_transactions
    where order_id = new.id
      and type = 'earn';

    change := new.points_redeemed - earned;
    if change <> 0 then
      insert into public.point_transactions (profile_id, order_id, points, type)
      values (new.customer_id, new.id, change, 'reverse');

      update public.profiles
      set points_balance = greatest(points_balance + change, 0)
      where id = new.customer_id;
    end if;
  end if;

  return null;
end;
$$;

revoke all on function private.apply_order_points() from public;

create trigger orders_apply_points
  after update of status on public.orders
  for each row
  when (old.status is distinct from new.status)
  execute function private.apply_order_points();

create function public.apply_points(p_order_id uuid, p_points integer)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  found_order record;
  discount_value numeric;
  points_change integer;
  available integer;
begin
  select id, customer_id, status, channel, subtotal, points_redeemed into found_order
  from public.orders
  where id = p_order_id
  for update;

  if not found
    or found_order.customer_id is null
    or not (
      found_order.customer_id = auth.uid()
      or (found_order.channel = 'pos' and private.current_app_role() in ('staff', 'admin'))
    )
  then
    raise exception 'ไม่พบคำสั่งซื้อ' using errcode = 'WJ010';
  end if;

  if found_order.status <> 'pending' then
    raise exception 'คำสั่งซื้อนี้ปิดแล้ว' using errcode = 'WJ010';
  end if;

  if exists (
    select 1 from public.payments
    where order_id = p_order_id
      and status = 'pending'
  ) then
    raise exception 'เริ่มชำระเงินแล้ว เปลี่ยนคะแนนไม่ได้' using errcode = 'WJ011';
  end if;

  if p_points < 0 or p_points % 100 <> 0 then
    raise exception 'แลกได้ทีละ 100 คะแนน' using errcode = 'WJ012';
  end if;

  discount_value := p_points / 100 * 20;
  if p_points > 0 and found_order.subtotal - discount_value < 20 then
    raise exception 'ยอดหลังหักส่วนลดต้องไม่ต่ำกว่า 20 บาท' using errcode = 'WJ013';
  end if;

  points_change := p_points - found_order.points_redeemed;

  select points_balance into available
  from public.profiles
  where id = found_order.customer_id
  for update;

  if points_change > available then
    raise exception 'คะแนนไม่พอ' using errcode = 'WJ014';
  end if;

  if points_change <> 0 then
    insert into public.point_transactions (profile_id, order_id, points, type)
    values (
      found_order.customer_id,
      p_order_id,
      -points_change,
      case when points_change > 0 then 'redeem'::public.point_type else 'reverse'::public.point_type end
    );

    update public.profiles
    set points_balance = points_balance - points_change
    where id = found_order.customer_id;
  end if;

  update public.orders
  set points_redeemed = p_points,
      discount = discount_value,
      total = found_order.subtotal - discount_value
  where id = p_order_id;
end;
$$;

revoke all on function public.apply_points(uuid, integer) from public, anon;
grant execute on function public.apply_points(uuid, integer) to authenticated;

create function public.pos_attach_member(p_order_id uuid, p_phone text)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  member record;
begin
  if private.current_app_role() is null
    or private.current_app_role() not in ('staff', 'admin')
  then
    raise exception 'ไม่มีสิทธิ์' using errcode = '42501';
  end if;

  select id, full_name, points_balance into member
  from public.profiles
  where phone = trim(p_phone);

  if not found then
    return jsonb_build_object('result', 'not_found');
  end if;

  update public.orders
  set customer_id = member.id
  where id = p_order_id
    and channel = 'pos'
    and status = 'pending'
    and points_redeemed = 0;

  if not found then
    return jsonb_build_object('result', 'locked');
  end if;

  return jsonb_build_object(
    'result', 'ok',
    'name', member.full_name,
    'points', member.points_balance
  );
end;
$$;

revoke all on function public.pos_attach_member(uuid, text) from public, anon;
grant execute on function public.pos_attach_member(uuid, text) to authenticated;

create function public.complete_refund(p_order_id uuid, p_reason text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if private.current_app_role() is distinct from 'admin' then
    raise exception 'ไม่มีสิทธิ์คืนเงิน' using errcode = '42501';
  end if;

  if not exists (
    select 1 from public.orders
    where id = p_order_id
      and status = 'paid'
  ) then
    raise exception 'คำสั่งซื้อนี้คืนเงินไม่ได้' using errcode = 'WJ020';
  end if;

  if exists (
    select 1 from public.tickets
    where order_id = p_order_id
      and status = 'used'
  ) then
    raise exception 'มีตั๋วที่ใช้แล้ว' using errcode = 'WJ021';
  end if;

  if exists (
    select 1
    from public.tickets as ticket
    join public.showtimes as showtime on showtime.id = ticket.showtime_id
    where ticket.order_id = p_order_id
      and showtime.status = 'scheduled'
      and showtime.starts_at <= now()
  ) then
    raise exception 'รอบฉายเริ่มแล้ว' using errcode = 'WJ022';
  end if;

  update public.tickets
  set status = 'refunded'
  where order_id = p_order_id
    and status = 'paid';

  update public.payments
  set status = 'refunded',
      refunded_at = now(),
      refunded_by = auth.uid(),
      refund_reason = p_reason
  where order_id = p_order_id
    and status = 'succeeded';

  update public.orders
  set status = 'refunded'
  where id = p_order_id;
end;
$$;

revoke all on function public.complete_refund(uuid, text) from public, anon;
grant execute on function public.complete_refund(uuid, text) to authenticated;

create function public.cancel_showtime(p_showtime_id uuid)
returns uuid[]
language plpgsql
security definer
set search_path = ''
as $$
declare
  paid_orders uuid[];
begin
  if private.current_app_role() is distinct from 'admin' then
    raise exception 'ไม่มีสิทธิ์ยกเลิกรอบฉาย' using errcode = '42501';
  end if;

  update public.showtimes
  set status = 'cancelled'
  where id = p_showtime_id;

  with held as (
    update public.orders as ord
    set status = 'cancelled'
    where ord.status = 'pending'
      and exists (
        select 1 from public.tickets as ticket
        where ticket.order_id = ord.id
          and ticket.showtime_id = p_showtime_id
      )
    returning ord.id
  )
  update public.tickets
  set status = 'released'
  where order_id in (select id from held)
    and status = 'held';

  select coalesce(array_agg(distinct ord.id), '{}') into paid_orders
  from public.orders as ord
  join public.tickets as ticket on ticket.order_id = ord.id
  where ticket.showtime_id = p_showtime_id
    and ord.status = 'paid';

  return paid_orders;
end;
$$;

revoke all on function public.cancel_showtime(uuid) from public, anon;
grant execute on function public.cancel_showtime(uuid) to authenticated;

create function public.set_user_role(p_user_id uuid, p_role public.app_role)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if private.current_app_role() is distinct from 'admin' then
    raise exception 'ไม่มีสิทธิ์เปลี่ยนบทบาท' using errcode = '42501';
  end if;
  if p_user_id = auth.uid() then
    raise exception 'เปลี่ยนบทบาทของตัวเองไม่ได้' using errcode = 'WJ030';
  end if;

  update public.profiles
  set role = p_role
  where id = p_user_id;
end;
$$;

revoke all on function public.set_user_role(uuid, public.app_role) from public, anon;
grant execute on function public.set_user_role(uuid, public.app_role) to authenticated;

create function public.clock_in()
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  current_shift uuid;
begin
  if private.current_app_role() is null
    or private.current_app_role() not in ('staff', 'admin')
  then
    raise exception 'ไม่มีสิทธิ์ลงเวลา' using errcode = '42501';
  end if;

  select id into current_shift
  from public.shifts
  where staff_id = auth.uid()
    and now() between starts_at - interval '1 hour' and ends_at
  order by starts_at
  limit 1;

  begin
    insert into public.attendance (staff_id, shift_id)
    values (auth.uid(), current_shift);
  exception when unique_violation then
    raise exception 'ลงเวลาเข้างานไว้แล้ว' using errcode = 'WJ040';
  end;
end;
$$;

revoke all on function public.clock_in() from public, anon;
grant execute on function public.clock_in() to authenticated;

create function public.clock_out()
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  update public.attendance
  set clock_out = now()
  where staff_id = auth.uid()
    and clock_out is null;

  if not found then
    raise exception 'ยังไม่ได้ลงเวลาเข้างาน' using errcode = 'WJ041';
  end if;
end;
$$;

revoke all on function public.clock_out() from public, anon;
grant execute on function public.clock_out() to authenticated;

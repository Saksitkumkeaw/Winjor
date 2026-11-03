-- ระบบสนับสนุนการตัดสินใจสั่งซื้อวัตถุดิบ: ต้นทุนสินค้าคงคลัง บันทึกการตัดสินใจ และข้อมูลสรุปสำหรับหลังบ้าน

alter table public.ingredients
  add column unit_cost numeric(12, 4) not null default 0 check (unit_cost >= 0),
  add column order_cost numeric(10, 2) not null default 0 check (order_cost >= 0),
  add column holding_rate numeric(5, 4) not null default 0.25 check (holding_rate between 0 and 1),
  add column lead_time_days integer not null default 3 check (lead_time_days between 0 and 60),
  add column discount_min_qty numeric(12, 2) check (discount_min_qty > 0),
  add column discount_pct numeric(5, 2) check (discount_pct > 0 and discount_pct < 100),
  add constraint ingredients_discount_pair
    check ((discount_min_qty is null) = (discount_pct is null));

grant insert (unit_cost, order_cost, holding_rate, lead_time_days, discount_min_qty, discount_pct)
  on public.ingredients to authenticated;
grant update (unit_cost, order_cost, holding_rate, lead_time_days, discount_min_qty, discount_pct)
  on public.ingredients to authenticated;

create type public.reorder_option as enum ('A', 'B', 'C');

-- บันทึกเท่านั้น แก้หรือลบไม่ได้ เพื่อใช้ย้อนดูว่าตัดสินใจจากข้อมูลอะไร
create table public.reorder_decisions (
  id uuid primary key default gen_random_uuid(),
  ingredient_id uuid not null references public.ingredients (id) on delete restrict,
  recommended_option public.reorder_option not null,
  recommended_qty numeric(12, 2) not null check (recommended_qty >= 0),
  approved_option public.reorder_option not null,
  approved_qty numeric(12, 2) not null check (approved_qty > 0),
  service_level integer not null check (service_level in (90, 95, 99)),
  demand_adjust_pct integer not null default 0 check (demand_adjust_pct between -30 and 60),
  d numeric(12, 2) not null check (d >= 0),
  sigma numeric(12, 2) not null check (sigma >= 0),
  rop numeric(12, 2) not null check (rop >= 0),
  on_hand numeric(12, 2) not null,
  lead_time_days integer not null check (lead_time_days between 0 and 60),
  order_cost numeric(10, 2) not null check (order_cost >= 0),
  created_by uuid default auth.uid() references public.profiles (id) on delete set null,
  created_at timestamptz not null default now()
);

create index reorder_decisions_ingredient_id_idx on public.reorder_decisions (ingredient_id);
create index reorder_decisions_created_by_idx on public.reorder_decisions (created_by);

alter table public.reorder_decisions enable row level security;

revoke all on public.reorder_decisions from anon, authenticated;
grant select on public.reorder_decisions to authenticated;
grant insert (
  ingredient_id, recommended_option, recommended_qty, approved_option, approved_qty,
  service_level, demand_adjust_pct, d, sigma, rop, on_hand, lead_time_days, order_cost
) on public.reorder_decisions to authenticated;

create policy "Admins can read" on public.reorder_decisions
  for select to authenticated
  using ((select private.current_app_role()) = 'admin');
create policy "Admins can insert" on public.reorder_decisions
  for insert to authenticated
  with check (
    (select private.current_app_role()) = 'admin'
    and created_by = (select auth.uid())
  );

-- ยอดใช้รายวันของทุกวัตถุดิบ วันที่ไม่มีการขายได้ 0 คืนเป็น jsonb จึงไม่ติดจำนวนแถวสูงสุดของ API
create function public.ingredient_daily_usage(p_from date, p_to date)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  range_start timestamptz := p_from::timestamp at time zone 'Asia/Bangkok';
  range_end timestamptz := (p_to + 1)::timestamp at time zone 'Asia/Bangkok';
  result jsonb;
begin
  if private.current_app_role() is distinct from 'admin' then
    raise exception 'ไม่มีสิทธิ์ดูข้อมูลการใช้วัตถุดิบ' using errcode = '42501';
  end if;
  if p_to < p_from or p_to - p_from > 366 then
    raise exception 'ช่วงวันที่ไม่ถูกต้อง' using errcode = 'WJ050';
  end if;

  with daily as (
    select
      movement.ingredient_id,
      (movement.created_at at time zone 'Asia/Bangkok')::date as usage_date,
      sum(-movement.change_qty) as used
    from public.stock_movements as movement
    where movement.reason = 'sale'
      and movement.created_at >= range_start
      and movement.created_at < range_end
    group by movement.ingredient_id, usage_date
  )
  select jsonb_build_object(
    'dates', (
      select jsonb_agg(day::date order by day)
      from generate_series(p_from::timestamp, p_to::timestamp, interval '1 day') as day
    ),
    'ingredients', coalesce((
      select jsonb_agg(
        jsonb_build_object(
          'ingredient_id', ingredient.id,
          'usage', (
            select jsonb_agg(coalesce(daily.used, 0) order by day)
            from generate_series(p_from::timestamp, p_to::timestamp, interval '1 day') as day
            left join daily
              on daily.ingredient_id = ingredient.id
              and daily.usage_date = day::date
          )
        )
        order by ingredient.name
      )
      from public.ingredients as ingredient
    ), '[]'::jsonb)
  )
  into result;

  return result;
end;
$$;

revoke all on function public.ingredient_daily_usage(date, date) from public, anon;
grant execute on function public.ingredient_daily_usage(date, date) to authenticated;

-- ความต้องการรอบฉายต่อหนัง นับที่นั่งแบบเดียวกับ sales_report
-- นับเฉพาะรอบที่เริ่มแล้ว เพราะรอบที่ยังไม่ถึงยังขายไม่ครบ
create function public.showtime_demand(p_from date, p_to date)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  days integer := p_to - p_from + 1;
  range_start timestamptz := p_from::timestamp at time zone 'Asia/Bangkok';
  range_end timestamptz := (p_to + 1)::timestamp at time zone 'Asia/Bangkok';
  previous_start timestamptz := (p_from - (p_to - p_from + 1))::timestamp at time zone 'Asia/Bangkok';
  result jsonb;
begin
  if private.current_app_role() is distinct from 'admin' then
    raise exception 'ไม่มีสิทธิ์ดูข้อมูลรอบฉาย' using errcode = '42501';
  end if;
  if p_to < p_from or p_to - p_from > 366 then
    raise exception 'ช่วงวันที่ไม่ถูกต้อง' using errcode = 'WJ050';
  end if;

  with sold_by_showtime as (
    select ticket.showtime_id, count(*) as sold
    from public.tickets as ticket
    where ticket.status in ('paid', 'used')
    group by ticket.showtime_id
  ),
  shows as (
    select
      showtime.movie_id,
      showtime.starts_at >= range_start as is_current,
      coalesce(sold.sold, 0) as sold,
      (
        select count(*)
        from public.seats as seat
        where seat.theater_id = showtime.theater_id
          and seat.is_active
      ) as capacity
    from public.showtimes as showtime
    left join sold_by_showtime as sold on sold.showtime_id = showtime.id
    where showtime.status = 'scheduled'
      and showtime.starts_at >= previous_start
      and showtime.starts_at < range_end
      and showtime.starts_at <= now()
  ),
  per_movie as (
    select
      shows.movie_id,
      count(*) filter (where is_current) as showtimes,
      coalesce(sum(sold) filter (where is_current), 0) as tickets,
      coalesce(sum(capacity) filter (where is_current), 0) as seats,
      count(*) filter (where is_current and capacity > 0 and sold >= capacity) as sold_out,
      coalesce(sum(sold) filter (where not is_current), 0) as previous_tickets,
      coalesce(sum(capacity) filter (where not is_current), 0) as previous_seats
    from shows
    group by shows.movie_id
  )
  select coalesce(jsonb_agg(
    jsonb_build_object(
      'movie_id', movie.id,
      'title', movie.title,
      'showtimes', per_movie.showtimes,
      'shows_per_day', round(per_movie.showtimes::numeric / days, 2),
      'tickets', per_movie.tickets,
      'seats', per_movie.seats,
      'occupancy', case when per_movie.seats > 0
        then round(per_movie.tickets::numeric / per_movie.seats, 4) end,
      'sold_out_share', case when per_movie.showtimes > 0
        then round(per_movie.sold_out::numeric / per_movie.showtimes, 4) end,
      'previous_occupancy', case when per_movie.previous_seats > 0
        then round(per_movie.previous_tickets::numeric / per_movie.previous_seats, 4) end
    )
    order by movie.title
  ), '[]'::jsonb)
  into result
  from per_movie
  join public.movies as movie on movie.id = per_movie.movie_id
  where per_movie.showtimes > 0;

  return result;
end;
$$;

revoke all on function public.showtime_demand(date, date) from public, anon;
grant execute on function public.showtime_demand(date, date) to authenticated;

-- ตัวเลขของวันนี้สำหรับหน้าภาพรวมหลังบ้าน
create function public.admin_today_summary()
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  today date := (now() at time zone 'Asia/Bangkok')::date;
  today_start timestamptz := today::timestamp at time zone 'Asia/Bangkok';
  tomorrow_start timestamptz := (today + 1)::timestamp at time zone 'Asia/Bangkok';
  yesterday_start timestamptz := (today - 1)::timestamp at time zone 'Asia/Bangkok';
  week_start timestamptz := (today - 6)::timestamp at time zone 'Asia/Bangkok';
  result jsonb;
begin
  if private.current_app_role() is distinct from 'admin' then
    raise exception 'ไม่มีสิทธิ์ดูภาพรวม' using errcode = '42501';
  end if;

  with paid_orders as (
    select id, total, channel, (created_at at time zone 'Asia/Bangkok')::date as sale_date
    from public.orders
    where status = 'paid'
      and created_at >= week_start
      and created_at < tomorrow_start
  ),
  sold_tickets as (
    select paid.channel, paid.sale_date
    from public.tickets as ticket
    join paid_orders as paid on paid.id = ticket.order_id
    where ticket.status in ('paid', 'used')
  ),
  sold_by_showtime as (
    select ticket.showtime_id, count(*) as sold
    from public.tickets as ticket
    where ticket.status in ('paid', 'used')
    group by ticket.showtime_id
  ),
  today_shows as (
    select
      coalesce(sold.sold, 0) as sold,
      (
        select count(*)
        from public.seats as seat
        where seat.theater_id = showtime.theater_id
          and seat.is_active
      ) as capacity
    from public.showtimes as showtime
    left join sold_by_showtime as sold on sold.showtime_id = showtime.id
    where showtime.status = 'scheduled'
      and showtime.starts_at >= today_start
      and showtime.starts_at < tomorrow_start
  )
  select jsonb_build_object(
    'revenue_today', (select coalesce(sum(total), 0) from paid_orders where sale_date = today),
    'revenue_yesterday', (
      select coalesce(sum(total), 0)
      from public.orders
      where status = 'paid'
        and created_at >= yesterday_start
        and created_at < today_start
    ),
    'tickets_online', (select count(*) from sold_tickets where sale_date = today and channel = 'online'),
    'tickets_pos', (select count(*) from sold_tickets where sale_date = today and channel = 'pos'),
    'showtimes_today', (select count(*) from today_shows),
    'seats_sold', (select coalesce(sum(sold), 0) from today_shows),
    'seats_available', (select coalesce(sum(capacity), 0) from today_shows),
    'sold_out_today', (select count(*) from today_shows where capacity > 0 and sold >= capacity),
    'awaiting_pickup', (
      select count(*)
      from public.orders as ord
      where ord.status = 'paid'
        and ord.items_picked_up_at is null
        and ord.created_at >= yesterday_start
        and exists (select 1 from public.order_items as item where item.order_id = ord.id)
    ),
    'daily', (
      select jsonb_agg(
        jsonb_build_object(
          'date', day::date,
          'revenue', coalesce((select sum(total) from paid_orders where sale_date = day::date), 0),
          'tickets', (select count(*) from sold_tickets where sale_date = day::date)
        )
        order by day
      )
      from generate_series((today - 6)::timestamp, today::timestamp, interval '1 day') as day
    )
  )
  into result;

  return result;
end;
$$;

revoke all on function public.admin_today_summary() from public, anon;
grant execute on function public.admin_today_summary() to authenticated;

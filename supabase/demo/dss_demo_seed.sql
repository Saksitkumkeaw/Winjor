-- ข้อมูลจำลองย้อนหลัง 90 วันสำหรับสาธิต DSS (รันใน SQL Editor ด้วย role postgres)
-- ลำดับ: รัน dss_ingredient_costs.sql ก่อน แล้วรันไฟล์นี้ ลบทั้งชุดได้ด้วย dss_demo_remove.sql
-- ระบุข้อมูลจำลองได้ทุกแถว: คำสั่งซื้อขึ้นต้นด้วย DEMO- (ตั๋ว รายการสินค้า และการตัดสต็อกผูกกับคำสั่งซื้อเหล่านี้)
-- ส่วนรอบฉายจดไว้ใน private.dss_demo_rows
-- มีทั้งรอบที่ฉายแล้ว 90 วัน และการจองล่วงหน้าของรอบที่ยังไม่ฉาย
-- ยอดย้อนหลังไม่เปลี่ยน quantity_on_hand ขั้นตอนสุดท้ายตั้งค่าคงเหลือสำหรับสาธิตแยกต่างหาก และจดค่าเดิมไว้

begin;

-- สร้างราว 1,350 รอบและ 17,000 คำสั่งซื้อ ใช้เวลาเกิน 2 นาทีได้
set local statement_timeout = 0;

do $
begin
  if to_regclass('private.dss_demo_rows') is not null then
    raise exception 'มีข้อมูลจำลองอยู่แล้ว ให้รัน dss_demo_remove.sql ก่อน';
  end if;
end;
$$;

create table private.dss_demo_rows (
  table_name text not null,
  row_id uuid not null,
  primary key (table_name, row_id)
);

create table private.dss_demo_stock (
  ingredient_id uuid primary key,
  original_on_hand numeric(12, 2) not null,
  demo_on_hand numeric(12, 2) not null,
  original_reorder_level numeric(12, 2) not null
);

alter table private.dss_demo_rows enable row level security;
alter table private.dss_demo_stock enable row level security;

-- หนังแต่ละเรื่องดังไม่เท่ากัน และคนดูลดลงสัปดาห์ละ 15% นับจากวันเข้าฉาย
-- เงาเหนือเมืองฝนได้รอบเยอะแม้คนดูลดลงแล้ว ส่วน THE AVENGAY ได้รอบเดียวแม้คนดูเยอะ
create table private.dss_demo_movies (
  sort_order integer primary key,
  title text not null,
  premiere_day integer not null,
  popularity numeric not null,
  slots integer not null,
  last_day integer not null
);

alter table private.dss_demo_movies enable row level security;

insert into private.dss_demo_movies values
  (1, 'เงาเหนือเมืองฝน', -28, 180, 4, 89),
  (2, 'รถไฟเที่ยวสุดท้าย', -14, 120, 3, 62),
  (3, 'START WARS', 0, 160, 3, 89),
  (4, 'HARRY BEER', 14, 110, 2, 89),
  (5, 'TAI-TA-NIK', 28, 130, 3, 89),
  (6, 'มหาอุทกภัย', 42, 120, 2, 89),
  (7, 'FAST & FURI-YUT', 63, 160, 3, 89),
  (8, 'THE AVENGAY', 70, 300, 1, 89);

create sequence private.dss_demo_order_seq;

-- วันที่ 0 = 90 วันก่อนวันนี้, วันที่ 89 = เมื่อวาน
-- แต่ละวันมี 20 ช่อง (5 โรง × 11:00, 14:00, 17:00, 20:00) แจกให้หนังตามลำดับ
create function private.dss_demo_generate(p_first_day integer, p_last_day integer)
returns integer
language plpgsql
set search_path = ''
as $$
declare
  start_date date := (now() at time zone 'Asia/Bangkok')::date - 90;
  slot_times time[] := array['11:00', '14:00', '17:00', '20:00']::time[];
  -- รอบเย็นคนมากกว่ารอบบ่าย
  slot_weights numeric[] := array[0.6, 0.8, 1.1, 1.3];
  theater_ids uuid[];
  popcorn_s uuid := (select id from public.products where name = 'ป๊อปคอร์น S');
  popcorn_l uuid := (select id from public.products where name = 'ป๊อปคอร์น L');
  soda uuid := (select id from public.products where name = 'น้ำอัดลม');
  combo uuid := (select id from public.products where name = 'ชุดคู่ ป๊อปคอร์น L + น้ำ 2 แก้ว');
  day_index integer;
  show_date date;
  day_factor numeric;
  movie record;
  demand numeric;
  weight_sum numeric;
  slot integer;
  slot_end integer;
  slot_cursor integer;
  theater uuid;
  starts timestamptz;
  showtime uuid;
  capacity integer;
  sold integer;
  seat_list uuid[];
  seat_index integer;
  group_size integer;
  channel public.order_channel;
  created timestamptz;
  new_order uuid;
  pick numeric;
  product uuid;
  orders_created integer := 0;
begin
  select array_agg(id order by name) into theater_ids
  from public.theaters
  where is_active;

  for day_index in p_first_day..p_last_day loop
    show_date := start_date + day_index;
    -- ศุกร์-อาทิตย์คนมากกว่าวันธรรมดา 1.6-2 เท่า
    day_factor := case extract(isodow from show_date)
      when 5 then 1.6
      when 6 then 2.0
      when 7 then 1.8
      else 1.0
    end;
    slot_cursor := 0;

    for movie in
      select config.*, film.id as movie_id, film.duration_min
      from private.dss_demo_movies as config
      join public.movies as film on film.title = config.title
      where day_index between config.premiere_day and config.last_day
      order by config.sort_order
    loop
      slot_end := least(slot_cursor + movie.slots, array_length(theater_ids, 1) * 4);
      demand := movie.popularity
        * power(0.85, floor((day_index - movie.premiere_day) / 7.0))
        * day_factor
        * (0.8 + random() * 0.4);

      select coalesce(sum(slot_weights[(s % 4) + 1]), 1) into weight_sum
      from generate_series(slot_cursor, slot_end - 1) as s;

      for slot in slot_cursor..slot_end - 1 loop
        theater := theater_ids[(slot / 4) + 1];
        starts := (show_date + slot_times[(slot % 4) + 1]) at time zone 'Asia/Bangkok';

        -- ข้ามช่องที่ทับรอบฉายจริง
        continue when exists (
          select 1
          from public.showtimes as existing
          where existing.theater_id = theater
            and existing.status <> 'cancelled'
            and tstzrange(existing.starts_at, existing.ends_at)
              && tstzrange(starts, starts + make_interval(mins => movie.duration_min + 20))
        );

        insert into public.showtimes (movie_id, theater_id, starts_at, ends_at, base_price)
        values (movie.movie_id, theater, starts, starts, 180)
        returning id into showtime;

        insert into private.dss_demo_rows values ('showtimes', showtime);

        select count(*) into capacity
        from public.seats
        where theater_id = theater
          and is_active;

        sold := least(
          capacity,
          round(demand * slot_weights[(slot % 4) + 1] / weight_sum * (0.85 + random() * 0.3))
        )::integer;

        seat_list := array(
          select id
          from public.seats
          where theater_id = theater
            and is_active
          order by random()
          limit sold
        );

        seat_index := 1;
        while seat_index <= sold loop
          group_size := least(sold - seat_index + 1, 1 + floor(random() * 4)::integer);
          if random() < 0.6 then
            channel := 'online';
            created := starts - interval '30 minutes' - random() * interval '2 days';
          else
            channel := 'pos';
            created := starts - interval '5 minutes' - random() * interval '55 minutes';
          end if;

          insert into public.orders (
            order_no, channel, status, subtotal, total, expires_at, created_at
          )
          values (
            'DEMO-' || lpad(nextval('private.dss_demo_order_seq')::text, 6, '0'),
            channel,
            'paid',
            0,
            0,
            created + interval '10 minutes',
            created
          )
          returning id into new_order;

          insert into public.tickets (
            order_id, showtime_id, seat_id, price, status, qr_token, checked_in_at, created_at
          )
          select
            new_order,
            showtime,
            seat.id,
            180 + seat_type.surcharge,
            'used',
            encode(extensions.gen_random_bytes(16), 'hex'),
            greatest(created + interval '1 minute', starts - random() * interval '30 minutes'),
            created
          from unnest(seat_list[seat_index:seat_index + group_size - 1]) as picked (seat_id)
          join public.seats as seat on seat.id = picked.seat_id
          join public.seat_types as seat_type on seat_type.id = seat.seat_type_id;

          -- ราวครึ่งหนึ่งของคำสั่งซื้อมีป๊อปคอร์นหรือน้ำ
          if random() < 0.55 then
            pick := random();
            product := case
              when pick < 0.35 then popcorn_l
              when pick < 0.60 then popcorn_s
              when pick < 0.85 then soda
              else combo
            end;

            insert into public.order_items (order_id, product_id, quantity, unit_price, created_at)
            select new_order, id, 1 + (random() < 0.3)::integer, price, created
            from public.products
            where id = product;

            if product in (popcorn_s, popcorn_l) and random() < 0.4 then
              insert into public.order_items (order_id, product_id, quantity, unit_price, created_at)
              select new_order, id, least(group_size, 2), price, created
              from public.products
              where id = soda;
            end if;

            insert into public.stock_movements (ingredient_id, order_id, change_qty, reason, created_at)
            select recipe.ingredient_id, new_order, -sum(recipe.quantity * item.quantity), 'sale', created
            from public.order_items as item
            join public.product_recipes as recipe on recipe.product_id = item.product_id
            where item.order_id = new_order
            group by recipe.ingredient_id;

            update public.orders
            set items_picked_up_at = greatest(created + interval '1 minute', starts - random() * interval '20 minutes')
            where id = new_order;
          end if;

          update public.orders
          set subtotal = totals.amount,
              total = totals.amount
          from (
            select
              coalesce((select sum(price) from public.tickets where order_id = new_order), 0)
              + coalesce((
                select sum(quantity * unit_price)
                from public.order_items
                where order_id = new_order
              ), 0) as amount
          ) as totals
          where id = new_order;

          orders_created := orders_created + 1;
          seat_index := seat_index + group_size;
        end loop;
      end loop;

      slot_cursor := slot_cursor + movie.slots;
    end loop;
  end loop;

  return orders_created;
end;
$$;

revoke all on function private.dss_demo_generate(integer, integer) from public;

-- ไม่ส่งสัญญาณ Realtime ทีละตั๋วระหว่างใส่ข้อมูลย้อนหลัง
alter table public.tickets disable trigger tickets_broadcast_seat_change;

select setseed(0.2026);
select private.dss_demo_generate(0, 89) as demo_orders;

alter table public.tickets enable trigger tickets_broadcast_seat_change;

-- ตั้งค่าคงเหลือสำหรับสาธิตจากยอดใช้ 30 วันล่าสุดและระดับบริการ 95% (ตรงกับค่าเริ่มต้นของหน้าเว็บ)
-- ข้าวโพดคั่วและแก้วน้ำต่ำกว่า ROP, เนยใกล้ถึงจุดสั่ง, ที่เหลือปกติ
-- จุดแจ้งเตือนของวิธีเดิมตั้งเป็น d × L คือไม่มีของสำรอง
with daily as (
  select
    ingredient.id,
    ingredient.lead_time_days,
    coalesce(sum(-movement.change_qty), 0) as used
  from public.ingredients as ingredient
  cross join generate_series(
    (now() at time zone 'Asia/Bangkok')::date - 30,
    (now() at time zone 'Asia/Bangkok')::date - 1,
    interval '1 day'
  ) as day
  left join public.stock_movements as movement
    on movement.ingredient_id = ingredient.id
    and movement.reason = 'sale'
    and (movement.created_at at time zone 'Asia/Bangkok')::date = day::date
  group by ingredient.id, ingredient.lead_time_days, day
),
stats as (
  select
    id,
    avg(used) as d,
    avg(used) * max(lead_time_days)
      + 1.645 * coalesce(stddev_samp(used), 0) * sqrt(max(lead_time_days)) as rop,
    max(lead_time_days) as lead_time_days
  from daily
  group by id
),
targets as (
  select
    ingredient.id,
    ingredient.quantity_on_hand,
    ingredient.reorder_level,
    round(stats.d * stats.lead_time_days) as legacy_level,
    round(case ingredient.name
      when 'ข้าวโพดคั่ว' then stats.rop * 0.6
      when 'แก้วน้ำ' then stats.rop * 0.8
      when 'เนย' then stats.rop + stats.d * 1.5
      else stats.rop + stats.d * 6
    end) as demo_on_hand
  from public.ingredients as ingredient
  join stats on stats.id = ingredient.id
  where stats.d > 0
),
saved as (
  insert into private.dss_demo_stock
  select id, quantity_on_hand, demo_on_hand, reorder_level
  from targets
)
update public.ingredients as ingredient
set quantity_on_hand = targets.demo_on_hand,
    reorder_level = targets.legacy_level
from targets
where ingredient.id = targets.id;

-- การจองล่วงหน้าของรอบที่ยังไม่ฉาย ใช้อัตราเข้าชม 14 วันล่าสุดของแต่ละเรื่อง
-- รอบที่ใกล้ฉายขายไปมากกว่ารอบที่อีกหลายวันจึงจะฉาย และไม่มีป๊อปคอร์นเพื่อไม่ให้ยอดใช้วัตถุดิบเปลี่ยน
create function private.dss_demo_book_upcoming()
returns integer
language plpgsql
set search_path = ''
as $
declare
  today date := (now() at time zone 'Asia/Bangkok')::date;
  upcoming record;
  base numeric;
  final_share numeric;
  booked_share numeric;
  sold integer;
  seat_list uuid[];
  seat_index integer;
  group_size integer;
  channel public.order_channel;
  created timestamptz;
  new_order uuid;
  orders_created integer := 0;
begin
  for upcoming in
    select
      showtime.id,
      showtime.movie_id,
      showtime.theater_id,
      showtime.starts_at,
      showtime.base_price,
      showtime.created_at,
      (showtime.starts_at at time zone 'Asia/Bangkok')::date - today as days_ahead,
      extract(hour from showtime.starts_at at time zone 'Asia/Bangkok') as start_hour,
      extract(isodow from showtime.starts_at at time zone 'Asia/Bangkok') as weekday
    from public.showtimes as showtime
    where showtime.status = 'scheduled'
      and showtime.starts_at > now()
    order by showtime.starts_at
  loop
    -- อัตราเข้าชมของเรื่องนี้ใน 14 วันที่ผ่านมา ถ้าไม่มีข้อมูลใช้ 15%
    select coalesce(sum(past_sold.count)::numeric / nullif(sum(past_capacity.count), 0), 0.15)
    into base
    from public.showtimes as past
    cross join lateral (
      select count(*) from public.tickets as ticket
      where ticket.showtime_id = past.id and ticket.status in ('paid', 'used')
    ) as past_sold
    cross join lateral (
      select count(*) from public.seats as seat
      where seat.theater_id = past.theater_id and seat.is_active
    ) as past_capacity
    where past.movie_id = upcoming.movie_id
      and past.status = 'scheduled'
      and past.starts_at >= now() - interval '14 days'
      and past.starts_at <= now();

    final_share := least(
      1,
      base
        * case when upcoming.start_hour < 13 then 0.75 when upcoming.start_hour < 16 then 0.9 when upcoming.start_hour < 19 then 1.1 else 1.2 end
        * case upcoming.weekday when 5 then 1.3 when 6 then 1.5 when 7 then 1.4 else 1.0 end
        * (0.85 + random() * 0.3)
    );
    booked_share := case
      when upcoming.days_ahead <= 0 then 0.75
      when upcoming.days_ahead = 1 then 0.45
      when upcoming.days_ahead = 2 then 0.3
      when upcoming.days_ahead = 3 then 0.2
      else 0.1
    end;

    seat_list := array(
      select seat.id
      from public.seats as seat
      where seat.theater_id = upcoming.theater_id
        and seat.is_active
        and not exists (
          select 1 from public.tickets as ticket
          where ticket.showtime_id = upcoming.id
            and ticket.seat_id = seat.id
            and ticket.status in ('held', 'paid', 'used')
        )
      order by random()
    );
    sold := least(
      coalesce(array_length(seat_list, 1), 0),
      round(coalesce(array_length(seat_list, 1), 0) * final_share * booked_share)::integer
    );

    seat_index := 1;
    while seat_index <= sold loop
      group_size := least(sold - seat_index + 1, 1 + floor(random() * 4)::integer);
      -- จองล่วงหน้าส่วนใหญ่ซื้อออนไลน์ หน้าร้านขายได้เฉพาะวันที่ฉาย
      channel := case when upcoming.days_ahead <= 0 and random() < 0.4 then 'pos' else 'online' end;
      created := greatest(upcoming.created_at, now() - random() * interval '3 days');

      insert into public.orders (order_no, channel, status, subtotal, total, expires_at, created_at)
      values (
        'DEMO-' || lpad(nextval('private.dss_demo_order_seq')::text, 6, '0'),
        channel,
        'paid',
        0,
        0,
        created + interval '10 minutes',
        created
      )
      returning id into new_order;

      insert into public.tickets (order_id, showtime_id, seat_id, price, status, qr_token, created_at)
      select
        new_order,
        upcoming.id,
        seat.id,
        upcoming.base_price + seat_type.surcharge,
        'paid',
        encode(extensions.gen_random_bytes(16), 'hex'),
        created
      from unnest(seat_list[seat_index:seat_index + group_size - 1]) as picked (seat_id)
      join public.seats as seat on seat.id = picked.seat_id
      join public.seat_types as seat_type on seat_type.id = seat.seat_type_id;

      update public.orders
      set subtotal = totals.amount,
          total = totals.amount
      from (
        select coalesce(sum(price), 0) as amount
        from public.tickets
        where order_id = new_order
      ) as totals
      where id = new_order;

      orders_created := orders_created + 1;
      seat_index := seat_index + group_size;
    end loop;
  end loop;

  return orders_created;
end;
$;

alter table public.tickets disable trigger tickets_broadcast_seat_change;
select private.dss_demo_book_upcoming() as upcoming_orders;
alter table public.tickets enable trigger tickets_broadcast_seat_change;

drop function private.dss_demo_book_upcoming();

drop function private.dss_demo_generate(integer, integer);
drop table private.dss_demo_movies;
drop sequence private.dss_demo_order_seq;

select
  (select count(*) from private.dss_demo_rows where table_name = 'showtimes') as showtimes,
  (select count(*) from public.orders where order_no like 'DEMO-%') as orders,
  (select count(*) from public.tickets where order_id in (select id from public.orders where order_no like 'DEMO-%')) as tickets,
  (select count(*) from public.order_items where order_id in (select id from public.orders where order_no like 'DEMO-%')) as order_items,
  (select count(*) from public.stock_movements where order_id in (select id from public.orders where order_no like 'DEMO-%')) as stock_movements;

commit;

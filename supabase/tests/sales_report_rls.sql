-- ทดสอบรายงานยอดขาย ทั้งหมดอยู่ใน transaction ที่ rollback จึงไม่เหลือข้อมูล
begin;

insert into auth.users (id, email, raw_user_meta_data) values
  ('00000000-0000-0000-0000-000000000081', 'staff-report@example.test', '{}'),
  ('00000000-0000-0000-0000-000000000082', 'executive-report@example.test', '{}');

update public.profiles set role = 'staff' where id = '00000000-0000-0000-0000-000000000081';
update public.profiles set role = 'executive' where id = '00000000-0000-0000-0000-000000000082';

create temporary table test_ids on commit drop as
select
  (select public.create_theater('โรงทดสอบรายงาน', 1, 4)) as theater_id,
  (select id from public.movies where title = 'เงาเหนือเมืองฝน') as movie_id,
  (select id from public.products where name = 'ป๊อปคอร์น L') as product_id;

insert into public.showtimes (movie_id, theater_id, starts_at, ends_at, base_price)
select movie_id, theater_id, now() + interval '2 hours', now() + interval '2 hours', 100 from test_ids;

do $$
declare
  ids record;
  st uuid;
  seat_list uuid[];
  sold_order uuid;
  refunded_order uuid;
  today date := (now() at time zone 'Asia/Bangkok')::date;
  before_report jsonb;
  after_report jsonb;
begin
  select * into ids from test_ids;
  select id into st from public.showtimes where theater_id = ids.theater_id;
  seat_list := array(select id from public.seats where theater_id = ids.theater_id order by seat_number);

  perform set_config('request.jwt.claims', '{"sub": "00000000-0000-0000-0000-000000000082", "role": "authenticated"}', true);
  set local role authenticated;
  before_report := public.sales_report(today, today);
  reset role;

  perform set_config('request.jwt.claims', '{"sub": "00000000-0000-0000-0000-000000000081", "role": "authenticated"}', true);
  set local role authenticated;

  sold_order := public.pos_create_order(
    st,
    seat_list[1:2],
    jsonb_build_array(jsonb_build_object('product_id', ids.product_id, 'quantity', 1))
  );
  perform public.pos_confirm_cash(sold_order);

  refunded_order := public.pos_create_order(st, seat_list[3:3]);

  begin
    perform public.sales_report(today, today);
    raise exception 'พนักงานต้องดูรายงานไม่ได้' using errcode = 'P0001';
  exception when insufficient_privilege then null;
  end;

  reset role;
  perform set_config('request.jwt.claims', '{"sub": "00000000-0000-0000-0000-000000000082", "role": "authenticated"}', true);
  set local role authenticated;

  after_report := public.sales_report(today, today);

  assert (after_report ->> 'revenue')::numeric - (before_report ->> 'revenue')::numeric = 290, 'ยอดขายต้องรวมตั๋วและสินค้า';
  assert (after_report ->> 'tickets')::integer - (before_report ->> 'tickets')::integer = 2, 'นับเฉพาะตั๋วที่จ่ายแล้ว';
  assert (after_report ->> 'seats_sold')::integer - (before_report ->> 'seats_sold')::integer = 2, 'อัตราเข้าชมต้องนับเฉพาะที่นั่งที่จ่ายแล้ว';
  assert (after_report ->> 'seats_available')::integer >= 4, 'ความจุต้องรวมที่นั่งของรอบวันนี้';
  assert jsonb_array_length(after_report -> 'daily') = 1, 'ต้องมีข้อมูลรายวัน';
  assert ((after_report -> 'daily' -> 0) ->> 'revenue')::numeric = (after_report ->> 'revenue')::numeric, 'ยอดรายวันต้องตรงกับยอดรวม';

  begin
    perform public.sales_report(today, today - 1);
    raise exception 'ช่วงวันที่กลับด้านต้องไม่ผ่าน' using errcode = 'P0001';
  exception when sqlstate 'WJ050' then null;
  end;

  reset role;
end;
$$;

select 'sales_report ok' as result;

rollback;

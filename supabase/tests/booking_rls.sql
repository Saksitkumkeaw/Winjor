-- ทดสอบการล็อกที่นั่ง การยืนยันคำสั่งซื้อ และสิทธิ์ ทั้งหมดอยู่ใน transaction ที่ rollback จึงไม่เหลือข้อมูล
begin;

insert into auth.users (id, email, raw_user_meta_data) values
  ('00000000-0000-0000-0000-000000000021', 'first@example.test', '{}'),
  ('00000000-0000-0000-0000-000000000022', 'second@example.test', '{}');

create temporary table test_data on commit drop as
select
  (select public.create_theater('โรงทดสอบจอง', 2, 3)) as theater_id,
  (select id from public.movies order by created_at limit 1) as movie_id,
  (select id from public.products where is_active order by name limit 1) as product_id;

insert into public.showtimes (movie_id, theater_id, starts_at, ends_at, base_price)
select movie_id, theater_id, now() + interval '1 day', now() + interval '1 day', 100
from test_data;

create temporary table test_ids on commit drop as
select
  (select id from public.showtimes where theater_id = data.theater_id) as showtime_id,
  array(select id from public.seats where theater_id = data.theater_id order by row_label, seat_number) as seat_ids,
  data.product_id
from test_data as data;

grant select on test_ids to authenticated, anon;

do $$
declare
  ids record;
  first_order uuid;
  second_order uuid;
  seen integer;
  total_amount numeric;
  outcome text;
begin
  select * into ids from test_ids;

  perform set_config('request.jwt.claims', '{"sub": "00000000-0000-0000-0000-000000000021", "role": "authenticated"}', true);
  set local role authenticated;

  first_order := public.hold_seats(
    ids.showtime_id,
    ids.seat_ids[1:2],
    jsonb_build_array(jsonb_build_object('product_id', ids.product_id, 'quantity', 2))
  );

  select total into total_amount from public.orders where id = first_order;
  assert total_amount = 200 + (select price * 2 from public.products where id = ids.product_id),
    'ยอดรวมต้องคำนวณจากฐานข้อมูล';

  select count(*) into seen
  from public.get_showtime_seats(ids.showtime_id)
  where is_taken;
  assert seen = 2, 'ที่นั่งที่ล็อกต้องแสดงว่าถูกจอง';

  reset role;
  perform set_config('request.jwt.claims', '{"sub": "00000000-0000-0000-0000-000000000022", "role": "authenticated"}', true);
  set local role authenticated;

  begin
    perform public.hold_seats(ids.showtime_id, ids.seat_ids[2:3]);
    raise exception 'ต้องจองที่นั่งซ้ำไม่ได้' using errcode = 'P0001';
  exception when sqlstate 'WJ005' then null;
  end;

  select count(*) into seen
  from public.get_showtime_seats(ids.showtime_id)
  where is_taken;
  assert seen = 2, 'การจองที่ล้มเหลวต้องไม่ล็อกที่นั่งบางส่วน';

  select count(*) into seen from public.orders where id = first_order;
  assert seen = 0, 'ผู้ใช้ต้องไม่เห็นคำสั่งซื้อของคนอื่น';

  perform public.cancel_order(first_order);

  begin
    perform public.hold_seats(ids.showtime_id, array[]::uuid[]);
    raise exception 'ต้องเลือกอย่างน้อย 1 ที่นั่ง' using errcode = 'P0001';
  exception when sqlstate 'WJ001' then null;
  end;

  begin
    perform public.hold_seats(ids.showtime_id, ids.seat_ids[3:3], '[{"product_id": "00000000-0000-0000-0000-000000000000", "quantity": 1}]');
    raise exception 'ต้องปฏิเสธสินค้าที่ไม่มีจริง' using errcode = 'P0001';
  exception when sqlstate 'WJ004' then null;
  end;

  begin
    insert into public.orders (subtotal, total, expires_at) values (0, 0, now());
    raise exception 'ผู้ใช้ต้องสร้างคำสั่งซื้อเองไม่ได้' using errcode = 'P0001';
  exception when insufficient_privilege then null;
  end;

  begin
    update public.orders set status = 'paid';
    raise exception 'ผู้ใช้ต้องแก้สถานะเองไม่ได้' using errcode = 'P0001';
  exception when insufficient_privilege then null;
  end;

  begin
    perform public.finalize_order(first_order);
    raise exception 'ผู้ใช้ต้องยืนยันการจ่ายเองไม่ได้' using errcode = 'P0001';
  exception when insufficient_privilege then null;
  end;

  second_order := public.hold_seats(ids.showtime_id, ids.seat_ids[3:3]);

  reset role;
  perform set_config('request.jwt.claims', '{"role": "service_role"}', true);

  outcome := public.finalize_order(first_order);
  assert outcome = 'paid', 'ยืนยันคำสั่งซื้อที่ยังไม่หมดอายุได้';
  assert public.finalize_order(first_order) = 'already_paid', 'ยืนยันซ้ำต้องไม่ทำงานซ้ำ';
  assert (select count(*) from public.tickets where order_id = first_order and status = 'paid' and qr_token is not null) = 2,
    'ตั๋วต้องมีรหัส QR หลังชำระเงิน';

  update public.orders set expires_at = now() - interval '2 minutes' where id = second_order;
  assert public.finalize_order(second_order) = 'too_late', 'ต้องไม่ยืนยันคำสั่งซื้อที่หมดอายุ';

  perform private.expire_orders();
  assert (select status from public.orders where id = second_order) = 'expired', 'ต้องหมดอายุ';
  assert (select status from public.tickets where order_id = second_order) = 'released', 'ต้องปล่อยที่นั่ง';

  perform set_config('request.jwt.claims', '{"sub": "00000000-0000-0000-0000-000000000021", "role": "authenticated"}', true);
  set local role authenticated;

  second_order := public.hold_seats(ids.showtime_id, ids.seat_ids[3:3]);
  assert second_order is not null, 'ต้องจองที่นั่งที่ถูกปล่อยได้';

  perform public.cancel_order(second_order);
  assert (select status from public.orders where id = second_order) = 'cancelled', 'เจ้าของต้องยกเลิกได้';
  assert not (
    select is_taken from public.get_showtime_seats(ids.showtime_id)
    where seat_id = ids.seat_ids[3]
  ), 'ยกเลิกแล้วที่นั่งต้องกลับมาว่าง';

  reset role;
  perform set_config('request.jwt.claims', '{"role": "anon"}', true);
  set local role anon;

  select count(*) into seen from public.get_showtime_seats(ids.showtime_id);
  assert seen = 6, 'anon ต้องดูผังที่นั่งได้';

  begin
    perform public.hold_seats(ids.showtime_id, ids.seat_ids[1:1]);
    raise exception 'anon ต้องจองไม่ได้' using errcode = 'P0001';
  exception when insufficient_privilege then null;
  end;

  begin
    perform 1 from public.tickets;
    raise exception 'anon ต้องอ่านตั๋วไม่ได้' using errcode = 'P0001';
  exception when insufficient_privilege then null;
  end;

  reset role;
end;
$$;

select 'booking_rls ok' as result;

rollback;

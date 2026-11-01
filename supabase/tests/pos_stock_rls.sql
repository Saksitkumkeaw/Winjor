-- ทดสอบการขายหน้าร้าน สแกนตั๋ว และสต็อก ทั้งหมดอยู่ใน transaction ที่ rollback จึงไม่เหลือข้อมูล
begin;

insert into auth.users (id, email, raw_user_meta_data) values
  ('00000000-0000-0000-0000-000000000041', 'staff-pos@example.test', '{}'),
  ('00000000-0000-0000-0000-000000000042', 'admin-pos@example.test', '{}'),
  ('00000000-0000-0000-0000-000000000043', 'customer-pos@example.test', '{}');

update public.profiles set role = 'staff' where id = '00000000-0000-0000-0000-000000000041';
update public.profiles set role = 'admin' where id = '00000000-0000-0000-0000-000000000042';

create temporary table test_ids on commit drop as
select
  (select public.create_theater('โรงทดสอบ POS', 1, 4)) as theater_id,
  (select id from public.movies order by created_at limit 1) as movie_id,
  (select id from public.products where name = 'ป๊อปคอร์น L') as product_id,
  (select id from public.ingredients where name = 'ข้าวโพดคั่ว') as ingredient_id;

insert into public.showtimes (movie_id, theater_id, starts_at, ends_at, base_price)
select movie_id, theater_id, now() + interval '30 minutes', now() + interval '30 minutes', 100
from test_ids;

do $$
declare
  ids record;
  st uuid;
  seat_list uuid[];
  new_order uuid;
  product_order uuid;
  order_no_value text;
  token text;
  stock_before numeric;
  stock_after numeric;
  outcome jsonb;
begin
  select * into ids from test_ids;
  select id into st from public.showtimes where theater_id = ids.theater_id;
  seat_list := array(select id from public.seats where theater_id = ids.theater_id order by seat_number);
  select quantity_on_hand into stock_before from public.ingredients where id = ids.ingredient_id;

  perform set_config('request.jwt.claims', '{"sub": "00000000-0000-0000-0000-000000000041", "role": "authenticated"}', true);
  set local role authenticated;

  new_order := public.pos_create_order(
    st,
    seat_list[1:1],
    jsonb_build_array(jsonb_build_object('product_id', ids.product_id, 'quantity', 2))
  );

  assert (select customer_id from public.orders where id = new_order) is null, 'ขายหน้าร้านต้องไม่บังคับมีลูกค้า';
  assert (select sold_by from public.orders where id = new_order) = '00000000-0000-0000-0000-000000000041', 'ต้องบันทึกพนักงาน';
  assert public.pos_confirm_cash(new_order) = 'paid', 'พนักงานรับเงินสดได้';
  assert public.pos_confirm_cash(new_order) = 'already_paid', 'รับเงินซ้ำต้องไม่ทำงานซ้ำ';
  assert (select count(*) from public.payments as p where p.order_id = new_order) = 1, 'ต้องบันทึกการจ่ายครั้งเดียว';

  select quantity_on_hand into stock_after from public.ingredients where id = ids.ingredient_id;
  assert stock_before - stock_after = 300, 'ต้องตัดวัตถุดิบตามสูตรครั้งเดียว';

  product_order := public.pos_create_order(null, '{}', jsonb_build_array(jsonb_build_object('product_id', ids.product_id, 'quantity', 1)));
  assert (select count(*) from public.tickets as t where t.order_id = product_order) = 0, 'ขายสินค้าอย่างเดียวได้';

  begin
    perform public.pos_create_order(null, '{}', '[]');
    raise exception 'ต้องมีตั๋วหรือสินค้า' using errcode = 'P0001';
  exception when sqlstate 'WJ001' then null;
  end;

  select qr_token into token from public.tickets as t where t.order_id = new_order;

  outcome := public.check_in_ticket(token);
  assert outcome ->> 'result' = 'ok', 'สแกนตั๋วครั้งแรกต้องผ่าน';
  outcome := public.check_in_ticket(token);
  assert outcome ->> 'result' = 'used', 'สแกนซ้ำต้องไม่ผ่าน';
  assert (public.check_in_ticket('not-a-token')) ->> 'result' = 'not_found', 'รหัสปลอมต้องไม่ผ่าน';

  select order_no into order_no_value from public.orders where id = new_order;
  assert (public.pickup_order_items(order_no_value)) ->> 'result' = 'ok', 'รับสินค้าได้';
  assert (public.pickup_order_items(order_no_value)) ->> 'result' = 'picked_up', 'รับสินค้าซ้ำไม่ได้';

  begin
    perform public.adjust_stock(ids.ingredient_id, 10, 'purchase');
    raise exception 'พนักงานต้องปรับสต็อกไม่ได้' using errcode = 'P0001';
  exception when insufficient_privilege then null;
  end;

  begin
    update public.ingredients set quantity_on_hand = 0;
    raise exception 'ต้องแก้ยอดสต็อกตรงไม่ได้' using errcode = 'P0001';
  exception when insufficient_privilege then null;
  end;

  reset role;
  perform set_config('request.jwt.claims', '{"sub": "00000000-0000-0000-0000-000000000042", "role": "authenticated"}', true);
  set local role authenticated;

  perform public.adjust_stock(ids.ingredient_id, 1000, 'purchase');
  assert (select quantity_on_hand from public.ingredients where id = ids.ingredient_id) = stock_after + 1000, 'รับเข้าสต็อกต้องเพิ่มยอด';

  begin
    update public.ingredients set quantity_on_hand = 0;
    raise exception 'ผู้ดูแลระบบต้องแก้ยอดตรงไม่ได้' using errcode = 'P0001';
  exception when insufficient_privilege then null;
  end;

  reset role;
  perform set_config('request.jwt.claims', '{"sub": "00000000-0000-0000-0000-000000000043", "role": "authenticated"}', true);
  set local role authenticated;

  begin
    perform public.pos_create_order(st, seat_list[2:2]);
    raise exception 'ลูกค้าต้องใช้ POS ไม่ได้' using errcode = 'P0001';
  exception when insufficient_privilege then null;
  end;

  begin
    perform public.check_in_ticket(token);
    raise exception 'ลูกค้าต้องสแกนตั๋วไม่ได้' using errcode = 'P0001';
  exception when insufficient_privilege then null;
  end;

  begin
    perform public.pos_confirm_cash(product_order);
    raise exception 'ลูกค้าต้องยืนยันเงินสดไม่ได้' using errcode = 'P0001';
  exception when insufficient_privilege then null;
  end;

  assert (select count(*) from public.ingredients) = 0, 'ลูกค้าต้องไม่เห็นสต็อก';

  reset role;
end;
$$;

select 'pos_stock_rls ok' as result;

rollback;

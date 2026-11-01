-- ทดสอบคะแนน การคืนเงิน กะงาน ลงเวลา และสิทธิ์ ทั้งหมดอยู่ใน transaction ที่ rollback จึงไม่เหลือข้อมูล
begin;

insert into auth.users (id, email, raw_user_meta_data) values
  ('00000000-0000-0000-0000-000000000061', 'member@example.test', '{"phone": "0800000061"}'),
  ('00000000-0000-0000-0000-000000000062', 'duplicate-phone@example.test', '{"phone": "0800000061"}'),
  ('00000000-0000-0000-0000-000000000063', 'staff-m@example.test', '{}'),
  ('00000000-0000-0000-0000-000000000064', 'admin-m@example.test', '{}');

update public.profiles set role = 'staff' where id = '00000000-0000-0000-0000-000000000063';
update public.profiles set role = 'admin' where id = '00000000-0000-0000-0000-000000000064';

create temporary table test_ids on commit drop as
select
  (select public.create_theater('โรงทดสอบสมาชิก', 1, 6)) as theater_id,
  (select id from public.movies order by created_at limit 1) as movie_id;

insert into public.showtimes (movie_id, theater_id, starts_at, ends_at, base_price)
select movie_id, theater_id, now() + interval '5 days', now() + interval '5 days', 200 from test_ids;

do $$
declare
  ids record;
  st uuid;
  seat_list uuid[];
  member_id uuid := '00000000-0000-0000-0000-000000000061';
  first_order uuid;
  redeem_order uuid;
  held_order uuid;
  pos_order uuid;
  balance integer;
  paid_orders uuid[];
begin
  select * into ids from test_ids;
  select id into st from public.showtimes where theater_id = ids.theater_id;
  seat_list := array(select id from public.seats where theater_id = ids.theater_id order by seat_number);

  assert (select phone from public.profiles where id = '00000000-0000-0000-0000-000000000062') is null,
    'เบอร์ซ้ำต้องไม่ทำให้สมัครล้มเหลว';

  perform set_config('request.jwt.claims', '{"sub": "00000000-0000-0000-0000-000000000061", "role": "authenticated"}', true);
  set local role authenticated;

  first_order := public.hold_seats(st, seat_list[1:1]);

  reset role;
  assert public.finalize_order(first_order) = 'paid', 'ชำระเงินสำเร็จ';
  assert (select points_balance from public.profiles where id = member_id) = 20, 'จ่าย 200 บาทได้ 20 คะแนน';

  update public.profiles set points_balance = 250 where id = member_id;

  set local role authenticated;

  redeem_order := public.hold_seats(st, seat_list[2:2]);

  begin
    perform public.apply_points(redeem_order, 150);
    raise exception 'ต้องแลกทีละ 100' using errcode = 'P0001';
  exception when sqlstate 'WJ012' then null;
  end;

  begin
    perform public.apply_points(redeem_order, 300);
    raise exception 'คะแนนไม่พอ' using errcode = 'P0001';
  exception when sqlstate 'WJ014' then null;
  end;

  perform public.apply_points(redeem_order, 200);
  assert (select total from public.orders where id = redeem_order) = 160, 'แลก 200 คะแนนลด 40 บาท';
  assert (select points_balance from public.profiles where id = member_id) = 50, 'ต้องหักคะแนน';

  perform public.apply_points(redeem_order, 100);
  assert (select total from public.orders where id = redeem_order) = 180, 'เปลี่ยนจำนวนแลกได้';
  assert (select points_balance from public.profiles where id = member_id) = 150, 'ต้องคืนคะแนนส่วนต่าง';

  perform public.cancel_order(redeem_order);
  assert (select points_balance from public.profiles where id = member_id) = 250, 'ยกเลิกต้องคืนคะแนน';

  held_order := public.hold_seats(st, seat_list[3:3]);
  perform public.apply_points(held_order, 100);

  reset role;
  update public.orders set expires_at = now() - interval '2 minutes' where id = held_order;
  perform private.expire_orders();
  assert (select points_balance from public.profiles where id = member_id) = 250, 'หมดเวลาต้องคืนคะแนน';

  perform set_config('request.jwt.claims', '{"sub": "00000000-0000-0000-0000-000000000063", "role": "authenticated"}', true);
  set local role authenticated;

  pos_order := public.pos_create_order(st, seat_list[4:4]);
  assert (public.pos_attach_member(pos_order, '0899999999')) ->> 'result' = 'not_found', 'ไม่พบเบอร์ต้องแจ้ง';
  assert (public.pos_attach_member(pos_order, '0800000061')) ->> 'result' = 'ok', 'ผูกสมาชิกได้';
  perform public.apply_points(pos_order, 100);
  assert public.pos_confirm_cash(pos_order) = 'paid', 'รับเงินสดหลังใช้คะแนน';
  assert (select points_balance from public.profiles where id = member_id) = 168, 'หัก 100 แล้วได้คะแนนจากยอดจ่าย 180';

  begin
    perform public.complete_refund(pos_order, 'ทดสอบ', 'manual');
    raise exception 'พนักงานต้องคืนเงินไม่ได้' using errcode = 'P0001';
  exception when insufficient_privilege then null;
  end;

  begin
    perform public.set_user_role(member_id, 'admin');
    raise exception 'พนักงานต้องตั้งบทบาทไม่ได้' using errcode = 'P0001';
  exception when insufficient_privilege then null;
  end;

  begin
    insert into public.shifts (staff_id, starts_at, ends_at)
    values ('00000000-0000-0000-0000-000000000063', now(), now() + interval '1 hour');
    raise exception 'พนักงานต้องสร้างกะเองไม่ได้' using errcode = 'P0001';
  exception when insufficient_privilege then null;
  end;

  perform public.clock_in();
  begin
    perform public.clock_in();
    raise exception 'ลงเวลาเข้าซ้ำไม่ได้' using errcode = 'P0001';
  exception when sqlstate 'WJ040' then null;
  end;
  perform public.clock_out();
  begin
    perform public.clock_out();
    raise exception 'ลงเวลาออกซ้ำไม่ได้' using errcode = 'P0001';
  exception when sqlstate 'WJ041' then null;
  end;

  reset role;
  perform set_config('request.jwt.claims', '{"sub": "00000000-0000-0000-0000-000000000064", "role": "authenticated"}', true);
  set local role authenticated;

  insert into public.shifts (staff_id, starts_at, ends_at)
  values ('00000000-0000-0000-0000-000000000063', now() + interval '1 day', now() + interval '1 day 8 hours');

  begin
    insert into public.shifts (staff_id, starts_at, ends_at)
    values ('00000000-0000-0000-0000-000000000063', now() + interval '1 day 1 hour', now() + interval '1 day 2 hours');
    raise exception 'กะทับกันไม่ได้' using errcode = 'P0001';
  exception when exclusion_violation then null;
  end;

  perform public.complete_refund(pos_order, 'ทดสอบคืนเงิน', 'manual');
  assert (select status from public.orders where id = pos_order) = 'refunded', 'คืนเงินได้';
  assert (select refund_method from public.payments as p where p.order_id = pos_order) = 'manual', 'ต้องบันทึกวิธีคืนเงิน';
  assert (select status from public.tickets where order_id = pos_order) = 'refunded', 'ตั๋วต้องใช้ไม่ได้';
  assert (select points_balance from public.profiles where id = member_id) = 250, 'คืนคะแนนที่ใช้และหักคะแนนที่ได้';
  assert not (select is_taken from public.get_showtime_seats(st) as s where s.seat_id = seat_list[4]), 'ที่นั่งต้องกลับมาว่าง';

  begin
    perform public.complete_refund(pos_order, 'ซ้ำ', 'manual');
    raise exception 'คืนเงินซ้ำไม่ได้' using errcode = 'P0001';
  exception when sqlstate 'WJ020' then null;
  end;

  begin
    perform public.set_user_role('00000000-0000-0000-0000-000000000064', 'customer');
    raise exception 'เปลี่ยนบทบาทตัวเองไม่ได้' using errcode = 'P0001';
  exception when sqlstate 'WJ030' then null;
  end;

  perform public.set_user_role(member_id, 'executive');
  assert (select role from public.profiles where id = member_id) = 'executive', 'ผู้ดูแลตั้งบทบาทได้';

  paid_orders := public.cancel_showtime(st);
  assert first_order = any (paid_orders), 'ต้องคืนรายการคำสั่งซื้อที่จ่ายแล้ว';

  reset role;
end;
$$;

select 'members_rls ok' as result;

rollback;

-- ทดสอบบันทึกการสแกน ทั้งหมดอยู่ใน transaction ที่ rollback จึงไม่เหลือข้อมูล
begin;

insert into auth.users (id, email, raw_user_meta_data) values
  ('00000000-0000-0000-0000-000000000051', 'staff-log@example.test', '{}'),
  ('00000000-0000-0000-0000-000000000052', 'customer-log@example.test', '{}');

update public.profiles set role = 'staff' where id = '00000000-0000-0000-0000-000000000051';

create temporary table test_ids on commit drop as
select
  (select public.create_theater('โรงทดสอบ Log', 1, 2)) as theater_id,
  (select id from public.movies order by created_at limit 1) as movie_id;

insert into public.showtimes (movie_id, theater_id, starts_at, ends_at, base_price)
select movie_id, theater_id, now() + interval '30 minutes', now() + interval '30 minutes', 100 from test_ids;

do $$
declare
  ids record;
  st uuid;
  seat_list uuid[];
  new_order uuid;
  token text;
  logged integer;
begin
  select * into ids from test_ids;
  select id into st from public.showtimes where theater_id = ids.theater_id;
  seat_list := array(select id from public.seats where theater_id = ids.theater_id order by seat_number);

  perform set_config('request.jwt.claims', '{"sub": "00000000-0000-0000-0000-000000000051", "role": "authenticated"}', true);
  set local role authenticated;

  new_order := public.pos_create_order(st, seat_list[1:1]);
  perform public.pos_confirm_cash(new_order);
  select qr_token into token from public.tickets as t where t.order_id = new_order;

  assert (public.check_in_ticket(token)) ->> 'result' = 'ok', 'สแกนครั้งแรกต้องผ่าน';
  assert (public.check_in_ticket(token)) ->> 'result' = 'used', 'สแกนซ้ำต้องไม่ผ่าน';
  assert (public.check_in_ticket('fake-code-123')) ->> 'result' = 'not_found', 'รหัสปลอมต้องไม่ผ่าน';

  select count(*) into logged from public.scan_logs where staff_id = '00000000-0000-0000-0000-000000000051';
  assert logged = 3, 'ต้องบันทึกทุกการสแกน';
  assert (select input_hint from public.scan_logs where result = 'not_found' and staff_id = '00000000-0000-0000-0000-000000000051') = 'fake-cod', 'ต้องเก็บรหัสแค่ 8 ตัว';
  assert not exists (select 1 from public.scan_logs where input_hint = token), 'ต้องไม่เก็บรหัสเต็ม';

  begin
    delete from public.scan_logs;
    raise exception 'พนักงานต้องลบ log ไม่ได้' using errcode = 'P0001';
  exception when insufficient_privilege then null;
  end;

  begin
    insert into public.scan_logs (result, input_hint) values ('ok', 'forged');
    raise exception 'พนักงานต้องปลอม log ไม่ได้' using errcode = 'P0001';
  exception when insufficient_privilege then null;
  end;

  reset role;
  perform set_config('request.jwt.claims', '{"sub": "00000000-0000-0000-0000-000000000052", "role": "authenticated"}', true);
  set local role authenticated;

  assert (select count(*) from public.scan_logs) = 0, 'ลูกค้าต้องไม่เห็น log';

  reset role;
end;
$$;

select 'scan_logs ok' as result;

rollback;

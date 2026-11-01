-- ทดสอบ trigger และ RLS ของ profiles ทั้งหมดอยู่ใน transaction ที่ rollback จึงไม่เหลือข้อมูล
begin;

insert into auth.users (id, email, raw_user_meta_data) values
  ('00000000-0000-0000-0000-000000000001', 'customer@example.test', '{"full_name": "ลูกค้า", "role": "admin"}'),
  ('00000000-0000-0000-0000-000000000002', 'other@example.test', '{"full_name": "ลูกค้าอีกคน"}'),
  ('00000000-0000-0000-0000-000000000003', 'staff@example.test', '{"full_name": "พนักงาน"}');

update public.profiles set role = 'staff'
where id = '00000000-0000-0000-0000-000000000003';

do $$
declare
  seen integer;
begin
  assert (select role from public.profiles where id = '00000000-0000-0000-0000-000000000001') = 'customer',
    'role จาก metadata ต้องไม่มีผล';
  assert (select full_name from public.profiles where id = '00000000-0000-0000-0000-000000000001') = 'ลูกค้า',
    'trigger ต้องคัดลอกชื่อ';

  perform set_config('request.jwt.claims', '{"sub": "00000000-0000-0000-0000-000000000001", "role": "authenticated"}', true);
  set local role authenticated;

  select count(*) into seen from public.profiles;
  assert seen = 1, 'ลูกค้าต้องเห็นเฉพาะแถวของตัวเอง';

  update public.profiles set full_name = 'ชื่อใหม่' where id = '00000000-0000-0000-0000-000000000001';
  assert (select full_name from public.profiles) = 'ชื่อใหม่', 'ลูกค้าต้องแก้ชื่อตัวเองได้';

  update public.profiles set full_name = 'แอบแก้' where id = '00000000-0000-0000-0000-000000000002';
  get diagnostics seen = row_count;
  assert seen = 0, 'ลูกค้าต้องแก้แถวของคนอื่นไม่ได้';

  begin
    update public.profiles set role = 'admin' where id = '00000000-0000-0000-0000-000000000001';
    raise exception 'ลูกค้าต้องแก้ role ไม่ได้' using errcode = 'P0001';
  exception when insufficient_privilege then null;
  end;

  begin
    update public.profiles set points_balance = 9999 where id = '00000000-0000-0000-0000-000000000001';
    raise exception 'ลูกค้าต้องแก้คะแนนไม่ได้' using errcode = 'P0001';
  exception when insufficient_privilege then null;
  end;

  reset role;
  perform set_config('request.jwt.claims', '{"sub": "00000000-0000-0000-0000-000000000003", "role": "authenticated"}', true);
  set local role authenticated;

  select count(*) into seen from public.profiles;
  assert seen = 3, 'พนักงานต้องเห็นทุกแถว';

  reset role;
  perform set_config('request.jwt.claims', '{"role": "anon"}', true);
  set local role anon;

  begin
    perform 1 from public.profiles;
    raise exception 'anon ต้องอ่าน profiles ไม่ได้' using errcode = 'P0001';
  exception when insufficient_privilege then null;
  end;

  reset role;
end;
$$;

select 'profiles_rls ok' as result;

rollback;

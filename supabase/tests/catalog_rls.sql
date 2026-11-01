-- ทดสอบกฎของหนัง โรง ที่นั่ง และรอบฉาย ทั้งหมดอยู่ใน transaction ที่ rollback จึงไม่เหลือข้อมูล
begin;

insert into auth.users (id, email, raw_user_meta_data) values
  ('00000000-0000-0000-0000-000000000011', 'admin@example.test', '{}'),
  ('00000000-0000-0000-0000-000000000012', 'staff@example.test', '{}');

update public.profiles set role = 'admin'
where id = '00000000-0000-0000-0000-000000000011';
update public.profiles set role = 'staff'
where id = '00000000-0000-0000-0000-000000000012';

do $$
declare
  new_movie uuid;
  new_theater uuid;
  first_showtime uuid;
  seat_count integer;
  ends timestamptz;
begin
  perform set_config('request.jwt.claims', '{"sub": "00000000-0000-0000-0000-000000000011", "role": "authenticated"}', true);
  set local role authenticated;

  insert into public.movies (title, duration_min) values ('หนังทดสอบ', 100)
  returning id into new_movie;

  new_theater := public.create_theater('โรงทดสอบ', 3, 4);
  select count(*) into seat_count from public.seats where theater_id = new_theater;
  assert seat_count = 12, 'create_theater ต้องสร้างที่นั่งครบ';
  assert (select count(distinct row_label) from public.seats where theater_id = new_theater) = 3,
    'create_theater ต้องสร้างแถวครบ';

  begin
    perform public.create_theater('โรงใหญ่เกิน', 27, 4);
    raise exception 'ต้องปฏิเสธผังที่ใหญ่เกินกำหนด' using errcode = 'P0001';
  exception when invalid_parameter_value then null;
  end;

  insert into public.showtimes (movie_id, theater_id, starts_at, ends_at, base_price)
  values (new_movie, new_theater, '2030-01-01 10:00+07', '2030-01-01 10:01+07', 180)
  returning id, ends_at into first_showtime, ends;
  assert ends = '2030-01-01 12:00+07'::timestamptz,
    'ends_at ต้องคำนวณจากความยาวหนังบวกเวลาทำความสะอาด 20 นาที';

  begin
    insert into public.showtimes (movie_id, theater_id, starts_at, ends_at, base_price)
    values (new_movie, new_theater, '2030-01-01 11:59+07', '2030-01-01 12:00+07', 180);
    raise exception 'รอบที่ทับกันต้องถูกปฏิเสธ' using errcode = 'P0001';
  exception when exclusion_violation then null;
  end;

  insert into public.showtimes (movie_id, theater_id, starts_at, ends_at, base_price)
  values (new_movie, new_theater, '2030-01-01 12:00+07', '2030-01-01 12:01+07', 180);

  update public.showtimes set status = 'cancelled' where id = first_showtime;
  insert into public.showtimes (movie_id, theater_id, starts_at, ends_at, base_price)
  values (new_movie, new_theater, '2030-01-01 09:00+07', '2030-01-01 09:01+07', 180);

  reset role;
  perform set_config('request.jwt.claims', '{"sub": "00000000-0000-0000-0000-000000000012", "role": "authenticated"}', true);
  set local role authenticated;

  assert (select count(*) from public.movies where id = new_movie) = 1, 'พนักงานต้องอ่านหนังได้';

  begin
    insert into public.movies (title, duration_min) values ('แอบเพิ่ม', 90);
    raise exception 'พนักงานต้องเพิ่มหนังไม่ได้' using errcode = 'P0001';
  exception when insufficient_privilege then null;
  end;

  update public.movies set title = 'แอบแก้' where id = new_movie;
  get diagnostics seat_count = row_count;
  assert seat_count = 0, 'พนักงานต้องแก้หนังไม่ได้';

  begin
    perform public.create_theater('แอบสร้าง', 2, 2);
    raise exception 'พนักงานต้องสร้างโรงไม่ได้' using errcode = 'P0001';
  exception when insufficient_privilege then null;
  end;

  reset role;
  perform set_config('request.jwt.claims', '{"role": "anon"}', true);
  set local role anon;

  assert (select count(*) from public.showtimes where movie_id = new_movie) = 3, 'anon ต้องอ่านรอบฉายได้';

  begin
    update public.movies set title = 'แอบแก้' where id = new_movie;
    raise exception 'anon ต้องแก้หนังไม่ได้' using errcode = 'P0001';
  exception when insufficient_privilege then null;
  end;

  begin
    perform public.create_theater('แอบสร้าง', 2, 2);
    raise exception 'anon ต้องเรียก create_theater ไม่ได้' using errcode = 'P0001';
  exception when insufficient_privilege then null;
  end;

  reset role;
end;
$$;

select 'catalog_rls ok' as result;

rollback;

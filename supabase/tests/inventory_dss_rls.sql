-- ทดสอบสิทธิ์ของระบบวางแผนสั่งซื้อ ทั้งหมดอยู่ใน transaction ที่ rollback จึงไม่เหลือข้อมูล
begin;

insert into auth.users (id, email, raw_user_meta_data) values
  ('00000000-0000-0000-0000-000000000091', 'customer-dss@example.test', '{}'),
  ('00000000-0000-0000-0000-000000000092', 'staff-dss@example.test', '{}'),
  ('00000000-0000-0000-0000-000000000093', 'executive-dss@example.test', '{}'),
  ('00000000-0000-0000-0000-000000000094', 'admin-dss@example.test', '{}');

update public.profiles set role = 'staff' where id = '00000000-0000-0000-0000-000000000092';
update public.profiles set role = 'executive' where id = '00000000-0000-0000-0000-000000000093';
update public.profiles set role = 'admin' where id = '00000000-0000-0000-0000-000000000094';

do $$
declare
  user_id text;
  today date := (now() at time zone 'Asia/Bangkok')::date;
  ingredient uuid := (select id from public.ingredients order by name limit 1);
  usage jsonb;
  decision_count integer;
begin
  foreach user_id in array array[
    '00000000-0000-0000-0000-000000000091',
    '00000000-0000-0000-0000-000000000092',
    '00000000-0000-0000-0000-000000000093'
  ] loop
    perform set_config('request.jwt.claims', format('{"sub": "%s", "role": "authenticated"}', user_id), true);
    set local role authenticated;

    begin
      perform public.ingredient_daily_usage(today - 6, today);
      raise exception 'ต้องดูยอดใช้วัตถุดิบไม่ได้' using errcode = 'P0001';
    exception when insufficient_privilege then null;
    end;

    begin
      perform public.showtime_demand(today - 6, today);
      raise exception 'ต้องดูความต้องการรอบฉายไม่ได้' using errcode = 'P0001';
    exception when insufficient_privilege then null;
    end;

    begin
      perform public.admin_today_summary();
      raise exception 'ต้องดูภาพรวมไม่ได้' using errcode = 'P0001';
    exception when insufficient_privilege then null;
    end;

    begin
      insert into public.reorder_decisions (
        ingredient_id, recommended_option, recommended_qty, approved_option, approved_qty,
        service_level, d, sigma, rop, on_hand, lead_time_days, order_cost
      ) values (ingredient, 'B', 10, 'B', 10, 95, 1, 1, 1, 1, 3, 100);
      raise exception 'ต้องบันทึกการตัดสินใจไม่ได้' using errcode = 'P0001';
    exception when insufficient_privilege then null;
    end;

    begin
      update public.ingredients set unit_cost = 1 where id = ingredient;
      assert not found, 'ต้องแก้ต้นทุนวัตถุดิบไม่ได้';
    exception when insufficient_privilege then null;
    end;

    assert (select count(*) from public.reorder_decisions) = 0, 'ต้องไม่เห็นบันทึกการตัดสินใจ';

    reset role;
  end loop;

  perform set_config('request.jwt.claims', '{"sub": "00000000-0000-0000-0000-000000000094", "role": "authenticated"}', true);
  set local role authenticated;

  usage := public.ingredient_daily_usage(today - 6, today);
  assert jsonb_array_length(usage -> 'dates') = 7, 'ต้องมีครบทุกวัน';
  assert jsonb_array_length(usage -> 'ingredients' -> 0 -> 'usage') = 7, 'วันที่ไม่มีการใช้ต้องได้ 0';
  assert jsonb_typeof(public.showtime_demand(today - 6, today)) = 'array', 'admin ดูความต้องการรอบฉายได้';
  assert public.admin_today_summary() ? 'revenue_today', 'admin ดูภาพรวมได้';

  begin
    perform public.ingredient_daily_usage(today, today - 1);
    raise exception 'ช่วงวันที่กลับด้านต้องไม่ผ่าน' using errcode = 'P0001';
  exception when sqlstate 'WJ050' then null;
  end;

  update public.ingredients set unit_cost = 0.08, lead_time_days = 3 where id = ingredient;
  assert found, 'admin แก้ต้นทุนวัตถุดิบได้';

  insert into public.reorder_decisions (
    ingredient_id, recommended_option, recommended_qty, approved_option, approved_qty,
    service_level, d, sigma, rop, on_hand, lead_time_days, order_cost
  ) values (ingredient, 'B', 10, 'A', 12, 95, 1, 1, 1, 1, 3, 100);

  select count(*) into decision_count from public.reorder_decisions;
  assert decision_count = 1, 'admin บันทึกและอ่านการตัดสินใจได้';
  assert (select created_by from public.reorder_decisions limit 1) = '00000000-0000-0000-0000-000000000094',
    'ต้องบันทึกผู้ตัดสินใจ';

  begin
    update public.reorder_decisions set approved_qty = 99;
    raise exception 'ต้องแก้บันทึกการตัดสินใจไม่ได้' using errcode = 'P0001';
  exception when insufficient_privilege then null;
  end;

  begin
    delete from public.reorder_decisions;
    raise exception 'ต้องลบบันทึกการตัดสินใจไม่ได้' using errcode = 'P0001';
  exception when insufficient_privilege then null;
  end;

  begin
    insert into public.reorder_decisions (
      ingredient_id, recommended_option, recommended_qty, approved_option, approved_qty,
      service_level, d, sigma, rop, on_hand, lead_time_days, order_cost, created_by
    ) values (ingredient, 'B', 10, 'B', 10, 95, 1, 1, 1, 1, 3, 100, '00000000-0000-0000-0000-000000000092');
    raise exception 'ต้องบันทึกในนามคนอื่นไม่ได้' using errcode = 'P0001';
  exception when insufficient_privilege then null;
  end;

  reset role;
end;
$$;

select 'inventory_dss ok' as result;

rollback;

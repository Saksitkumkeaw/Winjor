-- ลบข้อมูลจำลองของ DSS ทั้งชุด ไม่แตะข้อมูลจริง (รันใน SQL Editor ด้วย role postgres)
-- ค่าคงเหลือคืนด้วยผลต่างที่จดไว้ การขายจริงระหว่างสาธิตจึงยังอยู่
-- ค่าก่อนใส่ข้อมูลจำลอง (3 พ.ย. 2026) ไว้ตรวจสอบ: คงเหลือ / จุดแจ้งเตือน
--   น้ำอัดลม 22000 / 6000 มล., Coke 10000 / 6000 มล., ข้าวโพดคั่ว 14850 / 3000 กรัม, เนย 4320 / 800 กรัม
--   แก้วน้ำ 500 / 80 ใบ, กล่องป๊อปคอร์น S 290 / 50 ใบ, กล่องป๊อปคอร์น L 300 / 50 ใบ, lay 100 / 80 ถุง
-- ต้นทุนใน dss_ingredient_costs.sql เป็นค่าตั้งค่า จึงไม่ถูกลบ

begin;

do $$
begin
  if to_regclass('private.dss_demo_rows') is null then
    raise exception 'ไม่มีข้อมูลจำลองให้ลบ';
  end if;

  delete from public.stock_movements
  where order_id in (select id from public.orders where order_no like 'DEMO-%');

  -- ตั๋ว รายการสินค้า และการชำระเงินถูกลบตามคำสั่งซื้อ
  delete from public.orders where order_no like 'DEMO-%';

  delete from public.showtimes
  where id in (select row_id from private.dss_demo_rows where table_name = 'showtimes');

  update public.ingredients as ingredient
  set quantity_on_hand = ingredient.quantity_on_hand + saved.original_on_hand - saved.demo_on_hand,
      reorder_level = saved.original_reorder_level
  from private.dss_demo_stock as saved
  where ingredient.id = saved.ingredient_id;

  drop table private.dss_demo_rows;
  drop table private.dss_demo_stock;
end;
$$;

select
  (select count(*) from public.orders where order_no like 'DEMO-%') as demo_orders_left,
  (select count(*) from public.stock_movements where order_id is null and reason = 'sale') as orphan_sale_movements;

commit;

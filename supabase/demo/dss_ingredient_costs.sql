-- ต้นทุนของวัตถุดิบสำหรับ DSS วางแผนสั่งซื้อ อิงราคาจริงเท่าที่หาได้ ที่เหลือเป็นค่าประมาณ (แก้ได้ที่หน้าวางแผนสั่งซื้อ)
-- C = unit_cost (บาทต่อหน่วย), F = order_cost (บาทต่อครั้ง: ค่าส่งและเวลาจัดการ)
-- I = holding_rate (ต่อปี), L = lead_time_days
-- ที่มา (ค้นเมื่อ 3 พ.ย. 2026):
--   ข้าวโพดคั่ว: ถุง 22.68 กก. ราคา EUR 44.95 (eBay เยอรมนี) ≈ 76 บาท/กก.
--   เนย: Bega เนยเค็ม 1 กก. 357 บาท (Lazada)
--   แก้วน้ำ 22 ออนซ์: ลัง 1,000 ใบ $100.30 (Wasserstrom) และ £69.65 (AOS) ≈ 3 บาท/ใบ
--   I: ของแห้งเก็บได้นาน 20-25%/ปี, ของเน่าเสียได้ 30-40%/ปี (eightx.co)
--   น้ำอัดลม, Coke, กล่องป๊อปคอร์น, lay, F และ L ไม่พบราคาในไทย ใช้ค่าประมาณ

update public.ingredients as ingredient
set
  unit_cost = cost.unit_cost,
  order_cost = cost.order_cost,
  holding_rate = cost.holding_rate,
  lead_time_days = cost.lead_time_days,
  discount_min_qty = cost.discount_min_qty,
  discount_pct = cost.discount_pct
from (
  values
    ('ข้าวโพดคั่ว', 0.08, 50, 0.22, 3, 150000, 5),
    ('เนย', 0.36, 50, 0.35, 3, null, null),
    ('น้ำอัดลม', 0.02, 60, 0.22, 2, 800000, 4),
    ('Coke', 0.025, 60, 0.22, 2, null, null),
    ('แก้วน้ำ', 3.00, 40, 0.22, 5, 5000, 5),
    ('กล่องป๊อปคอร์น S', 2.00, 40, 0.22, 5, null, null),
    ('กล่องป๊อปคอร์น L', 3.00, 40, 0.22, 5, 3000, 5),
    ('lay', 15.00, 40, 0.22, 3, null, null)
) as cost (name, unit_cost, order_cost, holding_rate, lead_time_days, discount_min_qty, discount_pct)
where ingredient.name = cost.name;

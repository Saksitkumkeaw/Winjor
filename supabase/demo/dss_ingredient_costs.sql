-- ต้นทุนสมมติของวัตถุดิบสำหรับ DSS วางแผนสั่งซื้อ (ใช้เป็นสมมติฐานในการนำเสนอ แก้ได้ที่หน้าวางแผนสั่งซื้อ)
-- C = unit_cost (บาทต่อหน่วย), F = order_cost (บาทต่อครั้ง: ค่าส่งและเวลาจัดการ)
-- I = holding_rate (ต่อปี รวมค่าเสื่อม ของเสีย และพื้นที่เก็บ), L = lead_time_days
-- ตั้งให้ EOQ พอใช้ราว 1-3 สัปดาห์ ซึ่งสมจริงกับของกินและทำให้ backtest 30 วันมีหลายรอบสั่ง

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
    ('ข้าวโพดคั่ว', 0.08, 50, 0.30, 3, 150000, 5),
    ('เนย', 0.30, 50, 0.50, 3, null, null),
    ('น้ำอัดลม', 0.02, 60, 0.30, 2, 800000, 4),
    ('Coke', 0.025, 60, 0.50, 2, null, null),
    ('แก้วน้ำ', 1.50, 40, 0.50, 5, 30000, 8),
    ('กล่องป๊อปคอร์น S', 2.00, 40, 0.50, 5, null, null),
    ('กล่องป๊อปคอร์น L', 3.00, 40, 0.50, 5, 3000, 5),
    ('lay', 15.00, 40, 0.30, 3, null, null)
) as cost (name, unit_cost, order_cost, holding_rate, lead_time_days, discount_min_qty, discount_pct)
where ingredient.name = cost.name;

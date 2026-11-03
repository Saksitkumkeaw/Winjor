-- ต้นทุนสมมติของวัตถุดิบสำหรับ DSS วางแผนสั่งซื้อ (ใช้เป็นสมมติฐานในการนำเสนอ แก้ได้ที่หน้าวางแผนสั่งซื้อ)
-- C = unit_cost (บาทต่อหน่วย), F = order_cost (บาทต่อครั้ง), I = holding_rate (ต่อปี), L = lead_time_days

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
    ('ข้าวโพดคั่ว', 0.08, 100, 0.25, 3, 150000, 5),
    ('เนย', 0.30, 100, 0.25, 3, null, null),
    ('น้ำอัดลม', 0.02, 150, 0.20, 2, 500000, 4),
    ('Coke', 0.025, 150, 0.20, 2, null, null),
    ('แก้วน้ำ', 1.50, 80, 0.15, 5, 5000, 8),
    ('กล่องป๊อปคอร์น S', 2.00, 80, 0.15, 5, null, null),
    ('กล่องป๊อปคอร์น L', 3.00, 80, 0.15, 5, 3000, 5),
    ('lay', 15.00, 100, 0.25, 3, null, null)
) as cost (name, unit_cost, order_cost, holding_rate, lead_time_days, discount_min_qty, discount_pct)
where ingredient.name = cost.name;

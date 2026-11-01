-- ข้อมูลตัวอย่างสำหรับพัฒนา ใช้กับฐานข้อมูลใหม่ครั้งเดียว ชื่อหนังทั้งหมดเป็นชื่อสมมติ

select public.create_theater('โรง 1', 8, 12);
select public.create_theater('โรง 2', 6, 10);

update public.seats as seat
set seat_type_id = (select id from public.seat_types where name = 'พรีเมียม')
from public.theaters as theater
where theater.id = seat.theater_id
  and (
    (theater.name = 'โรง 1' and seat.row_label = 'H')
    or (theater.name = 'โรง 2' and seat.row_label = 'F')
  );

insert into public.movies (title, synopsis, duration_min, rating, release_date, status) values
  ('เงาเหนือเมืองฝน', 'นักสืบหญิงตามหาพยานคนสุดท้ายในเมืองที่ฝนไม่เคยหยุดตก', 118, 'น 15+', current_date - 7, 'now_showing'),
  ('รถไฟเที่ยวสุดท้าย', 'คนแปลกหน้าห้าคนติดอยู่บนรถไฟที่ไม่มีวันถึงปลายทาง', 102, 'น 13+', current_date - 3, 'now_showing'),
  ('ดาวดวงที่เจ็ด', 'ลูกเรืออวกาศต้องเลือกระหว่างภารกิจกับทางกลับบ้าน', 135, 'ท', current_date + 14, 'coming_soon');

with schedule (title, theater_name, start_time, base_price) as (
  values
    ('เงาเหนือเมืองฝน', 'โรง 1', time '13:00', 180),
    ('เงาเหนือเมืองฝน', 'โรง 1', time '16:00', 180),
    ('รถไฟเที่ยวสุดท้าย', 'โรง 1', time '19:30', 200),
    ('รถไฟเที่ยวสุดท้าย', 'โรง 2', time '14:00', 160),
    ('เงาเหนือเมืองฝน', 'โรง 2', time '18:30', 180)
),
days as (
  select (now() at time zone 'Asia/Bangkok')::date + offset_days as show_date
  from generate_series(0, 2) as offset_days
)
insert into public.showtimes (movie_id, theater_id, starts_at, ends_at, base_price)
select
  movie.id,
  theater.id,
  (days.show_date + schedule.start_time) at time zone 'Asia/Bangkok',
  (days.show_date + schedule.start_time) at time zone 'Asia/Bangkok',
  schedule.base_price
from schedule
cross join days
join public.movies as movie on movie.title = schedule.title
join public.theaters as theater on theater.name = schedule.theater_name;

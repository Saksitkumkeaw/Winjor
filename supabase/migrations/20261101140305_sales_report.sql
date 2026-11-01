-- รายงานผู้บริหาร: สรุปยอดในฐานข้อมูลตามวันเวลาไทย จึงไม่ติดจำนวนแถวสูงสุดของ API

create function public.sales_report(p_from date, p_to date)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  range_start timestamptz := p_from::timestamp at time zone 'Asia/Bangkok';
  range_end timestamptz := (p_to + 1)::timestamp at time zone 'Asia/Bangkok';
  report jsonb;
begin
  if private.current_app_role() is distinct from 'executive' then
    raise exception 'ไม่มีสิทธิ์ดูรายงาน' using errcode = '42501';
  end if;
  if p_to < p_from or p_to - p_from > 366 then
    raise exception 'ช่วงวันที่ไม่ถูกต้อง' using errcode = 'WJ050';
  end if;

  with paid_orders as (
    select id, total, channel, (created_at at time zone 'Asia/Bangkok')::date as sale_date
    from public.orders
    where status = 'paid'
      and created_at >= range_start
      and created_at < range_end
  ),
  sold_tickets as (
    select ticket.id, ticket.price, ticket.showtime_id, paid.sale_date
    from public.tickets as ticket
    join paid_orders as paid on paid.id = ticket.order_id
    where ticket.status in ('paid', 'used')
  ),
  sold_by_showtime as (
    select ticket.showtime_id, count(*) as sold
    from public.tickets as ticket
    where ticket.status in ('paid', 'used')
    group by ticket.showtime_id
  ),
  shows as (
    select
      showtime.id,
      showtime.movie_id,
      coalesce(sold.sold, 0) as sold,
      (
        select count(*)
        from public.seats as seat
        where seat.theater_id = showtime.theater_id
          and seat.is_active
      ) as capacity
    from public.showtimes as showtime
    left join sold_by_showtime as sold on sold.showtime_id = showtime.id
    where showtime.status = 'scheduled'
      and showtime.starts_at >= range_start
      and showtime.starts_at < range_end
  )
  select jsonb_build_object(
    'revenue', (select coalesce(sum(total), 0) from paid_orders),
    'orders', (select count(*) from paid_orders),
    'tickets', (select count(*) from sold_tickets),
    'seats_sold', (select coalesce(sum(sold), 0) from shows),
    'seats_available', (select coalesce(sum(capacity), 0) from shows),
    'refunded', (
      select coalesce(sum(total), 0)
      from public.orders
      where status = 'refunded'
        and created_at >= range_start
        and created_at < range_end
    ),
    'daily', (
      select jsonb_agg(
        jsonb_build_object(
          'date', day::date,
          'revenue', coalesce((select sum(total) from paid_orders where sale_date = day::date), 0),
          'tickets', (select count(*) from sold_tickets where sale_date = day::date)
        )
        order by day
      )
      from generate_series(p_from::timestamp, p_to::timestamp, interval '1 day') as day
    ),
    'movies', (
      select coalesce(jsonb_agg(row_data order by (row_data ->> 'revenue')::numeric desc), '[]'::jsonb)
      from (
        select jsonb_build_object(
          'title', movie.title,
          'tickets', count(*),
          'revenue', sum(sold.price)
        ) as row_data
        from sold_tickets as sold
        join public.showtimes as showtime on showtime.id = sold.showtime_id
        join public.movies as movie on movie.id = showtime.movie_id
        group by movie.id, movie.title
      ) as ranked
    ),
    'products', (
      select coalesce(jsonb_agg(row_data order by (row_data ->> 'revenue')::numeric desc), '[]'::jsonb)
      from (
        select jsonb_build_object(
          'name', product.name,
          'quantity', sum(item.quantity),
          'revenue', sum(item.quantity * item.unit_price)
        ) as row_data
        from public.order_items as item
        join paid_orders as paid on paid.id = item.order_id
        join public.products as product on product.id = item.product_id
        group by product.id, product.name
      ) as ranked
    ),
    'channels', (
      select coalesce(jsonb_agg(row_data order by (row_data ->> 'revenue')::numeric desc), '[]'::jsonb)
      from (
        select jsonb_build_object('channel', channel, 'revenue', sum(total)) as row_data
        from paid_orders
        group by channel
      ) as ranked
    )
  )
  into report;

  return report;
end;
$$;

revoke all on function public.sales_report(date, date) from public, anon;
grant execute on function public.sales_report(date, date) to authenticated;

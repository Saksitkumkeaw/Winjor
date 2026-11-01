-- บันทึกทุกการสแกน รวมครั้งที่ไม่ผ่าน ส่วนรหัสที่สแกนเก็บแค่ 8 ตัวแรก เพื่อไม่ให้นำไปใช้แทนตั๋วได้

create table public.scan_logs (
  id uuid primary key default gen_random_uuid(),
  ticket_id uuid references public.tickets (id) on delete set null,
  staff_id uuid references public.profiles (id) on delete set null,
  result text not null,
  input_hint text not null,
  created_at timestamptz not null default now()
);

create index scan_logs_created_at_idx on public.scan_logs (created_at desc);
create index scan_logs_ticket_id_idx on public.scan_logs (ticket_id);
create index scan_logs_staff_id_idx on public.scan_logs (staff_id);

alter table public.scan_logs enable row level security;

revoke all on public.scan_logs from anon, authenticated;
grant select on public.scan_logs to authenticated;

create policy "Staff can read" on public.scan_logs
  for select to authenticated
  using ((select private.current_app_role()) in ('staff', 'admin', 'executive'));

create or replace function public.check_in_ticket(p_qr_token text)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  found_ticket record;
  details jsonb;
  outcome text;
begin
  if private.current_app_role() is null
    or private.current_app_role() not in ('staff', 'admin')
  then
    raise exception 'ไม่มีสิทธิ์ตรวจตั๋ว' using errcode = '42501';
  end if;

  select
    ticket.id,
    ticket.status,
    ticket.checked_in_at,
    showtime.starts_at,
    showtime.status as showtime_status,
    movie.title,
    theater.name as theater_name,
    seat.row_label || seat.seat_number as seat_label
  into found_ticket
  from public.tickets as ticket
  join public.showtimes as showtime on showtime.id = ticket.showtime_id
  join public.movies as movie on movie.id = showtime.movie_id
  join public.theaters as theater on theater.id = showtime.theater_id
  join public.seats as seat on seat.id = ticket.seat_id
  where ticket.qr_token = p_qr_token
  for update of ticket;

  if not found then
    insert into public.scan_logs (staff_id, result, input_hint)
    values (auth.uid(), 'not_found', left(p_qr_token, 8));
    return jsonb_build_object('result', 'not_found');
  end if;

  details := jsonb_build_object(
    'title', found_ticket.title,
    'theater', found_ticket.theater_name,
    'seat', found_ticket.seat_label,
    'starts_at', found_ticket.starts_at,
    'checked_in_at', found_ticket.checked_in_at
  );

  outcome := case
    when found_ticket.status = 'used' then 'used'
    when found_ticket.status <> 'paid' or found_ticket.showtime_status <> 'scheduled' then 'invalid'
    when now() < found_ticket.starts_at - interval '1 hour' then 'too_early'
    when now() > found_ticket.starts_at + interval '30 minutes' then 'too_late'
    else 'ok'
  end;

  insert into public.scan_logs (ticket_id, staff_id, result, input_hint)
  values (found_ticket.id, auth.uid(), outcome, left(p_qr_token, 8));

  if outcome <> 'ok' then
    return details || jsonb_build_object('result', outcome);
  end if;

  update public.tickets
  set status = 'used',
      checked_in_at = now(),
      checked_in_by = auth.uid()
  where id = found_ticket.id;

  return details || jsonb_build_object('result', 'ok', 'checked_in_at', now());
end;
$$;

-- PromptPay คืนเงินผ่าน Omise ไม่ได้ จึงต้องบันทึกการคืนเงินเองและติดตามรายการที่ค้างคืน

alter table public.payments
  add column needs_refund boolean not null default false,
  add column refund_method text check (refund_method in ('omise', 'manual'));

create index payments_needs_refund_idx on public.payments (needs_refund) where needs_refund;

drop function public.complete_refund(uuid, text);

create function public.complete_refund(
  p_order_id uuid,
  p_reason text,
  p_refund_method text
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if private.current_app_role() is distinct from 'admin' then
    raise exception 'ไม่มีสิทธิ์คืนเงิน' using errcode = '42501';
  end if;

  if not exists (
    select 1 from public.orders
    where id = p_order_id
      and status = 'paid'
  ) then
    raise exception 'คำสั่งซื้อนี้คืนเงินไม่ได้' using errcode = 'WJ020';
  end if;

  if exists (
    select 1 from public.tickets
    where order_id = p_order_id
      and status = 'used'
  ) then
    raise exception 'มีตั๋วที่ใช้แล้ว' using errcode = 'WJ021';
  end if;

  if exists (
    select 1
    from public.tickets as ticket
    join public.showtimes as showtime on showtime.id = ticket.showtime_id
    where ticket.order_id = p_order_id
      and showtime.status = 'scheduled'
      and showtime.starts_at <= now()
  ) then
    raise exception 'รอบฉายเริ่มแล้ว' using errcode = 'WJ022';
  end if;

  update public.tickets
  set status = 'refunded'
  where order_id = p_order_id
    and status = 'paid';

  update public.payments
  set status = 'refunded',
      refunded_at = now(),
      refunded_by = auth.uid(),
      refund_reason = p_reason,
      refund_method = p_refund_method
  where order_id = p_order_id
    and status = 'succeeded'
    and not needs_refund;

  update public.orders
  set status = 'refunded'
  where id = p_order_id;
end;
$$;

revoke all on function public.complete_refund(uuid, text, text) from public, anon;
grant execute on function public.complete_refund(uuid, text, text) to authenticated;

create function public.mark_payment_refunded(p_payment_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if private.current_app_role() is distinct from 'admin' then
    raise exception 'ไม่มีสิทธิ์คืนเงิน' using errcode = '42501';
  end if;

  update public.payments
  set status = 'refunded',
      needs_refund = false,
      refunded_at = now(),
      refunded_by = auth.uid(),
      refund_method = 'manual'
  where id = p_payment_id
    and needs_refund;
end;
$$;

revoke all on function public.mark_payment_refunded(uuid) from public, anon;
grant execute on function public.mark_payment_refunded(uuid) to authenticated;

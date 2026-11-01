-- ผู้ใช้และบทบาท: role กำหนดได้จากฐานข้อมูลเท่านั้น ห้ามรับจากข้อมูลที่ผู้ใช้ส่งมา

create schema if not exists private;

create type public.app_role as enum ('customer', 'staff', 'admin', 'executive');

create table public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  full_name text not null default '',
  phone text,
  role public.app_role not null default 'customer',
  points_balance integer not null default 0 check (points_balance >= 0),
  created_at timestamptz not null default now()
);

alter table public.profiles enable row level security;

create function private.current_app_role()
returns public.app_role
language sql
stable
security definer
set search_path = ''
as $$
  select role from public.profiles where id = auth.uid();
$$;

create function private.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.profiles (id, full_name, phone)
  values (
    new.id,
    coalesce(new.raw_user_meta_data ->> 'full_name', ''),
    new.raw_user_meta_data ->> 'phone'
  );
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function private.handle_new_user();

revoke all on schema private from public;
grant usage on schema private to authenticated;
revoke all on function private.current_app_role() from public;
grant execute on function private.current_app_role() to authenticated;
revoke all on function private.handle_new_user() from public;

create policy "Read own profile or as staff"
  on public.profiles for select
  to authenticated
  using (
    id = (select auth.uid())
    or (select private.current_app_role()) in ('staff', 'admin')
  );

create policy "Update own profile"
  on public.profiles for update
  to authenticated
  using (id = (select auth.uid()))
  with check (id = (select auth.uid()));

-- สิทธิ์ระดับคอลัมน์กันผู้ใช้แก้ role และคะแนนของตัวเอง
revoke all on public.profiles from anon, authenticated;
grant select on public.profiles to authenticated;
grant update (full_name, phone) on public.profiles to authenticated;

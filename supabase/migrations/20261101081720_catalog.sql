-- ข้อมูลหนัง โรง ที่นั่ง และรอบฉาย: ทุกคนอ่านได้ เฉพาะผู้ดูแลระบบแก้ไขได้

create extension if not exists btree_gist with schema extensions;

create type public.movie_status as enum ('coming_soon', 'now_showing', 'ended');
create type public.showtime_status as enum ('scheduled', 'cancelled');

create table public.seat_types (
  id uuid primary key default gen_random_uuid(),
  name text not null unique,
  surcharge numeric(10, 2) not null default 0 check (surcharge >= 0),
  created_at timestamptz not null default now()
);

create table public.movies (
  id uuid primary key default gen_random_uuid(),
  title text not null check (length(trim(title)) > 0),
  synopsis text not null default '',
  duration_min integer not null check (duration_min > 0),
  rating text not null default '',
  poster_url text,
  release_date date,
  status public.movie_status not null default 'coming_soon',
  created_at timestamptz not null default now()
);

create table public.theaters (
  id uuid primary key default gen_random_uuid(),
  name text not null unique check (length(trim(name)) > 0),
  is_active boolean not null default true,
  created_at timestamptz not null default now()
);

create table public.seats (
  id uuid primary key default gen_random_uuid(),
  theater_id uuid not null references public.theaters (id) on delete cascade,
  seat_type_id uuid not null references public.seat_types (id) on delete restrict,
  row_label text not null,
  seat_number integer not null check (seat_number > 0),
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  constraint seats_unique_position unique (theater_id, row_label, seat_number)
);

create index seats_seat_type_id_idx on public.seats (seat_type_id);

create table public.showtimes (
  id uuid primary key default gen_random_uuid(),
  movie_id uuid not null references public.movies (id) on delete restrict,
  theater_id uuid not null references public.theaters (id) on delete restrict,
  starts_at timestamptz not null,
  ends_at timestamptz not null,
  base_price numeric(10, 2) not null check (base_price >= 0),
  status public.showtime_status not null default 'scheduled',
  created_at timestamptz not null default now(),
  constraint showtimes_valid_range check (ends_at > starts_at),
  constraint showtimes_no_overlap exclude using gist (
    theater_id with =,
    tstzrange(starts_at, ends_at) with &&
  ) where (status <> 'cancelled')
);

create index showtimes_movie_id_idx on public.showtimes (movie_id);
create index showtimes_starts_at_idx on public.showtimes (starts_at);

-- ends_at รวมเวลาทำความสะอาดโรง และคำนวณจากความยาวหนังเสมอ
create function private.set_showtime_end()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  movie_minutes integer;
begin
  select duration_min into movie_minutes
  from public.movies
  where id = new.movie_id;

  new.ends_at := new.starts_at + make_interval(mins => movie_minutes + 20);
  return new;
end;
$$;

revoke all on function private.set_showtime_end() from public;

create trigger showtimes_set_end
  before insert or update of starts_at, movie_id on public.showtimes
  for each row execute function private.set_showtime_end();

-- สร้างโรงพร้อมที่นั่งใน transaction เดียว ที่นั่งเริ่มต้นเป็นประเภทราคาต่ำสุด
create function public.create_theater(
  p_name text,
  p_rows integer,
  p_seats_per_row integer
)
returns uuid
language plpgsql
set search_path = ''
as $$
declare
  new_theater_id uuid;
  default_seat_type_id uuid;
begin
  if p_rows not between 1 and 26 or p_seats_per_row not between 1 and 40 then
    raise exception 'ขนาดผังที่นั่งไม่ถูกต้อง' using errcode = '22023';
  end if;

  select id into default_seat_type_id
  from public.seat_types
  order by surcharge, name
  limit 1;

  insert into public.theaters (name)
  values (p_name)
  returning id into new_theater_id;

  insert into public.seats (theater_id, seat_type_id, row_label, seat_number)
  select new_theater_id, default_seat_type_id, chr(64 + r), n
  from generate_series(1, p_rows) as r
  cross join generate_series(1, p_seats_per_row) as n;

  return new_theater_id;
end;
$$;

revoke all on function public.create_theater(text, integer, integer) from public, anon;
grant execute on function public.create_theater(text, integer, integer) to authenticated;

alter table public.seat_types enable row level security;
alter table public.movies enable row level security;
alter table public.theaters enable row level security;
alter table public.seats enable row level security;
alter table public.showtimes enable row level security;

do $$
declare
  t text;
begin
  foreach t in array array['seat_types', 'movies', 'theaters', 'seats', 'showtimes'] loop
    execute format('revoke all on public.%I from anon, authenticated', t);
    execute format('grant select on public.%I to anon, authenticated', t);
    execute format('grant insert, update, delete on public.%I to authenticated', t);

    execute format(
      'create policy "Anyone can read" on public.%I for select to anon, authenticated using (true)',
      t
    );
    execute format(
      'create policy "Admins can insert" on public.%I for insert to authenticated with check ((select private.current_app_role()) = ''admin'')',
      t
    );
    execute format(
      'create policy "Admins can update" on public.%I for update to authenticated using ((select private.current_app_role()) = ''admin'') with check ((select private.current_app_role()) = ''admin'')',
      t
    );
    execute format(
      'create policy "Admins can delete" on public.%I for delete to authenticated using ((select private.current_app_role()) = ''admin'')',
      t
    );
  end loop;
end;
$$;

insert into public.seat_types (name, surcharge) values
  ('ปกติ', 0),
  ('พรีเมียม', 60);

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('posters', 'posters', true, 900000, array['image/jpeg', 'image/png', 'image/webp']);

create policy "Admins can upload posters"
  on storage.objects for insert
  to authenticated
  with check (
    bucket_id = 'posters'
    and (select private.current_app_role()) = 'admin'
  );

create policy "Admins can update posters"
  on storage.objects for update
  to authenticated
  using (
    bucket_id = 'posters'
    and (select private.current_app_role()) = 'admin'
  );

create policy "Admins can delete posters"
  on storage.objects for delete
  to authenticated
  using (
    bucket_id = 'posters'
    and (select private.current_app_role()) = 'admin'
  );

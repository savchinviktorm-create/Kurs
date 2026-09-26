create extension if not exists pgcrypto;

create table if not exists public.users (
  telegram_id bigint primary key,
  first_name text not null,
  last_name text,
  username text,
  language_code text,
  photo_url text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.courses (
  slug text primary key,
  title text not null,
  short_title text not null,
  intro_text text not null,
  logo_path text,
  total_steps integer not null check (total_steps > 0),
  timezone text not null default 'Europe/Kyiv',
  unlock_hour integer not null default 11 check (unlock_hour between 0 and 23),
  restart_offer_after_missed_days integer not null default 5 check (restart_offer_after_missed_days >= 1),
  is_free boolean not null default false,
  one_time_price_stars integer,
  is_published boolean not null default true,
  sort_order integer not null default 100,
  source_sha256 text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.course_steps (
  course_slug text not null references public.courses(slug) on delete cascade,
  step_number integer not null check (step_number > 0),
  title text not null,
  content text not null,
  created_at timestamptz not null default now(),
  primary key (course_slug, step_number)
);

create table if not exists public.course_attempts (
  id uuid primary key default gen_random_uuid(),
  telegram_id bigint not null references public.users(telegram_id) on delete cascade,
  course_slug text not null references public.courses(slug) on delete cascade,
  status text not null default 'active' check (status in ('active','finished','archived')),
  completed_steps integer not null default 0 check (completed_steps >= 0),
  current_step integer not null default 1 check (current_step >= 1),
  next_unlock_at timestamptz,
  started_at timestamptz not null default now(),
  last_completed_at timestamptz,
  finished_at timestamptz,
  archived_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index if not exists one_active_attempt_per_course
  on public.course_attempts(telegram_id, course_slug)
  where status = 'active';

create table if not exists public.course_progress_events (
  id uuid primary key default gen_random_uuid(),
  attempt_id uuid not null references public.course_attempts(id) on delete cascade,
  telegram_id bigint not null references public.users(telegram_id) on delete cascade,
  course_slug text not null references public.courses(slug) on delete cascade,
  step_number integer not null,
  event_type text not null check (event_type in ('started','completed','restarted','finished')),
  created_at timestamptz not null default now()
);

create table if not exists public.payments (
  telegram_payment_charge_id text primary key,
  telegram_id bigint not null references public.users(telegram_id) on delete cascade,
  kind text not null check (kind in ('donation','course','subscription')),
  course_slug text,
  amount_stars integer not null check (amount_stars > 0),
  currency text not null default 'XTR',
  invoice_payload text not null,
  status text not null default 'paid' check (status in ('paid','refunded')),
  is_recurring boolean not null default false,
  is_first_recurring boolean not null default false,
  subscription_expiration_at timestamptz,
  paid_at timestamptz not null default now(),
  refunded_at timestamptz
);

create table if not exists public.entitlements (
  id uuid primary key default gen_random_uuid(),
  telegram_id bigint not null references public.users(telegram_id) on delete cascade,
  course_slug text not null references public.courses(slug) on delete cascade,
  access_type text not null default 'permanent' check (access_type = 'permanent'),
  source_payment_charge_id text unique references public.payments(telegram_payment_charge_id) on delete set null,
  created_at timestamptz not null default now(),
  unique (telegram_id, course_slug)
);

create table if not exists public.subscriptions (
  telegram_id bigint primary key references public.users(telegram_id) on delete cascade,
  plan_key text not null default 'all-access',
  expires_at timestamptz not null,
  source_payment_charge_id text references public.payments(telegram_payment_charge_id) on delete set null,
  updated_at timestamptz not null default now()
);

-- All database access is server-side through the service role.
alter table public.users enable row level security;
alter table public.courses enable row level security;
alter table public.course_steps enable row level security;
alter table public.course_attempts enable row level security;
alter table public.course_progress_events enable row level security;
alter table public.payments enable row level security;
alter table public.entitlements enable row level security;
alter table public.subscriptions enable row level security;

create or replace function public.next_course_unlock(p_timezone text, p_hour integer)
returns timestamptz
language sql
stable
as $$
  select (((now() at time zone p_timezone)::date + 1) + make_interval(hours => p_hour)) at time zone p_timezone;
$$;

create or replace function public.start_course(p_telegram_id bigint, p_course_slug text)
returns public.course_attempts
language plpgsql
security definer
set search_path = public
as $$
declare
  c public.courses;
  a public.course_attempts;
begin
  select * into c from public.courses where slug = p_course_slug and is_published = true;
  if not found then raise exception 'COURSE_NOT_FOUND'; end if;

  select * into a from public.course_attempts
    where telegram_id = p_telegram_id and course_slug = p_course_slug and status = 'active'
    limit 1;
  if found then return a; end if;

  insert into public.course_attempts (
    telegram_id, course_slug, completed_steps, current_step, next_unlock_at
  ) values (
    p_telegram_id, p_course_slug, 0, 1, public.next_course_unlock(c.timezone, c.unlock_hour)
  ) returning * into a;

  insert into public.course_progress_events(attempt_id, telegram_id, course_slug, step_number, event_type)
  values (a.id, p_telegram_id, p_course_slug, 1, 'started');

  return a;
end;
$$;

create or replace function public.complete_current_step(p_telegram_id bigint, p_course_slug text)
returns public.course_attempts
language plpgsql
security definer
set search_path = public
as $$
declare
  c public.courses;
  a public.course_attempts;
  completed_number integer;
begin
  select * into c from public.courses where slug = p_course_slug and is_published = true;
  if not found then raise exception 'COURSE_NOT_FOUND'; end if;

  select * into a from public.course_attempts
    where telegram_id = p_telegram_id and course_slug = p_course_slug and status = 'active'
    for update;
  if not found then raise exception 'ATTEMPT_NOT_FOUND'; end if;

  if a.next_unlock_at is null or now() < a.next_unlock_at then
    raise exception 'STEP_LOCKED';
  end if;

  completed_number := a.current_step;

  if completed_number >= c.total_steps then
    update public.course_attempts
      set completed_steps = c.total_steps,
          current_step = c.total_steps,
          status = 'finished',
          next_unlock_at = null,
          last_completed_at = now(),
          finished_at = now(),
          updated_at = now()
      where id = a.id
      returning * into a;

    insert into public.course_progress_events(attempt_id, telegram_id, course_slug, step_number, event_type)
    values (a.id, p_telegram_id, p_course_slug, completed_number, 'completed');
    insert into public.course_progress_events(attempt_id, telegram_id, course_slug, step_number, event_type)
    values (a.id, p_telegram_id, p_course_slug, completed_number, 'finished');
  else
    update public.course_attempts
      set completed_steps = completed_number,
          current_step = completed_number + 1,
          next_unlock_at = public.next_course_unlock(c.timezone, c.unlock_hour),
          last_completed_at = now(),
          updated_at = now()
      where id = a.id
      returning * into a;

    insert into public.course_progress_events(attempt_id, telegram_id, course_slug, step_number, event_type)
    values (a.id, p_telegram_id, p_course_slug, completed_number, 'completed');
  end if;

  return a;
end;
$$;

create or replace function public.restart_course(p_telegram_id bigint, p_course_slug text)
returns public.course_attempts
language plpgsql
security definer
set search_path = public
as $$
declare
  old_a public.course_attempts;
  new_a public.course_attempts;
  c public.courses;
begin
  select * into c from public.courses where slug = p_course_slug and is_published = true;
  if not found then raise exception 'COURSE_NOT_FOUND'; end if;

  select * into old_a from public.course_attempts
    where telegram_id = p_telegram_id and course_slug = p_course_slug and status = 'active'
    for update;

  if found then
    update public.course_attempts
      set status = 'archived', archived_at = now(), updated_at = now()
      where id = old_a.id;
    insert into public.course_progress_events(attempt_id, telegram_id, course_slug, step_number, event_type)
    values (old_a.id, p_telegram_id, p_course_slug, old_a.current_step, 'restarted');
  end if;

  insert into public.course_attempts (
    telegram_id, course_slug, completed_steps, current_step, next_unlock_at
  ) values (
    p_telegram_id, p_course_slug, 0, 1, public.next_course_unlock(c.timezone, c.unlock_hour)
  ) returning * into new_a;

  insert into public.course_progress_events(attempt_id, telegram_id, course_slug, step_number, event_type)
  values (new_a.id, p_telegram_id, p_course_slug, 1, 'started');

  return new_a;
end;
$$;


-- Do not expose the state-changing RPCs to public Supabase roles.
revoke all on function public.start_course(bigint, text) from public, anon, authenticated;
revoke all on function public.complete_current_step(bigint, text) from public, anon, authenticated;
revoke all on function public.restart_course(bigint, text) from public, anon, authenticated;
grant execute on function public.start_course(bigint, text) to service_role;
grant execute on function public.complete_current_step(bigint, text) to service_role;
grant execute on function public.restart_course(bigint, text) to service_role;

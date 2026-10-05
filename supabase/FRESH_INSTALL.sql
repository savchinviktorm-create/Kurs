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

-- Platform v2: admin CMS, spaces/storefronts, localization, media, imports and flexible pricing.
-- Safe to run on top of the original 001_initial.sql. Existing users/progress/payments are preserved.

create extension if not exists pgcrypto;

alter table public.courses add column if not exists description text;
alter table public.courses add column if not exists cover_path text;
alter table public.courses add column if not exists included_in_subscription boolean not null default true;
alter table public.courses add column if not exists first_step_immediate boolean not null default true;
alter table public.courses add column if not exists allow_previous_steps boolean not null default false;
alter table public.courses add column if not exists max_steps_per_day integer not null default 1 check (max_steps_per_day >= 1);
alter table public.courses add column if not exists default_locale text not null default 'uk';
alter table public.courses add column if not exists available_locales text[] not null default array['uk']::text[];
alter table public.courses add column if not exists protection_level text not null default 'standard' check (protection_level in ('standard','enhanced','maximum'));
alter table public.courses add column if not exists settings jsonb not null default '{}'::jsonb;

create table if not exists public.course_locales (
  course_slug text not null references public.courses(slug) on delete cascade,
  locale text not null,
  title text not null,
  short_title text not null,
  description text,
  intro_text text not null,
  logo_path text,
  cover_path text,
  is_published boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (course_slug, locale)
);

create table if not exists public.course_step_locales (
  course_slug text not null,
  step_number integer not null,
  locale text not null,
  title text not null,
  content text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (course_slug, step_number, locale),
  foreign key (course_slug, step_number) references public.course_steps(course_slug, step_number) on delete cascade
);

create table if not exists public.spaces (
  slug text primary key,
  title text not null,
  short_title text not null,
  description text,
  logo_path text,
  cover_path text,
  default_locale text not null default 'uk',
  allowed_locales text[] not null default array['uk','ru']::text[],
  locale_policy text not null default 'fallback' check (locale_policy in ('fallback','hide_missing')),
  theme jsonb not null default '{"mode":"light","accent":"gold"}'::jsonb,
  support_config jsonb not null default '{}'::jsonb,
  subscription_plan_key text not null default 'all-access',
  is_default boolean not null default false,
  is_published boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index if not exists one_default_space on public.spaces ((is_default)) where is_default = true;

create table if not exists public.space_locales (
  space_slug text not null references public.spaces(slug) on delete cascade,
  locale text not null,
  title text not null,
  short_title text not null,
  description text,
  hero_text text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (space_slug, locale)
);

create table if not exists public.space_courses (
  space_slug text not null references public.spaces(slug) on delete cascade,
  course_slug text not null references public.courses(slug) on delete cascade,
  is_visible boolean not null default true,
  sort_order integer not null default 100,
  price_override_stars integer check (price_override_stars is null or price_override_stars > 0),
  access_override text check (access_override is null or access_override in ('free','paid')),
  included_in_subscription_override boolean,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (space_slug, course_slug)
);

create table if not exists public.user_preferences (
  telegram_id bigint primary key references public.users(telegram_id) on delete cascade,
  locale text,
  last_space_slug text references public.spaces(slug) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.admin_users (
  telegram_id bigint primary key,
  role text not null check (role in ('owner','admin','editor','support','analyst')),
  permissions jsonb not null default '{}'::jsonb,
  enabled boolean not null default true,
  label text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.subscription_plans (
  plan_key text primary key,
  title text not null,
  price_stars integer not null check (price_stars > 0),
  period_seconds integer not null default 2592000 check (period_seconds > 0),
  is_recurring boolean not null default true,
  is_enabled boolean not null default true,
  settings jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.media_providers (
  provider_key text primary key,
  display_name text not null,
  provider_type text not null,
  delivery_type text not null check (delivery_type in ('supabase','youtube','vimeo','cloudflare_stream','bunny_stream','s3','direct','iframe','hls','dash')),
  config jsonb not null default '{}'::jsonb,
  secret_env_prefix text,
  is_enabled boolean not null default true,
  sort_order integer not null default 100,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.media_assets (
  id uuid primary key default gen_random_uuid(),
  provider_key text not null references public.media_providers(provider_key) on delete restrict,
  media_type text not null check (media_type in ('video','audio','pdf','image','file')),
  title text not null,
  source_locator text not null,
  mime_type text,
  size_bytes bigint,
  duration_seconds integer,
  poster_url text,
  protection_level text not null default 'enhanced' check (protection_level in ('standard','enhanced','maximum')),
  watermark_enabled boolean not null default true,
  metadata jsonb not null default '{}'::jsonb,
  status text not null default 'ready' check (status in ('draft','processing','ready','error','archived')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.course_step_blocks (
  id uuid primary key default gen_random_uuid(),
  course_slug text not null,
  step_number integer not null,
  locale text,
  block_type text not null check (block_type in ('text','video','audio','pdf','image','file','link','quote','checklist','quiz','divider')),
  sort_order integer not null default 100,
  title text,
  body text,
  media_asset_id uuid references public.media_assets(id) on delete set null,
  config jsonb not null default '{}'::jsonb,
  is_published boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  foreign key (course_slug, step_number) references public.course_steps(course_slug, step_number) on delete cascade
);

create index if not exists blocks_step_idx on public.course_step_blocks(course_slug, step_number, locale, sort_order);

create table if not exists public.course_step_interactions (
  id uuid primary key default gen_random_uuid(),
  attempt_id uuid not null references public.course_attempts(id) on delete cascade,
  telegram_id bigint not null references public.users(telegram_id) on delete cascade,
  course_slug text not null references public.courses(slug) on delete cascade,
  step_number integer not null,
  block_id uuid not null references public.course_step_blocks(id) on delete cascade,
  interaction_type text not null check (interaction_type in ('quiz','checklist')),
  state jsonb not null default '{}'::jsonb,
  completed boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(attempt_id, block_id)
);

create index if not exists course_step_interactions_attempt_idx on public.course_step_interactions(attempt_id, step_number);
create index if not exists course_step_interactions_user_idx on public.course_step_interactions(telegram_id, course_slug);
create index if not exists media_provider_idx on public.media_assets(provider_key, status);

create table if not exists public.course_versions (
  id uuid primary key default gen_random_uuid(),
  course_slug text not null references public.courses(slug) on delete cascade,
  version_label text not null,
  status text not null default 'draft' check (status in ('draft','published','archived')),
  manifest jsonb not null default '{}'::jsonb,
  created_by bigint,
  published_at timestamptz,
  created_at timestamptz not null default now(),
  unique (course_slug, version_label)
);

alter table public.course_attempts add column if not exists course_version_id uuid references public.course_versions(id) on delete set null;

create table if not exists public.course_imports (
  id uuid primary key default gen_random_uuid(),
  imported_by bigint not null,
  source_name text not null,
  course_slug text,
  status text not null default 'processing' check (status in ('processing','ready','error')),
  report jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  finished_at timestamptz
);

create table if not exists public.share_events (
  id uuid primary key default gen_random_uuid(),
  telegram_id bigint references public.users(telegram_id) on delete set null,
  space_slug text references public.spaces(slug) on delete set null,
  course_slug text references public.courses(slug) on delete set null,
  step_number integer,
  share_code text unique not null,
  opened_count integer not null default 0,
  created_at timestamptz not null default now()
);

create table if not exists public.app_settings (
  key text primary key,
  value jsonb not null,
  updated_at timestamptz not null default now()
);

create table if not exists public.audit_log (
  id bigserial primary key,
  admin_telegram_id bigint,
  action text not null,
  entity_type text,
  entity_id text,
  details jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

-- Private media bucket. Service role can upload; end users receive only short-lived signed links.
insert into storage.buckets (id, name, public)
values ('course-media', 'course-media', false)
on conflict (id) do update set public = false;

-- Public brand assets (course/Space logos and covers). Protected lesson media stays in course-media.
insert into storage.buckets (id, name, public)
values ('course-public', 'course-public', true)
on conflict (id) do update set public = true;

-- Seed the current/default storefront and admin accounts supplied by the owner.
insert into public.spaces(slug, title, short_title, description, default_locale, allowed_locales, is_default, is_published)
values ('pkk', 'Простір корисного контенту', 'Простір', 'Курси та практики Простору корисного контенту', 'uk', array['uk','ru']::text[], true, true)
on conflict (slug) do update set is_default = true, updated_at = now();

insert into public.space_locales(space_slug, locale, title, short_title, description, hero_text)
values
  ('pkk','uk','Простір корисного контенту','Простір','Курси та практики Простору корисного контенту','Ваші курси, прогрес і доступи зберігаються у Telegram-профілі.'),
  ('pkk','ru','Пространство полезного контента','Пространство','Курсы и практики Пространства полезного контента','Ваши курсы, прогресс и доступы сохраняются в Telegram-профиле.')
on conflict (space_slug, locale) do nothing;

insert into public.space_courses(space_slug, course_slug, sort_order)
select 'pkk', slug, sort_order from public.courses
on conflict (space_slug, course_slug) do nothing;

insert into public.subscription_plans(plan_key, title, price_stars, period_seconds, is_recurring, is_enabled)
values ('all-access','Усі платні курси',49,2592000,true,true)
on conflict (plan_key) do nothing;

insert into public.admin_users(telegram_id, role, label) values
  (653398188, 'owner', 'Основний власник'),
  (7527010484, 'admin', 'Тестовий адміністратор 1'),
  (8557032404, 'admin', 'Тестовий адміністратор 2')
on conflict (telegram_id) do update set enabled = true, role = excluded.role, label = excluded.label, updated_at = now();

insert into public.media_providers(provider_key, display_name, provider_type, delivery_type, config, secret_env_prefix, sort_order) values
  ('supabase','Supabase Storage','storage','supabase','{"bucket":"course-media"}'::jsonb,'MEDIA_SUPABASE',10),
  ('youtube','YouTube','video','youtube','{}'::jsonb,null,20),
  ('vimeo','Vimeo','video','vimeo','{}'::jsonb,null,30),
  ('cloudflare-stream','Cloudflare Stream','video','cloudflare_stream','{}'::jsonb,'MEDIA_CF_STREAM',40),
  ('bunny-stream','Bunny Stream','video','bunny_stream','{}'::jsonb,'MEDIA_BUNNY_STREAM',50),
  ('s3-main','S3 compatible storage','storage','s3','{}'::jsonb,'MEDIA_S3_MAIN',60),
  ('direct','Direct HTTPS / MP4 / MP3 / PDF','generic','direct','{}'::jsonb,null,80),
  ('iframe','External embedded player','generic','iframe','{}'::jsonb,null,90),
  ('hls','HLS stream','video','hls','{}'::jsonb,null,100),
  ('dash','MPEG-DASH stream','video','dash','{}'::jsonb,null,110)
on conflict (provider_key) do nothing;

insert into public.app_settings(key, value) values
  ('default_space_slug','"pkk"'::jsonb),
  ('support','{"enabled":false,"type":"telegram_bot","value":""}'::jsonb),
  ('telegram','{"bot_username":"Kurs91bot","mini_app_short_name":"tzmin","direct_link":"https://t.me/Kurs91bot/tzmin"}'::jsonb),
  ('donation_options','[10,25,50,100]'::jsonb)
on conflict (key) do nothing;

-- Mirror the current Ukrainian source into localization tables without changing the author's text.
insert into public.course_locales(course_slug, locale, title, short_title, intro_text, logo_path, cover_path, is_published)
select slug, 'uk', title, short_title, intro_text, logo_path, cover_path, is_published
from public.courses
on conflict (course_slug, locale) do nothing;

insert into public.course_step_locales(course_slug, step_number, locale, title, content)
select course_slug, step_number, 'uk', title, content
from public.course_steps
on conflict (course_slug, step_number, locale) do nothing;

-- First step is available immediately. Subsequent steps still unlock on the next course day at the configured hour.
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
    p_telegram_id, p_course_slug, 0, 1,
    case when c.first_step_immediate then now() else public.next_course_unlock(c.timezone, c.unlock_hour) end
  ) returning * into a;

  insert into public.course_progress_events(attempt_id, telegram_id, course_slug, step_number, event_type)
  values (a.id, p_telegram_id, p_course_slug, 1, 'started');

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
    p_telegram_id, p_course_slug, 0, 1,
    case when c.first_step_immediate then now() else public.next_course_unlock(c.timezone, c.unlock_hour) end
  ) returning * into new_a;

  insert into public.course_progress_events(attempt_id, telegram_id, course_slug, step_number, event_type)
  values (new_a.id, p_telegram_id, p_course_slug, 1, 'started');

  return new_a;
end;
$$;

-- Generic pacing: by default one step per course day; future courses may allow more via max_steps_per_day.
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
  completed_today integer := 0;
  local_day_start timestamptz;
  local_day_end timestamptz;
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
    local_day_start := (((now() at time zone c.timezone)::date)::timestamp at time zone c.timezone);
    local_day_end := ((((now() at time zone c.timezone)::date + 1)::timestamp) at time zone c.timezone);
    select count(*)::integer into completed_today
      from public.course_progress_events
      where attempt_id = a.id and event_type = 'completed'
        and created_at >= local_day_start and created_at < local_day_end;

    update public.course_attempts
      set completed_steps = completed_number,
          current_step = completed_number + 1,
          next_unlock_at = case
            when greatest(c.max_steps_per_day, 1) > (completed_today + 1) then now()
            else public.next_course_unlock(c.timezone, c.unlock_hour)
          end,
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

-- Already-started users who have not completed step 1 are unblocked immediately.
update public.course_attempts
set next_unlock_at = now(), updated_at = now()
where status = 'active' and completed_steps = 0 and current_step = 1 and next_unlock_at > now();

-- Server-only tables/API. Keep RLS enabled and no anon policies.
alter table public.course_locales enable row level security;
alter table public.course_step_locales enable row level security;
alter table public.spaces enable row level security;
alter table public.space_locales enable row level security;
alter table public.space_courses enable row level security;
alter table public.user_preferences enable row level security;
alter table public.admin_users enable row level security;
alter table public.subscription_plans enable row level security;
alter table public.media_providers enable row level security;
alter table public.media_assets enable row level security;
alter table public.course_step_blocks enable row level security;
alter table public.course_step_interactions enable row level security;
alter table public.course_versions enable row level security;
alter table public.course_imports enable row level security;
alter table public.share_events enable row level security;
alter table public.app_settings enable row level security;
alter table public.audit_log enable row level security;

revoke all on function public.start_course(bigint, text) from public, anon, authenticated;
revoke all on function public.restart_course(bigint, text) from public, anon, authenticated;
revoke all on function public.complete_current_step(bigint, text) from public, anon, authenticated;
grant execute on function public.start_course(bigint, text) to service_role;
grant execute on function public.restart_course(bigint, text) to service_role;
grant execute on function public.complete_current_step(bigint, text) to service_role;


-- Platform v2.2: completion certificates + configurable free trial access.
-- Safe additive migration for an existing v2/v2.1 database.

alter table public.courses add column if not exists trial_enabled boolean not null default false;
alter table public.courses add column if not exists trial_days integer not null default 3 check (trial_days between 1 and 365);
alter table public.courses add column if not exists trial_max_steps integer check (trial_max_steps is null or trial_max_steps > 0);
alter table public.courses add column if not exists certificate_enabled boolean not null default false;
alter table public.courses add column if not exists certificate_settings jsonb not null default '{"verification_enabled":true,"signatory_name":"","signatory_title":"","subtitle":"Сертифікат про завершення курсу"}'::jsonb;

create table if not exists public.course_trials (
  id uuid primary key default gen_random_uuid(),
  telegram_id bigint not null references public.users(telegram_id) on delete cascade,
  course_slug text not null references public.courses(slug) on delete cascade,
  source_space_slug text references public.spaces(slug) on delete set null,
  status text not null default 'active' check (status in ('active','expired','converted')),
  started_at timestamptz not null default now(),
  ends_at timestamptz not null,
  max_steps integer check (max_steps is null or max_steps > 0),
  converted_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (telegram_id, course_slug)
);

create index if not exists course_trials_user_idx on public.course_trials(telegram_id, status, ends_at);
create index if not exists course_trials_course_idx on public.course_trials(course_slug, status);

create table if not exists public.course_certificates (
  id uuid primary key default gen_random_uuid(),
  certificate_number text not null unique,
  verification_code text not null unique,
  telegram_id bigint not null references public.users(telegram_id) on delete cascade,
  course_slug text not null references public.courses(slug) on delete cascade,
  attempt_id uuid not null references public.course_attempts(id) on delete cascade,
  space_slug text references public.spaces(slug) on delete set null,
  full_name text not null,
  course_title_snapshot text not null,
  brand_title_snapshot text not null default 'Простір практичного контенту',
  locale text not null default 'uk',
  completed_at timestamptz not null,
  issued_at timestamptz not null default now(),
  status text not null default 'issued' check (status in ('issued','revoked')),
  metadata jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now(),
  unique (attempt_id)
);

create index if not exists course_certificates_user_idx on public.course_certificates(telegram_id, issued_at desc);
create index if not exists course_certificates_course_idx on public.course_certificates(course_slug, issued_at desc);

alter table public.course_trials enable row level security;
alter table public.course_certificates enable row level security;

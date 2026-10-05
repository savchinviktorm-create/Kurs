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

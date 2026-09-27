-- Platform v2.1: interactive course blocks, persistent quiz/checklist state.

alter table public.course_step_blocks
  drop constraint if exists course_step_blocks_block_type_check;

alter table public.course_step_blocks
  add constraint course_step_blocks_block_type_check
  check (block_type in ('text','video','audio','pdf','image','file','link','quote','checklist','quiz','divider'));

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

create index if not exists course_step_interactions_attempt_idx
  on public.course_step_interactions(attempt_id, step_number);
create index if not exists course_step_interactions_user_idx
  on public.course_step_interactions(telegram_id, course_slug);

alter table public.course_step_interactions enable row level security;

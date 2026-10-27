-- ==============================================================================
-- F to A MaxouT Project - Student Weekly Time Slot Scheduling Table
-- ==============================================================================
-- Conducted 6 days a week (Monday to Saturday, Sunday off) across 3 daily batches:
--   - Batch 1: 4.30 PM - 6.00 PM
--   - Batch 2: 8.00 PM - 9.30 PM
--   - Batch 3: 9.30 PM - 11.00 PM
--
-- This table tracks the recurring weekly time slot for each student or their
-- absence reason if they cannot attend on a specific day.
-- ==============================================================================

create table if not exists public.student_maxout_slots (
  id uuid not null default gen_random_uuid(),
  pcaid text not null,
  day_of_week text not null,
  status text not null default 'attending',
  slot text null,
  reason text null,
  notes text null,
  created_at timestamp with time zone not null default timezone('utc'::text, now()),
  updated_at timestamp with time zone not null default timezone('utc'::text, now()),
  
  -- Primary key on id
  constraint student_maxout_slots_pkey primary key (id),
  
  -- Foreign key linking to student (pcaid)
  constraint fk_student_maxout_pcaid 
    foreign key (pcaid) 
    references public.student(pcaid) 
    on update cascade 
    on delete cascade,

  -- Unique constraint ensures only 1 recurring schedule entry per day per student
  constraint uq_student_maxout_pcaid_day 
    unique (pcaid, day_of_week),

  -- Validate allowed days (Monday to Saturday)
  constraint chk_maxout_day_of_week 
    check (day_of_week in ('Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday')),

  -- Validate status
  constraint chk_maxout_status 
    check (status in ('attending', 'cannot_attend'))
) TABLESPACE pg_default;

-- Fast index by PCA ID
create index if not exists idx_student_maxout_pcaid 
  on public.student_maxout_slots using btree (pcaid);

-- Fast index by day of week
create index if not exists idx_student_maxout_day 
  on public.student_maxout_slots using btree (day_of_week);

-- Enable Row Level Security (RLS) if required by Supabase project
alter table public.student_maxout_slots enable row level security;

-- Permissive policy for authenticated / anon users (adjust to your project setup)
create policy "Allow all access to student_maxout_slots"
  on public.student_maxout_slots
  for all
  using (true)
  with check (true);

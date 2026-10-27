-- ==============================================================================
-- Table: public.student_maxout_slots
-- Purpose: Store recurring weekly slot selections and non-attendance reasons
--          for the 'F to A MaxouT Project' class.
-- Schedule: 6 Days (Monday through Saturday, Sunday off)
-- Daily Batches:
--   - Batch 1: 4.30 PM - 6.00 PM
--   - Batch 2: 8.00 PM - 9.30 PM
--   - Batch 3: 9.30 PM - 11.00 PM
-- ==============================================================================

CREATE TABLE IF NOT EXISTS public.student_maxout_slots (
    id UUID NOT NULL DEFAULT gen_random_uuid(),
    pcaid TEXT NOT NULL,
    student_name TEXT NULL,
    day_of_week TEXT NOT NULL, -- 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'
    status TEXT NOT NULL DEFAULT 'attending', -- 'attending' | 'cannot_attend'
    slot TEXT NULL, -- 'Batch 1: 4.30 PM - 6.00 PM' | 'Batch 2: 8.00 PM - 9.30 PM' | 'Batch 3: 9.30 PM - 11.00 PM'
    reason TEXT NULL,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT timezone('utc'::TEXT, now()),
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT timezone('utc'::TEXT, now()),
    CONSTRAINT student_maxout_slots_pkey PRIMARY KEY (id),
    CONSTRAINT student_maxout_slots_unique UNIQUE (pcaid, day_of_week),
    CONSTRAINT student_maxout_slots_pcaid_fkey FOREIGN KEY (pcaid) REFERENCES public.student(pcaid) ON DELETE CASCADE ON UPDATE CASCADE
) TABLESPACE pg_default;

-- Create Indexes for fast querying & aggregation
CREATE INDEX IF NOT EXISTS idx_student_maxout_slots_pcaid ON public.student_maxout_slots (pcaid);
CREATE INDEX IF NOT EXISTS idx_student_maxout_slots_day ON public.student_maxout_slots (day_of_week);
CREATE INDEX IF NOT EXISTS idx_student_maxout_slots_slot ON public.student_maxout_slots (slot);
CREATE INDEX IF NOT EXISTS idx_student_maxout_slots_status ON public.student_maxout_slots (status);

-- Enable Row Level Security (RLS)
ALTER TABLE public.student_maxout_slots ENABLE ROW LEVEL SECURITY;

-- Allow public / student / admin access to read, insert, and update
DROP POLICY IF EXISTS "Allow select student_maxout_slots" ON public.student_maxout_slots;
CREATE POLICY "Allow select student_maxout_slots"
ON public.student_maxout_slots FOR SELECT USING (true);

DROP POLICY IF EXISTS "Allow insert student_maxout_slots" ON public.student_maxout_slots;
CREATE POLICY "Allow insert student_maxout_slots"
ON public.student_maxout_slots FOR INSERT WITH CHECK (true);

DROP POLICY IF EXISTS "Allow update student_maxout_slots" ON public.student_maxout_slots;
CREATE POLICY "Allow update student_maxout_slots"
ON public.student_maxout_slots FOR UPDATE USING (true);

DROP POLICY IF EXISTS "Allow delete student_maxout_slots" ON public.student_maxout_slots;
CREATE POLICY "Allow delete student_maxout_slots"
ON public.student_maxout_slots FOR DELETE USING (true);

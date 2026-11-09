-- ==============================================================================
-- Table: public.student_attendance
-- Purpose: Store per-student attendance records from Zoom webinar/meeting sessions
--          supporting multi-batch slot tracking, reconnect count, and duration.
-- ==============================================================================

CREATE TABLE IF NOT EXISTS public.student_attendance (
    id UUID NOT NULL DEFAULT gen_random_uuid(),
    pcaid TEXT NOT NULL,
    webinar_id TEXT NOT NULL,
    session_title TEXT NOT NULL,
    session_date DATE NOT NULL,
    class_type TEXT NOT NULL,
    target_batch TEXT NOT NULL,
    batch_slot TEXT NULL, -- 'Batch 1' | 'Batch 2' | 'Batch 3' | NULL
    session_duration_minutes INTEGER NOT NULL DEFAULT 90,
    attended_minutes INTEGER NOT NULL DEFAULT 0,
    attendance_percentage NUMERIC(5, 2) NOT NULL DEFAULT 0.00,
    status TEXT NOT NULL DEFAULT 'absent', -- 'present' | 'partial' | 'absent' | 'excused'
    reconnect_count INTEGER NOT NULL DEFAULT 0,
    first_join_time TIMESTAMP WITH TIME ZONE NULL,
    last_leave_time TIMESTAMP WITH TIME ZONE NULL,
    excuse_reason TEXT NULL,
    synced_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT timezone('utc'::TEXT, now()),
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT timezone('utc'::TEXT, now()),
    
    CONSTRAINT student_attendance_pkey PRIMARY KEY (id),
    CONSTRAINT student_attendance_unique_session UNIQUE (pcaid, webinar_id, session_date, batch_slot),
    CONSTRAINT fk_student_attendance_pcaid FOREIGN KEY (pcaid) REFERENCES public.student(pcaid) ON DELETE CASCADE ON UPDATE CASCADE
) TABLESPACE pg_default;

-- Create Indexes for fast querying, filtering, and reporting
CREATE INDEX IF NOT EXISTS idx_student_attendance_pcaid ON public.student_attendance (pcaid);
CREATE INDEX IF NOT EXISTS idx_student_attendance_webinar ON public.student_attendance (webinar_id);
CREATE INDEX IF NOT EXISTS idx_student_attendance_date ON public.student_attendance (session_date);
CREATE INDEX IF NOT EXISTS idx_student_attendance_class_type ON public.student_attendance (class_type);
CREATE INDEX IF NOT EXISTS idx_student_attendance_batch_slot ON public.student_attendance (batch_slot);
CREATE INDEX IF NOT EXISTS idx_student_attendance_status ON public.student_attendance (status);

-- ==============================================================================
-- Row Level Security (RLS) Configuration
-- ==============================================================================
-- Enable RLS
ALTER TABLE public.student_attendance ENABLE ROW LEVEL SECURITY;

-- Allow unrestricted SELECT so dashboards and attendance viewers can query records
DROP POLICY IF EXISTS "Allow select student_attendance" ON public.student_attendance;
CREATE POLICY "Allow select student_attendance"
ON public.student_attendance FOR SELECT USING (true);

-- Allow INSERT / UPSERT for attendance synchronization
DROP POLICY IF EXISTS "Allow insert student_attendance" ON public.student_attendance;
CREATE POLICY "Allow insert student_attendance"
ON public.student_attendance FOR INSERT WITH CHECK (true);

-- Allow UPDATE for manual attendance status overrides & excuse reasons
DROP POLICY IF EXISTS "Allow update student_attendance" ON public.student_attendance;
CREATE POLICY "Allow update student_attendance"
ON public.student_attendance FOR UPDATE USING (true);

-- Allow DELETE for removing duplicate or test attendance records
DROP POLICY IF EXISTS "Allow delete student_attendance" ON public.student_attendance;
CREATE POLICY "Allow delete student_attendance"
ON public.student_attendance FOR DELETE USING (true);

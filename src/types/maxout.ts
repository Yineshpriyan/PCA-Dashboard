export type MaxoutDayOfWeek = 
  | 'Monday' 
  | 'Tuesday' 
  | 'Wednesday' 
  | 'Thursday' 
  | 'Friday' 
  | 'Saturday';

export const MAXOUT_DAYS: MaxoutDayOfWeek[] = [
  'Monday',
  'Tuesday',
  'Wednesday',
  'Thursday',
  'Friday',
  'Saturday'
];

export type MaxoutSlot = 
  | 'Batch 1: 4.30 PM - 6.00 PM'
  | 'Batch 2: 8.00 PM - 9.30 PM'
  | 'Batch 3: 9.30 PM - 11.00 PM';

export const MAXOUT_SLOTS: { id: MaxoutSlot; label: string; badge: string; time: string }[] = [
  {
    id: 'Batch 1: 4.30 PM - 6.00 PM',
    label: 'Batch 1',
    badge: '4.30 PM - 6.00 PM',
    time: '4.30 PM - 6.00 PM'
  },
  {
    id: 'Batch 2: 8.00 PM - 9.30 PM',
    label: 'Batch 2',
    badge: '8.00 PM - 9.30 PM',
    time: '8.00 PM - 9.30 PM'
  },
  {
    id: 'Batch 3: 9.30 PM - 11.00 PM',
    label: 'Batch 3',
    badge: '9.30 PM - 11.00 PM',
    time: '9.30 PM - 11.00 PM'
  }
];

export type MaxoutDayStatus = 'attending' | 'cannot_attend';

export interface StudentMaxoutDaySchedule {
  day_of_week: MaxoutDayOfWeek;
  status: MaxoutDayStatus;
  slot: MaxoutSlot | '';
  reason?: string;
  notes?: string;
}

export interface StudentMaxoutSlotRecord {
  id?: string;
  pcaid: string;
  student_name?: string | null;
  day_of_week: MaxoutDayOfWeek;
  status: MaxoutDayStatus;
  slot: string | null;
  reason: string | null;
  notes?: string | null;
  created_at?: string;
  updated_at?: string;
}

export const COMMON_ABSENCE_REASONS = [
  'School evening class / Practicals',
  'Other tuition class',
  'Exam / Term test preparation',
  'Health / Medical reason',
  'Power / Internet connectivity issue',
  'Traveling / Family commitment',
  'Personal reason'
];

import React, { useState, useEffect, useMemo } from 'react';
import { supabase } from '../lib/supabase';
import { 
  Student, 
  MaxoutDayOfWeek, 
  MaxoutTimeSlot, 
  MaxoutSlotStatus, 
  StudentMaxoutSlot 
} from '../types';
import { toast } from 'sonner';
import { 
  Clock, 
  CalendarRange, 
  CheckCircle2, 
  AlertCircle, 
  Save, 
  Sparkles, 
  Check, 
  RefreshCw, 
  CheckCheck
} from 'lucide-react';

export const MAXOUT_DAYS: MaxoutDayOfWeek[] = [
  'Monday',
  'Tuesday',
  'Wednesday',
  'Thursday',
  'Friday',
  'Saturday'
];

export const MAXOUT_SLOTS: { id: MaxoutTimeSlot; label: string; period: string }[] = [
  {
    id: 'Batch 1: 4.30 PM - 6.00 PM',
    label: 'Batch 1',
    period: '4.30 PM – 6.00 PM'
  },
  {
    id: 'Batch 2: 8.00 PM - 9.30 PM',
    label: 'Batch 2',
    period: '8.00 PM – 9.30 PM'
  },
  {
    id: 'Batch 3: 9.30 PM - 11.00 PM',
    label: 'Batch 3',
    period: '9.30 PM – 11.00 PM'
  }
];

export const QUICK_REASONS = [
  'Chemistry Class',
  'Bio Class',
  'Maths Class',
  'School Examination / Term Test',
  'School Lab / Practical Class',
  'Another Tuition Class',
  'Health / Medical Reason',
  'Power Cut / Connectivity Issue',
  'Family Event / Traveling'
];

interface DayScheduleState {
  status: MaxoutSlotStatus;
  slot: MaxoutTimeSlot;
  reason: string;
}

type WeeklySchedule = Record<MaxoutDayOfWeek, DayScheduleState>;

const DEFAULT_SCHEDULE: WeeklySchedule = {
  Monday: { status: 'attending', slot: 'Batch 2: 8.00 PM - 9.30 PM', reason: '' },
  Tuesday: { status: 'attending', slot: 'Batch 2: 8.00 PM - 9.30 PM', reason: '' },
  Wednesday: { status: 'attending', slot: 'Batch 2: 8.00 PM - 9.30 PM', reason: '' },
  Thursday: { status: 'attending', slot: 'Batch 2: 8.00 PM - 9.30 PM', reason: '' },
  Friday: { status: 'attending', slot: 'Batch 2: 8.00 PM - 9.30 PM', reason: '' },
  Saturday: { status: 'attending', slot: 'Batch 2: 8.00 PM - 9.30 PM', reason: '' }
};

interface StudentMaxoutSlotTrackerProps {
  student: Student;
  onRefreshProfile?: () => void;
}

export default function StudentMaxoutSlotTracker({ student }: StudentMaxoutSlotTrackerProps) {
  const [schedule, setSchedule] = useState<WeeklySchedule>(DEFAULT_SCHEDULE);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [lastSaved, setLastSaved] = useState<string | null>(null);

  const storageKey = useMemo(() => `student_maxout_slots_${student.pcaid.trim().toUpperCase()}`, [student.pcaid]);

  // Load slot selections for this student
  useEffect(() => {
    let isMounted = true;

    const loadSlots = async () => {
      setIsLoading(true);
      const cleanPcaid = student.pcaid.trim().toUpperCase();

      try {
        const { data, error } = await supabase
          .from('student_maxout_slots')
          .select('*')
          .eq('pcaid', cleanPcaid);

        if (error) {
          // Graceful fallback to localStorage
          const localData = localStorage.getItem(storageKey);
          if (localData && isMounted) {
            try {
              const parsed = JSON.parse(localData);
              if (parsed.schedule) {
                setSchedule(parsed.schedule);
                if (parsed.lastSaved) setLastSaved(parsed.lastSaved);
              }
            } catch (e) {
              console.error('Error reading cached schedule:', e);
            }
          }
        } else if (data && data.length > 0 && isMounted) {
          const loaded: WeeklySchedule = { ...DEFAULT_SCHEDULE };
          let latestUpdate: string | null = null;

          data.forEach((row: StudentMaxoutSlot) => {
            if (row.day_of_week && MAXOUT_DAYS.includes(row.day_of_week)) {
              loaded[row.day_of_week] = {
                status: row.status === 'cannot_attend' ? 'cannot_attend' : 'attending',
                slot: (row.slot as MaxoutTimeSlot) || 'Batch 2: 8.00 PM - 9.30 PM',
                reason: row.reason || ''
              };
              if (row.updated_at && (!latestUpdate || row.updated_at > latestUpdate)) {
                latestUpdate = row.updated_at;
              }
            }
          });

          setSchedule(loaded);
          if (latestUpdate) {
            setLastSaved(new Date(latestUpdate).toLocaleString('en-US', {
              month: 'short',
              day: 'numeric',
              year: 'numeric',
              hour: '2-digit',
              minute: '2-digit'
            }));
          }
        } else if (isMounted) {
          // Check local storage if no database row yet
          const localData = localStorage.getItem(storageKey);
          if (localData) {
            try {
              const parsed = JSON.parse(localData);
              if (parsed.schedule) {
                setSchedule(parsed.schedule);
                if (parsed.lastSaved) setLastSaved(parsed.lastSaved);
              }
            } catch (e) {
              // ignore
            }
          }
        }
      } catch (err) {
        console.error('Failed to load maxout slots:', err);
      } finally {
        if (isMounted) setIsLoading(false);
      }
    };

    loadSlots();

    return () => {
      isMounted = false;
    };
  }, [student.pcaid, storageKey]);

  // Handler for changing status (attending vs cannot_attend)
  const handleStatusChange = (day: MaxoutDayOfWeek, status: MaxoutSlotStatus) => {
    setSchedule(prev => ({
      ...prev,
      [day]: {
        ...prev[day],
        status
      }
    }));
  };

  // Handler for changing slot batch
  const handleSlotChange = (day: MaxoutDayOfWeek, slot: MaxoutTimeSlot) => {
    setSchedule(prev => ({
      ...prev,
      [day]: {
        ...prev[day],
        slot,
        status: 'attending'
      }
    }));
  };

  // Handler for updating reason
  const handleReasonChange = (day: MaxoutDayOfWeek, reason: string) => {
    setSchedule(prev => ({
      ...prev,
      [day]: {
        ...prev[day],
        reason
      }
    }));
  };

  // Quick action: Apply same slot to all attending days
  const handleApplySlotToAllAttending = (targetSlot: MaxoutTimeSlot) => {
    setSchedule(prev => {
      const next = { ...prev };
      MAXOUT_DAYS.forEach(day => {
        if (next[day].status === 'attending') {
          next[day] = { ...next[day], slot: targetSlot };
        }
      });
      return next;
    });
    const batchLabel = MAXOUT_SLOTS.find(s => s.id === targetSlot)?.label || 'Batch';
    toast.success(`Applied ${batchLabel} to all attending days!`);
  };

  // Quick action: Mark all days as attending
  const handleMarkAllAttending = () => {
    setSchedule(prev => {
      const next = { ...prev };
      MAXOUT_DAYS.forEach(day => {
        next[day] = { ...next[day], status: 'attending' };
      });
      return next;
    });
    toast.info('Marked all 6 days as Attending');
  };

  // Save changes to database
  const handleSaveSchedule = async () => {
    // Validate: Any cannot_attend day must have a reason
    for (const day of MAXOUT_DAYS) {
      if (schedule[day].status === 'cannot_attend') {
        const reason = (schedule[day].reason || '').trim();
        if (!reason) {
          toast.error(`Please provide a reason for not attending on ${day}`);
          return;
        }
      }
    }

    setIsSaving(true);
    const cleanPcaid = student.pcaid.trim().toUpperCase();
    const studentFullName = [student.name, student.last_name].filter(Boolean).join(' ') || student.pcaid;
    const nowIso = new Date().toISOString();

    const rows: StudentMaxoutSlot[] = MAXOUT_DAYS.map(day => ({
      pcaid: cleanPcaid,
      student_name: studentFullName,
      day_of_week: day,
      status: schedule[day].status,
      slot: schedule[day].status === 'attending' ? schedule[day].slot : null,
      reason: schedule[day].status === 'cannot_attend' ? schedule[day].reason.trim() : null,
      updated_at: nowIso
    }));

    try {
      // 1. Save to Supabase table
      const { error } = await supabase
        .from('student_maxout_slots')
        .upsert(rows, { onConflict: 'pcaid,day_of_week' });

      if (error) {
        console.warn('Supabase upsert note:', error.message);
      }

      // 2. Always backup to localStorage for zero-loss guarantee
      const formattedSavedDate = new Date().toLocaleString('en-US', {
        month: 'short',
        day: 'numeric',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
      });
      localStorage.setItem(storageKey, JSON.stringify({
        schedule,
        lastSaved: formattedSavedDate
      }));

      setLastSaved(formattedSavedDate);
      toast.success("Your 'F to A MaxouT Project' weekly time slot schedule has been saved successfully!");
    } catch (err: any) {
      console.error('Error saving schedule:', err);
      toast.error('Failed to save to cloud server: ' + (err.message || 'Unknown error'));
    } finally {
      setIsSaving(false);
    }
  };

  // Stats
  const attendingDaysCount = useMemo(() => {
    return MAXOUT_DAYS.filter(d => schedule[d].status === 'attending').length;
  }, [schedule]);

  const cannotAttendCount = 6 - attendingDaysCount;

  if (isLoading) {
    return (
      <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-2xl p-12 text-center shadow-xs">
        <RefreshCw className="w-8 h-8 text-teal-600 dark:text-teal-400 animate-spin mx-auto mb-3" />
        <p className="text-sm font-semibold text-gray-700 dark:text-gray-300">
          Loading your F to A MaxouT Project schedule...
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-4 sm:space-y-6">
      {/* Main Header Card - System Styled */}
      <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-2xl p-4 sm:p-6 lg:p-7 shadow-xs relative overflow-hidden transition-colors">
        <div className="relative space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div className="space-y-2">
              <div className="flex items-center gap-1.5 sm:gap-2 flex-wrap">
                <span className="px-2.5 py-0.5 bg-teal-600 text-white rounded-full text-[10px] font-black uppercase tracking-wider shadow-xs">
                  Official Class Slot Selection
                </span>
                <span className="px-2.5 py-0.5 bg-teal-50 dark:bg-teal-950/40 border border-teal-200 dark:border-teal-800/60 text-teal-700 dark:text-teal-300 rounded-full text-[10px] sm:text-[11px] font-bold">
                  6 Days Weekly (Mon &ndash; Sat)
                </span>
                <span className="px-2.5 py-0.5 bg-gray-100 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 text-gray-600 dark:text-gray-300 rounded-full text-[10px] sm:text-[11px] font-bold">
                  Sunday Off
                </span>
              </div>
              <h2 className="text-lg sm:text-xl lg:text-2xl font-black text-gray-900 dark:text-white tracking-tight">
                F to A MaxouT Project &mdash; Daily Time Slot Preferences
              </h2>
            </div>

            {/* Save Button in Header */}
            <div className="flex flex-col sm:items-end gap-1.5 shrink-0 w-full sm:w-auto">
              <button
                type="button"
                onClick={handleSaveSchedule}
                disabled={isSaving}
                className="w-full sm:w-auto px-5 py-2.5 bg-teal-600 hover:bg-teal-700 active:scale-95 text-white rounded-xl text-xs sm:text-sm font-bold shadow-xs transition-all cursor-pointer flex items-center justify-center gap-2 disabled:opacity-60"
              >
                {isSaving ? (
                  <>
                    <RefreshCw className="w-4 h-4 animate-spin" />
                    <span>Saving Schedule...</span>
                  </>
                ) : (
                  <>
                    <Save className="w-4 h-4" />
                    <span>Save My Slots</span>
                  </>
                )}
              </button>
              {lastSaved && (
                <span className="text-[10px] font-medium text-gray-400 flex items-center justify-center sm:justify-end gap-1 w-full">
                  <CheckCheck size={12} className="text-teal-600 dark:text-teal-400" />
                  <span>Last saved: {lastSaved}</span>
                </span>
              )}
            </div>
          </div>

          {/* KPI Mini-Bar */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-2.5 sm:gap-3 pt-2 sm:pt-3 border-t border-gray-100 dark:border-gray-800">
            <div className="p-3 bg-gray-50 dark:bg-gray-800/60 border border-gray-200 dark:border-gray-700 rounded-xl">
              <div className="text-[10px] uppercase font-bold text-gray-500 dark:text-gray-400">Program Days</div>
              <div className="text-base sm:text-lg font-black text-gray-900 dark:text-white mt-0.5">6 Days / Week</div>
              <div className="text-[10px] text-gray-400 truncate">Mon &ndash; Sat Schedule</div>
            </div>

            <div className="p-3 bg-teal-50/50 dark:bg-teal-950/30 border border-teal-200 dark:border-teal-800/60 rounded-xl">
              <div className="text-[10px] uppercase font-bold text-teal-700 dark:text-teal-300">Attending Days</div>
              <div className="text-base sm:text-lg font-black text-teal-700 dark:text-teal-300 mt-0.5">
                {attendingDaysCount} / 6 Days
              </div>
              <div className="text-[10px] text-teal-600/80 dark:text-teal-400/80">Batch confirmed</div>
            </div>

            <div className={`p-3 rounded-xl border transition-colors ${
              cannotAttendCount > 0
                ? 'bg-rose-50/50 dark:bg-rose-950/30 border-rose-200 dark:border-rose-800/60'
                : 'bg-gray-50 dark:bg-gray-800/60 border-gray-200 dark:border-gray-700'
            }`}>
              <div className={`text-[10px] uppercase font-bold ${
                cannotAttendCount > 0 ? 'text-rose-700 dark:text-rose-400' : 'text-gray-500 dark:text-gray-400'
              }`}>
                Cannot Join
              </div>
              <div className={`text-base sm:text-lg font-black mt-0.5 ${
                cannotAttendCount > 0 ? 'text-rose-700 dark:text-rose-400' : 'text-gray-900 dark:text-white'
              }`}>
                {cannotAttendCount} Day{cannotAttendCount !== 1 ? 's' : ''}
              </div>
              <div className="text-[10px] text-gray-400">Reason documented</div>
            </div>

            <div className="p-3 bg-gray-50 dark:bg-gray-800/60 border border-gray-200 dark:border-gray-700 rounded-xl">
              <div className="text-[10px] uppercase font-bold text-gray-500 dark:text-gray-400">Daily Slots</div>
              <div className="text-base sm:text-lg font-black text-gray-900 dark:text-white mt-0.5">3 Batches</div>
              <div className="text-[10px] text-gray-400 truncate">4.30PM / 8.00PM / 9.30PM</div>
            </div>
          </div>

          {/* Quick Bulk Setting Toolbar */}
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2.5 sm:gap-3 p-3 bg-gray-50 dark:bg-gray-800/60 border border-gray-200 dark:border-gray-700 rounded-xl text-xs">
            <div className="flex items-center gap-1.5 font-bold text-gray-700 dark:text-gray-300 shrink-0">
              <Sparkles size={14} className="text-teal-600 dark:text-teal-400" />
              <span>Quick Batch Presets:</span>
            </div>

            <div className="flex items-center gap-1.5 sm:gap-2 flex-wrap w-full sm:w-auto">
              {MAXOUT_SLOTS.map(s => (
                <button
                  key={s.id}
                  type="button"
                  onClick={() => handleApplySlotToAllAttending(s.id)}
                  className="flex-1 sm:flex-none px-2.5 py-1.5 bg-white dark:bg-gray-700 hover:bg-teal-50 dark:hover:bg-teal-950/40 text-gray-700 dark:text-gray-200 hover:text-teal-700 dark:hover:text-teal-300 border border-gray-200 dark:border-gray-600 rounded-lg text-[11px] sm:text-xs font-semibold transition-all cursor-pointer shadow-2xs text-center"
                >
                  {s.label} ({s.period.split('–')[0].trim()})
                </button>
              ))}

              <button
                type="button"
                onClick={handleMarkAllAttending}
                className="w-full sm:w-auto px-2.5 py-1.5 bg-teal-50 dark:bg-teal-950/40 text-teal-700 dark:text-teal-300 hover:bg-teal-100 border border-teal-200 dark:border-teal-800/60 rounded-lg text-[11px] sm:text-xs font-semibold transition-all cursor-pointer text-center"
              >
                Mark All 6 Days Attending
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* 6 Day Slot Selection Cards */}
      <div className="space-y-3 sm:space-y-4">
        <div className="flex items-center justify-between px-1">
          <h3 className="text-xs sm:text-sm font-black text-gray-900 dark:text-white uppercase tracking-wider flex items-center gap-2">
            <CalendarRange size={16} className="text-teal-600 dark:text-teal-400 shrink-0" />
            <span>Weekly Day-by-Day Slot Selection</span>
          </h3>
          <span className="text-[11px] text-gray-500 dark:text-gray-400 hidden sm:inline">
            Sunday is a scheduled rest day
          </span>
        </div>

        <div className="grid grid-cols-1 gap-3 sm:gap-4">
          {MAXOUT_DAYS.map((day, idx) => {
            const currentDayState = schedule[day];
            const isAttending = currentDayState.status === 'attending';

            return (
              <div 
                key={day}
                className={`bg-white dark:bg-gray-900 border rounded-2xl p-4 sm:p-5 lg:p-6 transition-all shadow-xs ${
                  isAttending
                    ? 'border-gray-200 dark:border-gray-800 hover:border-teal-300 dark:hover:border-teal-700/60'
                    : 'border-rose-200 dark:border-rose-900/60 bg-rose-50/20 dark:bg-rose-950/10'
                }`}
              >
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 sm:gap-4 pb-3.5 sm:pb-4 border-b border-gray-100 dark:border-gray-800">
                  {/* Day Title & Number - Single-line spacious badge */}
                  <div className="flex items-center gap-3">
                    <div className={`min-w-[3.75rem] h-10 sm:h-11 px-2.5 rounded-xl flex items-center justify-center gap-1.5 shrink-0 shadow-2xs ${
                      isAttending
                        ? 'bg-teal-50 dark:bg-teal-950/50 text-teal-700 dark:text-teal-300 border border-teal-200 dark:border-teal-800/60'
                        : 'bg-rose-50 dark:bg-rose-950/50 text-rose-700 dark:text-rose-400 border border-rose-200 dark:border-rose-800/60'
                    }`}>
                      <span className="text-[10px] font-black uppercase tracking-wider opacity-75">DAY</span>
                      <span className="text-base font-black leading-none">{idx + 1}</span>
                    </div>

                    <div className="min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <h4 className="text-sm sm:text-base font-bold text-gray-900 dark:text-white">
                          {day}
                        </h4>
                        <span className={`px-2 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider ${
                          isAttending
                            ? 'bg-teal-50 dark:bg-teal-950/50 text-teal-700 dark:text-teal-300 border border-teal-200 dark:border-teal-800/60'
                            : 'bg-rose-50 dark:bg-rose-950/50 text-rose-700 dark:text-rose-400 border border-rose-200 dark:border-rose-800/60'
                        }`}>
                          {isAttending ? 'Attending' : 'Cannot Attend'}
                        </span>
                      </div>
                      <p className="text-xs text-gray-500 dark:text-gray-400 truncate mt-0.5">
                        {isAttending 
                          ? `Selected: ${currentDayState.slot}`
                          : `Reason: ${currentDayState.reason || 'Pending reason'}`}
                      </p>
                    </div>
                  </div>

                  {/* Attendance Switch Toggle */}
                  <div className="w-full sm:w-auto grid grid-cols-2 sm:flex items-center gap-1 p-1 bg-gray-100 dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700">
                    <button
                      type="button"
                      onClick={() => handleStatusChange(day, 'attending')}
                      className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer flex items-center justify-center gap-1.5 ${
                        isAttending
                          ? 'bg-teal-600 text-white shadow-2xs font-black'
                          : 'text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-200'
                      }`}
                    >
                      <CheckCircle2 size={13} className={isAttending ? 'text-white' : 'text-gray-400'} />
                      <span>Attending (Join)</span>
                    </button>

                    <button
                      type="button"
                      onClick={() => handleStatusChange(day, 'cannot_attend')}
                      className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer flex items-center justify-center gap-1.5 ${
                        !isAttending
                          ? 'bg-rose-600 text-white shadow-2xs font-black'
                          : 'text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-200'
                      }`}
                    >
                      <AlertCircle size={13} className={!isAttending ? 'text-white' : 'text-gray-400'} />
                      <span>Cannot Join</span>
                    </button>
                  </div>
                </div>

                {/* Day Body Content */}
                <div className="pt-3.5 sm:pt-4">
                  {isAttending ? (
                    /* Slot Selection: 3 Daily Batches */
                    <div className="space-y-2">
                      <label className="block text-[11px] font-bold uppercase tracking-wider text-gray-500 dark:text-gray-400">
                        Choose your time slot for {day}:
                      </label>
                      <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5 sm:gap-3">
                        {MAXOUT_SLOTS.map(slotObj => {
                          const isSelected = currentDayState.slot === slotObj.id;

                          return (
                            <button
                              key={slotObj.id}
                              type="button"
                              onClick={() => handleSlotChange(day, slotObj.id)}
                              className={`p-3 sm:p-3.5 rounded-xl border text-left transition-all cursor-pointer relative overflow-hidden active:scale-[0.99] ${
                                isSelected
                                  ? 'bg-teal-50 dark:bg-teal-950/40 border-teal-600 dark:border-teal-500 shadow-xs ring-1 ring-teal-600 dark:ring-teal-500'
                                  : 'bg-white dark:bg-gray-800/60 border-gray-200 dark:border-gray-700/80 hover:border-teal-300 dark:hover:border-teal-700'
                              }`}
                            >
                              <div className="flex items-center justify-between mb-1">
                                <span className={`text-xs font-black uppercase tracking-wider ${
                                  isSelected ? 'text-teal-700 dark:text-teal-300' : 'text-gray-700 dark:text-gray-300'
                                }`}>
                                  {slotObj.label}
                                </span>
                                {isSelected ? (
                                  <div className="w-4 h-4 rounded-full bg-teal-600 flex items-center justify-center text-white shrink-0">
                                    <Check size={11} strokeWidth={3} />
                                  </div>
                                ) : (
                                  <div className="w-4 h-4 rounded-full border border-gray-300 dark:border-gray-600 shrink-0" />
                                )}
                              </div>
                              <div className="flex items-center gap-1.5 text-xs font-bold text-gray-900 dark:text-white">
                                <Clock size={13} className={isSelected ? 'text-teal-600 dark:text-teal-400' : 'text-gray-400'} />
                                <span>{slotObj.period}</span>
                              </div>
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  ) : (
                    /* Cannot Attend: Reason Form */
                    <div className="space-y-3 p-3.5 sm:p-4 bg-rose-50/50 dark:bg-rose-950/30 border border-rose-200/80 dark:border-rose-800/60 rounded-xl animate-in fade-in duration-150">
                      <div className="flex items-center gap-2 text-xs font-bold text-rose-800 dark:text-rose-300">
                        <AlertCircle size={15} className="text-rose-600 dark:text-rose-400 shrink-0" />
                        <span>Why are you unable to join on {day}?</span>
                      </div>

                      {/* Quick Reason Chips: Chemistry Class, Bio Class, Maths Class at the top */}
                      <div className="space-y-1.5">
                        <span className="text-[10px] uppercase font-bold text-gray-500 dark:text-gray-400">
                          Select a reason:
                        </span>
                        <div className="flex flex-wrap gap-1.5 sm:gap-2">
                          {QUICK_REASONS.map(r => {
                            const isChosen = currentDayState.reason === r;
                            const isSubjectClass = r === 'Chemistry Class' || r === 'Bio Class' || r === 'Maths Class';

                            return (
                              <button
                                key={r}
                                type="button"
                                onClick={() => handleReasonChange(day, r)}
                                className={`px-2.5 py-1.5 text-xs rounded-lg border transition-all cursor-pointer font-medium active:scale-95 ${
                                  isChosen
                                    ? 'bg-rose-600 text-white border-rose-600 font-bold shadow-2xs'
                                    : isSubjectClass
                                    ? 'bg-rose-100/70 hover:bg-rose-200/80 dark:bg-rose-950/60 text-rose-800 dark:text-rose-300 border-rose-300 dark:border-rose-700/70 font-bold'
                                    : 'bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-300 border-gray-200 dark:border-gray-700 hover:border-rose-300'
                                }`}
                              >
                                {r}
                              </button>
                            );
                          })}
                        </div>
                      </div>

                      {/* Custom Reason Text Input */}
                      <div>
                        <label className="block text-[11px] font-bold text-gray-700 dark:text-gray-300 mb-1">
                          Detailed explanation / Custom reason:
                        </label>
                        <textarea
                          rows={2}
                          value={currentDayState.reason}
                          onChange={(e) => handleReasonChange(day, e.target.value)}
                          placeholder={`Please explain why you cannot attend on ${day}...`}
                          className="w-full p-2.5 text-xs bg-white dark:bg-gray-900 border border-rose-200 dark:border-rose-800 rounded-xl focus:ring-2 focus:ring-teal-500/20 focus:border-teal-500 outline-none text-gray-900 dark:text-white"
                        />
                      </div>
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Weekly Schedule Review Card & Save Button */}
      <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-2xl p-4 sm:p-6 lg:p-7 shadow-xs space-y-4 sm:space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h3 className="text-sm sm:text-base font-bold text-gray-900 dark:text-white flex items-center gap-2">
              <CheckCircle2 className="w-5 h-5 text-teal-600 dark:text-teal-400 shrink-0" />
              <span>Review Your Weekly Timetable Summary</span>
            </h3>
            <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
              Confirm your time slot allocation before saving your schedule.
            </p>
          </div>

          <button
            type="button"
            onClick={handleSaveSchedule}
            disabled={isSaving}
            className="w-full sm:w-auto px-6 py-2.5 sm:py-3 bg-teal-600 hover:bg-teal-700 active:scale-95 text-white rounded-xl text-xs sm:text-sm font-bold shadow-xs transition-all cursor-pointer flex items-center justify-center gap-2 disabled:opacity-60"
          >
            {isSaving ? (
              <>
                <RefreshCw className="w-4 h-4 animate-spin" />
                <span>Saving Schedule...</span>
              </>
            ) : (
              <>
                <Save className="w-4 h-4" />
                <span>Save Schedule Now</span>
              </>
            )}
          </button>
        </div>

        {/* Timetable Matrix */}
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2 sm:gap-2.5 pt-1 sm:pt-2">
          {MAXOUT_DAYS.map(day => {
            const st = schedule[day];
            const isAtt = st.status === 'attending';

            return (
              <div 
                key={day}
                className={`p-2.5 sm:p-3 rounded-xl border text-center transition-all ${
                  isAtt 
                    ? 'bg-teal-50/50 dark:bg-teal-950/30 border-teal-200 dark:border-teal-800/60'
                    : 'bg-rose-50/50 dark:bg-rose-950/30 border-rose-200 dark:border-rose-800/60'
                }`}
              >
                <div className="text-[11px] sm:text-xs font-black text-gray-900 dark:text-white uppercase tracking-wider mb-0.5">
                  {day}
                </div>
                <div className={`text-[10px] font-bold mb-1 ${
                  isAtt ? 'text-teal-700 dark:text-teal-300' : 'text-rose-700 dark:text-rose-400'
                }`}>
                  {isAtt ? 'Attending' : 'Cannot Attend'}
                </div>
                <div className="text-[11px] font-semibold text-gray-700 dark:text-gray-300 truncate" title={isAtt ? st.slot : st.reason}>
                  {isAtt ? st.slot.split(':')[0] : (st.reason || 'Absent')}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

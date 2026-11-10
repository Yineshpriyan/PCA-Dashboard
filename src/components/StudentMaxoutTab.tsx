import React, { useState, useEffect } from 'react';
import { 
  MAXOUT_DAYS, 
  MAXOUT_SLOTS, 
  COMMON_ABSENCE_REASONS,
  MaxoutDayOfWeek, 
  MaxoutSlot, 
  StudentMaxoutDaySchedule,
  StudentMaxoutSlotRecord 
} from '../types/maxout';
import { supabase } from '../lib/supabase';
import { toast } from 'sonner';
import { 
  Calendar, 
  Clock, 
  CheckCircle2, 
  AlertCircle, 
  XCircle, 
  Save, 
  Loader2, 
  Sparkles, 
  Copy, 
  Check, 
  Database, 
  Share2, 
  RotateCcw,
  Info,
  CalendarCheck2,
  HelpCircle
} from 'lucide-react';
import { cn } from '../lib/utils';

interface StudentMaxoutTabProps {
  pcaid: string;
  studentName?: string;
  stream?: string;
  properBatch?: string;
  onBackToPersonal?: () => void;
}

const DEFAULT_SCHEDULE: Record<MaxoutDayOfWeek, StudentMaxoutDaySchedule> = {
  Monday: { day_of_week: 'Monday', status: 'attending', slot: 'Batch 1: 4.30 PM - 6.00 PM', reason: '', notes: '' },
  Tuesday: { day_of_week: 'Tuesday', status: 'attending', slot: 'Batch 1: 4.30 PM - 6.00 PM', reason: '', notes: '' },
  Wednesday: { day_of_week: 'Wednesday', status: 'attending', slot: 'Batch 1: 4.30 PM - 6.00 PM', reason: '', notes: '' },
  Thursday: { day_of_week: 'Thursday', status: 'attending', slot: 'Batch 1: 4.30 PM - 6.00 PM', reason: '', notes: '' },
  Friday: { day_of_week: 'Friday', status: 'attending', slot: 'Batch 1: 4.30 PM - 6.00 PM', reason: '', notes: '' },
  Saturday: { day_of_week: 'Saturday', status: 'attending', slot: 'Batch 1: 4.30 PM - 6.00 PM', reason: '', notes: '' },
};

const normalizeMaxoutSlot = (slot?: string | null): MaxoutSlot => {
  if (!slot) return 'Batch 1: 4.30 PM - 6.00 PM';
  if (
    slot.includes('9.30') || 
    slot.includes('11.00') || 
    slot.includes('Batch 3') || 
    slot.includes('Batch 02') || 
    (slot.includes('Batch 2') && !slot.includes('8.00'))
  ) {
    return 'Batch 2: 9.30 PM - 11.00 PM';
  }
  return 'Batch 1: 4.30 PM - 6.00 PM';
};

export const StudentMaxoutTab: React.FC<StudentMaxoutTabProps> = ({
  pcaid,
  studentName = '',
  stream = '',
  properBatch = '',
  onBackToPersonal
}) => {
  const [schedule, setSchedule] = useState<Record<MaxoutDayOfWeek, StudentMaxoutDaySchedule>>(() => {
    // Try reading local draft first
    if (pcaid) {
      try {
        const stored = localStorage.getItem(`maxout_schedule_${pcaid}`);
        if (stored) {
          const parsed = JSON.parse(stored);
          const sanitized: Record<MaxoutDayOfWeek, StudentMaxoutDaySchedule> = { ...DEFAULT_SCHEDULE };
          MAXOUT_DAYS.forEach(day => {
            if (parsed[day]) {
              sanitized[day] = {
                ...parsed[day],
                slot: parsed[day].status === 'attending' ? normalizeMaxoutSlot(parsed[day].slot) : ''
              };
            }
          });
          return sanitized;
        }
      } catch (e) {
        console.warn('Error reading local maxout schedule draft:', e);
      }
    }
    return DEFAULT_SCHEDULE;
  });

  const [loading, setLoading] = useState<boolean>(false);
  const [saving, setSaving] = useState<boolean>(false);
  const [isCopiedSummary, setIsCopiedSummary] = useState<boolean>(false);
  const [tableMissingWarning, setTableMissingWarning] = useState<boolean>(false);
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState<boolean>(false);

  // Fetch from database on student PCA ID change
  useEffect(() => {
    if (!pcaid) return;
    loadScheduleFromDb();
  }, [pcaid]);

  const loadScheduleFromDb = async () => {
    setLoading(true);
    setTableMissingWarning(false);
    try {
      const { data, error } = await supabase
        .from('student_maxout_slots')
        .select('*')
        .eq('pcaid', pcaid);

      if (error) {
        // Check if table does not exist in postgres (42P01)
        if (error.code === '42P01' || error.message?.includes('relation "public.student_maxout_slots" does not exist')) {
          setTableMissingWarning(true);
        } else {
          console.warn('Supabase fetch error for student_maxout_slots:', error);
        }
        // Fall back to local storage
        const local = localStorage.getItem(`maxout_schedule_${pcaid}`);
        if (local) {
          try {
            const parsed = JSON.parse(local);
            const sanitized: Record<MaxoutDayOfWeek, StudentMaxoutDaySchedule> = { ...DEFAULT_SCHEDULE };
            MAXOUT_DAYS.forEach(day => {
              if (parsed[day]) {
                sanitized[day] = {
                  ...parsed[day],
                  slot: parsed[day].status === 'attending' ? normalizeMaxoutSlot(parsed[day].slot) : ''
                };
              }
            });
            setSchedule(sanitized);
          } catch (e) {
            // ignore
          }
        }
        return;
      }

      if (data && data.length > 0) {
        const updated: Record<MaxoutDayOfWeek, StudentMaxoutDaySchedule> = { ...DEFAULT_SCHEDULE };
        data.forEach((row: StudentMaxoutSlotRecord) => {
          if (row.day_of_week && updated[row.day_of_week]) {
            updated[row.day_of_week] = {
              day_of_week: row.day_of_week,
              status: row.status || 'attending',
              slot: row.status === 'attending' ? normalizeMaxoutSlot(row.slot) : '',
              reason: row.reason || '',
              notes: row.notes || ''
            };
          }
        });
        setSchedule(updated);
        localStorage.setItem(`maxout_schedule_${pcaid}`, JSON.stringify(updated));
        setHasUnsavedChanges(false);
      } else {
        // Try local storage draft
        const local = localStorage.getItem(`maxout_schedule_${pcaid}`);
        if (local) {
          try {
            const parsed = JSON.parse(local);
            const sanitized: Record<MaxoutDayOfWeek, StudentMaxoutDaySchedule> = { ...DEFAULT_SCHEDULE };
            MAXOUT_DAYS.forEach(day => {
              if (parsed[day]) {
                sanitized[day] = {
                  ...parsed[day],
                  slot: parsed[day].status === 'attending' ? normalizeMaxoutSlot(parsed[day].slot) : ''
                };
              }
            });
            setSchedule(sanitized);
          } catch (e) {
            // ignore
          }
        }
      }
    } catch (err: any) {
      console.error('Failed to load maxout slots:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleDayStatusChange = (day: MaxoutDayOfWeek, status: 'attending' | 'cannot_attend') => {
    setSchedule(prev => ({
      ...prev,
      [day]: {
        ...prev[day],
        status,
        // if switching to attending and slot is empty, set default Batch 1
        slot: status === 'attending' && !prev[day].slot ? 'Batch 1: 4.30 PM - 6.00 PM' : prev[day].slot,
      }
    }));
    setHasUnsavedChanges(true);
  };

  const handleSlotChange = (day: MaxoutDayOfWeek, slot: MaxoutSlot) => {
    setSchedule(prev => ({
      ...prev,
      [day]: {
        ...prev[day],
        status: 'attending',
        slot
      }
    }));
    setHasUnsavedChanges(true);
  };

  const handleReasonChange = (day: MaxoutDayOfWeek, reason: string) => {
    setSchedule(prev => ({
      ...prev,
      [day]: {
        ...prev[day],
        reason
      }
    }));
    setHasUnsavedChanges(true);
  };

  const handleNotesChange = (day: MaxoutDayOfWeek, notes: string) => {
    setSchedule(prev => ({
      ...prev,
      [day]: {
        ...prev[day],
        notes
      }
    }));
    setHasUnsavedChanges(true);
  };

  const applyBatchToAll = (slot: MaxoutSlot) => {
    setSchedule(prev => {
      const next = { ...prev };
      MAXOUT_DAYS.forEach(day => {
        next[day] = {
          ...next[day],
          status: 'attending',
          slot,
          reason: ''
        };
      });
      return next;
    });
    setHasUnsavedChanges(true);
    toast.success(`Set all 6 days to ${slot}`);
  };

  const resetAllDays = () => {
    setSchedule(DEFAULT_SCHEDULE);
    setHasUnsavedChanges(true);
    toast.info('Reset schedule to default settings');
  };

  // Validation
  const validateSchedule = (): boolean => {
    for (const day of MAXOUT_DAYS) {
      const item = schedule[day];
      if (item.status === 'attending' && !item.slot) {
        toast.error(`Please select a batch slot for ${day} or mark as Cannot Join.`);
        return false;
      }
      if (item.status === 'cannot_attend' && !item.reason?.trim()) {
        toast.error(`Please enter or pick a reason why the student cannot join on ${day}.`);
        return false;
      }
    }
    return true;
  };

  const handleSave = async () => {
    if (!pcaid) {
      toast.error('Student PCA ID is required before saving schedule.');
      return;
    }

    if (!validateSchedule()) return;

    setSaving(true);
    try {
      // Always store locally first as a reliable fallback
      localStorage.setItem(`maxout_schedule_${pcaid}`, JSON.stringify(schedule));

      // Prepare records for Supabase upsert matching student_maxout_slots table schema
      const recordsToUpsert = MAXOUT_DAYS.map(day => {
        const item = schedule[day];
        return {
          pcaid: pcaid.trim().toUpperCase(),
          student_name: studentName ? studentName.trim() : null,
          day_of_week: day,
          status: item.status,
          slot: item.status === 'attending' ? item.slot || null : null,
          reason: item.status === 'cannot_attend' ? item.reason?.trim() || null : null,
          updated_at: new Date().toISOString()
        };
      });

      const { error } = await supabase
        .from('student_maxout_slots')
        .upsert(recordsToUpsert, { onConflict: 'pcaid,day_of_week' });

      if (error) {
        if (error.code === '42P01' || error.message?.includes('does not exist')) {
          setTableMissingWarning(true);
          toast.warning('Schedule saved locally! Please execute the SQL table migration script in Supabase to sync data to the database.');
        } else {
          console.error('Supabase upsert error:', error);
          toast.error(`Database error: ${error.message || 'Failed to save to Supabase'}`);
        }
      } else {
        toast.success(`MaxouT Project schedule successfully saved for ${pcaid}!`);
        setHasUnsavedChanges(false);
        setTableMissingWarning(false);
      }
    } catch (err: any) {
      console.error('Error saving schedule:', err);
      toast.error(`Error saving schedule: ${err.message || 'Unknown error'}`);
    } finally {
      setSaving(false);
    }
  };

  // Generate WhatsApp / text formatted summary
  const generateSummaryText = () => {
    let text = `*F to A MaxouT Project - Weekly Schedule*\n`;
    text += `Student: ${studentName || 'Student'} (${pcaid})\n`;
    if (properBatch) text += `Batch: ${properBatch}\n`;
    text += `------------------------------------\n`;

    MAXOUT_DAYS.forEach(day => {
      const item = schedule[day];
      if (item.status === 'attending') {
        text += `• *${day}*: ${item.slot || 'Batch 1'}\n`;
      } else {
        text += `• *${day}*: CANNOT JOIN (Reason: ${item.reason || 'Not specified'})\n`;
      }
    });

    text += `• *Sunday*: Holiday / Off\n`;
    text += `------------------------------------\n`;
    text += `Physics Cube Academy`;
    return text;
  };

  const handleCopySummary = async () => {
    try {
      const text = generateSummaryText();
      await navigator.clipboard.writeText(text);
      setIsCopiedSummary(true);
      toast.success('MaxouT schedule copied to clipboard! Ready to share on WhatsApp or SMS.');
      setTimeout(() => setIsCopiedSummary(false), 2500);
    } catch {
      toast.error('Failed to copy schedule summary.');
    }
  };

  // Stats calculation
  const attendingCount = MAXOUT_DAYS.filter(d => schedule[d].status === 'attending').length;
  const cannotAttendCount = MAXOUT_DAYS.filter(d => schedule[d].status === 'cannot_attend').length;
  const batch1Count = MAXOUT_DAYS.filter(d => schedule[d].status === 'attending' && (schedule[d].slot.includes('Batch 1') || schedule[d].slot.includes('4.30'))).length;
  const batch2Count = MAXOUT_DAYS.filter(d => schedule[d].status === 'attending' && (schedule[d].slot.includes('Batch 2') || schedule[d].slot.includes('9.30') || schedule[d].slot.includes('Batch 3') || schedule[d].slot.includes('Batch 02'))).length;

  if (!pcaid) {
    return (
      <div className="p-8 text-center bg-amber-50/80 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800 rounded-2xl animate-fade-in">
        <AlertCircle size={36} className="mx-auto text-amber-500 mb-2" />
        <h4 className="text-sm font-bold text-amber-900 dark:text-amber-200">PCA ID Required</h4>
        <p className="text-xs text-amber-700 dark:text-amber-300 mt-1 max-w-md mx-auto">
          Please assign or enter the student's PCA ID in the "Personal Details & Payment" tab first before allocating MaxouT Project class slots.
        </p>
        {onBackToPersonal && (
          <button
            type="button"
            onClick={onBackToPersonal}
            className="mt-4 px-5 py-2 bg-amber-600 text-white font-bold text-xs rounded-xl hover:bg-amber-700 transition-colors cursor-pointer"
          >
            Go to Personal Details
          </button>
        )}
      </div>
    );
  }

  return (
    <div className="space-y-6 animate-in fade-in duration-200">
      {/* Table schema missing notice if applicable */}
      {tableMissingWarning && (
        <div className="bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-800/80 rounded-2xl p-4 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 shadow-xs">
          <div className="flex items-start gap-3">
            <Database size={20} className="text-amber-600 dark:text-amber-400 shrink-0 mt-0.5" />
            <div>
              <h5 className="text-xs font-black uppercase tracking-wider text-amber-800 dark:text-amber-300">
                Supabase Database Setup Pending
              </h5>
              <p className="text-xs text-amber-700 dark:text-amber-400 mt-0.5">
                The <code className="font-mono bg-amber-100 dark:bg-amber-900/60 px-1 py-0.5 rounded text-[11px]">student_maxout_slots</code> table hasn't been created yet.
                Your schedule edits are safely preserved locally in your browser.
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Main Header Card */}
      <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-2xl p-6 shadow-xs">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-5 border-b border-gray-150 dark:border-gray-800">
          <div className="flex items-start sm:items-center gap-3">
            <div className="w-11 h-11 rounded-xl bg-teal-600 text-white flex items-center justify-center shadow-md shadow-teal-600/20 shrink-0">
              <CalendarCheck2 size={22} />
            </div>
            <div>
              <div className="flex flex-wrap items-center gap-2">
                <span className="px-2.5 py-0.5 bg-teal-100 dark:bg-teal-950/80 text-teal-800 dark:text-teal-300 text-xs font-mono font-black rounded-lg">
                  {pcaid}
                </span>
                <h3 className="text-lg font-bold text-gray-900 dark:text-white">
                  F to A MaxouT Project — Slot Allocation
                </h3>
                <span className="px-2 py-0.5 bg-teal-50 dark:bg-teal-950/50 text-teal-700 dark:text-teal-300 text-[10px] font-black uppercase tracking-wider rounded-md border border-teal-200 dark:border-teal-800">
                  6 Days / Week
                </span>
              </div>
              <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                Student: <strong className="text-gray-800 dark:text-gray-200">{studentName || 'Unnamed'}</strong> 
                {stream && ` | Stream: ${stream}`}
                {properBatch && ` | Batch: ${properBatch}`}
                {' — Sessions run Monday to Saturday with 2 daily batches (Sunday off).'}
              </p>
            </div>
          </div>

          {/* Action buttons in header */}
          <div className="flex items-center gap-2 flex-wrap">
            <button
              type="button"
              onClick={handleCopySummary}
              className="flex items-center gap-1.5 px-3 py-2 bg-gray-100 hover:bg-gray-200 dark:bg-gray-800 dark:hover:bg-gray-700 text-gray-700 dark:text-gray-200 rounded-xl text-xs font-bold transition-all cursor-pointer border border-gray-200 dark:border-gray-700"
              title="Copy formatted schedule for WhatsApp / Telegram"
            >
              {isCopiedSummary ? <Check size={14} className="text-green-600" /> : <Share2 size={14} />}
              <span>{isCopiedSummary ? 'Copied Schedule!' : 'Copy Summary'}</span>
            </button>

            <button
              type="button"
              onClick={handleSave}
              disabled={saving}
              className="flex items-center gap-1.5 px-5 py-2 bg-teal-600 hover:bg-teal-700 text-white rounded-xl text-xs font-bold transition-all shadow-md shadow-teal-600/20 active:scale-95 disabled:opacity-50 cursor-pointer"
            >
              {saving ? <Loader2 size={15} className="animate-spin" /> : <Save size={15} />}
              <span>{saving ? 'Saving...' : 'Save Schedule'}</span>
            </button>
          </div>
        </div>

        {/* Schedule Summary & Metrics Bar */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mt-4">
          <div className="bg-teal-50/60 dark:bg-teal-950/20 border border-teal-100 dark:border-teal-900/40 rounded-xl p-3">
            <div className="text-[10px] font-black uppercase tracking-wider text-teal-700 dark:text-teal-400 flex items-center justify-between">
              <span>Attending Days</span>
              <CheckCircle2 size={13} />
            </div>
            <div className="mt-1 flex items-baseline gap-1.5">
              <span className="text-xl font-black text-teal-900 dark:text-teal-200">{attendingCount}</span>
              <span className="text-xs text-teal-600 dark:text-teal-400 font-semibold">/ 6 Days</span>
            </div>
          </div>

          <div className="bg-amber-50/60 dark:bg-amber-950/20 border border-amber-100 dark:border-amber-900/40 rounded-xl p-3">
            <div className="text-[10px] font-black uppercase tracking-wider text-amber-700 dark:text-amber-400 flex items-center justify-between">
              <span>Cannot Join</span>
              <XCircle size={13} />
            </div>
            <div className="mt-1 flex items-baseline gap-1.5">
              <span className="text-xl font-black text-amber-900 dark:text-amber-200">{cannotAttendCount}</span>
              <span className="text-xs text-amber-600 dark:text-amber-400 font-semibold">/ 6 Days</span>
            </div>
          </div>

          <div className="bg-gray-50 dark:bg-gray-850 border border-gray-150 dark:border-gray-800 rounded-xl p-3">
            <div className="text-[10px] font-black uppercase tracking-wider text-gray-500 dark:text-gray-400 flex items-center justify-between">
              <span>Slot Distribution</span>
              <Clock size={13} />
            </div>
            <div className="mt-1 text-xs font-semibold text-gray-800 dark:text-gray-200 space-y-1">
              <div className="flex justify-between text-[11px]">
                <span className="text-teal-600 font-bold">B1 (4.30 PM):</span>
                <span className="font-mono">{batch1Count} d</span>
              </div>
              <div className="flex justify-between text-[11px]">
                <span className="text-purple-600 font-bold">B2 (9.30 PM):</span>
                <span className="font-mono">{batch2Count} d</span>
              </div>
            </div>
          </div>

          <div className="bg-gray-50 dark:bg-gray-850 border border-gray-150 dark:border-gray-800 rounded-xl p-3 flex flex-col justify-between">
            <div className="text-[10px] font-black uppercase tracking-wider text-gray-500 dark:text-gray-400 flex items-center justify-between">
              <span>Sunday Status</span>
              <Calendar size={13} />
            </div>
            <div className="mt-1">
              <span className="inline-block px-2 py-0.5 bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-300 rounded text-[11px] font-bold">
                Holiday / Off
              </span>
              <p className="text-[10px] text-gray-400 dark:text-gray-500 mt-1">No sessions on Sunday</p>
            </div>
          </div>
        </div>

        {/* Quick Batch Apply Toolstrip */}
        <div className="mt-5 pt-4 border-t border-gray-150 dark:border-gray-800 flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <Sparkles size={14} className="text-teal-600" />
            <span className="text-xs font-bold text-gray-700 dark:text-gray-300">Quick Fill All Days:</span>
          </div>

          <div className="flex items-center gap-2 flex-wrap">
            <button
              type="button"
              onClick={() => applyBatchToAll('Batch 1: 4.30 PM - 6.00 PM')}
              className="px-3 py-1.5 text-xs font-bold rounded-lg bg-teal-50 dark:bg-teal-950/40 text-teal-700 dark:text-teal-300 hover:bg-teal-100 dark:hover:bg-teal-900/60 border border-teal-200 dark:border-teal-800 transition-all cursor-pointer"
            >
              Batch 1 (4.30 PM - 6.00 PM)
            </button>

            <button
              type="button"
              onClick={() => applyBatchToAll('Batch 2: 9.30 PM - 11.00 PM')}
              className="px-3 py-1.5 text-xs font-bold rounded-lg bg-purple-50 dark:bg-purple-950/40 text-purple-700 dark:text-purple-300 hover:bg-purple-100 dark:hover:bg-purple-900/60 border border-purple-200 dark:border-purple-800 transition-all cursor-pointer"
            >
              Batch 2 (9.30 PM - 11.00 PM)
            </button>

            <button
              type="button"
              onClick={resetAllDays}
              className="p-1.5 text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-lg transition-colors cursor-pointer"
              title="Reset all days"
            >
              <RotateCcw size={14} />
            </button>
          </div>
        </div>
      </div>

      {/* 6-Day Schedule Grid */}
      <div className="space-y-4">
        {loading ? (
          <div className="py-16 text-center text-xs text-gray-500 dark:text-gray-400 flex flex-col items-center justify-center gap-2 bg-white dark:bg-gray-900 rounded-2xl border border-gray-200 dark:border-gray-800">
            <Loader2 size={24} className="animate-spin text-teal-600" />
            <span>Loading schedule records...</span>
          </div>
        ) : (
          MAXOUT_DAYS.map((day, dayIndex) => {
            const current = schedule[day];
            const isAttending = current.status === 'attending';

            return (
              <div 
                key={day}
                className={cn(
                  "bg-white dark:bg-gray-900 border rounded-2xl p-5 transition-all shadow-xs",
                  isAttending
                    ? "border-gray-200 dark:border-gray-800 hover:border-teal-300 dark:hover:border-teal-700"
                    : "border-amber-200 dark:border-amber-900/60 bg-amber-50/10 dark:bg-amber-950/10"
                )}
              >
                {/* Day Header Row */}
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-gray-150 dark:border-gray-800">
                  <div className="flex items-center gap-3">
                    <span className="w-7 h-7 rounded-lg bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-300 font-bold text-xs flex items-center justify-center">
                      {dayIndex + 1}
                    </span>
                    <div>
                      <h4 className="text-base font-bold text-gray-900 dark:text-white flex items-center gap-2">
                        <span>{day}</span>
                        {isAttending ? (
                          <span className="px-2 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider bg-green-100 text-green-800 dark:bg-green-950/80 dark:text-green-300">
                            Attending
                          </span>
                        ) : (
                          <span className="px-2 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider bg-amber-100 text-amber-800 dark:bg-amber-950/80 dark:text-amber-300">
                            Cannot Join
                          </span>
                        )}
                      </h4>
                    </div>
                  </div>

                  {/* Attendance Mode Switch (Attending vs Cannot Join) */}
                  <div className="flex items-center bg-gray-100 dark:bg-gray-800 p-1 rounded-xl self-start sm:self-auto">
                    <button
                      type="button"
                      onClick={() => handleDayStatusChange(day, 'attending')}
                      className={cn(
                        "flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer",
                        isAttending
                          ? "bg-teal-600 text-white shadow-xs"
                          : "text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white"
                      )}
                    >
                      <CheckCircle2 size={13} />
                      <span>Attending</span>
                    </button>

                    <button
                      type="button"
                      onClick={() => handleDayStatusChange(day, 'cannot_attend')}
                      className={cn(
                        "flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer",
                        !isAttending
                          ? "bg-amber-600 text-white shadow-xs"
                          : "text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white"
                      )}
                    >
                      <XCircle size={13} />
                      <span>Cannot Join</span>
                    </button>
                  </div>
                </div>

                {/* Day Body Content */}
                <div className="pt-4">
                  {isAttending ? (
                    <div>
                      <label className="text-xs font-bold text-gray-700 dark:text-gray-300 block mb-2">
                        Select Daily Time Slot:
                      </label>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-2.5">
                        {MAXOUT_SLOTS.map((slotOpt) => {
                          const isSelected = current.slot === slotOpt.id;
                          return (
                            <button
                              key={slotOpt.id}
                              type="button"
                              onClick={() => handleSlotChange(day, slotOpt.id)}
                              className={cn(
                                "flex flex-col p-3 rounded-xl border text-left transition-all cursor-pointer relative",
                                isSelected
                                  ? "bg-teal-50 dark:bg-teal-950/40 border-teal-500 dark:border-teal-500 ring-2 ring-teal-500/20 shadow-xs"
                                  : "bg-white dark:bg-gray-850 border-gray-200 dark:border-gray-750 hover:border-gray-300 dark:hover:border-gray-650"
                              )}
                            >
                              <div className="flex items-center justify-between">
                                <span className={cn(
                                  "text-xs font-black uppercase tracking-wider",
                                  isSelected ? "text-teal-700 dark:text-teal-300" : "text-gray-700 dark:text-gray-300"
                                )}>
                                  {slotOpt.label}
                                </span>
                                {isSelected && (
                                  <span className="w-2 h-2 rounded-full bg-teal-600 animate-pulse" />
                                )}
                              </div>
                              <div className="mt-1 flex items-center gap-1 text-xs font-mono font-bold text-gray-800 dark:text-gray-200">
                                <Clock size={12} className={isSelected ? "text-teal-600 dark:text-teal-400" : "text-gray-400"} />
                                <span>{slotOpt.time}</span>
                              </div>
                            </button>
                          );
                        })}
                      </div>

                      {/* Optional extra remarks for this day */}
                      <div className="mt-3">
                        <input
                          type="text"
                          value={current.notes || ''}
                          onChange={(e) => handleNotesChange(day, e.target.value)}
                          placeholder="Optional notes or remarks for this day (e.g. parent requested 15 mins early finish)..."
                          className="w-full text-xs px-3 py-1.5 bg-gray-50 dark:bg-gray-850 border border-gray-200 dark:border-gray-800 rounded-lg text-gray-700 dark:text-gray-300 placeholder-gray-400 focus:outline-none focus:ring-1 focus:ring-teal-500"
                        />
                      </div>
                    </div>
                  ) : (
                    <div className="space-y-3">
                      <div>
                        <div className="flex items-center justify-between mb-1.5">
                          <label className="text-xs font-bold text-amber-800 dark:text-amber-300 flex items-center gap-1.5">
                            <AlertCircle size={13} className="text-amber-600" />
                            <span>Reason for Not Joining on {day}:</span>
                            <span className="text-red-500">*</span>
                          </label>
                          <span className="text-[10px] text-gray-400">Click a preset or type below</span>
                        </div>

                        {/* Quick Reason Pills */}
                        <div className="flex flex-wrap gap-1.5 mb-2">
                          {COMMON_ABSENCE_REASONS.map(preset => {
                            const isChosen = current.reason === preset;
                            return (
                              <button
                                key={preset}
                                type="button"
                                onClick={() => handleReasonChange(day, preset)}
                                className={cn(
                                  "px-2.5 py-1 rounded-md text-[11px] font-semibold transition-all cursor-pointer border",
                                  isChosen
                                    ? "bg-amber-600 text-white border-amber-600 shadow-2xs"
                                    : "bg-white dark:bg-gray-800 text-gray-600 dark:text-gray-300 border-gray-200 dark:border-gray-700 hover:border-gray-300"
                                )}
                              >
                                {preset}
                              </button>
                            );
                          })}
                        </div>

                        {/* Custom Reason Text Input */}
                        <input
                          type="text"
                          value={current.reason || ''}
                          onChange={(e) => handleReasonChange(day, e.target.value)}
                          placeholder="Specify the reason why student cannot attend (mandatory)..."
                          className="w-full text-xs px-3 py-2 bg-white dark:bg-gray-850 border border-amber-300 dark:border-amber-800 rounded-xl text-gray-900 dark:text-gray-100 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-amber-500/20"
                        />
                      </div>

                      {/* Optional Notes */}
                      <div>
                        <input
                          type="text"
                          value={current.notes || ''}
                          onChange={(e) => handleNotesChange(day, e.target.value)}
                          placeholder="Optional notes (e.g. will watch recorded lecture or makeup session)..."
                          className="w-full text-xs px-3 py-1.5 bg-gray-50 dark:bg-gray-850 border border-gray-200 dark:border-gray-800 rounded-lg text-gray-700 dark:text-gray-300 placeholder-gray-400 focus:outline-none focus:ring-1 focus:ring-teal-500"
                        />
                      </div>
                    </div>
                  )}
                </div>
              </div>
            );
          })
        )}
      </div>

      {/* Bottom Sticky Action Bar */}
      <div className="sticky bottom-0 z-20 bg-white/95 dark:bg-gray-900/95 backdrop-blur-md border border-gray-200 dark:border-gray-800 p-4 rounded-2xl shadow-lg flex flex-col sm:flex-row items-center justify-between gap-4">
        <div className="flex items-center gap-2">
          {hasUnsavedChanges ? (
            <span className="flex items-center gap-1.5 text-xs font-bold text-amber-600 dark:text-amber-400">
              <span className="w-2 h-2 rounded-full bg-amber-500 animate-ping" />
              Unsaved changes present
            </span>
          ) : (
            <span className="flex items-center gap-1.5 text-xs font-bold text-green-600 dark:text-green-400">
              <CheckCircle2 size={14} />
              Schedule is up to date
            </span>
          )}
        </div>

        <div className="flex items-center gap-3">
          {onBackToPersonal && (
            <button
              type="button"
              onClick={onBackToPersonal}
              className="px-4 py-2 bg-gray-100 hover:bg-gray-200 dark:bg-gray-800 dark:hover:bg-gray-700 text-gray-700 dark:text-gray-300 rounded-xl text-xs font-bold transition-colors cursor-pointer border border-gray-200 dark:border-gray-700"
            >
              Back to Details
            </button>
          )}

          <button
            type="button"
            onClick={handleSave}
            disabled={saving}
            className="flex items-center gap-2 px-6 py-2 bg-teal-600 hover:bg-teal-700 text-white rounded-xl text-xs font-bold transition-all shadow-md shadow-teal-600/20 active:scale-95 disabled:opacity-50 cursor-pointer"
          >
            {saving ? <Loader2 size={16} className="animate-spin" /> : <Save size={16} />}
            <span>{saving ? 'Saving...' : 'Save Schedule Changes'}</span>
          </button>
        </div>
      </div>
    </div>
  );
};

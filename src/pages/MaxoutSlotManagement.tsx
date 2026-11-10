import React, { useState, useEffect, useMemo } from 'react';
import { supabase } from '../lib/supabase';
import { Student, StudentMaxoutSlot, MaxoutDayOfWeek, MaxoutTimeSlot } from '../types';
import { MAXOUT_DAYS, MAXOUT_SLOTS, QUICK_REASONS } from '../components/StudentMaxoutSlotTracker';
import { toast } from 'sonner';
import { 
  Clock, 
  Search, 
  Download, 
  RefreshCw, 
  Filter, 
  Copy, 
  Check, 
  User, 
  CheckCircle2, 
  AlertCircle, 
  ChevronRight, 
  Calendar, 
  Users, 
  Sparkles,
  Phone,
  LayoutGrid,
  Table as TableIcon,
  X,
  Edit,
  Save
} from 'lucide-react';

interface StudentWithSchedule {
  student: Student;
  schedule: Record<MaxoutDayOfWeek, {
    status: 'attending' | 'cannot_attend' | 'not_set';
    slot: string | null;
    reason: string | null;
  }>;
  hasConfigured: boolean;
  attendingDaysCount: number;
  cannotAttendDaysCount: number;
}

export default function MaxoutSlotManagement() {
  const [students, setStudents] = useState<Student[]>([]);
  const [slotRecords, setSlotRecords] = useState<StudentMaxoutSlot[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);

  // Filters
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | 'configured' | 'full-attending' | 'has-absence' | 'not-configured'>('all');
  const [selectedDayFilter, setSelectedDayFilter] = useState<'all' | MaxoutDayOfWeek>('all');
  const [selectedBatchFilter, setSelectedBatchFilter] = useState<'all' | 'Batch 1' | 'Batch 2' | 'cannot_attend'>('all');
  const [batchYearFilter, setBatchYearFilter] = useState<string>('all');

  // View Mode: Table vs Mobile Cards
  const [viewMode, setViewMode] = useState<'table' | 'cards'>('table');

  // Copy feedback
  const [copiedKey, setCopiedKey] = useState<string | null>(null);

  // Admin Edit Modal
  const [editingStudentSchedule, setEditingStudentSchedule] = useState<StudentWithSchedule | null>(null);
  const [isSavingEdit, setIsSavingEdit] = useState(false);

  // Fetch data
  const fetchData = async () => {
    try {
      setIsRefreshing(true);

      // 1. Fetch Students
      let allStudents: Student[] = [];
      let sFrom = 0;
      while (true) {
        const { data, error } = await supabase
          .from('student')
          .select('*')
          .is('deleted_at', null)
          .order('pcaid')
          .range(sFrom, sFrom + 999);

        if (error || !data || data.length === 0) break;
        allStudents = allStudents.concat(data as Student[]);
        if (data.length < 1000) break;
        sFrom += 1000;
      }

      // 2. Fetch MaxouT Slot records
      const { data: slotsData, error: slotsErr } = await supabase
        .from('student_maxout_slots')
        .select('*');

      if (slotsErr) {
        console.warn('Note fetching student_maxout_slots:', slotsErr.message);
      }

      setStudents(allStudents);
      setSlotRecords((slotsData as StudentMaxoutSlot[]) || []);
    } catch (err: any) {
      console.error('Failed to load maxout slot data:', err);
      toast.error('Failed to load slots: ' + (err.message || 'Unknown error'));
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  // Compute available batch years
  const availableProperBatches = useMemo(() => {
    const set = new Set<string>();
    students.forEach(s => {
      if (s.proper_batch && s.proper_batch.trim()) {
        set.add(s.proper_batch.trim());
      }
    });
    return Array.from(set).sort();
  }, [students]);

  // Combine students with their slot records
  const studentSchedules: StudentWithSchedule[] = useMemo(() => {
    const studentMap = new Map<string, Student>();
    students.forEach(s => {
      if (s.pcaid) studentMap.set(s.pcaid.trim().toUpperCase(), s);
    });

    // Ensure any student who has slot records is included
    slotRecords.forEach(r => {
      const cleanPca = (r.pcaid || '').trim().toUpperCase();
      if (cleanPca && !studentMap.has(cleanPca)) {
        studentMap.set(cleanPca, {
          id: cleanPca,
          pcaid: cleanPca,
          name: r.student_name || cleanPca,
          proper_batch: 'MaxouT Project',
          phone: '-',
          mail: '-'
        } as Student);
      }
    });

    // Map slots by pcaid -> day -> record
    const slotsMap = new Map<string, Map<MaxoutDayOfWeek, StudentMaxoutSlot>>();
    slotRecords.forEach(r => {
      const cleanPca = (r.pcaid || '').trim().toUpperCase();
      if (!cleanPca || !r.day_of_week) return;

      if (!slotsMap.has(cleanPca)) {
        slotsMap.set(cleanPca, new Map<MaxoutDayOfWeek, StudentMaxoutSlot>());
      }
      slotsMap.get(cleanPca)!.set(r.day_of_week, r);
    });

    const allMergedStudents = Array.from(studentMap.values());

    return allMergedStudents.map(s => {
      const cleanPca = (s.pcaid || '').trim().toUpperCase();
      const studentDayMap = slotsMap.get(cleanPca);

      const schedule: Record<MaxoutDayOfWeek, {
        status: 'attending' | 'cannot_attend' | 'not_set';
        slot: string | null;
        reason: string | null;
      }> = {
        Monday: { status: 'not_set', slot: null, reason: null },
        Tuesday: { status: 'not_set', slot: null, reason: null },
        Wednesday: { status: 'not_set', slot: null, reason: null },
        Thursday: { status: 'not_set', slot: null, reason: null },
        Friday: { status: 'not_set', slot: null, reason: null },
        Saturday: { status: 'not_set', slot: null, reason: null }
      };

      let configuredCount = 0;
      let attendingDaysCount = 0;
      let cannotAttendDaysCount = 0;

      MAXOUT_DAYS.forEach(day => {
        const record = studentDayMap?.get(day);
        if (record) {
          configuredCount++;
          if (record.status === 'cannot_attend') {
            schedule[day] = {
              status: 'cannot_attend',
              slot: null,
              reason: record.reason || 'Unable to join'
            };
            cannotAttendDaysCount++;
          } else {
            const rawSlot = record.slot;
            let resolvedSlot = 'Batch 1: 4.30 PM - 6.00 PM';
            if (rawSlot) {
              if (rawSlot.includes('9.30') || rawSlot.includes('11.00') || rawSlot.includes('Batch 3') || rawSlot.includes('Batch 02') || (rawSlot.includes('Batch 2') && !rawSlot.includes('8.00'))) {
                resolvedSlot = 'Batch 2: 9.30 PM - 11.00 PM';
              } else {
                resolvedSlot = 'Batch 1: 4.30 PM - 6.00 PM';
              }
            }
            schedule[day] = {
              status: 'attending',
              slot: resolvedSlot,
              reason: null
            };
            attendingDaysCount++;
          }
        }
      });

      return {
        student: s,
        schedule,
        hasConfigured: configuredCount > 0,
        attendingDaysCount,
        cannotAttendDaysCount
      };
    });
  }, [students, slotRecords]);

  // Filtered Student List
  const filteredList = useMemo(() => {
    return studentSchedules.filter(item => {
      // 1. Text Search (PCA ID, Name, Phone, Reasons)
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase().trim();
        const matchPca = (item.student.pcaid || '').toLowerCase().includes(q);
        const matchName = ([item.student.name, item.student.last_name].filter(Boolean).join(' ')).toLowerCase().includes(q);
        const matchPhone = (item.student.phone || '').includes(q);
        
        // Search in reasons
        const matchReason = MAXOUT_DAYS.some(d => 
          (item.schedule[d].reason || '').toLowerCase().includes(q)
        );

        if (!matchPca && !matchName && !matchPhone && !matchReason) {
          return false;
        }
      }

      // 2. Status Filter
      if (statusFilter === 'configured' && !item.hasConfigured) return false;
      if (statusFilter === 'not-configured' && item.hasConfigured) return false;
      if (statusFilter === 'full-attending' && (item.attendingDaysCount !== 6 || !item.hasConfigured)) return false;
      if (statusFilter === 'has-absence' && (item.cannotAttendDaysCount === 0 || !item.hasConfigured)) return false;

      // 3. Batch Year
      if (batchYearFilter !== 'all') {
        if ((item.student.proper_batch || '').trim() !== batchYearFilter) {
          return false;
        }
      }

      // 4. Day & Specific Batch Filter
      if (selectedDayFilter !== 'all') {
        const dayState = item.schedule[selectedDayFilter];
        if (selectedBatchFilter === 'cannot_attend') {
          if (dayState.status !== 'cannot_attend') return false;
        } else if (selectedBatchFilter !== 'all') {
          if (dayState.status !== 'attending' || !(dayState.slot || '').includes(selectedBatchFilter)) {
            return false;
          }
        }
      } else if (selectedBatchFilter !== 'all') {
        // If 'all' days selected, check if student attends that batch on ANY day
        if (selectedBatchFilter === 'cannot_attend') {
          if (item.cannotAttendDaysCount === 0) return false;
        } else {
          const attendsBatchAnyDay = MAXOUT_DAYS.some(d => 
            item.schedule[d].status === 'attending' && (item.schedule[d].slot || '').includes(selectedBatchFilter)
          );
          if (!attendsBatchAnyDay) return false;
        }
      }

      return true;
    });
  }, [studentSchedules, searchQuery, statusFilter, batchYearFilter, selectedDayFilter, selectedBatchFilter]);

  // Overall Statistics
  const stats = useMemo(() => {
    const totalStudents = students.length;
    const configuredCount = studentSchedules.filter(s => s.hasConfigured).length;
    const fullAttendanceCount = studentSchedules.filter(s => s.hasConfigured && s.attendingDaysCount === 6).length;
    const hasAbsenceCount = studentSchedules.filter(s => s.hasConfigured && s.cannotAttendDaysCount > 0).length;

    // Per day breakdown
    const dayStats: Record<MaxoutDayOfWeek, { batch1: number; batch2: number; unable: number }> = {
      Monday: { batch1: 0, batch2: 0, unable: 0 },
      Tuesday: { batch1: 0, batch2: 0, unable: 0 },
      Wednesday: { batch1: 0, batch2: 0, unable: 0 },
      Thursday: { batch1: 0, batch2: 0, unable: 0 },
      Friday: { batch1: 0, batch2: 0, unable: 0 },
      Saturday: { batch1: 0, batch2: 0, unable: 0 }
    };

    studentSchedules.forEach(item => {
      if (!item.hasConfigured) return;
      MAXOUT_DAYS.forEach(d => {
        const st = item.schedule[d];
        if (st.status === 'cannot_attend') {
          dayStats[d].unable++;
        } else if (st.status === 'attending') {
          if ((st.slot || '').includes('Batch 1') || (st.slot || '').includes('4.30')) dayStats[d].batch1++;
          else dayStats[d].batch2++;
        }
      });
    });

    return {
      totalStudents,
      configuredCount,
      fullAttendanceCount,
      hasAbsenceCount,
      dayStats
    };
  }, [students, studentSchedules]);

  // Export to CSV Function
  const handleExportCSV = () => {
    if (filteredList.length === 0) {
      toast.info('No records to export');
      return;
    }

    const headers = [
      'PCA ID',
      'Student Name',
      'Phone',
      'Proper Batch',
      'Monday',
      'Tuesday',
      'Wednesday',
      'Thursday',
      'Friday',
      'Saturday',
      'Attending Days',
      'Cannot Join Days',
      'Status'
    ];

    const rows = filteredList.map(item => {
      const getDayText = (day: MaxoutDayOfWeek) => {
        const dayState = item.schedule[day];
        if (dayState.status === 'attending') {
          return dayState.slot || 'Attending';
        } else if (dayState.status === 'cannot_attend') {
          return `Unable to join, ${dayState.reason || 'Absent'}`;
        }
        return 'Not Configured';
      };

      const fullName = [item.student.name, item.student.last_name].filter(Boolean).join(' ') || item.student.pcaid;
      const statusText = !item.hasConfigured 
        ? 'Not Configured' 
        : item.attendingDaysCount === 6 
        ? 'Full Attendance (6/6)' 
        : `${item.attendingDaysCount}/6 Attending (${item.cannotAttendDaysCount} Absence)`;

      return [
        item.student.pcaid,
        fullName,
        item.student.phone || '-',
        item.student.proper_batch || '-',
        getDayText('Monday'),
        getDayText('Tuesday'),
        getDayText('Wednesday'),
        getDayText('Thursday'),
        getDayText('Friday'),
        getDayText('Saturday'),
        item.attendingDaysCount,
        item.cannotAttendDaysCount,
        statusText
      ];
    });

    // Generate CSV content
    const csvContent = [
      headers.map(h => `"${h.replace(/"/g, '""')}"`).join(','),
      ...rows.map(row => row.map(cell => `"${String(cell || '').replace(/"/g, '""')}"`).join(','))
    ].join('\r\n');

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    const dateStr = new Date().toISOString().split('T')[0];
    link.href = url;
    link.setAttribute('download', `MaxouT_Slots_Report_${dateStr}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);

    toast.success(`Exported ${filteredList.length} student slot record(s) to CSV!`);
  };

  const handleCopyPcaid = (pcaid: string, e: React.MouseEvent) => {
    e.stopPropagation();
    navigator.clipboard.writeText(pcaid);
    setCopiedKey(pcaid);
    toast.success(`Copied PCA ID: ${pcaid}`);
    setTimeout(() => setCopiedKey(null), 2000);
  };

  // Admin Save Edited Student Schedule
  const handleSaveEditedSchedule = async () => {
    if (!editingStudentSchedule) return;

    setIsSavingEdit(true);
    const cleanPcaid = editingStudentSchedule.student.pcaid.trim().toUpperCase();
    const studentFullName = [editingStudentSchedule.student.name, editingStudentSchedule.student.last_name].filter(Boolean).join(' ') || cleanPcaid;
    const nowIso = new Date().toISOString();

    const rows: StudentMaxoutSlot[] = MAXOUT_DAYS.map(day => {
      const st = editingStudentSchedule.schedule[day];
      return {
        pcaid: cleanPcaid,
        student_name: studentFullName,
        day_of_week: day,
        status: st.status === 'cannot_attend' ? 'cannot_attend' : 'attending',
        slot: st.status === 'attending' ? (st.slot || 'Batch 1: 4.30 PM - 6.00 PM') : null,
        reason: st.status === 'cannot_attend' ? (st.reason || 'Unable to join') : null,
        updated_at: nowIso
      };
    });

    try {
      const { error } = await supabase
        .from('student_maxout_slots')
        .upsert(rows, { onConflict: 'pcaid,day_of_week' });

      if (error) {
        throw error;
      }

      toast.success(`Updated slot details for ${cleanPcaid}!`);
      setEditingStudentSchedule(null);
      await fetchData();
    } catch (err: any) {
      console.error('Failed to update student slots:', err);
      toast.error('Failed to update: ' + (err.message || 'Unknown error'));
    } finally {
      setIsSavingEdit(false);
    }
  };

  // Helper to render cell display for a day
  const renderDayCell = (dayState: { status: string; slot: string | null; reason: string | null }) => {
    if (dayState.status === 'attending') {
      const slotText = dayState.slot || 'Batch 1: 4.30 PM - 6.00 PM';
      const isBatch2 = slotText.includes('Batch 2') || slotText.includes('9.30');

      const badgeStyle = isBatch2
        ? 'bg-teal-100/70 dark:bg-teal-950/60 text-teal-800 dark:text-teal-200 border-teal-300/80 dark:border-teal-700/60 font-black'
        : 'bg-teal-50 dark:bg-teal-950/40 text-teal-700 dark:text-teal-300 border-teal-200 dark:border-teal-800/60';

      return (
        <div className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg border text-xs font-bold leading-tight ${badgeStyle}`}>
          <Clock size={12} className="shrink-0 text-teal-600 dark:text-teal-400" />
          <span className="truncate max-w-[170px]" title={slotText}>{slotText}</span>
        </div>
      );
    }

    if (dayState.status === 'cannot_attend') {
      const reason = dayState.reason || 'Unable to join';
      return (
        <div 
          className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg border text-xs font-semibold bg-rose-50 dark:bg-rose-950/40 text-rose-700 dark:text-rose-400 border-rose-200 dark:border-rose-800/60 leading-tight"
          title={`Unable to join, ${reason}`}
        >
          <AlertCircle size={12} className="text-rose-600 dark:text-rose-400 shrink-0" />
          <span className="truncate max-w-[190px]">
            Unable to join, {reason}
          </span>
        </div>
      );
    }

    return (
      <span className="text-gray-400 dark:text-gray-600 text-xs italic font-medium">
        &mdash;
      </span>
    );
  };

  return (
    <div className="space-y-5 p-2 sm:p-4 lg:p-6 max-w-[1600px] mx-auto">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-2xl p-5 sm:p-6 shadow-xs">
        <div className="space-y-1.5">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="px-2.5 py-0.5 bg-teal-600 text-white rounded-full text-[10px] font-black uppercase tracking-wider shadow-xs">
              Class Time Allocation
            </span>
            <span className="px-2.5 py-0.5 bg-teal-50 dark:bg-teal-950/50 border border-teal-200 dark:border-teal-800/60 text-teal-700 dark:text-teal-300 rounded-full text-xs font-bold">
              F to A MaxouT Project
            </span>
            <span className="px-2.5 py-0.5 bg-gray-100 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 text-gray-700 dark:text-gray-300 rounded-full text-xs font-medium">
              6 Days (Mon &ndash; Sat)
            </span>
          </div>
          <h1 className="text-xl sm:text-2xl font-black text-gray-900 dark:text-white tracking-tight">
            MaxouT Slots
          </h1>
          <p className="text-xs text-gray-500 dark:text-gray-400">
            View student weekly slot selections, attendance distribution, and reasons for absence.
          </p>
        </div>

        {/* Top Actions */}
        <div className="flex items-center gap-2.5 flex-wrap">
          <button
            type="button"
            onClick={fetchData}
            disabled={isRefreshing}
            className="px-3.5 py-2 bg-gray-50 dark:bg-gray-800 hover:bg-gray-100 dark:hover:bg-gray-750 text-gray-700 dark:text-gray-200 border border-gray-200 dark:border-gray-700 rounded-xl text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5 shadow-2xs"
            title="Refresh database records"
          >
            <RefreshCw size={14} className={isRefreshing ? 'animate-spin text-teal-600' : ''} />
            <span>Refresh</span>
          </button>

          <button
            type="button"
            onClick={handleExportCSV}
            disabled={filteredList.length === 0}
            className="px-4 py-2 bg-teal-600 hover:bg-teal-700 active:scale-95 text-white rounded-xl text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5 shadow-xs disabled:opacity-50"
            title="Export filtered records to CSV"
          >
            <Download size={14} />
            <span>Export CSV</span>
          </button>
        </div>
      </div>

      {/* KPI Stats Bar - System Colors */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-2xl p-4 shadow-xs">
          <div className="text-[10px] font-bold uppercase tracking-wider text-gray-500 dark:text-gray-400 flex items-center gap-1.5">
            <Users size={13} className="text-teal-600 dark:text-teal-400" />
            <span>Enrolled Students</span>
          </div>
          <div className="text-2xl font-black text-gray-900 dark:text-white mt-1">
            {stats.totalStudents}
          </div>
          <p className="text-[10px] text-gray-400 mt-0.5">Total registered students</p>
        </div>

        <div className="bg-white dark:bg-gray-900 border border-teal-200/80 dark:border-teal-800/60 rounded-2xl p-4 shadow-xs">
          <div className="text-[10px] font-bold uppercase tracking-wider text-teal-700 dark:text-teal-400 flex items-center gap-1.5">
            <CheckCircle2 size={13} className="text-teal-600 dark:text-teal-400" />
            <span>Slots Configured</span>
          </div>
          <div className="text-2xl font-black text-teal-700 dark:text-teal-300 mt-1">
            {stats.configuredCount}
          </div>
          <p className="text-[10px] text-teal-600/80 dark:text-teal-400/80 mt-0.5">
            {stats.totalStudents > 0 ? Math.round((stats.configuredCount / stats.totalStudents) * 100) : 0}% completion
          </p>
        </div>

        <div className="bg-white dark:bg-gray-900 border border-teal-200/80 dark:border-teal-800/60 rounded-2xl p-4 shadow-xs">
          <div className="text-[10px] font-bold uppercase tracking-wider text-teal-700 dark:text-teal-400 flex items-center gap-1.5">
            <Sparkles size={13} className="text-teal-600 dark:text-teal-400" />
            <span>Full Attendance (6/6)</span>
          </div>
          <div className="text-2xl font-black text-teal-700 dark:text-teal-300 mt-1">
            {stats.fullAttendanceCount}
          </div>
          <p className="text-[10px] text-teal-600/80 dark:text-teal-400/80 mt-0.5">
            Attends all 6 program days
          </p>
        </div>

        <div className="bg-white dark:bg-gray-900 border border-rose-200/80 dark:border-rose-800/60 rounded-2xl p-4 shadow-xs">
          <div className="text-[10px] font-bold uppercase tracking-wider text-rose-700 dark:text-rose-400 flex items-center gap-1.5">
            <AlertCircle size={13} className="text-rose-600 dark:text-rose-400" />
            <span>Has Reported Absences</span>
          </div>
          <div className="text-2xl font-black text-rose-700 dark:text-rose-400 mt-1">
            {stats.hasAbsenceCount}
          </div>
          <p className="text-[10px] text-rose-600/80 dark:text-rose-400/80 mt-0.5">
            Unable to join on 1+ days
          </p>
        </div>
      </div>

      {/* Filter and Search Bar */}
      <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-2xl p-4 sm:p-5 shadow-xs space-y-3">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3">
          {/* Quick Search */}
          <div className="lg:col-span-2 relative">
            <label className="block text-[10px] font-black uppercase text-gray-500 tracking-wider mb-1">
              Search Students / Reasons
            </label>
            <div className="relative">
              <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search by PCA ID, Name, Phone, or Reason (Chemistry, Bio...)"
                className="w-full h-9 pl-9 pr-3 text-xs bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl outline-none focus:ring-2 focus:ring-teal-500 text-gray-900 dark:text-gray-100"
              />
            </div>
          </div>

          {/* Status Filter */}
          <div>
            <label className="block text-[10px] font-black uppercase text-gray-500 tracking-wider mb-1">
              Attendance Status
            </label>
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value as any)}
              className="w-full h-9 px-2.5 text-xs bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl font-semibold text-gray-800 dark:text-gray-200 outline-none focus:ring-2 focus:ring-teal-500"
            >
              <option value="all">All Statuses ({studentSchedules.length})</option>
              <option value="configured">Slots Configured ({stats.configuredCount})</option>
              <option value="full-attending">Full Attendance (6/6 days)</option>
              <option value="has-absence">Has Absence / Unable to Join</option>
              <option value="not-configured">Not Configured ({stats.totalStudents - stats.configuredCount})</option>
            </select>
          </div>

          {/* Day Filter */}
          <div>
            <label className="block text-[10px] font-black uppercase text-gray-500 tracking-wider mb-1">
              Filter by Day
            </label>
            <select
              value={selectedDayFilter}
              onChange={(e) => setSelectedDayFilter(e.target.value as any)}
              className="w-full h-9 px-2.5 text-xs bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl font-semibold text-gray-800 dark:text-gray-200 outline-none focus:ring-2 focus:ring-teal-500"
            >
              <option value="all">All Days (Mon &ndash; Sat)</option>
              {MAXOUT_DAYS.map(day => (
                <option key={day} value={day}>{day}</option>
              ))}
            </select>
          </div>

          {/* Batch Filter */}
          <div>
            <label className="block text-[10px] font-black uppercase text-gray-500 tracking-wider mb-1">
              Specific Batch / Absence
            </label>
            <select
              value={selectedBatchFilter}
              onChange={(e) => setSelectedBatchFilter(e.target.value as any)}
              className="w-full h-9 px-2.5 text-xs bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl font-semibold text-gray-800 dark:text-gray-200 outline-none focus:ring-2 focus:ring-teal-500"
            >
              <option value="all">All Batches</option>
              <option value="Batch 1">Batch 01 (4.30 PM - 6.00 PM)</option>
              <option value="Batch 2">Batch 02 (9.30 PM - 11.00 PM)</option>
              <option value="cannot_attend">Unable to Join</option>
            </select>
          </div>
        </div>

        {/* View Toggle & Active Filter Count */}
        <div className="flex items-center justify-between pt-2 border-t border-gray-100 dark:border-gray-800 text-xs">
          <div className="flex items-center gap-2 text-gray-500 dark:text-gray-400">
            <span>Showing <strong className="text-gray-900 dark:text-white">{filteredList.length}</strong> of {studentSchedules.length} students</span>
            {searchQuery && (
              <button
                type="button"
                onClick={() => setSearchQuery('')}
                className="text-teal-600 hover:underline cursor-pointer text-[11px]"
              >
                Clear search
              </button>
            )}
          </div>

          {/* Table / Cards toggle for mobile and responsive preferences */}
          <div className="flex items-center gap-1 p-0.5 bg-gray-100 dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700">
            <button
              type="button"
              onClick={() => setViewMode('table')}
              className={`px-2.5 py-1 rounded-md text-xs font-bold transition-all cursor-pointer flex items-center gap-1 ${
                viewMode === 'table'
                  ? 'bg-white dark:bg-gray-900 text-teal-700 dark:text-teal-300 shadow-2xs font-black'
                  : 'text-gray-500 hover:text-gray-800 dark:hover:text-gray-200'
              }`}
              title="Table view"
            >
              <TableIcon size={13} />
              <span className="hidden sm:inline">Table</span>
            </button>
            <button
              type="button"
              onClick={() => setViewMode('cards')}
              className={`px-2.5 py-1 rounded-md text-xs font-bold transition-all cursor-pointer flex items-center gap-1 ${
                viewMode === 'cards'
                  ? 'bg-white dark:bg-gray-900 text-teal-700 dark:text-teal-300 shadow-2xs font-black'
                  : 'text-gray-500 hover:text-gray-800 dark:hover:text-gray-200'
              }`}
              title="Cards view"
            >
              <LayoutGrid size={13} />
              <span className="hidden sm:inline">Cards</span>
            </button>
          </div>
        </div>
      </div>

      {/* Main Content Area */}
      {isLoading ? (
        <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-2xl p-16 text-center shadow-xs">
          <RefreshCw className="w-8 h-8 text-teal-600 dark:text-teal-400 animate-spin mx-auto mb-3" />
          <p className="text-sm font-semibold text-gray-700 dark:text-gray-300">
            Loading student slot details...
          </p>
        </div>
      ) : filteredList.length === 0 ? (
        <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-2xl p-16 text-center shadow-xs space-y-2">
          <Clock className="w-10 h-10 text-gray-400 mx-auto mb-2" />
          <h3 className="text-base font-bold text-gray-800 dark:text-gray-200">No matching student slots found</h3>
          <p className="text-xs text-gray-500 dark:text-gray-400 max-w-md mx-auto">
            Try adjusting your search criteria or resetting filters to view all students.
          </p>
        </div>
      ) : viewMode === 'table' ? (
        /* TABLE VIEW (Responsive horizontal scroll with columns for each day) */
        <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-2xl shadow-xs overflow-hidden">
          <div className="overflow-x-auto scrollbar-thin">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="bg-gray-50 dark:bg-gray-800/80 text-gray-500 dark:text-gray-400 font-bold border-b border-gray-200 dark:border-gray-700 text-[10px] uppercase tracking-wider whitespace-nowrap">
                  <th className="py-3 px-3.5 sticky left-0 z-20 bg-gray-50 dark:bg-gray-800 shadow-[1px_0_0_0_rgba(0,0,0,0.05)]">
                    PCA ID
                  </th>
                  <th className="py-3 px-3.5 sticky left-[110px] z-20 bg-gray-50 dark:bg-gray-800 shadow-[1px_0_0_0_rgba(0,0,0,0.05)]">
                    Student Name
                  </th>
                  <th className="py-3 px-3 text-center min-w-[170px]">Monday</th>
                  <th className="py-3 px-3 text-center min-w-[170px]">Tuesday</th>
                  <th className="py-3 px-3 text-center min-w-[170px]">Wednesday</th>
                  <th className="py-3 px-3 text-center min-w-[170px]">Thursday</th>
                  <th className="py-3 px-3 text-center min-w-[170px]">Friday</th>
                  <th className="py-3 px-3 text-center min-w-[170px]">Saturday</th>
                  <th className="py-3 px-3 text-center min-w-[110px]">Weekly Rate</th>
                  <th className="py-3 px-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
                {filteredList.map((item) => {
                  const fullName = [item.student.name, item.student.last_name].filter(Boolean).join(' ') || item.student.pcaid;

                  return (
                    <tr 
                      key={item.student.pcaid} 
                      className="hover:bg-teal-50/30 dark:hover:bg-teal-950/20 transition-colors group"
                    >
                      {/* PCA ID (Sticky on desktop) */}
                      <td className="py-2.5 px-3.5 sticky left-0 z-10 bg-white dark:bg-gray-900 group-hover:bg-teal-50/40 dark:group-hover:bg-gray-850 transition-colors shadow-[1px_0_0_0_rgba(0,0,0,0.05)] font-mono font-bold text-gray-900 dark:text-gray-100 whitespace-nowrap">
                        <button
                          type="button"
                          onClick={(e) => handleCopyPcaid(item.student.pcaid, e)}
                          className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-lg text-xs font-mono font-bold text-gray-800 dark:text-gray-200 hover:bg-teal-100 dark:hover:bg-teal-950/80 transition-colors cursor-pointer border border-transparent hover:border-teal-300"
                          title="Click to copy PCA ID"
                        >
                          <span>{item.student.pcaid}</span>
                          {copiedKey === item.student.pcaid ? (
                            <Check size={11} className="text-teal-600 dark:text-teal-400" />
                          ) : (
                            <Copy size={11} className="text-gray-400 group-hover:text-teal-600" />
                          )}
                        </button>
                      </td>

                      {/* Student Name */}
                      <td className="py-2.5 px-3.5 sticky left-[110px] z-10 bg-white dark:bg-gray-900 group-hover:bg-teal-50/40 dark:group-hover:bg-gray-850 transition-colors shadow-[1px_0_0_0_rgba(0,0,0,0.05)] whitespace-nowrap">
                        <div className="font-bold text-gray-900 dark:text-gray-100 max-w-[160px] truncate" title={fullName}>
                          {fullName}
                        </div>
                        <div className="text-[10px] text-gray-400 flex items-center gap-1">
                          <span>{item.student.proper_batch || 'General'}</span>
                          {item.student.phone && (
                            <>
                              <span>&bull;</span>
                              <span>{item.student.phone}</span>
                            </>
                          )}
                        </div>
                      </td>

                      {/* Monday */}
                      <td className="py-2 px-3 text-center whitespace-nowrap">
                        {renderDayCell(item.schedule.Monday)}
                      </td>

                      {/* Tuesday */}
                      <td className="py-2 px-3 text-center whitespace-nowrap">
                        {renderDayCell(item.schedule.Tuesday)}
                      </td>

                      {/* Wednesday */}
                      <td className="py-2 px-3 text-center whitespace-nowrap">
                        {renderDayCell(item.schedule.Wednesday)}
                      </td>

                      {/* Thursday */}
                      <td className="py-2 px-3 text-center whitespace-nowrap">
                        {renderDayCell(item.schedule.Thursday)}
                      </td>

                      {/* Friday */}
                      <td className="py-2 px-3 text-center whitespace-nowrap">
                        {renderDayCell(item.schedule.Friday)}
                      </td>

                      {/* Saturday */}
                      <td className="py-2 px-3 text-center whitespace-nowrap">
                        {renderDayCell(item.schedule.Saturday)}
                      </td>

                      {/* Weekly Rate */}
                      <td className="py-2.5 px-3 text-center whitespace-nowrap">
                        {item.hasConfigured ? (
                          <span className={`inline-block px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider ${
                            item.attendingDaysCount === 6
                              ? 'bg-teal-50 dark:bg-teal-950/50 text-teal-700 dark:text-teal-300 border border-teal-200 dark:border-teal-800/60'
                              : 'bg-rose-50 dark:bg-rose-950/50 text-rose-700 dark:text-rose-400 border border-rose-200 dark:border-rose-800/60'
                          }`}>
                            {item.attendingDaysCount}/6 Days
                          </span>
                        ) : (
                          <span className="text-[10px] text-gray-400 font-semibold">Not Set</span>
                        )}
                      </td>

                      {/* Actions */}
                      <td className="py-2.5 px-3 text-right whitespace-nowrap">
                        <button
                          type="button"
                          onClick={() => setEditingStudentSchedule(item)}
                          className="px-2.5 py-1 text-xs font-bold text-teal-700 dark:text-teal-300 hover:bg-teal-50 dark:hover:bg-teal-950/60 rounded-lg transition-colors cursor-pointer border border-teal-200 dark:border-teal-800/60"
                        >
                          Edit Slots
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      ) : (
        /* MOBILE CARDS VIEW */
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {filteredList.map((item) => {
            const fullName = [item.student.name, item.student.last_name].filter(Boolean).join(' ') || item.student.pcaid;

            return (
              <div 
                key={item.student.pcaid}
                className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-2xl p-4 sm:p-5 shadow-xs space-y-3"
              >
                <div className="flex items-center justify-between gap-2 border-b border-gray-100 dark:border-gray-800 pb-2.5">
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="font-mono font-black text-sm text-teal-700 dark:text-teal-400">
                        {item.student.pcaid}
                      </span>
                      <span className={`px-2 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider ${
                        item.attendingDaysCount === 6
                          ? 'bg-teal-50 dark:bg-teal-950/50 text-teal-700 dark:text-teal-300 border border-teal-200 dark:border-teal-800/60'
                          : item.hasConfigured
                          ? 'bg-rose-50 dark:bg-rose-950/50 text-rose-700 dark:text-rose-400 border border-rose-200 dark:border-rose-800/60'
                          : 'bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300'
                      }`}>
                        {item.hasConfigured ? `${item.attendingDaysCount}/6 Days Attending` : 'Not Configured'}
                      </span>
                    </div>
                    <h4 className="text-sm font-bold text-gray-900 dark:text-white mt-0.5" title={fullName}>
                      {fullName}
                    </h4>
                  </div>

                  <button
                    type="button"
                    onClick={() => setEditingStudentSchedule(item)}
                    className="p-1.5 text-teal-600 hover:bg-teal-50 dark:hover:bg-teal-950/60 rounded-lg cursor-pointer"
                    title="Edit slots"
                  >
                    <Edit size={16} />
                  </button>
                </div>

                {/* Day-by-day pills */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs">
                  {MAXOUT_DAYS.map(day => (
                    <div key={day} className="flex flex-col p-2 bg-gray-50 dark:bg-gray-800/50 rounded-xl border border-gray-100 dark:border-gray-700/60">
                      <span className="text-[10px] font-black uppercase tracking-wider text-gray-500 dark:text-gray-400 mb-1">
                        {day}
                      </span>
                      <div>
                        {renderDayCell(item.schedule[day])}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Admin Edit Modal */}
      {editingStudentSchedule && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-gray-900/60 dark:bg-gray-950/80 backdrop-blur-xs">
          <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-2xl max-w-2xl w-full max-h-[90vh] overflow-hidden flex flex-col shadow-xl">
            {/* Modal Header */}
            <div className="px-6 py-4 bg-teal-50 dark:bg-teal-950/40 border-b border-teal-100 dark:border-teal-900/60 flex items-center justify-between">
              <div>
                <h3 className="text-base font-bold text-teal-950 dark:text-teal-200">
                  Edit Weekly Slots for {editingStudentSchedule.student.pcaid}
                </h3>
                <p className="text-xs text-teal-700 dark:text-teal-400">
                  {[editingStudentSchedule.student.name, editingStudentSchedule.student.last_name].filter(Boolean).join(' ')}
                </p>
              </div>
              <button
                type="button"
                onClick={() => setEditingStudentSchedule(null)}
                className="p-1.5 text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 rounded-lg cursor-pointer"
              >
                <X size={18} />
              </button>
            </div>

            {/* Modal Body */}
            <div className="p-6 overflow-y-auto space-y-4 flex-1 scrollbar-thin">
              {MAXOUT_DAYS.map(day => {
                const dayState = editingStudentSchedule.schedule[day];
                const isAttending = dayState.status === 'attending';

                return (
                  <div key={day} className="p-3.5 bg-gray-50 dark:bg-gray-800/60 border border-gray-200 dark:border-gray-700 rounded-xl space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="font-bold text-xs text-gray-900 dark:text-white">
                        {day}
                      </span>
                      <div className="flex items-center gap-1">
                        <button
                          type="button"
                          onClick={() => {
                            setEditingStudentSchedule(prev => {
                              if (!prev) return null;
                              return {
                                ...prev,
                                schedule: {
                                  ...prev.schedule,
                                  [day]: {
                                    status: 'attending',
                                    slot: prev.schedule[day].slot || 'Batch 1: 4.30 PM - 6.00 PM',
                                    reason: null
                                  }
                                }
                              };
                            });
                          }}
                          className={`px-2.5 py-1 text-xs rounded-lg font-bold cursor-pointer transition-all ${
                            isAttending
                              ? 'bg-teal-600 text-white shadow-2xs'
                              : 'bg-white dark:bg-gray-700 text-gray-600 dark:text-gray-300'
                          }`}
                        >
                          Attending
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            setEditingStudentSchedule(prev => {
                              if (!prev) return null;
                              return {
                                ...prev,
                                schedule: {
                                  ...prev.schedule,
                                  [day]: {
                                    status: 'cannot_attend',
                                    slot: null,
                                    reason: prev.schedule[day].reason || 'Chemistry Class'
                                  }
                                }
                              };
                            });
                          }}
                          className={`px-2.5 py-1 text-xs rounded-lg font-bold cursor-pointer transition-all ${
                            !isAttending
                              ? 'bg-rose-600 text-white shadow-2xs font-black'
                              : 'bg-white dark:bg-gray-700 text-gray-600 dark:text-gray-300'
                          }`}
                        >
                          Cannot Join
                        </button>
                      </div>
                    </div>

                    {isAttending ? (
                      <select
                        value={dayState.slot || 'Batch 1: 4.30 PM - 6.00 PM'}
                        onChange={(e) => {
                          const val = e.target.value;
                          setEditingStudentSchedule(prev => {
                            if (!prev) return null;
                            return {
                              ...prev,
                              schedule: {
                                ...prev.schedule,
                                [day]: { ...prev.schedule[day], slot: val }
                              }
                            };
                          });
                        }}
                        className="w-full p-2 text-xs bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-lg text-gray-900 dark:text-white focus:ring-2 focus:ring-teal-500/20 focus:border-teal-500"
                      >
                        {MAXOUT_SLOTS.map(s => (
                          <option key={s.id} value={s.id}>{s.id}</option>
                        ))}
                      </select>
                    ) : (
                      <div className="space-y-1.5">
                        <div className="flex flex-wrap gap-1">
                          {QUICK_REASONS.map(r => (
                            <button
                              key={r}
                              type="button"
                              onClick={() => {
                                setEditingStudentSchedule(prev => {
                                  if (!prev) return null;
                                  return {
                                    ...prev,
                                    schedule: {
                                      ...prev.schedule,
                                      [day]: { ...prev.schedule[day], reason: r }
                                    }
                                  };
                                });
                              }}
                              className={`px-2 py-0.5 text-[10px] rounded border cursor-pointer font-medium ${
                                dayState.reason === r
                                  ? 'bg-rose-600 text-white border-rose-600 font-bold'
                                  : 'bg-white dark:bg-gray-900 text-gray-700 dark:text-gray-300 border-gray-200 dark:border-gray-700 hover:border-rose-300'
                              }`}
                            >
                              {r}
                            </button>
                          ))}
                        </div>
                        <input
                          type="text"
                          value={dayState.reason || ''}
                          onChange={(e) => {
                            const val = e.target.value;
                            setEditingStudentSchedule(prev => {
                              if (!prev) return null;
                              return {
                                ...prev,
                                schedule: {
                                  ...prev.schedule,
                                  [day]: { ...prev.schedule[day], reason: val }
                                }
                              };
                            });
                          }}
                          placeholder="Reason for absence..."
                          className="w-full p-2 text-xs bg-white dark:bg-gray-900 border border-rose-300 dark:border-rose-800 rounded-lg text-gray-900 dark:text-white focus:ring-2 focus:ring-rose-500/20 focus:border-rose-500"
                        />
                      </div>
                    )}
                  </div>
                );
              })}
            </div>

            {/* Modal Footer */}
            <div className="p-4 bg-gray-50 dark:bg-gray-850 border-t border-gray-200 dark:border-gray-700 flex items-center justify-end gap-2">
              <button
                type="button"
                onClick={() => setEditingStudentSchedule(null)}
                className="px-4 py-2 text-xs font-semibold text-gray-600 dark:text-gray-300 hover:bg-gray-100 rounded-xl cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleSaveEditedSchedule}
                disabled={isSavingEdit}
                className="px-5 py-2 bg-teal-600 hover:bg-teal-700 text-white text-xs font-bold rounded-xl flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
              >
                {isSavingEdit ? <RefreshCw size={13} className="animate-spin" /> : <Save size={13} />}
                <span>Save Changes</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

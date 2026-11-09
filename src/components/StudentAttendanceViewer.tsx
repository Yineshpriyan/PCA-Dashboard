import React, { useState, useEffect, useMemo } from 'react';
import { 
  UserCheck, 
  Calendar as CalendarIcon, 
  Clock, 
  CheckCircle2, 
  AlertCircle, 
  XCircle, 
  ShieldCheck, 
  ChevronLeft, 
  ChevronRight, 
  Sparkles, 
  BarChart3, 
  Info,
  X,
  Layers,
  Filter
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { supabase } from '../lib/supabase';
import { StudentAttendance, AttendanceStatus } from '../types';
import { formatTimeDisplay } from '../lib/dateUtils';

interface StudentAttendanceViewerProps {
  pcaid: string;
}

export default function StudentAttendanceViewer({ pcaid }: StudentAttendanceViewerProps) {
  const [records, setRecords] = useState<StudentAttendance[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [selectedRecord, setSelectedRecord] = useState<StudentAttendance | null>(null);

  // Calendar State
  const [currentMonthDate, setCurrentMonthDate] = useState(() => new Date());

  // Filters for session history list
  const [filterClassType, setFilterClassType] = useState('all');
  const [filterStatus, setFilterStatus] = useState('all');

  useEffect(() => {
    if (!pcaid) return;

    const fetchAttendance = async () => {
      setIsLoading(true);
      try {
        const { data, error } = await supabase
          .from('student_attendance')
          .select('*')
          .eq('pcaid', pcaid)
          .order('session_date', { ascending: false });

        if (error) throw error;
        setRecords((data as StudentAttendance[]) || []);
      } catch (err) {
        console.error('Error fetching student attendance:', err);
      } finally {
        setIsLoading(false);
      }
    };

    fetchAttendance();
  }, [pcaid]);

  // Attendance metrics
  const metrics = useMemo(() => {
    const total = records.length;
    const present = records.filter(r => r.status === 'present').length;
    const partial = records.filter(r => r.status === 'partial').length;
    const absent = records.filter(r => r.status === 'absent').length;
    const excused = records.filter(r => r.status === 'excused').length;
    const totalAttendedMin = records.reduce((sum, r) => sum + (r.attended_minutes || 0), 0);

    // Rate: Present (100%), Partial (50%), Excused (excluded or counted towards compliance)
    const effectiveAttendanceRate = total > 0 
      ? Math.round(((present + excused + partial * 0.5) / total) * 100) 
      : 100;

    // Breakdown by class type
    const byClassType: Record<string, { total: number; present: number; excused: number }> = {};
    records.forEach(r => {
      const type = r.class_type || 'Other';
      if (!byClassType[type]) {
        byClassType[type] = { total: 0, present: 0, excused: 0 };
      }
      byClassType[type].total += 1;
      if (r.status === 'present') byClassType[type].present += 1;
      if (r.status === 'excused') byClassType[type].excused += 1;
    });

    return {
      total,
      present,
      partial,
      absent,
      excused,
      totalAttendedMin,
      effectiveAttendanceRate,
      byClassType
    };
  }, [records]);

  // Calendar Days Calculation
  const calendarDays = useMemo(() => {
    const year = currentMonthDate.getFullYear();
    const month = currentMonthDate.getMonth();

    const firstDay = new Date(year, month, 1);
    const lastDay = new Date(year, month + 1, 0);

    const startingDayIndex = (firstDay.getDay() + 6) % 7; // Monday = 0
    const totalDays = lastDay.getDate();

    // Map records to date strings YYYY-MM-DD
    const recordsByDate = new Map<string, StudentAttendance[]>();
    records.forEach(r => {
      const existing = recordsByDate.get(r.session_date) || [];
      existing.push(r);
      recordsByDate.set(r.session_date, existing);
    });

    const days = [];
    // Previous month filler
    for (let i = 0; i < startingDayIndex; i++) {
      days.push({ dayNumber: null, dateStr: '', records: [] });
    }

    // Current month days
    for (let day = 1; day <= totalDays; day++) {
      const dayStr = String(day).padStart(2, '0');
      const monthStr = String(month + 1).padStart(2, '0');
      const dateStr = `${year}-${monthStr}-${dayStr}`;
      const dayRecords = recordsByDate.get(dateStr) || [];
      days.push({ dayNumber: day, dateStr, records: dayRecords });
    }

    return days;
  }, [currentMonthDate, records]);

  // Month navigation
  const prevMonth = () => {
    setCurrentMonthDate(new Date(currentMonthDate.getFullYear(), currentMonthDate.getMonth() - 1, 1));
  };
  const nextMonth = () => {
    setCurrentMonthDate(new Date(currentMonthDate.getFullYear(), currentMonthDate.getMonth() + 1, 1));
  };

  // Filtered session list
  const filteredHistory = useMemo(() => {
    return records.filter(r => {
      if (filterClassType !== 'all' && r.class_type !== filterClassType) return false;
      if (filterStatus !== 'all' && r.status !== filterStatus) return false;
      return true;
    });
  }, [records, filterClassType, filterStatus]);

  const getStatusColorConfig = (status: AttendanceStatus) => {
    switch (status) {
      case 'present':
        return {
          dotBg: 'bg-emerald-500',
          textColor: 'text-emerald-700 dark:text-emerald-400',
          pillBg: 'bg-emerald-50/90 dark:bg-emerald-950/40',
          borderColor: 'border-emerald-200/90 dark:border-emerald-800/60',
          label: 'Present',
        };
      case 'partial':
        return {
          dotBg: 'bg-amber-500',
          textColor: 'text-amber-700 dark:text-amber-400',
          pillBg: 'bg-amber-50/90 dark:bg-amber-950/40',
          borderColor: 'border-amber-200/90 dark:border-amber-800/60',
          label: 'Partial',
        };
      case 'excused':
        return {
          dotBg: 'bg-indigo-500',
          textColor: 'text-indigo-700 dark:text-indigo-400',
          pillBg: 'bg-indigo-50/90 dark:bg-indigo-950/40',
          borderColor: 'border-indigo-200/90 dark:border-indigo-800/60',
          label: 'Excused',
        };
      case 'absent':
      default:
        return {
          dotBg: 'bg-rose-500',
          textColor: 'text-rose-700 dark:text-rose-400',
          pillBg: 'bg-rose-50/90 dark:bg-rose-950/40',
          borderColor: 'border-rose-200/90 dark:border-rose-800/60',
          label: 'Absent',
        };
    }
  };

  const getStatusBadge = (status: AttendanceStatus, excuseReason?: string | null) => {
    switch (status) {
      case 'present':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-800/60">
            <CheckCircle2 size={12} />
            <span>Present</span>
          </span>
        );
      case 'partial':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-amber-50 dark:bg-amber-950/40 text-amber-700 dark:text-amber-400 border border-amber-200 dark:border-amber-800/60">
            <Clock size={12} />
            <span>Partial</span>
          </span>
        );
      case 'excused':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-indigo-50 dark:bg-indigo-950/40 text-indigo-700 dark:text-indigo-400 border border-indigo-200 dark:border-indigo-800/60">
            <ShieldCheck size={12} />
            <span>Excused</span>
          </span>
        );
      case 'absent':
      default:
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-rose-50 dark:bg-rose-950/40 text-rose-700 dark:text-rose-400 border border-rose-200 dark:border-rose-800/60">
            <XCircle size={12} />
            <span>Absent</span>
          </span>
        );
    }
  };

  if (isLoading) {
    return (
      <div className="py-16 text-center text-gray-500">
        <div className="w-8 h-8 border-3 border-teal-600 border-t-transparent rounded-full animate-spin mx-auto mb-3" />
        <p className="text-xs font-medium">Loading your attendance records...</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Overview Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-5 gap-3.5">
        <div className="bg-white dark:bg-gray-900 p-4 rounded-2xl border border-gray-200 dark:border-gray-800 shadow-2xs">
          <div className="flex items-center justify-between text-gray-500 text-xs font-semibold">
            <span>Overall Rate</span>
            <Sparkles size={15} className="text-teal-600" />
          </div>
          <div className="text-2xl font-black text-teal-700 dark:text-teal-400 mt-1">
            {metrics.effectiveAttendanceRate}%
          </div>
          <div className="text-[11px] text-gray-400 mt-0.5">Weighted attendance</div>
        </div>

        <div className="bg-white dark:bg-gray-900 p-4 rounded-2xl border border-gray-200 dark:border-gray-800 shadow-2xs">
          <div className="flex items-center justify-between text-emerald-700 dark:text-emerald-400 text-xs font-semibold">
            <span>Present</span>
            <CheckCircle2 size={15} className="text-emerald-500" />
          </div>
          <div className="text-2xl font-black text-emerald-600 dark:text-emerald-400 mt-1">
            {metrics.present}
          </div>
          <div className="text-[11px] text-gray-400 mt-0.5">≥75% class duration</div>
        </div>

        <div className="bg-white dark:bg-gray-900 p-4 rounded-2xl border border-gray-200 dark:border-gray-800 shadow-2xs">
          <div className="flex items-center justify-between text-amber-700 dark:text-amber-400 text-xs font-semibold">
            <span>Partial</span>
            <Clock size={15} className="text-amber-500" />
          </div>
          <div className="text-2xl font-black text-amber-600 dark:text-amber-400 mt-1">
            {metrics.partial}
          </div>
          <div className="text-[11px] text-gray-400 mt-0.5">25% - 74% attended</div>
        </div>

        <div className="bg-white dark:bg-gray-900 p-4 rounded-2xl border border-gray-200 dark:border-gray-800 shadow-2xs">
          <div className="flex items-center justify-between text-indigo-700 dark:text-indigo-400 text-xs font-semibold">
            <span>Excused</span>
            <ShieldCheck size={15} className="text-indigo-500" />
          </div>
          <div className="text-2xl font-black text-indigo-600 dark:text-indigo-400 mt-1">
            {metrics.excused}
          </div>
          <div className="text-[11px] text-gray-400 mt-0.5">MaxouT slot excuses</div>
        </div>

        <div className="bg-white dark:bg-gray-900 p-4 rounded-2xl border border-gray-200 dark:border-gray-800 shadow-2xs col-span-2 lg:col-span-1">
          <div className="flex items-center justify-between text-rose-700 dark:text-rose-400 text-xs font-semibold">
            <span>Absent</span>
            <XCircle size={15} className="text-rose-500" />
          </div>
          <div className="text-2xl font-black text-rose-600 dark:text-rose-400 mt-1">
            {metrics.absent}
          </div>
          <div className="text-[11px] text-gray-400 mt-0.5">Out of {metrics.total} sessions</div>
        </div>
      </div>

      {/* Class Type Progress Breakdown */}
      {Object.keys(metrics.byClassType).length > 0 && (
        <div className="bg-white dark:bg-gray-900 p-5 rounded-2xl border border-gray-200 dark:border-gray-800 shadow-2xs space-y-3">
          <h3 className="text-xs font-bold text-gray-800 dark:text-gray-200 flex items-center gap-1.5 uppercase tracking-wider">
            <Layers size={14} className="text-teal-600 dark:text-teal-400" />
            <span>Attendance by Class Stream</span>
          </h3>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            {(Object.entries(metrics.byClassType) as [string, { total: number; present: number; excused: number }][]).map(([type, data]) => {
              const rate = data.total > 0 ? Math.round(((data.present + data.excused) / data.total) * 100) : 0;
              return (
                <div key={type} className="p-3 bg-gray-50 dark:bg-gray-800/60 rounded-xl border border-gray-100 dark:border-gray-800">
                  <div className="flex items-center justify-between text-xs mb-1.5">
                    <span className="font-bold text-gray-900 dark:text-white">{type}</span>
                    <span className="font-mono font-bold text-teal-700 dark:text-teal-400">{rate}%</span>
                  </div>
                  <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-1.5 overflow-hidden">
                    <div 
                      className="bg-teal-600 h-full rounded-full transition-all"
                      style={{ width: `${rate}%` }}
                    />
                  </div>
                  <div className="flex items-center justify-between text-[10px] text-gray-400 mt-1.5">
                    <span>{data.present} Present</span>
                    <span>{data.total} Total Sessions</span>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Monthly Interactive Calendar Card */}
      <div className="bg-white dark:bg-gray-900 rounded-2xl p-6 border border-gray-200 dark:border-gray-800 shadow-2xs space-y-4">
        {/* Calendar Month Header */}
        <div className="flex items-center justify-between pb-3 border-b border-gray-100 dark:border-gray-800">
          <div className="flex items-center gap-2">
            <CalendarIcon className="w-4 h-4 text-teal-600 dark:text-teal-400" />
            <h3 className="text-sm font-bold text-gray-900 dark:text-white">
              {currentMonthDate.toLocaleString('default', { month: 'long', year: 'numeric' })}
            </h3>
          </div>

          <div className="flex items-center gap-1.5">
            <button
              onClick={prevMonth}
              className="p-1.5 rounded-lg border border-gray-200 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-800 text-gray-600 dark:text-gray-300 transition-colors cursor-pointer"
            >
              <ChevronLeft size={16} />
            </button>
            <button
              onClick={() => setCurrentMonthDate(new Date())}
              className="px-2.5 py-1 text-xs font-semibold rounded-lg border border-gray-200 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-800 text-gray-600 dark:text-gray-300 transition-colors cursor-pointer"
            >
              Today
            </button>
            <button
              onClick={nextMonth}
              className="p-1.5 rounded-lg border border-gray-200 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-800 text-gray-600 dark:text-gray-300 transition-colors cursor-pointer"
            >
              <ChevronRight size={16} />
            </button>
          </div>
        </div>

        {/* Legend */}
        <div className="flex items-center gap-4 text-[11px] text-gray-500 dark:text-gray-400 flex-wrap">
          <div className="flex items-center gap-1.5">
            <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 inline-block" />
            <span>Present (≥75%)</span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="w-2.5 h-2.5 rounded-full bg-amber-500 inline-block" />
            <span>Partial (25-74%)</span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="w-2.5 h-2.5 rounded-full bg-indigo-500 inline-block" />
            <span>Excused (Slot Registered)</span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="w-2.5 h-2.5 rounded-full bg-rose-500 inline-block" />
            <span>Absent</span>
          </div>
        </div>

        {/* Calendar Grid */}
        <div className="grid grid-cols-7 gap-1.5 text-center">
          {['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'].map(dayName => (
            <div key={dayName} className="text-[10px] font-bold uppercase tracking-wider text-gray-400 py-1">
              {dayName}
            </div>
          ))}

          {calendarDays.map((cell, idx) => {
            if (!cell.dayNumber) {
              return (
                <div 
                  key={`empty-${idx}`} 
                  className="min-h-[82px] sm:min-h-[96px] bg-gray-50/40 dark:bg-gray-800/20 rounded-xl border border-transparent" 
                />
              );
            }

            const hasRecords = cell.records.length > 0;
            const todayStr = new Date().toISOString().split('T')[0];
            const isToday = cell.dateStr === todayStr;

            return (
              <div
                key={cell.dateStr}
                className={`min-h-[82px] sm:min-h-[96px] p-1.5 rounded-xl border text-left flex flex-col justify-between transition-all ${
                  hasRecords 
                    ? 'bg-white dark:bg-gray-900 border-gray-200 dark:border-gray-800 shadow-2xs hover:border-teal-500/50' 
                    : 'bg-white/60 dark:bg-gray-900/40 border-gray-100 dark:border-gray-800/60 opacity-80'
                } ${isToday ? 'ring-2 ring-teal-500/50 dark:ring-teal-400/50' : ''}`}
              >
                {/* Header: Date number & class count */}
                <div className="flex items-center justify-between pb-1">
                  <span className={`text-xs font-bold leading-none ${
                    isToday 
                      ? 'w-5 h-5 flex items-center justify-center rounded-full bg-teal-600 text-white text-[10px]' 
                      : 'text-gray-700 dark:text-gray-300'
                  }`}>
                    {cell.dayNumber}
                  </span>
                  {cell.records.length > 1 && (
                    <span className="text-[9px] font-bold text-gray-500 dark:text-gray-400 bg-gray-100 dark:bg-gray-800 px-1.5 py-0.2 rounded-md">
                      {cell.records.length}
                    </span>
                  )}
                </div>

                {/* Class details inside date box */}
                {hasRecords && (
                  <div className="space-y-1 mt-auto">
                    {cell.records.slice(0, 2).map((rec, rIdx) => {
                      const cfg = getStatusColorConfig(rec.status);
                      return (
                        <div
                          key={rec.id || `${cell.dateStr}-${rIdx}`}
                          onClick={() => setSelectedRecord(rec)}
                          className={`p-1 sm:p-1.5 rounded-lg border ${cfg.pillBg} ${cfg.borderColor} cursor-pointer hover:scale-[1.02] active:scale-[0.98] transition-all`}
                          title={`Click for session details: ${rec.class_type || rec.session_title} - ${cfg.label}`}
                        >
                          {/* Class Name + Status Color Dot */}
                          <div className="flex items-center gap-1.5 min-w-0">
                            <span className={`w-2 h-2 rounded-full shrink-0 ${cfg.dotBg} shadow-xs`} />
                            <span className="text-[10px] sm:text-[10.5px] font-bold text-gray-900 dark:text-gray-100 truncate leading-tight">
                              {rec.class_type || rec.session_title || 'Class'}
                            </span>
                          </div>

                          {/* Attendance Status Label + Duration */}
                          <div className="flex items-center justify-between text-[8.5px] sm:text-[9px] mt-0.5 pl-3.5 gap-1">
                            <span className={`font-bold uppercase tracking-wider text-[8px] sm:text-[8.5px] truncate ${cfg.textColor}`}>
                              {cfg.label}
                            </span>
                            <span className="font-mono text-gray-500 dark:text-gray-400 shrink-0 text-[8px] sm:text-[8.5px]">
                              {rec.attended_minutes}m ({Math.round(rec.attendance_percentage)}%)
                            </span>
                          </div>
                        </div>
                      );
                    })}

                    {cell.records.length > 2 && (
                      <button
                        onClick={() => setSelectedRecord(cell.records[0])}
                        className="w-full text-center text-[8.5px] font-bold text-teal-600 dark:text-teal-400 hover:underline cursor-pointer"
                      >
                        +{cell.records.length - 2} more
                      </button>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* Detailed Session History List */}
      <div className="bg-white dark:bg-gray-900 rounded-2xl p-6 border border-gray-200 dark:border-gray-800 shadow-2xs space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-gray-100 dark:border-gray-800">
          <div>
            <h3 className="text-sm font-bold text-gray-900 dark:text-white flex items-center gap-2">
              <Clock className="w-4 h-4 text-teal-600 dark:text-teal-400" />
              <span>Full Attendance History ({filteredHistory.length})</span>
            </h3>
            <p className="text-xs text-gray-400 mt-0.5">
              Click on any row for granular join/leave timestamps and session breakdown.
            </p>
          </div>

          {/* Filters */}
          <div className="flex items-center gap-2">
            <select
              value={filterClassType}
              onChange={(e) => setFilterClassType(e.target.value)}
              className="px-2.5 py-1.5 bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl text-xs text-gray-800 dark:text-gray-200"
            >
              <option value="all">All Class Types</option>
              <option value="MaxouT Project">MaxouT Project</option>
              <option value="Theory Class">Theory Class</option>
              <option value="Paper Class">Paper Class</option>
            </select>

            <select
              value={filterStatus}
              onChange={(e) => setFilterStatus(e.target.value)}
              className="px-2.5 py-1.5 bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl text-xs text-gray-800 dark:text-gray-200"
            >
              <option value="all">All Statuses</option>
              <option value="present">Present</option>
              <option value="partial">Partial</option>
              <option value="excused">Excused</option>
              <option value="absent">Absent</option>
            </select>
          </div>
        </div>

        {filteredHistory.length === 0 ? (
          <div className="py-10 text-center text-gray-400 text-xs">
            No attendance records found matching the selected filters.
          </div>
        ) : (
          <div className="divide-y divide-gray-100 dark:divide-gray-800">
            {filteredHistory.map(record => (
              <div
                key={record.id}
                onClick={() => setSelectedRecord(record)}
                className="py-3 px-2 flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 hover:bg-gray-50 dark:hover:bg-gray-800/50 rounded-xl transition-colors cursor-pointer"
              >
                <div className="space-y-0.5">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-bold text-xs text-gray-900 dark:text-white">
                      {record.session_title}
                    </span>
                    {getStatusBadge(record.status, record.excuse_reason)}
                  </div>
                  <div className="flex items-center gap-2 text-[11px] text-gray-400 flex-wrap">
                    <span className="font-mono text-gray-500">{record.session_date}</span>
                    <span>•</span>
                    <span className="text-teal-700 dark:text-teal-400 font-medium">{record.class_type}</span>
                    {record.batch_slot && (
                      <>
                        <span>•</span>
                        <span>{record.batch_slot}</span>
                      </>
                    )}
                    {record.reconnect_count > 0 && (
                      <>
                        <span>•</span>
                        <span className="text-gray-500">{record.reconnect_count} re-connections</span>
                      </>
                    )}
                  </div>
                </div>

                <div className="flex items-center gap-4">
                  <div className="text-right">
                    <div className="text-xs font-mono font-bold text-gray-900 dark:text-white">
                      {record.attended_minutes} / {record.session_duration_minutes} min
                    </div>
                    <div className="text-[10px] text-gray-400 font-mono">
                      {record.attendance_percentage}% duration
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Session Details Drawer/Modal */}
      <AnimatePresence>
        {selectedRecord && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-xs">
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-2xl w-full max-w-md p-6 shadow-xl space-y-4"
            >
              <div className="flex items-center justify-between pb-3 border-b border-gray-100 dark:border-gray-800">
                <div className="flex items-center gap-2">
                  <UserCheck className="w-5 h-5 text-teal-600 dark:text-teal-400" />
                  <h3 className="text-sm font-bold text-gray-900 dark:text-white">Session Attendance Details</h3>
                </div>
                <button
                  onClick={() => setSelectedRecord(null)}
                  className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 cursor-pointer"
                >
                  <X size={18} />
                </button>
              </div>

              <div className="space-y-3 text-xs">
                <div>
                  <div className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">Session Topic</div>
                  <div className="text-sm font-bold text-gray-900 dark:text-white mt-0.5">
                    {selectedRecord.session_title}
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-2 bg-gray-50 dark:bg-gray-800/60 p-3 rounded-xl border border-gray-100 dark:border-gray-800">
                  <div>
                    <span className="text-[10px] text-gray-400 block">Date</span>
                    <span className="font-mono font-bold text-gray-800 dark:text-gray-200">
                      {selectedRecord.session_date}
                    </span>
                  </div>
                  <div>
                    <span className="text-[10px] text-gray-400 block">Class Type</span>
                    <span className="font-semibold text-teal-700 dark:text-teal-400">
                      {selectedRecord.class_type}
                    </span>
                  </div>
                  <div>
                    <span className="text-[10px] text-gray-400 block">Batch Slot</span>
                    <span className="font-medium text-gray-800 dark:text-gray-200">
                      {selectedRecord.batch_slot || 'General Batch'}
                    </span>
                  </div>
                  <div>
                    <span className="text-[10px] text-gray-400 block">Attendance Status</span>
                    <div className="mt-0.5">
                      {getStatusBadge(selectedRecord.status, selectedRecord.excuse_reason)}
                    </div>
                  </div>
                </div>

                <div className="bg-gray-50 dark:bg-gray-800/60 p-3 rounded-xl border border-gray-100 dark:border-gray-800 space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-[10px] text-gray-400">Time Attended</span>
                    <span className="font-mono font-bold text-gray-900 dark:text-white">
                      {selectedRecord.attended_minutes} / {selectedRecord.session_duration_minutes} minutes ({selectedRecord.attendance_percentage}%)
                    </span>
                  </div>

                  <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-2 overflow-hidden">
                    <div
                      className={`h-full rounded-full transition-all ${
                        selectedRecord.attendance_percentage >= 75
                          ? 'bg-emerald-500'
                          : selectedRecord.attendance_percentage >= 25
                          ? 'bg-amber-500'
                          : 'bg-rose-500'
                      }`}
                      style={{ width: `${Math.min(100, selectedRecord.attendance_percentage)}%` }}
                    />
                  </div>

                  {selectedRecord.first_join_time && (
                    <div className="grid grid-cols-2 gap-2 text-[10px] text-gray-500 pt-1 border-t border-gray-200/50 dark:border-gray-700/50">
                      <div>
                        First Join: <span className="font-mono font-semibold text-gray-700 dark:text-gray-300">{formatTimeDisplay(selectedRecord.first_join_time) || selectedRecord.first_join_time || 'N/A'}</span>
                      </div>
                      <div>
                        Last Leave: <span className="font-mono font-semibold text-gray-700 dark:text-gray-300">{formatTimeDisplay(selectedRecord.last_leave_time) || selectedRecord.last_leave_time || 'N/A'}</span>
                      </div>
                    </div>
                  )}

                  {selectedRecord.reconnect_count > 0 && (
                    <div className="text-[10px] text-gray-500">
                      Re-connections: <span className="font-semibold text-gray-700 dark:text-gray-300">{selectedRecord.reconnect_count} drops/re-joins logged</span>
                    </div>
                  )}
                </div>

                {selectedRecord.excuse_reason && (
                  <div className="p-3 bg-indigo-50/60 dark:bg-indigo-950/40 rounded-xl border border-indigo-200 dark:border-indigo-900/60 text-xs">
                    <div className="text-[10px] font-bold text-indigo-700 dark:text-indigo-300 uppercase tracking-wider mb-0.5">
                      Excuse / Justification Note
                    </div>
                    <div className="text-indigo-950 dark:text-indigo-200">
                      {selectedRecord.excuse_reason}
                    </div>
                  </div>
                )}
              </div>

              <div className="pt-2 text-right">
                <button
                  type="button"
                  onClick={() => setSelectedRecord(null)}
                  className="px-4 py-2 bg-gray-100 hover:bg-gray-200 dark:bg-gray-800 dark:hover:bg-gray-700 text-gray-700 dark:text-gray-300 rounded-xl text-xs font-bold cursor-pointer"
                >
                  Close
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}

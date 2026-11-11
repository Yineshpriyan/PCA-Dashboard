import React, { useState, useEffect, useMemo, useRef } from 'react';
import Papa from 'papaparse';
import { toast } from 'sonner';
import { 
  Video, 
  UploadCloud, 
  Search, 
  Filter, 
  Download, 
  RefreshCw, 
  CheckCircle2, 
  Clock, 
  AlertCircle, 
  XCircle, 
  Calendar, 
  Trash2, 
  Edit3, 
  Check, 
  X, 
  Users, 
  ChevronDown, 
  ChevronUp, 
  Loader2, 
  Sparkles, 
  FileSpreadsheet,
  Info,
  ShieldCheck,
  ChevronLeft,
  ChevronRight,
  Layers,
  FileText,
  Plus,
  CheckCheck,
  Copy,
  RotateCcw,
  FilterX
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { supabase } from '../lib/supabase';
import { StudentAttendance, AttendanceStatus } from '../types';
import { parseFlexibleDate, safeToDateOnly, formatTimeDisplay } from '../lib/dateUtils';

interface StagedBatchFile {
  id: string;
  name: string;
  size: number;
  content: string;
  detectedSlot: string; // 'Batch 1' | 'Batch 2' | 'Batch 3' | ''
  detectedWebinarId?: string;
  detectedTopic?: string;
  detectedDuration?: number;
  detectedDate?: string;
  attendeeCount: number;
}

export interface AggregatedStudentRecord {
  id: string;
  pcaid: string;
  student?: {
    name: string;
    last_name?: string;
    mail?: string;
    phone?: string;
    proper_batch?: string;
    district?: string;
  };
  target_batch: string;
  total_attended_minutes: number;
  session_duration_minutes: number;
  attendance_percentage: number;
  status: AttendanceStatus;
  excuse_reason: string | null;
  reconnect_count: number;
  first_join_time: string | null;
  batch_slots: string[];
  class_types: string[];
  session_titles: string[];
  session_dates: string[];
  record_count: number;
  raw_records: StudentAttendance[];
}

interface SyncErrorDetails {
  type: 'date_mismatch' | 'not_found' | 'generic';
  title: string;
  message: string;
  webinarId?: string;
  requestedDate?: string;
  suggestedDates?: string[];
}

export default function ZoomAttendance() {
  const [activeTab, setActiveTab] = useState<'api' | 'csv'>('api');
  const [webinarId, setWebinarId] = useState('');
  const [sessionDurationMinutes, setSessionDurationMinutes] = useState<number>(90);
  const [targetBatch, setTargetBatch] = useState<string>('2027');
  const PRIORITY_CLASS_TYPES = ['MaxouT', 'GRC', 'Model Paper Class', 'Theory with Paper Class'];
  const [availableClassTypes, setAvailableClassTypes] = useState<string[]>(PRIORITY_CLASS_TYPES);
  const [classType, setClassType] = useState<string>('MaxouT');
  const [batchSlot, setBatchSlot] = useState<string>('');
  const [sessionDate, setSessionDate] = useState<string>(() => new Date().toISOString().split('T')[0]);
  const markAbsentForUnjoined = true; // Automatically mark unjoined batch students as absent in background
  
  // Staged multi-batch CSV files
  const [stagedFiles, setStagedFiles] = useState<StagedBatchFile[]>([]);
  const [isReadingFiles, setIsReadingFiles] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Syncing state
  const [isSyncing, setIsSyncing] = useState(false);
  const [lastSyncSummary, setLastSyncSummary] = useState<any | null>(null);
  const [syncErrorDetails, setSyncErrorDetails] = useState<SyncErrorDetails | null>(null);

  // Attendance Records State
  const [records, setRecords] = useState<StudentAttendance[]>([]);
  const [isLoadingRecords, setIsLoadingRecords] = useState(true);

  // Filters State
  const [searchQuery, setSearchQuery] = useState('');
  const [filterBatch, setFilterBatch] = useState('all');
  const [filterClassType, setFilterClassType] = useState('all');
  const [filterSlot, setFilterSlot] = useState('all');
  const [filterStatus, setFilterStatus] = useState<string>('all');
  const [filterWebinarId, setFilterWebinarId] = useState('all');
  const [filterDateFrom, setFilterDateFrom] = useState('');
  const [filterDateTo, setFilterDateTo] = useState('');

  // Pagination
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 25;

  // Edit/Override Modal State for Aggregated Student
  const [editingStudent, setEditingStudent] = useState<AggregatedStudentRecord | null>(null);
  const [editStatus, setEditStatus] = useState<AttendanceStatus>('present');
  const [editExcuseReason, setEditExcuseReason] = useState('');
  const [isSavingEdit, setIsSavingEdit] = useState(false);

  // Delete State
  const [deletingId, setDeletingId] = useState<string | null>(null);

  // RLS Guidance Modal State
  const [showRlsModal, setShowRlsModal] = useState(false);
  const [copiedSql, setCopiedSql] = useState(false);

  // Fetch Attendance Records
  const fetchAttendanceRecords = async () => {
    setIsLoadingRecords(true);
    try {
      const { data, error } = await supabase
        .from('student_attendance')
        .select(`
          *,
          student:student!fk_student_attendance_pcaid (
            name,
            last_name,
            mail,
            phone,
            proper_batch,
            district
          )
        `)
        .order('session_date', { ascending: false })
        .order('batch_slot', { ascending: true })
        .order('attended_minutes', { ascending: false })
        .limit(10000);

      if (error) {
        throw error;
      }

      setRecords((data as any[]) || []);
    } catch (err: any) {
      console.error('Error fetching attendance records:', err);
      toast.error('Failed to load attendance records: ' + (err.message || 'Unknown error'));
    } finally {
      setIsLoadingRecords(false);
    }
  };

  useEffect(() => {
    fetchAttendanceRecords();

    const fetchClassTypes = async () => {
      try {
        const { data, error } = await supabase
          .from('class_item')
          .select('class_type')
          .order('class_type');
        if (!error && data && data.length > 0) {
          const dbTypes = data.map((d: any) => d.class_type).filter(Boolean);
          const ordered = [
            ...PRIORITY_CLASS_TYPES,
            ...dbTypes.filter((t: string) => !PRIORITY_CLASS_TYPES.includes(t))
          ];
          setAvailableClassTypes(Array.from(new Set(ordered)));
        }
      } catch (e) {
        console.warn('Could not load class_item table:', e);
      }
    };
    fetchClassTypes();
  }, []);

  // Helper to split CSV row respecting double quotes
  const splitCSVRow = (row: string): string[] => {
    const result: string[] = [];
    let current = '';
    let inQuotes = false;

    for (let i = 0; i < row.length; i++) {
      const char = row[i];
      if (char === '"' || char === "'") {
        if (inQuotes && row[i + 1] === char) {
          current += char;
          i++;
        } else {
          inQuotes = !inQuotes;
        }
      } else if (char === ',' && !inQuotes) {
        result.push(current.trim());
        current = '';
      } else {
        current += char;
      }
    }
    result.push(current.trim());
    return result;
  };

  // Detect batch slot from filename, topic, or start time
  const detectSlot = (name: string, topic?: string, startTime?: string): string => {
    const combined = `${name} ${topic || ''}`.toLowerCase();
    if (combined.includes('batch 1') || combined.includes('batch1') || combined.includes('b1') || combined.includes('4.30') || combined.includes('4:30')) {
      return 'Batch 1';
    }
    if (combined.includes('batch 2') || combined.includes('batch2') || combined.includes('b2') || combined.includes('8.00') || combined.includes('8:00')) {
      return 'Batch 2';
    }
    if (combined.includes('batch 3') || combined.includes('batch3') || combined.includes('b3') || combined.includes('9.30') || combined.includes('9:30')) {
      return 'Batch 3';
    }

    if (startTime) {
      const clean = startTime.replace(/^["'\s]+|["'\s]+$/g, '').trim();
      const isUtc = clean.endsWith('Z') || clean.includes('+00') || clean.includes('+00:00');
      
      let hour = -1;
      let minute = 0;

      const ampmMatch = clean.match(/(\d{1,2}):(\d{2})(?::(\d{2}))?\s*(AM|PM)/i);
      if (ampmMatch) {
        let h = parseInt(ampmMatch[1], 10);
        minute = parseInt(ampmMatch[2], 10);
        const ampm = ampmMatch[4].toUpperCase();
        if (ampm === 'PM' && h < 12) h += 12;
        if (ampm === 'AM' && h === 12) h = 0;
        hour = h;
      } else {
        const time24Match = clean.match(/(?:T|\s|^)(\d{1,2}):(\d{2})(?::(\d{2}))?/);
        if (time24Match) {
          hour = parseInt(time24Match[1], 10);
          minute = parseInt(time24Match[2], 10);
        }
      }

      if (hour >= 0) {
        let totalMinutes = hour * 60 + minute;
        // If UTC, convert to Sri Lanka Time (UTC + 5:30 = +330 mins)
        if (isUtc) {
          totalMinutes = (totalMinutes + 330) % 1440;
        }

        // Slot 1: ~4:30 PM (16:30) -> 15:30 to 18:30 (900 to 1110 min)
        if (totalMinutes >= 900 && totalMinutes <= 1110) return 'Batch 1';
        // Slot 2: ~8:00 PM (20:00) -> 19:00 to 20:59 (1140 to 1259 min)
        if (totalMinutes >= 1140 && totalMinutes <= 1259) return 'Batch 2';
        // Slot 3: ~9:30 PM (21:30) -> 21:00 to 23:59 (1260 to 1439 min)
        if (totalMinutes >= 1260 && totalMinutes <= 1439) return 'Batch 3';
      }
    }
    return '';
  };

  // Handle Multi-file CSV Selection
  const handleFilesSelected = async (filesList: FileList | null) => {
    if (!filesList || filesList.length === 0) return;

    setIsReadingFiles(true);
    const newStaged: StagedBatchFile[] = [];

    for (let i = 0; i < filesList.length; i++) {
      const file = filesList[i];
      if (!file.name.endsWith('.csv')) {
        toast.error(`Skipped non-CSV file: ${file.name}`);
        continue;
      }

      try {
        const content = await file.text();
        const lines = content.split(/\r?\n/).slice(0, 15);

        let detectedWebId: string | undefined;
        let detectedTopic: string | undefined;
        let detectedDuration: number | undefined;
        let detectedDate: string | undefined;
        let detectedStartTime: string | undefined;

        // Parse quick metadata
        for (let j = 0; j < lines.length; j++) {
          const line = lines[j];
          if (line.toLowerCase().includes('webinar id') && lines[j + 1]) {
            const headerCols = splitCSVRow(line);
            const valCols = splitCSVRow(lines[j + 1]);
            const idIdx = headerCols.findIndex(c => c.toLowerCase().includes('webinar id'));
            const topicIdx = headerCols.findIndex(c => c.toLowerCase().includes('topic'));
            const durIdx = headerCols.findIndex(c => c.toLowerCase().includes('duration'));
            const startIdx = headerCols.findIndex(c => c.toLowerCase().includes('start time'));

            if (idIdx >= 0 && valCols[idIdx]) detectedWebId = valCols[idIdx].replace(/\D/g, '');
            if (topicIdx >= 0 && valCols[topicIdx]) detectedTopic = valCols[topicIdx].replace(/^["']|["']$/g, '').trim();
            if (durIdx >= 0 && valCols[durIdx]) detectedDuration = parseInt(valCols[durIdx], 10);
            if (startIdx >= 0 && valCols[startIdx]) {
              detectedStartTime = valCols[startIdx].replace(/^["']|["']$/g, '').trim();
              detectedDate = safeToDateOnly(detectedStartTime);
            }
            break;
          }
        }

        // Count approximate attendee lines
        const allLines = content.split(/\r?\n/);
        let attendeeRows = 0;
        let inAttendeeSection = false;
        for (const l of allLines) {
          if (l.toLowerCase().includes('attendee details')) inAttendeeSection = true;
          else if (inAttendeeSection && l.trim()) attendeeRows++;
        }
        if (attendeeRows > 1) attendeeRows -= 1; // remove header row

        const isMaxout = classType === 'MaxouT' || classType === 'F to A MaxouT Project' || classType.toLowerCase().includes('maxout');
        const autoSlot = isMaxout
          ? (detectSlot(file.name, detectedTopic, detectedStartTime) || 
             (filesList.length > 1 ? `Batch ${Math.min(3, stagedFiles.length + newStaged.length + 1)}` : 'Batch 1'))
          : '';

        newStaged.push({
          id: `${file.name}-${Date.now()}-${Math.random()}`,
          name: file.name,
          size: file.size,
          content,
          detectedSlot: autoSlot,
          detectedWebinarId: detectedWebId,
          detectedTopic,
          detectedDuration,
          detectedDate,
          attendeeCount: attendeeRows || allLines.length,
        });

        // Auto-fill top form inputs
        if (detectedWebId && !webinarId) setWebinarId(detectedWebId);
        if (detectedDate) setSessionDate(detectedDate);
        if (detectedDuration && detectedDuration > 0) setSessionDurationMinutes(detectedDuration);
      } catch (err) {
        console.error('Failed to read file:', file.name, err);
        toast.error(`Could not read file: ${file.name}`);
      }
    }

    setStagedFiles(prev => [...prev, ...newStaged]);
    setIsReadingFiles(false);
    toast.success(`Loaded ${newStaged.length} batch CSV file(s) for sync.`);
  };

  // Remove a staged file
  const removeStagedFile = (id: string) => {
    setStagedFiles(prev => prev.filter(f => f.id !== id));
  };

  // Update a staged file's batch slot
  const updateStagedSlot = (id: string, newSlot: string) => {
    setStagedFiles(prev => prev.map(f => f.id === id ? { ...f, detectedSlot: newSlot } : f));
  };

  // Trigger Sync (Zoom API or Multi-file CSV)
  const handleTriggerSync = async () => {
    const cleanId = webinarId.replace(/\D/g, '');
    
    if (activeTab === 'csv' && stagedFiles.length === 0) {
      toast.error('Please upload at least one Zoom attendee CSV file.');
      return;
    }

    if (activeTab === 'api' && !cleanId) {
      toast.error('Please provide a Webinar / Meeting ID for Live API sync.');
      return;
    }

    setIsSyncing(true);
    setLastSyncSummary(null);
    setSyncErrorDetails(null);

    try {
      const payload: any = {
        webinarId: cleanId || stagedFiles[0]?.detectedWebinarId,
        sessionDurationMinutes: Number(sessionDurationMinutes) || 90,
        targetBatch: targetBatch || '2027',
        classType: classType || 'MaxouT',
        batchSlot: batchSlot || null,
        sessionDate: sessionDate || undefined,
        markAbsentForUnjoined,
      };

      if (activeTab === 'csv') {
        payload.files = stagedFiles.map(f => ({
          name: f.name,
          content: f.content,
          batchSlot: f.detectedSlot || null,
          sessionDurationMinutes: f.detectedDuration || sessionDurationMinutes,
          sessionDate: f.detectedDate || sessionDate,
          webinarId: f.detectedWebinarId || cleanId
        }));
      }

      // Get auth token from active Supabase session if available
      const reqHeaders: Record<string, string> = { 'Content-Type': 'application/json' };
      try {
        const { data: sessionData } = await supabase.auth.getSession();
        if (sessionData?.session?.access_token) {
          reqHeaders['Authorization'] = `Bearer ${sessionData.session.access_token}`;
        }
      } catch (authErr) {
        console.warn('Could not retrieve active session for sync request:', authErr);
      }

      const response = await fetch('/api/sync-zoom-attendance', {
        method: 'POST',
        headers: reqHeaders,
        body: JSON.stringify(payload),
      });

      const result = await response.json();

      if (!response.ok || !result.success) {
        if (result.errorType === 'date_mismatch') {
          setSyncErrorDetails({
            type: 'date_mismatch',
            title: `No Class Session on ${result.requestedDate || sessionDate}`,
            message: result.message || `Zoom has no session records for this webinar on ${result.requestedDate || sessionDate}.`,
            webinarId: cleanId,
            requestedDate: result.requestedDate || sessionDate,
            suggestedDates: result.suggestedDates || [],
          });
          toast.error(`No Zoom session found on ${result.requestedDate || sessionDate}. Choose a date below.`);
          return;
        }

        if (result.errorType === 'not_found') {
          setSyncErrorDetails({
            type: 'not_found',
            title: `Webinar ID Not Found (${cleanId})`,
            message: result.message || `Zoom could not find any meeting or webinar with ID ${cleanId}. Please check the ID.`,
            webinarId: cleanId,
          });
          toast.error(`Webinar ID ${cleanId} not found in Zoom.`);
          return;
        }

        throw new Error(result.error || 'Attendance synchronization failed.');
      }

      setLastSyncSummary(result);
      
      const multiText = result.stats.multiBatchCount > 0 
        ? ` (${result.stats.multiBatchCount} joined multiple batches)` 
        : '';
        
      toast.success(
        `Attendance Synced! Total Records: ${result.stats.total} • Present: ${result.stats.present} • Absent: ${result.stats.absent}${multiText}`
      );

      if (result.warning) {
        toast.warning(result.warning, { duration: 9000 });
      }

      // Refresh records
      await fetchAttendanceRecords();
    } catch (err: any) {
      console.error('Sync failed:', err);
      const errMsg = err.message || 'Error executing Zoom attendance sync.';
      if (
        errMsg.toLowerCase().includes('row-level security') || 
        errMsg.toLowerCase().includes('rls') || 
        errMsg.toLowerCase().includes('42501')
      ) {
        setShowRlsModal(true);
      }
      
      const cleanDisplayMsg = errMsg.length > 90 ? errMsg.slice(0, 90) + '...' : errMsg;
      toast.error(cleanDisplayMsg);
    } finally {
      setIsSyncing(false);
    }
  };

  // Save Manual Status Override for aggregated student
  const handleSaveEdit = async () => {
    if (!editingStudent) return;
    setIsSavingEdit(true);

    try {
      const recordIds = editingStudent.raw_records.map(r => r.id);
      const { error } = await supabase
        .from('student_attendance')
        .update({
          status: editStatus,
          excuse_reason: editExcuseReason.trim() || null,
          updated_at: new Date().toISOString(),
        })
        .in('id', recordIds);

      if (error) throw error;

      toast.success(`Updated status for ${editingStudent.pcaid} to ${editStatus}`);
      setEditingStudent(null);
      await fetchAttendanceRecords();
    } catch (err: any) {
      console.error('Update failed:', err);
      toast.error('Failed to update attendance: ' + err.message);
    } finally {
      setIsSavingEdit(false);
    }
  };

  // Delete All Records for Student
  const handleDeleteStudent = async (student: AggregatedStudentRecord) => {
    if (!confirm(`Are you sure you want to remove all attendance records for student ${student.pcaid}?`)) {
      return;
    }

    const recordIds = student.raw_records.map(r => r.id);
    setDeletingId(student.id);
    try {
      const { error } = await supabase
        .from('student_attendance')
        .delete()
        .in('id', recordIds);

      if (error) throw error;

      toast.success('Records deleted.');
      const idSet = new Set(recordIds);
      setRecords(prev => prev.filter(r => !idSet.has(r.id)));
    } catch (err: any) {
      toast.error('Delete failed: ' + err.message);
    } finally {
      setDeletingId(null);
    }
  };

  // Dynamic Grouping & Calculation per Student based on active filters
  const aggregatedStudents = useMemo(() => {
    // 1. Filter raw records by criteria (Search, Class Type, Batch Slot, Target Batch, Date Range)
    const matchingRecords = records.filter(r => {
      // Search
      if (searchQuery.trim()) {
        const query = searchQuery.toLowerCase().trim();
        const studentName = r.student?.name?.toLowerCase() || '';
        const lastName = r.student?.last_name?.toLowerCase() || '';
        const fullName = `${studentName} ${lastName}`.trim();
        const pcaid = r.pcaid.toLowerCase();
        const phone = (r.student?.phone || '').toLowerCase();
        const email = (r.student?.mail || '').toLowerCase();

        if (
          !pcaid.includes(query) &&
          !fullName.includes(query) &&
          !phone.includes(query) &&
          !email.includes(query)
        ) {
          return false;
        }
      }

      // Batch
      if (filterBatch !== 'all' && r.target_batch !== filterBatch && r.student?.proper_batch !== filterBatch) {
        return false;
      }

      // Class Type
      if (filterClassType !== 'all' && r.class_type !== filterClassType) {
        return false;
      }

      // Slot
      if (filterSlot !== 'all') {
        if (filterSlot === 'none' || filterSlot === 'All Slots') {
          if (r.batch_slot && r.batch_slot !== 'All Slots') return false;
        } else if (r.batch_slot !== filterSlot) {
          return false;
        }
      }

      // Date range comparison (normalized to YYYY-MM-DD)
      const recordDate = r.session_date ? r.session_date.slice(0, 10) : '';
      if (filterDateFrom && recordDate && recordDate < filterDateFrom) {
        return false;
      }
      if (filterDateTo && recordDate && recordDate > filterDateTo) {
        return false;
      }

      return true;
    });

    // 2. Group matching records by PCAID
    const studentMap = new Map<string, {
      pcaid: string;
      student?: StudentAttendance['student'];
      target_batch: string;
      records: StudentAttendance[];
    }>();

    matchingRecords.forEach(r => {
      const existing = studentMap.get(r.pcaid);
      if (!existing) {
        studentMap.set(r.pcaid, {
          pcaid: r.pcaid,
          student: r.student,
          target_batch: r.target_batch,
          records: [r],
        });
      } else {
        existing.records.push(r);
        if (!existing.student && r.student) existing.student = r.student;
      }
    });

    // 3. For each student, compute summed attendance and final status
    const studentList: AggregatedStudentRecord[] = Array.from(studentMap.values()).map(entry => {
      const rawRecords = entry.records;

      // Calculate total attended minutes across all matching batches
      const totalAttendedMinutes = rawRecords.reduce((sum, r) => sum + (r.attended_minutes || 0), 0);

      // Determine expected class duration
      // For multi-batch sessions on the same date, expected lecture duration is max duration of that date's batches
      const dateDurationMap = new Map<string, number>();
      rawRecords.forEach(r => {
        const d = r.session_date || 'default';
        const dur = r.session_duration_minutes || 90;
        dateDurationMap.set(d, Math.max(dateDurationMap.get(d) || 0, dur));
      });
      const effectiveDuration = Array.from(dateDurationMap.values()).reduce((sum, dur) => sum + dur, 0) || 90;

      // Calculate final percentage capped at 100%
      const rawPct = (totalAttendedMinutes / effectiveDuration) * 100;
      const finalPercentage = Math.min(100, Math.round(rawPct));

      // Check for excuse
      const excusedRecord = rawRecords.find(r => r.status === 'excused');
      const excuseReason = excusedRecord?.excuse_reason || null;

      // Determine final status based on aggregated percentage
      let finalStatus: AttendanceStatus = 'absent';
      if (excusedRecord && finalPercentage < 75) {
        finalStatus = 'excused';
      } else if (finalPercentage >= 75) {
        finalStatus = 'present';
      } else if (finalPercentage >= 25) {
        finalStatus = 'partial';
      } else {
        finalStatus = 'absent';
      }

      // Collect distinct batch slots
      const batchSlots = Array.from(new Set(
        rawRecords
          .map(r => r.batch_slot)
          .filter((s): s is string => Boolean(s && s.trim() !== ''))
      ));

      // Collect distinct class types, titles, and dates
      const classTypes = Array.from(new Set(rawRecords.map(r => r.class_type).filter(Boolean)));
      const sessionTitles = Array.from(new Set(rawRecords.map(r => r.session_title).filter(Boolean)));
      const sessionDates = Array.from(new Set(rawRecords.map(r => r.session_date).filter(Boolean))).sort();

      // Cumulative reconnects
      const totalReconnects = rawRecords.reduce((sum, r) => sum + (r.reconnect_count || 0), 0);

      // Earliest join time
      const firstJoinTimes = rawRecords.map(r => r.first_join_time).filter(Boolean) as string[];
      const firstJoinTime = firstJoinTimes.length > 0 ? firstJoinTimes.sort()[0] : null;

      return {
        id: rawRecords[0]?.id || entry.pcaid,
        pcaid: entry.pcaid,
        student: entry.student,
        target_batch: entry.target_batch,
        total_attended_minutes: totalAttendedMinutes,
        session_duration_minutes: effectiveDuration,
        attendance_percentage: finalPercentage,
        status: finalStatus,
        excuse_reason: excuseReason,
        reconnect_count: totalReconnects,
        first_join_time: firstJoinTime,
        batch_slots: batchSlots,
        class_types: classTypes,
        session_titles: sessionTitles,
        session_dates: sessionDates,
        record_count: rawRecords.length,
        raw_records: rawRecords,
      };
    });

    // 4. Apply filterStatus against the student's final calculated status
    if (filterStatus === 'all') {
      return studentList;
    }
    if (filterStatus === 'unjoined') {
      return studentList.filter(s => s.total_attended_minutes === 0);
    }
    return studentList.filter(s => s.status === filterStatus);
  }, [
    records,
    searchQuery,
    filterBatch,
    filterClassType,
    filterSlot,
    filterStatus,
    filterDateFrom,
    filterDateTo,
  ]);

  // Overall Statistics based on current aggregated student view
  const stats = useMemo(() => {
    const total = aggregatedStudents.length;
    const present = aggregatedStudents.filter(r => r.status === 'present').length;
    const partial = aggregatedStudents.filter(r => r.status === 'partial').length;
    const absent = aggregatedStudents.filter(r => r.status === 'absent').length;
    const excused = aggregatedStudents.filter(r => r.status === 'excused').length;
    const totalAttendedMinutes = aggregatedStudents.reduce((acc, r) => acc + (r.total_attended_minutes || 0), 0);
    const avgMinutes = total > 0 ? Math.round(totalAttendedMinutes / total) : 0;
    const overallRate = total > 0 ? Math.round(((present + excused + partial * 0.5) / total) * 100) : 0;

    return { total, present, partial, absent, excused, avgMinutes, overallRate };
  }, [aggregatedStudents]);

  // Pagination Slice
  const totalPages = Math.ceil(aggregatedStudents.length / itemsPerPage) || 1;
  const paginatedStudents = useMemo(() => {
    const start = (currentPage - 1) * itemsPerPage;
    return aggregatedStudents.slice(start, start + itemsPerPage);
  }, [aggregatedStudents, currentPage]);

  // Reset page when filters change
  useEffect(() => {
    setCurrentPage(1);
  }, [
    searchQuery,
    filterBatch,
    filterClassType,
    filterSlot,
    filterStatus,
    filterDateFrom,
    filterDateTo,
  ]);

  // Check if any search or filter conditions are actively applied
  const hasActiveFilters = useMemo(() => {
    return Boolean(
      searchQuery.trim() !== '' ||
      filterBatch !== 'all' ||
      filterClassType !== 'all' ||
      filterSlot !== 'all' ||
      filterStatus !== 'all' ||
      filterDateFrom !== '' ||
      filterDateTo !== ''
    );
  }, [
    searchQuery,
    filterBatch,
    filterClassType,
    filterSlot,
    filterStatus,
    filterDateFrom,
    filterDateTo,
  ]);

  // Clear all search and filter conditions back to defaults
  const handleClearFilters = () => {
    setSearchQuery('');
    setFilterBatch('all');
    setFilterClassType('all');
    setFilterSlot('all');
    setFilterStatus('all');
    setFilterDateFrom('');
    setFilterDateTo('');
    setCurrentPage(1);
    toast.success('All filters have been cleared');
  };

  // Export Combined Records to CSV/Excel
  const handleExportCSV = () => {
    if (aggregatedStudents.length === 0) {
      toast.error('No student records available to export.');
      return;
    }

    const exportData = aggregatedStudents.map(s => ({
      'PCA ID': s.pcaid,
      'Student Name': `${s.student?.name || ''} ${s.student?.last_name || ''}`.trim() || 'N/A',
      'Batch': s.student?.proper_batch || s.target_batch,
      'Phone': s.student?.phone || 'N/A',
      'Email': s.student?.mail || 'N/A',
      'District': s.student?.district || 'N/A',
      'Class Type': s.class_types.join(', ') || classType,
      'Session Dates': s.session_dates.join(', ') || sessionDate,
      'Batches Attended': s.batch_slots.length > 0 ? s.batch_slots.join(', ') : '-',
      'Total Batches': s.record_count,
      'Attended Minutes': s.total_attended_minutes,
      'Class Duration (min)': s.session_duration_minutes,
      'Attendance %': `${s.attendance_percentage}%`,
      'Final Status': s.status.toUpperCase(),
      'Excuse Reason': s.excuse_reason || '',
      'Rejoins': s.reconnect_count,
      'First Join Time': s.first_join_time ? (formatTimeDisplay(s.first_join_time) || s.first_join_time) : 'N/A',
    }));

    const csv = Papa.unparse(exportData);
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', `Zoom_MultiBatch_Attendance_${sessionDate || new Date().toISOString().split('T')[0]}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    toast.success(`Exported ${exportData.length} records into single consolidated CSV view.`);
  };

  const getStatusBadge = (status: AttendanceStatus, excuseReason?: string | null) => {
    switch (status) {
      case 'present':
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-bold bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-800/60">
            <CheckCircle2 size={12} className="text-emerald-600 dark:text-emerald-400" />
            <span>Present (≥75%)</span>
          </span>
        );
      case 'partial':
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-bold bg-amber-50 dark:bg-amber-950/40 text-amber-700 dark:text-amber-400 border border-amber-200 dark:border-amber-800/60">
            <Clock size={12} className="text-amber-600 dark:text-amber-400" />
            <span>Partial (25-74%)</span>
          </span>
        );
      case 'excused':
        return (
          <span 
            title={excuseReason || 'Excused'}
            className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-bold bg-indigo-50 dark:bg-indigo-950/40 text-indigo-700 dark:text-indigo-400 border border-indigo-200 dark:border-indigo-800/60 cursor-help"
          >
            <ShieldCheck size={12} className="text-indigo-600 dark:text-indigo-400" />
            <span>Excused</span>
          </span>
        );
      case 'absent':
      default:
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-bold bg-rose-50 dark:bg-rose-950/40 text-rose-700 dark:text-rose-400 border border-rose-200 dark:border-rose-800/60">
            <XCircle size={12} className="text-rose-600 dark:text-rose-400" />
            <span>Absent (&lt;25%)</span>
          </span>
        );
    }
  };

  const getSlotBadge = (slot: string | null) => {
    if (!slot) return null;
    if (slot.includes('Batch 1') || slot.includes('1')) {
      return (
        <span className="inline-flex items-center px-2 py-0.5 rounded-md text-[10px] font-bold bg-sky-50 dark:bg-sky-950/50 text-sky-700 dark:text-sky-300 border border-sky-200 dark:border-sky-800">
          Batch 1 (4.30 PM)
        </span>
      );
    }
    if (slot.includes('Batch 2') || slot.includes('2')) {
      return (
        <span className="inline-flex items-center px-2 py-0.5 rounded-md text-[10px] font-bold bg-indigo-50 dark:bg-indigo-950/50 text-indigo-700 dark:text-indigo-300 border border-indigo-200 dark:border-indigo-800">
          Batch 2 (8.00 PM)
        </span>
      );
    }
    if (slot.includes('Batch 3') || slot.includes('3')) {
      return (
        <span className="inline-flex items-center px-2 py-0.5 rounded-md text-[10px] font-bold bg-amber-50 dark:bg-amber-950/50 text-amber-700 dark:text-amber-300 border border-amber-200 dark:border-amber-800">
          Batch 3 (9.30 PM)
        </span>
      );
    }
    return (
      <span className="inline-flex items-center px-2 py-0.5 rounded-md text-[10px] font-bold bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-300 border border-gray-200 dark:border-gray-700">
        {slot}
      </span>
    );
  };

  return (
    <div className="space-y-6 max-w-7xl mx-auto pb-16">
      {/* Sync Control Deck */}
      <div className="bg-white dark:bg-gray-900 rounded-3xl p-6 sm:p-7 border border-gray-200 dark:border-gray-800 shadow-xs space-y-6 transition-colors">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-4 border-b border-gray-100 dark:border-gray-800">
          <div>
            <h2 className="text-base font-bold text-gray-900 dark:text-white flex items-center gap-2">
              <Sparkles className="w-4 h-4 text-teal-600 dark:text-teal-400" />
              <span>Multi-Batch Zoom Attendance Synchronizer</span>
            </h2>
            <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
              Sync directly from Zoom or upload CSV attendance reports for any session date. All attendee records are combined in one unified view.
            </p>
          </div>

          {/* Sync Mode Switcher */}
          <div className="flex items-center gap-1 p-1 bg-gray-100 dark:bg-gray-800 rounded-xl w-fit border border-gray-200 dark:border-gray-700">
            <button
              onClick={() => setActiveTab('api')}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                activeTab === 'api'
                  ? 'bg-white dark:bg-gray-900 text-teal-700 dark:text-teal-300 shadow-xs'
                  : 'text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white'
              }`}
            >
              <Video size={13} />
              <span>Sync Zoom</span>
            </button>
            <button
              onClick={() => setActiveTab('csv')}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                activeTab === 'csv'
                  ? 'bg-white dark:bg-gray-900 text-teal-700 dark:text-teal-300 shadow-xs'
                  : 'text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white'
              }`}
            >
              <FileSpreadsheet size={13} />
              <span>Upload CSV</span>
            </button>
          </div>
        </div>

        {/* Cool, Interactive & Actionable Sync Error Alert */}
        <AnimatePresence>
          {syncErrorDetails && (
            <motion.div
              initial={{ opacity: 0, y: -6, scale: 0.99 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: -6, scale: 0.99 }}
              transition={{ duration: 0.15 }}
              className={`p-4 sm:p-5 rounded-2xl border ${
                syncErrorDetails.type === 'not_found'
                  ? 'bg-rose-50/90 dark:bg-rose-950/40 border-rose-200 dark:border-rose-800/80'
                  : 'bg-amber-50/90 dark:bg-amber-950/40 border-amber-200 dark:border-amber-800/80'
              } shadow-2xs space-y-3 transition-colors`}
            >
              <div className="flex items-start justify-between gap-3">
                <div className="flex items-start gap-3">
                  <div
                    className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 mt-0.5 ${
                      syncErrorDetails.type === 'not_found'
                        ? 'bg-rose-100 dark:bg-rose-900/60 text-rose-600 dark:text-rose-300'
                        : 'bg-amber-100 dark:bg-amber-900/60 text-amber-700 dark:text-amber-300'
                    }`}
                  >
                    <AlertCircle size={22} />
                  </div>
                  <div className="space-y-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <h4
                        className={`text-sm font-bold ${
                          syncErrorDetails.type === 'not_found'
                            ? 'text-rose-900 dark:text-rose-200'
                            : 'text-amber-900 dark:text-amber-200'
                        }`}
                      >
                        {syncErrorDetails.title}
                      </h4>
                      {syncErrorDetails.requestedDate && (
                        <span className="font-mono text-xs px-2 py-0.5 rounded-md bg-amber-100 dark:bg-amber-900/60 text-amber-800 dark:text-amber-200 font-bold">
                          {syncErrorDetails.requestedDate}
                        </span>
                      )}
                    </div>
                    <p
                      className={`text-xs ${
                        syncErrorDetails.type === 'not_found'
                          ? 'text-rose-700 dark:text-rose-300/90'
                          : 'text-amber-800 dark:text-amber-300/90'
                      } leading-relaxed`}
                    >
                      {syncErrorDetails.message}
                    </p>

                    {/* Clickable Suggested Dates from Zoom */}
                    {syncErrorDetails.suggestedDates && syncErrorDetails.suggestedDates.length > 0 && (
                      <div className="pt-2.5 mt-2 border-t border-amber-200/60 dark:border-amber-800/60">
                        <span className="text-[11px] font-bold text-amber-900 dark:text-amber-200 block mb-2">
                          Recent sessions found in Zoom for this webinar (click a date to autofill):
                        </span>
                        <div className="flex flex-wrap items-center gap-2">
                          {syncErrorDetails.suggestedDates.map(dateStr => (
                            <button
                              key={dateStr}
                              type="button"
                              onClick={() => {
                                setSessionDate(dateStr);
                                setSyncErrorDetails(null);
                                toast.success(`Selected ${dateStr}! Click "Sync Attendance" to proceed.`);
                              }}
                              className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-white dark:bg-gray-900 border border-amber-300 dark:border-amber-700/80 hover:border-amber-500 text-xs font-mono font-bold text-amber-950 dark:text-amber-100 hover:bg-amber-100/60 dark:hover:bg-amber-900/50 transition-all shadow-2xs hover:scale-105 active:scale-95 cursor-pointer"
                            >
                              <Calendar size={13} className="text-amber-600 dark:text-amber-400" />
                              <span>{dateStr}</span>
                              <span className="text-[10px] text-teal-600 dark:text-teal-400 font-sans font-bold ml-1">Use Date</span>
                            </button>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                </div>

                <button
                  type="button"
                  onClick={() => setSyncErrorDetails(null)}
                  className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 p-1 rounded-lg cursor-pointer transition-colors"
                  title="Dismiss"
                >
                  <X size={16} />
                </button>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Sync Form Grid */}
        {activeTab === 'csv' ? (
          /* Multi-File CSV Mode: Zero manual input for Webinar ID, Date, or Slot */
          <div className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {/* Target Batch */}
              <div className="space-y-1.5">
                <label className="text-xs font-bold text-gray-700 dark:text-gray-300">Target Student Batch</label>
                <div className="relative">
                  <input
                    type="text"
                    list="csv-target-batch-options"
                    value={targetBatch}
                    onChange={(e) => setTargetBatch(e.target.value)}
                    placeholder="e.g. 2027"
                    className="w-full px-3 py-2.5 bg-gray-50 dark:bg-gray-800/80 border border-gray-200 dark:border-gray-700 rounded-xl text-xs font-semibold text-gray-900 dark:text-white focus:outline-hidden focus:ring-2 focus:ring-teal-500/30 focus:border-teal-500 transition-all"
                  />
                  <datalist id="csv-target-batch-options">
                    <option value="2027">2027 Batch</option>
                    <option value="2028">2028 Batch</option>
                    <option value="2026">2026 Batch</option>
                    <option value="2025">2025 Batch</option>
                    <option value="Repeaters">Repeaters</option>
                  </datalist>
                </div>
              </div>

              {/* Class Type */}
              <div className="space-y-1.5">
                <label className="text-xs font-bold text-gray-700 dark:text-gray-300">Class Type</label>
                <select
                  value={classType}
                  onChange={(e) => setClassType(e.target.value)}
                  className="w-full px-3 py-2.5 bg-gray-50 dark:bg-gray-800/80 border border-gray-200 dark:border-gray-700 rounded-xl text-xs text-gray-900 dark:text-white focus:outline-hidden focus:ring-2 focus:ring-teal-500/30 focus:border-teal-500 transition-all font-semibold"
                >
                  {availableClassTypes.map(ct => (
                    <option key={ct} value={ct}>{ct}</option>
                  ))}
                </select>
              </div>

              {/* Sync Execution Button */}
              <div className="space-y-1.5 flex flex-col justify-end">
                <button
                  onClick={handleTriggerSync}
                  disabled={isSyncing || isReadingFiles || stagedFiles.length === 0}
                  className="w-full h-[42px] px-4 bg-teal-600 hover:bg-teal-700 text-white rounded-xl text-xs font-extrabold flex items-center justify-center gap-2 transition-all shadow-sm hover:shadow-teal-500/20 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {isSyncing ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      <span>Syncing Attendance...</span>
                    </>
                  ) : (
                    <>
                      <RefreshCw className="w-4 h-4" />
                      <span>Sync Attendance</span>
                    </>
                  )}
                </button>
              </div>
            </div>

            {/* Auto-Detection Indicator Banner */}
            <div className="flex items-center gap-2 px-3.5 py-2 rounded-xl bg-teal-50/80 dark:bg-teal-950/40 border border-teal-200/60 dark:border-teal-800/50 text-teal-800 dark:text-teal-300 text-xs">
              <Sparkles size={14} className="shrink-0 text-teal-600 dark:text-teal-400" />
              <span>
                <strong>Zero Manual Input:</strong> Webinar ID, Session Date, Duration, and Batch Slots (Batch 1, 2, or 3) are automatically extracted from your CSV files.
              </span>
            </div>
          </div>
        ) : (
          /* Live Zoom API Mode: Requires Webinar ID & Date */
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            {/* Webinar ID */}
            <div className="space-y-1.5">
              <label className="text-xs font-bold text-gray-700 dark:text-gray-300 flex items-center gap-1">
                <span>Webinar / Meeting ID</span>
                <span className="text-rose-500">*</span>
              </label>
              <input
                type="text"
                placeholder="e.g. 846 7515 2785"
                value={webinarId}
                onChange={(e) => setWebinarId(e.target.value)}
                className="w-full px-3.5 py-2.5 bg-gray-50 dark:bg-gray-800/80 border border-gray-200 dark:border-gray-700 rounded-xl text-xs font-mono text-gray-900 dark:text-white focus:outline-hidden focus:ring-2 focus:ring-teal-500/30 focus:border-teal-500 transition-all"
              />
            </div>

            {/* Session Date */}
            <div className="space-y-1.5">
              <label className="text-xs font-bold text-gray-700 dark:text-gray-300">Session Date</label>
              <input
                type="date"
                value={sessionDate}
                onChange={(e) => setSessionDate(e.target.value)}
                className="w-full px-3.5 py-2.5 bg-gray-50 dark:bg-gray-800/80 border border-gray-200 dark:border-gray-700 rounded-xl text-xs text-gray-900 dark:text-white focus:outline-hidden focus:ring-2 focus:ring-teal-500/30 focus:border-teal-500 transition-all"
              />
            </div>

            {/* Target Batch */}
            <div className="space-y-1.5">
              <label className="text-xs font-bold text-gray-700 dark:text-gray-300">Target Student Batch</label>
              <div className="relative">
                <input
                  type="text"
                  list="api-target-batch-options"
                  value={targetBatch}
                  onChange={(e) => setTargetBatch(e.target.value)}
                  placeholder="e.g. 2027"
                  className="w-full px-3 py-2.5 bg-gray-50 dark:bg-gray-800/80 border border-gray-200 dark:border-gray-700 rounded-xl text-xs font-semibold text-gray-900 dark:text-white focus:outline-hidden focus:ring-2 focus:ring-teal-500/30 focus:border-teal-500 transition-all"
                />
                <datalist id="api-target-batch-options">
                  <option value="2027">2027 Batch</option>
                  <option value="2028">2028 Batch</option>
                  <option value="2026">2026 Batch</option>
                  <option value="2025">2025 Batch</option>
                  <option value="Repeaters">Repeaters</option>
                </datalist>
              </div>
            </div>

            {/* Class Type */}
            <div className="space-y-1.5">
              <label className="text-xs font-bold text-gray-700 dark:text-gray-300">Class Type</label>
              <select
                value={classType}
                onChange={(e) => setClassType(e.target.value)}
                className="w-full px-3 py-2.5 bg-gray-50 dark:bg-gray-800/80 border border-gray-200 dark:border-gray-700 rounded-xl text-xs text-gray-900 dark:text-white focus:outline-hidden focus:ring-2 focus:ring-teal-500/30 focus:border-teal-500 transition-all font-semibold"
              >
                {availableClassTypes.map(ct => (
                  <option key={ct} value={ct}>{ct}</option>
                ))}
              </select>
            </div>

            {/* Sync Execution Button */}
            <div className="space-y-1.5 flex flex-col justify-end md:col-span-2 lg:col-span-4">
              <button
                onClick={handleTriggerSync}
                disabled={isSyncing || !webinarId.trim()}
                className="w-full h-[42px] px-4 bg-teal-600 hover:bg-teal-700 text-white rounded-xl text-xs font-extrabold flex items-center justify-center gap-2 transition-all shadow-sm hover:shadow-teal-500/20 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {isSyncing ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    <span>Syncing Attendance...</span>
                  </>
                ) : (
                  <>
                    <RefreshCw className="w-4 h-4" />
                    <span>Sync Attendance</span>
                  </>
                )}
              </button>
            </div>

            {/* Live API Date Instance Indicator Banner */}
            <div className="md:col-span-2 lg:col-span-4 flex items-center gap-2 px-3.5 py-2 rounded-xl bg-teal-50/80 dark:bg-teal-950/40 border border-teal-200/60 dark:border-teal-800/50 text-teal-800 dark:text-teal-300 text-xs">
              <Sparkles size={14} className="shrink-0 text-teal-600 dark:text-teal-400" />
              <span>
                <strong>Multi-Batch Auto Detection:</strong> System automatically discovers all Zoom session instances on your selected <strong>Session Date</strong>, maps Batch 1 / 2 / 3 slots, combines attendee minutes, and updates the shared filter table below.
              </span>
            </div>
          </div>
        )}

        {/* Multi-File Upload Staging Area (CSV Mode) */}
        {activeTab === 'csv' && (
          <div className="space-y-3 pt-3 border-t border-gray-100 dark:border-gray-800">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <FileSpreadsheet className="w-4 h-4 text-teal-600 dark:text-teal-400" />
                <span className="text-xs font-bold text-gray-900 dark:text-white">
                  Batch Reports for Selected Date ({stagedFiles.length} {stagedFiles.length === 1 ? 'file' : 'files'} staged)
                </span>
              </div>
              {stagedFiles.length > 0 && (
                <button
                  type="button"
                  onClick={() => setStagedFiles([])}
                  className="text-xs text-rose-500 hover:text-rose-600 font-semibold cursor-pointer"
                >
                  Clear All
                </button>
              )}
            </div>

            {/* Drag & Drop File Input Box */}
            <div
              onClick={() => fileInputRef.current?.click()}
              onDragOver={(e) => { e.preventDefault(); e.stopPropagation(); }}
              onDrop={(e) => {
                e.preventDefault();
                e.stopPropagation();
                handleFilesSelected(e.dataTransfer.files);
              }}
              className="w-full p-4 bg-gray-50 dark:bg-gray-800/50 hover:bg-teal-50/40 dark:hover:bg-gray-800 border-2 border-dashed border-gray-300 dark:border-gray-700 hover:border-teal-500 rounded-2xl flex flex-col items-center justify-center gap-2 cursor-pointer transition-all text-center"
            >
              <div className="w-10 h-10 rounded-full bg-teal-100 dark:bg-teal-950/60 flex items-center justify-center text-teal-600 dark:text-teal-400">
                <UploadCloud size={20} />
              </div>
              <div>
                <p className="text-xs font-bold text-gray-800 dark:text-gray-200">
                  Click to browse or drop your Zoom CSV reports here
                </p>
                <p className="text-[11px] text-gray-500 dark:text-gray-400 mt-0.5">
                  Select 1, 2, or 3 batch files together (e.g. Batch 1 at 4:30 PM, Batch 2 at 8:00 PM, Batch 3 at 9:30 PM).
                </p>
              </div>
              <input
                type="file"
                ref={fileInputRef}
                multiple
                accept=".csv"
                onChange={(e) => handleFilesSelected(e.target.files)}
                className="hidden"
              />
            </div>

            {/* Staged File Cards */}
            {stagedFiles.length > 0 && (
              <div className="space-y-2 pt-2">
                {stagedFiles.map((staged, idx) => (
                  <div
                    key={staged.id}
                    className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-3 bg-white dark:bg-gray-800/90 rounded-xl border border-gray-200 dark:border-gray-700 shadow-2xs"
                  >
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 rounded-lg bg-teal-50 dark:bg-teal-950/60 flex items-center justify-center text-teal-600 dark:text-teal-400 shrink-0">
                        <FileText size={16} />
                      </div>
                      <div className="min-w-0">
                        <div className="font-bold text-xs text-gray-900 dark:text-white truncate max-w-xs sm:max-w-md">
                          {staged.name}
                        </div>
                        <div className="text-[11px] text-gray-400 flex items-center gap-2 mt-0.5 flex-wrap">
                          <span>{(staged.size / 1024).toFixed(1)} KB</span>
                          {staged.detectedWebinarId && (
                            <>
                              <span>•</span>
                              <span className="font-mono">ID: {staged.detectedWebinarId}</span>
                            </>
                          )}
                          {staged.detectedDate && (
                            <>
                              <span>•</span>
                              <span className="font-semibold text-gray-700 dark:text-gray-300">Date: {staged.detectedDate}</span>
                            </>
                          )}
                          {staged.detectedDuration && (
                            <>
                              <span>•</span>
                              <span>{staged.detectedDuration} min</span>
                            </>
                          )}
                          <span>•</span>
                          <span className="text-teal-600 dark:text-teal-400 font-semibold">
                            ~{staged.attendeeCount} attendees found
                          </span>
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center gap-2 shrink-0">
                      {/* Slot selector (Only applicable for MaxouT) */}
                      {(classType === 'MaxouT' || classType === 'F to A MaxouT Project' || classType.toLowerCase().includes('maxout')) ? (
                        <div className="flex items-center gap-1.5">
                          <span className="text-[11px] font-semibold text-gray-500">Slot:</span>
                          <select
                            value={staged.detectedSlot}
                            onChange={(e) => updateStagedSlot(staged.id, e.target.value)}
                            className="px-2.5 py-1 bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-lg text-xs font-semibold text-teal-700 dark:text-teal-300 focus:ring-1 focus:ring-teal-500"
                          >
                            <option value="Batch 1">Batch 1 (4.30 PM - 6.00 PM)</option>
                            <option value="Batch 2">Batch 2 (8.00 PM - 9.30 PM)</option>
                            <option value="Batch 3">Batch 3 (9.30 PM - 11.00 PM)</option>
                            <option value="">General / No Slot</option>
                          </select>
                        </div>
                      ) : (
                        <span className="inline-flex items-center px-2 py-0.5 rounded-md text-[10px] font-bold bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-400 border border-gray-200 dark:border-gray-700">
                          Full Class (No Batches)
                        </span>
                      )}

                      {/* Remove button */}
                      <button
                        type="button"
                        onClick={() => removeStagedFile(staged.id)}
                        className="p-1.5 text-gray-400 hover:text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-950/40 rounded-lg transition-colors cursor-pointer"
                        title="Remove file"
                      >
                        <Trash2 size={14} />
                      </button>
                    </div>
                  </div>
                ))}

                <div className="flex justify-end pt-1">
                  <button
                    type="button"
                    onClick={() => fileInputRef.current?.click()}
                    className="inline-flex items-center gap-1 px-3 py-1.5 text-xs font-bold text-teal-600 dark:text-teal-400 hover:bg-teal-50 dark:hover:bg-teal-950/40 rounded-lg transition-colors cursor-pointer"
                  >
                    <Plus size={13} />
                    <span>Add Another Batch File</span>
                  </button>
                </div>
              </div>
            )}
          </div>
        )}

        {/* Sync Summary Feedback Banner */}
        <AnimatePresence>
          {lastSyncSummary && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              exit={{ opacity: 0, height: 0 }}
              className="p-4 bg-teal-50/70 dark:bg-teal-950/30 border border-teal-200 dark:border-teal-900/50 rounded-2xl space-y-3"
            >
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1">
                <div className="flex items-center gap-2 text-teal-900 dark:text-teal-200 font-bold text-xs">
                  <CheckCircle2 className="w-4 h-4 text-teal-600 dark:text-teal-400 shrink-0" />
                  <span>
                    Sync Complete: {lastSyncSummary.sessionTitle} ({lastSyncSummary.stats.batchCount || 1} Batch{lastSyncSummary.stats.batchCount > 1 ? 'es' : ''} Processed)
                  </span>
                </div>
                <span className="text-[11px] text-teal-700 dark:text-teal-300 font-mono">
                  Session Date: {lastSyncSummary.sessionDate} • Target: {lastSyncSummary.targetBatch}
                </span>
              </div>

              {/* KPI metrics */}
              <div className="grid grid-cols-2 sm:grid-cols-5 gap-2 text-center">
                <div className="bg-white/80 dark:bg-gray-900/80 p-2.5 rounded-xl border border-teal-100 dark:border-teal-900/30">
                  <div className="text-[10px] text-gray-500 uppercase tracking-wider font-bold">Total Stored Rows</div>
                  <div className="text-base font-black text-gray-900 dark:text-white">{lastSyncSummary.stats.total}</div>
                </div>
                <div className="bg-emerald-500/10 p-2.5 rounded-xl border border-emerald-500/20">
                  <div className="text-[10px] text-emerald-700 dark:text-emerald-300 uppercase tracking-wider font-bold">Present (≥75%)</div>
                  <div className="text-base font-black text-emerald-600 dark:text-emerald-400">{lastSyncSummary.stats.present}</div>
                </div>
                <div className="bg-amber-500/10 p-2.5 rounded-xl border border-amber-500/20">
                  <div className="text-[10px] text-amber-700 dark:text-amber-300 uppercase tracking-wider font-bold">Partial (25-74%)</div>
                  <div className="text-base font-black text-amber-600 dark:text-amber-400">{lastSyncSummary.stats.partial}</div>
                </div>
                <div className="bg-rose-500/10 p-2.5 rounded-xl border border-rose-500/20">
                  <div className="text-[10px] text-rose-700 dark:text-rose-300 uppercase tracking-wider font-bold">Absent (&lt;25%)</div>
                  <div className="text-base font-black text-rose-600 dark:text-rose-400">{lastSyncSummary.stats.absent}</div>
                </div>
                <div className="bg-indigo-500/10 p-2.5 rounded-xl border border-indigo-500/20">
                  <div className="text-[10px] text-indigo-700 dark:text-indigo-300 uppercase tracking-wider font-bold">Multi-Batch Attendees</div>
                  <div className="text-base font-black text-indigo-600 dark:text-indigo-400">{lastSyncSummary.stats.multiBatchCount || 0}</div>
                </div>
              </div>

              {/* Per-batch Breakdown Cards */}
              {lastSyncSummary.batchBreakdowns && lastSyncSummary.batchBreakdowns.length > 0 && (
                <div className="pt-2 border-t border-teal-200/60 dark:border-teal-900/40">
                  <div className="text-[11px] font-bold text-teal-900 dark:text-teal-200 mb-1.5 flex items-center gap-1.5">
                    <Layers size={13} />
                    <span>Batch Slot Breakdown:</span>
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                    {lastSyncSummary.batchBreakdowns.map((b: any, bIdx: number) => (
                      <div
                        key={bIdx}
                        className="bg-white/90 dark:bg-gray-900/90 p-2.5 rounded-xl border border-teal-100 dark:border-teal-900/30 text-xs space-y-1"
                      >
                        <div className="flex items-center justify-between font-bold">
                          <span className="text-gray-900 dark:text-white">{b.slot}</span>
                          <span className="text-teal-600 dark:text-teal-400 font-mono text-[11px]">{b.totalParticipants} Joined</span>
                        </div>
                        <div className="flex items-center justify-between text-[10px] text-gray-500">
                          <span className="text-emerald-600 font-semibold">{b.present} Present</span>
                          <span className="text-amber-600 font-semibold">{b.partial} Partial</span>
                          <span className="text-rose-600 font-semibold">{b.absent} Absent</span>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* Analytics KPI Ribbon */}
      <div className="grid grid-cols-2 lg:grid-cols-5 gap-3.5">
        <div className="bg-white dark:bg-gray-900 p-4 rounded-2xl border border-gray-200 dark:border-gray-800 shadow-2xs">
          <div className="flex items-center justify-between text-gray-500 text-xs font-semibold">
            <span>Total Students</span>
            <Users size={16} className="text-teal-600" />
          </div>
          <div className="text-2xl font-black text-gray-900 dark:text-white mt-1">
            {stats.total}
          </div>
          <div className="text-[11px] text-gray-400 mt-0.5">Unique students matching filters</div>
        </div>

        <div className="bg-white dark:bg-gray-900 p-4 rounded-2xl border border-gray-200 dark:border-gray-800 shadow-2xs">
          <div className="flex items-center justify-between text-emerald-600 text-xs font-semibold">
            <span>Present Rate</span>
            <CheckCircle2 size={16} />
          </div>
          <div className="text-2xl font-black text-emerald-600 mt-1">
            {stats.overallRate}%
          </div>
          <div className="text-[11px] text-gray-400 mt-0.5">{stats.present} students attended</div>
        </div>

        <div className="bg-white dark:bg-gray-900 p-4 rounded-2xl border border-gray-200 dark:border-gray-800 shadow-2xs">
          <div className="flex items-center justify-between text-amber-600 text-xs font-semibold">
            <span>Partial Sessions</span>
            <Clock size={16} />
          </div>
          <div className="text-2xl font-black text-amber-600 mt-1">
            {stats.partial}
          </div>
          <div className="text-[11px] text-gray-400 mt-0.5">25% - 74% duration</div>
        </div>

        <div className="bg-white dark:bg-gray-900 p-4 rounded-2xl border border-gray-200 dark:border-gray-800 shadow-2xs">
          <div className="flex items-center justify-between text-rose-600 text-xs font-semibold">
            <span>Absent Count</span>
            <XCircle size={16} />
          </div>
          <div className="text-2xl font-black text-rose-600 mt-1">
            {stats.absent}
          </div>
          <div className="text-[11px] text-gray-400 mt-0.5">&lt; 25% duration or unjoined</div>
        </div>

        <div className="bg-white dark:bg-gray-900 p-4 rounded-2xl border border-gray-200 dark:border-gray-800 shadow-2xs">
          <div className="flex items-center justify-between text-indigo-600 text-xs font-semibold">
            <span>Avg. Time Spent</span>
            <Calendar size={16} />
          </div>
          <div className="text-2xl font-black text-indigo-600 mt-1">
            {stats.avgMinutes} <span className="text-xs font-normal text-gray-400">min</span>
          </div>
          <div className="text-[11px] text-gray-400 mt-0.5">Across filtered records</div>
        </div>
      </div>

      {/* Filter and Search Bar */}
      <div className="bg-white dark:bg-gray-900 rounded-3xl p-5 border border-gray-200 dark:border-gray-800 shadow-xs space-y-4">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
          {/* Search Bar */}
          <div className="relative flex-1">
            <Search className="w-4 h-4 text-gray-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              placeholder="Search by Student PCAID, Name, or Phone..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-10 pr-4 py-2.5 bg-gray-50 dark:bg-gray-800/80 border border-gray-200 dark:border-gray-700 rounded-xl text-xs text-gray-900 dark:text-white focus:outline-hidden focus:ring-2 focus:ring-teal-500/30 focus:border-teal-500 transition-all placeholder:text-gray-400"
            />
            {searchQuery && (
              <button
                onClick={() => setSearchQuery('')}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 cursor-pointer"
              >
                <X size={14} />
              </button>
            )}
          </div>

          {/* Action buttons */}
          <div className="flex items-center gap-2.5 flex-wrap">
            <button
              onClick={handleClearFilters}
              disabled={!hasActiveFilters}
              className={`px-3.5 py-2.5 rounded-xl text-xs font-bold flex items-center gap-1.5 transition-all ${
                hasActiveFilters
                  ? 'bg-rose-50 hover:bg-rose-100 text-rose-700 dark:bg-rose-950/40 dark:text-rose-300 dark:hover:bg-rose-900/60 border border-rose-200 dark:border-rose-800 cursor-pointer shadow-2xs'
                  : 'bg-gray-100 dark:bg-gray-800 text-gray-400 dark:text-gray-500 cursor-not-allowed border border-transparent opacity-60'
              }`}
              title={hasActiveFilters ? "Reset all search and filter conditions" : "No active filters to reset"}
            >
              <RotateCcw size={14} className={hasActiveFilters ? 'text-rose-600 dark:text-rose-400' : 'text-gray-400'} />
              <span>Clear Filters</span>
              {hasActiveFilters && (
                <span className="w-1.5 h-1.5 rounded-full bg-rose-500 animate-pulse" />
              )}
            </button>

            <button
              onClick={fetchAttendanceRecords}
              disabled={isLoadingRecords}
              className="px-3.5 py-2.5 bg-gray-100 hover:bg-gray-200 dark:bg-gray-800 dark:hover:bg-gray-700 text-gray-700 dark:text-gray-200 rounded-xl text-xs font-bold flex items-center gap-1.5 transition-colors cursor-pointer"
            >
              <RefreshCw size={14} className={isLoadingRecords ? 'animate-spin' : ''} />
              <span>Refresh</span>
            </button>

            <button
              onClick={handleExportCSV}
              className="px-3.5 py-2.5 bg-teal-600 hover:bg-teal-700 text-white rounded-xl text-xs font-bold flex items-center gap-1.5 transition-colors cursor-pointer shadow-xs"
            >
              <Download size={14} />
              <span>Export Combined Excel/CSV</span>
            </button>
          </div>
        </div>

        {/* Dropdown Filters Row */}
        <div className="flex flex-wrap items-end gap-2.5 pt-2 border-t border-gray-100 dark:border-gray-800 text-xs">
          {/* Class Type selector */}
          <div className="flex-1 min-w-[260px] max-w-full">
            <label className="text-[10px] font-bold text-gray-500 uppercase tracking-wider block mb-1">Class Type</label>
            <select
              value={filterClassType}
              onChange={(e) => setFilterClassType(e.target.value)}
              className="w-full px-2.5 py-1.5 bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg text-xs text-gray-900 dark:text-white font-medium cursor-pointer focus:ring-2 focus:ring-teal-500/20 focus:border-teal-500 transition-all"
            >
              <option value="all">All Class Types ({aggregatedStudents.length} Students)</option>
              {availableClassTypes.map(ct => (
                <option key={ct} value={ct}>{ct}</option>
              ))}
            </select>
          </div>

          {/* Batch Slot filter */}
          <div className="w-full sm:w-auto sm:min-w-[145px]">
            <label className="text-[10px] font-bold text-gray-500 uppercase tracking-wider block mb-1">Batch Slot</label>
            <select
              value={filterSlot}
              onChange={(e) => setFilterSlot(e.target.value)}
              className="w-full px-2.5 py-1.5 bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg text-xs text-gray-900 dark:text-white font-medium cursor-pointer"
            >
              <option value="all">All Slots</option>
              <option value="Batch 1">Batch 1 (4.30 PM)</option>
              <option value="Batch 2">Batch 2 (8.00 PM)</option>
              <option value="Batch 3">Batch 3 (9.30 PM)</option>
              <option value="none">No Slot (Absent)</option>
            </select>
          </div>

          {/* Status filter */}
          <div className="w-full sm:w-auto sm:min-w-[135px]">
            <label className="text-[10px] font-bold text-gray-500 uppercase tracking-wider block mb-1">Status</label>
            <select
              value={filterStatus}
              onChange={(e) => setFilterStatus(e.target.value)}
              className="w-full px-2.5 py-1.5 bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg text-xs text-gray-900 dark:text-white font-medium cursor-pointer"
            >
              <option value="all">All Statuses</option>
              <option value="present">Present (≥75%)</option>
              <option value="partial">Partial (25-74%)</option>
              <option value="absent">Absent (&lt;25%)</option>
              <option value="unjoined">Unjoined (0 min)</option>
              <option value="excused">Excused</option>
            </select>
          </div>

          {/* Target Batch filter */}
          <div className="w-full sm:w-auto sm:min-w-[115px]">
            <label className="text-[10px] font-bold text-gray-500 uppercase tracking-wider block mb-1">Batch</label>
            <select
              value={filterBatch}
              onChange={(e) => setFilterBatch(e.target.value)}
              className="w-full px-2.5 py-1.5 bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg text-xs text-gray-900 dark:text-white font-medium cursor-pointer"
            >
              <option value="all">All Batches</option>
              <option value="2027">2027 Batch</option>
              <option value="2028">2028 Batch</option>
              <option value="2026">2026 Batch</option>
              <option value="2025">2025 Batch</option>
              <option value="Repeaters">Repeaters</option>
            </select>
          </div>

          {/* Date From */}
          <div className="w-full sm:w-auto sm:min-w-[130px]">
            <label className="text-[10px] font-bold text-gray-500 uppercase tracking-wider block mb-1">Date From</label>
            <input
              type="date"
              value={filterDateFrom}
              onChange={(e) => setFilterDateFrom(e.target.value)}
              className="w-full px-2 py-1.5 bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg text-xs text-gray-900 dark:text-white font-medium"
            />
          </div>

          {/* Date To */}
          <div className="w-full sm:w-auto sm:min-w-[130px]">
            <label className="text-[10px] font-bold text-gray-500 uppercase tracking-wider block mb-1">Date To</label>
            <input
              type="date"
              value={filterDateTo}
              onChange={(e) => setFilterDateTo(e.target.value)}
              className="w-full px-2 py-1.5 bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg text-xs text-gray-900 dark:text-white font-medium"
            />
          </div>
        </div>

        {/* Active Filters Pill Bar (when filters applied) */}
        {hasActiveFilters && (
          <div className="flex items-center gap-2 flex-wrap pt-2.5 border-t border-dashed border-gray-200 dark:border-gray-800 text-[11px]">
            <span className="font-semibold text-gray-500 dark:text-gray-400 flex items-center gap-1">
              <Filter size={12} />
              Active filters:
            </span>
            {searchQuery && (
              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-teal-50 dark:bg-teal-950/60 text-teal-700 dark:text-teal-300 border border-teal-200 dark:border-teal-800 font-medium">
                Search: "{searchQuery}"
                <button onClick={() => setSearchQuery('')} className="hover:text-teal-900 dark:hover:text-white cursor-pointer"><X size={11} /></button>
              </span>
            )}
            {filterClassType !== 'all' && (
              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-teal-50 dark:bg-teal-950/60 text-teal-700 dark:text-teal-300 border border-teal-200 dark:border-teal-800 font-medium">
                Class: {filterClassType}
                <button onClick={() => setFilterClassType('all')} className="hover:text-teal-900 dark:hover:text-white cursor-pointer"><X size={11} /></button>
              </span>
            )}
            {filterSlot !== 'all' && (
              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-teal-50 dark:bg-teal-950/60 text-teal-700 dark:text-teal-300 border border-teal-200 dark:border-teal-800 font-medium">
                Slot: {filterSlot}
                <button onClick={() => setFilterSlot('all')} className="hover:text-teal-900 dark:hover:text-white cursor-pointer"><X size={11} /></button>
              </span>
            )}
            {filterStatus !== 'all' && (
              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-teal-50 dark:bg-teal-950/60 text-teal-700 dark:text-teal-300 border border-teal-200 dark:border-teal-800 font-medium">
                Status: {filterStatus === 'unjoined' ? 'Unjoined (0 min)' : filterStatus}
                <button onClick={() => setFilterStatus('all')} className="hover:text-teal-900 dark:hover:text-white cursor-pointer"><X size={11} /></button>
              </span>
            )}
            {filterBatch !== 'all' && (
              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-teal-50 dark:bg-teal-950/60 text-teal-700 dark:text-teal-300 border border-teal-200 dark:border-teal-800 font-medium">
                Batch: {filterBatch}
                <button onClick={() => setFilterBatch('all')} className="hover:text-teal-900 dark:hover:text-white cursor-pointer"><X size={11} /></button>
              </span>
            )}
            {filterDateFrom && (
              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-teal-50 dark:bg-teal-950/60 text-teal-700 dark:text-teal-300 border border-teal-200 dark:border-teal-800 font-medium">
                From: {filterDateFrom}
                <button onClick={() => setFilterDateFrom('')} className="hover:text-teal-900 dark:hover:text-white cursor-pointer"><X size={11} /></button>
              </span>
            )}
            {filterDateTo && (
              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-teal-50 dark:bg-teal-950/60 text-teal-700 dark:text-teal-300 border border-teal-200 dark:border-teal-800 font-medium">
                To: {filterDateTo}
                <button onClick={() => setFilterDateTo('')} className="hover:text-teal-900 dark:hover:text-white cursor-pointer"><X size={11} /></button>
              </span>
            )}
            <button
              onClick={handleClearFilters}
              className="text-rose-600 dark:text-rose-400 hover:text-rose-700 dark:hover:text-rose-300 font-bold ml-auto cursor-pointer hover:underline flex items-center gap-1"
            >
              <RotateCcw size={11} />
              Clear all filters
            </button>
          </div>
        )}
      </div>

      {/* Attendance Records Data Table */}
      <div className="bg-white dark:bg-gray-900 rounded-3xl border border-gray-200 dark:border-gray-800 shadow-xs overflow-hidden transition-colors">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-gray-50/75 dark:bg-gray-800/50 border-b border-gray-200 dark:border-gray-800 text-[11px] font-black uppercase tracking-wider text-gray-500 dark:text-gray-400">
                <th className="px-5 py-3.5">Student / PCA ID</th>
                <th className="px-4 py-3.5">Class & Batches Attended</th>
                <th className="px-4 py-3.5">Duration Attended</th>
                <th className="px-4 py-3.5">Attendance %</th>
                <th className="px-4 py-3.5">Final Status</th>
                <th className="px-4 py-3.5">Rejoins</th>
                <th className="px-4 py-3.5 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100 dark:divide-gray-800 text-xs">
              {isLoadingRecords ? (
                <tr>
                  <td colSpan={7} className="px-5 py-12 text-center text-gray-500">
                    <div className="flex flex-col items-center justify-center gap-2">
                      <Loader2 className="w-6 h-6 animate-spin text-teal-600" />
                      <span>Loading attendance records...</span>
                    </div>
                  </td>
                </tr>
              ) : paginatedStudents.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-5 py-12 text-center text-gray-500">
                    <div className="flex flex-col items-center justify-center gap-2">
                      <AlertCircle className="w-6 h-6 text-gray-400" />
                      <p className="font-semibold text-gray-700 dark:text-gray-300">No attendance records match your criteria.</p>
                      <p className="text-xs text-gray-400">Try adjusting your filters or upload Zoom batch CSV files above.</p>
                      {hasActiveFilters && (
                        <button
                          onClick={handleClearFilters}
                          className="mt-2 inline-flex items-center gap-1.5 px-3.5 py-1.5 bg-rose-50 hover:bg-rose-100 dark:bg-rose-950/50 dark:hover:bg-rose-900/50 text-rose-600 dark:text-rose-300 border border-rose-200 dark:border-rose-800 text-xs font-bold rounded-xl transition-colors cursor-pointer"
                        >
                          <RotateCcw size={13} />
                          <span>Clear Filters</span>
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              ) : (
                paginatedStudents.map((s) => {
                  const studentName = `${s.student?.name || ''} ${s.student?.last_name || ''}`.trim() || 'Unknown Student';
                  const pct = Number(s.attendance_percentage) || 0;

                  return (
                    <tr 
                      key={s.pcaid}
                      className="hover:bg-gray-50/60 dark:hover:bg-gray-800/40 transition-colors"
                    >
                      {/* Student info */}
                      <td className="px-5 py-3.5 whitespace-nowrap">
                        <div className="font-bold text-gray-900 dark:text-white flex items-center gap-1.5 flex-wrap">
                          <span className="font-mono text-teal-700 dark:text-teal-400 bg-teal-50 dark:bg-teal-950/60 px-2 py-0.5 rounded-md border border-teal-200/60 dark:border-teal-900/40 text-[11px]">
                            {s.pcaid}
                          </span>
                          {s.record_count > 1 && (
                            <span 
                              title={`Student has ${s.record_count} batch attendance records combined`}
                              className="px-1.5 py-0.5 rounded-full text-[10px] font-extrabold bg-indigo-50 dark:bg-indigo-950/60 text-indigo-700 dark:text-indigo-300 border border-indigo-200 dark:border-indigo-800"
                            >
                              {s.record_count}x Batches
                            </span>
                          )}
                        </div>
                        <div className="text-gray-700 dark:text-gray-300 font-medium mt-0.5">
                          {studentName}
                        </div>
                        <div className="text-[11px] text-gray-400 flex items-center gap-1.5 mt-0.5">
                          <span>Batch: {s.student?.proper_batch || s.target_batch}</span>
                          {s.student?.phone && (
                            <>
                              <span>•</span>
                              <span>{s.student.phone}</span>
                            </>
                          )}
                        </div>
                      </td>

                      {/* Class & Batches Attended */}
                      <td className="px-4 py-3.5 max-w-xs">
                        <div className="font-semibold text-gray-900 dark:text-white truncate" title={s.class_types.join(', ')}>
                          {s.class_types.join(', ') || classType}
                        </div>
                        <div className="flex items-center gap-1.5 text-[11px] text-gray-500 mt-1 flex-wrap">
                          <span className="font-mono text-gray-600 dark:text-gray-400">
                            {s.session_dates.length > 0 ? s.session_dates.join(', ') : sessionDate}
                          </span>
                          {s.batch_slots.length > 0 ? (
                            s.batch_slots.map((slot, idx) => (
                              <React.Fragment key={idx}>
                                <span>•</span>
                                {getSlotBadge(slot)}
                              </React.Fragment>
                            ))
                          ) : (
                            s.class_types.some(ct => (ct || '').toLowerCase().includes('maxout')) ? (
                              <>
                                <span>•</span>
                                <span className="text-[10px] text-gray-400 dark:text-gray-500 font-mono italic">No Slot (Absent)</span>
                              </>
                            ) : null
                          )}
                        </div>
                      </td>

                      {/* Duration */}
                      <td className="px-4 py-3.5 whitespace-nowrap">
                        <div className="font-mono font-bold text-gray-900 dark:text-white">
                          {s.total_attended_minutes} <span className="text-gray-400 text-xs font-normal">/ {s.session_duration_minutes} min</span>
                        </div>
                        {s.first_join_time && (
                          <div className="text-[10px] text-gray-400 mt-0.5">
                            Joined {formatTimeDisplay(s.first_join_time) || s.first_join_time}
                          </div>
                        )}
                      </td>

                      {/* Percentage Bar */}
                      <td className="px-4 py-3.5 whitespace-nowrap">
                        <div className="flex items-center gap-2.5">
                          <span className="font-mono font-bold text-xs text-gray-800 dark:text-gray-200 min-w-10">
                            {pct.toFixed(0)}%
                          </span>
                          <div className="w-16 bg-gray-100 dark:bg-gray-800 rounded-full h-2 overflow-hidden">
                            <div
                              className={`h-full rounded-full transition-all ${
                                pct >= 75
                                  ? 'bg-emerald-500'
                                  : pct >= 25
                                  ? 'bg-amber-500'
                                  : 'bg-rose-500'
                              }`}
                              style={{ width: `${Math.min(100, Math.max(0, pct))}%` }}
                            />
                          </div>
                        </div>
                      </td>

                      {/* Final Status */}
                      <td className="px-4 py-3.5 whitespace-nowrap">
                        {getStatusBadge(s.status, s.excuse_reason)}
                        {s.excuse_reason && (
                          <div className="text-[10px] text-indigo-600 dark:text-indigo-400 max-w-44 truncate mt-0.5" title={s.excuse_reason}>
                            Reason: {s.excuse_reason}
                          </div>
                        )}
                      </td>

                      {/* Rejoins */}
                      <td className="px-4 py-3.5 whitespace-nowrap">
                        {s.reconnect_count > 0 ? (
                          <span className="px-2 py-0.5 bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-300 rounded-md text-[11px] font-mono font-semibold">
                            {s.reconnect_count} re-joins
                          </span>
                        ) : (
                          <span className="text-gray-400 text-xs">-</span>
                        )}
                      </td>

                      {/* Actions */}
                      <td className="px-4 py-3.5 whitespace-nowrap text-right">
                        <div className="flex items-center justify-end gap-1">
                          <button
                            onClick={() => {
                              setEditingStudent(s);
                              setEditStatus(s.status);
                              setEditExcuseReason(s.excuse_reason || '');
                            }}
                            title="Edit / Override Status"
                            className="p-1.5 text-gray-400 hover:text-teal-600 dark:hover:text-teal-400 rounded-lg hover:bg-teal-50 dark:hover:bg-teal-950/40 transition-colors cursor-pointer"
                          >
                            <Edit3 size={15} />
                          </button>
                          <button
                            onClick={() => handleDeleteStudent(s)}
                            disabled={deletingId === s.id}
                            title="Delete Records for this Student"
                            className="p-1.5 text-gray-400 hover:text-rose-600 dark:hover:text-rose-400 rounded-lg hover:bg-rose-50 dark:hover:bg-rose-950/40 transition-colors cursor-pointer disabled:opacity-40"
                          >
                            <Trash2 size={15} />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination Footer */}
        {totalPages > 1 && (
          <div className="p-4 border-t border-gray-100 dark:border-gray-800 flex items-center justify-between text-xs text-gray-500">
            <div>
              Showing {(currentPage - 1) * itemsPerPage + 1} -{' '}
              {Math.min(currentPage * itemsPerPage, aggregatedStudents.length)} of {aggregatedStudents.length} students
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                disabled={currentPage === 1}
                className="p-1.5 border border-gray-200 dark:border-gray-700 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-800 disabled:opacity-40 cursor-pointer"
              >
                <ChevronLeft size={16} />
              </button>
              <span className="font-bold text-gray-700 dark:text-gray-300">
                Page {currentPage} of {totalPages}
              </span>
              <button
                onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                disabled={currentPage === totalPages}
                className="p-1.5 border border-gray-200 dark:border-gray-700 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-800 disabled:opacity-40 cursor-pointer"
              >
                <ChevronRight size={16} />
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Manual Status Override Modal */}
      <AnimatePresence>
        {editingStudent && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-xs">
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-2xl w-full max-w-md p-6 shadow-xl space-y-4"
            >
              <div className="flex items-center justify-between pb-3 border-b border-gray-100 dark:border-gray-800">
                <h3 className="text-base font-bold text-gray-900 dark:text-white flex items-center gap-2">
                  <Edit3 size={16} className="text-teal-600 dark:text-teal-400" />
                  <span>Override Student Attendance Status</span>
                </h3>
                <button
                  onClick={() => setEditingStudent(null)}
                  className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 cursor-pointer"
                >
                  <X size={18} />
                </button>
              </div>

              <div className="text-xs space-y-1 text-gray-600 dark:text-gray-400 bg-gray-50 dark:bg-gray-800/60 p-3 rounded-xl border border-gray-100 dark:border-gray-800">
                <p>
                  <strong>Student:</strong> {editingStudent.student?.name} ({editingStudent.pcaid})
                </p>
                <p>
                  <strong>Class:</strong> {editingStudent.class_types.join(', ')}
                </p>
                {editingStudent.batch_slots.length > 0 && (
                  <p>
                    <strong>Attended Batches:</strong> {editingStudent.batch_slots.join(', ')}
                  </p>
                )}
                <p>
                  <strong>Date:</strong> {editingStudent.session_dates.join(', ')} • <strong>Total Attended:</strong> {editingStudent.total_attended_minutes} / {editingStudent.session_duration_minutes} min ({editingStudent.attendance_percentage}%)
                </p>
                <p className="text-[11px] text-teal-600 dark:text-teal-400">
                  {editingStudent.record_count} database record{editingStudent.record_count > 1 ? 's' : ''} will be updated with this status.
                </p>
              </div>

              <div className="space-y-2">
                <label className="text-xs font-bold text-gray-700 dark:text-gray-300">Set Status</label>
                <div className="grid grid-cols-2 gap-2">
                  {(['present', 'partial', 'absent', 'excused'] as AttendanceStatus[]).map((st) => (
                    <button
                      key={st}
                      type="button"
                      onClick={() => setEditStatus(st)}
                      className={`px-3 py-2 rounded-xl text-xs font-bold border transition-all cursor-pointer capitalize ${
                        editStatus === st
                          ? 'bg-teal-50 dark:bg-teal-950/50 text-teal-700 dark:text-teal-300 border-teal-500 ring-2 ring-teal-500/20'
                          : 'border-gray-200 dark:border-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-800'
                      }`}
                    >
                      {st}
                    </button>
                  ))}
                </div>
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-bold text-gray-700 dark:text-gray-300">Excuse / Override Note</label>
                <textarea
                  rows={3}
                  value={editExcuseReason}
                  onChange={(e) => setEditExcuseReason(e.target.value)}
                  placeholder="e.g. Granted special permission for school tournament, power outage, etc."
                  className="w-full px-3 py-2 bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl text-xs text-gray-900 dark:text-white focus:outline-hidden focus:ring-2 focus:ring-teal-500/30"
                />
              </div>

              <div className="flex items-center justify-end gap-2.5 pt-3 border-t border-gray-100 dark:border-gray-800">
                <button
                  type="button"
                  onClick={() => setEditingStudent(null)}
                  className="px-4 py-2 border border-gray-200 dark:border-gray-700 text-gray-600 dark:text-gray-300 rounded-xl text-xs font-bold hover:bg-gray-50 dark:hover:bg-gray-800 cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={handleSaveEdit}
                  disabled={isSavingEdit}
                  className="px-4 py-2 bg-teal-600 hover:bg-teal-700 text-white rounded-xl text-xs font-bold transition-all shadow-xs cursor-pointer disabled:opacity-50"
                >
                  {isSavingEdit ? 'Saving...' : 'Save Changes'}
                </button>
              </div>
            </motion.div>
          </div>
        )}

        {/* Row Level Security (RLS) Fix Helper Modal */}
        {showRlsModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs">
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="bg-white dark:bg-gray-900 rounded-2xl max-w-xl w-full p-6 shadow-2xl border border-red-200 dark:border-red-900/40 space-y-4"
            >
              <div className="flex items-start justify-between">
                <div className="flex items-center gap-3">
                  <div className="p-2.5 bg-red-100 dark:bg-red-950/60 rounded-xl text-red-600 dark:text-red-400">
                    <AlertCircle className="w-6 h-6" />
                  </div>
                  <div>
                    <h3 className="text-base font-bold text-gray-900 dark:text-white">
                      Supabase Row-Level Security (RLS) Policy Required
                    </h3>
                    <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
                      Your Supabase database blocked inserts on table <code className="text-red-600 dark:text-red-400 font-mono font-semibold">student_attendance</code> because RLS is active without an insert policy.
                    </p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setShowRlsModal(false)}
                  className="p-1 rounded-lg text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-800 cursor-pointer"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              <div className="p-3.5 bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-900/40 rounded-xl text-xs text-amber-800 dark:text-amber-300 space-y-1.5">
                <p className="font-bold">How to fix in 30 seconds:</p>
                <ol className="list-decimal pl-4 space-y-1 text-amber-700 dark:text-amber-300/90">
                  <li>Copy the SQL script below.</li>
                  <li>Open your <strong>Supabase Dashboard</strong> &rarr; <strong>SQL Editor</strong>.</li>
                  <li>Paste and click <strong>Run</strong> (or run <code className="font-mono">supabase_student_attendance.sql</code>).</li>
                  <li>Return here and click <strong>Sync Attendance</strong> again.</li>
                </ol>
              </div>

              <div className="space-y-1.5">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-gray-700 dark:text-gray-300 font-mono">
                    supabase_student_attendance.sql (RLS Policies)
                  </span>
                  <button
                    type="button"
                    onClick={() => {
                      const sql = `-- Enable Row Level Security (RLS) on student_attendance
ALTER TABLE public.student_attendance ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Allow select student_attendance" ON public.student_attendance;
CREATE POLICY "Allow select student_attendance"
ON public.student_attendance FOR SELECT USING (true);

DROP POLICY IF EXISTS "Allow insert student_attendance" ON public.student_attendance;
CREATE POLICY "Allow insert student_attendance"
ON public.student_attendance FOR INSERT WITH CHECK (true);

DROP POLICY IF EXISTS "Allow update student_attendance" ON public.student_attendance;
CREATE POLICY "Allow update student_attendance"
ON public.student_attendance FOR UPDATE USING (true);

DROP POLICY IF EXISTS "Allow delete student_attendance" ON public.student_attendance;
CREATE POLICY "Allow delete student_attendance"
ON public.student_attendance FOR DELETE USING (true);`;
                      navigator.clipboard.writeText(sql);
                      setCopiedSql(true);
                      toast.success('SQL copied to clipboard!');
                      setTimeout(() => setCopiedSql(false), 3000);
                    }}
                    className="flex items-center gap-1.5 px-3 py-1 bg-teal-50 dark:bg-teal-950/50 hover:bg-teal-100 dark:hover:bg-teal-900/50 text-teal-700 dark:text-teal-300 border border-teal-200 dark:border-teal-800 rounded-lg text-xs font-bold transition-all cursor-pointer"
                  >
                    {copiedSql ? (
                      <>
                        <Check className="w-3.5 h-3.5 text-teal-600 dark:text-teal-400" />
                        <span>Copied!</span>
                      </>
                    ) : (
                      <>
                        <Copy className="w-3.5 h-3.5" />
                        <span>Copy SQL</span>
                      </>
                    )}
                  </button>
                </div>
                <pre className="p-3 bg-gray-900 text-teal-300 rounded-xl text-[11px] font-mono overflow-x-auto max-h-48 border border-gray-800 leading-relaxed select-all">
{`-- Enable Row Level Security (RLS) on student_attendance
ALTER TABLE public.student_attendance ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Allow select student_attendance" ON public.student_attendance;
CREATE POLICY "Allow select student_attendance"
ON public.student_attendance FOR SELECT USING (true);

DROP POLICY IF EXISTS "Allow insert student_attendance" ON public.student_attendance;
CREATE POLICY "Allow insert student_attendance"
ON public.student_attendance FOR INSERT WITH CHECK (true);

DROP POLICY IF EXISTS "Allow update student_attendance" ON public.student_attendance;
CREATE POLICY "Allow update student_attendance"
ON public.student_attendance FOR UPDATE USING (true);

DROP POLICY IF EXISTS "Allow delete student_attendance" ON public.student_attendance;
CREATE POLICY "Allow delete student_attendance"
ON public.student_attendance FOR DELETE USING (true);`}
                </pre>
              </div>

              <div className="flex items-center justify-between pt-3 border-t border-gray-100 dark:border-gray-800">
                <span className="text-[11px] text-gray-500 dark:text-gray-400">
                  File saved at: <code className="font-mono text-gray-700 dark:text-gray-300">/supabase_student_attendance.sql</code>
                </span>
                <button
                  type="button"
                  onClick={() => setShowRlsModal(false)}
                  className="px-4 py-2 bg-gray-900 dark:bg-white text-white dark:text-gray-900 rounded-xl text-xs font-bold hover:bg-gray-800 dark:hover:bg-gray-100 transition-all cursor-pointer shadow-xs"
                >
                  I've run the SQL, Got it!
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}

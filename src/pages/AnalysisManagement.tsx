import React, { useState, useEffect, useMemo } from 'react';
import { useSearchParams } from 'react-router-dom';
import { 
  CreditCard, 
  Video, 
  Search, 
  Download, 
  Copy, 
  Check, 
  AlertTriangle, 
  RefreshCw, 
  Filter, 
  UserCheck, 
  UserX, 
  ExternalLink,
  ChevronRight,
  TrendingUp,
  Users,
  Calendar,
  Sparkles,
  Phone,
  MessageSquare,
  ArrowRight
} from 'lucide-react';
import { supabase } from '../lib/supabase';
import { Student, Payment, ZoomRegistrationRecord } from '../types';
import { useAuth } from '../hooks/useAuth';
import { toast } from 'sonner';

const MONTH_NAMES = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December'
];

export default function AnalysisManagement() {
  const { user } = useAuth();
  const [searchParams] = useSearchParams();

  // Active View Tab controlled by header tab navigation (?tab=side-by-side | continuity)
  const activeTab = (searchParams.get('tab') as 'side-by-side' | 'continuity') || 'side-by-side';

  // Loading & Refresh State
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);

  // Raw Database Data
  const [students, setStudents] = useState<Student[]>([]);
  const [payments, setPayments] = useState<Payment[]>([]);
  const [zoomRegistrations, setZoomRegistrations] = useState<ZoomRegistrationRecord[]>([]);
  const [classes, setClasses] = useState<{ id: string; class_type: string }[]>([]);
  const [webinars, setWebinars] = useState<{ id: number; webinar_id: string; webinar_name: string }[]>([]);

  // ---------------------------------------------------------------------------
  // LEFT PANEL FILTERS (Payment Analysis)
  // ---------------------------------------------------------------------------
  const currentYearStr = String(new Date().getFullYear());
  const currentMonthIdx = new Date().getMonth();
  const currentMonthName = MONTH_NAMES[currentMonthIdx];

  const [payYearFilter, setPayYearFilter] = useState<string>(currentYearStr);
  const [payMonthFilter, setPayMonthFilter] = useState<string>(currentMonthName);
  const [payClassFilter, setPayClassFilter] = useState<string>('all');
  const [paySearchQuery, setPaySearchQuery] = useState<string>('');
  const [payMissingSearchQuery, setPayMissingSearchQuery] = useState<string>('');

  // ---------------------------------------------------------------------------
  // RIGHT PANEL FILTERS (Zoom Registration Analysis)
  // ---------------------------------------------------------------------------
  const [zoomYearFilter, setZoomYearFilter] = useState<string>(currentYearStr);
  const [zoomMonthFilter, setZoomMonthFilter] = useState<string>(currentMonthName);
  const [selectedWebinarId, setSelectedWebinarId] = useState<string>('all');
  const [zoomSearchQuery, setZoomSearchQuery] = useState<string>('');
  const [zoomMissingSearchQuery, setZoomMissingSearchQuery] = useState<string>('');

  // Selection for registering missing zoom students
  const [selectedMissingZoomPcaids, setSelectedMissingZoomPcaids] = useState<string[]>([]);
  const [isRegisteringMissing, setIsRegisteringMissing] = useState(false);
  const [registerProgress, setRegisterProgress] = useState<{ done: number; total: number }>({ done: 0, total: 0 });

  // ---------------------------------------------------------------------------
  // CONTINUITY TAB FILTERS
  // ---------------------------------------------------------------------------
  const [baselineMonth, setBaselineMonth] = useState<string>(MONTH_NAMES[(currentMonthIdx + 11) % 12]); // Previous month
  const [targetMonth, setTargetMonth] = useState<string>(currentMonthName); // Current month
  const [continuityYear, setContinuityYear] = useState<string>(currentYearStr);
  const [continuityClassFilter, setContinuityClassFilter] = useState<string>('all');
  const [continuitySearchQuery, setContinuitySearchQuery] = useState<string>('');
  const [continuitySegment, setContinuitySegment] = useState<'all' | 'continuous' | 'churned' | 'new' | 'reactivated'>('all');

  // Copy Feedback state
  const [copiedKey, setCopiedKey] = useState<string | null>(null);

  // Available Years
  const availableYears = useMemo(() => {
    const yearsSet = new Set<string>();
    yearsSet.add(currentYearStr);
    yearsSet.add(String(new Date().getFullYear() - 1));
    yearsSet.add(String(new Date().getFullYear() + 1));

    payments.forEach(p => {
      if (p.paid_date) {
        const y = p.paid_date.split('-')[0];
        if (y && y.length === 4) yearsSet.add(y);
      }
    });
    return Array.from(yearsSet).sort().reverse();
  }, [payments, currentYearStr]);

  // Compute clean, unique base class types (without monthly suffix) exactly like StudentManagement
  const baseClassTypes = useMemo(() => {
    const cleaned = classes.map(c => {
      if (!c.class_type) return '';
      const match = MONTH_NAMES.find(m => 
        c.class_type.endsWith(` ${m}`) || 
        c.class_type.endsWith(` - ${m}`) ||
        c.class_type.toLowerCase().includes(`- ${m.toLowerCase()}`)
      );
      if (match) {
        let idx = c.class_type.lastIndexOf(` - ${match}`);
        if (idx === -1) {
          idx = c.class_type.lastIndexOf(` ${match}`);
        }
        if (idx !== -1) {
          return c.class_type.substring(0, idx).trim();
        }
      }
      return c.class_type.trim();
    }).filter(Boolean);

    return (Array.from(new Set(cleaned)) as string[]).sort((a: string, b: string) => {
      const topPriorityClasses = [
        'Admission',
        'MaxouT',
        'Paper Class with Theory Revision',
        'Paper Class with Theory'
      ];
      const idxA = topPriorityClasses.indexOf(a);
      const idxB = topPriorityClasses.indexOf(b);
      if (idxA !== -1 && idxB !== -1) return idxA - idxB;
      if (idxA !== -1) return -1;
      if (idxB !== -1) return 1;
      return a.localeCompare(b);
    });
  }, [classes]);

  // Fetch all initial data
  const fetchData = async () => {
    try {
      setIsRefreshing(true);

      const [
        studentsRes, 
        paymentsRes, 
        zoomRegRes, 
        classesRes, 
        webinarsRes
      ] = await Promise.all([
        supabase.from('student').select('*').is('deleted_at', null).order('pcaid'),
        supabase.from('payment').select('*').is('deleted_at', null).order('paid_date', { ascending: false }),
        supabase.from('zoom_registration').select('*').is('deleted_at', null).order('registered_at', { ascending: false }),
        supabase.from('class_item').select('*').order('class_type'),
        supabase.from('webinar_id').select('*').order('created_at', { ascending: false })
      ]);

      if (studentsRes.data) setStudents(studentsRes.data as Student[]);
      if (paymentsRes.data) setPayments(paymentsRes.data as Payment[]);
      if (zoomRegRes.data) setZoomRegistrations(zoomRegRes.data as ZoomRegistrationRecord[]);
      if (classesRes.data) setClasses(classesRes.data);
      if (webinarsRes.data) setWebinars(webinarsRes.data);

      // Auto-select first webinar if none selected
      if (webinarsRes.data && webinarsRes.data.length > 0 && selectedWebinarId === 'all') {
        setSelectedWebinarId(webinarsRes.data[0].webinar_id);
      }
    } catch (err: any) {
      console.error('Error fetching analysis data:', err);
      toast.error('Failed to load analysis records: ' + (err.message || 'Unknown error'));
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  // Map students by PCA ID for O(1) fast lookup
  const studentMap = useMemo(() => {
    const map = new Map<string, Student>();
    students.forEach(s => {
      if (s.pcaid) map.set(s.pcaid.trim().toUpperCase(), s);
    });
    return map;
  }, [students]);

  // ---------------------------------------------------------------------------
  // LEFT PANEL LOGIC: PAYMENT RECORDS & UNPAID MISSING LIST
  // ---------------------------------------------------------------------------
  
  // 1. Students who PAID matching the selected filters
  const paidStudentsList = useMemo(() => {
    return payments.filter(p => {
      if (!p.paid_date && !p.class_type) return false;

      // Extract payment year and month from paid_date (if present)
      let pYear = '';
      let pMonth = '';
      if (p.paid_date) {
        const dateParts = p.paid_date.split('-');
        if (dateParts.length >= 2) {
          pYear = dateParts[0];
          const pMonthIdx = parseInt(dateParts[1], 10) - 1;
          if (pMonthIdx >= 0 && pMonthIdx < 12) {
            pMonth = MONTH_NAMES[pMonthIdx];
          }
        }
      }

      // Year filter: check paid_date year or year mentioned in class_type
      if (payYearFilter !== 'all') {
        const yearInClass = (p.class_type || '').includes(payYearFilter);
        const yearInDate = pYear === payYearFilter;
        if (!yearInClass && !yearInDate) return false;
      }

      // Prepare individual class and package strings for this payment
      const rawItems: string[] = [];
      if (p.class_type) {
        p.class_type.split(',').forEach(item => {
          const trimmed = item.trim();
          if (trimmed) rawItems.push(trimmed);
        });
      }
      if (p.package_type) {
        p.package_type.split(',').forEach(item => {
          const trimmed = item.trim();
          if (trimmed) rawItems.push(trimmed);
        });
      }
      if (rawItems.length === 0) {
        rawItems.push(p.class_type || p.package_type || 'General');
      }

      // COMBINED FILTERING LOGIC:
      // When both month and class type are selected, the combined value is matched across items
      const matchesFilter = rawItems.some(item => {
        const itemLower = item.toLowerCase();

        // 1. Month match:
        // Matches if:
        // - payMonthFilter is 'all'
        // - OR item explicitly contains the month name (e.g. "2026 Theory October" or "2026 Theory - October")
        // - OR September shorthand ("sep")
        // - OR the payment's paid_date month matches payMonthFilter
        const monthMatch = payMonthFilter === 'all' || (
          itemLower.includes(payMonthFilter.toLowerCase()) ||
          (payMonthFilter.toLowerCase().startsWith('sep') && itemLower.includes('sep')) ||
          (pMonth && pMonth.toLowerCase() === payMonthFilter.toLowerCase())
        );

        if (!monthMatch) return false;

        // 2. Class match:
        if (payClassFilter === 'all') return true;

        const cLower = payClassFilter.toLowerCase().trim();

        // Check if item contains the full combined string: e.g. "2026 Theory October" or "2026 Theory - October"
        if (payMonthFilter !== 'all') {
          const combinedSpaced = `${cLower} ${payMonthFilter.toLowerCase()}`;
          const combinedHyphen = `${cLower} - ${payMonthFilter.toLowerCase()}`;
          if (itemLower.includes(combinedSpaced) || itemLower.includes(combinedHyphen)) {
            return true;
          }
        }

        // Direct containment
        if (itemLower.includes(cLower)) return true;

        // Check base item (stripping any month suffix like " - October" or " October")
        let baseItem = item;
        const foundMonth = MONTH_NAMES.find(m => 
          item.endsWith(` ${m}`) || 
          item.endsWith(` - ${m}`) || 
          item.toLowerCase().includes(`- ${m.toLowerCase()}`)
        );
        if (foundMonth) {
          baseItem = item.replace(new RegExp(`[- ]*${foundMonth}\\b`, 'gi'), '').trim();
        }
        const baseLower = baseItem.toLowerCase();
        return baseLower === cLower || baseLower.includes(cLower) || cLower.includes(baseLower);
      });

      if (!matchesFilter) return false;

      // Quick Search
      if (paySearchQuery.trim()) {
        const q = paySearchQuery.toLowerCase().trim();
        const s = studentMap.get(p.pcaid?.trim().toUpperCase());
        const matchPca = (p.pcaid || '').toLowerCase().includes(q);
        const matchName = (s?.name || '').toLowerCase().includes(q);
        const matchPhone = (s?.phone || '').includes(q);
        return matchPca || matchName || matchPhone;
      }

      return true;
    }).map(p => {
      const student = studentMap.get(p.pcaid?.trim().toUpperCase());
      return {
        paymentId: p.id,
        pcaid: p.pcaid,
        name: student?.name || 'Unknown',
        phone: student?.phone || '-',
        proper_batch: student?.proper_batch || '-',
        class_type: p.class_type || p.package_type || 'General',
        payment: p.payment,
        paid_date: p.paid_date,
        activation_date: p.activation_date,
        expired_date: p.expired_date
      };
    });
  }, [payments, payYearFilter, payMonthFilter, payClassFilter, paySearchQuery, studentMap]);

  // Set of PCA IDs who have paid in this selected year, month, and class
  const paidPcaidsSet = useMemo(() => {
    const set = new Set<string>();
    paidStudentsList.forEach(p => {
      if (p.pcaid) set.add(p.pcaid.trim().toUpperCase());
    });
    return set;
  }, [paidStudentsList]);

  // ---------------------------------------------------------------------------
  // RIGHT PANEL LOGIC: ZOOM REGISTRATIONS & CROSS AUDIT
  // ---------------------------------------------------------------------------

  // Unique webinars for dropdown
  const allWebinars = useMemo(() => {
    const map = new Map<string, string>();
    // From webinar_id table
    webinars.forEach(w => {
      if (w.webinar_id) {
        map.set(w.webinar_id.trim(), w.webinar_name || `Webinar ${w.webinar_id}`);
      }
    });
    // From zoom_registration table
    zoomRegistrations.forEach(zr => {
      if (zr.webinar_id && !map.has(zr.webinar_id.trim())) {
        map.set(zr.webinar_id.trim(), zr.webinar_name || `Webinar ${zr.webinar_id}`);
      }
    });

    return Array.from(map.entries()).map(([id, name]) => ({
      webinar_id: id,
      webinar_name: name
    }));
  }, [webinars, zoomRegistrations]);

  // Selected webinar details
  const activeWebinarObj = useMemo(() => {
    return allWebinars.find(w => w.webinar_id === selectedWebinarId);
  }, [allWebinars, selectedWebinarId]);

  // 1. Zoom Registered Students List matching filters
  const zoomRegisteredList = useMemo(() => {
    return zoomRegistrations.filter(zr => {
      if (zr.status !== 'Success') return false;

      // Webinar filter
      if (selectedWebinarId !== 'all') {
        if (zr.webinar_id?.trim() !== selectedWebinarId.trim()) return false;
      }

      // Year & Month filter on registered_at
      if (zr.registered_at) {
        const date = new Date(zr.registered_at);
        const zYear = String(date.getFullYear());
        const zMonth = MONTH_NAMES[date.getMonth()];

        if (zoomYearFilter !== 'all' && zYear !== zoomYearFilter) return false;
        if (zoomMonthFilter !== 'all' && zMonth !== zoomMonthFilter) return false;
      }

      // Search Query
      if (zoomSearchQuery.trim()) {
        const q = zoomSearchQuery.toLowerCase().trim();
        const matchPca = (zr.pcaid || '').toLowerCase().includes(q);
        const matchName = (zr.student_name || '').toLowerCase().includes(q);
        const matchEmail = (zr.email || '').toLowerCase().includes(q);
        return matchPca || matchName || matchEmail;
      }

      return true;
    });
  }, [zoomRegistrations, selectedWebinarId, zoomYearFilter, zoomMonthFilter, zoomSearchQuery]);

  // Set of PCA IDs who are successfully registered for the active webinar
  const zoomRegisteredPcaidsSet = useMemo(() => {
    const set = new Set<string>();
    zoomRegistrations.forEach(zr => {
      if (zr.status === 'Success' && zr.pcaid) {
        if (selectedWebinarId === 'all' || zr.webinar_id?.trim() === selectedWebinarId.trim()) {
          set.add(zr.pcaid.trim().toUpperCase());
        }
      }
    });
    return set;
  }, [zoomRegistrations, selectedWebinarId]);

  // ===========================================================================
  // MISSING LIST 1 (LEFT SECTION B): Enrolled Students with NO Payment
  // LOGIC: Students who have payment record for that specific class type (=month + class type)
  // but hasn't registered for the selected webinar yet.
  // ===========================================================================
  const paidStudentsMissingWebinarList = useMemo(() => {
    // Unique list of paid students (by PCA ID) from the left panel
    const uniquePaidMap = new Map<string, typeof paidStudentsList[0]>();
    paidStudentsList.forEach(p => {
      if (p.pcaid && !uniquePaidMap.has(p.pcaid.trim().toUpperCase())) {
        uniquePaidMap.set(p.pcaid.trim().toUpperCase(), p);
      }
    });

    return Array.from(uniquePaidMap.values()).filter(p => {
      const cleanPca = p.pcaid.trim().toUpperCase();

      // If already registered on this webinar, NOT missing
      if (zoomRegisteredPcaidsSet.has(cleanPca)) return false;

      // Search inside missing list
      if (payMissingSearchQuery.trim()) {
        const q = payMissingSearchQuery.toLowerCase().trim();
        const matchPca = cleanPca.toLowerCase().includes(q);
        const matchName = (p.name || '').toLowerCase().includes(q);
        const matchPhone = (p.phone || '').includes(q);
        const student = studentMap.get(cleanPca);
        const matchEmail = (student?.mail || '').toLowerCase().includes(q);
        return matchPca || matchName || matchPhone || matchEmail;
      }

      return true;
    });
  }, [paidStudentsList, zoomRegisteredPcaidsSet, payMissingSearchQuery, studentMap]);

  // ===========================================================================
  // MISSING LIST 2 (RIGHT SECTION B): Paid Students NOT on Zoom
  // LOGIC: Students who are registered for the selected webinar but has NO payment
  // records for the specific class type (=month + class type) in that selected year.
  // ===========================================================================
  const zoomRegistrantsMissingPaymentList = useMemo(() => {
    // Unique Zoom registrants for the active webinar
    const uniqueZoomMap = new Map<string, typeof zoomRegistrations[0]>();
    zoomRegistrations.forEach(zr => {
      if (zr.status === 'Success' && zr.pcaid) {
        if (selectedWebinarId === 'all' || zr.webinar_id?.trim() === selectedWebinarId.trim()) {
          const cleanPca = zr.pcaid.trim().toUpperCase();
          if (!uniqueZoomMap.has(cleanPca)) {
            uniqueZoomMap.set(cleanPca, zr);
          }
        }
      }
    });

    return Array.from(uniqueZoomMap.values()).filter(zr => {
      const cleanPca = zr.pcaid.trim().toUpperCase();

      // Check if student has payment record matching the selected year, month, and class type
      const hasPayment = paidPcaidsSet.has(cleanPca);
      if (hasPayment) {
        return false; // Student has paid, so NOT missing payment!
      }

      // Search inside right missing list
      if (zoomMissingSearchQuery.trim()) {
        const q = zoomMissingSearchQuery.toLowerCase().trim();
        const matchPca = cleanPca.toLowerCase().includes(q);
        const matchName = (zr.student_name || '').toLowerCase().includes(q);
        const matchEmail = (zr.email || '').toLowerCase().includes(q);
        const student = studentMap.get(cleanPca);
        const matchPhone = (student?.phone || '').includes(q);
        return matchPca || matchName || matchEmail || matchPhone;
      }

      return true;
    });
  }, [zoomRegistrations, selectedWebinarId, paidPcaidsSet, zoomMissingSearchQuery, studentMap]);

  // Toggle selection for registering missing students
  const toggleSelectMissingPcaid = (pcaid: string) => {
    setSelectedMissingZoomPcaids(prev => 
      prev.includes(pcaid) ? prev.filter(id => id !== pcaid) : [...prev, pcaid]
    );
  };

  const handleSelectAllMissingZoom = () => {
    if (selectedMissingZoomPcaids.length === paidStudentsMissingWebinarList.length) {
      setSelectedMissingZoomPcaids([]);
    } else {
      setSelectedMissingZoomPcaids(paidStudentsMissingWebinarList.map(p => p.pcaid));
    }
  };

  // Register missing students to selected webinar directly from the dashboard!
  const handleRegisterMissingOnZoom = async () => {
    if (!selectedWebinarId || selectedWebinarId === 'all') {
      toast.error('Please choose a specific webinar from the Webinar dropdown above before registering.');
      return;
    }

    const targetList = selectedMissingZoomPcaids.length > 0 
      ? paidStudentsMissingWebinarList.filter(p => selectedMissingZoomPcaids.includes(p.pcaid))
      : paidStudentsMissingWebinarList;

    if (targetList.length === 0) {
      toast.info('No missing students to register.');
      return;
    }

    setIsRegisteringMissing(true);
    setRegisterProgress({ done: 0, total: targetList.length });

    const webinarObj = allWebinars.find(w => w.webinar_id === selectedWebinarId);
    const webinarName = webinarObj?.webinar_name || `Webinar ${selectedWebinarId}`;

    const BATCH_SIZE = 10;
    const successfulToSave: any[] = [];
    let completedCount = 0;

    try {
      for (let i = 0; i < targetList.length; i += BATCH_SIZE) {
        const slice = targetList.slice(i, i + BATCH_SIZE);
        const payload = slice.map(item => {
          const s = studentMap.get(item.pcaid.trim().toUpperCase());
          const cleanEmail = (s?.mail && s.mail.trim()) ? s.mail.trim() : `${item.pcaid.toLowerCase()}@physicsacademy.lk`;
          // Split initials / first name if needed
          const cleanName = s?.name || item.name || 'Student';
          return {
            pcaid: item.pcaid,
            firstName: item.pcaid,
            lastName: cleanName,
            email: cleanEmail
          };
        });

        try {
          const resp = await fetch('/api/register-batch', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              webinarId: selectedWebinarId.trim(),
              eventType: 'webinar',
              students: payload.map(p => ({
                firstName: p.firstName,
                lastName: p.lastName,
                email: p.email
              }))
            })
          });

          if (resp.ok) {
            const data = await resp.json();
            if (data.results && Array.isArray(data.results)) {
              data.results.forEach((r: any) => {
                // Strictly ONLY save successful registrations
                if (r.status === 'Success') {
                  const matched = payload.find(p => p.email.toLowerCase() === r.email?.toLowerCase() || p.firstName.toLowerCase() === r.firstName?.toLowerCase());
                  successfulToSave.push({
                    pcaid: matched?.pcaid || r.firstName,
                    webinar_id: selectedWebinarId.trim(),
                    webinar_name: webinarName,
                    student_name: matched?.lastName || 'Student',
                    email: r.email,
                    event_type: 'webinar',
                    join_url: r.joinUrl || null,
                    status: 'Success',
                    registered_by: user?.username || 'admin',
                    registered_at: new Date().toISOString()
                  });
                }
              });
            }
          }
        } catch (apiErr) {
          console.warn('Batch registration error:', apiErr);
        }

        completedCount += slice.length;
        setRegisterProgress({ done: completedCount, total: targetList.length });
      }

      // Insert all successful registrations into zoom_registration table
      if (successfulToSave.length > 0) {
        const { error: insertErr } = await supabase
          .from('zoom_registration')
          .upsert(successfulToSave, { onConflict: 'pcaid,webinar_id' });

        if (insertErr) {
          console.error('zoom_registration upsert error:', insertErr);
        }
        toast.success(`Successfully registered and saved ${successfulToSave.length} student(s) on Zoom!`);
        // Refresh analysis data
        await fetchData();
        setSelectedMissingZoomPcaids([]);
      } else {
        toast.error('Could not complete registrations. Please verify Zoom credentials or webinar settings.');
      }
    } catch (err: any) {
      toast.error('Registration process failed: ' + (err.message || 'Unknown error'));
    } finally {
      setIsRegisteringMissing(false);
    }
  };

  // ---------------------------------------------------------------------------
  // CONTINUITY & RETENTION LOGIC (Tab 2)
  // ---------------------------------------------------------------------------
  const continuityAnalysis = useMemo(() => {
    // 1. Get payments for Baseline Month
    const baselinePaidMap = new Map<string, Payment>();
    // 2. Get payments for Target Month
    const targetPaidMap = new Map<string, Payment>();

    payments.forEach(p => {
      if (!p.paid_date) return false;
      const parts = p.paid_date.split('-');
      if (parts.length < 2) return;
      const y = parts[0];
      const m = MONTH_NAMES[parseInt(parts[1], 10) - 1];

      // Year match
      if (continuityYear !== 'all' && y !== continuityYear) return;

      // Class match
      if (continuityClassFilter !== 'all') {
        const pClass = (p.class_type || p.package_type || '').toLowerCase();
        if (!pClass.includes(continuityClassFilter.toLowerCase())) return;
      }

      const cleanPca = p.pcaid?.trim().toUpperCase();
      if (!cleanPca) return;

      if (m === baselineMonth) {
        baselinePaidMap.set(cleanPca, p);
      }
      if (m === targetMonth) {
        targetPaidMap.set(cleanPca, p);
      }
    });

    // All active students matching class filter
    const targetStudents = students.filter(s => {
      if (continuityClassFilter !== 'all') {
        const sClass = (s.asked_class_type || s.asked_package_type || s.proper_batch || '').toLowerCase();
        if (!sClass.includes(continuityClassFilter.toLowerCase())) return false;
      }
      return true;
    });

    const continuous: { student: Student; baselinePay: Payment; targetPay: Payment }[] = [];
    const churned: { student: Student; baselinePay: Payment }[] = [];
    const newJoinees: { student: Student; targetPay: Payment }[] = [];
    const reactivated: { student: Student; targetPay: Payment }[] = [];

    // Analyze transitions
    targetStudents.forEach(s => {
      const cleanPca = s.pcaid?.trim().toUpperCase();
      if (!cleanPca) return;

      const hasBaseline = baselinePaidMap.has(cleanPca);
      const hasTarget = targetPaidMap.has(cleanPca);

      if (hasBaseline && hasTarget) {
        continuous.push({
          student: s,
          baselinePay: baselinePaidMap.get(cleanPca)!,
          targetPay: targetPaidMap.get(cleanPca)!
        });
      } else if (hasBaseline && !hasTarget) {
        churned.push({
          student: s,
          baselinePay: baselinePaidMap.get(cleanPca)!
        });
      } else if (!hasBaseline && hasTarget) {
        // Check if student had ANY payment before baseline month
        const hadPriorPayments = payments.some(p => {
          if (p.pcaid?.trim().toUpperCase() !== cleanPca) return false;
          if (!p.paid_date) return false;
          return p.paid_date < (targetPaidMap.get(cleanPca)?.paid_date || '9999');
        });

        if (hadPriorPayments) {
          reactivated.push({
            student: s,
            targetPay: targetPaidMap.get(cleanPca)!
          });
        } else {
          newJoinees.push({
            student: s,
            targetPay: targetPaidMap.get(cleanPca)!
          });
        }
      }
    });

    return {
      continuous,
      churned,
      newJoinees,
      reactivated,
      totalTracked: targetStudents.length
    };
  }, [students, payments, baselineMonth, targetMonth, continuityYear, continuityClassFilter]);

  // Filtered list for Continuity Tab based on selected segment
  const continuityDisplayList = useMemo(() => {
    let list: Array<{
      pcaid: string;
      name: string;
      phone: string;
      proper_batch: string;
      status: 'Continuous' | 'Dropped Out' | 'New Joinee' | 'Reactivated';
      details: string;
    }> = [];

    if (continuitySegment === 'all' || continuitySegment === 'continuous') {
      continuityAnalysis.continuous.forEach(item => {
        list.push({
          pcaid: item.student.pcaid,
          name: item.student.name,
          phone: item.student.phone || '-',
          proper_batch: item.student.proper_batch || '-',
          status: 'Continuous',
          details: `Paid Rs. ${item.targetPay.payment} on ${item.targetPay.paid_date}`
        });
      });
    }

    if (continuitySegment === 'all' || continuitySegment === 'churned') {
      continuityAnalysis.churned.forEach(item => {
        list.push({
          pcaid: item.student.pcaid,
          name: item.student.name,
          phone: item.student.phone || '-',
          proper_batch: item.student.proper_batch || '-',
          status: 'Dropped Out',
          details: `Last paid on ${item.baselinePay.paid_date} (Missing in ${targetMonth})`
        });
      });
    }

    if (continuitySegment === 'all' || continuitySegment === 'new') {
      continuityAnalysis.newJoinees.forEach(item => {
        list.push({
          pcaid: item.student.pcaid,
          name: item.student.name,
          phone: item.student.phone || '-',
          proper_batch: item.student.proper_batch || '-',
          status: 'New Joinee',
          details: `First payment Rs. ${item.targetPay.payment} on ${item.targetPay.paid_date}`
        });
      });
    }

    if (continuitySegment === 'all' || continuitySegment === 'reactivated') {
      continuityAnalysis.reactivated.forEach(item => {
        list.push({
          pcaid: item.student.pcaid,
          name: item.student.name,
          phone: item.student.phone || '-',
          proper_batch: item.student.proper_batch || '-',
          status: 'Reactivated',
          details: `Returned with payment on ${item.targetPay.paid_date}`
        });
      });
    }

    if (continuitySearchQuery.trim()) {
      const q = continuitySearchQuery.toLowerCase().trim();
      list = list.filter(item => 
        item.pcaid.toLowerCase().includes(q) ||
        item.name.toLowerCase().includes(q) ||
        item.phone.includes(q) ||
        item.proper_batch.toLowerCase().includes(q)
      );
    }

    return list;
  }, [continuityAnalysis, continuitySegment, continuitySearchQuery, targetMonth]);

  // ---------------------------------------------------------------------------
  // EXPORT UTILITIES (CSV)
  // ---------------------------------------------------------------------------
  const exportToCSV = (filename: string, headers: string[], rows: (string | number)[][]) => {
    const csvContent = [
      headers.join(','),
      ...rows.map(row => row.map(cell => `"${String(cell || '').replace(/"/g, '""')}"`).join(','))
    ].join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.setAttribute('download', `${filename}_${new Date().toISOString().split('T')[0]}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    toast.success(`Exported ${rows.length} rows to ${filename}.csv`);
  };

  const handleCopyPhones = (phoneList: string[], key: string) => {
    const validPhones = phoneList.map(p => p.replace(/\D/g, '')).filter(Boolean);
    if (validPhones.length === 0) {
      toast.error('No valid phone numbers found.');
      return;
    }
    navigator.clipboard.writeText(validPhones.join(', '));
    setCopiedKey(key);
    toast.success(`Copied ${validPhones.length} phone numbers!`);
    setTimeout(() => setCopiedKey(null), 2500);
  };

  const handleCopyPcaids = (pcaids: string[], key: string) => {
    if (pcaids.length === 0) {
      toast.error('No PCA IDs to copy.');
      return;
    }
    navigator.clipboard.writeText(pcaids.join(', '));
    setCopiedKey(key);
    toast.success(`Copied ${pcaids.length} PCA IDs!`);
    setTimeout(() => setCopiedKey(null), 2500);
  };

  return (
    <div className="pt-0 px-0 pb-6 max-w-[1680px] mx-auto space-y-2 -mt-2 sm:-mt-3">
      {/* Top Utility Bar (Refresh Data) */}
      <div className="flex items-center justify-end pr-1">
        <button
          onClick={fetchData}
          disabled={isRefreshing}
          className="h-7 px-3 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-700 text-gray-700 dark:text-gray-300 rounded-lg text-xs font-bold transition-all shadow-2xs flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
          title="Refresh Data"
        >
          <RefreshCw size={12} className={isRefreshing ? 'animate-spin text-teal-600' : ''} />
          <span>Refresh Data</span>
        </button>
      </div>

      {isLoading ? (
        <div className="py-20 flex flex-col items-center justify-center space-y-3">
          <RefreshCw size={32} className="animate-spin text-teal-600" />
          <p className="text-sm font-semibold text-gray-500">Loading analysis records and cross-referencing...</p>
        </div>
      ) : activeTab === 'side-by-side' ? (
        /* ===================================================================== */
        /* TAB 1: 2-COLUMN SIDE-BY-SIDE VIEW (FROM USER SKETCH)                 */
        /* ===================================================================== */
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">

          {/* ================================================================= */
          /* LEFT COLUMN: PAYMENT ANALYSIS & MISSING UNPAID LIST               */
          /* ================================================================= */}
          <div className="flex flex-col space-y-5">
            <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-2xl p-5 shadow-sm space-y-4">
              {/* Card Header & 3 Filters */}
              <div className="border-b border-gray-100 dark:border-gray-800 pb-3">
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center gap-2">
                    <div className="w-8 h-8 rounded-lg bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 flex items-center justify-center font-bold">
                      <CreditCard size={18} />
                    </div>
                    <div>
                      <h2 className="text-base font-black text-gray-900 dark:text-white uppercase tracking-wider">
                        Payment Analysis
                      </h2>
                      <p className="text-[11px] text-gray-500 font-medium">Verify payments & catch students with missing fees</p>
                    </div>
                  </div>
                  <span className="px-2.5 py-1 bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-400 rounded-full text-xs font-black border border-emerald-200 dark:border-emerald-800/60">
                    Paid: {paidStudentsList.length}
                  </span>
                </div>

                {/* 3 Filters: Year, Month, Class Type */}
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5 pt-1">
                  {/* Filter 1: Year */}
                  <div>
                    <label className="block text-[10px] font-black uppercase text-gray-500 tracking-wider mb-1">
                      1. Year
                    </label>
                    <select
                      value={payYearFilter}
                      onChange={(e) => setPayYearFilter(e.target.value)}
                      className="w-full h-9 px-2.5 text-xs bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg font-semibold text-gray-800 dark:text-gray-200 focus:ring-2 focus:ring-emerald-500 outline-none"
                    >
                      <option value="all">All Years</option>
                      {availableYears.map(y => (
                        <option key={y} value={y}>{y}</option>
                      ))}
                    </select>
                  </div>

                  {/* Filter 2: Month */}
                  <div>
                    <label className="block text-[10px] font-black uppercase text-gray-500 tracking-wider mb-1">
                      2. Month
                    </label>
                    <select
                      value={payMonthFilter}
                      onChange={(e) => setPayMonthFilter(e.target.value)}
                      className="w-full h-9 px-2.5 text-xs bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg font-semibold text-gray-800 dark:text-gray-200 focus:ring-2 focus:ring-emerald-500 outline-none"
                    >
                      <option value="all">All Months</option>
                      {MONTH_NAMES.map(m => (
                        <option key={m} value={m}>{m}</option>
                      ))}
                    </select>
                  </div>

                  {/* Filter 3: Class Type */}
                  <div>
                    <label className="block text-[10px] font-black uppercase text-gray-500 tracking-wider mb-1">
                      3. Class Type
                    </label>
                    <select
                      value={payClassFilter}
                      onChange={(e) => setPayClassFilter(e.target.value)}
                      className="w-full h-9 px-2.5 text-xs bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg font-semibold text-gray-800 dark:text-gray-200 focus:ring-2 focus:ring-emerald-500 outline-none"
                    >
                      <option value="all">All Classes</option>
                      {baseClassTypes.map(c => (
                        <option key={c} value={c}>{c}</option>
                      ))}
                    </select>
                  </div>
                </div>

                {/* Active Combined Filter Indicator */}
                {payClassFilter !== 'all' && payMonthFilter !== 'all' && (
                  <div className="mt-2.5 flex items-center justify-between px-3 py-1.5 bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800/60 rounded-lg text-xs font-bold text-emerald-800 dark:text-emerald-300 animate-in fade-in duration-150">
                    <div className="flex items-center gap-1.5">
                      <span className="text-[10px] uppercase font-black tracking-wider text-emerald-600 dark:text-emerald-400">Combined:</span>
                      <span className="text-gray-900 dark:text-white font-extrabold">{payClassFilter}</span>
                      <span className="text-emerald-400 dark:text-emerald-600">•</span>
                      <span className="text-emerald-700 dark:text-emerald-300 font-extrabold">{payMonthFilter} {payYearFilter !== 'all' ? payYearFilter : ''}</span>
                    </div>
                    <span className="text-[10px] font-semibold text-emerald-600 dark:text-emerald-400">Filtering combined payments</span>
                  </div>
                )}
              </div>

              {/* SECTION A: PAID STUDENTS LIST */}
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-black text-gray-800 dark:text-gray-200 uppercase tracking-wider">
                      Paid Students
                    </span>
                    <span className="text-[11px] font-bold text-gray-500">
                      (Count: <strong className="text-emerald-600 dark:text-emerald-400">{paidStudentsList.length}</strong>)
                    </span>
                  </div>

                  <div className="flex items-center gap-2">
                    {/* Quick Search */}
                    <div className="relative w-36 sm:w-44">
                      <Search size={13} className="absolute left-2.5 top-2.5 text-gray-400" />
                      <input
                        type="text"
                        placeholder="Search paid..."
                        value={paySearchQuery}
                        onChange={(e) => setPaySearchQuery(e.target.value)}
                        className="w-full h-7 pl-7 pr-2 text-[11px] bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-md outline-none focus:ring-1 focus:ring-emerald-500"
                      />
                    </div>

                    <button
                      onClick={() => {
                        exportToCSV(
                          `paid_students_${payYearFilter}_${payMonthFilter}`,
                          ['PCA ID', 'Name', 'Phone', 'Batch', 'Class Type', 'Amount (Rs.)', 'Paid Date'],
                          paidStudentsList.map(p => [p.pcaid, p.name, p.phone, p.proper_batch, p.class_type, p.payment, p.paid_date])
                        );
                      }}
                      disabled={paidStudentsList.length === 0}
                      className="h-7 px-2.5 bg-gray-100 hover:bg-gray-200 dark:bg-gray-800 dark:hover:bg-gray-700 text-gray-700 dark:text-gray-300 rounded-md text-[11px] font-bold flex items-center gap-1 transition-all cursor-pointer disabled:opacity-40"
                      title="Export Paid List CSV"
                    >
                      <Download size={12} />
                      <span>Export</span>
                    </button>
                  </div>
                </div>

                {/* Table of Paid Students */}
                <div className="border border-gray-200 dark:border-gray-800 rounded-xl overflow-hidden h-[340px] overflow-y-auto scrollbar-thin">
                  <table className="w-full text-left text-xs">
                    <thead className="sticky top-0 z-10 bg-gray-50 dark:bg-gray-800 text-gray-500 dark:text-gray-400 font-bold border-b border-gray-200 dark:border-gray-700 text-[10px] uppercase tracking-wider">
                      <tr>
                        <th className="py-2.5 px-3">PCA ID</th>
                        <th className="py-2.5 px-3">Student Name</th>
                        <th className="py-2.5 px-2">Class / Type</th>
                        <th className="py-2.5 px-2 text-right">Amount</th>
                        <th className="py-2.5 px-3 text-right">Paid Date</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
                      {paidStudentsList.length === 0 ? (
                        <tr>
                          <td colSpan={5} className="py-28 text-center text-gray-400 font-medium">
                            No payment records found for {payMonthFilter} {payYearFilter !== 'all' ? payYearFilter : ''}
                          </td>
                        </tr>
                      ) : (
                        paidStudentsList.slice(0, 100).map((p, idx) => (
                          <tr key={`${p.pcaid}-${p.paymentId || idx}`} className="hover:bg-emerald-50/40 dark:hover:bg-emerald-950/20 transition-colors">
                            <td className="py-2 px-3 font-mono font-bold text-gray-900 dark:text-gray-100">
                              {p.pcaid}
                            </td>
                            <td className="py-2 px-3 font-semibold text-gray-800 dark:text-gray-200 truncate max-w-[140px]" title={p.name}>
                              {p.name}
                            </td>
                            <td className="py-2 px-2 text-[11px] text-gray-600 dark:text-gray-400 truncate max-w-[110px]" title={p.class_type}>
                              {p.class_type}
                            </td>
                            <td className="py-2 px-2 text-right font-mono font-semibold text-emerald-600 dark:text-emerald-400">
                              Rs. {Number(p.payment).toLocaleString()}
                            </td>
                            <td className="py-2 px-3 text-right text-[11px] font-mono text-gray-500">
                              {p.paid_date}
                            </td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>
                {paidStudentsList.length > 100 && (
                  <p className="text-[10px] text-gray-400 text-right">Showing top 100 of {paidStudentsList.length}. Export CSV for all.</p>
                )}
              </div>

              {/* ============================================================= */}
              {/* SECTION B: MISSING LIST (PAID BUT NOT REGISTERED ON WEBINAR)  */}
              {/* ============================================================= */}
              <div className="pt-3 border-t border-gray-200 dark:border-gray-800 space-y-2">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                  <div>
                    <div className="flex items-center gap-1.5">
                      <AlertTriangle size={15} className="text-amber-500" />
                      <span className="text-xs font-black text-amber-700 dark:text-amber-400 uppercase tracking-wider">
                        MISSING List: Enrolled Students with NO Payment
                      </span>
                    </div>
                    <p className="text-[11px] text-gray-500">
                      Paid for {payClassFilter !== 'all' ? payClassFilter : 'Class'} ({payMonthFilter} {payYearFilter !== 'all' ? payYearFilter : ''}), but hasn't registered for {activeWebinarObj?.webinar_name || 'selected webinar'} yet
                    </p>
                  </div>

                  <span className="self-start sm:self-center px-2 py-0.5 bg-amber-100 dark:bg-amber-950/60 text-amber-800 dark:text-amber-300 rounded-md text-[11px] font-black border border-amber-300 dark:border-amber-800">
                    Missing Webinar: {paidStudentsMissingWebinarList.length}
                  </span>
                </div>

                {/* Missing Actions Bar + Register Button */}
                <div className="flex flex-wrap items-center justify-between gap-2 pt-1">
                  <div className="flex items-center gap-2">
                    <div className="relative w-36">
                      <Search size={13} className="absolute left-2.5 top-2.5 text-gray-400" />
                      <input
                        type="text"
                        placeholder="Search missing..."
                        value={payMissingSearchQuery}
                        onChange={(e) => setPayMissingSearchQuery(e.target.value)}
                        className="w-full h-7 pl-7 pr-2 text-[11px] bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-md outline-none focus:ring-1 focus:ring-amber-500"
                      />
                    </div>

                    <button
                      onClick={handleSelectAllMissingZoom}
                      disabled={paidStudentsMissingWebinarList.length === 0}
                      className="h-7 px-2 bg-gray-100 hover:bg-gray-200 dark:bg-gray-800 text-gray-700 dark:text-gray-300 rounded-md text-[10px] font-bold transition-all cursor-pointer disabled:opacity-40"
                    >
                      {selectedMissingZoomPcaids.length === paidStudentsMissingWebinarList.length && paidStudentsMissingWebinarList.length > 0
                        ? 'Deselect All'
                        : 'Select All'}
                    </button>
                  </div>

                  <div className="flex items-center gap-1.5">
                    {/* One-Click Register Missing on Zoom */}
                    <button
                      onClick={handleRegisterMissingOnZoom}
                      disabled={isRegisteringMissing || paidStudentsMissingWebinarList.length === 0 || selectedWebinarId === 'all'}
                      className="h-7 px-3 bg-amber-600 hover:bg-amber-700 text-white rounded-md text-[11px] font-black tracking-wide flex items-center gap-1.5 transition-all shadow-sm cursor-pointer disabled:opacity-50"
                      title="Directly register missing students on Zoom for the selected webinar"
                    >
                      <Sparkles size={12} className={isRegisteringMissing ? 'animate-spin' : ''} />
                      <span>
                        {isRegisteringMissing
                          ? `Registering (${registerProgress.done}/${registerProgress.total})...`
                          : selectedMissingZoomPcaids.length > 0
                          ? `Register ${selectedMissingZoomPcaids.length} on Zoom`
                          : `Register All (${paidStudentsMissingWebinarList.length}) on Zoom`}
                      </span>
                    </button>

                    <button
                      onClick={() => handleCopyPcaids(paidStudentsMissingWebinarList.map(s => s.pcaid), 'left-missing-pcaids')}
                      disabled={paidStudentsMissingWebinarList.length === 0}
                      className="h-7 px-2 bg-gray-100 hover:bg-gray-200 dark:bg-gray-800 text-gray-700 dark:text-gray-300 rounded-md text-[11px] font-bold flex items-center gap-1 transition-all cursor-pointer disabled:opacity-40"
                      title="Copy PCA IDs"
                    >
                      {copiedKey === 'left-missing-pcaids' ? <Check size={12} className="text-emerald-600" /> : <Copy size={12} />}
                      <span>Copy IDs</span>
                    </button>

                    <button
                      onClick={() => {
                        exportToCSV(
                          `missing_webinar_registrations_${payClassFilter}_${payMonthFilter}`,
                          ['PCA ID', 'Name', 'Phone', 'Batch', 'Paid Class', 'Amount', 'Paid Date'],
                          paidStudentsMissingWebinarList.map(s => [s.pcaid, s.name, s.phone || '', s.proper_batch || '', s.class_type, s.payment, s.paid_date])
                        );
                      }}
                      disabled={paidStudentsMissingWebinarList.length === 0}
                      className="h-7 px-2.5 bg-gray-100 hover:bg-gray-200 dark:bg-gray-800 text-gray-700 dark:text-gray-300 rounded-md text-[11px] font-bold flex items-center gap-1 transition-all cursor-pointer disabled:opacity-40"
                    >
                      <Download size={12} />
                      <span>Export</span>
                    </button>
                  </div>
                </div>

                {/* Table of Paid Students Missing Zoom Webinar */}
                <div className="border border-amber-200 dark:border-amber-900/40 rounded-xl overflow-hidden h-[320px] overflow-y-auto scrollbar-thin bg-amber-50/20 dark:bg-amber-950/10">
                  <table className="w-full text-left text-xs">
                    <thead className="sticky top-0 z-10 bg-amber-100 dark:bg-amber-950 text-amber-900 dark:text-amber-300 font-bold border-b border-amber-200 dark:border-amber-800 text-[10px] uppercase tracking-wider">
                      <tr>
                        <th className="py-2.5 px-2.5 w-7 text-center">
                          <input
                            type="checkbox"
                            checked={selectedMissingZoomPcaids.length > 0 && selectedMissingZoomPcaids.length === paidStudentsMissingWebinarList.length}
                            onChange={handleSelectAllMissingZoom}
                            className="rounded border-gray-300 text-amber-600 focus:ring-amber-500 cursor-pointer"
                          />
                        </th>
                        <th className="py-2.5 px-2">PCA ID</th>
                        <th className="py-2.5 px-3">Student Name</th>
                        <th className="py-2.5 px-2">Phone</th>
                        <th className="py-2.5 px-2">Paid Class</th>
                        <th className="py-2.5 px-3 text-right">Paid Date</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-amber-100 dark:divide-amber-900/30">
                      {paidStudentsMissingWebinarList.length === 0 ? (
                        <tr>
                          <td colSpan={6} className="py-24 text-center text-emerald-600 dark:text-emerald-400 font-bold">
                            🎉 100% Zoom Coverage! All paid students are registered on Zoom for {activeWebinarObj?.webinar_name || 'the selected webinar'}.
                          </td>
                        </tr>
                      ) : (
                        paidStudentsMissingWebinarList.slice(0, 100).map((p) => {
                          const isChecked = selectedMissingZoomPcaids.includes(p.pcaid);
                          return (
                            <tr
                              key={p.pcaid}
                              onClick={() => toggleSelectMissingPcaid(p.pcaid)}
                              className={`cursor-pointer transition-colors ${
                                isChecked
                                  ? 'bg-amber-100/70 dark:bg-amber-900/40'
                                  : 'hover:bg-amber-100/30 dark:hover:bg-amber-900/20'
                              }`}
                            >
                              <td className="py-2 px-2.5 text-center" onClick={(e) => e.stopPropagation()}>
                                <input
                                  type="checkbox"
                                  checked={isChecked}
                                  onChange={() => toggleSelectMissingPcaid(p.pcaid)}
                                  className="rounded border-gray-300 text-amber-600 focus:ring-amber-500 cursor-pointer"
                                />
                              </td>
                              <td className="py-2 px-2 font-mono font-bold text-gray-900 dark:text-gray-100">
                                {p.pcaid}
                              </td>
                              <td className="py-2 px-3 font-semibold text-gray-800 dark:text-gray-200 truncate max-w-[130px]" title={p.name}>
                                {p.name}
                              </td>
                              <td className="py-2 px-2 font-mono text-gray-600 dark:text-gray-400">
                                {p.phone || '-'}
                              </td>
                              <td className="py-2 px-2 text-[11px] text-gray-600 dark:text-gray-400 truncate max-w-[120px]">
                                {p.class_type}
                              </td>
                              <td className="py-2 px-3 text-right text-[11px] font-mono text-gray-500">
                                {p.paid_date}
                              </td>
                            </tr>
                          );
                        })
                      )}
                    </tbody>
                  </table>
                </div>
                {paidStudentsMissingWebinarList.length > 100 && (
                  <p className="text-[10px] text-gray-400 text-right">Showing top 100 of {paidStudentsMissingWebinarList.length}. Export CSV for all.</p>
                )}
              </div>
            </div>
          </div>


          {/* ================================================================= */
          /* RIGHT COLUMN: ZOOM REGISTRATION & MISSING ZOOM ACCESS LIST        */
          /* ================================================================= */}
          <div className="flex flex-col space-y-5">
            <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-2xl p-5 shadow-sm space-y-4">
              {/* Card Header & 3 Filters */}
              <div className="border-b border-gray-100 dark:border-gray-800 pb-3">
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center gap-2">
                    <div className="w-8 h-8 rounded-lg bg-teal-500/10 text-teal-600 dark:text-teal-400 flex items-center justify-center font-bold">
                      <Video size={18} />
                    </div>
                    <div>
                      <h2 className="text-base font-black text-gray-900 dark:text-white uppercase tracking-wider">
                        Zoom Registration Analysis
                      </h2>
                      <p className="text-[11px] text-gray-500 font-medium">Verify webinar registrations & catch paid students missing access</p>
                    </div>
                  </div>
                  <span className="px-2.5 py-1 bg-teal-50 dark:bg-teal-950/40 text-teal-700 dark:text-teal-400 rounded-full text-xs font-black border border-teal-200 dark:border-teal-800/60">
                    Zoom: {zoomRegisteredList.length}
                  </span>
                </div>

                {/* 3 Filters: Year, Month, Webinar Name */}
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5 pt-1">
                  {/* Filter 1: Year */}
                  <div>
                    <label className="block text-[10px] font-black uppercase text-gray-500 tracking-wider mb-1">
                      1. Year
                    </label>
                    <select
                      value={zoomYearFilter}
                      onChange={(e) => setZoomYearFilter(e.target.value)}
                      className="w-full h-9 px-2.5 text-xs bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg font-semibold text-gray-800 dark:text-gray-200 focus:ring-2 focus:ring-teal-500 outline-none"
                    >
                      <option value="all">All Years</option>
                      {availableYears.map(y => (
                        <option key={y} value={y}>{y}</option>
                      ))}
                    </select>
                  </div>

                  {/* Filter 2: Month */}
                  <div>
                    <label className="block text-[10px] font-black uppercase text-gray-500 tracking-wider mb-1">
                      2. Month
                    </label>
                    <select
                      value={zoomMonthFilter}
                      onChange={(e) => setZoomMonthFilter(e.target.value)}
                      className="w-full h-9 px-2.5 text-xs bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg font-semibold text-gray-800 dark:text-gray-200 focus:ring-2 focus:ring-teal-500 outline-none"
                    >
                      <option value="all">All Months</option>
                      {MONTH_NAMES.map(m => (
                        <option key={m} value={m}>{m}</option>
                      ))}
                    </select>
                  </div>

                  {/* Filter 3: Webinar Name */}
                  <div>
                    <label className="block text-[10px] font-black uppercase text-gray-500 tracking-wider mb-1">
                      3. Webinar Name
                    </label>
                    <select
                      value={selectedWebinarId}
                      onChange={(e) => setSelectedWebinarId(e.target.value)}
                      className="w-full h-9 px-2.5 text-xs bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg font-semibold text-gray-800 dark:text-gray-200 focus:ring-2 focus:ring-teal-500 outline-none"
                    >
                      <option value="all">All Webinars</option>
                      {allWebinars.map(w => (
                        <option key={w.webinar_id} value={w.webinar_id}>
                          {w.webinar_name} ({w.webinar_id})
                        </option>
                      ))}
                    </select>
                  </div>
                </div>
              </div>

              {/* SECTION A: ZOOM REGISTERED STUDENTS LIST */}
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-black text-gray-800 dark:text-gray-200 uppercase tracking-wider">
                      Registered on Zoom
                    </span>
                    <span className="text-[11px] font-bold text-gray-500">
                      (Count: <strong className="text-teal-600 dark:text-teal-400">{zoomRegisteredList.length}</strong>)
                    </span>
                  </div>

                  <div className="flex items-center gap-2">
                    {/* Quick Search */}
                    <div className="relative w-36 sm:w-44">
                      <Search size={13} className="absolute left-2.5 top-2.5 text-gray-400" />
                      <input
                        type="text"
                        placeholder="Search zoom..."
                        value={zoomSearchQuery}
                        onChange={(e) => setZoomSearchQuery(e.target.value)}
                        className="w-full h-7 pl-7 pr-2 text-[11px] bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-md outline-none focus:ring-1 focus:ring-teal-500"
                      />
                    </div>

                    <button
                      onClick={() => {
                        exportToCSV(
                          `zoom_registered_${selectedWebinarId}`,
                          ['PCA ID', 'Name', 'Email', 'Webinar ID', 'Webinar Name', 'Join URL', 'Registered At'],
                          zoomRegisteredList.map(zr => [zr.pcaid, zr.student_name || '', zr.email, zr.webinar_id, zr.webinar_name || '', zr.join_url || '', zr.registered_at])
                        );
                      }}
                      disabled={zoomRegisteredList.length === 0}
                      className="h-7 px-2.5 bg-gray-100 hover:bg-gray-200 dark:bg-gray-800 dark:hover:bg-gray-700 text-gray-700 dark:text-gray-300 rounded-md text-[11px] font-bold flex items-center gap-1 transition-all cursor-pointer disabled:opacity-40"
                      title="Export Zoom Registered List CSV"
                    >
                      <Download size={12} />
                      <span>Export</span>
                    </button>
                  </div>
                </div>

                {/* Table of Zoom Registered Students */}
                <div className="border border-gray-200 dark:border-gray-800 rounded-xl overflow-hidden h-[340px] overflow-y-auto scrollbar-thin">
                  <table className="w-full text-left text-xs">
                    <thead className="sticky top-0 z-10 bg-gray-50 dark:bg-gray-800 text-gray-500 dark:text-gray-400 font-bold border-b border-gray-200 dark:border-gray-700 text-[10px] uppercase tracking-wider">
                      <tr>
                        <th className="py-2.5 px-3">PCA ID</th>
                        <th className="py-2.5 px-3">Student Name</th>
                        <th className="py-2.5 px-2">Email</th>
                        <th className="py-2.5 px-3 text-right">Join Link</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
                      {zoomRegisteredList.length === 0 ? (
                        <tr>
                          <td colSpan={4} className="py-28 text-center text-gray-400 font-medium">
                            No Zoom registrations recorded yet for this webinar in {zoomMonthFilter}
                          </td>
                        </tr>
                      ) : (
                        zoomRegisteredList.slice(0, 100).map((zr, idx) => (
                          <tr key={`${zr.pcaid}-${zr.webinar_id}-${idx}`} className="hover:bg-teal-50/40 dark:hover:bg-teal-950/20 transition-colors">
                            <td className="py-2 px-3 font-mono font-bold text-gray-900 dark:text-gray-100">
                              {zr.pcaid}
                            </td>
                            <td className="py-2 px-3 font-semibold text-gray-800 dark:text-gray-200 truncate max-w-[140px]" title={zr.student_name || ''}>
                              {zr.student_name || 'Student'}
                            </td>
                            <td className="py-2 px-2 text-[11px] text-gray-600 dark:text-gray-400 truncate max-w-[130px]" title={zr.email}>
                              {zr.email}
                            </td>
                            <td className="py-2 px-3 text-right">
                              {zr.join_url ? (
                                <button
                                  onClick={() => {
                                    navigator.clipboard.writeText(zr.join_url!);
                                    toast.success(`Copied join link for ${zr.pcaid}!`);
                                  }}
                                  className="px-2 py-0.5 bg-teal-50 hover:bg-teal-100 dark:bg-teal-950/60 dark:hover:bg-teal-900 text-teal-700 dark:text-teal-300 rounded text-[10px] font-bold border border-teal-200 dark:border-teal-800 transition-colors cursor-pointer inline-flex items-center gap-1"
                                >
                                  <Copy size={10} />
                                  <span>Copy</span>
                                </button>
                              ) : (
                                <span className="text-[10px] text-gray-400">Registered</span>
                              )}
                            </td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>
                {zoomRegisteredList.length > 100 && (
                  <p className="text-[10px] text-gray-400 text-right">Showing top 100 of {zoomRegisteredList.length}. Export CSV for all.</p>
                )}
              </div>

              {/* ============================================================= */}
              {/* SECTION B: MISSING LIST (REGISTERED ON ZOOM BUT NO PAYMENT)   */}
              {/* ============================================================= */}
              <div className="pt-3 border-t border-gray-200 dark:border-gray-800 space-y-2">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                  <div>
                    <div className="flex items-center gap-1.5">
                      <AlertTriangle size={15} className="text-rose-500" />
                      <span className="text-xs font-black text-rose-700 dark:text-rose-400 uppercase tracking-wider">
                        MISSING List: Paid Students NOT on Zoom
                      </span>
                    </div>
                    <p className="text-[11px] text-gray-500">
                      Students registered for {activeWebinarObj?.webinar_name || 'selected webinar'} who have NO payment records for {payClassFilter !== 'all' ? payClassFilter : 'Class'} ({payMonthFilter} {payYearFilter !== 'all' ? payYearFilter : ''})
                    </p>
                  </div>

                  <span className="self-start sm:self-center px-2 py-0.5 bg-rose-100 dark:bg-rose-950/60 text-rose-800 dark:text-rose-300 rounded-md text-[11px] font-black border border-rose-300 dark:border-rose-800">
                    Unpaid: {zoomRegistrantsMissingPaymentList.length}
                  </span>
                </div>

                {/* Missing Actions Bar */}
                <div className="flex flex-wrap items-center justify-between gap-2 pt-1">
                  <div className="relative w-40">
                    <Search size={13} className="absolute left-2.5 top-2.5 text-gray-400" />
                    <input
                      type="text"
                      placeholder="Search unpaid attendees..."
                      value={zoomMissingSearchQuery}
                      onChange={(e) => setZoomMissingSearchQuery(e.target.value)}
                      className="w-full h-7 pl-7 pr-2 text-[11px] bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-md outline-none focus:ring-1 focus:ring-rose-500"
                    />
                  </div>

                  <div className="flex items-center gap-1.5">
                    <button
                      onClick={() => handleCopyPcaids(zoomRegistrantsMissingPaymentList.map(zr => zr.pcaid), 'right-missing-pcaids')}
                      disabled={zoomRegistrantsMissingPaymentList.length === 0}
                      className="h-7 px-2.5 bg-gray-100 hover:bg-gray-200 dark:bg-gray-800 text-gray-700 dark:text-gray-300 rounded-md text-[11px] font-bold flex items-center gap-1 transition-all cursor-pointer disabled:opacity-40"
                      title="Copy PCA IDs of unpaid webinar attendees"
                    >
                      {copiedKey === 'right-missing-pcaids' ? <Check size={12} className="text-emerald-600" /> : <Copy size={12} />}
                      <span>Copy IDs</span>
                    </button>

                    <button
                      onClick={() => handleCopyPhones(zoomRegistrantsMissingPaymentList.map(zr => {
                        const s = studentMap.get(zr.pcaid?.trim().toUpperCase());
                        return s?.phone || zr.email || '';
                      }), 'right-missing-phones')}
                      disabled={zoomRegistrantsMissingPaymentList.length === 0}
                      className="h-7 px-2.5 bg-rose-50 hover:bg-rose-100 dark:bg-rose-950/40 dark:hover:bg-rose-900/60 text-rose-800 dark:text-rose-300 border border-rose-200 dark:border-rose-800/80 rounded-md text-[11px] font-bold flex items-center gap-1 transition-all cursor-pointer disabled:opacity-40"
                      title="Copy phone numbers / contacts for WhatsApp payment reminders"
                    >
                      {copiedKey === 'right-missing-phones' ? <Check size={12} className="text-emerald-600" /> : <Copy size={12} />}
                      <span>Copy Contacts</span>
                    </button>

                    <button
                      onClick={() => {
                        exportToCSV(
                          `unpaid_webinar_attendees_${selectedWebinarId}_${payMonthFilter}`,
                          ['PCA ID', 'Student Name', 'Email', 'Webinar Name', 'Webinar ID', 'Registered At', 'Payment Status'],
                          zoomRegistrantsMissingPaymentList.map(zr => [
                            zr.pcaid,
                            zr.student_name || 'Student',
                            zr.email,
                            zr.webinar_name || '',
                            zr.webinar_id,
                            zr.registered_at,
                            `Unpaid for ${payClassFilter} (${payMonthFilter} ${payYearFilter !== 'all' ? payYearFilter : ''})`
                          ])
                        );
                      }}
                      disabled={zoomRegistrantsMissingPaymentList.length === 0}
                      className="h-7 px-2.5 bg-gray-100 hover:bg-gray-200 dark:bg-gray-800 text-gray-700 dark:text-gray-300 rounded-md text-[11px] font-bold flex items-center gap-1 transition-all cursor-pointer disabled:opacity-40"
                    >
                      <Download size={12} />
                      <span>Export</span>
                    </button>
                  </div>
                </div>

                {/* Table of Zoom Registered Students Missing Payment */}
                <div className="border border-rose-200 dark:border-rose-900/40 rounded-xl overflow-hidden h-[320px] overflow-y-auto scrollbar-thin bg-rose-50/20 dark:bg-rose-950/10">
                  <table className="w-full text-left text-xs">
                    <thead className="sticky top-0 z-10 bg-rose-100 dark:bg-rose-950 text-rose-900 dark:text-rose-300 font-bold border-b border-rose-200 dark:border-rose-800 text-[10px] uppercase tracking-wider">
                      <tr>
                        <th className="py-2.5 px-3">PCA ID</th>
                        <th className="py-2.5 px-3">Student Name</th>
                        <th className="py-2.5 px-2">Email</th>
                        <th className="py-2.5 px-2">Webinar</th>
                        <th className="py-2.5 px-3 text-right">Status</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-rose-100 dark:divide-rose-900/30">
                      {zoomRegistrantsMissingPaymentList.length === 0 ? (
                        <tr>
                          <td colSpan={5} className="py-24 text-center text-teal-600 dark:text-teal-400 font-bold">
                            🎉 Perfect audit! All students registered for this webinar have verified payment records.
                          </td>
                        </tr>
                      ) : (
                        zoomRegistrantsMissingPaymentList.slice(0, 100).map((zr) => (
                          <tr
                            key={zr.pcaid + zr.webinar_id}
                            className="hover:bg-rose-100/40 dark:hover:bg-rose-900/30 transition-colors"
                          >
                            <td className="py-2 px-3 font-mono font-bold text-gray-900 dark:text-gray-100">
                              {zr.pcaid}
                            </td>
                            <td className="py-2 px-3 font-semibold text-gray-800 dark:text-gray-200 truncate max-w-[130px]" title={zr.student_name || ''}>
                              {zr.student_name || 'Student'}
                            </td>
                            <td className="py-2 px-2 text-[11px] text-gray-600 dark:text-gray-400 truncate max-w-[140px]" title={zr.email}>
                              {zr.email}
                            </td>
                            <td className="py-2 px-2 text-[11px] text-gray-600 dark:text-gray-400 truncate max-w-[120px]" title={zr.webinar_name || zr.webinar_id}>
                              {zr.webinar_name || zr.webinar_id}
                            </td>
                            <td className="py-2 px-3 text-right">
                              <span className="inline-block px-2 py-0.5 rounded-full text-[10px] font-bold bg-rose-100 dark:bg-rose-950/60 text-rose-700 dark:text-rose-300 border border-rose-200 dark:border-rose-800">
                                Unpaid
                              </span>
                            </td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>
                {zoomRegistrantsMissingPaymentList.length > 100 && (
                  <p className="text-[10px] text-gray-400 text-right">Showing top 100 of {zoomRegistrantsMissingPaymentList.length}. Export CSV for all.</p>
                )}
              </div>
            </div>
          </div>
        </div>
      ) : (
        /* ===================================================================== */
        /* TAB 2: MONTHLY CONTINUITY & RETENTION (REGULARS VS DROPOUTS)          */
        /* ===================================================================== */
        <div className="space-y-6">
          {/* Filter Bar for Continuity */}
          <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-2xl p-5 shadow-sm space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-gray-100 dark:border-gray-800 pb-3">
              <div>
                <h2 className="text-base font-black text-gray-900 dark:text-white uppercase tracking-wider flex items-center gap-2">
                  <TrendingUp size={18} className="text-teal-600" />
                  <span>Monthly Continuity & Retention Matrix</span>
                </h2>
                <p className="text-xs text-gray-500">
                  Compare two consecutive months to track who stays in class continuously, who stopped, and new joiners.
                </p>
              </div>

              {/* Year & Class Filter */}
              <div className="flex flex-wrap items-center gap-2">
                <select
                  value={continuityYear}
                  onChange={(e) => setContinuityYear(e.target.value)}
                  className="h-9 px-2.5 text-xs bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg font-semibold text-gray-800 dark:text-gray-200"
                >
                  <option value="all">All Years</option>
                  {availableYears.map(y => (
                    <option key={y} value={y}>{y}</option>
                  ))}
                </select>

                <select
                  value={continuityClassFilter}
                  onChange={(e) => setContinuityClassFilter(e.target.value)}
                  className="h-9 px-2.5 text-xs bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg font-semibold text-gray-800 dark:text-gray-200"
                >
                  <option value="all">All Classes</option>
                  {baseClassTypes.map(c => (
                    <option key={c} value={c}>{c}</option>
                  ))}
                </select>
              </div>
            </div>

            {/* Month Comparison Selectors */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3 items-center">
              <div className="lg:col-span-2">
                <label className="block text-[10px] font-black uppercase text-gray-500 tracking-wider mb-1">
                  Baseline Month (Previous)
                </label>
                <select
                  value={baselineMonth}
                  onChange={(e) => setBaselineMonth(e.target.value)}
                  className="w-full h-10 px-3 text-sm bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl font-bold text-gray-800 dark:text-gray-200"
                >
                  {MONTH_NAMES.map(m => (
                    <option key={m} value={m}>{m}</option>
                  ))}
                </select>
              </div>

              <div className="hidden lg:flex justify-center text-gray-400 pt-4">
                <ArrowRight size={20} />
              </div>

              <div className="lg:col-span-2">
                <label className="block text-[10px] font-black uppercase text-gray-500 tracking-wider mb-1">
                  Target Month (Current / Comparison)
                </label>
                <select
                  value={targetMonth}
                  onChange={(e) => setTargetMonth(e.target.value)}
                  className="w-full h-10 px-3 text-sm bg-gray-50 dark:bg-gray-800 border border-teal-500/40 rounded-xl font-bold text-teal-700 dark:text-teal-300"
                >
                  {MONTH_NAMES.map(m => (
                    <option key={m} value={m}>{m}</option>
                  ))}
                </select>
              </div>
            </div>

            {/* 4 Summary Cards */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 pt-2">
              {/* Continuous */}
              <div 
                onClick={() => setContinuitySegment(continuitySegment === 'continuous' ? 'all' : 'continuous')}
                className={`p-3.5 rounded-xl border transition-all cursor-pointer ${
                  continuitySegment === 'continuous'
                    ? 'bg-emerald-50 dark:bg-emerald-950/40 border-emerald-500 shadow-sm'
                    : 'bg-white dark:bg-gray-800/60 border-gray-200 dark:border-gray-700 hover:border-emerald-400'
                }`}
              >
                <div className="flex items-center justify-between text-xs text-gray-500 font-bold mb-1">
                  <span>Continuous</span>
                  <UserCheck size={16} className="text-emerald-500" />
                </div>
                <div className="text-xl sm:text-2xl font-black text-emerald-600 dark:text-emerald-400">
                  {continuityAnalysis.continuous.length}
                </div>
                <p className="text-[10px] text-gray-400 font-medium">Paid both {baselineMonth} & {targetMonth}</p>
              </div>

              {/* Churned */}
              <div 
                onClick={() => setContinuitySegment(continuitySegment === 'churned' ? 'all' : 'churned')}
                className={`p-3.5 rounded-xl border transition-all cursor-pointer ${
                  continuitySegment === 'churned'
                    ? 'bg-rose-50 dark:bg-rose-950/40 border-rose-500 shadow-sm'
                    : 'bg-white dark:bg-gray-800/60 border-gray-200 dark:border-gray-700 hover:border-rose-400'
                }`}
              >
                <div className="flex items-center justify-between text-xs text-gray-500 font-bold mb-1">
                  <span>Dropped Out</span>
                  <UserX size={16} className="text-rose-500" />
                </div>
                <div className="text-xl sm:text-2xl font-black text-rose-600 dark:text-rose-400">
                  {continuityAnalysis.churned.length}
                </div>
                <p className="text-[10px] text-gray-400 font-medium">Paid {baselineMonth}, stopped in {targetMonth}</p>
              </div>

              {/* New Joinees */}
              <div 
                onClick={() => setContinuitySegment(continuitySegment === 'new' ? 'all' : 'new')}
                className={`p-3.5 rounded-xl border transition-all cursor-pointer ${
                  continuitySegment === 'new'
                    ? 'bg-blue-50 dark:bg-blue-950/40 border-blue-500 shadow-sm'
                    : 'bg-white dark:bg-gray-800/60 border-gray-200 dark:border-gray-700 hover:border-blue-400'
                }`}
              >
                <div className="flex items-center justify-between text-xs text-gray-500 font-bold mb-1">
                  <span>New Joinees</span>
                  <Sparkles size={16} className="text-blue-500" />
                </div>
                <div className="text-xl sm:text-2xl font-black text-blue-600 dark:text-blue-400">
                  {continuityAnalysis.newJoinees.length}
                </div>
                <p className="text-[10px] text-gray-400 font-medium">First-time paid in {targetMonth}</p>
              </div>

              {/* Reactivated */}
              <div 
                onClick={() => setContinuitySegment(continuitySegment === 'reactivated' ? 'all' : 'reactivated')}
                className={`p-3.5 rounded-xl border transition-all cursor-pointer ${
                  continuitySegment === 'reactivated'
                    ? 'bg-purple-50 dark:bg-purple-950/40 border-purple-500 shadow-sm'
                    : 'bg-white dark:bg-gray-800/60 border-gray-200 dark:border-gray-700 hover:border-purple-400'
                }`}
              >
                <div className="flex items-center justify-between text-xs text-gray-500 font-bold mb-1">
                  <span>Reactivated</span>
                  <RefreshCw size={16} className="text-purple-500" />
                </div>
                <div className="text-xl sm:text-2xl font-black text-purple-600 dark:text-purple-400">
                  {continuityAnalysis.reactivated.length}
                </div>
                <p className="text-[10px] text-gray-400 font-medium">Returned after prior gap</p>
              </div>
            </div>
          </div>

          {/* Retention Data Table */}
          <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-2xl p-5 shadow-sm space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div className="flex items-center gap-2">
                <span className="text-sm font-black text-gray-900 dark:text-white uppercase tracking-wider">
                  Students ({continuityDisplayList.length})
                </span>
                {continuitySegment !== 'all' && (
                  <span className="px-2 py-0.5 bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-300 rounded text-xs font-bold capitalize">
                    Filtered: {continuitySegment}
                  </span>
                )}
              </div>

              <div className="flex items-center gap-2">
                <div className="relative w-52">
                  <Search size={14} className="absolute left-2.5 top-2.5 text-gray-400" />
                  <input
                    type="text"
                    placeholder="Search students..."
                    value={continuitySearchQuery}
                    onChange={(e) => setContinuitySearchQuery(e.target.value)}
                    className="w-full h-8 pl-8 pr-2 text-xs bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg outline-none"
                  />
                </div>

                <button
                  onClick={() => {
                    exportToCSV(
                      `continuity_${baselineMonth}_vs_${targetMonth}`,
                      ['PCA ID', 'Name', 'Phone', 'Batch', 'Status', 'Details'],
                      continuityDisplayList.map(item => [item.pcaid, item.name, item.phone, item.proper_batch, item.status, item.details])
                    );
                  }}
                  disabled={continuityDisplayList.length === 0}
                  className="h-8 px-3 bg-teal-600 hover:bg-teal-700 text-white rounded-lg text-xs font-bold flex items-center gap-1.5 transition-all cursor-pointer disabled:opacity-40"
                >
                  <Download size={13} />
                  <span>Export CSV</span>
                </button>
              </div>
            </div>

            {/* Continuity Table */}
            <div className="border border-gray-200 dark:border-gray-800 rounded-xl overflow-hidden max-h-[500px] overflow-y-auto">
              <table className="w-full text-left text-xs">
                <thead className="sticky top-0 bg-gray-50 dark:bg-gray-800 text-gray-500 font-bold border-b border-gray-200 dark:border-gray-700 text-[10px] uppercase tracking-wider">
                  <tr>
                    <th className="py-2.5 px-3">PCA ID</th>
                    <th className="py-2.5 px-3">Student Name</th>
                    <th className="py-2.5 px-2">Phone</th>
                    <th className="py-2.5 px-2">Batch</th>
                    <th className="py-2.5 px-2">Status</th>
                    <th className="py-2.5 px-3">Monthly Transition</th>
                    <th className="py-2.5 px-3 text-right">Quick Contact</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
                  {continuityDisplayList.length === 0 ? (
                    <tr>
                      <td colSpan={7} className="py-12 text-center text-gray-400 font-medium">
                        No students found for this filter selection.
                      </td>
                    </tr>
                  ) : (
                    continuityDisplayList.map((item) => (
                      <tr key={item.pcaid} className="hover:bg-gray-50 dark:hover:bg-gray-800/40 transition-colors">
                        <td className="py-2.5 px-3 font-mono font-bold text-gray-900 dark:text-gray-100">
                          {item.pcaid}
                        </td>
                        <td className="py-2.5 px-3 font-semibold text-gray-800 dark:text-gray-200">
                          {item.name}
                        </td>
                        <td className="py-2.5 px-2 font-mono text-gray-600 dark:text-gray-400">
                          {item.phone}
                        </td>
                        <td className="py-2.5 px-2 text-[11px] text-gray-600 dark:text-gray-400">
                          {item.proper_batch}
                        </td>
                        <td className="py-2.5 px-2">
                          <span className={`inline-flex px-2 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider ${
                            item.status === 'Continuous'
                              ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300'
                              : item.status === 'Dropped Out'
                              ? 'bg-rose-100 text-rose-800 dark:bg-rose-950/60 dark:text-rose-300'
                              : item.status === 'New Joinee'
                              ? 'bg-blue-100 text-blue-800 dark:bg-blue-950/60 dark:text-blue-300'
                              : 'bg-purple-100 text-purple-800 dark:bg-purple-950/60 dark:text-purple-300'
                          }`}>
                            {item.status}
                          </span>
                        </td>
                        <td className="py-2.5 px-3 text-[11px] text-gray-500 font-mono">
                          {item.details}
                        </td>
                        <td className="py-2.5 px-3 text-right">
                          {item.phone && item.phone !== '-' ? (
                            <a
                              href={`https://wa.me/94${item.phone.replace(/\D/g, '').replace(/^0+/, '')}`}
                              target="_blank"
                              rel="noreferrer"
                              className="inline-flex items-center gap-1 px-2 py-1 rounded bg-emerald-50 hover:bg-emerald-100 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300 text-[10px] font-bold transition-colors"
                              title="Message on WhatsApp"
                            >
                              <MessageSquare size={11} />
                              <span>WhatsApp</span>
                            </a>
                          ) : (
                            <span className="text-gray-400 text-[10px]">-</span>
                          )}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

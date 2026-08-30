import React, { useState, useEffect, useMemo } from 'react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../hooks/useAuth';
import { logTransaction } from '../lib/transactions';
import { 
  CreditCard, 
  Video, 
  Search, 
  Filter, 
  CheckSquare, 
  Square, 
  ChevronDown, 
  ChevronUp, 
  RefreshCw, 
  Copy, 
  Check, 
  ExternalLink, 
  Download, 
  AlertCircle, 
  CheckCircle2, 
  Clock, 
  UserCheck, 
  Calendar, 
  DollarSign, 
  User, 
  Phone, 
  Mail, 
  MapPin, 
  GraduationCap, 
  X, 
  Info,
  Layers,
  Sparkles,
  ArrowRight,
  ShieldCheck,
  FileSpreadsheet
} from 'lucide-react';
import { toast } from 'sonner';
import { SRI_LANKAN_DISTRICTS } from '../types';
import { cleanStudentNameForZoom } from '../lib/utils';

interface PaymentRecord {
  id: string;
  pcaid: string;
  type: string;
  class_type?: string | null;
  package_type?: string | null;
  payment: number;
  paid_date?: string | null;
  activation_date?: string | null;
  duration?: string | null;
  expired_date?: string | null;
  installment?: {
    id: string;
    paid_amount: number;
    paid_date: string;
    activation_date?: string;
    duration?: string;
    expired_date?: string;
    refund_reason?: string | null;
  }[];
}

interface PaymentProcessResult {
  pcaid: string;
  name: string;
  status: 'Success' | 'Failed';
  message: string;
  totalFee: number;
  paidAmount: number;
  item: string;
}

interface SelfStudent {
  id: string;
  pcaid: string;
  name: string;
  phone?: string | null;
  mail?: string | null;
  stream?: string | null;
  proper_batch?: string | null;
  joined_batch?: string | null;
  school?: string | null;
  district?: string | null;
  address?: string | null;
  nic?: string | null;
  admin?: string | null;
  created_at: string;
  payments: PaymentRecord[];
  totalPaid: number;
  isPaid: boolean;
  latestPayment?: PaymentRecord | null;
}

interface ZoomRegistrationResult {
  pcaid: string;
  name: string;
  email: string;
  status: 'Success' | 'Failed';
  joinUrl?: string;
  error?: string;
}

const DURATIONS = [
  { label: '0', value: 0 },
  { label: '1 day', value: 1 },
  { label: '2 days', value: 2 },
  { label: '1 week', value: 7 },
  { label: '2 weeks', value: 14 },
  { label: '1 month', value: 30 },
  { label: '2 months', value: 60 },
  { label: '3 months', value: 90 },
  { label: '6 months', value: 180 },
  { label: '1 year', value: 365 },
  { label: '2 years', value: 730 },
  { label: 'unlimited', value: null }
];

const MONTHS = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December'
];

const calculateExpiry = (activationDate: string, durationLabel: string) => {
  if (!activationDate) return '';
  const date = new Date(activationDate);
  if (isNaN(date.getTime())) return '';

  const cleanLabel = (durationLabel || '').trim().toLowerCase();
  if (cleanLabel === 'unlimited' || cleanLabel === 'no expiration') {
    date.setFullYear(date.getFullYear() + 100);
    return date.toISOString().split('T')[0];
  }

  const found = DURATIONS.find(d => {
    const l = d.label.toLowerCase();
    return l === cleanLabel || l.replace(/\s+/g, '') === cleanLabel.replace(/\s+/g, '');
  });

  const duration = (found !== undefined && found.value !== null) ? found.value : 30;
  date.setDate(date.getDate() + duration);
  return date.toISOString().split('T')[0];
};

export default function SelfEnrolmentManagement() {
  const { user } = useAuth();

  // Data states
  const [students, setStudents] = useState<SelfStudent[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [selectedPcaIds, setSelectedPcaIds] = useState<Set<string>>(new Set());

  // Dropdown options
  const [classTypes, setClassTypes] = useState<{ id: string; class_type: string }[]>([]);
  const [packageTypes, setPackageTypes] = useState<{ id: string; package_type: string }[]>([]);
  const [joinedBatches, setJoinedBatches] = useState<{ id: string; joined_batch: string }[]>([]);
  const [webinars, setWebinars] = useState<{ id: number; webinar_name: string; webinar_id: string }[]>([]);

  // Filter states
  const [searchQuery, setSearchQuery] = useState('');
  const [paymentFilter, setPaymentFilter] = useState<'all' | 'paid' | 'unpaid'>('all');
  const [adminFilter, setAdminFilter] = useState<string>('all');
  const [batchFilter, setBatchFilter] = useState('');
  const [properBatchFilter, setProperBatchFilter] = useState('');
  const [districtFilter, setDistrictFilter] = useState('');
  const [streamFilter, setStreamFilter] = useState('');
  const [fromDateFilter, setFromDateFilter] = useState('');
  const [toDateFilter, setToDateFilter] = useState('');

  // Accordion open/collapse states (Left side)
  const [isPaymentOpen, setIsPaymentOpen] = useState(true);
  const [isWebinarOpen, setIsWebinarOpen] = useState(true);

  // Section 1: Payment Form State
  const [paymentType, setPaymentType] = useState<'class' | 'package'>('class');
  const [paymentClassType, setPaymentClassType] = useState('');
  const [paymentMonth, setPaymentMonth] = useState('');
  const [paymentPackageType, setPaymentPackageType] = useState('');
  const [paymentTotalFee, setPaymentTotalFee] = useState<string>('3500');
  const [paymentPaidAmount, setPaymentPaidAmount] = useState<string>('3500');
  const [paymentPaidDate, setPaymentPaidDate] = useState<string>(() => new Date().toISOString().split('T')[0]);
  const [paymentActivationDate, setPaymentActivationDate] = useState<string>(() => new Date().toISOString().split('T')[0]);
  const [paymentDuration, setPaymentDuration] = useState<string>('1 month');
  const [isSubmittingPayment, setIsSubmittingPayment] = useState(false);
  const [showPaymentConfirmModal, setShowPaymentConfirmModal] = useState(false);
  const [showPaymentResultModal, setShowPaymentResultModal] = useState(false);
  const [paymentResults, setPaymentResults] = useState<PaymentProcessResult[]>([]);

  // Section 2: Zoom Webinar State
  const [webinarId, setWebinarId] = useState(() => localStorage.getItem('zoom_last_webinar_id') || '');
  const [eventType, setEventType] = useState<'webinar' | 'meeting'>('webinar');
  const [isRegisteringWebinar, setIsRegisteringWebinar] = useState(false);
  const [webinarProgress, setWebinarProgress] = useState<{ done: number; total: number }>({ done: 0, total: 0 });
  const [webinarResults, setWebinarResults] = useState<ZoomRegistrationResult[]>([]);
  const [showWebinarResultsModal, setShowWebinarResultsModal] = useState(false);

  // Detail modal state
  const [viewingStudent, setViewingStudent] = useState<SelfStudent | null>(null);

  // Load initial dropdown options
  useEffect(() => {
    async function loadOptions() {
      try {
        const [classesRes, packagesRes, batchesRes, webinarsRes] = await Promise.all([
          supabase.from('class_item').select('*').order('class_type'),
          supabase.from('package_item').select('*').order('package_type'),
          supabase.from('joined_batch_item').select('*').order('joined_batch', { ascending: false }),
          supabase.from('webinar_id').select('*').order('created_at', { ascending: false })
        ]);

        if (classesRes.data) setClassTypes(classesRes.data);
        if (packagesRes.data) setPackageTypes(packagesRes.data);
        if (batchesRes.data) setJoinedBatches(batchesRes.data);
        if (webinarsRes.data) setWebinars(webinarsRes.data as any);
      } catch (err) {
        console.error("Error loading dropdown items:", err);
      }
    }
    loadOptions();
  }, []);

  // Compute clean, unique base class types (without monthly suffix) identical to Student Form
  const baseClassTypes = (Array.from(new Set(classTypes.map(c => {
    const match = MONTHS.find(m => c.class_type.endsWith(` ${m}`) || c.class_type.endsWith(` - ${m}`));
    if (match) {
      let idx = c.class_type.lastIndexOf(` - ${match}`);
      if (idx === -1) {
        idx = c.class_type.lastIndexOf(` ${match}`);
      }
      return c.class_type.substring(0, idx).trim();
    }
    return c.class_type;
  }))) as string[]).filter(Boolean).sort((a: string, b: string) => {
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

  // Fetch students and their payment statuses
  const fetchStudents = async () => {
    setIsLoading(true);
    try {
      // 1. Fetch students (not deleted)
      const { data: studentsData, error: stuError } = await supabase
        .from('student')
        .select('*')
        .is('deleted_at', null)
        .order('created_at', { ascending: false });

      if (stuError) throw stuError;

      if (!studentsData || studentsData.length === 0) {
        setStudents([]);
        setIsLoading(false);
        return;
      }

      const pcaIds = studentsData.map(s => s.pcaid).filter(Boolean);

      // 2. Fetch payments & installments for these students
      let paymentsData: any[] = [];
      if (pcaIds.length > 0) {
        const { data: payRes, error: payError } = await supabase
          .from('payment')
          .select('*, installment(*)')
          .in('pcaid', pcaIds);

        if (payError) {
          console.warn("Payment fetch error:", payError);
        } else if (payRes) {
          paymentsData = payRes;
        }
      }

      // Map payments by pcaid
      const paymentsByPcaId = new Map<string, PaymentRecord[]>();
      for (const p of paymentsData) {
        const list = paymentsByPcaId.get(p.pcaid) || [];
        list.push(p);
        paymentsByPcaId.set(p.pcaid, list);
      }

      // 3. Assemble final SelfStudent objects
      const mappedStudents: SelfStudent[] = studentsData.map(s => {
        const studentPayments = paymentsByPcaId.get(s.pcaid) || [];
        
        let totalPaid = 0;
        studentPayments.forEach(pay => {
          const installments = pay.installment || [];
          const payInstSum = installments.reduce((sum: number, inst: any) => sum + Number(inst.paid_amount || 0), 0);
          // If installments exist, use their sum, otherwise use pay.payment
          if (installments.length > 0) {
            totalPaid += payInstSum;
          } else {
            totalPaid += Number(pay.payment || 0);
          }
        });

        // Sorted latest payment
        const sortedPay = [...studentPayments].sort((a, b) => {
          const dateA = a.paid_date ? new Date(a.paid_date).getTime() : 0;
          const dateB = b.paid_date ? new Date(b.paid_date).getTime() : 0;
          return dateB - dateA;
        });

        return {
          ...s,
          payments: studentPayments,
          totalPaid,
          isPaid: totalPaid > 0,
          latestPayment: sortedPay[0] || null
        };
      });

      setStudents(mappedStudents);
    } catch (err: any) {
      console.error("Error fetching students:", err);
      toast.error(`Failed to load students: ${err.message || 'Unknown error'}`);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchStudents();
  }, []);

  // Filter students based on active filter controls
  const filteredStudents = useMemo(() => {
    return students.filter(s => {
      // 1. Search Query
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase().trim();
        const matchPca = s.pcaid?.toLowerCase().includes(q);
        const matchName = s.name?.toLowerCase().includes(q);
        const matchPhone = s.phone?.toLowerCase().includes(q);
        const matchMail = s.mail?.toLowerCase().includes(q);
        const matchNic = s.nic?.toLowerCase().includes(q);
        const matchSchool = s.school?.toLowerCase().includes(q);
        if (!matchPca && !matchName && !matchPhone && !matchMail && !matchNic && !matchSchool) {
          return false;
        }
      }

      // 2. Payment Status Filter
      if (paymentFilter === 'paid' && !s.isPaid) return false;
      if (paymentFilter === 'unpaid' && s.isPaid) return false;

      // 3. Admin / Registered By Filter
      if (adminFilter !== 'all') {
        const stuAdmin = (s.admin || '').trim().toLowerCase();
        const targetAdmin = adminFilter.trim().toLowerCase();
        if (stuAdmin !== targetAdmin) {
          return false;
        }
      }

      // 4. Proper Batch Filter
      if (properBatchFilter && s.proper_batch !== properBatchFilter) return false;

      // 5. Joined Batch Filter
      if (batchFilter && s.joined_batch !== batchFilter) return false;

      // 6. District Filter
      if (districtFilter && s.district !== districtFilter) return false;

      // 7. Stream Filter
      if (streamFilter && s.stream !== streamFilter) return false;

      // 8. Date Range Filter
      if (fromDateFilter) {
        const stuDate = s.created_at ? s.created_at.split('T')[0] : '';
        if (stuDate && stuDate < fromDateFilter) return false;
      }
      if (toDateFilter) {
        const stuDate = s.created_at ? s.created_at.split('T')[0] : '';
        if (stuDate && stuDate > toDateFilter) return false;
      }

      return true;
    });
  }, [
    students,
    searchQuery,
    paymentFilter,
    adminFilter,
    properBatchFilter,
    batchFilter,
    districtFilter,
    streamFilter,
    fromDateFilter,
    toDateFilter
  ]);

  // Distinct admin list for filters
  const uniqueAdmins = useMemo(() => {
    const set = new Set<string>();
    students.forEach(s => {
      if (s.admin && s.admin.trim()) {
        set.add(s.admin.trim());
      }
    });
    // Ensure 'self' is in list if not already
    return Array.from(set).sort((a, b) => {
      if (a.toLowerCase() === 'self') return -1;
      if (b.toLowerCase() === 'self') return 1;
      return a.localeCompare(b);
    });
  }, [students]);

  // Distinct batch lists for filters
  const uniqueProperBatches = useMemo(() => {
    const set = new Set<string>();
    students.forEach(s => { if (s.proper_batch) set.add(s.proper_batch); });
    return Array.from(set).sort().reverse();
  }, [students]);

  // Selection handlers
  const handleToggleSelectAll = () => {
    if (selectedPcaIds.size === filteredStudents.length && filteredStudents.length > 0) {
      setSelectedPcaIds(new Set());
    } else {
      const newSet = new Set<string>();
      filteredStudents.forEach(s => newSet.add(s.pcaid));
      setSelectedPcaIds(newSet);
    }
  };

  const handleToggleSelectStudent = (pcaid: string) => {
    const next = new Set(selectedPcaIds);
    if (next.has(pcaid)) {
      next.delete(pcaid);
    } else {
      next.add(pcaid);
    }
    setSelectedPcaIds(next);
  };

  const handleSelectAllUnpaid = () => {
    const newSet = new Set<string>();
    filteredStudents.filter(s => !s.isPaid).forEach(s => newSet.add(s.pcaid));
    setSelectedPcaIds(newSet);
    toast.info(`Selected ${newSet.size} unpaid students`);
  };

  const handleClearSelection = () => {
    setSelectedPcaIds(new Set());
  };

  // Selected students full objects
  const selectedStudents = useMemo(() => {
    return students.filter(s => selectedPcaIds.has(s.pcaid));
  }, [students, selectedPcaIds]);

  // Computed expiry for Section 1 payment form
  const calculatedPaymentExpiry = useMemo(() => {
    return calculateExpiry(paymentActivationDate, paymentDuration);
  }, [paymentActivationDate, paymentDuration]);

  // Section 1: Execute Bulk Payment Confirmation Trigger
  const handleApplyBulkPayment = (e: React.FormEvent) => {
    e.preventDefault();

    if (selectedStudents.length === 0) {
      toast.error('Please select at least one student from the list');
      return;
    }

    if (paymentType === 'class') {
      if (!paymentClassType) {
        toast.error('Please select a Class Type');
        return;
      }
    } else {
      if (!paymentPackageType) {
        toast.error('Please select a Package Type');
        return;
      }
    }

    const totalFeeNum = Number(paymentTotalFee);
    const paidAmountNum = Number(paymentPaidAmount);

    if (isNaN(totalFeeNum) || totalFeeNum < 0) {
      toast.error('Please enter a valid Total Fee');
      return;
    }
    if (isNaN(paidAmountNum) || paidAmountNum < 0) {
      toast.error('Please enter a valid Paid Amount');
      return;
    }

    // Open in-app confirmation modal (bypasses browser alert/confirm sandbox restrictions)
    setShowPaymentConfirmModal(true);
  };

  // Section 1: Execute Bulk Payment to Database
  const executePaymentBulk = async () => {
    setShowPaymentConfirmModal(false);
    setIsSubmittingPayment(true);

    let finalClassType = '';
    if (paymentType === 'class') {
      finalClassType = paymentMonth ? `${paymentClassType} ${paymentMonth}` : paymentClassType;
    }
    const itemLabel = paymentType === 'class' ? finalClassType : paymentPackageType;
    const totalFeeNum = Number(paymentTotalFee);
    const paidAmountNum = Number(paymentPaidAmount);

    const results: PaymentProcessResult[] = [];
    let successCount = 0;
    let failCount = 0;

    try {
      for (const student of selectedStudents) {
        try {
          if (!supabase) {
            throw new Error('Database connection is not initialized. Please verify Supabase keys.');
          }

          if (!student.pcaid) {
            throw new Error('Student has no valid PCA ID assigned.');
          }

          // 1. Insert Payment Record
          const paymentPayload = {
            pcaid: student.pcaid,
            type: paymentType,
            class_type: paymentType === 'class' ? finalClassType : null,
            package_type: paymentType === 'package' ? paymentPackageType : null,
            payment: totalFeeNum, // 'payment' column holds the Total Fee
            paid_date: paymentPaidDate || new Date().toISOString().split('T')[0],
            activation_date: paymentActivationDate || new Date().toISOString().split('T')[0],
            duration: paymentDuration || '1 month',
            expired_date: calculatedPaymentExpiry
          };

          const { data: insertedPayment, error: payInsertError } = await supabase
            .from('payment')
            .insert(paymentPayload)
            .select()
            .single();

          if (payInsertError) {
            throw new Error(payInsertError.message || payInsertError.details || 'Failed to insert payment record');
          }

          if (insertedPayment && paidAmountNum > 0) {
            // 2. Insert Installment Record
            const installmentPayload = {
              payment_id: insertedPayment.id,
              paid_amount: paidAmountNum,
              paid_date: paymentPaidDate || new Date().toISOString().split('T')[0],
              activation_date: paymentActivationDate || new Date().toISOString().split('T')[0],
              duration: paymentDuration || '1 month',
              expired_date: calculatedPaymentExpiry
            };

            const { error: instInsertError } = await supabase
              .from('installment')
              .insert(installmentPayload);

            if (instInsertError) {
              throw new Error(instInsertError.message || instInsertError.details || 'Failed to insert installment record');
            }
          }

          results.push({
            pcaid: student.pcaid,
            name: student.name || 'Unknown Student',
            status: 'Success',
            message: `Recorded Rs. ${paidAmountNum.toLocaleString()} (Total: Rs. ${totalFeeNum.toLocaleString()})`,
            totalFee: totalFeeNum,
            paidAmount: paidAmountNum,
            item: itemLabel
          });
          successCount++;
        } catch (singleErr: any) {
          console.error(`Failed to apply payment for ${student.pcaid}:`, singleErr);
          results.push({
            pcaid: student.pcaid,
            name: student.name || 'Unknown Student',
            status: 'Failed',
            message: singleErr.message || 'Database insert failed',
            totalFee: totalFeeNum,
            paidAmount: paidAmountNum,
            item: itemLabel
          });
          failCount++;
        }
      }

      // Set results and show results popup modal immediately
      setPaymentResults(results);
      setShowPaymentResultModal(true);

      // Log Transaction in Audit Log
      try {
        await logTransaction({
          admin_username: user?.username || 'admin',
          action_type: 'INSERT',
          entity_type: 'payment',
          entity_id: `${selectedStudents.length} self-registered students`,
          details: `Bulk payment processed: ${successCount} successful, ${failCount} failed. (Item: ${itemLabel}, Amount: Rs. ${paidAmountNum})`
        });
      } catch (logErr) {
        console.warn('Audit log write error:', logErr);
      }

      if (successCount > 0) {
        toast.success(`Successfully recorded payments for ${successCount} student(s)!`);
        // Refresh data while keeping selection intact so webinar registration can follow
        await fetchStudents();
      }
      if (failCount > 0) {
        toast.error(`Payment failed for ${failCount} student(s). Check the results pop-up for details.`);
      }
    } catch (err: any) {
      console.error("Bulk payment process error:", err);
      toast.error(`Bulk payment error: ${err.message || 'Unknown error'}`);
    } finally {
      setIsSubmittingPayment(false);
    }
  };

  // Section 2: Execute Zoom Webinar Registration
  const handleRegisterWebinar = async () => {
    const cleanWebinarId = webinarId.trim();
    if (!cleanWebinarId) {
      toast.error('Please enter or select a valid Zoom Webinar/Meeting ID');
      return;
    }

    if (selectedStudents.length === 0) {
      toast.error('Please select at least one student from the list');
      return;
    }

    setIsRegisteringWebinar(true);
    setWebinarResults([]);
    setWebinarProgress({ done: 0, total: selectedStudents.length });
    setShowWebinarResultsModal(true);

    const allResults: ZoomRegistrationResult[] = [];
    const BATCH_SIZE = 10;

    try {
      // Save last webinar ID
      localStorage.setItem('zoom_last_webinar_id', cleanWebinarId);

      // Map students: FirstName = PCA ID, LastName = Clean Student Name without Initials, Email = Student Mail
      const targetPayload = selectedStudents.map(s => ({
        firstName: s.pcaid, // requirement: Firstname from PCAID
        lastName: cleanStudentNameForZoom(s.name), // requirement: Lastname from clean name (initials removed)
        email: s.mail?.trim() || `${s.pcaid.toLowerCase()}@physicsacademy.lk`
      }));

      for (let i = 0; i < targetPayload.length; i += BATCH_SIZE) {
        const batchSlice = targetPayload.slice(i, i + BATCH_SIZE);

        try {
          const response = await fetch('/api/register-batch', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              webinarId: cleanWebinarId,
              eventType: eventType,
              students: batchSlice
            })
          });

          let data: any;
          const contentType = response.headers.get('content-type') || '';
          if (contentType.includes('application/json')) {
            data = await response.json();
          } else {
            const text = await response.text();
            throw new Error(`Server returned status ${response.status}: ${text.slice(0, 100)}`);
          }

          if (response.ok && data.results) {
            const mappedBatchResults: ZoomRegistrationResult[] = (data.results as any[]).map(res => {
              const matchedStudent = selectedStudents.find(
                s => (s.mail && s.mail.toLowerCase() === res.email.toLowerCase()) || (s.pcaid.toLowerCase() === res.firstName?.toLowerCase())
              );
              return {
                pcaid: matchedStudent?.pcaid || res.firstName || 'N/A',
                name: matchedStudent?.name || res.lastName || 'Student',
                email: res.email,
                status: res.status,
                joinUrl: res.joinUrl,
                error: res.error
              };
            });
            allResults.push(...mappedBatchResults);
          } else {
            // Batch failed
            batchSlice.forEach(s => {
              allResults.push({
                pcaid: s.firstName,
                name: s.lastName,
                email: s.email,
                status: 'Failed',
                error: data.error || 'Registration failed'
              });
            });
          }
        } catch (err: any) {
          batchSlice.forEach(s => {
            allResults.push({
              pcaid: s.firstName,
              name: s.lastName,
              email: s.email,
              status: 'Failed',
              error: err.message || 'API request failure'
            });
          });
        }

        setWebinarProgress({
          done: Math.min(i + BATCH_SIZE, targetPayload.length),
          total: targetPayload.length
        });
        setWebinarResults([...allResults]);
      }

      const successCount = allResults.filter(r => r.status === 'Success').length;
      const failCount = allResults.filter(r => r.status === 'Failed').length;

      // Log transaction
      await logTransaction({
        admin_username: user?.username || 'admin',
        action_type: 'INSERT',
        entity_type: 'webinar_registration',
        entity_id: cleanWebinarId,
        details: `Zoom Webinar ${cleanWebinarId} registered: ${successCount} successful, ${failCount} failed.`
      });

      if (successCount > 0) {
        toast.success(`Zoom registration complete! ${successCount} successful, ${failCount} failed.`);
      } else {
        toast.error(`Zoom registration finished with ${failCount} errors.`);
      }
    } catch (err: any) {
      console.error("Zoom batch error:", err);
      toast.error(`Zoom registration error: ${err.message || 'Unknown error'}`);
    } finally {
      setIsRegisteringWebinar(false);
    }
  };

  // Helper to copy join links CSV
  const handleExportZoomCsv = () => {
    if (webinarResults.length === 0) return;

    const headers = ['PCA ID', 'Name', 'Email', 'Status', 'Join URL', 'Error'];
    const rows = webinarResults.map(r => [
      `"${r.pcaid}"`,
      `"${r.name}"`,
      `"${r.email}"`,
      `"${r.status}"`,
      `"${r.joinUrl || ''}"`,
      `"${r.error || ''}"`
    ]);

    const csvContent = 'data:text/csv;charset=utf-8,' + [headers.join(','), ...rows.map(e => e.join(','))].join('\n');
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `zoom_registration_${webinarId || 'webinar'}_${new Date().toISOString().split('T')[0]}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const copyToClipboard = (text: string, label: string = 'Copied') => {
    navigator.clipboard.writeText(text);
    toast.success(`${label} copied to clipboard!`);
  };

  // Quick stats
  const totalCount = students.length;
  const paidCount = students.filter(s => s.isPaid).length;
  const unpaidCount = students.filter(s => !s.isPaid).length;
  const selectedCount = selectedStudents.length;

  return (
    <div className="space-y-5">
      {/* Main 2-Column Split Layout */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        
        {/* ============================================================ */}
        {/* LEFT COLUMN: Collapsible Action Panels (Payment & Webinar)  */}
        {/* ============================================================ */}
        <div className="lg:col-span-4 space-y-4 sticky top-20">
          
          {/* Selected Count Indicator Banner */}
          <div className="p-3.5 rounded-2xl bg-gradient-to-r from-teal-50 to-blue-50 dark:from-teal-950/40 dark:to-blue-950/40 border border-teal-100 dark:border-teal-900/40 shadow-xs flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className="flex h-2.5 w-2.5 relative">
                <span className={`animate-ping absolute inline-flex h-full w-full rounded-full opacity-75 ${selectedCount > 0 ? 'bg-teal-400' : 'bg-gray-400'}`}></span>
                <span className={`relative inline-flex rounded-full h-2.5 w-2.5 ${selectedCount > 0 ? 'bg-teal-500' : 'bg-gray-400'}`}></span>
              </span>
              <p className="text-xs font-bold text-gray-900 dark:text-gray-100">
                <strong className="text-teal-700 dark:text-teal-400 font-extrabold text-sm">{selectedCount}</strong> student{selectedCount === 1 ? '' : 's'} selected
              </p>
            </div>
            {selectedCount > 0 && (
              <div className="flex items-center gap-1.5">
                <button
                  type="button"
                  onClick={handleClearSelection}
                  className="text-[11px] font-bold text-gray-500 hover:text-red-600 dark:hover:text-red-400 underline cursor-pointer"
                >
                  Clear
                </button>
              </div>
            )}
          </div>


          {/* ============================================================ */}
          {/* SECTION 1: PAYMENT (Collapsible)                            */}
          {/* ============================================================ */}
          <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-2xl overflow-hidden shadow-xs">
            {/* Collapsible Header */}
            <button
              type="button"
              onClick={() => setIsPaymentOpen(!isPaymentOpen)}
              className="w-full px-4 py-3.5 bg-gray-50 dark:bg-gray-800/60 hover:bg-gray-100 dark:hover:bg-gray-800 flex items-center justify-between border-b border-gray-200 dark:border-gray-800 transition-colors cursor-pointer text-left"
            >
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-lg bg-teal-100 dark:bg-teal-950/80 text-teal-700 dark:text-teal-300 flex items-center justify-center font-bold">
                  <CreditCard size={17} />
                </div>
                <div>
                  <h2 className="text-sm font-black text-gray-900 dark:text-gray-100">Payment</h2>
                  <p className="text-[11px] text-gray-500 dark:text-gray-400">Insert payment records in bulk</p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-[10px] font-extrabold uppercase px-2 py-0.5 rounded-full bg-teal-50 dark:bg-teal-950 text-teal-700 dark:text-teal-300 border border-teal-200/60 dark:border-teal-800/40">
                  Bulk
                </span>
                {isPaymentOpen ? <ChevronUp size={18} className="text-gray-400" /> : <ChevronDown size={18} className="text-gray-400" />}
              </div>
            </button>

            {/* Collapsible Body */}
            {isPaymentOpen && (
              <form onSubmit={handleApplyBulkPayment} className="p-4 space-y-3.5">
                
                {/* 1. Payment Type Selector */}
                <div className="space-y-1.5">
                  <label className="text-xs font-bold text-gray-700 dark:text-gray-300">Payment Type</label>
                  <div className="grid grid-cols-2 gap-2">
                    <button
                      type="button"
                      onClick={() => setPaymentType('class')}
                      className={`py-2 px-3 rounded-xl text-xs font-bold transition-all border cursor-pointer ${
                        paymentType === 'class'
                          ? 'bg-teal-600 text-white border-teal-600 shadow-xs'
                          : 'bg-gray-50 dark:bg-gray-800 text-gray-700 dark:text-gray-300 border-gray-200 dark:border-gray-700'
                      }`}
                    >
                      Class
                    </button>
                    <button
                      type="button"
                      onClick={() => setPaymentType('package')}
                      className={`py-2 px-3 rounded-xl text-xs font-bold transition-all border cursor-pointer ${
                        paymentType === 'package'
                          ? 'bg-teal-600 text-white border-teal-600 shadow-xs'
                          : 'bg-gray-50 dark:bg-gray-800 text-gray-700 dark:text-gray-300 border-gray-200 dark:border-gray-700'
                      }`}
                    >
                      Package
                    </button>
                  </div>
                </div>

                {/* 2. Class / Package Details */}
                {paymentType === 'class' ? (
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                    <div className="space-y-1">
                      <label className="text-xs font-bold text-gray-700 dark:text-gray-300">
                        Class Type <span className="text-red-500">*</span>
                      </label>
                      <select
                        value={paymentClassType}
                        onChange={(e) => setPaymentClassType(e.target.value)}
                        className="w-full px-3 py-2 bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl text-xs font-medium text-gray-900 dark:text-gray-100 focus:ring-2 focus:ring-teal-500/20 focus:border-teal-500"
                        required
                      >
                        <option value="">Select Class Type</option>
                        {baseClassTypes.map(cName => (
                          <option key={cName} value={cName}>{cName}</option>
                        ))}
                      </select>
                    </div>

                    <div className="space-y-1">
                      <label className="text-xs font-bold text-gray-700 dark:text-gray-300">Month</label>
                      <select
                        value={paymentMonth}
                        onChange={(e) => setPaymentMonth(e.target.value)}
                        className="w-full px-3 py-2 bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl text-xs font-medium text-gray-900 dark:text-gray-100 focus:ring-2 focus:ring-teal-500/20 focus:border-teal-500"
                      >
                        <option value="">No Month</option>
                        {MONTHS.map(m => (
                          <option key={m} value={m}>{m}</option>
                        ))}
                      </select>
                    </div>
                  </div>
                ) : (
                  <div className="space-y-1">
                    <label className="text-xs font-bold text-gray-700 dark:text-gray-300">
                      Package Type <span className="text-red-500">*</span>
                    </label>
                    <select
                      value={paymentPackageType}
                      onChange={(e) => setPaymentPackageType(e.target.value)}
                      className="w-full px-3 py-2 bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl text-xs font-medium text-gray-900 dark:text-gray-100 focus:ring-2 focus:ring-teal-500/20 focus:border-teal-500"
                      required
                    >
                      <option value="">Select Package</option>
                      {packageTypes.map(p => (
                        <option key={p.id} value={p.package_type}>{p.package_type}</option>
                      ))}
                    </select>
                  </div>
                )}

                {/* 3. Amounts (Total Fee & Paid Amount) */}
                <div className="grid grid-cols-2 gap-2.5">
                  <div className="space-y-1">
                    <label className="text-xs font-bold text-gray-700 dark:text-gray-300">Total Fee (Rs.)</label>
                    <input
                      type="number"
                      value={paymentTotalFee}
                      onChange={(e) => {
                        setPaymentTotalFee(e.target.value);
                        setPaymentPaidAmount(e.target.value);
                      }}
                      className="w-full px-3 py-2 bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl text-xs font-medium text-gray-900 dark:text-gray-100 focus:ring-2 focus:ring-teal-500/20 focus:border-teal-500"
                      placeholder="3500"
                      min="0"
                      required
                    />
                  </div>

                  <div className="space-y-1">
                    <label className="text-xs font-bold text-gray-700 dark:text-gray-300">Paid Amount (Rs.)</label>
                    <input
                      type="number"
                      value={paymentPaidAmount}
                      onChange={(e) => setPaymentPaidAmount(e.target.value)}
                      className="w-full px-3 py-2 bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl text-xs font-medium text-gray-900 dark:text-gray-100 focus:ring-2 focus:ring-teal-500/20 focus:border-teal-500"
                      placeholder="3500"
                      min="0"
                      required
                    />
                  </div>
                </div>

                {/* 4. Dates & Duration */}
                <div className="grid grid-cols-2 gap-2.5">
                  <div className="space-y-1">
                    <label className="text-xs font-bold text-gray-700 dark:text-gray-300">Paid Date</label>
                    <input
                      type="date"
                      value={paymentPaidDate}
                      onChange={(e) => setPaymentPaidDate(e.target.value)}
                      className="w-full px-3 py-2 bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl text-xs font-medium text-gray-900 dark:text-gray-100 focus:ring-2 focus:ring-teal-500/20 focus:border-teal-500"
                      required
                    />
                  </div>

                  <div className="space-y-1">
                    <label className="text-xs font-bold text-gray-700 dark:text-gray-300">Activation Date</label>
                    <input
                      type="date"
                      value={paymentActivationDate}
                      onChange={(e) => setPaymentActivationDate(e.target.value)}
                      className="w-full px-3 py-2 bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl text-xs font-medium text-gray-900 dark:text-gray-100 focus:ring-2 focus:ring-teal-500/20 focus:border-teal-500"
                      required
                    />
                  </div>
                </div>

                {/* 5. Duration & Calculated Expiry */}
                <div className="grid grid-cols-2 gap-2.5 items-center">
                  <div className="space-y-1">
                    <label className="text-xs font-bold text-gray-700 dark:text-gray-300">Duration</label>
                    <select
                      value={paymentDuration}
                      onChange={(e) => setPaymentDuration(e.target.value)}
                      className="w-full px-3 py-2 bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl text-xs font-medium text-gray-900 dark:text-gray-100 focus:ring-2 focus:ring-teal-500/20 focus:border-teal-500"
                    >
                      {DURATIONS.map(d => (
                        <option key={d.label} value={d.label}>{d.label}</option>
                      ))}
                    </select>
                  </div>

                  <div className="space-y-1">
                    <label className="text-xs font-bold text-gray-700 dark:text-gray-300">Calculated Expiry</label>
                    <div className="px-3 py-2 bg-slate-100 dark:bg-gray-800 border border-slate-200 dark:border-gray-700 rounded-xl text-xs font-bold text-teal-700 dark:text-teal-400">
                      {calculatedPaymentExpiry || 'N/A'}
                    </div>
                  </div>
                </div>

                {/* Submit Payment Button */}
                <div className="pt-2">
                  <button
                    type="submit"
                    disabled={isSubmittingPayment || selectedCount === 0}
                    className={`w-full py-2.5 px-4 rounded-xl text-xs font-bold text-white transition-all shadow-xs flex items-center justify-center gap-2 cursor-pointer ${
                      selectedCount === 0 || isSubmittingPayment
                        ? 'bg-gray-300 dark:bg-gray-800 text-gray-500 cursor-not-allowed'
                        : 'bg-teal-600 hover:bg-teal-700 active:bg-teal-800'
                    }`}
                  >
                    {isSubmittingPayment ? (
                      <>
                        <RefreshCw size={14} className="animate-spin" />
                        <span>Applying Payments...</span>
                      </>
                    ) : (
                      <>
                        <CreditCard size={14} />
                        <span>Add Payment</span>
                      </>
                    )}
                  </button>
                  {selectedCount === 0 && (
                    <p className="text-[10px] text-gray-400 text-center mt-1.5">
                      Select students from the list on the right to apply payment
                    </p>
                  )}
                </div>
              </form>
            )}
          </div>

          {/* ============================================================ */}
          {/* SECTION 2: WEBINAR REGISTER (Collapsible)                   */}
          {/* ============================================================ */}
          <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-2xl overflow-hidden shadow-xs">
            {/* Collapsible Header */}
            <button
              type="button"
              onClick={() => setIsWebinarOpen(!isWebinarOpen)}
              className="w-full px-4 py-3.5 bg-gray-50 dark:bg-gray-800/60 hover:bg-gray-100 dark:hover:bg-gray-800 flex items-center justify-between border-b border-gray-200 dark:border-gray-800 transition-colors cursor-pointer text-left"
            >
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-lg bg-blue-100 dark:bg-blue-950/80 text-blue-700 dark:text-blue-300 flex items-center justify-center font-bold">
                  <Video size={17} />
                </div>
                <div>
                  <h2 className="text-sm font-black text-gray-900 dark:text-gray-100">Webinar Register</h2>
                  <p className="text-[11px] text-gray-500 dark:text-gray-400">Webinar registration in bulk</p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-[10px] font-extrabold uppercase px-2 py-0.5 rounded-full bg-blue-50 dark:bg-blue-950 text-blue-700 dark:text-blue-300 border border-blue-200/60 dark:border-blue-800/40">
                  Zoom
                </span>
                {isWebinarOpen ? <ChevronUp size={18} className="text-gray-400" /> : <ChevronDown size={18} className="text-gray-400" />}
              </div>
            </button>

            {/* Collapsible Body */}
            {isWebinarOpen && (
              <div className="p-4 space-y-3.5">
                
                {/* Webinar ID text input & Preset Selector */}
                <div className="space-y-1.5">
                  <label className="text-xs font-bold text-gray-700 dark:text-gray-300 flex items-center justify-between">
                    <span>Webinar / Meeting ID <span className="text-red-500">*</span></span>
                    {webinars.length > 0 && (
                      <span className="text-[10px] font-normal text-gray-400">{webinars.length} configured</span>
                    )}
                  </label>
                  
                  {/* Preset dropdown if webinars exist */}
                  {webinars.length > 0 && (
                    <select
                      onChange={(e) => {
                        if (e.target.value) setWebinarId(e.target.value);
                      }}
                      className="w-full mb-2 px-3 py-1.5 bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl text-xs text-gray-700 dark:text-gray-300"
                    >
                      <option value="">-- Choose from configured webinars --</option>
                      {webinars.map(w => (
                        <option key={w.id} value={w.webinar_id}>
                          {w.webinar_name} ({w.webinar_id})
                        </option>
                      ))}
                    </select>
                  )}

                  <input
                    type="text"
                    value={webinarId}
                    onChange={(e) => setWebinarId(e.target.value)}
                    placeholder="e.g. 84567891234"
                    className="w-full px-3 py-2 bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl text-xs font-mono font-medium text-gray-900 dark:text-gray-100 focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
                  />
                </div>

                {/* Event Type Toggle */}
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => setEventType('webinar')}
                    className={`flex-1 py-1.5 px-3 rounded-lg text-xs font-bold transition-all border cursor-pointer ${
                      eventType === 'webinar'
                        ? 'bg-blue-600 text-white border-blue-600'
                        : 'bg-gray-50 dark:bg-gray-800 text-gray-600 dark:text-gray-400 border-gray-200 dark:border-gray-700'
                    }`}
                  >
                    Webinar
                  </button>
                  <button
                    type="button"
                    onClick={() => setEventType('meeting')}
                    className={`flex-1 py-1.5 px-3 rounded-lg text-xs font-bold transition-all border cursor-pointer ${
                      eventType === 'meeting'
                        ? 'bg-blue-600 text-white border-blue-600'
                        : 'bg-gray-50 dark:bg-gray-800 text-gray-600 dark:text-gray-400 border-gray-200 dark:border-gray-700'
                    }`}
                  >
                    Meeting
                  </button>
                </div>

                {/* Requirement note banner */}
                <div className="p-2.5 rounded-xl bg-blue-50/70 dark:bg-blue-950/30 border border-blue-100 dark:border-blue-900/40 text-[11px] text-blue-900 dark:text-blue-200 flex items-start gap-2">
                  <Info size={14} className="text-blue-600 shrink-0 mt-0.5" />
                  <p className="leading-tight">
                    Student format: <strong>First Name = PCA ID</strong>, <strong>Last Name = Student Name</strong>.
                  </p>
                </div>

                {/* Register Button */}
                <div className="pt-1">
                  <button
                    type="button"
                    onClick={handleRegisterWebinar}
                    disabled={isRegisteringWebinar || selectedCount === 0 || !webinarId.trim()}
                    className={`w-full py-2.5 px-4 rounded-xl text-xs font-bold text-white transition-all shadow-xs flex items-center justify-center gap-2 cursor-pointer ${
                      selectedCount === 0 || isRegisteringWebinar || !webinarId.trim()
                        ? 'bg-gray-300 dark:bg-gray-800 text-gray-500 cursor-not-allowed'
                        : 'bg-blue-600 hover:bg-blue-700 active:bg-blue-800'
                    }`}
                  >
                    {isRegisteringWebinar ? (
                      <>
                        <RefreshCw size={14} className="animate-spin" />
                        <span>Registering {webinarProgress.done}/{webinarProgress.total}...</span>
                      </>
                    ) : (
                      <>
                        <Video size={14} />
                        <span>Register</span>
                      </>
                    )}
                  </button>
                </div>

                {/* View Previous Results button if available */}
                {webinarResults.length > 0 && !isRegisteringWebinar && (
                  <button
                    type="button"
                    onClick={() => setShowWebinarResultsModal(true)}
                    className="w-full py-1.5 text-[11px] font-bold text-blue-600 dark:text-blue-400 hover:underline cursor-pointer flex items-center justify-center gap-1"
                  >
                    <span>View Latest Zoom Results ({webinarResults.length})</span>
                    <ArrowRight size={12} />
                  </button>
                )}
              </div>
            )}
          </div>
        </div>

        {/* ============================================================ */}
        {/* RIGHT COLUMN: Full Student List & Filters                   */}
        {/* ============================================================ */}
        <div className="lg:col-span-8 space-y-4">
          
          {/* Filters Bar */}
          <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-2xl p-4 shadow-xs space-y-3">
            
            {/* Search Input & Quick Status Filter */}
            <div className="flex flex-col sm:flex-row gap-3">
              <div className="relative flex-1">
                <Search size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400" />
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Search by Name, PCA ID, Phone, Email, NIC..."
                  className="w-full pl-10 pr-4 py-2 bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl text-xs font-medium text-gray-900 dark:text-gray-100 placeholder:text-gray-400 focus:ring-2 focus:ring-teal-500/20 focus:border-teal-500"
                />
                {searchQuery && (
                  <button
                    onClick={() => setSearchQuery('')}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 dark:hover:text-gray-200"
                  >
                    <X size={14} />
                  </button>
                )}
              </div>

              {/* Payment Filter Pill Buttons */}
              <div className="flex items-center gap-1.5 shrink-0">
                <div className="flex items-center gap-1 bg-gray-100 dark:bg-gray-800 p-1 rounded-xl">
                  <button
                    onClick={() => setPaymentFilter('all')}
                    className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                      paymentFilter === 'all'
                        ? 'bg-white dark:bg-gray-900 text-gray-900 dark:text-white shadow-2xs'
                        : 'text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white'
                    }`}
                  >
                    All ({totalCount})
                  </button>
                  <button
                    onClick={() => setPaymentFilter('unpaid')}
                    className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                      paymentFilter === 'unpaid'
                        ? 'bg-amber-600 text-white shadow-2xs'
                        : 'text-amber-700 dark:text-amber-400 hover:text-amber-800'
                    }`}
                  >
                    Unpaid ({unpaidCount})
                  </button>
                  <button
                    onClick={() => setPaymentFilter('paid')}
                    className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                      paymentFilter === 'paid'
                        ? 'bg-emerald-600 text-white shadow-2xs'
                        : 'text-emerald-700 dark:text-emerald-400 hover:text-emerald-800'
                    }`}
                  >
                    Paid ({paidCount})
                  </button>
                </div>

                <button
                  type="button"
                  onClick={fetchStudents}
                  disabled={isLoading}
                  className="p-2 text-gray-500 hover:text-teal-600 dark:text-gray-400 dark:hover:text-teal-400 bg-gray-100 hover:bg-gray-200 dark:bg-gray-800 dark:hover:bg-gray-700 rounded-xl transition-colors cursor-pointer"
                  title="Refresh Student List"
                >
                  <RefreshCw size={15} className={isLoading ? 'animate-spin text-teal-600' : ''} />
                </button>
              </div>
            </div>

            {/* Secondary Filters Grid */}
            <div className="grid grid-cols-2 sm:grid-cols-5 gap-2 pt-1 border-t border-gray-100 dark:border-gray-800">
              
              {/* Admins Filter */}
              <div>
                <select
                  value={adminFilter}
                  onChange={(e) => setAdminFilter(e.target.value)}
                  className="w-full px-2.5 py-1.5 bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg text-xs font-medium text-gray-700 dark:text-gray-300"
                >
                  <option value="all">All Admins</option>
                  {uniqueAdmins.map(a => (
                    <option key={a} value={a}>
                      {a.toLowerCase() === 'self' ? 'Self Registered' : `Admin: ${a}`}
                    </option>
                  ))}
                </select>
              </div>

              {/* Proper Batch */}
              <div>
                <select
                  value={properBatchFilter}
                  onChange={(e) => setProperBatchFilter(e.target.value)}
                  className="w-full px-2.5 py-1.5 bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg text-xs font-medium text-gray-700 dark:text-gray-300"
                >
                  <option value="">All Proper Batches</option>
                  {uniqueProperBatches.map(b => (
                    <option key={b} value={b}>{b}</option>
                  ))}
                </select>
              </div>

              {/* Joined Batch */}
              <div>
                <select
                  value={batchFilter}
                  onChange={(e) => setBatchFilter(e.target.value)}
                  className="w-full px-2.5 py-1.5 bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg text-xs font-medium text-gray-700 dark:text-gray-300"
                >
                  <option value="">All Joined Batches</option>
                  {joinedBatches.map(b => (
                    <option key={b.id} value={b.joined_batch}>{b.joined_batch}</option>
                  ))}
                </select>
              </div>

              {/* District */}
              <div>
                <select
                  value={districtFilter}
                  onChange={(e) => setDistrictFilter(e.target.value)}
                  className="w-full px-2.5 py-1.5 bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg text-xs font-medium text-gray-700 dark:text-gray-300"
                >
                  <option value="">All Districts</option>
                  {SRI_LANKAN_DISTRICTS.map(d => (
                    <option key={d} value={d}>{d}</option>
                  ))}
                </select>
              </div>

              {/* Date Registered (From) */}
              <div>
                <input
                  type="date"
                  value={fromDateFilter}
                  onChange={(e) => setFromDateFilter(e.target.value)}
                  className="w-full px-2.5 py-1.5 bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg text-xs font-medium text-gray-700 dark:text-gray-300"
                  title="Registered From Date"
                />
              </div>
            </div>

            {/* Reset Filters Bar */}
            {(searchQuery || adminFilter !== 'all' || properBatchFilter || batchFilter || districtFilter || streamFilter || fromDateFilter || toDateFilter || paymentFilter !== 'all') && (
              <div className="flex items-center justify-between text-xs pt-2 text-gray-500 dark:text-gray-400">
                <span>Showing <strong>{filteredStudents.length}</strong> of {students.length} students</span>
                <button
                  onClick={() => {
                    setSearchQuery('');
                    setPaymentFilter('all');
                    setAdminFilter('all');
                    setProperBatchFilter('');
                    setBatchFilter('');
                    setDistrictFilter('');
                    setStreamFilter('');
                    setFromDateFilter('');
                    setToDateFilter('');
                  }}
                  className="text-teal-600 dark:text-teal-400 font-bold hover:underline cursor-pointer"
                >
                  Reset all filters
                </button>
              </div>
            )}
          </div>

          {/* Student Table Card */}
          <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-2xl overflow-hidden shadow-xs">
            
            {/* Table Header Controls */}
            <div className="px-4 py-3 bg-gray-50/80 dark:bg-gray-800/60 border-b border-gray-200 dark:border-gray-800 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <button
                  type="button"
                  onClick={handleToggleSelectAll}
                  className="flex items-center gap-2 text-xs font-bold text-gray-700 dark:text-gray-300 hover:text-teal-600 dark:hover:text-teal-400 cursor-pointer"
                >
                  {selectedPcaIds.size === filteredStudents.length && filteredStudents.length > 0 ? (
                    <CheckSquare size={17} className="text-teal-600" />
                  ) : (
                    <Square size={17} className="text-gray-400" />
                  )}
                  <span>Select All Filtered ({filteredStudents.length})</span>
                </button>
              </div>

              <div className="text-xs font-bold text-gray-500 dark:text-gray-400">
                {selectedCount} selected
              </div>
            </div>

            {/* Students Table */}
            <div className="overflow-x-auto">
              {isLoading ? (
                <div className="p-12 text-center text-gray-500 dark:text-gray-400 flex flex-col items-center justify-center gap-2">
                  <RefreshCw size={24} className="animate-spin text-teal-600" />
                  <p className="text-sm font-semibold">Loading students...</p>
                </div>
              ) : filteredStudents.length === 0 ? (
                <div className="p-12 text-center text-gray-500 dark:text-gray-400 flex flex-col items-center justify-center gap-2">
                  <AlertCircle size={28} className="text-gray-400" />
                  <p className="text-sm font-semibold">No students found</p>
                  <p className="text-xs text-gray-400">Try adjusting your search criteria or filters</p>
                </div>
              ) : (
                <table className="w-full text-left text-xs">
                  <thead className="bg-gray-50/50 dark:bg-gray-800/40 text-gray-500 dark:text-gray-400 font-bold uppercase text-[10px] tracking-wider border-b border-gray-100 dark:border-gray-800 select-none">
                    <tr>
                      <th className="p-3.5 w-10 text-center">#</th>
                      <th className="p-3.5">Name</th>
                      <th className="p-3.5">PCAID</th>
                      <th className="p-3.5">Phone No</th>
                      <th className="p-3.5">Batch</th>
                      <th className="p-3.5">Registered By</th>
                      <th className="p-3.5">Payment Details</th>
                      <th className="p-3.5">Register Date</th>
                      <th className="p-3.5 text-right">Details</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100 dark:divide-gray-800/60 font-medium">
                    {filteredStudents.map((stu) => {
                      const isSelected = selectedPcaIds.has(stu.pcaid);

                      return (
                        <tr
                          key={stu.id || stu.pcaid}
                          onClick={() => handleToggleSelectStudent(stu.pcaid)}
                          className={`transition-colors cursor-pointer select-none ${
                            isSelected
                              ? 'bg-teal-50/80 dark:bg-teal-950/30 hover:bg-teal-100/70 dark:hover:bg-teal-900/40'
                              : 'hover:bg-gray-50/70 dark:hover:bg-gray-800/40'
                          }`}
                        >
                          {/* Checkbox */}
                          <td className="p-3.5 text-center" onClick={(e) => e.stopPropagation()}>
                            <button
                              type="button"
                              onClick={() => handleToggleSelectStudent(stu.pcaid)}
                              className="text-gray-400 hover:text-teal-600 dark:hover:text-teal-400 transition-colors"
                            >
                              {isSelected ? (
                                <CheckSquare size={17} className="text-teal-600" />
                              ) : (
                                <Square size={17} />
                              )}
                            </button>
                          </td>

                          {/* Name */}
                          <td className="p-3.5">
                            <span className="font-extrabold text-gray-900 dark:text-gray-100 text-xs">
                              {stu.name}
                            </span>
                          </td>

                          {/* PCAID */}
                          <td className="p-3.5">
                            <div className="flex items-center gap-1.5">
                              <span className="font-mono font-bold text-[11px] text-teal-700 dark:text-teal-400 bg-teal-50 dark:bg-teal-950/60 px-2 py-0.5 rounded border border-teal-200/60 dark:border-teal-800/40">
                                {stu.pcaid}
                              </span>
                              <button
                                type="button"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  copyToClipboard(stu.pcaid, 'PCA ID');
                                }}
                                className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 p-0.5 cursor-pointer"
                                title="Copy PCA ID"
                              >
                                <Copy size={11} />
                              </button>
                            </div>
                          </td>

                          {/* Phone No */}
                          <td className="p-3.5">
                            {stu.phone ? (
                              <div className="flex items-center gap-1 text-gray-700 dark:text-gray-300 text-xs">
                                <Phone size={12} className="text-gray-400" />
                                <a
                                  href={`tel:${stu.phone}`}
                                  onClick={(e) => e.stopPropagation()}
                                  className="hover:text-teal-600 hover:underline font-mono"
                                >
                                  {stu.phone}
                                </a>
                              </div>
                            ) : (
                              <span className="text-gray-400 text-xs">-</span>
                            )}
                          </td>

                          {/* Batch */}
                          <td className="p-3.5">
                            <span className="inline-block px-2 py-0.5 rounded-md bg-gray-100 dark:bg-gray-800 text-gray-800 dark:text-gray-200 text-xs font-semibold">
                              {stu.proper_batch ? `${stu.proper_batch}` : (stu.joined_batch || '-')}
                            </span>
                          </td>

                          {/* Registered By / Admin */}
                          <td className="p-3.5">
                            {stu.admin?.toLowerCase() === 'self' ? (
                              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[11px] font-bold bg-blue-50 dark:bg-blue-950/70 text-blue-700 dark:text-blue-300 border border-blue-200/60 dark:border-blue-800/40">
                                self
                              </span>
                            ) : stu.admin ? (
                              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[11px] font-bold bg-purple-50 dark:bg-purple-950/70 text-purple-700 dark:text-purple-300 border border-purple-200/60 dark:border-purple-800/40">
                                {stu.admin}
                              </span>
                            ) : (
                              <span className="text-gray-400 text-xs">-</span>
                            )}
                          </td>

                          {/* Payment Details */}
                          <td className="p-3.5">
                            {stu.isPaid ? (
                              <div className="space-y-0.5">
                                <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-emerald-100 dark:bg-emerald-950/80 text-emerald-800 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800/60">
                                  <CheckCircle2 size={11} />
                                  <span>Paid: Rs. {stu.totalPaid.toLocaleString()}</span>
                                </span>
                                {stu.latestPayment && (
                                  <div className="text-[10px] text-gray-500 dark:text-gray-400 capitalize truncate max-w-[150px]">
                                    {stu.latestPayment.class_type || stu.latestPayment.package_type || stu.latestPayment.type}
                                  </div>
                                )}
                              </div>
                            ) : (
                              <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-amber-100 dark:bg-amber-950/80 text-amber-800 dark:text-amber-300 border border-amber-200 dark:border-amber-800/60">
                                <AlertCircle size={11} />
                                <span>Unpaid</span>
                              </span>
                            )}
                          </td>

                          {/* Register Date */}
                          <td className="p-3.5 text-gray-600 dark:text-gray-400 text-xs whitespace-nowrap">
                            <div className="flex items-center gap-1.5 font-medium">
                              <Calendar size={12} className="text-gray-400" />
                              <span>{stu.created_at ? stu.created_at.split('T')[0] : 'N/A'}</span>
                            </div>
                          </td>

                          {/* Details Button */}
                          <td className="p-3.5 text-right" onClick={(e) => e.stopPropagation()}>
                            <button
                              type="button"
                              onClick={() => setViewingStudent(stu)}
                              className="px-3 py-1 text-xs font-bold text-teal-600 dark:text-teal-400 bg-teal-50 dark:bg-teal-950/50 hover:bg-teal-100 dark:hover:bg-teal-900/60 rounded-lg transition-colors border border-teal-200/60 dark:border-teal-800/60 cursor-pointer shadow-2xs"
                            >
                              Details
                            </button>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              )}
            </div>

            {/* Table Footer */}
            <div className="p-3.5 bg-gray-50/50 dark:bg-gray-800/40 border-t border-gray-200 dark:border-gray-800 flex items-center justify-between text-xs text-gray-500 dark:text-gray-400">
              <div>
                Showing <strong>{filteredStudents.length}</strong> of <strong>{students.length}</strong> students
              </div>
              <div>
                Selected: <strong className="text-teal-600 dark:text-teal-400">{selectedCount}</strong>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* ============================================================ */}
      {/* MODAL 1: Zoom Registration Live Results Modal                */}
      {/* ============================================================ */}
      {showWebinarResultsModal && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-2xl w-full max-w-3xl max-h-[90vh] flex flex-col shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-200">
            
            {/* Modal Header */}
            <div className="p-4 border-b border-gray-200 dark:border-gray-800 flex items-center justify-between bg-gray-50 dark:bg-gray-800/60">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-lg bg-blue-100 dark:bg-blue-950 text-blue-600 dark:text-blue-300 flex items-center justify-center">
                  <Video size={18} />
                </div>
                <div>
                  <h3 className="text-base font-black text-gray-900 dark:text-gray-100">
                    Zoom Webinar Registration Results
                  </h3>
                  <p className="text-xs text-gray-500 dark:text-gray-400">
                    Webinar ID: <strong className="font-mono text-blue-600 dark:text-blue-400">{webinarId}</strong>
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-2">
                {webinarResults.length > 0 && !isRegisteringWebinar && (
                  <button
                    type="button"
                    onClick={handleExportZoomCsv}
                    className="px-3 py-1.5 rounded-xl bg-gray-100 hover:bg-gray-200 dark:bg-gray-800 dark:hover:bg-gray-700 text-xs font-bold text-gray-700 dark:text-gray-300 flex items-center gap-1.5 transition-colors cursor-pointer"
                  >
                    <Download size={14} />
                    <span>Download CSV</span>
                  </button>
                )}
                <button
                  type="button"
                  onClick={() => setShowWebinarResultsModal(false)}
                  className="p-1.5 text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 rounded-lg"
                >
                  <X size={18} />
                </button>
              </div>
            </div>

            {/* Modal Body / Progress & List */}
            <div className="p-4 space-y-4 overflow-y-auto flex-1">
              
              {/* Progress indicator */}
              {isRegisteringWebinar && (
                <div className="p-4 rounded-xl bg-blue-50 dark:bg-blue-950/40 border border-blue-100 dark:border-blue-900/40 space-y-2">
                  <div className="flex items-center justify-between text-xs font-bold text-blue-900 dark:text-blue-200">
                    <span className="flex items-center gap-2">
                      <RefreshCw size={14} className="animate-spin text-blue-600" />
                      Registering students with Zoom API...
                    </span>
                    <span>{webinarProgress.done} / {webinarProgress.total}</span>
                  </div>
                  <div className="w-full h-2 bg-blue-200/60 dark:bg-blue-900/60 rounded-full overflow-hidden">
                    <div 
                      className="h-full bg-blue-600 transition-all duration-300 rounded-full"
                      style={{ width: `${(webinarProgress.done / (webinarProgress.total || 1)) * 100}%` }}
                    />
                  </div>
                </div>
              )}

              {/* Summary Stats */}
              {webinarResults.length > 0 && (
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                  <div className="p-3 bg-gray-50 dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700">
                    <p className="text-[10px] font-bold text-gray-500 uppercase">Total Processed</p>
                    <p className="text-lg font-black text-gray-900 dark:text-gray-100">{webinarResults.length}</p>
                  </div>
                  <div className="p-3 bg-emerald-50 dark:bg-emerald-950/40 rounded-xl border border-emerald-200 dark:border-emerald-900/40">
                    <p className="text-[10px] font-bold text-emerald-700 uppercase">Successful</p>
                    <p className="text-lg font-black text-emerald-700 dark:text-emerald-400">
                      {webinarResults.filter(r => r.status === 'Success').length}
                    </p>
                  </div>
                  <div className="p-3 bg-rose-50 dark:bg-rose-950/40 rounded-xl border border-rose-200 dark:border-rose-900/40">
                    <p className="text-[10px] font-bold text-rose-700 uppercase">Failed</p>
                    <p className="text-lg font-black text-rose-700 dark:text-rose-400">
                      {webinarResults.filter(r => r.status === 'Failed').length}
                    </p>
                  </div>
                </div>
              )}

              {/* Table of results */}
              <div className="border border-gray-200 dark:border-gray-800 rounded-xl overflow-hidden">
                <table className="w-full text-left text-xs">
                  <thead className="bg-gray-50 dark:bg-gray-800 text-gray-500 dark:text-gray-400 text-[10px] font-bold uppercase">
                    <tr>
                      <th className="p-2.5">PCA ID</th>
                      <th className="p-2.5">Student Name</th>
                      <th className="p-2.5">Status</th>
                      <th className="p-2.5">Join Link / Error</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
                    {webinarResults.map((r, idx) => (
                      <tr key={idx} className="hover:bg-gray-50/50 dark:hover:bg-gray-800/30">
                        <td className="p-2.5 font-mono font-bold text-teal-700 dark:text-teal-400">
                          {r.pcaid}
                        </td>
                        <td className="p-2.5 font-semibold text-gray-900 dark:text-gray-100">
                          {r.name}
                        </td>
                        <td className="p-2.5">
                          {r.status === 'Success' ? (
                            <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-100 dark:bg-emerald-950 text-emerald-800 dark:text-emerald-300">
                              Success
                            </span>
                          ) : (
                            <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-rose-100 dark:bg-rose-950 text-rose-800 dark:text-rose-300">
                              Failed
                            </span>
                          )}
                        </td>
                        <td className="p-2.5">
                          {r.joinUrl ? (
                            <div className="flex items-center gap-1.5 max-w-xs">
                              <span className="truncate text-blue-600 dark:text-blue-400 text-[11px] font-mono">
                                {r.joinUrl}
                              </span>
                              <button
                                type="button"
                                onClick={() => copyToClipboard(r.joinUrl!, 'Join URL')}
                                className="p-1 text-gray-400 hover:text-blue-600"
                                title="Copy Link"
                              >
                                <Copy size={12} />
                              </button>
                            </div>
                          ) : (
                            <span className="text-rose-600 dark:text-rose-400 text-[11px]">
                              {r.error || 'Registration failed'}
                            </span>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Modal Footer */}
            <div className="p-3 bg-gray-50 dark:bg-gray-800 border-t border-gray-200 dark:border-gray-800 flex justify-end">
              <button
                type="button"
                onClick={() => setShowWebinarResultsModal(false)}
                className="px-4 py-2 bg-gray-900 hover:bg-gray-800 dark:bg-gray-100 dark:hover:bg-white text-white dark:text-gray-900 rounded-xl text-xs font-bold transition-all cursor-pointer"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ============================================================ */}
      {/* MODAL 2: Student Details & Payments Modal                    */}
      {/* ============================================================ */}
      {viewingStudent && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-2xl w-full max-w-2xl max-h-[90vh] flex flex-col shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-200">
            
            {/* Modal Header */}
            <div className="p-4 border-b border-gray-200 dark:border-gray-800 flex items-center justify-between bg-gray-50 dark:bg-gray-800/60">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-xl bg-teal-100 dark:bg-teal-950 text-teal-700 dark:text-teal-300 flex items-center justify-center font-bold">
                  <User size={18} />
                </div>
                <div>
                  <h3 className="text-base font-black text-gray-900 dark:text-gray-100">
                    {viewingStudent.name}
                  </h3>
                  <p className="text-xs font-mono font-bold text-teal-700 dark:text-teal-400">
                    {viewingStudent.pcaid}
                  </p>
                </div>
              </div>

              <button
                type="button"
                onClick={() => setViewingStudent(null)}
                className="p-1.5 text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 rounded-lg"
              >
                <X size={18} />
              </button>
            </div>

            {/* Modal Body */}
            <div className="p-5 space-y-5 overflow-y-auto flex-1 text-xs">
              
              {/* Profile Details Grid */}
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 p-3.5 bg-gray-50 dark:bg-gray-800/50 rounded-xl border border-gray-100 dark:border-gray-800">
                <div>
                  <span className="text-[10px] font-bold text-gray-400 uppercase">Phone</span>
                  <p className="font-semibold text-gray-900 dark:text-gray-100">{viewingStudent.phone || 'N/A'}</p>
                </div>
                <div>
                  <span className="text-[10px] font-bold text-gray-400 uppercase">Email</span>
                  <p className="font-semibold text-gray-900 dark:text-gray-100 truncate" title={viewingStudent.mail || ''}>{viewingStudent.mail || 'N/A'}</p>
                </div>
                <div>
                  <span className="text-[10px] font-bold text-gray-400 uppercase">NIC</span>
                  <p className="font-semibold text-gray-900 dark:text-gray-100 font-mono">{viewingStudent.nic || 'N/A'}</p>
                </div>
                <div>
                  <span className="text-[10px] font-bold text-gray-400 uppercase">Proper Batch</span>
                  <p className="font-semibold text-gray-900 dark:text-gray-100">{viewingStudent.proper_batch || 'N/A'}</p>
                </div>
                <div>
                  <span className="text-[10px] font-bold text-gray-400 uppercase">Joined Batch</span>
                  <p className="font-semibold text-gray-900 dark:text-gray-100">{viewingStudent.joined_batch || 'N/A'}</p>
                </div>
                <div>
                  <span className="text-[10px] font-bold text-gray-400 uppercase">District</span>
                  <p className="font-semibold text-gray-900 dark:text-gray-100">{viewingStudent.district || 'N/A'}</p>
                </div>
                <div>
                  <span className="text-[10px] font-bold text-gray-400 uppercase">Registered By</span>
                  <p className="font-semibold text-gray-900 dark:text-gray-100 capitalize">
                    {viewingStudent.admin || 'N/A'}
                  </p>
                </div>
                {viewingStudent.school && (
                  <div className="col-span-2 sm:col-span-3">
                    <span className="text-[10px] font-bold text-gray-400 uppercase">School</span>
                    <p className="font-semibold text-gray-900 dark:text-gray-100">{viewingStudent.school}</p>
                  </div>
                )}
                {viewingStudent.address && (
                  <div className="col-span-2 sm:col-span-3">
                    <span className="text-[10px] font-bold text-gray-400 uppercase">Address</span>
                    <p className="font-semibold text-gray-900 dark:text-gray-100">{viewingStudent.address}</p>
                  </div>
                )}
              </div>

              {/* Payment Records Section */}
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <h4 className="text-xs font-black text-gray-900 dark:text-gray-100 flex items-center gap-1.5">
                    <CreditCard size={14} className="text-teal-600" />
                    <span>Payment History ({viewingStudent.payments.length})</span>
                  </h4>
                  <span className="font-black text-xs text-teal-700 dark:text-teal-400">
                    Total Paid: Rs. {viewingStudent.totalPaid.toLocaleString()}
                  </span>
                </div>

                {viewingStudent.payments.length === 0 ? (
                  <div className="p-6 text-center text-gray-400 bg-gray-50 dark:bg-gray-800/40 rounded-xl border border-dashed border-gray-200 dark:border-gray-700">
                    No payment records found for this student yet.
                  </div>
                ) : (
                  <div className="border border-gray-200 dark:border-gray-800 rounded-xl overflow-hidden">
                    <table className="w-full text-left text-xs">
                      <thead className="bg-gray-50 dark:bg-gray-800 text-gray-500 dark:text-gray-400 text-[10px] font-bold uppercase">
                        <tr>
                          <th className="p-2.5">Type / Item</th>
                          <th className="p-2.5">Total Fee</th>
                          <th className="p-2.5">Paid Date</th>
                          <th className="p-2.5">Duration & Expiry</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
                        {viewingStudent.payments.map((p) => (
                          <tr key={p.id} className="hover:bg-gray-50/50 dark:hover:bg-gray-800/30">
                            <td className="p-2.5">
                              <span className="font-bold text-gray-900 dark:text-gray-100 capitalize">
                                {p.class_type || p.package_type || p.type}
                              </span>
                              <span className="block text-[10px] text-gray-400 uppercase">{p.type}</span>
                            </td>
                            <td className="p-2.5 font-mono font-bold text-teal-700 dark:text-teal-400">
                              Rs. {p.payment?.toLocaleString()}
                            </td>
                            <td className="p-2.5 text-gray-500">
                              {p.paid_date || 'N/A'}
                            </td>
                            <td className="p-2.5">
                              <span className="text-gray-700 dark:text-gray-300 font-semibold capitalize">{p.duration || '1 month'}</span>
                              <span className="block text-[10px] text-gray-400">Expires: {p.expired_date || 'N/A'}</span>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            </div>

            {/* Modal Footer */}
            <div className="p-3 bg-gray-50 dark:bg-gray-800 border-t border-gray-200 dark:border-gray-800 flex justify-end">
              <button
                type="button"
                onClick={() => setViewingStudent(null)}
                className="px-4 py-2 bg-gray-900 hover:bg-gray-800 dark:bg-gray-100 dark:hover:bg-white text-white dark:text-gray-900 rounded-xl text-xs font-bold transition-all cursor-pointer"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ============================================================ */}
      {/* MODAL 3: Payment Confirmation Modal                          */}
      {/* ============================================================ */}
      {showPaymentConfirmModal && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-2xl w-full max-w-lg shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-200">
            
            {/* Modal Header */}
            <div className="p-4 border-b border-gray-200 dark:border-gray-800 flex items-center justify-between bg-teal-50/50 dark:bg-teal-950/30">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-xl bg-teal-100 dark:bg-teal-900 text-teal-700 dark:text-teal-300 flex items-center justify-center font-bold">
                  <CreditCard size={18} />
                </div>
                <div>
                  <h3 className="text-base font-black text-gray-900 dark:text-gray-100">
                    Confirm Bulk Payment
                  </h3>
                  <p className="text-xs text-gray-500 dark:text-gray-400">
                    Record payment for {selectedStudents.length} selected student(s)
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setShowPaymentConfirmModal(false)}
                className="p-1.5 text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 rounded-lg cursor-pointer"
              >
                <X size={18} />
              </button>
            </div>

            {/* Modal Body */}
            <div className="p-5 space-y-4 text-xs">
              <div className="grid grid-cols-2 gap-3 p-3.5 bg-gray-50 dark:bg-gray-800/60 rounded-xl border border-gray-200 dark:border-gray-700">
                <div>
                  <span className="text-[10px] font-bold text-gray-400 uppercase">Item Type</span>
                  <p className="font-bold text-gray-900 dark:text-gray-100">
                    {paymentType === 'class' ? (paymentMonth ? `${paymentClassType} ${paymentMonth}` : paymentClassType) : paymentPackageType}
                  </p>
                </div>
                <div>
                  <span className="text-[10px] font-bold text-gray-400 uppercase">Paid Amount / Total</span>
                  <p className="font-mono font-black text-teal-600 dark:text-teal-400">
                    Rs. {Number(paymentPaidAmount).toLocaleString()} <span className="text-gray-400 font-normal">/ Rs. {Number(paymentTotalFee).toLocaleString()}</span>
                  </p>
                </div>
                <div>
                  <span className="text-[10px] font-bold text-gray-400 uppercase">Paid Date</span>
                  <p className="font-medium text-gray-700 dark:text-gray-300">{paymentPaidDate}</p>
                </div>
                <div>
                  <span className="text-[10px] font-bold text-gray-400 uppercase">Expiry Date</span>
                  <p className="font-medium text-gray-700 dark:text-gray-300">{calculatedPaymentExpiry}</p>
                </div>
              </div>

              {/* Selected Students Preview */}
              <div className="space-y-1.5">
                <span className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">
                  Target Students ({selectedStudents.length})
                </span>
                <div className="max-h-36 overflow-y-auto border border-gray-200 dark:border-gray-700 rounded-xl divide-y divide-gray-100 dark:divide-gray-800">
                  {selectedStudents.map(s => (
                    <div key={s.pcaid} className="p-2 flex items-center justify-between hover:bg-gray-50 dark:hover:bg-gray-800/40">
                      <div>
                        <span className="font-bold text-gray-900 dark:text-gray-100">{s.name}</span>
                        <span className="block font-mono text-[10px] text-teal-600 dark:text-teal-400">{s.pcaid}</span>
                      </div>
                      <span className="text-[10px] font-medium text-gray-400">{s.phone || 'No phone'}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            {/* Modal Footer */}
            <div className="p-4 bg-gray-50 dark:bg-gray-800 border-t border-gray-200 dark:border-gray-800 flex items-center justify-end gap-2.5">
              <button
                type="button"
                onClick={() => setShowPaymentConfirmModal(false)}
                className="px-4 py-2 bg-gray-100 hover:bg-gray-200 dark:bg-gray-700 dark:hover:bg-gray-600 text-gray-700 dark:text-gray-200 rounded-xl text-xs font-bold transition-all cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={executePaymentBulk}
                disabled={isSubmittingPayment}
                className="px-5 py-2 bg-teal-600 hover:bg-teal-700 text-white rounded-xl text-xs font-bold transition-all shadow-sm flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
              >
                {isSubmittingPayment ? (
                  <>
                    <RefreshCw size={14} className="animate-spin" />
                    <span>Processing...</span>
                  </>
                ) : (
                  <>
                    <Check size={14} />
                    <span>Confirm & Apply Payment</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ============================================================ */}
      {/* MODAL 4: Payment Results (Success & Error Details) Pop-up     */}
      {/* ============================================================ */}
      {showPaymentResultModal && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-2xl w-full max-w-2xl max-h-[90vh] flex flex-col shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-200">
            
            {/* Modal Header */}
            <div className={`p-4 border-b border-gray-200 dark:border-gray-800 flex items-center justify-between ${
              paymentResults.some(r => r.status === 'Failed') && paymentResults.some(r => r.status === 'Success')
                ? 'bg-amber-50 dark:bg-amber-950/30'
                : paymentResults.every(r => r.status === 'Success')
                ? 'bg-emerald-50 dark:bg-emerald-950/30'
                : 'bg-rose-50 dark:bg-rose-950/30'
            }`}>
              <div className="flex items-center gap-2.5">
                <div className={`w-9 h-9 rounded-xl flex items-center justify-center font-bold ${
                  paymentResults.some(r => r.status === 'Failed') && paymentResults.some(r => r.status === 'Success')
                    ? 'bg-amber-100 dark:bg-amber-900 text-amber-700 dark:text-amber-300'
                    : paymentResults.every(r => r.status === 'Success')
                    ? 'bg-emerald-100 dark:bg-emerald-900 text-emerald-700 dark:text-emerald-300'
                    : 'bg-rose-100 dark:bg-rose-900 text-rose-700 dark:text-rose-300'
                }`}>
                  {paymentResults.every(r => r.status === 'Success') ? (
                    <CheckCircle2 size={20} />
                  ) : paymentResults.some(r => r.status === 'Success') ? (
                    <AlertCircle size={20} />
                  ) : (
                    <X size={20} />
                  )}
                </div>
                <div>
                  <h3 className="text-base font-black text-gray-900 dark:text-gray-100">
                    Payment Processing Summary
                  </h3>
                  <p className="text-xs text-gray-500 dark:text-gray-400">
                    {paymentResults.filter(r => r.status === 'Success').length} of {paymentResults.length} payment records processed successfully
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setShowPaymentResultModal(false)}
                className="p-1.5 text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 rounded-lg cursor-pointer"
              >
                <X size={18} />
              </button>
            </div>

            {/* Modal Body */}
            <div className="p-5 space-y-4 overflow-y-auto flex-1 text-xs">
              {/* Summary Metric Cards */}
              <div className="grid grid-cols-3 gap-3">
                <div className="p-3 bg-gray-50 dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700">
                  <p className="text-[10px] font-bold text-gray-400 uppercase">Total Selected</p>
                  <p className="text-lg font-black text-gray-900 dark:text-gray-100">{paymentResults.length}</p>
                </div>
                <div className="p-3 bg-emerald-50 dark:bg-emerald-950/40 rounded-xl border border-emerald-200 dark:border-emerald-900/40">
                  <p className="text-[10px] font-bold text-emerald-700 uppercase">Successful</p>
                  <p className="text-lg font-black text-emerald-700 dark:text-emerald-400">
                    {paymentResults.filter(r => r.status === 'Success').length}
                  </p>
                </div>
                <div className="p-3 bg-rose-50 dark:bg-rose-950/40 rounded-xl border border-rose-200 dark:border-rose-900/40">
                  <p className="text-[10px] font-bold text-rose-700 uppercase">Failed</p>
                  <p className="text-lg font-black text-rose-700 dark:text-rose-400">
                    {paymentResults.filter(r => r.status === 'Failed').length}
                  </p>
                </div>
              </div>

              {/* Table of per-student results */}
              <div className="border border-gray-200 dark:border-gray-800 rounded-xl overflow-hidden">
                <table className="w-full text-left text-xs">
                  <thead className="bg-gray-50 dark:bg-gray-800 text-gray-500 dark:text-gray-400 text-[10px] font-bold uppercase">
                    <tr>
                      <th className="p-2.5">PCA ID</th>
                      <th className="p-2.5">Student Name</th>
                      <th className="p-2.5">Status</th>
                      <th className="p-2.5">Item & Details</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
                    {paymentResults.map((r, idx) => (
                      <tr key={idx} className="hover:bg-gray-50/50 dark:hover:bg-gray-800/30">
                        <td className="p-2.5 font-mono font-bold text-teal-700 dark:text-teal-400">
                          {r.pcaid}
                        </td>
                        <td className="p-2.5 font-semibold text-gray-900 dark:text-gray-100">
                          {r.name}
                        </td>
                        <td className="p-2.5">
                          {r.status === 'Success' ? (
                            <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-100 dark:bg-emerald-950 text-emerald-800 dark:text-emerald-300 flex items-center gap-1 w-fit">
                              <CheckCircle2 size={11} />
                              Success
                            </span>
                          ) : (
                            <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-rose-100 dark:bg-rose-950 text-rose-800 dark:text-rose-300 flex items-center gap-1 w-fit">
                              <AlertCircle size={11} />
                              Failed
                            </span>
                          )}
                        </td>
                        <td className="p-2.5">
                          <span className={r.status === 'Success' ? 'text-gray-700 dark:text-gray-300' : 'text-rose-600 dark:text-rose-400 font-medium'}>
                            {r.message}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Modal Footer */}
            <div className="p-4 bg-gray-50 dark:bg-gray-800 border-t border-gray-200 dark:border-gray-800 flex items-center justify-between">
              <span className="text-xs text-gray-500 dark:text-gray-400">
                Selected students remain active for Zoom Webinar registration.
              </span>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setShowPaymentResultModal(false)}
                  className="px-4 py-2 bg-gray-900 hover:bg-gray-800 dark:bg-gray-100 dark:hover:bg-white text-white dark:text-gray-900 rounded-xl text-xs font-bold transition-all cursor-pointer"
                >
                  Close
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

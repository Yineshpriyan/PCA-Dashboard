import React, { useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';
import { toast } from 'sonner';
import { 
  Plus, 
  Minus,
  Save, 
  Trash2, 
  Edit, 
  Copy, 
  RefreshCw,
  CheckCircle2,
  Calendar,
  CreditCard,
  User as UserIcon,
  X,
  Search,
  FileDown,
  ExternalLink,
  ChevronDown,
  Check,
  Eye,
  ShieldCheck,
  ShieldAlert,
  AlertTriangle,
  MessageCircle
} from 'lucide-react';
import { 
  Student, 
  Payment, 
  ClassItem, 
  PackageItem, 
  JoinedBatchItem,
  SRI_LANKAN_DISTRICTS 
} from '../types';
import { cn, copyToClipboard, formatDate, exportToExcel } from '../lib/utils';
import { useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';
import { logTransaction } from '../lib/transactions';

const DISTRICT_NUMBERS: Record<string, string> = {
  'Colombo': '01',
  'Gampaha': '02',
  'Kalutara': '03',
  'Kandy': '04',
  'Matale': '05',
  'Nuwara Eliya': '06',
  'Galle': '07',
  'Matara': '08',
  'Matara ': '08',
  'Hambantota': '09',
  'Jaffna': '10',
  'Kilinochchi': '11',
  'Mannar': '12',
  'Vavuniya': '13',
  'Mullaitivu': '14',
  'Batticaloa': '15',
  'Ampara': '16',
  'Trincomalee': '17',
  'Kurunegala': '18',
  'Puttalam': '19',
  'Anuradhapura': '20',
  'Polonnaruwa': '21',
  'Badulla': '22',
  'Moneragala': '23',
  'Monaragala': '23',
  'Ratnapura': '24',
  'Kegalle': '25'
};

const DURATIONS = [
  { label: '0', value: 0 },
  { label: '1 week', value: 7 },
  { label: '2 weeks', value: 14 },
  { label: '1 month', value: 30 },
  { label: '3 months', value: 90 },
  { label: '6 months', value: 180 },
  { label: '1 year', value: 365 }
];

const calculateExpiry = (activationDate: string, durationLabel: string) => {
  const date = new Date(activationDate);
  const found = DURATIONS.find(d => d.label === durationLabel);
  const duration = found !== undefined ? found.value : 30;
  date.setDate(date.getDate() + duration);
  return date.toISOString().split('T')[0];
};

const mapDbPaymentToUI = (p: any): Payment => {
  const installments = (p.installment || p.installments || []).filter((inst: any) => !inst.deleted_at);
  if (installments.length > 0) {
    const totalPaid = installments.reduce((sum: number, inst: any) => sum + Number(inst.paid_amount || 0), 0);
    const sorted = [...installments].sort((a, b) => new Date(a.paid_date).getTime() - new Date(b.paid_date).getTime());
    const latest = sorted[sorted.length - 1] || installments[0];

    // Find the latest billing/payment installment (where paid_amount is positive/non-refund)
    // to determine the subscription duration, activation, and expiration.
    const billingInstallments = sorted.filter((inst: any) => Number(inst.paid_amount) >= 0);
    const latestBilling = billingInstallments[billingInstallments.length - 1] || latest;

    return {
      id: p.id,
      pcaid: p.pcaid,
      type: p.type,
      class_type: p.class_type,
      package_type: p.package_type,
      payment: totalPaid,
      total_amount: p.payment, // DB billing payment table column 'payment' is Total Fee amount
      paid_date: latestBilling.paid_date,
      activation_date: latestBilling.activation_date,
      duration: latestBilling.duration || p.duration || '1 month',
      expired_date: latestBilling.expired_date,
      installments: sorted
    };
  }

  return {
    id: p.id,
    pcaid: p.pcaid,
    type: p.type,
    class_type: p.class_type,
    package_type: p.package_type,
    payment: p.payment || 0,
    total_amount: p.total_amount !== undefined ? p.total_amount : p.payment,
    paid_date: p.paid_date || new Date().toISOString().split('T')[0],
    activation_date: p.activation_date || new Date().toISOString().split('T')[0],
    duration: p.duration || '1 month',
    expired_date: p.expired_date || new Date().toISOString().split('T')[0],
    installments: []
  };
};

const MONTHS = [
  "January", "February", "March", "April", "May", "June", 
  "July", "August", "September", "October", "November", "December"
];

interface StudentFormProps {
  key?: string;
  isModal?: boolean;
  modalStudent?: Student | null;
  modalLead?: any | null;
  onClose?: (shouldRefresh?: boolean) => void;
}

export function StudentForm({ isModal = false, modalStudent = null, modalLead = null, onClose }: StudentFormProps = {}) {
  const { state } = useLocation();
  const navigate = useNavigate();
  const { user } = useAuth();
  const leadData = isModal ? modalLead : state?.lead;
  const editStudent = isModal ? modalStudent : state?.student;

  const [loading, setLoading] = useState(false);
  const [initialPhone] = useState(editStudent?.phone || leadData?.phone || '');
  const [classTypes, setClassTypes] = useState<ClassItem[]>([]);
  const [packageTypes, setPackageTypes] = useState<PackageItem[]>([]);
  const [joinedBatches, setJoinedBatches] = useState<JoinedBatchItem[]>([]);
  const [selectedClass, setSelectedClass] = useState('');
  const [selectedMonth, setSelectedMonth] = useState('');
  const [selectedPackage, setSelectedPackage] = useState('');
  const [paymentClassType, setPaymentClassType] = useState('');
  const [paymentMonth, setPaymentMonth] = useState('');

  // Compute clean, unique base class types (without monthly suffix) for the dropdown selection
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
  }))) as string[]).sort((a, b) => a.localeCompare(b));
  
  // Verification State
  const [verifyQuery, setVerifyQuery] = useState('');
  const [verificationStatus, setVerificationStatus] = useState<{
    exists: boolean;
    student?: Student;
    lookupDone: boolean;
  }>({ exists: false, lookupDone: false });

  // Student Data
  const [studentData, setStudentData] = useState(() => {
    const rawPhone = editStudent?.phone || leadData?.phone || '';
    const cleanPhone = rawPhone.replace(/\D/g, '').replace(/^0+/, '').slice(0, 9);
    return {
      pcaid: editStudent?.pcaid || leadData?.pcaid || '',
      name: editStudent?.name || leadData?.name || '',
      phone: cleanPhone,
      stream: editStudent?.stream || leadData?.stream || '',
      proper_batch: editStudent?.proper_batch || leadData?.proper_batch || '',
      joined_batch: editStudent?.joined_batch || leadData?.joined_batch || '',
      school: editStudent?.school || leadData?.school || '',
      district: editStudent?.district || leadData?.district || '',
      mail: editStudent?.mail || leadData?.mail || '',
      address: editStudent?.address || leadData?.address || '',
      asked_class_type: editStudent?.asked_class_type || leadData?.asked_class_type || '',
      asked_package_type: editStudent?.asked_package_type || leadData?.asked_package_type || '',
      batch_type: editStudent?.batch_type || leadData?.batch_type || '',
      gender: editStudent?.gender || leadData?.gender || ''
    };
  });

  // Temporary ID generator state & function
  const [isGeneratingTempId, setIsGeneratingTempId] = useState(false);
  const [latestGeneratedTempId, setLatestGeneratedTempId] = useState<string | null>(null);

  // Sequential PCA ID generator state & function
  const [isGeneratingPcaId, setIsGeneratingPcaId] = useState(false);
  const [latestGeneratedPcaId, setLatestGeneratedPcaId] = useState<string | null>(null);

  // Field Validation State
  const [phoneError, setPhoneError] = useState('');
  const [mailError, setMailError] = useState('');

  const handlePhoneBlur = (phoneVal: string) => {
    const cleanPhone = phoneVal.replace(/\D/g, '');
    if (!cleanPhone) {
      setPhoneError('');
    } else if (cleanPhone.length !== 9) {
      setPhoneError('Invalid Phone Number');
    } else {
      setPhoneError('');
    }
  };

  const handleMailBlur = (mailVal: string) => {
    if (!mailVal) {
      setMailError('');
      return;
    }
    const isInvalid = mailVal === '@gmail.com' || 
                      !mailVal.endsWith('@gmail.com') || 
                      mailVal.startsWith('@') ||
                      mailVal.split('@')[0].includes(' ') ||
                      mailVal.split('@')[0].includes('@');
    if (isInvalid) {
      setMailError('Invalid Gmail username');
    } else {
      setMailError('');
    }
  };

  const getInitialStudentType = (): 'Paid' | 'Scholarship' => {
    const pcaid = editStudent?.pcaid || leadData?.pcaid || '';
    if (pcaid && pcaid.length === 10) {
      const last3 = pcaid.slice(-3);
      const num = parseInt(last3, 10);
      if (!isNaN(num) && num >= 900 && num <= 999) {
        return 'Scholarship';
      }
    }
    return 'Paid';
  };

  const [studentType, setStudentType] = useState<'Paid' | 'Scholarship'>(getInitialStudentType);

  // Duplicate alert modal state
  const [showDuplicateAlert, setShowDuplicateAlert] = useState(false);
  const [existingStudentName, setExistingStudentName] = useState('');

  const handleGeneratePcaId = async () => {
    if (!studentData.stream) {
      toast.error('Please select a Stream first.');
      return;
    }
    if (!studentData.batch_type) {
      toast.error('Please select a Batch Type first.');
      return;
    }
    if (!studentData.gender) {
      toast.error('Please select Gender first.');
      return;
    }
    if (!studentData.joined_batch) {
      toast.error('Please select a Joined Batch first.');
      return;
    }
    if (!studentData.district) {
      toast.error('Please select a District first.');
      return;
    }

    setIsGeneratingPcaId(true);
    try {
      // 1st character - stream
      // Biological Science -> B
      // Physical Science -> P
      // Non Stream -> N
      let streamChar = 'B';
      if (studentData.stream === 'Physical Science') {
        streamChar = 'P';
      } else if (studentData.stream === 'Biological Science') {
        streamChar = 'B';
      } else {
        streamChar = 'N';
      }

      // 2nd character - batch type
      // Proper -> P
      // Repeat -> R
      let batchTypeChar = 'P';
      if (studentData.batch_type === 'Repeat') {
        batchTypeChar = 'R';
      } else {
        batchTypeChar = 'P';
      }

      // 3rd character - gender
      // Male -> M
      // Female -> F
      // Others -> O
      let genderChar = 'M';
      if (studentData.gender === 'Female') {
        genderChar = 'F';
      } else if (studentData.gender === 'Other' || studentData.gender === 'Others') {
        genderChar = 'O';
      } else {
        genderChar = 'M';
      }

      // 4th, 5th character - joined batch (pick last 02 digits)
      const yearStr = String(studentData.joined_batch).trim();
      const joinedBatchChar = yearStr.slice(-2);

      // 6th, 7th character - district number
      let districtCode = DISTRICT_NUMBERS[studentData.district] || studentData.district || '';
      const digitsOnly = districtCode.replace(/\D/g, '');
      if (digitsOnly) {
        districtCode = digitsOnly.padStart(2, '0');
      } else {
        districtCode = '00';
      }

      // 8th, 9th, 10th character - last ID
      let dbLastId = 0;
      if (studentType === 'Scholarship') {
        dbLastId = 899; // Defaults to starting from 900
      }

      const { data, error } = await supabase
        .from('last_pca_id')
        .select('last_id, last_scholarship_id')
        .eq('joined_batch', studentData.joined_batch)
        .eq('district_code', districtCode)
        .maybeSingle();

      if (error) {
        console.error('Error fetching sequential PCA ID from DB:', error);
      } else if (data) {
        if (studentType === 'Scholarship') {
          if ('last_scholarship_id' in data && typeof data.last_scholarship_id === 'number') {
            dbLastId = data.last_scholarship_id;
          } else {
            // Fallback to old _sch district_code if column is missing/undefined in returned data
            const { data: oldSchData } = await supabase
              .from('last_pca_id')
              .select('last_id')
              .eq('joined_batch', studentData.joined_batch)
              .eq('district_code', districtCode + '_sch')
              .maybeSingle();
            if (oldSchData && typeof oldSchData.last_id === 'number') {
              dbLastId = oldSchData.last_id;
            }
          }
        } else {
          if (typeof data.last_id === 'number') {
            dbLastId = data.last_id;
          }
        }
      } else if (studentType === 'Scholarship') {
        // Fallback to old _sch district_code if main row not found and is scholarship
        const { data: oldSchData } = await supabase
          .from('last_pca_id')
          .select('last_id')
          .eq('joined_batch', studentData.joined_batch)
          .eq('district_code', districtCode + '_sch')
          .maybeSingle();
        if (oldSchData && typeof oldSchData.last_id === 'number') {
          dbLastId = oldSchData.last_id;
        }
      }

      const nextId = dbLastId + 1;

      // Limit checking based on student type
      if (studentType === 'Paid' && nextId > 899) {
        toast.error('IDs are full (Maximum of 899 Paid student IDs reached)');
        setIsGeneratingPcaId(false);
        return;
      }
      if (studentType === 'Scholarship' && nextId > 999) {
        toast.error('IDs are full (Maximum of 999 Scholarship student IDs reached)');
        setIsGeneratingPcaId(false);
        return;
      }

      let lastIdStr = '';
      if (String(nextId).length === 2) {
        lastIdStr = '0' + nextId;
      } else if (String(nextId).length === 1) {
        lastIdStr = '00' + nextId;
      } else {
        lastIdStr = String(nextId);
      }
      
      lastIdStr = lastIdStr.padStart(3, '0').slice(-3);

      const computedPcaId = `${streamChar}${batchTypeChar}${genderChar}${joinedBatchChar}${districtCode}${lastIdStr}`;

      setLatestGeneratedPcaId(computedPcaId);
      setStudentData(prev => ({ ...prev, pcaid: computedPcaId }));
      toast.success(`Generated sequential PCA ID: ${computedPcaId}`);
    } catch (err: any) {
      console.error('Failed to generate PCA ID:', err);
      toast.error(`Failed to generate PCA ID: ${err.message || 'Unknown error'}`);
    } finally {
      setIsGeneratingPcaId(false);
    }
  };

  const handleGenerateTempId = async () => {
    setIsGeneratingTempId(true);
    try {
      // 1. Fetch the last temporary id record from `last_temporary_id` table
      let { data, error } = await supabase
        .from('last_temporary_id')
        .select('temp_id')
        .eq('id', 1)
        .maybeSingle();

      if (error) {
        throw error;
      }

      let tempVal = 'Temp000';
      if (data && data.temp_id) {
        tempVal = data.temp_id;
      }

      // 2. Parse the prefix and the suffix digits
      const match = tempVal.match(/^([a-zA-Z\-_/]+)(\d+)$/);
      let prefix = 'Temp';
      let digitStr = '000';

      if (match) {
        prefix = match[1];
        digitStr = match[2];
      } else {
        const digitMatch = tempVal.match(/(\d+)$/);
        if (digitMatch) {
          digitStr = digitMatch[1];
          prefix = tempVal.substring(0, tempVal.length - digitStr.length);
        }
      }

      // Increment the numeric portion, keeping original zero-padded length
      const nextNum = parseInt(digitStr, 10) + 1;
      const nextNumStr = String(nextNum).padStart(digitStr.length || 3, '0');
      const newTempId = `${prefix}${nextNumStr}`;

      // Track the newly generated ID locally
      setLatestGeneratedTempId(newTempId);

      // Set the newly generated temporary ID in the PCAID textbox of the form
      setStudentData(prev => ({ ...prev, pcaid: newTempId }));
      toast.success(`Generated temporary ID: ${newTempId}`);
    } catch (err: any) {
      console.error(err);
      toast.error(`Failed to generate temporary ID: ${err.message || 'Unknown error'}`);
    } finally {
      setIsGeneratingTempId(false);
    }
  };

  // Payment UI State (Temporary)
  const [tempPayments, setTempPayments] = useState<Partial<Payment>[]>([]);
  const [existingPaymentIds, setExistingPaymentIds] = useState<Set<string>>(new Set());
  const [expandedFormPayments, setExpandedFormPayments] = useState<Record<string, boolean>>({});
  const [newFormInstAmount, setNewFormInstAmount] = useState<string>('');
  const [newFormInstPaidDate, setNewFormInstPaidDate] = useState<string>(new Date().toISOString().split('T')[0]);
  const [newFormInstActDate, setNewFormInstActDate] = useState<string>(new Date().toISOString().split('T')[0]);
  const [newFormInstDuration, setNewFormInstDuration] = useState<string>('1 month');
  const [newFormInstType, setNewFormInstType] = useState<'billing' | 'refund'>('billing');
  const [newFormInstRefundReason, setNewFormInstRefundReason] = useState<string>('');
  const [deletingFormInstallmentId, setDeletingFormInstallmentId] = useState<string | null>(null);
  const [editingFormInstallmentId, setEditingFormInstallmentId] = useState<string | null>(null);
  const [editingFormInstallmentData, setEditingFormInstallmentData] = useState<any | null>(null);
  const [currentPayment, setCurrentPayment] = useState<Partial<Payment>>({
    type: 'class',
    payment: 0,
    paid_date: new Date().toISOString().split('T')[0],
    activation_date: new Date().toISOString().split('T')[0],
    duration: '1 month',
    total_amount: undefined
  });
  const [editingIndex, setEditingIndex] = useState<number | null>(null);
  const [deletedPaymentIds, setDeletedPaymentIds] = useState<string[]>([]);
  const [deletingTempPaymentIdx, setDeletingTempPaymentIdx] = useState<number | null>(null);

  useEffect(() => {
    fetchItems();
    if (leadData?.phone) {
      checkExistingStudent(leadData.phone);
    }
    if (editStudent?.pcaid) {
      fetchExistingPayments(editStudent.pcaid);
    }
  }, []);

  const fetchExistingPayments = async (pcaid: string) => {
    const { data } = await supabase
      .from('payment')
      .select('*, installment(*)')
      .eq('pcaid', pcaid)
      .is('deleted_at', null);
    
    if (data) {
      const mapped = data.map(mapDbPaymentToUI);
      mapped.sort((a, b) => new Date(b.paid_date).getTime() - new Date(a.paid_date).getTime());
      setTempPayments(mapped);
      setExistingPaymentIds(new Set(mapped.map(p => p.id)));
    }
  };

  // Real-time duplicate verification
  useEffect(() => {
    const timer = setTimeout(() => {
      if (verifyQuery.trim().length > 3) {
        verifyStudent();
      } else {
        setVerificationStatus({ exists: false, lookupDone: false });
      }
    }, 500);

    return () => clearTimeout(timer);
  }, [verifyQuery]);

  const verifyStudent = async () => {
    const query = verifyQuery.trim();
    if (!query) {
      setVerificationStatus({ exists: false, lookupDone: false });
      return;
    }

    // Check by PCA ID or Phone
    const { data } = await supabase
      .from('student')
      .select('*')
      .or(`pcaid.eq.${query.toUpperCase()},phone.eq.${query}`)
      .is('deleted_at', null)
      .maybeSingle();

    setVerificationStatus({
      exists: !!data,
      student: data as Student || undefined,
      lookupDone: true
    });
  };

  const handleGrabDetails = () => {
    if (verificationStatus.student) {
      const s = verificationStatus.student;
      setStudentData({
        pcaid: s.pcaid || '',
        name: s.name || '',
        phone: s.phone || '',
        stream: s.stream || '',
        proper_batch: s.proper_batch || '',
        joined_batch: s.joined_batch || '',
        school: s.school || '',
        district: s.district || '',
        mail: s.mail || '',
        address: s.address || '',
        asked_class_type: s.asked_class_type || '',
        asked_package_type: s.asked_package_type || '',
        batch_type: s.batch_type || '',
        gender: s.gender || ''
      });
      if (s.pcaid && s.pcaid.length === 10) {
        const last3 = s.pcaid.slice(-3);
        const num = parseInt(last3, 10);
        if (!isNaN(num) && num >= 900 && num <= 999) {
          setStudentType('Scholarship');
        } else {
          setStudentType('Paid');
        }
      } else {
        setStudentType('Paid');
      }
      toast.success('Details grabbed successfully!');
    }
  };

  const checkExistingStudent = async (phone: string) => {
    const { data } = await supabase
      .from('student')
      .select('pcaid')
      .eq('phone', phone)
      .is('deleted_at', null)
      .maybeSingle();
    
    if (data) {
      setStudentData(prev => ({ ...prev, pcaid: data.pcaid }));
      toast.info(`Existing Student found with ID: ${data.pcaid}`);
    }
  };

  const fetchItems = async () => {
    const { data: classes } = await supabase.from('class_item').select('*').order('class_type');
    const { data: packages } = await supabase.from('package_item').select('*').order('package_type');
    const { data: batches } = await supabase.from('joined_batch_item').select('*').order('joined_batch', { ascending: false });
    if (classes) setClassTypes(classes);
    if (packages) setPackageTypes(packages);
    if (batches) setJoinedBatches(batches);
  };
  const handleAddPayment = () => {
    let finalClassType = '';
    if (currentPayment.type === 'class') {
      if (!paymentClassType) {
        toast.error('Select a class type');
        return;
      }
      
      finalClassType = paymentMonth ? `${paymentClassType} ${paymentMonth}` : paymentClassType;
      currentPayment.class_type = finalClassType;
    } else {
      if (!currentPayment.package_type) {
        toast.error('Select a package type');
        return;
      }
    }

    const expiry = calculateExpiry(currentPayment.activation_date!, currentPayment.duration!);
    const newPayment = { ...currentPayment, expired_date: expiry };

    if (editingIndex !== null) {
      const updatedPayments = [...tempPayments];
      updatedPayments[editingIndex] = newPayment;
      setTempPayments(updatedPayments);
      setEditingIndex(null);
      toast.success('Payment updated');
    } else {
      const paymentWithId = { ...newPayment, id: Math.random().toString(36).substr(2, 9) };
      setTempPayments([...tempPayments, paymentWithId]);
      toast.success('Added to payment list');
    }
    
    // Reset current except dates maybe
    setCurrentPayment({
      ...currentPayment,
      class_type: '',
      package_type: '',
      payment: 0,
      total_amount: undefined
    });
    setPaymentClassType('');
    setPaymentMonth('');
  };

  const handleEditPayment = (index: number) => {
    const p = tempPayments[index];
    setCurrentPayment({ ...p });
    setEditingIndex(index);
    if (p.type === 'class' && p.class_type) {
      const match = MONTHS.find(m => p.class_type!.endsWith(` ${m}`) || p.class_type!.endsWith(` - ${m}`));
      if (match) {
        let idx = p.class_type.lastIndexOf(` - ${match}`);
        if (idx === -1) {
          idx = p.class_type.lastIndexOf(` ${match}`);
        }
        setPaymentClassType(p.class_type.substring(0, idx).trim());
        setPaymentMonth(match);
      } else {
        setPaymentClassType(p.class_type);
        setPaymentMonth('');
      }
    } else {
      setPaymentClassType('');
      setPaymentMonth('');
    }
    // Focus or scroll to the payment entry form if needed
    window.scrollTo({ top: document.getElementById('payment-entry-section')?.offsetTop || 0, behavior: 'smooth' });
  };

  const handleAddFormInstallment = async (pId: string | undefined, idx: number) => {
    const isRefund = newFormInstType === 'refund';
    let paidAmt = Number(newFormInstAmount);
    if (!newFormInstAmount || isNaN(paidAmt) || paidAmt <= 0) {
      toast.error(isRefund ? 'Please enter a valid refund amount greater than zero' : 'Please enter a valid paid amount greater than zero');
      return;
    }

    if (isRefund) {
      paidAmt = -paidAmt; // negate it
    }

    let durationVal = newFormInstDuration;
    if (isRefund) {
      if (!newFormInstRefundReason.trim()) {
        toast.error('Please enter a refund reason');
        return;
      }
      durationVal = newFormInstRefundReason.trim();
    }

    const expDate = isRefund ? newFormInstPaidDate : calculateExpiry(newFormInstActDate, newFormInstDuration);
    const actDate = isRefund ? newFormInstPaidDate : newFormInstActDate;
    const isExistingPayment = pId && existingPaymentIds.has(pId);

    if (isExistingPayment) {
      const installmentPayload = {
        payment_id: pId,
        paid_amount: paidAmt,
        paid_date: newFormInstPaidDate,
        activation_date: actDate,
        duration: isRefund ? null : durationVal,
        refund_reason: isRefund ? durationVal : null,
        expired_date: expDate
      };

      try {
        const { error: insertError } = await supabase
          .from('installment')
          .insert(installmentPayload);

        if (insertError) throw insertError;

        toast.success(isRefund ? 'Refund recorded successfully' : 'Installment added successfully');
        setNewFormInstAmount('');
        setNewFormInstRefundReason('');
        setNewFormInstType('billing');
        if (studentData.pcaid) {
          await fetchExistingPayments(studentData.pcaid);
        }
      } catch (err: any) {
        console.error(err);
        toast.error(err.message || (isRefund ? 'Failed to record refund' : 'Failed to add installment'));
      }
    } else {
      const newInst = {
        id: 'temp_inst_' + Math.random().toString(36).substr(2, 9),
        paid_amount: paidAmt,
        paid_date: newFormInstPaidDate,
        activation_date: actDate,
        duration: isRefund ? null : durationVal,
        refund_reason: isRefund ? durationVal : null,
        expired_date: expDate
      };

      const updated = [...tempPayments];
      const targetPayment = updated[idx];
      const updatedInstallments = [...(targetPayment.installments || []), newInst];
      const totalPaid = updatedInstallments.reduce((sum: number, inst: any) => sum + Number(inst.paid_amount || 0), 0);

      updated[idx] = {
        ...targetPayment,
        payment: totalPaid,
        installments: updatedInstallments
      };

      setTempPayments(updated);
      setNewFormInstAmount('');
      setNewFormInstRefundReason('');
      setNewFormInstType('billing');
      toast.success(isRefund ? 'Refund recorded locally' : 'Installment added locally');
    }
  };

  const handleDeleteFormInstallment = async (installmentId: string, pId: string | undefined, idx: number) => {
    const isExistingPayment = pId && existingPaymentIds.has(pId);
    const isRealInstallment = installmentId && !installmentId.startsWith('temp_inst_');

    if (isExistingPayment && isRealInstallment) {
      try {
        const { error } = await supabase
          .from('installment')
          .update({ deleted_at: new Date().toISOString() })
          .eq('id', installmentId);

        if (error) throw error;

        toast.success('Installment soft-deleted');
        setDeletingFormInstallmentId(null);
        if (studentData.pcaid) {
          await fetchExistingPayments(studentData.pcaid);
        }
      } catch (err: any) {
        console.error(err);
        toast.error(err.message || 'Failed to delete installment');
      }
    } else {
      const updated = [...tempPayments];
      const targetPayment = updated[idx];
      const updatedInstallments = (targetPayment.installments || []).filter((inst: any) => (inst.id || inst.paid_date) !== installmentId);
      const totalPaid = updatedInstallments.reduce((sum: number, inst: any) => sum + Number(inst.paid_amount || 0), 0);

      updated[idx] = {
        ...targetPayment,
        payment: totalPaid,
        installments: updatedInstallments
      };

      setTempPayments(updated);
      setDeletingFormInstallmentId(null);
      toast.success('Installment removed locally');
    }
  };

  const handleStartEditFormInstallment = (inst: any) => {
    setEditingFormInstallmentId(inst.id);
    setEditingFormInstallmentData({ 
      ...inst, 
      paid_amount: Math.abs(inst.paid_amount), 
      is_refund: inst.paid_amount < 0 
    });
  };

  const handleCancelEditFormInstallment = () => {
    setEditingFormInstallmentId(null);
    setEditingFormInstallmentData(null);
  };

  const handleUpdateFormInstallment = async (pId: string | undefined, idx: number) => {
    if (!editingFormInstallmentData) return;
    const isRefund = !!editingFormInstallmentData.is_refund;
    let paidAmt = Number(editingFormInstallmentData.paid_amount);
    if (!editingFormInstallmentData.paid_amount || isNaN(paidAmt) || paidAmt <= 0) {
      toast.error(isRefund ? 'Please enter a valid refund amount greater than zero' : 'Please enter a valid paid amount greater than zero');
      return;
    }

    if (isRefund) {
      paidAmt = -paidAmt; // negate it
    }

    const expDate = isRefund ? editingFormInstallmentData.paid_date : calculateExpiry(editingFormInstallmentData.activation_date, editingFormInstallmentData.duration);
    const actDate = isRefund ? editingFormInstallmentData.paid_date : editingFormInstallmentData.activation_date;
    const isExistingPayment = pId && existingPaymentIds.has(pId);
    const isRealInstallment = editingFormInstallmentId && !editingFormInstallmentId.startsWith('temp_inst_');

    if (isExistingPayment && isRealInstallment) {
      try {
        const { error } = await supabase
          .from('installment')
          .update({
            paid_amount: paidAmt,
            paid_date: editingFormInstallmentData.paid_date,
            activation_date: actDate,
            duration: isRefund ? null : editingFormInstallmentData.duration,
            refund_reason: isRefund ? (editingFormInstallmentData.refund_reason || editingFormInstallmentData.duration) : null,
            expired_date: expDate
          })
          .eq('id', editingFormInstallmentId);

        if (error) throw error;

        toast.success(isRefund ? 'Refund updated successfully' : 'Installment updated successfully');
        setEditingFormInstallmentId(null);
        setEditingFormInstallmentData(null);
        if (studentData.pcaid) {
          await fetchExistingPayments(studentData.pcaid);
        }
      } catch (err: any) {
        console.error(err);
        toast.error(err.message || (isRefund ? 'Failed to update refund' : 'Failed to update installment'));
      }
    } else {
      const updated = [...tempPayments];
      const targetPayment = updated[idx];
      const updatedInstallments = (targetPayment.installments || []).map((inst: any) => {
        if ((inst.id || inst.paid_date) === editingFormInstallmentId) {
          return {
            ...inst,
            paid_amount: paidAmt,
            paid_date: editingFormInstallmentData.paid_date,
            activation_date: actDate,
            duration: isRefund ? null : editingFormInstallmentData.duration,
            refund_reason: isRefund ? (editingFormInstallmentData.refund_reason || editingFormInstallmentData.duration) : null,
            expired_date: expDate
          };
        }
        return inst;
      });
      const totalPaid = updatedInstallments.reduce((sum: number, inst: any) => sum + Number(inst.paid_amount || 0), 0);

      updated[idx] = {
        ...targetPayment,
        payment: totalPaid,
        installments: updatedInstallments
      };

      setTempPayments(updated);
      setEditingFormInstallmentId(null);
      setEditingFormInstallmentData(null);
      toast.success(isRefund ? 'Refund updated locally' : 'Installment updated locally');
    }
  };

  const handleGenerateID = () => {
    const random = Math.floor(1000 + Math.random() * 9000);
    setStudentData({ ...studentData, pcaid: `PCA-${random}` });
  };

  const handleAddClass = () => {
    if (!selectedClass) return;
    const combinedClass = selectedMonth ? `${selectedClass} ${selectedMonth}` : selectedClass;

    const current = studentData.asked_class_type ? studentData.asked_class_type.split(', ') : [];
    if (current.includes(combinedClass)) {
      toast.error('Class already added');
      return;
    }

    const updated = [...current, combinedClass].join(', ');
    setStudentData({ ...studentData, asked_class_type: updated });
    setSelectedClass('');
    setSelectedMonth('');
  };

  const handleRemoveClass = (val: string) => {
    const updated = studentData.asked_class_type
      .split(', ')
      .filter(c => c !== val)
      .join(', ');
    setStudentData({ ...studentData, asked_class_type: updated });
  };

  const handleAddPackage = () => {
    if (!selectedPackage) return;
    const current = studentData.asked_package_type ? studentData.asked_package_type.split(', ') : [];
    if (current.includes(selectedPackage)) {
      toast.error('Package already added');
      return;
    }
    const updated = [...current, selectedPackage].join(', ');
    setStudentData({ ...studentData, asked_package_type: updated });
    setSelectedPackage('');
  };

  const handleRemovePackage = (val: string) => {
    const updated = studentData.asked_package_type
      .split(', ')
      .filter(p => p !== val)
      .join(', ');
    setStudentData({ ...studentData, asked_package_type: updated });
  };

  const handleSaveAll = async () => {
    if (!studentData.pcaid || !studentData.name) {
      toast.error('PCA ID and Name are required');
      return;
    }

    if (studentData.phone && studentData.phone.replace(/\D/g, '').length !== 9) {
      toast.error('Sri Lankan phone number must be exactly 9 digits (e.g., 7X XXX XXXX)');
      return;
    }

    if (studentData.mail) {
      const isInvalid = studentData.mail === '@gmail.com' || 
                        !studentData.mail.endsWith('@gmail.com') || 
                        studentData.mail.startsWith('@') ||
                        studentData.mail.split('@')[0].includes(' ') ||
                        studentData.mail.split('@')[0].includes('@');
      if (isInvalid) {
        toast.error('Please enter a valid Gmail username');
        return;
      }
    }

    // Skip duplicate check if editing existing student and PCA ID hasn't been changed
    if (editStudent && editStudent.pcaid === studentData.pcaid) {
      await executeSave();
      return;
    }

    setLoading(true);
    try {
      const { data: existingStudent, error: checkError } = await supabase
        .from('student')
        .select('name')
        .eq('pcaid', studentData.pcaid.trim())
        .maybeSingle();

      if (checkError) {
        console.error('Check existing student error:', checkError);
      }

      if (existingStudent) {
        setExistingStudentName(existingStudent.name);
        setShowDuplicateAlert(true);
        setLoading(false);
        return;
      }
    } catch (err) {
      console.error('Error checking duplicate PCAID', err);
    } finally {
      setLoading(false);
    }

    await executeSave();
  };

  const executeSave = async () => {
    setLoading(true);
    try {
      // Auto-add selected class/package if not yet added to the list
      let finalAskedClassType = studentData.asked_class_type;
      if (selectedClass) {
        const current = finalAskedClassType ? finalAskedClassType.split(', ') : [];
        if (!current.includes(selectedClass)) {
          finalAskedClassType = [...current, selectedClass].join(', ');
        }
      }

      let finalAskedPackageType = studentData.asked_package_type;
      if (selectedPackage) {
        const current = finalAskedPackageType ? finalAskedPackageType.split(', ') : [];
        if (!current.includes(selectedPackage)) {
          finalAskedPackageType = [...current, selectedPackage].join(', ');
        }
      }

      const updatedStudentData = {
        ...studentData,
        asked_class_type: finalAskedClassType,
        asked_package_type: finalAskedPackageType
      };

      // 1. Save Student
      const payload: any = {
        ...updatedStudentData,
        admin: editStudent?.admin || leadData?.admin || user?.username || 'system',
        created_at: editStudent?.created_at || new Date().toISOString()
      };

      let { error: saveError } = await supabase
        .from('student')
        .upsert(payload, { onConflict: 'pcaid' });

      // If the error indicates missing column schema, fallback safely by omitting them
      if (saveError && (saveError.message?.includes('column') || saveError.message?.includes('relation') || saveError.hint?.includes('column'))) {
        console.warn('DB schema mismatch, retrying save without batch_type and gender keys', saveError);
        const slimPayload = { ...payload };
        delete slimPayload.batch_type;
        delete slimPayload.gender;
        const retryResult = await supabase
          .from('student')
          .upsert(slimPayload, { onConflict: 'pcaid' });
        saveError = retryResult.error;
      }

      if (saveError) throw saveError;

      // Update last_temporary_id table if the PCAID matches our newly generated temp ID
      if (studentData.pcaid && latestGeneratedTempId === studentData.pcaid) {
        try {
          let { data: existingRecord } = await supabase
            .from('last_temporary_id')
            .select('id')
            .eq('id', 1)
            .maybeSingle();

          if (existingRecord) {
            await supabase
              .from('last_temporary_id')
              .update({ temp_id: studentData.pcaid })
              .eq('id', 1);
          } else {
            await supabase
              .from('last_temporary_id')
              .insert({ id: 1, temp_id: studentData.pcaid });
          }
          setLatestGeneratedTempId(null);
        } catch (dbErr) {
          console.error('Error saving last temporary ID:', dbErr);
        }
      }

      // Update last_pca_id table if the PCAID matches our newly generated sequential PCA ID format or was generated in session
      const isSequentialPcaId = studentData.pcaid && (
        /^[BPN][PR][MFO]\d{7}$/.test(studentData.pcaid) || 
        latestGeneratedPcaId === studentData.pcaid
      );

      if (isSequentialPcaId) {
        try {
          let districtCode = DISTRICT_NUMBERS[studentData.district] || studentData.district || '';
          const digitsOnly = districtCode.replace(/\D/g, '');
          let finalDistrictCode = '00';
          if (digitsOnly) {
            finalDistrictCode = digitsOnly.padStart(2, '0');
          }

          // Determine if it is a scholarship or paid sequence based on the actual PCA ID digits
          let isScholarshipSeq = false;
          const pcaidSuffix = studentData.pcaid.slice(-3);
          const last3Val = parseInt(pcaidSuffix, 10);
          if (studentData.pcaid && studentData.pcaid.length === 10 && !isNaN(last3Val) && last3Val >= 900 && last3Val <= 999) {
            isScholarshipSeq = true;
          }

          if (studentData.joined_batch && finalDistrictCode) {
            // First fetch the record with plain district code to check for the new column
            const { data: existingPlain } = await supabase
              .from('last_pca_id')
              .select('*')
              .eq('joined_batch', studentData.joined_batch)
              .eq('district_code', finalDistrictCode)
              .maybeSingle();

            const hasScholarshipColumn = existingPlain && ('last_scholarship_id' in existingPlain);

            if (isScholarshipSeq && !hasScholarshipColumn) {
              // Fallback to the old '_sch' district code logic if the database hasn't been migrated yet
              const oldSchCode = finalDistrictCode + '_sch';
              const { data: existingOldSch } = await supabase
                .from('last_pca_id')
                .select('*')
                .eq('joined_batch', studentData.joined_batch)
                .eq('district_code', oldSchCode)
                .maybeSingle();

              const finalValue = !isNaN(last3Val) ? last3Val : ((existingOldSch ? (existingOldSch.last_id || 899) : 899) + 1);

              if (existingOldSch) {
                await supabase
                  .from('last_pca_id')
                  .update({ last_id: finalValue })
                  .eq('joined_batch', studentData.joined_batch)
                  .eq('district_code', oldSchCode);
              } else {
                await supabase
                  .from('last_pca_id')
                  .insert({
                    joined_batch: studentData.joined_batch,
                    district_code: oldSchCode,
                    last_id: finalValue
                  });
              }
            } else {
              // Use the unified single-row approach with last_id or last_scholarship_id
              const finalValue = !isNaN(last3Val) ? last3Val : (
                isScholarshipSeq
                  ? ((existingPlain ? (existingPlain.last_scholarship_id || 899) : 899) + 1)
                  : ((existingPlain ? (existingPlain.last_id || 0) : 0) + 1)
              );

              if (existingPlain) {
                const updatePayload: any = {};
                if (isScholarshipSeq) {
                  updatePayload.last_scholarship_id = finalValue;
                } else {
                  updatePayload.last_id = finalValue;
                }
                await supabase
                  .from('last_pca_id')
                  .update(updatePayload)
                  .eq('joined_batch', studentData.joined_batch)
                  .eq('district_code', finalDistrictCode);
              } else {
                const insertPayload: any = {
                  joined_batch: studentData.joined_batch,
                  district_code: finalDistrictCode,
                };
                if (isScholarshipSeq) {
                  insertPayload.last_scholarship_id = finalValue;
                  insertPayload.last_id = 0;
                } else {
                  insertPayload.last_id = finalValue;
                  insertPayload.last_scholarship_id = 899;
                }
                await supabase
                  .from('last_pca_id')
                  .insert(insertPayload);
              }
            }
          }
          setLatestGeneratedPcaId(null);
        } catch (dbErr) {
          console.error('Error saving last PCA ID update on save:', dbErr);
        }
      }

      // Log student transaction
      await logTransaction({
        admin_username: user?.username || 'system',
        action_type: editStudent ? 'UPDATE' : 'CREATE',
        entity_type: 'student',
        entity_id: studentData.pcaid,
        details: editStudent
          ? `Updated student details for ${studentData.name} (${studentData.pcaid})`
          : `Enrolled new student ${studentData.name} (${studentData.pcaid}) in stream ${studentData.stream || 'N/A'}`
      });

      // 1.5 Sync with CallTask table
      const sharedFieldsForTask = {
        pcaid: studentData.pcaid, // Syncing back the PCAID
        name: studentData.name,
        phone: studentData.phone,
        proper_batch: studentData.proper_batch,
        joined_batch: studentData.joined_batch,
        school: studentData.school,
        district: studentData.district,
        mail: studentData.mail,
        address: studentData.address,
        asked_class_type: finalAskedClassType,
        asked_package_type: finalAskedPackageType,
        status: 'Joined',
        stream: studentData.stream || null,
        admin: editStudent?.admin || leadData?.admin || user?.username || 'system'
      };

      // Update task where phone or pcaid matches (ensuring all columns are fully updated with new values)
      try {
        const pcaidCandidates = [
          editStudent?.pcaid,
          studentData.pcaid
        ].filter(p => p && p.trim() !== '') as string[];

        const phoneCandidates = [
          initialPhone,
          studentData.phone
        ].filter(p => p && p.trim() !== '') as string[];

        const calltaskMatchesMap = new Map<string, any>();

        // 1. Lookup calltasks by PCAIDs
        for (const p of pcaidCandidates) {
          const { data, error } = await supabase
            .from('calltask')
            .select('id, pcaid, phone')
            .eq('pcaid', p.toUpperCase().trim())
            .is('deleted_at', null);
          if (!error && data) {
            data.forEach(item => calltaskMatchesMap.set(item.id, item));
          }
        }

        // 2. Lookup calltasks by Phones
        for (const ph of phoneCandidates) {
          const { data, error } = await supabase
            .from('calltask')
            .select('id, pcaid, phone')
            .eq('phone', ph.trim())
            .is('deleted_at', null);
          if (!error && data) {
            data.forEach(item => calltaskMatchesMap.set(item.id, item));
          }
        }

        const calltaskMatches = Array.from(calltaskMatchesMap.values());

        if (calltaskMatches.length > 0) {
          for (const match of calltaskMatches) {
            const { error: syncError } = await supabase
              .from('calltask')
              .update(sharedFieldsForTask)
              .eq('id', match.id);

            if (syncError) {
              console.warn(`CallTask sync error for ID ${match.id} during Student save:`, syncError);
            }
          }
        } else {
          console.log('No matching calltasks found for PCAID/Phone candidates during Student save sync.');
        }
      } catch (syncErr) {
        console.error('Error during CallTask sync wrapper execution:', syncErr);
      }

      // 1.8 Soft-delete removed Payments (which will cascade to installments via DB triggers)
      if (deletedPaymentIds.length > 0) {
        const { error: deletePaymentsError } = await supabase
          .from('payment')
          .update({ deleted_at: new Date().toISOString() })
          .in('id', deletedPaymentIds);
        if (deletePaymentsError) throw deletePaymentsError;
        
        await logTransaction({
          admin_username: user?.username || 'system',
          action_type: 'PAYMENT_DELETE',
          entity_type: 'payment',
          entity_id: studentData.pcaid,
          details: `Deleted ${deletedPaymentIds.length} removed payment record(s) for ${studentData.name} (${studentData.pcaid})`
        });
      }

      // 2. Save Payments
      if (tempPayments.length > 0) {
        const toInsert = tempPayments.filter(p => !p.id || !existingPaymentIds.has(p.id));
        const toUpdate = tempPayments.filter(p => !!(p.id && existingPaymentIds.has(p.id)));

        let loggedPaymentsCount = 0;
        let loggedPaymentsSum = 0;

        if (toInsert.length > 0) {
          for (const p of toInsert) {
            const paymentPayload = {
              pcaid: studentData.pcaid,
              type: p.type,
              class_type: p.class_type,
              package_type: p.package_type,
              payment: p.total_amount !== undefined ? p.total_amount : p.payment, // Total Fee maps to payment
              paid_date: p.paid_date,
              activation_date: p.activation_date,
              duration: p.duration || '1 month',
              expired_date: p.expired_date
            };

            const { data: insertedPayment, error: insertPayError } = await supabase
              .from('payment')
              .insert(paymentPayload)
              .select()
              .single();

            if (insertPayError) throw insertPayError;

            if (insertedPayment) {
              if (p.installments && p.installments.length > 0) {
                const installmentPayloads = p.installments.map((inst: any) => ({
                  payment_id: insertedPayment.id,
                  paid_amount: inst.paid_amount,
                  paid_date: inst.paid_date,
                  activation_date: inst.activation_date,
                  duration: inst.duration,
                  refund_reason: inst.refund_reason || null,
                  expired_date: inst.expired_date
                }));

                const { error: insertInstError } = await supabase
                  .from('installment')
                  .insert(installmentPayloads);

                if (insertInstError) throw insertInstError;
              } else {
                const installmentPayload = {
                  payment_id: insertedPayment.id,
                  paid_amount: p.payment,
                  paid_date: p.paid_date,
                  activation_date: p.activation_date,
                  duration: p.duration || '1 month',
                  expired_date: p.expired_date
                };

                const { error: insertInstError } = await supabase
                  .from('installment')
                  .insert(installmentPayload);

                if (insertInstError) throw insertInstError;
              }
            }
            loggedPaymentsCount++;
            loggedPaymentsSum += Number(p.payment || 0);
          }
        }

        if (toUpdate.length > 0) {
          for (const p of toUpdate) {
            const paymentPayload = {
              pcaid: studentData.pcaid,
              type: p.type,
              class_type: p.class_type,
              package_type: p.package_type,
              payment: p.total_amount !== undefined ? p.total_amount : p.payment, // Total Fee maps to payment
              paid_date: p.paid_date,
              activation_date: p.activation_date,
              duration: p.duration || '1 month',
              expired_date: p.expired_date
            };

            const { error: updatePayError } = await supabase
              .from('payment')
              .update(paymentPayload)
              .eq('id', p.id);

            if (updatePayError) throw updatePayError;

            // Check if installment already exists for this payment_id
            const { data: existingInst } = await supabase
              .from('installment')
              .select('id')
              .eq('payment_id', p.id);

            const installmentPayload = {
              payment_id: p.id,
              paid_amount: p.payment,
              paid_date: p.paid_date,
              activation_date: p.activation_date,
              duration: p.duration || '1 month',
              expired_date: p.expired_date
            };

            if (existingInst && existingInst.length > 0) {
              const { error: updateInstError } = await supabase
                .from('installment')
                .update(installmentPayload)
                .eq('id', existingInst[0].id);

              if (updateInstError) throw updateInstError;
            } else {
              const { error: insertInstError } = await supabase
                .from('installment')
                .insert(installmentPayload);

              if (insertInstError) throw insertInstError;
            }
            loggedPaymentsCount++;
            loggedPaymentsSum += Number(p.payment || 0);
          }
        }

        // Log payment transactions
        if (loggedPaymentsCount > 0) {
          await logTransaction({
            admin_username: user?.username || 'system',
            action_type: 'PAYMENT_ADD',
            entity_type: 'payment',
            entity_id: studentData.pcaid,
            details: `Logged/Updated ${loggedPaymentsCount} payment(s) of total Rs.${loggedPaymentsSum} for ${studentData.name} (${studentData.pcaid})`
          });
        }
      }

      toast.success('All data saved successfully!');
      if (editStudent) {
        if (isModal && onClose) {
          onClose(true);
        } else {
          navigate('/admin/student-explorer');
        }
      } else {
        if (isModal && onClose) {
          onClose(true);
        } else {
          // Clear all
          setStudentData({ pcaid: '', name: '', phone: '', stream: '', proper_batch: '', joined_batch: '', school: '', district: '', mail: '', address: '', asked_class_type: '', asked_package_type: '', batch_type: '', gender: '' });
          setStudentType('Paid');
          setTempPayments([]);
        }
      }
    } catch (err: any) {
      console.error('Detailed save error:', err);
      let errorMsg = 'Failed to save data. ';
      if (err?.message) {
        errorMsg += err.message;
      } else if (typeof err === 'string') {
        errorMsg += err;
      } else {
        errorMsg += 'Unknown error occured.';
      }
      
      if (err?.details) {
        errorMsg += ` Detail: ${err.details}`;
      }
      if (err?.hint) {
        errorMsg += ` Hint: ${err.hint}`;
      }
      
      toast.error(errorMsg, { duration: 12000 });
    } finally {
      setLoading(false);
    }
  };

  const handleCopyMessage = (p: Partial<Payment>) => {
    const typeLabel = p.type === 'class' ? p.class_type : p.package_type;
    const msg = `${typeLabel} ${p.duration} மாதங்களுக்கு activate செய்யப்பட்டுள்ளது.✅`;
    toast.success(copyToClipboard(msg, 'Message'));
  };

  return (
    <div className="max-w-5xl mx-auto space-y-8 pb-12">
      {/* SECTION 1: STUDENT DATA */}
      <div className="bg-white p-8 rounded-2xl shadow-sm border border-gray-100">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-6">
          <h3 className="text-lg font-bold text-gray-800 flex items-center gap-2">
            <UserIcon size={20} className="text-teal-600"/>
            Section 1: Student Data
          </h3>
          
          {/* Verification Bar */}
          <div className="flex-1 max-w-md w-full relative">
            <div className="relative group">
              <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-gray-400 group-focus-within:text-teal-600 transition-colors">
                <Search size={16} />
              </div>
              <input
                type="text"
                value={verifyQuery}
                onChange={(e) => setVerifyQuery(e.target.value)}
                className="w-full pl-10 pr-4 py-2 bg-white border border-gray-200 rounded-xl text-sm focus:ring-2 focus:ring-teal-500/20 focus:border-teal-500 transition-all shadow-sm"
                placeholder="Verify PCA ID or Phone Number..."
              />
              <div className="absolute inset-y-0 right-0 flex items-center py-1.5 pr-1.5 gap-2">
                {verificationStatus.lookupDone && (
                  <div className="flex items-center gap-2">
                    <div className={cn(
                      "flex items-center gap-1.5 px-3 h-[30px] rounded-lg text-[10px] font-black uppercase tracking-wider animate-in fade-in slide-in-from-right-2 duration-300",
                      verificationStatus.exists ? "bg-red-50 text-red-600 border border-red-100" : "bg-green-50 text-green-600 border border-green-100"
                    )}>
                      {verificationStatus.exists ? (
                        <>
                          <ShieldAlert size={12}/>
                          Exists
                        </>
                      ) : (
                        <>
                          <ShieldCheck size={12}/>
                          New
                        </>
                      )}
                    </div>
                    
                    {verificationStatus.exists && (
                      <div className="flex items-center gap-2">
                        <button
                          onClick={handleGrabDetails}
                          className="flex items-center gap-1.5 px-3 h-[30px] bg-teal-600 text-white rounded-lg text-[10px] font-black uppercase tracking-wider hover:bg-teal-700 transition-colors shadow-sm animate-in zoom-in duration-300"
                          title="Fill form with existing details"
                        >
                          <RefreshCw size={12} className={loading ? "animate-spin" : ""} />
                          Grab Data
                        </button>
                        
                        <button
                          onClick={() => navigate('/admin/student-explorer', { state: { search: verifyQuery } })}
                          className="flex items-center gap-1.5 px-3 h-[30px] bg-orange-500 text-white rounded-lg text-[10px] font-black uppercase tracking-wider hover:bg-orange-600 transition-colors shadow-sm animate-in zoom-in duration-300"
                          title="View student details in directory"
                        >
                          <ExternalLink size={12} />
                          View
                        </button>
                      </div>
                    )}
                  </div>
                )}
              </div>
            </div>
            
            {/* Quick Action Badge if student exists */}
            {verificationStatus.exists && verificationStatus.student && (
              <div className="absolute mt-2 z-10 animate-in fade-in slide-in-from-top-1 duration-200">
                 <button 
                  onClick={() => navigate('/admin/student-explorer', { state: { search: verificationStatus.student?.pcaid } })}
                  className="flex items-center gap-2 px-3 py-1 bg-teal-900 text-white rounded-full text-[10px] font-bold hover:bg-black transition-colors shadow-lg"
                >
                  <ExternalLink size={10}/>
                  View {verificationStatus.student.name} in Explorer
                </button>
              </div>
            )}
          </div>
        </div>
        
        <div className="grid grid-cols-1 md:grid-cols-2 gap-x-12 gap-y-6">
          {/* Field 1: PCA ID */}
          <div className="flex flex-col gap-1.5">
            <label className="text-sm font-semibold text-gray-700">PCA ID</label>
            <div className="flex flex-col gap-2">
              <div className="flex items-center gap-2">
                <input
                  type="text"
                  value={studentData.pcaid}
                  onChange={(e) => setStudentData({ ...studentData, pcaid: e.target.value.toUpperCase() })}
                  className="w-36 px-4 py-2 bg-gray-50 border border-gray-200 rounded-lg font-mono text-base focus:outline-none focus:ring-2 focus:ring-teal-500/20"
                  placeholder="PCA-XXXX"
                />
                <div className="flex items-center gap-2">
                  <button 
                    type="button"
                    onClick={handleGenerateTempId}
                    disabled={isGeneratingTempId}
                    className="inline-flex items-center justify-center px-3 py-1.5 bg-teal-50 hover:bg-teal-100/80 active:bg-teal-200 text-teal-700 border border-teal-100 rounded-lg text-[10px] font-black uppercase tracking-wider transition-all disabled:opacity-50 cursor-pointer text-center h-[32px] whitespace-nowrap"
                  >
                    {isGeneratingTempId ? 'Generating...' : 'Temp ID'}
                  </button>
                  <button 
                    type="button"
                    onClick={handleGeneratePcaId}
                    disabled={isGeneratingPcaId}
                    className="inline-flex items-center justify-center px-3 py-1.5 bg-teal-600 hover:bg-teal-700 active:bg-teal-800 text-white border border-teal-600 rounded-lg text-[10px] font-black uppercase tracking-wider transition-all disabled:opacity-50 cursor-pointer text-center h-[32px] whitespace-nowrap font-sans font-bold"
                  >
                    {isGeneratingPcaId ? 'Generating...' : 'PCA ID'}
                  </button>
                </div>
              </div>

              {/* Student Category Dropdown Box */}
              <div className="flex flex-col gap-1 mt-1 max-w-[240px]">
                <label className="text-[10px] font-black uppercase tracking-wider text-gray-400">Student Category</label>
                <select
                  value={studentType}
                  onChange={(e) => setStudentType(e.target.value as 'Paid' | 'Scholarship')}
                  className="w-full px-3 py-2 bg-gray-50 border border-gray-200 rounded-lg text-xs focus:outline-none focus:ring-2 focus:ring-teal-500/20 text-gray-700 font-semibold cursor-pointer"
                >
                  <option value="Paid">Paid Student (Sequence 001 - 899)</option>
                  <option value="Scholarship">Scholarship Holder (Sequence 900 - 999)</option>
                </select>
              </div>
            </div>
          </div>

          {/* Field 2: Name */}
          <div className="flex flex-col gap-1.5">
            <label className="text-sm font-semibold text-gray-700">Name</label>
            <input
              type="text"
              value={studentData.name}
              onChange={(e) => setStudentData({ ...studentData, name: e.target.value })}
              className="w-full px-4 py-2 bg-gray-50 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-teal-500/20"
              placeholder="Full Name"
            />
          </div>

          {/* Field 3: Stream */}
          <div className="flex flex-col gap-1.5">
            <label className="text-sm font-semibold text-gray-700">Stream</label>
            <select
              value={studentData.stream || ''}
              onChange={(e) => setStudentData({ ...studentData, stream: e.target.value })}
              className="w-full px-4 py-2 bg-gray-50 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-teal-500/20 text-gray-800 font-medium"
            >
              <option value="">Select Stream</option>
              <option value="Biological Science">Biological Science</option>
              <option value="Physical Science">Physical Science</option>
              <option value="Non Stream">Non Stream</option>
            </select>
          </div>

          {/* Field 8: District with selected Label */}
          <div className="flex flex-col gap-1.5">
            <div className="flex items-center gap-2">
              <label className="text-sm font-semibold text-gray-700">District</label>
              {studentData.district && (
                <span className="text-xs font-black text-teal-700 bg-teal-50 border border-teal-100 px-2 py-0.5 rounded-md uppercase tracking-wider animate-in fade-in duration-200">
                  {DISTRICT_NUMBERS[studentData.district] || studentData.district}
                </span>
              )}
            </div>
            <select
              value={studentData.district}
              onChange={(e) => setStudentData({ ...studentData, district: e.target.value })}
              className="w-full px-4 py-2 bg-gray-50 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-teal-500/20 text-gray-800 font-medium"
            >
              <option value="">Select District</option>
              {SRI_LANKAN_DISTRICTS.map(d => <option key={d} value={d}>{d}</option>)}
            </select>
          </div>

          {/* Field 5: Proper Batch */}
          <div className="flex flex-col gap-1.5">
            <label className="text-sm font-semibold text-gray-700">Proper Batch</label>
            <input
              type="text"
              value={studentData.proper_batch}
              onChange={(e) => setStudentData({ ...studentData, proper_batch: e.target.value })}
              className="w-full px-4 py-2 bg-gray-50 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-teal-500/20"
              placeholder="e.g. 2024"
            />
          </div>

          {/* Field 6: Joined Batch */}
          <div className="flex flex-col gap-1.5">
            <label className="text-sm font-semibold text-gray-700">Joined Batch</label>
            <select
              value={studentData.joined_batch || ''}
              onChange={(e) => setStudentData({ ...studentData, joined_batch: e.target.value })}
              className="w-full px-4 py-2 bg-gray-50 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-teal-500/20 text-gray-800 font-medium"
            >
              <option value="">Select Joined Batch</option>
              {studentData.joined_batch && !joinedBatches.some(jb => jb.joined_batch === studentData.joined_batch) && (
                <option value={studentData.joined_batch}>
                  {studentData.joined_batch} (Passed Lead value)
                </option>
              )}
              {joinedBatches.map((jb) => (
                <option key={jb.id} value={jb.joined_batch}>
                  {jb.joined_batch}
                </option>
              ))}
            </select>
          </div>

          {/* Grouped: Batch Type & Gender - Only for PCA ID Generation */}
          <div className="md:col-span-2 p-5 bg-teal-50/35 border border-teal-100 rounded-2xl flex flex-col gap-4 shadow-sm">
            <div className="flex items-center gap-2 border-b border-teal-100/60 pb-2">
              <span className="text-xs font-bold text-teal-800 uppercase tracking-widest">
                only for generating PCA ID.
              </span>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-x-8 gap-y-4">
              {/* Field 4: Batch Type */}
              <div className="flex flex-col gap-1.5">
                <label className="text-sm font-semibold text-gray-700">Batch Type</label>
                <select
                  value={studentData.batch_type || ''}
                  onChange={(e) => setStudentData({ ...studentData, batch_type: e.target.value })}
                  className="w-full px-4 py-2 bg-white border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-teal-500/20 text-gray-800 font-medium"
                >
                  <option value="">Select Batch Type</option>
                  <option value="Proper">Proper</option>
                  <option value="Repeat">Repeat</option>
                </select>
              </div>

              {/* Field 7: Gender */}
              <div className="flex flex-col gap-1.5">
                <label className="text-sm font-semibold text-gray-700">Gender</label>
                <select
                  value={studentData.gender || ''}
                  onChange={(e) => setStudentData({ ...studentData, gender: e.target.value })}
                  className="w-full px-4 py-2 bg-white border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-teal-500/20 text-gray-800 font-medium"
                >
                  <option value="">Select Gender</option>
                  <option value="Male">Male</option>
                  <option value="Female">Female</option>
                  <option value="Other">Other</option>
                </select>
              </div>
            </div>
          </div>

          {/* Field 11: Phone */}
          <div className="flex flex-col gap-1.5">
            <label className="text-sm font-semibold text-gray-700">Phone</label>
            <div className={cn(
              "relative flex items-center border bg-gray-50 dark:bg-gray-900 rounded-lg overflow-hidden focus-within:ring-2 transition-all",
              phoneError 
                ? "border-red-500 focus-within:ring-red-500/20 focus-within:border-red-500" 
                : "border-gray-200 dark:border-gray-800 focus-within:ring-teal-500/20 focus-within:border-teal-500"
            )}>
              <div className="flex items-center gap-1.5 px-3 py-2 bg-gray-100/80 dark:bg-gray-800/80 border-r border-gray-200 dark:border-gray-700 select-none text-sm font-semibold text-gray-700 dark:text-gray-300">
                <span className="text-base" role="img" aria-label="Sri Lanka Flag">🇱🇰</span>
                <span>+94</span>
                <ChevronDown size={14} className="text-gray-400 dark:text-gray-500" />
              </div>
              <input
                type="text"
                value={studentData.phone}
                onChange={(e) => {
                  let digits = e.target.value.replace(/\D/g, '');
                  if (digits.startsWith('0')) {
                    digits = digits.slice(1);
                  }
                  setStudentData({ ...studentData, phone: digits.slice(0, 9) });
                  if (phoneError) setPhoneError('');
                }}
                onBlur={() => handlePhoneBlur(studentData.phone)}
                className="w-full px-3 py-2 bg-transparent focus:outline-none text-sm text-gray-800 dark:text-gray-100 placeholder-gray-400 dark:placeholder-gray-500"
                placeholder="7X XXX XXXX"
              />
            </div>
            {phoneError && (
              <span className="text-xs text-red-500 font-medium mt-0.5">{phoneError}</span>
            )}
          </div>

          {/* Field 10: Mail */}
          <div className="flex flex-col gap-1.5">
            <label className="text-sm font-semibold text-gray-700">Mail</label>
            <div className={cn(
              "relative flex items-center border bg-gray-50 dark:bg-gray-900 rounded-lg overflow-hidden focus-within:ring-2 transition-all",
              mailError 
                ? "border-red-500 focus-within:ring-red-500/20 focus-within:border-red-500" 
                : "border-gray-200 dark:border-gray-800 focus-within:ring-teal-500/20 focus-within:border-teal-500"
            )}>
              <input
                type="text"
                value={studentData.mail.endsWith('@gmail.com') ? studentData.mail.slice(0, -10) : studentData.mail}
                onChange={(e) => {
                  const val = e.target.value.trim();
                  const cleanVal = val.replace(/[^a-zA-Z0-9._-]/g, '');
                  setStudentData({ ...studentData, mail: cleanVal ? `${cleanVal}@gmail.com` : '' });
                  if (mailError) setMailError('');
                }}
                onBlur={() => handleMailBlur(studentData.mail)}
                className="w-full px-3 py-2 bg-transparent focus:outline-none text-sm text-gray-800 dark:text-gray-100 placeholder-gray-400 dark:placeholder-gray-500"
                placeholder="username"
              />
              <div className="px-3 py-2 bg-gray-100/80 dark:bg-gray-800/80 border-l border-gray-200 dark:border-gray-700 select-none text-sm font-semibold text-gray-500 dark:text-gray-400">
                @gmail.com
              </div>
            </div>
            {mailError && (
              <span className="text-xs text-red-500 font-medium mt-0.5">{mailError}</span>
            )}
          </div>

          {/* Field 9: School */}
          <div className="flex flex-col gap-1.5">
            <label className="text-sm font-semibold text-gray-700">School</label>
            <input
              type="text"
              value={studentData.school}
              onChange={(e) => setStudentData({ ...studentData, school: e.target.value })}
              className="w-full px-4 py-2 bg-gray-50 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-teal-500/20"
              placeholder="School Name"
            />
          </div>

          {/* Field 12: Address */}
          <div className="flex flex-col gap-1.5">
            <label className="text-sm font-semibold text-gray-700">Address</label>
            <textarea
              value={studentData.address}
              onChange={(e) => setStudentData({ ...studentData, address: e.target.value })}
              className="w-full px-4 py-2 bg-gray-50 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-teal-500/20 h-11"
              placeholder="Home Address"
            />
          </div>

          {/* Asked Class Type */}
          <div className="flex flex-col gap-2 p-4 bg-gray-50 rounded-xl border border-gray-100 md:col-span-2">
            <label className="text-sm font-semibold text-gray-700">Asked Class Type</label>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 w-full">
              <select
                value={selectedClass}
                onChange={(e) => setSelectedClass(e.target.value)}
                className="w-full min-w-0 px-4 py-2 bg-white border border-gray-200 rounded-lg focus:outline-none text-gray-700 font-medium"
              >
                <option value="">Select Class Type</option>
                {baseClassTypes.map(c => <option key={c} value={c}>{c}</option>)}
              </select>

              <div className="flex gap-2 min-w-0 w-full">
                <select
                  value={selectedMonth}
                  onChange={(e) => setSelectedMonth(e.target.value)}
                  className="flex-1 min-w-0 px-4 py-2 bg-white border border-gray-200 rounded-lg focus:outline-none text-gray-700 font-medium"
                >
                  <option value="">Select Month</option>
                  {MONTHS.map(m => <option key={m} value={m}>{m}</option>)}
                </select>
                <button
                  type="button"
                  onClick={handleAddClass}
                  className="p-2 bg-teal-600 text-white rounded-lg hover:bg-teal-700 active:scale-95 transition-all cursor-pointer flex items-center justify-center w-10 h-10 shrink-0"
                  title="Add Class"
                >
                  <Plus size={20} />
                </button>
              </div>
            </div>
            <div className="flex flex-wrap gap-2 mt-2">
              {studentData.asked_class_type.split(', ').filter(Boolean).map(c => (
                <div key={c} className="flex items-center gap-2 px-3 py-1 bg-white border border-teal-100 rounded-full text-xs font-bold text-teal-700">
                  <span>{c}</span>
                  <button type="button" onClick={() => handleRemoveClass(c)} className="text-red-400 hover:text-red-600 transition-colors">
                    <Trash2 size={14} />
                  </button>
                </div>
              ))}
            </div>
          </div>

          {/* Asked Package Type */}
          <div className="flex flex-col gap-2 p-4 bg-gray-50 rounded-xl border border-gray-100 md:col-span-2">
            <label className="text-sm font-semibold text-gray-700">Asked Package Type</label>
            <div className="flex gap-2 w-full">
              <select
                value={selectedPackage}
                onChange={(e) => setSelectedPackage(e.target.value)}
                className="flex-1 min-w-0 px-4 py-2 bg-white border border-gray-200 rounded-lg focus:outline-none text-gray-700 font-medium"
              >
                <option value="">Select Package</option>
                {packageTypes.map(p => <option key={p.id} value={p.package_type}>{p.package_type}</option>)}
              </select>
              <button
                type="button"
                onClick={handleAddPackage}
                className="p-2 bg-teal-600 text-white rounded-lg hover:bg-teal-700 transition-colors shrink-0"
                id="add_package_from_view"
              >
                <Plus size={20} />
              </button>
            </div>
            <div className="flex flex-wrap gap-2 mt-2">
              {studentData.asked_package_type.split(', ').filter(Boolean).map(p => (
                <div key={p} className="flex items-center gap-2 px-3 py-1 bg-white border border-teal-100 rounded-full text-xs font-bold text-teal-700">
                  <span>{p}</span>
                  <button type="button" onClick={() => handleRemovePackage(p)} className="text-red-400 hover:text-red-600 transition-colors">
                    <Trash2 size={14} />
                  </button>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* SECTION 2: PAYMENT MANAGEMENT */}
      <div className="bg-white p-8 rounded-2xl shadow-sm border border-gray-100 space-y-8">
          <h3 className="text-lg font-bold text-gray-800 flex items-center gap-2">
            <CreditCard size={20} className="text-teal-600"/>
            Section 2: Payment Management
          </h3>
          
          {/* Entry Row */}
          <div id="payment-entry-section" className="p-6 bg-teal-50/50 rounded-2xl border border-teal-100 flex flex-col gap-6">
            <div className="grid grid-cols-1 md:grid-cols-5 gap-4 items-end">
               <div className="md:col-span-2 flex flex-col gap-3">
                 {/* Entry Type */}
                 <div className="space-y-1">
                  <label className="text-xs font-bold text-teal-800 uppercase tracking-tighter">Entry Type</label>
                  <div className="flex bg-white rounded-lg p-1 border border-teal-100 w-full">
                    <button 
                      onClick={() => {
                        setCurrentPayment({ ...currentPayment, type: 'class', class_type: '', package_type: '' });
                        setPaymentClassType('');
                        setPaymentMonth('');
                      }}
                      className={cn("flex-1 px-2 py-1.5 text-xs font-bold rounded-md transition-all", currentPayment.type === 'class' ? 'bg-teal-600 text-white shadow-sm' : 'text-gray-500 hover:bg-gray-50')}
                    >
                      Class
                    </button>
                    <button 
                      onClick={() => {
                        setCurrentPayment({ ...currentPayment, type: 'package', class_type: '', package_type: '' });
                        setPaymentClassType('');
                        setPaymentMonth('');
                      }}
                      className={cn("flex-1 px-2 py-1.5 text-xs font-bold rounded-md transition-all", currentPayment.type === 'package' ? 'bg-teal-600 text-white shadow-sm' : 'text-gray-500 hover:bg-gray-50')}
                    >
                      Package
                    </button>
                  </div>
                </div>

                {/* Dropdowns below Entry Type */}
                {currentPayment.type === 'class' ? (
                  <div className="space-y-1 w-full">
                    <label className="text-xs font-bold text-teal-800 uppercase tracking-tighter">Class Type & Month</label>
                    <div className="grid grid-cols-2 gap-2 w-full">
                      <select
                        value={paymentClassType}
                        onChange={(e) => setPaymentClassType(e.target.value)}
                        className="w-full px-3 py-2 bg-white border border-teal-100 rounded-lg text-sm focus:ring-2 focus:ring-teal-500/20 outline-none"
                      >
                        <option value="">Select Class Type</option>
                        {baseClassTypes.map(c => <option key={c} value={c}>{c}</option>)}
                      </select>
                      <select
                        value={paymentMonth}
                        onChange={(e) => setPaymentMonth(e.target.value)}
                        className="w-full px-3 py-2 bg-white border border-teal-100 rounded-lg text-sm focus:ring-2 focus:ring-teal-500/20 outline-none"
                      >
                        <option value="">Select Month</option>
                        {MONTHS.map(m => <option key={m} value={m}>{m}</option>)}
                      </select>
                    </div>
                  </div>
                ) : (
                  <div className="space-y-1 w-full">
                    <label className="text-xs font-bold text-teal-800 uppercase tracking-tighter">Package Type</label>
                    <select
                      value={currentPayment.package_type || ''}
                      onChange={(e) => setCurrentPayment({ ...currentPayment, package_type: e.target.value })}
                      className="w-full px-3 py-2 bg-white border border-teal-100 rounded-lg text-sm focus:ring-2 focus:ring-teal-500/20 outline-none"
                    >
                      <option value="">Select Package</option>
                      {packageTypes.map(p => <option key={p.id} value={p.package_type}>{p.package_type}</option>)}
                    </select>
                  </div>
                )}
              </div>

              <div className="space-y-1">
                <label className="text-xs font-bold text-teal-800 dark:text-slate-300 uppercase tracking-tighter block mb-1">Total Fee Amount</label>
                <input
                  type="number"
                  placeholder="Enter Course Fee"
                  value={currentPayment.total_amount !== undefined ? currentPayment.total_amount : ''}
                  onChange={(e) => {
                    const val = e.target.value ? Number(e.target.value) : undefined;
                    setCurrentPayment({ ...currentPayment, total_amount: val });
                  }}
                  className="w-full px-4 py-2.5 bg-white dark:bg-[#0f121d] border border-teal-100 dark:border-slate-800 rounded-xl text-slate-900 dark:text-white font-mono font-semibold text-sm focus:ring-2 focus:ring-teal-500/20 dark:focus:ring-teal-500/50 outline-none placeholder-slate-400 dark:placeholder-slate-500/65 shadow-inner transition-colors [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                />
              </div>

              <div className="space-y-1">
                <label className="text-xs font-bold text-teal-800 dark:text-slate-300 uppercase tracking-tighter block mb-1">Paid Amount</label>
                <input
                  type="number"
                  placeholder="0"
                  value={currentPayment.payment === 0 ? '' : currentPayment.payment}
                  onChange={(e) => setCurrentPayment({ ...currentPayment, payment: e.target.value ? Number(e.target.value) : 0 })}
                  className="w-full px-4 py-2.5 bg-white dark:bg-[#0f121d] border border-teal-100 dark:border-slate-800 rounded-xl text-slate-900 dark:text-white font-mono font-semibold text-sm focus:ring-2 focus:ring-teal-500/20 dark:focus:ring-teal-500/50 outline-none placeholder-slate-400 dark:placeholder-slate-500/65 shadow-inner transition-colors [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                />
              </div>

              <div className="space-y-1">
                {currentPayment.total_amount !== undefined && currentPayment.payment !== undefined && (
                  <div className="flex mb-1 justify-start">
                    {(() => {
                      const diff = currentPayment.total_amount - currentPayment.payment;
                      if (diff > 0) {
                        return (
                          <span className="text-[10px] sm:text-xs font-black text-red-650 dark:text-red-400 bg-red-50 dark:bg-red-950/40 px-2 py-0.5 rounded border border-red-100 dark:border-red-900/20 select-none truncate">
                            Balance to Pay: LKR {diff.toLocaleString()}
                          </span>
                        );
                      } else if (diff < 0) {
                        return (
                          <span className="text-[10px] sm:text-xs font-black text-emerald-600 dark:text-emerald-450 bg-emerald-50 dark:bg-emerald-955/40 px-2 py-0.5 rounded border border-emerald-100 dark:border-emerald-900/20 select-none truncate">
                            Overpaid: LKR {Math.abs(diff).toLocaleString()}
                          </span>
                        );
                      } else {
                        return (
                          <span className="text-[10px] sm:text-xs font-black text-gray-500 bg-gray-50 px-2 py-0.5 rounded border border-gray-200 select-none truncate">
                            Fully Paid
                          </span>
                        );
                      }
                    })()}
                  </div>
                )}
                <label className="text-xs font-bold text-teal-800 dark:text-slate-300 uppercase tracking-tighter block mb-1">Duration</label>
                <select
                  value={currentPayment.duration}
                  onChange={(e) => setCurrentPayment({ ...currentPayment, duration: e.target.value })}
                  className="w-full px-4 py-2.5 bg-white dark:bg-[#0f121d] border border-teal-100 dark:border-slate-800 rounded-xl text-sm text-slate-900 dark:text-white font-semibold focus:ring-2 focus:ring-teal-500/20 dark:focus:ring-teal-500/50 outline-none transition-colors shadow-inner"
                >
                  {DURATIONS.map(d => <option key={d.label} value={d.label}>{d.label}</option>)}
                </select>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
               <div className="space-y-1">
                <label className="text-xs font-bold text-teal-800 uppercase tracking-tighter">Paid Date</label>
                <input
                  type="date"
                  value={currentPayment.paid_date}
                  onChange={(e) => setCurrentPayment({ ...currentPayment, paid_date: e.target.value })}
                  className="w-full px-3 py-2 bg-white border border-teal-100 rounded-lg text-sm"
                />
              </div>
              <div className="space-y-1">
                <label className="text-xs font-bold text-teal-800 uppercase tracking-tighter">Activation Date</label>
                <input
                  type="date"
                  value={currentPayment.activation_date}
                  onChange={(e) => setCurrentPayment({ ...currentPayment, activation_date: e.target.value })}
                  className="w-full px-3 py-2 bg-white border border-teal-100 rounded-lg text-sm"
                />
              </div>
               <div className="flex items-end gap-2">
                 <div className="flex-1 space-y-1">
                  <label className="text-xs font-bold text-teal-800 uppercase tracking-tighter italic">Preview Expired Date</label>
                  <div className="w-full px-3 py-2 bg-gray-100 text-gray-500 rounded-lg text-sm font-bold border border-dashed border-gray-300">
                    {calculateExpiry(currentPayment.activation_date || '', currentPayment.duration || '1 month')}
                  </div>
                </div>
                {editingIndex !== null && (
                  <button
                    onClick={() => {
                      setEditingIndex(null);
                      setCurrentPayment({
                        ...currentPayment,
                        class_type: '',
                        package_type: '',
                        payment: 0,
                        total_amount: undefined
                      });
                      setPaymentClassType('');
                      setPaymentMonth('');
                    }}
                    className="h-10 w-10 flex items-center justify-center bg-gray-200 text-gray-600 rounded-lg hover:bg-gray-300 transition-all active:scale-95 shadow-md shadow-gray-400/20"
                    title="Cancel Edit"
                  >
                    <X size={20}/>
                  </button>
                )}
                <button
                  onClick={handleAddPayment}
                  className={cn(
                    "h-10 w-10 flex items-center justify-center text-white rounded-lg transition-all active:scale-95 shadow-md",
                    editingIndex !== null ? "bg-orange-500 hover:bg-orange-600 shadow-orange-500/20" : "bg-teal-600 hover:bg-teal-700 shadow-teal-600/20"
                  )}
                  title={editingIndex !== null ? "Save Changes" : "Add Payment"}
                >
                  {editingIndex !== null ? <Check size={20}/> : <Plus size={20}/>}
                </button>
               </div>
            </div>
          </div>

          {/* Temporary Payments List Table */}
          <div className="overflow-x-auto border border-gray-100 dark:border-gray-800 rounded-2xl bg-white dark:bg-gray-900">
            <table className="w-full text-left border-collapse min-w-[800px]">
               <thead>
                <tr className="bg-gray-50 dark:bg-gray-800">
                  <th className="p-4 text-xs font-black text-gray-400 dark:text-gray-500 uppercase">Type</th>
                  <th className="p-4 text-xs font-black text-gray-400 dark:text-gray-500 uppercase">Option</th>
                  <th className="p-4 text-xs font-black text-gray-400 dark:text-gray-500 uppercase">Total Fee</th>
                  <th className="p-4 text-xs font-black text-gray-400 dark:text-gray-500 uppercase">Paid Amount</th>
                  <th className="p-4 text-xs font-black text-gray-400 dark:text-gray-500 uppercase">Balance</th>
                  <th className="p-4 text-xs font-black text-gray-400 dark:text-gray-500 uppercase">Duration</th>
                  <th className="p-4 text-xs font-black text-gray-400 dark:text-gray-500 uppercase text-center">Expired Date</th>
                  <th className="p-4 text-xs font-black text-gray-400 dark:text-gray-500 uppercase text-center">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50 dark:divide-gray-800/60">
                {tempPayments.length === 0 ? (
                  <tr>
                     <td colSpan={8} className="p-10 text-center text-gray-400 font-medium italic">Payment list is empty</td>
                  </tr>
                ) : (
                  tempPayments.map((p, idx) => {
                    const totalFeeObj = p.total_amount !== undefined ? p.total_amount : p.payment;
                    const balanceObj = Math.max(0, totalFeeObj - p.payment);
                    const isExpanded = !!expandedFormPayments[p.id || idx];

                    return (
                      <React.Fragment key={p.id || idx}>
                        <tr className="hover:bg-gray-50/50 dark:hover:bg-gray-850/40 group">
                        <td className="p-4">
                          <span className={cn("px-2 py-0.5 rounded text-[10px] font-bold uppercase", p.type === 'class' ? 'bg-indigo-50 dark:bg-indigo-950/40 text-indigo-600 dark:text-indigo-400' : 'bg-purple-50 dark:bg-purple-950/40 text-purple-600 dark:text-purple-400')}>
                            {p.type}
                          </span>
                        </td>
                        <td className="p-4 font-bold text-gray-800 dark:text-gray-100">{p.type === 'class' ? p.class_type : p.package_type}</td>
                        <td className="p-4 font-mono text-gray-650 dark:text-gray-300 font-bold">LKR {totalFeeObj?.toLocaleString()}</td>
                        <td className="p-4 font-mono text-teal-600 dark:text-teal-400 font-bold">LKR {p.payment?.toLocaleString()}</td>
                        <td className="p-4 font-mono">
                          {(() => {
                            const diff = totalFeeObj - p.payment;
                            if (diff > 0) {
                              return (
                                <div className="flex flex-col">
                                  <span className="text-red-500 font-bold">Rs. {diff.toLocaleString()}</span>
                                  <span className="text-[9px] font-black text-red-400 uppercase">Balance to Pay</span>
                                </div>
                              );
                            } else if (diff < 0) {
                              return (
                                <div className="flex flex-col">
                                  <span className="text-emerald-500 font-bold">Rs. {Math.abs(diff).toLocaleString()}</span>
                                  <span className="text-[9px] font-black text-emerald-400 uppercase">Overpaid</span>
                                </div>
                              );
                            } else {
                              return (
                                <div className="flex flex-col">
                                  <span className="text-gray-400 font-semibold">Rs. 0</span>
                                  <span className="text-[9px] font-black text-gray-400 uppercase">Fully Paid</span>
                                </div>
                              );
                            }
                          })()}
                        </td>
                      <td className="p-4 text-sm text-gray-500 dark:text-gray-400 font-medium">{p.duration}</td>
                      <td className="p-4 text-center">
                         <div className="inline-flex items-center gap-1.5 px-2 py-1 bg-red-50 dark:bg-red-950/40 text-red-600 dark:text-red-400 rounded text-[10px] font-bold border border-red-100 dark:border-red-900/40">
                           <Calendar size={12}/>
                           {p.expired_date}
                         </div>
                      </td>
                      <td className="p-4">
                         <div className="flex items-center justify-center gap-1">
                           <button 
                             type="button"
                             onClick={() => setExpandedFormPayments(prev => ({ ...prev, [p.id || idx]: !prev[p.id || idx] }))}
                             className={cn(
                               "p-1.5 rounded-lg transition-colors text-gray-400 dark:text-gray-500 hover:text-teal-600 hover:bg-teal-50/50"
                             )}
                             title="View & Add Installments"
                           >
                             <ChevronDown size={14} className={cn("transform transition-transform duration-200", isExpanded && "rotate-180")} />
                           </button>
                           <button 
                              onClick={() => handleCopyMessage(p)}
                              className="flex items-center gap-1 px-3 py-1 bg-teal-50 dark:bg-teal-950/40 text-teal-700 dark:text-teal-400 rounded-lg text-xs font-bold hover:bg-teal-100 dark:hover:bg-teal-900/40"
                              title="Copy activation message"
                            >
                             <Copy size={12}/> Msg
                           </button>
                           <button 
                              onClick={() => handleEditPayment(idx)}
                              className="p-1.5 text-gray-300 dark:text-gray-500 hover:text-teal-600 dark:hover:text-teal-400 transition-colors"
                              title="Edit this payment"
                            >
                             <Edit size={16}/>
                           </button>
                           {deletingTempPaymentIdx === idx ? (
                             <div className="flex items-center gap-1 animate-in zoom-in-95 duration-150">
                               <span className="text-[10px] font-black text-red-650 dark:text-red-400 uppercase">Delete?</span>
                               <button 
                                 type="button"
                                 onClick={() => {
                                   if (p.id && existingPaymentIds.has(p.id)) {
                                     setDeletedPaymentIds(prev => [...prev, p.id as string]);
                                   }
                                   // filter using idx to handle unsaved index items correctly
                                   setTempPayments(tempPayments.filter((_, itemIdx) => itemIdx !== idx));
                                   setDeletingTempPaymentIdx(null);
                                   toast.success('Payment record removed');
                                 }}
                                 className="px-2 py-0.5 bg-red-600 text-white text-[9px] font-black rounded uppercase hover:bg-red-700 transition-colors"
                               >
                                 Yes
                               </button>
                               <button 
                                 type="button"
                                 onClick={() => setDeletingTempPaymentIdx(null)}
                                 className="px-2 py-0.5 bg-gray-200 dark:bg-gray-800 text-gray-650 dark:text-gray-300 text-[9px] font-black rounded uppercase hover:bg-gray-300 dark:hover:bg-gray-750 transition-colors"
                               >
                                 No
                               </button>
                             </div>
                           ) : (
                             <button 
                               type="button"
                               onClick={() => {
                                 if (p.installments && p.installments.length > 0) {
                                   toast.error("You can't delete the payment before delete the installments");
                                 } else {
                                   setDeletingTempPaymentIdx(idx);
                                 }
                               }}
                               className="p-1.5 text-gray-300 dark:text-gray-500 hover:text-red-500 transition-colors"
                               title="Remove this payment"
                             >
                               <Trash2 size={16}/>
                             </button>
                           )}
                         </div>
                      </td>
                        </tr>

                        {isExpanded && (
                          <tr className="bg-teal-50/[0.04] dark:bg-teal-950/[0.02]">
                            <td colSpan={8} className="px-6 py-4 border-t border-b border-gray-100 dark:border-gray-800 bg-gray-50/5 dark:bg-gray-900/5 font-sans animate-fade-in">
                              <div className="space-y-4">
                                <div className="flex justify-between items-center border-b border-gray-100 dark:border-gray-850 pb-2">
                                  <h4 className="text-xs font-black text-teal-850 dark:text-teal-400 uppercase tracking-tight flex items-center gap-2">
                                    <CreditCard size={14} />
                                    Installment Billings ({p.installments?.length || 0})
                                  </h4>
                                  <span className="text-[10px] font-mono text-gray-400 dark:text-gray-500 bg-gray-100 dark:bg-gray-800 px-2 py-0.5 rounded">
                                    Class/Package Billing Row Installments
                                  </span>
                                </div>
                                
                                {/* Installments List */}
                                {p.installments && p.installments.length > 0 ? (
                                  <div className="space-y-1.5 max-w-4xl max-h-[220px] overflow-y-auto pr-1">
                                    {p.installments.map((inst, index) => (
                                      <div key={inst.id || index} className="flex flex-col md:flex-row md:items-center justify-between bg-white dark:bg-gray-855 p-3 rounded-xl border border-gray-100 dark:border-gray-800 text-xs shadow-sm hover:shadow-md gap-3 transition-all duration-150 animate-fade-in">
                                        {editingFormInstallmentId === inst.id && editingFormInstallmentData ? (
                                          <div className="w-full space-y-2">
                                            <div className="flex items-center gap-1.5 border-b border-gray-150 pb-1 mb-1">
                                              <span className={`font-black uppercase text-[10px] ${editingFormInstallmentData.is_refund ? 'text-red-700' : 'text-teal-700'}`}>
                                                Editing {editingFormInstallmentData.is_refund ? 'Refund' : 'Installment'} #{index + 1}
                                              </span>
                                            </div>
                                            <div className="grid grid-cols-1 sm:grid-cols-4 gap-2 items-end">
                                              <div>
                                                <label className="text-[9px] font-black text-gray-400 dark:text-gray-500 uppercase block mb-0.5">
                                                  {editingFormInstallmentData.is_refund ? 'Refund Amount (Rs.)' : 'Paid Amount (Rs.)'}
                                                </label>
                                                <input
                                                  type="number"
                                                  className={`w-full text-xs font-bold bg-white dark:bg-gray-800 border rounded-md p-1 font-mono shadow-inner outline-none focus:ring-1 ${
                                                    editingFormInstallmentData.is_refund 
                                                      ? 'text-red-700 dark:text-red-400 border-red-100 dark:border-gray-700 focus:ring-red-500' 
                                                      : 'text-teal-700 dark:text-teal-400 border-teal-100 dark:border-gray-700 focus:ring-teal-500'
                                                  }`}
                                                  value={editingFormInstallmentData.paid_amount || ''}
                                                  onChange={(e) => setEditingFormInstallmentData({ ...editingFormInstallmentData, paid_amount: e.target.value })}
                                                />
                                              </div>
                                              <div>
                                                <label className="text-[9px] font-black text-gray-400 dark:text-gray-500 uppercase block mb-0.5">
                                                  {editingFormInstallmentData.is_refund ? 'Refund Date' : 'Paid Date'}
                                                </label>
                                                <input
                                                  type="date"
                                                  className={`w-full text-xs font-bold bg-white dark:bg-gray-800 border rounded-md p-1 font-mono shadow-inner outline-none focus:ring-1 ${
                                                    editingFormInstallmentData.is_refund 
                                                      ? 'text-red-700 dark:text-red-400 border-red-100 dark:border-gray-700 focus:ring-red-500' 
                                                      : 'text-teal-700 dark:text-teal-400 border-teal-100 dark:border-gray-700 focus:ring-teal-500'
                                                  }`}
                                                  value={editingFormInstallmentData.paid_date ? new Date(editingFormInstallmentData.paid_date).toISOString().split('T')[0] : ''}
                                                  onChange={(e) => setEditingFormInstallmentData({ ...editingFormInstallmentData, paid_date: e.target.value })}
                                                />
                                              </div>
                                              {editingFormInstallmentData.is_refund ? (
                                                <div className="sm:col-span-2">
                                                  <label className="text-[9px] font-black text-gray-400 dark:text-gray-500 uppercase block mb-0.5">Refund Reason</label>
                                                  <input
                                                    type="text"
                                                    className="w-full text-xs font-bold text-red-700 dark:text-red-400 bg-white dark:bg-gray-800 border border-red-100 dark:border-gray-700 rounded-md p-1 shadow-inner outline-none focus:ring-1 focus:ring-red-500"
                                                    value={editingFormInstallmentData.refund_reason || editingFormInstallmentData.duration || ''}
                                                    onChange={(e) => setEditingFormInstallmentData({ ...editingFormInstallmentData, refund_reason: e.target.value, duration: e.target.value })}
                                                    placeholder="Enter reason..."
                                                  />
                                                </div>
                                              ) : (
                                                <>
                                                  <div>
                                                    <label className="text-[9px] font-black text-gray-400 dark:text-gray-500 uppercase block mb-0.5">Activation Date</label>
                                                    <input
                                                      type="date"
                                                      className="w-full text-xs font-bold text-teal-700 dark:text-teal-400 bg-white dark:bg-gray-800 border border-teal-100 dark:border-gray-700 rounded-md p-1 font-mono shadow-inner outline-none focus:ring-1 focus:ring-teal-500"
                                                      value={editingFormInstallmentData.activation_date ? new Date(editingFormInstallmentData.activation_date).toISOString().split('T')[0] : ''}
                                                      onChange={(e) => setEditingFormInstallmentData({ ...editingFormInstallmentData, activation_date: e.target.value })}
                                                    />
                                                  </div>
                                                  <div>
                                                    <label className="text-[9px] font-black text-gray-400 dark:text-gray-500 uppercase block mb-0.5">Duration</label>
                                                    <select
                                                      className="w-full text-xs font-bold text-teal-700 dark:text-teal-400 bg-white dark:bg-gray-800 border border-teal-100 dark:border-gray-700 rounded-md p-1 font-sans outline-none focus:ring-1 focus:ring-teal-500"
                                                      value={editingFormInstallmentData.duration}
                                                      onChange={(e) => setEditingFormInstallmentData({ ...editingFormInstallmentData, duration: e.target.value })}
                                                    >
                                                      {DURATIONS.map(d => <option key={d.label} value={d.label}>{d.label}</option>)}
                                                    </select>
                                                  </div>
                                                </>
                                              )}
                                            </div>
                                            <div className="flex justify-end gap-1.5 mt-2">
                                              <button
                                                type="button"
                                                onClick={() => handleUpdateFormInstallment(p.id, idx)}
                                                className="px-2.5 py-1 bg-emerald-600 text-white text-[10px] font-black rounded-lg uppercase hover:bg-emerald-700 transition-colors shadow-sm"
                                              >
                                                Save
                                              </button>
                                              <button
                                                type="button"
                                                onClick={handleCancelEditFormInstallment}
                                                className="px-2.5 py-1 bg-gray-200 dark:bg-gray-800 text-gray-650 dark:text-gray-400 text-[10px] font-black rounded-lg uppercase hover:bg-gray-300 dark:hover:bg-gray-700 transition-colors"
                                              >
                                                Cancel
                                              </button>
                                            </div>
                                          </div>
                                        ) : (
                                          <>
                                            <div className="flex flex-wrap items-center gap-x-5 gap-y-1">
                                              {Number(inst.paid_amount) < 0 ? (
                                                <>
                                                  <span className="font-extrabold text-red-700 bg-red-50 dark:bg-red-955/45 px-2 py-0.5 rounded-full text-[10px] uppercase font-mono flex items-center gap-1">
                                                    <Minus size={10} /> Refund #{index + 1}
                                                  </span>
                                                  <div>
                                                    <span className="font-bold text-red-450 mr-1 uppercase text-[9px]">Refunded:</span>
                                                    <span className="font-mono font-black text-red-600 dark:text-red-400">Rs. {Math.abs(Number(inst.paid_amount || 0)).toLocaleString()}</span>
                                                  </div>
                                                  <div>
                                                    <span className="font-bold text-red-450 mr-1 uppercase text-[9px]">Date:</span>
                                                    <span className="font-bold text-gray-755 dark:text-gray-400">{formatDate(inst.paid_date)}</span>
                                                  </div>
                                                  <div className="flex items-center gap-1.5">
                                                    <span className="font-bold text-red-450 uppercase text-[9px]">Reason:</span>
                                                    <span className="text-xs font-semibold text-red-700 dark:text-red-400 bg-red-50 dark:bg-red-955 px-2 py-0.5 rounded border border-red-100/30">{inst.refund_reason || inst.duration}</span>
                                                  </div>
                                                </>
                                              ) : (
                                                <>
                                                  <span className="font-extrabold text-teal-700 bg-teal-50 dark:bg-teal-955/45 px-2 py-0.5 rounded-full text-[10px] uppercase font-mono">
                                                    Bill #{index + 1}
                                                  </span>
                                                  <div>
                                                    <span className="font-bold text-gray-450 mr-1 uppercase text-[9px]">Paid:</span>
                                                    <span className="font-mono font-black text-teal-650 dark:text-teal-400">Rs. {Number(inst.paid_amount || 0).toLocaleString()}</span>
                                                  </div>
                                                  <div>
                                                    <span className="font-bold text-gray-450 mr-1 uppercase text-[9px]">Date:</span>
                                                    <span className="font-bold text-gray-755 dark:text-gray-400">{formatDate(inst.paid_date)}</span>
                                                  </div>
                                                  <div>
                                                    <span className="font-bold text-gray-450 mr-1 uppercase text-[9px]">Duration / Package:</span>
                                                    <span className="font-medium text-gray-700 dark:text-gray-350">{formatDate(inst.activation_date)} to {formatDate(inst.expired_date)}</span>
                                                  </div>
                                                  <span className="text-[9px] font-black bg-teal-50 dark:bg-teal-955 px-1.5 py-0.5 rounded text-teal-600 dark:text-teal-400 uppercase tracking-wider">{inst.duration}</span>
                                                </>
                                              )}
                                            </div>
                                            
                                            <div className="flex items-center gap-1 shrink-0">
                                              <button
                                                type="button"
                                                onClick={() => handleStartEditFormInstallment(inst)}
                                                className="p-1.5 text-gray-400 dark:text-gray-500 hover:text-teal-600 hover:bg-teal-50 dark:hover:bg-teal-950/20 rounded transition-colors"
                                                title="Edit Installment"
                                              >
                                                <Edit size={12} />
                                              </button>

                                              {/* Delete Installment */}
                                              {deletingFormInstallmentId === inst.id ? (
                                                <div className="flex items-center gap-1.5 shrink-0 bg-red-50 dark:bg-red-950/45 p-1 rounded-lg">
                                                  <span className="text-[9px] font-black text-red-600 dark:text-red-450 uppercase">Delete?</span>
                                                  <button 
                                                    type="button"
                                                    onClick={() => handleDeleteFormInstallment(inst.id, p.id, idx)}
                                                    className="px-2 py-0.5 bg-red-600 text-white text-[9px] font-black rounded uppercase hover:bg-red-705 transition-colors"
                                                  >
                                                    Confirm
                                                  </button>
                                                  <button 
                                                    type="button"
                                                    onClick={() => setDeletingFormInstallmentId(null)}
                                                    className="px-2 py-0.5 bg-gray-200 dark:bg-gray-850 text-gray-650 dark:text-gray-400 text-[9px] font-black rounded uppercase hover:bg-gray-300 dark:hover:bg-gray-750"
                                                  >
                                                    No
                                                  </button>
                                                </div>
                                              ) : (
                                                <button 
                                                  type="button"
                                                  onClick={() => setDeletingFormInstallmentId(inst.id)}
                                                  className="p-1.5 text-gray-400 dark:text-gray-500 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-950/20 rounded transition-colors"
                                                  title="Delete Installment"
                                                >
                                                  <Trash2 size={12} />
                                                </button>
                                              )}
                                            </div>
                                          </>
                                        )}
                                      </div>
                                    ))}
                                  </div>
                                ) : (
                                  <p className="text-xs text-gray-450 italic bg-white dark:bg-gray-855 p-3 rounded-xl border border-dashed border-gray-200 dark:border-gray-800 text-center animate-fade-in">
                                    No individual installments stored for this payment cycle.
                                  </p>
                                )}

                                {/* Inline Add Installment Form */}
                                <div className="bg-teal-50/20 dark:bg-teal-955/15 p-4 rounded-2xl border border-teal-100/50 dark:border-teal-900/30 space-y-3 max-w-4xl font-sans animate-fade-in">
                                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-2 border-b border-teal-100/30 dark:border-teal-900/20">
                                    <h5 className="text-[10px] font-black text-teal-855 dark:text-teal-400 uppercase tracking-widest flex items-center gap-1.5 font-sans">
                                      <Plus size={12} className="text-teal-650" />
                                      {newFormInstType === 'refund' ? 'Record Refund for this cycle' : 'Record Next Installment Payment'}
                                    </h5>
                                    
                                    {/* Billing vs Refund selector */}
                                    <div className="flex bg-gray-150 dark:bg-gray-800 p-0.5 rounded-lg border border-gray-250 dark:border-gray-700 w-fit self-end sm:self-auto">
                                      <button
                                        type="button"
                                        onClick={() => setNewFormInstType('billing')}
                                        className={`px-3 py-1 text-[9px] font-black uppercase tracking-wider rounded-md transition-all ${
                                          newFormInstType === 'billing'
                                            ? 'bg-teal-600 text-white shadow-sm'
                                            : 'text-gray-500 dark:text-gray-400 hover:text-gray-750 dark:hover:text-gray-200'
                                        }`}
                                      >
                                        Billing / Payment
                                      </button>
                                      <button
                                        type="button"
                                        onClick={() => setNewFormInstType('refund')}
                                        className={`px-3 py-1 text-[9px] font-black uppercase tracking-wider rounded-md transition-all ${
                                          newFormInstType === 'refund'
                                            ? 'bg-red-600 text-white shadow-sm'
                                            : 'text-gray-500 dark:text-gray-400 hover:text-gray-750 dark:hover:text-gray-200'
                                        }`}
                                      >
                                        Refund
                                      </button>
                                    </div>
                                  </div>
                                  
                                  <div className="grid grid-cols-1 md:grid-cols-5 gap-3 items-end">
                                    {/* Amount */}
                                    <div className="space-y-1">
                                      <label className="text-[9px] font-black text-gray-400 dark:text-gray-550 uppercase tracking-wider block">
                                        {newFormInstType === 'refund' ? 'Refund Amount (Rs.)' : 'Paid Amount (Rs.)'}
                                      </label>
                                      <input 
                                        type="number" 
                                        placeholder="e.g. 5000"
                                        value={newFormInstAmount}
                                        onChange={(e) => setNewFormInstAmount(e.target.value)}
                                        className={`w-full text-xs font-bold bg-white dark:bg-gray-850 border rounded-lg p-2 font-mono shadow-inner outline-none focus:ring-1 font-sans ${
                                          newFormInstType === 'refund'
                                            ? 'text-red-700 dark:text-red-400 border-red-100 dark:border-red-900 focus:ring-red-500'
                                            : 'text-teal-700 dark:text-teal-400 border-teal-100 dark:border-gray-700 focus:ring-teal-500'
                                        }`}
                                      />
                                    </div>

                                    {/* Paid Date */}
                                    <div className="space-y-1">
                                      <label className="text-[9px] font-black text-gray-400 dark:text-gray-555 uppercase tracking-wider block">
                                        {newFormInstType === 'refund' ? 'Refund Date' : 'Paid Date'}
                                      </label>
                                      <input 
                                        type="date" 
                                        value={newFormInstPaidDate}
                                        onChange={(e) => setNewFormInstPaidDate(e.target.value)}
                                        className={`w-full text-xs font-bold bg-white dark:bg-gray-855 border rounded-lg p-2 shadow-inner font-sans ${
                                          newFormInstType === 'refund'
                                            ? 'text-red-700 dark:text-red-400 border-red-100 dark:border-red-900 focus:ring-red-500'
                                            : 'text-teal-700 dark:text-teal-400 border-teal-100 dark:border-gray-700 focus:ring-teal-500'
                                        }`}
                                      />
                                    </div>

                                    {newFormInstType === 'refund' ? (
                                      /* Refund Reason Input (takes 2 columns) */
                                      <div className="md:col-span-2 space-y-1">
                                        <label className="text-[9px] font-black text-gray-400 dark:text-gray-555 uppercase tracking-wider block">Refund Reason</label>
                                        <input 
                                          type="text" 
                                          placeholder="Enter the reason for refund..."
                                          value={newFormInstRefundReason}
                                          onChange={(e) => setNewFormInstRefundReason(e.target.value)}
                                          className="w-full text-xs font-bold text-red-700 dark:text-red-400 bg-white dark:bg-gray-855 border border-red-100 dark:border-red-900 rounded-lg p-2 shadow-inner outline-none focus:ring-1 focus:ring-red-500 font-sans"
                                        />
                                      </div>
                                    ) : (
                                      <>
                                        {/* Activation Date */}
                                        <div className="space-y-1">
                                          <label className="text-[9px] font-black text-gray-400 dark:text-gray-555 uppercase tracking-wider block">Activation Date</label>
                                          <input 
                                            type="date" 
                                            value={newFormInstActDate}
                                            onChange={(e) => setNewFormInstActDate(e.target.value)}
                                            className="w-full text-xs font-bold text-teal-700 dark:text-teal-400 bg-white dark:bg-gray-855 border border-teal-100 dark:border-gray-700 rounded-lg p-2 shadow-inner font-sans"
                                          />
                                        </div>

                                        {/* Duration */}
                                        <div className="space-y-1">
                                          <label className="text-[9px] font-black text-gray-400 dark:text-gray-555 uppercase tracking-wider block">Duration</label>
                                          <select
                                            value={newFormInstDuration}
                                            onChange={(e) => setNewFormInstDuration(e.target.value)}
                                            className="w-full text-xs font-bold text-teal-700 dark:text-teal-400 bg-white dark:bg-gray-855 border border-teal-100 dark:border-gray-700 rounded-lg p-2 shadow-inner font-sans"
                                          >
                                            {DURATIONS.map(d => <option key={d.label} value={d.label}>{d.label}</option>)}
                                          </select>
                                        </div>
                                      </>
                                    )}

                                    {/* Action */}
                                    <button 
                                      type="button"
                                      onClick={() => handleAddFormInstallment(p.id, idx)}
                                      className={`w-full py-2 px-3 text-white text-[10px] font-black uppercase tracking-wider rounded-lg shadow-sm hover:shadow transition-all flex items-center justify-center gap-1.5 self-end h-[34px] font-sans ${
                                        newFormInstType === 'refund'
                                          ? 'bg-red-600 hover:bg-red-700'
                                          : 'bg-teal-600 hover:bg-teal-700'
                                      }`}
                                    >
                                      {newFormInstType === 'refund' ? (
                                        <>
                                          <Trash2 size={14} />
                                          Record Refund
                                        </>
                                      ) : (
                                        <>
                                          <Plus size={14} />
                                          Add Bill
                                        </>
                                      )}
                                    </button>
                                  </div>
                                </div>
                              </div>
                            </td>
                          </tr>
                        )}
                      </React.Fragment>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>

      {/* Save Button */}
      <div className="flex justify-end pt-6">
        <button
          onClick={handleSaveAll}
          disabled={loading}
          className="flex items-center gap-2 px-10 py-4 bg-teal-600 text-white font-black text-lg rounded-2xl hover:bg-teal-700 transition-all active:scale-95 shadow-xl shadow-teal-600/30 disabled:opacity-50"
        >
          {loading ? <RefreshCw className="animate-spin" size={24}/> : <Save size={24}/>}
          {loading ? 'Processing...' : 'SAVE DATA'}
        </button>
      </div>

      {/* Duplicate Alert Modal */}
      {showDuplicateAlert && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-gray-900/60 backdrop-blur-sm animate-fade-in" id="duplicate-alert-modal">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-2xl border border-gray-100 transform scale-100 transition-all">
            <div className="flex items-center gap-3 text-red-500 mb-4">
              <div className="p-2 bg-red-50 rounded-full text-red-600">
                <AlertTriangle size={24} />
              </div>
              <h3 className="text-lg font-bold text-gray-900">Duplicate PCA ID</h3>
            </div>
            
            <p className="text-sm text-gray-600 mb-6 leading-relaxed">
              The PCA ID <span className="font-mono font-bold text-red-600">"{studentData.pcaid}"</span> already exists in the student directory. It belongs to:
              <br />
              <strong className="text-gray-900 block mt-2 text-base font-semibold">👤 {existingStudentName || 'Another student'}</strong>
              <br />
              Since PCA ID must be unique, you <span className="text-red-600 font-bold">cannot overwrite</span> or reuse this ID. Please generate or enter a different, unique PCA ID to register this student.
            </p>

            <div className="flex items-center justify-end">
              <button
                type="button"
                onClick={() => setShowDuplicateAlert(false)}
                className="w-full sm:w-auto px-5 py-2.5 bg-teal-600 hover:bg-teal-700 text-white font-bold rounded-xl text-xs transition-colors shadow-md active:scale-95 text-center"
              >
                OK, Got It
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export function StudentExplorer() {
  const navigate = useNavigate();
  const { state: navState } = useLocation();
  const { user } = useAuth();
  const [students, setStudents] = useState<Student[]>([]);
  const [explorerPayments, setExplorerPayments] = useState<{ pcaid: string; class_type: string | null; type: string; paid_date: string | null }[]>([]);
  const [loading, setLoading] = useState(true);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [showClassDropdown, setShowClassDropdown] = useState(false);
  const [showMonthDropdown, setShowMonthDropdown] = useState(false);
  const [showYearDropdown, setShowYearDropdown] = useState(false);
  const [showPackageDropdown, setShowPackageDropdown] = useState(false);
  const [classTypes, setClassTypes] = useState<ClassItem[]>([]);
  const [packageTypes, setPackageTypes] = useState<PackageItem[]>([]);
  
  const [viewingStudent, setViewingStudent] = useState<Student | null>(null);
  
  // Student Form Modal States
  const [isStudentFormModalOpen, setIsStudentFormModalOpen] = useState(false);
  const [modalStudent, setModalStudent] = useState<Student | null>(null);
  const [modalLead, setModalLead] = useState<any | null>(null);
  const [studentPayments, setStudentPayments] = useState<Payment[]>([]);
  const [loadingPayments, setLoadingPayments] = useState(false);
  const [editingPaymentId, setEditingPaymentId] = useState<string | null>(null);
  const [pendingPaymentEdit, setPendingPaymentEdit] = useState<Payment | null>(null);
  const [deletingPaymentId, setDeletingPaymentId] = useState<string | null>(null);
  const [expandedPayments, setExpandedPayments] = useState<Record<string, boolean>>({});
  const [newInstAmount, setNewInstAmount] = useState<string>('');
  const [newInstPaidDate, setNewInstPaidDate] = useState<string>(new Date().toISOString().split('T')[0]);
  const [newInstActDate, setNewInstActDate] = useState<string>(new Date().toISOString().split('T')[0]);
  const [newInstDuration, setNewInstDuration] = useState<string>('1 month');
  const [newInstType, setNewInstType] = useState<'billing' | 'refund'>('billing');
  const [newInstRefundReason, setNewInstRefundReason] = useState<string>('');
  const [deletingInstallmentId, setDeletingInstallmentId] = useState<string | null>(null);
  const [editingInstallmentId, setEditingInstallmentId] = useState<string | null>(null);
  const [editingInstallmentData, setEditingInstallmentData] = useState<any | null>(null);
  const [admins, setAdmins] = useState<{username: string}[]>([]);
  const [selectedAdmin, setSelectedAdmin] = useState<string>(user?.admin_type === 'super_admin' ? '' : user?.username || '');

  const [filters, setFilters] = useState({
    search: navState?.search || '',
    district: '',
    properBatch: '',
    joinedBatch: '',
    classes: [] as string[],
    month: '',
    year: '',
    packages: [] as string[],
    startDate: '',
    endDate: '',
    pcaid: '',
    studentType: ''
  });

  // Dynamically compute clean, unique available years based on payment paid_dates
  const availableYears = React.useMemo(() => {
    const yearsSet = new Set<number>();
    explorerPayments.forEach(p => {
      if (p.paid_date) {
        const yearVal = new Date(p.paid_date).getFullYear();
        if (!isNaN(yearVal)) {
          yearsSet.add(yearVal);
        }
      }
    });
    return Array.from(yearsSet).sort((a, b) => b - a);
  }, [explorerPayments]);

  // Compute clean, unique base class types (without monthly suffix) for the dropdown selection from the class_item table
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
  })))).filter(Boolean).sort();

  // Verification States & Duplicate Check
  const [verifyQuery, setVerifyQuery] = useState('');
  const [verificationStatus, setVerificationStatus] = useState<{
    exists: boolean;
    student?: Student;
    lookupDone: boolean;
  }>({ exists: false, lookupDone: false });

  useEffect(() => {
    const timer = setTimeout(() => {
      if (verifyQuery.trim().length > 3) {
        verifyExplorerStudent();
      } else {
        setVerificationStatus({ exists: false, lookupDone: false });
      }
    }, 500);

    return () => clearTimeout(timer);
  }, [verifyQuery]);

  const verifyExplorerStudent = async () => {
    const query = verifyQuery.trim();
    if (!query) {
      setVerificationStatus({ exists: false, lookupDone: false });
      return;
    }

    // Check by PCA ID or Phone
    const { data } = await supabase
      .from('student')
      .select('*')
      .or(`pcaid.eq.${query.toUpperCase()},phone.eq.${query}`)
      .is('deleted_at', null)
      .maybeSingle();

    setVerificationStatus({
      exists: !!data,
      student: data as Student || undefined,
      lookupDone: true
    });
  };

  const handleGrabExplorerDetails = () => {
    if (verificationStatus.student) {
      setModalStudent(verificationStatus.student);
      setModalLead(null);
      setIsStudentFormModalOpen(true);
      toast.success('Opened edit student form in popup!');
    }
  };

  const handleOpenStudentPayments = (s: Student) => {
    setEditingPaymentId(null);
    setPendingPaymentEdit(null);
    setDeletingPaymentId(null);
    setExpandedPayments({});
    setNewInstAmount('');
    setNewInstPaidDate(new Date().toISOString().split('T')[0]);
    setNewInstActDate(new Date().toISOString().split('T')[0]);
    setNewInstDuration('1 month');
    setDeletingInstallmentId(null);
    setViewingStudent(s);
    fetchStudentPayments(s.pcaid);
  };

  const handleCloseStudentPayments = () => {
    setViewingStudent(null);
    setEditingPaymentId(null);
    setPendingPaymentEdit(null);
    setDeletingPaymentId(null);
    setExpandedPayments({});
    setNewInstAmount('');
    setNewInstPaidDate(new Date().toISOString().split('T')[0]);
    setNewInstActDate(new Date().toISOString().split('T')[0]);
    setNewInstDuration('1 month');
    setDeletingInstallmentId(null);
  };

  const handleViewExplorerStudent = () => {
    if (verificationStatus.student) {
      const s = verificationStatus.student;
      setFilters(prev => ({ ...prev, search: '', pcaid: s.pcaid }));
      handleOpenStudentPayments(s);
      toast.success(`Viewing student ${s.name}`);
    }
  };

  useEffect(() => {
    fetchStudents();
    fetchItems();
    if (user?.admin_type === 'super_admin') {
      fetchAdmins();
    }

    // Fast sync: Listen for changes in student table and payment table
    const subStudents = supabase.channel('student_explorer_sync').on('postgres_changes', { 
      event: '*', 
      schema: 'public', 
      table: 'student' 
    }, () => fetchStudents()).subscribe();

    const subPayments = supabase.channel('payment_explorer_sync').on('postgres_changes', { 
      event: '*', 
      schema: 'public', 
      table: 'payment' 
    }, () => fetchStudents()).subscribe();

    return () => { 
      supabase.removeChannel(subStudents);
      supabase.removeChannel(subPayments);
    };
  }, []);

  const fetchItems = async () => {
    const { data: classes } = await supabase.from('class_item').select('*').order('class_type');
    const { data: packages } = await supabase.from('package_item').select('*').order('package_type');
    if (classes) setClassTypes(classes);
    if (packages) setPackageTypes(packages);
  };

  const fetchAdmins = async () => {
    const { data } = await supabase.from('user').select('username').order('username');
    if (data) setAdmins(data);
  };

  const fetchStudents = async () => {
    if (!user) return;
    setLoading(true);
    let query = supabase.from('student').select('*').is('deleted_at', null);
    
    if (selectedAdmin) {
      query = query.eq('admin', selectedAdmin);
    } else if (user.admin_type !== 'super_admin') {
      // Safety fallback for non-super admins if selectedAdmin is somehow empty
      query = query.eq('admin', user.username);
    }

    const { data } = await query.order('created_at', { ascending: false });
    if (data) setStudents(data as Student[]);

    // Fetch all active payments with paid_date to build filter dropdowns and perform filtering
    const { data: payData } = await supabase
      .from('payment')
      .select('pcaid, class_type, type, paid_date')
      .is('deleted_at', null);
    if (payData) {
      setExplorerPayments(payData);
    }

    setLoading(false);
  };

  useEffect(() => {
    fetchStudents();
  }, [selectedAdmin]);

  const handleDelete = async (student: Student) => {
    try {
      setDeletingId(student.id);
      
      // Soft-delete from parent student table.
      // Database triggers will automatically cascade to soft-delete payments and installments.
      const { error: studentError } = await supabase
        .from('student')
        .update({ deleted_at: new Date().toISOString() })
        .eq('pcaid', student.pcaid);
      
      if (studentError) throw studentError;

      // Log student deletion
      await logTransaction({
        admin_username: user?.username || 'system',
        action_type: 'DELETE',
        entity_type: 'student',
        entity_id: student.pcaid,
        details: `Soft-deleted student ${student.name} (${student.pcaid}). Cascaded payments and installments via DB triggers.`
      });

      toast.success('Student and associated payment records soft-deleted');
      
      // Fast sync: Update local state immediately
      setStudents(prev => prev.filter(s => s.pcaid !== student.pcaid));

    } catch (error) {
      toast.error('Failed to soft-delete student records');
      console.error(error);
    } finally {
      setDeletingId(null);
    }
  };

  const fetchStudentPayments = async (pcaid: string) => {
    setLoadingPayments(true);
    const { data, error } = await supabase
      .from('payment')
      .select('*, installment(*)')
      .eq('pcaid', pcaid)
      .is('deleted_at', null);
    
    if (error) {
      toast.error('Failed to fetch payments');
    } else {
      const mapped = (data || []).map(mapDbPaymentToUI);
      mapped.sort((a, b) => new Date(b.paid_date).getTime() - new Date(a.paid_date).getTime());
      setStudentPayments(mapped);
    }
    setLoadingPayments(false);
  };

  const handleDeletePayment = async (paymentId: string) => {
    // Soft-deleting the payment automatically cascades and soft-deletes associated installments via DB triggers
    const { error } = await supabase
      .from('payment')
      .update({ deleted_at: new Date().toISOString() })
      .eq('id', paymentId);
    
    if (error) {
      toast.error('Failed to delete payment');
    } else {
      toast.success('Payment record soft-deleted');
      // Log payment deletion
      await logTransaction({
        admin_username: user?.username || 'system',
        action_type: 'DELETE',
        entity_type: 'payment',
        entity_id: paymentId,
        details: `Soft-deleted payment record ID: ${paymentId}. Installments soft-deleted via DB trigger cascade.`
      });
      setStudentPayments(prev => prev.filter(p => p.id !== paymentId));
    }
    setDeletingPaymentId(null);
  };

  const handleUpdatePayment = async (payment: Payment) => {
    const paymentPayload = {
      pcaid: payment.pcaid,
      type: payment.type,
      class_type: payment.class_type,
      package_type: payment.package_type,
      payment: payment.total_amount !== undefined ? payment.total_amount : payment.payment, // Total Fee
      paid_date: payment.paid_date,
      activation_date: payment.activation_date,
      duration: payment.duration || '1 month',
      expired_date: payment.expired_date
    };

    const { error: paymentError } = await supabase
      .from('payment')
      .update(paymentPayload)
      .eq('id', payment.id);
    
    if (paymentError) {
      toast.error('Failed to update payment billing record');
      return;
    }

    // Check if installment already exists for this payment_id
    const { data: existingInst } = await supabase
      .from('installment')
      .select('id')
      .eq('payment_id', payment.id);

    const installmentPayload = {
      payment_id: payment.id,
      paid_amount: payment.payment,
      paid_date: payment.paid_date,
      activation_date: payment.activation_date,
      duration: payment.duration || '1 month',
      expired_date: payment.expired_date
    };

    let syncInstallmentError = null;
    if (existingInst && existingInst.length > 0) {
      const { error: updateInstError } = await supabase
        .from('installment')
        .update(installmentPayload)
        .eq('id', existingInst[0].id);
      syncInstallmentError = updateInstError;
    } else {
      const { error: insertInstError } = await supabase
        .from('installment')
        .insert(installmentPayload);
      syncInstallmentError = insertInstError;
    }

    if (syncInstallmentError) {
      toast.error('Failed to update payment installment record');
    } else {
      toast.success('Payment updated');
      setStudentPayments(prev => prev.map(p => p.id === payment.id ? payment : p));
      setEditingPaymentId(null);
    }
  };

  const handleAddInstallment = async (paymentId: string, pcaid: string) => {
    const isRefund = newInstType === 'refund';
    let paidAmt = Number(newInstAmount);
    if (!newInstAmount || isNaN(paidAmt) || paidAmt <= 0) {
      toast.error(isRefund ? 'Please enter a valid refund amount greater than zero' : 'Please enter a valid paid amount greater than zero');
      return;
    }

    if (isRefund) {
      paidAmt = -paidAmt; // negate it
    }

    let durationVal = newInstDuration;
    if (isRefund) {
      if (!newInstRefundReason.trim()) {
        toast.error('Please enter a refund reason');
        return;
      }
      durationVal = newInstRefundReason.trim();
    }

    const expDate = isRefund ? newInstPaidDate : calculateExpiry(newInstActDate, newInstDuration);
    const actDate = isRefund ? newInstPaidDate : newInstActDate;

    const installmentPayload = {
      payment_id: paymentId,
      paid_amount: paidAmt,
      paid_date: newInstPaidDate,
      activation_date: actDate,
      duration: isRefund ? null : durationVal,
      refund_reason: isRefund ? durationVal : null,
      expired_date: expDate
    };

    try {
      const { error: insertError } = await supabase
        .from('installment')
        .insert(installmentPayload);

      if (insertError) throw insertError;

      toast.success(isRefund ? 'Refund recorded successfully' : 'Installment added successfully');
      
      // Reset fields
      setNewInstAmount('');
      setNewInstRefundReason('');
      setNewInstType('billing');
      
      // Refresh payments for this student
      await fetchStudentPayments(pcaid);
    } catch (err: any) {
      console.error(err);
      toast.error(err.message || (isRefund ? 'Failed to record refund' : 'Failed to add installment'));
    }
  };

  const handleDeleteInstallment = async (installmentId: string, pcaid: string) => {
    try {
      const { error } = await supabase
        .from('installment')
        .update({ deleted_at: new Date().toISOString() })
        .eq('id', installmentId);

      if (error) throw error;

      toast.success('Installment soft-deleted');
      setDeletingInstallmentId(null);
      await fetchStudentPayments(pcaid);
    } catch (err: any) {
      console.error(err);
      toast.error(err.message || 'Failed to delete installment');
    }
  };

  const handleStartEditInstallment = (inst: any) => {
    setEditingInstallmentId(inst.id);
    setEditingInstallmentData({ 
      ...inst, 
      paid_amount: Math.abs(inst.paid_amount), 
      is_refund: inst.paid_amount < 0 
    });
  };

  const handleCancelEditInstallment = () => {
    setEditingInstallmentId(null);
    setEditingInstallmentData(null);
  };

  const handleUpdateInstallment = async (pcaid: string) => {
    if (!editingInstallmentData) return;
    const isRefund = !!editingInstallmentData.is_refund;
    let paidAmt = Number(editingInstallmentData.paid_amount);
    if (!editingInstallmentData.paid_amount || isNaN(paidAmt) || paidAmt <= 0) {
      toast.error(isRefund ? 'Please enter a valid refund amount greater than zero' : 'Please enter a valid paid amount greater than zero');
      return;
    }

    if (isRefund) {
      paidAmt = -paidAmt; // negate it
    }

    const expDate = isRefund ? editingInstallmentData.paid_date : calculateExpiry(editingInstallmentData.activation_date, editingInstallmentData.duration);
    const actDate = isRefund ? editingInstallmentData.paid_date : editingInstallmentData.activation_date;

    try {
      const { error } = await supabase
        .from('installment')
        .update({
          paid_amount: paidAmt,
          paid_date: editingInstallmentData.paid_date,
          activation_date: actDate,
          duration: isRefund ? null : editingInstallmentData.duration,
          refund_reason: isRefund ? (editingInstallmentData.refund_reason || editingInstallmentData.duration) : null,
          expired_date: expDate
        })
        .eq('id', editingInstallmentId);

      if (error) throw error;

      toast.success(isRefund ? 'Refund updated successfully' : 'Installment updated successfully');
      setEditingInstallmentId(null);
      setEditingInstallmentData(null);
      await fetchStudentPayments(pcaid);
    } catch (err: any) {
      console.error(err);
      toast.error(err.message || (isRefund ? 'Failed to update refund' : 'Failed to update installment'));
    }
  };

  const handleExport = () => {
    const data = filteredStudents.map((s, idx) => ({
      'No': idx + 1,
      'PCA ID': s.pcaid,
      'Name': s.name,
      'Phone': s.phone,
      'District': s.district,
      'Proper Batch': s.proper_batch,
      'Joined Batch': s.joined_batch,
      'School': s.school,
      'Mail': s.mail,
      'Address': s.address,
      'Classes': s.asked_class_type,
      'Packages': s.asked_package_type,
      'Enrollment Date': formatDate(s.created_at)
    }));
    exportToExcel(data, 'Student_Directory');
  };

  const filteredStudents = students.filter(s => {
    const searchLower = filters.search.toLowerCase();
    const matchesSearch = !filters.search || 
      s.name.toLowerCase().includes(searchLower) || 
      s.pcaid.toLowerCase().includes(searchLower) || 
      s.phone.includes(filters.search);
    
    const matchesPcaidSearch = !filters.pcaid || (s.pcaid && s.pcaid.toLowerCase().includes(filters.pcaid.toLowerCase()));
    
    const matchesDistrict = !filters.district || s.district === filters.district;
    const matchesProperBatch = !filters.properBatch || (s.proper_batch && s.proper_batch.toLowerCase().includes(filters.properBatch.toLowerCase()));
    const matchesJoinedBatch = !filters.joinedBatch || (s.joined_batch && s.joined_batch.toLowerCase().includes(filters.joinedBatch.toLowerCase()));
    
    const studentPayments = explorerPayments.filter(p => p.pcaid === s.pcaid && p.type === 'class');
    const matchesClasses = filters.classes.length === 0 && !filters.month ? true : (
      studentPayments.some(p => {
        if (!p.class_type) return false;
        const ptLower = p.class_type.toLowerCase();
        
        const classMatch = filters.classes.length === 0 || 
          filters.classes.some(c => ptLower.includes(c.toLowerCase()));
          
        const monthMatch = !filters.month || 
          ptLower.endsWith(` ${filters.month.toLowerCase()}`) || 
          ptLower.includes(` ${filters.month.toLowerCase()}`) ||
          ptLower.endsWith(` - ${filters.month.toLowerCase()}`) || 
          ptLower.includes(`- ${filters.month.toLowerCase()}`);
          
        return classMatch && monthMatch;
      })
    );
    
    const matchesPackages = filters.packages.length === 0 || 
      (s.asked_package_type ? filters.packages.some(p => s.asked_package_type.toLowerCase().includes(p.toLowerCase())) : false);
    
    const matchesYear = !filters.year || explorerPayments.some(p => {
      if (p.pcaid === s.pcaid && p.paid_date) {
        const pYear = new Date(p.paid_date).getFullYear();
        return pYear.toString() === filters.year;
      }
      return false;
    });
    
    // Check if scholarship
    let isScholarship = false;
    if (s.pcaid && s.pcaid.length === 10) {
      const last3 = s.pcaid.slice(-3);
      const num = parseInt(last3, 10);
      if (!isNaN(num) && num >= 900 && num <= 999) {
        isScholarship = true;
      }
    }
    const matchesStudentType = !filters.studentType || 
      (filters.studentType === 'Scholarship' && isScholarship) ||
      (filters.studentType === 'Paid' && !isScholarship);

    // Date Range Logic
    const studentDate = s.created_at ? new Date(s.created_at).setHours(0,0,0,0) : null;
    const start = filters.startDate ? new Date(filters.startDate).setHours(0,0,0,0) : null;
    const end = filters.endDate ? new Date(filters.endDate).setHours(0,0,0,0) : null;
    
    let matchesDateRange = true;
    if (studentDate) {
      if (start && studentDate < start) matchesDateRange = false;
      if (end && studentDate > end) matchesDateRange = false;
    } else if (start || end) {
      matchesDateRange = false;
    }

    return matchesSearch && matchesPcaidSearch && matchesDistrict && matchesProperBatch && matchesJoinedBatch && matchesClasses && matchesPackages && matchesDateRange && matchesStudentType && matchesYear;
  });

  return (
    <div className="space-y-4">
      {/* Header Bar with Title, Verification Search, and Actions */}
      <div className="flex flex-wrap items-center gap-3 border-b border-gray-100 pb-3">
        {/* 1. Admin dropdownbox */}
        <div className="flex items-center gap-3">
          {user?.admin_type !== 'super_admin' ? (
            <div className="flex items-center gap-1.5 px-3 py-1 bg-teal-50 text-teal-700 rounded-full border border-teal-100 italic">
              <ShieldCheck size={12} />
              <span className="text-[10px] font-bold">Personal View: {user?.username}</span>
            </div>
          ) : (
            <div className="flex items-center gap-2">
              <span className="text-[10px] font-black text-gray-400 uppercase">Admin:</span>
              <select 
                value={selectedAdmin}
                onChange={(e) => setSelectedAdmin(e.target.value)}
                className="px-3 py-1.5 bg-white border border-gray-200 rounded-lg text-[10px] font-black text-teal-600 uppercase outline-none focus:ring-2 focus:ring-teal-500/20 cursor-pointer shadow-sm"
              >
                <option value="">All Admins (Global)</option>
                {admins.map(a => (
                  <option key={a.username} value={a.username}>{a.username}</option>
                ))}
              </select>
            </div>
          )}
        </div>

        {/* 2. Textbox */}
        <div className="relative group flex-1 max-w-md min-w-[280px]">
          <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-gray-400 group-focus-within:text-teal-600 transition-colors">
            <Search size={16} />
          </div>
          <input
            type="text"
            value={verifyQuery}
            onChange={(e) => setVerifyQuery(e.target.value)}
            className="w-full pl-10 pr-4 py-2 bg-white border border-gray-200 rounded-xl text-sm focus:ring-2 focus:ring-teal-500/20 focus:border-teal-500 transition-all shadow-sm placeholder:text-gray-400 font-bold"
            placeholder="Verify PCA ID or Phone Number..."
          />
          <div className="absolute inset-y-0 right-0 flex items-center py-1.5 pr-1.5 gap-2">
            {verificationStatus.lookupDone && (
              <div className="flex items-center gap-2">
                <div className={cn(
                  "flex items-center gap-1.5 px-3 h-[30px] rounded-lg text-[10px] font-black uppercase tracking-wider animate-in fade-in slide-in-from-right-2 duration-300",
                  verificationStatus.exists ? "bg-red-50 text-red-600 border border-red-100" : "bg-green-50 text-green-600 border border-green-100"
                )}>
                  {verificationStatus.exists ? (
                    <>
                      <ShieldAlert size={12}/>
                      Exists
                    </>
                  ) : (
                    <>
                      <ShieldCheck size={12}/>
                      New
                    </>
                  )}
                </div>
                
                {verificationStatus.exists && (
                  <div className="flex items-center gap-2">
                    <button
                      onClick={handleGrabExplorerDetails}
                      className="flex items-center gap-1.5 px-3 h-[30px] bg-teal-600 hover:bg-teal-700 text-white rounded-lg text-[10px] font-black uppercase tracking-wider transition-colors shadow-sm animate-in zoom-in duration-300 cursor-pointer"
                      title="Edit Student Form"
                    >
                      <RefreshCw size={12} />
                      Grab Data
                    </button>
                    
                    <button
                      onClick={handleViewExplorerStudent}
                      className="flex items-center gap-1.5 px-3 h-[30px] bg-orange-500 hover:bg-orange-600 text-white rounded-lg text-[10px] font-black uppercase tracking-wider transition-colors shadow-sm animate-in zoom-in duration-300 cursor-pointer"
                      title="View student in explorer modal"
                    >
                      <ExternalLink size={12} />
                      View
                    </button>
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Quick Action Badge if student exists */}
          {verificationStatus.exists && verificationStatus.student && (
            <div className="absolute mt-2 z-10 animate-in fade-in slide-in-from-top-1 duration-200">
               <button 
                onClick={handleViewExplorerStudent}
                className="flex items-center gap-2 px-3 py-1 bg-teal-900 text-white rounded-full text-[10px] font-bold hover:bg-black transition-colors shadow-lg cursor-pointer"
              >
                <ExternalLink size={10}/>
                View {verificationStatus.student.name} in Explorer
              </button>
            </div>
          )}
        </div>

        {/* 3. New Student button */}
        <button
          onClick={() => {
            setModalStudent(null);
            setModalLead(null);
            setIsStudentFormModalOpen(true);
          }}
          className="flex items-center justify-center gap-2 px-5 py-2.5 bg-teal-600 hover:bg-teal-700 active:scale-95 text-white rounded-xl font-bold text-sm transition-all shadow-md active:shadow-sm cursor-pointer whitespace-nowrap hover:shadow-lg h-[38px]"
        >
          <Plus size={18} />
          New Student
        </button>

        {/* 4. Export button */}
        <button
          onClick={handleExport}
          className="flex items-center gap-2 px-4 py-2.5 bg-teal-50 text-teal-700 hover:bg-teal-100 rounded-xl font-bold text-sm transition-colors shadow-sm whitespace-nowrap cursor-pointer h-[38px]"
        >
          <FileDown size={18} />
          Export
        </button>
      </div>

      {/* Search and Filters Section */}
      <div className="flex flex-col gap-3 w-full">
        <div className="flex flex-col xl:flex-row items-start xl:items-center justify-between gap-3">
          <div className="flex flex-wrap items-center gap-2 w-full xl:w-auto">
            <div className="flex flex-wrap items-center bg-white rounded-xl shadow-sm border border-gray-100 p-1 gap-1 w-full lg:w-auto">
              {/* Count */}
              <div className="px-3 py-1 bg-teal-50/50 rounded-lg w-full sm:w-auto text-center order-last sm:order-first">
                 <span className="text-[10px] font-black text-teal-600 uppercase whitespace-nowrap">Count: {filteredStudents.length}</span>
              </div>

              {/* Search */}
              <div className="relative flex items-center px-3 min-w-[200px] flex-1">
                <Search size={14} className="text-gray-400 mr-2 flex-shrink-0" />
                <input 
                  type="text"
                  placeholder="Search..."
                  value={filters.search}
                  onChange={(e) => setFilters({ ...filters, search: e.target.value })}
                  className="w-full text-xs font-bold text-gray-600 border-none outline-none bg-transparent placeholder:text-gray-300 py-1.5"
                />
              </div>

              {/* PCAID Filter */}
              <div className="flex items-center px-3 border-l border-gray-100">
                <input 
                  type="text"
                  placeholder="PCAID..."
                  value={filters.pcaid}
                  onChange={(e) => setFilters({ ...filters, pcaid: e.target.value })}
                  className="w-[80px] text-xs font-bold text-gray-600 border-none outline-none bg-transparent placeholder:text-gray-300 py-1.5 uppercase"
                />
              </div>

              {/* District Dropdown */}
              <select 
                value={filters.district}
                onChange={(e) => setFilters({ ...filters, district: e.target.value })}
                className="px-3 py-1.5 text-xs font-bold text-gray-600 border-none outline-none bg-transparent cursor-pointer min-w-[120px]"
              >
                <option value="">All Districts</option>
                {SRI_LANKAN_DISTRICTS.map(d => <option key={d} value={d}>{d}</option>)}
              </select>

              {/* Student Category Dropdown */}
              <select 
                value={filters.studentType}
                onChange={(e) => setFilters({ ...filters, studentType: e.target.value })}
                className="px-3 py-1.5 text-xs font-bold text-gray-600 border-none outline-none bg-transparent cursor-pointer min-w-[130px] border-l border-gray-100"
              >
                <option value="">All Categories</option>
                <option value="Paid">Paid Students</option>
                <option value="Scholarship">Scholarship Holders</option>
              </select>

              <div className="bg-gray-100 w-px my-1 hidden sm:block" />

              {/* Batch Filters */}
              <div className="flex items-center">
                <input 
                  type="text"
                  placeholder="Proper Batch..."
                  value={filters.properBatch}
                  onChange={(e) => setFilters({ ...filters, properBatch: e.target.value })}
                  className="px-3 py-1.5 text-xs font-bold text-gray-600 border-none outline-none bg-transparent w-[100px] placeholder:text-gray-300 border-r border-gray-100"
                />
                <input 
                  type="text"
                  placeholder="Joined Batch..."
                  value={filters.joinedBatch}
                  onChange={(e) => setFilters({ ...filters, joinedBatch: e.target.value })}
                  className="px-3 py-1.5 text-xs font-bold text-gray-600 border-none outline-none bg-transparent w-[100px] placeholder:text-gray-300"
                />
              </div>

              <div className="bg-gray-100 w-px my-1 hidden sm:block" />
              
              {/* Multi-Select Class Filter */}
              <div className="relative">
                <button 
                  onClick={() => setShowClassDropdown(!showClassDropdown)}
                  className="flex items-center gap-1 px-3 py-1.5 text-xs font-bold text-gray-600 outline-none bg-transparent min-w-[130px] justify-between cursor-pointer"
                >
                  <span className="truncate max-w-[100px]">
                    {filters.classes.length === 0 ? 'All Classes' : 
                     filters.classes.length === 1 ? filters.classes[0] : 
                     `${filters.classes.length} Classes`}
                  </span>
                  <ChevronDown size={14} className={`text-gray-400 transition-transform ${showClassDropdown ? 'rotate-180' : ''}`} />
                </button>

                {showClassDropdown && (
                  <>
                    <div className="fixed inset-0 z-40" onClick={() => setShowClassDropdown(false)} />
                    <div className="absolute left-0 mt-2 w-[220px] bg-white rounded-xl shadow-2xl border border-gray-100 py-2 z-50 max-h-[300px] overflow-auto animate-in fade-in zoom-in-95 duration-100">
                      <div className="px-3 py-1 mb-1 border-b border-gray-50 flex items-center justify-between">
                        <span className="text-[10px] font-black text-gray-400 uppercase">Select Classes</span>
                        {filters.classes.length > 0 && (
                          <button 
                            onClick={(e) => { e.stopPropagation(); setFilters({ ...filters, classes: [] }); }}
                            className="text-[10px] font-bold text-teal-600 hover:text-teal-700"
                          >
                            Clear
                          </button>
                        )}
                      </div>
                      {baseClassTypes.map(c => {
                        const isSelected = filters.classes.includes(c);
                        return (
                          <button
                            key={c}
                            onClick={(e) => {
                              e.stopPropagation();
                              const newClasses = isSelected 
                                ? filters.classes.filter(item => item !== c)
                                : [...filters.classes, c];
                              setFilters({ ...filters, classes: newClasses });
                            }}
                            className={`w-full flex items-center justify-between px-3 py-2 text-xs font-bold transition-colors ${isSelected ? 'bg-teal-50 text-teal-700' : 'text-gray-600 hover:bg-gray-50'}`}
                          >
                            {c}
                            {isSelected && <Check size={14} />}
                          </button>
                        );
                      })}
                    </div>
                  </>
                )}
              </div>

              <div className="bg-gray-100 w-px my-1 hidden sm:block" />

              {/* Month Filter */}
              <div className="relative">
                <button 
                  onClick={() => setShowMonthDropdown(!showMonthDropdown)}
                  className="flex items-center gap-1 px-3 py-1.5 text-xs font-bold text-gray-600 outline-none bg-transparent min-w-[120px] justify-between cursor-pointer"
                >
                  <span className="truncate max-w-[90px]">
                    {filters.month || 'All Months'}
                  </span>
                  <ChevronDown size={14} className={`text-gray-400 transition-transform ${showMonthDropdown ? 'rotate-180' : ''}`} />
                </button>

                {showMonthDropdown && (
                  <>
                    <div className="fixed inset-0 z-40" onClick={() => setShowMonthDropdown(false)} />
                    <div className="absolute left-0 mt-2 w-[180px] bg-white rounded-xl shadow-2xl border border-gray-100 py-2 z-50 max-h-[300px] overflow-auto animate-in fade-in zoom-in-95 duration-100">
                      <div className="px-3 py-1 mb-1 border-b border-gray-50 flex items-center justify-between">
                        <span className="text-[10px] font-black text-gray-400 uppercase">Select Month</span>
                        {filters.month && (
                          <button 
                            onClick={(e) => { e.stopPropagation(); setFilters({ ...filters, month: '' }); setShowMonthDropdown(false); }}
                            className="text-[10px] font-bold text-teal-600 hover:text-teal-700"
                          >
                            Clear
                          </button>
                        )}
                      </div>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          setFilters({ ...filters, month: '' });
                          setShowMonthDropdown(false);
                        }}
                        className={`w-full flex items-center justify-between px-3 py-2 text-xs font-bold transition-colors ${!filters.month ? 'bg-teal-50 text-teal-700' : 'text-gray-600 hover:bg-gray-50'}`}
                      >
                        All Months
                        {!filters.month && <Check size={14} />}
                      </button>
                      {MONTHS.map(m => {
                        const isSelected = filters.month === m;
                        return (
                          <button
                            key={m}
                            onClick={(e) => {
                              e.stopPropagation();
                              setFilters({ ...filters, month: m });
                              setShowMonthDropdown(false);
                            }}
                            className={`w-full flex items-center justify-between px-3 py-2 text-xs font-bold transition-colors ${isSelected ? 'bg-teal-50 text-teal-700' : 'text-gray-600 hover:bg-gray-50'}`}
                          >
                            {m}
                            {isSelected && <Check size={14} />}
                          </button>
                        );
                      })}
                    </div>
                  </>
                )}
              </div>

              <div className="bg-gray-100 w-px my-1 hidden sm:block" />

              {/* Year Filter */}
              <div className="relative">
                <button 
                  onClick={() => setShowYearDropdown(!showYearDropdown)}
                  className="flex items-center gap-1 px-3 py-1.5 text-xs font-bold text-gray-600 outline-none bg-transparent min-w-[110px] justify-between cursor-pointer"
                >
                  <span className="truncate max-w-[80px]">
                    {filters.year || 'All Years'}
                  </span>
                  <ChevronDown size={14} className={`text-gray-400 transition-transform ${showYearDropdown ? 'rotate-180' : ''}`} />
                </button>

                {showYearDropdown && (
                  <>
                    <div className="fixed inset-0 z-40" onClick={() => setShowYearDropdown(false)} />
                    <div className="absolute left-0 mt-2 w-[150px] bg-white rounded-xl shadow-2xl border border-gray-100 py-2 z-50 max-h-[300px] overflow-auto animate-in fade-in zoom-in-95 duration-100">
                      <div className="px-3 py-1 mb-1 border-b border-gray-50 flex items-center justify-between">
                        <span className="text-[10px] font-black text-gray-400 uppercase">Select Year</span>
                        {filters.year && (
                          <button 
                            onClick={(e) => { e.stopPropagation(); setFilters({ ...filters, year: '' }); setShowYearDropdown(false); }}
                            className="text-[10px] font-bold text-teal-600 hover:text-teal-700"
                          >
                            Clear
                          </button>
                        )}
                      </div>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          setFilters({ ...filters, year: '' });
                          setShowYearDropdown(false);
                        }}
                        className={`w-full flex items-center justify-between px-3 py-2 text-xs font-bold transition-colors ${!filters.year ? 'bg-teal-50 text-teal-700' : 'text-gray-600 hover:bg-gray-50'}`}
                      >
                        All Years
                        {!filters.year && <Check size={14} />}
                      </button>
                      {availableYears.map(y => {
                        const isSelected = filters.year === y.toString();
                        return (
                          <button
                            key={y}
                            onClick={(e) => {
                              e.stopPropagation();
                              setFilters({ ...filters, year: y.toString() });
                              setShowYearDropdown(false);
                            }}
                            className={`w-full flex items-center justify-between px-3 py-2 text-xs font-bold transition-colors ${isSelected ? 'bg-teal-50 text-teal-700' : 'text-gray-600 hover:bg-gray-50'}`}
                          >
                            {y}
                            {isSelected && <Check size={14} />}
                          </button>
                        );
                      })}
                    </div>
                  </>
                )}
              </div>

              <div className="bg-gray-100 w-px my-1 hidden sm:block" />

              {/* Multi-Select Package Filter */}
              <div className="relative">
                <button 
                  onClick={() => setShowPackageDropdown(!showPackageDropdown)}
                  className="flex items-center gap-1 px-3 py-1.5 text-xs font-bold text-gray-600 outline-none bg-transparent min-w-[130px] justify-between cursor-pointer"
                >
                  <span className="truncate max-w-[100px]">
                    {filters.packages.length === 0 ? 'All Packages' : 
                     filters.packages.length === 1 ? filters.packages[0] : 
                     `${filters.packages.length} Packages`}
                  </span>
                  <ChevronDown size={14} className={`text-gray-400 transition-transform ${showPackageDropdown ? 'rotate-180' : ''}`} />
                </button>

                {showPackageDropdown && (
                  <>
                    <div className="fixed inset-0 z-40" onClick={() => setShowPackageDropdown(false)} />
                    <div className="absolute left-0 mt-2 w-[220px] bg-white rounded-xl shadow-2xl border border-gray-100 py-2 z-50 max-h-[300px] overflow-auto animate-in fade-in zoom-in-95 duration-100">
                      <div className="px-3 py-1 mb-1 border-b border-gray-50 flex items-center justify-between">
                        <span className="text-[10px] font-black text-gray-400 uppercase">Select Packages</span>
                        {filters.packages.length > 0 && (
                          <button 
                            onClick={(e) => { e.stopPropagation(); setFilters({ ...filters, packages: [] }); }}
                            className="text-[10px] font-bold text-teal-600 hover:text-teal-700"
                          >
                            Clear
                          </button>
                        )}
                      </div>
                      {packageTypes.map(p => {
                        const isSelected = filters.packages.includes(p.package_type);
                        return (
                          <button
                            key={p.id}
                            onClick={(e) => {
                              e.stopPropagation();
                              const newPackages = isSelected 
                                ? filters.packages.filter(item => item !== p.package_type)
                                : [...filters.packages, p.package_type];
                              setFilters({ ...filters, packages: newPackages });
                            }}
                            className={`w-full flex items-center justify-between px-3 py-2 text-xs font-bold transition-colors ${isSelected ? 'bg-teal-50 text-teal-700' : 'text-gray-600 hover:bg-gray-50'}`}
                          >
                            {p.package_type}
                            {isSelected && <Check size={14} />}
                          </button>
                        );
                      })}
                    </div>
                  </>
                )}
              </div>

              <div className="bg-gray-100 w-px my-1 hidden sm:block" />

              {/* Date Range Filter */}
              <div className="flex items-center px-2 py-1.5 w-full sm:w-auto border-t sm:border-t-0 sm:border-l border-gray-100 mt-1 sm:mt-0">
                <Calendar size={14} className="text-gray-400 mr-2 flex-shrink-0" />
                <div className="flex items-center gap-1 flex-1">
                  <input 
                    type="date"
                    value={filters.startDate}
                    onChange={(e) => setFilters({ ...filters, startDate: e.target.value })}
                    className="text-[10px] font-bold text-gray-600 border-none outline-none bg-transparent cursor-pointer flex-1"
                    title="From Date"
                  />
                  <span className="text-[10px] text-gray-300 font-bold">to</span>
                  <input 
                    type="date"
                    value={filters.endDate}
                    onChange={(e) => setFilters({ ...filters, endDate: e.target.value })}
                    className="text-[10px] font-bold text-gray-600 border-none outline-none bg-transparent cursor-pointer flex-1"
                    title="To Date"
                  />
                </div>
              </div>

              {/* Clear Filters Button */}
              {(filters.district || filters.classes.length > 0 || filters.packages.length > 0 || filters.startDate || filters.endDate || filters.search || filters.properBatch || filters.joinedBatch || filters.pcaid || filters.studentType || filters.month || filters.year) && (
                <>
                  <div className="bg-gray-100 w-px my-1 hidden sm:block" />
                  <button
                    onClick={() => setFilters({ district: '', classes: [], packages: [], startDate: '', endDate: '', search: '', properBatch: '', joinedBatch: '', pcaid: '', studentType: '', month: '', year: '' })}
                    className="flex items-center gap-1.5 px-3 py-1.5 bg-red-50 hover:bg-red-100 text-red-600 rounded-lg font-bold text-xs transition-colors cursor-pointer whitespace-nowrap border border-red-100 ml-1"
                    title="Clear All Filters"
                  >
                    <X size={14} />
                    <span>Clear Filters</span>
                  </button>
                </>
              )}
            </div>
          </div>
        </div>
      </div>

      <div className="bg-white dark:bg-gray-900 rounded-2xl shadow-sm border border-gray-100 dark:border-gray-800 overflow-hidden">
        <div className="max-h-[600px] overflow-y-auto overflow-x-auto scrollbar-visible">
          <table className="w-full text-left border-collapse min-w-[850px] table-fixed">
            <thead className="sticky top-0 z-20">
              <tr className="bg-teal-600">
                <th className="p-4 font-bold text-white text-center w-[50px]">No</th>
                <th className="p-4 font-bold text-white w-[140px]">PCA ID</th>
                <th className="p-4 font-bold text-white">Student Name</th>
                <th className="p-4 font-bold text-white w-[190px]">Phone</th>
                <th className="p-4 font-bold text-white w-[140px]">District</th>
                <th className="p-4 font-bold text-white text-center w-[140px]">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50 dark:divide-gray-800/60">
              {loading ? (
                <tr><td colSpan={6} className="p-10 text-center text-gray-400 dark:text-gray-500 bg-white dark:bg-gray-900">Loading students...</td></tr>
              ) : filteredStudents.length === 0 ? (
                <tr><td colSpan={6} className="p-10 text-center text-gray-400 dark:text-gray-500 bg-white dark:bg-gray-900">No students found</td></tr>
              ) : (
                filteredStudents.map((s, idx) => (
                  <tr key={s.id} className="hover:bg-gray-50/50 dark:hover:bg-gray-800/20 transition-colors group">
                    <td className="p-4 text-center text-gray-400 dark:text-gray-550 text-sm bg-white dark:bg-gray-900 group-hover:bg-gray-50/50 dark:group-hover:bg-gray-800/20">{idx + 1}</td>
                    <td className="p-4 font-mono font-bold bg-white dark:bg-gray-900 group-hover:bg-gray-50/50 dark:group-hover:bg-gray-800/20">
                      <div className="flex items-center gap-2">
                        <span 
                          onClick={() => {
                            setModalStudent(s);
                            setModalLead(null);
                            setIsStudentFormModalOpen(true);
                          }}
                          className="text-teal-600 dark:text-teal-400 hover:text-teal-700 dark:hover:text-teal-300 cursor-pointer transition-colors"
                          title="Click to Edit Student"
                        >
                          {s.pcaid}
                        </span>
                        <button 
                          onClick={(e) => {
                            e.stopPropagation();
                            toast.success(copyToClipboard(s.pcaid, 'PCA ID'));
                          }}
                          className="p-1 text-gray-300 dark:text-gray-600 hover:text-teal-600 dark:hover:text-teal-400 transition-colors"
                        >
                          <Copy size={12}/>
                        </button>
                      </div>
                    </td>
                    <td className="p-4 bg-white dark:bg-gray-900 group-hover:bg-gray-50/50 dark:group-hover:bg-gray-800/20">
                      <div className="flex items-center gap-2 font-bold text-gray-900 dark:text-gray-100">
                        <span 
                          onClick={() => {
                            setModalStudent(s);
                            setModalLead(null);
                            setIsStudentFormModalOpen(true);
                          }}
                          className="hover:text-teal-600 dark:hover:text-teal-400 cursor-pointer underline decoration-dotted transition-colors"
                          title="Click to Edit Student"
                        >
                          {s.name}
                        </span>
                        <button 
                          onClick={(e) => {
                            e.stopPropagation();
                            toast.success(copyToClipboard(s.name, 'Name'));
                          }}
                          className="p-1 text-gray-300 dark:text-gray-600 hover:text-teal-600 dark:hover:text-teal-400 transition-colors"
                        >
                          <Copy size={12}/>
                        </button>
                      </div>
                    </td>
                    <td className="p-4 text-sm text-gray-600 dark:text-gray-300 bg-white dark:bg-gray-900 group-hover:bg-gray-50/50 dark:group-hover:bg-gray-800/20">
                      <div className="flex items-center gap-1.5 font-mono whitespace-nowrap flex-nowrap">
                        <span>{s.phone}</span>
                        <div className="flex items-center gap-0.5">
                          <button 
                            onClick={() => toast.success(copyToClipboard(s.phone, 'Phone'))}
                            className="p-1 text-gray-300 dark:text-gray-600 hover:text-teal-600 dark:hover:text-teal-400 transition-colors cursor-pointer"
                            title="Copy Phone Number"
                          >
                            <Copy size={12}/>
                          </button>
                          <a 
                            href={`https://wa.me/${s.phone.replace(/\D/g, '')}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="p-1 text-green-500 hover:text-green-600 dark:text-green-400 dark:hover:text-green-300 transition-colors flex items-center justify-center cursor-pointer"
                            title="Chat on WhatsApp"
                          >
                            <MessageCircle size={13} className="fill-green-500/10 dark:fill-green-400/10" />
                          </a>
                        </div>
                      </div>
                    </td>
                    <td className="p-4 text-sm text-gray-600 dark:text-gray-300 bg-white dark:bg-gray-900 group-hover:bg-gray-50/50 dark:group-hover:bg-gray-800/20">
                      <div className="flex items-center gap-2">
                        {s.district}
                        <button 
                          onClick={() => toast.success(copyToClipboard(s.district || '', 'District'))}
                          className="p-1 text-gray-300 dark:text-gray-600 hover:text-teal-600 dark:hover:text-teal-400 transition-colors"
                        >
                          <Copy size={12}/>
                        </button>
                      </div>
                    </td>
                    <td className="p-4 bg-white dark:bg-gray-900 group-hover:bg-gray-50/50 dark:group-hover:bg-gray-800/20 text-center">
                      <div className="flex items-center justify-center gap-2">
                        <button 
                          onClick={() => handleOpenStudentPayments(s)}
                          className="p-2 text-gray-400 hover:text-teal-600 hover:bg-teal-50 rounded-lg transition-colors"
                          title="View Payments"
                        >
                          <Eye size={18} />
                        </button>
                        <button 
                          onClick={() => {
                            setModalStudent(s);
                            setModalLead(null);
                            setIsStudentFormModalOpen(true);
                          }}
                          className="p-2 text-gray-400 hover:text-teal-600 hover:bg-teal-50 rounded-lg transition-colors"
                          title="Edit Student"
                        >
                          <Edit size={18} />
                        </button>
                        {deletingId === s.id ? (
                          <div className="flex items-center gap-1">
                            <button onClick={() => handleDelete(s)} className="px-2 py-1 bg-red-600 text-white text-[10px] font-black rounded uppercase">Yes</button>
                            <button onClick={() => setDeletingId(null)} className="px-2 py-1 bg-gray-200 text-gray-600 text-[10px] font-black rounded uppercase">No</button>
                          </div>
                        ) : (
                          <button 
                            onClick={() => setDeletingId(s.id)}
                            className="p-2 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                          >
                            <Trash2 size={18} />
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Payment Details Modal */}
      {viewingStudent && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-teal-900/40 backdrop-blur-sm animate-in fade-in duration-300">
          <div className="bg-white rounded-3xl shadow-2xl w-full max-w-4xl max-h-[85vh] overflow-hidden flex flex-col border border-teal-100 animate-in zoom-in-95 duration-300">
            {/* Header */}
            <div className="px-6 py-4 bg-teal-50 border-b border-teal-100 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-teal-100 rounded-xl text-teal-600">
                  <CreditCard size={20}/>
                </div>
                <div>
                  <h3 className="font-black text-teal-900 uppercase tracking-tighter">Payment History</h3>
                  <p className="text-[10px] font-bold text-teal-600 uppercase italic leading-none">
                    {viewingStudent.name} • {viewingStudent.pcaid}
                  </p>
                </div>
              </div>
              <button 
                onClick={handleCloseStudentPayments}
                className="p-2 hover:bg-teal-100 rounded-xl transition-colors text-teal-400 hover:text-teal-600"
              >
                <X size={20}/>
              </button>
            </div>

            {/* Content */}
            <div className="p-6 overflow-auto flex-1">
              {loadingPayments ? (
                <div className="flex flex-col items-center justify-center py-20 gap-4">
                  <RefreshCw className="animate-spin text-teal-600" size={32}/>
                  <span className="text-xs font-bold text-gray-400 uppercase">Fetching payments...</span>
                </div>
              ) : studentPayments.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-20 text-center">
                  <div className="w-16 h-16 bg-gray-50 rounded-full flex items-center justify-center mb-4">
                    <CreditCard size={32} className="text-gray-200" />
                  </div>
                  <p className="text-sm font-bold text-gray-400 italic">No payment history found for this student.</p>
                </div>
              ) : (
                <div className="overflow-x-auto border border-gray-100 dark:border-gray-800 rounded-2xl bg-white dark:bg-gray-900">
                  <table className="w-full text-left">
                    <thead>
                      <tr className="bg-gray-50 dark:bg-gray-850">
                        <th className="px-4 py-3 text-[10px] font-black text-gray-400 dark:text-gray-500 uppercase">Paid Date</th>
                        <th className="px-4 py-3 text-[10px] font-black text-gray-400 dark:text-gray-500 uppercase">Activation</th>
                        <th className="px-4 py-3 text-[10px] font-black text-gray-400 dark:text-gray-500 uppercase">Expiry</th>
                        <th className="px-4 py-3 text-[10px] font-black text-gray-400 dark:text-gray-500 uppercase">Type</th>
                        <th className="px-4 py-3 text-[10px] font-black text-gray-400 dark:text-gray-500 uppercase">Details</th>
                        <th className="px-4 py-3 text-[10px] font-black text-gray-400 dark:text-gray-500 uppercase">Total Fee</th>
                        <th className="px-4 py-3 text-[10px] font-black text-gray-400 dark:text-gray-500 uppercase">Paid Amount</th>
                        <th className="px-4 py-3 text-[10px] font-black text-gray-400 dark:text-gray-500 uppercase">Balance</th>
                        <th className="px-4 py-3 text-[10px] font-black text-gray-400 dark:text-gray-500 uppercase text-center">Actions</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-50 dark:divide-gray-800/60 font-sans">
                      {studentPayments.map(p => {
                        const isEditing = editingPaymentId === p.id;
                        const currentData = isEditing ? pendingPaymentEdit : p;
                        const isExpanded = !!expandedPayments[p.id];
                        
                        return (
                          <React.Fragment key={p.id}>
                            <tr className="hover:bg-gray-50/50 dark:hover:bg-gray-800/20 transition-colors bg-white dark:bg-gray-900">
                              <td className="px-4 py-3 whitespace-nowrap">
                                {isEditing && pendingPaymentEdit ? (
                                  <input 
                                    type="date" 
                                    value={pendingPaymentEdit.paid_date}
                                    onChange={(e) => setPendingPaymentEdit({ ...pendingPaymentEdit, paid_date: e.target.value })}
                                    className="text-[11px] font-bold text-teal-700 dark:text-teal-400 bg-teal-50 dark:bg-gray-850 border border-teal-150 dark:border-gray-700 rounded px-1"
                                  />
                                ) : (
                                  <span className="text-[11px] font-bold text-gray-600 dark:text-gray-300">{formatDate(p.paid_date)}</span>
                                )}
                              </td>
                              <td className="px-4 py-3 whitespace-nowrap">
                                {isEditing && pendingPaymentEdit ? (
                                  <input 
                                    type="date" 
                                    value={pendingPaymentEdit.activation_date}
                                    onChange={(e) => {
                                      const newDate = e.target.value;
                                      setPendingPaymentEdit({ 
                                        ...pendingPaymentEdit, 
                                        activation_date: newDate,
                                        expired_date: calculateExpiry(newDate, pendingPaymentEdit.duration)
                                      });
                                    }}
                                    className="text-[11px] font-bold text-teal-700 dark:text-teal-400 bg-teal-50 dark:bg-gray-850 border border-teal-150 dark:border-gray-700 rounded px-1"
                                  />
                                ) : (
                                  <span className="text-[11px] font-bold text-gray-600 dark:text-gray-300">{formatDate(p.activation_date)}</span>
                                )}
                              </td>
                              <td className="px-4 py-3 whitespace-nowrap">
                                {isEditing && pendingPaymentEdit ? (
                                  <div className="text-[11px] font-bold text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-950/40 border border-red-100 dark:border-red-900/40 rounded px-1">
                                    {pendingPaymentEdit.expired_date}
                                  </div>
                                ) : (
                                  <span className="text-[11px] font-bold text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-950/40 px-1 rounded">{formatDate(p.expired_date)}</span>
                                )}
                              </td>
                              <td className="px-4 py-3">
                                <span className={`px-2 py-0.5 rounded text-[10px] font-black uppercase ${p.type === 'class' ? 'bg-blue-50 dark:bg-blue-950/40 text-blue-600 dark:text-blue-450 border border-blue-100 dark:border-blue-900/40' : 'bg-purple-50 dark:bg-purple-950/40 text-purple-600 dark:text-purple-450 border border-purple-100 dark:border-purple-900/40'}`}>
                                  {p.type}
                                </span>
                              </td>
                              <td className="px-4 py-3">
                                <span className="text-[11px] font-bold text-gray-900 dark:text-gray-100">{p.type === 'class' ? p.class_type : p.package_type}</span>
                              </td>
                              <td className="px-4 py-3">
                                {isEditing && pendingPaymentEdit ? (
                                  <div className="space-y-1">
                                    <span className="text-[9px] font-bold text-gray-400 block uppercase">Total Fee</span>
                                    <input 
                                      type="number" 
                                      placeholder="Total Fee"
                                      value={pendingPaymentEdit.total_amount !== undefined ? pendingPaymentEdit.total_amount : ''}
                                      onChange={(e) => setPendingPaymentEdit({ 
                                        ...pendingPaymentEdit, 
                                        total_amount: e.target.value ? Number(e.target.value) : undefined 
                                      })}
                                      className="w-24 text-[11px] font-bold text-gray-700 dark:text-gray-200 bg-white dark:bg-gray-850 border border-teal-150 dark:border-gray-700 rounded px-1 block font-mono"
                                    />
                                  </div>
                                ) : (
                                  <span className="text-[11px] font-bold text-gray-650 dark:text-gray-300 font-mono">
                                    Rs. {(p.total_amount !== undefined ? p.total_amount : p.payment)?.toLocaleString()}
                                  </span>
                                )}
                              </td>
                              <td className="px-4 py-3">
                                {isEditing && pendingPaymentEdit ? (
                                  <div className="space-y-2">
                                    <div className="space-y-1">
                                      <div className="flex justify-between items-center gap-2">
                                        <span className="text-[9px] font-bold text-teal-600 block uppercase">Paid Amount</span>
                                        {pendingPaymentEdit.total_amount !== undefined && (
                                          (() => {
                                            const diff = pendingPaymentEdit.total_amount - pendingPaymentEdit.payment;
                                            if (diff > 0) {
                                              return (
                                                <span className="text-[9px] font-black text-red-500 block">
                                                  Pen: LKR {diff.toLocaleString()}
                                                </span>
                                              );
                                            } else if (diff < 0) {
                                              return (
                                                <span className="text-[9px] font-black text-emerald-500 block">
                                                  Over: LKR {Math.abs(diff).toLocaleString()}
                                                </span>
                                              );
                                            } else {
                                              return (
                                                <span className="text-[9px] font-black text-gray-400 block">
                                                  Paid
                                                </span>
                                              );
                                            }
                                          })()
                                        )}
                                      </div>
                                      <input 
                                        type="number" 
                                        value={pendingPaymentEdit.payment}
                                        onChange={(e) => setPendingPaymentEdit({ ...pendingPaymentEdit, payment: Number(e.target.value) })}
                                        className="w-24 text-[11px] font-bold text-teal-700 dark:text-teal-400 bg-teal-50 dark:bg-gray-850 border border-teal-150 dark:border-gray-700 rounded px-1 block font-mono"
                                      />
                                    </div>
                                    <select
                                      value={pendingPaymentEdit.duration}
                                      onChange={(e) => {
                                        const newDuration = e.target.value;
                                        setPendingPaymentEdit({
                                          ...pendingPaymentEdit,
                                          duration: newDuration,
                                          expired_date: calculateExpiry(pendingPaymentEdit.activation_date, newDuration)
                                        });
                                      }}
                                      className="text-[11px] font-bold text-teal-700 dark:text-teal-400 bg-white dark:bg-gray-850 border border-teal-150 dark:border-gray-700 rounded px-1 block"
                                    >
                                      {DURATIONS.map(d => <option key={d.label} value={d.label}>{d.label}</option>)}
                                    </select>
                                  </div>
                                ) : (
                                  <div className="flex flex-col">
                                    <span className="text-[11px] font-black text-teal-600 dark:text-teal-400 font-mono">Rs. {p.payment?.toLocaleString()}</span>
                                    <span className="text-[9px] font-bold text-gray-400 dark:text-gray-500 capitalize">{p.duration}</span>
                                  </div>
                                )}
                              </td>
                              <td className="px-4 py-3 font-mono">
                                {(() => {
                                  const activeData = isEditing && pendingPaymentEdit ? pendingPaymentEdit : p;
                                  const totFee = activeData.total_amount !== undefined ? activeData.total_amount : activeData.payment;
                                  const diff = totFee - (activeData.payment || 0);
                                  if (diff > 0) {
                                    return (
                                      <div className="flex flex-col">
                                        <span className="text-[11px] font-black text-red-500">Rs. {diff.toLocaleString()}</span>
                                        <span className="text-[9px] font-bold text-red-400 uppercase">Balance to Pay</span>
                                      </div>
                                    );
                                  } else if (diff < 0) {
                                    return (
                                      <div className="flex flex-col">
                                        <span className="text-[11px] font-black text-emerald-500">Rs. {Math.abs(diff).toLocaleString()}</span>
                                        <span className="text-[9px] font-bold text-emerald-400 uppercase">Overpaid</span>
                                      </div>
                                    );
                                  } else {
                                    return (
                                      <div className="flex flex-col">
                                        <span className="text-[11px] text-gray-400">Rs. 0</span>
                                        <span className="text-[9px] font-bold text-gray-450 uppercase">Fully Paid</span>
                                      </div>
                                    );
                                  }
                                })()}
                              </td>
                              <td className="px-4 py-3">
                                <div className="flex items-center justify-center gap-1">
                                  {isEditing ? (
                                    <>
                                      <button 
                                        onClick={() => pendingPaymentEdit && handleUpdatePayment(pendingPaymentEdit)}
                                        className="p-1.5 bg-teal-600 text-white rounded-lg hover:bg-teal-700 transition-colors"
                                        title="Save Changes"
                                      >
                                        <Save size={14} />
                                      </button>
                                      <button 
                                        onClick={() => { setEditingPaymentId(null); setPendingPaymentEdit(null); }}
                                        className="p-1.5 bg-gray-100 text-gray-450 rounded-lg hover:bg-gray-200 transition-colors"
                                        title="Cancel"
                                      >
                                        <X size={14} />
                                      </button>
                                    </>
                                  ) : (
                                    <>
                                      {/* Chevron Slide for Installment list */}
                                      <button 
                                        onClick={() => setExpandedPayments(prev => ({ ...prev, [p.id]: !isExpanded }))}
                                        className={`p-1.5 rounded-lg transition-colors flex items-center justify-center gap-1 border ${isExpanded ? 'bg-teal-50 border-teal-200 text-teal-700 dark:bg-teal-950/40 dark:border-teal-900/60 dark:text-teal-400' : 'text-gray-450 dark:text-gray-500 hover:text-teal-650 hover:bg-teal-50 dark:hover:bg-teal-950/20 border-transparent'}`}
                                        title={isExpanded ? "Hide Installments" : "Show / Record Installments"}
                                      >
                                        <ChevronDown size={14} className={`transform transition-transform duration-200 ${isExpanded ? 'rotate-180' : ''}`} />
                                        {p.installments && p.installments.length > 0 && (
                                          <span className="text-[9px] font-black bg-teal-100 dark:bg-teal-900 px-1 py-0.2 rounded font-mono">{p.installments.length}</span>
                                        )}
                                      </button>

                                      <button 
                                        onClick={() => { setEditingPaymentId(p.id); setPendingPaymentEdit(p); }}
                                        className="p-1.5 text-gray-450 dark:text-gray-500 hover:text-teal-600 dark:hover:text-teal-400 hover:bg-teal-50 dark:hover:bg-teal-950/40 rounded-lg transition-colors"
                                        title="Edit Payment"
                                      >
                                        <Edit size={14} />
                                      </button>
                                      
                                      {deletingPaymentId === p.id ? (
                                        <div className="flex items-center gap-1">
                                          <button 
                                            onClick={() => handleDeletePayment(p.id)}
                                            className="px-2 py-1 bg-red-600 text-white text-[8px] font-black rounded uppercase"
                                          >
                                            Yes
                                          </button>
                                          <button 
                                            onClick={() => setDeletingPaymentId(null)}
                                            className="px-2 py-1 bg-gray-200 dark:bg-gray-800 text-gray-600 dark:text-gray-300 text-[8px] font-black rounded uppercase border border-transparent dark:border-gray-700"
                                          >
                                            No
                                          </button>
                                        </div>
                                      ) : (
                                        <button 
                                          onClick={() => {
                                            if (p.installments && p.installments.length > 0) {
                                              toast.error("You can't delete the payment before delete the installments");
                                            } else {
                                              setDeletingPaymentId(p.id);
                                            }
                                          }}
                                          className="p-1.5 text-gray-450 dark:text-gray-500 hover:text-red-600 dark:hover:text-red-400 hover:bg-red-50 dark:hover:bg-red-950/40 rounded-lg transition-colors"
                                          title="Delete Payment"
                                        >
                                          <Trash2 size={14} />
                                        </button>
                                      )}
                                    </>
                                  )}
                                </div>
                              </td>
                            </tr>

                            {/* Collapsible details list & installment form */}
                            {isExpanded && (
                              <tr className="bg-teal-50/[0.08] dark:bg-teal-950/[0.03]">
                                <td colSpan={9} className="px-6 py-4 border-t border-b border-gray-100 dark:border-gray-800 bg-gray-50/10 dark:bg-gray-900/10 font-sans">
                                  <div className="space-y-4">
                                    <div className="flex justify-between items-center border-b border-gray-100 dark:border-gray-850 pb-2">
                                      <h4 className="text-xs font-black text-teal-800 dark:text-teal-400 uppercase tracking-tight flex items-center gap-2">
                                        <CreditCard size={14} />
                                        Installment Billings ({p.installments?.length || 0})
                                      </h4>
                                      <span className="text-[10px] font-mono text-gray-450 dark:text-gray-500 bg-gray-100 dark:bg-gray-800 px-2 py-0.5 rounded">
                                        Payment billing reference: {p.id}
                                      </span>
                                    </div>
                                                                      {p.installments && p.installments.length > 0 ? (
                                      <div className="space-y-1.5 max-w-4xl">
                                        {p.installments.map((inst, index) => (
                                          <div key={inst.id || index} className="flex flex-col md:flex-row md:items-center justify-between bg-white dark:bg-gray-850 p-3 rounded-xl border border-gray-100 dark:border-gray-800 text-xs shadow-sm hover:shadow-md transition-shadow gap-3">
                                            {editingInstallmentId === inst.id && editingInstallmentData ? (
                                              <div className="w-full space-y-2">
                                                <div className="flex items-center gap-1.5 border-b border-gray-150 pb-1 mb-1">
                                                  <span className={`font-black uppercase text-[10px] ${editingInstallmentData.is_refund ? 'text-red-700' : 'text-teal-700'}`}>Editing {editingInstallmentData.is_refund ? 'Refund' : 'Installment'} #{index + 1}</span>
                                                </div>
                                                <div className="grid grid-cols-1 sm:grid-cols-4 gap-2 items-end">
                                                  <div>
                                                    <label className="text-[9px] font-black text-gray-400 dark:text-gray-550 uppercase block mb-0.5">
                                                      {editingInstallmentData.is_refund ? 'Refund Amount (Rs.)' : 'Paid Amount (Rs.)'}
                                                    </label>
                                                    <input
                                                      type="number"
                                                      className={`w-full text-xs font-bold bg-white dark:bg-gray-800 border rounded-md p-1 font-mono shadow-inner outline-none focus:ring-1 ${
                                                        editingInstallmentData.is_refund 
                                                          ? 'text-red-700 dark:text-red-400 border-red-100 dark:border-gray-700 focus:ring-red-500' 
                                                          : 'text-teal-700 dark:text-teal-400 border-teal-100 dark:border-gray-700 focus:ring-teal-500'
                                                      }`}
                                                      value={editingInstallmentData.paid_amount || ''}
                                                      onChange={(e) => setEditingInstallmentData({ ...editingInstallmentData, paid_amount: e.target.value })}
                                                    />
                                                  </div>
                                                  <div>
                                                    <label className="text-[9px] font-black text-gray-400 dark:text-gray-555 uppercase block mb-0.5">
                                                      {editingInstallmentData.is_refund ? 'Refund Date' : 'Paid Date'}
                                                    </label>
                                                    <input
                                                      type="date"
                                                      className={`w-full text-xs font-bold bg-white dark:bg-gray-800 border rounded-md p-1 font-mono shadow-inner outline-none focus:ring-1 ${
                                                        editingInstallmentData.is_refund 
                                                          ? 'text-red-700 dark:text-red-400 border-red-100 dark:border-gray-700 focus:ring-red-500' 
                                                          : 'text-teal-700 dark:text-teal-400 border-teal-100 dark:border-gray-700 focus:ring-teal-500'
                                                      }`}
                                                      value={editingInstallmentData.paid_date ? new Date(editingInstallmentData.paid_date).toISOString().split('T')[0] : ''}
                                                      onChange={(e) => setEditingInstallmentData({ ...editingInstallmentData, paid_date: e.target.value })}
                                                    />
                                                  </div>
                                                  {editingInstallmentData.is_refund ? (
                                                    <div className="sm:col-span-2">
                                                      <label className="text-[9px] font-black text-gray-400 dark:text-gray-555 uppercase block mb-0.5">Refund Reason</label>
                                                      <input
                                                        type="text"
                                                        className="w-full text-xs font-bold text-red-700 dark:text-red-400 bg-white dark:bg-gray-800 border border-red-100 dark:border-gray-700 rounded-md p-1 shadow-inner outline-none focus:ring-1 focus:ring-red-500"
                                                        value={editingInstallmentData.refund_reason || editingInstallmentData.duration || ''}
                                                        onChange={(e) => setEditingInstallmentData({ ...editingInstallmentData, refund_reason: e.target.value, duration: e.target.value })}
                                                        placeholder="Enter reason..."
                                                      />
                                                    </div>
                                                  ) : (
                                                    <>
                                                      <div>
                                                        <label className="text-[9px] font-black text-gray-400 dark:text-gray-555 uppercase block mb-0.5">Activation Date</label>
                                                        <input
                                                          type="date"
                                                          className="w-full text-xs font-bold text-teal-700 dark:text-teal-400 bg-white dark:bg-gray-800 border border-teal-100 dark:border-gray-700 rounded-md p-1 font-mono shadow-inner outline-none focus:ring-1 focus:ring-teal-500"
                                                          value={editingInstallmentData.activation_date ? new Date(editingInstallmentData.activation_date).toISOString().split('T')[0] : ''}
                                                          onChange={(e) => setEditingInstallmentData({ ...editingInstallmentData, activation_date: e.target.value })}
                                                        />
                                                      </div>
                                                      <div>
                                                        <label className="text-[9px] font-black text-gray-400 dark:text-gray-555 uppercase block mb-0.5">Duration</label>
                                                        <select
                                                          className="w-full text-xs font-bold text-teal-700 dark:text-teal-400 bg-white dark:bg-gray-800 border border-teal-100 dark:border-gray-700 rounded-md p-1 font-sans outline-none focus:ring-1 focus:ring-teal-500"
                                                          value={editingInstallmentData.duration}
                                                          onChange={(e) => setEditingInstallmentData({ ...editingInstallmentData, duration: e.target.value })}
                                                        >
                                                          {DURATIONS.map(d => <option key={d.label} value={d.label}>{d.label}</option>)}
                                                        </select>
                                                      </div>
                                                    </>
                                                  )}
                                                </div>
                                                <div className="flex justify-end gap-1.5 mt-2">
                                                  <button
                                                    type="button"
                                                    onClick={() => handleUpdateInstallment(p.pcaid)}
                                                    className="px-2.5 py-1 bg-emerald-600 text-white text-[10px] font-black rounded-lg uppercase hover:bg-emerald-700 transition-colors shadow-sm"
                                                  >
                                                    Save
                                                  </button>
                                                  <button
                                                    type="button"
                                                    onClick={handleCancelEditInstallment}
                                                    className="px-2.5 py-1 bg-gray-200 dark:bg-gray-800 text-gray-650 dark:text-gray-400 text-[10px] font-black rounded-lg uppercase hover:bg-gray-300 dark:hover:bg-gray-700 transition-colors"
                                                  >
                                                    Cancel
                                                  </button>
                                                </div>
                                              </div>
                                            ) : (
                                              <>
                                                <div className="flex flex-wrap items-center gap-x-5 gap-y-1">
                                                  {Number(inst.paid_amount) < 0 ? (
                                                    <>
                                                      <span className="font-extrabold text-red-700 bg-red-50 dark:bg-red-955/45 px-2 py-0.5 rounded-full text-[10px] uppercase font-mono flex items-center gap-1">
                                                        <Minus size={10} /> Refund #{index + 1}
                                                      </span>
                                                      <div>
                                                        <span className="font-bold text-red-450 mr-1 uppercase text-[9px]">Refunded:</span>
                                                        <span className="font-mono font-black text-red-600 dark:text-red-400">Rs. {Math.abs(Number(inst.paid_amount || 0)).toLocaleString()}</span>
                                                      </div>
                                                      <div>
                                                        <span className="font-bold text-red-450 mr-1 uppercase text-[9px]">Date:</span>
                                                        <span className="font-bold text-gray-755 dark:text-gray-300">{formatDate(inst.paid_date)}</span>
                                                      </div>
                                                      <div className="flex items-center gap-1.5">
                                                        <span className="font-bold text-red-450 uppercase text-[9px]">Reason:</span>
                                                        <span className="text-xs font-semibold text-red-700 dark:text-red-400 bg-red-50 dark:bg-red-955 px-2 py-0.5 rounded border border-red-100/30">{inst.refund_reason || inst.duration}</span>
                                                      </div>
                                                    </>
                                                  ) : (
                                                    <>
                                                      <span className="font-extrabold text-teal-700 bg-teal-50 dark:bg-teal-955/45 px-2 py-0.5 rounded-full text-[10px] uppercase font-mono">
                                                        Bill #{index + 1}
                                                      </span>
                                                      <div>
                                                        <span className="font-bold text-gray-400 mr-1 uppercase text-[9px]">Paid:</span>
                                                        <span className="font-mono font-black text-teal-650 dark:text-teal-400">Rs. {Number(inst.paid_amount || 0).toLocaleString()}</span>
                                                      </div>
                                                      <div>
                                                        <span className="font-bold text-gray-400 mr-1 uppercase text-[9px]">Date:</span>
                                                        <span className="font-bold text-gray-755 dark:text-gray-300">{formatDate(inst.paid_date)}</span>
                                                      </div>
                                                      <div>
                                                        <span className="font-bold text-gray-400 mr-1 uppercase text-[9px]">Duration / Package:</span>
                                                        <span className="font-medium text-gray-700 dark:text-gray-350">{formatDate(inst.activation_date)} to {formatDate(inst.expired_date)}</span>
                                                      </div>
                                                      <span className="text-[9px] font-black bg-teal-50 dark:bg-teal-955 px-1.5 py-0.5 rounded text-teal-600 dark:text-teal-400 uppercase tracking-wider">{inst.duration}</span>
                                                    </>
                                                  )}
                                                </div>
                                                
                                                <div className="flex items-center gap-1 shrink-0">
                                                  <button
                                                    onClick={() => handleStartEditInstallment(inst)}
                                                    className="p-1.5 text-gray-400 dark:text-gray-500 hover:text-teal-600 hover:bg-teal-50 dark:hover:bg-teal-950/20 rounded transition-colors"
                                                    title="Edit Installment"
                                                  >
                                                    <Edit size={12} />
                                                  </button>

                                                  {/* Delete Installment */}
                                                  {deletingInstallmentId === inst.id ? (
                                                    <div className="flex items-center gap-1.5 shrink-0 bg-red-50 dark:bg-red-950/40 p-1 rounded-lg">
                                                      <span className="text-[9px] font-black text-red-600 dark:text-red-450 uppercase">Delete?</span>
                                                      <button 
                                                        onClick={() => handleDeleteInstallment(inst.id, p.pcaid)}
                                                        className="px-2 py-0.5 bg-red-600 text-white text-[9px] font-black rounded uppercase hover:bg-red-700 transition-colors"
                                                      >
                                                        Confirm
                                                      </button>
                                                      <button 
                                                        onClick={() => setDeletingInstallmentId(null)}
                                                        className="px-2 py-0.5 bg-gray-200 dark:bg-gray-850 text-gray-600 dark:text-gray-400 text-[9px] font-black rounded uppercase hover:bg-gray-300 dark:hover:bg-gray-750"
                                                      >
                                                        No
                                                      </button>
                                                    </div>
                                                  ) : (
                                                    <button 
                                                      onClick={() => setDeletingInstallmentId(inst.id)}
                                                      className="p-1 text-gray-450 dark:text-gray-500 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-950/20 rounded transition-colors"
                                                      title="Delete Installment"
                                                    >
                                                      <Trash2 size={12} />
                                                    </button>
                                                  )}
                                                </div>
                                              </>
                                            )}
                                          </div>
                                        ))}
                                      </div>
                                    ) : (
                                      <p className="text-xs text-gray-450 italic bg-white dark:bg-gray-850 p-3 rounded-xl border border-dashed border-gray-200 dark:border-gray-800 text-center">
                                        No individual installments stored for this payment cycle.
                                      </p>
                                    )}

                                    {/* Inline Add Installment Form */}
                                    <div className="bg-teal-50/20 dark:bg-teal-955/15 p-4 rounded-2xl border border-teal-100/50 dark:border-teal-900/30 space-y-3 max-w-4xl">
                                      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-2 border-b border-teal-100/30 dark:border-teal-900/20">
                                        <h5 className="text-[10px] font-black text-teal-850 dark:text-teal-400 uppercase tracking-widest flex items-center gap-1.5 font-sans">
                                          <Plus size={12} className="text-teal-650" />
                                          {newInstType === 'refund' ? 'Record Refund for this cycle' : 'Record Next Installment Payment'}
                                        </h5>
                                        
                                        {/* Billing vs Refund selector */}
                                        <div className="flex bg-gray-150 dark:bg-gray-800 p-0.5 rounded-lg border border-gray-200 dark:border-gray-700 w-fit self-end sm:self-auto">
                                          <button
                                            type="button"
                                            onClick={() => setNewInstType('billing')}
                                            className={`px-3 py-1 text-[9px] font-black uppercase tracking-wider rounded-md transition-all ${
                                              newInstType === 'billing'
                                                ? 'bg-teal-600 text-white shadow-sm'
                                                : 'text-gray-500 dark:text-gray-400 hover:text-gray-750 dark:hover:text-gray-200'
                                            }`}
                                          >
                                            Billing / Payment
                                          </button>
                                          <button
                                            type="button"
                                            onClick={() => setNewInstType('refund')}
                                            className={`px-3 py-1 text-[9px] font-black uppercase tracking-wider rounded-md transition-all ${
                                              newInstType === 'refund'
                                                ? 'bg-red-600 text-white shadow-sm'
                                                : 'text-gray-500 dark:text-gray-400 hover:text-gray-750 dark:hover:text-gray-200'
                                            }`}
                                          >
                                            Refund
                                          </button>
                                        </div>
                                      </div>
                                      
                                      <div className="grid grid-cols-1 md:grid-cols-5 gap-3 items-end">
                                        {/* Amount */}
                                        <div className="space-y-1">
                                          <label className="text-[9px] font-black text-gray-400 dark:text-gray-500 uppercase tracking-wider block">
                                            {newInstType === 'refund' ? 'Refund Amount (Rs.)' : 'Paid Amount (Rs.)'}
                                          </label>
                                          <input 
                                            type="number" 
                                            placeholder="e.g. 5000"
                                            value={newInstAmount}
                                            onChange={(e) => setNewInstAmount(e.target.value)}
                                            className={`w-full text-xs font-bold bg-white dark:bg-gray-850 border rounded-lg p-2 font-mono shadow-inner outline-none focus:ring-1 font-sans ${
                                              newInstType === 'refund'
                                                ? 'text-red-700 dark:text-red-400 border-red-100 dark:border-red-900 focus:ring-red-500'
                                                : 'text-teal-700 dark:text-teal-400 border-teal-100 dark:border-gray-700 focus:ring-teal-500'
                                            }`}
                                          />
                                        </div>

                                        {/* Paid Date */}
                                        <div className="space-y-1">
                                          <label className="text-[9px] font-black text-gray-400 dark:text-gray-500 uppercase tracking-wider block">
                                            {newInstType === 'refund' ? 'Refund Date' : 'Paid Date'}
                                          </label>
                                          <input 
                                            type="date" 
                                            value={newInstPaidDate}
                                            onChange={(e) => setNewInstPaidDate(e.target.value)}
                                            className={`w-full text-xs font-bold bg-white dark:bg-gray-850 border rounded-lg p-2 shadow-inner font-sans ${
                                              newInstType === 'refund'
                                                ? 'text-red-700 dark:text-red-400 border-red-100 dark:border-red-900 focus:ring-red-500'
                                                : 'text-teal-700 dark:text-teal-400 border-teal-100 dark:border-gray-700 focus:ring-teal-500'
                                            }`}
                                          />
                                        </div>

                                        {newInstType === 'refund' ? (
                                          /* Refund Reason Input (takes 2 columns) */
                                          <div className="md:col-span-2 space-y-1">
                                            <label className="text-[9px] font-black text-gray-400 dark:text-gray-550 uppercase tracking-wider block">Refund Reason</label>
                                            <input 
                                              type="text" 
                                              placeholder="Enter the reason for refund..."
                                              value={newInstRefundReason}
                                              onChange={(e) => setNewInstRefundReason(e.target.value)}
                                              className="w-full text-xs font-bold text-red-700 dark:text-red-400 bg-white dark:bg-gray-850 border border-red-100 dark:border-red-900 rounded-lg p-2 shadow-inner outline-none focus:ring-1 focus:ring-red-500 font-sans"
                                            />
                                          </div>
                                        ) : (
                                          <>
                                            {/* Activation Date */}
                                            <div className="space-y-1">
                                              <label className="text-[9px] font-black text-gray-400 dark:text-gray-500 uppercase tracking-wider block">Activation Date</label>
                                              <input 
                                                type="date" 
                                                value={newInstActDate}
                                                onChange={(e) => setNewInstActDate(e.target.value)}
                                                className="w-full text-xs font-bold text-teal-700 dark:text-teal-400 bg-white dark:bg-gray-850 border border-teal-100 dark:border-gray-700 rounded-lg p-2 shadow-inner font-sans"
                                              />
                                            </div>

                                            {/* Duration */}
                                            <div className="space-y-1">
                                              <label className="text-[9px] font-black text-gray-400 dark:text-gray-550 uppercase tracking-wider block">Duration</label>
                                              <select
                                                value={newInstDuration}
                                                onChange={(e) => setNewInstDuration(e.target.value)}
                                                className="w-full text-xs font-bold text-teal-700 dark:text-teal-400 bg-white dark:bg-gray-850 border border-teal-100 dark:border-gray-700 rounded-lg p-2 shadow-inner font-sans"
                                              >
                                                {DURATIONS.map(d => <option key={d.label} value={d.label}>{d.label}</option>)}
                                              </select>
                                            </div>
                                          </>
                                        )}

                                        {/* Action */}
                                        <button 
                                          onClick={() => handleAddInstallment(p.id, p.pcaid)}
                                          className={`w-full py-2 px-3 text-white text-[10px] font-black uppercase tracking-wider rounded-lg shadow-sm hover:shadow transition-all flex items-center justify-center gap-1.5 self-end h-[34px] font-sans ${
                                            newInstType === 'refund'
                                              ? 'bg-red-600 hover:bg-red-700'
                                              : 'bg-teal-600 hover:bg-teal-700'
                                          }`}
                                        >
                                          {newInstType === 'refund' ? (
                                            <>
                                              <Trash2 size={14} />
                                              Record Refund
                                            </>
                                          ) : (
                                            <>
                                              <Plus size={14} />
                                              Add Bill
                                            </>
                                          )}
                                        </button>
                                      </div>
                                    </div>
                                  </div>
                                </td>
                              </tr>
                            )}
                          </React.Fragment>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </div>

            {/* Footer */}
            <div className="px-6 py-4 bg-gray-50 border-t border-gray-100 flex justify-end">
              <button 
                onClick={handleCloseStudentPayments}
                className="px-6 py-2 bg-white border border-gray-200 text-gray-600 rounded-xl font-bold text-xs hover:bg-gray-50 transition-colors"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Student Form Modal Pop-up */}
      {isStudentFormModalOpen && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-xs z-50 flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-white dark:bg-gray-900 rounded-2xl shadow-2xl border border-gray-100 dark:border-gray-800 w-full max-w-5xl flex flex-col max-h-[90vh] relative animate-in fade-in zoom-in-95 duration-200">
            {/* Sticky Header with Close button in the top left corner */}
            <div className="sticky top-0 z-30 flex items-center h-14 px-6 border-b border-gray-100 dark:border-gray-800 bg-white/95 dark:bg-gray-900/95 backdrop-blur-xs rounded-t-2xl shrink-0">
              <button
                onClick={() => setIsStudentFormModalOpen(false)}
                className="p-2 text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 bg-gray-100 hover:bg-gray-200 dark:bg-gray-800 dark:hover:bg-gray-700 rounded-full transition-all duration-150 shadow-sm cursor-pointer flex items-center justify-center"
                title="Close Form"
              >
                <X size={18} />
              </button>
              <span className="ml-4 text-sm font-bold text-gray-550 dark:text-gray-450 uppercase tracking-wider">Student Form</span>
            </div>

            {/* The form itself - scrollable body */}
            <div className="flex-1 overflow-y-auto p-8">
              <StudentForm
                key={modalStudent?.id || 'new'}
                isModal={true}
                modalStudent={modalStudent}
                modalLead={modalLead}
                onClose={(shouldRefresh = true) => {
                  setIsStudentFormModalOpen(false);
                  if (shouldRefresh) {
                    fetchStudents();
                  }
                }}
              />
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

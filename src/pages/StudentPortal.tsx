import React, { useState, useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useStudentAuth } from '../hooks/useStudentAuth';
import { supabase } from '../lib/supabase';
import { Payment, StudentFolderAccess, AppFolder } from '../types';
import AcademyLogo from '../components/AcademyLogo';
import { toast } from 'sonner';
import { motion, AnimatePresence } from 'motion/react';
import { 
  User as UserIcon, 
  LogOut, 
  CreditCard, 
  BookOpen, 
  ShieldCheck, 
  KeyRound, 
  Save, 
  Copy, 
  Check, 
  FolderCheck, 
  Clock, 
  Eye, 
  EyeOff, 
  CheckCircle2,
  Sun,
  Moon,
  GraduationCap
} from 'lucide-react';

export default function StudentPortal() {
  const { 
    student, 
    credentials, 
    isLoading, 
    logoutStudent, 
    updateStudentPersonalDetails, 
    updateStudentPassword,
    refreshStudentProfile 
  } = useStudentAuth();
  
  const navigate = useNavigate();

  // System Theme State
  const [theme, setTheme] = useState<'light' | 'dark'>(() => {
    if (typeof localStorage !== 'undefined') {
      const stored = localStorage.getItem('theme');
      if (stored === 'dark') return 'dark';
      if (stored === 'light') return 'light';
    }
    if (typeof window !== 'undefined') {
      return document.documentElement.classList.contains('dark') ||
        window.matchMedia('(prefers-color-scheme: dark)').matches
        ? 'dark'
        : 'light';
    }
    return 'light';
  });

  useEffect(() => {
    if (theme === 'dark') {
      document.documentElement.classList.add('dark');
      localStorage.setItem('theme', 'dark');
    } else {
      document.documentElement.classList.remove('dark');
      localStorage.setItem('theme', 'light');
    }
  }, [theme]);

  const toggleTheme = () => {
    setTheme(prev => (prev === 'dark' ? 'light' : 'dark'));
  };

  const [activeTab, setActiveTab] = useState<'profile' | 'courses' | 'payments'>('profile');

  // Editable personal info state
  const [personalForm, setPersonalForm] = useState({
    name: '',
    phone: '',
    whatsapp: '',
    mail: '',
    address: '',
    school: '',
    nic: '',
    gender: 'Male',
  });

  // Change password state
  const [showPasswordModal, setShowPasswordModal] = useState(false);
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showNewPass, setShowNewPass] = useState(false);
  const [isChangingPass, setIsChangingPass] = useState(false);

  // Payments & Enrolled Classes
  const [payments, setPayments] = useState<Payment[]>([]);
  const [folderAccesses, setFolderAccesses] = useState<(StudentFolderAccess & { app_folder?: AppFolder })[]>([]);
  const [loadingData, setLoadingData] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [copiedPcaid, setCopiedPcaid] = useState(false);

  // Synchronize student data to form
  useEffect(() => {
    if (student) {
      setPersonalForm({
        name: student.name || '',
        phone: student.phone || '',
        whatsapp: (student as any).whatsapp || student.phone || '',
        mail: student.mail || '',
        address: student.address || '',
        school: student.school || '',
        nic: student.nic || '',
        gender: student.gender || 'Male',
      });
    }
  }, [student]);

  // Load Payments & Folder Accesses
  useEffect(() => {
    if (!student?.pcaid) return;

    const loadStudentDetails = async () => {
      setLoadingData(true);
      try {
        // 1. Fetch payments
        const { data: payData, error: payErr } = await supabase
          .from('payment')
          .select('*, installment(*)')
          .eq('pcaid', student.pcaid)
          .is('deleted_at', null)
          .order('paid_date', { ascending: false });

        if (payErr) {
          console.error('Error fetching student payments:', payErr);
        } else if (payData) {
          setPayments(payData as Payment[]);
        }

        // 2. Fetch accessible learning material folders
        const { data: folderData, error: folderErr } = await supabase
          .from('student_folder_access')
          .select('*, app_folder(*)')
          .eq('student_pcaid', student.pcaid)
          .eq('is_enabled', true);

        if (folderErr) {
          console.error('Error fetching student folder access:', folderErr);
        } else if (folderData) {
          setFolderAccesses(folderData as any[]);
        }
      } catch (err) {
        console.error('Failed to load portal data:', err);
      } finally {
        setLoadingData(false);
      }
    };

    loadStudentDetails();
  }, [student?.pcaid]);

  // If not authenticated and not loading, redirect to student login
  if (!isLoading && !student) {
    navigate('/student-login');
    return null;
  }

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 dark:bg-gray-950 text-gray-900 dark:text-gray-100">
        <div className="flex flex-col items-center gap-3">
          <div className="w-10 h-10 border-4 border-teal-600 border-t-transparent rounded-full animate-spin"></div>
          <p className="text-sm font-medium text-gray-500 dark:text-gray-400">Loading Student Portal...</p>
        </div>
      </div>
    );
  }

  const handleCopyPcaid = () => {
    if (!student?.pcaid) return;
    navigator.clipboard.writeText(student.pcaid);
    setCopiedPcaid(true);
    setTimeout(() => setCopiedPcaid(false), 2000);
    toast.success('PCA ID copied to clipboard');
  };

  const handleSavePersonalDetails = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!personalForm.name.trim()) {
      toast.error('Student name cannot be empty');
      return;
    }
    if (!personalForm.phone.trim()) {
      toast.error('Phone number cannot be empty');
      return;
    }

    if (personalForm.nic.trim()) {
      const cleanNic = personalForm.nic.trim();
      const is12Digits = /^\d{12}$/.test(cleanNic);
      const is10Chars = /^\d{9}[vVxX]$/.test(cleanNic);

      if (!is12Digits && !is10Chars) {
        toast.error('NIC must be 12 digits or 10 characters ending with V or X (e.g. 200512345678 or 981234567V)');
        return;
      }
    }

    setIsSaving(true);
    try {
      const res = await updateStudentPersonalDetails({
        ...personalForm,
        nic: personalForm.nic.trim().toUpperCase() || '',
      });
      if (res.success) {
        toast.success('Personal details updated successfully!');
      } else {
        toast.error(res.error || 'Failed to update details');
      }
    } catch (err: any) {
      toast.error(err.message || 'Error updating details');
    } finally {
      setIsSaving(false);
    }
  };

  const handlePasswordChange = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!newPassword || newPassword.length < 4) {
      toast.error('Password must be at least 4 characters long');
      return;
    }
    if (newPassword !== confirmPassword) {
      toast.error('New password and confirm password do not match');
      return;
    }

    setIsChangingPass(true);
    try {
      const res = await updateStudentPassword(newPassword);
      if (res.success) {
        toast.success('Password updated successfully!');
        setShowPasswordModal(false);
        setNewPassword('');
        setConfirmPassword('');
      } else {
        toast.error(res.error || 'Failed to update password');
      }
    } catch (err: any) {
      toast.error(err.message || 'Error updating password');
    } finally {
      setIsChangingPass(false);
    }
  };

  const totalPaid = payments.reduce((acc, p) => acc + (Number(p.payment) || 0), 0);

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-950 text-gray-900 dark:text-gray-100 flex flex-col selection:bg-teal-500 selection:text-white transition-colors duration-200">
      {/* Navigation Header */}
      <header className="w-full bg-white dark:bg-gray-900 border-b border-gray-200 dark:border-gray-800 sticky top-0 z-40 px-4 sm:px-8 py-3 flex items-center justify-between transition-colors shadow-2xs">
        <div className="flex items-center gap-3">
          <div className="p-1 bg-teal-50 dark:bg-teal-950/40 border border-teal-100 dark:border-teal-900/40 rounded-xl flex items-center justify-center shrink-0">
            <AcademyLogo width={36} height={36} showText={false} className="shrink-0" />
          </div>
          <div className="flex flex-col justify-center">
            <div className="flex items-center gap-2">
              <span className="font-black tracking-tight text-teal-700 dark:text-teal-400 text-base sm:text-lg leading-tight">
                PHYSICS CENTER
              </span>
              <span className="text-[10px] uppercase font-extrabold tracking-wider px-2 py-0.5 bg-teal-50 dark:bg-teal-950/50 text-teal-700 dark:text-teal-300 border border-teal-200 dark:border-teal-800/60 rounded-full leading-tight">
                Student Account
              </span>
            </div>
            <p className="text-xs text-gray-500 dark:text-gray-400 font-medium hidden sm:block leading-tight mt-0.5">
              Logged in as <strong className="text-gray-800 dark:text-gray-200">{student?.name}</strong>
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 sm:gap-3">
          {/* PCA ID Badge */}
          <div className="hidden sm:flex items-center gap-2 bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 px-3 py-1.5 rounded-xl">
            <span className="text-xs font-mono font-bold text-teal-700 dark:text-teal-400 tracking-wider">
              {student?.pcaid}
            </span>
            <button
              onClick={handleCopyPcaid}
              className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 transition-colors cursor-pointer"
              title="Copy PCA ID"
            >
              {copiedPcaid ? <Check className="w-3.5 h-3.5 text-teal-600 dark:text-teal-400" /> : <Copy className="w-3.5 h-3.5" />}
            </button>
          </div>

          {/* Theme Switcher Button */}
          <button
            type="button"
            onClick={toggleTheme}
            className="p-2 text-gray-600 dark:text-gray-300 bg-gray-50 dark:bg-gray-800 hover:bg-gray-100 dark:hover:bg-gray-750 rounded-xl transition-colors cursor-pointer border border-gray-200 dark:border-gray-700 shadow-2xs"
            title={`Switch to ${theme === 'dark' ? 'Light' : 'Dark'} mode`}
            aria-label="Toggle Theme"
          >
            {theme === 'dark' ? (
              <Sun size={17} className="text-amber-400" />
            ) : (
              <Moon size={17} className="text-gray-600" />
            )}
          </button>

          {/* Sign Out Button */}
          <button
            onClick={() => {
              logoutStudent();
              toast.info('Signed out');
              navigate('/student-login');
            }}
            className="flex items-center gap-1.5 px-3.5 py-1.5 bg-rose-50 dark:bg-rose-950/30 hover:bg-rose-100 dark:hover:bg-rose-900/40 text-rose-700 dark:text-rose-400 border border-rose-200 dark:border-rose-800/60 rounded-xl text-xs font-bold transition-all cursor-pointer shadow-2xs"
          >
            <LogOut className="w-3.5 h-3.5" />
            <span>Sign Out</span>
          </button>
        </div>
      </header>

      {/* Main Container */}
      <main className="flex-1 max-w-6xl w-full mx-auto p-4 sm:p-6 lg:p-8 space-y-6">
        {/* Student Profile Identity Card */}
        <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-2xl p-6 sm:p-8 shadow-xs relative overflow-hidden transition-colors">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-6">
            <div className="flex items-center gap-4">
              <div className="w-16 h-16 rounded-2xl bg-teal-600 dark:bg-teal-700 flex items-center justify-center text-white font-black text-2xl shadow-md shadow-teal-600/10 shrink-0">
                {student?.name?.charAt(0)?.toUpperCase() || 'S'}
              </div>
              <div className="space-y-1">
                <div className="flex items-center gap-3 flex-wrap">
                  <h1 className="text-xl sm:text-2xl font-bold text-gray-900 dark:text-white tracking-tight">
                    {student?.name}
                  </h1>
                  <span className="px-2.5 py-0.5 bg-teal-50 dark:bg-teal-950/40 border border-teal-200 dark:border-teal-800/60 text-teal-700 dark:text-teal-300 rounded-full text-xs font-bold font-mono">
                    {student?.pcaid}
                  </span>
                </div>
                <div className="flex items-center gap-2 text-xs text-gray-500 dark:text-gray-400 flex-wrap">
                  <span className="text-gray-700 dark:text-gray-300 font-medium">{student?.stream || 'A/L Physics'}</span>
                  <span>&bull;</span>
                  <span>Proper Batch: <strong className="text-teal-700 dark:text-teal-400">{student?.proper_batch || 'N/A'}</strong></span>
                  <span>&bull;</span>
                  <span>District: <strong className="text-gray-700 dark:text-gray-300">{student?.district || 'N/A'}</strong></span>
                </div>
              </div>
            </div>

            <div className="flex items-center gap-3">
              <button
                type="button"
                onClick={() => setShowPasswordModal(true)}
                className="px-4 py-2 bg-gray-50 dark:bg-gray-800 hover:bg-gray-100 dark:hover:bg-gray-750 text-gray-700 dark:text-gray-200 border border-gray-200 dark:border-gray-700 rounded-xl text-xs font-bold transition-all flex items-center gap-2 cursor-pointer shadow-2xs"
              >
                <KeyRound className="w-3.5 h-3.5 text-teal-600 dark:text-teal-400" />
                <span>Change Password</span>
              </button>
            </div>
          </div>

          {/* Navigation Tabs (matching system NavTabs design) */}
          <div className="mt-8 pt-4 border-t border-gray-100 dark:border-gray-800">
            <div className="flex items-center gap-1.5 p-1 bg-gray-100/80 dark:bg-gray-800/80 rounded-2xl w-fit border border-gray-200/80 dark:border-gray-700/80 shadow-2xs overflow-x-auto">
              <button
                onClick={() => setActiveTab('profile')}
                className={`flex items-center gap-2 px-4 py-2 text-xs rounded-xl transition-all cursor-pointer whitespace-nowrap ${
                  activeTab === 'profile'
                    ? 'bg-white dark:bg-gray-900 text-teal-700 dark:text-teal-300 shadow-xs border border-teal-100 dark:border-teal-900/40 font-extrabold'
                    : 'text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-200 font-medium'
                }`}
              >
                <UserIcon className="w-4 h-4" />
                <span>Personal Details</span>
              </button>

              <button
                onClick={() => setActiveTab('courses')}
                className={`flex items-center gap-2 px-4 py-2 text-xs rounded-xl transition-all cursor-pointer whitespace-nowrap ${
                  activeTab === 'courses'
                    ? 'bg-white dark:bg-gray-900 text-teal-700 dark:text-teal-300 shadow-xs border border-teal-100 dark:border-teal-900/40 font-extrabold'
                    : 'text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-200 font-medium'
                }`}
              >
                <BookOpen className="w-4 h-4" />
                <span>My Classes & Materials</span>
              </button>

              <button
                onClick={() => setActiveTab('payments')}
                className={`flex items-center gap-2 px-4 py-2 text-xs rounded-xl transition-all cursor-pointer whitespace-nowrap ${
                  activeTab === 'payments'
                    ? 'bg-white dark:bg-gray-900 text-teal-700 dark:text-teal-300 shadow-xs border border-teal-100 dark:border-teal-900/40 font-extrabold'
                    : 'text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-200 font-medium'
                }`}
              >
                <CreditCard className="w-4 h-4" />
                <span>Payment History ({payments.length})</span>
              </button>
            </div>
          </div>
        </div>

        {/* Tab Content Panels */}
        <AnimatePresence mode="wait">
          {/* TAB 1: PERSONAL DETAILS (EDITABLE) */}
          {activeTab === 'profile' && (
            <motion.div
              key="tab-profile"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              transition={{ duration: 0.2 }}
              className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-2xl p-6 sm:p-8 shadow-xs space-y-6 transition-colors"
            >
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-4 border-b border-gray-100 dark:border-gray-800">
                <div>
                  <h2 className="text-lg font-bold text-gray-900 dark:text-white">Edit Personal Information</h2>
                  <p className="text-xs text-gray-500 dark:text-gray-400">
                    Keep your contact and identification details up to date.
                  </p>
                </div>
                <div className="flex items-center gap-2 text-xs text-amber-700 dark:text-amber-300 bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-800/60 px-3 py-1.5 rounded-xl font-medium w-fit">
                  <ShieldCheck className="w-3.5 h-3.5" />
                  <span>Academic details locked by Admin</span>
                </div>
              </div>

              <form onSubmit={handleSavePersonalDetails} className="space-y-6">
                {/* Locked Academic Fields for Reference */}
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 p-4 bg-gray-50 dark:bg-gray-800/50 border border-gray-200 dark:border-gray-700/60 rounded-xl">
                  <div className="space-y-1">
                    <span className="text-[10px] font-bold uppercase tracking-wider text-gray-500 dark:text-gray-400">PCA ID</span>
                    <p className="text-sm font-mono font-bold text-teal-700 dark:text-teal-400">{student?.pcaid}</p>
                  </div>
                  <div className="space-y-1">
                    <span className="text-[10px] font-bold uppercase tracking-wider text-gray-500 dark:text-gray-400">Stream</span>
                    <p className="text-sm font-semibold text-gray-800 dark:text-gray-200">{student?.stream || 'N/A'}</p>
                  </div>
                  <div className="space-y-1">
                    <span className="text-[10px] font-bold uppercase tracking-wider text-gray-500 dark:text-gray-400">Proper Batch</span>
                    <p className="text-sm font-semibold text-gray-800 dark:text-gray-200">{student?.proper_batch || 'N/A'}</p>
                  </div>
                  <div className="space-y-1">
                    <span className="text-[10px] font-bold uppercase tracking-wider text-gray-500 dark:text-gray-400">District</span>
                    <p className="text-sm font-semibold text-gray-800 dark:text-gray-200">{student?.district || 'N/A'}</p>
                  </div>
                </div>

                {/* Editable Fields */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  {/* Full Name */}
                  <div className="space-y-1.5 sm:col-span-2">
                    <label className="text-xs font-semibold text-gray-700 dark:text-gray-300">
                      Full Name <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="text"
                      value={personalForm.name}
                      onChange={(e) => setPersonalForm({ ...personalForm, name: e.target.value })}
                      className="w-full px-4 py-2.5 bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl text-xs font-medium text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-teal-500/20 focus:border-teal-500 transition-all"
                      required
                    />
                  </div>

                  {/* Phone */}
                  <div className="space-y-1.5">
                    <label className="text-xs font-semibold text-gray-700 dark:text-gray-300">
                      Mobile Phone <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="tel"
                      value={personalForm.phone}
                      onChange={(e) => setPersonalForm({ ...personalForm, phone: e.target.value })}
                      className="w-full px-4 py-2.5 bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl text-xs font-medium text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-teal-500/20 focus:border-teal-500 transition-all"
                      required
                    />
                  </div>

                  {/* WhatsApp */}
                  <div className="space-y-1.5">
                    <label className="text-xs font-semibold text-gray-700 dark:text-gray-300">WhatsApp Number</label>
                    <input
                      type="tel"
                      value={personalForm.whatsapp}
                      onChange={(e) => setPersonalForm({ ...personalForm, whatsapp: e.target.value })}
                      className="w-full px-4 py-2.5 bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl text-xs font-medium text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-teal-500/20 focus:border-teal-500 transition-all"
                    />
                  </div>

                  {/* Email */}
                  <div className="space-y-1.5">
                    <label className="text-xs font-semibold text-gray-700 dark:text-gray-300">Email Address</label>
                    <input
                      type="email"
                      value={personalForm.mail}
                      onChange={(e) => setPersonalForm({ ...personalForm, mail: e.target.value })}
                      className="w-full px-4 py-2.5 bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl text-xs font-medium text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-teal-500/20 focus:border-teal-500 transition-all"
                    />
                  </div>

                  {/* NIC */}
                  <div className="space-y-1.5">
                    <label className="text-xs font-semibold text-gray-700 dark:text-gray-300">NIC / Birth Certificate No</label>
                    <input
                      type="text"
                      value={personalForm.nic}
                      onChange={(e) => setPersonalForm({ ...personalForm, nic: e.target.value })}
                      className="w-full px-4 py-2.5 bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl text-xs font-medium text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-teal-500/20 focus:border-teal-500 transition-all"
                    />
                  </div>

                  {/* School */}
                  <div className="space-y-1.5">
                    <label className="text-xs font-semibold text-gray-700 dark:text-gray-300">School</label>
                    <input
                      type="text"
                      value={personalForm.school}
                      onChange={(e) => setPersonalForm({ ...personalForm, school: e.target.value })}
                      className="w-full px-4 py-2.5 bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl text-xs font-medium text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-teal-500/20 focus:border-teal-500 transition-all"
                    />
                  </div>

                  {/* Gender */}
                  <div className="space-y-1.5">
                    <label className="text-xs font-semibold text-gray-700 dark:text-gray-300">Gender</label>
                    <select
                      value={personalForm.gender}
                      onChange={(e) => setPersonalForm({ ...personalForm, gender: e.target.value })}
                      className="w-full px-4 py-2.5 bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl text-xs font-medium text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-teal-500/20 focus:border-teal-500 transition-all cursor-pointer"
                    >
                      <option value="Male">Male</option>
                      <option value="Female">Female</option>
                      <option value="Other">Other</option>
                    </select>
                  </div>

                  {/* Address */}
                  <div className="space-y-1.5 sm:col-span-2">
                    <label className="text-xs font-semibold text-gray-700 dark:text-gray-300">Home Address</label>
                    <input
                      type="text"
                      value={personalForm.address}
                      onChange={(e) => setPersonalForm({ ...personalForm, address: e.target.value })}
                      className="w-full px-4 py-2.5 bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl text-xs font-medium text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-teal-500/20 focus:border-teal-500 transition-all"
                    />
                  </div>
                </div>

                <div className="flex items-center justify-end pt-4 border-t border-gray-100 dark:border-gray-800">
                  <button
                    type="submit"
                    disabled={isSaving}
                    className="px-6 py-2.5 bg-teal-600 hover:bg-teal-700 active:scale-95 text-white font-bold rounded-xl text-xs transition-all shadow-sm flex items-center gap-2 cursor-pointer disabled:opacity-50"
                  >
                    {isSaving ? (
                      <>
                        <div className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                        <span>Saving...</span>
                      </>
                    ) : (
                      <>
                        <Save className="w-3.5 h-3.5" />
                        <span>Save Profile Changes</span>
                      </>
                    )}
                  </button>
                </div>
              </form>
            </motion.div>
          )}

          {/* TAB 2: MY CLASSES & LEARNING MATERIALS */}
          {activeTab === 'courses' && (
            <motion.div
              key="tab-courses"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              transition={{ duration: 0.2 }}
              className="space-y-6"
            >
              {/* Enrolled Overview Card */}
              <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-2xl p-6 sm:p-8 shadow-xs space-y-6 transition-colors">
                <div className="border-b border-gray-100 dark:border-gray-800 pb-4">
                  <h2 className="text-lg font-bold text-gray-900 dark:text-white">Registered Courses & Program</h2>
                  <p className="text-xs text-gray-500 dark:text-gray-400">
                    Your current curriculum and activated learning packages.
                  </p>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="p-4 bg-gray-50 dark:bg-gray-800/50 border border-gray-200 dark:border-gray-700/60 rounded-xl space-y-2">
                    <div className="flex items-center gap-2 text-teal-700 dark:text-teal-400">
                      <GraduationCap className="w-4 h-4" />
                      <span className="text-xs font-bold uppercase tracking-wider">Class Program</span>
                    </div>
                    <p className="text-base font-bold text-gray-900 dark:text-white">
                      {student?.asked_class_type || 'General A/L Physics Batch'}
                    </p>
                    <p className="text-xs text-gray-500 dark:text-gray-400">
                      Batch: <span className="font-semibold text-gray-700 dark:text-gray-300">{student?.proper_batch}</span> &bull; Medium: <span className="font-semibold text-gray-700 dark:text-gray-300">{student?.stream}</span>
                    </p>
                  </div>

                  <div className="p-4 bg-gray-50 dark:bg-gray-800/50 border border-gray-200 dark:border-gray-700/60 rounded-xl space-y-2">
                    <div className="flex items-center gap-2 text-teal-700 dark:text-teal-400">
                      <BookOpen className="w-4 h-4" />
                      <span className="text-xs font-bold uppercase tracking-wider">Package / Track</span>
                    </div>
                    <p className="text-base font-bold text-gray-900 dark:text-white">
                      {student?.asked_package_type || 'Full Subject Course'}
                    </p>
                    <p className="text-xs text-gray-500 dark:text-gray-400">
                      Enrolled District: <span className="font-semibold text-gray-700 dark:text-gray-300">{student?.district}</span>
                    </p>
                  </div>
                </div>
              </div>

              {/* Activated App Materials Folders */}
              <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-2xl p-6 sm:p-8 shadow-xs space-y-6 transition-colors">
                <div className="border-b border-gray-100 dark:border-gray-800 pb-4 flex items-center justify-between">
                  <div>
                    <h2 className="text-lg font-bold text-gray-900 dark:text-white">Study Materials & App Folders</h2>
                    <p className="text-xs text-gray-500 dark:text-gray-400">
                      Resources and lesson folders activated for your account.
                    </p>
                  </div>
                  <span className="text-xs font-bold px-2.5 py-1 bg-teal-50 dark:bg-teal-950/40 text-teal-700 dark:text-teal-300 border border-teal-200 dark:border-teal-800/60 rounded-lg">
                    {folderAccesses.length} Active Access
                  </span>
                </div>

                {folderAccesses.length > 0 ? (
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                    {folderAccesses.map((item) => (
                      <div
                        key={item.id}
                        className="p-4 bg-gray-50 dark:bg-gray-800/50 border border-gray-200 dark:border-gray-700/60 rounded-xl space-y-3 hover:border-teal-500/50 transition-colors"
                      >
                        <div className="flex items-center justify-between">
                          <div className="p-2 bg-teal-50 dark:bg-teal-950/40 text-teal-700 dark:text-teal-400 rounded-xl border border-teal-100 dark:border-teal-900/30">
                            <FolderCheck className="w-5 h-5" />
                          </div>
                          <span className="text-[10px] font-bold px-2 py-0.5 bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800/60 rounded-full">
                            Active
                          </span>
                        </div>

                        <div>
                          <h3 className="text-sm font-bold text-gray-900 dark:text-white">{item.app_folder?.name || 'Folder Resource'}</h3>
                          <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5 line-clamp-2">
                            {item.app_folder?.description || 'Physics lecture notes, recorded sessions and worksheets.'}
                          </p>
                        </div>

                        {item.expires_at && (
                          <div className="pt-2 border-t border-gray-200 dark:border-gray-700 flex items-center gap-1.5 text-[11px] text-gray-500 dark:text-gray-400">
                            <Clock className="w-3.5 h-3.5 text-teal-600 dark:text-teal-400" />
                            <span>Valid until: {new Date(item.expires_at).toLocaleDateString()}</span>
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="p-8 text-center bg-gray-50 dark:bg-gray-800/30 border border-dashed border-gray-200 dark:border-gray-700 rounded-xl space-y-2">
                    <FolderCheck className="w-8 h-8 text-gray-400 dark:text-gray-500 mx-auto" />
                    <p className="text-sm font-semibold text-gray-700 dark:text-gray-300">No Custom Study Folders Assigned Yet</p>
                    <p className="text-xs text-gray-500 dark:text-gray-400 max-w-sm mx-auto">
                      When admins activate study material folders for your batch and payments, they will appear here.
                    </p>
                  </div>
                )}
              </div>
            </motion.div>
          )}

          {/* TAB 3: PAYMENT HISTORY */}
          {activeTab === 'payments' && (
            <motion.div
              key="tab-payments"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              transition={{ duration: 0.2 }}
              className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-2xl p-6 sm:p-8 shadow-xs space-y-6 transition-colors"
            >
              {/* Summary Stats */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pb-6 border-b border-gray-100 dark:border-gray-800">
                <div className="p-4 bg-gray-50 dark:bg-gray-800/50 border border-gray-200 dark:border-gray-700/60 rounded-xl flex items-center justify-between">
                  <div>
                    <span className="text-[10px] font-bold uppercase tracking-wider text-gray-500 dark:text-gray-400">Total Payments Recorded</span>
                    <p className="text-2xl font-bold text-gray-900 dark:text-white mt-0.5">{payments.length}</p>
                  </div>
                  <div className="p-3 bg-teal-50 dark:bg-teal-950/40 text-teal-700 dark:text-teal-400 rounded-xl border border-teal-100 dark:border-teal-900/30">
                    <CreditCard className="w-6 h-6" />
                  </div>
                </div>

                <div className="p-4 bg-gray-50 dark:bg-gray-800/50 border border-gray-200 dark:border-gray-700/60 rounded-xl flex items-center justify-between">
                  <div>
                    <span className="text-[10px] font-bold uppercase tracking-wider text-gray-500 dark:text-gray-400">Total Amount Paid</span>
                    <p className="text-2xl font-bold text-teal-700 dark:text-teal-400 mt-0.5">Rs. {totalPaid.toLocaleString()}</p>
                  </div>
                  <div className="p-3 bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-400 rounded-xl border border-emerald-100 dark:border-emerald-900/30">
                    <CheckCircle2 className="w-6 h-6" />
                  </div>
                </div>
              </div>

              {/* Payments Table / List */}
              <div className="space-y-4">
                <h3 className="text-xs font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wider">Payment Records</h3>

                {payments.length > 0 ? (
                  <div className="space-y-3">
                    {payments.map((p, idx) => (
                      <div
                        key={p.id || idx}
                        className="p-4 bg-gray-50 dark:bg-gray-800/40 border border-gray-200 dark:border-gray-700/60 rounded-xl flex flex-col sm:flex-row sm:items-center justify-between gap-4 hover:border-teal-500/40 transition-colors"
                      >
                        <div className="space-y-1">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="text-sm font-bold text-gray-900 dark:text-white">
                              {p.class_type || p.package_type || 'Tuition Fee'}
                            </span>
                            <span className="text-[10px] font-bold px-2 py-0.5 bg-teal-50 dark:bg-teal-950/40 text-teal-700 dark:text-teal-300 rounded-full border border-teal-200 dark:border-teal-800/60">
                              {p.type?.toUpperCase()}
                            </span>
                          </div>
                          <div className="flex items-center gap-3 text-xs text-gray-500 dark:text-gray-400 flex-wrap">
                            <span>Paid Date: <strong className="text-gray-700 dark:text-gray-300">{p.paid_date || 'N/A'}</strong></span>
                            <span>&bull;</span>
                            <span>Duration: {p.duration || '1 Month'}</span>
                            {p.expired_date && (
                              <>
                                <span>&bull;</span>
                                <span>Expires: {p.expired_date}</span>
                              </>
                            )}
                          </div>
                        </div>

                        <div className="flex items-center justify-between sm:justify-end gap-3 sm:text-right">
                          <div>
                            <span className="text-base font-mono font-bold text-gray-900 dark:text-white">
                              Rs. {Number(p.payment || 0).toLocaleString()}
                            </span>
                            <p className="text-[10px] text-emerald-600 dark:text-emerald-400 font-semibold">Payment Verified</p>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="p-8 text-center bg-gray-50 dark:bg-gray-800/30 border border-dashed border-gray-200 dark:border-gray-700 rounded-xl space-y-2">
                    <CreditCard className="w-8 h-8 text-gray-400 dark:text-gray-500 mx-auto" />
                    <p className="text-sm font-semibold text-gray-700 dark:text-gray-300">No Payments Recorded Yet</p>
                    <p className="text-xs text-gray-500 dark:text-gray-400 max-w-sm mx-auto">
                      When your admission and monthly fees are processed by administration, the receipts will be listed here.
                    </p>
                  </div>
                )}
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </main>

      {/* Change Password Modal */}
      <AnimatePresence>
        {showPasswordModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-gray-900/60 dark:bg-gray-950/80 backdrop-blur-xs">
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-2xl p-6 max-w-md w-full shadow-xl space-y-5 transition-colors"
            >
              <div className="flex items-center justify-between pb-3 border-b border-gray-100 dark:border-gray-800">
                <div className="flex items-center gap-2">
                  <KeyRound className="w-5 h-5 text-teal-600 dark:text-teal-400" />
                  <h3 className="text-base font-bold text-gray-900 dark:text-white">Change Account Password</h3>
                </div>
                <button
                  type="button"
                  onClick={() => setShowPasswordModal(false)}
                  className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 text-xs font-bold cursor-pointer"
                >
                  ✕
                </button>
              </div>

              <form onSubmit={handlePasswordChange} className="space-y-4">
                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-gray-700 dark:text-gray-300">New Password</label>
                  <div className="relative">
                    <input
                      type={showNewPass ? 'text' : 'password'}
                      value={newPassword}
                      onChange={(e) => setNewPassword(e.target.value)}
                      placeholder="Enter new password (min 4 characters)"
                      className="w-full pl-4 pr-10 py-2.5 bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl text-xs text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-teal-500/20 focus:border-teal-500"
                      required
                      minLength={4}
                    />
                    <button
                      type="button"
                      onClick={() => setShowNewPass(!showNewPass)}
                      className="absolute inset-y-0 right-0 pr-3 flex items-center text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 cursor-pointer"
                    >
                      {showNewPass ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  </div>
                </div>

                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-gray-700 dark:text-gray-300">Confirm New Password</label>
                  <input
                    type={showNewPass ? 'text' : 'password'}
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    placeholder="Re-type new password"
                    className="w-full px-4 py-2.5 bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl text-xs text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-teal-500/20 focus:border-teal-500"
                    required
                    minLength={4}
                  />
                </div>

                <div className="pt-2 flex items-center justify-end gap-3">
                  <button
                    type="button"
                    onClick={() => setShowPasswordModal(false)}
                    className="px-4 py-2 bg-gray-100 dark:bg-gray-800 hover:bg-gray-200 dark:hover:bg-gray-700 text-gray-700 dark:text-gray-300 rounded-xl text-xs font-semibold cursor-pointer transition-colors"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={isChangingPass}
                    className="px-5 py-2 bg-teal-600 hover:bg-teal-700 active:scale-95 text-white font-bold rounded-xl text-xs shadow-sm cursor-pointer disabled:opacity-50 transition-all"
                  >
                    {isChangingPass ? 'Updating...' : 'Update Password'}
                  </button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Footer */}
      <footer className="w-full py-4 text-center text-xs text-gray-400 dark:text-gray-500 border-t border-gray-200 dark:border-gray-800 mt-auto">
        Physics Center Academy &copy; {new Date().getFullYear()} &bull; Student Portal
      </footer>
    </div>
  );
}

import React, { useState, useEffect, useRef } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import { useStudentAuth } from '../hooks/useStudentAuth';
import { SRI_LANKAN_DISTRICTS, DISTRICT_NUMBERS, JoinedBatchItem } from '../types';
import { cleanStudentNameForZoom, parseEmailUsernameAndDomain, formatCleanEmail } from '../lib/utils';
import { 
  StudentRegisterLang, 
  SUPPORTED_LANGUAGES, 
  TRANSLATIONS 
} from '../lib/studentRegisterTranslations';
import AcademyLogo from '../components/AcademyLogo';
import { toast } from 'sonner';
import { motion, AnimatePresence } from 'motion/react';
import { 
  CheckCircle2, 
  Copy, 
  Check, 
  Eye, 
  EyeOff, 
  LogIn, 
  UserCheck, 
  Sparkles, 
  ArrowRight, 
  ShieldCheck, 
  BookOpen, 
  RefreshCw,
  Sun,
  Moon,
  ChevronDown,
  Globe
} from 'lucide-react';

export default function StudentRegister() {
  const navigate = useNavigate();
  const { loginStudent } = useStudentAuth();

  // Language State
  const [lang, setLang] = useState<StudentRegisterLang>(() => {
    if (typeof localStorage !== 'undefined') {
      const stored = localStorage.getItem('pca_student_reg_lang');
      if (stored === 'en' || stored === 'ta' || stored === 'si') return stored;
    }
    return 'ta';
  });
  const [isLangMenuOpen, setIsLangMenuOpen] = useState(false);
  const langMenuRef = useRef<HTMLDivElement>(null);

  const handleLangChange = (newLang: StudentRegisterLang) => {
    setLang(newLang);
    if (typeof localStorage !== 'undefined') {
      localStorage.setItem('pca_student_reg_lang', newLang);
    }
  };

  // Close language menu on outside click
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (langMenuRef.current && !langMenuRef.current.contains(event.target as Node)) {
        setIsLangMenuOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const t = TRANSLATIONS[lang];

  // Theme State
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

  // Form State
  const [name, setName] = useState('');
  const [lastName, setLastName] = useState('');
  const [selectedBatch, setSelectedBatch] = useState('2027');
  const [properBatch, setProperBatch] = useState('2026');
  const [joinedBatch, setJoinedBatch] = useState('2027');
  const [stream, setStream] = useState('Biological Science');
  const [school, setSchool] = useState('');
  const [fatherJob, setFatherJob] = useState('');
  const [motherJob, setMotherJob] = useState('');
  const [nic, setNic] = useState('');
  const [gender, setGender] = useState('');
  const [dob, setDob] = useState('');
  const [phone, setPhone] = useState('');
  const [mail, setMail] = useState('');
  const [mailDomain, setMailDomain] = useState('@gmail.com');
  const [address1, setAddress1] = useState('');
  const [address2, setAddress2] = useState('');
  const [district, setDistrict] = useState('Colombo');

  // Validation Error States
  const [phoneError, setPhoneError] = useState('');
  const [mailError, setMailError] = useState('');
  const [nicError, setNicError] = useState('');
  const [genderError, setGenderError] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Dropdown options loaded from database
  const [batchList, setBatchList] = useState<JoinedBatchItem[]>([]);

  // Generated Result state
  const [registeredResult, setRegisteredResult] = useState<{
    pcaid: string;
    name: string;
    stream?: string;
    proper_batch?: string;
    district?: string;
    isExisting?: boolean;
  } | null>(null);

  const [copiedPcaid, setCopiedPcaid] = useState(false);
  const [copiedPassword, setCopiedPassword] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

  // Fetch dropdown data
  useEffect(() => {
    const loadDropdownData = async () => {
      try {
        const { data: batches } = await supabase
          .from('joined_batch_item')
          .select('*')
          .order('joined_batch');

        if (batches && batches.length > 0) {
          setBatchList(batches);
          const firstBatch = batches[0].joined_batch;
          if (firstBatch) {
            setSelectedBatch(firstBatch);
            setProperBatch(firstBatch);
            setJoinedBatch(firstBatch);
          }
        }
      } catch (err) {
        console.error('Error fetching dropdown items:', err);
      }
    };

    loadDropdownData();
  }, []);

  // Auto-clean name helper: removes leading/trailing initials, parenthetical notes, extra spaces and capitalizes words properly
  const cleanStudentName = (rawName: string): string => {
    return cleanStudentNameForZoom(rawName);
  };

  // Validation helper: Phone blur
  const handlePhoneBlur = (phoneVal: string) => {
    const cleanPhone = phoneVal.replace(/\D/g, '');
    if (!cleanPhone) {
      setPhoneError('');
    } else if (cleanPhone.length !== 9) {
      setPhoneError(t.errors.phoneInvalid);
    } else {
      setPhoneError('');
    }
  };

  // Validation helper: Mail blur
  const handleMailBlur = (usernameVal: string, domainVal: string = mailDomain) => {
    const { username, domain } = parseEmailUsernameAndDomain(usernameVal, domainVal);
    if (!username) {
      setMailError('');
      return;
    }
    const fullMail = `${username}${domain}`;
    const endsWithAllowed = fullMail.endsWith('@gmail.com') || fullMail.endsWith('@icloud.com');
    const isInvalid = !endsWithAllowed ||
                      username.length === 0 ||
                      username.includes(' ') ||
                      username.includes('@');
    if (isInvalid) {
      setMailError(t.errors.emailInvalid);
    } else {
      setMailError('');
    }
  };

  // Validation helper: NIC blur
  const handleNicBlur = (nicVal: string) => {
    const clean = nicVal.trim();
    if (!clean) {
      setNicError('');
      return;
    }
    // Validation: 12 digits OR 10 characters (ending in V, v, X, or x)
    const is12Digits = /^\d{12}$/.test(clean);
    const is10Chars = /^\d{9}[vVxX]$/.test(clean);

    if (!is12Digits && !is10Chars) {
      setNicError(t.errors.nicInvalid);
    } else {
      setNicError('');
    }
  };

  const copyToClip = (text: string, type: 'pcaid' | 'password') => {
    navigator.clipboard.writeText(text);
    if (type === 'pcaid') {
      setCopiedPcaid(true);
      setTimeout(() => setCopiedPcaid(false), 2000);
      toast.success('PCA ID copied to clipboard');
    } else {
      setCopiedPassword(true);
      setTimeout(() => setCopiedPassword(false), 2000);
      toast.success('Password copied to clipboard');
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    // 1. Validate Name
    const sanitizedName = cleanStudentName(name);
    if (!sanitizedName) {
      toast.error('மாணவரின் பெயர் அவசியமானது / First Name is required');
      return;
    }
    if (sanitizedName !== name) {
      setName(sanitizedName);
    }

    const sanitizedLastName = cleanStudentName(lastName);
    if (!sanitizedLastName) {
      toast.error('தந்தையின் பெயர் அவசியமானது / Last Name is required');
      return;
    }
    if (sanitizedLastName !== lastName) {
      setLastName(sanitizedLastName);
    }

    // 2. Validate Batch
    if (!selectedBatch) {
      toast.error(t.errors.requiredFields);
      return;
    }

    const isRepeat = selectedBatch === 'Repeat';
    const effectiveProperBatch = isRepeat ? properBatch.trim() : selectedBatch.trim();
    const effectiveJoinedBatch = isRepeat ? joinedBatch.trim() : selectedBatch.trim();
    const effectiveBatchType = isRepeat ? 'Repeat' : 'Proper';

    if (isRepeat) {
      if (!effectiveProperBatch) {
        toast.error(t.errors.properBatchRequired);
        return;
      }
      if (!effectiveJoinedBatch) {
        toast.error(t.errors.requiredFields);
        return;
      }
    }

    // 3. Validate Stream
    if (!stream) {
      toast.error(t.errors.requiredFields);
      return;
    }

    // 4. Validate Gender
    if (!gender) {
      toast.error(t.errors.genderRequired);
      setGenderError(t.errors.genderRequired);
      return;
    }

    // 5. Validate Phone Number (Same validation as old student form)
    const cleanPhone = phone.replace(/\D/g, '');
    if (!cleanPhone) {
      toast.error(t.errors.phoneInvalid);
      setPhoneError(t.errors.phoneInvalid);
      return;
    }
    if (cleanPhone.length !== 9) {
      toast.error(t.errors.phoneInvalid);
      setPhoneError(t.errors.phoneInvalid);
      return;
    }

    // 6. Validate Email (if provided)
    let finalMail: string | null = null;
    if (mail.trim()) {
      const { username, domain } = parseEmailUsernameAndDomain(mail, mailDomain);
      if (username) {
        finalMail = `${username}${domain}`;
        const endsWithAllowed = finalMail.endsWith('@gmail.com') || finalMail.endsWith('@icloud.com');
        const isInvalid = !endsWithAllowed ||
                          username.length === 0 ||
                          username.includes(' ') ||
                          username.includes('@');
        if (isInvalid) {
          toast.error(t.errors.emailInvalid);
          setMailError(t.errors.emailInvalid);
          return;
        }
      }
    }

    // 7. Validate NIC (if provided)
    const cleanNic = nic.trim();
    if (cleanNic) {
      const is12Digits = /^\d{12}$/.test(cleanNic);
      const is10Chars = /^\d{9}[vVxX]$/.test(cleanNic);

      if (!is12Digits && !is10Chars) {
        toast.error(t.errors.nicInvalid);
        setNicError(t.errors.nicInvalid);
        return;
      }
    }

    // 8. Validate District
    if (!district) {
      toast.error(t.errors.requiredFields);
      return;
    }

    setIsSubmitting(true);

    try {
      // =========================================================================
      // STEP 0: Check if student already exists by Phone or NIC (prevent duplicate PCA IDs)
      // =========================================================================
      const phoneDigits = cleanPhone; // e.g. "771234567"
      const phoneVariations = [
        phoneDigits,
        `0${phoneDigits}`,
        `+94${phoneDigits}`,
        `94${phoneDigits}`
      ];
      const phoneOrFilter = phoneVariations.map(p => `phone.eq.${p}`).join(',');
      const rawNic = nic.trim().toUpperCase();
      const duplicateFilter = rawNic ? `${phoneOrFilter},nic.eq.${rawNic}` : phoneOrFilter;

      const { data: existingRecords, error: dupCheckErr } = await supabase
        .from('student')
        .select('pcaid, name, stream, proper_batch, district, phone, nic')
        .is('deleted_at', null)
        .or(duplicateFilter)
        .limit(1);

      if (dupCheckErr) {
        console.warn('Could not check existing student duplicates:', dupCheckErr);
      }

      if (existingRecords && existingRecords.length > 0) {
        const existingStudent = existingRecords[0];

        // Ensure credentials exist in student_app_credentials table for login
        await supabase
          .from('student_app_credentials')
          .upsert({
            pcaid: existingStudent.pcaid,
            password_hash: existingStudent.pcaid,
            status: 'Active',
            student_name: existingStudent.name,
          }, { onConflict: 'pcaid' });

        toast.success(`${t.success.alreadyRegistered}! PCA ID: ${existingStudent.pcaid}`);
        setRegisteredResult({
          pcaid: existingStudent.pcaid,
          name: existingStudent.name,
          stream: existingStudent.stream || stream,
          proper_batch: existingStudent.proper_batch || effectiveProperBatch,
          district: existingStudent.district || district,
          isExisting: true,
        });
        setIsSubmitting(false);
        return;
      }

      // 1. Calculate Stream Code
      let streamChar = 'B';
      if (stream === 'Physical Science') {
        streamChar = 'P';
      } else if (stream === 'Biological Science') {
        streamChar = 'B';
      } else {
        streamChar = 'N';
      }

      // 2. Calculate Batch Type Code (Proper -> P, Repeat -> R)
      const batchTypeChar = effectiveBatchType === 'Repeat' ? 'R' : 'P';

      // 3. Calculate Gender Code (Male -> M, Female -> F, Other -> O)
      let genderChar = 'M';
      const cleanGender = (gender || '').trim().toLowerCase();
      if (cleanGender === 'female' || cleanGender === 'f') {
        genderChar = 'F';
      } else if (cleanGender === 'other' || cleanGender === 'others' || cleanGender === 'o') {
        genderChar = 'O';
      } else if (cleanGender === 'male' || cleanGender === 'm') {
        genderChar = 'M';
      } else {
        genderChar = 'M';
      }

      // 4. Proper Batch Code (last 2 digits)
      const yearStr = String(effectiveProperBatch).trim();
      const properBatchChar = yearStr.slice(-2);

      // 5. District Code (2 digits)
      let districtCode = DISTRICT_NUMBERS[district] || district || '01';
      const digitsOnly = districtCode.replace(/\D/g, '');
      if (digitsOnly) {
        districtCode = digitsOnly.padStart(2, '0');
      } else {
        districtCode = '01';
      }

      // Build prefix (e.g. "BPM2701")
      const prefix = `${streamChar}${batchTypeChar}${genderChar}${properBatchChar}${districtCode}`;

      // 6. Query existing students for max sequence across Proper Batch + District
      const { data: existingStudents, error: queryErr } = await supabase
        .from('student')
        .select('pcaid')
        .eq('proper_batch', effectiveProperBatch)
        .is('deleted_at', null);

      if (queryErr) {
        console.error('Error checking existing PCA IDs:', queryErr);
      }

      let maxSeq = 0;
      if (existingStudents && existingStudents.length > 0) {
        for (const st of existingStudents) {
          if (st.pcaid) {
            const clean = st.pcaid.trim().toUpperCase();
            if (clean.length === 10) {
              const stBatch = clean.slice(3, 5);
              const stDist = clean.slice(5, 7);
              if (stBatch === properBatchChar && stDist === districtCode) {
                const suffix = clean.slice(-3);
                const seqVal = parseInt(suffix, 10);
                // Self-registration belongs to Paid sequence 001 - 899
                if (!isNaN(seqVal) && seqVal >= 1 && seqVal <= 899) {
                  maxSeq = Math.max(maxSeq, seqVal);
                }
              }
            }
          }
        }
      }

      const nextSeq = maxSeq + 1;
      if (nextSeq > 899) {
        toast.error('The registration sequence for this batch and district is full (899 limit reached). Please contact administration.');
        setIsSubmitting(false);
        return;
      }

      const seqStr = String(nextSeq).padStart(3, '0');
      const finalPcaId = `${prefix}${seqStr}`;

      // 7. Combine Address 1 & Address 2
      const combinedAddress = [address1.trim(), address2.trim()].filter(Boolean).join(', ');
      const studentFullName = [name.trim(), lastName.trim()].filter(Boolean).join(' ');

      // 8. Insert Student Record into `student` table (matching exact schema columns)
      const studentPayload = {
        pcaid: finalPcaId,
        name: name.trim(),
        last_name: lastName.trim() || null,
        stream: stream || null,
        proper_batch: effectiveProperBatch || null,
        joined_batch: effectiveJoinedBatch || null,
        district: district || null,
        phone: cleanPhone || null,
        mail: finalMail,
        nic: nic.trim().toUpperCase() || null,
        dob: dob || null,
        gender: gender ? gender.trim() : null,
        school: school.trim() || null,
        father_job: fatherJob.trim() || null,
        mother_job: motherJob.trim() || null,
        address: combinedAddress || null,
        admin: 'self',
        created_at: new Date().toISOString()
      };

      let { error: insertStudentErr } = await supabase
        .from('student')
        .insert(studentPayload);

      // Graceful fallback if database column 'dob', 'last_name', 'father_job', or 'mother_job' is missing in Postgres
      if (insertStudentErr && (insertStudentErr.message?.includes('column') || insertStudentErr.hint?.includes('column') || insertStudentErr.message?.includes('schema'))) {
        console.warn('DB schema mismatch, retrying insert without problematic columns:', insertStudentErr);
        const slimPayload = { ...studentPayload };
        const colMatch = insertStudentErr.message?.match(/Could not find the '([^']+)' column/i);
        if (colMatch && colMatch[1]) {
          delete (slimPayload as any)[colMatch[1]];
        }
        if (insertStudentErr.message?.includes('dob') || insertStudentErr.hint?.includes('dob')) {
          delete (slimPayload as any).dob;
        }
        if (insertStudentErr.message?.includes('last_name') || insertStudentErr.hint?.includes('last_name')) {
          delete (slimPayload as any).last_name;
        }
        if (insertStudentErr.message?.includes('father_job') || insertStudentErr.hint?.includes('father_job')) {
          delete (slimPayload as any).father_job;
        }
        if (insertStudentErr.message?.includes('mother_job') || insertStudentErr.hint?.includes('mother_job')) {
          delete (slimPayload as any).mother_job;
        }
        const retryResult = await supabase
          .from('student')
          .insert(slimPayload);
        insertStudentErr = retryResult.error;
      }

      if (insertStudentErr) {
        // If unique constraint was triggered (e.g. race condition or edge case)
        if (
          insertStudentErr.message?.includes('idx_student_unique_active_phone') ||
          insertStudentErr.message?.includes('idx_student_unique_active_nic') ||
          insertStudentErr.message?.includes('duplicate key value')
        ) {
          const { data: dupStudent } = await supabase
            .from('student')
            .select('pcaid, name, last_name, stream, proper_batch, district')
            .is('deleted_at', null)
            .or(duplicateFilter)
            .limit(1)
            .maybeSingle();

          if (dupStudent) {
            const dupFullName = [dupStudent.name, dupStudent.last_name].filter(Boolean).join(' ');
            await supabase
              .from('student_app_credentials')
              .upsert({
                pcaid: dupStudent.pcaid,
                password_hash: dupStudent.pcaid,
                status: 'Active',
                student_name: dupFullName || dupStudent.name,
              }, { onConflict: 'pcaid' });

            toast.success(`நீங்கள் ஏற்கனவே பதிவு செய்துள்ளீர்கள்! உங்களுடைய PCA ID: ${dupStudent.pcaid}`);
            setRegisteredResult({
              pcaid: dupStudent.pcaid,
              name: dupFullName || dupStudent.name,
              stream: dupStudent.stream || stream,
              proper_batch: dupStudent.proper_batch || effectiveProperBatch,
              district: dupStudent.district || district,
              isExisting: true,
            });
            setIsSubmitting(false);
            return;
          }
        }
        throw new Error(`Failed to create student record: ${insertStudentErr.message}`);
      }

      // 9. Create App Credentials in `student_app_credentials` table (PCA ID & password are same!)
      const credentialsPayload = {
        pcaid: finalPcaId,
        student_name: studentFullName,
        password_hash: finalPcaId, // The PCAID and password are same
        status: 'Active',
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      };

      const { error: insertCredsErr } = await supabase
        .from('student_app_credentials')
        .insert(credentialsPayload);

      if (insertCredsErr) {
        console.warn('Credentials sync warning:', insertCredsErr);
      }

      toast.success(t.success.newTitle);
      setRegisteredResult({
        pcaid: finalPcaId,
        name: studentFullName,
        stream: stream,
        proper_batch: effectiveProperBatch,
        district: district
      });

    } catch (err: any) {
      console.error('Registration failed:', err);
      toast.error(err.message || t.errors.genericError);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDirectLogin = async () => {
    if (!registeredResult) return;
    const res = await loginStudent(registeredResult.pcaid, registeredResult.pcaid);
    if (res.success) {
      toast.success(`Welcome, ${registeredResult.name}!`);
      navigate('/student-portal');
    } else {
      navigate('/student-login');
    }
  };

  const isRepeatSelected = selectedBatch === 'Repeat';

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950 text-slate-800 dark:text-slate-100 flex flex-col font-sans transition-colors selection:bg-teal-500 selection:text-white">
      {/* Top Navigation Bar */}
      <header className="w-full bg-white dark:bg-slate-900 border-b border-slate-200 dark:border-slate-800 sticky top-0 z-40 px-3 sm:px-6 py-2.5 sm:py-3 flex items-center justify-between gap-2 shadow-xs">
        <div className="flex items-center gap-2 sm:gap-2.5 min-w-0">
          <AcademyLogo width={26} height={26} showText={false} className="shrink-0" />
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <span className="font-bold sm:font-extrabold tracking-tight text-slate-900 dark:text-white text-xs sm:text-base whitespace-nowrap truncate">
                Physics Cube Academy
              </span>
              <span className="hidden sm:inline-flex text-[10px] uppercase font-bold tracking-wider px-2 py-0.5 bg-teal-50 dark:bg-teal-950/60 text-teal-700 dark:text-teal-400 border border-teal-200 dark:border-teal-800 rounded-full whitespace-nowrap">
                {t.nav.portalBadge}
              </span>
            </div>
            <p className="text-[11px] text-slate-500 dark:text-slate-400 font-medium hidden md:block leading-tight">{t.nav.subtitle}</p>
          </div>
        </div>

        <div className="flex items-center gap-1.5 sm:gap-2 shrink-0">
          {/* Language Switcher Dropdown (Placed next to theme toggle button) */}
          <div className="relative" ref={langMenuRef}>
            <button
              type="button"
              onClick={() => setIsLangMenuOpen(prev => !prev)}
              className="flex items-center gap-1.5 px-2.5 py-1.5 sm:py-2 text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg sm:rounded-xl transition-colors cursor-pointer border border-slate-200 dark:border-slate-700 text-xs font-semibold select-none shadow-2xs"
              title={t.nav.language}
              aria-label="Select Language"
              aria-expanded={isLangMenuOpen}
            >
              <Globe size={15} className="text-teal-600 dark:text-teal-400 shrink-0" />
              <span className="text-[11px] sm:text-xs font-bold">
                {SUPPORTED_LANGUAGES.find(l => l.code === lang)?.nativeLabel || 'English'}
              </span>
              <ChevronDown size={12} className={`text-slate-400 transition-transform duration-150 ${isLangMenuOpen ? 'rotate-180' : ''}`} />
            </button>

            {/* Dropdown Menu */}
            {isLangMenuOpen && (
              <div className="absolute right-0 mt-1.5 w-40 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl shadow-lg py-1 z-50 animate-in fade-in zoom-in-95 duration-150">
                {SUPPORTED_LANGUAGES.map(opt => (
                  <button
                    key={opt.code}
                    type="button"
                    onClick={() => {
                      handleLangChange(opt.code);
                      setIsLangMenuOpen(false);
                    }}
                    className={`w-full flex items-center justify-between px-3 py-2 text-left text-xs font-medium cursor-pointer transition-colors ${
                      lang === opt.code
                        ? 'bg-teal-50 dark:bg-teal-950/60 text-teal-700 dark:text-teal-300 font-bold'
                        : 'text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800'
                    }`}
                  >
                    <span className="flex items-center gap-1.5">
                      <span>{opt.nativeLabel}</span>
                      {opt.code !== 'en' && <span className="text-[10px] text-slate-400 font-normal">({opt.label})</span>}
                    </span>
                    {lang === opt.code && <Check size={14} className="text-teal-600 dark:text-teal-400" />}
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Theme Option Toggle */}
          <button
            type="button"
            onClick={toggleTheme}
            className="p-1.5 sm:p-2 text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg sm:rounded-xl transition-colors cursor-pointer border border-slate-200 dark:border-slate-700"
            title={theme === 'dark' ? t.nav.toggleThemeLight : t.nav.toggleThemeDark}
            aria-label="Toggle Theme"
          >
            {theme === 'dark' ? (
              <Sun size={16} className="text-amber-400" />
            ) : (
              <Moon size={16} className="text-slate-600" />
            )}
          </button>

          {/* Student Login Link */}
          <Link
            to="/student-login"
            className="flex items-center gap-1.5 px-2.5 sm:px-3.5 py-1.5 sm:py-2 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 border border-slate-200 dark:border-slate-700 rounded-lg sm:rounded-xl text-[11px] sm:text-xs font-bold transition-all shadow-xs cursor-pointer whitespace-nowrap"
          >
            <LogIn className="w-3.5 h-3.5 shrink-0" />
            <span>{t.nav.studentLogin}</span>
          </Link>
        </div>
      </header>

      {/* Main Content Area */}
      <main className="flex-1 max-w-3xl w-full mx-auto p-3 sm:p-6 lg:p-8 flex flex-col justify-center">
        <AnimatePresence mode="wait">
          {registeredResult ? (
            /* Registration Success Credentials View */
            <motion.div
              key="success-card"
              initial={{ opacity: 0, scale: 0.98, y: 15 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.98 }}
              transition={{ duration: 0.25 }}
              className="bg-white dark:bg-slate-900 border border-teal-200 dark:border-teal-800/60 rounded-2xl sm:rounded-3xl p-4 sm:p-8 shadow-sm space-y-6 sm:space-y-8"
            >
              {/* Header Badge */}
              <div className="text-center space-y-3">
                <div className="inline-flex items-center justify-center w-14 h-14 sm:w-16 sm:h-16 bg-teal-50 dark:bg-teal-950/60 border border-teal-200 dark:border-teal-800 rounded-full text-teal-600 dark:text-teal-400 shadow-inner">
                  <CheckCircle2 className="w-7 h-7 sm:w-8 sm:h-8" />
                </div>
                {registeredResult.isExisting ? (
                  <div>
                    <span className="inline-flex items-center gap-1.5 px-3 py-1 bg-amber-50 dark:bg-amber-950/60 border border-amber-300 dark:border-amber-700 text-amber-800 dark:text-amber-300 text-xs font-bold rounded-full">
                      <Sparkles className="w-3.5 h-3.5" />
                      <span>{t.success.alreadyRegistered}</span>
                    </span>
                  </div>
                ) : (
                  <div>
                    <span className="inline-flex items-center gap-1.5 px-3 py-1 bg-teal-50 dark:bg-teal-950/60 border border-teal-300 dark:border-teal-700 text-teal-800 dark:text-teal-300 text-xs font-bold rounded-full">
                      <Check className="w-3.5 h-3.5" />
                      <span>{t.success.newRegistration}</span>
                    </span>
                  </div>
                )}
                <h1 className="text-xl sm:text-2xl md:text-3xl font-black text-slate-900 dark:text-white tracking-tight">
                  {registeredResult.isExisting ? t.success.existingTitle : t.success.newTitle}
                </h1>
                <p className="text-slate-600 dark:text-slate-300 text-xs sm:text-sm max-w-md mx-auto">
                  {registeredResult.isExisting ? (
                    <>
                      <strong className="text-teal-600 dark:text-teal-400">{registeredResult.name}</strong>, {t.success.existingDesc}
                    </>
                  ) : (
                    <>
                      {t.success.newDesc.split('{name}')[0]}
                      <strong className="text-teal-600 dark:text-teal-400">{registeredResult.name}</strong>
                      {t.success.newDesc.split('{name}')[1] || ''}
                    </>
                  )}
                </p>
              </div>

              {/* Credentials Highlight Card */}
              <div className="bg-slate-50 dark:bg-slate-800/60 border border-teal-200 dark:border-teal-800/80 rounded-2xl p-4 sm:p-6 space-y-5 sm:space-y-6 shadow-xs relative overflow-hidden">
                <div className="flex items-center justify-between pb-3 border-b border-slate-200 dark:border-slate-700">
                  <div className="flex items-center gap-2">
                    <ShieldCheck className="w-4 h-4 sm:w-5 sm:h-5 text-teal-600 dark:text-teal-400" />
                    <span className="text-[11px] sm:text-xs font-black uppercase tracking-wider text-teal-700 dark:text-teal-300">{t.success.credentialsTitle}</span>
                  </div>
                  <span className="text-[10px] sm:text-[11px] font-semibold text-slate-500 dark:text-slate-400">{t.success.saveSecurely}</span>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4">
                  {/* PCA ID / Username */}
                  <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl p-3.5 sm:p-4 space-y-1.5 shadow-xs">
                    <span className="text-[10px] sm:text-[11px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">{t.success.usernameLabel}</span>
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-lg sm:text-2xl font-mono font-black text-slate-900 dark:text-white tracking-wider sm:tracking-widest selection:bg-teal-500">
                        {registeredResult.pcaid}
                      </span>
                      <button
                        type="button"
                        onClick={() => copyToClip(registeredResult.pcaid, 'pcaid')}
                        className="flex items-center gap-1.5 px-2.5 py-1.5 bg-teal-50 dark:bg-teal-950/60 hover:bg-teal-100 dark:hover:bg-teal-900 text-teal-600 dark:text-teal-400 rounded-lg transition-colors cursor-pointer border border-teal-100 dark:border-teal-800 text-xs font-bold shrink-0"
                        title={t.success.copy}
                      >
                        {copiedPcaid ? (
                          <>
                            <Check className="w-3.5 h-3.5 text-green-500" />
                            <span className="text-green-600 dark:text-green-400">{t.success.copied}</span>
                          </>
                        ) : (
                          <>
                            <Copy className="w-3.5 h-3.5" />
                            <span>{t.success.copy}</span>
                          </>
                        )}
                      </button>
                    </div>
                  </div>

                  {/* Password */}
                  <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl p-3.5 sm:p-4 space-y-1.5 shadow-xs">
                    <span className="text-[10px] sm:text-[11px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">{t.success.passwordLabel}</span>
                    <div className="flex items-center justify-between gap-2">
                      <div className="flex items-center gap-2 font-mono font-black text-slate-900 dark:text-white text-lg sm:text-2xl tracking-wider sm:tracking-widest">
                        {showPassword ? registeredResult.pcaid : '••••••••••'}
                        <button
                          type="button"
                          onClick={() => setShowPassword(!showPassword)}
                          className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 transition-colors p-1 cursor-pointer"
                        >
                          {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                        </button>
                      </div>
                      <button
                        type="button"
                        onClick={() => copyToClip(registeredResult.pcaid, 'password')}
                        className="flex items-center gap-1.5 px-2.5 py-1.5 bg-teal-50 dark:bg-teal-950/60 hover:bg-teal-100 dark:hover:bg-teal-900 text-teal-600 dark:text-teal-400 rounded-lg transition-colors cursor-pointer border border-teal-100 dark:border-teal-800 text-xs font-bold shrink-0"
                        title={t.success.copy}
                      >
                        {copiedPassword ? (
                          <>
                            <Check className="w-3.5 h-3.5 text-green-500" />
                            <span className="text-green-600 dark:text-green-400">{t.success.copied}</span>
                          </>
                        ) : (
                          <>
                            <Copy className="w-3.5 h-3.5" />
                            <span>{t.success.copy}</span>
                          </>
                        )}
                      </button>
                    </div>
                  </div>
                </div>

                {/* Important Notice */}
                <div className="bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800/50 rounded-xl p-3 sm:p-3.5 text-[11px] sm:text-xs text-amber-900 dark:text-amber-300 leading-relaxed flex items-start gap-2.5">
                  <Sparkles className="w-4 h-4 text-amber-500 shrink-0 mt-0.5" />
                  <div>
                    {t.success.importantNotice}
                  </div>
                </div>
              </div>

              {/* Action Buttons */}
              <div className="flex flex-col sm:flex-row items-center gap-3 sm:gap-4 pt-2">
                <button
                  type="button"
                  onClick={handleDirectLogin}
                  className="w-full sm:flex-1 py-3 sm:py-3.5 px-6 bg-teal-600 hover:bg-teal-700 active:bg-teal-800 text-white font-bold rounded-xl text-xs sm:text-sm transition-all shadow-sm flex items-center justify-center gap-2 cursor-pointer"
                >
                  <span>{t.success.openAccount}</span>
                  <ArrowRight className="w-4 h-4" />
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setRegisteredResult(null);
                    setName('');
                    setLastName('');
                    setFatherJob('');
                    setMotherJob('');
                    setPhone('');
                    setMail('');
                    setNic('');
                    setSchool('');
                    setAddress1('');
                    setAddress2('');
                    setPhoneError('');
                    setMailError('');
                  }}
                  className="w-full sm:w-auto py-3 sm:py-3.5 px-6 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 font-semibold rounded-xl text-xs sm:text-sm transition-colors cursor-pointer border border-slate-200 dark:border-slate-700"
                >
                  {t.success.registerAnother}
                </button>
              </div>
            </motion.div>
          ) : (
            /* Registration Form View */
            <motion.div
              key="register-form"
              initial={{ opacity: 0, y: 15 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -15 }}
              transition={{ duration: 0.25 }}
              className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl sm:rounded-3xl p-4 sm:p-8 md:p-10 shadow-sm space-y-6 sm:space-y-8"
            >
              {/* Form Header */}
              <div className="border-b border-slate-200 dark:border-slate-800 pb-4 sm:pb-5">
                <h1 className="text-xl sm:text-2xl md:text-3xl font-black text-slate-900 dark:text-white tracking-tight">{t.form.title}</h1>
                <p className="text-slate-500 dark:text-slate-400 text-[11px] sm:text-xs md:text-sm mt-1">
                  {t.form.subtitle}
                </p>
              </div>

              <form onSubmit={handleSubmit} className="space-y-6">
                
                {/* 1. Student Name & Last Name */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="space-y-1.5">
                    <label className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                      {t.form.firstName} <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="text"
                      value={name}
                      onChange={(e) => setName(e.target.value)}
                      onBlur={() => {
                        const formatted = cleanStudentName(name);
                        if (formatted && formatted !== name) {
                          setName(formatted);
                        }
                      }}
                      placeholder={t.form.firstNamePlaceholder}
                      className="w-full px-4 py-2.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-xs font-medium text-slate-900 dark:text-slate-100 placeholder:text-slate-400 dark:placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-teal-500/20 focus:border-teal-500 transition-all"
                      required
                    />
                  </div>

                  <div className="space-y-1.5">
                    <label className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                      {t.form.lastName} <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="text"
                      value={lastName}
                      onChange={(e) => setLastName(e.target.value)}
                      onBlur={() => {
                        const formatted = cleanStudentName(lastName);
                        if (formatted && formatted !== lastName) {
                          setLastName(formatted);
                        }
                      }}
                      placeholder={t.form.lastNamePlaceholder}
                      className="w-full px-4 py-2.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-xs font-medium text-slate-900 dark:text-slate-100 placeholder:text-slate-400 dark:placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-teal-500/20 focus:border-teal-500 transition-all"
                      required
                    />
                  </div>
                </div>

                {/* 2. Batch */}
                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                    {t.form.batch} <span className="text-red-500">*</span>
                  </label>
                  <select
                    value={selectedBatch}
                    onChange={(e) => {
                      const val = e.target.value;
                      setSelectedBatch(val);
                      if (val !== 'Repeat') {
                        setProperBatch(val);
                        setJoinedBatch(val);
                      }
                    }}
                    className="w-full px-3.5 py-2.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-xs font-medium text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-teal-500/20 focus:border-teal-500 transition-all cursor-pointer"
                    required
                  >
                    {batchList.length > 0 ? (
                      batchList.map(b => (
                        <option key={b.id || b.joined_batch} value={b.joined_batch}>{b.joined_batch}</option>
                      ))
                    ) : (
                      <>
                        <option value="2025">2025</option>
                        <option value="2026">2026</option>
                        <option value="2027">2027</option>
                        <option value="2028">2028</option>
                        <option value="2029">2029</option>
                      </>
                    )}
                    <option value="Repeat">Repeat</option>
                  </select>
                </div>

                {/* Conditional Fields: If 'Repeat' is selected */}
                <AnimatePresence>
                  {isRepeatSelected && (
                    <motion.div
                      initial={{ opacity: 0, height: 0 }}
                      animate={{ opacity: 1, height: 'auto' }}
                      exit={{ opacity: 0, height: 0 }}
                      transition={{ duration: 0.2 }}
                      className="overflow-hidden space-y-4 p-4 bg-teal-50/50 dark:bg-teal-950/20 border border-teal-200 dark:border-teal-800/60 rounded-2xl"
                    >
                      <div className="flex items-center gap-2 pb-1 border-b border-teal-100 dark:border-teal-900/60 text-teal-700 dark:text-teal-400 text-xs font-bold uppercase tracking-wider">
                        <BookOpen className="w-3.5 h-3.5" />
                        <span>{t.form.repeatDetails}</span>
                      </div>

                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        {/* Proper Batch */}
                        <div className="space-y-1.5">
                          <label className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                            {t.form.properBatch} <span className="text-red-500">*</span>
                          </label>
                          <input
                            type="text"
                            value={properBatch}
                            onChange={(e) => setProperBatch(e.target.value)}
                            placeholder={t.form.properBatchPlaceholder}
                            className="w-full px-4 py-2.5 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl text-xs font-medium text-slate-900 dark:text-slate-100 placeholder:text-slate-400 dark:placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-teal-500/20 focus:border-teal-500 transition-all"
                            required={isRepeatSelected}
                          />
                        </div>

                        {/* Joined Batch */}
                        <div className="space-y-1.5">
                          <label className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                            {t.form.joinedBatch} <span className="text-red-500">*</span>
                          </label>
                          <select
                            value={joinedBatch}
                            onChange={(e) => setJoinedBatch(e.target.value)}
                            className="w-full px-3.5 py-2.5 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl text-xs font-medium text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-teal-500/20 focus:border-teal-500 transition-all cursor-pointer"
                            required={isRepeatSelected}
                          >
                            {batchList.length > 0 ? (
                              batchList.map(b => (
                                <option key={b.id || b.joined_batch} value={b.joined_batch}>{b.joined_batch}</option>
                              ))
                            ) : (
                              <>
                                <option value="2026">2026</option>
                                <option value="2027">2027</option>
                                <option value="2028">2028</option>
                              </>
                            )}
                          </select>
                        </div>
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>

                {/* 5. Stream */}
                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                    {t.form.stream} <span className="text-red-500">*</span>
                  </label>
                  <select
                    value={stream}
                    onChange={(e) => setStream(e.target.value)}
                    className="w-full px-3.5 py-2.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-xs font-medium text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-teal-500/20 focus:border-teal-500 transition-all cursor-pointer"
                    required
                  >
                    <option value="Biological Science">{t.form.streamBio}</option>
                    <option value="Physical Science">{t.form.streamMaths}</option>
                    <option value="Non Stream">{t.form.streamOther}</option>
                  </select>
                </div>

                {/* 6. School */}
                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                    {t.form.school}
                  </label>
                  <input
                    type="text"
                    value={school}
                    onChange={(e) => setSchool(e.target.value)}
                    placeholder={t.form.schoolPlaceholder}
                    className="w-full px-4 py-2.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-xs font-medium text-slate-900 dark:text-slate-100 placeholder:text-slate-400 dark:placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-teal-500/20 focus:border-teal-500 transition-all"
                  />
                </div>

                {/* Parents' Occupation */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="space-y-1.5">
                    <label className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                      {t.form.fatherJob}
                    </label>
                    <input
                      type="text"
                      value={fatherJob}
                      onChange={(e) => setFatherJob(e.target.value)}
                      placeholder={t.form.fatherJobPlaceholder}
                      className="w-full px-4 py-2.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-xs font-medium text-slate-900 dark:text-slate-100 placeholder:text-slate-400 dark:placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-teal-500/20 focus:border-teal-500 transition-all"
                    />
                  </div>

                  <div className="space-y-1.5">
                    <label className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                      {t.form.motherJob}
                    </label>
                    <input
                      type="text"
                      value={motherJob}
                      onChange={(e) => setMotherJob(e.target.value)}
                      placeholder={t.form.motherJobPlaceholder}
                      className="w-full px-4 py-2.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-xs font-medium text-slate-900 dark:text-slate-100 placeholder:text-slate-400 dark:placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-teal-500/20 focus:border-teal-500 transition-all"
                    />
                  </div>
                </div>

                {/* 7. NIC */}
                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                    {t.form.nic}
                  </label>
                  <input
                    type="text"
                    value={nic}
                    onChange={(e) => {
                      setNic(e.target.value);
                      if (nicError) setNicError('');
                    }}
                    onBlur={() => handleNicBlur(nic)}
                    placeholder={t.form.nicPlaceholder}
                    className={`w-full px-4 py-2.5 bg-slate-50 dark:bg-slate-800 border rounded-xl text-xs font-medium text-slate-900 dark:text-slate-100 placeholder:text-slate-400 dark:placeholder:text-slate-500 focus:outline-none focus:ring-2 transition-all ${
                      nicError
                        ? 'border-red-500 focus:ring-red-500/20 focus:border-red-500'
                        : 'border-slate-200 dark:border-slate-700 focus:ring-teal-500/20 focus:border-teal-500'
                    }`}
                  />
                  {nicError && (
                    <span className="text-[11px] text-red-500 font-semibold">{nicError}</span>
                  )}
                </div>

                {/* 8. Gender */}
                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                    {t.form.gender} <span className="text-red-500">*</span>
                  </label>
                  <select
                    value={gender}
                    onChange={(e) => {
                      setGender(e.target.value);
                      if (genderError) setGenderError('');
                    }}
                    className={`w-full px-3.5 py-2.5 bg-slate-50 dark:bg-slate-800 border rounded-xl text-xs font-medium text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 transition-all cursor-pointer ${
                      genderError
                        ? 'border-red-500 focus:ring-red-500/20 focus:border-red-500'
                        : 'border-slate-200 dark:border-slate-700 focus:ring-teal-500/20 focus:border-teal-500'
                    }`}
                    required
                  >
                    <option value="" disabled>{t.form.genderSelect}</option>
                    <option value="Male">{t.form.genderMale}</option>
                    <option value="Female">{t.form.genderFemale}</option>
                    <option value="Other">{t.form.genderOther}</option>
                  </select>
                  {genderError && (
                    <span className="text-[11px] text-red-500 font-semibold">{genderError}</span>
                  )}
                </div>

                {/* 9. Date of Birth (DOB) */}
                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                    {t.form.dob}
                  </label>
                  <input
                    type="date"
                    value={dob}
                    onChange={(e) => setDob(e.target.value)}
                    max={new Date().toISOString().split('T')[0]}
                    className="w-full px-3.5 py-2.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-xs font-medium text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-teal-500/20 focus:border-teal-500 transition-all cursor-pointer"
                  />
                </div>

                {/* 10. Phone No */}
                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                    {t.form.phone} <span className="text-red-500">*</span>
                  </label>
                  <div className={`relative flex items-center border rounded-xl overflow-hidden focus-within:ring-2 transition-all bg-slate-50 dark:bg-slate-800 ${
                    phoneError 
                      ? 'border-red-500 focus-within:ring-red-500/20 focus-within:border-red-500' 
                      : 'border-slate-200 dark:border-slate-700 focus-within:ring-teal-500/20 focus-within:border-teal-500'
                  }`}>
                    <div className="flex items-center gap-1 sm:gap-1.5 px-2.5 sm:px-3.5 py-2 sm:py-2.5 bg-slate-100 dark:bg-slate-800/90 border-r border-slate-200 dark:border-slate-700 select-none text-xs font-bold text-slate-700 dark:text-slate-300 shrink-0">
                      <span className="text-sm sm:text-base" role="img" aria-label="Sri Lanka Flag">🇱🇰</span>
                      <span>+94</span>
                      <ChevronDown size={11} className="text-slate-400" />
                    </div>
                    <input
                      type="text"
                      value={phone}
                      onChange={(e) => {
                        let digits = e.target.value.replace(/\D/g, '');
                        if (digits.startsWith('0')) {
                          digits = digits.slice(1);
                        }
                        setPhone(digits.slice(0, 9));
                        if (phoneError) setPhoneError('');
                      }}
                      onBlur={() => handlePhoneBlur(phone)}
                      placeholder={t.form.phonePlaceholder}
                      className="w-full px-3 py-2 sm:py-2.5 bg-transparent focus:outline-none text-xs font-medium text-slate-900 dark:text-slate-100 placeholder:text-slate-400 dark:placeholder:text-slate-500"
                      required
                    />
                  </div>
                  {phoneError && (
                    <span className="text-[11px] text-red-500 font-semibold">{phoneError}</span>
                  )}
                </div>

                {/* 11. Email Address */}
                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                    {t.form.email}
                  </label>
                  <div className={`relative flex items-center border rounded-xl overflow-hidden focus-within:ring-2 transition-all bg-slate-50 dark:bg-slate-800 ${
                    mailError 
                      ? 'border-red-500 focus-within:ring-red-500/20 focus-within:border-red-500' 
                      : 'border-slate-200 dark:border-slate-700 focus-within:ring-teal-500/20 focus-within:border-teal-500'
                  }`}>
                    <input
                      type="text"
                      value={mail}
                      onChange={(e) => {
                        const inputVal = e.target.value;
                        const { username, domain } = parseEmailUsernameAndDomain(inputVal, mailDomain);
                        setMail(username);
                        if (domain !== mailDomain) {
                          setMailDomain(domain);
                        }
                        if (mailError) setMailError('');
                      }}
                      onBlur={() => {
                        const { username, domain } = parseEmailUsernameAndDomain(mail, mailDomain);
                        if (username !== mail) setMail(username);
                        if (domain !== mailDomain) setMailDomain(domain);
                        handleMailBlur(username, domain);
                      }}
                      placeholder={t.form.emailPlaceholder}
                      className="w-full px-3 py-2 sm:py-2.5 bg-transparent focus:outline-none text-xs font-medium text-slate-900 dark:text-slate-100 placeholder:text-slate-400 dark:placeholder:text-slate-500 min-w-0"
                    />
                    <select
                      value={mailDomain}
                      onChange={(e) => {
                        const newDomain = e.target.value;
                        setMailDomain(newDomain);
                        if (mailError) setMailError('');
                        if (mail) handleMailBlur(mail, newDomain);
                      }}
                      className="px-2 sm:px-3 py-2 sm:py-2.5 bg-slate-100 dark:bg-slate-800/90 border-l border-slate-200 dark:border-slate-700 text-[11px] sm:text-xs font-bold text-slate-700 dark:text-slate-300 focus:outline-none cursor-pointer shrink-0"
                    >
                      <option value="@gmail.com">@gmail.com</option>
                      <option value="@icloud.com">@icloud.com</option>
                    </select>
                  </div>
                  {mailError && (
                    <span className="text-[11px] text-red-500 font-semibold">{mailError}</span>
                  )}
                </div>

                {/* 12. Address 1 */}
                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                    {t.form.address1}
                  </label>
                  <input
                    type="text"
                    value={address1}
                    onChange={(e) => setAddress1(e.target.value)}
                    placeholder={t.form.address1Placeholder}
                    className="w-full px-4 py-2.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-xs font-medium text-slate-900 dark:text-slate-100 placeholder:text-slate-400 dark:placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-teal-500/20 focus:border-teal-500 transition-all"
                  />
                </div>

                {/* 13. Address 2 */}
                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                    {t.form.address2}
                  </label>
                  <input
                    type="text"
                    value={address2}
                    onChange={(e) => setAddress2(e.target.value)}
                    placeholder={t.form.address2Placeholder}
                    className="w-full px-4 py-2.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-xs font-medium text-slate-900 dark:text-slate-100 placeholder:text-slate-400 dark:placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-teal-500/20 focus:border-teal-500 transition-all"
                  />
                </div>

                {/* 14. District */}
                <div className="space-y-1.5">
                  <div className="flex items-center gap-2">
                    <label className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                      {t.form.district} <span className="text-red-500">*</span>
                    </label>
                    {district && (
                      <span className="text-[10px] font-bold text-teal-700 dark:text-teal-400 bg-teal-50 dark:bg-teal-950/60 border border-teal-200 dark:border-teal-800 px-1.5 py-0.2 rounded-md uppercase tracking-wider">
                        {DISTRICT_NUMBERS[district] || district}
                      </span>
                    )}
                  </div>
                  <select
                    value={district}
                    onChange={(e) => setDistrict(e.target.value)}
                    className="w-full px-3.5 py-2.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-xs font-medium text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-teal-500/20 focus:border-teal-500 transition-all cursor-pointer"
                    required
                  >
                    {SRI_LANKAN_DISTRICTS.map(d => (
                      <option key={d} value={d}>{d}</option>
                    ))}
                  </select>
                </div>

                {/* Submit Action */}
                <div className="pt-4 border-t border-slate-200 dark:border-slate-800 flex flex-col sm:flex-row items-center justify-between gap-4">
                  <p className="text-xs text-slate-500 dark:text-slate-400">
                    {t.form.footerNote}
                  </p>

                  <button
                    type="submit"
                    disabled={isSubmitting}
                    className="w-full sm:w-auto px-8 py-3.5 bg-teal-600 hover:bg-teal-700 active:bg-teal-800 text-white font-bold rounded-xl text-xs sm:text-sm transition-all shadow-sm shadow-teal-700/10 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2 cursor-pointer shrink-0"
                  >
                    {isSubmitting ? (
                      <>
                        <RefreshCw className="w-4 h-4 animate-spin" />
                        <span>{t.form.submitting}</span>
                      </>
                    ) : (
                      <>
                        <span>{t.form.submit}</span>
                        <ArrowRight className="w-4 h-4" />
                      </>
                    )}
                  </button>
                </div>
              </form>
            </motion.div>
          )}
        </AnimatePresence>
      </main>

      {/* Footer */}
      <footer className="w-full py-4 text-center text-xs text-slate-400 dark:text-slate-600 border-t border-slate-200 dark:border-slate-800 mt-auto">
        {t.footer} &copy; {new Date().getFullYear()}
      </footer>
    </div>
  );
}

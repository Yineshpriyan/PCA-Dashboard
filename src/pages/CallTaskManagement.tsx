import React, { useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';
import { toast } from 'sonner';
import * as XLSX from 'xlsx';
import { 
  Plus, 
  RotateCcw, 
  Search, 
  FileDown, 
  FileUp,
  Copy, 
  Edit, 
  Trash2, 
  ExternalLink,
  ChevronRight,
  Filter,
  CheckCircle2,
  Calendar,
  X,
  ChevronDown,
  Check,
  MessageCircle
} from 'lucide-react';
import { 
  CallTask, 
  ClassItem, 
  PackageItem, 
  JoinedBatchItem,
  SRI_LANKAN_DISTRICTS, 
  CallStatus, 
  LeadStatus 
} from '../types';
import { useAuth } from '../hooks/useAuth';
import { cn, formatDate, copyToClipboard, exportToExcel } from '../lib/utils';
import { motion, AnimatePresence } from 'motion/react';
import { useNavigate } from 'react-router-dom';
import { logTransaction } from '../lib/transactions';

export function CallTaskForm({ editData, onComplete }: { editData?: CallTask; onComplete?: (updatedTask?: CallTask) => void }) {
  const { user } = useAuth();
  const [loading, setLoading] = useState(false);
  const [classTypes, setClassTypes] = useState<ClassItem[]>([]);
  const [packageTypes, setPackageTypes] = useState<PackageItem[]>([]);
  const [joinedBatches, setJoinedBatches] = useState<JoinedBatchItem[]>([]);
  const [selectedClass, setSelectedClass] = useState('');
  const [selectedPackage, setSelectedPackage] = useState('');
  
  const [formData, setFormData] = useState({
    pcaid: editData?.pcaid || '',
    name: editData?.name || '',
    phone: editData?.phone || '',
    stream: editData?.stream || '',
    proper_batch: editData?.proper_batch || '',
    joined_batch: editData?.joined_batch || '',
    school: editData?.school || '',
    district: editData?.district || '',
    mail: editData?.mail || '',
    address: editData?.address || '',
    asked_class_type: editData?.asked_class_type || '',
    asked_package_type: editData?.asked_package_type || '',
    first_call_status: editData?.first_call_status || 'Pending' as CallStatus,
    first_call_date: editData?.first_call_date || '',
    second_call_status: editData?.second_call_status || 'Pending' as CallStatus,
    second_call_date: editData?.second_call_date || '',
    third_call_status: editData?.third_call_status || 'Pending' as CallStatus,
    third_call_date: editData?.third_call_date || '',
    note: editData?.note || '',
    status: editData?.status || 'Not Sure' as LeadStatus
  });

  // Verification State
  const [verifyQuery, setVerifyQuery] = useState('');
  const [verificationStatus, setVerificationStatus] = useState<{
    exists: boolean;
    student?: any;
    lookupDone: boolean;
  }>({ exists: false, lookupDone: false });

  // Temporary ID generator state & function
  const [isGeneratingTempId, setIsGeneratingTempId] = useState(false);
  const [latestGeneratedTempId, setLatestGeneratedTempId] = useState<string | null>(null);

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
      // Example value: "Temp001" or similar
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
      setFormData(prev => ({ ...prev, pcaid: newTempId }));
      toast.success(`Generated temporary ID: ${newTempId}`);
    } catch (err: any) {
      console.error(err);
      toast.error(`Failed to generate temporary ID: ${err.message || 'Unknown error'}`);
    } finally {
      setIsGeneratingTempId(false);
    }
  };

  useEffect(() => {
    fetchItems();
  }, []);

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

    // Check by PCA ID or Phone in both calltask and student tables
    // Checking student table is more important for "Joined" check
    const { data: studentData } = await supabase
      .from('student')
      .select('*')
      .or(`pcaid.eq.${query.toUpperCase()},phone.eq.${query}`)
      .is('deleted_at', null)
      .maybeSingle();

    if (studentData) {
      setVerificationStatus({ exists: true, student: studentData, lookupDone: true });
      return;
    }

    // Also check calltask for duplicates
    const { data: callData } = await supabase
      .from('calltask')
      .select('*')
      .or(`pcaid.eq.${query.toUpperCase()},phone.eq.${query}`)
      .is('deleted_at', null)
      .maybeSingle();

    if (callData) {
      setVerificationStatus({ exists: true, student: callData, lookupDone: true });
    } else {
      setVerificationStatus({ exists: false, lookupDone: true });
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

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.name || !formData.phone) {
      toast.error('Name and Phone are required');
      return;
    }

    setLoading(true);
    try {
      // Auto-add selected class/package if not yet added to the list
      let finalAskedClassType = formData.asked_class_type;
      if (selectedClass) {
        const current = finalAskedClassType ? finalAskedClassType.split(', ') : [];
        if (!current.includes(selectedClass)) {
          finalAskedClassType = [...current, selectedClass].join(', ');
        }
      }

      let finalAskedPackageType = formData.asked_package_type;
      if (selectedPackage) {
        const current = finalAskedPackageType ? finalAskedPackageType.split(', ') : [];
        if (!current.includes(selectedPackage)) {
          finalAskedPackageType = [...current, selectedPackage].join(', ');
        }
      }

      const dataToSave = {
        ...formData,
        asked_class_type: finalAskedClassType,
        asked_package_type: finalAskedPackageType,
        first_call_date: formData.first_call_date || null,
        second_call_date: formData.second_call_date || null,
        third_call_date: formData.third_call_date || null
      };

      if (editData) {
        const { data, error } = await supabase
          .from('calltask')
          .update(dataToSave)
          .eq('id', editData.id)
          .select()
          .single();
        if (error) throw error;

        // Log call task update transaction
        await logTransaction({
          admin_username: user?.username || 'system',
          action_type: 'UPDATE',
          entity_type: 'calltask',
          entity_id: formData.pcaid || formData.phone || editData.id,
          details: `Updated call task details for ${formData.name} (Phone: ${formData.phone}, Status: ${formData.status})`
        });

        // Sync with Joined Record
        const sharedFields: any = {
          pcaid: formData.pcaid,
          name: formData.name,
          phone: formData.phone,
          proper_batch: formData.proper_batch,
          joined_batch: formData.joined_batch,
          school: formData.school,
          district: formData.district,
          mail: formData.mail,
          address: formData.address,
          asked_class_type: finalAskedClassType,
          stream: formData.stream || null
        };

        // Standard student also has package type
        sharedFields.asked_package_type = finalAskedPackageType;
        await supabase
          .from('student')
          .update(sharedFields)
          .eq('phone', editData.phone);

        // Update last_temporary_id table if the PCAID matches our newly generated temp ID
        if (formData.pcaid && latestGeneratedTempId === formData.pcaid) {
          try {
            let { data: existingRecord } = await supabase
              .from('last_temporary_id')
              .select('id')
              .eq('id', 1)
              .maybeSingle();

            if (existingRecord) {
              await supabase
                .from('last_temporary_id')
                .update({ temp_id: formData.pcaid })
                .eq('id', 1);
            } else {
              await supabase
                .from('last_temporary_id')
                .insert({ id: 1, temp_id: formData.pcaid });
            }
            setLatestGeneratedTempId(null);
          } catch (dbErr) {
            console.error('Error saving last temporary ID:', dbErr);
          }
        }

        toast.success('Call task updated & synced');
        if (onComplete) onComplete(data as CallTask);
      } else {
        const { data, error } = await supabase
          .from('calltask')
          .insert({
            ...dataToSave,
            admin: user?.username,
            created_at: new Date().toISOString()
          })
          .select()
          .single();
        if (error) throw error;

        // Log call task creation transaction
        await logTransaction({
          admin_username: user?.username || 'system',
          action_type: 'CREATE',
          entity_type: 'calltask',
          entity_id: data.pcaid || data.phone || data.id,
          details: `Created new call task for ${data.name} (Phone: ${data.phone}, Proper Batch: ${data.proper_batch})`
        });

        // Update last_temporary_id table if the PCAID matches our newly generated temp ID
        if (formData.pcaid && latestGeneratedTempId === formData.pcaid) {
          try {
            let { data: existingRecord } = await supabase
              .from('last_temporary_id')
              .select('id')
              .eq('id', 1)
              .maybeSingle();

            if (existingRecord) {
              await supabase
                .from('last_temporary_id')
                .update({ temp_id: formData.pcaid })
                .eq('id', 1);
            } else {
              await supabase
                .from('last_temporary_id')
                .insert({ id: 1, temp_id: formData.pcaid });
            }
            setLatestGeneratedTempId(null);
          } catch (dbErr) {
            console.error('Error saving last temporary ID:', dbErr);
          }
        }

        toast.success('Call task saved');
        handleClear();
        if (onComplete) onComplete(data as CallTask);
      }
    } catch (err) {
      toast.error('Failed to save call task');
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const handleClear = () => {
    setFormData({
      pcaid: '',
      name: '', phone: '', stream: '', proper_batch: '', joined_batch: '', school: '',
      district: '', mail: '', address: '', asked_class_type: '', asked_package_type: '',
      first_call_status: 'Pending', first_call_date: '',
      second_call_status: 'Pending', second_call_date: '',
      third_call_status: 'Pending', third_call_date: '',
      note: '', status: 'Not Sure'
    });
    setSelectedClass('');
    setSelectedPackage('');
  };

  const handleAddClass = () => {
    if (!selectedClass) return;
    const current = formData.asked_class_type ? formData.asked_class_type.split(', ') : [];
    if (current.includes(selectedClass)) {
      toast.error('Class already added');
      return;
    }
    const updated = [...current, selectedClass].join(', ');
    setFormData({ ...formData, asked_class_type: updated });
    setSelectedClass('');
  };

  const handleRemoveClass = (val: string) => {
    const updated = formData.asked_class_type
      .split(', ')
      .filter(c => c !== val)
      .join(', ');
    setFormData({ ...formData, asked_class_type: updated });
  };

  const handleAddPackage = () => {
    if (!selectedPackage) return;
    const current = formData.asked_package_type ? formData.asked_package_type.split(', ') : [];
    if (current.includes(selectedPackage)) {
      toast.error('Package already added');
      return;
    }
    const updated = [...current, selectedPackage].join(', ');
    setFormData({ ...formData, asked_package_type: updated });
    setSelectedPackage('');
  };

  const handleRemovePackage = (val: string) => {
    const updated = formData.asked_package_type
      .split(', ')
      .filter(p => p !== val)
      .join(', ');
    setFormData({ ...formData, asked_package_type: updated });
  };

  return (
    <div className="max-w-4xl mx-auto">
      <form onSubmit={handleSubmit} className="bg-white p-8 rounded-2xl shadow-sm border border-gray-100 flex flex-col gap-8">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-gray-100 pb-6">
          <h3 className="text-lg font-bold text-gray-800 flex items-center gap-2">
            <Plus size={20} className="text-teal-600" />
            {editData ? 'Edit Call Task' : 'New Call Task'}
          </h3>

          {/* Verification Bar */}
          <div className="flex-1 max-w-md w-full relative">
            <div className="relative group">
              <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                <Search size={18} className="text-gray-400 group-focus-within:text-teal-600 transition-colors" />
              </div>
              <input 
                type="text"
                value={verifyQuery}
                onChange={(e) => setVerifyQuery(e.target.value)}
                placeholder="Verify PCA ID or Phone Availability..."
                className="block w-full pl-10 pr-10 py-2.5 bg-white border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-teal-500/20 focus:border-teal-500 text-sm transition-all shadow-sm"
              />
              <div className="absolute inset-y-0 right-0 pr-3 flex items-center">
                {verificationStatus.lookupDone && (
                  verificationStatus.exists ? (
                    <div className="flex items-center gap-1.5 text-red-500 bg-red-50 px-2.5 py-1 rounded-full border border-red-100 shadow-sm animate-in fade-in slide-in-from-right-2">
                      <Trash2 size={14} className="animate-pulse" />
                      <span className="text-[10px] font-bold uppercase tracking-wider">Already Exists</span>
                    </div>
                  ) : (
                    <div className="flex items-center gap-1.5 text-teal-600 bg-teal-50 px-2.5 py-1 rounded-full border border-teal-100 shadow-sm animate-in fade-in slide-in-from-right-2">
                      <CheckCircle2 size={14} />
                      <span className="text-[10px] font-bold uppercase tracking-wider">Available</span>
                    </div>
                  )
                )}
              </div>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-x-12 gap-y-6">
          {/* Left Column */}
          <div className="space-y-4">
            <div className="flex flex-col gap-1.5">
              <label className="text-sm font-semibold text-gray-700">PCA ID</label>
              <div className="flex gap-2 items-center">
                <input
                  type="text"
                  value={formData.pcaid}
                  onChange={(e) => setFormData({ ...formData, pcaid: e.target.value.toUpperCase() })}
                  className="flex-1 px-4 py-2 bg-gray-50 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-teal-500/20 font-mono text-sm min-w-0"
                  placeholder="PCA-XXXX"
                />
                <button
                  type="button"
                  onClick={handleGenerateTempId}
                  disabled={isGeneratingTempId}
                  className="px-4 py-2 bg-teal-600 hover:bg-teal-700 text-white font-semibold rounded-lg text-xs transition-colors whitespace-nowrap disabled:opacity-50 h-[40px] flex items-center justify-center leading-none"
                >
                  {isGeneratingTempId ? 'Generating...' : 'Generate Temp ID'}
                </button>
              </div>
            </div>
            <div className="flex flex-col gap-1.5">
              <label className="text-sm font-semibold text-gray-700">Name</label>
              <input
                type="text"
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                className="w-full px-4 py-2 bg-gray-50 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-teal-500/20"
                placeholder="Full Name"
              />
            </div>
            <div className="flex flex-col gap-1.5">
              <label className="text-sm font-semibold text-gray-700">Stream</label>
              <select
                value={formData.stream || ''}
                onChange={(e) => setFormData({ ...formData, stream: e.target.value })}
                className="w-full px-4 py-2 bg-gray-50 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-teal-500/20"
              >
                <option value="">Select Stream</option>
                <option value="Biological Science">Biological Science</option>
                <option value="Physical Science">Physical Science</option>
                <option value="Non Stream">Non Stream</option>
              </select>
            </div>
            <div className="flex flex-col gap-1.5">
              <label className="text-sm font-semibold text-gray-700">Proper Batch</label>
              <input
                type="text"
                value={formData.proper_batch}
                onChange={(e) => setFormData({ ...formData, proper_batch: e.target.value })}
                className="w-full px-4 py-2 bg-gray-50 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-teal-500/20"
                placeholder="e.g. 2024"
              />
            </div>
            <div className="flex flex-col gap-1.5">
              <label className="text-sm font-semibold text-gray-700">Joined Batch</label>
              <select
                value={formData.joined_batch || ''}
                onChange={(e) => setFormData({ ...formData, joined_batch: e.target.value })}
                className="w-full px-4 py-2 bg-gray-50 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-teal-500/20 text-gray-800 font-medium"
              >
                <option value="">Select Joined Batch</option>
                {formData.joined_batch && !joinedBatches.some(jb => jb.joined_batch === formData.joined_batch) && (
                  <option value={formData.joined_batch}>
                    {formData.joined_batch} (Legacy Value)
                  </option>
                )}
                {joinedBatches.map((jb) => (
                  <option key={jb.id} value={jb.joined_batch}>
                    {jb.joined_batch}
                  </option>
                ))}
              </select>
            </div>
            <div className="flex flex-col gap-1.5">
              <label className="text-sm font-semibold text-gray-700">School</label>
              <input
                type="text"
                value={formData.school}
                onChange={(e) => setFormData({ ...formData, school: e.target.value })}
                className="w-full px-4 py-2 bg-gray-50 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-teal-500/20"
                placeholder="School Name"
              />
            </div>
            <div className="flex flex-col gap-1.5">
              <label className="text-sm font-semibold text-gray-700">District</label>
              <select
                value={formData.district}
                onChange={(e) => setFormData({ ...formData, district: e.target.value })}
                className="w-full px-4 py-2 bg-gray-50 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-teal-500/20"
              >
                <option value="">Select District</option>
                {SRI_LANKAN_DISTRICTS.map(d => <option key={d} value={d}>{d}</option>)}
              </select>
            </div>
            <div className="flex flex-col gap-1.5">
              <label className="text-sm font-semibold text-gray-700">Mail</label>
              <input
                type="email"
                value={formData.mail}
                onChange={(e) => setFormData({ ...formData, mail: e.target.value })}
                className="w-full px-4 py-2 bg-gray-50 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-teal-500/20"
                placeholder="Email Address"
              />
            </div>
            <div className="flex flex-col gap-1.5">
              <label className="text-sm font-semibold text-gray-700">Phone</label>
              <input
                type="text"
                value={formData.phone}
                onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                className="w-full px-4 py-2 bg-gray-50 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-teal-500/20"
                placeholder="Phone Number"
              />
            </div>
            <div className="flex flex-col gap-1.5">
              <label className="text-sm font-semibold text-gray-700">Address</label>
              <textarea
                value={formData.address}
                onChange={(e) => setFormData({ ...formData, address: e.target.value })}
                className="w-full px-4 py-2 bg-gray-50 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-teal-500/20 h-24"
                placeholder="Home Address"
              />
            </div>
          </div>

          {/* Right Column */}
          <div className="space-y-4">
            <div className="flex flex-col gap-4">
              <div className="flex flex-col gap-2 p-4 bg-gray-50 rounded-xl border border-gray-100">
                <div className="flex items-center justify-between">
                  <label className="text-sm font-semibold text-gray-700">Asked Class Type</label>
                </div>
                <div className="flex gap-2 text-white">
                  <select
                    value={selectedClass}
                    onChange={(e) => setSelectedClass(e.target.value)}
                    className="flex-1 px-4 py-2 bg-white border border-gray-200 rounded-lg focus:outline-none text-gray-700 font-medium"
                  >
                    <option value="">Select Class</option>
                    {classTypes.map(ct => <option key={ct.id} value={ct.class_type}>{ct.class_type}</option>)}
                  </select>
                  <button
                    type="button"
                    onClick={handleAddClass}
                    className="p-2 bg-teal-600 rounded-lg hover:bg-teal-700 transition-colors"
                  >
                    <Plus size={20} />
                  </button>
                </div>
                <div className="flex flex-wrap gap-2 mt-2">
                  {formData.asked_class_type.split(', ').filter(Boolean).map(c => (
                    <div key={c} className="flex items-center gap-2 px-3 py-1 bg-white border border-teal-100 rounded-full text-xs font-bold text-teal-700">
                      <span>{c}</span>
                      <button type="button" onClick={() => handleRemoveClass(c)} className="text-red-400 hover:text-red-600 transition-colors">
                        <Trash2 size={14} />
                      </button>
                    </div>
                  ))}
                </div>
              </div>

              <div className="flex flex-col gap-2 p-4 bg-gray-50 rounded-xl border border-gray-100">
                <label className="text-sm font-semibold text-gray-700">Asked Package Type</label>
                <div className="flex gap-2 text-white">
                  <select
                    value={selectedPackage}
                    onChange={(e) => setSelectedPackage(e.target.value)}
                    className="flex-1 px-4 py-2 bg-white border border-gray-200 rounded-lg focus:outline-none text-gray-700 font-medium"
                  >
                    <option value="">Select Package</option>
                    {packageTypes.map(pt => <option key={pt.id} value={pt.package_type}>{pt.package_type}</option>)}
                  </select>
                  <button
                    type="button"
                    onClick={handleAddPackage}
                    className="p-2 bg-teal-600 rounded-lg hover:bg-teal-700 transition-colors"
                  >
                    <Plus size={20} />
                  </button>
                </div>
                <div className="flex flex-wrap gap-2 mt-2">
                  {formData.asked_package_type.split(', ').filter(Boolean).map(p => (
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

            <div className="p-4 bg-teal-50/50 rounded-xl space-y-4 border border-teal-100">
              <h3 className="text-sm font-bold text-teal-800 uppercase tracking-wider">Call Summary</h3>
              
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <label className="text-xs font-bold text-gray-500">1st Call Status</label>
                  <select
                    value={formData.first_call_status}
                    onChange={(e) => setFormData({ ...formData, first_call_status: e.target.value as CallStatus })}
                    className="w-full px-3 py-1.5 bg-white border border-teal-200 rounded-lg text-sm"
                  >
                    <option value="Pending">Pending</option>
                    <option value="No Answer">No Answer</option>
                    <option value="Completed">Completed</option>
                  </select>
                </div>
                <div className="space-y-1.5">
                  <label className="text-xs font-bold text-gray-500">1st Call Date</label>
                  <input
                    type="date"
                    value={formData.first_call_date}
                    onChange={(e) => setFormData({ ...formData, first_call_date: e.target.value })}
                    className="w-full px-3 py-1.5 bg-white border border-teal-200 rounded-lg text-sm"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <label className="text-xs font-bold text-gray-500">2nd Call Status</label>
                  <select
                    value={formData.second_call_status}
                    onChange={(e) => setFormData({ ...formData, second_call_status: e.target.value as CallStatus })}
                    className="w-full px-3 py-1.5 bg-white border border-teal-200 rounded-lg text-sm"
                  >
                    <option value="Pending">Pending</option>
                    <option value="No Answer">No Answer</option>
                    <option value="Completed">Completed</option>
                  </select>
                </div>
                <div className="space-y-1.5">
                  <label className="text-xs font-bold text-gray-500">2nd Call Date</label>
                  <input
                    type="date"
                    value={formData.second_call_date}
                    onChange={(e) => setFormData({ ...formData, second_call_date: e.target.value })}
                    className="w-full px-3 py-1.5 bg-white border border-teal-200 rounded-lg text-sm"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <label className="text-xs font-bold text-gray-500">3rd Call Status</label>
                  <select
                    value={formData.third_call_status}
                    onChange={(e) => setFormData({ ...formData, third_call_status: e.target.value as CallStatus })}
                    className="w-full px-3 py-1.5 bg-white border border-teal-200 rounded-lg text-sm"
                  >
                    <option value="Pending">Pending</option>
                    <option value="No Answer">No Answer</option>
                    <option value="Completed">Completed</option>
                  </select>
                </div>
                <div className="space-y-1.5">
                  <label className="text-xs font-bold text-gray-500">3rd Call Date</label>
                  <input
                    type="date"
                    value={formData.third_call_date}
                    onChange={(e) => setFormData({ ...formData, third_call_date: e.target.value })}
                    className="w-full px-3 py-1.5 bg-white border border-teal-200 rounded-lg text-sm"
                  />
                </div>
              </div>
            </div>

            <div className="flex flex-col gap-1.5">
              <label className="text-sm font-semibold text-gray-700">Note</label>
              <input
                type="text"
                value={formData.note}
                onChange={(e) => setFormData({ ...formData, note: e.target.value })}
                className="w-full px-4 py-2 bg-gray-50 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-teal-500/20"
                placeholder="Any special remarks"
              />
            </div>
          </div>
        </div>

        <div className="flex gap-4 pt-4 border-t border-gray-100">
          <button
            type="submit"
            disabled={loading}
            className="flex-1 bg-teal-600 hover:bg-teal-700 text-white font-bold py-3 rounded-xl shadow-lg shadow-teal-600/20 transition-all active:scale-95 disabled:opacity-50"
          >
            {loading ? 'Saving...' : editData ? 'Update' : 'Save'}
          </button>
          {!editData && (
            <button
              type="button"
              onClick={handleClear}
              className="px-6 py-3 bg-gray-100 hover:bg-gray-200 text-gray-700 font-bold rounded-xl transition-all"
            >
              Clear
            </button>
          )}
          {editData && (
            <button
              type="button"
              onClick={onComplete}
              className="px-6 py-3 bg-red-50 text-red-600 hover:bg-red-100 font-bold rounded-xl transition-all"
            >
              Cancel
            </button>
          )}
        </div>
      </form>
    </div>
  );
}

// CSV & Excel Normalization and Automapping Helpers
function autoMapHeaders(headers: string[]) {
  const mapping: { [key: string]: string } = {};
  
  const rules: { [targetField: string]: string[] } = {
    phone: ['phone', 'mobile', 'contact', 'phone_number', 'phone number', 'tele', 'telephone', 'phn'],
    name: ['name', 'full name', 'fullname', 'student name', 'std_name', 'student_name'],
    pcaid: ['pcaid', 'pca id', 'id', 'student id', 'student_id', 'pca_id'],
    stream: ['stream', 'subject stream', 'field', 'stream_type'],
    proper_batch: ['proper batch', 'proper_batch', 'batch', 'proper'],
    joined_batch: ['joined batch', 'joined_batch', 'joined'],
    school: ['school', 'college', 'school_name'],
    district: ['district', 'city', 'town'],
    mail: ['mail', 'email', 'email_address', 'gmail', 'emailaddress'],
    address: ['address', 'home_address', 'location', 'addr'],
    asked_class_type: ['class', 'class_type', 'asked_class_type', 'classes', 'subject', 'class types'],
    asked_package_type: ['package', 'package_type', 'asked_package_type', 'packages', 'package types'],
    status: ['status', 'lead_status', 'lead status', 'leadstage'],
    note: ['note', 'notes', 'remark', 'remarks', 'description'],
    first_call_status: ['1st call status', 'first call status', 'first_call_status', 'first_call'],
    first_call_date: ['1st call date', 'first call date', 'first_call_date'],
    second_call_status: ['2nd call status', 'second call status', 'second_call_status', 'second_call'],
    second_call_date: ['2nd call date', 'second call date', 'second_call_date'],
    third_call_status: ['3rd call status', 'third call status', 'third_call_status', 'third_call'],
    third_call_date: ['3rd call date', 'third call date', 'third_call_date']
  };

  headers.forEach(header => {
    const cleanHeader = header.toLowerCase().replace(/[\s\-_]/g, '');
    for (const [targetField, aliases] of Object.entries(rules)) {
      const match = aliases.some(alias => {
        const cleanAlias = alias.toLowerCase().replace(/[\s\-_]/g, '');
        return cleanHeader === cleanAlias || cleanHeader.includes(cleanAlias);
      });
      if (match && !mapping[targetField]) {
        mapping[targetField] = header;
        break;
      }
    }
  });

  return mapping;
}

function normalizeStream(val: string): string {
  if (!val) return 'Non Stream';
  const text = val.trim().toLowerCase();
  if (text.includes('bio') || text.includes('biology')) return 'Biological Science';
  if (text.includes('math') || text.includes('physical') || text.includes('physics')) return 'Physical Science';
  return 'Non Stream';
}

function normalizeDistrict(val: string): string {
  if (!val) return '';
  const cleaned = val.trim();
  const found = SRI_LANKAN_DISTRICTS.find(d => d.toLowerCase() === cleaned.toLowerCase());
  if (found) return found;
  return cleaned.charAt(0).toUpperCase() + cleaned.slice(1).toLowerCase();
}

function normalizeClassTypes(val: string, availableClasses: string[]): string {
  if (!val) return '';
  const parts = val.split(/[;,/+]/).map(p => p.trim()).filter(Boolean);
  const matched = parts.map(part => {
    const found = availableClasses.find(c => c.toLowerCase() === part.toLowerCase());
    return found || part;
  });
  return matched.join(', ');
}

function normalizePackageTypes(val: string, availablePackages: string[]): string {
  if (!val) return '';
  const parts = val.split(/[;,/+]/).map(p => p.trim()).filter(Boolean);
  const matched = parts.map(part => {
    const found = availablePackages.find(p => p.toLowerCase() === part.toLowerCase());
    return found || part;
  });
  return matched.join(', ');
}

function normalizeCallStatus(val: string): CallStatus {
  if (!val) return 'Pending';
  const clean = val.trim().toLowerCase();
  if (clean === 'pending') return 'Pending';
  if (clean === 'no answer' || clean === 'noanswer' || clean === 'no_answer') return 'No Answer';
  if (clean === 'completed' || clean === 'complete' || clean === 'done') return 'Completed';
  
  const capitalized = val.trim().split(/\s+/).map(w => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase()).join(' ');
  if (capitalized === 'Pending' || capitalized === 'No Answer' || capitalized === 'Completed') {
    return capitalized as CallStatus;
  }
  return 'Pending';
}

function normalizeLeadStatus(val: string): LeadStatus {
  if (!val) return 'Not Sure';
  const clean = val.trim().toLowerCase();
  if (clean === 'not sure' || clean === 'notsure' || clean === 'not_sure') return 'Not Sure';
  if (clean === 'joined' || clean === 'join') return 'Joined';
  if (clean === 'not join' || clean === 'notjoin' || clean === 'not_join' || clean === 'not joined' || clean === 'notjoined') return 'Not Join';
  if (clean === 'free') return 'Free';
  
  const capitalized = val.trim().split(/\s+/).map(w => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase()).join(' ');
  if (capitalized === 'Not Sure' || capitalized === 'Joined' || capitalized === 'Not Join' || capitalized === 'Free') {
    return capitalized as LeadStatus;
  }
  return 'Not Sure';
}

function normalizeDate(val: any): string | null {
  if (!val) return null;
  const str = String(val).trim();
  if (!str) return null;

  // 1. Check if it is a pure Excel serial date number
  if (/^\d{5}$/.test(str)) {
    const serial = Number(str);
    const date = new Date((serial - 25569) * 86400 * 1000);
    const yyyy = date.getFullYear();
    const mm = String(date.getMonth() + 1).padStart(2, '0');
    const dd = String(date.getDate()).padStart(2, '0');
    return `${yyyy}-${mm}-${dd}`;
  }

  // 2. Try parsing DD/MM/YYYY or DD-MM-YYYY or MM/DD/YYYY
  const sepMatch = str.match(/^(\d{1,2})[/\-.](\d{1,2})[/\-.](\d{4})$/);
  if (sepMatch) {
    const p1 = parseInt(sepMatch[1], 10);
    const p2 = parseInt(sepMatch[2], 10);
    const year = parseInt(sepMatch[3], 10);
    
    let day = p1;
    let month = p2;
    if (p1 > 12) {
      day = p1;
      month = p2;
    } else if (p2 > 12) {
      day = p2;
      month = p1;
    } else {
      // Default to DD/MM/YYYY
      day = p1;
      month = p2;
    }
    const yyyy = String(year);
    const mm = String(month).padStart(2, '0');
    const dd = String(day).padStart(2, '0');
    return `${yyyy}-${mm}-${dd}`;
  }

  // 3. Try fallback native parser
  const parsed = new Date(str);
  if (!isNaN(parsed.getTime())) {
    const yyyy = parsed.getFullYear();
    const mm = String(parsed.getMonth() + 1).padStart(2, '0');
    const dd = String(parsed.getDate()).padStart(2, '0');
    return `${yyyy}-${mm}-${dd}`;
  }

  return null;
}

export function CallTaskDisplay() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [tasks, setTasks] = useState<CallTask[]>([]);
  const [loading, setLoading] = useState(true);
  const [editingTask, setEditingTask] = useState<CallTask | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [undoingId, setUndoingId] = useState<string | null>(null);
  const [showClassDropdown, setShowClassDropdown] = useState(false);
  const [showPackageDropdown, setShowPackageDropdown] = useState(false);
  const [classTypes, setClassTypes] = useState<ClassItem[]>([]);
  const [packageTypes, setPackageTypes] = useState<PackageItem[]>([]);
  
  // Verification States & Duplicate Check
  const [verifyQuery, setVerifyQuery] = useState('');
  const [verificationStatus, setVerificationStatus] = useState<{
    exists: boolean;
    student?: any;
    lookupDone: boolean;
  }>({ exists: false, lookupDone: false });
  const [showNewModal, setShowNewModal] = useState(false);

  // CSV / Excel Import States
  const [importingData, setImportingData] = useState<any[] | null>(null);
  const [showImportModal, setShowImportModal] = useState(false);
  const [importLoading, setImportLoading] = useState(false);
  const [skipDuplicates, setSkipDuplicates] = useState(true);

  const [filters, setFilters] = useState({
    status: '',
    district: '',
    classes: [] as string[],
    packages: [] as string[],
    properBatch: '',
    joinedBatch: '',
    startDate: '',
    endDate: '',
    search: '',
    pcaid: ''
  });

  useEffect(() => {
    fetchTasks();
    fetchItems();
    const sub = supabase.channel('calltask_updates').on('postgres_changes', { event: '*', schema: 'public', table: 'calltask' }, () => fetchTasks()).subscribe();
    return () => { supabase.removeChannel(sub); };
  }, [user]);

  // Real-time lookup for CallTaskDisplay
  useEffect(() => {
    const timer = setTimeout(() => {
      if (verifyQuery.trim().length > 3) {
        verifyDisplayStudent();
      } else {
        setVerificationStatus({ exists: false, lookupDone: false });
      }
    }, 500);

    return () => clearTimeout(timer);
  }, [verifyQuery]);

  const verifyDisplayStudent = async () => {
    const query = verifyQuery.trim();
    if (!query) {
      setVerificationStatus({ exists: false, lookupDone: false });
      return;
    }

    // Checking student table is more important for "Joined" check
    const { data: studentData } = await supabase
      .from('student')
      .select('*')
      .or(`pcaid.eq.${query.toUpperCase()},phone.eq.${query}`)
      .is('deleted_at', null)
      .maybeSingle();

    if (studentData) {
      setVerificationStatus({ exists: true, student: studentData, lookupDone: true });
      return;
    }

    // Also check calltask for duplicates
    const { data: callData } = await supabase
      .from('calltask')
      .select('*')
      .or(`pcaid.eq.${query.toUpperCase()},phone.eq.${query}`)
      .is('deleted_at', null)
      .maybeSingle();

    if (callData) {
      setVerificationStatus({ exists: true, student: callData, lookupDone: true });
    } else {
      setVerificationStatus({ exists: false, lookupDone: true });
    }
  };

  const fetchItems = async () => {
    const { data: classes } = await supabase.from('class_item').select('*').order('class_type');
    const { data: packages } = await supabase.from('package_item').select('*').order('package_type');
    if (classes) setClassTypes(classes);
    if (packages) setPackageTypes(packages);
  };

  const fetchTasks = async () => {
    if (!user) return;
    
    let query = supabase.from('calltask').select('*').is('deleted_at', null);
    
    // Only filter by admin if the user is NOT a super_admin
    if (user.admin_type !== 'super_admin') {
      query = query.eq('admin', user.username);
    }
    
    const { data } = await query.order('created_at', { ascending: false });
    
    if (data) setTasks(data as CallTask[]);
    setLoading(false);
  };

  const filteredTasks = tasks.filter(t => {
    const searchLower = filters.search.toLowerCase();
    const matchesSearch = !filters.search || 
      (t.name?.toLowerCase().includes(searchLower)) || 
      (t.phone?.includes(filters.search)) ||
      (t.pcaid?.toLowerCase().includes(searchLower));

    const matchesPcaidSearch = !filters.pcaid || (t.pcaid && t.pcaid.toLowerCase().includes(filters.pcaid.toLowerCase()));
    
    const matchesStatus = !filters.status || t.status === filters.status;
    const matchesDistrict = !filters.district || t.district === filters.district;
    const matchesClasses = filters.classes.length === 0 || 
      (t.asked_class_type && filters.classes.some(c => t.asked_class_type?.toLowerCase().includes(c.toLowerCase())));
    const matchesPackages = filters.packages.length === 0 || 
      (t.asked_package_type && filters.packages.some(p => t.asked_package_type?.toLowerCase().includes(p.toLowerCase())));
    const matchesProperBatch = !filters.properBatch || 
      (t.proper_batch && t.proper_batch.toLowerCase().includes(filters.properBatch.toLowerCase()));
    const matchesJoinedBatch = !filters.joinedBatch || 
      (t.joined_batch && t.joined_batch.toLowerCase().includes(filters.joinedBatch.toLowerCase()));
    
    // Date Range Logic
    const taskDate = t.created_at ? new Date(t.created_at).setHours(0,0,0,0) : null;
    const start = filters.startDate ? new Date(filters.startDate).setHours(0,0,0,0) : null;
    const end = filters.endDate ? new Date(filters.endDate).setHours(0,0,0,0) : null;
    
    let matchesDateRange = true;
    if (taskDate) {
      if (start && taskDate < start) matchesDateRange = false;
      if (end && taskDate > end) matchesDateRange = false;
    } else if (start || end) {
      matchesDateRange = false;
    }

    return matchesSearch && matchesPcaidSearch && matchesStatus && matchesDistrict && matchesClasses && matchesPackages && matchesProperBatch && matchesJoinedBatch && matchesDateRange;
  });

  const handleDelete = async (task: CallTask) => {
    try {
      setDeletingId(task.id);
      
      const deletedAt = new Date().toISOString();

      // 1. Soft-delete associated registered records conditionally
      if (task.phone) {
        // Find active student records
        const { data: studentRecords } = await supabase
          .from('student')
          .select('pcaid')
          .eq('phone', task.phone)
          .is('deleted_at', null);

        if (studentRecords && studentRecords.length > 0) {
          for (const record of studentRecords) {
            // Soft-deleting the student cascades to payments & installments via DB triggers
            await supabase
              .from('student')
              .update({ deleted_at: deletedAt })
              .eq('pcaid', record.pcaid);
          }
        }
      }

      // 2. Soft-delete the call task itself
      const { error: taskError } = await supabase
        .from('calltask')
        .update({ deleted_at: deletedAt })
        .eq('id', task.id);
      
      if (taskError) throw taskError;

      // Log task and record deletion transaction
      await logTransaction({
        admin_username: user?.username || 'system',
        action_type: 'DELETE',
        entity_type: 'calltask',
        entity_id: task.pcaid || task.phone || task.id,
        details: `Soft-deleted call task for ${task.name} and synced student/payment table structures`
      });

      toast.success('Task and associated student records soft-deleted');
      setTasks(prev => prev.filter(t => t.id !== task.id));
    } catch (error) {
      toast.error('Failed to delete task or related records');
      console.error(error);
    } finally {
      setDeletingId(null);
    }
  };

  const handleUndoJoin = async (task: CallTask) => {
    try {
      setLoading(true);
      
      const deletedAt = new Date().toISOString();

      // 1. Find active student by phone
      const { data: studentRecords, error: studentError } = await supabase
        .from('student')
        .select('pcaid')
        .eq('phone', task.phone)
        .is('deleted_at', null);
      
      if (studentError) throw studentError;

      if (studentRecords && studentRecords.length > 0) {
        for (const record of studentRecords) {
          const pcaid = record.pcaid;
          // Soft-deleting student automatically soft-deletes payments/installments via DB triggers
          await supabase
            .from('student')
            .update({ deleted_at: deletedAt })
            .eq('pcaid', pcaid);
        }
      }

      // 2. Update call task status
      const { error: updateTaskError } = await supabase
        .from('calltask')
        .update({ status: 'Not Sure' })
        .eq('id', task.id);
      
      if (updateTaskError) throw updateTaskError;

      toast.success('Successfully undone join status (records soft-deleted)');
      
      // Fast sync: update local state
      setTasks(prev => prev.map(t => 
        t.id === task.id ? { ...t, status: 'Not Sure' as LeadStatus } : t
      ));

    } catch (err) {
      toast.error('Failed to undo join');
      console.error(err);
    } finally {
      setLoading(false);
      setUndoingId(null);
    }
  };

  const handleExport = () => {
    const data = filteredTasks.map((t, idx) => ({
      'No': idx + 1,
      'Name': t.name,
      'Phone': t.phone,
      'PCA ID': t.pcaid || '',
      'Stream': t.stream || '',
      'District': t.district || '',
      'Proper Batch': t.proper_batch || '',
      'Joined Batch': t.joined_batch || '',
      'School': t.school || '',
      'Mail': t.mail || '',
      'Address': t.address || '',
      'Class': t.asked_class_type || '',
      'Package': t.asked_package_type || '',
      '1st Call Status': t.first_call_status || '',
      '1st Call Date': t.first_call_date ? formatDate(t.first_call_date) : '',
      '2nd Call Status': t.second_call_status || '',
      '2nd Call Date': t.second_call_date ? formatDate(t.second_call_date) : '',
      '3rd Call Status': t.third_call_status || '',
      '3rd Call Date': t.third_call_date ? formatDate(t.third_call_date) : '',
      'Status': t.status || '',
      'Note': t.note || '',
      'Assigned Admin': t.admin || '',
      'Created Date': formatDate(t.created_at)
    }));
    exportToExcel(data, `Call_Tasks_Complete_${user?.username}`);
  };

  const handleImportFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = async (evt) => {
      try {
        const bstr = evt.target?.result;
        const workbook = XLSX.read(bstr, { type: 'binary' });
        const sheetName = workbook.SheetNames[0];
        const worksheet = workbook.Sheets[sheetName];
        const rawJson: any[] = XLSX.utils.sheet_to_json(worksheet, { header: 1 });

        if (rawJson.length < 2) {
          toast.error('The selected file does not contain sufficient data rows.');
          return;
        }

        const headers = rawJson[0].map((h: any) => String(h || '').trim());
        const rows = rawJson.slice(1);

        // Auto map columns
        const mapping = autoMapHeaders(headers);

        // Verify we found at least name and phone
        if (!mapping.phone || !mapping.name) {
          toast.error('Could not map "Name" and "Phone" columns automatically. Please make sure headers like "Name" and "Phone" exist in your CSV.');
          return;
        }

        const normalizedTasks = rows.map((row: any[], index: number) => {
          const getVal = (targetField: string) => {
            const originalHeader = mapping[targetField];
            if (!originalHeader) return '';
            const colIndex = headers.indexOf(originalHeader);
            if (colIndex === -1) return '';
            const rawVal = row[colIndex];
            return rawVal !== undefined && rawVal !== null ? String(rawVal).trim() : '';
          };

          const rawPhone = getVal('phone').replace(/[\s\-()]/g, '');
          const rawPcaid = getVal('pcaid');
          const rawName = getVal('name');

          // Date normalized
          const fDate = normalizeDate(getVal('first_call_date')) || null;
          const sDate = normalizeDate(getVal('second_call_date')) || null;
          const tDate = normalizeDate(getVal('third_call_date')) || null;

          return {
            rowNum: index + 2,
            pcaid: rawPcaid.toUpperCase() || '',
            name: rawName,
            phone: rawPhone,
            stream: normalizeStream(getVal('stream')),
            proper_batch: getVal('proper_batch'),
            joined_batch: getVal('joined_batch'),
            school: getVal('school'),
            district: normalizeDistrict(getVal('district')),
            mail: getVal('mail'),
            address: getVal('address'),
            asked_class_type: normalizeClassTypes(getVal('asked_class_type'), classTypes.map(c => c.class_type)),
            asked_package_type: normalizePackageTypes(getVal('asked_package_type'), packageTypes.map(p => p.package_type)),
            first_call_status: normalizeCallStatus(getVal('first_call_status')),
            first_call_date: fDate,
            second_call_status: normalizeCallStatus(getVal('second_call_status')),
            second_call_date: sDate,
            third_call_status: normalizeCallStatus(getVal('third_call_status')),
            third_call_date: tDate,
            status: normalizeLeadStatus(getVal('status')),
            note: getVal('note') || '',
            admin: user?.username || 'system'
          };
        }).filter(t => t.name && t.phone); // Require name and phone

        if (normalizedTasks.length === 0) {
          toast.error('No valid rows with Name and Phone were found in the file.');
          return;
        }

        setImportingData(normalizedTasks);
        setShowImportModal(true);
      } catch (err) {
        console.error('Failed to parse file:', err);
        toast.error('Failed to read and parse the file. Please ensure it is a valid CSV or Excel file.');
      } finally {
        e.target.value = ''; // Reset file input
      }
    };

    reader.readAsBinaryString(file);
  };

  const handleConfirmImport = async () => {
    if (!importingData || importingData.length === 0) return;
    setImportLoading(true);

    try {
      // 1. Fetch existing PCA IDs in calltask
      const { data: existingTasks, error: fetchErr } = await supabase
        .from('calltask')
        .select('pcaid')
        .is('deleted_at', null);

      if (fetchErr) throw fetchErr;

      // Helper to clean/normalize PCA ID for consistent comparison
      const normalizeCleanPCAID = (id: any) => id ? String(id).trim().toUpperCase() : '';

      const existingPCAIDs = new Set(
        (existingTasks || [])
          .map((t: any) => normalizeCleanPCAID(t.pcaid))
          .filter(id => id !== '')
      );
      
      // 2. Filter data if skipDuplicates is checked
      const filteredToInsert = skipDuplicates 
        ? importingData.filter(item => {
            const cleanId = normalizeCleanPCAID(item.pcaid);
            return cleanId === '' || !existingPCAIDs.has(cleanId);
          })
        : importingData;

      // 3. Deduplicate elements inside the batch itself to prevent inserting the same PCA ID twice in one import session
      const finalUniqueInsert: typeof filteredToInsert = [];
      const seenInBatch = new Set<string>();
      
      for (const item of filteredToInsert) {
        const cleanId = normalizeCleanPCAID(item.pcaid);
        if (cleanId === '' || !seenInBatch.has(cleanId)) {
          if (cleanId !== '') {
            seenInBatch.add(cleanId);
          }
          finalUniqueInsert.push(item);
        }
      }

      if (finalUniqueInsert.length === 0) {
        toast.warning('No new unique records to import after checking duplicate PCA IDs!');
        setShowImportModal(false);
        setImportingData(null);
        return;
      }

      // Payload for DB: map falsy PCA IDs to null instead of empty strings to avoid unique empty-string key violations in Postgres
      const insertPayload = finalUniqueInsert.map(({ rowNum, ...rest }) => {
        const payload: any = {
          ...rest,
          created_at: new Date().toISOString()
        };
        if (!payload.pcaid || String(payload.pcaid).trim() === '') {
          payload.pcaid = null;
        }
        return payload;
      });

      // Supabase bulk insert
      const { data: insertedRows, error: insertErr } = await supabase
        .from('calltask')
        .insert(insertPayload)
        .select();

      if (insertErr) throw insertErr;

      // Update local state
      if (insertedRows) {
        setTasks(prev => [...(insertedRows as CallTask[]), ...prev]);
      } else {
        fetchTasks();
      }

      // Log transaction
      await logTransaction({
        admin_username: user?.username || 'system',
        action_type: 'PAYMENT_ADD',
        entity_type: 'calltask',
        entity_id: user?.username || 'bulk_import',
        details: `Imported ${finalUniqueInsert.length} call tasks out of ${importingData.length} records parsed`
      });

      toast.success(`Successfully imported ${finalUniqueInsert.length} call task records!`);
      setShowImportModal(false);
      setImportingData(null);
    } catch (err: any) {
      console.error('Import failed:', err);
      const detailedMessage = err && err.message ? `: ${err.message}` : '';
      toast.error(`Failed to save imported records to the database${detailedMessage}`);
    } finally {
      setImportLoading(false);
    }
  };

  const handleComplete = (task?: CallTask) => {
    if (task) {
      setTasks(prev => {
        const exists = prev.find(t => t.id === task.id);
        if (exists) {
          return prev.map(t => t.id === task.id ? task : t);
        } else {
          return [task, ...prev];
        }
      });
    }
    setEditingTask(null);
  };

  return (
    <div className="space-y-6">
        <div className="flex flex-col gap-4 w-full">
          {/* Top Row: Search, New Task, Import, Export */}
          <div className="flex flex-wrap items-center gap-3 w-full">
            {/* Search textbox (Verify PCA ID / Phone Availability...) */}
            <div className="flex-1 min-w-[280px] max-w-md">
              <div className="relative group">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                  <Search size={16} className="text-gray-400 group-focus-within:text-teal-600 transition-colors" />
                </div>
                <input 
                  type="text"
                  value={verifyQuery}
                  onChange={(e) => setVerifyQuery(e.target.value)}
                  placeholder="Verify PCA ID / Phone Availability..."
                  className="block w-full pl-9 pr-24 py-2 bg-white border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-teal-500/20 focus:border-teal-500 text-xs transition-all font-semibold text-gray-700 shadow-sm"
                />
                <div className="absolute inset-y-0 right-0 pr-2.5 flex items-center">
                  {verificationStatus.lookupDone && (
                    verificationStatus.exists ? (
                      <div className="flex items-center gap-1 text-red-500 bg-red-50 px-2 py-0.5 rounded-full border border-red-100 shadow-sm animate-in fade-in duration-200">
                        <Trash2 size={12} className="animate-pulse" />
                        <span className="text-[9px] font-black uppercase tracking-wider">Exists</span>
                      </div>
                    ) : (
                      <div className="flex items-center gap-1 text-teal-600 bg-teal-50 px-2 py-0.5 rounded-full border border-teal-100 shadow-sm animate-in fade-in duration-200">
                        <CheckCircle2 size={12} />
                        <span className="text-[9px] font-black uppercase tracking-wider">Available</span>
                      </div>
                    )
                  )}
                </div>
              </div>
            </div>

            {/* New Task Button */}
            <button
              onClick={() => setShowNewModal(true)}
              className="flex items-center justify-center gap-1.5 px-4 py-2 bg-teal-600 hover:bg-teal-700 text-white rounded-xl font-bold text-xs transition-all shadow-md shadow-teal-600/20 active:scale-95 whitespace-nowrap cursor-pointer"
              title="Create New Call Task"
            >
              <Plus size={16} />
              New Task
            </button>

            {/* Import Button */}
            <button
              onClick={() => document.getElementById('csv-import-input')?.click()}
              className="flex items-center justify-center gap-1.5 px-4 py-2 bg-teal-50 hover:bg-teal-100 text-teal-700 border border-teal-100/50 rounded-xl font-bold text-xs transition-colors shadow-sm cursor-pointer whitespace-nowrap"
              title="Import Call Tasks from CSV or Excel"
            >
              <FileUp size={14} />
              Import
            </button>
            <input
              id="csv-import-input"
              type="file"
              accept=".csv, .xlsx, .xls"
              className="hidden"
              onChange={handleImportFile}
            />

            {/* Export Button */}
            <button
              onClick={handleExport}
              className="flex items-center justify-center gap-1.5 px-4 py-2 bg-teal-50 hover:bg-teal-100 text-teal-700 border border-teal-100/50 rounded-xl font-bold text-xs transition-colors shadow-sm cursor-pointer whitespace-nowrap"
              title="Export Call Tasks to Excel"
            >
              <FileDown size={14} />
              Export
            </button>
          </div>
          
          {/* Master Advanced Filters Grid Panel */}
          <div className="bg-white rounded-3xl border border-gray-100 shadow-sm p-4 space-y-4 w-full">
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-3">
              
              {/* 1. Search Lead Name/Phone */}
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-gray-400">
                  <Search size={14} />
                </div>
                <input 
                  type="text"
                  placeholder="Search Lead..."
                  value={filters.search}
                  onChange={(e) => setFilters({ ...filters, search: e.target.value })}
                  className="w-full pl-9 pr-3 py-2 bg-gray-50/50 border border-gray-200 rounded-xl text-xs font-semibold text-gray-700 placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-teal-500/10 focus:border-teal-500 focus:bg-white transition-all"
                />
              </div>

              {/* 2. PCA ID Input */}
              <div className="relative">
                <input 
                  type="text"
                  placeholder="PCAID..."
                  value={filters.pcaid}
                  onChange={(e) => setFilters({ ...filters, pcaid: e.target.value })}
                  className="w-full px-3 py-2 bg-gray-50/50 border border-gray-200 rounded-xl text-xs font-semibold text-gray-700 placeholder:text-gray-400 uppercase focus:outline-none focus:ring-2 focus:ring-teal-500/10 focus:border-teal-500 focus:bg-white transition-all"
                />
              </div>

              {/* 3. Status Filter Dropdown */}
              <div>
                <select 
                  value={filters.status}
                  onChange={(e) => setFilters({ ...filters, status: e.target.value })}
                  className="w-full px-3 py-2 bg-gray-50/50 border border-gray-200 rounded-xl text-xs font-semibold text-gray-700 focus:outline-none focus:ring-2 focus:ring-teal-500/10 focus:border-teal-500 focus:bg-white transition-all cursor-pointer"
                >
                  <option value="">All Statuses</option>
                  <option value="Not Sure">Not Sure</option>
                  <option value="Free">Free</option>
                  <option value="Joined">Joined</option>
                  <option value="Not Join">Not Join</option>
                </select>
              </div>

              {/* 4. District Filter Dropdown */}
              <div>
                <select 
                  value={filters.district}
                  onChange={(e) => setFilters({ ...filters, district: e.target.value })}
                  className="w-full px-3 py-2 bg-gray-50/50 border border-gray-200 rounded-xl text-xs font-semibold text-gray-700 focus:outline-none focus:ring-2 focus:ring-teal-500/10 focus:border-teal-500 focus:bg-white transition-all cursor-pointer"
                >
                  <option value="">All Districts</option>
                  {SRI_LANKAN_DISTRICTS.map(d => <option key={d} value={d}>{d}</option>)}
                </select>
              </div>

              {/* 5. Class Multi-Select Dropdown Button */}
              <div className="relative">
                <button 
                  onClick={() => setShowClassDropdown(!showClassDropdown)}
                  className="w-full flex items-center justify-between px-3 py-2 bg-gray-50/50 border border-gray-200 rounded-xl text-xs font-semibold text-gray-700 focus:outline-none focus:ring-2 focus:ring-teal-500/10 focus:border-teal-500 focus:bg-white transition-all cursor-pointer"
                >
                  <span className="truncate">
                    {filters.classes.length === 0 ? 'All Classes' : 
                     filters.classes.length === 1 ? filters.classes[0] : 
                     `${filters.classes.length} Classes`}
                  </span>
                  <ChevronDown size={14} className={`text-gray-400 transition-transform ${showClassDropdown ? 'rotate-180' : ''}`} />
                </button>

                {showClassDropdown && (
                  <>
                    <div className="fixed inset-0 z-40" onClick={() => setShowClassDropdown(false)} />
                    <div className="absolute left-0 mt-2 w-full bg-white rounded-xl shadow-2xl border border-gray-100 py-2 z-50 max-h-[300px] overflow-auto animate-in fade-in zoom-in-95 duration-100">
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
                      {classTypes.map(c => {
                        const isSelected = filters.classes.includes(c.class_type);
                        return (
                          <button
                            key={c.id}
                            onClick={(e) => {
                              e.stopPropagation();
                              const newClasses = isSelected 
                                ? filters.classes.filter(item => item !== c.class_type)
                                : [...filters.classes, c.class_type];
                              setFilters({ ...filters, classes: newClasses });
                            }}
                            className={`w-full flex items-center justify-between px-3 py-2 text-xs font-bold transition-colors ${isSelected ? 'bg-teal-50 text-teal-700' : 'text-gray-600 hover:bg-gray-50'}`}
                          >
                            {c.class_type}
                            {isSelected && <Check size={14} />}
                          </button>
                        );
                      })}
                    </div>
                  </>
                )}
              </div>

              {/* 6. Package Multi-Select Dropdown Button */}
              <div className="relative">
                <button 
                  onClick={() => setShowPackageDropdown(!showPackageDropdown)}
                  className="w-full flex items-center justify-between px-3 py-2 bg-gray-50/50 border border-gray-200 rounded-xl text-xs font-semibold text-gray-700 focus:outline-none focus:ring-2 focus:ring-teal-500/10 focus:border-teal-500 focus:bg-white transition-all cursor-pointer"
                >
                  <span className="truncate">
                    {filters.packages.length === 0 ? 'All Packages' : 
                     filters.packages.length === 1 ? filters.packages[0] : 
                     `${filters.packages.length} Packages`}
                  </span>
                  <ChevronDown size={14} className={`text-gray-400 transition-transform ${showPackageDropdown ? 'rotate-180' : ''}`} />
                </button>

                {showPackageDropdown && (
                  <>
                    <div className="fixed inset-0 z-40" onClick={() => setShowPackageDropdown(false)} />
                    <div className="absolute left-0 mt-2 w-full bg-white rounded-xl shadow-2xl border border-gray-100 py-2 z-50 max-h-[300px] overflow-auto animate-in fade-in zoom-in-95 duration-100">
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

              {/* 7. Proper Batch */}
              <div>
                <input 
                  type="text"
                  placeholder="Proper Batch..."
                  value={filters.properBatch}
                  onChange={(e) => setFilters({ ...filters, properBatch: e.target.value })}
                  className="w-full px-3 py-2 bg-gray-50/50 border border-gray-200 rounded-xl text-xs font-semibold text-gray-700 placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-teal-500/10 focus:border-teal-500 focus:bg-white transition-all"
                />
              </div>

              {/* 8. Joined Batch */}
              <div>
                <input 
                  type="text"
                  placeholder="Joined Batch..."
                  value={filters.joinedBatch}
                  onChange={(e) => setFilters({ ...filters, joinedBatch: e.target.value })}
                  className="w-full px-3 py-2 bg-gray-50/50 border border-gray-200 rounded-xl text-xs font-semibold text-gray-700 placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-teal-500/10 focus:border-teal-500 focus:bg-white transition-all"
                />
              </div>

              {/* 9. From Date Picker */}
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-gray-400">
                  <Calendar size={13} />
                </div>
                <input 
                  type="date"
                  value={filters.startDate}
                  onChange={(e) => setFilters({ ...filters, startDate: e.target.value })}
                  className="w-full pl-9 pr-3 py-2 bg-gray-50/50 border border-gray-200 rounded-xl text-xs font-semibold text-gray-700 focus:outline-none focus:ring-2 focus:ring-teal-500/10 focus:border-teal-500 focus:bg-white transition-all cursor-pointer"
                  title="From Date"
                />
              </div>

              {/* 10. To Date Picker */}
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-gray-400">
                  <Calendar size={13} />
                </div>
                <input 
                  type="date"
                  value={filters.endDate}
                  onChange={(e) => setFilters({ ...filters, endDate: e.target.value })}
                  className="w-full pl-9 pr-3 py-2 bg-gray-50/50 border border-gray-200 rounded-xl text-xs font-semibold text-gray-700 focus:outline-none focus:ring-2 focus:ring-teal-500/10 focus:border-teal-500 focus:bg-white transition-all cursor-pointer"
                  title="To Date"
                />
              </div>

            </div>

            {/* Tray Status indicators and Reset Button */}
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between border-t border-gray-100 pt-3 gap-3">
              <div className="flex items-center gap-2">
                <span className="inline-flex items-center justify-center px-3 py-1 bg-teal-50 border border-teal-100 text-teal-700 text-xs font-extrabold rounded-lg shadow-sm">
                  COUNT: {filteredTasks.length}
                </span>
                <span className="text-[10px] text-gray-400 font-extrabold uppercase tracking-widest">Tasks Match Active Filters</span>
              </div>

              <div className="flex flex-wrap items-center gap-2 w-full sm:w-auto">
                {(filters.status || filters.district || filters.classes.length > 0 || filters.packages.length > 0 || filters.properBatch || filters.joinedBatch || filters.startDate || filters.endDate || filters.search || filters.pcaid) && (
                  <button
                    onClick={() => setFilters({ status: '', district: '', classes: [], packages: [], properBatch: '', joinedBatch: '', startDate: '', endDate: '', search: '', pcaid: '' })}
                    className="inline-flex items-center justify-center gap-1 bg-rose-50 hover:bg-rose-100 border border-rose-100 text-rose-600 rounded-xl px-4 py-1.5 text-xs font-bold transition-all active:scale-95 cursor-pointer"
                    title="Clear all filters"
                  >
                    <X size={14} />
                    Clear All Filters
                  </button>
                )}
              </div>
            </div>
          </div>
        </div>

      <div className="max-h-[calc(100vh-260px)] min-h-[450px] overflow-auto bg-white dark:bg-gray-900 rounded-2xl shadow-sm border border-gray-100 dark:border-gray-800 relative shadow-md">
        <table className="w-full text-left border-collapse min-w-[1100px]">
          <thead className="sticky top-0 z-30">
            <tr className="bg-teal-600">
              <th className="p-4 font-bold text-white text-center sticky left-0 top-0 z-40 bg-teal-600 w-[50px]">No</th>
              <th className="p-4 font-bold text-white sticky left-[50px] top-0 z-40 bg-teal-600 min-w-[120px]">PCA ID</th>
              <th className="p-4 font-bold text-white sticky left-[170px] top-0 z-40 bg-teal-600 min-w-[180px] border-r border-teal-500/20 shadow-[4px_0_8px_-4px_rgba(0,0,0,0.2)]">Name</th>
              <th className="p-4 font-bold text-white min-w-[130px] bg-teal-600">Phone</th>
              <th className="p-4 font-bold text-white min-w-[110px] bg-teal-600 text-center">1st Call</th>
              <th className="p-4 font-bold text-white min-w-[110px] bg-teal-600 text-center">2nd Call</th>
              <th className="p-4 font-bold text-white min-w-[110px] bg-teal-600 text-center">3rd Call</th>
              <th className="p-4 font-bold text-white min-w-[120px] bg-teal-600">Status</th>
              <th className="p-4 font-bold text-white text-center min-w-[160px] sticky top-0 bg-teal-600">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-50 dark:divide-gray-800/60">
            {filteredTasks.length === 0 ? (
              <tr>
                <td colSpan={9} className="p-12 text-center text-gray-400 dark:text-gray-500 font-medium">No records found</td>
              </tr>
            ) : (
              filteredTasks.map((task, idx) => (
                <tr key={task.id} className="hover:bg-teal-50/30 dark:hover:bg-teal-950/20 transition-colors group">
                  <td className="p-4 text-center text-gray-400 dark:text-gray-500 text-sm sticky left-0 z-10 bg-white dark:bg-gray-900 group-hover:bg-teal-50/30 dark:group-hover:bg-teal-950/20">{idx + 1}</td>
                  <td className="p-4 font-mono font-bold text-teal-600 dark:text-teal-400 text-xs sticky left-[50px] z-10 bg-white dark:bg-gray-900 group-hover:bg-teal-50/30 dark:group-hover:bg-teal-950/20">
                    <div className="flex items-center gap-2">
                      <span>{task.pcaid || '-'}</span>
                      {task.pcaid && <button onClick={() => toast.success(copyToClipboard(task.pcaid))} className="text-gray-300 dark:text-gray-600 hover:text-teal-600 dark:hover:text-teal-400"><Copy size={12}/></button>}
                    </div>
                  </td>
                  <td className="p-4 font-bold text-gray-900 dark:text-gray-100 sticky left-[170px] z-10 bg-white dark:bg-gray-900 group-hover:bg-teal-50/30 dark:group-hover:bg-teal-950/20 border-r border-gray-100 dark:border-gray-800 shadow-[4px_0_8px_-4px_rgba(0,0,0,0.12)]">
                    <div className="flex items-center gap-2">
                      <span>{task.name}</span>
                      <button onClick={() => toast.success(copyToClipboard(task.name))} className="text-gray-300 dark:text-gray-600 hover:text-teal-600 dark:hover:text-teal-400"><Copy size={14}/></button>
                    </div>
                  </td>
                  <td className="p-4 font-mono text-sm text-gray-600 dark:text-gray-350">
                    <div className="flex items-center gap-1.5 flex-nowrap">
                      <span>{task.phone}</span>
                      <div className="flex items-center gap-0.5">
                        <button 
                          onClick={() => toast.success(copyToClipboard(task.phone))} 
                          className="p-1 text-gray-300 dark:text-gray-600 hover:text-teal-600 dark:hover:text-teal-400 transition-colors cursor-pointer"
                          title="Copy Phone Number"
                        >
                          <Copy size={13}/>
                        </button>
                        {task.phone && (
                          <a 
                            href={`https://wa.me/${task.phone.replace(/\D/g, '')}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="p-1 text-green-500 hover:text-green-600 dark:text-green-400 dark:hover:text-green-300 transition-colors flex items-center justify-center cursor-pointer"
                            title="Chat on WhatsApp"
                          >
                            <MessageCircle size={14} className="fill-green-500/10 dark:fill-green-400/10" />
                          </a>
                        )}
                      </div>
                    </div>
                  </td>
                  <td className="p-4 text-center">
                    <div className="flex flex-col gap-0.5">
                      <span className="text-[10px] font-bold text-gray-400 dark:text-gray-500 uppercase">{task.first_call_date || 'N/A'}</span>
                      <span className={cn("text-xs font-semibold", task.first_call_status === 'Completed' ? 'text-green-600 dark:text-green-400' : 'text-gray-500 dark:text-gray-450')}>{task.first_call_status}</span>
                    </div>
                  </td>
                  <td className="p-4 text-center">
                    <div className="flex flex-col gap-0.5">
                      <span className="text-[10px] font-bold text-gray-400 dark:text-gray-500 uppercase">{task.second_call_date || 'N/A'}</span>
                      <span className={cn("text-xs font-semibold", task.second_call_status === 'Completed' ? 'text-green-600 dark:text-green-400' : 'text-gray-500 dark:text-gray-450')}>{task.second_call_status}</span>
                    </div>
                  </td>
                  <td className="p-4 text-center">
                    <div className="flex flex-col gap-0.5">
                      <span className="text-[10px] font-bold text-gray-400 dark:text-gray-500 uppercase">{task.third_call_date || 'N/A'}</span>
                      <span className={cn("text-xs font-semibold", task.third_call_status === 'Completed' ? 'text-green-600 dark:text-green-400' : 'text-gray-500 dark:text-gray-450')}>{task.third_call_status}</span>
                    </div>
                  </td>
                  <td className="p-4">
                    <div className="flex flex-col gap-1">
                      <span className={cn(
                        "px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-widest text-center",
                        task.status === 'Not Sure' && "bg-yellow-105 text-yellow-700 dark:bg-yellow-950/40 dark:text-yellow-400",
                        task.status === 'Joined' && "bg-green-105 text-green-700 dark:bg-green-950/40 dark:text-green-400 border border-green-200 dark:border-green-800/40",
                        task.status === 'Free' && "bg-blue-105 text-blue-700 dark:bg-blue-950/40 dark:text-blue-400 border border-blue-200 dark:border-blue-800/40",
                        task.status === 'Not Join' && "bg-red-105 text-red-700 dark:bg-red-950/40 dark:text-red-400"
                      )}>
                        {task.status}
                      </span>
                    </div>
                  </td>
                  <td className="p-4">
                    <div className="flex items-center justify-center gap-2">
                        {task.status === 'Joined' ? (
                          <div className="flex items-center gap-2">
                             {undoingId === task.id ? (
                              <div className="flex items-center gap-1 animate-in zoom-in-95 duration-150">
                                <span className="text-[10px] font-black text-orange-600 dark:text-orange-400 uppercase mr-1">Undo?</span>
                                <button onClick={() => handleUndoJoin(task)} className="px-2 py-1 bg-orange-600 text-white text-[10px] font-black rounded uppercase">Yes</button>
                                <button onClick={() => setUndoingId(null)} className="px-2 py-1 bg-gray-200 text-gray-600 dark:bg-gray-800 dark:text-gray-300 text-[10px] font-black rounded uppercase">No</button>
                              </div>
                            ) : (
                              <>
                                <div className="flex items-center gap-1.5 px-3 py-1.5 bg-gray-100 dark:bg-gray-800 text-gray-400 dark:text-gray-300 rounded-lg text-xs font-bold border border-gray-200 dark:border-gray-700">
                                   Joined <CheckCircle2 size={14} className="text-green-500 dark:text-green-400"/>
                                </div>
                                <button 
                                  onClick={() => setUndoingId(task.id)}
                                  className="p-1.5 text-gray-400 hover:text-orange-600 hover:bg-orange-50 dark:hover:bg-orange-950/20 rounded-lg transition-colors border border-transparent hover:border-orange-100 dark:hover:border-orange-900/40"
                                  title="Undo Join (Delete Student Record)"
                                >
                                  <RotateCcw size={16} />
                                </button>
                              </>
                            )}
                          </div>
                        ) : (
                          <button 
                            onClick={() => {
                              navigate('/admin/student-form', { state: { lead: task } });
                            }}
                            className="flex items-center gap-1.5 px-3 py-1.5 bg-teal-600 text-white rounded-lg text-xs font-bold hover:bg-teal-700 active:scale-95 transition-all shadow-md shadow-teal-600/20"
                          >
                            Join <ChevronRight size={14}/>
                          </button>
                        )}
                      <button 
                        onClick={() => setEditingTask(task)}
                        className="p-2 text-gray-400 dark:text-gray-500 hover:text-teal-600 hover:bg-teal-50 dark:hover:bg-teal-950/40 rounded-lg transition-colors"
                      >
                        <Edit size={18} />
                      </button>
                      {deletingId === task.id ? (
                        <div className="flex gap-1 animate-in zoom-in-95 duration-150">
                          <button onClick={() => handleDelete(task)} className="px-2 py-1 bg-red-600 text-white text-[10px] font-black rounded uppercase">Yes</button>
                          <button onClick={() => setDeletingId(null)} className="px-2 py-1 bg-gray-200 text-gray-600 dark:bg-gray-800 dark:text-gray-300 text-[10px] font-black rounded uppercase">No</button>
                        </div>
                      ) : (
                        <button 
                          onClick={() => setDeletingId(task.id)}
                          className="p-2 text-gray-400 dark:text-gray-500 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-950/40 rounded-lg transition-colors"
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

      {/* Pop-up Modals for New and Edit Form Views - Disables behind window using fixed backdrop */}
      <AnimatePresence>
        {showNewModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            {/* Backdrop: translucent dark background with backdrop blur disabling interaction behind */}
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setShowNewModal(false)}
              className="absolute inset-0 bg-black/60 backdrop-blur-sm"
            />
            
            {/* Modal Body Container */}
            <motion.div 
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="relative bg-white rounded-3xl shadow-2xl border border-gray-100 max-w-4xl w-full max-h-[90vh] overflow-y-auto z-50 p-6 md:p-8"
            >
              <button
                onClick={() => setShowNewModal(false)}
                className="absolute top-4 right-4 p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-full transition-all z-10"
                title="Close"
              >
                <X size={20} />
              </button>
              
              <div className="mt-2">
                <CallTaskForm 
                  onComplete={(task) => {
                    if (task) {
                      setTasks(prev => [task, ...prev]);
                    }
                    setShowNewModal(false);
                  }}
                />
              </div>
            </motion.div>
          </div>
        )}

        {editingTask && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            {/* Backdrop: translucent dark background with backdrop blur disabling interaction behind */}
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setEditingTask(null)}
              className="absolute inset-0 bg-black/60 backdrop-blur-sm"
            />
            
            {/* Modal Body Container */}
            <motion.div 
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="relative bg-white rounded-3xl shadow-2xl border border-gray-100 max-w-4xl w-full max-h-[90vh] overflow-y-auto z-50 p-6 md:p-8"
            >
              <button
                onClick={() => setEditingTask(null)}
                className="absolute top-4 right-4 p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-full transition-all z-10"
                title="Close"
              >
                <X size={20} />
              </button>
              
              <div className="mt-2">
                <CallTaskForm 
                  editData={editingTask}
                  onComplete={(task) => {
                    if (task) {
                      setTasks(prev => prev.map(t => t.id === task.id ? task : t));
                    }
                    setEditingTask(null);
                  }}
                />
              </div>
            </motion.div>
          </div>
        )}

        {showImportModal && importingData && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setShowImportModal(false)}
              className="absolute inset-0 bg-black/60 backdrop-blur-sm"
            />
            
            <motion.div 
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="relative bg-white rounded-3xl shadow-2xl border border-gray-100 max-w-5xl w-full max-h-[90vh] overflow-hidden flex flex-col z-50 p-6 md:p-8"
            >
              <button
                onClick={() => setShowImportModal(false)}
                className="absolute top-4 right-4 p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-full transition-all z-10"
                title="Close"
              >
                <X size={20} />
              </button>
              
              <div className="flex flex-col gap-1.5 border-b border-gray-100 pb-4 mb-4">
                <h3 className="text-xl font-black text-gray-950 flex items-center gap-2">
                  <FileUp className="text-teal-600" size={24} />
                  <span>Review and Import Leads Data</span>
                </h3>
                <p className="text-xs font-semibold text-gray-500">
                  Parsed <span className="text-teal-600 font-bold">{importingData.length}</span> potential call task records. Review matched fields and normalized values below before confirming.
                </p>
              </div>

              {/* Duplicate Prevention Option */}
              <div className="bg-teal-50 border border-teal-100 p-4 rounded-2xl flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-4">
                <div className="space-y-0.5">
                  <span className="text-sm font-bold text-teal-950 flex items-center gap-1.5">
                    🛡️ Automatically Prevent Duplicates
                  </span>
                  <p className="text-[11px] font-semibold text-teal-700/80">
                    If checked, records with PCA IDs that are already registered in the Call Tasks page will be skipped dynamically.
                  </p>
                </div>
                <label className="relative inline-flex items-center cursor-pointer select-none">
                  <input 
                    type="checkbox" 
                    checked={skipDuplicates}
                    onChange={(e) => setSkipDuplicates(e.target.checked)}
                    className="sr-only peer"
                  />
                  <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-teal-600"></div>
                  <span className="ml-2 text-xs font-black text-teal-950 uppercase">{skipDuplicates ? 'Enabled' : 'Disabled'}</span>
                </label>
              </div>

              {/* Scrollable Data Table Preview */}
              <div className="flex-1 overflow-auto border border-gray-100 dark:border-gray-800 rounded-2xl bg-gray-50 dark:bg-gray-900 shadow-inner">
                <table className="w-full text-left border-collapse text-xs">
                  <thead>
                    <tr className="bg-gray-100 dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700 text-[10px] font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wider animate-none">
                      <th className="p-3 text-center">Row</th>
                      <th className="p-3">Name</th>
                      <th className="p-3">Phone</th>
                      <th className="p-3">PCA ID</th>
                      <th className="p-3">Stream</th>
                      <th className="p-3">District</th>
                      <th className="p-3">Ask Classes</th>
                      <th className="p-3">Ask Packages</th>
                      <th className="p-3">Notes / Status</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-200/60 dark:divide-gray-800/60 bg-white dark:bg-gray-950">
                    {importingData.map((row, idx) => (
                      <tr key={idx} className="hover:bg-teal-50/10 dark:hover:bg-teal-950/20 transition-colors">
                        <td className="p-3 text-center font-mono font-bold text-gray-400 dark:text-gray-500">{row.rowNum}</td>
                        <td className="p-3 font-bold text-gray-900 dark:text-gray-100">{row.name}</td>
                        <td className="p-3 font-mono font-semibold text-gray-700 dark:text-gray-300">{row.phone}</td>
                        <td className="p-3 font-mono text-[10px] font-black text-teal-600 dark:text-teal-400">{row.pcaid || '-'}</td>
                        <td className="p-3">
                          <span className={cn(
                            "px-2 py-0.5 rounded-full text-[10px] font-bold",
                            row.stream === 'Biological Science' && "bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-400",
                            row.stream === 'Physical Science' && "bg-sky-50 dark:bg-sky-950/40 text-sky-700 dark:text-sky-400",
                            row.stream === 'Non Stream' && "bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-400"
                          )}>
                            {row.stream}
                          </span>
                        </td>
                        <td className="p-3 font-semibold text-gray-600 dark:text-gray-300">{row.district || '-'}</td>
                        <td className="p-3 text-gray-600 dark:text-gray-300 max-w-[120px] truncate" title={row.asked_class_type}>{row.asked_class_type || '-'}</td>
                        <td className="p-3 text-gray-600 dark:text-gray-300 max-w-[120px] truncate" title={row.asked_package_type}>{row.asked_package_type || '-'}</td>
                        <td className="p-3">
                          <div className="flex flex-col gap-0.5">
                            <span className="font-semibold text-[10px] text-teal-600 dark:text-teal-400 uppercase tracking-wide">{row.status}</span>
                            {row.note && <span className="text-[10px] text-gray-400 dark:text-gray-500 italic truncate max-w-[140px]">{row.note}</span>}
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* Action Buttons */}
              <div className="flex items-center justify-end gap-3 border-t border-gray-100 pt-5 mt-5">
                <button
                  type="button"
                  onClick={() => setShowImportModal(false)}
                  className="px-5 py-2.5 bg-gray-50 text-gray-600 hover:bg-gray-100 font-bold rounded-xl transition-all text-xs"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  disabled={importLoading}
                  onClick={handleConfirmImport}
                  className="px-6 py-2.5 bg-teal-600 hover:bg-teal-700 text-white font-bold rounded-xl transition-all shadow-md shadow-teal-600/10 hover:shadow-lg disabled:opacity-50 text-xs flex items-center gap-2"
                >
                  {importLoading ? (
                    <>
                      <div className="w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                      <span>Saving Data...</span>
                    </>
                  ) : (
                    <>
                      <span>Import {importingData.length} records</span>
                    </>
                  )}
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}

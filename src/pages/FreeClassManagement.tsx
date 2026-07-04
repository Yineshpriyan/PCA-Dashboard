import React, { useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';
import { toast } from 'sonner';
import { 
  User as UserIcon,
  Save,
  CheckCircle2,
  RefreshCw,
  Search,
  ShieldCheck,
  ShieldAlert,
  ChevronLeft,
  Plus,
  Trash2
} from 'lucide-react';
import { useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';
import { SRI_LANKAN_DISTRICTS, ClassItem } from '../types';
import { cn } from '../lib/utils';

export function FreeClassForm() {
  const { state } = useLocation();
  const navigate = useNavigate();
  const { user } = useAuth();
  const leadData = state?.lead;

  const [loading, setLoading] = useState(false);
  const [classTypes, setClassTypes] = useState<ClassItem[]>([]);
  const [selectedClass, setSelectedClass] = useState('');
  
  // Verification State (Optional but good to have)
  const [verifyQuery, setVerifyQuery] = useState('');
  const [verificationStatus, setVerificationStatus] = useState<{
    exists: boolean;
    lookupDone: boolean;
  }>({ exists: false, lookupDone: false });

  const [formData, setFormData] = useState({
    pcaid: leadData?.pcaid || '',
    name: leadData?.name || '',
    phone: leadData?.phone || '',
    proper_batch: leadData?.proper_batch || '',
    joined_batch: leadData?.joined_batch || '',
    school: leadData?.school || '',
    district: leadData?.district || '',
    mail: leadData?.mail || '',
    address: leadData?.address || '',
    asked_class_type: leadData?.asked_class_type || ''
  });

  useEffect(() => {
    if (leadData) {
      setFormData({
        pcaid: leadData.pcaid || '',
        name: leadData.name || '',
        phone: leadData.phone || '',
        proper_batch: leadData.proper_batch || '',
        joined_batch: leadData.joined_batch || '',
        school: leadData.school || '',
        district: leadData.district || '',
        mail: leadData.mail || '',
        address: leadData.address || '',
        asked_class_type: leadData.asked_class_type || ''
      });
    }
  }, [leadData]);

  useEffect(() => {
    fetchClassTypes();
  }, []);

  const fetchClassTypes = async () => {
    const { data } = await supabase.from('class_item').select('*').order('class_type');
    if (data) setClassTypes(data);
  };

  const handleAddClass = () => {
    if (selectedClass && !formData.asked_class_type.includes(selectedClass)) {
      const newList = formData.asked_class_type 
        ? `${formData.asked_class_type}, ${selectedClass}`
        : selectedClass;
      setFormData({ ...formData, asked_class_type: newList });
      setSelectedClass('');
    }
  };

  const handleRemoveClass = (classToRemove: string) => {
    const newList = formData.asked_class_type
      .split(', ')
      .filter(c => c !== classToRemove)
      .join(', ');
    setFormData({ ...formData, asked_class_type: newList });
  };

  const handleSave = async () => {
    if (!formData.name || !formData.phone) {
      toast.error('Name and Phone are required');
      return;
    }

    setLoading(true);
    try {
      // 1. Save to freeclass table using insert (since there's no unique constraint on phone)
      const { error: saveError } = await supabase
        .from('freeclass')
        .insert({
          pcaid: formData.pcaid || null,
          name: formData.name,
          phone: formData.phone,
          proper_batch: formData.proper_batch,
          joined_batch: formData.joined_batch,
          school: formData.school,
          district: formData.district,
          mail: formData.mail,
          address: formData.address,
          asked_class_type: formData.asked_class_type,
          admin: user?.username
        });

      if (saveError) {
        console.error('Supabase Save Error:', saveError);
        throw new Error(saveError.message);
      }

      // 2. Sync with CallTask table to mark as Joined and update record info
      const sharedFieldsForTask = {
        pcaid: formData.pcaid || null,
        name: formData.name,
        phone: formData.phone,
        proper_batch: formData.proper_batch,
        joined_batch: formData.joined_batch,
        school: formData.school,
        district: formData.district,
        mail: formData.mail,
        address: formData.address,
        asked_class_type: formData.asked_class_type,
        status: 'Joined'
      };

      const { error: taskError } = await supabase
        .from('calltask')
        .update(sharedFieldsForTask)
        .eq('phone', formData.phone);

      if (taskError) {
        console.error('CallTask Update Error:', taskError);
      }

      toast.success('Free Class student registered successfully!');
      navigate('/admin/call-task/display');
    } catch (err: any) {
      toast.error(`Error: ${err.message || 'Failed to save data'}`);
      console.error('Full Error Object:', err);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="max-w-4xl mx-auto space-y-8 pb-12">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <button 
            onClick={() => navigate(-1)}
            className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
          >
            <ChevronLeft size={24} />
          </button>
          <h2 className="text-2xl font-bold text-gray-900 border-l-4 border-blue-600 pl-4 uppercase tracking-tight">
            Free Class Registration
          </h2>
        </div>
        <div className="bg-blue-600 text-white px-4 py-2 rounded-xl text-xs font-black uppercase tracking-widest animate-pulse shadow-lg shadow-blue-600/30">
          Free Class Form
        </div>
      </div>

      <div className="bg-white p-8 rounded-2xl shadow-sm border border-gray-100 space-y-6">
        <h3 className="text-lg font-bold text-gray-800 flex items-center gap-2">
          <UserIcon size={20} className="text-blue-600"/>
          Registration Details
        </h3>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="space-y-4">
            <div className="flex flex-col gap-1.5">
              <label className="text-sm font-semibold text-gray-700">PCA ID (Optional)</label>
              <input
                type="text"
                value={formData.pcaid}
                onChange={(e) => setFormData({ ...formData, pcaid: e.target.value.toUpperCase() })}
                className="w-full px-4 py-2 bg-gray-50 border border-gray-200 rounded-lg font-mono"
                placeholder="PCA-XXXX"
              />
            </div>

            <div className="flex flex-col gap-1.5">
              <label className="text-sm font-semibold text-gray-700">Name</label>
              <input
                type="text"
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                className="w-full px-4 py-2 bg-gray-50 border border-gray-200 rounded-lg"
                placeholder="Full Name"
              />
            </div>

            <div className="flex flex-col gap-1.5">
              <label className="text-sm font-semibold text-gray-700">Phone</label>
              <input
                type="text"
                value={formData.phone}
                onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                className="w-full px-4 py-2 bg-gray-50 border border-gray-200 rounded-lg"
                placeholder="Phone Number"
              />
            </div>

            <div className="flex flex-col gap-1.5">
              <label className="text-sm font-semibold text-gray-700">Proper Batch</label>
              <input
                type="text"
                value={formData.proper_batch}
                onChange={(e) => setFormData({ ...formData, proper_batch: e.target.value })}
                className="w-full px-4 py-2 bg-gray-50 border border-gray-200 rounded-lg"
                placeholder="e.g. 2024"
              />
            </div>

            <div className="flex flex-col gap-1.5">
              <label className="text-sm font-semibold text-gray-700">Joined Batch</label>
              <input
                type="text"
                value={formData.joined_batch}
                onChange={(e) => setFormData({ ...formData, joined_batch: e.target.value })}
                className="w-full px-4 py-2 bg-gray-50 border border-gray-200 rounded-lg"
                placeholder="e.g. 2024 June"
              />
            </div>
          </div>

          <div className="space-y-4">
            <div className="flex flex-col gap-1.5">
              <label className="text-sm font-semibold text-gray-700">District</label>
              <select
                value={formData.district}
                onChange={(e) => setFormData({ ...formData, district: e.target.value })}
                className="w-full px-4 py-2 bg-gray-50 border border-gray-200 rounded-lg"
              >
                <option value="">Select District</option>
                {SRI_LANKAN_DISTRICTS.map(d => <option key={d} value={d}>{d}</option>)}
              </select>
            </div>

            <div className="flex flex-col gap-1.5">
              <label className="text-sm font-semibold text-gray-700">Class Type</label>
              <div className="flex gap-2">
                <select
                  value={selectedClass}
                  onChange={(e) => setSelectedClass(e.target.value)}
                  className="flex-1 px-4 py-2 bg-gray-50 border border-gray-200 rounded-lg focus:outline-none"
                >
                  <option value="">Select Class</option>
                  {classTypes.map(c => <option key={c.id} value={c.class_type}>{c.class_type}</option>)}
                </select>
                <button
                  type="button"
                  onClick={handleAddClass}
                  className="p-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors shadow-sm shadow-blue-600/20"
                >
                  <Plus size={20} />
                </button>
              </div>
              <div className="flex flex-wrap gap-2 mt-2">
                {formData.asked_class_type.split(', ').filter(Boolean).map(c => (
                  <div key={c} className="flex items-center gap-2 px-3 py-1 bg-blue-50 border border-blue-100 rounded-full text-xs font-bold text-blue-700 shadow-sm">
                    <span>{c}</span>
                    <button 
                      type="button" 
                      onClick={() => handleRemoveClass(c)} 
                      className="text-red-400 hover:text-red-600 transition-colors"
                    >
                      <Trash2 size={14} />
                    </button>
                  </div>
                ))}
              </div>
            </div>

            <div className="flex flex-col gap-1.5">
              <label className="text-sm font-semibold text-gray-700">School</label>
              <input
                type="text"
                value={formData.school}
                onChange={(e) => setFormData({ ...formData, school: e.target.value })}
                className="w-full px-4 py-2 bg-gray-50 border border-gray-200 rounded-lg"
                placeholder="School Name"
              />
            </div>

            <div className="flex flex-col gap-1.5">
              <label className="text-sm font-semibold text-gray-700">Email</label>
              <input
                type="email"
                value={formData.mail}
                onChange={(e) => setFormData({ ...formData, mail: e.target.value })}
                className="w-full px-4 py-2 bg-gray-50 border border-gray-200 rounded-lg"
                placeholder="Email Address"
              />
            </div>

            <div className="flex flex-col gap-1.5">
              <label className="text-sm font-semibold text-gray-700">Address</label>
              <textarea
                value={formData.address}
                onChange={(e) => setFormData({ ...formData, address: e.target.value })}
                className="w-full px-4 py-2 bg-gray-50 border border-gray-200 rounded-lg h-24"
                placeholder="Address"
              />
            </div>
          </div>
        </div>

        <div className="pt-6 border-t border-gray-100">
          <button
            onClick={handleSave}
            disabled={loading}
            className="w-full py-4 bg-blue-600 hover:bg-blue-700 text-white font-black uppercase tracking-widest rounded-xl shadow-lg shadow-blue-600/20 transition-all active:scale-[0.98] disabled:opacity-50 flex items-center justify-center gap-2"
          >
            {loading ? <RefreshCw size={20} className="animate-spin" /> : <Save size={20} />}
            {loading ? 'Processing...' : 'SAVE FREE CLASS DATA'}
          </button>
        </div>
      </div>
    </div>
  );
}

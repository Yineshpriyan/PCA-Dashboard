import React, { useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';
import { toast } from 'sonner';
import { 
  Copy, 
  Trash2, 
  MessageSquare, 
  Plus, 
  Save, 
  X, 
  Edit,
  UserPlus,
  ShieldCheck,
  CheckCircle2,
  Eye,
  EyeOff,
  Users,
  Lock,
  Filter,
  Calendar,
  RotateCcw,
  Search,
  FileDown,
  Sliders
} from 'lucide-react';
import { Issue, IssueType, User, AdminType, IssueStatus, ClassItem, PackageItem } from '../types';
import { cn, copyToClipboard, formatDate, exportToExcel } from '../lib/utils';
import { motion, AnimatePresence } from 'motion/react';
import { useAuth } from '../hooks/useAuth';
import { logTransaction } from '../lib/transactions';

// --- FIXING VIEW ---
export function FixingView() {
  const { user } = useAuth();
  const [tokens, setTokens] = useState<Issue[]>([]);
  const [issueTypes, setIssueTypes] = useState<IssueType[]>([]);
  const [loading, setLoading] = useState(true);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [filters, setFilters] = useState({
    issue: '',
    date: '',
    fixedDate: '',
    status: '',
    search: ''
  });

  useEffect(() => {
    fetchTokens();
    fetchIssueTypes();
    const subscription = supabase
      .channel('public:issue_all')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'issue' }, () => {
        fetchTokens();
      })
      .subscribe();

    return () => {
      supabase.removeChannel(subscription);
    };
  }, []);

  const fetchTokens = async () => {
    const { data } = await supabase.from('issue').select('*').order('date', { ascending: false });
    if (data) setTokens(data as Issue[]);
    setLoading(false);
  };

  const fetchIssueTypes = async () => {
    const { data } = await supabase.from('issue_item').select('*').order('issue_type');
    if (data) setIssueTypes(data as IssueType[]);
  };

  const filteredTokens = tokens.filter(token => {
    const issueMatch = !filters.issue || token.issue === filters.issue;
    const statusMatch = !filters.status || token.status === filters.status;
    const dateMatch = !filters.date || (token.date && token.date.startsWith(filters.date));
    const fixedDateMatch = !filters.fixedDate || (token.fixed_date && token.fixed_date.startsWith(filters.fixedDate));
    
    const searchLower = filters.search.toLowerCase();
    const searchMatch = !filters.search || 
      token.name?.toLowerCase().includes(searchLower) || 
      token.phone?.includes(filters.search) || 
      token.pcaid?.toLowerCase().includes(searchLower) ||
      token.admin?.toLowerCase().includes(searchLower);

    return issueMatch && statusMatch && dateMatch && fixedDateMatch && searchMatch;
  });

  const handleExport = () => {
    if (filteredTokens.length === 0) {
      toast.error('No data to export');
      return;
    }

    const exportData = filteredTokens.map((t, index) => ({
      'No': index + 1,
      'Date': formatDate(t.date),
      'Issue': t.issue,
      'Note': t.note || '',
      'Phone': t.phone,
      'PCAID': t.pcaid,
      'Name': t.name,
      'Admin': t.admin,
      'Status': t.status,
      'Fixed Date': formatDate(t.fixed_date)
    }));

    exportToExcel(exportData, `Fixing_Report_${new Date().toISOString().split('T')[0]}`);
    toast.success('Excel file downloaded');
  };

  const handleStatusChange = async (tokenId: string, newStatus: IssueStatus) => {
    try {
      const updates: any = { status: newStatus };
      if (newStatus === 'Done') {
        updates.fixed_date = new Date().toISOString();
      } else {
        updates.fixed_date = null;
      }

      const { error } = await supabase
        .from('issue')
        .update(updates)
        .eq('id', tokenId);

      if (error) throw error;

      // Log issue resolution / status change
      await logTransaction({
        admin_username: user?.username || 'system',
        action_type: 'RESOLVE',
        entity_type: 'issue',
        entity_id: tokenId,
        details: `Updated issue token status to "${newStatus}" for token ID: ${tokenId}`
      });

      toast.success(`Status updated to ${newStatus}`);
      
      // Fast sync: update local state
      setTokens(prev => prev.map(t => 
        t.id === tokenId ? { ...t, ...updates } : t
      ));
    } catch (err) {
      toast.error('Failed to update status');
    }
  };

  const handleDelete = async (tokenId: string) => {
    try {
      const { error } = await supabase.from('issue').delete().eq('id', tokenId);
      if (error) throw error;

      // Log action
      await logTransaction({
        admin_username: user?.username || 'system',
        action_type: 'DELETE',
        entity_type: 'issue',
        entity_id: tokenId,
        details: `Deleted issue token ID: ${tokenId} from FixingView`
      });

      toast.success('Token deleted');
      setTokens(prev => prev.filter(t => t.id !== tokenId));
      setDeletingId(null);
    } catch (err) {
      toast.error('Failed to delete token');
    }
  };

  const handleWhatsApp = (token: Issue) => {
    const message = `${token.issue} is Fixed`;
    copyToClipboard(message);
    toast.success('WhatsApp message generated and copied!');
    window.open(`https://wa.me/${token.phone.replace(/\D/g,'')}?text=${encodeURIComponent(message)}`, '_blank');
  };

  const handleCopyConfirmMessage = (token: Issue) => {
    const message = `${token.issue} is Fixed.✅`;
    copyToClipboard(message);
    toast.success('Confirmation message copied!');
  };

  if (loading) return <div className="space-y-4">...Loading...</div>;

  return (
    <div className="space-y-6">
      <div className="flex flex-col xl:flex-row xl:items-center justify-end gap-4">
        
        <div className="flex flex-wrap items-center gap-2">
          <div className="relative group flex-1 md:flex-none">
            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
            <input
              type="text"
              placeholder="Search..."
              value={filters.search}
              onChange={(e) => setFilters({ ...filters, search: e.target.value })}
              className="pl-9 pr-4 py-2 bg-white border border-gray-200 rounded-xl text-xs sm:text-sm focus:border-teal-600 outline-none w-full md:w-[200px]"
            />
          </div>

          <div className="relative group flex-1 md:flex-none">
            <Filter size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
            <select
              value={filters.issue}
              onChange={(e) => setFilters({ ...filters, issue: e.target.value })}
              className="pl-9 pr-4 py-2 bg-white border border-gray-200 rounded-xl text-xs sm:text-sm focus:border-teal-600 outline-none appearance-none min-w-[120px] w-full"
            >
              <option value="">All Issues</option>
              {issueTypes.map(it => (
                <option key={it.id} value={it.issue_type}>{it.issue_type}</option>
              ))}
            </select>
          </div>

          <div className="relative group flex-1 md:flex-none">
            <Calendar size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
            <input
              type="date"
              value={filters.date}
              onChange={(e) => setFilters({ ...filters, date: e.target.value })}
              className="pl-9 pr-4 py-2 bg-white border border-gray-200 rounded-xl text-xs sm:text-sm focus:border-teal-600 outline-none w-full"
              title="Issue Date"
            />
          </div>

          <div className="relative group flex-1 md:flex-none">
            <Calendar size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-teal-600/50" />
            <input
              type="date"
              value={filters.fixedDate}
              onChange={(e) => setFilters({ ...filters, fixedDate: e.target.value })}
              className="pl-9 pr-4 py-2 bg-white border border-gray-200 rounded-xl text-xs sm:text-sm focus:border-teal-600 outline-none w-full"
              title="Fixed Date"
            />
          </div>

          <select
            value={filters.status}
            onChange={(e) => setFilters({ ...filters, status: e.target.value })}
            className="px-4 py-2 bg-white border border-gray-200 rounded-xl text-sm focus:border-teal-600 outline-none transition-all min-w-[120px]"
          >
            <option value="">All Status</option>
            <option value="Pending">Pending</option>
            <option value="Progress">Progress</option>
            <option value="Done">Done</option>
          </select>

          <button
            onClick={handleExport}
            className="flex items-center gap-2 px-4 py-2 bg-teal-600 hover:bg-teal-700 text-white rounded-xl text-sm font-bold transition-all shadow-sm active:scale-95"
            title="Export to Excel"
          >
            <FileDown size={18} />
            <span className="hidden sm:inline">Export</span>
          </button>

          {(filters.issue || filters.date || filters.fixedDate || filters.status || filters.search) && (
            <button
              onClick={() => setFilters({ issue: '', date: '', fixedDate: '', status: '', search: '' })}
              className="p-2 text-gray-400 hover:text-red-500 transition-colors"
              title="Clear Filters"
            >
              <RotateCcw size={18} />
            </button>
          )}
        </div>
      </div>

      <div className="max-h-[600px] overflow-auto bg-white dark:bg-gray-900 rounded-2xl shadow-sm border border-gray-100 dark:border-gray-800 relative">
        <table className="w-full text-left border-collapse min-w-[1200px]">
          <thead className="sticky top-0 z-30">
            <tr className="bg-orange-200 dark:bg-amber-950">
              <th className="p-4 font-bold text-gray-800 dark:text-amber-100 text-center sticky left-0 top-0 z-30 bg-orange-200 dark:bg-amber-950 w-[60px]">No</th>
              <th className="p-4 font-bold text-gray-800 dark:text-amber-100 sticky left-[60px] top-0 z-30 bg-orange-200 dark:bg-amber-950 w-[140px]">Date</th>
              <th className="p-4 font-bold text-gray-800 dark:text-amber-100 sticky left-[200px] top-0 z-30 bg-orange-200 dark:bg-amber-950 min-w-[150px]">Issue</th>
              <th className="p-4 font-bold text-gray-800 dark:text-amber-100 sticky left-[350px] top-0 z-30 bg-orange-200 dark:bg-amber-950 w-[140px]">Phone</th>
              <th className="p-4 font-bold text-gray-800 dark:text-amber-100 min-w-[200px] bg-orange-200 dark:bg-amber-950 sticky top-0">Note</th>
              <th className="p-4 font-bold text-gray-800 dark:text-amber-100 min-w-[140px] bg-orange-200 dark:bg-amber-950 sticky top-0">PCAID</th>
              <th className="p-4 font-bold text-gray-800 dark:text-amber-100 min-w-[160px] bg-orange-200 dark:bg-amber-950 sticky top-0">Name</th>
              <th className="p-4 font-bold text-gray-800 dark:text-amber-100 min-w-[140px] bg-orange-200 dark:bg-amber-950 sticky top-0">Admin</th>
              <th className="p-4 font-bold text-gray-800 dark:text-amber-100 min-w-[120px] bg-orange-200 dark:bg-amber-950 sticky top-0">Status</th>
              <th className="p-4 font-bold text-gray-800 dark:text-amber-100 min-w-[140px] bg-orange-200 dark:bg-amber-950 sticky top-0">Fixed Date</th>
              <th className="p-4 font-bold text-gray-800 dark:text-amber-100 text-center min-w-[120px] bg-orange-200 dark:bg-amber-950 sticky top-0">Actions</th>
            </tr>
          </thead>
          <tbody>
            {filteredTokens.length === 0 ? (
              <tr>
                <td colSpan={11} className="p-10 text-center text-gray-500 dark:text-gray-400 font-medium whitespace-nowrap bg-white dark:bg-gray-900">
                  {tokens.length === 0 ? "No tokens found" : "No results match your filters"}
                </td>
              </tr>
            ) : (
              filteredTokens.map((token, index) => (
              <tr key={token.id} className="border-t border-gray-150 dark:border-gray-800 hover:bg-orange-50/30 dark:hover:bg-amber-950/20 transition-colors group">
                <td className="p-4 text-center text-gray-500 dark:text-gray-400 sticky left-0 z-10 bg-white dark:bg-gray-900 group-hover:bg-orange-50/35 dark:group-hover:bg-amber-950/20">{index + 1}</td>
                <td className="p-4 text-xs text-gray-400 dark:text-gray-500 capitalize whitespace-nowrap sticky left-[60px] z-10 bg-white dark:bg-gray-900 group-hover:bg-orange-50/35 dark:group-hover:bg-amber-950/20">{formatDate(token.date)}</td>
                <td className="p-4 sticky left-[200px] z-10 bg-white dark:bg-gray-900 group-hover:bg-orange-50/35 dark:group-hover:bg-amber-950/20 min-w-[150px]">
                  <div className="flex items-center gap-1">
                    <span className="text-sm font-medium text-gray-900 dark:text-gray-100">{token.issue}</span>
                    <button onClick={() => toast.success(copyToClipboard(token.issue, 'Issue'))} className="p-1 text-teal-600 hover:bg-teal-50 dark:hover:bg-teal-950/40 rounded">
                      <Copy size={14} />
                    </button>
                  </div>
                </td>
                <td className="p-4 sticky left-[350px] z-10 bg-white dark:bg-gray-900 group-hover:bg-orange-50/35 dark:group-hover:bg-amber-950/20 w-[140px]">
                   <div className="flex items-center gap-1">
                    <span className="text-sm font-mono text-gray-700 dark:text-gray-300">{token.phone}</span>
                    <button onClick={() => toast.success(copyToClipboard(token.phone, 'Phone'))} className="p-1 text-teal-600 hover:bg-teal-50 dark:hover:bg-teal-950/40 rounded">
                      <Copy size={14} />
                    </button>
                  </div>
                </td>
                <td className="p-4 text-sm text-gray-600 dark:text-gray-350 min-w-[200px] max-w-[300px]" title={token.note || ''}>
                  <div className="flex items-center justify-between gap-1 overflow-hidden">
                    <span className="truncate">{token.note || '-'}</span>
                    {token.note && (
                      <button onClick={() => toast.success(copyToClipboard(token.note!, 'Note'))} className="p-1 text-teal-600 hover:bg-teal-50 dark:hover:bg-teal-950/40 rounded shrink-0">
                        <Copy size={14} />
                      </button>
                    )}
                  </div>
                </td>
                <td className="p-4 min-w-[140px]">
                  <div className="flex items-center gap-1">
                    <span className="text-sm font-mono text-gray-700 dark:text-gray-300">{token.pcaid}</span>
                    <button onClick={() => toast.success(copyToClipboard(token.pcaid, 'PCAID'))} className="p-1 text-teal-600 hover:bg-teal-50 dark:hover:bg-teal-950/40 rounded">
                      <Copy size={14} />
                    </button>
                  </div>
                </td>
                <td className="p-4 min-w-[160px]">
                  <div className="flex items-center gap-1">
                    <span className="text-sm font-medium text-gray-900 dark:text-gray-100">{token.name}</span>
                    <button onClick={() => toast.success(copyToClipboard(token.name, 'Name'))} className="p-1 text-teal-600 hover:bg-teal-50 dark:hover:bg-teal-950/40 rounded">
                      <Copy size={14} />
                    </button>
                  </div>
                </td>
                <td className="p-4 text-sm font-semibold text-teal-700 dark:text-teal-400 uppercase min-w-[140px]">{token.admin}</td>
                <td className="p-4 min-w-[120px]">
                  <select
                    value={token.status}
                    onChange={(e) => handleStatusChange(token.id, e.target.value as IssueStatus)}
                    className={cn(
                      "px-2 py-1 rounded-md text-xs font-bold uppercase focus:ring-2 focus:ring-teal-200 outline-none cursor-pointer bg-white dark:bg-gray-800 border dark:border-gray-700",
                      token.status === 'Pending' && "bg-yellow-105 text-yellow-700 dark:bg-yellow-950/40 dark:text-yellow-400",
                      token.status === 'Progress' && "bg-blue-105 text-blue-700 dark:bg-blue-950/40 dark:text-blue-400",
                      token.status === 'Done' && "bg-green-105 text-green-700 dark:bg-green-950/40 dark:text-green-400"
                    )}
                  >
                    <option value="Pending">Pending</option>
                    <option value="Progress">Progress</option>
                    <option value="Done">Done</option>
                  </select>
                </td>
                <td className="p-4 text-xs text-gray-400 dark:text-gray-500 capitalize whitespace-nowrap min-w-[140px]">{formatDate(token.fixed_date)}</td>
                <td className="p-4 text-center min-w-[120px]">
                  <div className="flex items-center justify-center gap-1">
                    <button onClick={() => handleWhatsApp(token)} className="p-2 text-teal-600 dark:text-teal-400 hover:bg-teal-50 dark:hover:bg-teal-950/40 rounded-lg transition-colors" title="WhatsApp Message">
                      <MessageSquare size={18} />
                    </button>
                    <button onClick={() => handleCopyConfirmMessage(token)} className="p-2 text-teal-700 dark:text-teal-400 hover:bg-teal-50 dark:hover:bg-teal-950/40 rounded-lg transition-colors" title="Copy Finished Message">
                      <Copy size={18} />
                    </button>
                    {deletingId === token.id ? (
                      <div className="flex gap-1 animate-in fade-in zoom-in-95 duration-200">
                        <button onClick={() => handleDelete(token.id)} className="px-2 py-1 bg-red-600 text-white text-[10px] font-bold rounded uppercase">Del</button>
                        <button onClick={() => setDeletingId(null)} className="px-2 py-1 bg-gray-200 text-gray-700 text-[10px] font-bold rounded uppercase">No</button>
                      </div>
                    ) : (
                      <button onClick={() => setDeletingId(token.id)} className="p-2 text-red-600 hover:bg-red-50 rounded-lg transition-colors" title="Delete">
                        <Trash2 size={18} />
                      </button>
                    )}
                  </div>
                </td>
              </tr>
            )))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// --- ITEM VIEW ---
export function ItemsView() {
  const { user } = useAuth();
  const [issueItems, setIssueItems] = useState<IssueType[]>([]);
  const [classItems, setClassItems] = useState<ClassItem[]>([]);
  const [packageItems, setPackageItems] = useState<PackageItem[]>([]);
  const [joinedBatchItems, setJoinedBatchItems] = useState<any[]>([]);
  
  const [newValues, setNewValues] = useState({ issue: '', class: '', package: '', joinedBatch: '' });
  const [editing, setEditing] = useState<{ type: string; id: string; text: string } | null>(null);
  const [loading, setLoading] = useState(false);

  // Temporary ID Configurator States
  const [lastTempId, setLastTempId] = useState<string>('');
  const [tempIdLoading, setTempIdLoading] = useState<boolean>(false);

  useEffect(() => {
    fetchIssueItems();
    fetchClassItems();
    fetchPackageItems();
    fetchJoinedBatchItems();
    fetchLastTemporaryId();
  }, []);

  const fetchIssueItems = async () => {
    const { data } = await supabase.from('issue_item').select('*').order('issue_type');
    if (data) setIssueItems(data as IssueType[]);
  };

  const fetchClassItems = async () => {
    const { data } = await supabase.from('class_item').select('*').order('class_type');
    if (data) setClassItems(data as ClassItem[]);
  };

  const fetchPackageItems = async () => {
    const { data } = await supabase.from('package_item').select('*').order('package_type');
    if (data) setPackageItems(data as PackageItem[]);
  };

  const fetchJoinedBatchItems = async () => {
    try {
      const { data, error } = await supabase.from('joined_batch_item').select('*').order('joined_batch', { ascending: false });
      if (!error && data) {
        setJoinedBatchItems(data);
      }
    } catch (err) {
      console.warn("joined_batch_item fetch warning (table may not exist yet):", err);
    }
  };

  const fetchLastTemporaryId = async () => {
    try {
      const { data, error } = await supabase
        .from('last_temporary_id')
        .select('temp_id')
        .eq('id', 1)
        .maybeSingle();
      if (error) throw error;
      if (data) {
        setLastTempId(data.temp_id);
      } else {
        setLastTempId('');
      }
    } catch (err) {
      console.error('Failed to fetch last temporary ID:', err);
    }
  };

  const handleUpdateLastTempId = async () => {
    if (!lastTempId.trim()) {
      toast.error('Temporary ID cannot be empty');
      return;
    }
    setTempIdLoading(true);
    try {
      const { data: existing, error: checkErr } = await supabase
        .from('last_temporary_id')
        .select('id')
        .eq('id', 1)
        .maybeSingle();

      if (checkErr) throw checkErr;

      if (existing) {
        const { error: updateErr } = await supabase
          .from('last_temporary_id')
          .update({ temp_id: lastTempId.trim() })
          .eq('id', 1);
        if (updateErr) throw updateErr;
      } else {
        const { error: insertErr } = await supabase
          .from('last_temporary_id')
          .insert({ id: 1, temp_id: lastTempId.trim() });
        if (insertErr) throw insertErr;
      }

      await logTransaction({
        admin_username: user?.username || 'system',
        action_type: 'SYSTEM',
        entity_type: 'last_temporary_id',
        entity_id: '1',
        details: `Updated last temporary ID to "${lastTempId.trim()}"`
      });

      toast.success('Last Temporary ID updated successfully');
    } catch (err: any) {
      console.error('Failed to update last temporary ID:', err);
      toast.error(err.message || 'Failed to update last temporary ID');
    } finally {
      setTempIdLoading(false);
    }
  };

  const handleAdd = async (type: 'issue' | 'class' | 'package' | 'joinedBatch') => {
    const val = newValues[type];
    if (!val) return;
    setLoading(true);
    try {
      const table = type === 'issue' ? 'issue_item' : 
                    type === 'class' ? 'class_item' : 
                    type === 'package' ? 'package_item' : 'joined_batch_item';
      const col = type === 'issue' ? 'issue_type' : 
                  type === 'class' ? 'class_type' : 
                  type === 'package' ? 'package_type' : 'joined_batch';
      const { data, error } = await supabase.from(table).insert({ [col]: val }).select().single();
      if (error) throw error;
      
      // If it's a joinedBatch, automatically initialize the 25 rows for district_codes '01'-'25' in last_pca_id table
      if (type === 'joinedBatch') {
        const lastPcaIdRows = Array.from({ length: 25 }, (_, i) => {
          const districtCode = String(i + 1).padStart(2, '0');
          return {
            joined_batch: val,
            district_code: districtCode,
            last_id: 0,
            last_scholarship_id: 899
          };
        });
        const { error: batchErr } = await supabase.from('last_pca_id').insert(lastPcaIdRows);
        if (batchErr) {
          console.error('Failed to initialize last_pca_id entries:', batchErr);
          toast.error(`Joined Batch added, but failed to initialize PCA IDs in database: ${batchErr.message}`);
        } else {
          toast.success('New Joined Batch added and PCA IDs initialized successfully!');
        }
      } else {
        toast.success(`New ${type} type added`);
      }

      setNewValues({ ...newValues, [type]: '' });
      
      // Fast sync: update local state immediately
      if (type === 'issue') {
        setIssueItems(prev => [...prev, data as IssueType].sort((a, b) => a.issue_type.localeCompare(b.issue_type)));
      } else if (type === 'class') {
        setClassItems(prev => [...prev, data as ClassItem].sort((a, b) => a.class_type.localeCompare(b.class_type)));
      } else if (type === 'package') {
        setPackageItems(prev => [...prev, data as PackageItem].sort((a, b) => a.package_type.localeCompare(b.package_type)));
      } else {
        setJoinedBatchItems(prev => [...prev, data].sort((a, b) => b.joined_batch.localeCompare(a.joined_batch)));
      }
    } catch (err: any) {
      console.error('Failed to add item:', err);
      toast.error(err.message || 'Failed to add item. Ensure table exists in Supabase.');
    } finally {
      setLoading(false);
    }
  };

  const handleUpdate = async () => {
    if (!editing) return;
    try {
      const table = editing.type === 'issue' ? 'issue_item' : 
                    editing.type === 'class' ? 'class_item' : 
                    editing.type === 'package' ? 'package_item' : 'joined_batch_item';
      const col = editing.type === 'issue' ? 'issue_type' : 
                  editing.type === 'class' ? 'class_type' : 
                  editing.type === 'package' ? 'package_type' : 'joined_batch';
      const { error } = await supabase.from(table).update({ [col]: editing.text }).eq('id', editing.id);
      if (error) throw error;
      toast.success('Updated successfully');
      
      // Fast sync
      if (editing.type === 'issue') {
        setIssueItems(prev => prev.map(i => i.id === editing.id ? { ...i, issue_type: editing.text } : i));
      } else if (editing.type === 'class') {
        setClassItems(prev => prev.map(c => c.id === editing.id ? { ...c, class_type: editing.text } : c));
      } else if (editing.type === 'package') {
        setPackageItems(prev => prev.map(p => p.id === editing.id ? { ...p, package_type: editing.text } : p));
      } else {
        setJoinedBatchItems(prev => prev.map(jb => jb.id === editing.id ? { ...jb, joined_batch: editing.text } : jb));
      }
      setEditing(null);
    } catch (err) {
      toast.error('Failed to update');
    }
  };

  const handleDelete = async (type: string, id: string) => {
    try {
      if (type === 'joinedBatch') {
        const item = joinedBatchItems.find(jb => jb.id === id);
        if (item && item.joined_batch) {
          // Delete related records from last_pca_id first
          const { error: pcaErr } = await supabase.from('last_pca_id').delete().eq('joined_batch', item.joined_batch);
          if (pcaErr) {
            console.error('Failed to delete related last_pca_id entries:', pcaErr);
          }
        }
      }

      const table = type === 'issue' ? 'issue_item' : 
                    type === 'class' ? 'class_item' : 
                    type === 'package' ? 'package_item' : 'joined_batch_item';
      const { error } = await supabase.from(table).delete().eq('id', id);
      if (error) throw error;
      toast.success('Deleted successfully');
      if (type === 'issue') setIssueItems(prev => prev.filter(i => i.id !== id));
      else if (type === 'class') setClassItems(prev => prev.filter(c => c.id !== id));
      else if (type === 'package') setPackageItems(prev => prev.filter(p => p.id !== id));
      else setJoinedBatchItems(prev => prev.filter(jb => jb.id !== id));
    } catch (err) {
      toast.error('Failed to delete');
    }
  };

  return (
    <div className="space-y-8">
      {/* Section 1: Management Items Configuration */}
      <div className="bg-white dark:bg-gray-900 border border-gray-100 dark:border-gray-800 rounded-3xl p-6 md:p-8 shadow-md space-y-6">
        <label className="text-sm font-black text-gray-400 dark:text-gray-500 uppercase tracking-widest block">
          Management Items Configuration
        </label>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
          <div className="bg-slate-50/50 dark:bg-slate-900/30 border border-slate-100 dark:border-slate-800/60 rounded-2xl p-5 shadow-sm hover:border-teal-100/80 dark:hover:border-teal-900/30 transition-all duration-300">
            <ItemList 
              title="Issue Types" 
              type="issue" 
              items={issueItems} 
              col="issue_type" 
              placeholder="New Issue..." 
              newValues={newValues}
              setNewValues={setNewValues}
              handleAdd={handleAdd}
              editing={editing}
              setEditing={setEditing}
              handleUpdate={handleUpdate}
              handleDelete={handleDelete}
              loading={loading}
            />
          </div>

          <div className="bg-slate-50/50 dark:bg-slate-900/30 border border-slate-100 dark:border-slate-800/60 rounded-2xl p-5 shadow-sm hover:border-teal-100/80 dark:hover:border-teal-900/30 transition-all duration-300">
            <ItemList 
              title="Class Types" 
              type="class" 
              items={classItems} 
              col="class_type" 
              placeholder="New Class..." 
              newValues={newValues}
              setNewValues={setNewValues}
              handleAdd={handleAdd}
              editing={editing}
              setEditing={setEditing}
              handleUpdate={handleUpdate}
              handleDelete={handleDelete}
              loading={loading}
            />
          </div>

          <div className="bg-slate-50/50 dark:bg-slate-900/30 border border-slate-100 dark:border-slate-800/60 rounded-2xl p-5 shadow-sm hover:border-teal-100/80 dark:hover:border-teal-900/30 transition-all duration-300">
            <ItemList 
              title="Package Types" 
              type="package" 
              items={packageItems} 
              col="package_type" 
              placeholder="New Package..." 
              newValues={newValues}
              setNewValues={setNewValues}
              handleAdd={handleAdd}
              editing={editing}
              setEditing={setEditing}
              handleUpdate={handleUpdate}
              handleDelete={handleDelete}
              loading={loading}
            />
          </div>

          <div className="bg-slate-50/50 dark:bg-slate-900/30 border border-slate-100 dark:border-slate-800/60 rounded-2xl p-5 shadow-sm hover:border-teal-100/80 dark:hover:border-teal-900/30 transition-all duration-300">
            <ItemList 
              title="Joined Batches" 
              type="joinedBatch" 
              items={joinedBatchItems} 
              col="joined_batch" 
              placeholder="New Batch (e.g. 2025)..." 
              newValues={newValues}
              setNewValues={setNewValues}
              handleAdd={handleAdd}
              editing={editing}
              setEditing={setEditing}
              handleUpdate={handleUpdate}
              handleDelete={handleDelete}
              loading={loading}
            />
          </div>
        </div>
      </div>

      {/* Section 2: Temporary ID Section */}
      <div className="bg-white dark:bg-gray-900 border border-gray-100 dark:border-gray-800 rounded-3xl p-6 md:p-8 shadow-md space-y-6">
        <label className="text-sm font-black text-gray-400 dark:text-gray-500 uppercase tracking-widest block">
          Call Task - Last Temporary ID Configuration
        </label>
        
        <div className="max-w-xl bg-white dark:bg-gray-800/50 border border-gray-100 dark:border-gray-800 rounded-3xl p-6 shadow-sm space-y-5">
          <div className="flex items-start gap-4">
            <div className="p-3 bg-teal-50 dark:bg-teal-950/30 text-teal-600 dark:text-teal-400 rounded-2xl">
              <Sliders size={24} />
            </div>
            <div className="space-y-1">
              <h3 className="font-bold text-gray-800 dark:text-gray-200 text-sm">Temporary ID Base</h3>
              <p className="text-xs text-gray-400 dark:text-gray-500 leading-relaxed">
                Configure the baseline sequence/ID (e.g. <span className="font-mono text-gray-500 dark:text-gray-400 font-semibold bg-gray-50 dark:bg-gray-900 px-1 py-0.5 rounded border border-gray-100 dark:border-gray-800">PCA-0500</span>) used as the starting/last reference point for generating brand new PCA IDs on call tasks.
              </p>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-[1fr_auto] gap-3 items-center pt-2">
            <div className="relative">
              <span className="absolute left-4 top-1/2 -translate-y-1/2 text-[9px] font-black text-gray-400 dark:text-gray-500 uppercase font-mono bg-gray-50 dark:bg-gray-900 px-2 py-0.5 rounded border border-gray-100 dark:border-gray-800 select-none">
                CURRENT BASE
              </span>
              <input
                value={lastTempId}
                onChange={(e) => setLastTempId(e.target.value)}
                placeholder="e.g. PCA-0001"
                className="w-full pl-32 pr-4 py-3 bg-white dark:bg-gray-900 border-2 border-gray-100 dark:border-gray-800 rounded-2xl focus:border-teal-600 focus:outline-none text-sm font-bold font-mono text-gray-800 dark:text-gray-200 transition-all"
              />
            </div>
            
            <button
              onClick={handleUpdateLastTempId}
              disabled={tempIdLoading}
              className="w-full sm:w-auto px-6 py-3 bg-teal-600 hover:bg-teal-700 disabled:opacity-50 text-white rounded-2xl font-bold text-sm transition-all shadow-md active:scale-95 flex items-center justify-center gap-2"
            >
              <Save size={18} />
              {tempIdLoading ? 'Updating...' : 'Update ID'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

function ItemList({ 
  title, 
  type, 
  items, 
  col, 
  placeholder,
  newValues,
  setNewValues,
  handleAdd,
  editing,
  setEditing,
  handleUpdate,
  handleDelete,
  loading
}: { 
  title: string; 
  type: 'issue' | 'class' | 'package' | 'joinedBatch'; 
  items: any[]; 
  col: string; 
  placeholder: string;
  newValues: any;
  setNewValues: (val: any) => void;
  handleAdd: (type: 'issue' | 'class' | 'package' | 'joinedBatch') => void;
  editing: any;
  setEditing: (val: any) => void;
  handleUpdate: () => void;
  handleDelete: (type: string, id: string) => void;
  loading: boolean;
}) {
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);

  return (
    <div className="space-y-4 flex flex-col h-full">
      <div className="flex flex-col gap-2">
        <label className="text-sm font-black text-gray-400 uppercase tracking-widest">{title}</label>
        <div className="relative group">
          <input
            value={newValues[type]}
            onChange={(e) => setNewValues({ ...newValues, [type]: e.target.value })}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                e.preventDefault();
                handleAdd(type);
              }
            }}
            className="w-full pl-4 pr-12 py-2 bg-white dark:bg-gray-800 border-2 border-gray-100 dark:border-gray-700/80 rounded-xl focus:border-teal-600 outline-none transition-all placeholder:text-gray-300 dark:placeholder:text-gray-500 text-sm font-medium text-gray-800 dark:text-gray-200"
            placeholder={placeholder}
          />
          <button 
            onClick={() => handleAdd(type)} 
            disabled={loading}
            className="absolute right-1 top-1 bottom-1 w-10 flex items-center justify-center bg-teal-600 text-white rounded-lg hover:bg-teal-700 disabled:opacity-50 transition-all active:scale-90"
          >
            <Plus size={20}/>
          </button>
        </div>
      </div>
      
      <div className="flex-1 overflow-auto max-h-[400px] pr-2 scrollbar-thin scrollbar-thumb-gray-200">
        <div className="space-y-2">
          {items.map(item => (
            <div key={item.id} className="group p-3 bg-white dark:bg-gray-800/80 border border-gray-100 dark:border-gray-800/60 rounded-xl hover:border-teal-200 dark:hover:border-teal-900/40 hover:shadow-sm transition-all flex items-center justify-between">
              {confirmDeleteId === item.id ? (
                <div className="flex-1 flex flex-col sm:flex-row sm:items-center justify-between gap-3 animate-in fade-in zoom-in-95 duration-150">
                  <div className="flex flex-col">
                    <span className="text-xs font-semibold text-red-600 leading-snug">
                      {type === 'joinedBatch' 
                        ? `Are you okay to delete all the PCA ID from the system for batch "${item[col]}"?`
                        : `Delete "${item[col]}"?`}
                    </span>
                    {type === 'joinedBatch' && (
                      <span className="text-[10px] text-red-400 font-medium select-none">This action is permanent and cannot be undone.</span>
                    )}
                  </div>
                  <div className="flex gap-1.5 justify-end">
                    <button 
                      onClick={() => {
                        handleDelete(type, item.id);
                        setConfirmDeleteId(null);
                      }} 
                      className="px-2.5 py-1 text-xs font-semibold bg-red-600 text-white hover:bg-red-700 rounded-lg shadow-sm transition-all whitespace-nowrap"
                    >
                      Delete
                    </button>
                    <button 
                      onClick={() => setConfirmDeleteId(null)} 
                      className="px-2.5 py-1 text-xs font-semibold bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-lg transition-all whitespace-nowrap"
                    >
                      Cancel
                    </button>
                  </div>
                </div>
              ) : editing?.type === type && editing?.id === item.id ? (
                <div className="flex-1 flex gap-2 items-center">
                  <input 
                    value={editing.text}
                    onChange={(e) => setEditing({ ...editing, text: e.target.value })}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        e.preventDefault();
                        handleUpdate();
                      } else if (e.key === 'Escape') {
                        setEditing(null);
                      }
                    }}
                    className="flex-1 px-2 py-1 border-b-2 border-teal-600 bg-transparent outline-none text-sm font-medium text-gray-800 dark:text-gray-100"
                    autoFocus
                  />
                  <button onClick={handleUpdate} className="text-green-600 hover:text-green-700 p-1 rounded hover:bg-green-50 transition-colors" title="Save (Enter)">
                    <CheckCircle2 size={18}/>
                  </button>
                  <button onClick={() => setEditing(null)} className="text-red-400 hover:text-red-500 p-1 rounded hover:bg-red-50 transition-colors" title="Cancel (Esc)">
                    <X size={18}/></button>
                </div>
              ) : (
                <>
                  <span className="text-sm font-semibold text-gray-700 dark:text-gray-200 truncate mr-2">{item[col]}</span>
                  <div className="flex gap-1">
                    {type !== 'joinedBatch' && (
                      <button 
                        onClick={() => {
                          setConfirmDeleteId(null);
                          setEditing({ type, id: item.id, text: item[col] });
                        }} 
                        className="p-1.5 text-gray-400 hover:text-teal-600 hover:bg-teal-50 rounded-lg transition-colors"
                        title="Edit"
                      >
                        <Edit size={16}/>
                      </button>
                    )}
                    <button 
                      onClick={() => {
                        setEditing(null);
                        setConfirmDeleteId(item.id);
                      }} 
                      className="p-1.5 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors"
                      title="Delete"
                    >
                      <Trash2 size={16}/>
                    </button>
                  </div>
                </>
              )}
            </div>
          ))}
          {items.length === 0 && (
            <div className="py-12 border-2 border-dashed border-gray-50 rounded-2xl flex flex-col items-center justify-center text-gray-300">
              <Plus size={32} className="mb-2 opacity-20"/>
              <p className="text-xs font-bold uppercase tracking-widest">No Items</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// --- SIGNUP VIEW ---
export function SignupView() {
  const [formData, setFormData] = useState({
    username: '',
    email: '',
    password: '',
    admin_type: 'admin' as AdminType
  });
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.username.trim() || !formData.email.trim() || !formData.password) {
      toast.error('All fields are required');
      return;
    }

    if (!formData.email.includes('@')) {
      toast.error('Please enter a valid email address');
      return;
    }

    setLoading(true);
    try {
      const email = formData.email.trim();

      const { data, error: signUpError } = await supabase.auth.signUp({
        email,
        password: formData.password,
        options: {
          data: {
            username: formData.username.trim(),
            admin_type: formData.admin_type
          }
        }
      });

      if (signUpError) {
        throw signUpError;
      }

      if (!data?.user) {
        throw new Error('Account creation failed');
      }

      // Check if trigger automatically created the profile row, otherwise insert manually
      await new Promise(resolve => setTimeout(resolve, 500));
      const { data: profile } = await supabase
        .from('user')
        .select('id')
        .eq('id', data.user.id)
        .maybeSingle();

      if (!profile) {
        const { error: insertError } = await supabase.from('user').insert({
          id: data.user.id,
          username: formData.username.trim(),
          admin_type: formData.admin_type,
          joined_date: new Date().toISOString()
        });
        if (insertError) throw insertError;
      }

      toast.success('Account created successfully!');
      setFormData({ username: '', email: '', password: '', admin_type: 'admin' });
    } catch (err: any) {
      toast.error(err.message || 'Failed to create account');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="max-w-xl mx-auto">
      <form onSubmit={handleSubmit} className="space-y-5 bg-white p-6 md:p-8 rounded-2xl shadow-sm border border-gray-100 p-6 dark:bg-gray-900 dark:border-gray-800">
        <div className="space-y-4">
          <div className="flex flex-col gap-1.5">
            <label className="text-sm font-semibold text-gray-700 dark:text-gray-300">Username</label>
            <input
              value={formData.username}
              onChange={(e) => setFormData({ ...formData, username: e.target.value })}
              className="w-full px-4 py-2 bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg focus:outline-none focus:ring-2 focus:ring-teal-500/20 text-gray-800 dark:text-gray-100 font-medium"
              placeholder="Enter username"
            />
          </div>

          <div className="flex flex-col gap-1.5">
            <label className="text-sm font-semibold text-gray-700 dark:text-gray-300">Email Address</label>
            <input
              type="email"
              value={formData.email}
              onChange={(e) => setFormData({ ...formData, email: e.target.value })}
              className="w-full px-4 py-2 bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg focus:outline-none focus:ring-2 focus:ring-teal-500/20 text-gray-800 dark:text-gray-100 font-medium"
              placeholder="e.g. admin@pca.academy"
            />
          </div>

          <div className="flex flex-col gap-1.5">
            <label className="text-sm font-semibold text-gray-700 dark:text-gray-300">Password</label>
            <div className="relative">
              <input
                type={showPassword ? "text" : "password"}
                value={formData.password}
                onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                className="w-full px-4 py-2 bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg focus:outline-none focus:ring-2 focus:ring-teal-500/20 text-gray-800 dark:text-gray-100 font-medium pr-10"
                placeholder="Enter password"
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute inset-y-0 right-0 pr-3 flex items-center text-teal-600 hover:text-teal-700"
              >
                {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
              </button>
            </div>
          </div>

          <div className="flex flex-col gap-1.5">
            <label className="text-sm font-semibold text-gray-700 dark:text-gray-300">Admin Type</label>
            <select
              value={formData.admin_type}
              onChange={(e) => setFormData({ ...formData, admin_type: e.target.value as AdminType })}
              className="w-full px-4 py-2 bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg focus:outline-none focus:ring-2 focus:ring-teal-500/20 text-gray-800 dark:text-gray-100 font-medium appearance-none bg-[url('data:image/svg+xml;charset=US-ASCII,%3Csvg%20xmlns%3D%22http%3A%2F%2Fwww.w3.org%2F2000%2Fsvg%22%20width%3D%2214%22%20height%3D%2214%22%20viewBox%3D%220%200%2024%2024%22%20fill%3D%22none%22%20stroke%3D%22currentColor%22%20stroke-width%3D%222%22%20stroke-linecap%3D%22round%22%20stroke-linejoin%3D%22round%22%3E%3Cpath%20d%3D%22M6%209l6%206%206-6%22%2F%3E%3C%2Fsvg%3E')] bg-[length:14px_14px] bg-[right_1rem_center] bg-no-repeat"
            >
              <option value="admin">Admin</option>
              <option value="super_admin">Super Admin</option>
            </select>
          </div>
        </div>

        <button
          type="submit"
          disabled={loading}
          className="w-full py-2.5 bg-teal-600 hover:bg-teal-700 disabled:opacity-50 text-white rounded-lg font-bold text-sm transition-all shadow-md active:scale-95 flex items-center justify-center gap-2"
        >
          {loading ? 'Creating...' : 'Signup'}
        </button>
      </form>
    </div>
  );
}

// --- ADMINS LIST VIEW ---
export function AdminsView() {
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [editingUser, setEditingUser] = useState<User | null>(null);
  const [showEditPassword, setShowEditPassword] = useState(false);

  useEffect(() => {
    fetchUsers();
  }, []);

  const fetchUsers = async () => {
    const { data } = await supabase.from('user').select('*').order('joined_date', { ascending: false });
    if (data) setUsers(data as User[]);
    setLoading(false);
  };

  const handleDeleteUser = async (userId: string) => {
    try {
      const { error } = await supabase.from('user').delete().eq('id', userId);
      if (error) throw error;
      toast.success('Admin account deleted');
      setUsers(prev => prev.filter(u => u.id !== userId));
      setDeletingId(null);
    } catch (err: any) {
      toast.error('Failed to delete account');
    }
  };

  const handleUpdateUser = async () => {
    if (!editingUser) return;
    try {
      const { error } = await supabase
        .from('user')
        .update({
          username: editingUser.username,
          admin_type: editingUser.admin_type
        })
        .eq('id', editingUser.id);
      
      if (error) throw error;
      toast.success('Admin profile updated');
      setUsers(prev => prev.map(u => u.id === editingUser.id ? editingUser : u));
      setEditingUser(null);
    } catch (err: any) {
      toast.error('Failed to update admin');
    }
  };

  if (loading) return (
    <div className="flex items-center justify-center py-20">
      <div className="h-8 w-8 animate-spin rounded-full border-4 border-teal-600 border-t-transparent"></div>
    </div>
  );

  return (
    <div className="space-y-6">
      <div className="overflow-x-auto bg-white dark:bg-gray-900 rounded-2xl shadow-sm border border-gray-100 dark:border-gray-800">
        <table className="w-full text-left border-collapse">
          <thead>
            <tr className="bg-orange-200 dark:bg-amber-950">
              <th className="p-4 font-bold text-gray-800 dark:text-amber-100 text-center">No</th>
              <th className="p-4 font-bold text-gray-800 dark:text-amber-100 animate-fade-in">Username</th>
              <th className="p-4 font-bold text-gray-800 dark:text-amber-100">Role</th>
              <th className="p-4 font-bold text-gray-800 dark:text-amber-100">Joined Date</th>
              <th className="p-4 font-bold text-gray-800 dark:text-amber-100 text-center">Actions</th>
            </tr>
          </thead>
          <tbody>
            {users.map((userItem, index) => (
              <tr key={userItem.id} className="border-t border-gray-100 dark:border-gray-800 hover:bg-orange-50/30 dark:hover:bg-amber-950/20 transition-colors group">
                <td className="p-4 text-center text-gray-500 dark:text-gray-400">{index + 1}</td>
                <td className="p-4">
                  <div className="flex items-center gap-2">
                    <span className="font-bold text-gray-900 dark:text-gray-100">{userItem.username}</span>
                    {userItem.admin_type === 'super_admin' && (
                      <ShieldCheck size={16} className="text-teal-600 dark:text-teal-400" />
                    )}
                  </div>
                </td>
                <td className="p-4">
                  <span className={cn(
                    "px-2 py-0.5 rounded text-[10px] font-bold uppercase",
                    userItem.admin_type === 'super_admin' 
                      ? "bg-teal-100 dark:bg-teal-950/50 text-teal-700 dark:text-teal-400" 
                      : "bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-300"
                  )}>
                    {userItem.admin_type.replace('_', ' ')}
                  </span>
                </td>
                <td className="p-4 text-xs text-gray-500 dark:text-gray-400 whitespace-nowrap">{formatDate(userItem.joined_date)}</td>
                <td className="p-4 text-center">
                  <div className="flex items-center justify-center gap-1">
                    <button 
                      onClick={() => {
                        setEditingUser(userItem);
                        setShowEditPassword(false);
                      }}
                      className="p-2 text-teal-600 hover:bg-teal-50 rounded-lg transition-colors"
                      title="Edit Admin"
                    >
                      <Edit size={18} />
                    </button>
                    {deletingId === userItem.id ? (
                      <div className="flex gap-1 animate-in fade-in zoom-in-95 duration-200">
                        <button onClick={() => handleDeleteUser(userItem.id)} className="px-2 py-1 bg-red-600 text-white text-[10px] font-bold rounded uppercase">Del</button>
                        <button onClick={() => setDeletingId(null)} className="px-2 py-1 bg-gray-200 text-gray-700 text-[10px] font-bold rounded uppercase">No</button>
                      </div>
                    ) : (
                      <button 
                        onClick={() => setDeletingId(userItem.id)} 
                        className="p-2 text-red-600 hover:bg-red-50 rounded-lg transition-colors" 
                        title="Delete Admin"
                        disabled={users.length <= 1 && userItem.admin_type === 'super_admin'}
                      >
                        <Trash2 size={18} />
                      </button>
                    )}
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Admin Edit Modal */}
      <AnimatePresence>
        {editingUser && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setEditingUser(null)}
              className="absolute inset-0 bg-black/40 backdrop-blur-sm"
            />
            <motion.div
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              className="relative w-full max-w-lg bg-white rounded-3xl shadow-2xl p-8"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="flex justify-between items-center mb-6">
                <h3 className="text-2xl font-bold text-gray-900 border-l-4 border-teal-600 pl-4">Edit Admin</h3>
                <button onClick={() => setEditingUser(null)} className="p-2 hover:bg-gray-100 rounded-full">
                  <X size={24} />
                </button>
              </div>

              <div className="space-y-6">
                <div className="space-y-2">
                  <label className="text-sm font-bold text-gray-700">Username</label>
                  <input
                    type="text"
                    value={editingUser.username}
                    onChange={(e) => setEditingUser({ ...editingUser, username: e.target.value })}
                    className="w-full px-4 py-3 bg-gray-50 border-2 border-gray-100 rounded-2xl focus:border-teal-600 outline-none transition-all"
                  />
                </div>

                <div className="space-y-2">
                  <label className="text-sm font-bold text-gray-700">Admin Role</label>
                  <select
                    value={editingUser.admin_type}
                    onChange={(e) => setEditingUser({ ...editingUser, admin_type: e.target.value as AdminType })}
                    className="w-full px-4 py-3 bg-gray-50 border-2 border-gray-100 rounded-2xl focus:border-teal-600 outline-none transition-all appearance-none"
                  >
                    <option value="admin">Admin</option>
                    <option value="super_admin">Super Admin</option>
                  </select>
                </div>

                <div className="flex gap-4 pt-4">
                  <button
                    onClick={() => setEditingUser(null)}
                    className="flex-1 py-4 bg-gray-100 hover:bg-gray-200 text-gray-700 font-bold rounded-full transition-all"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={handleUpdateUser}
                    className="flex-1 py-4 bg-teal-600 hover:bg-teal-700 text-white font-bold rounded-full transition-all shadow-lg shadow-teal-600/20"
                  >
                    Save Changes
                  </button>
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}

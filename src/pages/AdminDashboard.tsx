import React, { useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../hooks/useAuth';
import { logTransaction } from '../lib/transactions';
import { toast } from 'sonner';
import { Copy, Edit2, History, RotateCcw, Send, Trash2, X as CloseIcon, Filter, Search, Calendar, FileDown } from 'lucide-react';
import { Issue, IssueType } from '../types';
import { cn, copyToClipboard, formatDate, exportToExcel } from '../lib/utils';
import { motion, AnimatePresence } from 'motion/react';

export function IssueTokenForm() {
  const { user } = useAuth();
  const [issueTypes, setIssueTypes] = useState<IssueType[]>([]);
  const [formData, setFormData] = useState({
    name: '',
    phone: '',
    pcaid: '',
    issue: '',
    note: ''
  });
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    fetchIssueTypes();
  }, []);

  const fetchIssueTypes = async () => {
    const { data } = await supabase.from('issue_item').select('*');
    if (data) setIssueTypes(data);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.name || !formData.phone || !formData.pcaid || !formData.issue) {
      toast.error('All fields are required');
      return;
    }

    setLoading(true);
    try {
      const { error } = await supabase.from('issue').insert({
        ...formData,
        admin: user?.username,
        status: 'Pending',
        date: new Date().toISOString()
      });

      if (error) throw error;

      // Log issue token generation
      await logTransaction({
        admin_username: user?.username || 'system',
        action_type: 'CREATE',
        entity_type: 'issue',
        entity_id: formData.pcaid || formData.phone,
        details: `Generated new issue token for student ${formData.name} (${formData.pcaid}). Issue type: "${formData.issue}"`
      });

      toast.success('Token issued successfully!');
      setFormData({ name: '', phone: '', pcaid: '', issue: '', note: '' });
    } catch (err) {
      toast.error('Failed to issue token');
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const handleClear = () => {
    setFormData({ name: '', phone: '', pcaid: '', issue: '', note: '' });
    toast.info('Form cleared');
  };

  return (
    <div className="max-w-xl mx-auto">
      <form onSubmit={handleSubmit} className="space-y-4 bg-white p-6 md:p-8 rounded-2xl shadow-sm border border-gray-100">
        <div className="flex flex-col gap-4">
          <div className="flex flex-col md:grid md:grid-cols-[100px_1fr] md:items-center gap-2 md:gap-4">
            <label className="text-sm font-semibold text-gray-700 capitalize">Issue</label>
            <select
              value={formData.issue}
              onChange={(e) => setFormData({ ...formData, issue: e.target.value })}
              className="w-full px-4 py-2.5 bg-gray-50 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-teal-500/20 text-gray-800 font-medium appearance-none bg-[url('data:image/svg+xml;charset=US-ASCII,%3Csvg%20xmlns%3D%22http%3A%2F%2Fwww.w3.org%2F2000%2Fsvg%22%20width%3D%2214%22%20height%3D%2214%22%20viewBox%3D%220%200%2024%2024%22%20fill%3D%22none%22%20stroke%3D%22currentColor%22%20stroke-width%3D%222%22%20stroke-linecap%3D%22round%22%20stroke-linejoin%3D%22round%22%3E%3Cpath%20d%3D%22M6%209l6%206%206-6%22%2F%3E%3C%2Fsvg%3E')] bg-[length:14px_14px] bg-[right_1rem_center] bg-no-repeat text-sm text-gray-800"
            >
              <option value="">Select issue</option>
              {issueTypes.map(it => (
                <option key={it.id} value={it.issue_type}>{it.issue_type}</option>
              ))}
            </select>
          </div>

          <div className="flex flex-col md:grid md:grid-cols-[100px_1fr] md:items-center gap-2 md:gap-4">
            <label className="text-sm font-semibold text-gray-700 capitalize">Phone</label>
            <input
              type="text"
              value={formData.phone}
              onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
              className="w-full px-4 py-2.5 bg-gray-50 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-teal-500/20 text-gray-800 font-medium text-sm"
              placeholder="Enter phone"
            />
          </div>

          <div className="flex flex-col md:grid md:grid-cols-[100px_1fr] md:items-center gap-2 md:gap-4">
            <label className="text-sm font-semibold text-gray-700 uppercase">PCAID</label>
            <input
              type="text"
              value={formData.pcaid}
              onChange={(e) => setFormData({ ...formData, pcaid: e.target.value })}
              className="w-full px-4 py-2.5 bg-gray-50 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-teal-500/20 text-gray-800 font-medium text-sm text-transform uppercase"
              placeholder="Enter PCA ID"
            />
          </div>

          <div className="flex flex-col md:grid md:grid-cols-[100px_1fr] md:items-center gap-2 md:gap-4">
            <label className="text-sm font-semibold text-gray-700 capitalize">Name</label>
            <input
              type="text"
              value={formData.name}
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              className="w-full px-4 py-2.5 bg-gray-50 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-teal-500/20 text-gray-800 font-medium text-sm"
              placeholder="Enter name"
            />
          </div>

          <div className="flex flex-col md:grid md:grid-cols-[100px_1fr] md:items-center gap-2 md:gap-4">
            <label className="text-sm font-semibold text-gray-700 capitalize">Note</label>
            <input
              type="text"
              value={formData.note}
              onChange={(e) => setFormData({ ...formData, note: e.target.value })}
              className="w-full px-4 py-2.5 bg-gray-50 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-teal-500/20 text-gray-800 font-medium text-sm"
              placeholder="Enter internal note (optional)"
            />
          </div>
        </div>

        <div className="flex gap-4 pt-4">
          <button
            type="button"
            onClick={handleClear}
            className="flex-1 py-2.5 px-4 bg-gray-100 hover:bg-gray-200 text-gray-700 hover:text-gray-900 rounded-lg font-bold text-sm transition-all flex items-center justify-center gap-2 border border-gray-200/50"
          >
            Clear
          </button>
          <button
            type="submit"
            disabled={loading}
            className="flex-1 py-2.5 px-4 bg-teal-600 hover:bg-teal-700 text-white rounded-lg font-bold text-sm transition-all flex items-center justify-center gap-2 disabled:opacity-50 shadow-md active:scale-95"
          >
            {loading ? <div className="h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent" /> : 'Issue Token'}
          </button>
        </div>
      </form>
    </div>
  );
}

export function DisplayTokens() {
  const { user } = useAuth();
  const [tokens, setTokens] = useState<Issue[]>([]);
  const [issueTypes, setIssueTypes] = useState<IssueType[]>([]);
  const [loading, setLoading] = useState(true);
  const [editingToken, setEditingToken] = useState<Issue | null>(null);
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
      .channel('public:issue')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'issue' }, () => {
        fetchTokens();
      })
      .subscribe();

    return () => {
      supabase.removeChannel(subscription);
    };
  }, []);

  const fetchIssueTypes = async () => {
    const { data } = await supabase.from('issue_item').select('*');
    if (data) setIssueTypes(data);
  };

  const fetchTokens = async () => {
    if (!user) return;
    let query = supabase.from('issue').select('*');
    
    if (user.admin_type !== 'super_admin') {
      query = query.eq('admin', user.username);
    }

    const { data } = await query.order('date', { ascending: false });
    
    if (data) setTokens(data as Issue[]);
    setLoading(false);
  };

  const handleCopy = (text: string, label: string) => {
    toast.success(copyToClipboard(text, label));
  };

  const handleDelete = async (id: string) => {
    try {
      const { error } = await supabase.from('issue').delete().eq('id', id);
      if (error) throw error;

      // Log issue token deletion
      await logTransaction({
        admin_username: user?.username || 'system',
        action_type: 'DELETE',
        entity_type: 'issue',
        entity_id: id,
        details: `Deleted issue token ID: ${id}`
      });

      toast.success('Token deleted successfully');
      setTokens(prev => prev.filter(t => t.id !== id));
      setDeletingId(null);
    } catch (error: any) {
      toast.error('Error deleting token');
    }
  };

  const filteredTokens = tokens.filter(token => {
    const issueMatch = !filters.issue || token.issue === filters.issue;
    const statusMatch = !filters.status || token.status === filters.status;
    const dateMatch = !filters.date || (token.date && token.date.startsWith(filters.date));
    const fixedDateMatch = !filters.fixedDate || (token.fixed_date && token.fixed_date.startsWith(filters.fixedDate));
    
    const searchLower = filters.search.toLowerCase();
    const searchMatch = !filters.search || 
      token.name.toLowerCase().includes(searchLower) || 
      token.phone.includes(filters.search) || 
      token.pcaid.toLowerCase().includes(searchLower);

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
      'Fixed Date': formatDate(t.fixed_date),
      'Status': t.status
    }));

    exportToExcel(exportData, `Tokens_Export_${new Date().toISOString().split('T')[0]}`);
    toast.success('Excel file downloaded');
  };

  if (loading) return <div className="animate-pulse space-y-4">{[...Array(5)].map((_, i) => <div key={i} className="h-16 bg-gray-200 rounded-xl" />)}</div>;

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
              <th className="p-4 font-bold text-gray-800 dark:text-amber-100 min-w-[140px] bg-orange-200 dark:bg-amber-950 sticky top-0">Fixed Date</th>
              <th className="p-4 font-bold text-gray-800 dark:text-amber-100 min-w-[120px] bg-orange-200 dark:bg-amber-950 sticky top-0">Status</th>
              <th className="p-4 font-bold text-gray-800 dark:text-amber-100 text-center min-w-[100px] bg-orange-200 dark:bg-amber-950 sticky top-0">Actions</th>
            </tr>
          </thead>
          <tbody>
            {filteredTokens.length === 0 ? (
              <tr>
                <td colSpan={10} className="p-10 text-center text-gray-500 dark:text-gray-400 font-medium whitespace-nowrap bg-white dark:bg-gray-900">
                  {tokens.length === 0 ? "No tokens found" : "No results match your filters"}
                </td>
              </tr>
            ) : (
              filteredTokens.map((token, index) => (
                <tr key={token.id} className="border-t border-gray-100 dark:border-gray-800 hover:bg-orange-50/50 dark:hover:bg-amber-950/20 transition-colors group">
                  <td className="p-4 text-center font-medium text-gray-600 dark:text-gray-400 sticky left-0 z-10 bg-white dark:bg-gray-900 group-hover:bg-orange-50/50 dark:group-hover:bg-amber-950/20">{index + 1}</td>
                  <td className="p-4 text-sm text-gray-500 dark:text-gray-400 sticky left-[60px] z-10 bg-white dark:bg-gray-900 group-hover:bg-orange-50/50 dark:group-hover:bg-amber-950/20 whitespace-nowrap">{formatDate(token.date)}</td>
                  <td className="p-4 sticky left-[200px] z-10 bg-white dark:bg-gray-900 group-hover:bg-orange-50/50 dark:group-hover:bg-amber-950/20 min-w-[150px]">
                    <div className="flex items-center gap-2">
                      <span className="text-gray-900 dark:text-gray-100 font-medium">{token.issue}</span>
                      <button onClick={() => handleCopy(token.issue, 'Issue')} className="p-1 text-teal-600 hover:bg-teal-50 dark:hover:bg-teal-950/35 rounded">
                        <Copy size={16} />
                      </button>
                    </div>
                  </td>
                  <td className="p-4 font-mono text-sm sticky left-[350px] z-10 bg-white dark:bg-gray-900 group-hover:bg-orange-50/50 dark:group-hover:bg-amber-950/20 w-[140px]">
                    <div className="flex items-center gap-2">
                      <span className="text-gray-700 dark:text-gray-300">{token.phone}</span>
                      <button onClick={() => handleCopy(token.phone, 'Phone')} className="p-1 text-teal-600 hover:bg-teal-50 dark:hover:bg-teal-950/35 rounded">
                        <Copy size={16} />
                      </button>
                    </div>
                  </td>
                  <td className="p-4 text-sm text-gray-600 dark:text-gray-350 min-w-[200px] max-w-[300px]" title={token.note || ''}>
                    <div className="flex items-center justify-between gap-2 overflow-hidden">
                      <span className="truncate">{token.note || '-'}</span>
                      {token.note && (
                        <button onClick={() => handleCopy(token.note!, 'Note')} className="p-1 text-teal-600 hover:bg-teal-50 dark:hover:bg-teal-950/35 rounded shrink-0">
                          <Copy size={16} />
                        </button>
                      )}
                    </div>
                  </td>
                  <td className="p-4 font-mono text-sm min-w-[140px]">
                    <div className="flex items-center gap-2">
                      <span className="text-gray-700 dark:text-gray-300">{token.pcaid}</span>
                      <button onClick={() => handleCopy(token.pcaid, 'PCAID')} className="p-1 text-teal-600 hover:bg-teal-50 dark:hover:bg-teal-950/35 rounded">
                        <Copy size={16} />
                      </button>
                    </div>
                  </td>
                  <td className="p-4 text-gray-800 dark:text-gray-200 min-w-[160px]">
                    <div className="flex items-center gap-2">
                      <span className="font-medium text-gray-900 dark:text-gray-100">{token.name}</span>
                      <button onClick={() => handleCopy(token.name, 'Name')} className="p-1 text-teal-600 hover:bg-teal-50 dark:hover:bg-teal-950/35 rounded">
                        <Copy size={16} />
                      </button>
                    </div>
                  </td>
                  <td className="p-4 text-sm text-gray-500 dark:text-gray-400 min-w-[140px] whitespace-nowrap">{formatDate(token.fixed_date)}</td>
                  <td className="p-4 min-w-[120px]">
                    <span className={cn(
                      "px-3 py-1 rounded-full text-xs font-bold uppercase",
                      token.status === 'Pending' && "bg-yellow-100 text-yellow-700 dark:bg-yellow-950/40 dark:text-yellow-400",
                      token.status === 'Progress' && "bg-blue-100 text-blue-700 dark:bg-blue-950/40 dark:text-blue-400",
                      token.status === 'Done' && "bg-green-100 text-green-700 dark:bg-green-950/40 dark:text-green-400"
                    )}>
                      {token.status}
                    </span>
                  </td>
                  <td className="p-4 text-center">
                    <div className="flex items-center justify-center gap-1">
                      <button 
                        onClick={() => setEditingToken(token)}
                        className="p-2 text-gray-400 dark:text-gray-500 hover:text-teal-600 dark:hover:text-teal-400 transition-colors"
                        title="Edit Token"
                      >
                        <Edit2 size={18} />
                      </button>
                      
                      {deletingId === token.id ? (
                        <div className="flex gap-1 animate-in fade-in zoom-in-95 duration-200">
                          <button 
                            onClick={() => handleDelete(token.id)} 
                            className="px-2 py-1 bg-red-600 text-white text-[10px] font-bold rounded uppercase"
                          >
                            Del
                          </button>
                          <button 
                            onClick={() => setDeletingId(null)} 
                            className="px-2 py-1 bg-gray-200 text-gray-700 text-[10px] font-bold rounded uppercase"
                          >
                            No
                          </button>
                        </div>
                      ) : (
                        <button 
                          onClick={() => setDeletingId(token.id)} 
                          className="p-2 text-gray-400 hover:text-red-600 transition-colors"
                          title="Delete Token"
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

      {/* Edit Modal */}
      <AnimatePresence>
        {editingToken && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setEditingToken(null)}
              className="absolute inset-0 bg-black/40 backdrop-blur-sm"
            />
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="relative w-full max-w-lg bg-white rounded-3xl shadow-2xl p-8"
            >
              <h3 className="text-2xl font-bold mb-6">Edit Token</h3>
              <div className="space-y-4">
                <div className="space-y-1">
                  <label className="text-sm font-bold text-gray-700">Issue</label>
                  <select
                    value={editingToken.issue}
                    onChange={(e) => setEditingToken({ ...editingToken, issue: e.target.value })}
                    className="w-full px-4 py-2 border-2 border-gray-200 rounded-xl focus:border-teal-600 outline-none bg-white appearance-none bg-[url('data:image/svg+xml;charset=US-ASCII,%3Csvg%20xmlns%3D%22http%3A%2F%2Fwww.w3.org%2F2000%2Fsvg%22%20width%3D%2214%22%20height%3D%2214%22%20viewBox%3D%220%200%2024%2024%22%20fill%3D%22none%22%20stroke%3D%22currentColor%22%20stroke-width%3D%222%22%20stroke-linecap%3D%22round%22%20stroke-linejoin%3D%22round%22%3E%3Cpath%20d%3D%22M6%209l6%206%206-6%22%2F%3E%3C%2Fsvg%3E')] bg-[length:14px_14px] bg-[right_1rem_center] bg-no-repeat"
                  >
                    <option value="">Select issue</option>
                    {issueTypes.map(it => (
                      <option key={it.id} value={it.issue_type}>{it.issue_type}</option>
                    ))}
                  </select>
                </div>
                <div className="space-y-1">
                  <label className="text-sm font-bold text-gray-700">Name</label>
                  <input
                    type="text"
                    value={editingToken.name}
                    onChange={(e) => setEditingToken({ ...editingToken, name: e.target.value })}
                    className="w-full px-4 py-2 border-2 border-gray-200 rounded-xl focus:border-teal-600 outline-none"
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-sm font-bold text-gray-700">Phone</label>
                  <input
                    type="text"
                    value={editingToken.phone}
                    onChange={(e) => setEditingToken({ ...editingToken, phone: e.target.value })}
                    className="w-full px-4 py-2 border-2 border-gray-200 rounded-xl focus:border-teal-600 outline-none"
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-sm font-bold text-gray-700">PCA ID</label>
                  <input
                    type="text"
                    value={editingToken.pcaid}
                    onChange={(e) => setEditingToken({ ...editingToken, pcaid: e.target.value })}
                    className="w-full px-4 py-2 border-2 border-gray-200 rounded-xl focus:border-teal-600 outline-none"
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-sm font-bold text-gray-700">Note</label>
                  <input
                    type="text"
                    value={editingToken.note || ''}
                    onChange={(e) => setEditingToken({ ...editingToken, note: e.target.value })}
                    className="w-full px-4 py-2 border-2 border-gray-200 rounded-xl focus:border-teal-600 outline-none"
                  />
                </div>
              </div>
              <div className="flex gap-4 mt-8">
                <button
                  onClick={() => setEditingToken(null)}
                  className="flex-1 py-3 px-4 bg-gray-100 hover:bg-gray-200 text-gray-700 font-bold rounded-full transition-all"
                >
                  Cancel
                </button>
                <button
                  onClick={async () => {
                    if (!editingToken) return;
                    const { error } = await supabase
                      .from('issue')
                      .update({
                        name: editingToken.name,
                        phone: editingToken.phone,
                        pcaid: editingToken.pcaid,
                        issue: editingToken.issue,
                        note: editingToken.note
                      })
                      .eq('id', editingToken.id);
                    
                    if (error) {
                      toast.error('Update failed');
                    } else {
                      toast.success('Token updated');
                      setTokens(prev => prev.map(t => t.id === editingToken.id ? editingToken : t));
                      setEditingToken(null);
                    }
                  }}
                  className="flex-1 py-3 px-4 bg-teal-600 hover:bg-teal-700 text-white font-bold rounded-full transition-all"
                >
                  Save Changes
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}

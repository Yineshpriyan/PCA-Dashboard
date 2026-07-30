import React, { useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../hooks/useAuth';
import { toast } from 'sonner';
import { 
  Search, 
  Filter, 
  RotateCcw, 
  FileDown, 
  Calendar, 
  X, 
  ShieldAlert,
  Clock, 
  CheckCircle2, 
  AlertCircle,
  Database,
  ArrowRightLeft
} from 'lucide-react';
import { TransactionLog } from '../types';
import { cn, formatDate, exportToExcel } from '../lib/utils';
import { motion } from 'motion/react';
import { AuditNavTabs } from '../components/NavTabs';

const ACTION_COLORS: Record<string, string> = {
  'CREATE': 'bg-emerald-50 text-emerald-700 border-emerald-100',
  'UPDATE': 'bg-blue-50 text-blue-700 border-blue-100',
  'DELETE': 'bg-rose-50 text-rose-700 border-rose-100',
  'RESOLVE': 'bg-purple-50 text-purple-700 border-purple-100',
  'LOGIN': 'bg-teal-50 text-teal-700 border-teal-100',
  'LOGOUT': 'bg-gray-50 text-gray-700 border-gray-100',
  'PAYMENT_ADD': 'bg-amber-50 text-amber-700 border-amber-100'
};

const ENTITY_LABELS: Record<string, string> = {
  'student': 'Student',
  'free_class': 'Free Class',
  'calltask': 'Call Task',
  'issue': 'Issue Token',
  'payment': 'Payment',
  'admin': 'Admin Account',
  'auth': 'Authentication'
};

export default function TransactionHistory() {
  const { user } = useAuth();
  const [logs, setLogs] = useState<TransactionLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [tableExists, setTableExists] = useState(true);
  
  // Search and filter state
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedAction, setSelectedAction] = useState('');
  const [selectedEntity, setSelectedEntity] = useState('');
  const [selectedDate, setSelectedDate] = useState('');

  const fetchLogs = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('transaction_log')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) {
        if (error.code === '42P01') { // PostgreSQL undefined_table error
          setTableExists(false);
        } else {
          toast.error(`Database error: ${error.message}`);
        }
        return;
      }

      setTableExists(true);
      setLogs(data || []);
    } catch (err: any) {
      console.error('Error fetching transactions:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchLogs();
  }, []);

  const handleResetFilters = () => {
    setSearchQuery('');
    setSelectedAction('');
    setSelectedEntity('');
    setSelectedDate('');
    toast.info('Filters reset');
  };

  const handleExport = () => {
    if (filteredLogs.length === 0) {
      toast.warning('No transactions available to export');
      return;
    }

    const exportData = filteredLogs.map((log, idx) => ({
      'S.No': idx + 1,
      'Date & Time': formatDate(log.created_at),
      'Operator (Admin)': log.admin_username,
      'Action Type': log.action_type,
      'Entity Impacted': ENTITY_LABELS[log.entity_type] || log.entity_type,
      'Reference ID': log.entity_id || 'N/A',
      'Transaction Details': log.details
    }));

    exportToExcel(exportData, `PCA_Activity_Transactions_Log`);
    toast.success('Transactions log exported to Excel');
  };

  const filteredLogs = logs.filter(log => {
    // Search query matching details or admin username or entity id
    const val = searchQuery.toLowerCase();
    const matchesSearch = 
      log.details.toLowerCase().includes(val) ||
      log.admin_username.toLowerCase().includes(val) ||
      (log.entity_id && log.entity_id.toLowerCase().includes(val));

    const matchesAction = selectedAction === '' || log.action_type === selectedAction;
    const matchesEntity = selectedEntity === '' || log.entity_type === selectedEntity;
    
    let matchesDate = true;
    if (selectedDate) {
      const logDateString = new Date(log.created_at).toISOString().split('T')[0];
      matchesDate = logDateString === selectedDate;
    }

    return matchesSearch && matchesAction && matchesEntity && matchesDate;
  });

  if (!tableExists) {
    return (
      <div className="max-w-4xl mx-auto py-12 px-4">
        <div className="bg-white border border-rose-100 rounded-3xl shadow-xl p-8 md:p-12 text-center space-y-6">
          <div className="inline-flex items-center justify-center p-4 bg-rose-50 rounded-full text-rose-600 mb-2">
            <Database size={48} />
          </div>
          <h2 className="text-2xl md:text-3xl font-black text-gray-900 tracking-tight">Setup Transaction History Logging</h2>
          <p className="text-gray-600 text-sm max-w-xl mx-auto leading-relaxed">
            Beautiful news! The core application code is now fully ready to maintain activity transaction logs. To activate this, please run the following SQL query inside your Supabase SQL Editor:
          </p>

          <div className="bg-gray-950 text-gray-200 text-left p-6 rounded-2xl font-mono text-xs overflow-x-auto border border-gray-800 shadow-inner max-w-2xl mx-auto">
{`CREATE TABLE transaction_log (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  admin_username text NOT NULL,
  action_type text NOT NULL,
  entity_type text NOT NULL,
  entity_id text,
  details text NOT NULL,
  created_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Turn off RLS or grant security access policies
ALTER TABLE transaction_log ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Allow authenticated read and write to transaction_logs" 
  ON transaction_log FOR ALL USING (true) WITH CHECK (true);`}
          </div>

          <p className="text-xs text-gray-400">
            Once you execute the above SQL in Supabase, click the refresh button below to load the live transactions timeline immediately.
          </p>

          <button
            onClick={fetchLogs}
            className="px-6 py-3 bg-teal-600 hover:bg-teal-700 text-white rounded-xl font-bold text-sm shadow-md transition-all active:scale-95 inline-flex items-center gap-2"
          >
            <RotateCcw size={16} />
            Refresh State
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6 max-w-7xl mx-auto pb-12">
      <div className="flex flex-col sm:flex-row sm:items-center justify-end gap-4">
        {/* Header Banner Actions */}
        <div className="flex items-center gap-2">
          <button
            onClick={handleExport}
            className="flex items-center justify-center gap-2 px-4 py-2 bg-teal-50 text-teal-700 hover:bg-teal-100 dark:bg-teal-950/40 dark:text-teal-300 dark:hover:bg-teal-900/50 rounded-xl font-bold text-xs transition-colors shadow-xs whitespace-nowrap cursor-pointer"
          >
            <FileDown size={16} />
            Export to Excel
          </button>
          <button
            onClick={fetchLogs}
            disabled={loading}
            className="px-4 py-2 bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-800 rounded-xl font-bold text-xs shadow-xs transition-all flex items-center gap-1.5 disabled:opacity-50 cursor-pointer"
            title="Reload live logs"
          >
            <RotateCcw size={14} className={cn(loading && "animate-spin")} />
            Refresh
          </button>
        </div>
      </div>

      {/* Advanced Filter Box */}
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4 space-y-4">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
          {/* Search Input */}
          <div className="relative">
            <Search className="absolute left-3.5 top-2.5 h-4 w-4 text-gray-400" />
            <input
              type="text"
              placeholder="Search details, PCA ID, admin..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-9 pr-4 py-2 bg-gray-50/50 border border-gray-200 rounded-xl text-xs focus:ring-2 focus:ring-teal-500/15 focus:border-teal-500 transition-all font-semibold"
            />
          </div>

          {/* Action Filter */}
          <div className="relative">
            <Filter className="absolute left-3 w-4 h-4 top-2.5 text-gray-400" />
            <select
              value={selectedAction}
              onChange={(e) => setSelectedAction(e.target.value)}
              className="w-full pl-9 pr-4 py-2 bg-gray-50/50 border border-gray-200 rounded-xl text-xs focus:ring-2 focus:ring-teal-500/15 focus:border-teal-500 transition-all font-semibold text-gray-700 appearance-none bg-no-repeat bg-[right_10px_center]"
            >
              <option value="">All Action Types</option>
              <option value="CREATE">CREATE (Create Records)</option>
              <option value="UPDATE">UPDATE (Edit Records)</option>
              <option value="DELETE">DELETE (Remove Records)</option>
              <option value="RESOLVE">RESOLVE (Fix Issues)</option>
              <option value="LOGIN">LOGIN (Admin Sign In)</option>
              <option value="LOGOUT">LOGOUT (Session End)</option>
              <option value="PAYMENT_ADD">PAYMENT_ADD (Add money)</option>
            </select>
          </div>

          {/* Entity Filter */}
          <div className="relative">
            <Database className="absolute left-3 w-4 h-4 top-2.5 text-gray-400" />
            <select
              value={selectedEntity}
              onChange={(e) => setSelectedEntity(e.target.value)}
              className="w-full pl-9 pr-4 py-2 bg-gray-50/50 border border-gray-200 rounded-xl text-xs focus:ring-2 focus:ring-teal-500/15 focus:border-teal-500 transition-all font-semibold text-gray-700 appearance-none bg-no-repeat bg-[right_10px_center]"
            >
              <option value="">All Segment Areas</option>
              {Object.entries(ENTITY_LABELS).map(([k, v]) => (
                <option key={k} value={k}>{v}</option>
              ))}
            </select>
          </div>

          {/* Date Filter */}
          <div className="relative">
            <Calendar className="absolute left-3 w-4 h-4 top-2.5 text-gray-400" />
            <input
              type="date"
              value={selectedDate}
              onChange={(e) => setSelectedDate(e.target.value)}
              className="w-full pl-9 pr-4 py-2 bg-gray-50/50 border border-gray-200 rounded-xl text-xs focus:ring-2 focus:ring-teal-500/15 focus:border-teal-500 transition-all font-semibold text-gray-700"
            />
          </div>
        </div>

        {/* Filters Clear Row */}
        {(searchQuery || selectedAction || selectedEntity || selectedDate) && (
          <div className="flex items-center justify-between border-t border-gray-50 pt-3 animate-in fade-in duration-200">
            <div className="flex flex-wrap gap-1.5 items-center">
              <span className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">Active Filters:</span>
              {searchQuery && (
                <span className="inline-flex items-center gap-1 bg-teal-50 text-teal-700 border border-teal-100 rounded-full px-2 py-0.5 text-[10px] font-bold">
                  Query: {searchQuery}
                  <X size={10} className="cursor-pointer" onClick={() => setSearchQuery('')} />
                </span>
              )}
              {selectedAction && (
                <span className="inline-flex items-center gap-1 bg-teal-50 text-teal-700 border border-teal-100 rounded-full px-2 py-0.5 text-[10px] font-bold">
                  Action: {selectedAction}
                  <X size={10} className="cursor-pointer" onClick={() => setSelectedAction('')} />
                </span>
              )}
              {selectedEntity && (
                <span className="inline-flex items-center gap-1 bg-teal-50 text-teal-700 border border-teal-100 rounded-full px-2 py-0.5 text-[10px] font-bold">
                  Module: {ENTITY_LABELS[selectedEntity] || selectedEntity}
                  <X size={10} className="cursor-pointer" onClick={() => setSelectedEntity('')} />
                </span>
              )}
              {selectedDate && (
                <span className="inline-flex items-center gap-1 bg-teal-50 text-teal-700 border border-teal-100 rounded-full px-2 py-0.5 text-[10px] font-bold">
                  Date: {selectedDate}
                  <X size={10} className="cursor-pointer" onClick={() => setSelectedDate('')} />
                </span>
              )}
            </div>
            
            <button
              onClick={handleResetFilters}
              className="text-[10px] font-black uppercase text-teal-600 hover:text-teal-700 bg-teal-50 px-2 py-1 rounded-md transition-colors"
            >
              Clear All
            </button>
          </div>
        )}
      </div>

      {loading ? (
        <div className="bg-white dark:bg-gray-900 rounded-3xl border border-gray-100 dark:border-gray-800 shadow-sm p-16 flex flex-col items-center justify-center space-y-4">
          <div className="h-10 w-10 animate-spin rounded-full border-4 border-teal-600 border-t-transparent" />
          <p className="text-gray-500 dark:text-gray-450 font-bold text-sm">Loading activity registers...</p>
        </div>
      ) : filteredLogs.length === 0 ? (
        <div className="bg-white dark:bg-gray-900 rounded-3xl border border-gray-100 dark:border-gray-800 shadow-sm p-16 flex flex-col items-center justify-center text-center space-y-3">
          <div className="p-4 bg-teal-50 dark:bg-teal-950/40 text-teal-600 dark:text-teal-400 rounded-full">
            <Clock size={32} />
          </div>
          <p className="text-gray-700 dark:text-gray-200 font-bold text-lg">No Transactions Found</p>
          <p className="text-gray-400 dark:text-gray-500 text-xs max-w-sm">No recorded events match your matching filter parameters or search constraints.</p>
        </div>
      ) : (
        <div className="bg-white dark:bg-gray-900 rounded-3xl border border-gray-100 dark:border-gray-800 shadow-sm overflow-hidden">
          <div className="overflow-x-auto w-full">
            <table className="w-full text-left border-collapse table-auto">
              <thead>
                <tr className="bg-gray-50/50 dark:bg-gray-800/40 border-b border-gray-100 dark:border-gray-800 text-[10px] font-bold text-gray-400 dark:text-gray-500 uppercase tracking-widest">
                  <th className="py-4 pl-6 pr-3 w-16">No</th>
                  <th className="py-4 px-3 w-40">Timestamp</th>
                  <th className="py-4 px-3 w-32">Admin User</th>
                  <th className="py-4 px-3 w-28">Action</th>
                  <th className="py-4 px-3 w-32">Module Area</th>
                  <th className="py-4 px-3 w-32">Ref ID</th>
                  <th className="py-4 pl-3 pr-6">Transaction Details</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50 dark:divide-gray-800/60 text-xs text-gray-700 dark:text-gray-300 font-medium">
                {filteredLogs.map((log, index) => (
                  <tr key={log.id} className="hover:bg-gray-50/30 dark:hover:bg-gray-850/20 transition-colors">
                    <td className="py-3.5 pl-6 pr-3 text-gray-400 dark:text-gray-500 font-bold">{index + 1}</td>
                    <td className="py-3.5 px-3 select-none text-gray-500 dark:text-gray-400 whitespace-nowrap">
                      {formatDate(log.created_at)}
                    </td>
                    <td className="py-3.5 px-3">
                      <div className="flex items-center gap-1.5">
                        <span className="h-2 w-2 rounded-full bg-teal-500" />
                        <span className="font-extrabold text-gray-900 dark:text-gray-100">{log.admin_username}</span>
                      </div>
                    </td>
                    <td className="py-3.5 px-3">
                      <span className={cn(
                        "inline-flex px-2.5 py-0.5 rounded-full border text-[9px] font-black uppercase tracking-wider",
                        ACTION_COLORS[log.action_type] || 'bg-gray-50 dark:bg-gray-800 text-gray-700 dark:text-gray-300 border-gray-100 dark:border-gray-700'
                      )}>
                        {log.action_type}
                      </span>
                    </td>
                    <td className="py-3.5 px-3 text-gray-500 dark:text-gray-400 font-bold whitespace-nowrap">
                      {ENTITY_LABELS[log.entity_type] || log.entity_type}
                    </td>
                    <td className="py-3.5 px-3">
                      {log.entity_id ? (
                        <span className="font-mono bg-gray-50 dark:bg-gray-800 border border-gray-100 dark:border-gray-700 rounded px-1.5 py-0.5 text-[10px] text-gray-600 dark:text-gray-300">
                          {log.entity_id}
                        </span>
                      ) : (
                        <span className="text-gray-300 dark:text-gray-600">-</span>
                      )}
                    </td>
                    <td className="py-3.5 pl-3 pr-6 text-gray-600 dark:text-gray-300 font-semibold leading-relaxed">
                      {log.details}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="bg-gray-50/50 border-t border-gray-100 px-6 py-3.5 flex items-center justify-between text-xs text-gray-400 font-bold">
            <span>Showing {filteredLogs.length} activity transaction entries</span>
            <span>Live Sync Connected ✅</span>
          </div>
        </div>
      )}
    </div>
  );
}

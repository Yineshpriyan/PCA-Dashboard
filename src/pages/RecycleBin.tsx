import React, { useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../hooks/useAuth';
import { toast } from 'sonner';
import { 
  Search, 
  RotateCcw, 
  Trash2, 
  User, 
  Phone, 
  Calendar, 
  Clock, 
  Users,
  LayoutDashboard,
  ShieldAlert,
  Undo2
} from 'lucide-react';
import { Student, CallTask } from '../types';
import { cn, formatDate } from '../lib/utils';
import { logTransaction } from '../lib/transactions';
import { AuditNavTabs } from '../components/NavTabs';

export default function RecycleBin() {
  const { user } = useAuth();
  const [students, setStudents] = useState<Student[]>([]);
  const [callTasks, setCallTasks] = useState<CallTask[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'students' | 'calltasks'>('students');
  const [searchQuery, setSearchQuery] = useState('');
  const [restoringId, setRestoringId] = useState<string | null>(null);

  const fetchData = async () => {
    setLoading(true);
    try {
      // 1. Fetch soft-deleted students
      const { data: deletedStudents, error: studentsErr } = await supabase
        .from('student')
        .select('*')
        .not('deleted_at', 'is', null)
        .order('deleted_at', { ascending: false });

      if (studentsErr) {
        toast.error(`Error fetching deleted students: ${studentsErr.message}`);
      } else {
        setStudents(deletedStudents || []);
      }

      // 2. Fetch soft-deleted call tasks
      const { data: deletedCallTasks, error: callTasksErr } = await supabase
        .from('calltask')
        .select('*')
        .not('deleted_at', 'is', null)
        .order('deleted_at', { ascending: false });

      if (callTasksErr) {
        toast.error(`Error fetching deleted call tasks: ${callTasksErr.message}`);
      } else {
        setCallTasks(deletedCallTasks || []);
      }
    } catch (err: any) {
      console.error('Error fetching trash data:', err);
      toast.error('Failed to load deleted records');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  const handleRestoreStudent = async (student: Student) => {
    if (!user) return;
    try {
      setRestoringId(student.id);

      // Restore Student record (setting deleted_at to null)
      const { error: studentErr } = await supabase
        .from('student')
        .update({ deleted_at: null })
        .eq('pcaid', student.pcaid);

      if (studentErr) throw studentErr;

      // Restore associated payment records
      await supabase
        .from('payment')
        .update({ deleted_at: null })
        .eq('pcaid', student.pcaid);

      // Restore associated installment records
      const { data: payments } = await supabase
        .from('payment')
        .select('id')
        .eq('pcaid', student.pcaid);

      if (payments && payments.length > 0) {
        const paymentIds = payments.map(p => p.id);
        await supabase
          .from('installment')
          .update({ deleted_at: null })
          .in('payment_id', paymentIds);
      }

      const studentFullName = [student.name, student.last_name].filter(Boolean).join(' ');

      // Log restoration action
      await logTransaction({
        admin_username: user.username,
        action_type: 'RESTORE',
        entity_type: 'student',
        entity_id: student.pcaid,
        details: `Restored student ${studentFullName || student.name} (${student.pcaid}) and associated payments/installments from Recycle Bin`
      });

      toast.success(`Student ${studentFullName || student.name} successfully restored!`);
      setStudents(prev => prev.filter(s => s.id !== student.id));
    } catch (err: any) {
      console.error('Error restoring student:', err);
      toast.error(`Failed to restore student: ${err.message}`);
    } finally {
      setRestoringId(null);
    }
  };

  const handleRestoreCallTask = async (task: CallTask) => {
    if (!user) return;
    try {
      setRestoringId(task.id);

      // Restore Call Task record
      const { error: taskErr } = await supabase
        .from('calltask')
        .update({ deleted_at: null })
        .eq('id', task.id);

      if (taskErr) throw taskErr;

      // Log restoration action
      await logTransaction({
        admin_username: user.username,
        action_type: 'RESTORE',
        entity_type: 'calltask',
        entity_id: task.pcaid || task.phone || task.id,
        details: `Restored call task for ${task.name} (${task.pcaid || 'No PCAID'})`
      });

      toast.success(`Call task for ${task.name} successfully restored!`);
      setCallTasks(prev => prev.filter(t => t.id !== task.id));
    } catch (err: any) {
      console.error('Error restoring call task:', err);
      toast.error(`Failed to restore call task: ${err.message}`);
    } finally {
      setRestoringId(null);
    }
  };

  // Filter lists based on search query
  const filteredStudents = students.filter(s => {
    const query = searchQuery.toLowerCase();
    const fullName = [s.name, s.last_name].filter(Boolean).join(' ').toLowerCase();
    return (
      fullName.includes(query) ||
      (s.last_name && s.last_name.toLowerCase().includes(query)) ||
      s.pcaid.toLowerCase().includes(query) ||
      s.phone.toLowerCase().includes(query) ||
      (s.admin && s.admin.toLowerCase().includes(query))
    );
  });

  const filteredCallTasks = callTasks.filter(t => {
    const query = searchQuery.toLowerCase();
    return (
      t.name.toLowerCase().includes(query) ||
      (t.pcaid && t.pcaid.toLowerCase().includes(query)) ||
      t.phone.toLowerCase().includes(query) ||
      (t.admin && t.admin.toLowerCase().includes(query))
    );
  });

  return (
    <div className="space-y-6 max-w-7xl mx-auto pb-12">
      <div className="flex flex-col sm:flex-row sm:items-center justify-end gap-4">
        <div className="flex items-center gap-2">
          <button
            onClick={fetchData}
            disabled={loading}
            className="px-4 py-2 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-750 text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-gray-700 rounded-xl font-bold text-xs shadow-xs transition-all flex items-center gap-1.5 disabled:opacity-50 cursor-pointer"
          >
            <RotateCcw size={14} className={cn(loading && 'animate-spin')} />
            Refresh Trash
          </button>
        </div>
      </div>

      {/* Tabs Selector & Search */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-4 bg-white dark:bg-gray-900 p-4 rounded-2xl border border-gray-100 dark:border-gray-800 shadow-sm">
        {/* Tabs */}
        <div className="flex bg-gray-100/80 dark:bg-gray-800 p-1 rounded-xl">
          <button
            onClick={() => { setActiveTab('students'); setSearchQuery(''); }}
            className={cn(
              "flex items-center gap-2 px-4 py-2 text-xs font-bold rounded-lg transition-all cursor-pointer",
              activeTab === 'students'
                ? "bg-white dark:bg-gray-700 text-teal-700 dark:text-teal-400 shadow-sm"
                : "text-gray-500 dark:text-gray-400 hover:text-gray-800 dark:hover:text-gray-200"
            )}
          >
            <Users size={14} />
            Deleted Students ({students.length})
          </button>
          <button
            onClick={() => { setActiveTab('calltasks'); setSearchQuery(''); }}
            className={cn(
              "flex items-center gap-2 px-4 py-2 text-xs font-bold rounded-lg transition-all cursor-pointer",
              activeTab === 'calltasks'
                ? "bg-white dark:bg-gray-700 text-teal-700 dark:text-teal-400 shadow-sm"
                : "text-gray-500 dark:text-gray-400 hover:text-gray-800 dark:hover:text-gray-200"
            )}
          >
            <LayoutDashboard size={14} />
            Deleted Call Tasks ({callTasks.length})
          </button>
        </div>

        {/* Search */}
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3.5 top-2.5 h-4 w-4 text-gray-400" />
          <input
            type="text"
            placeholder={activeTab === 'students' ? "Search deleted student details..." : "Search deleted call task details..."}
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-9 pr-4 py-2 bg-gray-50/50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl text-xs focus:ring-2 focus:ring-teal-500/15 focus:border-teal-500 transition-all font-semibold text-gray-800 dark:text-gray-200"
          />
        </div>
      </div>

      {/* Content Area */}
      {loading ? (
        <div className="bg-white dark:bg-gray-900 rounded-3xl border border-gray-100 dark:border-gray-800 shadow-sm p-16 flex flex-col items-center justify-center space-y-4">
          <div className="h-10 w-10 animate-spin rounded-full border-4 border-teal-600 border-t-transparent" />
          <p className="text-gray-500 dark:text-gray-450 font-bold text-sm">Scanning trash bins...</p>
        </div>
      ) : activeTab === 'students' ? (
        filteredStudents.length === 0 ? (
          <div className="bg-white dark:bg-gray-900 rounded-3xl border border-gray-100 dark:border-gray-800 shadow-sm p-16 flex flex-col items-center justify-center text-center space-y-3">
            <div className="p-4 bg-teal-50 dark:bg-teal-950/40 text-teal-600 dark:text-teal-400 rounded-full">
              <Users size={32} />
            </div>
            <p className="text-gray-750 dark:text-gray-200 font-bold text-lg">No Deleted Students Found</p>
            <p className="text-gray-400 dark:text-gray-500 text-xs max-w-sm">
              {searchQuery ? "No matches found for your query." : "Trash bin is empty! No soft-deleted student records detected."}
            </p>
          </div>
        ) : (
          <div className="bg-white dark:bg-gray-900 rounded-3xl border border-gray-100 dark:border-gray-800 shadow-sm overflow-hidden">
            <div className="overflow-x-auto w-full">
              <table className="w-full text-left border-collapse table-auto">
                <thead>
                  <tr className="bg-gray-50/50 dark:bg-gray-800/40 border-b border-gray-100 dark:border-gray-800 text-[10px] font-bold text-gray-450 dark:text-gray-500 uppercase tracking-widest">
                    <th className="py-4 pl-6 pr-3 w-16">No</th>
                    <th className="py-4 px-3">Student Name</th>
                    <th className="py-4 px-3">PCAID / ID</th>
                    <th className="py-4 px-3">Phone</th>
                    <th className="py-4 px-3">District</th>
                    <th className="py-4 px-3">Registered By</th>
                    <th className="py-4 px-3">Deleted Date</th>
                    <th className="py-4 pl-3 pr-6 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-50 dark:divide-gray-800/60 text-xs text-gray-700 dark:text-gray-300 font-medium">
                  {filteredStudents.map((student, idx) => (
                    <tr key={student.id} className="hover:bg-gray-50/30 dark:hover:bg-gray-850/20 transition-colors">
                      <td className="py-3.5 pl-6 pr-3 text-gray-450 dark:text-gray-500 font-bold">{idx + 1}</td>
                      <td className="py-3.5 px-3">
                        <div className="font-extrabold text-gray-900 dark:text-gray-100">
                          {[student.name, student.last_name].filter(Boolean).join(' ')}
                        </div>
                        <div className="text-[10px] text-gray-400">{student.mail}</div>
                      </td>
                      <td className="py-3.5 px-3">
                        <span className="font-mono bg-gray-50 dark:bg-gray-800 border border-gray-150 dark:border-gray-700 rounded px-1.5 py-0.5 text-[10px] text-gray-600 dark:text-gray-300">
                          {student.pcaid}
                        </span>
                      </td>
                      <td className="py-3.5 px-3 whitespace-nowrap">
                        <div className="flex items-center gap-1">
                          <Phone size={12} className="text-gray-400" />
                          <span>{student.phone}</span>
                        </div>
                      </td>
                      <td className="py-3.5 px-3 whitespace-nowrap text-gray-500 dark:text-gray-400">
                        {student.district}
                      </td>
                      <td className="py-3.5 px-3 whitespace-nowrap font-semibold">
                        <span className="inline-flex items-center gap-1 text-gray-600 dark:text-gray-355">
                          <span className="w-1.5 h-1.5 rounded-full bg-teal-500" />
                          {student.admin}
                        </span>
                      </td>
                      <td className="py-3.5 px-3 text-red-500 dark:text-red-400 font-bold whitespace-nowrap">
                        {formatDate((student as any).deleted_at)}
                      </td>
                      <td className="py-3.5 pl-3 pr-6 text-right">
                        <button
                          onClick={() => handleRestoreStudent(student)}
                          disabled={restoringId === student.id}
                          className="inline-flex items-center gap-1 px-3 py-1.5 bg-teal-50 dark:bg-teal-950/40 text-teal-700 dark:text-teal-400 hover:bg-teal-100 dark:hover:bg-teal-900/40 rounded-xl text-[11px] font-black tracking-tight transition-all disabled:opacity-50 cursor-pointer"
                        >
                          <Undo2 size={13} />
                          {restoringId === student.id ? 'Restoring...' : 'Restore Record'}
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div className="bg-gray-50/50 dark:bg-gray-800/20 border-t border-gray-100 dark:border-gray-800 px-6 py-3.5 flex items-center justify-between text-xs text-gray-400 font-bold">
              <span>Showing {filteredStudents.length} soft-deleted student files</span>
              <span>Trash Vault protected 🔒</span>
            </div>
          </div>
        )
      ) : (
        filteredCallTasks.length === 0 ? (
          <div className="bg-white dark:bg-gray-900 rounded-3xl border border-gray-100 dark:border-gray-800 shadow-sm p-16 flex flex-col items-center justify-center text-center space-y-3">
            <div className="p-4 bg-teal-50 dark:bg-teal-950/40 text-teal-600 dark:text-teal-400 rounded-full">
              <LayoutDashboard size={32} />
            </div>
            <p className="text-gray-75.0 dark:text-gray-200 font-bold text-lg">No Deleted Call Tasks Found</p>
            <p className="text-gray-400 dark:text-gray-500 text-xs max-w-sm">
              {searchQuery ? "No matches found for your query." : "Trash bin is empty! No soft-deleted call tasks detected."}
            </p>
          </div>
        ) : (
          <div className="bg-white dark:bg-gray-900 rounded-3xl border border-gray-100 dark:border-gray-800 shadow-sm overflow-hidden">
            <div className="overflow-x-auto w-full">
              <table className="w-full text-left border-collapse table-auto">
                <thead>
                  <tr className="bg-gray-50/50 dark:bg-gray-800/40 border-b border-gray-100 dark:border-gray-800 text-[10px] font-bold text-gray-450 dark:text-gray-500 uppercase tracking-widest">
                    <th className="py-4 pl-6 pr-3 w-16">No</th>
                    <th className="py-4 px-3">Lead / Student Name</th>
                    <th className="py-4 px-3">Ref ID / Phone</th>
                    <th className="py-4 px-3">School</th>
                    <th className="py-4 px-3">Assigned To</th>
                    <th className="py-4 px-3">Lead Status</th>
                    <th className="py-4 px-3">Deleted Date</th>
                    <th className="py-4 pl-3 pr-6 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-50 dark:divide-gray-800/60 text-xs text-gray-700 dark:text-gray-300 font-medium">
                  {filteredCallTasks.map((task, idx) => (
                    <tr key={task.id} className="hover:bg-gray-50/30 dark:hover:bg-gray-850/20 transition-colors">
                      <td className="py-3.5 pl-6 pr-3 text-gray-450 dark:text-gray-500 font-bold">{idx + 1}</td>
                      <td className="py-3.5 px-3">
                        <div className="font-extrabold text-gray-900 dark:text-gray-100">{task.name}</div>
                        <div className="text-[10px] text-gray-400">{task.mail || 'No email'}</div>
                      </td>
                      <td className="py-3.5 px-3">
                        {task.pcaid ? (
                          <span className="font-mono bg-gray-50 dark:bg-gray-800 border border-gray-150 dark:border-gray-700 rounded px-1.5 py-0.5 text-[10px] text-gray-600 dark:text-gray-300 mr-1.5">
                            {task.pcaid}
                          </span>
                        ) : null}
                        <span className="text-gray-500 dark:text-gray-400 font-semibold">{task.phone}</span>
                      </td>
                      <td className="py-3.5 px-3 whitespace-nowrap text-gray-500 dark:text-gray-400">
                        {task.school || '-'}
                      </td>
                      <td className="py-3.5 px-3 whitespace-nowrap font-semibold">
                        <span className="inline-flex items-center gap-1 text-gray-600 dark:text-gray-355">
                          <span className="w-1.5 h-1.5 rounded-full bg-blue-500" />
                          {task.admin}
                        </span>
                      </td>
                      <td className="py-3.5 px-3 whitespace-nowrap">
                        <span className={cn(
                          "inline-flex px-2 py-0.5 rounded-full border text-[9px] font-black uppercase tracking-wider",
                          task.status === 'Joined' ? 'bg-emerald-50 dark:bg-emerald-950/20 text-emerald-700 dark:text-emerald-400 border-emerald-100 dark:border-emerald-900/30' :
                          task.status === 'Not Join' ? 'bg-rose-50 dark:bg-rose-950/20 text-rose-700 dark:text-rose-400 border-rose-100 dark:border-rose-900/30' :
                          'bg-amber-50 dark:bg-amber-950/20 text-amber-700 dark:text-amber-400 border-amber-100 dark:border-amber-900/30'
                        )}>
                          {task.status}
                        </span>
                      </td>
                      <td className="py-3.5 px-3 text-red-500 dark:text-red-400 font-bold whitespace-nowrap">
                        {formatDate((task as any).deleted_at)}
                      </td>
                      <td className="py-3.5 pl-3 pr-6 text-right">
                        <button
                          onClick={() => handleRestoreCallTask(task)}
                          disabled={restoringId === task.id}
                          className="inline-flex items-center gap-1 px-3 py-1.5 bg-teal-50 dark:bg-teal-950/40 text-teal-700 dark:text-teal-400 hover:bg-teal-100 dark:hover:bg-teal-900/40 rounded-xl text-[11px] font-black tracking-tight transition-all disabled:opacity-50 cursor-pointer"
                        >
                          <Undo2 size={13} />
                          {restoringId === task.id ? 'Restoring...' : 'Restore Record'}
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div className="bg-gray-50/50 dark:bg-gray-800/20 border-t border-gray-100 dark:border-gray-800 px-6 py-3.5 flex items-center justify-between text-xs text-gray-400 font-bold">
              <span>Showing {filteredCallTasks.length} soft-deleted call tasks</span>
              <span>Trash Vault protected 🔒</span>
            </div>
          </div>
        )
      )}
    </div>
  );
}

import React from 'react';
import { Link, useLocation, useSearchParams } from 'react-router-dom';
import { Video, UserPlus, History, Trash2, Users, ClipboardList, PlusCircle, LayoutDashboard, Folder, Key, Layers, Bell } from 'lucide-react';
import { cn } from '../lib/utils';
import { useAuth } from '../hooks/useAuth';

export function ZoomNavTabs() {
  const location = useLocation();
  const isBulk = location.pathname === '/admin/zoom-register';
  const isIndividual = location.pathname === '/admin/zoom-register-individual';

  return (
    <div className="flex items-center gap-1.5 p-1 bg-gray-100/80 dark:bg-gray-800/80 rounded-2xl w-fit border border-gray-200/80 dark:border-gray-700/80 shadow-2xs">
      <Link
        to="/admin/zoom-register"
        className={cn(
          "flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer",
          isBulk
            ? "bg-white dark:bg-gray-900 text-teal-700 dark:text-teal-300 shadow-xs border border-teal-100 dark:border-teal-900/40 font-extrabold"
            : "text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white hover:bg-white/50 dark:hover:bg-gray-700/50"
        )}
      >
        <Video size={15} className={isBulk ? "text-teal-600 dark:text-teal-400" : "text-gray-400"} />
        <span>Bulk Register</span>
      </Link>
      <Link
        to="/admin/zoom-register-individual"
        className={cn(
          "flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer",
          isIndividual
            ? "bg-white dark:bg-gray-900 text-teal-700 dark:text-teal-300 shadow-xs border border-teal-100 dark:border-teal-900/40 font-extrabold"
            : "text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white hover:bg-white/50 dark:hover:bg-gray-700/50"
        )}
      >
        <UserPlus size={15} className={isIndividual ? "text-teal-600 dark:text-teal-400" : "text-gray-400"} />
        <span>Individual Register</span>
      </Link>
    </div>
  );
}

export function AuditNavTabs() {
  const { user } = useAuth();
  const location = useLocation();
  const isTransactions = location.pathname === '/admin/transactions';
  const isRecycleBin = location.pathname === '/admin/recycle-bin';

  const isSuperAdmin = user?.admin_type === 'super_admin';

  return (
    <div className="flex items-center gap-1.5 p-1 bg-gray-100/80 dark:bg-gray-800/80 rounded-2xl w-fit border border-gray-200/80 dark:border-gray-700/80 shadow-2xs">
      {isSuperAdmin && (
        <Link
          to="/admin/transactions"
          className={cn(
            "flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer",
            isTransactions
              ? "bg-white dark:bg-gray-900 text-teal-700 dark:text-teal-300 shadow-xs border border-teal-100 dark:border-teal-900/40 font-extrabold"
              : "text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white hover:bg-white/50 dark:hover:bg-gray-700/50"
          )}
        >
          <History size={15} className={isTransactions ? "text-teal-600 dark:text-teal-400" : "text-gray-400"} />
          <span>Transaction Log</span>
        </Link>
      )}
      <Link
        to="/admin/recycle-bin"
        className={cn(
          "flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer",
          isRecycleBin
            ? "bg-white dark:bg-gray-900 text-teal-700 dark:text-teal-300 shadow-xs border border-teal-100 dark:border-teal-900/40 font-extrabold"
            : "text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white hover:bg-white/50 dark:hover:bg-gray-700/50"
        )}
      >
        <Trash2 size={15} className={isRecycleBin ? "text-teal-600 dark:text-teal-400" : "text-gray-400"} />
        <span>Recycle Bin</span>
      </Link>
    </div>
  );
}

export function AdminNavTabs() {
  const location = useLocation();
  const isAdminList = location.pathname === '/super-admin/admins';
  const isNewAccount = location.pathname === '/super-admin/signup';

  return (
    <div className="flex items-center gap-1.5 p-1 bg-gray-100/80 dark:bg-gray-800/80 rounded-2xl w-fit border border-gray-200/80 dark:border-gray-700/80 shadow-2xs">
      <Link
        to="/super-admin/admins"
        className={cn(
          "flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer",
          isAdminList
            ? "bg-white dark:bg-gray-900 text-teal-700 dark:text-teal-300 shadow-xs border border-teal-100 dark:border-teal-900/40 font-extrabold"
            : "text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white hover:bg-white/50 dark:hover:bg-gray-700/50"
        )}
      >
        <Users size={15} className={isAdminList ? "text-teal-600 dark:text-teal-400" : "text-gray-400"} />
        <span>Admins</span>
      </Link>
      <Link
        to="/super-admin/signup"
        className={cn(
          "flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer",
          isNewAccount
            ? "bg-white dark:bg-gray-900 text-teal-700 dark:text-teal-300 shadow-xs border border-teal-100 dark:border-teal-900/40 font-extrabold"
            : "text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white hover:bg-white/50 dark:hover:bg-gray-700/50"
        )}
      >
        <UserPlus size={15} className={isNewAccount ? "text-teal-600 dark:text-teal-400" : "text-gray-400"} />
        <span>New Account</span>
      </Link>
    </div>
  );
}

export function TokenNavTabs() {
  const location = useLocation();
  const isDisplay = location.pathname === '/admin/display';
  const isNew = location.pathname === '/admin/new';

  return (
    <div className="flex items-center gap-1.5 p-1 bg-gray-100/80 dark:bg-gray-800/80 rounded-2xl w-fit border border-gray-200/80 dark:border-gray-700/80 shadow-2xs">
      <Link
        to="/admin/display"
        className={cn(
          "flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer",
          isDisplay
            ? "bg-white dark:bg-gray-900 text-teal-700 dark:text-teal-300 shadow-xs border border-teal-100 dark:border-teal-900/40 font-extrabold"
            : "text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white hover:bg-white/50 dark:hover:bg-gray-700/50"
        )}
      >
        <ClipboardList size={15} className={isDisplay ? "text-teal-600 dark:text-teal-400" : "text-gray-400"} />
        <span>Issues</span>
      </Link>
      <Link
        to="/admin/new"
        className={cn(
          "flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer",
          isNew
            ? "bg-white dark:bg-gray-900 text-teal-700 dark:text-teal-300 shadow-xs border border-teal-100 dark:border-teal-900/40 font-extrabold"
            : "text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white hover:bg-white/50 dark:hover:bg-gray-700/50"
        )}
      >
        <PlusCircle size={15} className={isNew ? "text-teal-600 dark:text-teal-400" : "text-gray-400"} />
        <span>New Issue</span>
      </Link>
    </div>
  );
}

export function LeadNavTabs() {
  const location = useLocation();
  const isDisplay = location.pathname === '/admin/call-task/display';
  const isNew = location.pathname === '/admin/call-task/new';

  return (
    <div className="flex items-center gap-1.5 p-1 bg-gray-100/80 dark:bg-gray-800/80 rounded-2xl w-fit border border-gray-200/80 dark:border-gray-700/80 shadow-2xs">
      <Link
        to="/admin/call-task/display"
        className={cn(
          "flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer",
          isDisplay
            ? "bg-white dark:bg-gray-900 text-teal-700 dark:text-teal-300 shadow-xs border border-teal-100 dark:border-teal-900/40 font-extrabold"
            : "text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white hover:bg-white/50 dark:hover:bg-gray-700/50"
        )}
      >
        <LayoutDashboard size={15} className={isDisplay ? "text-teal-600 dark:text-teal-400" : "text-gray-400"} />
        <span>Leads</span>
      </Link>
      <Link
        to="/admin/call-task/new"
        className={cn(
          "flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer",
          isNew
            ? "bg-white dark:bg-gray-900 text-teal-700 dark:text-teal-300 shadow-xs border border-teal-100 dark:border-teal-900/40 font-extrabold"
            : "text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white hover:bg-white/50 dark:hover:bg-gray-700/50"
        )}
      >
        <UserPlus size={15} className={isNew ? "text-teal-600 dark:text-teal-400" : "text-gray-400"} />
        <span>New Lead</span>
      </Link>
    </div>
  );
}

export function ActivationNavTabs() {
  const [searchParams, setSearchParams] = useSearchParams();
  const activeTab = searchParams.get('tab') || 'student-access';

  const setTab = (tab: string) => {
    setSearchParams({ tab });
  };

  return (
    <div className="flex items-center gap-1.5 p-1 bg-gray-100/80 dark:bg-gray-800/80 rounded-2xl w-fit border border-gray-200/80 dark:border-gray-700/80 shadow-2xs overflow-x-auto">
      <button
        onClick={() => setTab('folders')}
        className={cn(
          "flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer whitespace-nowrap",
          activeTab === 'folders'
            ? "bg-white dark:bg-gray-900 text-teal-700 dark:text-teal-300 shadow-xs border border-teal-100 dark:border-teal-900/40 font-extrabold"
            : "text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white hover:bg-white/50 dark:hover:bg-gray-700/50"
        )}
      >
        <Folder size={15} className={activeTab === 'folders' ? "text-teal-600 dark:text-teal-400" : "text-gray-400"} />
        <span>Folders & Files</span>
      </button>
      <button
        onClick={() => setTab('student-access')}
        className={cn(
          "flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer whitespace-nowrap",
          activeTab === 'student-access'
            ? "bg-white dark:bg-gray-900 text-teal-700 dark:text-teal-300 shadow-xs border border-teal-100 dark:border-teal-900/40 font-extrabold"
            : "text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white hover:bg-white/50 dark:hover:bg-gray-700/50"
        )}
      >
        <Key size={15} className={activeTab === 'student-access' ? "text-teal-600 dark:text-teal-400" : "text-gray-400"} />
        <span>Access</span>
      </button>
      <button
        onClick={() => setTab('students')}
        className={cn(
          "flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer whitespace-nowrap",
          activeTab === 'students'
            ? "bg-white dark:bg-gray-900 text-teal-700 dark:text-teal-300 shadow-xs border border-teal-100 dark:border-teal-900/40 font-extrabold"
            : "text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white hover:bg-white/50 dark:hover:bg-gray-700/50"
        )}
      >
        <Users size={15} className={activeTab === 'students' ? "text-teal-600 dark:text-teal-400" : "text-gray-400"} />
        <span>Edit</span>
      </button>
      <button
        onClick={() => setTab('api-docs')}
        className={cn(
          "flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer whitespace-nowrap",
          activeTab === 'api-docs'
            ? "bg-white dark:bg-gray-900 text-teal-700 dark:text-teal-300 shadow-xs border border-teal-100 dark:border-teal-900/40 font-extrabold"
            : "text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white hover:bg-white/50 dark:hover:bg-gray-700/50"
        )}
      >
        <Layers size={15} className={activeTab === 'api-docs' ? "text-teal-600 dark:text-teal-400" : "text-gray-400"} />
        <span>App API Live Sync</span>
      </button>
      <button
        onClick={() => setTab('notifications')}
        className={cn(
          "flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer whitespace-nowrap",
          activeTab === 'notifications'
            ? "bg-white dark:bg-gray-900 text-teal-700 dark:text-teal-300 shadow-xs border border-teal-100 dark:border-teal-900/40 font-extrabold"
            : "text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white hover:bg-white/50 dark:hover:bg-gray-700/50"
        )}
      >
        <Bell size={15} className={activeTab === 'notifications' ? "text-teal-600 dark:text-teal-400" : "text-gray-400"} />
        <span>App Notifications</span>
      </button>
    </div>
  );
}

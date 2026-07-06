import React, { useState, useEffect } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { 
  PlusCircle, 
  LayoutDashboard, 
  Settings, 
  UserPlus, 
  LogOut, 
  Menu, 
  X,
  ClipboardList,
  User as UserIcon,
  ChevronDown,
  Wrench,
  Users,
  Bell,
  History,
  Sun,
  Moon,
  Video
} from 'lucide-react';
import { useAuth } from '../hooks/useAuth';
import { logTransaction } from '../lib/transactions';
import { cn, playNotificationSound } from '../lib/utils';
import { motion, AnimatePresence } from 'motion/react';
import { supabase } from '../lib/supabase';
import { toast } from 'sonner';
import { Issue } from '../types';
import AcademyLogo from './AcademyLogo';

interface NavItem {
  label: string;
  path: string;
  icon: React.ReactNode;
  roles: ('admin' | 'super_admin')[];
}

interface NavSection {
  title: string;
  items: NavItem[];
}

const navSections: NavSection[] = [
  {
    title: 'Tokens & Issues',
    items: [
      { label: 'New Issue', path: '/admin/new', icon: <PlusCircle size={18} />, roles: ['admin', 'super_admin'] },
      { label: 'Issues', path: '/admin/display', icon: <ClipboardList size={18} />, roles: ['admin', 'super_admin'] },
    ]
  },
  {
    title: 'Lead & Call Tasks',
    items: [
      { label: 'New Call Task', path: '/admin/call-task/new', icon: <UserPlus size={18} />, roles: ['admin', 'super_admin'] },
      { label: 'Call Tasks', path: '/admin/call-task/display', icon: <LayoutDashboard size={18} />, roles: ['admin', 'super_admin'] },
    ]
  },
  {
    title: 'Student Enrolment',
    items: [
      { label: 'New Student', path: '/admin/student-form', icon: <Settings size={18} />, roles: ['admin', 'super_admin'] },
      { label: 'Student Explorer', path: '/admin/student-explorer', icon: <Users size={18} />, roles: ['admin', 'super_admin'] },
    ]
  },
  {
    title: 'Zoom Webinars',
    items: [
      { label: 'Bulk Register', path: '/admin/zoom-register', icon: <Video size={18} />, roles: ['admin', 'super_admin'] },
      { label: 'Individual Register', path: '/admin/zoom-register-individual', icon: <UserPlus size={18} />, roles: ['admin', 'super_admin'] },
    ]
  },
  {
    title: 'System Audit',
    items: [
      { label: 'Transaction Log', path: '/admin/transactions', icon: <History size={18} />, roles: ['super_admin'] },
    ]
  },
  {
    title: 'Super Admin Area',
    items: [
      { label: 'Issue Fixing', path: '/super-admin/fixing', icon: <Wrench size={18} />, roles: ['super_admin'] },
      { label: 'Admins List', path: '/super-admin/admins', icon: <Users size={18} />, roles: ['super_admin'] },
      { label: 'Add Items', path: '/super-admin/items', icon: <Settings size={18} />, roles: ['super_admin'] },
      { label: 'New Account', path: '/super-admin/signup', icon: <UserPlus size={18} />, roles: ['super_admin'] },
    ]
  }
];

export function Sidebar({ 
  isOpen, 
  setIsOpen,
  theme,
  toggleTheme
}: { 
  isOpen: boolean; 
  setIsOpen: (val: boolean) => void;
  theme: 'light' | 'dark';
  toggleTheme: () => void;
}) {
  const { user, logout } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();
  const [isDesktop, setIsDesktop] = React.useState(typeof window !== 'undefined' ? window.innerWidth >= 1024 : true);

  React.useEffect(() => {
    const handleResize = () => setIsDesktop(window.innerWidth >= 1024);
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  const handleLogout = () => {
    if (user) {
      logTransaction({
        admin_username: user.username,
        action_type: 'LOGOUT',
        entity_type: 'auth',
        entity_id: user.id,
        details: `Logged out of the PCA Portal`
      });
    }
    logout();
    setIsOpen(false);
    navigate('/login');
  };

  const filteredSections = navSections
    .map(section => ({
      ...section,
      items: section.items.filter(item => user && item.roles.includes(user.admin_type))
    }))
    .filter(section => section.items.length > 0);

  return (
    <>
      {/* Mobile Backdrop */}
      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={() => setIsOpen(false)}
            className="fixed inset-0 z-40 bg-black/50 lg:hidden"
          />
        )}
      </AnimatePresence>

      {/* Sidebar */}
      <motion.aside
        initial={false}
        animate={{ 
          x: isDesktop || isOpen ? 0 : -300 
        }}
        transition={{ type: 'spring', damping: 25, stiffness: 200 }}
        className={cn(
          "fixed top-0 bottom-0 left-0 z-50 w-64 bg-white dark:bg-gray-900 border-r border-gray-200 dark:border-gray-800 lg:translate-x-0 transition-shadow",
          !isOpen && "max-lg:hidden",
          isOpen && "shadow-2xl"
        )}
      >
        <div className="flex flex-col h-full">
          <div className="p-4 py-5 flex items-center justify-between border-b border-gray-100 dark:border-gray-800">
            <h1 className="text-xl font-black text-teal-700 tracking-tight flex items-center gap-2">
              <AcademyLogo width={34} height={34} showText={false} />
              <div className="flex flex-col">
                <span className="text-sm font-black text-gray-800 dark:text-gray-100 leading-none">PHYSICS CUBE</span>
                <span className="text-[10px] font-black uppercase tracking-widest text-teal-600 dark:text-teal-400 leading-none mt-1">Portal</span>
              </div>
            </h1>
            <button onClick={() => setIsOpen(false)} className="lg:hidden p-1 text-gray-500 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-lg">
              <X size={24} />
            </button>
          </div>

          <div className="flex-1 px-3 py-6 space-y-6 overflow-y-auto">
            {filteredSections.map((section, idx) => (
              <div key={idx} className="space-y-1.5">
                <h3 className="text-[10px] font-bold text-gray-450 dark:text-gray-500 uppercase tracking-widest px-3 select-none">
                  {section.title}
                </h3>
                <div className="space-y-1">
                  {section.items.map((item) => (
                    <Link
                      key={item.path}
                      to={item.path}
                      onClick={() => setIsOpen(false)}
                      className={cn(
                        "flex items-center gap-3 px-3 py-2 rounded-xl text-xs font-bold transition-all border border-transparent",
                        location.pathname === item.path
                          ? "bg-teal-50/70 dark:bg-teal-950/40 text-teal-700 dark:text-teal-400 border-teal-100/50 dark:border-teal-900/30 shadow-sm shadow-teal-700/5 font-black"
                          : "text-gray-600 dark:text-gray-300 hover:bg-gray-50/70 dark:hover:bg-gray-800/65 hover:text-gray-900 dark:hover:text-white"
                      )}
                    >
                      <span className={cn(
                        "transition-transform duration-300",
                        location.pathname === item.path ? "text-teal-600 dark:text-teal-400 scale-110" : "text-gray-400 dark:text-gray-500 group-hover:text-gray-600 dark:group-hover:text-gray-300"
                      )}>
                        {item.icon}
                      </span>
                      <span>{item.label}</span>
                    </Link>
                  ))}
                </div>
              </div>
            ))}
          </div>

          <div className="p-4 border-t border-gray-100 dark:border-gray-800 space-y-2">
            <div className="flex items-center gap-3 p-3 rounded-lg bg-gray-50 dark:bg-gray-800 border border-gray-100 dark:border-gray-700">
              <div className="w-10 h-10 rounded-full bg-teal-100 dark:bg-teal-950 flex items-center justify-center text-teal-700 dark:text-teal-300 shadow-inner">
                <UserIcon size={20} />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-bold text-gray-900 dark:text-gray-100 truncate">{user?.username}</p>
                <p className="text-xs text-gray-500 dark:text-gray-400 font-medium capitalize">{user?.admin_type?.replace('_', ' ')}</p>
              </div>
            </div>

            {/* Sidebar Theme Switcher */}
            <div className="flex items-center justify-between p-2 rounded-lg bg-gray-50 dark:bg-gray-800 border border-gray-100/50 dark:border-gray-700/50">
              <span className="text-xs font-bold text-gray-500 dark:text-gray-400 pl-1.5">Theme Mode</span>
              <button
                type="button"
                onClick={toggleTheme}
                className="p-1 px-2.5 rounded-lg bg-white dark:bg-gray-700 border border-gray-200 dark:border-gray-650 hover:bg-gray-50 dark:hover:bg-gray-600 text-gray-700 dark:text-gray-200 transition-all flex items-center gap-1.5 text-xs font-bold shadow-sm cursor-pointer"
              >
                {theme === 'dark' ? (
                  <>
                    <Moon size={13} className="text-teal-400" />
                    <span>Dark Mode</span>
                  </>
                ) : (
                  <>
                    <Sun size={13} className="text-amber-500" />
                    <span>Light Mode</span>
                  </>
                )}
              </button>
            </div>
            
            <button
              onClick={handleLogout}
              className="lg:hidden w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-950/20 transition-colors"
            >
              <LogOut size={20} />
              Logout
            </button>
          </div>
        </div>
      </motion.aside>
    </>
  );
}

export function Topbar({ 
  setIsSidebarOpen,
  theme,
  toggleTheme
}: { 
  setIsSidebarOpen: () => void;
  theme: 'light' | 'dark';
  toggleTheme: () => void;
}) {
  const { user, logout } = useAuth();
  const [isProfileOpen, setIsProfileOpen] = useState(false);
  const navigate = useNavigate();

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  return (
    <header className="sticky top-0 z-45 h-16 bg-white dark:bg-gray-900 border-b border-gray-200 dark:border-gray-800 px-4 flex items-center justify-between">
      <button
        onClick={setIsSidebarOpen}
        className="lg:hidden p-2 text-gray-500 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-md"
      >
        <Menu size={24} />
      </button>

      <div className="hidden lg:block">
        {/* Placeholder if needed */}
      </div>

      <div className="flex items-center gap-4">
        <div className="relative">
          <button
            onClick={() => setIsProfileOpen(!isProfileOpen)}
            className="flex items-center gap-2 p-1 pl-2 rounded-full border border-gray-200 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors"
          >
            <span className="text-sm font-medium text-gray-700 dark:text-gray-300 hidden sm:inline">{user?.username}</span>
            <div className="w-8 h-8 rounded-full bg-teal-600 flex items-center justify-center text-white">
              <UserIcon size={16} />
            </div>
            <ChevronDown size={14} className={cn("text-gray-500 dark:text-gray-400 transition-transform", isProfileOpen && "rotate-180")} />
          </button>

          <AnimatePresence>
            {isProfileOpen && (
              <>
                <div className="fixed inset-0 z-10" onClick={() => setIsProfileOpen(false)} />
                <motion.div
                  initial={{ opacity: 0, y: 10, scale: 0.95 }}
                  animate={{ opacity: 1, y: 0, scale: 1 }}
                  exit={{ opacity: 0, y: 10, scale: 0.95 }}
                  className="absolute right-0 mt-2 w-48 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl shadow-lg py-1 z-20"
                >
                  <div className="px-4 py-2 border-b border-gray-100 dark:border-gray-700 lg:hidden font-sans">
                    <p className="text-sm font-semibold text-gray-900 dark:text-gray-100 truncate">{user?.username}</p>
                    <p className="text-xs text-gray-500 dark:text-gray-400 capitalize">{user?.admin_type?.replace('_', ' ')}</p>
                  </div>
                  {/* Theme Selector Section */}
                  <div className="px-4 py-2 flex items-center justify-between border-b border-gray-100 dark:border-gray-700 text-sans">
                    <span className="text-xs font-bold text-gray-500 dark:text-gray-400">Theme</span>
                    <button
                      type="button"
                      onClick={toggleTheme}
                      className="p-1 px-2.5 rounded-lg bg-gray-100 dark:bg-gray-700 border border-gray-250 dark:border-gray-600 hover:bg-gray-200 dark:hover:bg-gray-650 text-gray-700 dark:text-gray-200 transition-all flex items-center gap-1 text-xs font-bold shadow-sm cursor-pointer"
                    >
                      {theme === 'dark' ? (
                        <>
                          <Moon size={11} className="text-teal-400" />
                          <span>Dark</span>
                        </>
                      ) : (
                        <>
                          <Sun size={11} className="text-amber-500" />
                          <span>Light</span>
                        </>
                      )}
                    </button>
                  </div>
                  <button
                    onClick={handleLogout}
                    className="w-full flex items-center gap-2 px-4 py-2 text-sm text-red-600 hover:bg-red-50 dark:hover:bg-red-950/20 transition-colors text-left cursor-pointer"
                  >
                    <LogOut size={16} />
                    Logout
                  </button>
                </motion.div>
              </>
            )}
          </AnimatePresence>
        </div>
      </div>
    </header>
  );
}

export function Shell({ children }: { children: React.ReactNode }) {
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const { user } = useAuth();

  // Unified system-wide light/dark theme state
  const [theme, setTheme] = useState<'light' | 'dark'>(() => {
    if (typeof localStorage !== 'undefined') {
      const stored = localStorage.getItem('theme');
      if (stored === 'dark') return 'dark';
      if (stored === 'light') return 'light';
    }
    if (typeof window !== 'undefined') {
      return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
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
    setTheme(prev => prev === 'dark' ? 'light' : 'dark');
  };

  useEffect(() => {
    if (user?.admin_type !== 'super_admin') return;

    // Request deskop notification permissions
    if (typeof Notification !== 'undefined' && Notification.permission === 'default') {
      Notification.requestPermission();
    }

    const channel = supabase
      .channel('super-admin-notifications')
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'issue' },
        (payload) => {
          const newIssue = payload.new as Issue;
          
          // Sound trigger
          playNotificationSound();

          // Sonner toast
          toast.info(`New Issue: ${newIssue.issue}`, {
            description: `From: ${newIssue.name} (${newIssue.admin})`,
            duration: 8000,
            icon: <Bell className="text-teal-600" />,
            action: {
              label: 'View',
              onClick: () => window.location.href = '/super-admin/fixing'
            }
          });

          // Browser notification
          if (typeof Notification !== 'undefined' && Notification.permission === 'granted') {
            new Notification('New Ticket Created', {
              body: `${newIssue.issue} - ${newIssue.name}`,
              icon: '/favicon.ico'
            });
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [user]);

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-950 text-gray-900 dark:text-gray-100 transition-colors duration-200">
      <Sidebar isOpen={isSidebarOpen} setIsOpen={setIsSidebarOpen} theme={theme} toggleTheme={toggleTheme} />
      <div className="lg:ml-64 flex flex-col min-h-screen">
        <Topbar setIsSidebarOpen={() => setIsSidebarOpen(true)} theme={theme} toggleTheme={toggleTheme} />
        <main className="flex-1 p-4 lg:p-8">
          <div className="max-w-7xl mx-auto h-full">
            {children}
          </div>
        </main>
      </div>
    </div>
  );
}

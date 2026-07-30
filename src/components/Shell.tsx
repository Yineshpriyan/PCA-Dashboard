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
  Video,
  Home,
  Trash2,
  Smartphone
} from 'lucide-react';
import { useAuth } from '../hooks/useAuth';
import { logTransaction } from '../lib/transactions';
import { cn, playNotificationSound } from '../lib/utils';
import { motion, AnimatePresence } from 'motion/react';
import { supabase } from '../lib/supabase';
import { toast } from 'sonner';
import { TokenNavTabs, LeadNavTabs, ZoomNavTabs, AuditNavTabs, AdminNavTabs, ActivationNavTabs } from './NavTabs';
import { Issue } from '../types';
import AcademyLogo from './AcademyLogo';

interface NavItem {
  label: string;
  path: string;
  icon: React.ReactNode;
  roles: ('admin' | 'super_admin')[];
  matchPaths?: string[];
}

interface NavSection {
  title: string;
  items: NavItem[];
}

const navSections: NavSection[] = [
  {
    title: 'Overview',
    items: [
      { label: 'Dashboard', path: '/admin/home', icon: <Home size={18} />, roles: ['admin', 'super_admin'] },
    ]
  },
  {
    title: 'Tokens & Issues',
    items: [
      { 
        label: 'Tokens', 
        path: '/admin/display', 
        matchPaths: ['/admin/display', '/admin/new'],
        icon: <ClipboardList size={18} />, 
        roles: ['admin', 'super_admin'] 
      },
    ]
  },
  {
    title: 'Lead & Call Tasks',
    items: [
      { 
        label: 'Leads', 
        path: '/admin/call-task/display', 
        matchPaths: ['/admin/call-task/display', '/admin/call-task/new'],
        icon: <LayoutDashboard size={18} />, 
        roles: ['admin', 'super_admin'] 
      },
    ]
  },
  {
    title: 'Student Enrolment',
    items: [
      { label: 'New Student', path: '/admin/student-form', icon: <Settings size={18} />, roles: ['admin', 'super_admin'] },
      { label: 'Students', path: '/admin/student-explorer', icon: <Users size={18} />, roles: ['admin', 'super_admin'] },
    ]
  },
  {
    title: 'App',
    items: [
      { label: 'Activation', path: '/admin/app-activation', icon: <Smartphone size={18} />, roles: ['admin', 'super_admin'] },
    ]
  },
  {
    title: 'Zoom',
    items: [
      { 
        label: 'Webinar / Meeting', 
        path: '/admin/zoom-register', 
        matchPaths: ['/admin/zoom-register', '/admin/zoom-register-individual'],
        icon: <Video size={18} />, 
        roles: ['admin', 'super_admin'] 
      },
    ]
  },
  {
    title: 'System Audit',
    items: [
      { 
        label: 'System Audit', 
        path: '/admin/transactions', 
        matchPaths: ['/admin/transactions', '/admin/recycle-bin'],
        icon: <History size={18} />, 
        roles: ['admin', 'super_admin'] 
      },
    ]
  },
  {
    title: 'Super Admin Area',
    items: [
      { label: 'Issue Fixing', path: '/super-admin/fixing', icon: <Wrench size={18} />, roles: ['super_admin'] },
      { 
        label: 'Admins', 
        path: '/super-admin/admins', 
        matchPaths: ['/super-admin/admins', '/super-admin/signup'],
        icon: <Users size={18} />, 
        roles: ['super_admin'] 
      },
      { label: 'Add Items', path: '/super-admin/items', icon: <Settings size={18} />, roles: ['super_admin'] },
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
  const [isSidebarProfileExpanded, setIsSidebarProfileExpanded] = React.useState(false);

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
      items: section.items
        .filter(item => user && item.roles.includes(user.admin_type))
        .map(item => {
          if (item.label === 'System Audit' && user?.admin_type === 'admin') {
            return { ...item, path: '/admin/recycle-bin' };
          }
          return item;
        })
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
          x: isOpen ? 0 : -260 
        }}
        transition={{ type: 'spring', damping: 25, stiffness: 200 }}
        className={cn(
          "fixed top-0 bottom-0 left-0 z-50 w-64 bg-white dark:bg-gray-900 border-r border-gray-200 dark:border-gray-800 transition-shadow",
          isOpen && "shadow-2xl lg:shadow-md"
        )}
      >
        <div className="flex flex-col h-full">
          <div className="p-4 py-5 flex items-center justify-between border-b border-gray-100 dark:border-gray-800">
            <div className="flex items-center gap-2">
              <button
                onClick={() => setIsOpen(false)}
                className="p-1.5 text-gray-500 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-md transition-colors cursor-pointer"
                title="Collapse Sidebar"
              >
                <Menu size={20} />
              </button>
              <h1 className="text-xl font-black tracking-tight flex items-center gap-2 select-none">
                <AcademyLogo width={42} height={42} showText={false} />
                <span className="text-2xl font-black tracking-wider bg-gradient-to-r from-blue-600 to-white bg-clip-text text-transparent drop-shadow-[0_1px_1.5px_rgba(30,58,138,0.3)] dark:drop-shadow-none">
                  PCA
                </span>
              </h1>
            </div>
          </div>

          {/* Clickable Profile Card - Placed below logo and above overview */}
          <div className="px-4 py-3 border-b border-gray-100 dark:border-gray-800">
            <button
              type="button"
              onClick={() => setIsSidebarProfileExpanded(!isSidebarProfileExpanded)}
              className="w-full flex items-center justify-between p-3 rounded-2xl bg-gray-50 dark:bg-gray-800 border border-gray-100 dark:border-gray-700 hover:bg-gray-100 dark:hover:bg-gray-750 transition-all cursor-pointer text-left focus:outline-none focus:ring-2 focus:ring-teal-500/20 group"
            >
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-teal-100 dark:bg-teal-950 flex items-center justify-center text-teal-700 dark:text-teal-300 shadow-inner group-hover:scale-105 transition-transform">
                  <UserIcon size={20} />
                </div>
                <div className="min-w-0">
                  <p className="text-sm font-bold text-gray-900 dark:text-gray-100 truncate leading-snug">{user?.username}</p>
                  <p className="text-xs text-gray-500 dark:text-gray-400 font-medium capitalize leading-none mt-0.5">{user?.admin_type?.replace('_', ' ')}</p>
                </div>
              </div>
              <ChevronDown 
                size={16} 
                className={cn(
                  "text-gray-400 dark:text-gray-500 transition-transform duration-250",
                  isSidebarProfileExpanded && "rotate-180 text-teal-600 dark:text-teal-400"
                )} 
              />
            </button>

            {/* Collapsible Options panel */}
            <AnimatePresence initial={false}>
              {isSidebarProfileExpanded && (
                <motion.div
                  initial={{ height: 0, opacity: 0, marginTop: 0 }}
                  animate={{ height: 'auto', opacity: 1, marginTop: 8 }}
                  exit={{ height: 0, opacity: 0, marginTop: 0 }}
                  className="overflow-hidden space-y-1.5"
                >
                  {/* Theme Selector */}
                  <div className="flex items-center justify-between p-2 pl-3 rounded-xl bg-gray-50/50 dark:bg-gray-800/50 border border-gray-100/50 dark:border-gray-700/50">
                    <span className="text-xs font-bold text-gray-500 dark:text-gray-400">Theme Mode</span>
                    <button
                      type="button"
                      onClick={toggleTheme}
                      className="p-1 px-2.5 rounded-lg bg-white dark:bg-gray-700 border border-gray-200 dark:border-gray-650 hover:bg-gray-50 dark:hover:bg-gray-600 text-gray-700 dark:text-gray-200 transition-all flex items-center gap-1.5 text-[11px] font-bold shadow-sm cursor-pointer"
                    >
                      {theme === 'dark' ? (
                        <>
                          <Moon size={12} className="text-teal-400" />
                          <span>Dark</span>
                        </>
                      ) : (
                        <>
                          <Sun size={12} className="text-amber-500" />
                          <span>Light</span>
                        </>
                      )}
                    </button>
                  </div>

                  {/* Logout Button */}
                  <button
                    onClick={handleLogout}
                    className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-xs font-bold text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-950/20 transition-colors border border-transparent hover:border-red-100 dark:hover:border-red-900/30 cursor-pointer"
                  >
                    <LogOut size={16} />
                    <span>Sign Out</span>
                  </button>
                </motion.div>
              )}
            </AnimatePresence>
          </div>

          <div className="flex-1 px-3 py-6 space-y-6 overflow-y-auto">
            {filteredSections.map((section, idx) => (
              <div key={idx} className="space-y-1.5">
                <h3 className="text-[10px] font-bold text-gray-450 dark:text-gray-500 uppercase tracking-widest px-3 select-none">
                  {section.title}
                </h3>
                <div className="space-y-1">
                  {section.items.map((item) => {
                    const isActive = item.matchPaths 
                      ? item.matchPaths.includes(location.pathname)
                      : location.pathname === item.path;

                    return (
                      <Link
                        key={item.path}
                        to={item.path}
                        onClick={() => !isDesktop && setIsOpen(false)}
                        className={cn(
                          "flex items-center gap-3 px-3 py-2 rounded-xl text-xs font-bold transition-all border border-transparent",
                          isActive
                            ? "bg-teal-50/70 dark:bg-teal-950/40 text-teal-700 dark:text-teal-400 border-teal-100/50 dark:border-teal-900/30 shadow-sm shadow-teal-700/5 font-black"
                            : "text-gray-600 dark:text-gray-300 hover:bg-gray-50/70 dark:hover:bg-gray-800/65 hover:text-gray-900 dark:hover:text-white"
                        )}
                      >
                        <span className={cn(
                          "transition-transform duration-300",
                          isActive ? "text-teal-600 dark:text-teal-400 scale-110" : "text-gray-400 dark:text-gray-500 group-hover:text-gray-600 dark:group-hover:text-gray-300"
                        )}>
                          {item.icon}
                        </span>
                        <span>{item.label}</span>
                      </Link>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>
        </div>
      </motion.aside>
    </>
  );
}

export function Topbar({ 
  isSidebarOpen,
  setIsSidebarOpen,
  theme,
  toggleTheme
}: { 
  isSidebarOpen: boolean;
  setIsSidebarOpen: () => void;
  theme: 'light' | 'dark';
  toggleTheme: () => void;
}) {
  const { user, logout } = useAuth();
  const [isProfileOpen, setIsProfileOpen] = useState(false);
  const navigate = useNavigate();
  const location = useLocation();

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  // Find current nav item label
  let activeLabel = '';
  for (const section of navSections) {
    const found = section.items.find(item => item.path === location.pathname || (item.matchPaths && item.matchPaths.includes(location.pathname)));
    if (found) {
      activeLabel = found.label;
      break;
    }
  }

  // Fallbacks for other dynamic routes or specific paths
  if (!activeLabel) {
    if (location.pathname.startsWith('/admin/student-form')) {
      activeLabel = 'Student Form';
    } else if (location.pathname.startsWith('/admin/home')) {
      activeLabel = 'Dashboard';
    } else if (location.pathname === '/admin/student-explorer') {
      activeLabel = 'Students';
    }
  }

  return (
    <header className="sticky top-0 z-45 h-16 bg-white dark:bg-gray-900 border-b border-gray-200 dark:border-gray-800 px-4 flex items-center justify-between">
      <div className="flex items-center gap-3">
        {!isSidebarOpen && (
          <button
            onClick={setIsSidebarOpen}
            className="p-2 text-gray-500 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-md transition-colors cursor-pointer animate-in fade-in duration-200"
          >
            <Menu size={24} />
          </button>
        )}
        {activeLabel && (
          <div className="flex items-center gap-3 sm:gap-4 overflow-x-auto py-1">
            <h2 className="text-lg md:text-xl font-bold text-gray-900 dark:text-gray-100 border-l-4 border-teal-600 pl-3 whitespace-nowrap">
              {activeLabel}
            </h2>
            {(location.pathname === '/admin/display' || location.pathname === '/admin/new') && (
              <TokenNavTabs />
            )}
            {(location.pathname === '/admin/call-task/display' || location.pathname === '/admin/call-task/new') && (
              <LeadNavTabs />
            )}
            {location.pathname === '/admin/app-activation' && (
              <ActivationNavTabs />
            )}
            {(location.pathname === '/admin/zoom-register' || location.pathname === '/admin/zoom-register-individual') && (
              <ZoomNavTabs />
            )}
            {(location.pathname === '/admin/transactions' || location.pathname === '/admin/recycle-bin') && (
              <AuditNavTabs />
            )}
            {(location.pathname === '/super-admin/admins' || location.pathname === '/super-admin/signup') && (
              <AdminNavTabs />
            )}
          </div>
        )}
      </div>
    </header>
  );
}

export function Shell({ children }: { children: React.ReactNode }) {
  const [isSidebarOpen, setIsSidebarOpen] = useState(() => {
    if (typeof window !== 'undefined') {
      return window.innerWidth >= 1024;
    }
    return true;
  });
  const { user } = useAuth();

  useEffect(() => {
    if (typeof window === 'undefined') return;
    let prevIsDesktop = window.innerWidth >= 1024;
    const handleResize = () => {
      const isDesktop = window.innerWidth >= 1024;
      if (isDesktop !== prevIsDesktop) {
        setIsSidebarOpen(isDesktop);
        prevIsDesktop = isDesktop;
      }
    };
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

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
      <div className={cn("flex flex-col min-h-screen transition-all duration-300 ease-in-out", isSidebarOpen ? "lg:ml-64" : "lg:ml-0")}>
        <Topbar isSidebarOpen={isSidebarOpen} setIsSidebarOpen={() => setIsSidebarOpen(!isSidebarOpen)} theme={theme} toggleTheme={toggleTheme} />
        <main className="flex-1 p-4 lg:px-6 lg:py-4">
          <div className="max-w-7xl mx-auto h-full">
            {children}
          </div>
        </main>
      </div>
    </div>
  );
}

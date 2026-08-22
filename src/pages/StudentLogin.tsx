import React, { useState, useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useStudentAuth } from '../hooks/useStudentAuth';
import AcademyLogo from '../components/AcademyLogo';
import { toast } from 'sonner';
import { motion } from 'motion/react';
import { LogIn, Lock, User as UserIcon, Eye, EyeOff, Sun, Moon, ArrowRight } from 'lucide-react';

export default function StudentLogin() {
  const [pcaid, setPcaid] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [logoFailed, setLogoFailed] = useState(false);

  // Theme State synchronized with system style
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

  const { loginStudent } = useStudentAuth();
  const navigate = useNavigate();

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!pcaid.trim() || !password.trim()) {
      toast.error('Please enter both PCA ID and password');
      return;
    }

    setIsLoading(true);

    try {
      const res = await loginStudent(pcaid.trim(), password.trim());
      if (res.success) {
        toast.success('Signed in successfully!');
        navigate('/student-portal');
      } else {
        toast.error(res.error || 'Invalid PCA ID or password');
      }
    } catch (err: any) {
      toast.error(err.message || 'Login failed. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-950 flex flex-col items-center justify-center p-4 transition-colors duration-200 selection:bg-teal-500 selection:text-white relative">
      {/* Top Bar for Theme Toggle */}
      <div className="absolute top-4 right-4 sm:top-6 sm:right-6">
        <button
          type="button"
          onClick={toggleTheme}
          className="p-2.5 text-gray-600 dark:text-gray-300 bg-white dark:bg-gray-900 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-xl transition-colors cursor-pointer border border-gray-200 dark:border-gray-800 shadow-sm"
          title={`Switch to ${theme === 'dark' ? 'Light' : 'Dark'} mode`}
          aria-label="Toggle Theme"
        >
          {theme === 'dark' ? (
            <Sun size={18} className="text-amber-400" />
          ) : (
            <Moon size={18} className="text-gray-600" />
          )}
        </button>
      </div>

      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="w-full max-w-md"
      >
        {/* Header Branding */}
        <div className="text-center mb-8 flex flex-col items-center">
          {!logoFailed ? (
            <img 
              src="/Logo.png" 
              alt="Physics Cube Academy" 
              className="max-h-[150px] w-auto mb-3 object-contain"
              onError={() => setLogoFailed(true)}
              referrerPolicy="no-referrer"
            />
          ) : (
            <AcademyLogo className="mb-3 transform scale-95 origin-center" width={150} height={150} showText={true} />
          )}
          <h2 className="text-2xl font-bold tracking-tight text-teal-700 dark:text-teal-400">
            Physics Cube Academy
          </h2>
          <p className="text-gray-500 dark:text-gray-400 font-normal text-base tracking-wide mt-0.5">
            Student Portal Login
          </p>
        </div>

        {/* Login Card */}
        <div className="bg-white dark:bg-gray-900 p-6 md:p-8 rounded-2xl shadow-xl shadow-teal-900/5 dark:shadow-none border border-gray-100 dark:border-gray-800 transition-colors space-y-4">
          <form onSubmit={handleLogin} className="space-y-4">
            {/* Username / PCA ID */}
            <div className="space-y-1.5">
              <label className="text-sm font-semibold text-gray-700 dark:text-gray-300 ml-0.5">
                Username (PCA ID)
              </label>
              <div className="relative">
                <div className="absolute inset-y-0 left-3 flex items-center pointer-events-none text-gray-400">
                  <UserIcon size={18} />
                </div>
                <input
                  type="text"
                  value={pcaid}
                  onChange={(e) => setPcaid(e.target.value.toUpperCase())}
                  className="w-full pl-10 pr-4 py-2.5 bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg focus:outline-none focus:ring-2 focus:ring-teal-500/20 text-gray-800 dark:text-white font-mono font-bold uppercase transition-all text-sm"
                  placeholder="e.g. BPM2701001"
                  required
                />
              </div>
            </div>

            {/* Password */}
            <div className="space-y-1.5">
              <label className="text-sm font-semibold text-gray-700 dark:text-gray-300 ml-0.5">
                Password
              </label>
              <div className="relative">
                <div className="absolute inset-y-0 left-3 flex items-center pointer-events-none text-gray-400">
                  <Lock size={18} />
                </div>
                <input
                  type={showPassword ? 'text' : 'password'}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full pl-10 pr-10 py-2.5 bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg focus:outline-none focus:ring-2 focus:ring-teal-500/20 text-gray-800 dark:text-white font-medium transition-all text-sm"
                  placeholder="Enter your password"
                  required
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute inset-y-0 right-3 flex items-center text-teal-600 hover:text-teal-700 dark:text-teal-400"
                >
                  {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                </button>
              </div>
            </div>

            {/* Submit Button */}
            <button
              type="submit"
              disabled={isLoading}
              className="w-full flex justify-center items-center py-2.5 px-4 border border-transparent rounded-lg shadow-md text-sm font-bold text-white bg-teal-600 hover:bg-teal-700 focus:outline-none focus:ring-2 focus:ring-teal-500/20 disabled:opacity-70 disabled:cursor-not-allowed transition-all mt-4 active:scale-95 cursor-pointer gap-2"
            >
              {isLoading ? (
                <div className="h-5 w-5 animate-spin rounded-full border-2 border-white border-t-transparent" />
              ) : (
                <>
                  <LogIn size={18} />
                  <span>Login</span>
                </>
              )}
            </button>
          </form>

          {/* Under Login Button Links */}
          <div className="pt-4 border-t border-gray-100 dark:border-gray-800 text-center">
            <Link
              to="/register"
              className="inline-flex items-center gap-1.5 text-xs font-semibold text-teal-600 dark:text-teal-400 hover:text-teal-700 dark:hover:text-teal-300 hover:underline cursor-pointer transition-colors"
            >
              <span>New Registration</span>
              <ArrowRight size={14} />
            </Link>
          </div>
        </div>

        <div className="mt-8 text-center text-gray-400 text-sm">
          &copy; {new Date().getFullYear()} Physics Cube Academy &bull; Student Portal
        </div>
      </motion.div>
    </div>
  );
}

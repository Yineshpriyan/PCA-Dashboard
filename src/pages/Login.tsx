import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import { useAuth } from '../hooks/useAuth';
import { logTransaction } from '../lib/transactions';
import { toast } from 'sonner';
import { motion } from 'motion/react';
import { Eye, EyeOff, Lock, User as UserIcon } from 'lucide-react';
import { User } from '../types';
import AcademyLogo from '../components/AcademyLogo';

export default function Login() {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [logoFailed, setLogoFailed] = useState(false);
  const { login } = useAuth();
  const navigate = useNavigate();

  const isConfigMissing = !import.meta.env.VITE_SUPABASE_URL || !import.meta.env.VITE_SUPABASE_ANON_KEY;

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();

    if (isConfigMissing) {
      toast.error('Supabase configuration is missing. Please check your environment variables.');
      return;
    }

    if (!username || !password) {
      toast.error('Please fill in all fields');
      return;
    }

    setLoading(true);
    try {
      let email = username.trim();

      if (!username.includes('@')) {
        // Look up the user's registered email by their username
        const { data: userProfile, error: profileErr } = await supabase
          .from('user')
          .select('*')
          .eq('username', username.trim())
          .maybeSingle();

        if (!profileErr && userProfile && 'email' in userProfile && userProfile.email) {
          email = userProfile.email;
        } else {
          // Default backward-compatible fallback format
          email = `${username.toLowerCase().trim()}@pca.academy`;
        }
      }

      const loginPromise = supabase.auth.signInWithPassword({
        email,
        password,
      });

      const timeoutPromise = new Promise((_, reject) => 
        setTimeout(() => reject(new Error('Request timed out after 10 seconds')), 10000)
      );

      const { data, error } = (await Promise.race([loginPromise, timeoutPromise])) as any;

      if (error) {
        toast.error(`Authentication error: ${error.message}`);
        console.error('Supabase Auth Error:', error);
        return;
      }

      if (!data || !data.user) {
        toast.error('Invalid username or password');
        return;
      }

      // Fetch user profile from public.user table
      const { data: profile, error: profileError } = await supabase
        .from('user')
        .select('*')
        .eq('id', data.user.id)
        .single();

      if (profileError || !profile) {
        toast.error('User registered in Auth but profile not found in database registry.');
        console.error('Profile fetch error:', profileError);
        return;
      }

      const userData = profile as User;
      login(userData);
      toast.success(`Welcome back, ${userData.username}!`);
      
      // Log successful login
      await logTransaction({
        admin_username: userData.username,
        action_type: 'LOGIN',
        entity_type: 'admin',
        entity_id: userData.id,
        details: `Logged into the PCA Portal`
      });
      
      navigate('/admin/home');
    } catch (err: any) {
      toast.error(err.message || 'An error occurred during login');
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-950 flex flex-col items-center justify-center p-4 transition-colors duration-200">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="w-full max-w-md"
      >
        <div className="text-center mb-10 flex flex-col items-center">
          {!logoFailed ? (
            <img 
              src="/Logo.png" 
              alt="Physics Cube Academy" 
              className="max-h-[170px] w-auto mb-4 object-contain"
              onError={() => setLogoFailed(true)}
              referrerPolicy="no-referrer"
            />
          ) : (
            <AcademyLogo className="mb-4 transform scale-95 origin-center" width={170} height={170} showText={true} />
          )}
          <h2 className="text-2xl font-bold tracking-tight mt-1 text-teal-700 dark:text-teal-400">
            Physics Cube Academy
          </h2>
          <p className="text-gray-500 dark:text-gray-400 font-normal text-lg tracking-wide mt-1">
            Student Management System
          </p>
        </div>

        <div className="bg-white dark:bg-gray-900 p-6 md:p-8 rounded-2xl shadow-xl shadow-teal-900/5 dark:shadow-none border border-gray-100 dark:border-gray-800 transition-colors">
          <form onSubmit={handleLogin} className="space-y-4">
            <div className="space-y-1.5">
              <label className="text-sm font-semibold text-gray-700 dark:text-gray-300 ml-0.5">Username</label>
              <div className="relative">
                <div className="absolute inset-y-0 left-3 flex items-center pointer-events-none text-gray-400">
                  <UserIcon size={18} />
                </div>
                <input
                  type="text"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  className="w-full pl-10 pr-4 py-2.5 bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg focus:outline-none focus:ring-2 focus:ring-teal-500/20 text-gray-800 dark:text-white font-medium transition-all text-sm"
                  placeholder="Enter username"
                  required
                />
              </div>
            </div>

            <div className="space-y-1.5">
              <label className="text-sm font-semibold text-gray-700 dark:text-gray-300 ml-0.5">Password</label>
              <div className="relative">
                <div className="absolute inset-y-0 left-3 flex items-center pointer-events-none text-gray-400">
                  <Lock size={18} />
                </div>
                <input
                  type={showPassword ? "text" : "password"}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full pl-10 pr-10 py-2.5 bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg focus:outline-none focus:ring-2 focus:ring-teal-500/20 text-gray-800 dark:text-white font-medium transition-all text-sm"
                  placeholder="Enter password"
                  required
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute inset-y-0 right-3 flex items-center text-teal-600 hover:text-teal-700"
                >
                  {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                </button>
              </div>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full flex justify-center items-center py-2.5 px-4 border border-transparent rounded-lg shadow-md text-sm font-bold text-white bg-teal-600 hover:bg-teal-700 focus:outline-none focus:ring-2 focus:ring-teal-500/20 disabled:opacity-70 disabled:cursor-not-allowed transition-all mt-6 active:scale-95"
            >
              {loading ? (
                <div className="h-5 w-5 animate-spin rounded-full border-2 border-white border-t-transparent" />
              ) : (
                'Login'
              )}
            </button>
          </form>
        </div>
        
        <div className="mt-8 text-center text-gray-400 text-sm">
          &copy; 2026 Admin Panel - PCA System
        </div>
      </motion.div>
    </div>
  );
}

import React, { createContext, useContext, useEffect, useState, useRef } from 'react';
import { supabase } from '../lib/supabase';
import { User } from '../types';

interface AuthContextType {
  user: User | null;
  login: (user: User) => void;
  logout: () => void;
  isLoading: boolean;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(() => {
    try {
      const cached = localStorage.getItem('pca_cached_user');
      return cached ? JSON.parse(cached) : null;
    } catch {
      return null;
    }
  });
  
  // If we have a cached user, we can immediately mount the App and verify the session in the background
  const [isLoading, setIsLoading] = useState(() => {
    try {
      return !localStorage.getItem('pca_cached_user');
    } catch {
      return true;
    }
  });

  const lastFetchedId = useRef<string | null>(null);

  const updateLocalUser = (u: User | null) => {
    setUser(u);
    try {
      if (u) {
        localStorage.setItem('pca_cached_user', JSON.stringify(u));
      } else {
        localStorage.removeItem('pca_cached_user');
      }
    } catch (e) {
      console.error('Error writing user session to cache:', e);
    }
  };

  const fetchProfile = async (userId: string, email?: string, userMetadata?: any) => {
    if (!supabase) return;
    if (lastFetchedId.current === userId) {
      // Already fetching or fetched this profile
      return;
    }
    lastFetchedId.current = userId;

    try {
      // Fetch with a timeout signal if needed, or simply let it run in background
      const { data, error } = await supabase
        .from('user')
        .select('*')
        .eq('id', userId)
        .maybeSingle();
      
      if (data) {
        updateLocalUser(data as User);
      } else if (!error) {
        // Only attempt auto-creation if there was no DB error and no profile was found
        const baseUsername = userMetadata?.full_name?.replace(/\s+/g, '').toLowerCase() || email?.split('@')[0] || 'user_' + userId.slice(0, 5);
        
        // Let's make sure the username is unique
        let uniqueUsername = baseUsername;
        let attempt = 1;
        while (true) {
          const { data: existingUser } = await supabase
            .from('user')
            .select('id')
            .eq('username', uniqueUsername)
            .maybeSingle();
          if (!existingUser) break;
          uniqueUsername = `${baseUsername}${attempt++}`;
        }

        const { data: newProfile, error: insertError } = await supabase
          .from('user')
          .insert({
            id: userId,
            username: uniqueUsername,
            admin_type: 'admin', // Default to admin role
            joined_date: new Date().toISOString()
          })
          .select()
          .single();

        if (newProfile && !insertError) {
          updateLocalUser(newProfile as User);
        } else {
          console.error('Failed to auto-create user profile:', insertError);
          updateLocalUser(null);
        }
      } else {
        // Database query failed (e.g. network offline, DB timeout). Fail fast to avoid nesting additional slow requests.
        console.error('Error fetching user profile:', error);
        // Do not clear the cached user if it's a network/database temporary timeout error
        if (!user) updateLocalUser(null);
      }
    } catch (e) {
      console.error('Error fetching user profile:', e);
      if (!user) updateLocalUser(null);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    if (!supabase) {
      setIsLoading(false);
      return;
    }

    let isMounted = true;

    // Safety timeout: If Supabase connection/auth takes more than 2.5 seconds (due to DB sleep/cold start),
    // stop blocking the main UI thread and fall back to whatever is cached or show the login screen.
    const sessionTimeout = setTimeout(() => {
      if (isMounted) {
        console.warn('Initial session check taking too long (possible DB sleep). Unblocking load state.');
        setIsLoading(false);
      }
    }, 2500);

    // Check initial session
    supabase.auth.getSession().then(({ data: { session } }) => {
      clearTimeout(sessionTimeout);
      if (!isMounted) return;
      if (session?.user) {
        fetchProfile(session.user.id, session.user.email, session.user.user_metadata);
      } else {
        updateLocalUser(null);
        setIsLoading(false);
      }
    }).catch((err) => {
      clearTimeout(sessionTimeout);
      console.error('Error getting initial session:', err);
      if (isMounted) {
        setIsLoading(false);
      }
    });

    // Listen for auth state changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (event, session) => {
        if (!isMounted) return;
        if (session?.user) {
          await fetchProfile(session.user.id, session.user.email, session.user.user_metadata);
        } else {
          updateLocalUser(null);
          lastFetchedId.current = null;
          setIsLoading(false);
        }
      }
    );

    return () => {
      isMounted = false;
      clearTimeout(sessionTimeout);
      subscription.unsubscribe();
    };
  }, []);


  const login = (userData: User) => {
    updateLocalUser(userData);
  };

  const logout = async () => {
    // Immediately clear local state so the UI updates to logged-out state instantly
    updateLocalUser(null);
    lastFetchedId.current = null;
    
    // Forcibly clear any Supabase-specific local storage tokens to guarantee sign-out succeeds locally
    try {
      for (let i = localStorage.length - 1; i >= 0; i--) {
        const key = localStorage.key(i);
        if (key && (key.startsWith('sb-') || key.includes('supabase.auth'))) {
          localStorage.removeItem(key);
        }
      }
    } catch (e) {
      console.error('Error clearing Supabase keys from localStorage:', e);
    }

    try {
      await supabase.auth.signOut();
    } catch (e) {
      console.error('Error signing out from Supabase:', e);
    }
  };

  return (
    <AuthContext.Provider value={{ user, login, logout, isLoading }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}

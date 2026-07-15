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
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const lastFetchedId = useRef<string | null>(null);

  const fetchProfile = async (userId: string, email?: string, userMetadata?: any) => {
    if (!supabase) return;
    if (lastFetchedId.current === userId) {
      // Already fetching or fetched this profile
      return;
    }
    lastFetchedId.current = userId;

    try {
      const { data, error } = await supabase
        .from('user')
        .select('*')
        .eq('id', userId)
        .maybeSingle();
      
      if (data && !error) {
        setUser(data as User);
      } else {
        // If profile not found, let's auto-create it (e.g. for Google Auth or newly registered OAuth users)
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
          setUser(newProfile as User);
        } else {
          console.error('Failed to auto-create user profile:', insertError);
          setUser(null);
        }
      }
    } catch (e) {
      console.error('Error fetching user profile:', e);
      setUser(null);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    if (!supabase) {
      setIsLoading(false);
      return;
    }

    // Check initial session
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session?.user) {
        fetchProfile(session.user.id, session.user.email, session.user.user_metadata);
      } else {
        setIsLoading(false);
      }
    }).catch((err) => {
      console.error('Error getting initial session:', err);
      setIsLoading(false);
    });

    // Listen for auth state changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (event, session) => {
        if (session?.user) {
          await fetchProfile(session.user.id, session.user.email, session.user.user_metadata);
        } else {
          setUser(null);
          lastFetchedId.current = null;
          setIsLoading(false);
        }
      }
    );

    return () => {
      subscription.unsubscribe();
    };
  }, []);


  const login = (userData: User) => {
    setUser(userData);
  };

  const logout = async () => {
    await supabase.auth.signOut();
    setUser(null);
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

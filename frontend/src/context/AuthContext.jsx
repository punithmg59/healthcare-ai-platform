import React, { createContext, useContext, useEffect, useState, useMemo, useCallback, useRef } from 'react';
import { supabase } from '../lib/supabase';
import toast from 'react-hot-toast';

const AuthContext = createContext({});

// Helper for promise timeout
const withTimeout = (promise, ms = 10000, errorMsg = 'Request timed out') => {
  return Promise.race([
    promise,
    new RegExp('timeout').test(errorMsg) 
      ? new Promise((_, reject) => setTimeout(() => reject(new Error(errorMsg)), ms))
      : new Promise((_, reject) => setTimeout(() => reject(new Error(errorMsg)), ms))
  ]);
};

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [profile, setProfile] = useState(null);
  const [loading, setLoading] = useState(true);
  const lastFetchedId = useRef(null);

  const fetchProfile = useCallback(async (userId) => {
    if (!userId) return null;
    
    // Prevent redundant fetches for the same user
    if (lastFetchedId.current === userId && profile) {
      return profile;
    }

    console.log(`🔐 Auth: Fetching profile for ${userId}...`);
    try {
      const { data, error } = await withTimeout(
        supabase.from('profiles').select('*').eq('id', userId).single(),
        8000,
        'Profile fetch timed out'
      );

      if (!error && data) {
        setProfile(data);
        lastFetchedId.current = userId;
        return data;
      }
      return null;
    } catch (err) {
      console.error('❌ Auth: Profile fetch error:', err);
      return null;
    }
  }, [profile]);

  useEffect(() => {
    let mounted = true;

    // Failsafe timeout: Force stop loading after 10 seconds
    const failsafe = setTimeout(() => {
      if (mounted && loading) {
        console.warn("⚠️ Auth: Failsafe triggered. Force-stopping loading state.");
        setLoading(false);
      }
    }, 10000);

    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, session) => {
      console.log(`🔐 Auth: onAuthStateChange [${event}]`);
      if (!mounted) return;
      
      try {
        const currentUser = session?.user ?? null;
        
        // Prevent setting loading=true for background refreshes
        const isInitialLoad = !user && event === 'INITIAL_SESSION';
        
        if (isInitialLoad && currentUser) {
            setLoading(true);
        }

        setUser(currentUser);
        
        if (event === 'INITIAL_SESSION' || event === 'SIGNED_IN' || event === 'USER_UPDATED') {
          if (currentUser) {
            const p = await fetchProfile(currentUser.id);
            
            // Auto-creation check
            if (!p && currentUser.email && (event === 'INITIAL_SESSION' || event === 'SIGNED_IN')) {
              console.log("🔐 Auth: Creating missing profile...");
              const { data: newProfile, error: createError } = await withTimeout(
                supabase.from('profiles').upsert({
                  id: currentUser.id,
                  email: currentUser.email,
                  full_name: currentUser.user_metadata?.full_name || currentUser.email.split('@')[0],
                  username: currentUser.user_metadata?.username || currentUser.email.split('@')[0],
                  phone: currentUser.user_metadata?.phone || '',
                }).select().single(),
                8000,
                'Profile creation timed out'
              );
              
              if (!createError && newProfile) {
                setProfile(newProfile);
                lastFetchedId.current = currentUser.id;
              }
            }
          } else {
            setProfile(null);
            lastFetchedId.current = null;
          }
        } else if (event === 'SIGNED_OUT') {
          setProfile(null);
          lastFetchedId.current = null;
        }
      } catch (err) {
        console.error("❌ Auth: Change listener error:", err);
      } finally {
        if (mounted) {
          setLoading(false);
          clearTimeout(failsafe);
        }
      }
    });

    return () => {
      mounted = false;
      subscription.unsubscribe();
      clearTimeout(failsafe);
    };
  }, [fetchProfile]);

  const signUp = async ({ email, password, full_name, phone, username }) => {
    console.log("🔐 Auth: Signup request received");
    try {
      const { data, error } = await withTimeout(
        supabase.auth.signUp({
          email,
          password,
          options: {
            data: {
              full_name,
              username: username || email.split('@')[0],
              phone,
            }
          }
        }),
        10000,
        'Signup request timed out'
      );

      if (error) throw error;

      if (data.user) {
        console.log("🔐 Auth: User created successfully. Syncing profile...");
        const { error: profileError } = await withTimeout(
          supabase.from('profiles').upsert([
            {
              id: data.user.id,
              full_name,
              email,
              phone,
              username: username || email.split('@')[0],
            },
          ]),
          8000,
          'Profile sync timed out'
        );
        
        if (profileError) console.warn("⚠️ Auth: Profile sync delayed:", profileError);
        return data;
      }
      return data;
    } catch (error) {
      console.error("❌ Auth: Signup error:", error);
      throw error;
    }
  };

  const signIn = async ({ email, password }) => {
    console.log("🔐 Auth: Login request received");
    try {
      const { data, error } = await withTimeout(
        supabase.auth.signInWithPassword({ email, password }),
        10000,
        'Login request timed out'
      );
      if (error) throw error;
      console.log("🔐 Auth: Login successful");
      return data;
    } catch (error) {
      console.error("❌ Auth: Login error:", error);
      throw error;
    }
  };

  const signOut = async () => {
    try {
      const { error } = await withTimeout(supabase.auth.signOut(), 5000, 'Logout timed out');
      if (error) throw error;
      setProfile(null);
      lastFetchedId.current = null;
    } catch (error) {
      console.error("❌ Auth: Logout error:", error);
      // Even if it fails, clear local state
      setUser(null);
      setProfile(null);
      lastFetchedId.current = null;
    }
  };

  const value = useMemo(() => ({
    user,
    profile,
    loading,
    signUp,
    signIn,
    signOut,
    updateProfile: async (updates) => {
      if (!user) throw new Error('No user logged in');
      try {
        setLoading(true);
        const { error } = await withTimeout(
          supabase.from('profiles').update(updates).eq('id', user.id),
          8000,
          'Profile update timed out'
        );
        if (error) throw error;
        await fetchProfile(user.id);
        toast.success('Profile updated');
        return { success: true };
      } catch (error) {
        toast.error(error.message);
        throw error;
      } finally {
        setLoading(false);
      }
    },
    refreshProfile: () => user && fetchProfile(user.id)
  }), [user, profile, loading, fetchProfile]);

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) throw new Error('useAuth must be used within an AuthProvider');
  return context;
};


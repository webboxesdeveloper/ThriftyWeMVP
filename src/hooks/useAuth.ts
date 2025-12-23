import { useEffect, useState, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';

export const useAuth = () => {
  const [userId, setUserId] = useState<string | null>(null); // profile id
  const [loading, setLoading] = useState(true);
  const [role, setRole] = useState<string | null>(null);
  const [userProfile, setUserProfile] = useState<{ username?: string; email?: string } | null>(null);
  const currentAuthUserIdRef = useRef<string | null>(null);
  const hasSyncedRef = useRef(false);

  useEffect(() => {
    let isMounted = true;
    let subscription: { unsubscribe: () => void } | null = null;
    let initialSessionLoaded = false; // Flag to track if initial session restoration is complete

    const init = async () => {
      // Set a timeout to ensure loading doesn't hang forever
      const timeoutId = setTimeout(() => {
        if (isMounted) {
          console.warn('Auth init timeout - clearing loading state');
          setLoading(false);
        }
      }, 10000); // 10 second timeout

      try {
        // STEP 1: Read session from sessionStorage FIRST (Best Practice)
        // This restores the session before any listeners can interfere
        const { data: { session: currentSession }, error: sessionError } = await supabase.auth.getSession();
        
        // STEP 2: Validate session with getUser() (Best Practice - keep this)
        // This ensures the token is still valid and not revoked
        if (currentSession) {
          try {
            const { data: { user }, error: userError } = await supabase.auth.getUser();
            if (!user || userError) {
              // Token is invalid or revoked, clear it
              console.warn('Invalid session token, clearing');
              await supabase.auth.signOut();
              if (isMounted) {
                setUserId(null);
                setRole(null);
                setUserProfile(null);
              }
              return;
            }
          } catch (userError) {
            // Network error or other issue - don't clear session immediately
            // Trust Supabase's autoRefreshToken to handle it
            console.warn('Error validating session, but keeping it:', userError);
            // Continue with session restoration
          }
        }

        const session = currentSession;

        // STEP 3: Restore session state
        if (session?.user && isMounted) {
          currentAuthUserIdRef.current = session.user.id;
          try {
            await syncProfileAndRole(session.user.id);
            hasSyncedRef.current = true;
          } catch (syncError) {
            console.error('Error syncing profile in init:', syncError);
            // Even if sync fails, we have a valid session
            // Set userId to auth user id so user stays logged in
            if (isMounted) {
              setUserId(session.user.id);
              setRole('user');
              setUserProfile({
                email: session.user.email || undefined,
              });
            }
          }
        } else if (isMounted) {
          // No session found in storage
          setUserId(null);
          setRole(null);
          setUserProfile(null);
        }

        // Mark initial session load as complete
        initialSessionLoaded = true;

        // STEP 4: NOW register onAuthStateChange listener AFTER session is restored
        // This prevents the listener from firing with null before session is loaded
        const { data: { subscription: authSubscription } } = supabase.auth.onAuthStateChange(async (event, session) => {
          if (!isMounted) return;

          // Ignore initial null events if we just loaded a session
          // Only process events after initial session restoration
          if (!initialSessionLoaded && !session) {
            return; // Ignore initial null event
          }

          // Only sync if the user ID actually changed or if we haven't synced yet
          const newAuthUserId = session?.user?.id || null;
          const authUserIdChanged = newAuthUserId !== currentAuthUserIdRef.current;
          const needsSync = authUserIdChanged || (newAuthUserId && !hasSyncedRef.current);

          if (session?.user) {
            currentAuthUserIdRef.current = session.user.id;
            
            if (needsSync) {
              setLoading(true);
              try {
                await syncProfileAndRole(session.user.id);
                hasSyncedRef.current = true;
              } catch (error) {
                console.error('Error in auth state change:', error);
                // Keep user logged in with session but use defaults
                if (isMounted) {
                  setUserId(session.user.id);
                  setRole('user');
                  setUserProfile({
                    email: session.user.email || undefined,
                  });
                }
              } finally {
                if (isMounted) {
                  setLoading(false);
                }
              }
            } else {
              if (isMounted) {
                setLoading(false);
              }
            }
          } else {
            // No session -> clear state (only after initial load)
            if (initialSessionLoaded) {
              currentAuthUserIdRef.current = null;
              hasSyncedRef.current = false;
              if (isMounted) {
                setUserId(null);
                setRole(null);
                setUserProfile(null);
                setLoading(false);
              }
            }
          }
        });
        subscription = authSubscription;
      } catch (error) {
        console.error('useAuth init error', error);
        // On error, try to restore session one more time
        try {
          const { data: { session: errorSession } } = await supabase.auth.getSession();
          if (errorSession?.user && isMounted) {
            setUserId(errorSession.user.id);
            setRole('user');
            setUserProfile({
              email: errorSession.user.email || undefined,
            });
          } else if (isMounted) {
            setUserId(null);
            setRole(null);
            setUserProfile(null);
          }
        } catch (sessionError) {
          if (isMounted) {
            setUserId(null);
            setRole(null);
            setUserProfile(null);
          }
        }
        initialSessionLoaded = true;
      } finally {
        clearTimeout(timeoutId);
        if (isMounted) {
          setLoading(false);
        }
      }
    };

    // Start initialization
    init();

    return () => {
      isMounted = false;
      if (subscription) {
        subscription.unsubscribe();
      }
    };
  }, []);

  const syncProfileAndRole = async (authUserId: string) => {
    try {
      // Ensure a user_profiles row exists with id = auth user id
      const { data: profile, error: selErr } = await supabase
        .from('user_profiles')
        .select('id, plz, username, email')
        .eq('id', authUserId)
        .single();

      if (selErr && selErr.code !== 'PGRST116') {
        // PGRST116 = no rows found, which is expected for new users
        console.error('Error fetching profile:', selErr);
        throw selErr;
      }

      if (!profile) {
        const authUser = (await supabase.auth.getUser()).data.user;
        const { data: inserted, error: insertError } = await supabase
          .from('user_profiles')
          .insert({ id: authUserId, email: authUser?.email })
          .select('id, username, email')
          .single();

        if (insertError) {
          console.error('Error creating profile:', insertError);
          throw insertError;
        }

        if (inserted) {
          setUserId(inserted.id);
          setUserProfile({
            username: inserted.username || undefined,
            email: inserted.email || authUser?.email || undefined,
          });
        }
      } else {
        setUserId(profile.id);
        setUserProfile({
          username: profile.username || undefined,
          email: profile.email || undefined,
        });
      }

      // Get roles for the profile
      const { data: roles, error: rolesError } = await supabase
        .from('user_roles')
        .select('role')
        .eq('user_id', authUserId);

      if (rolesError) {
        console.error('Error fetching roles:', rolesError);
        // Don't throw, just set default role
        setRole('user');
        return;
      }

      if (roles && roles.length > 0) {
        // Prefer admin if present
        const hasAdmin = roles.find((r: any) => r.role === 'admin');
        setRole(hasAdmin ? 'admin' : roles[0].role);
      } else {
        // If no role found, assign 'user' by default
        const { error: insertRoleError } = await supabase.from('user_roles').insert({ user_id: authUserId, role: 'user' });
        if (insertRoleError) {
          console.error('Error inserting default role:', insertRoleError);
        }
        setRole('user');
      }
    } catch (error) {
      console.error('syncProfileAndRole error', error);
      // Re-throw so caller can handle it
      throw error;
    }
  };

  const signIn = async (email: string, password: string) => {
    // Sign in with credentials
    // Supabase will handle clearing any existing session automatically
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) throw error;

    // After successful sign in, sync profile
    const authUser = (await supabase.auth.getUser()).data.user;
    if (authUser) {
      await syncProfileAndRole(authUser.id);
    }
  };

  const signUp = async (email: string, password: string, username?: string, plz?: string) => {
    // Use Supabase signUp with metadata to pass username and PLZ
    // The trigger will automatically create the profile with this metadata
    const { data, error } = await supabase.auth.signUp({ 
      email, 
      password,
      options: {
        data: {
          username: username || null,
          plz: plz || null,
        }
      }
    });
    
    // Handle Supabase auth errors with user-friendly messages
    if (error) {
      const errorMsg = error.message?.toLowerCase() || '';
      
      // Email already exists
      if (errorMsg.includes('already registered') || 
          errorMsg.includes('already exists') || 
          errorMsg.includes('user already registered') ||
          error.code === 'signup_disabled') {
        throw new Error('This email address is already registered. Please sign in instead or use a different email address.');
      }
      
      // Invalid email format
      if (errorMsg.includes('invalid email') || errorMsg.includes('email format')) {
        throw new Error('Please enter a valid email address (e.g., yourname@example.com).');
      }
      
      // Password too short
      if (errorMsg.includes('password') && (errorMsg.includes('short') || errorMsg.includes('length'))) {
        throw new Error('Password must be at least 6 characters long. Please choose a stronger password.');
      }
      
      // Weak password
      if (errorMsg.includes('weak password') || errorMsg.includes('password is too weak')) {
        throw new Error('Password is too weak. Please choose a stronger password with at least 6 characters.');
      }
      
      // Generic error with helpful message
      throw new Error(error.message || 'Failed to create account. Please check your information and try again.');
    }

    // The trigger handle_new_user() will automatically:
    // 1. Create user_profiles row with email, username, and PLZ from metadata
    // 2. Create user_roles row with 'user' role
    // No need to manually create/update profile - trigger handles it all

    // If a user object is returned (auto-confirmed), sync local state
    const createdUser = data?.user;
    if (createdUser) {
      // Wait a moment for trigger to complete
      await new Promise(resolve => setTimeout(resolve, 500));
      
      // Sync local state (profile should already exist from trigger)
      try {
        await syncProfileAndRole(createdUser.id);
      } catch (err) {
        console.error('Error syncing profile after signUp:', err);
        // Not fatal - trigger created profile, state will sync on next auth change
      }
    } else {
      // Email confirmation required - profile will be created when user confirms email
      // The trigger will handle profile creation automatically with metadata
    }

    return data;
  };

  const signOut = async () => {
    try {
      await supabase.auth.signOut();
    } catch (error) {
      console.error('Error during sign out:', error);
      // Even if signOut fails, clear local state and storage
      try {
        // Manually clear sessionStorage auth keys
        const keys = Object.keys(sessionStorage);
        keys.forEach(key => {
          if (key.startsWith('sb-')) {
            sessionStorage.removeItem(key);
          }
        });
      } catch {
        // Ignore storage errors
      }
    } finally {
      // Always clear local state
      setUserId(null);
      setRole(null);
      setUserProfile(null);
    }
  };

  const updatePLZ = async (plz: string) => {
    if (!userId) return;
    const { error } = await supabase
      .from('user_profiles')
      .update({ plz })
      .eq('id', userId);
    if (error) throw error;
  };

  return { userId, loading, role, userProfile, signIn, signUp, signOut, updatePLZ } as const;
};

export default useAuth;

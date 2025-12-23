import { useEffect, useState, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';

export const useAuth = () => {
  const [userId, setUserId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [role, setRole] = useState<string | null>(null);
  const [userProfile, setUserProfile] = useState<{ username?: string; email?: string } | null>(null);
  const currentAuthUserIdRef = useRef<string | null>(null);
  const hasSyncedRef = useRef(false);

  useEffect(() => {
    let isMounted = true;
    let subscription: { unsubscribe: () => void } | null = null;
    let initialSessionLoaded = false;

    const init = async () => {
      const timeoutId = setTimeout(() => {
        if (isMounted) {
          setLoading(false);
        }
      }, 10000);

      try {
        const { data: { session: currentSession }, error: sessionError } = await supabase.auth.getSession();
        
        if (currentSession) {
          try {
            const { data: { user }, error: userError } = await supabase.auth.getUser();
            if (!user || userError) {
              await supabase.auth.signOut();
              if (isMounted) {
                setUserId(null);
                setRole(null);
                setUserProfile(null);
              }
              return;
            }
          } catch (userError) {
          }
        }

        const session = currentSession;

        if (session?.user && isMounted) {
          currentAuthUserIdRef.current = session.user.id;
          try {
            await syncProfileAndRole(session.user.id);
            hasSyncedRef.current = true;
          } catch (syncError) {
            if (isMounted) {
              setUserId(session.user.id);
              setRole('user');
              setUserProfile({
                email: session.user.email || undefined,
              });
            }
          }
        } else if (isMounted) {
          setUserId(null);
          setRole(null);
          setUserProfile(null);
        }

        initialSessionLoaded = true;

        const { data: { subscription: authSubscription } } = supabase.auth.onAuthStateChange(async (event, session) => {
          if (!isMounted) return;

          if (!initialSessionLoaded && !session) {
            return;
          }

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
      const { data: profile, error: selErr } = await supabase
        .from('user_profiles')
        .select('id, plz, username, email')
        .eq('id', authUserId)
        .single();

      if (selErr && selErr.code !== 'PGRST116') {
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

      const { data: roles, error: rolesError } = await supabase
        .from('user_roles')
        .select('role')
        .eq('user_id', authUserId);

      if (rolesError) {
        setRole('user');
        return;
      }

      if (roles && roles.length > 0) {
        const hasAdmin = roles.find((r: any) => r.role === 'admin');
        setRole(hasAdmin ? 'admin' : roles[0].role);
      } else {
        const { error: insertRoleError } = await supabase.from('user_roles').insert({ user_id: authUserId, role: 'user' });
        if (insertRoleError) {
        }
        setRole('user');
      }
    } catch (error) {
      throw error;
    }
  };

  const signIn = async (email: string, password: string) => {
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) throw error;

    const authUser = (await supabase.auth.getUser()).data.user;
    if (authUser) {
      await syncProfileAndRole(authUser.id);
    }
  };

  const signUp = async (email: string, password: string, username?: string, plz?: string) => {
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
    
    if (error) {
      const errorMsg = error.message?.toLowerCase() || '';
      
      if (errorMsg.includes('already registered') || 
          errorMsg.includes('already exists') || 
          errorMsg.includes('user already registered') ||
          error.code === 'signup_disabled') {
        throw new Error('This email address is already registered. Please sign in instead or use a different email address.');
      }
      
      if (errorMsg.includes('invalid email') || errorMsg.includes('email format')) {
        throw new Error('Please enter a valid email address (e.g., yourname@example.com).');
      }
      
      if (errorMsg.includes('password') && (errorMsg.includes('short') || errorMsg.includes('length'))) {
        throw new Error('Password must be at least 6 characters long. Please choose a stronger password.');
      }
      
      if (errorMsg.includes('weak password') || errorMsg.includes('password is too weak')) {
        throw new Error('Password is too weak. Please choose a stronger password with at least 6 characters.');
      }
      
      throw new Error(error.message || 'Failed to create account. Please check your information and try again.');
    }

    const createdUser = data?.user;
    if (createdUser) {
      await new Promise(resolve => setTimeout(resolve, 500));
      
      try {
        await syncProfileAndRole(createdUser.id);
      } catch (err) {
      }
    }

    return data;
  };

  const signOut = async () => {
    try {
      await supabase.auth.signOut();
    } catch (error) {
      try {
        const keys = Object.keys(sessionStorage);
        keys.forEach(key => {
          if (key.startsWith('sb-')) {
            sessionStorage.removeItem(key);
          }
        });
      } catch {
      }
    } finally {
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

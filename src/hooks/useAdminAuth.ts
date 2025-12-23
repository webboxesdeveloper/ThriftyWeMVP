import { useEffect, useState, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useNavigate } from 'react-router-dom';

export const useAdminAuth = () => {
  const [isAdmin, setIsAdmin] = useState(false);
  const [loading, setLoading] = useState(true);
  const [userId, setUserId] = useState<string | null>(null);
  const navigate = useNavigate();
  const currentAuthUserIdRef = useRef<string | null>(null);
  const hasCheckedRef = useRef(false);

  useEffect(() => {
    let isMounted = true;

    const initCheck = async () => {
      try {
        await checkAdminStatus();
        hasCheckedRef.current = true;
      } catch (error) {
        console.error('Error in initial admin check:', error);
      }
    };

    initCheck();

    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (event, session) => {
        if (!isMounted) return;

        // Only check if the user ID actually changed or if we haven't checked yet
        const newAuthUserId = session?.user?.id || null;
        const authUserIdChanged = newAuthUserId !== currentAuthUserIdRef.current;
        const needsCheck = authUserIdChanged || (newAuthUserId && !hasCheckedRef.current);

        if (session?.user) {
          currentAuthUserIdRef.current = session.user.id;
          
          // Only set loading and check if we actually need to
          if (needsCheck) {
            setLoading(true);
            try {
              await checkAdminRole(session.user.id);
              hasCheckedRef.current = true;
            } catch (error) {
              console.error('Error in admin auth state change:', error);
              if (isMounted) {
                setIsAdmin(false);
                setUserId(null);
              }
            } finally {
              if (isMounted) {
                setLoading(false);
              }
            }
          }
        } else {
          // No session -> clear state
          currentAuthUserIdRef.current = null;
          hasCheckedRef.current = false;
          if (isMounted) {
            setIsAdmin(false);
            setUserId(null);
            setLoading(false);
          }
        }
      }
    );

    return () => {
      isMounted = false;
      subscription.unsubscribe();
    };
  }, []);

  const checkAdminStatus = async () => {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      
      if (session?.user) {
        await checkAdminRole(session.user.id);
      } else {
        setIsAdmin(false);
        setLoading(false);
      }
    } catch (error) {
      console.error('Error checking admin status:', error);
      setIsAdmin(false);
      setLoading(false);
    }
  };

  const checkAdminRole = async (authUserId: string) => {
    try {
      // Get user profile
      const { data: profile } = await supabase
        .from('user_profiles')
        .select('id')
        .eq('email', (await supabase.auth.getUser()).data.user?.email)
        .single();

      if (!profile) {
        setIsAdmin(false);
        setLoading(false);
        return;
      }

      setUserId(profile.id);

      // Check admin role
      const { data: roles } = await supabase
        .from('user_roles')
        .select('role')
        .eq('user_id', profile.id)
        .eq('role', 'admin');

      setIsAdmin(roles && roles.length > 0);
    } catch (error) {
      console.error('Error checking admin role:', error);
      setIsAdmin(false);
    } finally {
      setLoading(false);
    }
  };

  const signIn = async (email: string, password: string) => {
    const { error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    if (error) throw error;

    await checkAdminStatus();
  };

  const signOut = async () => {
    await supabase.auth.signOut();
    setIsAdmin(false);
    setUserId(null);
    navigate('/login');
  };

  return { isAdmin, loading, userId, signIn, signOut };
};

import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';

const ANONYMOUS_USER_KEY = 'mealdeal_anonymous_user_id';

export const useAnonymousAuth = () => {
  const [userId, setUserId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const initAnonymousUser = async () => {
      try {
        let storedUserId = localStorage.getItem(ANONYMOUS_USER_KEY);

        if (!storedUserId) {
          const { data, error } = await supabase
            .from('user_profiles')
            .insert({})
            .select()
            .single();

          if (error) throw error;

          storedUserId = data.id;
          localStorage.setItem(ANONYMOUS_USER_KEY, storedUserId);
        } else {
          const { error } = await supabase
            .from('user_profiles')
            .update({ last_seen: new Date().toISOString() })
            .eq('id', storedUserId);

          if (error) {
            const { data, error: createError } = await supabase
              .from('user_profiles')
              .insert({})
              .select()
              .single();

            if (createError) throw createError;
            
            storedUserId = data.id;
            localStorage.setItem(ANONYMOUS_USER_KEY, storedUserId);
          }
        }

        setUserId(storedUserId);
      } catch (error) {
      } finally {
        setLoading(false);
      }
    };

    initAnonymousUser();
  }, []);

  const updatePLZ = async (plz: string) => {
    if (!userId) return;

    const { error } = await supabase
      .from('user_profiles')
      .update({ plz })
      .eq('id', userId);

    if (error) {
      throw error;
    }
  };

  return { userId, loading, updatePLZ };
};

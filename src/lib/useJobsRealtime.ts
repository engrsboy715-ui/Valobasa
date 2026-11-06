import { useEffect, useRef } from 'react';
import { supabase } from '@/lib/supabase';

export function useJobsRealtime(onChange: () => void) {
  const handlerRef = useRef(onChange);
  handlerRef.current = onChange;

  useEffect(() => {
    const channel = supabase
      .channel('jobs-live')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'jobs' }, () => handlerRef.current())
      .subscribe();
    return () => {
      void supabase.removeChannel(channel);
    };
  }, []);
}

import { useEffect, useState } from 'react';
import { fetchMyPartnerKey } from '@/lib/supabase';

export function usePartnerStatus(active: boolean): boolean {
  const [isPartner, setIsPartner] = useState(false);

  useEffect(() => {
    if (!active) return;
    let cancelled = false;
    fetchMyPartnerKey()
      .then((key) => { if (!cancelled) setIsPartner(key?.status === 'approved'); })
      .catch(() => { if (!cancelled) setIsPartner(false); });
    return () => { cancelled = true; };
  }, [active]);

  return isPartner;
}

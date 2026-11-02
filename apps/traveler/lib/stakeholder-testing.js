import { useEffect, useState } from 'react';
import { apiFetch } from './api';

export function useStakeholderTesting() {
  const [enabled, setEnabled] = useState(false);
  useEffect(() => {
    let active = true;
    apiFetch('/v1/config').then((config) => {
      if (active) setEnabled(config.stakeholder_testing === true);
    }).catch(() => { if (active) setEnabled(false); });
    return () => { active = false; };
  }, []);
  return enabled;
}

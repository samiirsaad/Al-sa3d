import { useState, useEffect, useCallback } from 'react';
import { ExpiryAlert } from '../types';

interface UseInventoryResult {
  alerts: ExpiryAlert[];
  loading: boolean;
  error: string | null;
  loadAlerts: () => Promise<void>;
  disposeLot: (lotId: number, userId: number) => Promise<boolean>;
}

export const useInventory = (): UseInventoryResult => {
  const [alerts, setAlerts] = useState<ExpiryAlert[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadAlerts = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const result = await window.electronAPI.getExpiryAlerts();
      if (result.success && result.data) {
        setAlerts(result.data);
      } else {
        setError(result.error || 'Failed to load expiry alerts');
      }
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, []);

  const disposeLot = useCallback(async (lotId: number, userId: number): Promise<boolean> => {
    try {
      const result = await window.electronAPI.disposeExpiredLot(lotId, userId);
      return result.success;
    } catch {
      return false;
    }
  }, []);

  useEffect(() => {
    loadAlerts();
  }, [loadAlerts]);

  return {
    alerts,
    loading,
    error,
    loadAlerts,
    disposeLot,
  };
};
